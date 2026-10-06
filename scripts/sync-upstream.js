#!/usr/bin/env node
'use strict';

const { spawnSync, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.join(__dirname, '..');
const conflictFile = path.join(root, 'UPDATE-CONFLICTS.md');
const upstreamRef = 'refs/neo/upstream-base';
const moduleToken = (name) => `/* NEO_UPSTREAM_MODULE_${name.toUpperCase()} */`;

const rendererModules = [
  ['bookshelf.js', '/*  BOOKSHELF'],
  ['bound-shelves.js', '/*  BOUND SHELVES'],
  ['editor-open.js', '/*  EDITOR — open / render'],
  ['editor-typing.js', '/*  EDITOR — typing'],
  ['paragraph-styles.js', '/*  POETRY PARAGRAPHS'],
  ['vim-keys.js', '/*  Vim keys (View → Vim Keys'],
  ['screenplay.js', '/*  SCREENPLAYS'],
  ['placeholders.js', '/*  PLACEHOLDERS + STICKIES'],
  ['navigation.js', '/*  NAV PANE'],
  ['tabs.js', '/*  TABS — Manuscript / Notes / Outline / Darlings'],
  ['outline.js', '/*  STRUCTURED OUTLINE'],
  ['counters.js', '/*  COUNTERS'],
  ['persistence.js', '/*  SAVING'],
  ['structural-undo.js', '/*  STRUCTURAL UNDO'],
  ['read-aloud.js', '/*  READ ALOUD'],
  ['find-replace.js', '/*  FIND & REPLACE'],
  ['import-ui.js', '/*  IMPORT'],
  ['spellcheck.js', '/*  SPELLCHECK PASS'],
  ['focus-goals.js', '/*  FOCUS MODE'],
  ['app-menus.js', '/*  COVER ART SETTINGS'],
  ['export.js', '/*  EXPORT + EMAIL'],
  ['accessibility.js', '/*  SAFETY NET']
];

const mainModules = [
  {
    name: 'library',
    file: 'src/main/library.js',
    start: 'function ensureLibrary() {',
    end: "const COVER_EXTS = ['png', 'jpg', 'jpeg', 'webp'];",
    result: 'return { ensureLibrary, libName, bookDir, writeCatalog, writeFileDurable, parseJSONFile, readJSON, writeJSON, rebuildBookMeta };',
    toSource(text) {
      return text.replace(/\bgetLibraryDir\(\)/g, 'LIBRARY_DIR').replace(/\bgetLibraryFile\(\)/g, 'LIBRARY_FILE');
    },
    fromSource(text) {
      return text.replace(/\bLIBRARY_DIR\b/g, 'getLibraryDir()').replace(/\bLIBRARY_FILE\b/g, 'getLibraryFile()');
    }
  },
  {
    name: 'export',
    file: 'src/main/export.js',
    start: '// Export + email',
    end: '// Import: .docx / .txt / .md → chapters'
  },
  {
    name: 'import',
    file: 'src/main/import.js',
    start: '// Import: .docx / .txt / .md → chapters',
    end: '// Robustness: error log, daily backups, single instance'
  },
  {
    name: 'backups',
    file: 'src/main/backups.js',
    start: '// One zip of the whole library per day, keeping the last 14. Cheap insurance.',
    end: '// ---------------------------------------------------------------------------\n// Window',
    result: 'return dailyBackup;',
    toSource(text) {
      return text
        .replace(/^  const LIBRARY_DIR = getLibraryDir\(\);\n/m, '')
        .replace(/\bgetLibraryDir\(\)/g, 'LIBRARY_DIR');
    },
    fromSource(text) {
      return text.replace(/\bLIBRARY_DIR\b/g, 'getLibraryDir()').replace(
        /(async function dailyBackup\(\) \{\n)/,
        '$1  const LIBRARY_DIR = getLibraryDir();\n'
      );
    }
  },
  {
    name: 'menu',
    file: 'src/main/menu.js',
    start: "// the Format menu's ticks",
    end: '// No generative-AI tools in NEO — not now, not later.',
    result: 'return buildMenu;',
    toSource(text) {
      return text
        .replace(/\bgetLibraryFile\(\)/g, 'LIBRARY_FILE')
        .replace(/\bspellLanguages\b/g, 'SPELL_LANGUAGES')
        .replace('checked: getSpellLanguage() === code', 'checked: spellLanguage === code')
        .replace("new Intl.NumberFormat(getUiLanguage() || 'en'", "new Intl.NumberFormat(uiLanguage || 'en'")
        .replace('checked: getUiLanguage() === lang.code', 'checked: uiLanguage === lang.code');
    },
    fromSource(text) {
      return text
        .replace(/\bLIBRARY_FILE\b/g, 'getLibraryFile()')
        .replace(/\bSPELL_LANGUAGES\b/g, 'spellLanguages')
        .replace('checked: spellLanguage === code', 'checked: getSpellLanguage() === code')
        .replace("new Intl.NumberFormat(uiLanguage || 'en'", "new Intl.NumberFormat(getUiLanguage() || 'en'")
        .replace('checked: uiLanguage === lang.code', 'checked: getUiLanguage() === lang.code');
    }
  },
  {
    name: 'updates',
    file: 'src/main/updates.js',
    start: '// Manual update check (Help → Check for Update…):',
    end: '// Two copies of NEO editing the same library is how words get eaten',
    scheduleStart: '// The background look: a few seconds after launch, every hour after that',
    scheduleEnd: 'app.whenReady().then(() => {',
    result: 'return checkForUpdates;'
  }
];

function git(args, options = {}) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options
  }).trim();
}

