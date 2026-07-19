import type { AppSettings } from '../shared/contracts';

interface ScheduleControllerOptions {
  readonly run: () => Promise<void>;
  readonly onFailure: (message: string) => void;
  readonly setTimer?: (callback: () => void, delayMs: number) => NodeJS.Timeout;
  readonly clearTimer?: (timer: NodeJS.Timeout) => void;
}

export class ScheduleController {
  readonly #run: () => Promise<void>;
  readonly #onFailure: (message: string) => void;
  readonly #setTimer: NonNullable<ScheduleControllerOptions['setTimer']>;
  readonly #clearTimer: NonNullable<ScheduleControllerOptions['clearTimer']>;
  #timer: NodeJS.Timeout | null = null;
  #activeRun: Promise<void> | null = null;
  #settings: AppSettings | null = null;
  #disposed = false;
  #revision = 0;

  constructor(options: ScheduleControllerOptions) {
    this.#run = options.run;
    this.#onFailure = options.onFailure;
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

  async dispose(): Promise<void> {
    this.#disposed = true;
    this.#revision += 1;
    this.#clearScheduledTimer();
    await this.#activeRun;
  }

  #scheduleNext(revision = this.#revision): void {
    const hours = this.#settings?.scheduleHours;
    if (this.#disposed || this.#timer || !hours || this.#settings?.schedulePaused) {
      return;
    }
    this.#timer = this.#setTimer(() => {
      this.#timer = null;
      const activeRun = this.#run()
        .catch(() => {
          this.#onFailure(
            'Scheduled wallpaper generation failed. Infinite Wall will try again at the next interval.',
          );
        })
        .finally(() => {
          if (this.#activeRun === activeRun) this.#activeRun = null;
          if (revision === this.#revision) this.#scheduleNext(revision);
        });
      this.#activeRun = activeRun;
    }, hours * 60 * 60 * 1000);
    this.#timer.unref?.();
  }

  #clearScheduledTimer(): void {
    if (this.#timer) {
      this.#clearTimer(this.#timer);
      this.#timer = null;
    }
  }
}
