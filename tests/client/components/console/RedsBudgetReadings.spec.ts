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
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {AGENDA_GRANT_END_OF_TRACK_REASON, AGENDA_GRANT_STEP_KEY} from '@/common/parliament/agendaGrant';
import {levyNetEffectOf} from '@/common/parliament/resolutionLevy';
import ConsoleAgendaGrant from '@/client/components/console/parliament/ConsoleAgendaGrant.vue';
import {voteLevyOf, voteYieldsOf, yieldCountPresentation} from '@/client/console/parliament/influenceYieldModel';
import {voteReadingOf} from '@/client/console/parliament/voteInfoModel';
import {ledgerPartText, voteLedgerOf} from '@/client/console/parliament/voteLedgerModel';
import {familyOf} from '@/client/console/parliament/resolutionFamily';
import {agendaGrantCaptionOf, agendaGrantReadingOf, agendaGrantWinKey} from '@/client/console/parliament/agendaGrantModel';
import {resultsPayoutPart} from '@/client/console/parliament/parliamentResultsModel';
import {parliamentBandLine} from '@/client/console/parliament/parliamentBand';
import {careerGrantState, careerWalkBonuses, detectNewCareerWalks, resetCareerGrantBeat, seedCareerGrantWalks} from '@/client/console/parliament/careerGrantBeat';
import {parliamentHolds, resetParliamentHolds} from '@/client/console/parliament/parliamentDisplayHolds';
import {detectAgendaWalk} from '@/client/console/parliament/agendaWalk';
import {resolutionAnnotations} from '@/client/console/parliament/parliamentAnnotations';
import {getResolution} from '@/client/parliament/ClientParliamentManifest';

/**
 * REDS BUDGET (Turmoil Redux, RX39) — THE READINGS OF THE LAST BUDGET and of
 * the second deed a law hands the seats: a STEP OF THE CAREER for everyone.
 * The card writes no reading of its own; what is pinned here is that the
 * shipped ones compose and that the new one reads the printed track:
 *  · the NET line is the LEVY's (RX15) on the M€ payout, and the count
 *    explains itself with the PRINTED space and Mars tags (the asteroids lie
 *    face down — named by the count's own rule);
 *  · the STEP is its own row, never added to the money: the next node and its
 *    gift (TR · card · level), «+2 шага» for a winner, the end of the track
 *    named before the vote;
 *  · MarsBot stands in the ledger with the STEP alone (D11) and its card step
 *    reads as 1 M€; the results print «3 → 4» with what it paid;
 *  · the sitting's beat plays the PHASE'S records seat by seat (never
 *    `lastAdvance`) and the card-walk detector stays silent for the law.
 */
const BUDGET_ID = 'RDX_REDS_REDS_BUDGET';
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

const BY_TAG = [{tag: Tag.SPACE, count: 2}, {tag: Tag.MARS, count: 1}];

/** A human seat: Mars Army Ships (Mars + space) + Satellites (space) = 3, the supply the levy reads, the marker at `agenda`. */
function seat(color: Color, agenda: number, influence: number, held: number): ParliamentPlayerModel {
  return {
    color, participates: true, enactment: true, seatGrant: true, lobby: true, reserve: 6, onResolutions: 0, chairman: false, agenda, influence,
    access: [], partyActionUses: {}, resolutionActionUses: 0,
    counts: [{id: 'spaceMarsTags', count: 3, cards: [CardName.MARS_ARMY_SHIPS, CardName.SATELLITES], units: [2, 1], byTag: BY_TAG}],
    stock: {[Resource.MEGACREDITS]: held},
  };
}

/** MarsBot under `'politics'`: delegates, PAID like every seat (D16 — its own counts), the step (D11). */
function botSeat(agenda: number, influence: number): ParliamentPlayerModel {
  return {
    color: BOT, participates: true, enactment: true, everyUnitLands: true, noPartyEffects: true, seatGrant: true, lobby: true, reserve: 6, onResolutions: 0, chairman: false, agenda, influence,
    stock: {[Resource.MEGACREDITS]: 20},
    counts: [{id: 'spaceMarsTags', count: 5, cards: []}],
    access: [], partyActionUses: {}, resolutionActionUses: 0,
  };
}

function model(players: Array<ParliamentPlayerModel>, over: Partial<ParliamentModel> = {}): ParliamentModel {
  return {slots: [], rulingParty: PartyName.GREENS, popularSupport: {}, players, deckSize: 4, discardSize: 0, neutralSupply: 14, botMode: 'politics', ...over};
}

function upForVote(players: Array<ParliamentPlayerModel>): ParliamentModel {
  return model(players, {slots: [{instance: `${BUDGET_ID}#0`, resolution: BUDGET_ID, party: PartyName.REDS, votes: []} as never]});
}

