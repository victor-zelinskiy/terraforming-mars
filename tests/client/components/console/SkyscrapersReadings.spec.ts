import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {Color} from '@/common/Color';
import {SpaceId} from '@/common/Types';
import {PartyName} from '@/common/turmoil/PartyName';
import {ParliamentEnactOutcomeModel, ParliamentModel, ParliamentPlayerModel} from '@/common/models/ParliamentModel';
import {resolutionInstanceId} from '@/common/parliament/ParliamentTypes';
import {
  TILE_GRANT_NO_DESTINATION_REASON, TILE_GRANT_NOT_ELIGIBLE_REASON, tileGrantCountId, tileGrantStepKey,
} from '@/common/parliament/tileGrant';
import ConsoleTileGrant from '@/client/components/console/parliament/ConsoleTileGrant.vue';
import {
  TILE_GRANT_RULE_KEY, TileGrantReading, tileGrantCaptionOf, tileGrantDetailOf, tileGrantOutcomeOf, tileGrantReadingOf, tileGrantSentenceOf,
} from '@/client/console/parliament/tileGrantModel';
import {READING_KICKER_SEATED, READING_KICKER_SPECTATOR, voteReadingOf} from '@/client/console/parliament/voteInfoModel';
import {resolutionAnnotations} from '@/client/console/parliament/parliamentAnnotations';
import {familyOf} from '@/client/console/parliament/resolutionFamily';
import {yieldCountPresentation} from '@/client/console/parliament/influenceYieldModel';
import {resultsPayoutPart} from '@/client/console/parliament/parliamentResultsModel';
import {parliamentBandLine} from '@/client/console/parliament/parliamentBand';
import {getResolution} from '@/client/parliament/ClientParliamentManifest';

/*
 * SKYSCRAPERS (Turmoil Redux, RX20) — THE READINGS of a tile granted BY
 * THRESHOLD. What is pinned on the client: the manifest declares the grant
 * as data (one city tile, a tier on the seat's own city, the winner and the
 * influence line) and no scaled part; the family is `tile-grant`; the
 * DESTINATIONS are a board count the seat model carries (`marsCities`); ONE
 * reading model answers «do I get it, where does it go, what happened» in the
 * winner model's four moments; the vote reading, the inspector's «for you»
 * row, the band's chip, the results panel's part and the graphic block all
 * read that one model — none of them re-derives the rule.
 */
const SKY_ID = 'RDX_MARS_SKYSCRAPERS';
const SKY = resolutionInstanceId(SKY_ID, 0);
const BLUE = 'blue' as Color;
const RED = 'red' as Color;

function seat(color: Color, agenda: number, influence: number, cities?: number): ParliamentPlayerModel {
  return {
    color, participates: true, lobby: true, reserve: 6, onResolutions: 0, chairman: false, agenda, influence, access: [], partyActionUses: {}, resolutionActionUses: 0,
    ...(cities === undefined ? {} : {counts: [{id: 'marsCities' as const, count: cities, cards: [], spaces: Array.from({length: cities}, (_, i) => String(30 + i) as SpaceId)}]}),
  };
}

function model(players: Array<ParliamentPlayerModel>, over: Partial<ParliamentModel> = {}): ParliamentModel {
  return {slots: [], rulingParty: PartyName.GREENS, popularSupport: {}, players, deckSize: 0, discardSize: 0, neutralSupply: 14, botMode: 'none', ...over};
}

/** The card UP FOR THE VOTE. */
function voting(players: Array<ParliamentPlayerModel>): ParliamentModel {
  return model(players, {slots: [{instance: SKY, resolution: SKY_ID, party: PartyName.MARS, votes: [], totalVotes: 0, isWinning: true, tiePriority: 1, viewerVotes: 0}]});
}

/** The phase RESOLVING the card: the winner fixed, the records so far. */
function resolving(players: Array<ParliamentPlayerModel>, winner: Color | 'neutral', outcomes: Array<ParliamentEnactOutcomeModel> = []): ParliamentModel {
  return model(players, {
    rulingParty: PartyName.MARS,
    enacted: {instance: SKY, resolution: SKY_ID, party: PartyName.MARS},
    phase: {generation: 3, final: false, step: 'effects', winner: {instance: SKY, player: winner}, outcomes},
  });
}

