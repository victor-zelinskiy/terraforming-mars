/*
 * DIVERTED RESEARCH (the Reds) — Turmoil Redux resolution RX35: the first law of
 * the REPLACING kind. The two kinds before it ANSWER an event (Development Craze
 * pays a placement's bonuses again, Urban Development draws for a tag) or are
 * READ by one function (Heat Capture's discount, Metal Research's value, R&D
 * Funding's tags). This one steps IN FRONT of the event: the scale does not
 * move, the tile is not seated, the rating does not rise — a data resource
 * lands on one of the seat's cards instead (docs/TURMOIL_REDUX_DIVERTED_RESEARCH.md).
 *
 * Printed: «When enacted: Gain data resources equal to your Influence. Effect:
 * REPLACE each increase in Oxygen or Temperature and each Greenery and Ocean
 * tile you would gain with 1 data resource. (Even if the parameter is maxed.)»
 * Chairman quest: add 4 data resources to your cards.
 *
 * THE READINGS FIXED HERE:
 *  · DATA AT THE ENACTMENT: 1 × the seat's influence, onto ONE card that can
 *    hold data — Aquifer Contest's picker (`AddResourcesToCard`, `autoSelect:
 *    false`: one holder is still shown and confirmed), never a layout (no
 *    `spread`). Influence 0 is NAMED; influence without a holder is NAMED with
 *    its size and forfeited («no card can hold data»), never banked.
 *  · THE PASSIVE replaces exactly FOUR things the seat WOULD GAIN: a step of
 *    OXYGEN, a step of TEMPERATURE, a GREENERY tile, an OCEAN tile — one data
 *    apiece. Not Venus (not named), not a bare rating (`behavior.tr`, the
 *    Agenda's step, the chair), not a LOWERING, not the World Government's
 *    move nor any `unrewarded` move (nobody «gains» those), not a city or a
 *    special tile, never MarsBot (outside the `enactment` aspect), never a
 *    seat outside the parliament.
 *  · «EVEN IF THE PARAMETER IS MAXED»: the replacement stands BEFORE the
 *    ceiling check — 14 % oxygen and «+1 oxygen» is 1 data, nine oceans and
 *    «an ocean» is 1 data (Whales takes no animal: the ocean never reached
 *    its no-ocean branch). The PRINTED units count, not what the ceiling would
 *    leave (decision Р3: 13 % and «+2» is 2 data).
 *  · A GREENERY IS ONE DATA, not two: its oxygen is part of the tile
 *    (`Game.addGreenery` raises it), and the tile is taken before the oxygen
 *    exists. A card printing «+1 O₂» AND a greenery is 2 (a step and a tile).
 *  · ONE OPERATION — ONE QUESTION (decision Р4): every unit the operation
 *    replaces is accrued by the family's accumulator
 *    (`resolutions/DivertedTerraforming.ts`) and asked once, at the back of
 *    the line, on one card. No holder: the loss is NAMED with its sum. The
 *    action itself is never blocked for want of a holder (invariant 4: a
 *    named loss, not a gate); it is «without effect» (`actionFutility`).
 *  · THE GATES OF THE CEILING AND OF THE CELL FALL WHILE THE LAW STANDS
 *    (decision Р5): a conversion at maximum, an asteroid at +8 °C, a greenery
 *    with no legal cell — the law seats nothing and needs no room; the price
 *    (8 plants, 8 heat, the M€) stays the gate it was.
 *  · WHAT FOLLOWS A UNIT NEVER HAPPENS — by the engine's own order, nothing is
 *    undone here: no rating (and so no Greens' M€), no bonus step crossed, no
 *    `onGlobalParameterIncrease` reactor, no cell bonus, no adjacency, no
 *    Redux greenery TR, no tile VP, no `global-parameter-changed` /
 *    `tile-placed` event. The law does not zero the operation — it SUBSTITUTES:
 *    its own `effect-triggered` marker (channel `terraforming-diverted`) with
 *    the data's landing as its child stands where the planet's event would.
 *  · THE NEXT LAW'S WINNER PART is never replaced: the enactment puts the new
 *    card in the slot BEFORE its steps run (`ParliamentPhase.stepEnact`), so
 *    Mohole Contest after this card pays its winner the temperature.
 *  · THE LAW STANDS UNTIL THE NEXT ENACTMENT — the final greenery placement
 *    of the last generation included (decision Р2): eight plants buy one data
 *    there, and the session says so.
 *  · THE QUEST («add 4 data to your cards») counts the seat's OWN deeds: the
 *    data of the enactment never (its root is the political phase), the data
 *    the law diverts INSIDE the seat's own action always (decision Р6 — the
 *    one named exception of `QuestTracker.eligible`, keyed on the channel).
 *  · THE FORECAST TWIN is the family's one exit pass over every preview
 *    (`models/divertedTerraforming.ts`): the printed chip STRUCK with the data
 *    it becomes, the implied rating gone, the «where» step pre-collected; the
 *    law's own fact reads its sum off the same pass (`ctx.diverted`). The
 *    DOSSIER twin (`placementFacts`) warns on a cell whose PAID bonus is an
 *    ocean or a temperature step (the Hellas pole, Vastitas Borealis): the
 *    purchase buys 1 data.
 *  · No `compatibility`: data is a base resource of this fork (ten holders in
 *    the Redux scope, Pluto pays it), so the card is dealt in every Redux game.
 *
 * THE STEP CONTRACT (IResolution.ts): the one step MUTATES or ASKS, never
 * both — the amount is fixed in `ctx.state` the first time, and every mutation
 * happens inside the prompt's own callback.
 */
