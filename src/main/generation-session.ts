interface ActiveGeneration {
  readonly controller: AbortController;
  cancellable: boolean;
}

export class GenerationSessionController {
  #active: ActiveGeneration | null = null;
  readonly #idleWaiters = new Set<() => void>();

  get busy(): boolean {
    return this.#active !== null;
  }

  start(): AbortController {
    if (this.#active) {
      throw new Error('A generation session is already active.');
    }
    const controller = new AbortController();
    this.#active = { controller, cancellable: true };
    return controller;
  }

  lockCancellation(controller: AbortController): void {
    if (this.#active?.controller === controller) {
      this.#active.cancellable = false;
    }
  }

  finish(controller: AbortController): void {
    if (this.#active?.controller === controller) {
      this.#active = null;
      for (const resolve of this.#idleWaiters) {
        resolve();
      }
      this.#idleWaiters.clear();
    }
  }

  cancel(): boolean {
    if (!this.#active?.cancellable) {
      return false;
    }
    this.#active.controller.abort();
    return true;
  }

  dispose(): void {
    this.#active?.controller.abort();
  }

  waitForIdle(): Promise<void> {
    if (!this.#active) {
      return Promise.resolve();
    }
    return new Promise((resolve) => this.#idleWaiters.add(resolve));
  }
}
