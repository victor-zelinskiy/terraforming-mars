import {expect} from 'chai';
import {RED_LAWYERS_STEPS, RedLawyers} from '../../../src/server/cards/turmoilRedux/RedLawyers';
import {CouncilSeat} from '../../../src/server/cards/turmoilRedux/CouncilSeat';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {testAutomaGame} from '../../automa/AutomaTestGame';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {ChairmanSeat} from '../../../src/server/parliament/quests/ChairmanSeat';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {PARTY_REQUIREMENT_REASON, unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {requiredPartyOf} from '../../../src/server/cards/requirements/partyRequirementCards';
import {AGENDA_TRACK_ICON, INFLUENCE_ICON} from '../../../src/server/cards/actionPreviews';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {PARLIAMENT_AGENDA_STEPS} from '../../../src/common/parliament/ParliamentTypes';
import {CardRenderItemType} from '../../../src/common/cards/render/CardRenderItemType';
import {ICardRenderItem, ItemType, isICardRenderItem} from '../../../src/common/cards/render/Types';
import {AgendaWalkModel} from '../../../src/common/models/ActionPreviewModel';
import {Payment} from '../../../src/common/inputs/Payment';
import {ALL_MODULE_MANIFESTS} from '../../../src/server/cards/AllManifests';
import {questGateOf, quietResolutionOf, seatEnacted, seatResolution} from '../../parliament/parliamentArrange';
import {runAllActions} from '../../TestingUtils';
import {buildEventChildren} from '../../../src/client/components/journal/journalEventChild';
import {recomputeRootImpact} from '../../../src/client/components/notifications/notificationModel';

/**
 * TR37 — RED LAWYERS: TR04's printed walk WITHOUT the influence ceiling — the
 * card for which a CARD step in the MIDDLE of a walk became reachable. The
 * walk itself is the ONE walk (`ChairmanSeat.walkAgenda`, pinned by
 * tests/parliament/AgendaWalk.spec.ts); every rule reading of the card file's
 * header is pinned here on the real card, and the preview's promise is held
 * to the play's result.
 */
const R = PartyName.REDS;
const COST = 5;

type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, parliament: Parliament, card: RedLawyers};

/** `n` of `player`'s own cubes on the slot of `party` (the lobby's free one first, the rest from the reserve). */
function cubes(t: Table, player: TestPlayer, party: PartyName.REDS, n: number): void {
  const slot = t.parliament.slotOf(party)!;
  for (let i = 0; i < n; i++) {
    t.parliament.placeVote(player, slot, t.parliament.lobby.has(player.id) ? 'lobby' : 'reserve');
  }
}

/**
 * A two-seat Redux table in the action phase: the Greens rule by the starting
 * rule, a quiet Reds resolution stands in slot 0, p1's marker on `position`,
 * the card in hand, 20 M€. `access` names the road to the requirement: two of
 * p1's own cubes on the Reds' resolution (the default), the Reds RULING by an
 * enacted card, or none.
 */
function table(position: number, access: 'delegates' | 'ruling' | 'none' = 'delegates'): Table {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  const parliament = game.parliament!;
  parliament.agenda.set(p1.id, position);
  const card = new RedLawyers();
  p1.cardsInHand.push(card);
  p1.megaCredits = 20;
  const t: Table = {game, p1, p2, parliament, card};
  if (access === 'ruling') {
    seatEnacted(parliament, quietResolutionOf(R));
  } else {
    seatResolution(parliament, 0, quietResolutionOf(R));
    if (access === 'delegates') {
      cubes(t, p1, R, 2);
    }
  }
  return t;
}

const ADVANCE = '${0} advances on the Agenda track to step ${1}';
const TR_LINE = '${0} gained ${1} ${2} from the Agenda track';
const END_LINE = '${0} is already at the end of the Agenda track';
const DRAW_LINE = '${0} drew ${1}';
const WALK_LINES: ReadonlyArray<string> = [ADVANCE, TR_LINE, END_LINE, DRAW_LINE];

