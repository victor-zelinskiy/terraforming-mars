/**
 * Maps an icon-key (as supplied by the server in OptionMetadata / SelectAmount)
 * to the CSS class family that renders it. Shared by the modern input modals
 * (ModernOptionPicker, ModernAmountSelector, …) so every surface resolves an
 * icon the same way:
 *
 *   - standard resources (megacredits / steel / titanium / plants / energy /
 *     heat)        → `resource_icon resource_icon--<key>`
 *   - terraform rating (`tr`) → `resource_icon resource_icon--rating` (the real
 *     tr.png), and "a card" (`cards`) → `resource_icon resource_icon--cards` (the
 *     real card.png) — so preview chips reuse the canonical art, not a drawn glyph
 *   - global parameters (temperature / venus / oxygen / ocean)
 *                  → `wgt-icon wgt-icon--<key>`
 *   - everything else (card resources: microbe / animal / science / floater /…)
 *                  → `card-resource card-resource-<key>`
 *
 * `modal_inputs.less` normalises the size of all three families via the shared
 * `.modal-input__option-icon` class, so the caller only needs the family class.
 */

const STANDARD_RESOURCE_ICONS: ReadonlySet<string> = new Set(['megacredits', 'steel', 'titanium', 'plants', 'energy', 'heat']);
const GLOBAL_PARAMETER_ICONS: ReadonlySet<string> = new Set(['temperature', 'venus', 'oxygen', 'ocean']);
// Pseudo-icons that map onto the global `resource_icon` sprite family (the same
// art the card renderer uses, but its own classes are scoped under `.card-container`).
// `rating` is the rail's own key for the terraform rating (the parliament's Agenda bonus rides it as a chip).
const RESOURCE_ICON_ALIASES: Readonly<Record<string, string>> = {tr: 'rating', rating: 'rating', cards: 'cards'};
// The `GlobalParameter` enum uses the PLURAL 'oceans', but the icon class is the
// singular `wgt-icon--ocean` (the ocean TILE art). Normalise here — the single
// resolution point — so both the journal's `impact` chips (which pass
// `EventImpact.globalParameter.parameter`) AND the RESOURCE log token resolve
// the ocean sprite instead of falling through to a non-existent card-resource.
const GLOBAL_PARAMETER_ALIASES: Readonly<Record<string, string>> = {oceans: 'ocean'};

/**
 * Keys with NO sprite in any of the three families, resolved to '' on purpose.
 *
 * Victory points are drawn as the card's own printed badge — there is no inline
 * icon for them anywhere in the game's art. Left to fall through, `vp` would
 * resolve to `card-resource-vp`, a class no stylesheet defines, and every
 * consumer would reserve a 22px hole with nothing in it. Returning '' routes
 * them through the callers' existing "no honest sprite" path instead.
 *
 * A MarsBot TRACK step (`track` — the effect forecast's «MarsBot advances its
 * event track» chip) has no sprite either: the mat's tracks are drawn by the
 * bot board, never as an inline icon, so the chip carries its note instead.
 */
const NO_SPRITE_ICONS: ReadonlySet<string> = new Set(['vp', 'track']);

export function iconClassFor(icon: string | undefined): string {
  if (icon === undefined || icon === '' || NO_SPRITE_ICONS.has(icon)) {
    return '';
  }
  if (STANDARD_RESOURCE_ICONS.has(icon)) {
    return 'resource_icon resource_icon--' + icon;
  }
  if (icon in RESOURCE_ICON_ALIASES) {
    return 'resource_icon resource_icon--' + RESOURCE_ICON_ALIASES[icon];
  }
  if (icon in GLOBAL_PARAMETER_ALIASES) {
    return 'wgt-icon wgt-icon--' + GLOBAL_PARAMETER_ALIASES[icon];
  }
  if (GLOBAL_PARAMETER_ICONS.has(icon)) {
    return 'wgt-icon wgt-icon--' + icon;
  }
  // Card resources: the global `.card-resource-<key>` classes are generated from
  // `@card_resource_types` (lowercase, spaces→hyphens). A caller may pass either
  // the already-normalised key (the optionMetadata factories) OR the raw
  // `CardResource` enum value ('Microbe', 'Hydroelectric resource', …) — e.g. the
  // journal's `impactChips` forwards `cardResource` verbatim. Normalise here (the
  // single resolution point) so both forms resolve to a real sprite; lowercasing
  // an already-normalised key is idempotent.
  return 'card-resource card-resource-' + icon.toLowerCase().replace(/\s+/g, '-');
}
