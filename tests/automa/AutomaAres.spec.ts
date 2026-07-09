import {expect} from 'chai';
import {SpaceBonus} from '../../src/common/boards/SpaceBonus';
import {Tag} from '../../src/common/cards/Tag';
import {TileType} from '../../src/common/TileType';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {Space} from '../../src/server/boards/Space';
import {AutomaAres} from '../../src/server/automa/AutomaAres';
import {AutomaMAEvaluation} from '../../src/server/automa/AutomaMAEvaluation';
import {AutomaResolver} from '../../src/server/automa/AutomaResolver';
import {AutomaTilePlacer} from '../../src/server/automa/AutomaTilePlacer';
import {AutomaTurnLog} from '../../src/server/automa/AutomaTurnLog';
import {testAutomaGame} from './AutomaTestGame';

// Tharsis track indexes (THARSIS_MARSBOT_BOARD order).
const BUILDING = 0;

/** An Ares automa game with NO initial dust storms — hazards are placed by hand. */
function aresGame() {
  return testAutomaGame({aresExtension: true, aresHazards: false});
}

function putHazard(space: Space, tileType: TileType = TileType.DUST_STORM_MILD): void {
  space.tile = {tileType, protectedHazard: false};
}

/** A human-owned Ares tile whose neighbors earn `bonus` units. */
function putAdjacencyTile(space: Space, owner: IPlayer, bonus: Array<SpaceBonus>): void {
  space.tile = {tileType: TileType.RESTRICTED_AREA};
  space.player = owner;
  space.adjacency = {bonus};
}

const adjacent = (game: IGame, a: Space, b: Space): boolean =>
  game.board.getAdjacentSpaces(a).includes(b);

/**
 * A middle space + two of its neighbors whose ONLY common neighbor is the
 * middle itself (so the middle is the unique double-adjacency spot), + one
 * more neighbor for a hazard. Everything computed from the real board —
 * never hardcoded ids.
 */
function findDoubleCitySpot(game: IGame, bot: IPlayer): {middle: Space, city1: Space, city2: Space, hazardSpot: Space} {
  const land = game.board.getAvailableSpacesOnLand(bot);
  for (const middle of land) {
    const neighbors = game.board.getAdjacentSpaces(middle).filter((n) => land.includes(n));
    if (neighbors.length < 3) {
      continue;
    }
    for (const city1 of neighbors) {
      for (const city2 of neighbors) {
        if (city1 === city2 || adjacent(game, city1, city2)) {
          continue;
        }
        const common = game.board.getAdjacentSpaces(city1).filter((s) => adjacent(game, city2, s));
        if (common.length !== 1 || common[0] !== middle) {
          continue;
        }
        // The hazard is placed AFTER the cities, so its own adjacency to them
        // costs nothing — any spare empty neighbor of the middle works.
        const hazardSpot = neighbors.find((n) => n !== city1 && n !== city2);
        if (hazardSpot !== undefined) {
          return {middle, city1, city2, hazardSpot};
        }
      }
    }
  }
  throw new Error('No double-city spot found on the board');
}

