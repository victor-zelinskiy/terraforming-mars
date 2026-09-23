/*
 * COLONY CONTEST (Unity) — Turmoil Redux resolution RX09: titanium by influence
 * for everyone (the family's plainest payout — a stock chip to the rail) and
 * the FIRST winner's part that is not a tile on Mars but a COLONY: the winner
 * builds one for free (docs/TURMOIL_REDUX_COLONY_CONTEST.md).
 *
 * Printed: «When enacted: Gain titanium equal to your Influence. The player
 * that won this resolution places a colony for free.» Chairman quest: build 2
 * colonies. Colonies are mandatory in Redux, so the card declares no
 * compatibility (Colonial Affairs' reading).
 *
 * THE READINGS FIXED HERE:
 *  · TITANIUM: 1 × the player's influence for EVERY participant — voters or
 *    not, the Unity effect or not — read through the Redux ledger AFTER the
 *    winner's Agenda step (the driver seeds `ctx.influence` after step 1).
 *    Ordinary titanium into the supply: never production, no cap. Influence 0
 *    → nothing, NAMED (a journal line and a `skipped` outcome), no question.
 *  · THE WINNER'S COLONY is ONE standard build (`BuildColony`): the ordinary
 *    availability (`Colonies.getPlayableColonies` — an ACTIVE tile, not full,
 *    none of the winner's cubes on it; Venus / Europa / Leavitt only while the
 *    winner can afford their TR step), the cube on the tile, and the tile's
 *    BUILD BONUS paid by the colony itself (`Colony.addColony` — production,
 *    titanium, a resource onto a card the winner picks, Europa's ocean,
 *    Pluto's cards: the engine's own deferred tail, which the phase drains
 *    before it goes on, pausing on every question it raises). FREE means
 *    exactly that: no 17 M€ (no `commit` closure of the standard project), no
 *    trade fleet, no action counted. «Places a colony for free» is this build.
 *  · NO AVAILABLE COLONY (every tile full or inactive, the winner's cube on
 *    every open one): the part is NAMED and skipped (journal + outcome) — no
 *    empty prompt, nothing substituted (no M€, no titanium in its place).
 *  · A NEUTRAL winner builds nothing (`winnerSteps` never run for one —
 *    rulebook FAQ p.18); the titanium still reaches everyone. A record needs a
 *    seat and the neutral player has none, so the client reads the neutral
 *    winner off the phase's own verdict (`winnerRewardModel`: «нейтральный
 *    победитель — колонию никто не строит»), exactly as for a tile.
 *  · THE CHAIRMAN QUEST («build 2 colonies») counts a player's OWN action-phase
 *    builds; this colony never counts — its chain's root is the political phase
 *    and the resolution sits on the event stack (`QuestTracker.eligible`,
 *    decision Q5), however and whenever the pick is answered.
 *  · ONCE PER ENACTMENT: the driver's idempotency keys
 *    (`effect:<generation>:<instance>:<player>:<step>`) — a reload, a repeated
 *    answer or a model refresh pays nothing twice; the build and the step's
 *    applied mark are saved together, so a reload never finds a colony built
 *    by a question it still asks.
 *
 * THE STEP CONTRACT (IResolution.ts): the titanium step MUTATES; the colony
 * step ASKS (the pick's own answer builds and reports) — or, with no tile to
 * build on, changes nothing and reports the skip. A reload inside the question
 * re-runs `run`, which offers the same tiles (nothing on the table moves while
 * the phase waits for this one answer).
 */
import {CardRenderer} from '../../../cards/render/CardRenderer';
import {PartyName} from '../../../../common/turmoil/PartyName';
import {Resource} from '../../../../common/Resource';
import {ResolutionCode, ResolutionId} from '../../../../common/parliament/ParliamentTypes';
import {InfluenceScaledEffect, scaledAmount} from '../../../../common/parliament/influenceScaling';
import {ChoiceContextSource} from '../../../../common/models/PlayerInputModel';
import {BuildColony} from '../../../deferredActions/BuildColony';
import {committedPlacement} from '../../../inputs/placementContext';
import {EnactStep, ResolutionDefinition} from '../IResolution';

export const COLONY_CONTEST_ID: ResolutionId = 'RDX_UNITY_COLONY_CONTEST';
export const COLONY_CONTEST_CODE: ResolutionCode = 'RX09';

