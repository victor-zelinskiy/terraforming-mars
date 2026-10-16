import {expect} from 'chai';
import {
  FLOATERS_TO_ANY_CARD, HEAT_PRICE, PLANTS_PRICE, REPROCESSING_PLANT_HEAT_TITLE, REPROCESSING_PLANT_PLANTS_TITLE, ReprocessingPlant,
} from '../../../src/server/cards/turmoilRedux/ReprocessingPlant';
import {CouncilSeat} from '../../../src/server/cards/turmoilRedux/CouncilSeat';
import {ConstructionMechs} from '../../../src/server/cards/turmoilRedux/ConstructionMechs';
import {Dirigibles} from '../../../src/server/cards/venusNext/Dirigibles';
import {AerialMappers} from '../../../src/server/cards/venusNext/AerialMappers';
import {StormCraftIncorporated} from '../../../src/server/cards/colonies/StormCraftIncorporated';
import {floaterCards} from '../../../src/server/cards/venusNext/floaterCards';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {testAutomaGame} from '../../automa/AutomaTestGame';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {AutomaResolver} from '../../../src/server/automa/AutomaResolver';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {CardResource} from '../../../src/common/CardResource';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {Resource} from '../../../src/common/Resource';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {Payment} from '../../../src/common/inputs/Payment';
import {InputResponse} from '../../../src/common/inputs/InputResponse';
import {ALL_MODULE_MANIFESTS} from '../../../src/server/cards/AllManifests';
import {actionPreview} from '../../../src/server/models/actionPreview';
import {actionUnavailableReasons} from '../../../src/server/models/actionUnavailableReasons';
import {actionFutility} from '../../../src/server/models/actionFutility';
import {effectForecastForAction} from '../../../src/server/models/effectForecast';
import {PARTY_REQUIREMENT_REASON, unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {requiredPartyOf} from '../../../src/server/cards/requirements/partyRequirementCards';
import {buildCardInformation} from '../../../src/server/tools/cardInfo/buildCardInformation';
import {replayBatch} from '../../../src/server/inputs/deferredInputBatch';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {AndOptions} from '../../../src/server/inputs/AndOptions';
import {ICard} from '../../../src/server/cards/ICard';
import {IProjectCard} from '../../../src/server/cards/IProjectCard';
import {ActionPreviewBranch} from '../../../src/common/models/ActionPreviewModel';
import {SelectCardModel} from '../../../src/common/models/PlayerInputModel';
import {addressed} from '../../../src/common/inputs/preselectAddress';
import {cast} from '../../../src/common/utils/utils';
import {quietResolutionOf, seatEnacted, seatResolution} from '../../parliament/parliamentArrange';
import {formatMessage, runAllActions} from '../../TestingUtils';

/**
 * TR58 — REPROCESSING PLANT: the Industrialists' sixth plate and the set's
 * first `or` on the PRICE side — «3 plants OR 5 heat → 3 floaters onto ANY
 * card». Every rule reading of the card file's header is pinned here: the
 * plate's two roads, a play of nothing but the Building tag, the two prices
 * that live apart and buy one result, the holder never applied by itself,
 * Stormcraft's heat split asked BEFORE the commit (the branch's first step),
 * the reason that closes both variants leading, futility, Celestic, MarsBot,
 * save / load.
 */
const I = PartyName.INDUSTRIALISTS;
const COST = 8;
const RP = CardName.REPROCESSING_PLANT;
const NO_HOLDER = 'No card to add the resource to';

type Table = {game: IGame, player: TestPlayer, opponent: TestPlayer, parliament: Parliament, card: ReprocessingPlant};

/** A two-seat Redux table in the action phase, the Industrialists RULING by an enacted card, 20 M€, nothing to pay with. */
function table(): Table {
  const [game, player, opponent] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true, venusNextExtension: true});
  game.phase = Phase.ACTION;
  const parliament = game.parliament!;
  seatEnacted(parliament, quietResolutionOf(I));
  player.megaCredits = 20;
  return {game, player, opponent, parliament, card: new ReprocessingPlant()};
}

function redsRule(t: Table): Table {
  seatEnacted(t.parliament, quietResolutionOf(PartyName.REDS));
  expect(t.parliament.rulingParty()).eq(PartyName.REDS);
  return t;
}