function gitFile(revision, file) {
  try {
    return execFileSync('git', ['show', `${revision}:${file}`], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
  } catch (err) {
    if (err.status === 128) return null;
    throw err;
  }
}

function gitFileBuffer(revision, file) {
  try {
    return execFileSync('git', ['show', `${revision}:${file}`], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe']
    });
  } catch (err) {
    if (err.status === 128) return null;
    throw err;
  }
}

function parseOptions(args) {
  const options = { remote: 'upstream', branch: 'main' };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--remote' && args[i + 1]) options.remote = args[++i];
    else if (args[i] === '--branch' && args[i + 1]) options.branch = args[++i];
    else if (args[i] === '--help' || args[i] === '-h') options.help = true;
    else throw new Error(`Unknown option: ${args[i]}`);
  }
  return options;
}

function lineAt(source, offset) {
  return source.slice(0, offset).split('\n').length;
}

function range(source, startMarker, endMarker, filename) {
  const start = source.indexOf(startMarker);
  const end = start < 0 ? -1 : source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) throw new Error(`Cannot map ${filename}: missing "${startMarker}" or "${endMarker}"`);
  return { text: source.slice(start, end), start, end, line: lineAt(source, start) };
}

function splitRenderer(source, filename) {
  const starts = rendererModules.map(([, marker]) => {
    const at = source.indexOf(marker);
    if (at < 0 && marker === '/*  SCREENPLAYS') return -1;
    if (at < 0) throw new Error(`Cannot map ${filename}: missing renderer section "${marker}"`);
    return at;
  });
  const present = starts.map((at, index) => ({ at, index })).filter(({ at }) => at >= 0);
  if (present.some(({ at }, i) => i && at <= present[i - 1].at)) {
    throw new Error(`Cannot map ${filename}: renderer sections changed order`);
  }
  const chunks = new Map([['core', source.slice(0, present[0].at)]]);
  rendererModules.forEach(([module], i) => {
    const at = starts[i];
    const next = present.find(({ index }) => index > i);
    chunks.set(module, at < 0 ? '' : source.slice(at, next ? next.at : source.length));
  });
  return chunks;
}

