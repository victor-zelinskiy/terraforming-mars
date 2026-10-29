/**
 * MarsBot dividend GOAL CANDIDATES bench (the owner, 2026-10-29 — «бонусные цели должны быть тематическими,
 * умеренно редкими и НЕ завязанными на механику дивиденда; главное — рассчитать математически, что цель достижима»).
 *
 * Loads FINISHED bot games (the owner's exports), rebuilds each through the real `Game.deserialize`, and for every
 * game measures a LIBRARY of candidate goal operands — things a corporation's goal could count that are NOT the
 * dividend's own formula: tags and kinds of the bot's played pile, its tracks, where its tiles stand (bonus cells,
 * the map's edge, the poles and the equator, beside oceans, beside the players' cities, in one connected cluster),
 * the parameters it raised, its awards, milestones, colonies, money. Beside them, every corporation's dividend
 * FORMULA VP (the goal tiers stripped) and the VP its CURRENT goal paid. Then:
 *
 *   npx tsx scripts/marsbot-goal-candidates.ts <dir> [--out=cands.json] [--cache=rows.json]
 *     prints every candidate's distribution on Hard games and, per corporation, the candidates least correlated
 *     (Pearson, eligible Hard games) with the corporation's formula — the number the catalog is built on;
 *   npx tsx scripts/marsbot-goal-candidates.ts <dir> --cache=rows.json --pick=<assignment.json>
 *     for an assignment {C07: 'tiles.tiUnits', …} (or a list of names per corporation) prints the pair's
 *     correlation, the operand's distribution and the THREE TIERS the calibration rule proposes (first tier in
 *     ≤ 40 % of games, tiers strictly rarer, the last reached in ≥ 2 real games, expected goal VP closest to what
 *     the corporation's current goal pays).
 */
import '../src/server/database/Database';
import '../src/server/database/GameLoader';
import {globalInitialize} from '../src/server/globalInitialize';
import * as fs from 'fs';
import * as path from 'path';
import {Game} from '../src/server/Game';
import {IGame} from '../src/server/IGame';
import {Board} from '../src/server/boards/Board';
import {Space} from '../src/server/boards/Space';
import {CardType} from '../src/common/cards/CardType';
import {Tag} from '../src/common/cards/Tag';
import {GlobalParameter} from '../src/common/GlobalParameter';
import {SpaceBonus} from '../src/common/boards/SpaceBonus';
import {OCEAN_TILES} from '../src/common/TileType';
import {MARS_BOT_CORP_IDS, MarsBotCorpId, marsBotCorpInfo} from '../src/common/automa/MarsBotCorpData';
import {MarsBotTrackRole} from '../src/common/automa/AutomaTypes';
import {GOAL_TERM_LABELS, DIVIDEND_GOAL_VP} from '../src/common/automa/MarsBotDividend';
import {AutomaCorporations} from '../src/server/automa/corps/AutomaCorporations';
import {AutomaResolver} from '../src/server/automa/AutomaResolver';
import {
  awardStandings, borders, botGreenerySpaces, botOceansPlaced, botParameterSteps, botTileSpaces, colonyCounts,
  failedActionCount, isBotTile, isOtherPlayersTile, matTracks, otherPlayersCardsWithTag, pileCards, pileCount, pileTagCount,
  printedVictoryPoints, regressedSpaces, trackPosition,
} from '../src/server/automa/corps/MarsBotDividendReads';
import {marsBotOf} from '../src/server/automa/AutomaUtil';
import {isIActionCard} from '../src/server/cards/ICard';

type Row = {
  id: string; board: string; hard: boolean; redux: boolean; generation: number;
  eligible: Array<string>; formula: Record<string, number>; goalVp: Record<string, number>; cand: Record<string, number>;
};

const TRACK_ROLES: ReadonlyArray<MarsBotTrackRole> = ['building', 'space', 'event', 'science', 'power', 'earth', 'bio', 'venus'];
const PILE_TAGS: ReadonlyArray<Tag> = [Tag.BUILDING, Tag.SPACE, Tag.SCIENCE, Tag.POWER, Tag.EARTH, Tag.JOVIAN, Tag.VENUS, Tag.PLANT, Tag.MICROBE, Tag.ANIMAL, Tag.CITY];

const units = (space: Space, bonus: SpaceBonus) => space.bonus.filter((b) => b === bonus).length;

