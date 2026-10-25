import {expect} from 'chai';
import {
  ALREADY_CHAIRMAN_REASON, CHAIR_ICON, NO_CHAIRMAN_TO_REMOVE_REASON, UNSEATS_NOTE, VOTE_OF_NO_CONFIDENCE_INFLUENCE,
  VOTE_OF_NO_CONFIDENCE_STEPS, VoteOfNoConfidenceRedux,
} from '../../../src/server/cards/turmoilRedux/VoteOfNoConfidenceRedux';
import {VoteOfNoConfidence} from '../../../src/server/cards/turmoil/VoteOfNoConfidence';
import {TURMOIL_REDUX_CARD_MANIFEST} from '../../../src/server/cards/turmoilRedux/TurmoilReduxCardManifest';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {GameCards} from '../../../src/server/GameCards';
import {newCard} from '../../../src/server/createCard';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {ChairmanSeat} from '../../../src/server/parliament/quests/ChairmanSeat';
import {NO_DELEGATE_IN_RESERVE_REASON} from '../../../src/server/parliament/RemoveDelegate';
import {Payment} from '../../../src/common/inputs/Payment';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {DEFAULT_GAME_OPTIONS, GameOptions} from '../../../src/server/game/GameOptions';
import {replacementCardNumber} from '../../../src/common/cards/turmoilReduxReplacements';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Phase} from '../../../src/common/Phase';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {CardRenderItemType} from '../../../src/common/cards/render/CardRenderItemType';
import {ICardRenderItem, ItemType, isICardRenderItem} from '../../../src/common/cards/render/Types';
import {AgendaWalkModel} from '../../../src/common/models/ActionPreviewModel';
import {inPremiumScope} from '../../../src/common/cards/premiumScope';
import {toName} from '../../../src/common/utils/utils';
import {TestPlayer} from '../../TestPlayer';
import {runAllActions, testGame} from '../../TestingUtils';
import {testAutomaGame} from '../../automa/AutomaTestGame';
import {quietResolutionOf, seatResolution} from '../../parliament/parliamentArrange';

/**
 * TR76 — VOTE OF NO CONFIDENCE (Redux replacement of the classic T16), the last replacement. Every rule reading of
 * the card's header is pinned here on the real card: the printed card (MIN «1 influence», 5 M€, «− chairman + your
 * chairman · one Agenda step» — TR76 by its registry row), the requirement (the WHOLE influence, TR04's kind), the
 * three named blockers in order, the play (one journal group: header → unseat → seat from the reserve → walk), the
 * preview, the deal, save / load.
 */
type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, parliament: Parliament, card: VoteOfNoConfidenceRedux};

