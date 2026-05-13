# flarum-printtrade-theme

Flarum theme + SSO polish for the [The Print Trade](https://theprinttrade.com) community forum at [forum.theprinttrade.com](https://forum.theprinttrade.com).

## What this extension does

1. **Theme** — visually matches `theprinttrade.com`:
   - Epilogue (headlines) / Manrope (body, labels) / Inconsolata (mono)
   - Brand blue `#1941ff`
   - Flat 0px corners, hairline `#e5e5e5` borders
   - Paper-white header with single black underline
   - Editorial discussion list (eyebrow labels, dot separators, tabular numerals)

2. **SSO polish** — supplies the locale strings that make the SSO flow read naturally:
   - "Log In with theprinttrade.com" (instead of `fof/oauth`'s default "Generic")
   - Persistent across container rebuilds, unlike the vendor YAML edit it replaces.

## Install

In the Flarum container (or via Composer):

```bash
composer require theprinttrade/flarum-printtrade-theme:dev-main
php flarum cache:clear
```

For the `crazymax/flarum` image, add to `/data/extensions/list`:

```
theprinttrade/flarum-printtrade-theme:dev-main
```

…with a VCS repository entry so Composer can resolve it:

```
COMPOSER_REPOSITORIES='{"theprinttrade":{"type":"vcs","url":"https://github.com/resolutionathens/flarum-printtrade-theme"}}'
```

## Dev

```bash
cd js
yarn install
yarn build
# or `yarn dev` for watch mode
```

## License

[MIT](LICENSE.md)