/** The candidate library — every reader is a pure read of the finished game. */
function candidates(game: IGame): Record<string, number> {
  const bot = marsBotOf(game);
  const board = game.board;
  const tiles = botTileSpaces(game);
  const cities = tiles.filter((s) => Board.isCitySpace(s));
  const greeneries = botGreenerySpaces(game);
  const pile = pileCards(game);
  const adj = (s: Space) => board.getAdjacentSpaces(s);
  const column = (s: Space) => s.x - Math.abs(4 - s.y) / 2;

  const isHumanCity = (n: Space) => Board.isCitySpace(n) && n.player !== undefined && n.player.id !== bot.id;
  const isHumanGreenery = (n: Space) => Board.isGreenerySpace(n) && n.player !== undefined && n.player.id !== bot.id;
  const isBotCity = (n: Space) => Board.isCitySpace(n) && n.player?.id === bot.id;
  const c: Record<string, number> = {};
  // ── the played pile
  for (const tag of PILE_TAGS) c[`pile.tag.${tag}`] = pileTagCount(game, [tag]);
  c['pile.events'] = pileCount(game, (card) => card.type === CardType.EVENT);
  c['pile.active'] = pileCount(game, (card) => card.type === CardType.ACTIVE);
  c['pile.automated'] = pileCount(game, (card) => card.type === CardType.AUTOMATED);
  c['pile.vp1'] = pileCount(game, (card) => printedVictoryPoints(card) >= 1);
  c['pile.vp2'] = pileCount(game, (card) => printedVictoryPoints(card) >= 2);
  c['pile.negVp'] = pileCount(game, (card) => printedVictoryPoints(card) < 0);
  c['pile.cost20'] = pileCount(game, (card) => card.cost >= 20);
  c['pile.cost25'] = pileCount(game, (card) => card.cost >= 25);
  c['pile.cost30'] = pileCount(game, (card) => card.cost >= 30);
  c['pile.cost8'] = pileCount(game, (card) => card.cost <= 8);
  c['pile.cost5'] = pileCount(game, (card) => card.cost <= 5);
  c['pile.cost10to15'] = pileCount(game, (card) => card.cost >= 10 && card.cost <= 15);
  c['pile.cost16to24'] = pileCount(game, (card) => card.cost >= 16 && card.cost <= 24);
  c['pile.cost0'] = pileCount(game, (card) => card.cost === 0);
  c['pile.vpExactly1'] = pileCount(game, (card) => printedVictoryPoints(card) === 1);
  c['pile.activeNoAction'] = pileCount(game, (card) => card.type === CardType.ACTIVE && !isIActionCard(card));
  c['pile.eventNoTag'] = pileCount(game, (card) => card.type === CardType.EVENT && AutomaResolver.printedTags(card).length === 0);
  c['pile.cityTag'] = pileCount(game, (card) => AutomaResolver.printedTags(card).includes(Tag.CITY));
  c['pile.jovianOrSpace'] = pileCount(game, (card) => {
    const tags = AutomaResolver.printedTags(card);
    return tags.includes(Tag.JOVIAN) || tags.includes(Tag.SPACE);
  });
  c['pile.noTag'] = pileCount(game, (card) => AutomaResolver.printedTags(card).length === 0);
  c['pile.multiTag'] = pileCount(game, (card) => AutomaResolver.printedTags(card).length >= 2);
  c['pile.threeTag'] = pileCount(game, (card) => AutomaResolver.printedTags(card).length >= 3);
  c['pile.requirement'] = pileCount(game, (card) => card.requirements.length > 0);
  c['pile.eventCost15'] = pileCount(game, (card) => card.type === CardType.EVENT && card.cost >= 15);
  c['pile.buildingSpace'] = pileCount(game, (card) => {
    const tags = AutomaResolver.printedTags(card);
    return tags.includes(Tag.BUILDING) && tags.includes(Tag.SPACE);
  });
  c['pile.scienceReq'] = pileCount(game, (card) => AutomaResolver.printedTags(card).includes(Tag.SCIENCE) && card.requirements.length > 0);
  c['pile.sciencePlusVp'] = pileCount(game, (card) => AutomaResolver.printedTags(card).includes(Tag.SCIENCE) && printedVictoryPoints(card) >= 1);
  const tagCounts = new Map<Tag, number>();
  for (const card of pile) for (const tag of AutomaResolver.printedTags(card)) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
  c['pile.distinctTags'] = tagCounts.size;
  c['pile.tagsAtLeast3'] = [...tagCounts.values()].filter((n) => n >= 3).length;
  c['pile.tagsAtLeast4'] = [...tagCounts.values()].filter((n) => n >= 4).length;
  c['pile.tagsAtLeast5'] = [...tagCounts.values()].filter((n) => n >= 5).length;
  c['pile.size'] = pile.length;
  // ── the tracks
  for (const role of TRACK_ROLES) c[`track.${role}`] = trackPosition(game, role);
  const positions = matTracks(game).map((t) => t.position);
  c['track.max'] = Math.max(0, ...positions);
  c['track.min'] = positions.length > 0 ? Math.min(...positions) : 0;
  c['track.sum'] = positions.reduce((s, p) => s + p, 0);
  for (const mark of [8, 10, 12, 14, 16]) c[`track.at${mark}`] = positions.filter((p) => p >= mark).length;
  c['track.regressed'] = regressedSpaces(game);
  // ── the board
  c['tiles.all'] = tiles.length;
  c['tiles.cities'] = cities.length;
  c['tiles.greeneries'] = greeneries.length;
  c['tiles.oceansPlaced'] = botOceansPlaced(game);
  c['tiles.onSteel'] = tiles.filter((s) => units(s, SpaceBonus.STEEL) > 0).length;
  c['tiles.onTitanium'] = tiles.filter((s) => units(s, SpaceBonus.TITANIUM) > 0).length;
  c['tiles.onPlant'] = tiles.filter((s) => units(s, SpaceBonus.PLANT) > 0).length;
  c['tiles.onCard'] = tiles.filter((s) => units(s, SpaceBonus.DRAW_CARD) > 0).length;
  const nearBonus = (bonus: SpaceBonus) => tiles.filter((s) => units(s, bonus) > 0 || adj(s).some((n) => units(n, bonus) > 0)).length;
  c['tiles.nearTitanium'] = nearBonus(SpaceBonus.TITANIUM);
  c['tiles.nearSteel'] = nearBonus(SpaceBonus.STEEL);
  c['tiles.nearCard'] = nearBonus(SpaceBonus.DRAW_CARD);
  c['tiles.citiesNearTitanium'] = cities.filter((s) => units(s, SpaceBonus.TITANIUM) > 0 || adj(s).some((n) => units(n, SpaceBonus.TITANIUM) > 0)).length;
  c['tiles.greeneriesNextToHumanGreenery'] = greeneries.filter((s) => adj(s).some(isHumanGreenery)).length;
  c['tiles.citiesNextToHumanGreenery'] = cities.filter((s) => adj(s).some(isHumanGreenery)).length;
  c['tiles.tiUnits'] = tiles.reduce((n, s) => n + units(s, SpaceBonus.TITANIUM), 0);
  c['tiles.steelUnits'] = tiles.reduce((n, s) => n + units(s, SpaceBonus.STEEL), 0);
  c['tiles.plantUnits'] = tiles.reduce((n, s) => n + units(s, SpaceBonus.PLANT), 0);
  c['tiles.cardUnits'] = tiles.reduce((n, s) => n + units(s, SpaceBonus.DRAW_CARD), 0);
  c['tiles.metalUnits'] = c['tiles.tiUnits'] + c['tiles.steelUnits'];
  c['tiles.bonusItems'] = tiles.reduce((n, s) => n + s.bonus.length, 0);
  c['tiles.onDouble'] = tiles.filter((s) => s.bonus.length >= 2).length;
  c['tiles.onAnyBonus'] = tiles.filter((s) => s.bonus.length > 0).length;
  c['tiles.onNoBonus'] = tiles.filter((s) => s.bonus.length === 0).length;
  c['tiles.edge'] = tiles.filter((s) => adj(s).length < 6).length;
  c['tiles.citiesEdge'] = cities.filter((s) => adj(s).length < 6).length;
  c['tiles.citiesOnSteel'] = cities.filter((s) => units(s, SpaceBonus.STEEL) > 0).length;
  c['tiles.citiesOnNoBonus'] = cities.filter((s) => s.bonus.length === 0).length;
  c['tiles.citiesOnPlant'] = cities.filter((s) => units(s, SpaceBonus.PLANT) > 0).length;
  c['tiles.greeneriesOnPlant'] = greeneries.filter((s) => units(s, SpaceBonus.PLANT) > 0).length;
  c['tiles.greeneriesOnBonus'] = greeneries.filter((s) => s.bonus.length > 0).length;
  c['tiles.greeneriesOnNoBonus'] = greeneries.filter((s) => s.bonus.length === 0).length;
  c['tiles.polar'] = tiles.filter((s) => s.y <= 1 || s.y >= 7).length;
  c['tiles.polarRows'] = tiles.filter((s) => s.y === 0 || s.y === 8).length;
  c['tiles.equator'] = tiles.filter((s) => s.y >= 3 && s.y <= 5).length;
  c['tiles.equatorRow'] = tiles.filter((s) => s.y === 4).length;
  c['tiles.north'] = tiles.filter((s) => s.y <= 3).length;
  c['tiles.south'] = tiles.filter((s) => s.y >= 5).length;
  // The server's x carries the row offset (row y starts at |4 - y|); the geometric column is x - |4 - y| / 2, the map's
  // centre column 4 — the hemispheres are the cells strictly left / right of it.
  c['tiles.east'] = tiles.filter((s) => column(s) >= 4.5).length;
  c['tiles.west'] = tiles.filter((s) => column(s) <= 3.5).length;
  c['tiles.nextToOcean'] = tiles.filter((s) => adj(s).some((n) => Board.isOceanSpace(n))).length;
  c['tiles.nextToTwoOceans'] = tiles.filter((s) => adj(s).filter((n) => Board.isOceanSpace(n)).length >= 2).length;
  c['tiles.citiesNextToOcean'] = cities.filter((s) => adj(s).some((n) => Board.isOceanSpace(n))).length;
  c['tiles.greeneriesNextToOcean'] = greeneries.filter((s) => adj(s).some((n) => Board.isOceanSpace(n))).length;
  c['tiles.nextToHumanCity'] = tiles.filter((s) => adj(s).some(isHumanCity)).length;
  c['tiles.nextToHumanGreenery'] = tiles.filter((s) => adj(s).some(isHumanGreenery)).length;
  c['tiles.nextToHumanTile'] = tiles.filter((s) => adj(s).some((n) => n.tile !== undefined && n.player !== undefined && n.player.id !== bot.id)).length;
  c['tiles.citiesNextToHumanCity'] = cities.filter((s) => adj(s).some(isHumanCity)).length;
  c['tiles.greeneryNextToBotCity'] = greeneries.filter((s) => adj(s).some(isBotCity)).length;
  c['tiles.greeneryNextToHumanCity'] = greeneries.filter((s) => adj(s).some(isHumanCity)).length;
  c['tiles.greeneryWith2BotCities'] = greeneries.filter((s) => adj(s).filter(isBotCity).length >= 2).length;
  c['tiles.cityWith3Greeneries'] = cities.filter((s) => adj(s).filter((n) => Board.isGreenerySpace(n)).length >= 3).length;
  c['tiles.cityWith2BotGreeneries'] = cities.filter((s) => adj(s).filter((n) => Board.isGreenerySpace(n) && n.player?.id === bot.id).length >= 2).length;
  c['tiles.cityNoGreenery'] = cities.filter((s) => !adj(s).some((n) => Board.isGreenerySpace(n))).length;
  c['tiles.adjacentPairs'] = borders(game, isBotTile(game), isBotTile(game), true);
  c['tiles.bordersHumans'] = borders(game, isBotTile(game), isOtherPlayersTile(game));
  c['tiles.lonely'] = tiles.filter((s) => adj(s).every((n) => n.tile === undefined)).length;
  c['tiles.humanCitiesNextToBotGreenery'] = board.spaces.filter((s) => isHumanCity(s) && adj(s).some((n) => Board.isGreenerySpace(n) && n.player?.id === bot.id)).length;
  c['tiles.humanTilesNextToBotCity'] = board.spaces.filter((s) => s.tile !== undefined && s.player !== undefined && s.player.id !== bot.id && adj(s).some(isBotCity)).length;
  // the largest connected cluster, the rows the bot occupies, the fullest row
  const botIds = new Set(tiles.map((s) => s.id));
  const seen = new Set<string>();
  let largest = 0;
  for (const s of tiles) {
    if (seen.has(s.id)) continue;
    let size = 0;
    const stack = [s];
    seen.add(s.id);
    while (stack.length > 0) {
      const cur = stack.pop()!;
      size++;
      for (const n of adj(cur)) {
        if (botIds.has(n.id) && !seen.has(n.id)) {
          seen.add(n.id);
          stack.push(n);
        }
      }
    }
    largest = Math.max(largest, size);
  }
  c['tiles.largestCluster'] = largest;
  // ── OWN-ONLY geometry (the owner, 2026-10-29: a goal may not depend on where the PLAYERS build)
  const isBotGreenery = (n: Space) => Board.isGreenerySpace(n) && n.player?.id === bot.id;
  const isBotTileSpace = (n: Space) => n.tile !== undefined && n.player?.id === bot.id;
  c['tiles.cityWith3BotGreeneries'] = cities.filter((s) => adj(s).filter(isBotGreenery).length >= 3).length;
  c['tiles.citiesNextToBotCity'] = cities.filter((s) => adj(s).some(isBotCity)).length;
  c['tiles.citiesOnDouble'] = cities.filter((s) => s.bonus.length >= 2).length;
  c['tiles.greeneriesOnDouble'] = greeneries.filter((s) => s.bonus.length >= 2).length;
  c['tiles.dense'] = tiles.filter((s) => adj(s).filter(isBotTileSpace).length >= 3).length;
  c['tiles.greeneriesDense'] = greeneries.filter((s) => adj(s).filter(isBotGreenery).length >= 2).length;
  c['tiles.greeneriesNextToBotGreenery'] = greeneries.filter((s) => adj(s).some(isBotGreenery)).length;
  c['tiles.greeneriesNoBotCity'] = greeneries.filter((s) => !adj(s).some(isBotCity)).length;
  c['tiles.centralColumn'] = tiles.filter((s) => Math.abs(column(s) - 4) <= 0.5).length;
  c['tiles.centralBand'] = tiles.filter((s) => Math.abs(column(s) - 4) <= 1.5).length;
  c['tiles.corners'] = tiles.filter((s) => adj(s).length <= 3).length;
  c['tiles.greeneriesEdge'] = greeneries.filter((s) => adj(s).length < 6).length;
  c['tiles.citiesRows'] = new Set(cities.map((s) => s.y)).size;
  c['tiles.greeneriesRows'] = new Set(greeneries.map((s) => s.y)).size;
  const greeneryIds = new Set(greeneries.map((s) => s.id));
  const seenG = new Set<string>();
  let largestG = 0;
  for (const s of greeneries) {
    if (seenG.has(s.id)) continue;
    let size = 0;
    const stack = [s];
    seenG.add(s.id);
    while (stack.length > 0) {
      const cur = stack.pop()!;
      size++;
      for (const n of adj(cur)) {
        if (greeneryIds.has(n.id) && !seenG.has(n.id)) {
          seenG.add(n.id);
          stack.push(n);
        }
      }
    }
    largestG = Math.max(largestG, size);
  }
  c['tiles.greeneryCluster'] = largestG;
  const rows = new Map<number, number>();
  for (const s of tiles) rows.set(s.y, (rows.get(s.y) ?? 0) + 1);
  c['tiles.rowsOccupied'] = rows.size;
  c['tiles.maxInRow'] = Math.max(0, ...rows.values());
  c['tiles.rowsWith2'] = [...rows.values()].filter((n) => n >= 2).length;
  // oceans the bot placed beside another ocean / beside a human tile (from the event stream — ocean tiles have no owner)
  const botOceanIds = new Set(game.events.events
    .filter((e) => e.type === 'tile-placed' && e.player === bot.color && e.tile !== undefined && OCEAN_TILES.has(e.tile))
    .map((e) => (e as unknown as {space: string}).space));
  const botOceans = board.spaces.filter((s) => botOceanIds.has(s.id));
  c['tiles.botOceansNextToOcean'] = botOceans.filter((s) => adj(s).some((n) => Board.isOceanSpace(n))).length;
  c['tiles.botOceansNextToHumanTile'] = botOceans.filter((s) => adj(s).some((n) => n.tile !== undefined && n.player !== undefined && n.player.id !== bot.id)).length;
  c['tiles.botOceansNextToBotTile'] = botOceans.filter((s) => adj(s).some((n) => n.tile !== undefined && n.player?.id === bot.id)).length;
  c['tiles.botOceansOnBonus'] = botOceans.filter((s) => s.bonus.length > 0).length;
  c['tiles.botOceansNextToBotCity'] = botOceans.filter((s) => adj(s).some(isBotCity)).length;
  c['tiles.botOceansJoined'] = botOceans.filter((s) => adj(s).filter((n) => Board.isOceanSpace(n)).length >= 2).length;
  // ── the parameters
  c['params.temperature'] = botParameterSteps(game, GlobalParameter.TEMPERATURE);
  c['params.oxygen'] = botParameterSteps(game, GlobalParameter.OXYGEN);
  c['params.venus'] = botParameterSteps(game, GlobalParameter.VENUS);
  c['params.all'] = c['params.temperature'] + c['params.oxygen'] + c['tiles.oceansPlaced'];
  // ── the rest
  c['misc.failed'] = failedActionCount(game);
  const standings = awardStandings(game);
  c['misc.awardsLed'] = standings.first;
  c['misc.awardsSecond'] = standings.second;
  c['misc.awardsPlaced'] = standings.first + standings.second;
  c['misc.awardsFunded'] = game.fundedAwards.filter((a) => a.player.id === bot.id).length;
  c['misc.milestones'] = game.claimedMilestones.filter((m) => m.player.id === bot.id).length;
  c['misc.tr'] = bot.terraformRating;
  c['misc.mc'] = bot.megaCredits;
  c['misc.destroyedBonus'] = game.automa!.destroyedBonusCards.length;
  c['misc.bonusDiscard'] = game.automa!.bonusDiscard.length;
  c['misc.floaters'] = game.automa!.floaters;
  const colonies = colonyCounts(game);
  c['colonies.bot'] = colonies.bot;
  c['colonies.all'] = colonies.all;
  c['colonies.storage'] = Object.values(game.automa!.shippingStorage).reduce((s, n) => s + (n ?? 0), 0);
  for (const tag of [Tag.EARTH, Tag.JOVIAN, Tag.VENUS, Tag.SCIENCE, Tag.PLANT, Tag.MICROBE, Tag.BUILDING, Tag.SPACE]) {
    c[`humans.tag.${tag}`] = otherPlayersCardsWithTag(game, tag);
  }
  return c;
}

