export class InFlightLimitError extends Error {
  readonly code = "IN_FLIGHT_LIMIT";

  constructor() {
    super("外部APIの同時実行数上限に達しています");
    this.name = "InFlightLimitError";
  }
}

export type InFlightStats = {
  active: number;
  max: number;
  mapSize: number;
  deduplicated: number;
  rejected: number;
};

export const FANZA_MAX_CONCURRENT_REQUESTS = 20;

/** Shares identical work while bounding distinct external requests. */
export class InFlightLimiter {
  private readonly requests = new Map<string, Promise<unknown>>();
  private active = 0;
  private deduplicated = 0;
  private rejected = 0;
  private readonly maxConcurrent: number;

  constructor(maxConcurrent: number) {
    if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1) {
      throw new RangeError("maxConcurrent must be a positive integer");
    }
    this.maxConcurrent = maxConcurrent;
  }

  run<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const existing = this.requests.get(key) as Promise<T> | undefined;

    // Sharing always precedes the capacity check.
    if (existing) {
      this.deduplicated += 1;
      return existing;
    }

    if (this.active >= this.maxConcurrent) {
      this.rejected += 1;
      throw new InFlightLimitError();
    }

    this.active += 1;
    let promise: Promise<T>;
    try {
      promise = operation();
    } catch (error) {
      this.active -= 1;
      throw error;
    }

    this.requests.set(key, promise);
    promise
      .finally(() => {
        if (this.requests.get(key) === promise) {
          this.requests.delete(key);
          this.active -= 1;
        }
      })
      .catch(() => {});

    return promise;
  }

  stats(): InFlightStats {
    return {
      active: this.active,
      max: this.maxConcurrent,
      mapSize: this.requests.size,
      deduplicated: this.deduplicated,
      rejected: this.rejected,
    };
  }
}

export const fanzaInFlightLimiter = new InFlightLimiter(
  FANZA_MAX_CONCURRENT_REQUESTS
);
let lastStatsLogAt = 0;

export function fanzaRequestKey(url: string) {
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete("api_id");
    parsed.searchParams.delete("affiliate_id");
    parsed.search = new URLSearchParams(
      [...parsed.searchParams.entries()].sort(([left], [right]) =>
        left.localeCompare(right)
      )
    ).toString();
    return parsed.toString();
  } catch {
    return url.replace(/([?&])(api_id|affiliate_id)=[^&]*/g, "$1$2=[redacted]");
  }
}

export function withFanzaInFlight<T>(
  url: string,
  operation: () => Promise<T>
) {
  try {
    return fanzaInFlightLimiter.run(fanzaRequestKey(url), operation);
  } finally {
    const now = Date.now();
    if (now - lastStatsLogAt >= 60_000) {
      lastStatsLogAt = now;
      console.info("FANZA API in-flight summary", {
        timestamp: new Date(now).toISOString(),
        ...fanzaInFlightLimiter.stats(),
      });
    }
  }
}
