import {expect} from 'chai';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {CardResource} from '@/common/CardResource';
import {PartyName} from '@/common/turmoil/PartyName';
import {ParliamentEnactOutcomeModel, ParliamentModel, ParliamentPlayerModel} from '@/common/models/ParliamentModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {
  countedHolderChanges, countedHoldersVp, noRecipientCompactNoteOf, noRecipientNoteOf, voteYieldsOf, yieldCountPresentation, yieldIconClasses,
  yieldIconOf, enactedYieldsOf,
} from '@/client/console/parliament/influenceYieldModel';
import {familyOf} from '@/client/console/parliament/resolutionFamily';
import {EACH_CARD_LIST_MAX, OWN_KIND_UNIT, resultsPayoutPart} from '@/client/console/parliament/parliamentResultsModel';
import {resolutionAnnotations} from '@/client/console/parliament/parliamentAnnotations';
import {sittingFieldOf} from '@/client/console/parliament/consoleSittingFlow';
import {
  detectNewTableReceipts, endTableReceipt, markReceiptSpecLanded, planReceiptRow, receiptArtTiers, receiptOf, releaseTableReceipts, resetTableReceiptBeat, seedTableReceipts,
  tableReceiptState, tableReceiptsOwed, takeTableReceipt,
} from '@/client/console/parliament/tableReceiptBeat';
import {clearPanelRewardHold, panelRewardHold} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {getResolution} from '@/client/parliament/ClientParliamentManifest';
import {holdersReadingOf} from '@/client/console/parliament/voteInfoModel';

/**
 * SPONSORED PROJECTS (Turmoil Redux, RX40) — THE READINGS of the first card payout that ASKS NOBODY, and the RECEIPT
 * OF THE TABLE that shows it. The card writes no reading of its own; pinned here:
 *  · the unit of NO declared kind draws as the face's «?» cube, the count as the holder glyph, and a zero is the
 *    count's own («No card of yours has a resource yet») — never a «no holder, forfeited» note;
 *  · the vote's «ДЛЯ ВАС» names every card with what one more makes of it («Fish 2 → 3») and the points it brings;
 *  · the results say on how many cards the payout landed, the names for a short list only;
 *  · the receipt is DETECTED off the phase's records (never a prompt), SEEDED in the apply block only while the
 *    sitting stands, holds the satellite and the capsules until each token lands, and lets everything go on release;
 *  · the field stands for an owed receipt; the row is solved from the pane — one line, the album's face at most.
 */
const SPONSORED_ID = 'RDX_SCIENTISTS_SPONSORED_PROJECTS';
const BLUE = 'blue' as Color;
const RED = 'red' as Color;

const resolutionOf = () => {
  const resolution = getResolution(SPONSORED_ID);
  if (resolution === undefined) {
    throw new Error('Sponsored Projects is not in the client manifest');
  }
  return resolution;
};

const BY_CARD = [
  {card: CardName.FISH, resource: CardResource.ANIMAL, count: 2, vp: {from: 2, to: 3}},
  {card: CardName.DIRIGIBLES, resource: CardResource.FLOATER, count: 1},
  {card: CardName.SUPERCOMPUTER, resource: CardResource.DATA, count: 3},
];

function seat(color: Color, agenda: number, influence: number, byCard = BY_CARD): ParliamentPlayerModel {
  return {
    color, participates: true, enactment: true, seatGrant: true, lobby: true, reserve: 6, onResolutions: 0, chairman: false, agenda, influence,
    access: [], partyActionUses: {}, resolutionActionUses: 0,
    counts: [{id: 'cardsWithResources', count: byCard.length, cards: byCard.map((e) => e.card), byCard}],
  };
}

function upForVote(players: Array<ParliamentPlayerModel>): ParliamentModel {
  return {
    slots: [{instance: `${SPONSORED_ID}#0`, resolution: SPONSORED_ID, party: PartyName.SCIENTISTS, votes: []} as never],
    rulingParty: PartyName.GREENS, popularSupport: {}, players, deckSize: 4, discardSize: 0, neutralSupply: 14, botMode: 'none',
  } as ParliamentModel;
}

