# Flarum Print Trade Theme — onboarding notes

A Flarum **1.x** theme extension for `forum.theprinttrade.com` — the
community forum that sits alongside `theprinttrade.com`. The forum is
sub-branded as **The Darkroom** but Flarum's `forum_title` setting can
stay "The Print Trade" for SEO.

## Live forum

- Production URL: `https://forum.theprinttrade.com`
- Coolify host: `ssh root@178.156.135.154`, dashboard at `coolify.adoors.top`
- Flarum container: `flarum-sg9o4eyorch8eev34l8m5rtq` (image: `crazymax/flarum:1.8.10`)
- DB container: `mariadb-sg9o4eyorch8eev34l8m5rtq` (image: `mariadb:10.11`)
- Coolify project uuid: `atamv3et3ovjtbvw6hdd5kg7`
- Coolify service uuid: `sg9o4eyorch8eev34l8m5rtq`
- DB credentials live in `/opt/flarum/config.php` inside the Flarum container
  (read via `docker exec`; **never grep with wide LIKE filters that could echo
  the secret to a transcript**)

## Architecture

```
composer.json              — Flarum extension metadata
extend.php                 — Wires Frontend (forum+admin) LESS+JS + Locales
less/forum.less            — Main theme stylesheet (~900 lines)
less/admin.less            — Minimal admin overrides
js/forum.ts                — Webpack entry (re-exports src/forum)
js/src/forum/index.ts      — Mithril `extend()` calls + footer injection
js/dist/forum.js           — Compiled bundle (committed)
resources/locale/en.yml    — Locale string overrides (button labels, etc.)
```

The repo lives at `resolutionathens/flarum-printtrade-theme` on GitHub.

## Brand tokens