import {CardRenderer} from '../../../cards/render/CardRenderer';
import {Size} from '../../../../common/cards/render/Size';
import {PartyName} from '../../../../common/turmoil/PartyName';
import {CardResource} from '../../../../common/CardResource';
import {ResolutionCode, ResolutionId} from '../../../../common/parliament/ParliamentTypes';
import {InfluenceScaledEffect, scaledAmount} from '../../../../common/parliament/influenceScaling';
import {ChoiceContextSource} from '../../../../common/models/PlayerInputModel';
import {SpaceBonus} from '../../../../common/boards/SpaceBonus';
import {BoardFact} from '../../../../common/boards/BoardInformationFacts';
import {message} from '../../../logs/MessageBuilder';
import {AddResourcesToCard} from '../../../deferredActions/AddResourcesToCard';
import {EnactStep, ResolutionDefinition} from '../IResolution';
import {divertIntoData, logDivertedUnit} from '../DivertedTerraforming';

export const DIVERTED_RESEARCH_ID: ResolutionId = 'RDX_REDS_DIVERTED_RESEARCH';
export const DIVERTED_RESEARCH_CODE: ResolutionCode = 'RX35';
/** The printed «4 [data]» — the chairman quest's count. */
export const DIVERTED_RESEARCH_QUEST_DATA = 4;

/** THE FORMULA: 1 data per point of influence, onto ONE card, for every participant — no cap, no layout. */
export const DIVERTED_RESEARCH_DATA: InfluenceScaledEffect = {
  id: 'data',
  unit: {kind: 'cardResource', resources: [CardResource.DATA]},
  perInfluence: 1,
  recipient: 'each',
};

/** WHO asks — the same source on the enactment's picker and on every skip. */
const SOURCE: ChoiceContextSource = {kind: 'resolution', resolution: DIVERTED_RESEARCH_ID};

/** The state key the data step fixes its amount under (see the contract above). */
const DATA_OWED_KEY = 'dataOwed';

/** The server's own reason for the forfeited enactment share. */
export const DIVERTED_RESEARCH_NO_HOLDER_REASON = 'No card can hold data';

const DATA_STEP: EnactStep = {
  key: 'data',
  run(ctx) {
    const player = ctx.player;
    const remembered = ctx.state[DATA_OWED_KEY];
    const owed = typeof remembered === 'number' ? remembered : scaledAmount(DIVERTED_RESEARCH_DATA, ctx.influence);
    ctx.state[DATA_OWED_KEY] = owed;
    if (owed <= 0) {
      ctx.game.log('${0} has no influence — no data from ${1}', (b) => b.player(player).resolution(DIVERTED_RESEARCH_ID));
      ctx.report({kind: 'skipped', effect: DIVERTED_RESEARCH_DATA.id, resource: CardResource.DATA, amount: 0, influence: ctx.influence, reason: 'No influence'});
      return undefined;
    }
    const cards = player.getResourceCards(CardResource.DATA);
    if (cards.length === 0) {
      ctx.game.log('${0} has no card that can hold data — ${1} data from ${2} are forfeited', (b) =>
        b.player(player).number(owed).resolution(DIVERTED_RESEARCH_ID));
      ctx.report({kind: 'skipped', effect: DIVERTED_RESEARCH_DATA.id, resource: CardResource.DATA, amount: owed, influence: ctx.influence, reason: DIVERTED_RESEARCH_NO_HOLDER_REASON});
      return undefined;
    }
    // THE SHARED PICKER (Aquifer Contest's): the candidates, the «current →
    // resulting» and VP readings and the source dock all come from it;
    // `autoSelect: false` is the «to ANY card» law of this fork.
    return new AddResourcesToCard(player, CardResource.DATA, {
      count: owed,
      autoSelect: false,
      title: message('Add ${0} data to one of your cards', (b) => b.number(owed)),
      cause: SOURCE,
      from: {resolution: DIVERTED_RESEARCH_ID},
    }).andThen((card) => {
      ctx.report({kind: 'cardResource', effect: DIVERTED_RESEARCH_DATA.id, resource: CardResource.DATA, amount: owed, card: card.name, influence: ctx.influence});
    }).execute();
  },
};