function evaluate(file: string): Row | undefined {
  const d = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (d.phase !== 'end' || d.gameOptions?.automa === undefined) return undefined;
  const game = Game.deserialize(d);
  if (game.automa === undefined) return undefined;
  const formula: Record<string, number> = {};
  const goalVp: Record<string, number> = {};
  for (const id of MARS_BOT_CORP_IDS) {
    const result = AutomaCorporations.dividendOf(game, id);
    const isGoal = (label: string) => (GOAL_TERM_LABELS as ReadonlyArray<string>).includes(label);
    formula[id] = result.terms.filter((t) => !isGoal(t.label)).reduce((s, t) => s + t.vp, 0);
    goalVp[id] = result.terms.filter((t) => isGoal(t.label)).reduce((s, t) => s + t.vp, 0);
  }
  const primary = game.automa.corporation;
  const eligible = AutomaCorporations.eligibleCorpIds(game).filter((id) => id !== primary);
  if (primary !== undefined) eligible.push(primary);
  return {
    id: d.id, board: d.gameOptions.boardName, hard: d.gameOptions.automa.difficulty === 'hard', redux: d.gameOptions.turmoilReduxExpansion === true,
    generation: game.generation, eligible, formula, goalVp, cand: candidates(game),
  };
}

const quantile = (xs: ReadonlyArray<number>, q: number) => {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};
const share = (xs: ReadonlyArray<number>, t: number) => xs.filter((x) => x >= t).length / xs.length;
const games = (xs: ReadonlyArray<number>, t: number) => xs.filter((x) => x >= t).length;
const pct = (p: number) => `${Math.round(p * 100)}%`;
function pearson(xs: ReadonlyArray<number>, ys: ReadonlyArray<number>): number {
  const n = xs.length;
  if (n < 3) return NaN;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0; let sxx = 0; let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  return sxx === 0 || syy === 0 ? 0 : sxy / Math.sqrt(sxx * syy);
}
function stepFor(max: number): number {
  return max >= 300 ? 10 : max >= 90 ? 5 : max >= 40 ? 2 : 1;
}

