/** biome-ignore-all lint/suspicious/noExplicitAny: Necessary for utility functions */

import { concurrencyFork, type Operation } from "iter-ops";

type UnknownIterable<T> = Iterable<T> | AsyncIterable<T>;

function isAsyncIterable<T>(value: UnknownIterable<T>): value is AsyncIterable<T> {
    return value != null && typeof (value as any)[Symbol.asyncIterator] === "function";
}

function isSyncIterable<T>(value: UnknownIterable<T>): value is Iterable<T> {
    return value != null && typeof (value as any)[Symbol.iterator] === "function";
}

function toAsyncIterable<T>(value: UnknownIterable<T>): AsyncIterable<T> {
    if (isAsyncIterable<T>(value)) {
        return value;
    }
    const sync = value as Iterable<T>;
    return {
        async *[Symbol.asyncIterator]() {
            for (const v of sync) {
                yield v;
            }
        },
    };
}

function mergeAsyncIterables<T>(iterables: AsyncIterable<T>[]): AsyncIterable<T> {
    return {
        async *[Symbol.asyncIterator]() {
            type Resolver = () => void;

            const queue: T[] = [];
            let pending: Resolver | null = null;
            let active = iterables.length;

            const wake = () => {
                if (pending) {
                    const r = pending;
                    pending = null;
                    r();
                }
            };

            const push = (value: T) => {
                queue.push(value);
                wake();
            };

            const markDone = () => {
                active -= 1;
                if (active === 0) {
                    wake();
                }
            };

            // Start a producer task for each iterable
            for (const it of iterables) {
                (async () => {
                    try {
                        for await (const v of it) {
                            push(v);
                        }
                    } finally {
                        markDone();
                    }
                })();
            }

            // Consumer loop
            while (active > 0 || queue.length > 0) {
                if (queue.length === 0) {
                    await new Promise<void>(res => {
                        pending = res;
                    });
                    continue;
                }

                const value = queue.shift() as T;
                yield value;
            }
        },
    };
}

/**
 * merge(...)
 *
 * Iter-ops operator that merges the *source* iterable with any number of
 * additional iterables.
 *
 * - In a sync pipeline: all iterables must be synchronous.
 * - In an async pipeline: you can mix sync + async; everything is promoted
 *   to async and merged concurrently.
 */
export function merge<T>(...others: UnknownIterable<T>[]): Operation<T, T> {
    return source =>
        concurrencyFork<T, T>({
            // Synchronous pipeline case
            onSync(i: Iterable<T>) {
                // For sync pipelines we only support merging sync iterables;
                // async ones would require promoting the whole pipeline to async.
                for (const o of others) {
                    if (!isSyncIterable<T>(o)) {
                        throw new TypeError(
                            "[merge] Cannot merge async iterable into a synchronous pipeline",
                        );
                    }
                }

                function* syncMerged(): Iterable<T> {
                    // source first
                    for (const v of i) {
                        yield v;
                    }
                    // then all others
                    for (const o of others as Iterable<T>[]) {
                        for (const v of o) {
                            yield v;
                        }
                    }
                }

                return syncMerged();
            },

            // Asynchronous pipeline case
            onAsync(i: AsyncIterable<T>) {
                const allAsync = [toAsyncIterable<T>(i), ...others.map(toAsyncIterable)];
                return mergeAsyncIterables(allAsync);
            },
        })(source);
}