function resourcesRecord(player: Color, cards: ReadonlyArray<{card: CardName, resource: CardResource, before: number, vp?: {from: number, to: number}}>): ParliamentEnactOutcomeModel {
  const kinds = new Set(cards.map((c) => c.resource));
  return {
    player, step: 'resources', part: 'effect', kind: 'cardResource', effect: 'resources', onto: 'each-counted', influence: 2,
    amount: cards.length, count: cards.length, counted: cards.map((c) => c.card),
    countedByCard: cards.map((c) => ({card: c.card, resource: c.resource, count: c.before, ...(c.vp === undefined ? {} : {vp: c.vp})})),
    cards: cards.map((c) => ({card: c.card, amount: 1, resource: c.resource, before: c.before, ...(c.vp === undefined ? {} : {vp: c.vp})})),
    ...(kinds.size === 1 ? {resource: cards[0].resource} : {}),
  } as ParliamentEnactOutcomeModel;
}

const THREE = [
  {card: CardName.FISH, resource: CardResource.ANIMAL, before: 2, vp: {from: 2, to: 3}},
  {card: CardName.DIRIGIBLES, resource: CardResource.FLOATER, before: 1},
  {card: CardName.SUPERCOMPUTER, resource: CardResource.DATA, before: 3},
];

function liveView(viewer: Color, outcomes: ReadonlyArray<ParliamentEnactOutcomeModel>, generation = 3): PlayerViewModel {
  return {
    thisPlayer: {color: viewer},
    game: {generation, parliament: {phase: {generation, final: false, step: 'effects', outcomes: [...outcomes],
      summary: {generation, seq: 4, support: [], refreshed: [], lobbyRefilled: [], outcomes: [...outcomes]}}}},
  } as unknown as PlayerViewModel;
}

