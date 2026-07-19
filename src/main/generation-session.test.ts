import { describe, expect, it } from 'vitest';

import { GenerationSessionController } from './generation-session';

describe('GenerationSessionController', () => {
  it('cancels an active generation before persistence', () => {
    const sessions = new GenerationSessionController();
    const controller = sessions.start();

    expect(sessions.cancel()).toBe(true);
    expect(controller.signal.aborted).toBe(true);
  });

  it('stops accepting cancellation once persistence begins', () => {
    const sessions = new GenerationSessionController();
    const controller = sessions.start();
    sessions.lockCancellation(controller);

    expect(sessions.cancel()).toBe(false);
    expect(controller.signal.aborted).toBe(false);
  });

  it('aborts and waits for active generation cleanup during shutdown', async () => {
    const sessions = new GenerationSessionController();
    const controller = sessions.start();
    sessions.lockCancellation(controller);
    const idle = sessions.waitForIdle();

    sessions.dispose();

    expect(controller.signal.aborted).toBe(true);
    expect(sessions.busy).toBe(true);
    sessions.finish(controller);
    await idle;
    expect(sessions.busy).toBe(false);
  });
});
