import {expect} from 'chai';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {PartyName} from '@/common/turmoil/PartyName';
import {ParliamentModel, ParliamentPlayerModel, PartyAccessModel, VoteProjectionModel} from '@/common/models/ParliamentModel';
import {VoteSupportProjection} from '@/common/models/PlayerInputModel';
import {StagedVoteModel} from '@/common/models/ActionPreviewModel';
import {IClientResolution} from '@/common/parliament/IClientResolution';
import {influenceAtAgenda} from '@/common/parliament/ParliamentTypes';
import {allResolutions, getPartyEffect} from '@/client/parliament/ClientParliamentManifest';
import {ParliamentPartyVm, ParliamentSlotVm, voteForecastOf} from '@/client/console/parliament/consoleParliamentModel';
import {
  CARD_DOOR_RECEIPT, CARD_DOOR_SOURCE, GRANT_KICKER, SUPPORT_KICKER, SUPPORT_NONE_AREA, SUPPORT_NONE_SUPPLY, SUPPORT_TAIL_AREA, SUPPORT_TAIL_SUPPLY,
  supportReadingOf, supportTailText, TextFn, VOTE_INFO_LIMITS, voteFactsOf, voteInfoBudget, voteInfoOf, VoteInfoVm,
} from '@/client/console/parliament/voteInfoModel';
import {resolutionPartyAnnotations, SUPPORT_NUMBERS_KEY, SUPPORT_RULE_KEY} from '@/client/console/parliament/parliamentAnnotations';
import {playCommitVerb, playDoorNextStepKey, playDoorOf, playPrimaryVerb} from '@/client/console/consolePlayCardComposer';
import {ActionPreviewBranch} from '@/common/models/ActionPreviewModel';
import ruParliament from '@/locales/ru/parliament.json';
import ruConsole from '@/locales/ru/console.json';
import ruUi from '@/locales/ru/ui.json';
import ruTurmoil from '@/locales/ru/turmoil.json';

/**
 * «НАРОДНАЯ ПОДДЕРЖКА» IN THE VOTE PANEL — the block a door that also pays the
 * chosen resolution's PARTY adds to the panel (Turmoil Redux TR03 Political
 * Donation), and the play composer's DOOR that leads to it.
 *
 * The numbers are the SERVER's row (`votePrompt.support`); this pins how they
 * are laid out: three places (filled · arriving · empty), `current →
 * resulting`, the four tails, a named zero — and that the block costs the
 * panel a bounded number of words on the WHOLE catalog, at every subject.
 * The support is the PARTY's, so the block never speaks in the second person.
 */
const BLUE = 'blue' as Color;
const RED = 'red' as Color;
const G = PartyName.GREENS;

const RU: Record<string, string> = {...ruTurmoil, ...ruUi, ...ruConsole, ...ruParliament} as Record<string, string>;
const interpolate = (text: string, params?: ReadonlyArray<string>): string =>
  (params ?? []).reduce<string>((acc, p, i) => acc.split('${' + i + '}').join(p), text);
const ru: TextFn = (key, params) => interpolate(RU[key] ?? key, params);

const FULL: VoteSupportProjection = {party: G, current: 0, gained: 3, resulting: 3, printed: 3};
const AREA_CUT: VoteSupportProjection = {party: G, current: 2, gained: 1, resulting: 3, printed: 3, limit: 'area'};
const SUPPLY_CUT: VoteSupportProjection = {party: G, current: 0, gained: 2, resulting: 2, printed: 3, limit: 'supply'};
const AREA_FULL: VoteSupportProjection = {party: G, current: 3, gained: 0, resulting: 3, printed: 3, limit: 'area'};
const SUPPLY_EMPTY: VoteSupportProjection = {party: G, current: 1, gained: 0, resulting: 1, printed: 3, limit: 'supply'};
const ROWS: ReadonlyArray<{name: string, row: VoteSupportProjection}> = [
  {name: 'everything lands', row: FULL}, {name: 'the area cuts it', row: AREA_CUT}, {name: 'the supply cuts it', row: SUPPLY_CUT},
  {name: 'the area is full', row: AREA_FULL}, {name: 'the supply is empty', row: SUPPLY_EMPTY},
];

