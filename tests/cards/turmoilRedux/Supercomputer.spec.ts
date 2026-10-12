import {expect} from 'chai';
import {SUPERCOMPUTER_DATA_PER_ACTION, Supercomputer} from '../../../src/server/cards/turmoilRedux/Supercomputer';
import {MartianFiber} from '../../../src/server/cards/turmoilRedux/MartianFiber';
import {MartianCensus} from '../../../src/server/cards/turmoilRedux/MartianCensus';
import {ResearchStartups} from '../../../src/server/cards/turmoilRedux/ResearchStartups';
import {BiologicalSimulations} from '../../../src/server/cards/turmoilRedux/BiologicalSimulations';
import {VectorComputations} from '../../../src/server/cards/turmoilRedux/VectorComputations';
import {CouncilSeat} from '../../../src/server/cards/turmoilRedux/CouncilSeat';
import {Aurorai} from '../../../src/server/cards/pathfinders/Aurorai';
import {AquiferStandardProject} from '../../../src/server/cards/base/standardProjects/AquiferStandardProject';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {testAutomaGame} from '../../automa/AutomaTestGame';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {CardResource} from '../../../src/common/CardResource';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {Resource} from '../../../src/common/Resource';
import {DATA_VALUE, SUPERCOMPUTER_DATA_VALUE} from '../../../src/common/constants';
import {DEFAULT_PAYMENT_VALUES, Payment} from '../../../src/common/inputs/Payment';
import {CARD_FOR_SPENDABLE_RESOURCE, SPENDABLE_CARD_RESOURCES} from '../../../src/common/inputs/Spendable';
import {CardRenderItemType} from '../../../src/common/cards/render/CardRenderItemType';
import {InputResponse} from '../../../src/common/inputs/InputResponse';
import {SelectCardModel} from '../../../src/common/models/PlayerInputModel';
import {ALL_MODULE_MANIFESTS} from '../../../src/server/cards/AllManifests';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {actionPreview} from '../../../src/server/models/actionPreview';
import {effectForecastForPlay} from '../../../src/server/models/effectForecast';
import {PARTY_REQUIREMENT_REASON, unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {requiredPartyOf} from '../../../src/server/cards/requirements/partyRequirementCards';
import {SelectPaymentDeferred} from '../../../src/server/deferredActions/SelectPaymentDeferred';
import {SelectProjectCardToPlay} from '../../../src/server/inputs/SelectProjectCardToPlay';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {replayBatch} from '../../../src/server/inputs/deferredInputBatch';
import {ICard} from '../../../src/server/cards/ICard';
import {IProjectCard} from '../../../src/server/cards/IProjectCard';
import {cast} from '../../../src/common/utils/utils';
import {quietResolutionOf, seatEnacted, seatResolution} from '../../parliament/parliamentArrange';
import {fakeCard, formatMessage, runAllActions} from '../../TestingUtils';

/**
 * TR48 — SUPERCOMPUTER: the Scientists' plate, −1 energy production, an action
 * putting 2 data on ANY card, and the set's THIRD card-bound payment unit
 * (`supercomputerData` — the data here pay 2 M€ for a Science card). Every rule
 * reading of the card file's header is pinned here; the unit's client tables
 * are guarded in `paymentPlan.spec` (completeness, order) and the tag gate's
 * two copies in `tests/console/paymentTagGateParity.spec.ts`.
 */
const S = PartyName.SCIENTISTS;
const COST = 10;
const SC = CardName.SUPERCOMPUTER;

type Table = {game: IGame, player: TestPlayer, opponent: TestPlayer, parliament: Parliament, card: Supercomputer};

/** A two-seat Redux table in the action phase, the Scientists RULING, the card in hand with 1 energy production. */
function table(): Table {
  const [game, player, opponent] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  const parliament = game.parliament!;
  seatEnacted(parliament, quietResolutionOf(S));
  const card = new Supercomputer();
  player.cardsInHand.push(card);
  player.production.override({energy: 1});
  player.megaCredits = 20;
  return {game, player, opponent, parliament, card};
}

/** The card on the player's table with `data` on it. */
function onTable(t: Table, data: number): void {
  t.player.cardsInHand = [];
  t.player.playedCards.push(t.card);
  t.card.resourceCount = data;
}

function holder<T extends ICard>(player: TestPlayer, card: T, count: number): T {
  card.resourceCount = count;
  player.playedCards.push(card);
  return card;
}

const tagged = (name: string, cost: number, tags: Array<Tag>) => fakeCard({name: name as CardName, cost, tags});
const scienceCard = (cost: number) => tagged(`Science ${cost}`, cost, [Tag.SCIENCE]);
const plainCard = (cost: number) => tagged(`Plain ${cost}`, cost, []);

/** Activate through the REAL blue-action door; the action's own target pick is returned. */
function activate(t: Table): SelectCard<ICard> {
  const door = cast(t.player.playActionCard(), SelectCard);
  expect(door.cards.map((c) => c.name), 'the card stands among the playable actions').to.include(SC);
  door.cb([t.card]);
  runAllActions(t.game);
  return cast(t.player.getWaitingFor(), SelectCard<ICard>);
}

describe('Supercomputer', () => {
  let t: Table;

  beforeEach(() => {
    t = table();
  });

  describe('the card as printed', () => {
    it('is a blue card for 10, Science, a data holder, the SCIENTISTS\' plate, no VP, TR48 — in the Redux manifest without compatibility', () => {
      const card = t.card;
      expect(card.name).eq(SC);
      expect(card.type).eq(CardType.ACTIVE);
      expect(card.cost).eq(COST);
      expect(card.tags, 'the corner holds one atom').deep.eq([Tag.SCIENCE]);
      expect(card.resourceType).eq(CardResource.DATA);
      expect(card.victoryPoints, 'no VP badge').is.undefined;
      expect(requiredPartyOf(card), 'the MIN plate holds the Scientists\' flask — a requirement, not a tag').eq(S);
      expect(card.requirements).has.length(1);
      expect(card.metadata.cardNumber).eq('TR48');
      expect(card.metadata.description).eq('Requires the Scientists to be ruling or that you have 2 delegates there. Decrease your energy production 1 step.');
      expect(card.behavior).deep.eq({production: {energy: -1}});
      expect(card.actionBehavior).deep.eq({addResourcesToAnyCard: {type: CardResource.DATA, count: SUPERCOMPUTER_DATA_PER_ACTION}});
      expect(SUPERCOMPUTER_DATA_PER_ACTION).eq(2);
      // A payment unit, not a trigger: no card-played hook, no forecast twin.
      const hooks = card as unknown as {onCardPlayed?: unknown, cardPlayedForecast?: unknown};
      expect(hooks.onCardPlayed).is.undefined;
      expect(hooks.cardPlayedForecast).is.undefined;
      const manifest = ALL_MODULE_MANIFESTS.find((m) => m.module === 'turmoilRedux')!;
      const entry = (manifest.projectCards as Record<string, {compatibility?: unknown}>)[SC];
      expect(entry, 'registered in the Redux manifest').is.not.undefined;
      expect(entry.compatibility, 'only the module\'s icon at the bottom left').is.undefined;
    });

    it('the face reads the scan: → [data] [data]*; [Science] : [data] = [2]; − [energy] on the production plate', () => {
      type Node = {is?: string, type?: string, amount?: number, tag?: string, rows?: Array<Array<Node | string>>};
      const rows = (t.card.metadata.renderData as unknown as {rows: Array<Array<Node>>}).rows;
      expect(rows).has.length(3);
      const [action, effect, production] = [rows[0][0], rows[1][0], rows[2][0]];
      const parts = (box: Node, i: number) => (box.rows?.[i] ?? []).filter((n): n is Node => typeof n === 'object');
      expect(action.is).eq('effect');
      expect(parts(action, 0).map((n) => [n.is, n.type]), 'an arrow with nothing to pay on its left').deep.eq([['symbol', ' ']]);
      expect(parts(action, 2).map((n) => [n.type, n.amount])).deep.eq([[CardRenderItemType.RESOURCE, 2], ['*', undefined]]);
      expect(action.rows?.[2]).deep.include('Action: Add 2 data resources to ANY card.');
      expect(effect.is).eq('effect');
      expect(parts(effect, 0).map((n) => [n.type, n.tag])).deep.eq([[CardRenderItemType.TAG, Tag.SCIENCE]]);
      // `.equals().megacredits(2)` is load-bearing: the explainability layer reads `valueAsPayment` off it.
      expect(parts(effect, 2).map((n) => [n.type, n.amount])).deep.eq([
        [CardRenderItemType.RESOURCE, -1], ['=', undefined], [CardRenderItemType.MEGACREDITS, SUPERCOMPUTER_DATA_VALUE],
      ]);
      expect(production.is).eq('production-box');
      expect(parts(production, 0).map((n) => [n.type, n.amount])).deep.eq([['-', undefined], [CardRenderItemType.ENERGY, 1]]);
    });
  });

  describe('rule 1 — the requirement: the Scientists rule, or 2 of your delegates on their resolution', () => {
    beforeEach(() => {
      seatEnacted(t.parliament, quietResolutionOf(PartyName.REDS));
      expect(t.parliament.rulingParty()).eq(PartyName.REDS);
    });

    function scientistsCubes(n: number): void {
      let slot = t.parliament.slotOf(S);
      if (slot === undefined) {
        seatResolution(t.parliament, 0, quietResolutionOf(S));
        slot = t.parliament.slotOf(S)!;
      }
      for (let i = 0; i < n; i++) {
        t.parliament.placeVote(t.player, slot, t.parliament.lobby.has(t.player.id) ? 'lobby' : 'reserve');
      }
    }

    it('neither road: «0 of 2» with the NAMED party reason; one cube: still no; two: playable', () => {
      expect(t.player.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.player, t.card)[0]).deep.include({type: 'party', message: PARTY_REQUIREMENT_REASON, params: [S, '2'], party: S, current: 0});
      scientistsCubes(1);
      expect(t.player.canPlay(t.card)).is.false;
      scientistsCubes(1);
      expect(t.player.canPlay(t.card)).is.true;
    });

    it('the Scientists ruling: playable with no delegate anywhere', () => {
      seatEnacted(t.parliament, quietResolutionOf(S));
      expect(t.player.canPlay(t.card)).is.true;
    });

    it('TR36 Council Seat lowers the EFFECT\'s threshold, never a REQUIREMENT\'s', () => {
      t.player.playedCards.push(new CouncilSeat());
      scientistsCubes(1);
      expect(t.player.canPlay(t.card)).is.false;
    });
  });

  describe('rule 2 — the play: −1 energy production', () => {
    it('−1 energy production; the preview is declarative «1 → 0» on the production', () => {
      const chip = cardPlayPreview(t.player, t.card).branches[0].effects.find((e) => e.icon === Resource.ENERGY);
      expect(chip).deep.include({direction: 'cost', amount: 1, current: 1, resulting: 0, note: 'production'});
      t.player.playCard(t.card, Payment.of({megacredits: COST}));
      runAllActions(t.game);
      expect(t.player.production.energy).eq(0);
      expect(t.player.playedCards.get(SC)).eq(t.card);
    });

    it('NO energy production: unplayable, and the hand names it («Cannot reduce production»)', () => {
      t.player.production.override({energy: 0});
      expect(t.player.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.player, t.card)).deep.include({type: 'production', message: 'Cannot reduce production'});
    });

    it('the Science tag wakes TR05 Vector Computations (+2 data on itself) — forecast and live agree', () => {
      const vector = holder(t.player, new VectorComputations(), 0);
      const facts = effectForecastForPlay(t.player, t.card, cardPlayPreview(t.player, t.card)).facts;
      const data = facts.filter((f) => f.source.name === CardName.VECTOR_COMPUTATIONS)
        .flatMap((f) => f.effects).filter((e) => e.icon === 'data').reduce((s, e) => s + e.amount, 0);
      expect(data).eq(2);
      t.player.playCard(t.card, Payment.of({megacredits: COST}));
      runAllActions(t.game);
      expect(vector.resourceCount).eq(data);
    });
  });

  describe('rule 3 — the action: +2 data on ANY of your data holders, this card included, never chosen for you', () => {
    it('ONE holder (this card): still a pick of one — never automatic; the data land here', () => {
      onTable(t, 0);
      expect(t.card.canAct(t.player)).is.true;
      const pick = activate(t);
      expect(pick.cards.map((c) => c.name)).deep.eq([SC]);
      t.player.process({type: 'card', cards: [SC]});
      runAllActions(t.game);
      expect(t.card.resourceCount).eq(2);
    });

    it('several holders: every OWN data holder is a candidate, a rival\'s never; +2 on the chosen one', () => {
      onTable(t, 1);
      const census = holder(t.player, new MartianCensus(), 1);
      const startups = holder(t.player, new ResearchStartups(), 2);
      const sims = holder(t.player, new BiologicalSimulations(), 0);
      holder(t.opponent, new ResearchStartups(), 3);
      const pick = activate(t);
      expect(pick.cards.map((c) => c.name)).to.have.members([SC, census.name, startups.name, sims.name]);
      expect(pick.cards).has.length(4);
      t.player.process({type: 'card', cards: [census.name]});
      runAllActions(t.game);
      expect(census.resourceCount, '1 → 3: a delegate is now affordable').eq(3);
      expect(t.card.resourceCount).eq(1);
      expect([startups.resourceCount, sims.resourceCount]).deep.eq([2, 0]);
    });

    it('once per generation: used, the card leaves the playable actions', () => {
      onTable(t, 0);
      const pick = activate(t);
      t.player.process({type: 'card', cards: [pick.cards[0].name]});
      runAllActions(t.game);
      expect(t.player.getPlayableActionCards().map((c) => c.name)).not.to.include(SC);
    });

    it('the preview\'s target step IS the live picker: the same candidates, 2 per pick, the data icon', () => {
      onTable(t, 0);
      const census = holder(t.player, new MartianCensus(), 1);
      const branch = actionPreview(t.player, t.card).branches[0];
      const step = branch.steps.find((s) => s.kind === 'input');
      if (step === undefined || step.kind !== 'input') {
        throw new Error('the target is an input step');
      }
      expect(step.amount).eq(2);
      expect(step.cardResource).eq('data');
      expect(step.for, 'the pre-collected answer is ADDRESSED').is.not.undefined;
      const model = step.input as SelectCardModel;
      const live = activate(t);
      expect(model.cards.map((c) => c.name)).deep.eq(live.cards.map((c) => c.name));
      expect(model.cards.map((c) => c.name)).to.have.members([SC, census.name]);
    });

    it('the composed batch [activate, target] replays WHOLE with its address — nothing asked twice', () => {
      onTable(t, 0);
      const census = holder(t.player, new MartianCensus(), 1);
      const step = actionPreview(t.player, t.card).branches[0].steps.find((s) => s.kind === 'input');
      if (step === undefined || step.kind !== 'input') {
        throw new Error('the target is an input step');
      }
      t.player.takeAction();
      const menu = cast(t.player.getWaitingFor(), OrOptions);
      const perform = menu.options.findIndex((o) => o.title === 'Perform an action from a played card');
      expect(perform).gte(0);
      const batch: Array<InputResponse> = [
        {type: 'or', index: perform, response: {type: 'card', cards: [SC]}},
        {type: 'card', cards: [census.name], ...(step.for === undefined ? {} : {for: step.for})} as InputResponse,
      ];
      replayBatch(t.player, batch);
      runAllActions(t.game);
      expect(census.resourceCount).eq(3);
      const wf = t.player.getWaitingFor();
      expect(wf === undefined || wf instanceof OrOptions, 'the action is over — the target was not asked again').is.true;
    });
  });

  describe('rule 4 — the effect: the data HERE pay 2 M€ for a card with a PRINTED Science tag', () => {
    beforeEach(() => {
      onTable(t, 4);
    });

    it('the unit: one entry, this card, a flat 2 (Aurorai\'s data stay their own unit at 3)', () => {
      expect(SPENDABLE_CARD_RESOURCES).to.include('supercomputerData');
      expect(CARD_FOR_SPENDABLE_RESOURCE.supercomputerData).eq(SC);
      expect(DEFAULT_PAYMENT_VALUES.supercomputerData).eq(SUPERCOMPUTER_DATA_VALUE);
      expect(SUPERCOMPUTER_DATA_VALUE).eq(2);
      expect(DEFAULT_PAYMENT_VALUES.auroraiData).eq(DATA_VALUE);
      expect(t.player.getSpendable('supercomputerData')).eq(4);
    });

    it('the gate: a Science card opens the lane; no tag, a wild tag, a standard project and a deferred bill do not', () => {
      expect(t.player.paymentOptionsForCard(scienceCard(8)).supercomputerData).is.true;
      expect(t.player.paymentOptionsForCard(tagged('Science+Building', 8, [Tag.SCIENCE, Tag.BUILDING])).supercomputerData).is.true;
      expect(t.player.paymentOptionsForCard(plainCard(8)).supercomputerData).is.false;
      expect(t.player.paymentOptionsForCard(tagged('Wild', 8, [Tag.WILD])).supercomputerData, 'a wild tag is no Science card').is.false;
      expect(t.player.paymentOptionsForCard(new AquiferStandardProject()).supercomputerData).is.false;
      t.player.megaCredits = 3;
      t.player.steel = 1;
      const model = new SelectPaymentDeferred(t.player, 6, {canUseSteel: true}).previewPaymentModel();
      expect(model?.paymentOptions.supercomputerData, 'a bill is no card play').is.false;
      expect(model?.supercomputerData).eq(4);
    });

    it('a Science card for 8 at 0 M€ and 4 data here: playable; pay() takes the 4 data off THIS card', () => {
      t.player.megaCredits = 0;
      const science = scienceCard(8);
      t.player.cardsInHand.push(science);
      expect(t.player.canPlay(science)).is.true;
      expect(new SelectProjectCardToPlay(t.player, [science]).toModel(t.player).supercomputerData).eq(4);
      t.player.checkPaymentAndPlayCard(science, Payment.of({supercomputerData: 4}));
      runAllActions(t.game);
      expect(t.card.resourceCount).eq(0);
      expect(t.player.playedCards.get(science.name)).is.not.undefined;
    });

    it('a card with no Science tag is short of M€ whatever data stand here', () => {
      t.player.megaCredits = 0;
      const plain = plainCard(8);
      t.player.cardsInHand.push(plain);
      expect(t.player.canPlay(plain)).is.false;
      expect(() => t.player.checkPaymentAndPlayCard(plain, Payment.of({supercomputerData: 4}))).to.throw(/Did not spend enough/);
    });

    it('data on ANOTHER card are no money: Research Startups\' 5 data pay nothing', () => {
      t.card.resourceCount = 0;
      holder(t.player, new ResearchStartups(), 5);
      t.player.megaCredits = 0;
      const science = scienceCard(4);
      t.player.cardsInHand.push(science);
      expect(t.player.getSpendable('supercomputerData')).eq(0);
      expect(t.player.canPlay(science)).is.false;
    });

    it('rule 5 — overpay is the upstream semantic: 2 data for a 3 M€ card are legal, both leave', () => {
      t.player.megaCredits = 0;
      const science = scienceCard(3);
      t.player.cardsInHand.push(science);
      t.player.checkPaymentAndPlayCard(science, Payment.of({supercomputerData: 2}));
      runAllActions(t.game);
      expect(t.card.resourceCount).eq(2);
    });

    it('Science + Building: steel and data are two independent lanes on one play', () => {
      t.player.megaCredits = 0;
      t.player.steel = 2;
      const both = tagged('Science+Building', 8, [Tag.SCIENCE, Tag.BUILDING]);
      t.player.cardsInHand.push(both);
      t.player.checkPaymentAndPlayCard(both, Payment.of({steel: 2, supercomputerData: 2}));
      runAllActions(t.game);
      expect([t.player.steel, t.card.resourceCount]).deep.eq([0, 2]);
    });

    it('rule 6 — pay() records «spent as payment» under THIS card: 3 data, 6 M€ saved', () => {
      t.player.pay(Payment.of({supercomputerData: 3}));
      expect(t.card.resourceCount).eq(1);
      const record = t.game.events.events.find((e) => e.impact.cardResourcesSpentAsPayment !== undefined);
      expect(record?.source).deep.eq({kind: 'card', card: SC, owner: t.player.color});
      expect(record?.impact.cardResourcesSpentAsPayment).deep.eq([{cardResource: CardResource.DATA, amount: 3}]);
      expect(record?.impact.megacreditsSaved).eq(6);
    });

    it('Aurorai is untouched: its data still pay a standard project at 3, never a Science card', () => {
      const aurorai = new Aurorai();
      aurorai.resourceCount = 2;
      t.player.playedCards.push(aurorai);
      expect(t.player.getSpendable('auroraiData')).eq(2);
      expect(t.player.paymentOptionsForCard(scienceCard(8)).auroraiData).is.false;
      expect(t.player.paymentOptionsForCard(new AquiferStandardProject()).auroraiData).is.true;
      expect(t.player.payingAmount(Payment.of({auroraiData: 2}), {auroraiData: true})).eq(6);
    });
  });

  describe('rules 6 · 8 — the journal and the table\'s answer to the action', () => {
    it('Martian Fiber pays +2 M€ for the 2 data, whatever the target (this card included); the log names the target', () => {
      onTable(t, 0);
      holder(t.player, new MartianFiber(), 0);
      const census = holder(t.player, new MartianCensus(), 0);
      for (const target of [SC, census.name]) {
        t.player.actionsThisGeneration.delete(SC);
        const before = t.player.megaCredits;
        activate(t);
        t.player.process({type: 'card', cards: [target]});
        runAllActions(t.game);
        expect(t.player.megaCredits - before, `the Fiber answers the data on ${target}`).eq(2);
      }
      const lines = t.game.gameLog.map((m) => formatMessage(m));
      expect(lines.some((l) => /added 2 data to Supercomputer/i.test(l)), lines.slice(-8).join('\n')).is.true;
      expect(lines.some((l) => /added 2 data to Martian Census/i.test(l)), lines.slice(-8).join('\n')).is.true;
    });
  });

  describe('rule 9 — MarsBot and save / load', () => {
    it('MarsBot\'s table holds no unit: its data on any card are no money', () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true});
      game.phase = Phase.ACTION;
      const card = new Supercomputer();
      card.resourceCount = 3;
      human.playedCards.push(card);
      expect(human.getSpendable('supercomputerData')).eq(3);
      expect(bot.isMarsBot).is.true;
      expect(bot.getSpendable('supercomputerData')).eq(0);
    });

    it('the data and the action\'s flag survive a reload as ordinary fields, and are spendable again', () => {
      onTable(t, 3);
      t.player.actionsThisGeneration.add(SC);
      const reloaded = Game.deserialize(structuredClone(t.game.serialize()));
      const owner = reloaded.getPlayerById(t.player.id);
      const again = owner.playedCards.get(SC) as IProjectCard | undefined;
      expect(again?.resourceCount).eq(3);
      expect(owner.actionsThisGeneration.has(SC)).is.true;
      expect(owner.getSpendable('supercomputerData')).eq(3);
      expect(owner.payingAmount(Payment.of({supercomputerData: 3}), owner.paymentOptionsForCard(scienceCard(6)))).eq(6);
    });
  });
});
