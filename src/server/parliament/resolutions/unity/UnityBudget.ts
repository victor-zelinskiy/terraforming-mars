/*
 * UNITY BUDGET (Unity) — Turmoil Redux resolution RX29: the FOURTH card of the
 * BUDGET family, and the FIRST resolution that moves the COLONY TABLE — every
 * colony track advances 2 steps at once (docs/TURMOIL_REDUX_UNITY_BUDGET.md).
 *
 * Printed: «When enacted: Lose 12 M€. Gain M€ equal to your Earth, Venus, and
 * Jovian tags combined + Influence. Advance each colony track 2 steps.»
 * Chairman quest: play 2 Earth tags. Colonies are mandatory in Redux, so the
 * card declares no compatibility (Colonial Affairs' reading).
 *
 * Two of the three parts are the family's own declarations: the LEVY (the
 * shared member and its ONE step, RX15) and the payout by a TAG COUNT + influence
 * (the multi-tag form Cloud Development declared, over three tags here). The
 * third part is new to the catalog and is written ONCE for every law that
 * will ever move the colony table: `trackAdvance` as data + the family's
 * shared world step (`ResolutionColonyTrack.ts`). This file therefore writes
 * no mechanism: it states the sums, the tags and the steps.
 *
 * THE READINGS FIXED HERE:
 *  · THE PRINTED ORDER IS THE EXECUTED ORDER: levy → payout for EVERY
 *    participant in turn (voters or not, the party effect or not; a neutral
 *    winner cancels nothing), THEN the colony table — the world's part comes
 *    after every seat's own, as the driver walks `worldSteps`.
 *  · THE LEVY IS THE FAMILY'S, whole: bounded by the seat (4 M€ pays 4 of 12
 *    and the record names the shortfall; 0 M€ pays nothing, a named skip),
 *    `from: {resolution}` on the take, and both still receive the payout.
 *  · THE COUNT IS THREE TAGS ADDED UP — Earth, Venus and Jovian, the
 *    project's canonical counter of EACH in the enactment's own context
 *    (`RESOLUTION_TAG_COUNTING_MODE` = `'raw'`): every source in play, a card
 *    printing two of them (Luna Governor: two Earth tags; Venus Governor:
 *    two Venus tags) is 2, a wild tag is none of them, and the record keeps
 *    the per-tag totals beside the sum (`countedByTag`). Influence pays on its
 *    own; the terms add; there is no cap. Skipped — named — only when count
 *    and influence are both zero.
 *  · THE TRACKS ARE THE WORLD'S, NOT A SEAT'S. «Each colony track» is every
 *    tile IN PLAY — the tiles with nobody's cube on them and the bot's alike —
 *    advanced ONCE per enactment (a world step: listed in `immediateSteps` it
 *    would advance 2 × N steps for N participants). The engine's own clamp
 *    (`Colony.increaseTrack`, `MAX_COLONY_TRACK_POSITION`) cuts the steps: a
 *    track at its end does not move and is NAMED so in the record (before ===
 *    after), a track one short of it makes one honest step. An inactive tile
 *    has no live track and is not moved — exactly as the end of the
 *    generation leaves it.
 *  · MarsBot takes no seat: never levied, never paid. Its colonies' tracks
 *    move with everybody's — the track is the tile's.
 *
 * THE STEP CONTRACT (IResolution.ts): all three steps MUTATE (nothing here
 * asks), and each reports exactly once — the levy's shortfall and the end of
 * a track included.
 */
import {CardRenderer} from '../../../cards/render/CardRenderer';
import {Size} from '../../../../common/cards/render/Size';
import {PartyName} from '../../../../common/turmoil/PartyName';
import {Resource} from '../../../../common/Resource';
import {Tag} from '../../../../common/cards/Tag';
import {ResolutionCode, ResolutionId} from '../../../../common/parliament/ParliamentTypes';
import {InfluenceScaledEffect, scaledAmount} from '../../../../common/parliament/influenceScaling';
import {ResolutionLevy} from '../../../../common/parliament/resolutionLevy';
import {ColonyTrackAdvance} from '../../../../common/parliament/colonyTrackAdvance';
import {EnactStep, ResolutionDefinition} from '../IResolution';
import {resolutionCount} from '../ResolutionCounts';
import {levyStep} from '../ResolutionLevy';
import {colonyTrackStep} from '../ResolutionColonyTrack';

export const UNITY_BUDGET_ID: ResolutionId = 'RDX_UNITY_UNITY_BUDGET';
export const UNITY_BUDGET_CODE: ResolutionCode = 'RX29';
/** The printed «Lose 12 M€». */
export const UNITY_BUDGET_LEVY_AMOUNT = 12;
/** The printed «Advance each colony track 2 steps». */
export const UNITY_BUDGET_TRACK_STEPS = 2;

/** THE LEVY, as data: 12 M€ from every participant, first. */
export const UNITY_BUDGET_LEVY: ResolutionLevy = {resource: Resource.MEGACREDITS, amount: UNITY_BUDGET_LEVY_AMOUNT, recipient: 'each'};