describe('Sponsored Projects — the readings of a payout that asked nobody, and the receipt of the table', () => {
  afterEach(() => {
    resetTableReceiptBeat();
    clearPanelRewardHold();
  });

  it('the shipped manifest: a draw by influence, then one of its own kind onto every card with a resource — the each-card family', () => {
    const law = resolutionOf();
    expect(law.code).eq('RX40');
    const resources = (law.scaled ?? []).find((e) => e.id === 'resources')!;
    expect(resources.unit).deep.eq({kind: 'cardResource', resources: 'own-kind', onto: 'each-counted'});
    expect(resources.count).deep.eq({id: 'cardsWithResources', per: 1});
    expect(familyOf(law)).eq('each-card');
    expect(yieldCountPresentation('cardsWithResources')).deep.include({glyph: {kind: 'resource-card'}, skipReasonKey: 'No card of yours has a resource yet'});
    // The unit of no declared kind is the face's «?» cube — never a kind standing in for all.
    expect(yieldIconOf(resources)).deep.eq({family: 'own-kind-resource'});
    // The printed «?» is the existing WILD icon — never a cube with a «?» drawn over it.
    expect(yieldIconClasses(yieldIconOf(resources))).deep.eq(['resource_icon resource_icon--wild']);
  });

  it('the vote: the count is the server\'s cards, the amount one per card, no «forfeited» note — the dossier carries no «ДЛЯ ВАС»; the panel\'s own line names each card\'s change and the points', () => {
    const law = resolutionOf();
    const table = upForVote([seat(BLUE, 3, 2), seat(RED, 0, 0, [])]);
    const yields = voteYieldsOf(law, table, BLUE).filter((y) => y.context === 'estimate');
    const holders = yields.find((y) => y.effect.id === 'resources')!;
    expect(holders).deep.include({amount: 3, count: 3});
    expect(yields.find((y) => y.effect.id === 'draw')).deep.include({amount: 2, influence: 2});
    const resources = (law.scaled ?? []).find((e) => e.id === 'resources')!;
    expect(noRecipientNoteOf(resources, []), 'a unit of no declared kind is never «forfeited»').is.undefined;
    expect(noRecipientCompactNoteOf(resources, [])).is.undefined;
    expect(countedHolderChanges(holders, (name) => name)).deep.eq([`${CardName.FISH} 2 → 3`, `${CardName.DIRIGIBLES} 1 → 2`, `${CardName.SUPERCOMPUTER} 3 → 4`]);
    expect(countedHoldersVp(holders)).eq(1);
    // The dossier carries no «for you» block (texts 2026-10-23) — the holders' changes are the panel's line below.
    expect(resolutionAnnotations(SPONSORED_ID).some((block) => block.id === 'group:you')).is.false;
    // Another seat reads ITS OWN cards (the ledger's column) — red holds none: a zero, the count's own reason.
    const red = voteYieldsOf(law, table, RED).find((y) => y.context === 'estimate' && y.effect.id === 'resources');
    expect(red).deep.include({amount: 0, count: 0});
    // THE PANEL's own line: every holder with its kind and «before → after», the points summed; a seat with none, no line.
    expect(holdersReadingOf(yields)).deep.eq({
      rows: [
        {card: CardName.FISH, resource: CardResource.ANIMAL, before: 2, after: 3},
        {card: CardName.DIRIGIBLES, resource: CardResource.FLOATER, before: 1, after: 2},
        {card: CardName.SUPERCOMPUTER, resource: CardResource.DATA, before: 3, after: 4},
      ],
      vp: 1,
    });
    expect(holdersReadingOf(voteYieldsOf(law, table, RED))).is.undefined;
  });

  it('the record: the applied reading keeps the counted cards; the results say «on N cards», the names below the list\'s maximum', () => {
    const law = resolutionOf();
    const record = resourcesRecord(BLUE, THREE);
    const applied = enactedYieldsOf(law, {...upForVote([seat(BLUE, 3, 2)]), lastPhase: {
      generation: 3, final: false, winner: {instance: `${SPONSORED_ID}#0`, resolution: SPONSORED_ID, party: PartyName.SCIENTISTS, votes: 1},
      outcomes: [record], support: [], enacted: {instance: `${SPONSORED_ID}#0`, resolution: SPONSORED_ID, party: PartyName.SCIENTISTS}, refreshed: [], lobbyRefilled: [],
    }} as ParliamentModel, BLUE).find((y) => y.effect.id === 'resources')!;
    expect(applied.countedByCard?.map((e) => e.card)).deep.eq([CardName.FISH, CardName.DIRIGIBLES, CardName.SUPERCOMPUTER]);
    const part = resultsPayoutPart(record, 0);
    expect(part).deep.include({kind: 'cardResource', unit: OWN_KIND_UNIT, amount: 3, eachCard: 3});
    expect(part.cards?.map((c) => c.card)).deep.eq([CardName.FISH, CardName.DIRIGIBLES, CardName.SUPERCOMPUTER]);
    // One kind on every card: the unit names it — the «?» only where the cards took several.
    expect(resultsPayoutPart(resourcesRecord(BLUE, [THREE[0], {card: CardName.BIRDS, resource: CardResource.ANIMAL, before: 1}]), 0).unit).eq(CardResource.ANIMAL);
    // A long list stays in the receipt: «on 8 cards», no names.
    const eight = Array.from({length: EACH_CARD_LIST_MAX + 2}, (_, i) => ({card: [CardName.FISH, CardName.BIRDS, CardName.PETS, CardName.DIRIGIBLES, CardName.TARDIGRADES,
      CardName.SUPERCOMPUTER, CardName.ARKLIGHT, CardName.GHG_PRODUCING_BACTERIA][i], resource: CardResource.ANIMAL, before: 1}));
    const long = resultsPayoutPart(resourcesRecord(BLUE, eight), 0);
    expect(long.eachCard).eq(8);
    expect(long.cards).is.undefined;
  });

  it('DETECT: the viewer\'s NEW each-counted record of this response — never another seat\'s, never a known one, never a first view; a pick\'s payout is no receipt', () => {
    const record = resourcesRecord(BLUE, THREE);
    expect(detectNewTableReceipts(undefined, liveView(BLUE, [record])), 'a reload replays nothing').deep.eq([]);
    expect(detectNewTableReceipts(liveView(BLUE, [record]), liveView(BLUE, [record])), 'already known').deep.eq([]);
    expect(detectNewTableReceipts(liveView(BLUE, []), liveView(BLUE, [resourcesRecord(RED, THREE)])), 'another seat\'s').deep.eq([]);
    const picked = {...record, onto: undefined} as ParliamentEnactOutcomeModel;
    expect(detectNewTableReceipts(liveView(BLUE, []), liveView(BLUE, [picked])), 'a pick\'s payout is the picker\'s').deep.eq([]);
    const fresh = detectNewTableReceipts(liveView(BLUE, []), liveView(BLUE, [record]));
    expect(fresh).has.length(1);
    expect(fresh[0].cards.map((c) => [c.card, c.iconKey, c.before, c.amount])).deep.eq([
      [CardName.FISH, 'animal', 2, 1], [CardName.DIRIGIBLES, 'floater', 1, 1], [CardName.SUPERCOMPUTER, 'data', 3, 1],
    ]);
    expect(fresh[0].specs).deep.eq([
      {channel: 'card-resource', resource: 'animal', amount: 1, targetCard: CardName.FISH},
      {channel: 'card-resource', resource: 'floater', amount: 1, targetCard: CardName.DIRIGIBLES},
      {channel: 'card-resource', resource: 'data', amount: 1, targetCard: CardName.SUPERCOMPUTER},
    ]);
    expect(receiptOf({...record, cards: []} as ParliamentEnactOutcomeModel, 3), 'a payout that landed nothing shows nothing').is.undefined;
  });

  it('SEED on screen: owed, the capsules and the satellite held; each touchdown releases its own; the end lets the rest go — off screen nothing is held', () => {
    const before = liveView(BLUE, []);
    const after = liveView(BLUE, [resourcesRecord(BLUE, THREE)]);
    seedTableReceipts('3:4', before, after, false);
    expect(tableReceiptsOwed(), 'a parked sitting owes nothing').is.false;
    expect(panelRewardHold.capsule[CardName.FISH]).is.undefined;
    seedTableReceipts('3:4', before, after, true);
    expect(tableReceiptsOwed()).is.true;
    expect(panelRewardHold.capsule[CardName.FISH]).eq(1);
    expect(panelRewardHold.cardRes.animal).eq(1);
    seedTableReceipts('3:4', before, after, true);
    expect(tableReceiptState.owed, 'an echo frame seeds nothing twice').has.length(1);
    const receipt = takeTableReceipt()!;
    expect(tableReceiptState.showing).eq(receipt);
    expect(tableReceiptsOwed(), 'standing in the zone is still owed — the field holds').is.true;
    markReceiptSpecLanded(receipt.specs[0]);
    expect(panelRewardHold.capsule[CardName.FISH], 'Fish ticks on its touchdown').is.undefined;
    expect(panelRewardHold.capsule[CardName.DIRIGIBLES], 'Dirigibles still waits for its token').eq(1);
    endTableReceipt();
    expect(panelRewardHold.capsule[CardName.DIRIGIBLES], 'the end lets the rest go').is.undefined;
    expect(tableReceiptsOwed()).is.false;
  });

  it('RELEASE (a stage that ends unplayed, a new sitting): every held counter ticks at once', () => {
    seedTableReceipts('3:4', liveView(BLUE, []), liveView(BLUE, [resourcesRecord(BLUE, THREE)]), true);
    releaseTableReceipts();
    expect(tableReceiptsOwed()).is.false;
    expect(Object.keys(panelRewardHold.capsule)).deep.eq([]);
    seedTableReceipts('3:4', liveView(BLUE, []), liveView(BLUE, [resourcesRecord(BLUE, THREE)]), true);
    seedTableReceipts('4:5', liveView(BLUE, [], 4), liveView(BLUE, [], 4), true);
    expect(tableReceiptsOwed(), 'a new sitting drops what the old one owed').is.false;
  });

  it('THE FIELD stands for an owed receipt on the reward page — and nowhere else', () => {
    expect(sittingFieldOf('reward', 'received', false, false, false, true)).deep.eq({pose: true, stepOpen: false});
    expect(sittingFieldOf('reward', 'intake', false, false, false, true), 'the take still stands: field and door').deep.eq({pose: true, stepOpen: true});
    expect(sittingFieldOf('results', 'received', false, false, false, true)).deep.eq({pose: false, stepOpen: false});
  });

  it('THE ROW: one line solved from the pane — the album\'s face at most, eight cards draw closer and smaller, never wider than the pane', () => {
    const wide = planReceiptRow({availW: 2400, availH: 700, count: 3, ui: 1, tagH: 50});
    expect(wide.zoom, 'three cards on a roomy pane: capped at the scene\'s scale').eq(1.1);
    const eight = planReceiptRow({availW: 1500, availH: 600, count: 8, ui: 1, tagH: 50});
    expect(eight.zoom).lessThan(wide.zoom);
    expect(8 * 320 * eight.zoom + 7 * eight.gap).lessThan(1500 + 0.5);
    const short = planReceiptRow({availW: 3000, availH: 300, count: 2, ui: 2, tagH: 80});
    expect(460 * short.zoom + 80, 'a short pane is bound by its height').lessThan(300 + 0.5);
  });

  it('THE ART the seed warms is the tier a face may paint: the thumb at 1080, the full file too where a TV face outgrows it', () => {
    expect(receiptArtTiers(1)).deep.eq(['thumb']);
    expect(receiptArtTiers(2)).deep.eq(['thumb', 'full']);
  });
});
