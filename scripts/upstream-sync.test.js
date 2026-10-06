'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const sync = require('./sync-upstream');
const rendererSource = require('./renderer-source');

const root = path.join(__dirname, '..');

test('renderer module manifest maps sections in runtime load order', () => {
  const assembled = [
    fs.readFileSync(path.join(root, 'app.js'), 'utf8'),
    ...rendererSource.modules.map((file) => fs.readFileSync(path.join(root, 'src/renderer', file), 'utf8')
      .replace(/^'use strict';\n\n/, ''))
  ].join('');
  const mapped = sync.currentRenderer(root);
  assert.equal(mapped.size, rendererSource.modules.length + 1);
  assert.equal([
    mapped.get('core'),
    ...rendererSource.modules.map((file) => mapped.get(file))
  ].join(''), assembled);
});

test('renderer mapping treats a not-yet-existing upstream feature module as a clean addition', () => {
  const mapped = sync.currentRenderer(root);
  const withoutScreenplay = [
    mapped.get('core'),
    ...rendererSource.modules
      .filter((file) => file !== 'screenplay.js')
      .map((file) => mapped.get(file))
  ].join('');
  assert.equal(sync.splitRenderer(withoutScreenplay, 'older upstream app.js').get('screenplay.js'), '');
});

test('main-service source maps identify every module wrapper', () => {
  const currentModules = sync.currentMainModules(root);
  assert.equal(currentModules.size, sync.mainModules.length);
  for (const spec of sync.mainModules) assert.ok(currentModules.get(spec.name).text.trim(), spec.file);
});

test('main entry point retains registrations for all extracted services', () => {
  const forkMain = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
  const { source, registrations } = sync.mainRegistrations(forkMain);
  for (const name of ['library', 'export', 'import', 'backups', 'menu']) {
    assert.ok(registrations.has(name), name);
    assert.ok(source.includes(`NEO_UPSTREAM_MODULE_${name.toUpperCase()}`), name);
  }
  assert.ok(source.includes('NEO_UPSTREAM_MODULE_UPDATES-SCHEDULE'));
});

test('conflict parser extracts each diff3 side for the report', () => {
  const blocks = sync.markerRanges([
    'before',
    '<<<<<<< fork modules',
    'local line',
    '||||||| common upstream base',
    'base line',
    '=======',
    'upstream line',
    '>>>>>>> upstream main',
    'after'
  ].join('\n'));

  assert.equal(blocks.length, 1);
  assert.deepEqual(blocks[0].local, ['local line']);
  assert.deepEqual(blocks[0].base, ['base line']);
  assert.deepEqual(blocks[0].upstream, ['upstream line']);
});

test('merge helper treats multiple conflict hunks as merge conflicts', () => {
  const merge = sync.mergeText(
    'fork one\nshared\nfork two\n',
    'base one\nshared\nbase two\n',
    'upstream one\nshared\nupstream two\n',
    { local: 'fork', base: 'base', upstream: 'upstream' }
  );
  assert.equal(merge.conflict, true);
  assert.equal(sync.markerRanges(merge.text).length, 2);
});

test('main service rebuilding retains internal returns and closes the module wrapper', () => {
  const original = [
    'module.exports = function createService({}) {',
    '  return existingValue();',
    '};',
    ''
  ].join('\n');
  const rebuilt = sync.rebuildMainModule(original, { file: 'service.js' }, 'return existingValue();\nreturn addedValue();', []);
  assert.equal(rebuilt, [
    'module.exports = function createService({}) {',
    '  return existingValue();',
    '  return addedValue();',
    '};',
    ''
  ].join('\n'));

  const returning = [
    'module.exports = function createService({}) {',
    '  doWork();',
    '  return createResult();',
    '};',
    ''
  ].join('\n');
  const rebuiltReturning = sync.rebuildMainModule(
    returning,
    { file: 'service.js', result: 'return createResult();' },
    'doWork();',
    []
  );
  assert.equal(rebuiltReturning, returning);
});

test('conflict reports append timestamped diff references without replacing prior reports', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'neo-sync-report-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const destination = path.join(dir, 'UPDATE-CONFLICTS.md');
  const info = { remote: 'upstream', branch: 'main', target: 'abc123', base: 'def456', destination };
  const item = {
    file: 'src/renderer/editor-typing.js',
    upstreamFile: 'app.js',
    title: 'Renderer conflict',
    currentOffset: 2,
    baseLine: 20,
    upstreamLine: 30
  };
  const merge = {
    text: '<<<<<<< fork\nfork line\n||||||| base\nbase line\n=======\nupstream line\n>>>>>>> upstream',
    conflict: true
  };

  sync.appendConflictReport([{ item, merge }], info);
  sync.appendConflictReport([{ item, merge }], info);
  const report = fs.readFileSync(destination, 'utf8');
  assert.equal((report.match(/## Upstream sync conflict — /g) || []).length, 2);
  assert.equal((report.match(/^---$/gm) || []).length, 2);
  assert.match(report, /src\/renderer\/editor-typing\.js#L3/);
  assert.match(report, /app\.js#L20/);
  assert.match(report, /app\.js#L30/);
  assert.match(report, /<<<<<<< fork\nfork line\n\|\|\|\|\|\|\| common base\nbase line\n=======\nupstream line\n>>>>>>> upstream/);
});