function currentRenderer(rootDir) {
  const source = [
    fs.readFileSync(path.join(rootDir, 'app.js'), 'utf8'),
    ...rendererModules.map(([file]) => fs.readFileSync(path.join(rootDir, 'src/renderer', file), 'utf8')
      .replace(/^'use strict';\n\n/, ''))
  ].join('');
  return splitRenderer(source, 'fork renderer modules');
}

function factoryCode(source, resultLine) {
  const bodyStart = source.indexOf('}) {');
  const bodyEnd = source.lastIndexOf('\n};');
  if (bodyStart < 0 || bodyEnd < bodyStart) throw new Error('Unrecognized main-service module wrapper');
  let body = source.slice(source.indexOf('\n', bodyStart) + 1, bodyEnd);
  if (resultLine) {
    const resultAt = body.lastIndexOf(`\n  ${resultLine}`);
    if (resultAt < 0) throw new Error(`Cannot find module return "${resultLine}"`);
    body = body.slice(0, resultAt);
  }
  return body.split('\n').map((line) => line.startsWith('  ') ? line.slice(2) : line).join('\n');
}

function sourceMainModules(source, filename) {
  const chunks = new Map();
  for (const spec of mainModules) {
    const section = range(source, spec.start, spec.end, filename);
    chunks.set(spec.name, { text: section.text, line: section.line });
    if (spec.scheduleStart) {
      const schedule = range(source, spec.scheduleStart, spec.scheduleEnd, filename);
      const previous = chunks.get(spec.name);
      chunks.set(spec.name, {
        text: previous.text.trimEnd() + '\n\n' + schedule.text,
        line: previous.line,
        scheduleLine: schedule.line
      });
    }
  }
  return chunks;
}

function currentMainModules(rootDir) {
  const chunks = new Map();
  for (const spec of mainModules) {
    const source = fs.readFileSync(path.join(rootDir, spec.file), 'utf8');
    const code = factoryCode(source, spec.result);
    let text = spec.toSource ? spec.toSource(code) : code;
    if (spec.name === 'updates') text = text.replace(/\n{3,}(?=\/\/ The background look)/, '\n\n');
    chunks.set(spec.name, { text });
  }
  return chunks;
}

function replaceRange(source, startMarker, endMarker, replacement, filename) {
  const found = range(source, startMarker, endMarker, filename);
  return source.slice(0, found.start) + replacement + source.slice(found.end);
}

function mainRegistrations(source) {
  const specs = [
    ['library', "const { ensureLibrary, libName, bookDir, writeCatalog,", '});\n\n'],
    ['export', "require('./src/main/export.js')({", '});\n\n'],
    ['import', "require('./src/main/import.js')({", '});\n\n'],
    ['backups', "const dailyBackup = require('./src/main/backups.js')({", '});\n\n'],
    ['updates', "const checkForUpdates = require('./src/main/updates.js')(", ';\n\n']
  ];
  const registrations = new Map();
  let normalized = source;
  for (const [name, startMarker, endMarker] of specs) {
    const start = normalized.indexOf(startMarker);
    const end = start < 0 ? -1 : normalized.indexOf(endMarker, start) + endMarker.length;
    if (start < 0 || end < endMarker.length) throw new Error(`Cannot locate the ${name} service registration in main.js`);
    registrations.set(name, normalized.slice(start, end));
    normalized = normalized.slice(0, start) + moduleToken(name) + '\n\n' + normalized.slice(end);
  }
  const menuStart = normalized.indexOf("const buildMenu = require('./src/main/menu.js')({");
  const menuEnd = menuStart < 0 ? -1 : normalized.indexOf('});\n\n', menuStart) + '});\n\n'.length;
  if (menuStart < 0 || menuEnd < '});\n\n'.length) throw new Error('Cannot locate the menu service registration in main.js');
  registrations.set('menu', normalized.slice(menuStart, menuEnd));
  normalized = normalized.slice(0, menuStart) + normalized.slice(menuEnd);
  const menuAnchor = normalized.indexOf('// No generative-AI tools in NEO — not now, not later.');
  if (menuAnchor < 0) throw new Error('Cannot locate the menu service insertion point in main.js');
  normalized = normalized.slice(0, menuAnchor) + moduleToken('menu') + '\n\n' + normalized.slice(menuAnchor);
  const ready = normalized.indexOf('app.whenReady().then(() => {');
  if (ready < 0) throw new Error('Cannot locate app startup in main.js');
  normalized = normalized.slice(0, ready) + moduleToken('updates-schedule') + '\n\n' + normalized.slice(ready);
  return { source: normalized, registrations };
}

