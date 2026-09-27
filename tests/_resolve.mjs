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

// Vite injects `import.meta.env` at build time; under plain Node it is
// undefined. Give app modules an empty env (no Supabase, no keys) in tests.
export async function load(url, context, next) {
  const out = await next(url, context);
  if (out.format === 'module' && url.includes('/src/') && out.source) {
    const src = String(out.source);
    if (src.includes('import.meta.env')) return { ...out, source: src.replaceAll('import.meta.env', '(globalThis.__VITE_ENV__ || { MODE: "test", DEV: false, PROD: false })') };
  }
  return out;
}
