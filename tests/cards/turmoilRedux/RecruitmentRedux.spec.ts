import {expect} from 'chai';
import {DELEGATES_EXCHANGED, RecruitmentRedux} from '../../../src/server/cards/turmoilRedux/RecruitmentRedux';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {NO_DELEGATE_IN_RESERVE_REASON, NO_NEUTRAL_ON_RESOLUTION_REASON, RemoveDelegate} from '../../../src/server/parliament/RemoveDelegate';
import {SelectPartyDelegate} from '../../../src/server/inputs/SelectPartyDelegate';
import {Server} from '../../../src/server/models/ServerModel';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {TURMOIL_REDUX_CARD_MANIFEST} from '../../../src/server/cards/turmoilRedux/TurmoilReduxCardManifest';
import {replacementCardNumber} from '../../../src/common/cards/turmoilReduxReplacements';
import {POLITICAL_DONATION_NO_DELEGATE_REASON} from '../../../src/server/cards/turmoilRedux/PoliticalDonation';
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
 * TR74 — RECRUITMENT:redux: a NEUTRAL delegate on a resolution is exchanged for one of the player's own from the
 * reserve (the shared step `RemoveDelegate {source: 'exchange'}`, pinned on its own by
 * tests/parliament/RemoveDelegate.spec.ts). Every rule reading of the card file's header is pinned here, and the
 * preview's promise is held to the play's result.
 */
const G = PartyName.GREENS;
const M = PartyName.MARS;
const I = PartyName.INDUSTRIALISTS;

type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, parliament: Parliament, card: RecruitmentRedux};