function canonicalMain(source, filename) {
  let normalized = source;
  for (const spec of mainModules) {
    normalized = replaceRange(normalized, spec.start, spec.end, moduleToken(spec.name) + '\n\n', filename);
    if (spec.scheduleStart) {
      normalized = replaceRange(normalized, spec.scheduleStart, spec.scheduleEnd, moduleToken('updates-schedule') + '\n\n', filename);
    }
  }
  return { source: normalized, registrations: new Map() };
}

function restoreMain(source, registrations) {
  let restored = source;
  for (const name of ['library', 'export', 'import', 'backups']) {
    const token = moduleToken(name);
    if (!restored.includes(token)) throw new Error(`Upstream main.js lost the ${name} module insertion point`);
    restored = restored.replace(token + '\n\n', registrations.get(name));
  }
  const menuToken = moduleToken('menu') + '\n\n';
  if (!restored.includes(menuToken)) throw new Error('Upstream main.js lost the menu module insertion point');
  restored = restored.replace(menuToken, '');
  const updatesToken = moduleToken('updates') + '\n\n';
  if (!restored.includes(updatesToken)) throw new Error('Upstream main.js lost the update module insertion point');
  restored = restored.replace(updatesToken, registrations.get('menu') + updatesToken);
  restored = restored.replace(updatesToken, registrations.get('updates'));
  restored = restored.replace(moduleToken('updates-schedule') + '\n\n', '');
  return restored;
}

function mergeText(current, base, upstream, labels) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'neo-upstream-'));
  const ours = path.join(dir, 'fork');
  const ancestor = path.join(dir, 'base');
  const theirs = path.join(dir, 'upstream');
  try {
    fs.writeFileSync(ours, current);
    fs.writeFileSync(ancestor, base);
    fs.writeFileSync(theirs, upstream);
    const result = spawnSync('git', [
      'merge-file', '--stdout', '--diff3',
      '-L', labels.local,
      '-L', labels.base,
      '-L', labels.upstream,
      ours, ancestor, theirs
    ], { cwd: root, encoding: 'utf8' });
    if (result.error) throw result.error;
    const conflict = result.stdout.includes('<<<<<<< ');
    if (result.status && !conflict) {
      throw new Error(result.stderr || `git merge-file exited with status ${result.status}`);
    }
    return { text: result.stdout, conflict };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function trimIndent(text) {
  return text.split('\n').map((line) => line.replace(/^[\t ]+/, '')).join('\n');
}

function restoreIndent(merged, candidates) {
  const sources = candidates.map((text) => text.split('\n'));
  const offsets = sources.map(() => 0);
  return merged.split('\n').map((line) => {
    const normalized = line.replace(/^[\t ]+/, '');
    for (let i = 0; i < sources.length; i++) {
      const at = sources[i].indexOf(normalized, offsets[i]);
      if (at >= 0) {
        offsets[i] = at + 1;
        return sources[i][at];
      }
    }
    return line;
  }).join('\n');
}

function markerRanges(text) {
  const lines = text.split('\n');
  const blocks = [];
  let block = null;
  const numbered = (name) => name === 'local' ? block && block.local : name === 'base' ? block && block.base : block && block.upstream;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('<<<<<<< ')) {
      block = { startLine: i + 1, local: [], base: [], upstream: [], side: 'local' };
    } else if (block && lines[i].startsWith('||||||| ')) {
      block.side = 'base';
    } else if (block && lines[i] === '=======') {
      block.side = 'upstream';
    } else if (block && lines[i].startsWith('>>>>>>> ')) {
      block.endLine = i + 1;
      blocks.push(block);
      block = null;
    } else if (block) {
      numbered(block.side).push(lines[i]);
    }
  }
  return blocks;
}

