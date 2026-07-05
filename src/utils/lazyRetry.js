// Wraps React.lazy()'s dynamic import so a stale chunk (old tab open across a
// new deploy — the hashed filename it's asking for no longer exists on the
// server) triggers ONE automatic hard reload instead of a permanent crash
// screen. sessionStorage guards against a reload loop if the failure is a real
// network outage rather than a stale build.
export function lazyWithRetry(importFn, chunkName) {
  return async () => {
    const key = `audax-chunk-retry:${chunkName}`;
    try {
      const mod = await importFn();
      sessionStorage.removeItem(key); // success — clear any prior retry flag
      return mod;
    } catch (err) {
      const alreadyRetried = sessionStorage.getItem(key);
      const isChunkError = /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i.test(
        err?.message || ''
      );
      if (isChunkError && !alreadyRetried) {
        sessionStorage.setItem(key, '1');
        window.location.reload();
        // Never resolves — the reload navigates away before this matters.
        return new Promise(() => {});
      }
      throw err;
    }
  };
}
