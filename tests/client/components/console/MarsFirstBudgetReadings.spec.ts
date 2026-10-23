import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {PartyName} from '@/common/turmoil/PartyName';
import {Resource} from '@/common/Resource';
import {Tag} from '@/common/cards/Tag';
import {
  ParliamentEnactedModel, ParliamentEnactOutcomeModel, ParliamentModel, ParliamentPhaseSummaryModel, ParliamentPlayerModel,
} from '@/common/models/ParliamentModel';
import {levyNetEffectOf} from '@/common/parliament/resolutionLevy';
import {TILE_GRANT_NO_SPACE_REASON} from '@/common/parliament/tileGrant';
import ConsoleTileGrant from '@/client/components/console/parliament/ConsoleTileGrant.vue';
import {voteLevyOf, voteYieldsOf, yieldCountPresentation} from '@/client/console/parliament/influenceYieldModel';
import {voteReadingOf} from '@/client/console/parliament/voteInfoModel';
import {voteLedgerOf} from '@/client/console/parliament/voteLedgerModel';
import {familyOf} from '@/client/console/parliament/resolutionFamily';
import {tileGrantCaptionOf, tileGrantDetailOf, tileGrantReadingOf, tileGrantRecipientsKey, tileGrantWhereKey} from '@/client/console/parliament/tileGrantModel';
import {BOT_POLITICS_NOTE} from '@/client/console/parliament/seatParliamentReading';
import {getPartyEffect, getResolution} from '@/client/parliament/ClientParliamentManifest';

/**
 * MARS FIRST BUDGET (Turmoil Redux, RX38) — THE READINGS OF THE SIXTH BUDGET
 * and of the tile grant's SECOND variant. The card writes no reading of its
 * own; what is pinned here is that the shipped ones compose:
 *  · the NET line is the LEVY's (RX15) on the M€ payout, and the count
 *    explains itself with the PRINTED building and Mars tags;
 *  · the CITY is its own row, never added to the money: «you place a city
 *    tile» on «any legal space» — no influence line, no star, no count of
 *    cells, no stack (every one of those is Skyscrapers' and only Skyscrapers');
 *  · the ruling party's ANSWER rides beside the city (Р3: +1 steel, +1 card —
 *    Mars First's declared answer to a tile), for a human seat only;
 *  · MarsBot stands in the ledger with the TILE alone (D11) — never a payout —
 *    and only under a law that grants the seats a tile;
 *  · the bot's one line in the Information zone says it places such tiles.
 */
const BUDGET_ID = 'RDX_MARS_MARS_FIRST_BUDGET';
const SKYSCRAPERS_ID = 'RDX_MARS_SKYSCRAPERS';
const GREENS_BUDGET_ID = 'RDX_GREENS_GREENS_BUDGET';
const BLUE = 'blue' as Color;
const RED = 'red' as Color;
const BOT = 'yellow' as Color;

const resolutionOf = (id: string) => {
  const resolution = getResolution(id);
  if (resolution === undefined) {
    throw new Error(`${id} is not in the client manifest`);
  }
  return resolution;
};

const BY_TAG = [{tag: Tag.BUILDING, count: 2}, {tag: Tag.MARS, count: 1}];

/** A human seat of the budget's table: Martian Roads (Mars + building) + Mine (building) = 3, and the supply the levy reads. */
function seat(color: Color, agenda: number, influence: number, held: number): ParliamentPlayerModel {
  return {
    color, participates: true, enactment: true, seatGrant: true, lobby: true, reserve: 6, onResolutions: 0, chairman: false, agenda, influence,
    access: [], partyActionUses: {}, resolutionActionUses: 0,
    counts: [
      {id: 'buildingMarsTags', count: 3, cards: [CardName.MARTIAN_ROADS, CardName.MINE], units: [2, 1], byTag: BY_TAG},
      {id: 'marsCities', count: 1, cards: [], units: []},
    ],
    stock: {[Resource.MEGACREDITS]: held},
  };
}

/** MarsBot under `'politics'`: delegates, no payout (D3), the tile (D11). */
function botSeat(influence: number): ParliamentPlayerModel {
  return {
    color: BOT, participates: true, enactment: false, seatGrant: true, lobby: true, reserve: 6, onResolutions: 0, chairman: false, agenda: 0, influence,
    access: [], partyActionUses: {}, resolutionActionUses: 0,
  };
}

function model(players: Array<ParliamentPlayerModel>, over: Partial<ParliamentModel> = {}): ParliamentModel {
  return {slots: [], rulingParty: PartyName.GREENS, popularSupport: {}, players, deckSize: 4, discardSize: 0, neutralSupply: 14, botMode: 'politics', ...over};
}

/** The table with `id` up for the vote in slot 0. */
function upForVote(id: string, players: Array<ParliamentPlayerModel>): ParliamentModel {
  return model(players, {slots: [{instance: `${id}#0`, resolution: id, party: resolutionOf(id).party, votes: []} as never]});
}

const ENACTED: ParliamentEnactedModel = {instance: `${BUDGET_ID}#0`, resolution: BUDGET_ID, party: PartyName.MARS};

