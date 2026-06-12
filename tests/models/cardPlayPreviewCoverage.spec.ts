import {expect} from 'chai';
import {ALL_MODULE_MANIFESTS} from '../../src/server/cards/AllManifests';
import {ICard} from '../../src/server/cards/ICard';
import {Card} from '../../src/server/cards/Card';
import {GameModule} from '../../src/common/cards/GameModule';
import {CardName} from '../../src/common/cards/CardName';
import {Behavior} from '../../src/server/behavior/Behavior';
import {stepsForBehavior} from '../../src/server/models/actionPreview';
import {testGame} from '../TestGame';

// Only modules whose PROJECT cards are played from hand via the "РАЗЫГРАТЬ КАРТУ"
// modal. Preludes / corporations use the start-of-game flow, not this modal.
const SCOPE = new Set<GameModule>(['base', 'corpera', 'promo', 'venus', 'colonies', 'prelude']);

/**
 * In-scope PROJECT cards whose `bespokePlay` produces an on-play CHOICE that is
 * intentionally NOT pre-collected in the play modal — it rides the post-batch
 * follow-up routing instead. Each entry documents WHY.
 *
 *  - 'follow-up': the on-play CHOICE is INHERENTLY a board/colony interaction OR
 *    renders BETTER on a dedicated premium follow-up surface than crammed into the
 *    play modal (board-tile placement → PlacementBanner; colony placement →
 *    ColoniesOverlay; multi-select card pick → CardSelectionContent; a nested /
 *    composed OrOptions → ModernOptionPicker). The play modal shows the card +
 *    payment; the choice arrives as the rich follow-up.
 *
 *  - 'automatic' (RESERVED, currently NONE): a card whose on-play effect has
 *    GENUINELY nothing showable AND no choice. The refined criterion is the point
 *    of this whole mechanism: **a FIXED, COMPUTABLE result MUST be shown** — even
 *    with no choice, the play modal has to surface the change (M€ / production / TR
 *    / draw / card-resource) as a `current → resulting` chip via a `cardPlayPreview`
 *    hook, so the player never plays blind ("показывать изменение заранее"). So a
 *    "no choice" card is NOT automatically a dynamic fallback — it's a dynamic
 *    fallback only if the result also can't be computed/shown read-only (a variable
 *    bundle that resists a single chip → classify it 'follow-up' and let the
 *    follow-ups speak instead). Today every previously-'automatic' card either got a
 *    result chip (Interplanetary Trade, Media Archives, Terraforming Ganymede, Io
 *    Sulphur Research, Community Services, Quantum Communications, Decomposers) or is
 *    a 'follow-up' (Mars Nomads board placement, Productive Outpost colony bonuses).
 *
 * A card with a declarative `behavior` OR a co-located `cardPlayPreview` hook is
 * covered WITHOUT being listed here. This list keeps the "rides the dynamic
 * fallback" decision EXPLICIT, so a NEW bespoke-play card can't silently slip
 * through without either a hook or a deliberate entry.
 */
