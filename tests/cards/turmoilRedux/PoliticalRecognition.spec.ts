import {expect} from 'chai';
import {
  POLITICAL_RECOGNITION_REQUIRED, POLITICAL_RECOGNITION_STEPS, PoliticalRecognition,
} from '../../../src/server/cards/turmoilRedux/PoliticalRecognition';
import {CardsWithRequirementsRequirement, playedCardsWithRequirements} from '../../../src/server/cards/requirements/CardsWithRequirementsRequirement';
import {requirementType} from '../../../src/common/cards/CardRequirementDescriptor';
import {Algae} from '../../../src/server/cards/base/Algae';
import {KelpFarming} from '../../../src/server/cards/base/KelpFarming';
import {Lichen} from '../../../src/server/cards/base/Lichen';
import {ArcticAlgae} from '../../../src/server/cards/base/ArcticAlgae';
import {SearchForLife} from '../../../src/server/cards/base/SearchForLife';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {AGENDA_TRACK_ICON} from '../../../src/server/cards/actionPreviews';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Tag} from '../../../src/common/cards/Tag';
import {RequirementType} from '../../../src/common/cards/RequirementType';
import {Phase} from '../../../src/common/Phase';
import {CardRenderItemType} from '../../../src/common/cards/render/CardRenderItemType';
import {ICardRenderItem, ItemType, isICardRenderItem} from '../../../src/common/cards/render/Types';
import {AgendaWalkModel} from '../../../src/common/models/ActionPreviewModel';
import {Payment} from '../../../src/common/inputs/Payment';
import {fakeCard, runAllActions} from '../../TestingUtils';
import {Tactician} from '../../../src/server/milestones/Tactician';
import {Forecaster} from '../../../src/server/awards/Forecaster';
import {Scientist} from '../../../src/server/awards/Scientist';
import {IProjectCard} from '../../../src/server/cards/IProjectCard';

/**
 * TR68 — POLITICAL RECOGNITION: the set's first card on the requirement kind
 * «cards with requirements PLAYED» and the fourth card on the ONE walk of the
 * Agenda track (`ChairmanSeat.walkAgenda`, three steps). Every rule reading of
 * the card file's header is pinned here; the preview's promise is held to the
 * play's result.
 */
type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, parliament: Parliament, card: PoliticalRecognition};

/** A played card that prints a requirement (`event` — an EVENT, the pile of the same tableau). */
function withRequirement(event = false): IProjectCard {
  return fakeCard({requirements: [{oceans: 3, count: 3}], type: event ? CardType.EVENT : CardType.AUTOMATED});
}

function table(position: number, played = POLITICAL_RECOGNITION_REQUIRED, opts: {events?: number} = {}): Table {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  const parliament = game.parliament!;
  parliament.agenda.set(p1.id, position);
  const events = opts.events ?? 0;
  for (let i = 0; i < played; i++) {
    p1.playedCards.push(withRequirement(i < events));
  }
  const card = new PoliticalRecognition();
  p1.cardsInHand.push(card);
  p1.megaCredits = 30;
  return {game, p1, p2, parliament, card};
}

const ADVANCE = '${0} advances on the Agenda track to step ${1}';
const END_LINE = '${0} is already at the end of the Agenda track';

function walkOf(t: Table): AgendaWalkModel {
  const step = cardPlayPreview(t.p1, t.card).branches[0].steps.find((s) => s.kind === 'agendaWalk');
  expect(step, 'the walk is a step of the preview').is.not.undefined;
  return (step as {kind: 'agendaWalk', walk: AgendaWalkModel}).walk;
}

function play(t: Table): void {
  t.p1.playCard(t.card, Payment.of({megacredits: 8}));
  runAllActions(t.game);
}