Cribbed from `/Users/slip/Documents/GitHub/photozines-exchange/app/assets/main.css`
(the parent site's design system).

| Token | Value |
|---|---|
| `@pt-blue-500` | `#1941ff` |
| `@pt-blue-600` | `#1235d9` (hover) |
| `@pt-neutral-900` | `#171717` |
| `@pt-neutral-500` | `#737373` |
| `@pt-neutral-200` | `#e5e5e5` (hairline borders) |
| `@pt-neutral-100` | `#f5f5f5` |
| Headline | `Epilogue` 800 / 500, often `-0.025em` to `-0.04em` tracking |
| Body | `Manrope` 400-700 |
| Mono | `Inconsolata` |
| Border radius | `0` everywhere (sharp corners) |
| Container max | `1152px` (`max-w-6xl`) |

## Deploy

Standard path is broken (see below). Current workaround:

```bash
# 1. Edit LESS / TS. If TS changed, rebuild bundle:
cd js && npm run build

# 2. Commit + push.
git add -A && git commit -m "..." && git push origin master
SHA=$(git rev-parse HEAD)

# 3. Tarball deploy into vendor dir on the container:
ssh root@178.156.135.154 "docker exec flarum-sg9o4eyorch8eev34l8m5rtq sh -c '\
  cd /tmp && rm -rf flarum-printtrade-theme-* pt.tar.gz && \
  curl -sL https://github.com/resolutionathens/flarum-printtrade-theme/archive/$SHA.tar.gz -o pt.tar.gz && \
  tar xzf pt.tar.gz && \
  cp -r flarum-printtrade-theme-$SHA/* /opt/flarum/vendor/theprinttrade/flarum-printtrade-theme/ && \
  chown -R flarum:flarum /opt/flarum/vendor/theprinttrade/flarum-printtrade-theme/ && \
  yasu flarum:flarum php /opt/flarum/flarum cache:clear && \
  rm -f /data/assets/forum.* /data/assets/admin.* /data/assets/rev-manifest.json'"
```

**Composer is broken on this container** — `composer update --no-cache`
triggers a `TypeError: implode() Argument #2 must be of type ?array` from
Composer's `Git.php:357`. Suspect cause: stale `credential.helper` config in
`/opt/flarum/.composer/config.json`. Fixing it would let us use the normal
`composer update theprinttrade/flarum-printtrade-theme` flow and keep
composer's installed-version metadata in sync with what's actually on disk.

## Flarum 1.x gotchas

- **Version pinning**: `flarum-webpack-config: ^2` is critical. v3.x is for
  Flarum 2.x and emits `flarum.reg.get(...)` style imports that 1.x doesn't
  understand. Symptom: bundle loads but extends silently fail.
- **No `HeaderTitle` component** — the `<div class="Header-title">` is
  rendered inline inside `App.view`. Trying to
  `extend(HeaderTitle.prototype, 'view', ...)` resolves to `undefined.prototype`
  and crashes the whole bundle at init time with
  `theprinttrade-printtrade-theme failed to initialize`. The wordmark next to
  the logo is therefore a CSS `::after` pseudo on `.Header-title a`.
- **Mobile drawer IS the same `.App-header`** — Flarum's mobile UX
  CSS-translates the entire header off-screen as a slide-in drawer. So
  `display: none` on `.Header-primary` at mobile widths erases the cross-nav
  from BOTH the header AND the drawer. Restyle for vertical stacking instead.
- **Avatar background uses CSS custom property** — Flarum 1.8+ renders
  `style="--avatar-bg: <hashcolor>"` on the `.Avatar` span (not
  `style="background: ..."`). Selectors targeting `[style*="background"]` are
  no-ops; use `[style*="--avatar-bg"]` AND override the custom property:
  `--avatar-bg: @pt-blue-500 !important; background: @pt-blue-500 !important`.
- **fof/oauth button class is `FoFLogInButton`** — not bare `.LogInButton`.
  The element has `Button FoFLogInButton LogInButton--<provider>`. Selectors
  like `.Button.LogInButton` never match.

## Locale overrides

`blt950/oauth-generic` ships a locale that sets
`fof-oauth.lib.providers.generic: theprinttrade.com`, which collided with our
override. **Extension load order determines locale precedence** — the last
extension to set a key wins. Flarum 1.x does NOT auto-load themes last;
order is the literal sequence in `settings.extensions_enabled` (JSON array).

Current order (set 2026-05-13) puts this theme last so its locales win:

```
fof-oauth → v17development-third-party-login-only → flarum-nicknames
→ flarum-markdown → blt950-oauth-generic → theprinttrade-printtrade-theme
```

To re-check or adjust:

```bash
docker exec mariadb-... mariadb -uflarum -p... flarum -e \
  "SELECT value FROM flarum_settings WHERE \`key\`='extensions_enabled';"
```

## CSS / LESS gotchas

- **LESS misparses `calc()` with mixed-unit arithmetic**. Writing
  `padding-left: calc(1.5rem - 3px)` in a `.less` file compiles to
  `calc(-1.5rem)` — LESS evaluates the math at compile time and produces
  garbage. Two fixes:
  - Literal px value: `padding-left: 21px;`
  - Escape so LESS passes through to the browser: `padding-left: ~"calc(1.5rem - 3px)";`
- **Active nav items use a positioned `::after` for the underline**, not
  `border-bottom + padding-bottom`. The latter adds height to the active item
  which makes its parent `<ul>` taller than sibling uls, breaking flex-center
  alignment between cross-nav items in `.Header-primary` and the Log In
  button in `.Header-secondary`. See `.pt-cross-nav-item--active::after`.
- **`.Header-secondary > .item-notifications` is a no-op selector** —
  `.item-notifications` is nested one level deeper (inside `.Header-controls > ul`).
  Use flat `.item-notifications, .NotificationsDropdown { display: none; }`.

## Tags

| ID | Name | Slug |
|---|---|---|
| 2 | Introductions | `introductions` |
| 3 | Show & Tell | `show-and-tell` |
| 4 | Printing | `printing` |
| 5 | Photography | `photography` |
| 6 | Trades | `trades` |
| 7 | Meta | `meta` |

Settings enforce **exactly one primary tag** (`min_primary_tags = max_primary_tags = 1`)
and up to 3 optional secondary tags. No tag has a `color` field set — they
inherit neutral styling from `less/forum.less`. Theme primary `#1941ff` at
low alpha looked like lavender on the `.TagHero` background; we override
`.TagHero` to white + Epilogue 800 heading instead.

## Open items (pre-main-site rollout)

1. **Single sign-out is incomplete**. Forum has no logout affordance, and
   logging out at the parent does not invalidate the forum session. Either
   add RP-initiated OIDC logout to fof/oauth, or add a Logout link in the
   avatar dropdown that hits both endpoints.
2. **Fix composer on the container** so future deploys can use
   `composer update` instead of the tarball workaround. Suspect:
   `/opt/flarum/.composer/config.json` `credential.helper` config.
3. **Fonts are loaded from Google Fonts CDN** via `@import` at the top of
   `less/forum.less`. Self-host before main site rollout for privacy +
   reliability.
4. **Bell hidden**. Notifications work but are only reachable via the
   `/notifications` URL. Either re-add a quiet bell or accept that
   notifications live in email only.

## Useful commands

```bash
# DB shell (don't echo passwords into wide LIKE filters)
ssh root@178.156.135.154 docker exec -it mariadb-sg9o4eyorch8eev34l8m5rtq \
  mariadb -uflarum -p flarum

# Flarum CLI (cache clear, info)
ssh root@178.156.135.154 docker exec flarum-sg9o4eyorch8eev34l8m5rtq \
  yasu flarum:flarum php /opt/flarum/flarum cache:clear

# Check installed vs filesystem version
ssh root@178.156.135.154 docker exec flarum-sg9o4eyorch8eev34l8m5rtq \
  yasu flarum:flarum composer show theprinttrade/flarum-printtrade-theme
ssh root@178.156.135.154 "docker exec flarum-sg9o4eyorch8eev34l8m5rtq sh -c \
  'cat /opt/flarum/vendor/theprinttrade/flarum-printtrade-theme/composer.json | grep version'"

# Inspect compiled CSS (debug LESS output without re-deploying)
curl -s https://forum.theprinttrade.com/assets/forum.css | \
  grep -oE '<selector>[^{]*\{[^}]+\}'
```
