import { describe, expect, it, vi } from 'vitest';

import { RendererEventQueue } from './renderer-event-queue';

describe('RendererEventQueue', () => {
  it('holds the latest event until the renderer signals readiness', () => {
    const queue = new RendererEventQueue<string>();
    const send = vi.fn();

    queue.sendOrQueue('generate', send);
    queue.sendOrQueue('surprise', send);
    expect(send).not.toHaveBeenCalled();

    queue.markReady(send);
    expect(send).toHaveBeenCalledWith('surprise');
  });

  it('queues again while a renderer reloads', () => {
    const queue = new RendererEventQueue<string>();
    const send = vi.fn();
    queue.markReady(send);
    queue.sendOrQueue('first', send);
    queue.markLoading();
    queue.sendOrQueue('after-reload', send);

    expect(send).toHaveBeenCalledTimes(1);
    queue.markReady(send);
    expect(send).toHaveBeenLastCalledWith('after-reload');
  });
});
