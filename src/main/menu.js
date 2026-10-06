'use strict';

module.exports = function registerMenuService({
  BrowserWindow, ipcMain, Menu, process, t, sendToWindow, readJSON, getLibraryFile,
  chooseLibraryFolder, logError, roomColor, spellLanguages, getSpellLanguage,
  getUiLanguage, listLanguages, setUiLanguage, editMenuState, menuTitle,
  watchEditMenu, hideSystemEditItems
}) {
  // the Format menu's ticks: whether the caret is in a poetry paragraph, and
  // whether typewriter scrolling is on
  let poetryState = false;
  let flushState = false;
  let typewriterState = false;
  let scriptState = { on: false, element: null };
  ipcMain.on('script:state', (_e, state) => {
    const next = {
      on: !!(state && state.on),
      element: state && ['heading', 'action', 'character', 'paren', 'dialogue', 'transition', 'shot'].includes(state.element)
        ? state.element : 'action'
    };
    if (next.on === scriptState.on && next.element === scriptState.element) return;
    scriptState = next;
    try { buildMenu(); } catch (err) { logError('menu', err); }
  });
  ipcMain.on('poetry:state', (_e, on) => {
    on = !!on;
    if (on === poetryState) return;
    poetryState = on;
    try { buildMenu(); } catch (err) { logError('menu', err); }
  });
  ipcMain.on('flush:state', (_e, on) => {
    on = !!on;
    if (on === flushState) return;
    flushState = on;
    try { buildMenu(); } catch (err) { logError('menu', err); }
  });
  ipcMain.on('typewriter:state', (_e, on) => {
    on = !!on;
    if (on === typewriterState) return;
    typewriterState = on;
    try { buildMenu(); } catch (err) { logError('menu', err); }
  });
  // View → Vim Keys shows whether they're on
  let vimState = false;
  ipcMain.on('vim:state', (_e, on) => {
    on = !!on;
    if (on === vimState) return;
    vimState = on;
    try { buildMenu(); } catch (err) { logError('menu', err); }
  });
  // View → Interface Size shows its choice
  let uiZoomState = 1;
  ipcMain.on('uizoom:state', (_e, z) => {
    z = [1, 1.25, 1.5, 2, 2.5, 3].includes(z) ? z : 1;
    if (z === uiZoomState) return;
    uiZoomState = z;
    try { buildMenu(); } catch (err) { logError('menu', err); }
  });
  // View menu ticks: the focus level, the page, and Brighter Interface
  let viewState = { focus: 'off', pageTheme: 'night', uiBright: false };
  ipcMain.on('view:state', (e, st) => {
    st = st || {};
    const next = { focus: st.focus || 'off', pageTheme: st.pageTheme || 'night', uiBright: !!st.uiBright };
    if (JSON.stringify(next) === JSON.stringify(viewState)) return;
    if (next.pageTheme !== viewState.pageTheme) {
      const w = BrowserWindow.fromWebContents(e.sender);
      if (w && !w.isDestroyed()) w.setBackgroundColor(roomColor(next.pageTheme));
    }
    viewState = next;
    try { buildMenu(); } catch (err) { logError('menu', err); }
  });
  // File → New Books Open To: the pantser/plotter choice, kept in library.json
  let writingStyle = 'pantser';
  ipcMain.on('style:state', (_e, style) => {
    style = style === 'plotter' ? 'plotter' : 'pantser';
    if (style === writingStyle) return;
    writingStyle = style;
    try { buildMenu(); } catch (err) { logError('menu', err); }
  });

  function buildMenu() {
    const isMac = process.platform === 'darwin';
    const isWin = process.platform === 'win32';
    // macOS and Windows name faces that ship with the OS. Linux has none of
    // them, so the menu names the faces bundled in fonts/ (see styles.css).
    // The Windows list stays the one the renderer already understands.
    const bodyFonts = isMac
      ? ['Georgia', 'Palatino', 'Baskerville', 'Hoefler Text', 'Iowan Old Style', 'Jost', 'iA Writer Quattro']
      : isWin
        ? ['Georgia', 'Palatino', 'Baskerville', 'Cambria', 'Constantia', 'Jost', 'iA Writer Quattro']
        : ['Gelasio', 'TeX Gyre Pagella', 'Libre Baskerville', 'Alegreya', 'Source Serif Pro', 'Jost', 'iA Writer Quattro'];
    const template = [
      // appMenu exists only on macOS — including it on Windows throws,
      // which is exactly what kept NEO from ever opening a window there
      ...(isMac ? [{
        role: 'appMenu',
        submenu: [
          { role: 'about', label: t('About NEO') },
          { type: 'separator' },
          { role: 'services', label: t('Services') },
          { type: 'separator' },
          { role: 'hide', label: t('Hide NEO') },
          { role: 'hideOthers', label: t('Hide Others') },
          { role: 'unhide', label: t('Show All') },
          { type: 'separator' },
          { role: 'quit', label: t('Quit NEO') }
        ]
      }] : []),
      {
        label: t('File'),
        submenu: [
          {
            label: t('Export'),
            submenu: scriptState.on ? [
              { label: t('PDF (.pdf)'), click: () => sendToWindow({ type: 'export', format: 'pdf' }) },
              { label: t('Fountain (.fountain)'), click: () => sendToWindow({ type: 'export', format: 'fountain' }) },
              { label: t('Final Draft (.fdx)'), click: () => sendToWindow({ type: 'export', format: 'fdx' }) }
            ] : [
              { label: t('Plain Text (.txt)'), click: () => sendToWindow({ type: 'export', format: 'txt' }) },
              { label: 'Markdown (.md)', click: () => sendToWindow({ type: 'export', format: 'md' }) },
              { label: t('Web Page (.html)'), click: () => sendToWindow({ type: 'export', format: 'html' }) },
              { label: 'PDF (.pdf)', click: () => sendToWindow({ type: 'export', format: 'pdf' }) },
              { label: 'Word (.docx)', click: () => sendToWindow({ type: 'export', format: 'docx' }) },
              { label: 'EPUB (.epub)', click: () => sendToWindow({ type: 'export', format: 'epub' }) },
              { type: 'separator' },
              {
                id: 'export-custom-chapter-titles',
                label: t('Chapter Titles Only'),
                type: 'checkbox',
                checked: !!readJSON(getLibraryFile(), {}).exportCustomChapterTitles,
                click: (item) => sendToWindow({ type: 'exportCustomChapterTitles', checked: item.checked })
              }
            ]
          },
          { type: 'separator' },
          {
            label: t('Email Draft to Myself'),
            accelerator: 'CmdOrCtrl+E',
            click: () => sendToWindow({ type: 'emailDraft' })
          },
          { label: t('Email Settings…'), click: () => sendToWindow({ type: 'emailSettings' }) },
          { label: t('Cover Art…'), click: () => sendToWindow({ type: 'coverArt' }) },
          {
            label: t('Goals…'),
            accelerator: 'CmdOrCtrl+,',
            click: () => sendToWindow({ type: 'stats' })
          },
          {
            label: t('New Books Open To'),
            submenu: [
              { label: t('Blank Page'), type: 'radio', checked: writingStyle !== 'plotter', click: () => sendToWindow({ type: 'writingStyle', value: 'pantser' }) },
              { label: t('Outline First'), type: 'radio', checked: writingStyle === 'plotter', click: () => sendToWindow({ type: 'writingStyle', value: 'plotter' }) }
            ]
          },
          { type: 'separator' },
          {
            label: t('Import Manuscripts…'),
            accelerator: 'CmdOrCtrl+Shift+I',
            click: () => sendToWindow({ type: 'import' })
          },
          { label: t('Reshelve a Book…'), click: () => sendToWindow({ type: 'reshelve' }) },
          { label: t('Library Folder…'), click: () => { chooseLibraryFolder().catch((err) => logError('library folder', err)); } },
          { type: 'separator' },
          ...(isMac ? [{ role: 'close', label: t('Close Window') }] : [{ role: 'quit', label: t('Quit') }])
        ]
      },
      {
        // macOS slips Writing Tools and AutoFill into this menu on its own;
        // hideSystemEditItems() hides them again (see below)
        label: t('Edit'),
        submenu: [
          // standard items carry their own labels, so they follow NEO's language
          { role: 'undo', label: t('Undo') }, { role: 'redo', label: t('Redo') },
          { type: 'separator' },
          { role: 'cut', label: t('Cut') }, { role: 'copy', label: t('Copy') }, { role: 'paste', label: t('Paste') },
          { role: 'pasteAndMatchStyle', label: t('Paste and Match Style') }, { role: 'selectAll', label: t('Select All') },
          { type: 'separator' },
          {
            label: isMac ? t('Find & Replace') : t('Find & Replace').replace(/&/g, '&&'),
            accelerator: 'CmdOrCtrl+F',
            click: () => sendToWindow({ type: 'find' })
          },
          {
            label: t('Spellcheck Pass'),
            accelerator: 'CmdOrCtrl+;',
            click: () => sendToWindow({ type: 'spellcheck' })
          },
          {
            label: t('Spellcheck Language'),
            submenu: Object.entries(spellLanguages).map(([code, lang]) => ({
              label: lang.label,
              type: 'radio',
              checked: getSpellLanguage() === code,
              click: () => sendToWindow({ type: 'spellLanguage', value: code })
            }))
          }
        ]
      },
      {
        label: t('Format'),
        submenu: [
          {
            label: t('Body Font'),
            submenu: [
              ...bodyFonts.map((f) => ({
                label: f,
                click: () => sendToWindow({ type: 'bodyFont', value: f })
              })),
              { type: 'separator' },
              { label: t('Other Font…'), click: () => sendToWindow({ type: 'bodyFontPick' }) }
            ]
          },
          {
            label: t('Drop Cap Style'),
            submenu: [
              { label: t('Literary'), click: () => sendToWindow({ type: 'dropCap', value: 'literary' }) },
              { label: t('Fantasy'), click: () => sendToWindow({ type: 'dropCap', value: 'fantasy' }) },
              { label: t('Sci-Fi'), click: () => sendToWindow({ type: 'dropCap', value: 'scifi' }) },
              { type: 'separator' },
              { label: t('Off'), click: () => sendToWindow({ type: 'dropCap', value: 'none' }) }
            ]
          },
          {
            label: t('Align Paragraph'),
            submenu: [
              { label: t('Left'), accelerator: 'CmdOrCtrl+Shift+L', click: () => sendToWindow({ type: 'align', value: 'left' }) },
              { label: t('Center'), accelerator: 'CmdOrCtrl+Shift+C', click: () => sendToWindow({ type: 'align', value: 'center' }) },
              { label: t('Right'), accelerator: 'CmdOrCtrl+Shift+R', click: () => sendToWindow({ type: 'align', value: 'right' }) },
              { label: t('Justify'), accelerator: 'CmdOrCtrl+Shift+J', click: () => sendToWindow({ type: 'align', value: 'justify' }) }
            ]
          },
          { type: 'separator' },
          { label: t('Larger Text'), accelerator: 'CmdOrCtrl-Plus', click: () => sendToWindow({ type: 'fontSize', value: 1 }) },
          { label: t('Smaller Text'), accelerator: 'CmdOrCtrl-Minus', click: () => sendToWindow({ type: 'fontSize', value: -1 }) },
          { label: t('Reset Text Size'), accelerator: 'CmdOrCtrl+0', click: () => sendToWindow({ type: 'fontSize', value: 0 }) },
          { type: 'separator' },
          {
            label: t('Typewriter Scrolling'),
            accelerator: 'CmdOrCtrl+Shift+T',
            type: 'checkbox',
            checked: typewriterState,
            click: () => sendToWindow({ type: 'typewriter' })
          },
          {
            label: t('Merge beats upward when deleting a scene'),
            accelerator: 'CmdOrCtrl+Shift+M',
            type: 'checkbox',
            checked: !!readJSON(getLibraryFile(), {}).mergeBeatsOnSceneDelete,
            click: (item) => sendToWindow({ type: 'mergeBeatsOnSceneDelete', checked: item.checked })
          },
          { type: 'separator' },
          // tick when the caret sits in one; the keys are the editor's own
          // (they split or continue a paragraph, which a menu item can't), so
          // they're named here without an accelerator
          {
            label: t('Flush Paragraph') + '\t' + (isMac ? '⇧Enter' : 'Shift+Enter'),
            visible: !scriptState.on,
            type: 'checkbox',
            checked: flushState,
            click: () => sendToWindow({ type: 'flush' })
          },
          {
            label: t('Poetry Paragraph') + '\t' + (isMac ? '⇧⌘Enter' : 'Ctrl+Shift+Enter'),
            visible: !scriptState.on,
            type: 'checkbox',
            checked: poetryState,
            click: () => sendToWindow({ type: 'poetry' })
          },
          ...(scriptState.on
            ? [
              [t('Scene Heading'), 'heading'],
              [t('Action'), 'action'],
              [t('Character'), 'character'],
              [t('Parenthetical'), 'paren'],
              [t('Dialogue'), 'dialogue'],
              [t('Transition'), 'transition'],
              [t('Shot'), 'shot']
            ].map(([label, value], i) => ({
              label: `${label}\t${isMac ? '⌘' : 'Ctrl+'}${i + 1}`,
              type: 'radio',
              checked: scriptState.element === value,
              click: () => sendToWindow({ type: 'scriptElement', value })
            }))
            : []),
          { type: 'separator' },
          // *italic* and **bold** as you type or paste; off for writers who
          // keep literal asterisks
          {
            label: t('Markdown Emphasis'),
            type: 'checkbox',
            checked: !readJSON(getLibraryFile(), {}).markdownOff,
            click: (item) => sendToWindow({ type: 'markdownEmphasis', checked: item.checked })
          }
        ]
      },
      {
        label: t('View'),
        submenu: [
          {
            label: t('Keyboard Shortcuts…'),
            accelerator: 'CmdOrCtrl+/',
            click: () => sendToWindow({ type: 'help' })
          },
          { type: 'separator' },
          {
            label: t('Full Screen'),
            accelerator: 'CmdOrCtrl+Shift+F',
            click: () => {
              const w = BrowserWindow.getFocusedWindow();
              if (w) w.setFullScreen(!w.isFullScreen());
            }
          },
          {
            label: t('Focus Mode'),
            submenu: [
              { label: t('Cycle'), accelerator: 'CmdOrCtrl+Shift+O', click: () => sendToWindow({ type: 'focusCycle' }) },
              { type: 'separator' },
              { label: t('Sentence'), type: 'radio', checked: viewState.focus === 'sentence', click: () => sendToWindow({ type: 'focus', value: 'sentence' }) },
              { label: t('Paragraph'), type: 'radio', checked: viewState.focus === 'paragraph', click: () => sendToWindow({ type: 'focus', value: 'paragraph' }) },
              { label: t('Off'), type: 'radio', checked: viewState.focus === 'off', click: () => sendToWindow({ type: 'focus', value: 'off' }) }
            ]
          },
          {
            label: t('Vim Keys'),
            type: 'checkbox',
            checked: vimState,
            click: () => sendToWindow({ type: 'vim' })
          },
          { type: 'separator' },
          {
            label: t('Page'),
            submenu: [
              { label: t('Night'), type: 'radio', checked: viewState.pageTheme !== 'paper' && viewState.pageTheme !== 'light', click: () => sendToWindow({ type: 'pageTheme', value: 'night' }) },
              { label: t('Paper'), type: 'radio', checked: viewState.pageTheme === 'paper', click: () => sendToWindow({ type: 'pageTheme', value: 'paper' }) },
              // white paper in a light room: the whole app, shelf included
              { label: t('Light'), type: 'radio', checked: viewState.pageTheme === 'light', click: () => sendToWindow({ type: 'pageTheme', value: 'light' }) }
            ]
          },
          {
            label: t('Brighter Interface'),
            type: 'checkbox',
            checked: viewState.uiBright,
            click: () => sendToWindow({ type: 'uiBright' })
          },
          {
            label: t('Interface Size'),
            // as far as the page zoom goes: 300%
            submenu: [1, 1.25, 1.5, 2, 2.5, 3].map((z) => ({
              label: z === 1 ? t('Normal') : new Intl.NumberFormat(getUiLanguage() || 'en', { style: 'percent' }).format(z),
              type: 'radio',
              checked: uiZoomState === z,
              click: () => sendToWindow({ type: 'uiZoom', value: z })
            }))
          },
          { type: 'separator' },
          {
            label: t('Language'),
            submenu: listLanguages().map((lang) => ({
              label: lang.name,
              type: 'radio',
              checked: getUiLanguage() === lang.code,
              click: () => setUiLanguage(lang.code)
            }))
          }
        ]
      },
      {
        role: 'windowMenu',
        label: t('Window'),
        submenu: [
          { role: 'minimize', label: t('Minimize') },
          { role: 'zoom', label: t('Zoom') },
          ...(isMac
            ? [{ type: 'separator' }, { role: 'front', label: t('Bring All to Front') }]
            : [{ role: 'close', label: t('Close') }])
        ]
      },
      {
        label: t('Help'),
        submenu: [
          {
            label: t('NEO Shortcuts'),
            click: () => sendToWindow({ type: 'help' })
          },
          { type: 'separator' },
          {
            label: t('About NEO'),
            click: () => sendToWindow({ type: 'about' })
          },
          {
            label: t('Check for Update…'),
            click: () => sendToWindow({ type: 'checkUpdate' })
          }
        ]
      }
    ];
    const menu = Menu.buildFromTemplate(template);
    editMenuState.edit = null; // the old menu bar is going: forget its Edit menu first
    Menu.setApplicationMenu(menu);
    if (isMac) {
      // macOS adds its items as the menu opens: NEO hears each addition
      // (watchEditMenu) and looks again whenever the menu opens
      const edit = menu.items.find((it) => it.submenu && it.label === t('Edit'));
      if (edit) {
        // NEO's own Edit items in order; null stands for a separator
        editMenuState.index = menu.items.indexOf(edit);
        editMenuState.ours = edit.submenu.items.map((it) => (it.type === 'separator' ? null : menuTitle(it.label)));
        watchEditMenu();
        setImmediate(hideSystemEditItems);
        edit.submenu.on('menu-will-show', hideSystemEditItems);
      }
    }
  }


  return buildMenu;
};
