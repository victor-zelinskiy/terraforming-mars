/*
 * URBAN RESEARCH (Mars First) — Turmoil Redux resolution RX31. Both halves are
 * the family's, word for word: a COUNTED term over the player's tableau
 * (Central Power Grid RX04, Medical Database RX18, Scientists Budget RX27) and
 * a DRAW handed over through the shared external intake (Climate Research RX05,
 * Joint Research RX16, RX27). What is new is the COMBINATION — a draw whose
 * amount is a COUNT: until this card `cards` was flat («draw 2»), a LEVEL
 * («draw up to 6 + influence») or SEQUENTIAL («1 card per 3 steps of heat
 * production»), never «one for every object in your tableau». The arithmetic
 * costs nothing (`scaledAmount` knows nothing of the unit); the price of the
 * combination is in the READINGS, and it is paid there
 * (docs/TURMOIL_REDUX_URBAN_RESEARCH.md).
 *
 * Printed: «When enacted: Draw 1 card for every City tag you have. Gain 2 M€
 * per point of Influence you have.» Chairman quest: play 1 city tag. A base
 * card: no expansion is needed.
 *
 * THE READINGS FIXED HERE:
 *  · ⚠ A CITY TAG IS A TAG, NOT A CITY. The catalog already holds THREE city
 *    counts and every one of them is over the BOARD — `spaceCities` (RX08),
 *    `marsCities` (RX20, cells) and `marsCityTiers` (RX21, tiers). None of them
 *    is this card's: `cityTags` counts the printed CITY MEDALLIONS in the
 *    seat's tableau, the twin of `scienceTags` and `powerTags`. Reaching for a
 *    board count here would not fail — it would quietly pay the wrong number,
 *    so the spec pins the divergence directly (five cities on Mars and no city
 *    tag → ZERO cards).
 *  · THE COUNT IS THE PROJECT'S CANONICAL ONE in the enactment's own context
 *    (`RESOLUTION_TAG_COUNTING_MODE` = `'raw'`): every face-up source in play
 *    — a project, a prelude, a corporation — a card printing two city tags is
 *    worth 2, a WILD tag is not a city tag at an enactment, and a played
 *    event's tags are face down (`Tags.eventTagsInPlay`, Odyssey excepted).
 *  · INFLUENCE BUYS NO CARDS and the tags buy no money: two independent
 *    halves, two steps, two records, TWO DIFFERENT ZEROES each naming itself
 *    («no city tags — no cards» / «no influence — no M€»). A seat with three
 *    city tags and influence 0 is dealt three cards; a seat with influence 3
 *    and no city tag is paid 6 M€. A common «nothing came of it» would be a
 *    lie about both.
 *  · THE PRINTED ORDER IS THE EXECUTED ORDER: the draw first, the money
 *    second — the sentence on the card. The draw ASKS (the mandatory take),
 *    and a step that asks need not be the last one: the walk re-enters from
 *    the first step on every pass and a finished step is a no-op
 *    (`ParliamentPhase.runSeatStep`'s idempotency keys), so the seat's M€ are
 *    paid on the pass that follows its own take.
 *  · THE CARDS COME FROM THE PROJECT DECK THROUGH THE SHARED INTAKE: they
 *    leave the deck at the enactment in seat order, are WITHHELD from the hand
 *    until the mandatory take, and the prompt is a projection of serialized
 *    state — so a reload inside the take draws nothing twice and loses
 *    nothing. A short deck delivers what it has and the record keeps both
 *    `amount` and `drawn`; an empty one is a NAMED skip. An ordinary
 *    `drawCard` is forbidden here: this is a sitting, not the seat's own turn.
 *  · MarsBot takes no seat: never dealt to, never paid.
 *
 * THE STEP CONTRACT (IResolution.ts): the M€ step MUTATES; the draw step is
 * the one documented exception the intake makes safe — it takes the cards off
 * the deck and asks in the same breath, and re-entry (a reload) is idempotent
 * because the intake it remembers IS game state.
 */
