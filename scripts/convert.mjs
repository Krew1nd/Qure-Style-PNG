import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { Resvg } from '@resvg/resvg-js';

const root = process.cwd();
const source = path.resolve(process.argv[2] || '.upstream');
const sha256 = b => crypto.createHash('sha256').update(b).digest('hex');
const write = (p, b) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, b); };
const json = p => JSON.parse(fs.readFileSync(p, 'utf8'));
function files(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    if (e.isSymbolicLink()) throw new Error(`Symlink rejected: ${p}`);
    return e.isDirectory() ? files(p, base) : [path.relative(base, p).split(path.sep).join('/')];
  }).sort();
}
function pngOK(buf) {
  return buf.length > 32 && buf.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))
    && buf.readUInt32BE(16) === 256 && buf.readUInt32BE(20) === 256;
}
const sourceIcons = path.join(source, 'icon/svg');
const inputs = files(sourceIcons).filter(p => p.toLowerCase().endsWith('.svg'));
if (!inputs.length) throw new Error('No upstream icons; refusing empty sync');
const upstreamCommit = execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (!/^[a-f0-9]{40}$/.test(upstreamCommit)) throw new Error('Invalid upstream commit');
const statePath = path.join(root, 'sync-state.json');
const old = fs.existsSync(statePath) ? json(statePath) : {};
const renderer = `resvg-2.6.2-256-v1`;
const records = {};
const generated = new Map();
let rendered = 0;
// Stage every render in memory. A single failure never publishes partial output.
for (const rel of inputs) {
  const raw = fs.readFileSync(path.join(sourceIcons, rel));
  if (raw.length > 10 * 1024 * 1024) throw new Error(`SVG too large: ${rel}`);
  const text = raw.toString('utf8');
  if (/<(?:script|foreignObject)\b/i.test(text) || /<!ENTITY\b/i.test(text)
    || /(?:href\s*=\s*["']\s*(?!#|data:)[^"']+|url\(\s*["']?(?:https?:|file:|\/))/i.test(text)) {
    throw new Error(`Unsafe or external SVG content: ${rel}`);
  }
  const svgHash = sha256(raw);
  const pngRel = rel.replace(/\.svg$/i, '.png');
  const output = path.join(root, 'icon/png', pngRel);
  let png;
  if (old.renderer === renderer && old.icons?.[rel]?.svg_sha256 === svgHash && fs.existsSync(output)) {
    const cached = fs.readFileSync(output);
    if (pngOK(cached) && sha256(cached) === old.icons[rel].png_sha256) png = cached;
  }
  if (!png) {
    png = Buffer.from(new Resvg(text, {
      fitTo: { mode: 'width', value: 256 },
      font: { loadSystemFonts: false },
    }).render().asPng());
    if (!pngOK(png)) throw new Error(`Not a 256x256 PNG: ${rel}`);
    rendered++;
  }
  generated.set(`icon/png/${pngRel}`, png);
  generated.set(`upstream/svg/${rel}`, raw);
  records[rel] = { svg_sha256: svgHash, png_sha256: sha256(png) };
}
// Copy original licenses and corresponding source (including GPL-derived assets).
for (const rel of files(path.join(source, 'licenses'))) {
  generated.set(`upstream/licenses/${rel}`, fs.readFileSync(path.join(source, 'licenses', rel)));
}
for (const name of ['THIRD_PARTY_NOTICES.md', 'README.md', 'README_en.md']) {
  generated.set(`upstream/${name}`, fs.readFileSync(path.join(source, name)));
}
const packageFile = path.join(source, 'Other/Qure-Style-SVG.json');
const originalPackage = json(packageFile);
generated.set('upstream/Qure-Style-SVG.json', fs.readFileSync(packageFile));
const repository = process.env.GITHUB_REPOSITORY || 'Krew1nd/Qure-Style-PNG';
const base = `https://raw.githubusercontent.com/${repository}/main/icon/png/`;
const expectedPrefix = 'https://raw.githubusercontent.com/aaANDkk/Qure_Style_SVG/main/icon/svg/';
const listed = new Set();
const icons = originalPackage.icons.map(item => {
  if (!item.url.startsWith(expectedPrefix)) throw new Error(`Unexpected upstream icon URL: ${item.url}`);
  const rel = decodeURIComponent(item.url.slice(expectedPrefix.length));
  if (!Object.hasOwn(records, rel)) throw new Error(`Manifest points to missing SVG: ${rel}`);
  if (listed.has(rel)) throw new Error(`Duplicate manifest path: ${rel}`);
  listed.add(rel);
  const pngRel = rel.replace(/\.svg$/i, '.png');
  return { ...item, name: item.name.replace(/\.svg$/i, '.png'), url: base + pngRel.split('/').map(encodeURIComponent).join('/') };
});
if (listed.size !== inputs.length) throw new Error('Upstream manifest does not cover every icon');
const pack = {
  ...originalPackage,
  name: 'Qure-Style-PNG',
  description: 'Qure 风格 256×256 PNG 图标集；SVG 原作者 aaANDkk，风格参考 Koolson/Qure。仅学习交流，非商业用途。',
  icons,
};
generated.set('Other/Qure-Style-PNG.json', Buffer.from(JSON.stringify(pack, null, 2) + '\n'));
const counts = Object.fromEntries([...new Set(inputs.map(p => p.split('/')[0]))].sort().map(k => [k, inputs.filter(p => p.startsWith(k + '/')).length]));
const state = { upstream: 'aaANDkk/Qure_Style_SVG', upstream_commit: upstreamCommit, renderer, size: 256, count: inputs.length, categories: counts, icons: records };
generated.set('sync-state.json', Buffer.from(JSON.stringify(state, null, 2) + '\n'));
for (const [rel, bytes] of generated) write(path.join(root, rel), bytes);
// Delete only inside explicitly managed directories, never user/config files.
let removed = 0;
for (const dir of ['icon/png', 'upstream']) {
  for (const rel of files(path.join(root, dir))) {
    const fullRel = `${dir}/${rel}`;
    if (!generated.has(fullRel)) { fs.unlinkSync(path.join(root, fullRel)); removed++; }
  }
}
console.log(JSON.stringify({ upstreamCommit, count: inputs.length, categories: counts, rendered, removed }));
