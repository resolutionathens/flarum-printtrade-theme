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
import IndexPage from 'flarum/forum/components/IndexPage';
import LogInButton from 'flarum/forum/components/LogInButton';
import Button from 'flarum/common/components/Button';

// NOTE: Flarum 1.x does NOT expose a HeaderTitle component — the
// `<div class="Header-title">` is rendered inline inside App.view, so
// there's nothing to extend on the JS side. The wordmark next to the
// logo is therefore styled via a CSS ::after pseudo-element in
// less/forum.less. Don't try to import 'flarum/forum/components/HeaderTitle' —
// the compat lookup returns undefined and throws at extend() time.

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
// "Forum" carries both `active: true` AND an href to the forum root —
// active so it gets the brand-blue underline, href so it works as a
// "home" link from sub-pages (tag views, discussions, etc.) the same
// way the Darkroom logo on the left does.
const CROSS_NAV: CrossNavLink[] = [
  { label: 'Directory', href: `${SITE_ORIGIN}/directory` },
  { label: 'Limited',   href: `${SITE_ORIGIN}/limited` },
  { label: 'Exchanges', href: `${SITE_ORIGIN}/exchanges` },
  { label: 'Rules',     href: `${SITE_ORIGIN}/rules` },
  { label: 'Forum',     href: '/', active: true },
  { label: 'Profile',   href: `${SITE_ORIGIN}/profile` },
];

// Footer — mirrors the parent site's footer exactly.
//
// Flarum 1.x has no default footer, and no `Footer*` component to extend.
// We append a static <footer.pt-footer> as a direct child of <body>,
// which puts it OUTSIDE Mithril's #app root — so SPA redraws never
// touch it. One-time inject at boot; persists across navigations.
//
// Mirror source from theprinttrade.com:
//   <footer class="border-t border-neutral-200">
//     <div class="max-w-6xl mx-auto px-4 sm:px-6 py-8 text-center">
//       <p class="text-[10px] font-bold tracking-[0.2em] uppercase
//                 text-neutral-400">The Print Trade</p>
//       <p class="text-xs text-neutral-400 mt-2">A community for trading
//          collector-grade photography prints.</p>
//       <div class="flex items-center justify-center gap-3 mt-2">
//         About · Terms of Use · Privacy Policy · Feedback
//       </div>
//     </div>
//   </footer>
function injectFooter(): void {
  if (document.querySelector('.pt-footer')) return;

  const footer = document.createElement('footer');
  footer.className = 'pt-footer';
  footer.innerHTML = `
    <div class="pt-footer-inner">
      <p class="pt-footer-brand">The Print Trade</p>
      <p class="pt-footer-tagline">A community for trading collector-grade photography prints.</p>
      <div class="pt-footer-links">
        <a href="${SITE_ORIGIN}/about">About</a>
        <span class="pt-footer-dot">·</span>
        <a href="${SITE_ORIGIN}/terms">Terms of Use</a>
        <span class="pt-footer-dot">·</span>
        <a href="${SITE_ORIGIN}/privacy">Privacy Policy</a>
        <span class="pt-footer-dot">·</span>
        <a href="https://theprinttrade.userjot.com/" target="_blank" rel="noopener">Feedback</a>
      </div>
    </div>
  `;
  document.body.appendChild(footer);
}

app.initializers.add('theprinttrade-printtrade-theme', () => {
  // eslint-disable-next-line no-console
  console.log('[printtrade-theme] initializer registered');

  injectFooter();

  extend(HeaderPrimary.prototype, 'items', function (this: HeaderPrimary, items: any) {
    CROSS_NAV.forEach((link, i) => {
      let classes = 'pt-cross-nav-item';
      if (link.active) classes += ' pt-cross-nav-item--active';

      // If the item has an href, always render as <a> (even when active,
      // so it stays clickable as a "home" link from sub-pages). The
      // active class still drives the underline styling.
      const node = link.href
        ? m('a', { className: classes, href: link.href, rel: 'noopener' }, link.label)
        : m('span', { className: classes }, link.label);

      items.add(`pt-nav-${i}`, node, 200 - i);
    });
  });

  // Override fof/oauth's LogInButton click handler to use a top-level
  // navigation instead of window.open(). iOS Safari opens popups as
  // new tabs where window.opener postMessage silently fails, breaking
  // the OAuth handoff (Jake + Dow both got caught in this).
  //
  // fof/oauth registers its own extend() on LogInButton.initAttrs that
  // sets attrs.onclick = popupOpener. Our theme is loaded LAST in the
  // extensions_enabled order, so this extend() runs AFTER fof/oauth's
  // and gets the final word on the onclick handler.
  //
  // Paired with the TopLevelResponseFactory override on the PHP side
  // (see extend.php), the full flow becomes:
  //   1. Click button → top-level navigate to /auth/generic
  //   2. fof/oauth's controller redirects to theprinttrade.com OIDC
  //   3. User authenticates, redirects back to /auth/generic?code=...
  //   4. Our overridden ResponseFactory auto-creates the user (if
  //      needed) and returns RedirectResponse('/') with the session
  //      cookie attached
  //   5. Browser follows redirect, user lands on / logged in
  extend(LogInButton.prototype, 'initAttrs', function (this: any, attrs: any) {
    if (!attrs.path) return;

    attrs.onclick = function (e: MouseEvent) {
      e.preventDefault();
      window.location.assign(app.forum.attribute('baseUrl') + attrs.path);
    };
  });

  // Members-only forum: there are no "guests" in the social sense — anyone
  // landing here unauthenticated either belongs (and just needs to log in)
  // or got the URL by mistake. The stock IndexPage shows a compose icon
  // ("Start a Discussion") in the mobile top-right slot, which for a
  // signed-out visitor is a confusing dead-end — clicking it opens a
  // login modal but the icon itself gives no hint that auth is required.
  //
  // For guests, swap that button for a "Log In" CTA that uses the same
  // App-primaryControl mobile slot. Clicking it does a top-level redirect
  // to /auth/generic — same path used by our LogInButton override above,
  // so iOS Safari works (no popup) and the user lands back on the forum
  // logged in via the TopLevelResponseFactory flow.
  //
  // Desktop also benefits: the left-rail "Start a Discussion" primary
  // button becomes "Log In" with a sign-in icon, which is a clearer
  // affordance for an authenticated forum.
  extend(IndexPage.prototype, 'sidebarItems', function (this: IndexPage, items: any) {
    if (app.session.user) return;

    const loginButton = Button.component(
      {
        icon: 'fas fa-sign-in-alt',
        className: 'Button Button--primary IndexPage-newDiscussion',
        itemClassName: 'App-primaryControl',
        onclick: (e: MouseEvent) => {
          e.preventDefault();
          window.location.assign(app.forum.attribute('baseUrl') + '/auth/generic');
        },
      },
      app.translator.trans('core.forum.header.log_in_link')
    );

    items.replace('newDiscussion', loginButton);
  });
});