/**
 * A quiet Redux table: Greens p2 · neutral (p2 leads), Mars First neutral · neutral · p1 (p1 leads — a second cube
 * of p1's there opens the Mars First effect), Industrialists empty; Mars First's support area holds 2 (never a target).
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
  parliament.addNeutralVote(green);
  parliament.addNeutralVote(mars);
  parliament.addNeutralVote(mars);
  parliament.placeVote(p1, mars, 'reserve');
  parliament.popularSupport.set(M, 2);
  const card = new RecruitmentRedux();
  p1.cardsInHand.push(card);
  p1.megaCredits = 2;
  return {game, p1, p2, parliament, card};
}

function emptyReserve(t: Table): void {
  while (t.parliament.reserve(t.p1) > 0) {
    t.parliament.placeVote(t.p1, t.parliament.slots[2], 'reserve');
  }
}

function playToPrompt(t: Table): SelectPartyDelegate {
  t.p1.playCard(t.card, Payment.of({megacredits: 2}));
  runAllActions(t.game);
  return cast(t.p1.getWaitingFor(), SelectPartyDelegate);
}

function exchangeOn(t: Table, party: PartyName): void {
  t.p1.process({type: 'party', partyName: party, delegate: {place: 'resolution', owner: 'neutral'}});
  runAllActions(t.game);
}

function doorOf(t: Table): StagedDelegateModel | undefined {
  const step = cardPlayPreview(t.p1, t.card).branches[0].steps.find((s) => s.kind === 'delegateRemoval');
  return (step as Extract<ActionPreviewStep, {kind: 'delegateRemoval'}> | undefined)?.staged;
}

describe('RecruitmentRedux', () => {
  describe('the card as printed', () => {
    it('an EVENT for 2, no tags, no VP, no requirement, TR74 — «− [neutral delegate]* + [delegate]»', () => {
      const card = new RecruitmentRedux();
      expect(card.name).eq(CardName.RECRUITMENT_REDUX);
      expect(card.name).eq('Recruitment:redux');
      expect(card.type).eq(CardType.EVENT);
      expect(card.cost).eq(2);
      expect(card.tags).deep.eq([]);
      expect(card.victoryPoints).is.undefined;
      expect(card.requirements).has.lengthOf(0);
      expect(card.metadata.cardNumber).eq('TR74');
      expect(replacementCardNumber(CardName.RECRUITMENT)).eq('TR74');
      expect(card.metadata.reimplements).eq(CardName.RECRUITMENT);
      expect(DELEGATES_EXCHANGED).eq(1);
      const rows = (card.metadata.renderData as unknown as {rows: Array<Array<ItemType>>}).rows;
      const items = rows[0].filter((node: ItemType) => isICardRenderItem(node)) as Array<ICardRenderItem>;
      expect(items.map((item) => [item.type, item.amount, item.anyPlayer === true])).deep.eq([
        [CardRenderItemType.NEUTRAL_DELEGATE, 1, false],
        [CardRenderItemType.DELEGATES, 1, false],
      ]);
    });

    it('is the Redux deck\'s Recruitment: the replacement registered, the classic card removed', () => {
      expect(TURMOIL_REDUX_CARD_MANIFEST.projectCards[CardName.RECRUITMENT_REDUX]).is.not.undefined;
      expect(TURMOIL_REDUX_CARD_MANIFEST.cardsToRemove.has(CardName.RECRUITMENT)).is.true;
    });
  });

  describe('rule 1 — a NEUTRAL delegate on a RESOLUTION, nothing else', () => {
    it('the play asks the delegate pick over the neutral figures on the bills only, the card as the giver of a reward', () => {
      const t = table();
      const prompt = playToPrompt(t);
      const model = Server.getWaitingFor(t.p1, prompt) as SelectPartyModel;
      expect(model.delegatePrompt?.source).eq('exchange');
      expect(model.delegatePrompt?.targets.map((r) => [r.place, r.party, r.owner, r.count])).deep.eq([
        ['resolution', G, 'neutral', 1],
        ['resolution', M, 'neutral', 2],
      ]);
      expect(model.choiceContext).deep.eq({source: {kind: 'card', card: CardName.RECRUITMENT_REDUX}, mode: 'reward'});
    });

    it('no «non-leader» clause: a bill whose neutral cubes alone stand is a target too', () => {
      const t = table();
      t.parliament.addNeutralVote(t.parliament.slots[2]);
      const targets = RemoveDelegate.exchangeTargetsOf(t.p1, t.parliament);
      expect(targets.map((r) => r.party)).deep.eq([G, M, I]);
    });
  });

  describe('rules 2 and 4 — one operation: the neutral cube to the supply, mine from the reserve in its place', () => {
    it('from the RESERVE, free; the bill keeps its count, the leader is re-read', () => {
      const t = table();
      playToPrompt(t);
      const reserve = t.parliament.reserve(t.p1);
      const supply = t.parliament.neutralSupply();
      const green = t.parliament.slots[0];
      exchangeOn(t, G);
      expect(green.votes.map((v) => v.owner)).deep.eq([t.p2.id, t.p1.id]);
      expect(t.parliament.reserve(t.p1)).eq(reserve - 1);
      expect(t.parliament.neutralSupply()).eq(supply + 1);
      expect(t.p1.megaCredits, 'the card\'s 2 M€ only — the delegate is free').eq(0);
      // 1–1: p2's first delegate is the earlier one — the lead stays p2's.
      expect(t.parliament.leaderOf(green)?.owner).eq(t.p2.id);
      expect([...t.p1.tableau].map((c) => c.name)).includes(CardName.RECRUITMENT_REDUX);
      t.parliament.assertLedger(t.game);
    });

    it('a SECOND delegate of mine on the bill opens the party\'s effect — the forecast promised it', () => {
      const t = table();
      const prompt = playToPrompt(t);
      const model = Server.getWaitingFor(t.p1, prompt) as SelectPartyModel;
      const mars = model.delegatePrompt!.targets.find((r) => r.party === M)!;
      expect(mars.arrives).deep.eq({owner: t.p1.color, count: {current: 1, resulting: 2}});
      expect(mars.effectsGained).deep.eq([M]);
      expect(t.parliament.access(t.p1, M).byDelegates).is.false;
      exchangeOn(t, M);
      expect(t.parliament.access(t.p1, M).byDelegates).is.true;
    });

    it('the support area\'s neutral cubes are never touched', () => {
      const t = table();
      playToPrompt(t);
      exchangeOn(t, M);
      expect(t.parliament.popularSupportOf(M)).eq(2);
    });
  });

  describe('rule 3 — two named blockers, the table\'s first', () => {
    it('no neutral cube on any bill: unplayable, named', () => {
      const t = table();
      for (const slot of t.parliament.slots) {
        slot.votes.splice(0, slot.votes.length, ...slot.votes.filter((v) => v.owner !== 'NEUTRAL'));
      }
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([{type: 'target', message: NO_NEUTRAL_ON_RESOLUTION_REASON}]);
    });

    it('an empty reserve: unplayable, with TR03\'s key — and the table speaks first when both block', () => {
      const t = table();
      emptyReserve(t);
      expect(NO_DELEGATE_IN_RESERVE_REASON).eq(POLITICAL_DONATION_NO_DELEGATE_REASON);
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([{type: 'party', message: NO_DELEGATE_IN_RESERVE_REASON, current: 0}]);
      t.parliament.slots.forEach((slot) => slot.votes.splice(0, slot.votes.length, ...slot.votes.filter((v) => v.owner !== 'NEUTRAL')));
      expect(unplayableReasons(t.p1, t.card).map((r) => r.message)).deep.eq([NO_NEUTRAL_ON_RESOLUTION_REASON]);
    });

    it('a cube in the LOBBY does not lift the reserve\'s block (the lobby\'s cube is the generation\'s free vote)', () => {
      const t = table();
      emptyReserve(t);
      t.parliament.lobby.add(t.p1.id);
      expect(t.p1.canPlay(t.card)).is.false;
    });
  });

  describe('rule 5 — the preview: the door IS the live prompt', () => {
    it('the delegate leaving the reserve, then one staged door — title, figures, forecast and giver as the play asks them', () => {
      const t = table();
      const preview = cardPlayPreview(t.p1, t.card);
      const effects = preview.branches[0].effects;
      expect(effects.some((e) => e.icon === 'delegate' && e.direction === 'cost' && e.amount === 1)).is.true;
      const door = doorOf(t)!;
      expect(door.sourceCard).eq(CardName.RECRUITMENT_REDUX);
      playToPrompt(t);
      const live = Server.getWaitingFor(t.p1, t.p1.getWaitingFor()) as SelectPartyModel;
      expect(door.prompt.title).deep.eq(live.title);
      expect(door.prompt.parties).deep.eq(live.parties);
      expect(door.prompt.choiceContext).deep.eq(live.choiceContext);
      // The card's 2 M€ left between the preview and the ask — nothing the forecast reads.
      expect(door.prompt.delegatePrompt).deep.eq(live.delegatePrompt);
    });

    it('the preview mutates nothing', () => {
      const t = table();
      const before = JSON.stringify(t.game.serialize());
      const events = t.game.events.events.length;
      cardPlayPreview(t.p1, t.card);
      expect(JSON.stringify(t.game.serialize())).eq(before);
      expect(t.game.events.events.length).eq(events);
    });

    it('the STAGED play is ONE batch: the play and the addressed exchange land together, nothing is asked again', () => {
      const t = table();
      t.p1.takeAction();
      const menu = cast(t.p1.getWaitingFor(), OrOptions);
      const index = menu.options.findIndex((o) => o.title === 'Play project card');
      replayBatch(t.p1, [
        {type: 'or', index, response: {type: 'projectCard', card: t.card.name, payment: Payment.of({megacredits: 2})}},
        {type: 'party', partyName: G, delegate: {place: 'resolution', owner: 'neutral'}, stagedFor: CardName.RECRUITMENT_REDUX},
      ]);
      expect(t.parliament.votesOf(t.p1, t.parliament.slots[0])).eq(1);
      expect(t.parliament.neutralVotes(t.parliament.slots[0])).eq(0);
      expect(t.p1.getWaitingFor() instanceof SelectPartyDelegate).is.false;
    });
  });

  describe('the record — the journal and nobody\'s loss', () => {
    it('the journal draws two rows (the neutral cube gone · my delegate placed), and nobody\'s band is hostile', () => {
      const t = table();
      playToPrompt(t);
      exchangeOn(t, G);
      const root = t.game.events.events.find((e) => e.type === 'action' && e.source?.kind === 'card' && e.source.card === CardName.RECRUITMENT_REDUX)!.id;
      const chain = t.game.events.events.filter((e) => e.correlationId === root);
      expect(chain.find((e) => e.type === 'delegate-removed')?.target).is.undefined;
      expect(chain.some((e) => e.type === 'delegates-placed')).is.true;
      const rows = buildEventChildren(chain, root, t.p1.color).filter((r) => r.political?.kind === 'resolution');
      expect(rows).has.lengthOf(2);
      expect(viewerImpactOfChain(chain, t.p2.color, t.p1.color).losses).deep.eq([]);
      expect(t.game.gameLog.some((l) => l.message === '${0} exchanged a neutral delegate on ${1} for one of their own')).is.true;
    });
  });

  it('rule 6 — MarsBot\'s cubes are never targets (they are a seat\'s, not neutral)', () => {
    const t = table();
    const targets = RemoveDelegate.exchangeTargetsOf(t.p1, t.parliament);
    expect(targets.every((r) => r.owner === 'neutral')).is.true;
  });

  it('rule 7 — save / load: the played event and the exchanged table survive; the record is not serialized', () => {
    const t = table();
    playToPrompt(t);
    exchangeOn(t, G);
    const live = Game.deserialize(structuredClone(t.game.serialize()));
    const again = live.getPlayerById(t.p1.id);
    const parliament = live.parliament!;
    expect([...again.tableau].map((c) => c.name)).includes(CardName.RECRUITMENT_REDUX);
    expect(parliament.votesOf(again.id, parliament.slots[0])).eq(1);
    expect(parliament.neutralVotes(parliament.slots[0])).eq(0);
    expect(parliament.lastRemoval, 'a presentation record — never serialized').is.undefined;
    parliament.assertLedger(live);
  });
});