/** THE FORMULA: 1 M€ per Earth, Venus and Jovian tag, plus 1 per influence, no cap, for every participant. */
export const UNITY_BUDGET_MEGACREDITS: InfluenceScaledEffect = {
  id: 'megacredits',
  unit: {kind: 'stock', resource: Resource.MEGACREDITS},
  perInfluence: 1,
  count: {id: 'earthVenusJovianTags', per: 1},
  recipient: 'each',
};

/** THE COLONY TABLE'S PART, as data: every track 2 steps, once, for nobody. */
export const UNITY_BUDGET_TRACKS: ColonyTrackAdvance = {steps: UNITY_BUDGET_TRACK_STEPS};

/** The server's own reason for a payout of nothing — the count and the influence are both zero. */
export const UNITY_BUDGET_NO_TAGS_REASON = 'No Earth, Venus or Jovian tags and no influence';

const MEGACREDITS_STEP: EnactStep = {
  key: 'megacredits',
  run(ctx) {
    const player = ctx.player;
    const effect = UNITY_BUDGET_MEGACREDITS;
    // The canonical count of each of the three tags in the enactment's own
    // context — the PRINTED tags, with the cards that made them and the
    // per-tag totals the reading explains the sum by.
    const counted = resolutionCount(player, 'earthVenusJovianTags');
    const influence = ctx.influence;
    const amount = scaledAmount(effect, influence, counted.count);
    const recorded = {
      effect: effect.id,
      stock: Resource.MEGACREDITS,
      influence,
      count: counted.count,
      counted: [...counted.cards],
      ...(counted.units === undefined ? {} : {countedUnits: [...counted.units]}),
      ...(counted.byTag === undefined ? {} : {countedByTag: counted.byTag.map((entry) => ({...entry}))}),
    };
    if (amount <= 0) {
      ctx.game.log('${0} has no Earth, Venus or Jovian tags and no influence — no M€ from ${1}', (b) =>
        b.player(player).resolution(UNITY_BUDGET_ID));
      ctx.report({kind: 'skipped', ...recorded, amount: 0, reason: UNITY_BUDGET_NO_TAGS_REASON});
      return undefined;
    }
    const before = player.megaCredits;
    // The standard gain under this resolution's source (its events, the party
    // reactions, the recorder); the ONE journal line below carries the whole
    // calculation, so the add itself stays silent.
    player.stock.add(Resource.MEGACREDITS, amount, {log: false, from: {resolution: UNITY_BUDGET_ID}});
    const after = player.megaCredits;
    ctx.game.log('${0} gained ${1} M€ from ${2}: ${3} Earth, Venus and Jovian tag(s) + ${4} influence (${5} → ${6})', (b) =>
      b.player(player).number(amount).resolution(UNITY_BUDGET_ID)
        .number(counted.count).number(influence).number(before).number(after));
    ctx.report({kind: 'stock', ...recorded, amount, before, after});
    return undefined;
  },
};

export const UNITY_BUDGET: ResolutionDefinition = {
  id: UNITY_BUDGET_ID,
  code: UNITY_BUDGET_CODE,
  module: 'turmoilRedux',
  party: PartyName.UNITY,
  copies: 1,
  // THE FACE, as printed: «−12 [M€]» (the negative printed INSIDE the tile)
  // beside «ALL [colony tile] +2» on the first row; the rate «1 [M€] / [Earth]
  // + [Venus] + [Jovian] + [influence]» on the second. The counted objects are
  // the printed TAG medallions — the card counts tags, not cards.
  renderData: CardRenderer.builder((b) => {
    b.megacredits(-UNITY_BUDGET_LEVY_AMOUNT).nbsp.text('ALL', Size.SMALL, true).colonies(1).text(`+${UNITY_BUDGET_TRACK_STEPS}`, Size.MEDIUM, true).br;
    b.megacredits(1).slash().tag(Tag.EARTH).plus().tag(Tag.VENUS).plus().tag(Tag.JOVIAN).plus().influence();
  }),
  text: {
    name: 'Unity Budget',
    effect: 'Lose 12 M€. Then gain 1 M€ per Earth, Venus and Jovian tag you have, plus 1 per influence.',
    world: 'Advance every colony track 2 steps.',
    quest: 'Play 2 Earth tags',
  },
  quest: {goal: {kind: 'tag', tag: Tag.EARTH}, count: 2},
  levy: UNITY_BUDGET_LEVY,
  scaled: [UNITY_BUDGET_MEGACREDITS],
  trackAdvance: UNITY_BUDGET_TRACKS,
  // THE PRINTED ORDER: the levy first, the payout second — for every seat; the colony table once, after them.
  immediateSteps: [levyStep(UNITY_BUDGET_ID, UNITY_BUDGET_LEVY), MEGACREDITS_STEP],
  worldSteps: [colonyTrackStep(UNITY_BUDGET_ID, UNITY_BUDGET_TRACKS)],
};
