/*
 * theprinttrade/flarum-printtrade-theme — forum entry
 *
 * Injects a cross-product nav into the forum header so users can move
 * between forum.theprinttrade.com and theprinttrade.com sections
 * without leaving via the browser. Mirrors the parent site's nav and
 * marks "Forum" as the current section.
 *
 * Uses raw Mithril hyperscript (`m('a', ...)`) rather than the
 * `LinkButton.component()` factory because the latter has been a moving
 * target across Flarum + Mithril versions, and we want the bundle to be
 * robust against minor core upgrades.
 */

import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import HeaderPrimary from 'flarum/forum/components/HeaderPrimary';

// Mithril is exposed on the global as `m`.
declare const m: any;

const SITE_ORIGIN = 'https://theprinttrade.com';

const CROSS_NAV: Array<{ label: string; href?: string; active?: boolean }> = [
  { label: 'Directory', href: `${SITE_ORIGIN}/directory` },
  { label: 'Limited',   href: `${SITE_ORIGIN}/limited` },
  { label: 'Exchanges', href: `${SITE_ORIGIN}/exchanges` },
  { label: 'Rules',     href: `${SITE_ORIGIN}/rules` },
  { label: 'Forum',     active: true },
  { label: 'Profile',   href: `${SITE_ORIGIN}/profile` },
];

app.initializers.add('theprinttrade-printtrade-theme', () => {
  // eslint-disable-next-line no-console
  console.log('[printtrade-theme] initializer registered');

  // Inject "THE PRINT TRADE" as a styled span next to the icon-only logo,
  // mirroring the parent site's <img> + <span>The Print Trade</span>
  // pattern. Flarum's stock template renders ONLY the logo image when
  // logo_path is set (suppressing the forum_title), so we patch Header
  // via DOM hook after the logo renders.
  //
  // We do this via a Mithril oncreate on the logo's parent link so it
  // survives Mithril redraws without us having to manually re-inject.
  ensureHeaderTitleSpan();
  // Re-check on every route change (in case the header re-renders).
  if (typeof window !== 'undefined') {
    document.addEventListener('DOMContentLoaded', ensureHeaderTitleSpan);
    setInterval(ensureHeaderTitleSpan, 1000);
  }

  extend(HeaderPrimary.prototype, 'items', function (this: HeaderPrimary, items: any) {
    CROSS_NAV.forEach((link, i) => {
      const className =
        'pt-cross-nav-item' + (link.active ? ' pt-cross-nav-item--active' : '');

      const node = link.active
        ? m('span', { className }, link.label)
        : m(
            'a',
            {
              className,
              href: link.href,
              rel: 'noopener',
            },
            link.label
          );

      // Wrap in <li class="item-pt-nav-N"> for Flarum's ItemList renderer.
      items.add(`pt-nav-${i}`, node, 200 - i);
    });
  });
});

/**
 * Mounts a "THE PRINT TRADE" wordmark span next to the icon logo. Idempotent
 * — skips when the span already exists. setInterval guards against Mithril
 * redraws blowing it away, which can happen during page transitions before
 * the header component re-mounts.
 */
function ensureHeaderTitleSpan(): void {
  const headerTitle = document.querySelector('.Header-title');
  if (!headerTitle) return;
  if (headerTitle.querySelector('.pt-wordmark')) return;
  const link = headerTitle.querySelector('a');
  if (!link) return;
  const span = document.createElement('span');
  span.className = 'pt-wordmark';
  span.textContent = 'The Print Trade';
  link.appendChild(span);
}