const P1_MAX = 0.40;
/** The calibration rule of `marsbot-dividend-tiers.ts`, aimed at a target expected VP. */
function proposeTiers(counts: ReadonlyArray<number>, evTarget: number, vp: readonly [number, number, number]): [number, number, number] | undefined {
  const max = Math.max(...counts);
  const step = stepFor(max);
  const cands: Array<number> = [];
  for (let t = step; t <= max; t += step) cands.push(t);
  let best: {score: number, at: [number, number, number]} | undefined;
  for (const t3 of cands) {
    if (games(counts, t3) < 2) continue;
    const p3 = share(counts, t3);
    for (const t2 of cands) {
      if (t2 >= t3) break;
      const p2 = share(counts, t2);
      for (const t1 of cands) {
        if (t1 >= t2) break;
        const p1 = share(counts, t1);
        if (!(p1 > p2 && p2 > p3)) continue;
        if (p1 > P1_MAX) continue;
        const ev = vp[0] * p1 + vp[1] * p2 + vp[2] * p3;
        const score =
          100 * ((ev - evTarget) / Math.max(1, evTarget)) ** 2 + (ev > evTarget ? 1e-6 : 0) +
          12 * (p3 - 0.06) ** 2 / 0.06 +
          4 * (p1 - 0.28) ** 2 / 0.28 +
          6 * (p2 - (p1 + p3) / 2) ** 2 / ((p1 + p3) / 2);
        if (best === undefined || score < best.score) best = {score, at: [t1, t2, t3]};
      }
    }
  }
  return best?.at;
}