/** The walk's own journal lines (and the draw of a card step), in order. */
function walkLines(game: IGame, from: number): Array<string> {
  return game.gameLog.slice(from).map((entry) => entry.message).filter((message) => WALK_LINES.includes(message));
}

function play(t: Table): void {
  t.p1.playCard(t.card, Payment.of({megacredits: COST}));
  runAllActions(t.game);
}

function walkOf(t: Table): AgendaWalkModel {
  const preview = cardPlayPreview(t.p1, t.card);
  const step = preview.branches[0].steps.find((s) => s.kind === 'agendaWalk');
  expect(step, 'the walk is a step of the preview').is.not.undefined;
  return (step as {kind: 'agendaWalk', walk: AgendaWalkModel}).walk;
}

describe('RedLawyers', () => {
  describe('the card as printed', () => {
    it('is a green card for 5, a Mars tag, no VP, the Reds\' plate, TR37 — and prints two Agenda-step units (TR04\'s own)', () => {
      const card = new RedLawyers();
      expect(card.type).eq(CardType.AUTOMATED);
      expect(card.cost).eq(COST);
      expect(card.tags).deep.eq([Tag.MARS]);
      expect(card.victoryPoints).is.undefined;
      expect(requiredPartyOf(card), 'the MIN plate holds the Reds\' emblem — a requirement, not a tag').eq(R);
      expect(card.requirements).has.length(1);
      expect(card.metadata.cardNumber).eq('TR37');
      const manifest = ALL_MODULE_MANIFESTS.find((m) => m.module === 'turmoilRedux')!;
      const entry = (manifest.projectCards as Record<string, {compatibility?: unknown}>)[CardName.RED_LAWYERS];
      expect(entry, 'registered in the Redux manifest').is.not.undefined;
      expect(entry.compatibility, 'only the module\'s icon at the bottom left: the module is the gate').is.undefined;
      expect(card.metadata.description).eq('Requires the Reds to be ruling or that you have 2 delegates there. Advance your Agenda marker 2 steps. (And collect bonuses from each step.)');
      expect(RED_LAWYERS_STEPS).eq(2);
      const rows = (card.metadata.renderData as unknown as {rows: Array<Array<ItemType>>}).rows;
      expect(rows).has.lengthOf(1);
      const items = rows[0].filter((node: ItemType) => isICardRenderItem(node)) as Array<ICardRenderItem>;
      expect(items.map((item) => [item.type, item.amount])).deep.eq([[CardRenderItemType.AGENDA_STEP, 2]]);
    });
  });

  describe('rule 1 — the requirement: the Reds rule, or 2 of your delegates on their resolution; no ceiling of the walk\'s own', () => {
    it('no delegate: «0 of 2» with the named reason; one: «1 of 2»; two: playable; the Reds ruling: playable with no delegate anywhere', () => {
      const t = table(6, 'none');
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)[0]).deep.include({
        type: 'party', message: PARTY_REQUIREMENT_REASON, params: [R, '2'], party: R, current: 0, requirement: true, requirementKey: 'req:party',
      });
      cubes(t, t.p1, R, 1);
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)[0]).deep.include({party: R, current: 1});
      cubes(t, t.p1, R, 1);
      expect(t.p1.canPlay(t.card)).is.true;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([]);

      const ruled = table(6, 'ruling');
      expect(ruled.parliament.rulingParty()).eq(R);
      expect(ruled.p1.canPlay(ruled.card)).is.true;
    });

    it('TR36 Council Seat on the table lowers the EFFECT\'s threshold, never a REQUIREMENT\'s (FAQ p.19): with one delegate the card still reads «1 of 2»', () => {
      const t = table(6, 'none');
      t.p1.playedCards.push(new CouncilSeat());
      cubes(t, t.p1, R, 1);
      expect(t.parliament.hasPartyEffect(t.p1, R), 'the Reds\' EFFECT is the player\'s by the Seat').is.true;
      expect(t.p1.canPlay(t.card), 'the requirement is still two').is.false;
      expect(unplayableReasons(t.p1, t.card)[0]).deep.include({party: R, current: 1, params: [R, '2']});
    });

    it('the position on the track closes nothing: the card opens at 0, at 6 (influence 3) and at 11 (influence 4)', () => {
      for (const position of [0, 6, 11]) {
        const t = table(position);
        expect(t.p1.canPlay(t.card), `position ${position}`).is.true;
      }
    });
  });

  describe('rules 2–3 — the play IS the walk, synchronous; no ceiling, so every kind of step comes, each paid before the next', () => {
    it('from 6: ⑦ is a CARD step and ⑧ sets influence 4 — the card is DRAWN BEFORE the second step is taken; one record with both steps; the cost is paid', () => {
      const t = table(6);
      const hand = t.p1.cardsInHand.length;
      const reveals = t.p1.cardDrawReveals.length;
      const at = t.game.gameLog.length;
      play(t);
      expect(t.parliament.agendaOf(t.p1)).eq(8);
      expect(t.parliament.influence(t.p1), 'rule 7 — the influence is re-read: 4 after 6 → 8').eq(4);
      expect(t.p1.cardsInHand.length, 'the hand grew by the card step\'s card (the played card left it)').eq(hand - 1 + 1);
      const drawn = t.p1.cardDrawReveals.slice(reveals);
      expect(drawn, 'ONE reveal batch, the Agenda\'s own source').has.lengthOf(1);
      expect(drawn[0].source).deep.eq({type: 'agenda'});
      expect(drawn[0].cards).has.lengthOf(1);
      expect(t.p1.megaCredits, '20 − 5 for the card; no TR step, so nothing from the Greens').eq(15);
      expect([...t.p1.tableau].map((c) => c.name)).includes(CardName.RED_LAWYERS);
      expect(t.parliament.lastAdvance).deep.include({
        player: t.p1.id, from: 6, to: 8, reason: 'card', card: CardName.RED_LAWYERS, generation: t.game.generation,
      });
      expect(t.parliament.lastAdvance?.steps).deep.eq([{to: 7, bonus: 'card'}, {to: 8}]);
      expect(t.parliament.lastAdvance?.seq, 'the serial moved ONCE for the whole walk').eq(1);
      expect(walkLines(t.game, at), 'step 7 · the draw · step 8 — the bonus before the next step').deep.eq([ADVANCE, DRAW_LINE, ADVANCE]);
    });

    it('from 5: the TR of ⑥ (the ruling Greens answer it), then the card of ⑦ LAST', () => {
      const t = table(5);
      const tr = t.p1.terraformRating;
      const hand = t.p1.cardsInHand.length;
      const at = t.game.gameLog.length;
      play(t);
      expect(t.parliament.agendaOf(t.p1)).eq(7);
      expect(t.p1.terraformRating).eq(tr + 1);
      expect(t.p1.cardsInHand.length).eq(hand);
      expect(t.p1.cardDrawReveals.at(-1)?.source).deep.eq({type: 'agenda'});
      expect(t.p1.megaCredits, '20 − 5 for the card + 2 from the Greens for the TR').eq(17);
      expect(t.parliament.lastAdvance?.steps).deep.eq([{to: 6, bonus: 'tr'}, {to: 7, bonus: 'card'}]);
      expect(walkLines(t.game, at)).deep.eq([ADVANCE, TR_LINE, ADVANCE, DRAW_LINE]);
    });

    it('from 9: the card of ⑩ FIRST, then the TR of ⑪', () => {
      const t = table(9);
      const tr = t.p1.terraformRating;
      const at = t.game.gameLog.length;
      play(t);
      expect(t.parliament.agendaOf(t.p1)).eq(11);
      expect(t.p1.terraformRating).eq(tr + 1);
      expect(t.parliament.lastAdvance?.steps).deep.eq([{to: 10, bonus: 'card'}, {to: 11, bonus: 'tr'}]);
      expect(walkLines(t.game, at)).deep.eq([ADVANCE, DRAW_LINE, ADVANCE, TR_LINE]);
    });

    it('from 3: the TR of ④, then influence 3 on ⑤ (TR04\'s own ground, without its ceiling)', () => {
      const t = table(3);
      const tr = t.p1.terraformRating;
      play(t);
      expect(t.parliament.agendaOf(t.p1)).eq(5);
      expect(t.parliament.influence(t.p1)).eq(3);
      expect(t.p1.terraformRating).eq(tr + 1);
      expect(t.parliament.lastAdvance?.steps).deep.eq([{to: 4, bonus: 'tr'}, {to: 5}]);
    });
  });

  describe('rule 4 — the end of the track cuts honestly, and the card is played all the same', () => {
    it('from 11: ONE step and «already at the end» once; a one-step record', () => {
      const t = table(PARLIAMENT_AGENDA_STEPS - 1);
      const at = t.game.gameLog.length;
      play(t);
      expect(t.parliament.agendaOf(t.p1)).eq(12);
      expect(t.parliament.influence(t.p1)).eq(5);
      expect(t.parliament.lastAdvance?.steps).deep.eq([{to: 12}]);
      expect(walkLines(t.game, at)).deep.eq([ADVANCE, END_LINE]);
      expect([...t.p1.tableau].map((c) => c.name)).includes(CardName.RED_LAWYERS);
    });

    it('from 12: NO step, no record, no event, the line once — the card PLAYED: the cost paid, in the tableau, its Mars tag counted', () => {
      const t = table(PARLIAMENT_AGENDA_STEPS);
      expect(t.p1.canPlay(t.card), 'playable — the walk adds no check of its own (decision 5)').is.true;
      const at = t.game.gameLog.length;
      play(t);
      expect(t.parliament.agendaOf(t.p1)).eq(12);
      expect(t.parliament.lastAdvance).is.undefined;
      expect(t.game.events.events.filter((e) => e.type === 'agenda-advanced')).deep.eq([]);
      expect(walkLines(t.game, at)).deep.eq([END_LINE]);
      expect(t.p1.megaCredits).eq(15);
      expect([...t.p1.tableau].map((c) => c.name)).includes(CardName.RED_LAWYERS);
      expect(t.p1.tags.count(Tag.MARS)).eq(1);
    });
  });

  describe('rules 5–6 — the TR of a walked step is an ordinary TR of the action phase', () => {
    it('a chairman quest of «gain 1 TR» is closed by the walk, and its gate stands AFTER the walk has finished', () => {
      const t = table(5);
      t.parliament.quest = {definition: {goal: {kind: 'tr'}, count: 1}, source: 'starter', generation: t.game.generation, progress: new Map()};
      play(t);
      expect(t.parliament.quest?.completedBy, 'the quest counted the card\'s TR (R p.9: the player\'s own action)').eq(t.p1.id);
      expect(t.parliament.agendaOf(t.p1), 'the walk finished before the gate rose').eq(7);
      expect(t.parliament.pendingActions).deep.eq([{kind: 'chairman-quest', player: t.p1.id}]);
      expect(questGateOf(t.p1), 'the gate stands, deferred behind the play').is.not.undefined;
      expect(t.parliament.lastAdvance?.reason, 'the quest\'s own step has not been walked yet').eq('card');
    });
  });

  describe('rule 8 — the journal and the events: the card is the source', () => {
    it('ONE agenda-advanced event sourced by the CARD; the draw of the card step under the card too, in one chain', () => {
      const t = table(6);
      play(t);
      const advanced = t.game.events.events.filter((e) => e.type === 'agenda-advanced');
      expect(advanced).has.lengthOf(1);
      expect(advanced[0].impact.agenda).deep.eq({from: 6, to: 8, steps: [{to: 7, bonus: 'card'}, {to: 8}], reason: 'card'});
      expect(advanced[0].source).deep.include({kind: 'card', card: CardName.RED_LAWYERS});
      const drawn = t.game.events.events.filter((e) => e.type === 'cards-drawn' && e.player === t.p1.color);
      expect(drawn, 'the card step\'s draw is the card\'s deed').has.lengthOf(1);
      expect(drawn[0].source).deep.include({kind: 'card', card: CardName.RED_LAWYERS});
      expect(drawn[0].correlationId, 'one chain: the play').eq(advanced[0].correlationId);
    });

    it('the TR of a walked step: the event under the card, the provenance segment the TRACK\'s', () => {
      const t = table(5);
      play(t);
      const trChanged = t.game.events.events.filter((e) => e.type === 'tr-changed' && e.player === t.p1.color);
      expect(trChanged).has.lengthOf(1);
      expect(trChanged[0].source).deep.include({kind: 'card', card: CardName.RED_LAWYERS});
      expect(t.p1.terraformRatingSources.at(-1)).deep.include({sourceType: 'other', sourceName: 'Agenda track', amount: 1});
    });

    it('the journal draws the walk as a row of the CARD — the steps chip «+2» with the position and the level it set', () => {
      const t = table(6);
      play(t);
      const root = t.game.events.events.find((e) => e.type === 'action' && e.source?.kind === 'card' && e.source.card === CardName.RED_LAWYERS)!.id;
      const chain = t.game.events.events.filter((e) => e.correlationId === root);
      const rows = buildEventChildren(chain, root, t.p1.color);
      const own = rows.filter((row) => row.source.kind === 'card' && row.source.card === CardName.RED_LAWYERS);
      const walk = own.find((row) => row.political?.kind === 'agenda');
      expect(walk, 'the walk is a row of its own').is.not.undefined;
      expect(walk!.chips).deep.eq([{icon: 'agenda', text: '+2'}]);
      expect(walk!.political).deep.eq({kind: 'agenda', from: 6, to: 8, level: 4});
      expect(rows[rows.length - 1].bucket).eq('payment');
    });

    it('a rival\'s notification carries the walk and the drawn card as the actor\'s pills', () => {
      const t = table(6);
      play(t);
      const root = t.game.events.events.find((e) => e.type === 'action' && e.source?.kind === 'card' && e.source.card === CardName.RED_LAWYERS)!.id;
      const impact = recomputeRootImpact(t.game.events.events, root, t.p1.color, t.p2.color);
      const actor = impact.pillGroups.find((group) => group.scope === 'actor');
      expect(actor?.chips.map((chip) => `${chip.icon} ${chip.text}`)).to.include.members(['agenda +2', 'cards +1']);
    });
  });

  describe('the preview — the walk read before the press, held to the play', () => {
    it('from 6: the track chip 6 → 8, the card chip and the influence chip 3 → 4 in the steps\' order; the SHOW step carries the walk', () => {
      const t = table(6);
      const branch = cardPlayPreview(t.p1, t.card).branches[0];
      expect(branch.effects.map((e) => e.icon)).deep.eq([AGENDA_TRACK_ICON, 'cards', INFLUENCE_ICON]);
      expect(branch.effects[0]).deep.include({direction: 'gain', amount: 2, current: 6, resulting: 8});
      expect(branch.effects[0].note, 'no cut — no note').is.undefined;
      expect(branch.effects[1]).deep.include({direction: 'gain', icon: 'cards', amount: 1});
      expect(branch.effects[2]).deep.include({direction: 'gain', icon: INFLUENCE_ICON, amount: 1, current: 3, resulting: 4});
      expect(walkOf(t)).deep.eq({
        from: 6, to: 8, printed: 2, walked: 2,
        steps: [{to: 7, kind: 'card'}, {to: 8, kind: 'influence', level: 4}],
        influence: {current: 3, resulting: 4},
      });
    });

    it('from 5: the TR chip first, then the card — the chips follow the steps', () => {
      const t = table(5);
      const branch = cardPlayPreview(t.p1, t.card).branches[0];
      expect(branch.effects.map((e) => e.icon)).deep.eq([AGENDA_TRACK_ICON, 'tr', 'cards']);
      expect(walkOf(t).steps).deep.eq([{to: 6, kind: 'tr'}, {to: 7, kind: 'card'}]);
    });

    it('a cut is NAMED before the press: from 11 «1 of 2 · end of the track»; from 12 «0 of 2» — the card still playable', () => {
      const t = table(11);
      const branch = cardPlayPreview(t.p1, t.card).branches[0];
      expect(branch.effects[0]).deep.include({icon: AGENDA_TRACK_ICON, amount: 1, current: 11, resulting: 12, note: 'end of the track'});
      expect(walkOf(t)).deep.include({from: 11, to: 12, printed: 2, walked: 1});
      const end = table(12);
      const nothing = cardPlayPreview(end.p1, end.card).branches[0];
      expect(nothing.effects[0]).deep.include({icon: AGENDA_TRACK_ICON, amount: 0, current: 12, resulting: 12, note: 'end of the track'});
      expect(walkOf(end)).deep.include({from: 12, to: 12, printed: 2, walked: 0, steps: []});
      expect(end.p1.canPlay(end.card)).is.true;
    });

    it('PARITY: the preview\'s walk is the play\'s result, and the preview mutates nothing', () => {
      const t = table(6);
      const before = JSON.stringify(t.game.serialize());
      const walk = walkOf(t);
      expect(JSON.stringify(t.game.serialize()), 'purity').eq(before);
      play(t);
      expect(t.parliament.agendaOf(t.p1)).eq(walk.to);
      expect(t.parliament.influence(t.p1)).eq(walk.influence.resulting);
      expect(t.parliament.lastAdvance?.steps?.map((s) => s.to)).deep.eq(walk.steps.map((s) => s.to));
    });
  });

  describe('rule 9 — MarsBot', () => {
    it('never plays it; the bot\'s own walk onto a card step pays 1 M€ instead of a card (no hand), one step as ever', () => {
      const [game, , bot] = testAutomaGame({turmoilReduxExpansion: true, coloniesExtension: true, botParliamentMode: 'politics'});
      game.phase = Phase.ACTION;
      const parliament = game.parliament!;
      parliament.agenda.set(bot.id, 6);
      const mc = bot.megaCredits;
      const hand = bot.cardsInHand.length;
      const walk = ChairmanSeat.walkAgenda(bot, parliament, 1, {reason: 'quest'});
      expect(walk).deep.eq({from: 6, to: 7, steps: [{to: 7, bonus: 'card'}]});
      expect(bot.megaCredits).eq(mc + 1);
      expect(bot.cardsInHand.length).eq(hand);
      expect(bot.cardDrawReveals).deep.eq([]);
    });
  });

  describe('rule 10 — save / load adds nothing', () => {
    it('the walk\'s record and the drawn card survive a save and a load whole', () => {
      const t = table(6);
      play(t);
      const restored = Game.deserialize(structuredClone(t.game.serialize()));
      const again = restored.getPlayerById(t.p1.id);
      expect(restored.parliament!.agendaOf(again)).eq(8);
      expect(restored.parliament!.influence(again)).eq(4);
      expect(restored.parliament!.lastAdvance).deep.include({from: 6, to: 8, reason: 'card', card: CardName.RED_LAWYERS});
      expect(restored.parliament!.lastAdvance?.steps).deep.eq([{to: 7, bonus: 'card'}, {to: 8}]);
      expect(again.cardsInHand.length).eq(t.p1.cardsInHand.length);
      expect([...again.tableau].map((c) => c.name)).includes(CardName.RED_LAWYERS);
    });
  });

  describe('outside the Mars Parliament', () => {
    it('never dealt (the manifest is the gate); a play without a parliament walks nothing and does not throw', () => {
      const [game, p1] = testGame(2);
      expect(game.parliament).is.undefined;
      const card = new RedLawyers();
      p1.cardsInHand.push(card);
      p1.megaCredits = 20;
      expect(() => card.play(p1)).to.not.throw();
      expect(game.events.events.filter((e) => e.type === 'agenda-advanced')).deep.eq([]);
    });
  });
});