function conflictEntry(item, merge) {
  const blocks = markerRanges(merge.text);
  if (!blocks.length) {
    const refs = [
      `- Fork module: [\`${item.file}\` line ${item.currentOffset || 1}](./${item.file}#L${item.currentOffset || 1})`,
      `- Upstream source: [\`${item.upstreamFile}\` line ${item.upstreamLine || 1}](./${item.upstreamFile}#L${item.upstreamLine || 1})`
    ].join('\n');
    return `### ${item.title}\n\n${item.description}\n\n${refs}\n\n\`\`\`diff\n${merge.text.trimEnd()}\n\`\`\`\n`;
  }
  return blocks.map((block, i) => {
    const localStart = (item.currentOffset || 0) + block.startLine;
    const baseStart = item.baseLine + block.startLine - 1;
    const upstreamStart = item.upstreamLine + block.startLine - 1;
    const reference = (label, file, start, count) => `- ${label}: [\`${file}\` lines ${start}-${start + Math.max(0, count - 1)}](./${file}#L${start})`;
    const refs = [
      reference('Fork module', item.file, localStart, block.local.length),
      reference('Common base', item.upstreamFile, baseStart, block.base.length),
      reference('Upstream', item.upstreamFile, upstreamStart, block.upstream.length)
    ].join('\n');
    return `### ${item.title} — conflict ${i + 1}\n\n${refs}\n\n\`\`\`diff\n<<<<<<< fork\n${block.local.join('\n')}\n||||||| common base\n${block.base.join('\n')}\n=======\n${block.upstream.join('\n')}\n>>>>>>> upstream\n\`\`\`\n`;
  }).join('\n');
}

function appendConflictReport(conflicts, info) {
  const timestamp = new Date().toISOString();
  const sections = conflicts.map(({ item, merge }) => conflictEntry(item, merge));
  const destination = info.destination || conflictFile;
  const report = [
    `## Upstream sync conflict — ${timestamp}`,
    '',
    `- Upstream: \`${info.remote}/${info.branch}\` at \`${info.target}\``,
    `- Common base: \`${info.base}\``,
    '- No source files were changed by this run.',
    '',
    ...sections,
    ''
  ].join('\n');
  const previous = fs.existsSync(destination) ? fs.readFileSync(destination, 'utf8').trimEnd() : '# Upstream sync conflicts';
  fs.writeFileSync(destination, `${previous}\n\n---\n\n${report}`, 'utf8');
}

function addMerge(plan, conflicts, current, base, upstream, item) {
  const merge = mergeText(current, base, upstream, {
    local: 'fork modules',
    base: 'common upstream base',
    upstream: 'upstream main'
  });
  if (merge.conflict) conflicts.push({ item, merge });
  else if (merge.text !== current) plan.set(item.file, merge.text);
}

function rebuildMainModule(original, spec, merged, candidates) {
  const start = original.indexOf('}) {');
  if (start < 0) throw new Error(`Cannot rebuild ${spec.file}: unrecognized service wrapper`);
  const bodyStart = original.indexOf('\n', start);
  const beforeReturn = original.slice(0, bodyStart + 1);
  const restoredCode = restoreIndent(merged, candidates);
  const code = spec.fromSource ? spec.fromSource(restoredCode) : restoredCode;
  const body = code.split('\n').map((line) => line ? `  ${line}` : '').join('\n');
  const returnAt = spec.result ? original.lastIndexOf(`\n  ${spec.result}`) : -1;
  const returned = returnAt < 0 ? '\n};\n' : original.slice(returnAt);
  return beforeReturn + body + returned;
}

function lineCountBefore(source, text) {
  const at = source.indexOf(text);
  return at < 0 ? 1 : lineAt(source, at);
}

