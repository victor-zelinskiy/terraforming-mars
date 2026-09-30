import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {Game} from '../../src/server/Game';
import {Parliament} from '../../src/server/parliament/Parliament';
import {ChairmanSeat} from '../../src/server/parliament/quests/ChairmanSeat';
import {getParliamentModel} from '../../src/server/parliament/ParliamentModel';
import {Phase} from '../../src/common/Phase';
import {CardName} from '../../src/common/cards/CardName';
import {PARLIAMENT_AGENDA_STEPS} from '../../src/common/parliament/ParliamentTypes';

/*
 * THE ONE WALK OF THE AGENDA TRACK (TR04 Minority Representation): the three
 * engines of the track — the sitting's winner step, the chairman quest, a
 * card's «advance N steps» — are ONE function, `ChairmanSeat.walkAgenda`. It
 * takes the steps one at a time and pays each step's bonus before the next
 * one is taken, writes ONE record with every step, ONE journal event, and
 * cuts honestly at the end of the track. The quest and the phase are the walk
 * with `steps = 1` — their record is the old one plus `steps`.
 */
type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, parliament: Parliament};

function table(position: number): Table {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  const parliament = game.parliament!;
  parliament.agenda.set(p1.id, position);
  return {game, p1, p2, parliament};
}

const ADVANCE = '${0} advances on the Agenda track to step ${1}';
const TR_LINE = '${0} gained ${1} ${2} from the Agenda track';
const END_LINE = '${0} is already at the end of the Agenda track';
const WALK_LINES: ReadonlyArray<string> = [ADVANCE, TR_LINE, END_LINE];

/** The WALK's own journal lines, in order (the ruling Greens answer a TR with their own «+2 M€» line in between — not the walk's). */
function linesOf(game: IGame, from: number): Array<string> {
  return game.gameLog.slice(from).map((entry) => entry.message).filter((message) => WALK_LINES.includes(message));
}