import {CardRenderer} from '../../../cards/render/CardRenderer';
import {PartyName} from '../../../../common/turmoil/PartyName';
import {Resource} from '../../../../common/Resource';
import {Tag} from '../../../../common/cards/Tag';
import {ResolutionCode, ResolutionId} from '../../../../common/parliament/ParliamentTypes';
import {InfluenceScaledEffect, scaledAmount} from '../../../../common/parliament/influenceScaling';
import {ExternalDrawIntake} from '../../../deferredActions/ExternalDrawIntake';
import {EnactStep, ResolutionDefinition} from '../IResolution';
import {resolutionCount} from '../ResolutionCounts';

export const URBAN_RESEARCH_ID: ResolutionId = 'RDX_MARS_URBAN_RESEARCH';
export const URBAN_RESEARCH_CODE: ResolutionCode = 'RX31';

/**
 * THE DRAW: one card for every CITY TAG the seat has in play — the counted
 * term over the tableau, with no influence in it at all (the card prints none
 * beside the card glyph, so `perInfluence` is 0 and the reading prints no
 * influence cluster — the Jovian Tax Rights law, `yieldInfluenceEnters`).
 */
export const URBAN_RESEARCH_DRAW: InfluenceScaledEffect = {
  id: 'draw',
  unit: {kind: 'cards'},
  perInfluence: 0,
  count: {id: 'cityTags', per: 1},
  recipient: 'each',
};

/** THE MONEY: 2 M€ per point of influence, for every participant — no count, no cap. */
export const URBAN_RESEARCH_MEGACREDITS: InfluenceScaledEffect = {
  id: 'megacredits',
  unit: {kind: 'stock', resource: Resource.MEGACREDITS},
  perInfluence: 2,
  recipient: 'each',
};

/** The draw's own zero — the seat prints no city tag. Never «and no influence»: influence buys no cards here. */
export const URBAN_RESEARCH_NO_TAGS_REASON = 'No city tags';
/** The money's own zero — the seat has no influence. Never merged with the draw's: the two halves are independent. */
export const URBAN_RESEARCH_NO_INFLUENCE_REASON = 'No influence';

/** The intake the draw step opened — the proof it already drew (the cards are game state). */
const INTAKE_KEY = 'drawIntake';

const DRAW_STEP: EnactStep = {
  key: 'draw',
  run(ctx) {
    const player = ctx.player;
    const effect = URBAN_RESEARCH_DRAW;
    // RE-ENTRY (a reload inside the take): the cards already left the deck and
    // sit in the intake — game state. Nothing is drawn again; the mandatory
    // prompt is re-derived from the intake.
    const remembered = ctx.state[INTAKE_KEY];
    if (typeof remembered === 'number') {
      const pending = ExternalDrawIntake.pendingOf(player, remembered);
      return pending === undefined ? undefined : ExternalDrawIntake.takePromptFor(player, pending);
    }
    const influence = ctx.influence;
    // THE CITY TAGS OF THE TABLEAU — never the cities of the board (see the
    // header): the canonical count with the cards that made it.
    const counted = resolutionCount(player, 'cityTags');
    const owed = scaledAmount(effect, influence, counted.count);
    const recorded = {
      effect: effect.id,
      influence,
      count: counted.count,
      counted: [...counted.cards],
      ...(counted.units === undefined ? {} : {countedUnits: [...counted.units]}),
    };
    if (owed <= 0) {
      ctx.game.log('${0} has no city tags — no cards from ${1}', (b) => b.player(player).resolution(URBAN_RESEARCH_ID));
      ctx.report({kind: 'skipped', ...recorded, amount: 0, drawn: 0, reason: URBAN_RESEARCH_NO_TAGS_REASON});
      return undefined;
    }
    // THE SHARED INTAKE: the project deck, the standard exhaustion behaviour,
    // the cards withheld from the hand until taken, the prompt re-derivable.
    const intake = ExternalDrawIntake.open(player, owed, {kind: 'resolution', resolution: URBAN_RESEARCH_ID, effect: effect.id});
    if (intake === undefined) {
      // The deck (and its discard) had nothing left — named, never silent.
      ctx.report({kind: 'skipped', ...recorded, amount: owed, drawn: 0, reason: 'The project deck is empty'});
      return undefined;
    }
    ctx.state[INTAKE_KEY] = intake.id;
    ctx.game.log('${0} draws ${1} card(s) from ${2}: 1 per city tag, ${3} city tag(s)', (b) =>
      b.player(player).number(intake.count).resolution(URBAN_RESEARCH_ID).number(counted.count));
    if (intake.count < owed) {
      ctx.game.log('Only ${0} of ${1} card(s) were left in the deck for ${2}', (b) =>
        b.number(intake.count).number(owed).player(player));
    }
    ctx.report({kind: 'cards', ...recorded, amount: owed, drawn: intake.count, intake: intake.id});
    return ExternalDrawIntake.takePromptFor(player, intake);
  },
};