const ACCEPTED_DYNAMIC: Partial<Record<CardName, 'automatic' | 'follow-up'>> = {
  // 'follow-up' — the on-play CHOICE is INHERENTLY a board/colony interaction OR
  // renders BETTER on a dedicated premium follow-up surface than crammed into the
  // play modal. Each rides a PREMIUM surface AFTER the batch (never a bare prompt):
  //   - board-tile placement → PlacementBanner (click the planet);
  //   - colony placement → ColoniesOverlay;
  //   - a MULTI-select card pick (return/reveal N) → the premium CardSelectionContent
  //     grid / КАРТЫ В РУКЕ overlay (the play modal's single-select picker can't
  //     host a multi-pick well);
  //   - a nested / composed OrOptions (attacks) → the rich ModernOptionPicker.
  // SINGLE-select card picks are NOT here — they're pre-collected in the play modal
  // via a `cardPlayPreview` hook (Project Inspection, Robotic Workforce, Stratospheric
  // Birds, the Venus resource-target cards…). Viron's COPY-an-action picker rides the
  // ACTION-confirm modal via its `actionPreview` hook (not a play card).
  'Ecological Zone': 'follow-up', // greenery placement → PlacementBanner
  'Immigrant City': 'follow-up', // city placement → PlacementBanner
  'Industrial Center': 'follow-up', // tile placement → PlacementBanner
  'Land Claim': 'follow-up', // space placement → PlacementBanner
  'Mining Rights': 'follow-up', // space placement (+ steel/titanium pick) → PlacementBanner
  'Mining Area': 'follow-up', // space placement → PlacementBanner
  'Minority Refuge': 'follow-up', // build a colony → ColoniesOverlay
  'Pioneer Settlement': 'follow-up', // build a colony → ColoniesOverlay
  'Market Manipulation': 'follow-up', // two sequential SelectColony track picks → ColoniesOverlay
  'Flooding': 'follow-up', // ocean placement (PlacementBanner) + a M€-removal OrOptions
  // 'Virus' now has a cardPlayPreview hook — a TWO-TAB (animals / plants) removal
  // picker, the OR indices introspected from the shared buildRemovalOptions.
  // 'Astra Mechanica' now has a cardPlayPreview hook — two card-target SLOTS over
  // the played events (board pick), MERGED into ONE response (mergeCardSteps, min 0
  // → the 2nd slot is optional). No longer a follow-up.
  // 'Public Plans' now has a cardPlayPreview hook — a MULTI-select hand pick hosted
  // in the КАРТЫ В РУКЕ overlay (count summary + live +N M€). No longer a follow-up.
  // 'Air Raid' now has a cardPlayPreview hook — the steal OrOptions (per-target
  // loss) + the floater spend are pre-collected; +5 M€ / −1 floater result chips.
  // 'Sponsored Academies' now has a cardPlayPreview hook — the discard-1 hand pick
  // pre-collected; −1 card / +3 cards result chips.
  'Mars Nomads': 'follow-up', // place the nomad marker on a land space → PlacementBanner
  // 'Productive Outpost' now has a cardPlayPreview hook — it aggregates every owned
  // colony's FIXED metadata.colony bonus into result chips; interactive bonuses note.
};

/**
 * In-scope project cards that have BOTH a declarative `behavior` AND override
 * `bespokePlay`. The behavior chips show automatically in the play modal — but if
 * `bespokePlay` adds a FIXED, COMPUTABLE result NOT expressed in `behavior` (a
 * production / stock / TR / card-resource change, e.g. NitrogenRichAsteroid's plant
 * production, Potatoes' plant cost, NoctisCity's −1 energy), the modal would show
 * only the behavior chips and HIDE the bespoke result — the exact "Interplanetary
 * Trade" class of bug, just masked by the card already being `declarative`.
 *
 * Such a card MUST carry a `cardPlayPreview` hook (which auto-includes the behavior
 * chips + the bespoke extra). A card whose `bespokePlay` is PURELY an interactive
 * CHOICE / placement / attack — no hidden fixed result, the choice rides the
 * post-batch follow-up and the automatic part is fully in `behavior` — is listed
 * here WITH the reason, so the audit stays EXPLICIT and a future card (or upstream
 * merge) can't silently regress.
 */
const BEHAVIOR_BESPOKE_NO_HIDDEN_RESULT: Partial<Record<CardName, string>> = {
  // 'Atmoscoop' now has a cardPlayPreview hook (temp/Venus choice pre-collected as
  // an OrOptions step + the floater target pick) — no longer a follow-up.
  // 'Cyberia Systems' now has a cardPlayPreview hook (both copy targets pre-collected
  // as two card-target steps with cross-step de-dup) — no longer a follow-up.
  'Established Methods': 'use a standard project → follow-up; +30 M€ in behavior',
  'Great Dam:promo': 'tile placement → PlacementBanner; +2 energy production in behavior',
  // 'Hackers' now has a cardPlayPreview hook (the M€-production steal target picker
  // pre-collected) — no longer a follow-up; behavior shows −1 energy / +2 M€ prod.
  'Urbanized Area': 'city placement → PlacementBanner; +2 M€ production in behavior',
  'Kaguya Tech': 'convert a greenery to a city = a board placement choice → PlacementBanner; +2 M€ production + draw in behavior',
  'Martian Lumber Corp': 'sets the canUsePlantsAsMegacredits ABILITY flag (no immediate result, like Helion); +1 plant production in behavior',
  'Lava Tube Settlement': 'city placement on a volcanic space → PlacementBanner; −1 energy / +2 M€ production in behavior',
};

function overridesBespokePlay(card: ICard): boolean {
  return (card as {bespokePlay?: unknown}).bespokePlay !== Card.prototype.bespokePlay;
}

