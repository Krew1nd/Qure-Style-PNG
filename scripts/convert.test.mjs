import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const project = process.cwd();
test('full conversion, manifest mapping, idempotence and safe stale-file cleanup', t => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qure-png-test-'));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  fs.mkdirSync(path.join(tmp, '.upstream'), { recursive: true });
  fs.cpSync(path.join(project, 'scripts'), path.join(tmp, 'scripts'), { recursive: true });
  fs.cpSync(path.join(project, 'node_modules'), path.join(tmp, 'node_modules'), { recursive: true });
  fs.cpSync(path.join(project, 'package.json'), path.join(tmp, 'package.json'));
  fs.cpSync(path.join(project, 'package-lock.json'), path.join(tmp, 'package-lock.json'));
  fs.cpSync(path.join(project, '.upstream/icon/svg'), path.join(tmp, '.upstream/icon/svg'), { recursive: true });
  fs.cpSync(path.join(project, '.upstream/licenses'), path.join(tmp, '.upstream/licenses'), { recursive: true });
  for (const f of ['Other/Qure-Style-SVG.json', 'README.md', 'README_en.md', 'THIRD_PARTY_NOTICES.md']) {
    fs.mkdirSync(path.dirname(path.join(tmp, '.upstream', f)), { recursive: true });
    fs.copyFileSync(path.join(project, '.upstream', f), path.join(tmp, '.upstream', f));
  }
  fs.mkdirSync(path.join(tmp, '.upstream/.git'), { recursive: true });
  const git = (...args) => spawnSync('git', args, { cwd: path.join(tmp, '.upstream'), encoding: 'utf8' });
  for (const args of [['init', '-q'], ['config', 'user.email', 'test@example.invalid'], ['config', 'user.name', 'Test'], ['add', '.'], ['commit', '-qm', 'fixture']]) {
    const r = git(...args); assert.equal(r.status, 0, r.stderr);
  }
  const run = () => spawnSync('node', ['scripts/convert.mjs', '.upstream'], { cwd: tmp, encoding: 'utf8' });
  let r = run(); assert.equal(r.status, 0, r.stderr);
  const summary = JSON.parse(r.stdout); assert.ok(summary.count >= 2200); assert.equal(summary.rendered, summary.count);
  const state = JSON.parse(fs.readFileSync(path.join(tmp, 'sync-state.json')));
  const listed = JSON.parse(fs.readFileSync(path.join(tmp, 'Other/Qure-Style-PNG.json')));
  assert.equal(state.count, summary.count); assert.equal(listed.icons.length, summary.count);
  for (const [p, record] of Object.entries(state.icons)) {
    const out = path.join(tmp, 'icon/png', p.replace(/\.svg$/i, '.png'));
    const png = fs.readFileSync(out);
    assert.deepEqual([...png.subarray(0, 8)], [137,80,78,71,13,10,26,10]);
    assert.equal(png.readUInt32BE(16), 256); assert.equal(png.readUInt32BE(20), 256);
    assert.equal(requireHash(png), record.png_sha256);
  }
  fs.mkdirSync(path.join(tmp, 'icon/png/obsolete'), { recursive: true });
  fs.writeFileSync(path.join(tmp, 'icon/png/obsolete/test.png'), 'stale');
  fs.writeFileSync(path.join(tmp, 'DO-NOT-DELETE'), 'protected');
  r = run(); assert.equal(r.status, 0, r.stderr);
  assert.equal(JSON.parse(r.stdout).rendered, 0);
  assert.equal(JSON.parse(r.stdout).removed, 1);
  assert.ok(fs.existsSync(path.join(tmp, 'DO-NOT-DELETE')));
  assert.ok(!fs.existsSync(path.join(tmp, 'icon/png/obsolete/test.png')));
});
function requireHash(buf) {
  return createHash('sha256').update(buf).digest('hex');
}
