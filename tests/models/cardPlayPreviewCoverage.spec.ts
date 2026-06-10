import {expect} from 'chai';
import {ALL_MODULE_MANIFESTS} from '../../src/server/cards/AllManifests';
import {ICard} from '../../src/server/cards/ICard';
import {Card} from '../../src/server/cards/Card';
import {GameModule} from '../../src/common/cards/GameModule';
import {CardName} from '../../src/common/cards/CardName';

// Only modules whose PROJECT cards are played from hand via the "РАЗЫГРАТЬ КАРТУ"
// modal. Preludes / corporations use the start-of-game flow, not this modal.
const SCOPE = new Set<GameModule>(['base', 'corpera', 'promo', 'venus', 'colonies', 'prelude']);

/**
 * In-scope PROJECT cards whose `bespokePlay` produces an on-play CHOICE / effect
 * that is intentionally NOT pre-collected in the play modal — it rides the
 * post-batch follow-up routing instead. Each entry documents WHY. Two reasons:
 *
 *  - 'automatic': `bespokePlay` applies a fixed effect with NO player choice
 *    (counts tags, conditional bonus, sets a flag…). The play modal shows the
 *    payment + any declarative chips; there's nothing to choose, so the dynamic
 *    preview is correct.
 *  - 'follow-up': the on-play CHOICE is intricate (board-tile placement → handled
 *    by PlacementBanner; a multi-step / nested OrOptions that renders BETTER in
 *    the premium ModernOptionPicker follow-up than in the play modal). The play
 *    modal shows the card + payment; the choice arrives as the rich follow-up.
 *
 * A card with a declarative `behavior` OR a co-located `cardPlayPreview` hook is
 * covered WITHOUT being listed here. This list keeps the "rides the dynamic
 * fallback" decision EXPLICIT, so a NEW bespoke-play card can't silently slip
 * through without either a hook or a deliberate entry.
 */
const ACCEPTED_DYNAMIC: Partial<Record<CardName, 'automatic' | 'follow-up'>> = {
  // 'automatic' — a FIXED on-play effect with no player choice (count tags /
  // conditional bonus / copy a value). The play modal shows the payment; there's
  // nothing to choose, so the dynamic preview is correct.
  'Decomposers': 'automatic',
  'Media Archives': 'automatic',
  'Terraforming Ganymede': 'automatic',
  'Interplanetary Trade': 'automatic',
  'Mars Nomads': 'automatic',
  'Io Sulphur Research': 'automatic',
  'Community Services': 'automatic',
  'Quantum Communications': 'automatic',
  'Productive Outpost': 'automatic',

  // 'follow-up' — the on-play CHOICE is a board-tile / colony placement (handled
  // by PlacementBanner / ColoniesOverlay after the batch) OR an intricate /
  // nested prompt that renders BETTER in the premium ModernOptionPicker /
  // CardSelectionContent follow-up than crammed into the play modal. The play
  // modal shows the card + payment; the choice arrives as the rich follow-up.
  'Ecological Zone': 'follow-up', // greenery placement
  'Immigrant City': 'follow-up', // city placement
  'Industrial Center': 'follow-up', // tile placement
  'Land Claim': 'follow-up', // space placement
  'Mining Rights': 'follow-up', // space placement
  'Mining Area': 'follow-up', // space placement
  'Minority Refuge': 'follow-up', // build a colony
  'Pioneer Settlement': 'follow-up', // build a colony
  'Flooding': 'follow-up', // ocean placement + a M€-removal OrOptions
  'Virus': 'follow-up', // animals/plants removal OrOptions (composed deferreds)
  'Robotic Workforce': 'follow-up', // pick a building card to copy production
  'Project Inspection': 'follow-up', // pick a played action card to re-use
  'Astra Mechanica': 'follow-up', // return up to 2 event cards to hand
  'Public Plans': 'follow-up', // reveal cards from hand
  'Air Raid': 'follow-up', // steal a resource (rich OrOptions)
  'Market Manipulation': 'follow-up', // two sequential SelectColony track picks
  'Sponsored Academies': 'follow-up', // discard a card from hand
  'Stratospheric Birds': 'follow-up', // remove a floater from a chosen card
};

function overridesBespokePlay(card: ICard): boolean {
  return (card as {bespokePlay?: unknown}).bespokePlay !== Card.prototype.bespokePlay;
}

describe('card-play-preview coverage', () => {
  it('every in-scope project card with a bespoke on-play effect is hooked, declarative, or an explicit dynamic fallback', () => {
    const gaps: Array<string> = [];
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
        if (!overridesBespokePlay(card)) {
          continue;
        }
        const declarative = (card as {behavior?: unknown}).behavior !== undefined;
        const hasHook = typeof (card as {cardPlayPreview?: unknown}).cardPlayPreview === 'function';
        const accepted = card.name in ACCEPTED_DYNAMIC;
        if (!declarative && !hasHook && !accepted) {
          gaps.push(`${card.name} [${manifest.module}]`);
        }
      }
    }
    expect(gaps, `bespoke-play cards needing a cardPlayPreview hook, a behavior, or an ACCEPTED_DYNAMIC entry:\n  ${gaps.join('\n  ')}`).to.have.length(0);
  });
});
