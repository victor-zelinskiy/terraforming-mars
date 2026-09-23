import {expect} from 'chai';
import {Color} from '@/common/Color';
import {PartyName} from '@/common/turmoil/PartyName';
import {Resource} from '@/common/Resource';
import {ParliamentEnactOutcomeModel, ParliamentModel, ParliamentPlayerModel, ParliamentSlotModel} from '@/common/models/ParliamentModel';
import {IClientResolution} from '@/common/parliament/IClientResolution';
import {winnerRewardTrTotal} from '@/common/parliament/winnerReward';
import {
  winnerOutcomeOf, winnerRewardCaptionOf, winnerRewardGlyph, winnerRewardReadingOf, winnerRewardRuleKey, winnerRewardSentenceOf, winnerRewardTableOf,
  winnerTileLabelKey,
} from '@/client/console/parliament/winnerRewardModel';
import {enactedYieldsOf, voteYieldsOf, yieldIconOf} from '@/client/console/parliament/influenceYieldModel';
import {resolutionAnnotations} from '@/client/console/parliament/parliamentAnnotations';
import {getResolution} from '@/client/parliament/ClientParliamentManifest';

/**
 * THE WINNER'S PART — one client reading for every moment a surface stands in:
 * the rule alone off the table, «if you win» (what the tile would do to the
 * table as it stands — a maxed oxygen named, the tile's own TR kept), the
 * fixed recipient while the phase resolves it, the RECORD once it has (a
 * step, the maximum, a named skip, a neutral winner), history marked with its
 * generation. Everyone's plants read through the shared influence model:
 * 2 per point of influence, no cap, stock (never production).
 */
const BIODOME_ID = 'RDX_GREENS_BIODOME_CONTEST';
const BIODOME = `${BIODOME_ID}#0`;
const blue = 'blue' as Color;
const red = 'red' as Color;

function seat(color: Color, agenda: number, influence: number): ParliamentPlayerModel {
  return {color, participates: true, lobby: true, reserve: 6, onResolutions: 0, chairman: false, agenda, influence, access: [], partyActionUses: {}, resolutionActionUses: 0};
}

function slot(resolution: string): ParliamentSlotModel {
  return {instance: `${resolution}#0`, resolution, party: PartyName.GREENS, votes: [], totalVotes: 0, isWinning: true, tiePriority: 1, viewerVotes: 0};
}

function model(over: Partial<ParliamentModel> = {}): ParliamentModel {
  return {slots: [], rulingParty: PartyName.GREENS, popularSupport: {}, players: [seat(blue, 2, 1), seat(red, 5, 3)], deckSize: 0, discardSize: 0, neutralSupply: 14, botMode: 'none', ...over};
}

const table = (oxygenLevel: number, temperature = -30, oceans = 0) => ({oxygenLevel, temperature, oceans});

function biodome(): IClientResolution {
  const resolution = getResolution(BIODOME_ID);
  if (resolution === undefined) {
    throw new Error('Biodome Contest is not in the client manifest');
  }
  return resolution;
}

