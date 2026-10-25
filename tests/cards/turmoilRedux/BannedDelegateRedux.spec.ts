import {expect} from 'chai';
import {BannedDelegateRedux, DELEGATES_REMOVED} from '../../../src/server/cards/turmoilRedux/BannedDelegateRedux';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {NO_DELEGATE_ON_TABLE_REASON, RemoveDelegate} from '../../../src/server/parliament/RemoveDelegate';
import {SelectPartyDelegate} from '../../../src/server/inputs/SelectPartyDelegate';
import {Server} from '../../../src/server/models/ServerModel';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {CHAIRMAN_REQUIREMENT_REASON, unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {TURMOIL_REDUX_CARD_MANIFEST} from '../../../src/server/cards/turmoilRedux/TurmoilReduxCardManifest';
import {replacementCardNumber} from '../../../src/common/cards/turmoilReduxReplacements';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Phase} from '../../../src/common/Phase';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {REDUX_PARTIES} from '../../../src/common/parliament/ParliamentTypes';
import {CardRenderItemType} from '../../../src/common/cards/render/CardRenderItemType';
import {ICardRenderItem, ItemType, isICardRenderItem} from '../../../src/common/cards/render/Types';
import {ActionPreviewStep, StagedDelegateModel} from '../../../src/common/models/ActionPreviewModel';
import {SelectPartyModel} from '../../../src/common/models/PlayerInputModel';
import {Payment} from '../../../src/common/inputs/Payment';
import {cast} from '../../../src/common/utils/utils';
import {quietResolutionOf, seatResolution} from '../../parliament/parliamentArrange';
import {runAllActions} from '../../TestingUtils';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {replayBatch} from '../../../src/server/inputs/deferredInputBatch';
import {buildEventChildren} from '../../../src/client/components/journal/journalEventChild';
import {viewerImpactOfChain} from '../../../src/client/components/notifications/notificationSemantics';

/**
 * TR72 — BANNED DELEGATE:redux: the chairman takes ANY ONE delegate off a resolution or out of a Popular Support
 * area (the shared step `RemoveDelegate`, pinned on its own by tests/parliament/RemoveDelegate.spec.ts). Every
 * rule reading of the card file's header is pinned here, and the preview's promise is held to the play's result.
 */
const G = PartyName.GREENS;
const M = PartyName.MARS;
const I = PartyName.INDUSTRIALISTS;

type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, parliament: Parliament, card: BannedDelegateRedux};

/**
 * A quiet Redux table, p1 in the chair: Greens p2 p2 p1 (p2 leads), Mars First one neutral vote, Industrialists
 * empty; Mars First's support area holds 1.
 */
