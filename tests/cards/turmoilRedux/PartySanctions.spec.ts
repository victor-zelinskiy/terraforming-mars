import {expect} from 'chai';
import {PARTY_SANCTIONS_STEPS, PartySanctions} from '../../../src/server/cards/turmoilRedux/PartySanctions';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {SelectParty} from '../../../src/server/inputs/SelectParty';
import {Server} from '../../../src/server/models/ServerModel';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {CHAIRMAN_REQUIREMENT_REASON, unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {EMPTY_SUPPORT_AREA_REASON, EVERY_SUPPORT_AREA_EMPTY_REASON} from '../../../src/server/parliament/DiscardPopularSupport';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Phase} from '../../../src/common/Phase';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {POPULAR_SUPPORT_LABEL, REDUX_PARTIES} from '../../../src/common/parliament/ParliamentTypes';
import {CardRenderItemType} from '../../../src/common/cards/render/CardRenderItemType';
import {ICardRenderItem, ItemType, isICardRenderItem} from '../../../src/common/cards/render/Types';
import {ActionPreviewStep, StagedSupportModel} from '../../../src/common/models/ActionPreviewModel';
import {SelectPartyModel} from '../../../src/common/models/PlayerInputModel';
import {Payment} from '../../../src/common/inputs/Payment';
import {cast} from '../../../src/common/utils/utils';
import {quietResolutionOf, seatResolution} from '../../parliament/parliamentArrange';
import {runAllActions} from '../../TestingUtils';
import {buildEventChildren} from '../../../src/client/components/journal/journalEventChild';
import {recomputeRootImpact} from '../../../src/client/components/notifications/notificationModel';

/**
 * TR12 — PARTY SANCTIONS: the chairman strips ONE Popular Support area (the
 * shared step `DiscardPopularSupport`, pinned on its own by
 * tests/parliament/DiscardPopularSupport.spec.ts) and walks the Agenda one
 * step (the ONE walk, tests/parliament/AgendaWalk.spec.ts). Every rule reading
 * of the card file's header is pinned here, and the preview's promise is held
 * to the play's result.
 */
const M = PartyName.MARS;
const G = PartyName.GREENS;
const I = PartyName.INDUSTRIALISTS;

type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, parliament: Parliament, card: PartySanctions};

/**
 * A quiet Redux table: three resolutions up for a vote, the viewer (p1) in the
 * chair, the Agenda marker on step 3 (the next step pays TR), the support
 * areas holding exactly `support`.
 */