function mergeRenderer(rootDir, baseSource, upstreamSource, plan, conflicts) {
  const base = splitRenderer(baseSource, 'base app.js');
  const upstream = splitRenderer(upstreamSource, 'upstream app.js');
  const current = currentRenderer(rootDir);
  for (const [name] of [['core'], ...rendererModules.map(([file]) => [file])]) {
    const item = name === 'core'
      ? { file: 'app.js', upstreamFile: 'app.js', title: '`app.js` shared renderer core', baseLine: 1, upstreamLine: 1 }
      : {
        file: `src/renderer/${name}`,
        upstreamFile: 'app.js',
        title: `Renderer module \`${name}\``,
        currentOffset: 2,
        baseLine: lineCountBefore(baseSource, rendererModules.find(([file]) => file === name)[1]),
        upstreamLine: lineCountBefore(upstreamSource, rendererModules.find(([file]) => file === name)[1])
      };
    addMerge(plan, conflicts, current.get(name), base.get(name), upstream.get(name), item);
  }
}

function mergeMain(rootDir, baseSource, upstreamSource, plan, conflicts) {
  const baseModules = sourceMainModules(baseSource, 'base main.js');
  const upstreamModules = sourceMainModules(upstreamSource, 'upstream main.js');
  const currentModules = currentMainModules(rootDir);
  for (const spec of mainModules) {
    const current = currentModules.get(spec.name).text;
    const base = baseModules.get(spec.name).text;
    const upstream = upstreamModules.get(spec.name).text;
    const merge = mergeText(trimIndent(current), trimIndent(base), trimIndent(upstream), {
      local: 'fork module',
      base: 'common upstream base',
      upstream: 'upstream main'
    });
    const item = {
      file: spec.file,
      upstreamFile: 'main.js',
      title: `Main-process module \`${spec.file}\``,
      currentOffset: 4,
      baseLine: baseModules.get(spec.name).line,
      upstreamLine: upstreamModules.get(spec.name).line
    };
    if (merge.conflict) conflicts.push({ item, merge });
    else if (merge.text !== trimIndent(current)) {
      const original = fs.readFileSync(path.join(rootDir, spec.file), 'utf8');
      plan.set(spec.file, rebuildMainModule(original, spec, merge.text, [current, upstream, base]));
    }
  }
  const baseCanonical = canonicalMain(baseSource, 'base main.js');
  const upstreamCanonical = canonicalMain(upstreamSource, 'upstream main.js');
  const currentMain = fs.readFileSync(path.join(rootDir, 'main.js'), 'utf8');
  const forkCanonical = mainRegistrations(currentMain);
  const merge = mergeText(forkCanonical.source, baseCanonical.source, upstreamCanonical.source, {
    local: 'fork main.js',
    base: 'common upstream base',
    upstream: 'upstream main.js'
  });
  const item = {
    file: 'main.js',
    upstreamFile: 'main.js',
    title: '`main.js` entry point',
    baseLine: 1,
    upstreamLine: 1
  };
  if (merge.conflict) conflicts.push({ item, merge });
  else if (merge.text !== forkCanonical.source) plan.set('main.js', restoreMain(merge.text, forkCanonical.registrations));
}

