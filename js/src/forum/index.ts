/*
 * theprinttrade/flarum-printtrade-theme — forum entry
 *
 * Injects a cross-product nav into the forum HeaderPrimary so users
 * can move between the forum (this app) and theprinttrade.com sections
 * without leaving via the browser. Mirrors the parent site's nav and
 * marks "Forum" as the current section.
 */

import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import HeaderPrimary from 'flarum/forum/components/HeaderPrimary';
import LinkButton from 'flarum/common/components/LinkButton';

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
  extend(HeaderPrimary.prototype, 'items', function (this: HeaderPrimary, items: any) {
    CROSS_NAV.forEach((link, i) => {
      items.add(
        `pt-nav-${i}`,
        LinkButton.component(
          {
            href: link.href || '#',
            external: true,
            force: false,
            className:
              'pt-cross-nav-item' + (link.active ? ' pt-cross-nav-item--active' : ''),
            // Disabled link for the current section; others navigate.
            disabled: link.active,
          },
          link.label
        ),
        // Render BEFORE Flarum's stock items (which have priority 100, 90...)
        // so cross-product nav appears at the left of HeaderPrimary.
        200 - i
      );
    });
  });
});