describe('voteInfoModel — «НАРОДНАЯ ПОДДЕРЖКА» (supportReadingOf)', () => {
  it('+3: three arriving places, the bare amount, the GAIN tone', () => {
    const vm = supportReadingOf(FULL);
    expect(vm).to.deep.include({current: 0, resulting: 3, gained: 3, amount: '+3', tail: undefined, tone: 'gain'});
    expect(vm.places).to.deep.eq({filled: 0, incoming: 3, total: 3});
    expect(supportTailText(vm, ru)).to.eq('+3');
  });

  it('the AREA cuts it: «+1 из 3 · предел области», one arriving place, the CUT tone', () => {
    const vm = supportReadingOf(AREA_CUT);
    expect(vm.places).to.deep.eq({filled: 2, incoming: 1, total: 3});
    expect(vm.tail).to.deep.eq({key: SUPPORT_TAIL_AREA, params: ['1', '3']});
    expect(vm.tone).to.eq('cut');
    expect(supportTailText(vm, ru)).to.eq('+1 из 3 · предел области');
  });

  it('the SUPPLY cuts it: «+2 из 3 · нейтральных в запасе: 2»', () => {
    const vm = supportReadingOf(SUPPLY_CUT);
    expect(vm.tail).to.deep.eq({key: SUPPORT_TAIL_SUPPLY, params: ['2', '3', '2']});
    expect(vm.tone).to.eq('cut');
    expect(supportTailText(vm, ru)).to.eq('+2 из 3 · нейтральных в запасе: 2');
  });

  it('a NAMED zero, in the calm register: «+0 · область заполнена» / «+0 · нейтральных не осталось» — and no arriving place', () => {
    const area = supportReadingOf(AREA_FULL);
    expect(area).to.deep.include({amount: '+0', tone: 'none'});
    expect(area.tail?.key).to.eq(SUPPORT_NONE_AREA);
    expect(area.places).to.deep.eq({filled: 3, incoming: 0, total: 3});
    expect(supportTailText(area, ru)).to.eq('+0 · область заполнена');
    const supply = supportReadingOf(SUPPLY_EMPTY);
    expect(supply.tail?.key).to.eq(SUPPORT_NONE_SUPPLY);
    expect(supply.places).to.deep.eq({filled: 1, incoming: 0, total: 3});
    expect(supportTailText(supply, ru)).to.eq('+0 · нейтральных не осталось');
  });

  it('during the landing a place FILLS on each touchdown — the numbers and the tail never change', () => {
    const before = supportReadingOf(FULL, 0);
    const mid = supportReadingOf(FULL, 2);
    const after = supportReadingOf(FULL, 3);
    expect(mid.places).to.deep.eq({filled: 2, incoming: 1, total: 3});
    expect(after.places).to.deep.eq({filled: 3, incoming: 0, total: 3});
    for (const vm of [mid, after]) {
      expect({current: vm.current, resulting: vm.resulting, amount: vm.amount, tone: vm.tone}).to.deep.eq({current: before.current, resulting: before.resulting, amount: before.amount, tone: before.tone});
    }
    // More touchdowns than cubes is clamped — a place can never overfill.
    expect(supportReadingOf(AREA_CUT, 5).places).to.deep.eq({filled: 3, incoming: 0, total: 3});
  });

  it('every line of the block has its RU wording, and none of it is in the second person (the support is the party\'s)', () => {
    const keys = [SUPPORT_KICKER, SUPPORT_TAIL_AREA, SUPPORT_TAIL_SUPPLY, SUPPORT_NONE_AREA, SUPPORT_NONE_SUPPLY, CARD_DOOR_SOURCE, CARD_DOOR_RECEIPT,
      SUPPORT_NUMBERS_KEY, SUPPORT_RULE_KEY, 'Choose the resolution', 'Resolution — chosen in the Parliament', 'Play card'];
    expect(keys.filter((k) => RU[k] === undefined), 'untranslated keys').to.deep.eq([]);
    const lines = [SUPPORT_KICKER, SUPPORT_TAIL_AREA, SUPPORT_TAIL_SUPPLY, SUPPORT_NONE_AREA, SUPPORT_NONE_SUPPLY, SUPPORT_RULE_KEY].map((k) => ru(k, ['1', '3', '2']));
    // (no `\b` — JS word boundaries are ASCII-only and never fire beside a Cyrillic letter)
    const second = lines.filter((line) => /(^|\s|«)(вы|ваш|ваша|ваше|ваши|ваших|вас|вам|вами)(\s|,|:|»|$)/i.test(line));
    expect(second, 'second-person phrases').to.deep.eq([]);
    expect(ru(SUPPORT_KICKER)).to.eq('Народная поддержка');
    expect(ru(CARD_DOOR_SOURCE)).to.eq('из резерва · по карте');
    expect(ru('Choose the resolution')).to.eq('Выбрать резолюцию');
  });
});