const sky = () => {
  const resolution = getResolution(SKY_ID);
  if (resolution === undefined) {
    throw new Error(`${SKY_ID} is not in the client manifest`);
  }
  return resolution;
};

const STEP = 'city-tier';
const tier = (player: Color, influence: number, stackHeight = 2): ParliamentEnactOutcomeModel =>
  ({player, step: STEP, part: 'effect', kind: 'city', influence, space: '35', stackHeight});
const skip = (player: Color, influence: number, reason: string): ParliamentEnactOutcomeModel =>
  ({player, step: STEP, part: 'effect', kind: 'skipped', influence, reason});

const t = {global: {mocks: {$t: (key: string) => key}}};
const words = {text: (key: string) => key, params: (key: string, params: Array<string>) => `${key}|${params.join(',')}`};

describe('SkyscrapersReadings (RX20)', () => {
  it('the manifest declares the GRANT as data — one city tile, a tier on the seat\'s own city, the winner and everyone at influence ≥ 2 — no scaled part; the family, the count and the step key derive from it', () => {
    const law = sky();
    expect(law.code).eq('RX20');
    expect(law.party).eq(PartyName.MARS);
    expect(law.tileGrant).deep.eq({tile: 'city', placement: 'own-city', recipients: {winner: true, influenceAtLeast: 2}});
    expect(law.scaled ?? []).deep.eq([]);
    expect(law.winnerReward).is.undefined;
    expect(law.levy).is.undefined;
    expect(law.hasImmediate).is.true;
    expect(law.quest).deep.eq({goal: {kind: 'tile', tile: 'city'}, count: 2});
    expect(familyOf(law)).eq('tile-grant');
    expect(tileGrantCountId(law.tileGrant!)).eq('marsCities');
    expect(tileGrantStepKey(law.tileGrant!)).eq(STEP);
    expect(yieldCountPresentation('marsCities').glyph).deep.eq({kind: 'tile', tile: 'marsCity'});
    expect(yieldCountPresentation('marsCities').skipReasonKey).eq(TILE_GRANT_NO_DESTINATION_REASON);
  });

  describe('the reading model', () => {
    it('no table, or no seat: the rule alone (reference)', () => {
      expect(tileGrantReadingOf(sky(), undefined, BLUE)).deep.eq({grant: sky().tileGrant, context: 'reference'});
      expect(tileGrantReadingOf(sky(), voting([seat(RED, 3, 2, 1)]), BLUE), 'a spectator').deep.include({context: 'reference'});
      expect(tileGrantReadingOf(sky(), voting([seat(BLUE, 3, 2, 1)]), undefined)).deep.include({context: 'reference'});
      expect(tileGrantReadingOf(getResolution('RDX_MARS_ARCHITECTURE_AWARD'), voting([seat(BLUE, 3, 2)]), BLUE), 'a card with no grant').is.undefined;
    });

    it('up for the vote: the viewer\'s standing as a NON-winner at their influence now — «yours, win or not» at 2, «only if you win» below — and their destinations', () => {
      const yours = tileGrantReadingOf(sky(), voting([seat(BLUE, 3, 2, 1)]), BLUE)!;
      expect(yours).deep.include({context: 'conditional', eligibility: 'influence', influence: 2, cities: 1});
      expect(tileGrantCaptionOf(yours)).deep.eq({key: 'Yours at influence ${0} — win or not', params: ['2']});
      expect(tileGrantDetailOf(yours)).deep.eq({key: 'your cities on Mars: ${0}', params: ['1']});
      const below = tileGrantReadingOf(sky(), voting([seat(BLUE, 1, 1, 2)]), BLUE)!;
      expect(below).deep.include({context: 'conditional', eligibility: 'none', influence: 1, cities: 2});
      expect(tileGrantCaptionOf(below)).deep.eq({key: 'Only if you win — influence ${0} is below ${1}', params: ['1', '2']});
      // No city on Mars: the honest «nothing lands», in the server's own words; no count on the model: no promise at all.
      expect(tileGrantDetailOf(tileGrantReadingOf(sky(), voting([seat(BLUE, 3, 2, 0)]), BLUE)!)).deep.eq({key: TILE_GRANT_NO_DESTINATION_REASON});
      const uncounted = tileGrantReadingOf(sky(), voting([seat(BLUE, 3, 2)]), BLUE)!;
      expect(uncounted.cities).is.undefined;
      expect(tileGrantDetailOf(uncounted)).is.undefined;
    });

    it('the phase resolving it: the eligibility is FIXED by the recorded winner and the influence after the Agenda step — the winner below the line receives it, a seat at 2 receives it, a seat at 1 is passed over BY THE RULE', () => {
      const table = [seat(BLUE, 1, 1, 1), seat(RED, 3, 2, 1)];
      const winner = tileGrantReadingOf(sky(), resolving(table, BLUE), BLUE)!;
      expect(winner).deep.include({context: 'pending', eligibility: 'winner', influence: 1, cities: 1});
      expect(tileGrantCaptionOf(winner)).deep.eq({key: 'You place it — the winner of the vote'});
      const line = tileGrantReadingOf(sky(), resolving(table, BLUE), RED)!;
      expect(line).deep.include({context: 'pending', eligibility: 'influence', influence: 2});
      expect(tileGrantCaptionOf(line)).deep.eq({key: 'You place it — influence ${0}', params: ['2']});
      const passed = tileGrantReadingOf(sky(), resolving(table, RED), BLUE)!;
      expect(passed).deep.include({context: 'pending', eligibility: 'none', influence: 1});
      expect(tileGrantCaptionOf(passed)).deep.eq({key: 'Not yours — influence ${0} is below ${1} and you did not win', params: ['1', '2']});
      // A neutral winner: the line alone decides.
      expect(tileGrantReadingOf(sky(), resolving(table, 'neutral'), BLUE)!.eligibility).eq('none');
      expect(tileGrantReadingOf(sky(), resolving(table, 'neutral'), RED)!.eligibility).eq('influence');
    });

    it('the viewer\'s RECORD: the tier and the stack it became (as the winner, or by the line), or the named skip; a reaction of the same seat is never the grant\'s record', () => {
      const table = [seat(BLUE, 1, 1, 1), seat(RED, 3, 2, 0)];
      const placed = tileGrantReadingOf(sky(), resolving(table, BLUE, [tier(BLUE, 1)]), BLUE)!;
      expect(placed).deep.include({context: 'applied', eligibility: 'winner', influence: 1, placed: {space: '35', stackHeight: 2}});
      expect(placed.skipped).is.undefined;
      expect(tileGrantCaptionOf(placed)).deep.eq({key: 'You placed it — the winner of the vote'});
      expect(tileGrantDetailOf(placed)).deep.eq({key: 'a stack of ${0}', params: ['2']});
      const byLine = tileGrantReadingOf(sky(), resolving([seat(BLUE, 1, 1, 1), seat(RED, 3, 2, 1)], BLUE, [tier(BLUE, 1), tier(RED, 2, 3)]), RED)!;
      expect(byLine).deep.include({context: 'applied', eligibility: 'influence', placed: {space: '35', stackHeight: 3}});
      expect(tileGrantCaptionOf(byLine)).deep.eq({key: 'You placed it — influence ${0}', params: ['2']});
      const skipped = tileGrantReadingOf(sky(), resolving(table, BLUE, [tier(BLUE, 1), skip(RED, 2, TILE_GRANT_NO_DESTINATION_REASON)]), RED)!;
      expect(skipped).deep.include({context: 'applied', skipped: TILE_GRANT_NO_DESTINATION_REASON});
      expect(tileGrantCaptionOf(skipped)).deep.eq({key: TILE_GRANT_NO_DESTINATION_REASON});
      expect(tileGrantDetailOf(skipped)).is.undefined;
      const reaction: ParliamentEnactOutcomeModel = {player: BLUE, step: STEP, kind: 'reaction', party: PartyName.MARS, amount: 1};
      expect(tileGrantOutcomeOf(sky().tileGrant!, [reaction], BLUE)).is.undefined;
      expect(tileGrantOutcomeOf(sky().tileGrant!, [reaction, tier(BLUE, 1)], BLUE)).deep.eq(tier(BLUE, 1));
      expect(tileGrantOutcomeOf(sky().tileGrant!, [{player: BLUE, step: 'other', kind: 'skipped', reason: 'x'}], BLUE), 'another step\'s skip').is.undefined;
    });

    it('a FINISHED phase: the record as history, with its generation in the sentence', () => {
      const history = model([seat(BLUE, 1, 1, 1)], {
        enacted: {instance: SKY, resolution: SKY_ID, party: PartyName.MARS},
        lastPhase: {
          generation: 4, final: false, winner: {instance: SKY, resolution: SKY_ID, party: PartyName.MARS, votes: 2, player: BLUE},
          outcomes: [tier(BLUE, 1)], support: [], enacted: {instance: SKY, resolution: SKY_ID, party: PartyName.MARS}, refreshed: [], lobbyRefilled: [],
        },
      });
      const reading = tileGrantReadingOf(sky(), history, BLUE)!;
      expect(reading).deep.include({context: 'applied', generation: 4, placed: {space: '35', stackHeight: 2}});
      expect(tileGrantSentenceOf(reading, words)).deep.eq({caption: 'Generation ${0}|4 · You placed it — the winner of the vote', detail: 'a stack of ${0}|2'});
      // Enacted long ago with no record of the viewer (a seat that joined later): the rule alone.
      expect(tileGrantReadingOf(sky(), model([seat(RED, 3, 2)], {enacted: {instance: SKY, resolution: SKY_ID, party: PartyName.MARS}}), RED)!.context).eq('reference');
    });
  });

  describe('the surfaces read the one model', () => {
    it('the vote reading: no number to pay, but the seat\'s OWN reading all the same — under «for you», with the grant; a spectator keeps the plain heading', () => {
      const reading = voteReadingOf(sky(), voting([seat(BLUE, 3, 2, 1)]), BLUE, []);
      expect(reading.kicker).eq(READING_KICKER_SEATED);
      expect(reading.yields).deep.eq([]);
      expect(reading.grant).deep.include({context: 'conditional', eligibility: 'influence', cities: 1});
      const spectator = voteReadingOf(sky(), voting([seat(RED, 3, 2, 1)]), BLUE, []);
      expect(spectator.kicker).eq(READING_KICKER_SPECTATOR);
      expect(spectator.grant).is.undefined;
    });

    it('the inspector: the effect with the STACK rule under it, the quest last; «for you» reads the viewer\'s standing in words', () => {
      const plain = resolutionAnnotations(SKY_ID);
      expect(plain.map((b) => b.labelKey)).deep.eq(['When enacted', 'Chairman quest']);
      expect(plain[0].rows.map((r) => r.text)).deep.eq([sky().text.effect, TILE_GRANT_RULE_KEY]);
      const seated = resolutionAnnotations(SKY_ID, [], undefined, undefined, undefined, {reading: tileGrantReadingOf(sky(), voting([seat(BLUE, 3, 2, 1)]), BLUE)});
      expect(seated.map((b) => b.labelKey)).deep.eq(['When enacted', 'For you', 'Chairman quest']);
      const you = seated[1].rows[0] as {text: string, params?: ReadonlyArray<string>};
      expect(you.text).eq('${0}: ${1}');
      expect(you.params?.[0]).contains('influence 2');
      expect(you.params?.[1]).contains('1');
      // Off the table the row does not exist — a reference reading says nothing personal.
      expect(resolutionAnnotations(SKY_ID, [], undefined, undefined, undefined, {reading: tileGrantReadingOf(sky(), undefined, BLUE)}).map((b) => b.labelKey))
        .deep.eq(['When enacted', 'Chairman quest']);
    });

    it('the band: a `grant` chip on the reward line for a tier owed or placed — never for a skipped seat (its skip chip says that)', () => {
      const line = parliamentBandLine({
        sitting: {
          stage: 'reward', rewardStep: 'placement', beat: '', supportWave: '', generation: 3, awaiting: [],
          summary: {generation: 3, final: false, winner: {instance: SKY, resolution: SKY_ID, party: PartyName.MARS, votes: 2, player: BLUE}, support: [], enacted: {instance: SKY, resolution: SKY_ID, party: PartyName.MARS}, refreshed: [], lobbyRefilled: []},
          reward: {yields: [], reactions: [], skips: [], grant: 'city'},
        },
        standing: {votes: 0},
      });
      expect(line.chips).deep.eq([{kind: 'grant', tile: 'city'}]);
    });

    it('the results panel: a city tier is its tile with the STACK beside it — «×2», no amount', () => {
      const part = resultsPayoutPart(tier(BLUE, 2), 0);
      expect(part).deep.include({kind: 'city', tile: 'city', stack: 2, unit: ''});
      expect(part.amount).is.undefined;
      expect(part.skipped).is.undefined;
      expect(resultsPayoutPart(skip(BLUE, 1, TILE_GRANT_NOT_ELIGIBLE_REASON), 0).skipped).deep.eq({title: 'Resolution effect', reason: TILE_GRANT_NOT_ELIGIBLE_REASON});
    });
  });

  describe('the graphic block', () => {
    const mountReading = (reading: TileGrantReading, over: Record<string, unknown> = {}) =>
      mount(ConsoleTileGrant, {props: {reading, size: 'normal', variant: 'block', ...over}, ...t});

    it('draws the tile, where it lands, the destinations and the caption — and says its state in data and class', () => {
      const w = mountReading(tileGrantReadingOf(sky(), voting([seat(BLUE, 3, 2, 1)]), BLUE)!);
      const root = w.find('[data-tile-grant]');
      expect(root.attributes('data-grant-context')).eq('conditional');
      expect(root.attributes('data-grant-eligibility')).eq('influence');
      expect(root.attributes('data-grant-cities')).eq('1');
      expect(root.classes()).contains('con-tgrant--yours');
      expect(root.classes()).not.contains('con-tgrant--passed');
      expect(w.find('.con-tgrant__name').text()).eq('City tile');
      expect(w.find('[data-grant-where]').text()).contains('on top of your own city on Mars');
      expect(w.find('[data-grant-detail]').text()).contains('1');
      expect(w.find('[data-grant-caption]').text()).contains('influence 2');
      expect(w.find('.con-tgrant__label').text()).contains('2');
    });

    it('passed over by the rule / nowhere to build / the record — each its own pose', () => {
      const passed = mountReading(tileGrantReadingOf(sky(), voting([seat(BLUE, 1, 1, 1)]), BLUE)!);
      expect(passed.find('[data-tile-grant]').classes()).contains('con-tgrant--passed');
      const nowhere = mountReading(tileGrantReadingOf(sky(), voting([seat(BLUE, 3, 2, 0)]), BLUE)!);
      expect(nowhere.find('[data-tile-grant]').classes()).contains('con-tgrant--nowhere');
      expect(nowhere.find('[data-grant-detail]').text()).eq(TILE_GRANT_NO_DESTINATION_REASON);
      const placed = mountReading(tileGrantReadingOf(sky(), resolving([seat(BLUE, 1, 1, 1)], BLUE, [tier(BLUE, 1)]), BLUE)!, {variant: 'inline', size: 'compact'});
      expect(placed.find('[data-tile-grant]').attributes('data-grant-stack')).eq('2');
      expect(placed.find('[data-grant-stack-line]').text()).eq('×2');
      expect(placed.find('[data-grant-detail]').exists(), 'the stack replaces the destinations').is.false;
      expect(placed.find('.con-tgrant__head').exists(), 'inline: no head of its own').is.false;
      expect(placed.find('[data-grant-caption]').text()).contains('winner of the vote');
      const skipped = mountReading(tileGrantReadingOf(sky(), resolving([seat(BLUE, 1, 1, 0)], BLUE, [skip(BLUE, 1, TILE_GRANT_NO_DESTINATION_REASON)]), BLUE)!, {reasonElsewhere: true});
      expect(skipped.find('[data-tile-grant]').classes()).contains('con-tgrant--skipped');
      expect(skipped.find('[data-grant-caption]').text(), 'the host carries the reason: the caption says «skipped» alone').eq('Skipped');
    });
  });
});
