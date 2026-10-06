'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const rendererSource = require('./renderer-source');

const root = path.join(__dirname, '..');

test('desktop and Pocket load renderer modules in the same order', () => {
  const modulesIn = (file) => [...fs.readFileSync(path.join(root, file), 'utf8')
    .matchAll(/<script src="src\/renderer\/([^"]+)"><\/script>/g)]
    .map((match) => match[1]);
  const expected = rendererSource.modules;

  assert.deepEqual(modulesIn('index.html'), expected);
  assert.deepEqual(modulesIn('pocket/www/index.html'), expected);
  for (const file of expected) assert.ok(fs.existsSync(path.join(root, 'src/renderer', file)), file);
});
