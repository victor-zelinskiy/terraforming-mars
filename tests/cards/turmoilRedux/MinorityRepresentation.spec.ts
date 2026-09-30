import {expect} from 'chai';
import {MINORITY_REPRESENTATION_STEPS, MinorityRepresentation} from '../../../src/server/cards/turmoilRedux/MinorityRepresentation';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {AGENDA_TRACK_ICON, INFLUENCE_ICON} from '../../../src/server/cards/actionPreviews';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Phase} from '../../../src/common/Phase';
import {CardRenderItemType} from '../../../src/common/cards/render/CardRenderItemType';
import {ICardRenderItem, ItemType, isICardRenderItem} from '../../../src/common/cards/render/Types';
import {AgendaWalkModel} from '../../../src/common/models/ActionPreviewModel';
import {Payment} from '../../../src/common/inputs/Payment';
import {questGateOf} from '../../parliament/parliamentArrange';
import {runAllActions} from '../../TestingUtils';
import {buildEventChildren} from '../../../src/client/components/journal/journalEventChild';
import {recomputeRootImpact} from '../../../src/client/components/notifications/notificationModel';

/**
 * TR04 — MINORITY REPRESENTATION: the third engine of the Agenda track and the
 * first card to walk the marker MORE than one step — one call of the ONE walk
 * (`ChairmanSeat.walkAgenda`, pinned by tests/parliament/AgendaWalk.spec.ts).
 * Every rule reading of the card file's header is pinned here, and the
 * preview's promise is held to the play's result.
 */
type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, parliament: Parliament, card: MinorityRepresentation};

function table(position: number): Table {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  const parliament = game.parliament!;
  parliament.agenda.set(p1.id, position);
  const card = new MinorityRepresentation();
  p1.cardsInHand.push(card);
  p1.megaCredits = 20;
  return {game, p1, p2, parliament, card};
}

const ADVANCE = '${0} advances on the Agenda track to step ${1}';
const TR_LINE = '${0} gained ${1} ${2} from the Agenda track';
const END_LINE = '${0} is already at the end of the Agenda track';
const WALK_LINES: ReadonlyArray<string> = [ADVANCE, TR_LINE, END_LINE];

function walkLines(game: IGame, from: number): Array<string> {
  return game.gameLog.slice(from).map((entry) => entry.message).filter((message) => WALK_LINES.includes(message));
}

function walkOf(t: Table): AgendaWalkModel {
  const preview = cardPlayPreview(t.p1, t.card);
  const step = preview.branches[0].steps.find((s) => s.kind === 'agendaWalk');
  expect(step, 'the walk is a step of the preview').is.not.undefined;
  return (step as {kind: 'agendaWalk', walk: AgendaWalkModel}).walk;
}