describe('ChairmanSeat.walkAgenda — one walk for the three engines of the track', () => {
  describe('N = 1 — the quest and the phase, unchanged', () => {
    it('a quest step from 1 lands on 2 (a TR step): the old record plus its one-step `steps`, one event, the old journal lines', () => {
      const {game, p1, parliament} = table(1);
      const tr = p1.terraformRating;
      const at = game.gameLog.length;
      const walk = ChairmanSeat.walkAgenda(p1, parliament, 1, {reason: 'quest'});
      expect(walk).deep.eq({from: 1, to: 2, steps: [{to: 2, bonus: 'tr'}]});
      expect(parliament.agendaOf(p1)).eq(2);
      expect(p1.terraformRating).eq(tr + 1);
      expect(parliament.lastAdvance).deep.eq({
        seq: 1, player: p1.id, from: 1, to: 2, bonus: 'tr', steps: [{to: 2, bonus: 'tr'}], reason: 'quest', generation: game.generation,
      });
      expect(linesOf(game, at)).deep.eq([ADVANCE, TR_LINE]);
      const events = game.events.events.filter((e) => e.type === 'agenda-advanced');
      expect(events).has.lengthOf(1);
      expect(events[0].impact.agenda).deep.eq({from: 1, to: 2, steps: [{to: 2, bonus: 'tr'}], reason: 'quest'});
      expect(events[0].source, 'the quest is the PARLIAMENT\'s deed').deep.eq({kind: 'parliament'});
    });

    it('an influence step pays nothing on the spot — the level is read off the position', () => {
      const {game, p1, parliament} = table(0);
      const tr = p1.terraformRating;
      const hand = p1.cardsInHand.length;
      const walk = ChairmanSeat.walkAgenda(p1, parliament, 1, {reason: 'phase'});
      expect(walk).deep.eq({from: 0, to: 1, steps: [{to: 1}]});
      expect(parliament.influence(p1)).eq(1);
      expect(p1.terraformRating).eq(tr);
      expect(p1.cardsInHand.length).eq(hand);
      expect(parliament.lastAdvance).deep.include({from: 0, to: 1, bonus: undefined, reason: 'phase'});
      expect(parliament.lastAdvance?.steps).deep.eq([{to: 1}]);
      expect(game.events.events.filter((e) => e.type === 'agenda-advanced')[0].source).deep.eq({kind: 'parliament'});
    });

    it('a card step draws for a human', () => {
      const {p1, parliament} = table(6);
      const hand = p1.cardsInHand.length;
      expect(ChairmanSeat.walkAgenda(p1, parliament, 1, {reason: 'quest'})).deep.eq({from: 6, to: 7, steps: [{to: 7, bonus: 'card'}]});
      expect(p1.cardsInHand.length).eq(hand + 1);
    });
  });

  describe('N = 2 — a card\'s walk (TR04)', () => {
    it('from 1: two steps in order — the TR of step 2 is paid BEFORE step 3 is taken; one record (seq + 1 once), one event', () => {
      const {game, p1, parliament} = table(1);
      // A record already stands: the walk bumps its serial ONCE.
      parliament.lastAdvance = {seq: 4, player: p1.id, from: 0, to: 1, steps: [{to: 1}], reason: 'phase', generation: 1};
      const tr = p1.terraformRating;
      const at = game.gameLog.length;
      const walk = ChairmanSeat.walkAgenda(p1, parliament, 2, {reason: 'card', card: CardName.MINORITY_REPRESENTATION});
      expect(walk).deep.eq({from: 1, to: 3, steps: [{to: 2, bonus: 'tr'}, {to: 3}]});
      expect(parliament.agendaOf(p1)).eq(3);
      expect(parliament.influence(p1), 'step 3 raises the level to 2').eq(2);
      expect(p1.terraformRating).eq(tr + 1);
      expect(parliament.lastAdvance).deep.eq({
        seq: 5, player: p1.id, from: 1, to: 3, bonus: undefined, steps: [{to: 2, bonus: 'tr'}, {to: 3}],
        reason: 'card', card: CardName.MINORITY_REPRESENTATION, generation: game.generation,
      });
      expect(linesOf(game, at), 'step 2 · its TR · step 3 — the bonus before the next step').deep.eq([ADVANCE, TR_LINE, ADVANCE]);
      const events = game.events.events.filter((e) => e.type === 'agenda-advanced');
      expect(events).has.lengthOf(1);
      expect(events[0].impact.agenda).deep.eq({from: 1, to: 3, steps: [{to: 2, bonus: 'tr'}, {to: 3}], reason: 'card'});
      expect(events[0].source, 'a card\'s walk is NOT wrapped in the parliament\'s source — it keeps the live scope (the card\'s play)').not.deep.eq({kind: 'parliament'});
    });

    it('from 0 the first step SEATS the marker (step 1), the second pays the TR of step 2', () => {
      const {game, p1, parliament} = table(0);
      const tr = p1.terraformRating;
      const at = game.gameLog.length;
      const walk = ChairmanSeat.walkAgenda(p1, parliament, 2, {reason: 'card', card: CardName.MINORITY_REPRESENTATION});
      expect(walk).deep.eq({from: 0, to: 2, steps: [{to: 1}, {to: 2, bonus: 'tr'}]});
      expect(parliament.influence(p1)).eq(1);
      expect(p1.terraformRating).eq(tr + 1);
      expect(linesOf(game, at)).deep.eq([ADVANCE, ADVANCE, TR_LINE]);
    });

    it('from 5: a TR step, then a CARD step — both paid, in order', () => {
      const {p1, parliament} = table(5);
      const tr = p1.terraformRating;
      const hand = p1.cardsInHand.length;
      const walk = ChairmanSeat.walkAgenda(p1, parliament, 2, {reason: 'card', card: CardName.MINORITY_REPRESENTATION});
      expect(walk).deep.eq({from: 5, to: 7, steps: [{to: 6, bonus: 'tr'}, {to: 7, bonus: 'card'}]});
      expect(p1.terraformRating).eq(tr + 1);
      expect(p1.cardsInHand.length).eq(hand + 1);
    });

    it('the ruling party sees the TR of a walked step like any TR of the action phase (the Greens\' +2 M€)', () => {
      const {p1, parliament} = table(1);
      const mc = p1.megaCredits;
      ChairmanSeat.walkAgenda(p1, parliament, 2, {reason: 'card', card: CardName.MINORITY_REPRESENTATION});
      expect(p1.megaCredits, 'the Greens pay 2 M€ per TR raised').eq(mc + 2);
    });
  });

  describe('the end of the track cuts the walk honestly', () => {
    it('from 11 a walk of 2 takes ONE step and logs «already at the end» once', () => {
      const {game, p1, parliament} = table(PARLIAMENT_AGENDA_STEPS - 1);
      const at = game.gameLog.length;
      const walk = ChairmanSeat.walkAgenda(p1, parliament, 2, {reason: 'card', card: CardName.MINORITY_REPRESENTATION});
      expect(walk).deep.eq({from: 11, to: 12, steps: [{to: 12}]});
      expect(parliament.agendaOf(p1)).eq(12);
      expect(parliament.influence(p1)).eq(5);
      expect(linesOf(game, at)).deep.eq([ADVANCE, END_LINE]);
      expect(parliament.lastAdvance?.steps).deep.eq([{to: 12}]);
    });

    it('from 12 nothing moves: no record, no event, the line once', () => {
      const {game, p1, parliament} = table(PARLIAMENT_AGENDA_STEPS);
      const at = game.gameLog.length;
      expect(ChairmanSeat.walkAgenda(p1, parliament, 2, {reason: 'card', card: CardName.MINORITY_REPRESENTATION})).is.undefined;
      expect(parliament.lastAdvance).is.undefined;
      expect(game.events.events.filter((e) => e.type === 'agenda-advanced')).deep.eq([]);
      expect(linesOf(game, at)).deep.eq([END_LINE]);
    });
  });

  describe('the record on the wire and on disk', () => {
    it('the client model carries the steps and the card', () => {
      const {game, p1, parliament} = table(1);
      ChairmanSeat.walkAgenda(p1, parliament, 2, {reason: 'card', card: CardName.MINORITY_REPRESENTATION});
      const model = getParliamentModel(game, p1)!;
      expect(model.lastAdvance).deep.eq({
        seq: 1, player: p1.color, from: 1, to: 3, bonus: undefined, steps: [{to: 2, bonus: 'tr'}, {to: 3}],
        reason: 'card', card: CardName.MINORITY_REPRESENTATION, generation: game.generation,
      });
    });

    it('a walk survives a save and a load whole', () => {
      const {game, p1, parliament} = table(1);
      ChairmanSeat.walkAgenda(p1, parliament, 2, {reason: 'card', card: CardName.MINORITY_REPRESENTATION});
      const restored = Game.deserialize(structuredClone(game.serialize())).parliament!;
      expect(restored.lastAdvance).deep.include({from: 1, to: 3, reason: 'card', card: CardName.MINORITY_REPRESENTATION});
      expect(restored.lastAdvance?.steps).deep.eq([{to: 2, bonus: 'tr'}, {to: 3}]);
    });

    it('a save from before TR04 (one step, no `steps`) loads as a walk of that one step', () => {
      const {game, p1, parliament} = table(1);
      ChairmanSeat.walkAgenda(p1, parliament, 1, {reason: 'quest'});
      const legacy = structuredClone(game.serialize());
      delete legacy.parliament!.lastAdvance!.steps;
      const restored = Game.deserialize(legacy).parliament!;
      expect(restored.lastAdvance?.steps).deep.eq([{to: 2, bonus: 'tr'}]);
      const influenceOnly = structuredClone(game.serialize());
      influenceOnly.parliament!.lastAdvance = {seq: 1, player: p1.id, from: 0, to: 1, reason: 'phase', generation: 1};
      expect(Game.deserialize(influenceOnly).parliament!.lastAdvance?.steps, 'no bonus → a bare step').deep.eq([{to: 1}]);
    });
  });
});