export const DIVERTED_RESEARCH: ResolutionDefinition = {
  id: DIVERTED_RESEARCH_ID,
  code: DIVERTED_RESEARCH_CODE,
  module: 'turmoilRedux',
  party: PartyName.REDS,
  copies: 1,
  // THE FACE, as printed: the per-influence formula on its own row («[data] /
  // [influence]»), then the passive as ONE rule in the game's own dictionary
  // — «REPLACE [temperature] / [oxygen] / [ocean] / [greenery] : [data]» —
  // one drawing serving the bill, the effects list and the inspector.
  renderData: CardRenderer.builder((b) => {
    b.resource(CardResource.DATA).slash().influence().br;
    b.effect(undefined, (eb) => {
      eb.text('REPLACE', Size.SMALL, true).temperature(1).slash().oxygen(1).slash().oceans(1).slash().greenery()
        .startEffect.resource(CardResource.DATA);
    });
  }),
  text: {
    name: 'Diverted Research',
    effect: 'Add 1 data resource per point of your influence to one of your cards.',
    // The block label says WHEN («Эффект, пока принята»); the sentence says WHAT.
    passive: 'Each step of oxygen or temperature you would raise and each greenery or ocean tile you would place becomes 1 data resource on one of your cards instead — even when the parameter is at its maximum.',
    quest: 'Add 4 data resources to your cards',
  },
  quest: {goal: {kind: 'cardResource', resource: CardResource.DATA}, count: DIVERTED_RESEARCH_QUEST_DATA},
  scaled: [DIVERTED_RESEARCH_DATA],
  immediateSteps: [DATA_STEP],
  passive: {
    // THE REPLACEMENT — inside the dispatcher's scope (the gate and the law's
    // event source are its): the unit is journaled in the family's words and
    // accrued into the ONE accumulator, whose landing asks «where» once.
    divertTerraforming(player, unit) {
      logDivertedUnit(player.game, player, DIVERTED_RESEARCH_ID, unit);
      divertIntoData(player, DIVERTED_RESEARCH_ID, unit);
      return true;
    },
    // THE DOSSIER TWIN: a cell whose PAID bonus is a terraforming unit — the
    // Hellas pole's ocean (6 M€), Vastitas Borealis' temperature step (4 M€)
    // — buys 1 data under the law, and the dossier says so BEFORE the
    // placement. The cell's printed facts already state the purchase; this
    // fact names what the purchase becomes.
    placementFacts(ctx) {
      if (!ctx.onMars || !ctx.placesTile || !ctx.grantsPlacementBonus) {
        return [];
      }
      const facts: Array<BoardFact> = [];
      if (ctx.space.bonus.includes(SpaceBonus.OCEAN)) {
        facts.push(ctx.gain('ocean-bonus', {icon: 'data', amount: 1, direction: 'gain'},
          'Enacted resolution: the ocean this cell\'s bonus buys becomes 1 data on one of your cards'));
      }
      if (ctx.space.bonus.includes(SpaceBonus.TEMPERATURE_4MC)) {
        facts.push(ctx.gain('temperature-bonus', {icon: 'data', amount: 1, direction: 'gain'},
          'Enacted resolution: the temperature step this cell\'s bonus buys becomes 1 data on one of your cards'));
      }
      return facts;
    },
    // THE FORECAST TWIN reads the family's exit pass (`ctx.diverted` — the sum
    // of the chips the pass struck), on the channel the live marker fires on.
    forecast(ctx) {
      const {data, holder} = ctx.diverted;
      if (data <= 0) {
        return [];
      }
      const source = ctx.source('terraforming-diverted');
      const chips = [ctx.cardResourceGain(CardResource.DATA, data)];
      if (!holder) {
        return [ctx.skipped(source, chips, 'Diverted Research replaces the terraforming with data on one of your cards',
          {id: 'diverted-research-data', note: 'No card can hold the diverted data'})];
      }
      return [ctx.exact(source, chips, 'Diverted Research replaces the terraforming with data on one of your cards', {id: 'diverted-research-data'})];
    },
  },
};