function table(support: Partial<Record<PartyName, number>> = {[M]: 3, [G]: 1}, position: number = 3): Table {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  const parliament = game.parliament!;
  ([G, M, I] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
  for (const party of REDUX_PARTIES) {
    parliament.popularSupport.set(party, support[party] ?? 0);
  }
  parliament.chairman = p1.id;
  parliament.agenda.set(p1.id, position);
  const card = new PartySanctions();
  p1.cardsInHand.push(card);
  p1.megaCredits = 20;
  return {game, p1, p2, parliament, card};
}

function play(t: Table): void {
  t.p1.playCard(t.card, Payment.of({megacredits: 2}));
  runAllActions(t.game);
}

function playToPrompt(t: Table): SelectParty {
  play(t);
  return cast(t.p1.getWaitingFor(), SelectParty);
}

function answer(t: Table, party: PartyName): void {
  t.p1.process({type: 'party', partyName: party});
  runAllActions(t.game);
}

function doorOf(t: Table): StagedSupportModel | undefined {
  const step = cardPlayPreview(t.p1, t.card).branches[0].steps.find((s) => s.kind === 'supportDiscard');
  return (step as Extract<ActionPreviewStep, {kind: 'supportDiscard'}> | undefined)?.staged;
}

const DISCARD_LINE = '${0} discarded ${1} neutral delegate(s) from the Popular Support of ${2} (0/${3})';
const ADVANCE_LINE = '${0} advances on the Agenda track to step ${1}';

describe('PartySanctions', () => {
  describe('the card as printed', () => {
    it('is an EVENT for 2 with no tags, no VP, the CHAIRMAN requirement, TR12 — «−ALL [neutral]* · [step]»', () => {
      const card = new PartySanctions();
      expect(card.type).eq(CardType.EVENT);
      expect(card.cost).eq(2);
      expect(card.tags).deep.eq([]);
      expect(card.victoryPoints).is.undefined;
      expect(card.requirements).has.lengthOf(1);
      expect((card.requirements[0] as {chairman?: unknown}).chairman).eq(true);
      expect(card.metadata.cardNumber).eq('TR12');
      expect(PARTY_SANCTIONS_STEPS).eq(1);
      const rows = (card.metadata.renderData as unknown as {rows: Array<Array<ItemType>>}).rows;
      expect(rows).has.lengthOf(1);
      const items = rows[0].filter((node: ItemType) => isICardRenderItem(node)) as Array<ICardRenderItem>;
      expect(items.map((item) => [item.type, item.amount])).deep.eq([
        [CardRenderItemType.TEXT, -1], [CardRenderItemType.NEUTRAL_DELEGATE, 1], [CardRenderItemType.AGENDA_STEP, 1],
      ]);
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
      expect(unplayableReasons(p1, card)).deep.eq([{
        type: 'party', message: CHAIRMAN_REQUIREMENT_REASON, chairmanNow: {name: p2.name, color: p2.color},
        requirement: true, requirementKey: 'req:Chairman',
      }]);
    });

    it('the chair is vacant: unplayable, «the chair is vacant»', () => {
      const {p1, parliament, card} = table();
      parliament.chairman = undefined;
      expect(p1.canPlay(card)).is.false;
      expect(unplayableReasons(p1, card)[0]).deep.include({chairmanNow: 'vacant'});
    });
  });

  describe('rules 2–3 — ONE area, every neutral delegate in it, nothing else', () => {
    it('the play asks a SelectParty over the CANDIDATES, marked with all six areas and the card as giver', () => {
      const t = table();
      const prompt = playToPrompt(t);
      expect(prompt.parties).deep.eq([G, M]);
      expect(prompt.choiceContext?.source).deep.eq({kind: 'card', card: CardName.PARTY_SANCTIONS});
      const areas = prompt.supportPrompt!.areas;
      expect(areas.map((a) => a.party)).deep.eq([...REDUX_PARTIES]);
      expect(areas.find((a) => a.party === M)).deep.eq({party: M, current: 3, resulting: 0, available: true});
      expect(areas.filter((a) => !a.available).every((a) => a.reason === EMPTY_SUPPORT_AREA_REASON)).is.true;
      expect(areas.filter((a) => a.available)).has.lengthOf(2);
      expect(t.parliament.agendaOf(t.p1), 'nothing walks before the answer').eq(3);
    });

    it('the answer empties THAT area into the common supply; votes, players\' delegates and the chair are untouched', () => {
      const t = table();
      t.parliament.slots[0].votes.push({owner: 'NEUTRAL', seq: ++t.parliament.voteSeq});
      t.parliament.placeVote(t.p2, t.parliament.slots[1], 'reserve');
      const supply = t.parliament.neutralSupply();
      const neutralVotes = t.parliament.neutralVotes();
      const p2Votes = t.parliament.votesOf(t.p2);
      const reserve = t.parliament.reserve(t.p1);
      playToPrompt(t);
      answer(t, M);
      expect(t.parliament.popularSupportOf(M)).eq(0);
      expect(t.parliament.popularSupportOf(G), 'one area only').eq(1);
      expect(t.parliament.neutralSupply()).eq(supply + 3);
      expect(t.parliament.neutralVotes(), 'a neutral VOTE is not support').eq(neutralVotes);
      expect(t.parliament.votesOf(t.p2), 'a player\'s delegate is not support').eq(p2Votes);
      expect(t.parliament.reserve(t.p1)).eq(reserve);
      expect(t.parliament.chairman, 'rule 7 — the card does not spend the chair').eq(t.p1.id);
      t.parliament.assertLedger(t.game);
    });

    it('the RULING party\'s area is an ordinary candidate when it holds a stock', () => {
      const t = table({});
      const ruler = t.parliament.rulingParty();
      t.parliament.popularSupport.set(ruler, 2);
      expect(playToPrompt(t).parties).deep.eq([ruler]);
      answer(t, ruler);
      expect(t.parliament.popularSupportOf(ruler)).eq(0);
    });
  });

  describe('rules 5–6 — then ONE step of the Agenda, in the same answer', () => {
    it('3 → 4 pays its TR; one walk record with the card as cause; the discard is logged BEFORE the step', () => {
      const t = table();
      const tr = t.p1.terraformRating;
      const at = t.game.gameLog.length;
      playToPrompt(t);
      answer(t, M);
      expect(t.parliament.agendaOf(t.p1)).eq(4);
      expect(t.p1.terraformRating).eq(tr + 1);
      expect(t.parliament.lastAdvance).deep.include({player: t.p1.id, from: 3, to: 4, reason: 'card', card: CardName.PARTY_SANCTIONS});
      expect(t.parliament.lastAdvance?.steps).deep.eq([{to: 4, bonus: 'tr'}]);
      const lines = t.game.gameLog.slice(at).map((e) => e.message).filter((m) => m === DISCARD_LINE || m === ADVANCE_LINE);
      expect(lines, 'the printed order: discard, then the step').deep.eq([DISCARD_LINE, ADVANCE_LINE]);
      expect([...t.p1.tableau].map((c) => c.name)).includes(CardName.PARTY_SANCTIONS);
    });

    it('the events of the chain: the discard, then the walk — both sourced by the CARD', () => {
      const t = table();
      playToPrompt(t);
      answer(t, M);
      const types = t.game.events.events.map((e) => e.type).filter((type) => type === 'popular-support-discarded' || type === 'agenda-advanced');
      expect(types).deep.eq(['popular-support-discarded', 'agenda-advanced']);
      const discarded = t.game.events.events.find((e) => e.type === 'popular-support-discarded')!;
      expect(discarded.impact.popularSupport).deep.eq({party: M, gained: -3, total: 0});
      expect(discarded.source).deep.include({kind: 'card', card: CardName.PARTY_SANCTIONS});
    });

    it('the journal draws the discard as the card\'s row («[neutral] −3» · the area 0/3); a rival\'s pills carry it', () => {
      const t = table();
      playToPrompt(t);
      answer(t, M);
      const root = t.game.events.events.find((e) => e.type === 'action' && e.source?.kind === 'card' && e.source.card === CardName.PARTY_SANCTIONS)!.id;
      const chain = t.game.events.events.filter((e) => e.correlationId === root);
      const rows = buildEventChildren(chain, root, t.p1.color);
      const support = rows.find((row) => row.political?.kind === 'support');
      expect(support?.chips).deep.eq([{icon: 'neutral-delegate', text: '−3'}]);
      expect(support?.political).deep.eq({kind: 'support', party: M, total: 0});
      expect(rows.some((row) => row.political?.kind === 'agenda'), 'the walk is its own row').is.true;
      const impact = recomputeRootImpact(t.game.events.events, root, t.p1.color, t.p2.color);
      const actor = impact.pillGroups.find((group) => group.scope === 'actor');
      expect(actor?.chips.map((chip) => `${chip.icon} ${chip.text}`)).to.include.members(['neutral-delegate −3', 'agenda +1', 'tr +1']);
    });

    it('the end of the track: the step is the walk\'s own named cut — the discard still happens', () => {
      const t = table(undefined, 12);
      const seq = t.parliament.lastAdvance?.seq;
      playToPrompt(t);
      answer(t, M);
      expect(t.parliament.popularSupportOf(M)).eq(0);
      expect(t.parliament.agendaOf(t.p1)).eq(12);
      expect(t.parliament.lastAdvance?.seq, 'no walk, no record').eq(seq);
      expect(t.game.gameLog.some((e) => e.message === '${0} is already at the end of the Agenda track')).is.true;
    });
  });

  describe('rule 4 — every area empty: the discard is a NAMED skip, the step stands', () => {
    it('nothing is asked, the skip is recorded, the walk happens in the same play', () => {
      const t = table({});
      play(t);
      expect(t.p1.getWaitingFor()).is.undefined;
      expect(t.parliament.agendaOf(t.p1)).eq(4);
      const skipped = t.game.events.events.filter((e) => e.type === 'effect-skipped').map((e) => e.impact.skipped);
      expect(skipped).deep.eq([{label: POPULAR_SUPPORT_LABEL, reason: EVERY_SUPPORT_AREA_EMPTY_REASON}]);
    });

    it('the preview says so BEFORE the play: the named skip, no door — and the walk step', () => {
      const t = table({});
      const steps = cardPlayPreview(t.p1, t.card).branches[0].steps;
      expect(steps.map((s) => s.kind)).deep.eq(['note', 'agendaWalk']);
      expect(steps[0]).deep.include({noteKind: 'warning', text: EVERY_SUPPORT_AREA_EMPTY_REASON, skipped: {label: POPULAR_SUPPORT_LABEL}});
    });
  });

  describe('the preview — the door and the walk, read before the press', () => {
    it('the door IS the live prompt (title, candidates, the six areas, the giver), then the walk 3 → 4 with its TR chip', () => {
      const t = table();
      const door = doorOf(t)!;
      expect(door.sourceCard).eq(CardName.PARTY_SANCTIONS);
      const preview = cardPlayPreview(t.p1, t.card);
      expect(preview.branches[0].steps.map((s) => s.kind)).deep.eq(['supportDiscard', 'agendaWalk']);
      expect(preview.branches[0].effects.map((e) => e.icon)).deep.eq(['agenda', 'tr']);
      playToPrompt(t);
      const live = Server.getWaitingFor(t.p1, t.p1.getWaitingFor()) as SelectPartyModel;
      expect(door.prompt.title).deep.eq(live.title);
      expect(door.prompt.parties).deep.eq(live.parties);
      expect(door.prompt.supportPrompt).deep.eq(live.supportPrompt);
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
  });

  it('save / load: the played event, the emptied area and the walked marker survive', () => {
    const t = table();
    playToPrompt(t);
    answer(t, M);
    const live = Game.deserialize(structuredClone(t.game.serialize()));
    const again = live.getPlayerById(t.p1.id);
    const parliament = live.parliament!;
    expect([...again.tableau].map((c) => c.name)).includes(CardName.PARTY_SANCTIONS);
    expect(parliament.popularSupportOf(M)).eq(0);
    expect(parliament.agendaOf(again)).eq(4);
    expect(parliament.chairman).eq(again.id);
    parliament.assertLedger(live);
  });
});
