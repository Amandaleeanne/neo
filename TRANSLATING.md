# Translating NEO

NEO's interface can be shown in any language. Each language is a single file in `locales/`, and adding one needs no programming.

## Add a language

1. Copy `locales/_template.json` to `locales/<code>.json`, where `<code>` is the language's code: `de` for German, `es` for Spanish, `pt-BR` for Brazilian Portuguese.
2. Set `_meta.name` to the language's own name (`Deutsch`, `Español`). That is what the **View → Language** menu shows.
3. Fill in each empty value with the translation of its English key. Anything left empty simply stays in English, so a partial translation is fine to start with.
4. Check your work: `node scripts/i18n.js check <code>`. It lists what is missing, and any `{placeholder}` that went astray.

The new language appears in **View → Language** the next time NEO starts.

## Regional variants

Language codes follow [BCP 47](https://www.rfc-editor.org/info/bcp47): a language (`fr`), optionally followed by a region (`fr-CA`, `fr-BE`, `fr-CH`). NEO also accepts the POSIX spelling (`fr_CA`) when reading a system or saved setting.

A language's base file (`fr.json`) serves every region. A regional file (`fr-CA.json`) holds **only the strings that differ** there, and everything else comes from the base file, then from English:

```
fr-CA.json  →  fr.json  →  English
```

So `fr-CA.json` is short: in Quebec, "courriel" instead of "e-mail", and no space before `; ! ?`. A system set to Belgian or Swiss French, with no `fr-BE.json` or `fr-CH.json`, simply uses `fr.json`. Add a regional file only when wording really differs; numbers and dates already follow the region through the system's own formats.

`node scripts/i18n.js check fr-CA` counts the base file's strings as covered.

## The rules of the file

- **Placeholders** in braces, like `{title}` or `{n}`, are filled in by NEO. Keep them, spelled exactly the same; you can move them anywhere in the sentence.
- **Plurals.** When a string counts something with `{n}`, you can give one form per plural category instead of a single string:

  ```json
  "{n} words": { "one": "{n} mot", "other": "{n} mots" }
  ```

  The categories are those of your language in [Unicode's plural rules](https://www.unicode.org/cldr/charts/latest/supplemental/language_plural_rules.html) (`one`, `few`, `many`, `other`…). `other` is always required.
- **Numbers** are formatted for the language automatically (`1,234` in English, `1 234` in French).
- **`&amp;`** appears in a few help strings that are shown as HTML. Keep it as `&amp;` (or rephrase without an ampersand).
- **Keyboard keys** such as `⌘`, `⇧` or `Ctrl` are added by NEO; translate the words around them.

## For developers

The English text is the key. In the window (`app.js`) and the main process (`main.js`), wrap every string a writer can see:

```js
toast(t('Chapter removed — its words are in Darlings, or {key} to undo', { key: KZ }));
```

- `t()` translates now. `tk()` only marks a string for translation where it is defined, for strings translated later with `t()` when shown.
- In `index.html`, mark text with `data-i18n`, and attributes with `data-i18n-title`, `data-i18n-placeholder` or `data-i18n-ph`.
- English plural forms live in `locales/en.json`.
- After adding or changing strings, run `node scripts/i18n.js template` to refresh `locales/_template.json`, and `node scripts/i18n.js check fr` (for each language) to see what needs translating.

The window receives its language once, before any of its code runs (see `preload.js`); changing the language saves the open book and reloads the window.