// A card "customizes its play" if it overrides EITHER `bespokePlay` (the common
// path) OR `play()` directly (the older pattern — e.g. SoilEnrichment,
// LocalHeatTrapping — which bypasses the behavior/bespokePlay split entirely). The
// modal's preview can hide an on-play choice/result for BOTH, so the coverage gate
// must consider both — checking only `bespokePlay` once let SoilEnrichment's
// "spend a microbe from which card?" picker slip through to a bare dynamic modal.
function customizesPlay(card: ICard): boolean {
  return overridesBespokePlay(card) ||
    (card as {play?: unknown}).play !== Card.prototype.play;
}

function hasBehavior(card: ICard): boolean {
  return (card as {behavior?: unknown}).behavior !== undefined;
}

function hasHook(card: ICard): boolean {
  return typeof (card as {cardPlayPreview?: unknown}).cardPlayPreview === 'function';
}

function forEachInScopeProjectCard(cb: (card: ICard, module: GameModule) => void): void {
  for (const manifest of ALL_MODULE_MANIFESTS) {
    if (!SCOPE.has(manifest.module)) {
      continue;
    }
    for (const name of Object.keys(manifest.projectCards)) {
      const Factory = (manifest.projectCards as Record<string, {Factory: new () => ICard}>)[name]?.Factory;
      if (Factory === undefined) {
        continue;
      }
      let card: ICard;
      try {
        card = new Factory();
      } catch {
        continue;
      }
      cb(card, manifest.module);
    }
  }
}

describe('card-play-preview coverage', () => {
  it('every in-scope project card that customizes its play (bespokePlay OR play()) is hooked, declarative, or an explicit dynamic fallback', () => {
    const gaps: Array<string> = [];
    forEachInScopeProjectCard((card, module) => {
      if (!customizesPlay(card)) {
        return;
      }
      const accepted = card.name in ACCEPTED_DYNAMIC;
      if (!hasBehavior(card) && !hasHook(card) && !accepted) {
        gaps.push(`${card.name} [${module}]`);
      }
    });
    expect(gaps, `cards customizing play that need a cardPlayPreview hook, a behavior, or an ACCEPTED_DYNAMIC entry:\n  ${gaps.join('\n  ')}`).to.have.length(0);
  });

  it('no behavior+bespokePlay card silently HIDES a fixed on-play result (each has a hook or an audited "no hidden result" entry)', () => {
    const gaps: Array<string> = [];
    forEachInScopeProjectCard((card, module) => {
      if (!overridesBespokePlay(card) || !hasBehavior(card)) {
        return;
      }
      const audited = card.name in BEHAVIOR_BESPOKE_NO_HIDDEN_RESULT;
      if (!hasHook(card) && !audited) {
        gaps.push(`${card.name} [${module}]`);
      }
    });
    expect(gaps, `behavior+bespokePlay cards that may HIDE a fixed on-play result. Add a cardPlayPreview hook (playPreview auto-includes the behavior chips + your bespoke extra) OR, if bespokePlay is purely an interactive choice/placement/attack with no hidden fixed result, a BEHAVIOR_BESPOKE_NO_HIDDEN_RESULT entry explaining why:\n  ${gaps.join('\n  ')}`).to.have.length(0);
  });

  // GUARD: `addResourcesToAnyCard` is single-OR-ARRAY. Both preview walkers must
  // surface EVERY addition (a target picker or a "no eligible card" warning) — a
  // dropped addition is invisible to the player (the Imported Nitrogen bug: the
  // `!Array.isArray` guard silently skipped the whole +3 microbe / +2 animal block).
  it('every in-scope declarative card surfaces EACH addResourcesToAnyCard addition (no silent ARRAY drop)', () => {
    const [/* game */, player] = testGame(2);
    const gaps: Array<string> = [];
    forEachInScopeProjectCard((card, module) => {
      const behavior = (card as {behavior?: Behavior}).behavior;
      const raw = behavior?.addResourcesToAnyCard;
      if (behavior === undefined || raw === undefined) {
        return;
      }
      const additions = Array.isArray(raw) ? raw : [raw];
      // Each addition surfaces as a card-target picker (the player can hold it) OR a
      // warning (no eligible card). Fewer steps than additions = a silent drop.
      const surfaced = stepsForBehavior(player, card, behavior).filter((s) =>
        (s.kind === 'note' && s.noteKind === 'warning') ||
        (s.kind === 'input' && s.input.type === 'card')).length;
      if (surfaced < additions.length) {
        gaps.push(`${card.name} [${module}]: ${additions.length} addResourcesToAnyCard additions, only ${surfaced} surfaced`);
      }
    });
    expect(gaps, `declarative cards silently dropping an addResourcesToAnyCard addition:\n  ${gaps.join('\n  ')}`).to.have.length(0);
  });
});
