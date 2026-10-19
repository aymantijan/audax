import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GENRES } from '../src/utils/reading-genres.js';
import { BOOK_CATALOG } from '../src/utils/book-catalog.js';
import { BOOK_CATALOG_V2 } from '../src/utils/book-catalog-2.js';
import { BOOK_CATALOG_V3 } from '../src/utils/book-catalog-3.js';
import { BOOK_CATALOG_V4 } from '../src/utils/book-catalog-4.js';
import { BOOK_CATALOG_V5 } from '../src/utils/book-catalog-5.js';

const ALL = [...BOOK_CATALOG, ...BOOK_CATALOG_V2, ...BOOK_CATALOG_V3, ...BOOK_CATALOG_V4, ...BOOK_CATALOG_V5];
const key = (b) => `${b.title}|${b.author}`.toLowerCase();

test('every catalog book has a known genre and usable figures', () => {
  for (const b of ALL) {
    assert.ok(GENRES.includes(b.genre), `${b.title}: ${b.genre}`);
    assert.ok(b.pages > 0 && Number.isInteger(b.year) && b.title && b.author, b.title);
  }
});

test('the new finance books are not duplicates of the catalog', () => {
  const before = new Set([...BOOK_CATALOG, ...BOOK_CATALOG_V2, ...BOOK_CATALOG_V3, ...BOOK_CATALOG_V4].map(key));
  const titles = new Set([...BOOK_CATALOG, ...BOOK_CATALOG_V2, ...BOOK_CATALOG_V3, ...BOOK_CATALOG_V4].map((b) => b.title.toLowerCase()));
  const seen = new Set();
  for (const b of BOOK_CATALOG_V5) {
    assert.ok(!before.has(key(b)) && !titles.has(b.title.toLowerCase()), `already there: ${b.title}`);
    assert.ok(!seen.has(key(b)), `twice: ${b.title}`);
    seen.add(key(b));
  }
});

test('trading, investing and financial education each have a real shelf', () => {
  for (const g of ['Trading', 'Finance & Investing', 'Personal Finance']) {
    assert.ok(ALL.filter((b) => b.genre === g).length >= 25, g);
  }
});