describe('winnerRewardModel', () => {
  it('the shipped catalog: RX03, 2 plants per influence for everyone (stock, no cap), the winner\'s greenery as data', () => {
    const resolution = biodome();
    expect(resolution.code).eq('RX03');
    expect(resolution.party).eq(PartyName.GREENS);
    expect(resolution.scaled).deep.eq([{id: 'plants', unit: {kind: 'stock', resource: Resource.PLANTS}, perInfluence: 2, recipient: 'each'}]);
    expect(yieldIconOf(resolution.scaled![0])).deep.eq({family: 'resource', resource: Resource.PLANTS, production: false});
    expect(resolution.winnerReward).deep.eq({kind: 'tile', tile: 'greenery'});
    expect(getResolution('RDX_GREENS_AQUIFER_CONTEST')?.winnerReward).deep.eq({kind: 'tile', tile: 'ocean'});
    expect(getResolution('RDX_MARS_ARCHITECTURE_AWARD')?.winnerReward, 'no winner part, no reading').is.undefined;
    expect(winnerRewardReadingOf(getResolution('RDX_MARS_ARCHITECTURE_AWARD'), model(), table(3))).is.undefined;
    expect(resolution.questRenderData).is.not.undefined;
  });

  it('the plants readings: influence 1 → +2 now, the winner\'s Agenda step → influence 2 → +4; a seat at 3 → +6', () => {
    const m = model({slots: [slot(BIODOME_ID)]});
    const mine = voteYieldsOf(biodome(), m, blue);
    expect(mine.map((y) => [y.context, y.influence, y.amount])).deep.eq([['estimate', 1, 2], ['forecast', 2, 4]]);
    const theirs = voteYieldsOf(biodome(), m, red);
    // Step 5 → 6 is a TR step: the influence stays 3 → one number.
    expect(theirs.map((y) => [y.context, y.influence, y.amount])).deep.eq([['estimate', 3, 6]]);
    // Beyond the track: 5 + 2 = 7 → 14, never capped at 5.
    const beyond = voteYieldsOf(biodome(), model({slots: [slot(BIODOME_ID)], players: [seat(blue, 12, 7)]}), blue);
    expect(beyond[0]).deep.include({influence: 7, amount: 14});
  });

  it('a recorded plants outcome reads as received; a zero reads as its named skip', () => {
    const outcomes: Array<ParliamentEnactOutcomeModel> = [
      {player: blue, step: 'plants', part: 'effect', effect: 'plants', kind: 'stock', stock: Resource.PLANTS, amount: 4, influence: 2, before: 1, after: 5},
      {player: red, step: 'plants', part: 'effect', effect: 'plants', kind: 'skipped', stock: Resource.PLANTS, amount: 0, influence: 0, reason: 'No influence'},
    ];
    const m = model({enacted: {instance: BIODOME, resolution: BIODOME_ID, party: PartyName.GREENS},
      lastPhase: {generation: 3, final: false, winner: {instance: BIODOME, resolution: BIODOME_ID, party: PartyName.GREENS, votes: 2, player: blue},
        outcomes, support: [], enacted: {instance: BIODOME, resolution: BIODOME_ID, party: PartyName.GREENS}, refreshed: [], lobbyRefilled: []}});
    expect(enactedYieldsOf(biodome(), m, blue)[0]).deep.include({context: 'applied', amount: 4, influence: 2});
    expect(enactedYieldsOf(biodome(), m, red)[0]).deep.include({context: 'applied', amount: 0, skipped: 'No influence'});
  });

  it('no table: the rule alone (reference)', () => {
    const r = winnerRewardReadingOf(biodome(), undefined, undefined);
    expect(r).deep.eq({reward: {kind: 'tile', tile: 'greenery'}, context: 'reference', parameter: 'oxygen'});
    expect(winnerRewardCaptionOf(r!, blue, String)).is.undefined;
  });

  it('up for the vote: «if you win» — oxygen 7 → 8 with the temperature step, the TR it is worth; never a recipient', () => {
    const r = winnerRewardReadingOf(biodome(), model({slots: [slot(BIODOME_ID)]}), table(7, -10))!;
    expect(r.context).eq('conditional');
    expect(r.recipient).is.undefined;
    expect(r.room).deep.include({current: 7, resulting: 8, rises: true, temperatureBonus: true});
    expect(r.tr).deep.eq({tile: 1, parameter: 1, temperature: 1});
    expect(winnerRewardTrTotal(r.tr!)).eq(3);
    expect(winnerRewardCaptionOf(r, blue, String)).deep.eq({key: 'If you win'});
  });

  it('oxygen at its maximum: the tile still lands — no step, the tile\'s own TR only', () => {
    const r = winnerRewardReadingOf(biodome(), model({slots: [slot(BIODOME_ID)]}), table(14, 8))!;
    expect(r.room).deep.include({rises: false, resulting: 14, tileAvailable: true, temperatureBonus: false});
    expect(r.tr).deep.eq({tile: 1, parameter: 0, temperature: 0});
  });

  it('the phase resolving it: the recipient is FIXED — «you place it» for the winner, «placed by X» for the others, neutral names itself', () => {
    const phase = (player: Color | 'neutral', outcomes: Array<ParliamentEnactOutcomeModel> = []) => model({
      enacted: {instance: BIODOME, resolution: BIODOME_ID, party: PartyName.GREENS},
      phase: {generation: 2, final: false, step: 'effects', winner: {instance: BIODOME, player}, outcomes},
    });
    const pending = winnerRewardReadingOf(biodome(), phase(blue), table(5))!;
    expect(pending).deep.include({context: 'pending', recipient: blue});
    expect(pending.room).deep.include({current: 5, resulting: 6});
    expect(winnerRewardCaptionOf(pending, blue, String)).deep.eq({key: 'You place it'});
    expect(winnerRewardCaptionOf(pending, red, (c) => `name-${c}`)).deep.eq({key: 'Placed by ${0}', params: ['name-blue']});
    const neutral = winnerRewardReadingOf(biodome(), phase('neutral'), table(5))!;
    expect(neutral).deep.include({context: 'applied', recipient: 'neutral'});
    expect(winnerRewardCaptionOf(neutral, blue, String)).deep.eq({key: 'Neutral winner — nobody places it'});
    // The PLANTS record alone is not the winner's: still pending.
    const plantsOnly = winnerRewardReadingOf(biodome(), phase(blue, [
      {player: blue, step: 'plants', part: 'effect', effect: 'plants', kind: 'stock', stock: Resource.PLANTS, amount: 2},
    ]), table(5))!;
    expect(plantsOnly.context).eq('pending');
  });

  it('the record: the step as the server read it (or the maximum), a named skip, and history with its generation', () => {
    const placed: ParliamentEnactOutcomeModel = {player: blue, step: 'greenery', part: 'winner', kind: 'greenery', space: '35', parameter: {id: 'oxygen', before: 5, after: 6}};
    const live = winnerRewardReadingOf(biodome(), model({
      phase: {generation: 2, final: false, step: 'effects', winner: {instance: BIODOME, player: blue}, outcomes: [placed]},
    }), table(6))!;
    expect(live).deep.include({context: 'applied', recipient: blue, placed: {space: '35', before: 5, after: 6}});
    expect(live.tr).deep.eq({tile: 1, parameter: 1, temperature: 0});
    expect(live.generation, 'a live phase is not history').is.undefined;
    expect(winnerRewardCaptionOf(live, blue, String)).deep.eq({key: 'You placed it'});
    expect(winnerRewardCaptionOf(live, red, String)).deep.eq({key: 'Placed · ${0}', params: ['blue']});

    const atMax: ParliamentEnactOutcomeModel = {...placed, parameter: {id: 'oxygen', before: 14, after: 14}};
    const skipped: ParliamentEnactOutcomeModel = {player: blue, step: 'greenery', part: 'winner', kind: 'skipped', reason: 'No space can take a greenery'};
    const history = (outcome: ParliamentEnactOutcomeModel) => winnerRewardReadingOf(biodome(), model({
      enacted: {instance: BIODOME, resolution: BIODOME_ID, party: PartyName.GREENS},
      lastPhase: {generation: 4, final: false, winner: {instance: BIODOME, resolution: BIODOME_ID, party: PartyName.GREENS, votes: 1, player: blue},
        outcomes: [outcome], support: [], enacted: {instance: BIODOME, resolution: BIODOME_ID, party: PartyName.GREENS}, refreshed: [], lobbyRefilled: []},
    }), table(3))!;
    const maxed = history(atMax);
    expect(maxed).deep.include({context: 'applied', generation: 4, placed: {space: '35', before: 14, after: 14}});
    expect(maxed.tr).deep.eq({tile: 1, parameter: 0, temperature: 0});
    const skip = history(skipped);
    expect(skip).deep.include({context: 'applied', skipped: 'No space can take a greenery', generation: 4});
    expect(winnerRewardCaptionOf(skip, blue, String)).deep.eq({key: 'No space can take a greenery'});
  });

  it('the winner\'s record is the driver\'s stamp — an older unstamped save falls back to the tile kind, never guesses a skip', () => {
    expect(winnerOutcomeOf([
      {player: blue, step: 'plants', part: 'effect', kind: 'skipped', reason: 'No influence'},
      {player: blue, step: 'greenery', part: 'winner', kind: 'skipped', reason: 'No space can take a greenery'},
    ])?.step).eq('greenery');
    expect(winnerOutcomeOf([{player: blue, step: 'ocean', kind: 'ocean', space: '12'}])?.kind).eq('ocean');
    expect(winnerOutcomeOf([{player: blue, step: 'ocean', kind: 'skipped', reason: 'No ocean tile is left'}])).is.undefined;
  });

  it('the «for you» words read the SAME reading: the moment, the parameter step (or the maximum), the TR broken down', () => {
    const t = {text: (key: string) => key, params: (key: string, params: Array<string>) => params.reduce((acc, p, i) => acc.replace('${' + i + '}', p), key)};
    const conditional = winnerRewardReadingOf(biodome(), model({slots: [slot(BIODOME_ID)]}), table(7, -10))!;
    expect(winnerRewardSentenceOf(conditional, blue, String, t)).deep.eq({
      caption: 'If you win', detail: 'oxygen 7 → 8 %; TR +3 (for the tile +1, for oxygen +1, for temperature +1)',
    });
    const maxed = winnerRewardReadingOf(biodome(), model({slots: [slot(BIODOME_ID)]}), table(14, 8))!;
    expect(winnerRewardSentenceOf(maxed, blue, String, t)).deep.eq({caption: 'If you win', detail: 'oxygen at its maximum — no step; TR +1 (for the tile +1)'});
    const neutral = winnerRewardReadingOf(biodome(), model({
      phase: {generation: 2, final: false, step: 'effects', winner: {instance: BIODOME, player: 'neutral'}, outcomes: []},
    }), table(5))!;
    expect(winnerRewardSentenceOf(neutral, blue, String, t)).deep.eq({caption: 'Neutral winner — nobody places it', detail: ''});
    expect(winnerRewardSentenceOf(winnerRewardReadingOf(biodome(), undefined, undefined)!, blue, String, t), 'no table, no words').is.undefined;
    // The inspector's «for you» block carries exactly that one row; the reference (no table) adds none.
    const rows = resolutionAnnotations(BIODOME_ID, [], {reading: conditional, viewer: blue, nameOf: String}).find((b) => b.id === 'group:you')?.rows ?? [];
    expect(rows).has.length(1);
    expect(rows[0].text).eq('${0}: ${1}');
    expect(rows[0].params?.[1]).to.match(/7 → 8 %/);
    expect(resolutionAnnotations(BIODOME_ID, [], {reading: winnerRewardReadingOf(biodome(), undefined, undefined), viewer: blue, nameOf: String})
      .some((b) => b.id === 'group:you')).is.false;
  });

  it('the table comes straight off the game model; the inspector names the greenery\'s TR rule once under the winner block', () => {
    expect(winnerRewardTableOf({oxygenLevel: 3, temperature: -12, oceans: 4})).deep.eq({oxygenLevel: 3, temperature: -12, oceans: 4});
    expect(winnerRewardTableOf(undefined)).is.undefined;
    const rule = winnerRewardRuleKey({kind: 'tile', tile: 'greenery'});
    expect(rule).is.not.undefined;
    expect(winnerRewardRuleKey({kind: 'tile', tile: 'ocean'})).is.undefined;
    const blocks = resolutionAnnotations(BIODOME_ID);
    const winner = blocks.find((b) => b.id === 'group:winner');
    expect(winner?.rows.map((r) => r.text)).deep.eq([biodome().text.winner, rule]);
    expect(blocks.find((b) => b.id === 'group:immediate')?.rows.map((r) => r.text)).deep.eq([biodome().text.effect]);
    expect(blocks.find((b) => b.id === 'group:quest')?.rows.map((r) => r.text)).deep.eq(['Place 2 greeneries']);
  });
});

