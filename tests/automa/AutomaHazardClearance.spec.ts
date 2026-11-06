import {expect} from 'chai';
import {TileType} from '../../src/common/TileType';
import {SpaceBonus} from '../../src/common/boards/SpaceBonus';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {Space} from '../../src/server/boards/Space';
import {Board} from '../../src/server/boards/Board';
import {Game} from '../../src/server/Game';
import {AutomaAres, CLEARANCE} from '../../src/server/automa/AutomaAres';
import {AutomaTilePlacer} from '../../src/server/automa/AutomaTilePlacer';
import {AutomaGameEnd} from '../../src/server/automa/AutomaGameEnd';
import {Purifier} from '../../src/server/milestones/Purifier';
import {testAutomaGame} from './AutomaTestGame';

/**
 * ARES HOUSE RULE 4 — MarsBot CLEARS hazards (the owner's decision 2026-11-06, docs/AUTOMA_DATA_AUDIT.md §22.7): its
 * final greenery covers a hazard it can pay for (the most TR first); in the game only when it truly pays — from
 * generation 4, once a generation, 5 M€ kept, the hazard strictly better than every ordinary cell (Purifier lifts the
 * priority). The price and the reward ride the human's pipeline: the M€, the TR, the Purifier count.
 */

function aresGame(suffix: string): [IGame, IPlayer] {
  const [game, , bot] = testAutomaGame({aresExtension: true, aresHazards: false}, suffix);
  return [game, bot];
}

function putHazard(space: Space, tileType: TileType = TileType.DUST_STORM_MILD): void {
  space.tile = {tileType, protectedHazard: false};
}

/** A greenery-legal land space for the bot far from everything placed so far. */
function freeLand(game: IGame, bot: IPlayer, skip: ReadonlyArray<Space> = []): Array<Space> {
  return game.board.getAvailableSpacesForGreenery(bot).filter((s) => !skip.includes(s) && s.tile === undefined);
}

function purifierCount(game: IGame, bot: IPlayer): number {
  return game.aresData!.milestoneResults.find((e) => e.id === bot.id)!.purifierCount;
}

/** Arms one final-greenery icon: a track whose NEXT space is a greenery. */
function armFinalGreenery(game: IGame): void {
  const track = game.automa!.board.tracks.find((t) => t.definition.layout.some((a, i) => i > 0 && a === 'greenery'))!;
  track.position = track.definition.layout.indexOf('greenery') - 1;
  for (const other of game.automa!.board.tracks) {
    if (other !== track) {
      other.position = other.maxPosition; // no other final greenery
    }
  }
}

