// usage: node toTsv.mjs <catalog.json> <results.json> <out.tsv>
import fs from 'fs';
const [, , catFile, resFile, outFile] = process.argv;
const cat = JSON.parse(fs.readFileSync(catFile, 'utf8'));
const res = JSON.parse(fs.readFileSync(resFile, 'utf8'));
const order = {};
for (const e of cat) {
  const m = {};
  (e.ingredients || []).forEach((i, n) => { m[i.identifier] = (typeof i.sort === 'number' ? i.sort : n); });
  order[e.full_name] = m;
}
const lines = [['language', 'full_name', 'stage', 'ref', 'aligned', 'checked_books', 'url', 'checked_usfm_url'].join('\t')];
for (const r of res) {
  const o = order[r.full_name] || {};
  const books = [...r.alignedBooks].sort((a, b) => (o[a] ?? 999) - (o[b] ?? 999));
  lines.push([r.language, r.full_name, r.stage, r.ref, books.length > 0, books.join(','), r.url, r.alignedUrl || ''].join('\t'));
}
fs.writeFileSync(outFile, lines.join('\n') + '\n');