/*
 * THE WINNER'S COLONY (Colony Contest, RX09) — the same reading for a part that is not a tile: no parameter, no room,
 * no TR; before the pick only WHO builds, after it WHERE the cube landed (the tile's name); the verb is «build».
 */
const CONTEST_ID = 'RDX_UNITY_COLONY_CONTEST';
const CONTEST = `${CONTEST_ID}#0`;

function contest(): IClientResolution {
  const resolution = getResolution(CONTEST_ID);
  if (resolution === undefined) {
    throw new Error('Colony Contest is not in the client manifest');
  }
  return resolution;
}

describe('winnerRewardModel — the winner\'s COLONY', () => {
  it('the shipped catalog: RX09, 1 titanium per influence for everyone (stock, no cap), the winner\'s colony as data', () => {
    const resolution = contest();
    expect(resolution.code).eq('RX09');
    expect(resolution.party).eq(PartyName.UNITY);
    expect(resolution.scaled).deep.eq([{id: 'titanium', unit: {kind: 'stock', resource: Resource.TITANIUM}, perInfluence: 1, recipient: 'each'}]);
    expect(resolution.winnerReward).deep.eq({kind: 'colony'});
    expect(resolution.quest).deep.include({count: 2});
  });

  it('the readings carry NO parameter and no room: the rule alone off the table, «if you win» up for the vote, the fixed recipient while the phase resolves it', () => {
    const resolution = contest();
    expect(winnerRewardReadingOf(resolution, undefined, undefined)).deep.eq({reward: {kind: 'colony'}, context: 'reference'});
    const voting = winnerRewardReadingOf(resolution, model({slots: [slot(CONTEST_ID)]}), table(5));
    expect(voting).deep.eq({reward: {kind: 'colony'}, context: 'conditional'});
    expect(winnerRewardCaptionOf(voting!, blue, String)).deep.eq({key: 'If you win'});
    const pending = winnerRewardReadingOf(resolution, model({phase: {generation: 3, final: false, step: 'effects', winner: {instance: CONTEST, player: blue}, outcomes: []}}), table(5));
    expect(pending).deep.eq({reward: {kind: 'colony'}, context: 'pending', recipient: blue});
    expect(winnerRewardCaptionOf(pending!, blue, String)).deep.eq({key: 'You build it'});
    expect(winnerRewardCaptionOf(pending!, red, (c) => c.toUpperCase())).deep.eq({key: 'Built by ${0}', params: ['BLUE']});
    const neutral = winnerRewardReadingOf(resolution, model({phase: {generation: 3, final: false, step: 'effects', winner: {instance: CONTEST}, outcomes: []}}), table(5));
    expect(neutral?.recipient).eq('neutral');
    expect(winnerRewardCaptionOf(neutral!, blue, String)).deep.eq({key: 'Neutral winner — nobody builds it'});
  });

  it('the record: the tile the cube landed on («built»), the named skip of an empty table, history with its generation; the words read the same reading', () => {
    const resolution = contest();
    const built: ParliamentEnactOutcomeModel = {player: blue, step: 'colony', part: 'winner', kind: 'colony', colony: 'Luna' as never};
    const applied = winnerRewardReadingOf(resolution, model({phase: {generation: 3, final: false, step: 'effects', winner: {instance: CONTEST, player: blue}, outcomes: [built]}}), table(5));
    expect(applied).deep.eq({reward: {kind: 'colony'}, context: 'applied', recipient: blue, built: 'Luna'});
    expect(winnerRewardCaptionOf(applied!, blue, String)).deep.eq({key: 'You built it'});
    expect(winnerRewardCaptionOf(applied!, red, (c) => c.toUpperCase())).deep.eq({key: 'Built · ${0}', params: ['BLUE']});
    const t = {text: (k: string) => `[${k}]`, params: (k: string, p: Array<string>) => `[${k}|${p.join(',')}]`};
    expect(winnerRewardSentenceOf(applied!, blue, String, t)).deep.eq({caption: '[You built it]', detail: '[Colony · ${0}|[Luna]]'});
    const skipped: ParliamentEnactOutcomeModel = {player: blue, step: 'colony', part: 'winner', kind: 'skipped', reason: 'No colony is available'};
    const history = winnerRewardReadingOf(resolution, model({
      lastPhase: {generation: 2, final: false, enacted: {instance: CONTEST, resolution: CONTEST_ID, party: PartyName.UNITY},
        winner: {instance: CONTEST, resolution: CONTEST_ID, party: PartyName.UNITY, player: blue, votes: 1}, outcomes: [skipped]} as never,
    }), table(5));
    expect(history).deep.eq({reward: {kind: 'colony'}, context: 'applied', recipient: blue, generation: 2, skipped: 'No colony is available'});
    expect(winnerRewardSentenceOf(history!, blue, String, t)).deep.eq({caption: '[Generation ${0}|2] · [No colony is available]', detail: ''});
  });

  it('the labels: «Colony», the `colony` glyph, the one qualification sentence under the winner block; the tile helpers are untouched', () => {
    expect(winnerTileLabelKey({kind: 'colony'})).eq('Colony');
    expect(winnerRewardGlyph({kind: 'colony'})).eq('colony');
    expect(winnerRewardGlyph({kind: 'tile', tile: 'ocean'})).eq('ocean');
    expect(winnerRewardRuleKey({kind: 'colony'})).to.match(/built for free/);
    expect(winnerTileLabelKey({kind: 'tile', tile: 'greenery'})).eq('Greenery');
    const blocks = resolutionAnnotations(CONTEST_ID);
    expect(blocks.find((b) => b.id === 'group:winner')?.rows.map((r) => r.text)).deep.eq([contest().text.winner, winnerRewardRuleKey({kind: 'colony'})]);
    expect(blocks.find((b) => b.id === 'group:quest')?.rows.map((r) => r.text)).deep.eq(['Build 2 colonies']);
  });
});