const ENACTED: ParliamentEnactedModel = {instance: `${BUDGET_ID}#0`, resolution: BUDGET_ID, party: PartyName.REDS};

function lastPhase(outcomes: ReadonlyArray<ParliamentEnactOutcomeModel>): ParliamentPhaseSummaryModel {
  return {
    generation: 3, final: false,
    winner: {instance: ENACTED.instance, resolution: BUDGET_ID, party: PartyName.REDS, votes: 2},
    outcomes: [...outcomes], support: [], enacted: ENACTED, refreshed: [], lobbyRefilled: [],
  };
}

function walkRecord(player: Color, from: number, steps: ReadonlyArray<{to: number, bonus?: 'tr' | 'card'}>, over: Partial<ParliamentEnactOutcomeModel> = {}): ParliamentEnactOutcomeModel {
  return {player, step: AGENDA_GRANT_STEP_KEY, part: 'effect', kind: 'agenda', influence: 1, amount: steps.length,
    walk: {from, to: steps[steps.length - 1].to, steps: [...steps]}, ...over};
}

/** A minimal view of a live sitting standing at `step` with `outcomes` — the shape the transport seeds against. */
function view(viewer: Color, outcomes: ReadonlyArray<ParliamentEnactOutcomeModel>, lastAdvance?: ParliamentModel['lastAdvance']): PlayerViewModel {
  return {
    thisPlayer: {color: viewer},
    game: {generation: 3, parliament: model([seat(BLUE, 4, 2, 5), botSeat(7, 3)], {
      phase: {generation: 3, final: false, step: 'adjourn', outcomes: [...outcomes], summary: {...lastPhase(outcomes), seq: 7}},
      ...(lastAdvance === undefined ? {} : {lastAdvance}),
    })},
  } as unknown as PlayerViewModel;
}

const t = {global: {mocks: {$t: (key: string) => key}}};