function main() {
  globalInitialize();
  const dir = process.argv[2];
  if (dir === undefined) throw new Error('usage: tsx scripts/marsbot-goal-candidates.ts <dir> [--out=cands.json] [--cache=rows.json] [--pick=assignment.json]');
  const cache = process.argv.find((a) => a.startsWith('--cache='))?.slice(8);
  let rows: Array<Row>;
  if (cache !== undefined && fs.existsSync(cache)) {
    rows = JSON.parse(fs.readFileSync(cache, 'utf8')).rows;
  } else {
    rows = [];
    let failed = 0;
    for (const f of fs.readdirSync(dir).filter((x) => /^g[0-9a-f]+\.json$/.test(x))) {
      try {
        const r = evaluate(path.join(dir, f));
        if (r !== undefined) rows.push(r);
      } catch (e) {
        failed++;
        console.error(`SKIP ${f}: ${(e as Error).message.split('\n')[0]}`);
      }
    }
    if (failed > 0) console.log(`${failed} games failed to load`);
    if (cache !== undefined) fs.writeFileSync(cache, JSON.stringify({rows}));
  }
  const hard = rows.filter((r) => r.hard);
  console.log(`loaded ${rows.length} finished bot games, ${hard.length} Hard\n`);
  const names = Object.keys(hard[0].cand);

  const shares = process.argv.find((a) => a.startsWith('--shares='))?.slice(9);
  if (shares !== undefined) {
    // Exact reach of every threshold — all Hard games and the Redux subset — for hand-tuning a goal's tiers.
    const redux = hard.filter((r) => r.redux);
    for (const name of shares.split(',')) {
      const xs = hard.map((r) => r.cand[name]);
      const rx = redux.map((r) => r.cand[name]);
      const max = Math.max(...xs);
      const cells: Array<string> = [];
      for (let t = 1; t <= max; t++) cells.push(`${t}: ${pct(share(xs, t))} (${games(xs, t)}) rx ${pct(share(rx, t))} (${games(rx, t)})`);
      console.log(`${name}  n=${xs.length} rx=${rx.length}\n  ` + cells.join('\n  '));
    }
    return;
  }
  const final = process.argv.find((a) => a.startsWith('--final='))?.slice(8);
  if (final !== undefined) {
    // A FIXED catalog {C07: {op, at: [a, b, c], vp?: [x, y, z]}} — the table the review doc prints: correlation, reach, EV on all
    // eligible Hard games and on the Redux subset (the owner plays Redux — a goal generous only there would be a hidden bonus).
    const catalog: Record<string, {op: string, at: [number, number, number], vp?: [number, number, number]}> = JSON.parse(fs.readFileSync(final, 'utf8'));
    let evSum = 0;
    let evReduxSum = 0;
    console.log('| corp | operand | r | tiers | hit (Hard) | games | hit (Redux) | EV | EV Redux |');
    console.log('|---|---|---|---|---|---|---|---|---|');
    for (const id of MARS_BOT_CORP_IDS) {
      const entry = catalog[id];
      if (entry === undefined) continue;
      const set = hard.filter((r) => r.eligible.includes(id));
      const redux = set.filter((r) => r.redux);
      const xs = set.map((r) => r.cand[entry.op]);
      const rx = redux.map((r) => r.cand[entry.op]);
      if (xs.some((x) => x === undefined)) throw new Error(`unknown candidate ${entry.op}`);
      const r = pearson(xs, set.map((row) => row.formula[id]));
      const vp = entry.vp ?? DIVIDEND_GOAL_VP;
      const ev = vp[0] * share(xs, entry.at[0]) + vp[1] * share(xs, entry.at[1]) + vp[2] * share(xs, entry.at[2]);
      const evRedux = rx.length === 0 ? NaN : vp[0] * share(rx, entry.at[0]) + vp[1] * share(rx, entry.at[1]) + vp[2] * share(rx, entry.at[2]);
      evSum += ev;
      evReduxSum += Number.isNaN(evRedux) ? 0 : evRedux;
      const vpText = entry.vp !== undefined ? ` (+${entry.vp.join('/+')})` : '';
      console.log(`| ${id} | ${entry.op} | ${r.toFixed(2)} | ${entry.at.join(' / ')}${vpText} | ${entry.at.map((t) => pct(share(xs, t))).join(' · ')} | ${entry.at.map((t) => String(games(xs, t))).join('/')} of ${xs.length} | ${entry.at.map((t) => pct(share(rx, t))).join(' · ')} (${rx.length}) | ${ev.toFixed(2)} | ${evRedux.toFixed(2)} |`);
    }
    console.log(`\nΣ EV ${evSum.toFixed(1)} · Σ EV Redux ${evReduxSum.toFixed(1)} over ${Object.keys(catalog).length} corporations`);
    return;
  }
  const pick = process.argv.find((a) => a.startsWith('--pick='))?.slice(7);
  if (pick !== undefined) {
    const assignment: Record<string, string | Array<string>> = JSON.parse(fs.readFileSync(pick, 'utf8'));
    const evArg = process.argv.find((a) => a.startsWith('--ev='));
    const evOverride = evArg !== undefined ? Number(evArg.slice(5)) : undefined;
    let evSum = 0;
    let evNowSum = 0;
    console.log('corp  candidate                            r     n   p50 p80 p90 max  rx: p50 p80 max   tiers       hit             games     redux    EV now → EV');
    for (const id of MARS_BOT_CORP_IDS) {
      const wanted = assignment[id];
      if (wanted === undefined) continue;
      const set = hard.filter((r) => r.eligible.includes(id));
      const ys = set.map((r) => r.formula[id]);
      const evNow = set.reduce((s, r) => s + r.goalVp[id], 0) / set.length;
      const evTarget = evOverride ?? evNow;
      for (const name of Array.isArray(wanted) ? wanted : [wanted]) {
        const xs = set.map((r) => r.cand[name]);
        if (xs.some((x) => x === undefined)) throw new Error(`unknown candidate ${name}`);
        const r = pearson(xs, ys);
        const at = proposeTiers(xs, evTarget, DIVIDEND_GOAL_VP);
        const redux = set.filter((row) => row.redux).map((row) => row.cand[name]);
        let evText = '(no fit)';
        let tiersText = '—';
        let hitText = '';
        let gamesText = '';
        let reduxText = '';
        if (at !== undefined) {
          const ev = DIVIDEND_GOAL_VP[0] * share(xs, at[0]) + DIVIDEND_GOAL_VP[1] * share(xs, at[1]) + DIVIDEND_GOAL_VP[2] * share(xs, at[2]);
          evText = ev.toFixed(2);
          tiersText = at.join('/');
          hitText = at.map((t) => pct(share(xs, t))).join(' ');
          gamesText = at.map((t) => String(games(xs, t))).join('/');
          reduxText = redux.length > 0 ? at.map((t) => String(games(redux, t))).join('/') + `/${redux.length}` : '—';
          if (name === (Array.isArray(wanted) ? wanted[0] : wanted)) {
            evSum += ev;
            evNowSum += evNow;
          }
        }
        console.log(`${id}  ${name.padEnd(36)} ${r.toFixed(2).padStart(5)} ${String(set.length).padStart(3)}   ${String(quantile(xs, 0.5)).padStart(3)} ${String(quantile(xs, 0.8)).padStart(3)} ${String(quantile(xs, 0.9)).padStart(3)} ${String(Math.max(...xs)).padStart(3)}      ${String(quantile(redux, 0.5)).padStart(3)} ${String(quantile(redux, 0.8)).padStart(3)} ${String(Math.max(...redux)).padStart(3)}   ${tiersText.padEnd(11)} ${hitText.padEnd(15)} ${gamesText.padEnd(9)} ${reduxText.padEnd(8)} ${evNow.toFixed(2)} → ${evText}`);
      }
    }
    console.log(`\nΣ EV now ${evNowSum.toFixed(1)} → Σ EV proposed ${evSum.toFixed(1)} (first candidate of each corporation)`);
    return;
  }

  console.log('== candidate distributions on Hard games: p50 · p80 · p90 · p95 · max · distinct values · games at p95');
  for (const name of names) {
    const xs = hard.map((r) => r.cand[name]);
    const p95 = quantile(xs, 0.95);
    console.log(`${name.padEnd(36)} ${String(quantile(xs, 0.5)).padStart(4)} ${String(quantile(xs, 0.8)).padStart(4)} ${String(quantile(xs, 0.9)).padStart(4)} ${String(p95).padStart(4)} ${String(Math.max(...xs)).padStart(4)}   ${String(new Set(xs).size).padStart(3)}   ${xs.filter((x) => x >= p95).length}`);
  }

  console.log('\n== per corporation: the candidates LEAST correlated with its dividend formula (|r| ascending; spread ≥ 6 values; eligible Hard games)');
  const corr: Record<string, Record<string, number>> = {};
  for (const id of MARS_BOT_CORP_IDS) {
    const set = hard.filter((r) => r.eligible.includes(id));
    const ys = set.map((r) => r.formula[id]);
    corr[id] = {};
    const scored: Array<{name: string, r: number}> = [];
    for (const name of names) {
      const xs = set.map((r) => r.cand[name]);
      const r = pearson(xs, ys);
      corr[id][name] = Math.round(r * 100) / 100;
      if (new Set(xs).size < 6) continue;
      scored.push({name, r});
    }
    scored.sort((a, b) => Math.abs(a.r) - Math.abs(b.r));
    console.log(`${id} ${marsBotCorpInfo(id as MarsBotCorpId).original.padEnd(28)} n=${set.length}  ` + scored.slice(0, 12).map((s) => `${s.name} ${s.r.toFixed(2)}`).join(' · '));
  }
  const out = process.argv.find((a) => a.startsWith('--out='));
  if (out !== undefined) {
    fs.writeFileSync(out.slice(6), JSON.stringify({rows, corr}));
    console.log(`\nwrote ${out.slice(6)}`);
  }
}

main();
