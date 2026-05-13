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

interface CrossNavLink {
  label: string;
  href?: string;
  active?: boolean;
  logout?: boolean;
}

// Mirrors the parent site's nav order exactly:
//   Directory · Limited · Exchanges · Rules · (Forum, active here)
//   · Profile · Admin · Sign Out
//
// Admin is omitted since admin status here is per-product and the
// forum has its own admin UI under /admin.
const CROSS_NAV: CrossNavLink[] = [
  { label: 'Directory', href: `${SITE_ORIGIN}/directory` },
  { label: 'Limited',   href: `${SITE_ORIGIN}/limited` },
  { label: 'Exchanges', href: `${SITE_ORIGIN}/exchanges` },
  { label: 'Rules',     href: `${SITE_ORIGIN}/rules` },
  { label: 'Forum',     active: true },
  { label: 'Profile',   href: `${SITE_ORIGIN}/profile` },
  { label: 'Sign Out',  logout: true },
];

app.initializers.add('theprinttrade-printtrade-theme', () => {
  // eslint-disable-next-line no-console
  console.log('[printtrade-theme] initializer registered');

  // Note: the "THE PRINT TRADE" wordmark next to the logo is rendered via a
  // CSS ::after pseudo-element in less/forum.less (.Header-title a::after).
  // Earlier versions tried injecting a real <span> via DOM, but Mithril
  // redraws would blow it away. Pseudo-elements live outside the vDOM and
  // survive every redraw with zero JS overhead.

  extend(HeaderPrimary.prototype, 'items', function (this: HeaderPrimary, items: any) {
    CROSS_NAV.forEach((link, i) => {
      let classes = 'pt-cross-nav-item';
      if (link.active) classes += ' pt-cross-nav-item--active';
      if (link.logout) classes += ' pt-cross-nav-item--signout';

      let node: any;
      if (link.active) {
        node = m('span', { className: classes }, link.label);
      } else if (link.logout) {
        node = m(
          'a',
          {
            className: classes,
            href: '#',
            onclick: (e: Event) => {
              e.preventDefault();
              // Flarum's stock logout — POSTs CSRF-protected to /logout.
              // app.session.logout() exists in 1.x and is the canonical path.
              if (app.session && typeof (app.session as any).logout === 'function') {
                (app.session as any).logout();
              } else {
                // Fallback: direct nav to the logout endpoint.
                window.location.href = '/logout?token=' + (app.session as any).csrfToken;
              }
            },
          },
          link.label
        );
      } else {
        node = m(
          'a',
          { className: classes, href: link.href, rel: 'noopener' },
          link.label
        );
      }

      items.add(`pt-nav-${i}`, node, 200 - i);
    });
  });
});
