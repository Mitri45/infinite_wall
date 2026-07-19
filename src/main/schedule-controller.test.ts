import { afterEach, describe, expect, it, vi } from 'vitest';

import { appSettingsSchema } from '../shared/contracts';
import { ScheduleController } from './schedule-controller';

afterEach(() => vi.useRealTimers());

describe('ScheduleController', () => {
  it('waits until the next interval after a scheduled failure', async () => {
    vi.useFakeTimers();
    const run = vi.fn(async () => { throw new Error('offline'); });
    const onFailure = vi.fn();
    const scheduler = new ScheduleController({ run, onFailure });
    scheduler.configure(appSettingsSchema.parse({ scheduleHours: 1 }));

    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
    expect(run).toHaveBeenCalledTimes(1);
    expect(onFailure).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(59 * 60 * 1000);
    expect(run).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60 * 1000);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('does not schedule when disabled or paused', async () => {
    vi.useFakeTimers();
    const run = vi.fn(async () => undefined);
    const scheduler = new ScheduleController({ run, onFailure: vi.fn() });
    scheduler.configure(appSettingsSchema.parse({ scheduleHours: 1, schedulePaused: true }));
    await vi.advanceTimersByTimeAsync(2 * 60 * 60 * 1000);
    expect(run).not.toHaveBeenCalled();
    scheduler.configure(appSettingsSchema.parse({ scheduleHours: null }));
    await vi.runAllTimersAsync();
    expect(run).not.toHaveBeenCalled();
  });

  it('does not duplicate timers when settings change during a run', async () => {
    vi.useFakeTimers();
    let finishFirst!: () => void;
    const firstRun = new Promise<void>((resolve) => { finishFirst = resolve; });
    const run = vi.fn().mockImplementationOnce(() => firstRun).mockResolvedValue(undefined);
    const scheduler = new ScheduleController({ run, onFailure: vi.fn() });
    scheduler.configure(appSettingsSchema.parse({ scheduleHours: 1 }));
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
    expect(run).toHaveBeenCalledTimes(1);

    scheduler.configure(appSettingsSchema.parse({ scheduleHours: 3 }));
    finishFirst();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(3 * 60 * 60 * 1000);
    expect(run).toHaveBeenCalledTimes(2);
  });
});