// ── the panel under a card's door, on the whole catalog ─────────────────────

function seatFor(agenda: number, access: PartyAccessModel): ParliamentPlayerModel {
  return {
    color: BLUE, participates: true, lobby: true, reserve: 5, onResolutions: 1, chairman: false,
    agenda, influence: influenceAtAgenda(agenda), access: [access], partyActionUses: {}, resolutionActionUses: 0,
  };
}

function cardDoorPanel(resolution: IClientResolution, row: VoteSupportProjection, opts: {edge: boolean, receipt: boolean, rival?: {name: string}}): VoteInfoVm {
  const instance = `${resolution.id}#0`;
  const mine = opts.edge ? 1 : 0;
  const votes = [{owner: RED, seq: 1}, ...(mine > 0 ? [{owner: BLUE, seq: 2}] : [])];
  const projection: VoteProjectionModel = {
    instance, votesAfter: votes.length + 1, leaderAfter: BLUE, viewerLeads: true, becomesWinning: true, unlocksEffect: opts.edge, unlocksRequirement: opts.edge,
  };
  const access: PartyAccessModel = {party: resolution.party, ruling: false, delegates: mine, byDelegates: false, granted: [], hasEffect: false, satisfiesRequirement: false};
  const model: ParliamentModel = {
    slots: [{instance, resolution: resolution.id, party: resolution.party, votes, totalVotes: votes.length, leader: RED, isWinning: false, tiePriority: 1, viewerVotes: mine}],
    rulingParty: PartyName.GREENS, popularSupport: {}, players: [seatFor(1, access)], deckSize: 3, discardSize: 0, neutralSupply: 10, botMode: 'none',
    viewer: {vote: {available: true, reason: '', source: 'lobby', cost: 0, projections: [projection]}, partyActions: []},
  };
  const slot: ParliamentSlotVm = {
    instance, resolutionId: resolution.id, resolution, party: resolution.party, votes, totalVotes: votes.length, leader: RED, leaderVotes: 1,
    isWinning: false, tiePriority: 1, viewerVotes: mine, viewerEffectDelegates: 2, projection,
  };
  const party: ParliamentPartyVm = {
    party: resolution.party, effect: getPartyEffect(resolution.party), rule: undefined, support: row.current, inArea: true, ruling: false, access, actionId: undefined, action: undefined,
  };
  const facts = voteFactsOf({
    slot, party, viewer: BLUE, forecast: voteForecastOf(slot, BLUE, model.viewer?.vote), snapshot: undefined, landed: false,
    mineBefore: mine, mineAfter: mine + 1, nameOf: (c) => c,
  });
  return voteInfoOf({
    slot, resolution, model, subject: BLUE, rival: opts.rival, tableau: [], name: resolution.text.name, winning: false,
    // A GRANT's delegate leaves the reserve, free — whatever the viewer's own vote would cost.
    source: 'reserve', cost: 0, facts, numbers: {votesBefore: slot.totalVotes, votesAfter: slot.totalVotes + 1, mineBefore: mine, mineAfter: mine + 1},
    grant: {count: 1, card: true, receipt: opts.receipt ? {amount: 4, icon: 'megacredits'} : undefined},
    support: {row: {...row, party: resolution.party}, landed: 0},
  });
}