describe('AutomaAres', () => {
  it('without Ares every helper is a no-op / identity — behavior is unchanged', () => {
    const [game, /* human */, bot] = testAutomaGame();
    const land = game.board.getAvailableSpacesOnLand(bot);
    expect(AutomaAres.hazardAdjacencyCount(game, land[5])).eq(0);
    expect(AutomaAres.adjacencyBonusUnits(game, land[5])).eq(0);
    expect(AutomaAres.withoutHazardSpaces(game, land)).eq(land); // Same reference.
    expect(AutomaAres.preferAwayFromHazards(game, land)).eq(land);
  });

  it('the default Ares setup still seeds the initial dust storms', () => {
    const [game] = testAutomaGame({aresExtension: true, aresHazards: true});
    const storms = game.board.spaces.filter((s) => s.tile?.tileType === TileType.DUST_STORM_MILD);
    expect(storms).has.length(3); // playerCount <= 3 → 3 mild dust storms.
  });

  it('neighborhood bonus: the bot gains 1 M€ per adjacency unit, the owner keeps the income, Networker counts', () => {
    const [game, human, bot] = aresGame();
    const land = game.board.getAvailableSpacesOnLand(bot);
    const target = land.find((s) => game.board.getAdjacentSpaces(s).some((adj) => land.includes(adj)))!;
    const host = game.board.getAdjacentSpaces(target).find((adj) => land.includes(adj))!;
    putAdjacencyTile(host, human, [SpaceBonus.MEGACREDITS, SpaceBonus.STEEL]);

    const botMc = bot.megaCredits;
    const humanMc = human.megaCredits;
    game.addCity(bot, target);

    // 1 M€ per adjacency unit (2) + 1 M€ per covered printed icon (the automa
    // conversion) — never the actual steel.
    expect(bot.megaCredits).eq(botMc + 2 + target.bonus.length);
    expect(bot.steel).eq(0);
    // The Ares tile OWNER's income is untouched.
    expect(human.megaCredits).eq(humanMc + 1);
    // The dedicated reason line is in the journal (never folded into a generic money change).
    expect(game.gameLog.some((m) => m.message === '${0} gained ${1} M€ for the Ares adjacency bonus')).is.true;
    // The placement counts toward the Ares Networker milestone tally.
    const entry = game.aresData!.milestoneResults.find((e) => e.id === bot.id);
    expect(entry?.networkerCount).eq(1);
  });

  it('placement evaluation counts adjacency-bonus units exactly like printed icons', () => {
    const [game, human, bot] = aresGame();
    const land = [...game.board.getAvailableSpacesOnLand(bot)];
    const c1 = land.find((s) => game.board.getAdjacentSpaces(s).some((adj) => land.includes(adj)))!;
    const host = game.board.getAdjacentSpaces(c1).find((adj) => land.includes(adj))!;
    putAdjacencyTile(host, human, [SpaceBonus.MEGACREDITS]);
    // A far-away space with the SAME printed-bonus count (no ocean tiles exist,
    // so the first tiebreaker ties too).
    const c2 = land.find((s) => s !== c1 && s !== host &&
      s.bonus.length === c1.bonus.length && !adjacent(game, s, host))!;
    // The adjacency unit tips the icon tiebreaker — no random flip needed.
    expect(AutomaTilePlacer.breakTie(game, [c2, c1])).eq(c1);
    expect(game.gameLog.some((m) => m.message === '${0} flipped ${1} (cost ${2}) to break a placement tie')).is.false;
  });

  it('the bot avoids placing next to a hazard when a normal alternative exists', () => {
    const [game, /* human */, bot] = aresGame();
    const land = game.board.getAvailableSpacesOnLand(bot);
    putHazard(land.find((s) => game.board.getAdjacentSpaces(s).length === 6)!);

    AutomaTilePlacer.placeCity(game);

    const city = game.board.spaces.find((s) => s.tile?.tileType === TileType.CITY && s.player?.id === bot.id);
    expect(city).is.not.undefined;
    expect(AutomaAres.hazardAdjacencyCount(game, city!)).eq(0);
    // No consequence fired: no track regressed, and no prompt was ever created.
    expect(game.automa!.board.tracks.every((t) => t.regressedPositions.size === 0)).is.true;
    expect(game.deferredActions.length).eq(0);
  });

  it('the bot never places ON a hazard tile (cleanup is not an automa concept)', () => {
    const [game, /* human */, bot] = aresGame();
    const land = game.board.getAvailableSpacesOnLand(bot);
    const hazardSpace = land[7];
    putHazard(hazardSpace);
    expect(AutomaAres.withoutHazardSpaces(game, game.board.getAvailableSpacesForCity(bot))).to.not.include(hazardSpace);

    AutomaTilePlacer.placeCity(game);
    expect(hazardSpace.tile?.tileType).eq(TileType.DUST_STORM_MILD); // Still there.
  });

  it('rare case: a hazard-adjacent space that is strictly better IS chosen — one random track regresses, recorded in the turn script', () => {
    const [game, /* human */, bot] = aresGame();
    const {middle, city1, city2, hazardSpot} = findDoubleCitySpot(game, bot);
    game.addCity(bot, city1);
    game.addCity(bot, city2);
    putHazard(hazardSpot); // Placed AFTER the cities, so nothing paid for them.
    // Only the Building track can regress → the random pick is deterministic.
    const track = game.automa!.board.tracks[BUILDING];
    track.position = 3;

    AutomaTurnLog.begin(game);
    AutomaTilePlacer.placeGreenery(game);
    AutomaTurnLog.finish(game);

    // The greenery went to the strictly-better (2 own cities) hazard-adjacent spot.
    expect(middle.tile?.tileType).eq(TileType.GREENERY);
    // The consequence: ONE step back + the no-reactivation marker.
    expect(track.position).eq(2);
    expect(track.regressedPositions.has(3)).is.true;
    // Never a prompt for the bot.
    expect(game.deferredActions.length).eq(0);
    // The overview carries the structured step (which track, from → to).
    const step = game.automa!.lastTurn!.steps.find((s) => s.kind === 'hazard');
    expect(step).deep.include({kind: 'hazard', trackIndex: BUILDING, from: 3, to: 2});
    expect(step !== undefined && step.kind === 'hazard' && step.message?.message)
      .eq('${0} placed next to an Ares hazard — its ${1} track regressed from ${2} to ${3}');
  });

  it('several adjacent hazards still cost exactly ONE regress per placement', () => {
    const [game, /* human */, bot] = aresGame();
    const {middle, city1, city2, hazardSpot} = findDoubleCitySpot(game, bot);
    game.addCity(bot, city1);
    game.addCity(bot, city2);
    putHazard(hazardSpot);
    const second = game.board.getAdjacentSpaces(middle)
      .find((n) => n !== city1 && n !== city2 && n !== hazardSpot && n.tile === undefined)!;
    putHazard(second, TileType.EROSION_SEVERE);
    const tracks = game.automa!.board.tracks;
    tracks[BUILDING].position = 3;
    tracks[1].position = 2; // A second eligible track — the pick is random, the TOTAL must still be 1.
    const before = tracks.reduce((sum, t) => sum + t.position, 0);

    AutomaTilePlacer.placeGreenery(game);

    expect(middle.tile?.tileType).eq(TileType.GREENERY);
    const after = tracks.reduce((sum, t) => sum + t.position, 0);
    expect(before - after).eq(1);
    expect(game.deferredActions.length).eq(0);
  });

  it('CRITICAL: a bonus regressed away by the hazard consequence is NOT granted again on re-advance', () => {
    const [game, /* human */, bot] = aresGame();
    const track = game.automa!.board.tracks[BUILDING];
    // Tharsis Building layout[2] = 'ocean' — stand ON the bonus cell, as if it fired earlier.
    track.position = 2;

    AutomaAres.applyHazardConsequence(game); // Only eligible track → deterministic.
    expect(track.position).eq(1);
    expect(track.regressedPositions.has(2)).is.true;

    AutomaResolver.resolveTag(game, Tag.BUILDING); // Re-advance 1 → 2.
    expect(track.position).eq(2);
    expect(track.regressedPositions.has(2)).is.false; // Marker consumed…
    expect(game.board.getOceanSpaces()).is.empty; // …and the ocean bonus did NOT fire again.
    expect(bot.megaCredits).eq(0); // No Failed Action either — the cell is simply spent.
  });

  it('all tracks at the start: the consequence honestly resolves to nothing (logged, no prompt)', () => {
    const [game] = aresGame();
    AutomaAres.applyHazardConsequence(game);
    expect(game.automa!.board.tracks.every((t) => t.position === 0 && t.regressedPositions.size === 0)).is.true;
    expect(game.gameLog.some((m) => m.message === '${0} placed next to an Ares hazard, but its tracks are all at the start')).is.true;
    expect(game.deferredActions.length).eq(0);
  });

  it('oceans are exempt: an ocean next to a hazard costs the bot nothing', () => {
    const [game] = aresGame();
    const oceanSpace = game.board.getAvailableSpacesForOcean(marsBot(game))[0];
    const neighbor = game.board.getAdjacentSpaces(oceanSpace).find((s) => s.tile === undefined)!;
    putHazard(neighbor);
    const track = game.automa!.board.tracks[BUILDING];
    track.position = 3;

    game.addOcean(marsBot(game), oceanSpace);

    expect(track.position).eq(3);
    expect(track.regressedPositions.size).eq(0);
    expect(game.deferredActions.length).eq(0);
  });

  it('the 6-ocean planetary event: the bot placing the final ocean gains the +1 TR cleanup bonus like any player', () => {
    const [game, /* human */, bot] = testAutomaGame({aresExtension: true, aresHazards: true});
    expect(game.board.spaces.filter((s) => s.tile?.tileType === TileType.DUST_STORM_MILD)).has.length(3);
    // Pre-set 5 oceans WITHOUT the engine path so no threshold fires early.
    for (const s of game.board.getAvailableSpacesForOcean(bot).slice(0, 5)) {
      s.tile = {tileType: TileType.OCEAN};
    }
    const tr = bot.terraformRating;

    AutomaTilePlacer.placeOcean(game); // The 6th ocean, through the bot's own flow.

    // +1 TR for the ocean step +1 TR for the dust-storm cleanup (the same
    // player-agnostic AresHazards path a human rides).
    expect(bot.terraformRating).eq(tr + 2);
    // The storms are gone, and the scale-event marker is claimed in the bot's colour.
    expect(game.board.spaces.some((s) => s.tile?.tileType === TileType.DUST_STORM_MILD)).is.false;
    expect(game.aresData!.hazardData.removeDustStormsOceanCount.triggeredByColor).eq(bot.color);
    expect(game.gameLog.some((m) => m.message === '${0}\'s TR increases 1 step for eliminating dust storms.')).is.true;
    // Never a prompt for the bot.
    expect(game.deferredActions.length).eq(0);
  });

  it('Ares milestones & awards join the set and the bot evaluates them honestly', () => {
    const [game] = aresGame();
    expect(game.milestones.map((m) => m.name)).to.include.members(['Networker', 'Purifier']);
    expect(game.awards.map((a) => a.name)).to.include.members(['Entrepreneur', 'Rugged']);
    for (const milestone of game.milestones) {
      expect(AutomaMAEvaluation.botMilestoneMet(milestone, game)).is.false; // Fresh game — nothing met, nothing throws.
    }
    for (const award of game.awards) {
      expect(AutomaMAEvaluation.botAwardScore(award, game)).to.be.a('number');
    }
  });
});

function marsBot(game: IGame): IPlayer {
  const bot = game.players.find((p) => p.isMarsBot);
  if (bot === undefined) {
    throw new Error('no bot');
  }
  return bot;
}
