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
import SessionDropdown from 'flarum/forum/components/SessionDropdown';
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

// RP-initiated logout configuration.
//
// Better-Auth (the parent's OIDC provider) exposes a spec-compliant
// `end_session_endpoint` at /api/auth/oauth2/endsession. With both
// `client_id` and `post_logout_redirect_uri` supplied, it kills the
// parent's session, revokes any access tokens issued to this client,
// and 302s back to the forum. The redirect URI must match a value
// registered in the trusted client's redirectUrls — see
// photozines-exchange:server/utils/auth.ts.
const PARENT_ENDSESSION = `${SITE_ORIGIN}/api/auth/oauth2/endsession`;
const FORUM_ROOT = 'https://forum.theprinttrade.com/';
const OIDC_CLIENT_ID = 'flarum-forum';

app.initializers.add('theprinttrade-printtrade-theme', () => {
  // eslint-disable-next-line no-console
  console.log('[printtrade-theme] initializer registered');

  injectFooter();

  // Replace Flarum's stock logout (which only kills the forum session
  // and redirects to /) with an RP-initiated logout that ALSO kills the
  // parent's Better-Auth session. Without this, signing out at the
  // forum leaves the user still authenticated at theprinttrade.com — and
  // because OAuth then silently re-consents on the next "Log In with
  // The Print Trade" click, the forum logout effectively does nothing.
  //
  // Flow:
  //  1. Fire-and-forget GET /logout?token=<csrf> to kill the Flarum
  //     server-side session + cookies. `redirect: 'manual'` because we
  //     don't care where it 302s; we're about to navigate elsewhere.
  //  2. Top-level navigate to parent's endsession with both client_id
  //     and post_logout_redirect_uri. Parent kills its session, then
  //     302s back to FORUM_ROOT. User lands on the forum index, logged
  //     out of both systems.
  //
  // We hook this via `SessionDropdown.prototype.items` rather than by
  // monkey-patching `app.session.logout`. Earlier attempt did the latter
  // and crashed the entire theme initializer on guest views because
  // `app.session` can be undefined at initializer time (Flarum sets it
  // up during boot but its shape varies across versions/auth states).
  // The dropdown extend only runs on render, only on authenticated
  // views (guests don't see SessionDropdown), and never touches
  // app.session directly.
  async function rpInitiatedLogout() {
    const csrf = (app.session as any)?.csrfToken || (app.data as any)?.csrfToken;
    if (csrf) {
      try {
        await fetch(`${app.forum.attribute('baseUrl')}/logout?token=${encodeURIComponent(csrf)}`, {
          method: 'GET',
          credentials: 'same-origin',
          redirect: 'manual',
        });
      } catch {
        // Non-fatal: parent endsession will still kill the Better-Auth
        // session, and the post-logout redirect back to the forum will
        // land on a stale Flarum session which the next page load
        // re-syncs via OAuth.
      }
    }
    const params = new URLSearchParams({
      client_id: OIDC_CLIENT_ID,
      post_logout_redirect_uri: FORUM_ROOT,
    });
    window.location.assign(`${PARENT_ENDSESSION}?${params}`);
  }

  extend(SessionDropdown.prototype, 'items', function (this: any, items: any) {
    if (!items || typeof items.has !== 'function' || !items.has('logOut')) return;
    const replacement = Button.component(
      {
        icon: 'fas fa-sign-out-alt',
        onclick: (e: MouseEvent) => {
          e.preventDefault();
          rpInitiatedLogout();
        },
      },
      app.translator.trans('core.forum.header.log_out_button')
    );
    items.replace('logOut', replacement);
  });

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

  // For guests, replace the IndexPage body with a centered sign-in panel.
  //
  // The stock IndexPage shows the WelcomeHero + sidebar + empty discussion
  // list to unauth'd visitors — there's no way to read or post without
  // logging in, so all of that chrome is friction. Hide it and surface a
  // single clear sign-in CTA instead, matching the parent site's
  // editorial pattern (Epilogue 800 headline, neutral subtext, brand-blue
  // primary button).
  //
  // Header (cross-nav + Darkroom wordmark) is intentionally preserved so
  // users can navigate back to the parent site sections. Body class
  // `pt-guest-index` is added/removed on IndexPage mount/unmount so CSS
  // can hide the stock content blocks while leaving them untouched for
  // authenticated users.
  function gotoLogin(e: Event) {
    e.preventDefault();
    window.location.assign(app.forum.attribute('baseUrl') + '/auth/generic');
  }

  // NOTE on the `_returnValue` arg: flarum's `extend()` calls our callback
  // with `(returnValue, ...originalArgs)`. For void-returning methods like
  // `oncreate(vnode)`, that means our callback receives `(undefined, vnode)`.
  // The Flarum docstring example shows `function(vnode) {...}` which is
  // MISLEADING — it would treat `vnode` as `undefined`. We need the second
  // positional arg. (Same gotcha applies to `onupdate`, `onbeforeremove`,
  // etc. — anything Mithril lifecycle.)
  extend(IndexPage.prototype, 'oncreate', function (this: any, _returnValue: any, vnode: any) {
    if (app.session.user) return;
    document.body.classList.add('pt-guest-index');

    const root = vnode.dom as HTMLElement;
    if (!root || root.querySelector('.pt-guest-login')) return;

    const panel = document.createElement('section');
    panel.className = 'pt-guest-login';
    panel.innerHTML = `
      <p class="pt-guest-login-eyebrow">The Darkroom</p>
      <h1 class="pt-guest-login-heading">A members-only forum<br>for The Print Trade.</h1>
      <p class="pt-guest-login-tagline">Discussion of photography, printing, and trading collector-grade prints.</p>
      <button type="button" class="pt-guest-login-cta">Sign in with The Print Trade</button>
      <p class="pt-guest-login-meta">New here? <a href="${SITE_ORIGIN}">Create an account at theprinttrade.com</a>, then come back.</p>
    `;
    root.prepend(panel);
    panel.querySelector('.pt-guest-login-cta')!.addEventListener('click', gotoLogin);
  });

  extend(IndexPage.prototype, 'onremove', function () {
    document.body.classList.remove('pt-guest-index');
  });
});