describe('Ares house rule 4 — MarsBot clears hazards', () => {
  it('the FINAL greenery covers a hazard the bot can pay for — the price, the TR and the Purifier count ride the human pipeline', () => {
    const [game, bot] = aresGame('-clear-final');
    const [hazard] = freeLand(game, bot);
    putHazard(hazard);
    bot.megaCredits = 20;
    const tr = bot.terraformRating;
    armFinalGreenery(game);
    AutomaGameEnd.placeFinalGreeneries(game);
    expect(hazard.tile?.tileType, 'the greenery went ON the hazard').eq(TileType.GREENERY);
    expect(hazard.player).eq(bot);
    expect(purifierCount(game, bot)).eq(1);
    expect(bot.terraformRating - tr, 'the cleanup TR (+ the oxygen step of the greenery when it can still move)').is.at.least(1);
    expect(bot.megaCredits, 'the cleanup price, paid without a prompt').is.at.most(12);
    expect(game.gameLog.some((l) => l.message.startsWith('${0} covers an Ares hazard with a final greenery'))).is.true;
  });

  it('the final greenery prefers the hazard giving MORE TR (a severe storm), and covers nothing it cannot pay for', () => {
    const [game, bot] = aresGame('-clear-severe');
    const [mild, severe] = freeLand(game, bot);
    putHazard(mild, TileType.DUST_STORM_MILD);
    putHazard(severe, TileType.DUST_STORM_SEVERE);
    bot.megaCredits = 20;
    armFinalGreenery(game);
    AutomaGameEnd.placeFinalGreeneries(game);
    expect(severe.tile?.tileType).eq(TileType.GREENERY);
    expect(mild.tile?.tileType, 'one greenery, the most TR').eq(TileType.DUST_STORM_MILD);

    const [poor, poorBot] = aresGame('-clear-poor');
    const [h] = freeLand(poor, poorBot);
    putHazard(h);
    poorBot.megaCredits = 7;
    armFinalGreenery(poor);
    AutomaGameEnd.placeFinalGreeneries(poor);
    expect(h.tile?.tileType, '7 M€ cannot pay for a mild storm').eq(TileType.DUST_STORM_MILD);
  });

  it('IN THE GAME: never before generation 4, never when it leaves under 5 M€, never when an ordinary cell is as good', () => {
    const [game, bot] = aresGame('-clear-turn');
    const land = freeLand(game, bot);
    const hazard = land[0];
    putHazard(hazard);
    const legal = legalGreenery(game, bot);
    const ordinary = AutomaAres.withoutHazardSpaces(game, legal);
    bot.megaCredits = 30;
    game.generation = 3;
    expect(AutomaAres.clearanceCandidates(game, legal, ordinary, 'turn'), 'generation 3').is.undefined;
    game.generation = CLEARANCE.fromGeneration;
    // A bare hazard (no icon) is worth exactly its price at 8 M€ a step — never strictly better than an ordinary cell.
    hazard.bonus = [];
    expect(AutomaAres.clearanceCandidates(game, legal, ordinary, 'turn'), 'no better than the ordinary cells').is.undefined;
  });

  it('IN THE GAME: the icons printed UNDER a hazard are not its merit — a covering tile is paid none of them', () => {
    const [game, bot] = aresGame('-clear-turn-icons');
    const [hazard] = freeLand(game, bot);
    putHazard(hazard);
    // The richest cell of the board by far — on paper: six icons the cover would never be paid.
    hazard.bonus = [SpaceBonus.STEEL, SpaceBonus.STEEL, SpaceBonus.STEEL, SpaceBonus.STEEL, SpaceBonus.STEEL, SpaceBonus.STEEL];
    for (const space of game.board.spaces.filter((s) => s !== hazard)) {
      space.bonus = [];
    }
    bot.megaCredits = 30;
    game.generation = CLEARANCE.fromGeneration;
    const legal = legalGreenery(game, bot);
    expect(AutomaAres.clearanceCandidates(game, legal, AutomaAres.withoutHazardSpaces(game, legal), 'turn'),
      'eight M€ for a TR step is break-even — the unpaid icons add nothing').is.undefined;
    AutomaTilePlacer.placeGreenery(game);
    expect(hazard.tile?.tileType, 'the storm is left alone').eq(TileType.DUST_STORM_MILD);
    expect(bot.megaCredits, 'and nothing was paid for it').is.at.least(30);
  });

  it('IN THE GAME: a hazard worth its price (the Purifier chase) is covered — once a generation, 5 M€ kept', () => {
    const [game, bot] = aresGame('-clear-turn-yes');
    const hazard = freeLand(game, bot)[0];
    putHazard(hazard);
    for (const space of game.board.spaces) {
      space.bonus = [];
    }
    // The merit that is REAL: the milestone the clearance counts towards (+4 while the bot chases it).
    game.milestones.push(new Purifier());
    bot.megaCredits = 30;
    game.generation = CLEARANCE.fromGeneration;
    const before = purifierCount(game, bot);
    AutomaTilePlacer.placeGreenery(game);
    expect(hazard.tile?.tileType).eq(TileType.GREENERY);
    expect(purifierCount(game, bot) - before).eq(1);
    expect(game.automa!.lastClearanceGeneration).eq(CLEARANCE.fromGeneration);
    // A second hazard in the SAME generation is left alone.
    // A greenery must now touch the bot's own tiles, so the next legal cells are the new greenery's neighbours.
    const second = freeLand(game, bot, [hazard])[0];
    putHazard(second);
    const legal = legalGreenery(game, bot);
    expect(AutomaAres.clearanceCandidates(game, legal, AutomaAres.withoutHazardSpaces(game, legal), 'turn'), 'once a generation').is.undefined;
    game.generation++;
    expect(AutomaAres.clearanceCandidates(game, legal, AutomaAres.withoutHazardSpaces(game, legal), 'turn')).deep.eq([second]);
    // …and 5 M€ stay in the till: 8 for the storm + 5 kept = 13 needed.
    bot.megaCredits = 12;
    expect(AutomaAres.clearanceCandidates(game, legal, AutomaAres.withoutHazardSpaces(game, legal), 'turn'), '12 M€ — the 5 kept would go').is.undefined;
  });

  it('Purifier in the set and unclaimed lifts the priority — a hazard only as good as the best ordinary cell is now covered', () => {
    const [game, bot] = aresGame('-clear-purifier');
    const land = freeLand(game, bot);
    const hazard = land[0];
    putHazard(hazard);
    for (const space of game.board.spaces) {
      space.bonus = [];
    }
    bot.megaCredits = 30;
    game.generation = CLEARANCE.fromGeneration;
    const legal = legalGreenery(game, bot);
    const ordinary = AutomaAres.withoutHazardSpaces(game, legal);
    expect(AutomaAres.clearanceCandidates(game, legal, ordinary, 'turn'), 'no Purifier — break-even is not enough').is.undefined;
    game.milestones.push(new Purifier());
    expect(AutomaAres.clearanceCandidates(game, legal, ordinary, 'turn'), 'Purifier — chase it').deep.eq([hazard]);
  });

  it('the clearance generation survives a save; a game without Ares never clears', () => {
    const [game] = aresGame('-clear-save');
    game.automa!.lastClearanceGeneration = 5;
    expect(Game.deserialize(structuredClone(game.serialize())).automa!.lastClearanceGeneration).eq(5);
    const [plain, , plainBot] = testAutomaGame({}, '-clear-plain');
    const legal = legalGreenery(plain, plainBot);
    expect(AutomaAres.clearanceCandidates(plain, legal, legal, 'final')).is.undefined;
    expect(plain.board.spaces.filter((s) => Board.isGreenerySpace(s))).is.empty;
  });
});

/** The bot's legal greenery list, hazards included (what the placer hands the rule). */
function legalGreenery(game: IGame, bot: IPlayer): ReadonlyArray<Space> {
  return game.board.getAvailableSpacesForGreenery(bot);
}