function phase(outcomes: ReadonlyArray<ParliamentEnactOutcomeModel>): ParliamentPhaseSummaryModel {
  return {
    generation: 3, final: false,
    winner: {instance: ENACTED.instance, resolution: BUDGET_ID, party: PartyName.MARS, votes: 2},
    outcomes: [...outcomes], support: [], enacted: ENACTED, refreshed: [], lobbyRefilled: [],
  };
}

const t = {global: {mocks: {$t: (key: string) => key}}};

describe('Mars First Budget — the readings of the sixth budget and of the grant to everyone', () => {
  it('the shipped manifest declares a LEVY of 12 M€ first, the two-tag count + influence, and a CITY for everyone on any legal cell', () => {
    const law = resolutionOf(BUDGET_ID);
    expect(law.code).eq('RX38');
    expect(law.party).eq(PartyName.MARS);
    expect(law.levy).deep.eq({resource: Resource.MEGACREDITS, amount: 12, recipient: 'each'});
    const [mc] = law.scaled ?? [];
    expect(mc.count).deep.eq({id: 'buildingMarsTags', per: 1});
    expect(levyNetEffectOf(law.levy!, law.scaled)).eq(mc);
    expect(law.tileGrant).deep.eq({tile: 'city', placement: 'any-legal', recipients: {kind: 'everyone'}});
    expect(law.quest).deep.eq({goal: {kind: 'tag', tag: Tag.MARS}, count: 2});
    expect(familyOf(law), 'a budget — a grant to everyone qualifies nobody').eq('counted-tags');
    expect(familyOf(resolutionOf(SKYSCRAPERS_ID)), 'the threshold grant keeps its own family').eq('tile-grant');
    // Р3's data: Mars First declares its answer to a tile beside the hook that pays it.
    expect(getPartyEffect(PartyName.MARS)?.tileAnswer).deep.eq({perTile: {resource: Resource.STEEL, amount: 1}, cityCards: 1});
  });

  it('the count explains itself with the PRINTED building and Mars tags', () => {
    expect(yieldCountPresentation('buildingMarsTags')).deep.eq({
      glyph: {kind: 'tags', tags: [Tag.BUILDING, Tag.MARS]},
      pluralKey: '${0} building and Mars tag(s)',
      skipReasonKey: 'No building or Mars tags and no influence',
    });
  });

  it('the vote: the NET line in M€ is the one number, the city its own row — «every player places one» on any legal space, with Mars First\'s answer beside it', () => {
    const law = resolutionOf(BUDGET_ID);
    const m = upForVote(BUDGET_ID, [seat(BLUE, 3, 2, 34), seat(RED, 1, 1, 20)]);
    const levy = voteLevyOf(law, m, BLUE)!;
    expect(levy).deep.include({resource: Resource.MEGACREDITS, paid: 12});
    expect(levy.net, '−12 → +(3 tags + influence 2) = −7').eq(-7);
    expect(voteYieldsOf(law, m, BLUE).some((y) => y.effect.id === 'megacredits')).is.true;
    const grant = tileGrantReadingOf(law, m, BLUE)!;
    expect(grant).deep.include({context: 'conditional', eligibility: 'everyone', influence: 2});
    expect(grant.cities, 'a grant by the usual rules counts no cells').is.undefined;
    expect(grant.answer).deep.eq({party: PartyName.MARS, perTile: {resource: Resource.STEEL, amount: 1}, cards: 1});
    expect(tileGrantCaptionOf(grant), 'the tile name stands beside it — the caption never repeats it').deep.eq({key: 'Every player places one'});
    expect(tileGrantCaptionOf(grant, 'they')).deep.eq({key: 'Every player places one'});
    expect(tileGrantDetailOf(grant), 'no destinations to count, no stack').is.undefined;
    expect(tileGrantWhereKey(grant.grant)).eq('on any legal space on Mars');
    expect(tileGrantRecipientsKey(grant.grant)).deep.eq({key: 'Every player, clockwise from the first player', params: []});
    const reading = voteReadingOf(law, m, BLUE, []);
    expect(reading.grant?.eligibility).eq('everyone');
    expect(reading.yields.length).is.greaterThan(0);
  });

  it('the record: a placed city names no stack; a skipped one reads its reason and carries no answer', () => {
    const law = resolutionOf(BUDGET_ID);
    const placed: ParliamentEnactOutcomeModel = {player: BLUE, step: 'city', part: 'effect', kind: 'city', influence: 2, space: '35'};
    const m = model([seat(BLUE, 3, 2, 34), seat(RED, 1, 1, 20)], {phase: {...phase([placed]), step: 'effects'} as never});
    const applied = tileGrantReadingOf(law, m, BLUE)!;
    expect(applied).deep.include({context: 'applied', eligibility: 'everyone'});
    expect(applied.placed).deep.eq({space: '35'});
    expect(tileGrantCaptionOf(applied)).deep.eq({key: 'You placed it'});
    expect(tileGrantCaptionOf(applied, 'they')).deep.eq({key: 'Placed'});
    expect(tileGrantDetailOf(applied), 'a new city is no stack').is.undefined;
    expect(applied.answer?.party).eq(PartyName.MARS);
    const skipped: ParliamentEnactOutcomeModel = {player: BLUE, step: 'city', part: 'effect', kind: 'skipped', influence: 2, reason: TILE_GRANT_NO_SPACE_REASON};
    const n = model([seat(BLUE, 3, 2, 34)], {phase: {...phase([skipped]), step: 'effects'} as never});
    const none = tileGrantReadingOf(law, n, BLUE)!;
    expect(tileGrantCaptionOf(none)).deep.eq({key: TILE_GRANT_NO_SPACE_REASON});
    expect(none.answer, 'no tile, no answer').is.undefined;
  });

  it('the LEDGER: MarsBot stands with the TILE alone under a grant (D11) — never a payout — and not at all under a law that only pays', () => {
    const players = [seat(BLUE, 3, 2, 34), seat(RED, 1, 1, 20), botSeat(1)];
    const chips = voteLedgerOf({resolution: resolutionOf(BUDGET_ID), model: upForVote(BUDGET_ID, players), viewer: BLUE, players: []});
    expect(chips.map((c) => c.color)).deep.eq([BLUE, RED, BOT]);
    const bot = chips.find((c) => c.color === BOT)!;
    expect(bot.parts).deep.eq([{key: 'tile', kind: 'tile', tone: 'gain'}]);
    const blue = chips.find((c) => c.color === BLUE)!;
    expect(blue.parts.map((p) => p.key), 'the net in M€, then the city').deep.eq(['megacredits', 'tile']);
    // A law that pays and grants no tile: the bot is not in the row (D3).
    const greens = voteLedgerOf({resolution: resolutionOf(GREENS_BUDGET_ID), model: upForVote(GREENS_BUDGET_ID, players), viewer: BLUE, players: []});
    expect(greens.map((c) => c.color)).not.includes(BOT);
  });

  it('Skyscrapers: the bot\'s chip follows the RECIPIENTS rule (Р5) — influence 2 is a tier, influence 1 nothing', () => {
    const law = resolutionOf(SKYSCRAPERS_ID);
    const withBot = (influence: number) => voteLedgerOf({
      resolution: law, model: upForVote(SKYSCRAPERS_ID, [seat(BLUE, 3, 2, 34), {...botSeat(influence), counts: [{id: 'marsCities', count: 1, cards: [], units: []}]}]),
      viewer: BLUE, players: [],
    }).find((c) => c.color === BOT);
    expect(withBot(2)?.parts).deep.eq([{key: 'tile', kind: 'tile', tone: 'gain'}]);
    expect(withBot(1)?.parts ?? []).deep.eq([]);
    // The bot's own reading carries no party answer — MarsBot ignores the ruling party.
    const botReading = tileGrantReadingOf(law, upForVote(SKYSCRAPERS_ID, [seat(BLUE, 3, 2, 34), botSeat(2)]), BOT);
    expect(botReading?.eligibility).eq('influence');
    expect(botReading?.answer).is.undefined;
  });

  it('the block: no winner\'s star, no arrow onto a base city — the tile, «any legal space», and the party\'s answer', () => {
    const law = resolutionOf(BUDGET_ID);
    const reading = tileGrantReadingOf(law, upForVote(BUDGET_ID, [seat(BLUE, 3, 2, 34)]), BLUE)!;
    const block = mount(ConsoleTileGrant, {props: {reading, variant: 'block'}, ...t});
    expect(block.find('.con-tgrant__star').exists(), 'the star is the winner\'s mark').is.false;
    expect(block.find('.con-tgrant__tile--base').exists(), 'no city to stack on').is.false;
    expect(block.find('[data-grant-where]').text()).contains('on any legal space on Mars');
    const root = block.find('[data-tile-grant]');
    expect(root.attributes('data-grant-placement')).eq('any-legal');
    expect(root.classes()).contains('con-tgrant--yours');
    const answer = block.find('[data-grant-answer]');
    expect(answer.exists()).is.true;
    expect(answer.attributes('data-grant-answer-party')).eq(PartyName.MARS);
    expect(answer.findAll('.con-tgrant__answer-amount').map((a) => a.text())).deep.eq(['+1', '+1']);
    // Skyscrapers keeps both of its marks.
    const sky = tileGrantReadingOf(resolutionOf(SKYSCRAPERS_ID), upForVote(SKYSCRAPERS_ID, [seat(BLUE, 3, 2, 34)]), BLUE)!;
    const tier = mount(ConsoleTileGrant, {props: {reading: sky, variant: 'block'}, ...t});
    expect(tier.find('.con-tgrant__star').exists()).is.true;
    expect(tier.find('.con-tgrant__tile--base').exists()).is.true;
  });

  it('the bot\'s one line in the Information zone says it carries out the deeds a law grants — a tile, a step of the Career (RX39\'s key)', () => {
    expect(BOT_POLITICS_NOTE).eq('MarsBot votes, completes chairman quests and takes the winner\'s reward. An enacted resolution never pays or charges it, but it carries out what a resolution grants every player: a tile, a step of the Career.');
  });
});
