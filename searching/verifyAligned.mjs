// usage: node verifyAligned.mjs <catalog.json> <out.json>
import fs from 'fs';

const [, , inFile, outFile] = process.argv;
const entries = JSON.parse(fs.readFileSync(inFile, 'utf8'));
const BASE = 'https://git.door43.org';
const CONCURRENCY = 8;

function rawUrl(entry, path) {
  const ref = entry.branch_or_tag_name;
  const kind = entry.ref_type ? entry.ref_type : (/^v\d/.test(ref) ? 'tag' : 'branch');
  return `${BASE}/${entry.full_name}/raw/${kind}/${encodeURIComponent(ref)}/${path.replace(/^\.\//, '')}`;
}

// stream file and stop as soon as \zaln is seen
async function hasZaln(url) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 60000);
      const res = await fetch(url, {signal: ctrl.signal});
      if (res.status !== 200) {
        clearTimeout(timer);
        return {status: res.status, found: false};
      }
      const decoder = new TextDecoder();
      let tail = '';
      for await (const chunk of res.body) {
        const text = tail + decoder.decode(chunk, {stream: true});
        if (text.includes('\\zaln')) {
          ctrl.abort();
          clearTimeout(timer);
          return {status: 200, found: true};
        }
        tail = text.slice(-8);
      }
      clearTimeout(timer);
      return {status: 200, found: false};
    } catch (e) {
      if (attempt === 3) return {status: 'error', found: false, error: String(e)};
    }
  }
}

async function check(entry) {
  const books = (entry.ingredients || []).filter((i) => i.path && /\.usfm$/i.test(i.path) && i.exists !== false);
  books.sort((a, b) => (b.identifier === 'tit') - (a.identifier === 'tit'));
  const result = {
    language: entry.language,
    full_name: entry.full_name,
    stage: entry.stage,
    ref: entry.branch_or_tag_name,
    url: `${BASE}/${entry.full_name}`,
    usfmBooks: books.length,
    alignedBook: null,
    booksChecked: 0,
    errors: [],
  };
  for (const book of books) {
    const url = rawUrl(entry, book.path);
    const r = await hasZaln(url);
    result.booksChecked++;
    if (r.status !== 200) result.errors.push(`${book.identifier}: ${r.status}`);
    if (r.found) {
      result.alignedBook = book.identifier;
      result.alignedUrl = url;
      break;
    }
  }
  return result;
}

const results = [];
let next = 0;
async function worker() {
  while (next < entries.length) {
    const entry = entries[next++];
    const r = await check(entry);
    results.push(r);
    process.stderr.write(`${results.length}/${entries.length} ${r.full_name} -> ${r.alignedBook || 'NOT ALIGNED'}\n`);
  }
}
await Promise.all(Array.from({length: CONCURRENCY}, worker));
results.sort((a, b) => a.language.localeCompare(b.language) || a.full_name.localeCompare(b.full_name));
fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
