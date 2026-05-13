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
import HeaderTitle from 'flarum/forum/components/HeaderTitle';

// Mithril is exposed on the global as `m`.
declare const m: any;

const SITE_ORIGIN = 'https://theprinttrade.com';

interface CrossNavLink {
  label: string;
  href?: string;
  active?: boolean;
}

// Mirrors the parent site's nav order. Two intentional deviations:
//   - "Forum" inserted between Rules and Profile to mark the user's
//     current section (active styling). Parent has no such item because
//     the forum lives on a subdomain.
//   - "Sign Out" omitted. Logout is parent-only by design: signing out
//     of the forum without killing the parent's OIDC session would
//     immediately re-auth the user on next request. The avatar dropdown
//     also has its Log Out item hidden (see less/forum.less) to enforce
//     this single source of truth.
const CROSS_NAV: CrossNavLink[] = [
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

  // Inject a real <span class="Header-wordmark">The Print Trade</span>
  // inside the .Header-title anchor, next to the .Header-logo img. This
  // mirrors the parent site's markup exactly:
  //
  //   <a class="flex items-center gap-3">
  //     <img class="h-8 sm:h-9 w-auto" src="/brand/icon-black.svg">
  //     <span class="... text-base sm:text-lg ...">The Print Trade</span>
  //   </a>
  //
  // An earlier iteration used a CSS ::after pseudo to avoid Mithril
  // redraws clobbering injected DOM, but pseudo-elements render with
  // subtly different metrics than real text (font hinting, kerning,
  // baseline alignment) and they're not exposed to assistive tech the
  // same way. Extending the component's view() rebuilds the vnode on
  // every redraw so there's nothing to clobber.
  extend(HeaderTitle.prototype, 'view', function (this: any, vnode: any) {
    if (!vnode || !Array.isArray(vnode.children)) return;
    const link = vnode.children.find((c: any) => c && typeof c === 'object' && c.tag);
    if (!link || !Array.isArray(link.children)) return;
    link.children.push(
      m('span', { className: 'Header-wordmark', 'aria-hidden': 'true' }, 'The Print Trade')
    );
  });

  extend(HeaderPrimary.prototype, 'items', function (this: HeaderPrimary, items: any) {
    CROSS_NAV.forEach((link, i) => {
      let classes = 'pt-cross-nav-item';
      if (link.active) classes += ' pt-cross-nav-item--active';

      const node = link.active
        ? m('span', { className: classes }, link.label)
        : m('a', { className: classes, href: link.href, rel: 'noopener' }, link.label);

      items.add(`pt-nav-${i}`, node, 200 - i);
    });
  });
});