function industrialistCubes(t: Table, player: TestPlayer, n: number): void {
  let slot = t.parliament.slotOf(I);
  if (slot === undefined) {
    seatResolution(t.parliament, 0, quietResolutionOf(I));
    slot = t.parliament.slotOf(I)!;
  }
  for (let i = 0; i < n; i++) {
    t.parliament.placeVote(player, slot, t.parliament.lobby.has(player.id) ? 'lobby' : 'reserve');
  }
}

/** The card on the player's table with `plants` / `heat` in stock. */
function owned(t: Table, plants: number, heat: number): Table {
  t.player.playedCards.push(t.card);
  t.player.plants = plants;
  t.player.heat = heat;
  return t;
}

/** Two floater holders: Dirigibles (1 floater) and Aerial Mappers (empty). */
function holders(t: Table): {dirigibles: Dirigibles, mappers: AerialMappers} {
  const dirigibles = new Dirigibles();
  dirigibles.resourceCount = 1;
  const mappers = new AerialMappers();
  t.player.playedCards.push(dirigibles, mappers);
  return {dirigibles, mappers};
}

/** Stormcraft as the player's corporation with `floaters` on it. */
function stormcraft(t: Table, floaters: number): StormCraftIncorporated {
  const corp = new StormCraftIncorporated();
  corp.resourceCount = floaters;
  t.player.playedCards.push(corp);
  return corp;
}

/** The blue card's action from the action menu; every deferred step run. */
function activate(t: Table): void {
  const door = cast(t.player.playActionCard(), SelectCard);
  expect(door.cards.map((c) => c.name)).to.include(RP);
  door.cb([t.card]);
  runAllActions(t.game);
}

/** Answer the standing variant pick through the real input path. */
function variant(t: Table, index: number): void {
  cast(t.player.getWaitingFor(), OrOptions);
  t.player.process({type: 'or', index, response: {type: 'option'}});
  runAllActions(t.game);
}

/** Answer the standing card target through the real input path. */
function target(t: Table, card: ICard): void {
  const prompt = cast(t.player.getWaitingFor(), SelectCard<ICard>);
  expect(prompt.cards.map((c) => c.name)).to.include(card.name);
  t.player.process({type: 'card', cards: [card.name]});
  runAllActions(t.game);
}

function branches(t: Table): ReadonlyArray<ActionPreviewBranch> {
  return actionPreview(t.player, t.card).branches;
}