function planPlainFiles(changed, baseRevision, upstreamRevision, plan, conflicts) {
  for (const file of changed) {
    if (file === 'app.js' || file === 'main.js') continue;
    const baseBuffer = gitFileBuffer(baseRevision, file);
    const upstreamBuffer = gitFileBuffer(upstreamRevision, file);
    const full = path.resolve(root, file);
    if (!full.startsWith(root + path.sep)) throw new Error(`Unsafe upstream path: ${file}`);
    const exists = fs.existsSync(full);
    const currentBuffer = exists ? fs.readFileSync(full) : null;
    const binary = [baseBuffer, currentBuffer, upstreamBuffer].some((content) => content && content.includes(0));
    if (binary) {
      const item = {
        file,
        upstreamFile: file,
        title: `Binary file \`${file}\``,
        baseLine: 1,
        upstreamLine: 1,
        description: 'Binary changes are compared byte-for-byte and cannot be shown as a text diff.'
      };
      if (baseBuffer === null) {
        if (upstreamBuffer === null) continue;
        if (!exists) plan.set(file, upstreamBuffer);
        else if (!currentBuffer.equals(upstreamBuffer)) {
          conflicts.push({ item, merge: { text: 'Binary file already exists in the fork with different content.', conflict: true } });
        }
      } else if (upstreamBuffer === null) {
        if (!exists || currentBuffer.equals(baseBuffer)) plan.set(file, null);
        else conflicts.push({ item, merge: { text: 'Binary file was deleted upstream but has different content in the fork.', conflict: true } });
      } else if (!exists) {
        conflicts.push({ item, merge: { text: 'Binary file is missing in the fork but still exists upstream.', conflict: true } });
      } else if (!currentBuffer.equals(upstreamBuffer)) {
        if (currentBuffer.equals(baseBuffer)) plan.set(file, upstreamBuffer);
        else if (!upstreamBuffer.equals(baseBuffer)) {
          conflicts.push({ item, merge: { text: 'Both the fork and upstream changed this binary file.', conflict: true } });
        }
      }
      continue;
    }

    const base = baseBuffer && baseBuffer.toString('utf8');
    const upstream = upstreamBuffer && upstreamBuffer.toString('utf8');
    const current = currentBuffer && currentBuffer.toString('utf8');
    if (base === null) {
      if (upstream === null) continue;
      if (!exists) plan.set(file, upstream);
      else if (current !== upstream) conflicts.push({
        item: { file, upstreamFile: file, title: `New upstream file \`${file}\``, baseLine: 1, upstreamLine: 1,
          description: `This file was added upstream, but a file with the same path already exists in the fork.` },
        merge: { text: `<<<<<<< fork\n${current}\n=======\n${upstream}\n>>>>>>> upstream`, conflict: true }
      });
      continue;
    }
    if (upstream === null) {
      if (!exists || current === base) plan.set(file, null);
      else conflicts.push({
        item: { file, upstreamFile: file, title: `Deleted upstream file \`${file}\``, baseLine: 1, upstreamLine: 1,
          description: 'The file has local edits but was deleted upstream.' },
        merge: { text: `<<<<<<< fork\n${current}\n||||||| common base\n${base}\n=======\n>>>>>>> upstream`, conflict: true }
      });
      continue;
    }
    if (!exists) {
      conflicts.push({
        item: { file, upstreamFile: file, title: `Missing fork file \`${file}\``, baseLine: 1, upstreamLine: 1,
          description: 'The file still exists upstream but is missing from the fork.' },
        merge: { text: `<<<<<<< fork\n=======\n${upstream}\n>>>>>>> upstream`, conflict: true }
      });
      continue;
    }
    addMerge(plan, conflicts, current, base, upstream, {
      file,
      upstreamFile: file,
      title: `File \`${file}\``,
      baseLine: 1,
      upstreamLine: 1
    });
  }
}

function applyPlan(plan) {
  const before = new Map();
  try {
    for (const [relative, content] of plan) {
      const file = path.resolve(root, relative);
      if (!file.startsWith(root + path.sep)) throw new Error(`Unsafe output path: ${relative}`);
      before.set(relative, fs.existsSync(file) ? fs.readFileSync(file) : null);
      if (content === null) {
        fs.rmSync(file);
      } else {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        const tmp = `${file}.neo-sync-${process.pid}.tmp`;
        fs.writeFileSync(tmp, content);
        fs.renameSync(tmp, file);
      }
    }
  } catch (err) {
    for (const [relative, content] of [...before].reverse()) {
      const file = path.resolve(root, relative);
      if (content === null) fs.rmSync(file, { force: true });
      else fs.writeFileSync(file, content);
    }
    throw err;
  }
}

