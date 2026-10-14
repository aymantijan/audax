// All built-in book catalogs in one module, loaded on demand by
// readingsStore.seedCatalog (G9): ~200 KB that the app no longer downloads
// at startup, only when Lectures / Bibliothèque is opened.
import { BOOK_CATALOG } from './book-catalog';
import { BOOK_CATALOG_V2 } from './book-catalog-2';
import { BOOK_CATALOG_V3 } from './book-catalog-3';
import { BOOK_CATALOG_V4 } from './book-catalog-4';

export const ALL_BOOKS = [...BOOK_CATALOG, ...BOOK_CATALOG_V2, ...BOOK_CATALOG_V3, ...BOOK_CATALOG_V4];
