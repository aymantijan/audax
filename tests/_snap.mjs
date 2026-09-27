const mod = await import(process.argv[2]);
const store = mod[process.argv[3]];
const s = store.getInitialState ? store.getInitialState() : store.getState();
const shape = Object.fromEntries(Object.keys(s).sort().map((k) => [k, typeof s[k] === 'function' ? `fn/${s[k].length}/${String(s[k]).replace(/\s+/g, ' ')}` : JSON.stringify(s[k])]));
const opts = store.persist?.getOptions?.() || {};
console.log(JSON.stringify({ keys: Object.keys(shape).length, persist: { name: opts.name, version: opts.version, hasMerge: !!opts.merge, hasMigrate: !!opts.migrate, hasPartialize: !!opts.partialize }, shape }));
