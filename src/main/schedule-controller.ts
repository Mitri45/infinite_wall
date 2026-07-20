import type { AppSettings, ScheduleStatus } from '../shared/contracts';

interface ScheduleControllerOptions {
  readonly run: () => Promise<void>;
  readonly onFailure: (message: string) => void;
  readonly onStatusChange?: (status: ScheduleStatus) => void;
  readonly now?: () => number;
  readonly setTimer?: (callback: () => void, delayMs: number) => NodeJS.Timeout;
  readonly clearTimer?: (timer: NodeJS.Timeout) => void;
}

export class ScheduleController {
  readonly #run: () => Promise<void>;
  readonly #onFailure: (message: string) => void;
  readonly #onStatusChange: NonNullable<ScheduleControllerOptions['onStatusChange']>;
  readonly #now: NonNullable<ScheduleControllerOptions['now']>;
  readonly #setTimer: NonNullable<ScheduleControllerOptions['setTimer']>;
  readonly #clearTimer: NonNullable<ScheduleControllerOptions['clearTimer']>;
  #timer: NodeJS.Timeout | null = null;
  #activeRun: Promise<void> | null = null;
  #nextRunAt: number | null = null;
  #settings: AppSettings | null = null;
  #disposed = false;
  #revision = 0;

  constructor(options: ScheduleControllerOptions) {
    this.#run = options.run;
    this.#onFailure = options.onFailure;
    this.#onStatusChange = options.onStatusChange ?? (() => undefined);
    this.#now = options.now ?? Date.now;
    this.#setTimer = options.setTimer ?? setTimeout;
    this.#clearTimer = options.clearTimer ?? clearTimeout;
  }

  configure(settings: AppSettings): void {
    const scheduleChanged =
      this.#settings === null ||
      this.#settings.scheduleHours !== settings.scheduleHours ||
      this.#settings.schedulePaused !== settings.schedulePaused;
    this.#settings = settings;
    if (!scheduleChanged) {
      return;
    }
    this.#revision += 1;
    this.#clearScheduledTimer();
    this.#scheduleNext();
  }

  getStatus(): ScheduleStatus {
    const intervalHours = this.#settings?.scheduleHours ?? null;
    if (!intervalHours) {
      return { state: 'manual', intervalHours: null, nextRunAt: null };
    }
    if (this.#settings?.schedulePaused) {
      return { state: 'paused', intervalHours, nextRunAt: null };
    }
    if (this.#activeRun) {
      return { state: 'running', intervalHours, nextRunAt: null };
    }
    return {
      state: 'active',
      intervalHours,
      nextRunAt: new Date(
        this.#nextRunAt ?? this.#now() + intervalHours * 60 * 60 * 1000,
      ).toISOString(),
    };
  }

  async dispose(): Promise<void> {
    this.#disposed = true;
    this.#revision += 1;
    this.#clearScheduledTimer();
    await this.#activeRun;
  }

  #scheduleNext(revision = this.#revision): void {
    const hours = this.#settings?.scheduleHours;
    if (this.#disposed || this.#timer || !hours || this.#settings?.schedulePaused) {
      this.#publishStatus();
      return;
    }
    this.#nextRunAt = this.#now() + hours * 60 * 60 * 1000;
    this.#timer = this.#setTimer(() => {
      this.#timer = null;
      this.#nextRunAt = null;
      const activeRun = this.#run();
      this.#activeRun = activeRun;
      this.#publishStatus();
      void activeRun
        .catch(() => {
          this.#onFailure(
            'Scheduled wallpaper generation failed. Infinite Wall will try again at the next interval.',
          );
        })
        .finally(() => {
          if (this.#activeRun === activeRun) this.#activeRun = null;
          if (revision === this.#revision) {
            this.#scheduleNext(revision);
          } else {
            this.#publishStatus();
          }
        });
    }, hours * 60 * 60 * 1000);
    this.#timer.unref?.();
    this.#publishStatus();
  }

  #clearScheduledTimer(): void {
    if (this.#timer) {
      this.#clearTimer(this.#timer);
      this.#timer = null;
    }
    this.#nextRunAt = null;
  }

  #publishStatus(): void {
    if (!this.#disposed) {
      this.#onStatusChange(this.getStatus());
    }
  }
}
