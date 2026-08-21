import {expect} from 'chai';
import {
  computeTimelineStats,
  buildVictoryProfile,
  selectInsights,
  generateInsights,
  gameSeed,
  InsightCandidate,
  InsightContext,
} from '@/client/components/endgame/insightEngine';
import {EndgameCategory, EndgameCategoryKey, EndgamePlayerScore} from '@/client/components/endgame/endgameModel';
import {MarsBotCorpId} from '@/common/automa/AutomaTypes';
import {MarsBotCorpStats} from '@/common/automa/MarsBotCorpData';
import {VictoryPointsBreakdown} from '@/common/game/VictoryPointsBreakdown';
import {Color} from '@/common/Color';

function breakdown(partial: Partial<VictoryPointsBreakdown>): VictoryPointsBreakdown {
  return {
    terraformRating: 20,
    terraformRatingBreakdown: {base: 20, temperature: 0, oxygen: 0, oceans: 0, venus: 0, cards: 0},
    milestones: 0, awards: 0, greenery: 0, city: 0, escapeVelocity: 0,
    moonHabitats: 0, moonMines: 0, moonRoads: 0, planetaryTracks: 0, deltaProject: 0,
    victoryPoints: 0, total: 20,
    detailsCards: [], detailsMilestones: [], detailsAwards: [], detailsPlanetaryTracks: [],
    negativeVP: 0,
    ...partial,
  };
}

function score(color: Color, name: string, opts: {
  total?: number;
  categories?: Partial<Record<EndgameCategoryKey, number>>;
  vpByGeneration?: Array<number>;
  parametersTotal?: number;
  topCards?: Array<{cardName: string; victoryPoint: number}>;
  penaltyCards?: Array<{cardName: string; victoryPoint: number}>;
} = {}): EndgamePlayerScore {
  const categories: Record<EndgameCategoryKey, number> =
    {tr: 20, cards: 0, board: 0, mca: 0, moon: 0, tracks: 0, ...(opts.categories ?? {})};
  return {
    color,
    name,
    corporations: [],
    place: 1,
    isWinner: false,
    total: opts.total ?? 20,
    megacredits: 0,
    breakdown: breakdown({total: opts.total ?? 20}),
    vpByGeneration: opts.vpByGeneration ?? [],
    categories,
    topCards: (opts.topCards ?? []).map((c) => ({...c, kind: 'conditional' as const})),
    penaltyCards: (opts.penaltyCards ?? []).map((c) => ({...c, kind: 'penalty' as const})),
    globalSteps: {},
    parametersTotal: opts.parametersTotal ?? 0,
    strongestCategory: undefined,
  };
}

function category(key: EndgameCategoryKey, values: Partial<Record<Color, number>>): EndgameCategory {
  let max = 0;
  for (const v of Object.values(values)) {
    if (v !== undefined && v > max) {
      max = v;
    }
  }
  const leaders: Array<Color> = [];
  if (max > 0) {
    for (const [color, v] of Object.entries(values)) {
      if (v === max) {
        leaders.push(color as Color);
      }
    }
  }
  return {key, label: key, accent: key, values: values as Record<string, number>, max, leaders};
}

function ctxFor(players: Array<EndgamePlayerScore>, opts: {
  generation?: number;
  categories?: Array<EndgameCategory>;
} = {}): InsightContext {
  const winner = players[0];
  winner.isWinner = true;
  const runnerUp = players[1];
  const generation = opts.generation ?? 10;
  const margin = runnerUp !== undefined ? winner.total - runnerUp.total : 0;
  const timeline = computeTimelineStats(players, winner, generation, leadGen(players, winner, generation));
  return {
    mode: players.length === 2 ? 'duel' : 'standings',
    generation,
    players,
    winner,
    runnerUp,
    margin,
    categories: opts.categories ?? [],
    parameters: [],
    timeline,
    profile: buildVictoryProfile(winner),
    seed: gameSeed(players, generation),
  };
}

// Re-implements the model's winnerTookLeadGen for the harness (the engine
// receives it from endgameModel in production).
function leadGen(players: Array<EndgamePlayerScore>, winner: EndgamePlayerScore, generation: number): number | undefined {
  const others = players.filter((p) => p.color !== winner.color);
  const len = Math.min(generation, winner.vpByGeneration.length, ...others.map((o) => o.vpByGeneration.length));
  if (len <= 0 || others.length === 0) {
    return undefined;
  }
  let lastNotAhead = -1;
  for (let g = 0; g < len; g++) {
    const w = winner.vpByGeneration[g];
    if (others.some((o) => o.vpByGeneration[g] >= w)) {
      lastNotAhead = g;
    }
  }
  if (lastNotAhead < 0 || lastNotAhead + 1 >= len) {
    return undefined;
  }
  return lastNotAhead + 2;
}

