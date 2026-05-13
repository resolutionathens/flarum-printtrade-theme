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
use ThePrintTrade\Theme\Provider\AuthOverrideProvider;

return [
    (new Extend\Frontend('forum'))
        ->css(__DIR__ . '/less/forum.less')
        ->js(__DIR__ . '/js/dist/forum.js'),

    (new Extend\Frontend('admin'))
        ->css(__DIR__ . '/less/admin.less')
        ->js(__DIR__ . '/js/dist/admin.js'),

    new Extend\Locales(__DIR__ . '/resources/locale'),

    // Bypass fof/oauth's SignUpModal + popup-completion HTML; auto-create
    // SSO users server-side and return a top-level RedirectResponse so
    // the flow works on iOS Safari. See TopLevelResponseFactory.
    (new Extend\ServiceProvider())->register(AuthOverrideProvider::class),
];
