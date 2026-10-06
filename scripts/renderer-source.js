'use strict';

const fs = require('node:fs');
const path = require('node:path');

const modules = [
  'bookshelf.js',
  'bound-shelves.js',
  'editor-open.js',
  'editor-typing.js',
  'paragraph-styles.js',
  'vim-keys.js',
  'screenplay.js',
  'placeholders.js',
  'navigation.js',
  'tabs.js',
  'outline.js',
  'counters.js',
  'persistence.js',
  'structural-undo.js',
  'read-aloud.js',
  'find-replace.js',
  'import-ui.js',
  'spellcheck.js',
  'focus-goals.js',
  'app-menus.js',
  'export.js',
  'accessibility.js'
];

const rendererSource = (root) => [
  fs.readFileSync(path.join(root, 'app.js'), 'utf8'),
  ...modules.map((file) => fs.readFileSync(path.join(root, 'src/renderer', file), 'utf8'))
].join('\n');

rendererSource.modules = modules;

module.exports = rendererSource;