describe('insightEngine', () => {
  describe('computeTimelineStats', () => {
    it('counts lead changes and winner-led generations', () => {
      const a = score('red', 'A', {total: 40, vpByGeneration: [10, 12, 20, 30, 40]});
      const b = score('blue', 'B', {total: 35, vpByGeneration: [11, 14, 15, 25, 35]});
      const t = computeTimelineStats([a, b], a, 5, undefined);
      expect(t).to.not.eq(undefined);
      expect(t?.sampled).to.eq(5);
      // B leads gens 1-2, A leads 3-5 → one change.
      expect(t?.leadChanges).to.eq(1);
      expect(t?.winnerLedGens).to.eq(3);
      expect(t?.wireToWire).to.eq(false);
      expect(t?.maxDeficit).to.eq(2); // gen 2: 14 vs 12
      expect(t?.maxDeficitGen).to.eq(2);
    });

    it('flags wire-to-wire and computes the final surge', () => {
      const a = score('red', 'A', {total: 50, vpByGeneration: [12, 20, 28, 38, 50]});
      const b = score('blue', 'B', {total: 30, vpByGeneration: [8, 14, 20, 26, 30]});
      const t = computeTimelineStats([a, b], a, 5, undefined);
      expect(t?.wireToWire).to.eq(true);
      expect(t?.finalSurge?.color).to.eq('red');
      expect(t?.finalSurge?.gain).to.eq(22); // 50 - 28
      expect(t?.finalSurge?.bestOtherGain).to.eq(10); // 30 - 20
    });

    it('returns undefined without enough data', () => {
      const a = score('red', 'A', {vpByGeneration: []});
      const b = score('blue', 'B', {vpByGeneration: []});
      expect(computeTimelineStats([a, b], a, 8, undefined)).to.eq(undefined);
      expect(computeTimelineStats([a], a, 8, undefined)).to.eq(undefined);
    });
  });

  describe('buildVictoryProfile', () => {
    it('classifies a terraforming-driven win', () => {
      const w = score('red', 'A', {categories: {tr: 45, cards: 10, board: 8, mca: 5}});
      const p = buildVictoryProfile(w);
      expect(p?.kind).to.eq('terraformer');
      expect(p?.sourceKey).to.eq('tr');
      expect(p?.share).to.be.greaterThan(50);
    });

    it('classifies a card-engine win', () => {
      const w = score('red', 'A', {categories: {tr: 25, cards: 30, board: 5, mca: 5}});
      expect(buildVictoryProfile(w)?.kind).to.eq('engine');
    });

    it('falls back to balanced when nothing dominates', () => {
      const w = score('red', 'A', {categories: {tr: 26, cards: 18, board: 14, mca: 12}});
      expect(buildVictoryProfile(w)?.kind).to.eq('balanced');
    });
  });


  describe('analyzeBotCorporation', () => {
    /** A duel between a human and the bot seat carrying `stats`. */
    function botInsights(stats: MarsBotCorpStats, id: MarsBotCorpId = MarsBotCorpId.C05_INVENTRIX, name = 'Inventrix') {
      const human = score('blue', 'Human', {total: 60, vpByGeneration: [10, 20, 40, 60]});
      const bot = score('red', 'Bot', {total: 40, vpByGeneration: [8, 16, 30, 40]});
      bot.botCorporation = {id, name, stats};
      return generateInsights(ctxFor([human, bot]))
        .filter((i) => i.storyCluster === 'bot-corporation');
    }

    it('C05 tells its two printed halves as SEPARATE stories', () => {
      const insights = botInsights({
        inventrixTriggers: 7, inventrixMc: 14,
        doItRightTemperature: 2, doItRightGreeneries: 1, doItRightOceans: 1,
      });
      // TWO cards, with stable distinct ids (the reading ORDER is the story
      // selector's business — the stronger half may well lead).
      expect(insights).has.length(2);
      expect(insights.map((i) => i.id).sort()).deep.eq(
        ['reason.bot-corporation.red', 'reason.bot-corporation.red.do-it-right']);
      const toll = insights.find((i) => i.textKey.includes('Hard problems were good business'));
      const pushes = insights.find((i) => i.textKey.includes('finished the job'));
      expect(toll, 'the requirement toll has its own card').is.not.undefined;
      expect(pushes, 'Do It Right has its own card').is.not.undefined;
      // Neither sentence carries the other half's numbers.
      expect(toll!.textKey).not.contains('Do It Right');
      expect(pushes!.textKey).not.contains('requirements');
    });

    it('only the half that actually fired speaks — and it keeps the plain id', () => {
      const insights = botInsights({
        inventrixTriggers: 1, inventrixMc: 2,
        doItRightTemperature: 3,
      });
      expect(insights).has.length(1);
      expect(insights[0].id).eq('reason.bot-corporation.red');
      expect(insights[0].textKey).contains('finished the job');
    });

    it('below both thresholds the corporation says nothing', () => {
      expect(botInsights({inventrixTriggers: 2, inventrixMc: 4, doItRightOceans: 1})).is.empty;
    });

    it('a one-story corporation still emits exactly one candidate', () => {
      const insights = botInsights(
        {credicorTriggers: 6, credicorMc: 24}, MarsBotCorpId.C01_CREDICOR, 'CrediCor');
      expect(insights).has.length(1);
      expect(insights[0].id).eq('reason.bot-corporation.red');
    });

    it('C15 names the price of every push it bought', () => {
      const insights = botInsights({diversificationPlayed: 5, diversificationPushes: 5, diversificationMc: 20},
        MarsBotCorpId.C15_ROBINSON_INDUSTRIES, 'Robinson Industries');
      expect(insights).has.length(1);
      expect(insights[0].textKey).contains('bought ${2} steps');
      expect(insights[0].textKey, 'the cost is stated in table language').contains('victory points');
      expect(insights[0].params.map((p) => p.v), 'the M€ it paid is in the sentence').contains('20');
    });

    it('C15 says so when the war chest ran dry instead of hiding it', () => {
      const insights = botInsights({diversificationPlayed: 6, diversificationPushes: 6, diversificationMc: 8, diversificationFree: 4},
        MarsBotCorpId.C15_ROBINSON_INDUSTRIES, 'Robinson Industries');
      expect(insights).has.length(1);
      expect(insights[0].textKey).contains('came free once the war chest ran dry');
    });

    it('C16 counts the free projects, not the cubes that produced them', () => {
      const insights = botInsights({valleyCubesHit: 2, valleyCardsDrawn: 2, valleyExtraStartCards: 1},
        MarsBotCorpId.C16_VALLEY_TRUST, 'Valley Trust');
      expect(insights).has.length(1);
      expect(insights[0].textKey).contains('free projects on the table');
      expect(insights[0].textKey, 'the internal cube vocabulary stays in the code').not.contains('cube');
      expect(insights[0].params.map((p) => p.v)).contains('2');
    });

    it('C16 says nothing when only one cube ever paid', () => {
      expect(botInsights({valleyCubesHit: 1, valleyCardsDrawn: 1, valleyExtraStartCards: 1},
        MarsBotCorpId.C16_VALLEY_TRUST, 'Valley Trust')).is.empty;
    });

    it('C17 tells its two printed halves as SEPARATE stories', () => {
      const insights = botInsights({vitorTriggers: 8, vitorMc: 24, vitorOverachievementGenerations: 6},
        MarsBotCorpId.C17_VITOR, 'Vitor');
      expect(insights).has.length(2);
      expect(insights.map((i) => i.id).sort()).deep.eq(
        ['reason.bot-corporation.red', 'reason.bot-corporation.red.overachievement']);
      const toll = insights.find((i) => i.textKey.includes('prestige, not progress'));
      const claim = insights.find((i) => i.textKey.includes('milestone board was never safe'));
      expect(toll, 'the VP toll has its own card').is.not.undefined;
      expect(claim, 'the standing claim has its own card').is.not.undefined;
      expect(toll!.textKey).not.contains('milestone');
    });

    it('C17 says nothing when its card was destroyed early and the toll was thin', () => {
      expect(botInsights({vitorTriggers: 2, vitorMc: 6, vitorOverachievementGenerations: 2},
        MarsBotCorpId.C17_VITOR, 'Vitor')).is.empty;
    });

    it('C18 tells the land grab and the rent as SEPARATE stories', () => {
      const insights = botInsights({arcadianMarkers: 6, arcadianBuilds: 4, arcadianMc: 12},
        MarsBotCorpId.C18_ARCADIAN_COMMUNITIES, 'Arcadian Communities');
      expect(insights).has.length(2);
      expect(insights.map((i) => i.id).sort()).deep.eq(
        ['reason.bot-corporation.red', 'reason.bot-corporation.red.own-land']);
      const grab = insights.find((i) => i.textKey.includes('staking out Mars'));
      const rent = insights.find((i) => i.textKey.includes('Building on its own land'));
      expect(grab, 'the claims have their own card').is.not.undefined;
      expect(rent, 'the rent has its own card').is.not.undefined;
      expect(grab!.textKey, 'the internal marker vocabulary stays in the code').not.contains('marker');
    });

    it('C18 keeps quiet when it barely claimed anything', () => {
      expect(botInsights({arcadianMarkers: 2, arcadianBuilds: 1, arcadianMc: 3},
        MarsBotCorpId.C18_ARCADIAN_COMMUNITIES, 'Arcadian Communities')).is.empty;
    });

    it('C19 counts the extra pushes, and speaks in its own voice — not C14\'s', () => {
      const drill = botInsights({astroWhiteCubes: 3, astroBlackCubes: 2, astroSteps: 5},
        MarsBotCorpId.C19_ASTRO_DRILL, 'Astro Drill');
      expect(drill).has.length(1);
      expect(drill[0].textKey).contains('flywheel');
      expect(drill[0].params.map((p) => p.v)).contains('5');

      // The two corporations share an EFFECT, never a sentence.
      const luna = botInsights({lunaSteps: 5}, MarsBotCorpId.C14_POINT_LUNA, 'Point Luna');
      expect(luna).has.length(1);
      expect(luna[0].textKey).is.not.eq(drill[0].textKey);
    });

    it('C20 tells the till and the dry spell as SEPARATE stories', () => {
      const insights = botInsights({factorumStored: 14, factorumWithdrawn: 12, supplyDemandPlayed: 6, supplyDemandEmpty: 4},
        MarsBotCorpId.C20_FACTORUM, 'Factorum');
      expect(insights).has.length(2);
      expect(insights.map((i) => i.id).sort()).deep.eq(
        ['reason.bot-corporation.red', 'reason.bot-corporation.red.dry-till']);
      const cash = insights.find((i) => i.textKey.includes('like a factory floor'));
      const dry = insights.find((i) => i.textKey.includes('came up empty'));
      expect(cash, 'the cash-out has its own card').is.not.undefined;
      expect(dry, 'the dry spell has its own card').is.not.undefined;
      expect(cash!.params.map((p) => p.v)).contains('12');
    });

    it('C20 keeps quiet when the till barely moved', () => {
      expect(botInsights({factorumStored: 3, factorumWithdrawn: 3, supplyDemandPlayed: 1, supplyDemandEmpty: 1},
        MarsBotCorpId.C20_FACTORUM, 'Factorum')).is.empty;
    });

    it('C21 tells its two OPPOSITE halves as separate stories', () => {
      const insights = botInsights({pharmacyTr: 6, pharmacyScienceCards: 5, pharmacyOwnTag: 1,
        pharmacyMicrobeTags: 4, pharmacyMcLost: 14},
      MarsBotCorpId.C21_PHARMACY_UNION, 'Pharmacy Union');
      expect(insights).has.length(2);
      expect(insights.map((i) => i.id).sort()).deep.eq(
        ['reason.bot-corporation.red', 'reason.bot-corporation.red.microbe-toll']);
      const paid = insights.find((i) => i.textKey.includes('shortest road to standing'));
      const taxed = insights.find((i) => i.textKey.includes('could not stomach'));
      expect(paid, 'the TR it earned has its own card').is.not.undefined;
      expect(taxed, 'the toll it paid has its own card').is.not.undefined;
      expect(paid!.textKey, 'neither sentence carries the other half').not.contains('microbe');
    });

    it('C21 keeps quiet when neither half moved much', () => {
      expect(botInsights({pharmacyTr: 2, pharmacyMicrobeTags: 1, pharmacyMcLost: 4},
        MarsBotCorpId.C21_PHARMACY_UNION, 'Pharmacy Union')).is.empty;
    });

    it('C22 tells the border, the road it bought and the card as SEPARATE stories', () => {
      const insights = botInsights({philaresBorders: 12, philaresScience: 13, philaresSpends: 3,
        philaresSteps: 3, buildPlayed: 4, buildCities: 2, buildSpecialTiles: 1},
      MarsBotCorpId.C22_PHILARES, 'Philares');
      expect(insights).has.length(3);
      expect(insights.map((i) => i.id).sort()).deep.eq([
        'reason.bot-corporation.red',
        'reason.bot-corporation.red.build-card',
        'reason.bot-corporation.red.science-spent',
      ]);
      const border = insights.find((i) => i.textKey.includes('shared frontier'));
      const road = insights.find((i) => i.textKey.includes('frontier was a road'));
      const built = insights.find((i) => i.textKey.includes('did not wait to be neighboured'));
      expect(border, 'the borders have their own card').is.not.undefined;
      expect(road, 'the conversions have their own card').is.not.undefined;
      expect(built, 'the bonus card has its own card').is.not.undefined;
      expect(border!.textKey, 'neither sentence carries another\'s fact').not.contains('science');
      expect(border!.params.map((p) => p.v)).contains('12');
      expect(built!.params.map((p) => p.v)).contains('3');
    });

    it('C22 keeps quiet when the two builds barely touched', () => {
      expect(botInsights({philaresBorders: 3, philaresScience: 4, philaresSpends: 1, philaresSteps: 1},
        MarsBotCorpId.C22_PHILARES, 'Philares')).is.empty;
    });

    it('C23 tells the conversion rate as ONE story', () => {
      const insights = botInsights({recyclonCubesHit: 4, recyclonSteps: 4},
        MarsBotCorpId.C23_RECYCLON, 'Recyclon');
      expect(insights).has.length(1);
      expect(insights[0].textKey).contains('one belt');
      expect(insights[0].params.map((p) => p.v)).contains('4');
    });

    it('C23 keeps quiet when the belt barely turned', () => {
      expect(botInsights({recyclonCubesHit: 1, recyclonSteps: 1},
        MarsBotCorpId.C23_RECYCLON, 'Recyclon')).is.empty;
    });

    it('C24 tells the two seats it bills as SEPARATE stories', () => {
      const insights = botInsights({spliceHumanTags: 6, spliceHumanMc: 12, spliceOwnTags: 4, spliceOwnMc: 16},
        MarsBotCorpId.C24_SPLICE, 'Splice');
      expect(insights).has.length(2);
      expect(insights.map((i) => i.id).sort()).deep.eq(
        ['reason.bot-corporation.red', 'reason.bot-corporation.red.own-microbes']);
      const royalties = insights.find((i) => i.textKey.includes('licensed'));
      const own = insights.find((i) => i.textKey.includes('its own biology'));
      expect(royalties, 'what the opponent paid has its own card').is.not.undefined;
      expect(own, 'what its own microbes paid has its own card').is.not.undefined;
      expect(royalties!.params.map((p) => p.v)).contains('12');
      expect(own!.params.map((p) => p.v)).contains('16');
    });

    it('C24 keeps quiet when neither seat grew much', () => {
      expect(botInsights({spliceHumanTags: 2, spliceHumanMc: 4, spliceOwnTags: 1, spliceOwnMc: 4},
        MarsBotCorpId.C24_SPLICE, 'Splice')).is.empty;
    });

    it('C25 tells its double-paying cards as ONE story', () => {
      const insights = botInsights({vironActionCards: 5, vironFloaters: 5},
        MarsBotCorpId.C25_VIRON, 'Viron');
      expect(insights).has.length(1);
      expect(insights[0].textKey).contains('worked twice');
      expect(insights[0].params.map((p) => p.v)).contains('5');
    });

    it('C25 keeps quiet when it barely saw an arrow', () => {
      expect(botInsights({vironActionCards: 1, vironFloaters: 1},
        MarsBotCorpId.C25_VIRON, 'Viron')).is.empty;
    });

    it('C26 tells the steady income and the paid failures as SEPARATE stories', () => {
      const insights = botInsights({celesticFloaters: 12, celesticRounds: 8, celesticFailedActions: 4, celesticSetup: 1},
        MarsBotCorpId.C26_CELESTIC, 'Celestic');
      expect(insights).has.length(2);
      expect(insights.map((i) => i.id).sort()).deep.eq(
        ['reason.bot-corporation.red', 'reason.bot-corporation.red.failed-actions']);
      const income = insights.find((i) => i.textKey.includes('whatever the turn brought'));
      const failures = insights.find((i) => i.textKey.includes('Being stuck paid'));
      expect(income, 'the pool has its own card').is.not.undefined;
      expect(failures, 'the failures have their own card').is.not.undefined;
      expect(income!.params.map((p) => p.v)).contains('12');
      expect(failures!.params.map((p) => p.v)).contains('4');
    });

    it('C26 keeps quiet when barely anything gathered', () => {
      expect(botInsights({celesticFloaters: 3, celesticRounds: 2, celesticFailedActions: 1},
        MarsBotCorpId.C26_CELESTIC, 'Celestic')).is.empty;
    });

    it('C27 tells the cubes and the lobby as SEPARATE stories', () => {
      const insights = botInsights({morningCubesHit: 4, morningMc: 20, lobbyPlayed: 3, lobbyVenus: 3, lobbyParameter: 3},
        MarsBotCorpId.C27_MORNING_STAR, 'Morning Star Inc.');
      expect(insights).has.length(2);
      expect(insights.map((i) => i.id).sort()).deep.eq(
        ['reason.bot-corporation.red', 'reason.bot-corporation.red.lobby']);
      const cubes = insights.find((i) => i.textKey.includes('by the metre'));
      const lobby = insights.find((i) => i.textKey.includes('kept the wheel turning'));
      expect(cubes, 'the cubes have their own card').is.not.undefined;
      expect(lobby, 'the lobby has its own card').is.not.undefined;
      expect(cubes!.params.map((p) => p.v)).contains('20');
      expect(lobby!.params.map((p) => p.v)).contains('3');
    });

    it('C27 keeps quiet when the track barely moved', () => {
      expect(botInsights({morningCubesHit: 1, morningMc: 5, lobbyPlayed: 1},
        MarsBotCorpId.C27_MORNING_STAR, 'Morning Star Inc.')).is.empty;
    });

    it('C28 tells its toll as ONE story', () => {
      const insights = botInsights({aphroditeSteps: 9, aphroditeMc: 18},
        MarsBotCorpId.C28_APHRODITE, 'Aphrodite');
      expect(insights).has.length(1);
      expect(insights[0].textKey).contains('Nobody could touch Venus');
      expect(insights[0].params.map((p) => p.v)).contains('18');
    });

    it('C28 keeps quiet when Venus barely moved', () => {
      expect(botInsights({aphroditeSteps: 2, aphroditeMc: 4},
        MarsBotCorpId.C28_APHRODITE, 'Aphrodite')).is.empty;
    });

    it('C29 tells its extra spaces as ONE story', () => {
      const insights = botInsights({manutechTriggers: 7, manutechSteps: 6},
        MarsBotCorpId.C29_MANUTECH, 'Manutech');
      expect(insights).has.length(1);
      expect(insights[0].textKey).contains('never stopped at a checkpoint');
      expect(insights[0].params.map((p) => p.v), 'the number is the spaces the player watched it take')
        .contains('6');
    });

    it('C29 keeps quiet when the line barely rolled', () => {
      expect(botInsights({manutechTriggers: 3, manutechSteps: 3},
        MarsBotCorpId.C29_MANUTECH, 'Manutech')).is.empty;
    });

    it('C30 tells its cube engine as ONE story', () => {
      const insights = botInsights({aridorCubesHit: 6, aridorSteps: 6, aridorColonyAdded: 1},
        MarsBotCorpId.C30_ARIDOR, 'Aridor');
      expect(insights).has.length(1);
      expect(insights[0].textKey).contains('Every direction paid the same account');
      expect(insights[0].params.map((p) => p.v)).contains('6');
    });

    it('C30 keeps quiet when barely any cube was reached', () => {
      expect(botInsights({aridorCubesHit: 2, aridorSteps: 2, aridorColonyAdded: 1},
        MarsBotCorpId.C30_ARIDOR, 'Aridor')).is.empty;
    });

    it('C31 tells its living payroll as ONE story', () => {
      const insights = botInsights({arklightTags: 7, arklightMc: 14},
        MarsBotCorpId.C31_ARKLIGHT, 'Arklight');
      expect(insights).has.length(1);
      expect(insights[0].textKey).contains('not one microbe among them');
      expect(insights[0].params.map((p) => p.v)).contains('14');
    });

    it('C31 keeps quiet when barely anything grew', () => {
      expect(botInsights({arklightTags: 2, arklightMc: 4},
        MarsBotCorpId.C31_ARKLIGHT, 'Arklight')).is.empty;
    });

    it('C32 tells the thinning and the dead turns as SEPARATE stories', () => {
      const insights = botInsights({polyphemosDiscards: 9, polyphemosTaglessShed: 3},
        MarsBotCorpId.C32_POLYPHEMOS, 'Polyphemos');
      expect(insights).has.length(2);
      expect(insights[0].textKey).contains('Nothing weak survived');
      expect(insights[1].textKey).contains('no tag at all');
    });

    it('C32 keeps the second story quiet when nothing tagless was shed', () => {
      const insights = botInsights({polyphemosDiscards: 9, polyphemosTaglessShed: 0},
        MarsBotCorpId.C32_POLYPHEMOS, 'Polyphemos');
      expect(insights).has.length(1);
      expect(insights[0].textKey).contains('Nothing weak survived');
    });

    it('C32 keeps quiet when barely anything was shed', () => {
      expect(botInsights({polyphemosDiscards: 2, polyphemosTaglessShed: 1},
        MarsBotCorpId.C32_POLYPHEMOS, 'Polyphemos')).is.empty;
    });

    it('C33 tells the table colonies and the opponent OWN ones as SEPARATE stories', () => {
      const insights = botInsights({poseidonSteps: 6, poseidonBotColonies: 2, poseidonHumanColonies: 4},
        MarsBotCorpId.C33_POSEIDON, 'Poseidon');
      // Order is the SELECTOR's business (it ranks by measure/scale), so the
      // claim here is the SET: two independent facts, never one welded line.
      expect(insights).has.length(2);
      const keys = insights.map((i) => i.textKey).join(' | ');
      expect(keys).contains('Every flag planted anywhere');
      expect(keys).contains('of those flags were');
    });

    it('C33 keeps the second story quiet when the opponent never settled', () => {
      const insights = botInsights({poseidonSteps: 6, poseidonBotColonies: 6, poseidonHumanColonies: 0},
        MarsBotCorpId.C33_POSEIDON, 'Poseidon');
      expect(insights).has.length(1);
    });

    it('C33 keeps quiet when barely anything was founded', () => {
      expect(botInsights({poseidonSteps: 2, poseidonBotColonies: 1, poseidonHumanColonies: 1},
        MarsBotCorpId.C33_POSEIDON, 'Poseidon')).is.empty;
    });

    it('C34 tells the burn and the stockpile as SEPARATE stories', () => {
      const insights = botInsights({stormcraftTemperature: 3, stormcraftSpends: 3, stormcraftFloaters: 12},
        MarsBotCorpId.C34_STORMCRAFT, 'Stormcraft Incorporated');
      expect(insights).has.length(2);
      const keys = insights.map((i) => i.textKey).join(' | ');
      expect(keys).contains('stored, it burned');
      expect(keys).contains('tanks were never empty');
    });

    it('C34 keeps the burn quiet when the exchange never fired', () => {
      const insights = botInsights({stormcraftTemperature: 0, stormcraftSpends: 0, stormcraftFloaters: 12},
        MarsBotCorpId.C34_STORMCRAFT, 'Stormcraft Incorporated');
      expect(insights).has.length(1);
      expect(insights[0].textKey).contains('tanks were never empty');
    });

    it('C34 keeps quiet when barely anything gathered', () => {
      expect(botInsights({stormcraftTemperature: 1, stormcraftSpends: 1, stormcraftFloaters: 4},
        MarsBotCorpId.C34_STORMCRAFT, 'Stormcraft Incorporated')).is.empty;
    });

    it('C35 tells the flipping cube and the shoreline as SEPARATE stories', () => {
      const insights = botInsights({lakefrontOceans: 9, lakefrontSteps: 5, lakefrontWaterfront: 4, lakefrontExtraMc: 6},
        MarsBotCorpId.C35_LAKEFRONT_RESORTS, 'Lakefront Resorts');
      expect(insights).has.length(2);
      const keys = insights.map((i) => i.textKey).join(' | ');
      expect(keys).contains('Every second wave');
      expect(keys).contains('built where the water was');
    });

    it('C35 keeps the shoreline quiet when it never built by the water', () => {
      const insights = botInsights({lakefrontOceans: 9, lakefrontSteps: 5, lakefrontWaterfront: 0, lakefrontExtraMc: 0},
        MarsBotCorpId.C35_LAKEFRONT_RESORTS, 'Lakefront Resorts');
      expect(insights).has.length(1);
      expect(insights[0].textKey).contains('Every second wave');
    });

    it('C35 keeps quiet on a dry map', () => {
      expect(botInsights({lakefrontOceans: 2, lakefrontSteps: 1, lakefrontWaterfront: 1, lakefrontExtraMc: 1},
        MarsBotCorpId.C35_LAKEFRONT_RESORTS, 'Lakefront Resorts')).is.empty;
    });

    it('C36 tells the called-off steps and the money as SEPARATE stories', () => {
      const insights = botInsights({pristarConversions: 5, pristarMc: 30, pristarCubes: 6},
        MarsBotCorpId.C36_PRISTAR, 'Pristar');
      expect(insights).has.length(2);
      const keys = insights.map((i) => i.textKey).join(' | ');
      expect(keys).contains('left alone for money');
      expect(keys).contains('Preservation paid');
    });

    it('C36 keeps quiet when the cube was hardly ever spent', () => {
      expect(botInsights({pristarConversions: 1, pristarMc: 6, pristarCubes: 5},
        MarsBotCorpId.C36_PRISTAR, 'Pristar')).is.empty;
    });

    it('C38 tells the thicker deck and the late doubling as SEPARATE stories', () => {
      const insights = botInsights({terralabsCards: 12, terralabsLateCards: 6, terralabsTrLost: 8},
        MarsBotCorpId.C38_TERRALABS, 'TerraLabs');
      expect(insights).has.length(2);
      const keys = insights.map((i) => i.textKey).join(' | ');
      expect(keys).contains('Research outran the rating');
      expect(keys).contains('late game came in twos');
    });

    it('C38 keeps the late line quiet in a short game', () => {
      const insights = botInsights({terralabsCards: 8, terralabsLateCards: 0, terralabsTrLost: 8},
        MarsBotCorpId.C38_TERRALABS, 'TerraLabs');
      expect(insights).has.length(1);
      expect(insights[0].textKey).contains('Research outran the rating');
    });

    it('C39 tells the rebalancing and the dividends as SEPARATE stories', () => {
      const insights = botInsights({investorsPlayed: 9, investorsPushes: 4, investorsRegressions: 4, investorsMc: 20},
        MarsBotCorpId.C39_UTOPIA_INVEST, 'Utopia Invest');
      expect(insights).has.length(2);
      const keys = insights.map((i) => i.textKey).join(' | ');
      expect(keys).contains('allowed to run away');
      expect(keys).contains('off years paid dividends');
    });

    it('C39 keeps the dividends quiet when the odd generations paid little', () => {
      const insights = botInsights({investorsPlayed: 5, investorsPushes: 3, investorsRegressions: 3, investorsMc: 4},
        MarsBotCorpId.C39_UTOPIA_INVEST, 'Utopia Invest');
      expect(insights).has.length(1);
      expect(insights[0].textKey).contains('allowed to run away');
    });

    it('C40 tells the conversions and the harvest as SEPARATE stories', () => {
      const insights = botInsights({ecotecPlantsAdded: 18, ecotecSpends: 3, ecotecSteps: 3, ecotecMicrobeCells: 1},
        MarsBotCorpId.C40_ECOTEC, 'EcoTec');
      expect(insights).has.length(2);
      const keys = insights.map((i) => i.textKey).join(' | ');
      expect(keys).contains('counted twice');
      expect(keys).contains('greenhouse never stood empty');
    });

    it('C40 keeps quiet when the greenhouse barely ran', () => {
      expect(botInsights({ecotecPlantsAdded: 6, ecotecSpends: 1, ecotecSteps: 1},
        MarsBotCorpId.C40_ECOTEC, 'EcoTec')).is.empty;
    });

    it('C41 tells the mined track and the water as SEPARATE stories', () => {
      const insights = botInsights({kuiperWhiteCubes: 3, kuiperTemperatureSteps: 3, kuiperBlackCubes: 3, kuiperOceans: 3},
        MarsBotCorpId.C41_KUIPER_COOPERATIVE, 'Kuiper Cooperative');
      expect(insights).has.length(2);
      const keys = insights.map((i) => i.textKey).join(' | ');
      expect(keys).contains('One track did all of it');
      expect(keys).contains('beyond Neptune');
    });

    it('C41 keeps the water line quiet when the black cubes never came up', () => {
      const insights = botInsights({kuiperWhiteCubes: 3, kuiperTemperatureSteps: 3, kuiperBlackCubes: 0, kuiperOceans: 0},
        MarsBotCorpId.C41_KUIPER_COOPERATIVE, 'Kuiper Cooperative');
      expect(insights).has.length(1);
      expect(insights[0].textKey).contains('One track did all of it');
    });

    it('C42 tells the schedule and the idle generations as SEPARATE stories', () => {
      const insights = botInsights({nirgalMilestones: 3, nirgalAwards: 2, nirgalSkipped: 4},
        MarsBotCorpId.C42_NIRGAL_ENTERPRISES, 'Nirgal Enterprises');
      expect(insights).has.length(2);
      const keys = insights.map((i) => i.textKey).join(' | ');
      expect(keys).contains('The schedule was the whole corporation');
      expect(keys).contains('the office signed nothing');
    });

    it('C42 keeps the idle line quiet when the box almost always found something', () => {
      const insights = botInsights({nirgalMilestones: 3, nirgalAwards: 2, nirgalSkipped: 1},
        MarsBotCorpId.C42_NIRGAL_ENTERPRISES, 'Nirgal Enterprises');
      expect(insights).has.length(1);
      expect(insights[0].textKey).contains('The schedule was the whole corporation');
      expect(insights[0].params.map((p) => p.v)).contains('3');
    });

    it('C42 keeps quiet when the schedule barely fired', () => {
      expect(botInsights({nirgalMilestones: 1, nirgalSkipped: 2},
        MarsBotCorpId.C42_NIRGAL_ENTERPRISES, 'Nirgal Enterprises')).is.empty;
    });

    it('C46 tells its one moment as ONE story', () => {
      const insights = botInsights({hyperlinkPlayed: 1, hyperlinkDrawn: 9, hyperlinkResolved: 2},
        MarsBotCorpId.C46_TYCHO_MAGNETICS, 'Tycho Magnetics');
      expect(insights).has.length(1);
      expect(insights[0].textKey).contains('The wait was the plan');
      expect(insights[0].params.map((p) => p.v)).contains('9');
    });

    it('C46 keeps quiet when the hyperlink never came up', () => {
      expect(botInsights({}, MarsBotCorpId.C46_TYCHO_MAGNETICS, 'Tycho Magnetics')).is.empty;
    });

    it('the draft fallback speaks only when no printed effect did', () => {
      const withEffect = botInsights({credicorTriggers: 6, credicorMc: 24, fiveCardDecks: 3},
        MarsBotCorpId.C01_CREDICOR, 'CrediCor');
      expect(withEffect).has.length(1);
      expect(withEffect[0].textKey).contains('bread and butter');

      const fallbackOnly = botInsights({fiveCardDecks: 3}, MarsBotCorpId.C01_CREDICOR, 'CrediCor');
      expect(fallbackOnly).has.length(1);
      expect(fallbackOnly[0].textKey).contains('refused to give anything back after the draft');
    });
  });

  describe('selectInsights', () => {
    const candidate = (id: string, group: InsightCandidate['group'], priority: number, suppresses?: Array<string>): InsightCandidate => ({
      id, group, priority, severity: 'normal', icon: 'flag', badge: 'b', textKey: 't', params: [], suppresses,
    });

    it('keeps one insight per group, ranked by priority', () => {
      const picked = selectInsights([
        candidate('a1', 'verdict', 50),
        candidate('a2', 'verdict', 90),
        candidate('b1', 'timeline', 70),
      ]);
      expect(picked.map((p) => p.id)).to.deep.eq(['a2', 'b1']);
    });

    it('honours suppression links', () => {
      const picked = selectInsights([
        candidate('big', 'timeline', 90, ['small']),
        candidate('small', 'momentum', 80),
        candidate('other', 'cards', 70),
      ]);
      expect(picked.map((p) => p.id)).to.deep.eq(['big', 'other']);
    });

    it('caps the list and orders it by story flow', () => {
      const picked = selectInsights([
        candidate('p', 'profile', 99),
        candidate('v', 'verdict', 50),
        candidate('t', 'timeline', 60),
      ], 3);
      // Reading order: verdict → timeline → … → profile, regardless of priority.
      expect(picked.map((p) => p.id)).to.deep.eq(['v', 't', 'p']);
    });
  });

  describe('generateInsights', () => {
    it('tells a photo-finish story', () => {
      const a = score('red', 'A', {total: 41, vpByGeneration: [10, 20, 41]});
      const b = score('blue', 'B', {total: 40, vpByGeneration: [12, 22, 40]});
      const insights = generateInsights(ctxFor([a, b], {generation: 3}));
      expect(insights.some((i) => i.id === 'verdict.photo-finish')).to.eq(true);
    });

    it('tells a tiebreaker story', () => {
      const a = score('red', 'A', {total: 40});
      const b = score('blue', 'B', {total: 40});
      const insights = generateInsights(ctxFor([a, b]));
      expect(insights.some((i) => i.id === 'verdict.tiebreaker')).to.eq(true);
    });

    it('detects a late comeback and suppresses the redundant surge line', () => {
      // Winner trails by 8 until taking the lead in the final generation.
      const a = score('red', 'A', {total: 46, vpByGeneration: [10, 14, 20, 26, 46]});
      const b = score('blue', 'B', {total: 40, vpByGeneration: [12, 20, 28, 34, 40]});
      const insights = generateInsights(ctxFor([a, b], {generation: 5}));
      expect(insights.some((i) => i.id === 'timeline.late-comeback')).to.eq(true);
      expect(insights.some((i) => i.id === 'momentum.winner-surge')).to.eq(false);
    });

    it('flags the decisive category when its lead covers the margin', () => {
      const a = score('red', 'A', {total: 50, categories: {tr: 25, cards: 20, board: 5, mca: 0}});
      const b = score('blue', 'B', {total: 44, categories: {tr: 26, cards: 8, board: 10, mca: 0}});
      const cats = [
        category('tr', {red: 25, blue: 26}),
        category('cards', {red: 20, blue: 8}),
        category('board', {red: 5, blue: 10}),
      ];
      const insights = generateInsights(ctxFor([a, b], {categories: cats}));
      expect(insights.some((i) => i.id === 'reason.decisive-category')).to.eq(true);
    });

    it('returns nothing for solo games', () => {
      const a = score('red', 'A', {total: 60});
      const ctx = {...ctxFor([a]), mode: 'solo' as const};
      expect(generateInsights(ctx)).to.deep.eq([]);
    });

    it('is deterministic for the same game', () => {
      const make = () => {
        const a = score('red', 'A', {total: 47, vpByGeneration: [10, 20, 30, 47]});
        const b = score('blue', 'B', {total: 44, vpByGeneration: [12, 22, 32, 44]});
        return generateInsights(ctxFor([a, b], {generation: 4}));
      };
      expect(make()).to.deep.eq(make());
    });

    it('never emits two insights of the same group', () => {
      const a = score('red', 'A', {total: 80, vpByGeneration: [10, 30, 50, 80], categories: {tr: 40, cards: 30, board: 10, mca: 0}});
      const b = score('blue', 'B', {total: 40, vpByGeneration: [12, 20, 30, 40], categories: {tr: 25, cards: 5, board: 10, mca: 0}});
      const cats = [
        category('tr', {red: 40, blue: 25}),
        category('cards', {red: 30, blue: 5}),
        category('board', {red: 10, blue: 10}),
      ];
      const insights = generateInsights(ctxFor([a, b], {generation: 4, categories: cats}));
      const groups = insights.map((i) => i.group);
      expect(new Set(groups).size).to.eq(groups.length);
      expect(insights.length).to.be.greaterThan(2);
      expect(insights.length).to.be.lessThan(7);
    });
  });
});