describe('PoliticalRecognition', () => {
  describe('the card as printed', () => {
    it('is a green AUTOMATED for 8 with the WILD tag, no VP, «5 other cards with requirements», TR68 — and prints three Agenda-step units', () => {
      const card = new PoliticalRecognition();
      expect(card.type).eq(CardType.AUTOMATED);
      expect(card.cost).eq(8);
      expect(card.tags).deep.eq([Tag.WILD]);
      expect(card.victoryPoints).is.undefined;
      expect(card.requirements).deep.eq([{cardsWithRequirements: 5, count: 5}]);
      expect(requirementType(card.requirements[0])).eq(RequirementType.CARDS_WITH_REQUIREMENTS);
      expect(card.metadata.cardNumber).eq('TR68');
      expect(POLITICAL_RECOGNITION_STEPS).eq(3);
      const rows = (card.metadata.renderData as unknown as {rows: Array<Array<ItemType>>}).rows;
      expect(rows).has.lengthOf(1);
      const items = rows[0].filter((node: ItemType) => isICardRenderItem(node)) as Array<ICardRenderItem>;
      expect(items.map((item) => [item.type, item.amount])).deep.eq([[CardRenderItemType.AGENDA_STEP, 3]]);
    });
  });

  describe('rule 1 — PLAYED cards with requirements, events included, this card excluded', () => {
    it('4 → not playable, the count reason with its honest «now»; 5 → playable', () => {
      const short = table(1, 4);
      expect(short.p1.canPlay(short.card)).is.false;
      expect(unplayableReasons(short.p1, short.card)[0]).deep.include({
        type: 'count', message: 'Requires ${0} played cards with requirements', params: ['5'], current: 4, requirement: true,
      });
      const exact = table(1, 5);
      expect(exact.p1.canPlay(exact.card), 'exactly 5 meets it').is.true;
      expect(unplayableReasons(exact.p1, exact.card)).deep.eq([]);
    });

    it('EVENTS count («played», never «in play») — Tactician does not count them, the card does', () => {
      const t = table(1, 5, {events: 2});
      expect(playedCardsWithRequirements(t.p1)).eq(5);
      expect(t.p1.canPlay(t.card)).is.true;
      expect(new Tactician().getScore(t.p1), 'the milestone keeps its own «in play» semantics').eq(3);
    });

    it('a card WITHOUT a requirement, a prelude, a corporation count for nothing', () => {
      const t = table(1, 4);
      t.p1.playedCards.push(fakeCard({type: CardType.AUTOMATED}));
      t.p1.playedCards.push(fakeCard({type: CardType.PRELUDE}));
      expect(playedCardsWithRequirements(t.p1)).eq(4);
      expect(t.p1.canPlay(t.card)).is.false;
    });

    it('«other» — the card never counts itself: on the table it is excluded by name from its own count', () => {
      const t = table(1, 5);
      play(t);
      expect(playedCardsWithRequirements(t.p1), 'six cards with requirements lie on the table').eq(6);
      expect(playedCardsWithRequirements(t.p1, CardName.POLITICAL_RECOGNITION), 'the card asking is never its own «other»').eq(5);
      expect(new CardsWithRequirementsRequirement({count: 5}).getScore(t.p1, t.card)).eq(5);
    });
  });

  describe('rule 3 — three consecutive steps, each bonus on its own landing, in the steps\' order', () => {
    it('from 6: the CARD step lands in the middle (7), then influence 4 (8), then the TR (9); one record, the cost paid', () => {
      const t = table(6);
      const hand = t.p1.cardsInHand.length;
      const tr = t.p1.terraformRating;
      const at = t.game.gameLog.length;
      play(t);
      expect(t.parliament.agendaOf(t.p1)).eq(9);
      expect(t.parliament.influence(t.p1)).eq(4);
      expect(t.p1.terraformRating).eq(tr + 1);
      expect(t.p1.cardsInHand.length, 'the hand lost the played card and gained the card step\'s card').eq(hand - 1 + 1);
      expect(t.parliament.lastAdvance).deep.include({
        player: t.p1.id, from: 6, to: 9, reason: 'card', card: CardName.POLITICAL_RECOGNITION, generation: t.game.generation,
      });
      expect(t.parliament.lastAdvance?.steps).deep.eq([{to: 7, bonus: 'card'}, {to: 8}, {to: 9, bonus: 'tr'}]);
      expect(t.parliament.lastAdvance?.seq, 'the serial moved ONCE for the whole walk').eq(1);
      expect(t.game.gameLog.slice(at).filter((e) => e.message === ADVANCE)).has.lengthOf(3);
      expect([...t.p1.tableau].map((c) => c.name)).includes(CardName.POLITICAL_RECOGNITION);
    });

    it('from 0: the first step SEATS the marker (influence 1), then the TR, then influence 2', () => {
      const t = table(0);
      play(t);
      expect(t.parliament.agendaOf(t.p1)).eq(3);
      expect(t.parliament.influence(t.p1)).eq(2);
      expect(t.parliament.lastAdvance?.steps).deep.eq([{to: 1}, {to: 2, bonus: 'tr'}, {to: 3}]);
    });

    it('ONE agenda-advanced event sourced by the CARD', () => {
      const t = table(1);
      play(t);
      const advanced = t.game.events.events.filter((e) => e.type === 'agenda-advanced');
      expect(advanced).has.lengthOf(1);
      expect(advanced[0].impact.agenda).deep.eq({from: 1, to: 4, steps: [{to: 2, bonus: 'tr'}, {to: 3}, {to: 4, bonus: 'tr'}], reason: 'card', influence: 2});
      expect(advanced[0].source).deep.include({kind: 'card', card: CardName.POLITICAL_RECOGNITION});
    });
  });

  describe('rule 4 — the end of the track cuts honestly, the card is played either way', () => {
    it('from 10: two steps; from 11: one; from 12: none, ONE «already at the end» line, the cost paid, the card on the table', () => {
      const ten = table(10);
      play(ten);
      expect(ten.parliament.agendaOf(ten.p1)).eq(12);
      expect(ten.parliament.lastAdvance?.steps).deep.eq([{to: 11, bonus: 'tr'}, {to: 12}]);

      const eleven = table(11);
      play(eleven);
      expect(eleven.parliament.lastAdvance?.steps).deep.eq([{to: 12}]);

      const end = table(12);
      const mc = end.p1.megaCredits;
      const at = end.game.gameLog.length;
      play(end);
      expect(end.parliament.agendaOf(end.p1)).eq(12);
      expect(end.parliament.lastAdvance, 'no walk, no record').is.undefined;
      expect(end.game.gameLog.slice(at).filter((e) => e.message === END_LINE)).has.lengthOf(1);
      expect(end.p1.megaCredits).eq(mc - 8);
      expect([...end.p1.tableau].map((c) => c.name)).includes(CardName.POLITICAL_RECOGNITION);
      expect(end.game.events.events.filter((e) => e.type === 'agenda-advanced')).deep.eq([]);
    });

    it('the preview NAMES the cut before the press: «2 of 3 · end of the track» from 10, «0 of 3» at 12', () => {
      const ten = table(10);
      expect(walkOf(ten)).deep.include({from: 10, to: 12, printed: 3, walked: 2});
      expect(cardPlayPreview(ten.p1, ten.card).branches[0].effects[0]).deep.include({icon: AGENDA_TRACK_ICON, amount: 2, current: 10, resulting: 12, note: 'end of the track'});
      const end = table(12);
      expect(walkOf(end)).deep.include({from: 12, to: 12, printed: 3, walked: 0, steps: []});
    });
  });

  describe('rule 5 — the preview, held to the play', () => {
    it('from 1: the track chip 1 → 4, then the bonuses; the walk is the play\'s result; the preview mutates nothing', () => {
      const t = table(1);
      const before = JSON.stringify(t.game.serialize());
      const branch = cardPlayPreview(t.p1, t.card).branches[0];
      expect(branch.effects[0]).deep.include({direction: 'gain', icon: AGENDA_TRACK_ICON, amount: 3, current: 1, resulting: 4});
      expect(branch.effects[0].note, 'no cut — no note').is.undefined;
      expect(branch.effects.map((e) => e.icon)).deep.eq([AGENDA_TRACK_ICON, 'tr', 'influence']);
      const walk = walkOf(t);
      expect(walk).deep.eq({
        from: 1, to: 4, printed: 3, walked: 3,
        steps: [{to: 2, kind: 'tr'}, {to: 3, kind: 'influence', level: 2}, {to: 4, kind: 'tr'}],
        influence: {current: 1, resulting: 2},
      });
      expect(t.card.agendaWalkForecast(t.p1), 'the hand\'s plate reads the same walk').deep.eq(walk);
      expect(JSON.stringify(t.game.serialize()), 'purity').eq(before);
      play(t);
      expect(t.parliament.agendaOf(t.p1)).eq(walk.to);
      expect(t.parliament.influence(t.p1)).eq(walk.influence.resulting);
      expect(t.parliament.lastAdvance?.steps?.map((s) => s.to)).deep.eq(walk.steps.map((s) => s.to));
    });
  });

  describe('rule 6 — the WILD tag', () => {
    it('counts as any tag when playing a card (a «2 science» requirement met with one science) and never for an award', () => {
      const t = table(1);
      play(t);
      t.p1.playedCards.push(fakeCard({tags: [Tag.SCIENCE]}));
      expect(t.p1.tags.count(Tag.SCIENCE), 'printed science + the wild tag').eq(2);
      const needsTwoScience = fakeCard({requirements: [{tag: Tag.SCIENCE, count: 2}]});
      expect(needsTwoScience.canPlay(t.p1)).is.true;
      expect(new Scientist().getScore(t.p1), 'the award sees the printed tag only').eq(1);
    });
  });

  describe('rule 7 — once played, the card is itself a card with a requirement', () => {
    it('Tactician and Forecaster count it, and so does another player\'s count', () => {
      const t = table(1, 5);
      const tactician = new Tactician().getScore(t.p1);
      const forecaster = new Forecaster().getScore(t.p1);
      play(t);
      expect(new Tactician().getScore(t.p1)).eq(tactician + 1);
      expect(new Forecaster().getScore(t.p1)).eq(forecaster + 1);
      expect(playedCardsWithRequirements(t.p1, CardName.ARCHAEBACTERIA), 'another card\'s «other» sees it').eq(6);
    });
  });

  describe('rule 8 — save / load adds nothing', () => {
    it('the walk\'s record and the card survive a reload as they were', () => {
      // Real cards on the table (a fake card has no factory to come back from).
      const t = table(1, 0);
      t.p1.playedCards.push(new Algae(), new KelpFarming(), new Lichen(), new ArcticAlgae(), new SearchForLife());
      play(t);
      const loaded = Game.deserialize(structuredClone(t.game.serialize()));
      const p1 = loaded.getPlayerById(t.p1.id);
      expect(loaded.parliament?.agendaOf(p1)).eq(4);
      expect([...p1.tableau].map((c) => c.name)).includes(CardName.POLITICAL_RECOGNITION);
      expect(playedCardsWithRequirements(p1, CardName.POLITICAL_RECOGNITION)).eq(5);
    });
  });

  describe('outside the Mars Parliament', () => {
    it('a play without a parliament walks nothing and does not throw', () => {
      const [game, p1] = testGame(2);
      expect(game.parliament).is.undefined;
      const card = new PoliticalRecognition();
      expect(() => card.play(p1)).to.not.throw();
      expect(game.events.events.filter((e) => e.type === 'agenda-advanced')).deep.eq([]);
    });
  });
});