/** THE FORMULA: 1 titanium per point of influence, for every participant — no count, no cap. */
export const COLONY_CONTEST_TITANIUM: InfluenceScaledEffect = {
  id: 'titanium',
  unit: {kind: 'stock', resource: Resource.TITANIUM},
  perInfluence: 1,
  recipient: 'each',
};

/** The skip's reason when the winner has no tile to build on — an English key; the stage plate translates it. */
export const NO_COLONY_AVAILABLE = 'No colony is available';

/** WHO asks — the same source on the pick, its plate and every skip. */
const SOURCE: ChoiceContextSource = {kind: 'resolution', resolution: COLONY_CONTEST_ID};

const TITANIUM_STEP: EnactStep = {
  key: 'titanium',
  run(ctx) {
    const player = ctx.player;
    const effect = COLONY_CONTEST_TITANIUM;
    const influence = ctx.influence;
    const amount = scaledAmount(effect, influence);
    if (amount <= 0) {
      ctx.game.log('${0} has no influence — no titanium from ${1}', (b) => b.player(player).resolution(COLONY_CONTEST_ID));
      ctx.report({kind: 'skipped', effect: effect.id, stock: Resource.TITANIUM, amount: 0, influence, reason: 'No influence'});
      return undefined;
    }
    const before = player.titanium;
    // The standard gain: its event carries this resolution as the source (the
    // journal chip, the notification's «why», the recorder). The ONE journal
    // line below carries the whole calculation, so the add itself stays silent.
    player.stock.add(Resource.TITANIUM, amount, {log: false, from: {resolution: COLONY_CONTEST_ID}});
    const after = player.titanium;
    ctx.game.log('${0} gained ${1} ${2} from ${3}: 1 per point of influence, influence ${4} (${5} → ${6})', (b) =>
      b.player(player).number(amount).resource(Resource.TITANIUM).resolution(COLONY_CONTEST_ID).number(influence).number(before).number(after));
    ctx.report({kind: 'stock', effect: effect.id, stock: Resource.TITANIUM, amount, influence, before, after});
    return undefined;
  },
};

const COLONY_STEP: EnactStep = {
  key: 'colony',
  run(ctx) {
    const player = ctx.player;
    const game = ctx.game;
    // THE STANDARD BUILD, free: the tiles the ordinary rules allow (the others
    // offered DISABLED with their reason — full, inactive, already yours), the
    // colony's own `addColony` with the tile's build bonus, the console's
    // colonies screen as the surface. The resolution is the source
    // (`placementContext.source` — the sitting's step, the plate, L3); the
    // answer reports WHERE the cube landed.
    const prompt = new BuildColony(player, {
      title: 'Select where to build the free colony',
      placementContext: committedPlacement('The winner of the vote builds this colony — the resolution is already enacted', SOURCE),
    }).andThen((colony) => {
      game.log('${0} built the free colony of ${1} on ${2}', (b) => b.player(player).resolution(COLONY_CONTEST_ID).colony(colony));
      ctx.report({kind: 'colony', colony: colony.name});
    }).execute();
    if (prompt === undefined) {
      // The ordinary rules left no tile: named and skipped — nothing
      // substitutes for the colony.
      game.log('No colony can be built — the winner\'s colony from ${0} is skipped', (b) => b.resolution(COLONY_CONTEST_ID));
      ctx.report({kind: 'skipped', reason: NO_COLONY_AVAILABLE});
    }
    return prompt;
  },
};

export const COLONY_CONTEST: ResolutionDefinition = {
  id: COLONY_CONTEST_ID,
  code: COLONY_CONTEST_CODE,
  module: 'turmoilRedux',
  party: PartyName.UNITY,
  copies: 1,
  // THE FACE, as printed: the per-influence formula on its own row (1 titanium
  // / influence — the RESOURCE), the winner's colony on the next: the game's
  // own colony tile symbol with the winner star.
  renderData: CardRenderer.builder((b) => {
    b.titanium(1).slash().influence().br;
    b.colonies(1).voteWinner();
  }),
  text: {
    name: 'Colony Contest',
    effect: 'Gain 1 titanium for every point of your influence.',
    winner: 'Build a colony for free.',
    quest: 'Build 2 colonies',
  },
  quest: {goal: {kind: 'colony'}, count: 2},
  scaled: [COLONY_CONTEST_TITANIUM],
  winnerReward: {kind: 'colony'},
  immediateSteps: [TITANIUM_STEP],
  winnerSteps: [COLONY_STEP],
};
