import { afterEach, describe, expect, it, vi } from 'vitest';

import { appSettingsSchema } from '../shared/contracts';
import { ScheduleController } from './schedule-controller';

afterEach(() => vi.useRealTimers());

describe('ScheduleController', () => {
  it('reports the exact next deadline and paused or manual states', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-20T01:00:00.000Z'));
    const onStatusChange = vi.fn();
    const scheduler = new ScheduleController({
      run: vi.fn(async () => undefined),
      onFailure: vi.fn(),
      onStatusChange,
    });

    scheduler.configure(appSettingsSchema.parse({ scheduleHours: 3 }));
    expect(scheduler.getStatus()).toEqual({
      state: 'active',
      intervalHours: 3,
      nextRunAt: '2026-07-20T04:00:00.000Z',
    });

    scheduler.configure(appSettingsSchema.parse({
      scheduleHours: 3,
      schedulePaused: true,
    }));
    expect(scheduler.getStatus()).toEqual({
      state: 'paused', intervalHours: 3, nextRunAt: null,
    });

    scheduler.configure(appSettingsSchema.parse({ scheduleHours: null }));
    expect(scheduler.getStatus()).toEqual({
      state: 'manual', intervalHours: null, nextRunAt: null,
    });
    expect(onStatusChange).toHaveBeenLastCalledWith({
      state: 'manual', intervalHours: null, nextRunAt: null,
    });
  });

  it('reports a running state before starting a fresh interval', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-20T01:00:00.000Z'));
    let finishRun!: () => void;
    const run = vi.fn(() => new Promise<void>((resolve) => { finishRun = resolve; }));
    const onStatusChange = vi.fn();
    const scheduler = new ScheduleController({
      run,
      onFailure: vi.fn(),
      onStatusChange,
    });
    scheduler.configure(appSettingsSchema.parse({ scheduleHours: 1 }));

    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
    expect(scheduler.getStatus()).toEqual({
      state: 'running', intervalHours: 1, nextRunAt: null,
    });

    finishRun();
    await vi.advanceTimersByTimeAsync(0);
    expect(scheduler.getStatus()).toEqual({
      state: 'active',
      intervalHours: 1,
      nextRunAt: '2026-07-20T03:00:00.000Z',
    });
    expect(onStatusChange).toHaveBeenLastCalledWith(scheduler.getStatus());
  });

  it('tracks run-now work without moving the automatic deadline', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-20T01:00:00.000Z'));
    let finishRun!: () => void;
    const run = vi.fn(() => new Promise<void>((resolve) => { finishRun = resolve; }));
    const onStatusChange = vi.fn();
    const scheduler = new ScheduleController({
      run,
      onFailure: vi.fn(),
      onStatusChange,
    });
    scheduler.configure(appSettingsSchema.parse({ scheduleHours: 3 }));
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);

    const operation = scheduler.runNow();
    expect(scheduler.getStatus()).toEqual({
      state: 'running', intervalHours: 3, nextRunAt: null,
    });
    await expect(scheduler.runNow()).rejects.toThrow(
      'Schedule generation is already active.',
    );

    finishRun();
    await operation;
    await vi.advanceTimersByTimeAsync(0);
    expect(scheduler.getStatus()).toEqual({
      state: 'active',
      intervalHours: 3,
      nextRunAt: '2026-07-20T04:00:00.000Z',
    });
    expect(onStatusChange).toHaveBeenLastCalledWith(scheduler.getStatus());
  });

  it('reports run-now work in manual mode', async () => {
    let finishRun!: () => void;
    const scheduler = new ScheduleController({
      run: () => new Promise<void>((resolve) => { finishRun = resolve; }),
      onFailure: vi.fn(),
    });
    scheduler.configure(appSettingsSchema.parse({ scheduleHours: null }));

    const operation = scheduler.runNow();
    expect(scheduler.getStatus()).toEqual({
      state: 'running', intervalHours: null, nextRunAt: null,
    });

    await Promise.resolve();
    finishRun();
    await operation;
    await Promise.resolve();
    expect(scheduler.getStatus()).toEqual({
      state: 'manual', intervalHours: null, nextRunAt: null,
    });
  });

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

  it('preserves the deadline for unrelated settings updates', async () => {
    vi.useFakeTimers();
    const run = vi.fn(async () => undefined);
    const scheduler = new ScheduleController({ run, onFailure: vi.fn() });
    scheduler.configure(appSettingsSchema.parse({ scheduleHours: 24 }));

    await vi.advanceTimersByTimeAsync(23 * 60 * 60 * 1000);
    scheduler.configure(
      appSettingsSchema.parse({ scheduleHours: 24, quality: 'high' }),
    );
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);

    expect(run).toHaveBeenCalledTimes(1);
  });

  it('waits for an in-flight scheduled run during disposal', async () => {
    vi.useFakeTimers();
    let finishRun!: () => void;
    const run = vi.fn(() => new Promise<void>((resolve) => { finishRun = resolve; }));
    const scheduler = new ScheduleController({ run, onFailure: vi.fn() });
    scheduler.configure(appSettingsSchema.parse({ scheduleHours: 1 }));
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);

    let disposed = false;
    const disposal = scheduler.dispose().then(() => { disposed = true; });
    await Promise.resolve();
    expect(disposed).toBe(false);

    finishRun();
    await disposal;
    expect(disposed).toBe(true);
  });

  it('absorbs a scheduled failure while disposal waits for cleanup', async () => {
    vi.useFakeTimers();
    let rejectRun!: (error: Error) => void;
    const run = vi.fn(() => new Promise<void>((_resolve, reject) => {
      rejectRun = reject;
    }));
    const onFailure = vi.fn();
    const scheduler = new ScheduleController({ run, onFailure });
    scheduler.configure(appSettingsSchema.parse({ scheduleHours: 1 }));
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);

    const disposal = scheduler.dispose();
    rejectRun(new Error('offline'));

    await expect(disposal).resolves.toBeUndefined();
    expect(onFailure).toHaveBeenCalledOnce();
  });
});