function run(args = process.argv.slice(2)) {
  const options = parseOptions(args);
  if (options.help) {
    console.log('Usage: npm run sync:upstream [-- --remote upstream --branch main]');
    return;
  }
  const status = git(['status', '--porcelain', '--untracked-files=all'])
    .split('\n')
    .filter(Boolean)
    .filter((line) => !line.slice(3).endsWith('UPDATE-CONFLICTS.md'));
  if (status.length) {
    throw new Error(`Commit or stash fork changes before syncing:\n${status.join('\n')}`);
  }
  git(['remote', 'get-url', options.remote]);
  console.log(`Fetching ${options.remote}/${options.branch}…`);
  git(['fetch', '--no-tags', options.remote, options.branch]);
  const upstreamRevision = git(['rev-parse', 'FETCH_HEAD']);
  let baseRevision = null;
  try {
    const savedBase = git(['rev-parse', upstreamRef]);
    if (git(['merge-base', '--is-ancestor', savedBase, upstreamRevision]) === '') baseRevision = savedBase;
  } catch { /* first sync, or upstream history was rewritten */ }
  if (!baseRevision) baseRevision = git(['merge-base', 'HEAD', upstreamRevision]);
  if (!baseRevision) throw new Error('The fork and upstream have no common ancestor.');
  if (baseRevision === upstreamRevision) {
    git(['update-ref', upstreamRef, upstreamRevision]);
    console.log('The fork already contains the latest upstream source.');
    return;
  }
  const changed = git(['diff', '--name-only', '-z', '--no-renames', baseRevision, upstreamRevision])
    .split('\0').filter(Boolean);
  const baseApp = gitFile(baseRevision, 'app.js');
  const upstreamApp = gitFile(upstreamRevision, 'app.js');
  const baseMain = gitFile(baseRevision, 'main.js');
  const upstreamMain = gitFile(upstreamRevision, 'main.js');
  if (!baseApp || !upstreamApp || !baseMain || !upstreamMain) {
    throw new Error('Could not read upstream app.js or main.js at both revisions.');
  }
  const plan = new Map();
  const conflicts = [];
  try {
    mergeRenderer(root, baseApp, upstreamApp, plan, conflicts);
    mergeMain(root, baseMain, upstreamMain, plan, conflicts);
    planPlainFiles(changed, baseRevision, upstreamRevision, plan, conflicts);
  } catch (err) {
    conflicts.push({
      item: {
        file: 'app.js',
        upstreamFile: 'app.js',
        title: 'Upstream source mapping failure',
        currentOffset: 1,
        upstreamLine: 1,
        description: 'The sync could not safely map upstream changes into the fork modules.'
      },
      merge: { text: `- Mapping failed\n+ ${err.message}`, conflict: true }
    });
    appendConflictReport(conflicts, { remote: options.remote, branch: options.branch, target: upstreamRevision, base: baseRevision });
    throw new Error('Source mapping failed. No source files were changed; see UPDATE-CONFLICTS.md.');
  }
  if (conflicts.length) {
    appendConflictReport(conflicts, { remote: options.remote, branch: options.branch, target: upstreamRevision, base: baseRevision });
    throw new Error(`${conflicts.length} conflict(s). No source files were changed; see UPDATE-CONFLICTS.md.`);
  }
  applyPlan(plan);
  git(['update-ref', upstreamRef, upstreamRevision]);
  console.log(`Applied ${plan.size} upstream file update(s) from ${options.remote}/${options.branch}.`);
  console.log('Review and commit the changes before running this script again.');
}

if (require.main === module) {
  try {
    run();
  } catch (err) {
    console.error(`\nUpstream sync stopped: ${err.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  canonicalMain,
  currentMainModules,
  currentRenderer,
  factoryCode,
  mainRegistrations,
  mainModules,
  markerRanges,
  conflictEntry,
  appendConflictReport,
  rebuildMainModule,
  mergeText,
  rendererModules,
  restoreIndent,
  sourceMainModules,
  trimIndent,
  splitRenderer
};
