/*
 * URBAN DEVELOPMENT (Mars First) — Turmoil Redux resolution RX30. Its payout
 * and its quest are RX10's, letter for letter; the whole price of the card is
 * its passive, which opens the family's SECOND reactive channel: a law that
 * answers A CARD BEING PLAYED (until it, only `onTilePlaced` fired).
 *
 * Printed: «When enacted: Gain steel equal to your Influence. Effect: After
 * you play a Building tag, draw a card.»
 * Chairman quest: place 1 SPECIAL tile (the printed solid brown hex — a city
 * does NOT close it; the same footnote Development Craze carries).
 *
 * THE READINGS FIXED HERE:
 *  · STEEL: 1 × the player's influence for EVERY participant, into the supply,
 *    no cap — `DEVELOPMENT_CRAZE_STEEL`'s formula, written out again for this
 *    card. Influence 0 → nothing, NAMED (a journal line and a `skipped`).
 *  · «A BUILDING TAG» IS EVERY BUILDING TAG. A card printing TWO of them draws
 *    TWO cards. The engine's own precedent is Point Luna («When you play an
 *    Earth tag … draw a card» → `cardTagCount` → `drawCard(tagCount)`, «one
 *    card drawn per Earth tag»), and our sentence is built the same way, so it
 *    reads the same way. The count is `Tags.cardTagCount` and nothing of our
 *    own: PRINTED tags of the card alone — a wild tag is not a Building tag,
 *    and the Habitat Marte substitution touches only Science.
 *    ⚠️ THE UPSTREAM PARTY POLICY `mp02` («When you play a building tag, gain
 *    2 M€») counts ONCE PER CARD (`card.tags.includes`). That is upstream code
 *    under a differently-built sentence; it is not touched and not aligned —
 *    the divergence is recorded in the spec so nobody levels the two by guess.
 *  · WHO HOLDS IT: every PARTICIPANT of the sitting (an enacted resolution is
 *    everyone's law), never MarsBot and never a seat outside the parliament —
 *    the dispatcher's own gate (`ParliamentHandler.enactedPassive`).
 *  · A CARD PLAY, not a building: the standard project CITY plays no card and
 *    carries no tag, so it pays nothing. A PRELUDE and a CORPORATION do count
 *    when their play happens under the standing law (Merger, New Partner) —
 *    they go through the same `Player.onCardPlayed`. The SOURCE of the play is
 *    never filtered: decision Q5 («what a resolution's own source did does not
 *    count») is about QUESTS — a passive is an effect, and a play is a play.
 *  · SYNCHRONOUSLY, at the hook: the draw asks the player nothing, and the
 *    card must be in hand before the play finishes (the ruling party's own
 *    `mp02` pays on the spot at the very same point). Deferring would queue it
 *    behind whatever the played card itself defers and quietly change what the
 *    deck hands out.
 *  · THE DECK CAN COME UP SHORT: what it could not deliver is journaled, never
 *    a silent zero (the family's `Only N of M card(s) were left…` line).
 *  · THE FORECAST twin stands at the hook's own position in the fan-out
 *    (`effectForecast.cardPlayedFacts`, step 2.5) and is EXACT: the number is
 *    known now — the tags are printed on the card being confirmed.
 *  · ENDS WITH THE LAW: the dispatcher reads the ENACTED definition at every
 *    firing, so a later sitting that enacts another card ends the draw.
 */
import {CardRenderer} from '../../../cards/render/CardRenderer';
import {PartyName} from '../../../../common/turmoil/PartyName';
import {Resource} from '../../../../common/Resource';
import {Tag} from '../../../../common/cards/Tag';
import {ResolutionCode, ResolutionId} from '../../../../common/parliament/ParliamentTypes';
import {InfluenceScaledEffect, scaledAmount} from '../../../../common/parliament/influenceScaling';
import {IPlayer} from '../../../IPlayer';
import {ICard} from '../../../cards/ICard';
import {EnactStep, ResolutionDefinition} from '../IResolution';

export const URBAN_DEVELOPMENT_ID: ResolutionId = 'RDX_MARS_URBAN_DEVELOPMENT';
export const URBAN_DEVELOPMENT_CODE: ResolutionCode = 'RX30';

/** THE FORMULA: 1 steel per point of influence, for every participant — no cap. */
export const URBAN_DEVELOPMENT_STEEL: InfluenceScaledEffect = {
  id: 'steel',
  unit: {kind: 'stock', resource: Resource.STEEL},
  perInfluence: 1,
  recipient: 'each',
};