/** A two-seat Redux table in the action phase, quiet resolutions up for the vote, p1 at `position` (1 = influence 1), p2 in the chair. */
function table(position = 1, chair: 'p2' | 'p1' | 'none' = 'p2'): Table {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  const parliament = game.parliament!;
  ([PartyName.GREENS, PartyName.MARS, PartyName.INDUSTRIALISTS] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
  parliament.agenda.set(p1.id, position);
  parliament.chairman = chair === 'none' ? undefined : chair === 'p1' ? p1.id : p2.id;
  const card = new VoteOfNoConfidenceRedux();
  p1.cardsInHand.push(card);
  p1.megaCredits = 20;
  return {game, p1, p2, parliament, card};
}

function walkOf(t: Table): AgendaWalkModel {
  const step = cardPlayPreview(t.p1, t.card).branches[0].steps.find((s) => s.kind === 'agendaWalk');
  expect(step, 'the walk is a step of the preview').is.not.undefined;
  return (step as {kind: 'agendaWalk', walk: AgendaWalkModel}).walk;
}

function play(t: Table): void {
  t.p1.playCard(t.card, Payment.of({megacredits: 5}));
}

function options(overrides: Partial<GameOptions>): GameOptions {
  return {...DEFAULT_GAME_OPTIONS, ...overrides};
}

describe('VoteOfNoConfidenceRedux', () => {
  it('the printed card: an EVENT for 5, no tags, no VP, the influence plate «1», «− chairman (any) + chairman · one Agenda step»; TR76, reimplementing T16', () => {
    const c = new VoteOfNoConfidenceRedux();
    expect(c.name).eq(CardName.VOTE_OF_NO_CONFIDENCE_REDUX);
    expect(c.name, 'upstream\'s «Of» with the `:redux` suffix').eq('Vote Of No Confidence:redux');
    expect(c.type).eq(CardType.EVENT);
    expect(c.cost).eq(5);
    expect(new VoteOfNoConfidence().cost).eq(5);
    expect(c.tags).deep.eq([]);
    expect(c.victoryPoints).is.undefined;
    expect(c.requirements).deep.eq([{influence: 1, count: 1}]);
    expect(VOTE_OF_NO_CONFIDENCE_INFLUENCE).eq(1);
    expect(c.behavior, 'no «+1 TR» — the classic reward is gone').is.undefined;
    expect(c.tr, 'no TR forecast either').is.undefined;
    const rows = (c.metadata.renderData as unknown as {rows: Array<Array<ItemType>>}).rows;
    const items = rows.flat().filter((node: ItemType) => isICardRenderItem(node)) as Array<ICardRenderItem>;
    expect(items.map((item) => item.type), 'the «−» / «+» are symbols between them').deep.eq([CardRenderItemType.CHAIRMAN, CardRenderItemType.CHAIRMAN, CardRenderItemType.AGENDA_STEP]);
    expect(items[0].anyPlayer, 'the removed chairman is ANY player\'s (the red frame)').is.true;
    expect(items[1].anyPlayer, 'the seated one is yours').is.not.true;
    expect(items[2].amount).eq(VOTE_OF_NO_CONFIDENCE_STEPS);
    expect(VOTE_OF_NO_CONFIDENCE_STEPS).eq(1);
    expect(c.metadata.cardNumber, 'the SIXTH project row').eq('TR76');
    expect(replacementCardNumber(CardName.VOTE_OF_NO_CONFIDENCE)).eq('TR76');
    expect(c.metadata.reimplements, 'the art and the lore are the classic T16\'s').eq(CardName.VOTE_OF_NO_CONFIDENCE);
    expect(new VoteOfNoConfidence().metadata.cardNumber).eq('T16');
    expect(TURMOIL_REDUX_CARD_MANIFEST.projectCards[CardName.VOTE_OF_NO_CONFIDENCE_REDUX]?.compatibility).is.undefined;
    expect(newCard(CardName.VOTE_OF_NO_CONFIDENCE_REDUX)).to.be.instanceOf(VoteOfNoConfidenceRedux);
    expect(newCard(CardName.VOTE_OF_NO_CONFIDENCE), 'the plain name stays the classic card').to.be.instanceOf(VoteOfNoConfidence);
  });

  describe('rule 1 — at least 1 influence, the WHOLE influence', () => {
    it('Career position 0 (influence 0): not playable, the named counted reason «Influence 0/1»', () => {
      const t = table(0);
      expect(t.parliament.influence(t.p1)).eq(0);
      expect(t.p1.canPlay(t.card)).is.false;
      const [reason] = unplayableReasons(t.p1, t.card);
      expect(reason).deep.include({type: 'count', message: 'Requires ${0} influence', params: ['1'], current: 0, requirement: true});
    });

    it('position 1 (influence 1): playable, no reason', () => {
      const t = table(1);
      expect(t.parliament.influence(t.p1)).eq(1);
      expect(t.p1.canPlay(t.card)).is.true;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([]);
    });

    it('a BONUS opens it with no Career at all (T05 Event Analysts\' +1)', () => {
      const t = table(0);
      t.parliament.influenceBonus.set(t.p1.id, [{amount: 1, source: CardName.EVENT_ANALYSTS}]);
      expect(t.parliament.influence(t.p1)).eq(1);
      expect(t.p1.canPlay(t.card)).is.true;
    });
  });

  describe('rules 2–3 — somebody ELSE in the chair, a delegate in the RESERVE; one named reason, in order', () => {
    it('an EMPTY chair: nobody to remove — not playable, «no chairman to remove · the chair is vacant»', () => {
      const t = table(1, 'none');
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([{type: 'party', message: NO_CHAIRMAN_TO_REMOVE_REASON, chairmanNow: 'vacant'}]);
    });

    it('the player IS the chairman: not playable, «you are already the chairman»', () => {
      const t = table(1, 'p1');
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([{type: 'party', message: ALREADY_CHAIRMAN_REASON}]);
    });

    it('an EMPTY reserve: not playable, TR03\'s «No delegate in your reserve» — the lobby cube does not count', () => {
      const t = table(1);
      for (let i = 0; i < 6; i++) {
        t.parliament.placeVote(t.p1, t.parliament.slots[i % 3], 'reserve');
      }
      t.parliament.lobby.add(t.p1.id);
      expect(t.parliament.reserve(t.p1)).eq(0);
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([{type: 'party', message: NO_DELEGATE_IN_RESERVE_REASON, current: 0}]);
    });

    it('the order: the printed requirement first, then the chair (one bespoke reason at a time)', () => {
      const t = table(0, 'none');
      const reasons = unplayableReasons(t.p1, t.card);
      expect(reasons.map((r) => r.message)).deep.eq(['Requires ${0} influence', NO_CHAIRMAN_TO_REMOVE_REASON]);
    });

    it('the blocker reading is ONE function (`ChairmanSeat.unseatBlocker`): vacant → self → reserve', () => {
      const t = table(1, 'none');
      expect(ChairmanSeat.unseatBlocker(t.p1, t.parliament)).eq('vacant');
      t.parliament.chairman = t.p1.id;
      expect(ChairmanSeat.unseatBlocker(t.p1, t.parliament)).eq('self');
      t.parliament.chairman = t.p2.id;
      expect(ChairmanSeat.unseatBlocker(t.p1, t.parliament)).is.undefined;
      expect(() => ChairmanSeat.unseatAndSeatFromReserve(t.p2, t.parliament), 'a blocked unseat is never applied').to.throw();
    });
  });

  describe('rule 4 — ONE group: header → the outgoing delegate home → yours from the reserve → one Agenda step', () => {
    it('a rival in the chair: the seat changes hands, both reserves move by one, the marker walks 1 → 2 and pays its TR', () => {
      const t = table(1);
      const mine = t.parliament.reserve(t.p1);
      const theirs = t.parliament.reserve(t.p2);
      const lobby = t.parliament.lobby.has(t.p1.id);
      const tr = t.p1.terraformRating;
      play(t);
      expect(t.parliament.chairman, 'synchronous — before any deferred action runs').eq(t.p1.id);
      expect(t.parliament.agendaOf(t.p1), 'synchronous').eq(2);
      runAllActions(t.game);
      expect(t.p1.megaCredits, '5 M€ paid; the TR of the step answered by the ruling Greens (+2 M€)').eq(20 - 5 + 2);
      expect(t.parliament.reserve(t.p1), 'my delegate left the reserve').eq(mine - 1);
      expect(t.parliament.reserve(t.p2), 'the outgoing delegate is back in its owner\'s reserve').eq(theirs + 1);
      expect(t.parliament.lobby.has(t.p1.id), 'the lobby is untouched').eq(lobby);
      expect(t.game.politics!.isChairman(t.p1)).is.true;
      expect(t.game.politics!.isChairman(t.p2)).is.false;
      expect(t.p1.terraformRating).eq(tr + 1);
      expect(t.parliament.lastAdvance).deep.include({player: t.p1.id, from: 1, to: 2, reason: 'card', card: CardName.VOTE_OF_NO_CONFIDENCE_REDUX});
      expect(t.parliament.pendingActions, 'nothing pending — the reserve always answers').deep.eq([]);
      expect([...t.p1.tableau].map((c) => c.name)).includes(CardName.VOTE_OF_NO_CONFIDENCE_REDUX);
    });

    it('the journal: the header first, then the seat lines, then the walk — and the record names whose delegate left', () => {
      const t = table(1);
      const before = t.game.gameLog.length;
      play(t);
      runAllActions(t.game);
      const lines = t.game.gameLog.slice(before).map((m) => m.message);
      const at = (msg: string) => lines.indexOf(msg);
      expect(at('${0} takes the chairmanship')).to.be.greaterThan(-1);
      expect(at('${0} takes the chairmanship')).lessThan(at('The delegate of ${0} leaves the chairman seat'));
      expect(at('The delegate of ${0} leaves the chairman seat')).lessThan(at('${0} becomes the chairman (delegate from the reserve)'));
      expect(at('${0} becomes the chairman (delegate from the reserve)')).lessThan(at('${0} advances on the Agenda track to step ${1}'));
      const seated = t.game.events.serialize().events.filter((e) => e.type === 'chairman-seated');
      expect(seated).has.length(1);
      expect(seated[0].player).eq(t.p1.color);
      expect(seated[0].target?.player, 'the previous holder — its notification\'s addressee').eq(t.p2.color);
      const advanced = t.game.events.serialize().events.find((e) => e.type === 'agenda-advanced');
      expect(advanced?.correlationId, 'ONE journal root for the seat and the walk').eq(seated[0].correlationId);
    });

    it('the chairman quest is the generation\'s, not the office-holder\'s: the unseat never touches it', () => {
      const t = table(1);
      const quest = structuredClone(t.parliament.quest);
      play(t);
      runAllActions(t.game);
      expect(t.parliament.quest).deep.eq(quest);
    });

    it('a requirement «be the chairman» of another card (T10, TR72) is met at once', () => {
      const t = table(1);
      play(t);
      runAllActions(t.game);
      expect(t.game.politics!.chairman()).eq(t.p1);
    });

    it('MarsBot in the chair is removed like anybody: its cube back to the bot, mine in the chair', () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true});
      game.phase = Phase.ACTION;
      const parliament = game.parliament!;
      ([PartyName.GREENS, PartyName.MARS, PartyName.INDUSTRIALISTS] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
      parliament.agenda.set(human.id, 1);
      parliament.chairman = bot.id;
      const card = new VoteOfNoConfidenceRedux();
      human.cardsInHand.push(card);
      human.megaCredits = 20;
      expect(human.canPlay(card)).is.true;
      human.playCard(card, Payment.of({megacredits: 5}));
      runAllActions(game);
      expect(parliament.chairman).eq(human.id);
      const seated = game.events.serialize().events.find((e) => e.type === 'chairman-seated');
      expect(seated?.target?.player).eq(bot.color);
    });
  });

  describe('rule 5 — preview = execution', () => {
    it('the chips: the chair (whose delegate leaves), the reserve «n → n−1», then the walk\'s; the SHOW step is the walk', () => {
      const t = table(1);
      const reserve = t.parliament.reserve(t.p1);
      const branch = cardPlayPreview(t.p1, t.card).branches[0];
      expect(branch.effects[0]).deep.include({direction: 'gain', icon: CHAIR_ICON, amount: 1, note: UNSEATS_NOTE, noteParams: [t.p2.name]});
      expect(branch.effects[1]).deep.include({direction: 'cost', icon: 'delegate', amount: 1, current: reserve, resulting: reserve - 1});
      expect(branch.effects[2]).deep.include({icon: 'agenda', current: 1, resulting: 2});
      expect(branch.effects.some((e) => e.icon === 'tr'), 'step 2 pays a TR').is.true;
      expect(walkOf(t).steps.map((s) => s.to)).deep.eq([2]);
    });

    it('the preview is pure — nobody moves before the press', () => {
      const t = table(1);
      cardPlayPreview(t.p1, t.card);
      expect(t.parliament.chairman).eq(t.p2.id);
      expect(t.parliament.agendaOf(t.p1)).eq(1);
    });

    it('the end of the track cuts honestly: from the last step the seat still changes hands, the walk takes none', () => {
      const t = table(12);
      expect(walkOf(t).steps).deep.eq([]);
      play(t);
      runAllActions(t.game);
      expect(t.parliament.chairman).eq(t.p1.id);
      expect(t.parliament.agendaOf(t.p1)).eq(12);
    });
  });

  describe('the deal: the replacement on a Redux table, the classic card on a classic one, never both', () => {
    const REDUX = {turmoilReduxExpansion: true, turmoilExtension: false, coloniesExtension: true};
    const CLASSIC = {turmoilReduxExpansion: false, turmoilExtension: true, coloniesExtension: true};

    it('Redux: TR76 is dealt, the classic T16 is removed by the manifest\'s `cardsToRemove`', () => {
      const names = new GameCards(options(REDUX)).getProjectCards().map(toName);
      expect(names).to.contain(CardName.VOTE_OF_NO_CONFIDENCE_REDUX);
      expect(names).to.not.contain(CardName.VOTE_OF_NO_CONFIDENCE);
      expect(TURMOIL_REDUX_CARD_MANIFEST.cardsToRemove.has(CardName.VOTE_OF_NO_CONFIDENCE)).is.true;
    });

    it('classic Turmoil: the classic card is dealt, the replacement is not', () => {
      const names = new GameCards(options(CLASSIC)).getProjectCards().map(toName);
      expect(names).to.contain(CardName.VOTE_OF_NO_CONFIDENCE);
      expect(names).to.not.contain(CardName.VOTE_OF_NO_CONFIDENCE_REDUX);
    });

    it('the premium scope covers the replacement and never the replaced classic card', () => {
      expect(inPremiumScope({module: 'turmoilRedux', name: CardName.VOTE_OF_NO_CONFIDENCE_REDUX})).is.true;
      expect(inPremiumScope({module: 'turmoil', name: CardName.VOTE_OF_NO_CONFIDENCE})).is.false;
    });
  });

  it('save / reload: the event in the tableau, the chair mine, the marker where the walk left it, nothing pending', () => {
    const t = table(1);
    play(t);
    runAllActions(t.game);
    const reloaded = Game.deserialize(structuredClone(t.game.serialize()));
    const owner = reloaded.getPlayerById(t.p1.id);
    expect(owner.playedCards.get(CardName.VOTE_OF_NO_CONFIDENCE_REDUX)).to.be.instanceOf(VoteOfNoConfidenceRedux);
    expect(reloaded.parliament!.chairman).eq(t.p1.id);
    expect(reloaded.parliament!.agendaOf(owner)).eq(2);
    expect(reloaded.parliament!.pendingActions).deep.eq([]);
  });
});
