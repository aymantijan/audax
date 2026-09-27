// Test-only module resolver: app modules import each other without extensions
// (`./constants`), which Vite resolves but plain Node doesn't. Retries a
// relative specifier with `.js`, then `/index.js`. Registered by _register.mjs.
export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context);
  } catch (err) {
    const relative = specifier.startsWith('./') || specifier.startsWith('../');
    if (!relative || /\.[mc]?[jt]sx?$/.test(specifier) || err?.code !== 'ERR_MODULE_NOT_FOUND') throw err;
    for (const ext of ['.js', '/index.js']) {
      try { return await next(specifier + ext, context); } catch { /* try next */ }
    }
    throw err;
  }
}
