// Loaded with `node --import ./tests/_register.mjs --test …` (see package.json).
import { register } from 'node:module';

register('./_resolve.mjs', import.meta.url);
