/**
 * program-api.js — Supabase CRUD layer for Programme.
 *
 * Programme is 100% database-backed (no localStorage).  Every function here
 * talks directly to Supabase and returns plain JS objects.  The programStore
 * caches the results in memory.
 *
 * Convention: every mutating function returns the upserted row(s) so the
 * caller can update its in-memory cache without a second round-trip.
 */
//
// Split into ./program-api/ (F3): the functions live in three files by theme;
// this barrel keeps every existing `import * as api from '…/program-api'` working.

export * from './program-api/structure';
export * from './program-api/daily';
export * from './program-api/progress';
