import {expect} from 'chai';
import {
  STRATEGIC_SHIFT_CARDS_PER_CARD, STRATEGIC_SHIFT_COUNT_LABEL, STRATEGIC_SHIFT_DISCARD_TITLE, STRATEGIC_SHIFT_MEGACREDITS_PER_CARD,
  STRATEGIC_SHIFT_NO_CANDIDATE_NOTE, STRATEGIC_SHIFT_NO_CANDIDATE_REASON, STRATEGIC_SHIFT_NO_REQUIREMENT_REASON, StrategicShift,
} from '../../../src/server/cards/turmoilRedux/StrategicShift';
import {SponsoredPowerPlant} from '../../../src/server/cards/turmoilRedux/SponsoredPowerPlant';
import {Lichen} from '../../../src/server/cards/base/Lichen';
import {Birds} from '../../../src/server/cards/base/Birds';
import {FusionPower} from '../../../src/server/cards/base/FusionPower';
import {Research} from '../../../src/server/cards/base/Research';
import {Tardigrades} from '../../../src/server/cards/base/Tardigrades';
import {AcquiredCompany} from '../../../src/server/cards/base/AcquiredCompany';
import {IProjectCard} from '../../../src/server/cards/IProjectCard';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {promptAddressOf} from '../../../src/common/inputs/preselectAddress';
import {SelectCardModel} from '../../../src/common/models/PlayerInputModel';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Phase} from '../../../src/common/Phase';
import {Payment} from '../../../src/common/inputs/Payment';
import {CardRenderItemType} from '../../../src/common/cards/render/CardRenderItemType';
import {AltSecondaryTag} from '../../../src/common/cards/render/AltSecondaryTag';
import {ICardRenderItem, ItemType, isICardRenderItem} from '../../../src/common/cards/render/Types';
import {cast} from '../../../src/common/utils/utils';
import {runAllActions} from '../../TestingUtils';

/**
 * TR65 — STRATEGIC SHIFT: «discard any number of cards WITH A REQUIREMENT, then +1 M€ and +1 card each». Every rule
 * reading of the card file's header is pinned here; the preview's promise is held to the play's result.
 */
type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, card: StrategicShift};

/** The four requirement KINDS the hand can hold (a parameter · tags · a party · another parameter) and three cards without one. */
function withRequirement(): Array<IProjectCard> {
  return [new Lichen(), new FusionPower(), new SponsoredPowerPlant(), new Birds()];
}
function withoutRequirement(): Array<IProjectCard> {
  return [new Research(), new Tardigrades(), new AcquiredCompany()];
}

function table(hand: ReadonlyArray<IProjectCard>): Table {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  const card = new StrategicShift();
  p1.cardsInHand.push(card, ...hand);
  p1.megaCredits = 20;
  // The deck holds its own copies of the hand's names — a draw must never hand one back by coincidence.
  const inHand = new Set(hand.map((c) => c.name));
  game.projectDeck.drawPile.splice(0, game.projectDeck.drawPile.length, ...game.projectDeck.drawPile.filter((c) => !inHand.has(c.name)));
  return {game, p1, p2, card};
}

/** Play the card and pop the ONE question it asks (or none). */
function playAndAsk(t: Table): SelectCard<IProjectCard> | undefined {
  t.p1.playCard(t.card, Payment.of({megacredits: 2}));
  runAllActions(t.game);
  const input = t.p1.popWaitingFor();
  return input === undefined ? undefined : cast(input, SelectCard<IProjectCard>);
}

const names = (cards: ReadonlyArray<{name: CardName}>) => cards.map((c) => c.name);
const skips = (game: IGame) => game.events.events.filter((e) => e.type === 'effect-skipped').map((e) => e.impact.skipped);