describe('Reds Budget — the readings of the last budget and of the step of the Career for everyone', () => {
  afterEach(() => {
    resetCareerGrantBeat();
    resetParliamentHolds();
  });

  it('the shipped manifest declares a LEVY of 10 M€ first, the two-tag count + influence, and ONE Career step for everyone', () => {
    const law = resolutionOf(BUDGET_ID);
    expect(law.code).eq('RX39');
    expect(law.party).eq(PartyName.REDS);
    expect(law.levy).deep.eq({resource: Resource.MEGACREDITS, amount: 10, recipient: 'each'});
    const mc = (law.scaled ?? []).find((e) => e.id === 'megacredits')!;
    expect(mc.count).deep.eq({id: 'spaceMarsTags', per: 1});
    expect(law.agendaGrant).deep.eq({steps: 1, recipients: {kind: 'everyone'}});
    expect(law.tileGrant).is.undefined;
    expect(familyOf(law), 'a budget — the step to everyone qualifies nobody').eq('counted-tags');
    expect(yieldCountPresentation('spaceMarsTags')).deep.eq({
      glyph: {kind: 'tags', tags: [Tag.SPACE, Tag.MARS]},
      pluralKey: '${0} space and Mars tag(s)',
      skipReasonKey: 'No space or Mars tags and no influence',
    });
    // The inspector prints the printed text alone (texts 2026-10-23): the step of the Career is the card's own sentence.
    const rules = resolutionAnnotations(BUDGET_ID);
    expect(rules.find((b) => b.id === 'group:immediate')?.rows.map((r) => r.text)).deep.eq([law.text.effect]);
    expect(law.text.effect).includes('Every player advances their Agenda marker 1 step.');
  });

  it('the NET line is the levy\'s on the M€ payout: 15 M€ − 10 + (3 tags + influence 2) = net −5', () => {
    const law = resolutionOf(BUDGET_ID);
    const table = upForVote([seat(BLUE, 3, 2, 15), seat(RED, 6, 3, 20)]);
    const levy = voteLevyOf(law, table, BLUE)!;
    expect(levy).deep.include({paid: 10, owed: 10, short: false});
    expect(levy.net).eq(-5);
    expect(levyNetEffectOf(law.levy!, law.scaled)?.id).eq('megacredits');
    const yields = voteYieldsOf(law, table, BLUE).filter((y) => y.context !== 'reference');
    expect(yields.find((y) => y.effect.id === 'megacredits')).deep.include({amount: 5, influence: 2, count: 3});
  });

  it('the STEP is its own reading: the next node and its gift — a TR, a card, a level — never added to the money', () => {
    const law = resolutionOf(BUDGET_ID);
    const tr = agendaGrantReadingOf(law, upForVote([seat(BLUE, 3, 2, 15)]), BLUE)!;
    expect(tr).deep.include({context: 'conditional', eligibility: 'everyone', position: 3});
    expect(tr.ahead).deep.eq([{to: 4, step: {kind: 'tr'}, level: 2}]);
    expect(tr.ifWin, 'the winner walks twice: its own step first').deep.eq([{to: 4, step: {kind: 'tr'}, level: 2}, {to: 5, step: {kind: 'influence', influence: 3}, level: 3}]);
    expect(agendaGrantWinKey(tr)).deep.eq({key: 'If you win: +${0} Career steps', params: ['2']});
    const card = agendaGrantReadingOf(law, upForVote([seat(BLUE, 6, 3, 15)]), BLUE)!;
    expect(card.ahead?.[0]).deep.eq({to: 7, step: {kind: 'card'}, level: 3});
    const end = agendaGrantReadingOf(law, upForVote([seat(BLUE, 12, 5, 15)]), BLUE)!;
    expect(end.ahead, 'the end of the track — nothing ahead').deep.eq([]);
    expect(end.ifWin).is.undefined;
    expect(agendaGrantCaptionOf(end)).deep.eq({key: 'You are already at the end of the Career'});
    expect(agendaGrantCaptionOf(end, 'they')).deep.eq({key: 'They are already at the end of the Career'});
    // The vote panel's reading carries it beside the yields.
    const reading = voteReadingOf(law, upForVote([seat(BLUE, 3, 2, 15)]), BLUE, []);
    expect(reading.career).deep.include({context: 'conditional', position: 3});
  });

  it('the graphic: the insignia, the numbered node, «+1 [TR]» — the bot\'s card step reads «+1 [card]» like every seat\'s (D16); the win\'s two nodes', () => {
    const law = resolutionOf(BUDGET_ID);
    const human = mount(ConsoleAgendaGrant, {props: {reading: agendaGrantReadingOf(law, upForVote([seat(BLUE, 3, 2, 15)]), BLUE)!, variant: 'block'}, ...t});
    expect(human.find('.career-step-glyph').exists(), 'the career insignia — never a star').is.true;
    expect(human.find('[data-agenda-step]').attributes('data-agenda-step-to')).eq('4');
    expect(human.find('[data-agenda-step]').attributes('data-agenda-step-gift')).eq('tr');
    expect(human.find('.con-agrant__node').text()).eq('4');
    expect(human.findAll('[data-agenda-win] [data-agenda-win-to]').map((w) => w.attributes('data-agenda-win-to'))).deep.eq(['4', '5']);
    const bot = mount(ConsoleAgendaGrant, {props: {reading: agendaGrantReadingOf(law, upForVote([botSeat(6, 3)]), BOT)!, variant: 'inline'}, ...t});
    expect(bot.find('[data-agenda-step]').attributes('data-agenda-step-gift')).eq('card');
    expect(bot.text(), 'no word about a substitute').not.contains('instead of a card');
  });

  it('the LEDGER: every seat a step, the bot with its MONEY and its STEP like every seat (D11 + D16); «✕» at the end of the track', () => {
    const law = resolutionOf(BUDGET_ID);
    const table = upForVote([seat(BLUE, 3, 2, 15), seat(RED, 12, 5, 20), botSeat(6, 3)]);
    const chips = voteLedgerOf({resolution: law, model: table, viewer: BLUE, players: []});
    expect(chips.map((c) => c.color)).deep.eq([BLUE, RED, BOT]);
    const career = (color: Color) => chips.find((c) => c.color === color)!.parts.find((p) => p.key === 'career')!;
    expect(ledgerPartText(career(BLUE))).eq('+1');
    expect(career(RED).tone).eq('lost');
    expect(ledgerPartText(career(RED))).eq('✕');
    expect(chips.find((c) => c.color === BOT)!.parts.map((p) => p.key), 'the bot\'s net in M€, then its step — as every seat').deep.eq(
      chips.find((c) => c.color === BLUE)!.parts.map((p) => p.key));
  });

  it('the RECORD: an applied reading and a results part «3 → 4» with what it paid; the bot\'s card like a player\'s; a skip names the end', () => {
    const law = resolutionOf(BUDGET_ID);
    const records = [
      walkRecord(BLUE, 3, [{to: 4, bonus: 'tr'}], {tr: 1}),
      walkRecord(BOT, 6, [{to: 7, bonus: 'card'}], {drawn: 1}),
      {player: RED, step: AGENDA_GRANT_STEP_KEY, part: 'effect' as const, kind: 'skipped' as const, influence: 5, amount: 0, walk: {from: 12, to: 12, steps: []}, reason: AGENDA_GRANT_END_OF_TRACK_REASON},
    ];
    const table = model([seat(BLUE, 4, 2, 5), seat(RED, 12, 5, 10), botSeat(7, 3)], {lastPhase: lastPhase(records), enacted: ENACTED});
    expect(agendaGrantReadingOf(law, table, BLUE)).deep.include({context: 'applied', position: 3, walked: {from: 3, to: 4, steps: [{to: 4, bonus: 'tr'}]}, tr: 1, generation: 3});
    expect(agendaGrantReadingOf(law, table, RED)).deep.include({context: 'applied', skipped: AGENDA_GRANT_END_OF_TRACK_REASON});
    expect(agendaGrantReadingOf(law, table, BOT)).deep.include({context: 'applied', drawn: 1});
    expect(resultsPayoutPart(records[0], 0)).deep.include({kind: 'agenda', walk: {from: 3, to: 4}, tr: 1});
    expect(resultsPayoutPart(records[1], 1)).deep.include({kind: 'agenda', walk: {from: 6, to: 7}, drawn: 1});
    expect(resultsPayoutPart(records[2], 2).skipped).deep.eq({title: 'Resolution effect', reason: AGENDA_GRANT_END_OF_TRACK_REASON});
  });

  it('the SITTING plays the PHASE\'S records seat by seat — never `lastAdvance`; the card-walk detector stays silent for the law', () => {
    const records = [walkRecord(BLUE, 3, [{to: 4, bonus: 'tr'}], {tr: 1}), walkRecord(BOT, 6, [{to: 7, bonus: 'card'}], {drawn: 1})];
    const last = {seq: 9, player: BOT, from: 6, to: 7, bonus: 'card' as const, steps: [{to: 7, bonus: 'card' as const}], reason: 'resolution' as const, resolution: BUDGET_ID, generation: 3};
    const before = view(BLUE, []);
    const after = view(BLUE, records, last);
    const walks = detectNewCareerWalks(before, after);
    expect(walks.map((w) => `${w.player}:${w.from}->${w.to}`)).deep.eq([`${BLUE}:3->4`, `${BOT}:6->7`]);
    expect(walks[0].viewer).is.true;
    expect(walks[1]).deep.include({viewer: false});
    // A reload (no before), an echo (the same records) owe nothing.
    expect(detectNewCareerWalks(undefined, after)).deep.eq([]);
    expect(detectNewCareerWalks(after, after)).deep.eq([]);
    // The card-walk detector plays `card` alone: the law's last walk is never played by it.
    expect(detectAgendaWalk(view(BOT, []), view(BOT, records, last))).is.undefined;
    // SEED: every walked marker held on its old step; the viewer's TR step owed to the ledger; nothing off screen.
    expect(seedCareerGrantWalks('3:7', before, after, false)).deep.eq([]);
    expect(parliamentHolds.agendaGrantAwaits.size).eq(0);
    const bonuses = seedCareerGrantWalks('3:7', before, after, true);
    expect(bonuses).deep.eq(careerWalkBonuses(walks[0]));
    expect(bonuses).deep.eq([{generation: 3, player: BLUE, step: 4, kind: 'tr', spec: {channel: 'stock', resource: 'rating', amount: 1}, career: true}]);
    expect([...parliamentHolds.agendaGrantAwaits.values()]).deep.eq([{player: BLUE, from: 3, to: 4}, {player: BOT, from: 6, to: 7}]);
    expect(careerGrantState.owed.map((w) => w.player), 'in the seat order').deep.eq([BLUE, BOT]);
    expect(seedCareerGrantWalks('3:7', before, after, true), 'an echo seeds nothing twice').deep.eq([]);
    expect(careerGrantState.owed).has.length(2);
  });

  it('the BAND names whose step plays and what it pays — the bot\'s card step as a card (D16)', () => {
    const base = {
      stage: 'reward' as const, rewardStep: 'received' as const, beat: 'career' as const, supportWave: '' as const, generation: 3,
      reward: {yields: [], reactions: [], skips: []},
    };
    const line = parliamentBandLine({sitting: {...base, career: {player: BOT, to: 7, bonus: 'card'}}, standing: {votes: 0}});
    expect(line.kicker).eq('Agenda track');
    expect(line.key).eq(`career:${BOT}:7`);
    expect(line.chips).deep.eq([{kind: 'player', player: BOT}, {kind: 'agenda', to: 7, bonus: 'card'}]);
    const settled = parliamentBandLine({sitting: {...base, beat: '', reward: {...base.reward, career: {to: 4, bonus: 'tr'}}}, standing: {votes: 0}});
    expect(settled.chips.some((c) => c.kind === 'agenda' && c.to === 4), 'the reward line keeps the viewer\'s own step').is.true;
  });
});