const MEGACREDITS_STEP: EnactStep = {
  key: 'megacredits',
  run(ctx) {
    const player = ctx.player;
    const effect = URBAN_RESEARCH_MEGACREDITS;
    const influence = ctx.influence;
    const amount = scaledAmount(effect, influence);
    if (amount <= 0) {
      ctx.game.log('${0} has no influence — no M€ from ${1}', (b) => b.player(player).resolution(URBAN_RESEARCH_ID));
      ctx.report({kind: 'skipped', effect: effect.id, stock: Resource.MEGACREDITS, amount: 0, influence, reason: URBAN_RESEARCH_NO_INFLUENCE_REASON});
      return undefined;
    }
    const before = player.megaCredits;
    // The standard gain under this resolution's source (its events, the party
    // reactions, the recorder); the ONE journal line below carries the whole
    // calculation, so the add itself stays silent.
    player.stock.add(Resource.MEGACREDITS, amount, {log: false, from: {resolution: URBAN_RESEARCH_ID}});
    const after = player.megaCredits;
    ctx.game.log('${0} gained ${1} M€ from ${2}: 2 per point of influence, influence ${3} (${4} → ${5})', (b) =>
      b.player(player).number(amount).resolution(URBAN_RESEARCH_ID).number(influence).number(before).number(after));
    ctx.report({kind: 'stock', effect: effect.id, stock: Resource.MEGACREDITS, amount, influence, before, after});
    return undefined;
  },
};

export const URBAN_RESEARCH: ResolutionDefinition = {
  id: URBAN_RESEARCH_ID,
  code: URBAN_RESEARCH_CODE,
  module: 'turmoilRedux',
  party: PartyName.MARS,
  copies: 1,
  // THE FACE, as the scan prints it: ONE row of two boxes — «2 [M€] /
  // [influence]» on the left, «[card] / [city tag]» on the right. The card's
  // own order, not the steps' (a face is a pictogram, never a sequence), and
  // the counted object is the printed CITY MEDALLION — this card counts tags,
  // never tiles.
  renderData: CardRenderer.builder((b) => {
    b.megacredits(2).slash().influence().nbsp.cards(1).slash().tag(Tag.CITY);
  }),
  text: {
    name: 'Urban Research',
    effect: 'Draw 1 card for every city tag you have. Then gain 2 M€ per point of influence.',
    quest: 'Play 1 city tag',
  },
  quest: {goal: {kind: 'tag', tag: Tag.CITY}, count: 1},
  scaled: [URBAN_RESEARCH_DRAW, URBAN_RESEARCH_MEGACREDITS],
  // THE PRINTED ORDER: the cards first, the money second.
  immediateSteps: [DRAW_STEP, MEGACREDITS_STEP],
};