describe('MinorityRepresentation', () => {
  describe('the card as printed', () => {
    it('is an EVENT for 6 with no tags, no VP, «max 1 influence», TR04 — and prints two Agenda-step units', () => {
      const card = new MinorityRepresentation();
      expect(card.type).eq(CardType.EVENT);
      expect(card.cost).eq(6);
      expect(card.tags).deep.eq([]);
      expect(card.victoryPoints).is.undefined;
      expect(card.requirements).deep.eq([{influence: 1, max: true, count: 1}]);
      expect(card.metadata.cardNumber).eq('TR04');
      expect(MINORITY_REPRESENTATION_STEPS).eq(2);
      const rows = (card.metadata.renderData as unknown as {rows: Array<Array<ItemType>>}).rows;
      expect(rows).has.lengthOf(1);
      const items = rows[0].filter((node: ItemType) => isICardRenderItem(node)) as Array<ICardRenderItem>;
      expect(items.map((item) => [item.type, item.amount])).deep.eq([[CardRenderItemType.AGENDA_STEP, 2]]);
    });
  });

  describe('rule 1 — the requirement is the WHOLE influence, never the position', () => {
    it('opens on positions 0, 1 and 2 (level ≤ 1) and closes from 3 (level 2) with the count reason', () => {
      for (const position of [0, 1, 2]) {
        const {p1, card} = table(position);
        expect(p1.canPlay(card), `position ${position}`).is.true;
        expect(unplayableReasons(p1, card)).deep.eq([]);
      }
      const {p1, card} = table(3);
      expect(p1.canPlay(card)).is.false;
      expect(unplayableReasons(p1, card)[0]).deep.include({type: 'count', message: 'Requires influence ${0} or less', params: ['1'], current: 2, requirement: true});
    });

    it('an influence bonus closes it too: position 1 with +1 is influence 2', () => {
      const {p1, parliament, card} = table(1);
      parliament.addInfluenceBonus(p1, 1, 'a test card');
      expect(p1.canPlay(card)).is.false;
      expect(unplayableReasons(p1, card)[0]).deep.include({current: 2});
    });

    it('the end of the track is unreachable under the requirement (position 11 is influence 4)', () => {
      const {p1, parliament, card} = table(11);
      expect(parliament.influence(p1)).eq(4);
      expect(p1.canPlay(card)).is.false;
    });
  });

  describe('rule 2 — two consecutive steps, each with its own bonus, in the steps\' order', () => {
    it('from 1: step 2 pays its TR before step 3 sets influence 2; one record with both steps; the cost is paid; the ruling Greens answer the TR', () => {
      const {game, p1, parliament, card} = table(1);
      const tr = p1.terraformRating;
      const at = game.gameLog.length;
      p1.playCard(card, Payment.of({megacredits: 6}));
      runAllActions(game);
      expect(parliament.agendaOf(p1)).eq(3);
      expect(parliament.influence(p1)).eq(2);
      expect(p1.terraformRating).eq(tr + 1);
      expect(p1.megaCredits, '20 − 6 for the card + 2 from the Greens for the TR').eq(16);
      expect([...p1.tableau].map((c) => c.name)).includes(CardName.MINORITY_REPRESENTATION);
      expect(parliament.lastAdvance).deep.include({
        player: p1.id, from: 1, to: 3, reason: 'card', card: CardName.MINORITY_REPRESENTATION, generation: game.generation,
      });
      expect(parliament.lastAdvance?.steps).deep.eq([{to: 2, bonus: 'tr'}, {to: 3}]);
      expect(parliament.lastAdvance?.seq, 'the serial moved ONCE for the whole walk').eq(1);
      expect(walkLines(game, at)).deep.eq([ADVANCE, TR_LINE, ADVANCE]);
    });

    it('from 0: the first step seats the marker (influence 1), the second pays the TR', () => {
      const {game, p1, parliament, card} = table(0);
      const tr = p1.terraformRating;
      const at = game.gameLog.length;
      p1.playCard(card, Payment.of({megacredits: 6}));
      runAllActions(game);
      expect(parliament.agendaOf(p1)).eq(2);
      expect(parliament.influence(p1)).eq(1);
      expect(p1.terraformRating).eq(tr + 1);
      expect(parliament.lastAdvance?.steps).deep.eq([{to: 1}, {to: 2, bonus: 'tr'}]);
      expect(walkLines(game, at)).deep.eq([ADVANCE, ADVANCE, TR_LINE]);
    });

    it('from 2: influence 2 on step 3, then the TR of step 4', () => {
      const {game, p1, parliament, card} = table(2);
      p1.playCard(card, Payment.of({megacredits: 6}));
      runAllActions(game);
      expect(parliament.agendaOf(p1)).eq(4);
      expect(parliament.influence(p1)).eq(2);
      expect(parliament.lastAdvance?.steps).deep.eq([{to: 3}, {to: 4, bonus: 'tr'}]);
    });
  });

  describe('the journal and the events — the card is the source', () => {
    it('ONE agenda-advanced event, sourced by the CARD (never the parliament), and the TR delta under the card too', () => {
      const {game, p1, card} = table(1);
      p1.playCard(card, Payment.of({megacredits: 6}));
      runAllActions(game);
      const advanced = game.events.events.filter((e) => e.type === 'agenda-advanced');
      expect(advanced).has.lengthOf(1);
      expect(advanced[0].impact.agenda).deep.eq({from: 1, to: 3, steps: [{to: 2, bonus: 'tr'}, {to: 3}], reason: 'card'});
      expect(advanced[0].source).deep.include({kind: 'card', card: CardName.MINORITY_REPRESENTATION});
      const trChanged = game.events.events.filter((e) => e.type === 'tr-changed' && e.player === p1.color);
      expect(trChanged).has.lengthOf(1);
      expect(trChanged[0].source, 'the TR of a walked step is the card\'s deed').deep.include({kind: 'card', card: CardName.MINORITY_REPRESENTATION});
      expect(trChanged[0].correlationId, 'one chain: the play').eq(advanced[0].correlationId);
    });

    it('the journal draws the walk as a row of the CARD — the steps chip «+2» with the position and the level it set — beside the TR row; the payment reads last', () => {
      const {game, p1, card} = table(1);
      p1.playCard(card, Payment.of({megacredits: 6}));
      runAllActions(game);
      const root = game.events.events.find((e) => e.type === 'action' && e.source?.kind === 'card' && e.source.card === CardName.MINORITY_REPRESENTATION)!.id;
      const chain = game.events.events.filter((e) => e.correlationId === root);
      const rows = buildEventChildren(chain, root, p1.color);
      const own = rows.filter((row) => row.source.kind === 'card' && row.source.card === CardName.MINORITY_REPRESENTATION);
      const walk = own.find((row) => row.political?.kind === 'agenda');
      expect(walk, 'the walk is a row of its own').is.not.undefined;
      expect(walk!.chips).deep.eq([{icon: 'agenda', text: '+2'}]);
      expect(walk!.political).deep.eq({kind: 'agenda', from: 1, to: 3, level: 2});
      expect(own.some((row) => row.chips.some((chip) => chip.icon === 'tr' && chip.text === '+1')), 'the TR of the walked step is its own chip').is.true;
      expect(rows[rows.length - 1].bucket).eq('payment');
    });

    it('a rival\'s notification carries the walk and the TR as the actor\'s pills — never a bare «played a card · −6 M€»', () => {
      const {game, p1, p2, card} = table(1);
      p1.playCard(card, Payment.of({megacredits: 6}));
      runAllActions(game);
      const root = game.events.events.find((e) => e.type === 'action' && e.source?.kind === 'card' && e.source.card === CardName.MINORITY_REPRESENTATION)!.id;
      const impact = recomputeRootImpact(game.events.events, root, p1.color, p2.color);
      const actor = impact.pillGroups.find((group) => group.scope === 'actor');
      expect(actor?.chips.map((chip) => `${chip.icon} ${chip.text}`)).to.include.members(['agenda +2', 'tr +1']);
    });

    it('the TR\'s provenance segment is the TRACK\'s («Agenda track»), whoever walked it', () => {
      const {game, p1, card} = table(1);
      p1.playCard(card, Payment.of({megacredits: 6}));
      runAllActions(game);
      expect(p1.terraformRatingSources.at(-1), 'the provenance names the track, not the card').deep.include({sourceType: 'other', sourceName: 'Agenda track', amount: 1});
    });
  });

  describe('rules 6–7 — the TR of a walked step is an ordinary TR of the action phase', () => {
    it('a chairman quest of «gain 1 TR» is closed by the walk, and its gate stands AFTER the walk has finished', () => {
      const {game, p1, parliament, card} = table(1);
      parliament.quest = {definition: {goal: {kind: 'tr'}, count: 1}, source: 'starter', generation: game.generation, progress: new Map()};
      p1.playCard(card, Payment.of({megacredits: 6}));
      runAllActions(game);
      expect(parliament.quest?.completedBy, 'the quest counted the card\'s TR (R p.9: the player\'s own action)').eq(p1.id);
      expect(parliament.agendaOf(p1), 'the walk finished before the gate rose').eq(3);
      expect(parliament.pendingActions).deep.eq([{kind: 'chairman-quest', player: p1.id}]);
      expect(questGateOf(p1), 'the gate stands, deferred behind the play').is.not.undefined;
      expect(parliament.lastAdvance?.reason, 'the quest\'s own step has not been walked yet').eq('card');
    });
  });

  describe('the preview — the walk read before the press, held to the play', () => {
    it('from 1: the track chip 1 → 3, the TR chip and the influence chip in the steps\' order; the SHOW step carries the walk', () => {
      const t = table(1);
      const preview = cardPlayPreview(t.p1, t.card);
      const branch = preview.branches[0];
      expect(branch.effects.map((e) => e.icon)).deep.eq([AGENDA_TRACK_ICON, 'tr', INFLUENCE_ICON]);
      expect(branch.effects[0]).deep.include({direction: 'gain', amount: 2, current: 1, resulting: 3});
      expect(branch.effects[0].note, 'no cut — no note').is.undefined;
      expect(branch.effects[1]).deep.include({direction: 'gain', icon: 'tr', amount: 1, current: t.p1.terraformRating, resulting: t.p1.terraformRating + 1});
      expect(branch.effects[2]).deep.include({direction: 'gain', icon: INFLUENCE_ICON, amount: 1, current: 1, resulting: 2});
      const walk = walkOf(t);
      expect(walk).deep.eq({
        from: 1, to: 3, printed: 2, walked: 2,
        steps: [{to: 2, kind: 'tr'}, {to: 3, kind: 'influence', level: 2}],
        influence: {current: 1, resulting: 2},
      });
    });

    it('from 0: the influence step comes first, then the TR — the chips follow', () => {
      const t = table(0);
      const branch = cardPlayPreview(t.p1, t.card).branches[0];
      expect(branch.effects.map((e) => e.icon)).deep.eq([AGENDA_TRACK_ICON, INFLUENCE_ICON, 'tr']);
      expect(walkOf(t).steps).deep.eq([{to: 1, kind: 'influence', level: 1}, {to: 2, kind: 'tr'}]);
    });

    it('a cut is NAMED before the press: from 11 the walk is 1 of 2 · end of the track (the walk\'s reading — the card itself is closed there)', () => {
      const t = table(11);
      const branch = cardPlayPreview(t.p1, t.card).branches[0];
      expect(branch.effects[0]).deep.include({icon: AGENDA_TRACK_ICON, amount: 1, current: 11, resulting: 12, note: 'end of the track'});
      expect(walkOf(t)).deep.include({from: 11, to: 12, printed: 2, walked: 1});
      const end = table(12);
      expect(walkOf(end)).deep.include({from: 12, to: 12, walked: 0, steps: []});
    });

    it('PARITY: the preview\'s walk is the play\'s result, and the preview mutates nothing', () => {
      const t = table(1);
      const before = JSON.stringify(t.game.serialize());
      const walk = walkOf(t);
      expect(JSON.stringify(t.game.serialize()), 'purity').eq(before);
      t.p1.playCard(t.card, Payment.of({megacredits: 6}));
      runAllActions(t.game);
      expect(t.parliament.agendaOf(t.p1)).eq(walk.to);
      expect(t.parliament.influence(t.p1)).eq(walk.influence.resulting);
      expect(t.parliament.lastAdvance?.steps?.map((s) => s.to)).deep.eq(walk.steps.map((s) => s.to));
    });
  });

  describe('outside the Mars Parliament', () => {
    it('never dealt (the manifest is the gate); a play without a parliament walks nothing and does not throw', () => {
      const [game, p1] = testGame(2);
      expect(game.parliament).is.undefined;
      const card = new MinorityRepresentation();
      p1.cardsInHand.push(card);
      p1.megaCredits = 20;
      expect(() => card.play(p1)).to.not.throw();
      expect(game.events.events.filter((e) => e.type === 'agenda-advanced')).deep.eq([]);
    });
  });
});