function table(): Table {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  const parliament = game.parliament!;
  ([G, M, I] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
  for (const party of REDUX_PARTIES) {
    parliament.popularSupport.set(party, 0);
  }
  parliament.lobby.clear();
  const [green, mars] = parliament.slots;
  parliament.placeVote(p2, green, 'reserve');
  parliament.placeVote(p2, green, 'reserve');
  parliament.placeVote(p1, green, 'reserve');
  parliament.addNeutralVote(mars);
  parliament.popularSupport.set(M, 1);
  parliament.chairman = p1.id;
  const card = new BannedDelegateRedux();
  p1.cardsInHand.push(card);
  p1.megaCredits = 0;
  return {game, p1, p2, parliament, card};
}

/** An EMPTY table: no vote anywhere, every area empty — p1 in the chair. */
function emptyTable(): Table {
  const t = table();
  for (const slot of t.parliament.slots) {
    slot.votes.length = 0;
  }
  t.parliament.popularSupport.set(M, 0);
  return t;
}

function playToPrompt(t: Table): SelectPartyDelegate {
  t.p1.playCard(t.card, Payment.EMPTY);
  runAllActions(t.game);
  return cast(t.p1.getWaitingFor(), SelectPartyDelegate);
}

function doorOf(t: Table): StagedDelegateModel | undefined {
  const step = cardPlayPreview(t.p1, t.card).branches[0].steps.find((s) => s.kind === 'delegateRemoval');
  return (step as Extract<ActionPreviewStep, {kind: 'delegateRemoval'}> | undefined)?.staged;
}

describe('BannedDelegateRedux', () => {
  describe('the card as printed', () => {
    it('an EVENT for 0, no tags, no VP, the CHAIRMAN plate, TR72 — «− [delegate]» in the any-player frame', () => {
      const card = new BannedDelegateRedux();
      expect(card.name).eq(CardName.BANNED_DELEGATE_REDUX);
      expect(card.name).eq('Banned Delegate:redux');
      expect(card.type).eq(CardType.EVENT);
      expect(card.cost).eq(0);
      expect(card.tags).deep.eq([]);
      expect(card.victoryPoints).is.undefined;
      expect(card.requirements).has.lengthOf(1);
      expect((card.requirements[0] as {chairman?: unknown}).chairman).eq(true);
      expect(card.metadata.cardNumber).eq('TR72');
      expect(replacementCardNumber(CardName.BANNED_DELEGATE)).eq('TR72');
      expect(card.metadata.reimplements).eq(CardName.BANNED_DELEGATE);
      expect(DELEGATES_REMOVED).eq(1);
      const rows = (card.metadata.renderData as unknown as {rows: Array<Array<ItemType>>}).rows;
      const items = rows[0].filter((node: ItemType) => isICardRenderItem(node)) as Array<ICardRenderItem>;
      expect(items.map((item) => [item.type, item.amount, item.anyPlayer === true])).deep.eq([[CardRenderItemType.DELEGATES, 1, true]]);
    });

    it('is the Redux deck\'s Banned Delegate: the replacement registered, the classic card removed', () => {
      expect(TURMOIL_REDUX_CARD_MANIFEST.projectCards[CardName.BANNED_DELEGATE_REDUX]).is.not.undefined;
      expect(TURMOIL_REDUX_CARD_MANIFEST.cardsToRemove.has(CardName.BANNED_DELEGATE)).is.true;
    });
  });

  describe('rule 1 — the requirement is the chair, NOW', () => {
    it('in the chair: playable, no reason', () => {
      const {p1, card} = table();
      expect(p1.canPlay(card)).is.true;
      expect(unplayableReasons(p1, card)).deep.eq([]);
    });

    it('another seat holds it: unplayable, the reason names the holder', () => {
      const {p1, p2, parliament, card} = table();
      parliament.chairman = p2.id;
      expect(p1.canPlay(card)).is.false;
      const reasons = unplayableReasons(p1, card);
      expect(reasons).has.lengthOf(1);
      expect(reasons[0]).deep.include({type: 'party', message: CHAIRMAN_REQUIREMENT_REASON, chairmanNow: {name: p2.name, color: p2.color}});
    });

    it('the chair is vacant: unplayable, «the chair is vacant»', () => {
      const {p1, parliament, card} = table();
      parliament.chairman = undefined;
      expect(p1.canPlay(card)).is.false;
      expect(unplayableReasons(p1, card)[0]).deep.include({type: 'party', message: CHAIRMAN_REQUIREMENT_REASON, chairmanNow: 'vacant'});
    });
  });

  describe('rules 2–4 — ANY one delegate, from a resolution or a support area', () => {
    it('the play asks the delegate pick over every figure, the card as the giver of an attack', () => {
      const t = table();
      const prompt = playToPrompt(t);
      const model = Server.getWaitingFor(t.p1, prompt) as SelectPartyModel;
      expect(model.delegatePrompt?.targets.map((r) => [r.place, r.party, r.owner])).deep.eq([
        ['resolution', G, t.p2.color],
        ['resolution', G, t.p1.color],
        ['resolution', M, 'neutral'],
        ['support', M, 'neutral'],
      ]);
      expect(model.choiceContext).deep.eq({source: {kind: 'card', card: CardName.BANNED_DELEGATE_REDUX}, mode: 'attack'});
      expect(t.parliament.chairman, 'the play does not spend the chair').eq(t.p1.id);
    });

    it('the LEADER\'s cube is a target (no «non-leader» clause): p2\'s latest goes home, the lead is re-read', () => {
      const t = table();
      playToPrompt(t);
      const reserve = t.parliament.reserve(t.p2);
      t.p1.process({type: 'party', partyName: G, delegate: {place: 'resolution', owner: t.p2.color}});
      runAllActions(t.game);
      expect(t.parliament.reserve(t.p2)).eq(reserve + 1);
      expect(t.parliament.votesOf(t.p2, t.parliament.slots[0])).eq(1);
      // 1–1: the EARLIER first delegate leads — p2's (they came first), so the lead is theirs still.
      expect(t.parliament.leaderOf(t.parliament.slots[0])?.owner).eq(t.p2.id);
      expect([...t.p1.tableau].map((c) => c.name)).includes(CardName.BANNED_DELEGATE_REDUX);
    });

    it('the player\'s OWN delegate, a neutral vote and a support cube are all targets', () => {
      const t = table();
      playToPrompt(t);
      t.p1.process({type: 'party', partyName: G, delegate: {place: 'resolution', owner: t.p1.color}});
      runAllActions(t.game);
      expect(t.parliament.votesOf(t.p1, t.parliament.slots[0])).eq(0);

      const u = table();
      const supply = u.parliament.neutralSupply();
      playToPrompt(u);
      u.p1.process({type: 'party', partyName: M, delegate: {place: 'support', owner: 'neutral'}});
      runAllActions(u.game);
      expect(u.parliament.popularSupportOf(M)).eq(0);
      expect(u.parliament.neutralSupply()).eq(supply + 1);
    });
  });

  describe('rule 5 — an empty table: the card is not played at all', () => {
    it('unplayable, with the named reason (an event whose only effect would hit nothing)', () => {
      const t = emptyTable();
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([{type: 'target', message: NO_DELEGATE_ON_TABLE_REASON}]);
      expect(RemoveDelegate.targetsOf(t.game, t.parliament)).deep.eq([]);
    });

    it('both blocks name themselves at once — no chair AND no figure', () => {
      const t = emptyTable();
      t.parliament.chairman = t.p2.id;
      expect(unplayableReasons(t.p1, t.card).map((r) => r.message)).deep.eq([CHAIRMAN_REQUIREMENT_REASON, NO_DELEGATE_ON_TABLE_REASON]);
    });
  });

  describe('rule 6 — the preview: the door IS the live prompt', () => {
    it('one staged door into the Parliament\'s delegate mode; title, figures, forecast and giver as the play asks them', () => {
      const t = table();
      const door = doorOf(t)!;
      expect(door.sourceCard).eq(CardName.BANNED_DELEGATE_REDUX);
      expect(cardPlayPreview(t.p1, t.card).branches[0].steps.map((s) => s.kind)).deep.eq(['delegateRemoval']);
      playToPrompt(t);
      const live = Server.getWaitingFor(t.p1, t.p1.getWaitingFor()) as SelectPartyModel;
      expect(door.prompt.title).deep.eq(live.title);
      expect(door.prompt.parties).deep.eq(live.parties);
      expect(door.prompt.delegatePrompt).deep.eq(live.delegatePrompt);
      expect(door.prompt.choiceContext).deep.eq(live.choiceContext);
    });

    it('the preview mutates nothing', () => {
      const t = table();
      const before = JSON.stringify(t.game.serialize());
      const events = t.game.events.events.length;
      cardPlayPreview(t.p1, t.card);
      expect(JSON.stringify(t.game.serialize())).eq(before);
      expect(t.game.events.events.length).eq(events);
    });

    it('the STAGED play is ONE batch: the play and the addressed delegate tail land together, nothing is asked again', () => {
      const t = table();
      t.p1.takeAction();
      const menu = cast(t.p1.getWaitingFor(), OrOptions);
      const index = menu.options.findIndex((o) => o.title === 'Play project card');
      replayBatch(t.p1, [
        {type: 'or', index, response: {type: 'projectCard', card: t.card.name, payment: Payment.EMPTY}},
        {type: 'party', partyName: G, delegate: {place: 'resolution', owner: t.p2.color}, stagedFor: CardName.BANNED_DELEGATE_REDUX},
      ]);
      expect(t.parliament.votesOf(t.p2, t.parliament.slots[0])).eq(1);
      expect(t.p1.getWaitingFor() instanceof SelectPartyDelegate).is.false;
    });
  });

  describe('the record — the journal row and the victim\'s notification', () => {
    it('the journal draws the ban as the VICTIM\'s row («[delegate] −1» · the resolution); the victim\'s band is hostile', () => {
      const t = table();
      playToPrompt(t);
      t.p1.process({type: 'party', partyName: G, delegate: {place: 'resolution', owner: t.p2.color}});
      runAllActions(t.game);
      const root = t.game.events.events.find((e) => e.type === 'action' && e.source?.kind === 'card' && e.source.card === CardName.BANNED_DELEGATE_REDUX)!.id;
      const chain = t.game.events.events.filter((e) => e.correlationId === root);
      const removed = chain.find((e) => e.type === 'delegate-removed')!;
      expect(removed.source).deep.include({kind: 'card', card: CardName.BANNED_DELEGATE_REDUX});
      const rows = buildEventChildren(chain, root, t.p1.color);
      const row = rows.find((r) => r.political?.kind === 'resolution');
      expect(row?.player).eq(t.p2.color);
      expect(row?.chips).deep.eq([{icon: 'delegate', text: '−1'}]);
      const victim = viewerImpactOfChain(chain, t.p2.color, t.p1.color);
      expect(victim.sign).eq('negative');
      expect(victim.losses).deep.eq([{icon: 'delegate', text: '−1'}]);
      expect(victim.attacker).eq(t.p1.color);
    });

    it('a neutral cube has no victim: nobody\'s band', () => {
      const t = table();
      playToPrompt(t);
      t.p1.process({type: 'party', partyName: M, delegate: {place: 'resolution', owner: 'neutral'}});
      runAllActions(t.game);
      const chain = t.game.events.events.filter((e) => e.type === 'delegate-removed');
      expect(chain[0].target).is.undefined;
      expect(viewerImpactOfChain(t.game.events.events, t.p2.color, t.p1.color).losses).deep.eq([]);
    });
  });

  it('save / load: the played event and the table without the cube survive', () => {
    const t = table();
    playToPrompt(t);
    t.p1.process({type: 'party', partyName: G, delegate: {place: 'resolution', owner: t.p2.color}});
    runAllActions(t.game);
    const live = Game.deserialize(structuredClone(t.game.serialize()));
    const again = live.getPlayerById(t.p1.id);
    const parliament = live.parliament!;
    expect([...again.tableau].map((c) => c.name)).includes(CardName.BANNED_DELEGATE_REDUX);
    expect(parliament.votesOf(t.p2.id, parliament.slots[0])).eq(1);
    expect(parliament.chairman).eq(again.id);
    expect(parliament.lastRemoval, 'a presentation record — never serialized').is.undefined;
    parliament.assertLedger(live);
  });
});