describe('voteInfoOf — a CARD\'s door (the staged vote) on the panel', () => {
  const dealt = allResolutions().filter((r) => r.copies > 0);

  it('the block says whose delegates these are, from where and by what — and carries the locked receipt only while staged', () => {
    const staged = cardDoorPanel(dealt[0], FULL, {edge: false, receipt: true});
    expect(staged.vote).to.deep.include({kicker: GRANT_KICKER, door: 'card', grant: true, source: 'reserve', cost: 0, count: 1});
    expect(staged.vote.receipt).to.deep.eq({amount: 4, icon: 'megacredits'});
    expect(staged.support).to.deep.include({current: 0, resulting: 3, amount: '+3'});
    const live = cardDoorPanel(dealt[0], FULL, {edge: false, receipt: false});
    expect(live.vote.door).to.eq('card');
    expect(live.vote.receipt, 'the card is already paid: no receipt on a live door').to.eq(undefined);
  });

  it('a colony\'s grant and the viewer\'s own vote are NOT a card\'s door — and draw no support block', () => {
    const resolution = dealt[0];
    const base = cardDoorPanel(resolution, FULL, {edge: false, receipt: true});
    const slot = {instance: base.instance, party: base.party} as unknown as ParliamentSlotVm;
    const common = {slot, resolution, model: undefined, subject: BLUE, tableau: [], name: base.name, winning: false, source: 'reserve' as const, cost: 5, facts: base.vote.all, numbers: base.vote.numbers};
    expect(voteInfoOf({...common, grant: {count: 2}}).vote).to.deep.include({door: 'grant', cost: 0});
    expect(voteInfoOf({...common, grant: {count: 2}}).support).to.eq(undefined);
    expect(voteInfoOf(common).vote).to.deep.include({door: 'vote', cost: 5, grant: false});
  });

  it('on the second delegate the PARTY EFFECT fact lights — the card\'s hidden gain is on the panel', () => {
    const vm = cardDoorPanel(dealt[0], FULL, {edge: true, receipt: true});
    expect(vm.vote.facts.map((f) => f.id)).to.include('access');
    expect(vm.vote.facts.find((f) => f.id === 'access')?.tone).to.eq('gain');
  });

  it('THE BUDGET, on the whole catalog × the five support shapes × the edge × both subjects: the panel\'s words stay in their ceiling and the block in its own', () => {
    const offences: Array<string> = [];
    let worst = 0;
    let worstSupport = 0;
    for (const resolution of dealt) {
      for (const {name, row} of ROWS) {
        for (const edge of [true, false]) {
          for (const rival of [undefined, {name: 'Анна'}]) {
            const vm = cardDoorPanel(resolution, row, {edge, receipt: true, rival});
            const b = voteInfoBudget(vm, ru);
            worst = Math.max(worst, b.words);
            worstSupport = Math.max(worstSupport, b.support);
            const where = `${resolution.text.name} (${resolution.code ?? resolution.id}) · ${name}${edge ? ' · on the edge' : ''}${rival === undefined ? '' : ' · for another seat'}`;
            if (b.words > VOTE_INFO_LIMITS.words) {
              offences.push(`${where}: words ${b.words} (≤ ${VOTE_INFO_LIMITS.words})`);
            }
            if (b.support > VOTE_INFO_LIMITS.supportWords) {
              offences.push(`${where}: the support block ${b.support} words (≤ ${VOTE_INFO_LIMITS.supportWords})`);
            }
            if (b.support === 0) {
              offences.push(`${where}: the support block costs no words — it is not being counted`);
            }
            const factLimit = edge ? VOTE_INFO_LIMITS.factsOnEdge : VOTE_INFO_LIMITS.facts;
            if (b.facts > factLimit) {
              offences.push(`${where}: facts ${b.facts} (≤ ${factLimit})`);
            }
          }
        }
      }
    }
    expect(dealt.length, 'anti-vacuity').to.be.greaterThan(10);
    expect(offences, `the vote panel under a card's door (worst ${worst} words, support ${worstSupport}):\n` + offences.join('\n')).to.deep.eq([]);
  });

  it('a door that pays no support costs the support axis nothing', () => {
    const resolution = dealt[0];
    const base = cardDoorPanel(resolution, FULL, {edge: false, receipt: false});
    const plain = voteInfoOf({
      slot: {instance: base.instance, party: base.party} as unknown as ParliamentSlotVm, resolution, model: undefined, subject: BLUE, tableau: [],
      name: base.name, winning: false, source: 'lobby', cost: 0, facts: base.vote.all, numbers: base.vote.numbers,
    });
    expect(voteInfoBudget(plain, ru).support).to.eq(0);
  });
});