describe('StrategicShift', () => {
  describe('the card as printed', () => {
    it('is an EVENT for 2 with no tags, no VP, no requirement, TR65 — and prints −X [a card with a requirement] +X [M€] +X [a card]', () => {
      const card = new StrategicShift();
      expect(card.type).eq(CardType.EVENT);
      expect(card.cost).eq(2);
      expect(card.tags).deep.eq([]);
      expect(card.victoryPoints).is.undefined;
      expect(card.requirements).deep.eq([]);
      expect(card.metadata.cardNumber).eq('TR65');
      expect(STRATEGIC_SHIFT_MEGACREDITS_PER_CARD).eq(1);
      expect(STRATEGIC_SHIFT_CARDS_PER_CARD).eq(1);
      const rows = (card.metadata.renderData as unknown as {rows: Array<Array<ItemType>>}).rows;
      expect(rows).has.lengthOf(1);
      const items = rows[0].filter((node: ItemType) => isICardRenderItem(node)) as Array<ICardRenderItem>;
      // The «−» and «+» are symbols between the three UNITS; each unit prints its X (the M€ square inside).
      expect(items.map((item) => [item.type, item.secondaryTag, item.innerText])).deep.eq([
        [CardRenderItemType.CARDS, AltSecondaryTag.REQ, 'X'],
        [CardRenderItemType.MEGACREDITS, undefined, 'X'],
        [CardRenderItemType.CARDS, undefined, 'X'],
      ]);
    });
  });

  describe('rule 2 — the candidates are the hand\'s cards WITH A REQUIREMENT, never the card itself', () => {
    it('every requirement kind counts; a card without one is offered DISABLED with its reason; min 0, max = the candidates, select all', () => {
      const t = table([...withRequirement(), ...withoutRequirement()]);
      const ask = playAndAsk(t);
      expect(ask, 'one question').is.not.undefined;
      expect(names(ask!.cards)).deep.eq([CardName.LICHEN, CardName.FUSION_POWER, CardName.SPONSORED_POWER_PLANT, CardName.BIRDS]);
      expect(ask!.config.min).eq(0);
      expect(ask!.config.max).eq(4);
      expect(ask!.config.showSelectAll).is.true;
      expect(ask!.title).eq(STRATEGIC_SHIFT_DISCARD_TITLE);
      // The rest of the hand is SHOWN — refused by name, never silently absent.
      expect(ask!.config.disabled?.map((d) => [d.card.name, d.reason])).deep.eq([
        [CardName.RESEARCH, STRATEGIC_SHIFT_NO_REQUIREMENT_REASON],
        [CardName.TARDIGRADES, STRATEGIC_SHIFT_NO_REQUIREMENT_REASON],
        [CardName.ACQUIRED_COMPANY, STRATEGIC_SHIFT_NO_REQUIREMENT_REASON],
      ]);
      const model = ask!.toModel(t.p1) as SelectCardModel;
      expect(model.disabledCards?.map((c) => [c.name, c.disabledReason])).deep.eq([
        [CardName.RESEARCH, STRATEGIC_SHIFT_NO_REQUIREMENT_REASON],
        [CardName.TARDIGRADES, STRATEGIC_SHIFT_NO_REQUIREMENT_REASON],
        [CardName.ACQUIRED_COMPANY, STRATEGIC_SHIFT_NO_REQUIREMENT_REASON],
      ]);
      // The DISCARD marker — the console's one discard skin, what it buys per card.
      expect(model.discardPrompt).deep.eq({
        min: 0, max: 4,
        source: {kind: 'card', card: CardName.STRATEGIC_SHIFT},
        exchange: {icon: 'megacredits', amount: 1, perCard: true, draw: 1},
        colonyBonus: undefined, colonyRepeat: undefined,
      });
      // The card itself has already left the hand — it is nowhere in the question.
      expect(names(ask!.cards)).not.include(CardName.STRATEGIC_SHIFT);
      expect(model.disabledCards?.map((c) => c.name)).not.include(CardName.STRATEGIC_SHIFT);
    });

    it('a card without a requirement is never ACCEPTED', () => {
      const t = table([...withRequirement(), ...withoutRequirement()]);
      const ask = playAndAsk(t)!;
      expect(() => ask.process({type: 'card', cards: [CardName.RESEARCH]})).throws(/not found/i);
    });
  });

  describe('rules 3–4 — the discard pays off in its own answer: +1 M€ and +1 card per card thrown', () => {
    it('three thrown → −3 cards, +3 M€, +3 cards; the journal names the gain', () => {
      const t = table([...withRequirement(), ...withoutRequirement()]);
      const ask = playAndAsk(t)!;
      const mc = t.p1.megaCredits;
      const deck = t.game.projectDeck.drawPile.length;
      ask.process({type: 'card', cards: [CardName.LICHEN, CardName.BIRDS, CardName.SPONSORED_POWER_PLANT]});
      runAllActions(t.game);
      expect(t.p1.megaCredits).eq(mc + 3);
      expect(names(t.p1.cardsInHand)).not.include.members([CardName.LICHEN, CardName.BIRDS, CardName.SPONSORED_POWER_PLANT]);
      expect(names(t.p1.cardsInHand)).include.members([CardName.FUSION_POWER, CardName.RESEARCH, CardName.TARDIGRADES, CardName.ACQUIRED_COMPANY]);
      expect(t.p1.cardsInHand, '7 − 3 + 3').has.lengthOf(7);
      expect(t.game.projectDeck.drawPile).has.lengthOf(deck - 3);
      expect(t.game.projectDeck.discardPile.map((c) => c.name)).include.members([CardName.LICHEN, CardName.BIRDS, CardName.SPONSORED_POWER_PLANT]);
      expect(t.p1.popWaitingFor(), 'nothing asked twice').is.undefined;
      expect(skips(t.game)).deep.eq([]);
    });

    it('zero thrown is a legal answer (min 0 — never an auto-discard): nothing moves, nothing is paid', () => {
      const t = table([...withRequirement()]);
      const ask = playAndAsk(t)!;
      const mc = t.p1.megaCredits;
      const log = t.game.gameLog.length;
      ask.process({type: 'card', cards: []});
      runAllActions(t.game);
      expect(t.p1.megaCredits).eq(mc);
      expect(t.p1.cardsInHand).has.lengthOf(4);
      expect(t.game.gameLog.slice(log).map((m) => m.message)).not.include('Only ${0} of ${1} card(s) were left in the deck for ${2}');
    });

    it('a candidate set of ONE still asks (one card is a decision, not an auto-discard)', () => {
      const t = table([new Lichen(), new Research()]);
      const ask = playAndAsk(t);
      expect(ask).is.not.undefined;
      expect(names(ask!.cards)).deep.eq([CardName.LICHEN]);
      expect(ask!.config.min).eq(0);
      expect(ask!.config.max).eq(1);
    });

    it('the pool can never be short BY CONSTRUCTION: every card thrown is a card drawable again — an empty deck still draws N', () => {
      const t = table([...withRequirement()]);
      const ask = playAndAsk(t)!;
      t.game.projectDeck.drawPile.splice(0);
      t.game.projectDeck.discardPile.splice(0);
      ask.process({type: 'card', cards: [CardName.LICHEN, CardName.BIRDS]});
      runAllActions(t.game);
      expect(t.p1.cardsInHand, '4 − 2 + 2 (the thrown pair, reshuffled)').has.lengthOf(4);
      expect(t.p1.megaCredits).eq(20 - 2 + 2);
    });
  });

  describe('rules 3 / 9 — no candidate at all: the play goes on, the loss is NAMED, before and after the press', () => {
    it('plays (the event lands), asks nothing, records the skip by name', () => {
      const t = table([...withoutRequirement()]);
      expect(t.p1.canPlay(t.card)).is.true;
      const ask = playAndAsk(t);
      expect(ask).is.undefined;
      expect(names(t.p1.playedCards.asArray())).include(CardName.STRATEGIC_SHIFT);
      expect(t.p1.cardsInHand).has.lengthOf(3);
      expect(t.p1.megaCredits).eq(18);
      expect(skips(t.game)).deep.eq([{label: 'Discard cards from hand', reason: STRATEGIC_SHIFT_NO_CANDIDATE_REASON}]);
    });

    it('the preview says so BEFORE the press — a named warning, no step, no effect chip', () => {
      const t = table([...withoutRequirement()]);
      const preview = cardPlayPreview(t.p1, t.card);
      expect(preview.branches).has.lengthOf(1);
      expect(preview.branches[0].effects).deep.eq([]);
      expect(preview.branches[0].steps).has.lengthOf(1);
      expect(preview.branches[0].steps[0]).deep.include({kind: 'note', noteKind: 'warning', text: STRATEGIC_SHIFT_NO_CANDIDATE_NOTE});
      expect((preview.branches[0].steps[0] as {skipped?: {label: string}}).skipped?.label).eq('Discard cards from hand');
    });
  });

  describe('rules 5–6 — preview = execution: ONE addressed discard step over the same candidates, nothing counted', () => {
    it('the step: the candidates, min 0 / max N / select all, self + the no-requirement cards disabled with reasons, both payouts, the marker, the address', () => {
      const t = table([...withRequirement(), ...withoutRequirement()]);
      const preview = cardPlayPreview(t.p1, t.card);
      expect(preview.branches[0].effects, 'no counted chip — the number is the player\'s').deep.eq([]);
      const steps = preview.branches[0].steps;
      expect(steps).has.lengthOf(1);
      const step = steps[0];
      expect(step.kind).eq('input');
      if (step.kind !== 'input') {
        return;
      }
      const input = step.input as SelectCardModel;
      expect(input.type).eq('card');
      expect(input.title).eq(STRATEGIC_SHIFT_DISCARD_TITLE);
      expect(input.buttonLabel).eq('Discard');
      expect(input.cards.map((c) => c.name)).deep.eq([CardName.LICHEN, CardName.FUSION_POWER, CardName.SPONSORED_POWER_PLANT, CardName.BIRDS]);
      expect(input.min).eq(0);
      expect(input.max).eq(4);
      expect(input.showSelectAll).is.true;
      expect(input.disabledCards?.map((c) => [c.name, c.disabledReason])).deep.eq([
        [CardName.STRATEGIC_SHIFT, 'This card is being played'],
        [CardName.RESEARCH, STRATEGIC_SHIFT_NO_REQUIREMENT_REASON],
        [CardName.TARDIGRADES, STRATEGIC_SHIFT_NO_REQUIREMENT_REASON],
        [CardName.ACQUIRED_COMPANY, STRATEGIC_SHIFT_NO_REQUIREMENT_REASON],
      ]);
      expect(step.multiSelect).deep.eq({countLabel: STRATEGIC_SHIFT_COUNT_LABEL, revealGain: {resource: 'megacredits', amount: 1}, drawPerCard: 1});
      expect(input.discardPrompt).deep.eq({
        min: 0, max: 4,
        source: {kind: 'card', card: CardName.STRATEGIC_SHIFT},
        exchange: {icon: 'megacredits', amount: 1, perCard: true, draw: 1},
      });
      expect(step.for).deep.eq({role: 'discard', source: {kind: 'card', card: CardName.STRATEGIC_SHIFT}});
    });

    it('the preview\'s address IS the live prompt\'s — the answer lands only on this card\'s own discard', () => {
      const t = table([...withRequirement(), ...withoutRequirement()]);
      const preview = cardPlayPreview(t.p1, t.card);
      const step = preview.branches[0].steps[0];
      const ask = playAndAsk(t)!;
      expect(promptAddressOf(ask)).deep.eq(step.kind === 'input' ? step.for : undefined);
      expect(promptAddressOf(ask)).deep.eq({role: 'discard', source: {kind: 'card', card: CardName.STRATEGIC_SHIFT}});
    });

    it('the preview mutates nothing', () => {
      const t = table([...withRequirement(), ...withoutRequirement()]);
      const before = JSON.stringify(t.game.serialize());
      cardPlayPreview(t.p1, t.card);
      cardPlayPreview(t.p1, t.card);
      expect(JSON.stringify(t.game.serialize()), 'purity').eq(before);
    });
  });

  describe('rule 10 — save / load', () => {
    it('an ordinary event on the table; the thrown cards in the discard pile; the hand restored', () => {
      const t = table([...withRequirement()]);
      const ask = playAndAsk(t)!;
      ask.process({type: 'card', cards: [CardName.LICHEN]});
      runAllActions(t.game);
      const copy = Game.deserialize(JSON.parse(JSON.stringify(t.game.serialize())));
      const p1 = copy.getPlayerById(t.p1.id);
      expect(names(p1.playedCards.asArray())).include(CardName.STRATEGIC_SHIFT);
      expect(p1.cardsInHand, '4 − 1 + 1').has.lengthOf(4);
      expect(names(p1.cardsInHand)).not.include(CardName.LICHEN);
      expect(copy.projectDeck.discardPile.map((c) => c.name)).include(CardName.LICHEN);
      expect(p1.megaCredits).eq(19);
    });
  });
});
