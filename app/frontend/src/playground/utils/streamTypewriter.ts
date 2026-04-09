/**
 * Stream typewriter utility
 *
 * Buffers incoming stream chunks and emits text at a steady cadence so
 * assistant responses feel progressively typed instead of chunk-populated.
 */

export interface StreamTypewriterOptions {
  tickMs?: number;
  charsPerTick?: number;
  burstMultiplier?: number;
  maxBufferedChars?: number;
  onUpdate: (nextText: string) => void;
}

export interface StreamTypewriterController {
  enqueue: (chunk: string) => void;
  flush: () => void;
  complete: (options?: { maxWaitMs?: number }) => Promise<void>;
  stop: () => void;
  getDisplayedText: () => string;
}

const DEFAULT_TICK_MS = 24;
const DEFAULT_CHARS_PER_TICK = 5;
const DEFAULT_BURST_MULTIPLIER = 4;
const DEFAULT_MAX_BUFFERED_CHARS = 1200;

export const createStreamTypewriter = (
  options: StreamTypewriterOptions,
): StreamTypewriterController => {
  const tickMs = options.tickMs ?? DEFAULT_TICK_MS;
  const charsPerTick = options.charsPerTick ?? DEFAULT_CHARS_PER_TICK;
  const burstMultiplier = options.burstMultiplier ?? DEFAULT_BURST_MULTIPLIER;
  const maxBufferedChars = options.maxBufferedChars ?? DEFAULT_MAX_BUFFERED_CHARS;

  let displayedText = "";
  let pendingBuffer = "";
  let intervalId: number | null = null;
  let idleResolvers: Array<() => void> = [];

  const resolveIdle = (): void => {
    if (pendingBuffer.length || intervalId !== null) return;
    if (idleResolvers.length === 0) return;
    const resolvers = idleResolvers;
    idleResolvers = [];
    resolvers.forEach((resolve) => resolve());
  };

  const drainOnce = (): void => {
    if (!pendingBuffer.length) return;

    const shouldBurst = pendingBuffer.length > maxBufferedChars;
    const chunkSize = shouldBurst ? charsPerTick * burstMultiplier : charsPerTick;
    const nextSlice = pendingBuffer.slice(0, chunkSize);

    pendingBuffer = pendingBuffer.slice(nextSlice.length);
    displayedText += nextSlice;
    options.onUpdate(displayedText);
  };

  const ensureTimer = (): void => {
    if (intervalId !== null) return;
    intervalId = window.setInterval(() => {
      drainOnce();
      if (!pendingBuffer.length) {
        window.clearInterval(intervalId!);
        intervalId = null;
        resolveIdle();
      }
    }, tickMs);
  };

  const waitForIdle = (maxWaitMs: number): Promise<void> => {
    if (!pendingBuffer.length && intervalId === null) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      let settled = false;
      const done = (): void => {
        if (settled) return;
        settled = true;
        resolve();
      };

      idleResolvers.push(done);

      window.setTimeout(() => {
        if (settled) return;
        // Safety: never leave trailing text behind even under heavy throttling.
        if (pendingBuffer.length) {
          displayedText += pendingBuffer;
          pendingBuffer = "";
          options.onUpdate(displayedText);
        }
        if (intervalId !== null) {
          window.clearInterval(intervalId);
          intervalId = null;
        }
        done();
      }, maxWaitMs);
    });
  };

  return {
    enqueue: (chunk: string): void => {
      if (!chunk) return;
      pendingBuffer += chunk;
      ensureTimer();
    },
    flush: (): void => {
      if (pendingBuffer.length) {
        displayedText += pendingBuffer;
        pendingBuffer = "";
        options.onUpdate(displayedText);
      }
      if (intervalId !== null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
      resolveIdle();
    },
    complete: async (completeOptions?: { maxWaitMs?: number }): Promise<void> => {
      ensureTimer();
      await waitForIdle(completeOptions?.maxWaitMs ?? 4500);
    },
    stop: (): void => {
      if (intervalId !== null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
      pendingBuffer = "";
      resolveIdle();
    },
    getDisplayedText: (): string => displayedText,
  };
};