describe('parliamentAnnotations — the inspector prints the support\'s RULE (the panel never does)', () => {
  it('a party column under a support door gains ONE block: the numbers, what cut them, the rule in words', () => {
    const party = allResolutions().find((r) => r.copies > 0)!.party;
    const plain = resolutionPartyAnnotations(party);
    const withSupport = resolutionPartyAnnotations(party, supportReadingOf({...AREA_CUT, party}));
    expect(withSupport.length).to.eq(plain.length + 1);
    const block = withSupport[withSupport.length - 1];
    expect(block.id).to.eq('group:support');
    expect(block.labelKey).to.eq(SUPPORT_KICKER);
    expect(block.rows.map((row) => row.text)).to.deep.eq([SUPPORT_NUMBERS_KEY, SUPPORT_TAIL_AREA, SUPPORT_RULE_KEY]);
    expect(block.rows[0].params).to.deep.eq(['2', '3', '3']);
    // Everything lands → no «what cut it» row; a named zero keeps its cause.
    expect(resolutionPartyAnnotations(party, supportReadingOf({...FULL, party})).slice(-1)[0].rows.map((row) => row.text)).to.deep.eq([SUPPORT_NUMBERS_KEY, SUPPORT_RULE_KEY]);
    expect(resolutionPartyAnnotations(party, supportReadingOf({...AREA_FULL, party})).slice(-1)[0].rows.map((row) => row.text)).to.deep.eq([SUPPORT_NUMBERS_KEY, SUPPORT_NONE_AREA, SUPPORT_RULE_KEY]);
  });
});

// ── the play composer's door ────────────────────────────────────────────────

describe('consolePlayCardComposer — the DOOR (a step the composer leads to, never answers)', () => {
  const STAGED: StagedVoteModel = {
    prompt: {type: 'party', title: 'Add 1 delegate to a resolution', buttonLabel: 'Add', parties: [G]} as unknown as StagedVoteModel['prompt'],
    sourceCard: CardName.POLITICAL_DONATION,
  };
  const branch = (steps: ActionPreviewBranch['steps']): ActionPreviewBranch => ({index: -1, title: '', available: true, renderKeys: [], effects: [], steps});

  it('a `delegateGrant` step is the PARLIAMENT door: the CTA and the bar say «Выбрать резолюцию», the next step is named', () => {
    const door = playDoorOf(branch([{kind: 'delegateGrant', staged: STAGED}]));
    expect(door, 'the vote mode of the ONE parliament door (TR12 added the support mode beside it)').to.deep.eq({kind: 'parliament', staged: STAGED, mode: 'vote'});
    expect(playCommitVerb(door)).to.eq('Choose the resolution');
    expect(playDoorNextStepKey(door)).to.eq('Resolution — chosen in the Parliament');
    expect(playPrimaryVerb({focused: 'cta', primary: {kind: 'ready'}, doorVerb: playCommitVerb(door)})).to.deep.eq({label: 'Choose the resolution', enabled: true});
  });

  it('a staged Mars placement is the BOARD door; a card with neither commits the play itself', () => {
    const placement = {title: '', spaces: [], sourceCard: CardName.NUCLEAR_ZONE};
    const board = playDoorOf(branch([{kind: 'boardPlacement', placementType: 'land', staged: placement}]));
    expect(board).to.deep.eq({kind: 'board', staged: placement});
    expect(playCommitVerb(board)).to.eq('Play on the board');
    expect(playDoorNextStepKey(board), 'the board\'s own row is the placement presenter\'s').to.eq(undefined);
    // An un-staged placement (a follow-up) and a plain note are not doors.
    expect(playDoorOf(branch([{kind: 'boardPlacement', placementType: 'land'}, {kind: 'note', noteKind: 'generic'}]))).to.eq(undefined);
    expect(playCommitVerb(undefined)).to.eq('Play card');
    expect(playDoorOf(undefined)).to.eq(undefined);
  });

  it('a blocked or unfinished composer never borrows the door\'s verb', () => {
    expect(playPrimaryVerb({focused: 'cta', primary: {kind: 'blocked-payment'}, doorVerb: 'Choose the resolution'}).label).to.eq('Configure payment');
    expect(playPrimaryVerb({focused: 'cta', primary: {kind: 'need-preselect', rowIndex: 0}, doorVerb: 'Choose the resolution'}).label).to.eq('Choose an option');
    expect(playPrimaryVerb({focused: 'cta', primary: {kind: 'ready'}}).label, 'no door: the plain play verb').to.eq('Play now');
  });
});
