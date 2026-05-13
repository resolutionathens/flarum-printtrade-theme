<?php

/*
 * theprinttrade/flarum-printtrade-theme
 *
 * Brings the Flarum forum visually in line with theprinttrade.com — uses
 * Epilogue + Manrope + Inconsolata (loaded via Google Fonts), the brand
 * blue (#1941ff), and the design system's flat / hairline-bordered /
 * 0px-corner aesthetic. Also supplies persistent locale overrides for
 * the SSO flow (kills the vendor edit fragility flagged in the project
 * memory).
 */

use Flarum\Extend;

return [
    // CSS-only theme in v0. The js/ directory is scaffolded for future
    // overrides (eyebrow labels, dot separators, branded empty states),
    // but we don't ship a JS bundle yet — a malformed stub bundle takes
    // down the whole forum SPA, since Flarum concatenates every
    // extension's bundle into a single forum.js.
    (new Extend\Frontend('forum'))
        ->css(__DIR__ . '/less/forum.less'),

    (new Extend\Frontend('admin'))
        ->css(__DIR__ . '/less/admin.less'),

    new Extend\Locales(__DIR__ . '/resources/locale'),
];
