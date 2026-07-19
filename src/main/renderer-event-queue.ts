export class RendererEventQueue<T> {
  #ready = false;
  #pending: T | null = null;

  sendOrQueue(value: T, send: (value: T) => void): void {
    if (this.#ready) {
      send(value);
      return;
    }
    this.#pending = value;
  }

  markReady(send: (value: T) => void): void {
    this.#ready = true;
    if (this.#pending === null) {
      return;
    }
    const pending = this.#pending;
    this.#pending = null;
    send(pending);
  }

  markLoading(): void {
    this.#ready = false;
  }
}