const STEEL_STEP: EnactStep = {
  key: 'steel',
  run(ctx) {
    const player = ctx.player;
    const effect = URBAN_DEVELOPMENT_STEEL;
    const influence = ctx.influence;
    const amount = scaledAmount(effect, influence);
    if (amount <= 0) {
      ctx.game.log('${0} has no influence — no steel from ${1}', (b) => b.player(player).resolution(URBAN_DEVELOPMENT_ID));
      ctx.report({kind: 'skipped', effect: effect.id, stock: Resource.STEEL, amount: 0, influence, reason: 'No influence'});
      return undefined;
    }
    const before = player.steel;
    // The standard gain under the resolution's source; the ONE journal line
    // below carries the whole calculation, so the add itself stays silent.
    player.stock.add(Resource.STEEL, amount, {log: false, from: {resolution: URBAN_DEVELOPMENT_ID}});
    const after = player.steel;
    ctx.game.log('${0} gained ${1} ${2} from ${3}: 1 per point of influence, influence ${4} (${5} → ${6})', (b) =>
      b.player(player).number(amount).resource(Resource.STEEL).resolution(URBAN_DEVELOPMENT_ID).number(influence).number(before).number(after));
    ctx.report({kind: 'stock', effect: effect.id, stock: Resource.STEEL, amount, influence, before, after});
    return undefined;
  },
};

/**
 * HOW MANY CARDS THIS PLAY IS WORTH — the ONE reading, shared by the live hook
 * and its forecast twin so the promise and the payout cannot disagree. Printed
 * Building tags of the card, one card apiece (Point Luna's precedent).
 */
export function urbanDevelopmentCards(player: IPlayer, card: ICard): number {
  return player.tags.cardTagCount(card, Tag.BUILDING);
}

export const URBAN_DEVELOPMENT: ResolutionDefinition = {
  id: URBAN_DEVELOPMENT_ID,
  code: URBAN_DEVELOPMENT_CODE,
  module: 'turmoilRedux',
  party: PartyName.MARS,
  copies: 1,
  // THE FACE: the per-influence steel on its own row; the passive as the
  // game's own dictionary reads it — a Building TAG played → a card. The SAME
  // drawing serves the bill, the Information effects list and the inspector.
  renderData: CardRenderer.builder((b) => {
    b.steel(1).slash().influence().br;
    b.effect(undefined, (eb) => eb.tag(Tag.BUILDING).startEffect.cards(1));
  }),
  text: {
    name: 'Urban Development',
    effect: 'Gain 1 steel for every point of your influence.',
    // The block label says WHEN («Эффект, пока принята»); the sentence says WHAT.
    passive: 'After you play a Building tag, draw a card.',
    quest: 'Place 1 special tile',
  },
  quest: {goal: {kind: 'tile', tile: 'special'}, count: 1},
  scaled: [URBAN_DEVELOPMENT_STEEL],
  immediateSteps: [STEEL_STEP],
  passive: {
    onCardPlayed(player, card) {
      const owed = urbanDevelopmentCards(player, card);
      if (owed === 0) {
        return;
      }
      // The seat's ordinary IN-TURN draw (never the external intake — that is
      // for a draw outside your own turn). The scope is the dispatcher's, so
      // the reveal and the analytics already name the law.
      const before = player.cardsInHand.length;
      player.drawCard(owed);
      const drawn = player.cardsInHand.length - before;
      player.game.log('${0} played ${1} building tag(s) and draws ${2} card(s) from ${3}', (b) =>
        b.player(player).number(owed).number(drawn).resolution(URBAN_DEVELOPMENT_ID));
      if (drawn < owed) {
        player.game.log('Only ${0} of ${1} card(s) were left in the deck for ${2}', (b) =>
          b.number(drawn).number(owed).player(player));
      }
    },
    cardPlayedForecast(ctx) {
      const owed = urbanDevelopmentCards(ctx.player, ctx.card);
      if (owed === 0) {
        return [];
      }
      // EXACT: the tags are printed on the card in front of the player, so the
      // number is known at the confirmation — nothing here is chosen later.
      // The sentence is the LAW's own (the family's way, RX10): the shared
      // `tagReason` key would drag in a term this fork does not use for the
      // Building tag, and rewriting a translation we did not coin is banned.
      return [ctx.exact(ctx.source('card-played'), [ctx.drawGain(owed)],
        'Urban Development draws a card for every building tag you play', {id: 'urban-development-draw'})];
    },
    // Nothing of this law answers the operation's GRANTS or TILES — its one
    // reaction is the play itself, and that has its own twin above.
    forecast() {
      return [];
    },
  },
};
