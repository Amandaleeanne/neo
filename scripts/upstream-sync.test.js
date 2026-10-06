'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const sync = require('./sync-upstream');
const rendererSource = require('./renderer-source');

const root = path.join(__dirname, '..');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });

test('renderer section manifest reconstructs the tracked renderer', () => {
  let reconstructed = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  for (const file of rendererSource.modules) {
    reconstructed += fs.readFileSync(path.join(root, 'src/renderer', file), 'utf8')
      .replace(/^'use strict';\n\n/, '');
  }
  assert.equal(reconstructed, git('show', 'HEAD:app.js'));
});

test('main-service modules map back to the tracked main-process sections', () => {
  const trackedMain = git('show', 'HEAD:main.js');
  const trackedModules = sync.sourceMainModules(trackedMain, 'tracked main.js');
  const currentModules = sync.currentMainModules(root);

  for (const spec of sync.mainModules) {
    const merge = sync.mergeText(
      sync.trimIndent(currentModules.get(spec.name).text),
      sync.trimIndent(trackedModules.get(spec.name).text),
      sync.trimIndent(trackedModules.get(spec.name).text),
      { local: 'fork', base: 'base', upstream: 'upstream' }
    );
    assert.equal(merge.conflict, false, spec.file);
  }
});

test('main entry point keeps its original structure around module registrations', () => {
  const trackedMain = git('show', 'HEAD:main.js');
  const forkMain = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
  const expected = sync.canonicalMain(trackedMain, 'tracked main.js').source;
  const actual = sync.mainRegistrations(forkMain).source;
  assert.equal(actual, expected);
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
