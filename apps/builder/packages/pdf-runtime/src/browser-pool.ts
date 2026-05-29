import type { BrowserPoolConfig } from "./types";

type BrowserLike = {
  newPage: () => Promise<PageLike>;
  close: () => Promise<void>;
};

type PageLike = {
  setContent: (html: string, options?: { waitUntil?: string }) => Promise<void>;
  pdf: (options?: Record<string, unknown>) => Promise<Uint8Array>;
  close: () => Promise<void>;
};

type LaunchBrowser = () => Promise<BrowserLike>;

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );
    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

interface BrowserSlot {
  browser: BrowserLike;
  inUsePages: number;
}

export class BrowserPool {
  private readonly config: BrowserPoolConfig;
  private readonly launchBrowser: LaunchBrowser;
  private readonly slots: BrowserSlot[] = [];
  private crashCount = 0;

  constructor(config: BrowserPoolConfig, launchBrowser: LaunchBrowser) {
    this.config = config;
    this.launchBrowser = launchBrowser;
  }

  async withPage<T>(
    task: (page: PageLike) => Promise<T>,
  ): Promise<{ value: T; queueWaitMs: number }> {
    const acquired = await withTimeout(
      this.acquireSlot(),
      this.config.queueTimeoutMs,
      "Pool acquire",
    );
    const { slot, queueWaitMs } = acquired;
    const page = await withTimeout(
      slot.browser.newPage(),
      this.config.taskTimeoutMs,
      "newPage",
    ).catch((error) => {
      this.crashCount += 1;
      throw error;
    });

    try {
      const value = await withTimeout(
        task(page),
        this.config.taskTimeoutMs,
        "Page task",
      );
      return { value, queueWaitMs };
    } catch (error) {
      this.crashCount += 1;
      throw error;
    } finally {
      await page.close().catch(() => undefined);
      slot.inUsePages -= 1;
    }
  }

  getCrashCount(): number {
    return this.crashCount;
  }

  async shutdown(): Promise<void> {
    const closing = this.slots.map((slot) =>
      slot.browser.close().catch(() => undefined),
    );
    await Promise.all(closing);
    this.slots.length = 0;
  }

  private async acquireSlot(): Promise<{
    slot: BrowserSlot;
    queueWaitMs: number;
  }> {
    const start = Date.now();
    const reusable = this.slots.find(
      (slot) => slot.inUsePages < this.config.maxPagesPerBrowser,
    );
    if (reusable) {
      reusable.inUsePages += 1;
      return { slot: reusable, queueWaitMs: Date.now() - start };
    }

    if (this.slots.length < this.config.maxBrowsers) {
      const browser = await withTimeout(
        this.launchBrowser(),
        this.config.launchTimeoutMs,
        "Browser launch",
      );
      const slot: BrowserSlot = { browser, inUsePages: 1 };
      this.slots.push(slot);
      return { slot, queueWaitMs: Date.now() - start };
    }

    return new Promise((resolve, reject) => {
      const tick = () => {
        const available = this.slots.find(
          (slot) => slot.inUsePages < this.config.maxPagesPerBrowser,
        );
        if (available) {
          available.inUsePages += 1;
          resolve({ slot: available, queueWaitMs: Date.now() - start });
          return;
        }

        if (Date.now() - start >= this.config.queueTimeoutMs) {
          reject(new Error("Pool acquire timed out"));
          return;
        }

        setTimeout(tick, 20);
      };

      tick();
    });
  }
}
