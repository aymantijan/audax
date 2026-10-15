import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectLink, normalizeUrl, parseLinkLines, parseProgramme, isUrl } from '../src/utils/links.js';

test('services are recognised from the link', () => {
  assert.equal(detectLink('https://drive.google.com/drive/folders/abc').provider, 'gdrive');
  assert.equal(detectLink('https://drive.google.com/drive/folders/abc').folder, true);
  assert.equal(detectLink('https://1drv.ms/f/s!xyz').label, 'OneDrive');
  assert.equal(detectLink('https://univ-x.sharepoint.com/:f:/g/abc').provider, 'onedrive');
  assert.equal(detectLink('https://www.dropbox.com/scl/fo/abc').provider, 'dropbox');
  assert.equal(detectLink('https://youtu.be/xyz').type, 'video');
  const pdf = detectLink('https://site.edu/cours/chapitre_3-bilan.pdf');
  assert.deepEqual([pdf.provider, pdf.type, pdf.name], ['pdf', 'article', 'chapitre 3 bilan']);
  assert.equal(detectLink('https://www.khanacademy.org/math').label, 'khanacademy.org');
});

test('links typed without https still work', () => {
  assert.equal(normalizeUrl('drive.google.com/x'), 'https://drive.google.com/x');
  assert.equal(isUrl('drive.google.com/x'), true);
  assert.equal(isUrl('pas un lien'), false);
});

test('a pasted list of links, with or without titles', () => {
  const rows = parseLinkLines(`Cours magistral | https://drive.google.com/drive/folders/1
https://youtu.be/abc
TD 2 : https://site.edu/td2.pdf
une ligne sans lien`);
  assert.deepEqual(rows.map((r) => [r.title, r.provider]), [['Cours magistral', 'gdrive'], ['YouTube', 'youtube'], ['TD 2', 'pdf']]);
});

test('a pasted plan becomes chapters and tasks', () => {
  const ch = parseProgramme(`1. Introduction https://drive.google.com/file/d/1
  - Lire le chapitre
  - Faire les exercices
2. Le bilan
• Actif et passif
3. Le compte de résultat`);
  assert.deepEqual(ch.map((c) => [c.title, c.items.length]), [['1. Introduction', 2], ['2. Le bilan', 1], ['3. Le compte de résultat', 0]]);
  assert.equal(ch[0].url, 'https://drive.google.com/file/d/1');
  assert.equal(ch[1].items[0].title, 'Actif et passif');
});