describe('ReprocessingPlant', () => {
  let t: Table;

  beforeEach(() => {
    t = table();
  });

  describe('the card as printed', () => {
    it('is a blue card for 8, Building, no resource, no VP, the INDUSTRIALISTS\' plate, TR58 — in the Redux manifest without compatibility', () => {
      const card = t.card;
      expect(card.name).eq(RP);
      expect(card.type).eq(CardType.ACTIVE);
      expect(card.cost).eq(COST);
      expect(card.tags, 'the corner holds one brown disc with the house').deep.eq([Tag.BUILDING]);
      expect(card.resourceType, 'a converter: it holds nothing').is.undefined;
      expect(card.victoryPoints, 'no VP badge').is.undefined;
      expect(requiredPartyOf(card), 'the MIN plate holds the Industrialists\' cog — a requirement, not a tag').eq(I);
      expect(card.requirements).has.length(1);
      expect(card.metadata.cardNumber).eq('TR58');
      expect(card.metadata.description).eq('Requires the Industrialists to be ruling or that you have 2 delegates there.');
      const manifest = ALL_MODULE_MANIFESTS.find((m) => m.module === 'turmoilRedux')!;
      const entry = (manifest.projectCards as Record<string, {compatibility?: unknown}>)[RP];
      expect(entry, 'registered in the Redux manifest').is.not.undefined;
      expect(entry.compatibility, 'only the module\'s icon at the bottom left: the module is the gate').is.undefined;
      expect([PLANTS_PRICE, HEAT_PRICE, FLOATERS_TO_ANY_CARD]).deep.eq([3, 5, 3]);
      expect((card as ICard).actionUnavailableReason, 'no reason of its own — the declaration\'s automatic ones').is.undefined;
      expect(card.behavior, 'the play does nothing but stand the card').is.undefined;
    });

    it('the ACTION is ONE DECLARATION: an `or` of two titled PRICES buying the SAME result, plants then heat — never optional', () => {
      const add = {type: CardResource.FLOATER, count: 3, mustHaveCard: true};
      expect(t.card.actionBehavior).deep.eq({
        or: {
          behaviors: [
            {spend: {plants: 3}, addResourcesToAnyCard: add, title: REPROCESSING_PLANT_PLANTS_TITLE},
            {spend: {heat: 5}, addResourcesToAnyCard: add, title: REPROCESSING_PLANT_HEAT_TITLE},
          ],
          autoSelect: true,
        },
      });
    });

    it('the face reads the scan: ONE action row — «3 [plant] OR 5 [heat] → 3 [floater]*», the «OR» on the PRICE side', () => {
      type Node = {type?: string, resource?: string, amount?: number, showDigit?: boolean, showAsterix?: boolean, rows?: Array<Array<Node | string>>};
      const rows = (t.card.metadata.renderData as unknown as {rows: Array<Array<Node | string>>}).rows;
      const action = rows.flat().find((n): n is Node => typeof n === 'object' && n.rows !== undefined)!;
      const [price, , result] = action.rows!.map((r) => r.filter((n): n is Node => typeof n === 'object'));
      expect(price.map((n) => n.type), 'two prices split by «OR»').deep.eq(['plants', 'OR', 'heat']);
      expect([price[0].amount, price[2].amount]).deep.eq([3, 5]);
      const goods = result.filter((n) => n.resource !== undefined);
      expect(goods.map((n) => [n.resource, n.amount, n.showDigit]), 'the result ONCE').deep.eq([[CardResource.FLOATER, 3, true]]);
      expect(JSON.stringify(result), 'the asterisk «to ANY card» after it').to.include('"*"');
    });

    it('the structured text prints the requirement and the action row with its short', () => {
      const info = buildCardInformation(t.card, 'turmoilRedux');
      const blocks = info?.groups.flatMap((g) => g.blocks) ?? [];
      expect(blocks.map((b) => b.text)).deep.eq([
        'Requires Industrialists to be ruling or that you have 2 delegates on its resolution.',
        'Action: Pay 3 plants or 5 heat to add 3 floater resources to ANY card.',
      ]);
      expect(blocks.map((b) => [b.kind, b.short])).to.deep.include.members([
        ['action', 'Pay 3 plants or 5 heat for 3 floaters on ANY card'],
      ]);
    });
  });

  describe('rule 1 — the requirement: the Industrialists rule, or 2 of your delegates on their resolution', () => {
    it('ruling: playable with no delegate anywhere', () => {
      t.player.cardsInHand.push(t.card);
      expect(t.player.canPlay(t.card)).is.true;
      expect(unplayableReasons(t.player, t.card)).deep.eq([]);
    });

    it('the Reds ruling: «0 of 2» with the named reason; one cube: «1 of 2»; two: playable', () => {
      redsRule(t);
      t.player.cardsInHand.push(t.card);
      expect(t.player.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.player, t.card)[0]).deep.include({
        type: 'party', message: PARTY_REQUIREMENT_REASON, params: [I, '2'], party: I, current: 0, requirement: true,
      });
      industrialistCubes(t, t.player, 1);
      expect(t.player.canPlay(t.card)).is.false;
      industrialistCubes(t, t.player, 1);
      expect(t.player.canPlay(t.card)).is.true;
    });

    it('TR36 Council Seat lowers the EFFECT\'s threshold, never the REQUIREMENT', () => {
      redsRule(t);
      t.player.cardsInHand.push(t.card);
      t.player.playedCards.push(new CouncilSeat());
      industrialistCubes(t, t.player, 1);
      expect(t.player.canPlay(t.card)).is.false;
    });

    it('checked at the PLAY only: on the table, the action works whoever rules', () => {
      const u = owned(redsRule(table()), 3, 0);
      holders(u);
      expect(u.card.canAct(u.player)).is.true;
    });
  });

  describe('rule 2 — the play: the Building tag and nothing else', () => {
    it('the cost is paid, the card stands, nothing is asked, nothing else moves', () => {
      t.player.cardsInHand.push(t.card);
      t.player.playCard(t.card, Payment.of({megacredits: COST}));
      runAllActions(t.game);
      expect(t.player.megaCredits).eq(20 - COST);
      expect(t.player.playedCards.get(RP)).eq(t.card);
      expect(t.player.getWaitingFor()).is.undefined;
    });

    it('Construction Mechs PAYS for it with mechs (the Building tag), EVA does not', () => {
      t.player.cardsInHand.push(t.card);
      const options = t.player.paymentOptionsForCard(t.card);
      expect(options.constructionMechs).is.true;
      expect(options.mechs).is.false;
      const construction = new ConstructionMechs();
      construction.resourceCount = 2;
      t.player.playedCards.push(construction);
      t.player.megaCredits = 0;
      t.player.playCard(t.card, Payment.of({constructionMechs: 2}));
      runAllActions(t.game);
      expect(t.player.playedCards.get(RP)).eq(t.card);
      expect(construction.resourceCount).eq(0);
    });
  });

  describe('rule 3 — ONE action, two PRICES, one result: each variant lives on its own price', () => {
    it('both prices met: an OrOptions in the printed order (plants, heat), marked as this card\'s effect choice; two branches, one price chip each, the SAME target step', () => {
      owned(t, 4, 6);
      const {dirigibles, mappers} = holders(t);
      expect(t.card.action(t.player), 'the declarative class DEFERS its question').is.undefined;
      runAllActions(t.game);
      const or = cast(t.player.popWaitingFor(), OrOptions);
      expect(or.options.map((o) => o.title)).deep.eq([REPROCESSING_PLANT_PLANTS_TITLE, REPROCESSING_PLANT_HEAT_TITLE]);
      expect(or.choiceContext?.source).deep.eq({kind: 'card', card: RP});
      expect(or.choiceContext?.mode).eq('effect-choice');
      const [a, b] = branches(t);
      expect([a.index, a.available, b.index, b.available]).deep.eq([0, true, 1, true]);
      expect(a.effects.find((e) => e.direction === 'cost')).deep.include({icon: Resource.PLANTS, amount: 3, current: 4, resulting: 1});
      expect(b.effects.find((e) => e.direction === 'cost')).deep.include({icon: Resource.HEAT, amount: 5, current: 6, resulting: 1});
      for (const branch of [a, b]) {
        const pick = branch.steps.find((s) => s.kind === 'input');
        expect(pick?.kind === 'input' && pick.input.type).eq('card');
        expect(pick?.kind === 'input' && pick.amount).eq(3);
        const names = pick?.kind === 'input' ? (pick.input as SelectCardModel).cards.map((c) => c.name) : [];
        expect(names, 'every holder, one set for both prices').to.have.members([dirigibles.name, mappers.name]);
      }
    });

    it('plants: 4 → 1, the target NEVER applied by itself (one pick), Dirigibles 1 → 4; the use spent once per generation', () => {
      owned(t, 4, 0);
      const {dirigibles} = holders(t);
      activate(t);
      // Only the plants variant is live (heat 0) — `autoSelect` runs it without a pick; the TARGET is still asked.
      target(t, dirigibles);
      expect(t.player.plants).eq(1);
      expect(dirigibles.resourceCount).eq(4);
      expect(t.player.actionsThisGeneration.has(RP)).is.true;
      expect(t.player.getPlayableActionCards().includes(t.card)).is.false;
    });

    it('a SINGLE holder is still asked (invariant 3): the pick stands with one candidate', () => {
      owned(t, 0, 5);
      const mappers = new AerialMappers();
      t.player.playedCards.push(mappers);
      activate(t);
      const prompt = cast(t.player.getWaitingFor(), SelectCard<ICard>);
      expect(prompt.cards.map((c) => c.name)).deep.eq([mappers.name]);
      target(t, mappers);
      expect([t.player.heat, mappers.resourceCount]).deep.eq([0, 3]);
    });

    it('heat: 6 → 1 after the variant pick; the journal names the floaters on their card', () => {
      owned(t, 4, 6);
      const {mappers} = holders(t);
      const at = t.game.gameLog.length;
      activate(t);
      variant(t, 1);
      target(t, mappers);
      expect([t.player.plants, t.player.heat, mappers.resourceCount]).deep.eq([4, 1, 3]);
      const lines = t.game.gameLog.slice(at).map((m) => formatMessage(m));
      expect(lines.some((l) => /3 floater/i.test(l) && l.includes(mappers.name)), lines.join('\n')).is.true;
    });

    const cases: Array<[plants: number, heat: number, verdict: [boolean, boolean]]> = [
      [2, 4, [false, false]], [3, 4, [true, false]], [2, 5, [false, true]], [3, 5, [true, true]],
    ];
    for (const [plants, heat, verdict] of cases) {
      it(`${plants} plants, ${heat} heat → variants ${JSON.stringify(verdict)}; the card acts iff one lives`, () => {
        owned(t, plants, heat);
        holders(t);
        expect(branches(t).map((b) => b.available)).deep.eq(verdict);
        expect(t.card.canAct(t.player)).eq(verdict.some((v) => v));
      });
    }
  });

  describe('rule 4 — «to ANY card»: the player\'s OWN holders, Stormcraft among them', () => {
    it('an opponent\'s floater card is never a target', () => {
      owned(t, 3, 0);
      const mine = new AerialMappers();
      t.player.playedCards.push(mine);
      t.opponent.playedCards.push(new Dirigibles());
      const pick = branches(t)[0].steps.find((s) => s.kind === 'input');
      const names = pick?.kind === 'input' ? (pick.input as SelectCardModel).cards.map((c) => c.name) : [];
      expect(names).deep.eq([mine.name]);
    });

    it('Stormcraft is a holder: the floaters may come back onto it', () => {
      owned(t, 3, 0);
      const corp = stormcraft(t, 0);
      activate(t);
      target(t, corp);
      expect(corp.resourceCount).eq(3);
    });
  });

  describe('rule 5 — heat under Stormcraft: the split is asked BEFORE the commit — the heat branch\'s first step', () => {
    it('the heat variant carries the Stormcraft split FIRST, then the target; the plants variant asks no split; no card-level preStep', () => {
      owned(t, 4, 1);
      holders(t);
      stormcraft(t, 4);
      const preview = actionPreview(t.player, t.card);
      expect(preview.preSteps ?? [], 'the split follows the variant pick — never a card-level step').has.length(0);
      const [a, b] = preview.branches;
      expect(b.available, '1 heat + 4 floaters × 2 cover the 5').is.true;
      expect(b.steps.map((s) => s.kind)).deep.eq(['spendHeat', 'input']);
      const split = b.steps[0];
      expect(split.kind === 'spendHeat' && split.input.spendHeatPrompt).deep.eq({amount: 5});
      expect(split.kind === 'spendHeat' && split.for, 'addressed to Stormcraft, the asker').deep.include({source: {kind: 'corporation', card: CardName.STORMCRAFT_INCORPORATED}});
      expect(a.steps.map((s) => s.kind)).deep.eq(['input']);
    });

    it('the live order is the preview\'s: variant → split → target', () => {
      owned(t, 4, 1);
      const {mappers} = holders(t);
      const corp = stormcraft(t, 4);
      activate(t);
      variant(t, 1);
      const split = cast(t.player.getWaitingFor(), AndOptions);
      expect(split.spendHeatPrompt).deep.eq({amount: 5});
      t.player.process({type: 'and', responses: [{type: 'amount', amount: 1}, {type: 'amount', amount: 2}]});
      runAllActions(t.game);
      target(t, mappers);
      expect([t.player.heat, corp.resourceCount, mappers.resourceCount]).deep.eq([0, 2, 3]);
    });

    it('the composed batch [activate, heat variant, split, target] — ADDRESSED as the composer sends it — replays WHOLE: nothing asked after the press', () => {
      owned(t, 4, 1);
      holders(t);
      const corp = stormcraft(t, 4);
      const heat = branches(t)[1];
      const [split, pick] = heat.steps;
      t.player.takeAction();
      const menu = cast(t.player.getWaitingFor(), OrOptions);
      const perform = menu.options.findIndex((o) => o.title === 'Perform an action from a played card');
      expect(perform).gte(0);
      const forOf = (s: typeof split) => (s.kind === 'input' || s.kind === 'spendHeat' ? s.for : undefined);
      const batch: Array<InputResponse> = [
        {type: 'or', index: perform, response: {type: 'card', cards: [RP]}},
        addressed({type: 'or', index: 1, response: {type: 'option'}} as InputResponse, heat.for),
        addressed({type: 'and', responses: [{type: 'amount', amount: 1}, {type: 'amount', amount: 2}]} as InputResponse, forOf(split)),
        // The floaters come back onto Stormcraft itself — the price left it first (4 → 2 → 5).
        addressed({type: 'card', cards: [CardName.STORMCRAFT_INCORPORATED]} as InputResponse, forOf(pick)),
      ];
      replayBatch(t.player, batch);
      runAllActions(t.game);
      const wf = t.player.getWaitingFor();
      expect(wf === undefined || wf instanceof OrOptions, 'the action is over').is.true;
      expect([t.player.heat, corp.resourceCount]).deep.eq([0, 5]);
    });

    it('without Stormcraft floaters the heat is taken straight: no split step, no split prompt', () => {
      owned(t, 0, 5);
      stormcraft(t, 0);
      holders(t);
      const heat = branches(t)[1];
      expect(heat.steps.map((s) => s.kind)).deep.eq(['input']);
    });
  });

  describe('rule 6 — the reason that closes BOTH variants leads', () => {
    it('no holder, too few plants and heat: «No card…» FIRST, then each variant\'s own shortfall in the printed order', () => {
      owned(t, 2, 4);
      const reasons = actionUnavailableReasons(t.player, t.card);
      expect(reasons[0]).deep.include({type: 'target', message: NO_HOLDER});
      expect(reasons.slice(1).map((r) => r.resource)).deep.eq([Resource.PLANTS, Resource.HEAT]);
    });

    it('no holder, both prices met: ONE reason — the holder', () => {
      owned(t, 3, 5);
      expect(actionUnavailableReasons(t.player, t.card).map((r) => r.message)).deep.eq([NO_HOLDER]);
      expect(branches(t).map((b) => b.unavailableReason)).deep.eq([NO_HOLDER, NO_HOLDER]);
    });

    it('a holder, both prices short: the two shortfalls, plants first; each refused variant carries its own', () => {
      owned(t, 1, 2);
      holders(t);
      expect(actionUnavailableReasons(t.player, t.card).map((r) => r.resource)).deep.eq([Resource.PLANTS, Resource.HEAT]);
      expect(branches(t).map((b) => b.unavailableReason)).deep.eq(['Not enough plants', 'Not enough heat']);
    });
  });

  describe('rules 7–10 — the table, futility, Celestic, MarsBot, save / load, purity', () => {
    it('the forecast reads the action through the server (no number of the card\'s): it builds for both branches', () => {
      owned(t, 4, 6);
      holders(t);
      const forecast = effectForecastForAction(t.player, t.card, actionPreview(t.player, t.card));
      expect(forecast).is.not.undefined;
    });

    it('never futile while a holder stands', () => {
      owned(t, 3, 5);
      holders(t);
      expect(actionFutility(t.player, t.card)).is.undefined;
    });

    it('the card PRINTS floaters: Celestic reveals it as a floater card', () => {
      expect(floaterCards.has(RP)).is.true;
    });

    it('the previews are pure: building them moves nothing', () => {
      owned(t, 4, 1);
      holders(t);
      stormcraft(t, 4);
      const before = JSON.stringify(t.game.serialize());
      actionPreview(t.player, t.card);
      actionUnavailableReasons(t.player, t.card);
      effectForecastForAction(t.player, t.card, actionPreview(t.player, t.card));
      expect(JSON.stringify(t.game.serialize())).eq(before);
    });

    it('the bot\'s building tag is nobody\'s play of this card: nothing moves, nothing is asked', () => {
      const [game, human] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true});
      game.phase = Phase.ACTION;
      const card = new ReprocessingPlant();
      human.playedCards.push(card);
      human.plants = 3;
      AutomaResolver.resolveTag(game, Tag.BUILDING);
      runAllActions(game);
      expect(human.plants).eq(3);
    });

    it('the spent action survives serialization', () => {
      owned(t, 3, 0);
      t.player.actionsThisGeneration.add(RP);
      const reloaded = Game.deserialize(structuredClone(t.game.serialize()));
      const again = reloaded.getPlayerById(t.player.id);
      expect((again.playedCards.get(RP) as IProjectCard | undefined)?.name).eq(RP);
      expect(again.actionsThisGeneration.has(RP)).is.true;
    });
  });
});
