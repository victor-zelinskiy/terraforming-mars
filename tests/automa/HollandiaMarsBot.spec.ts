import {expect} from 'chai';
import {BoardName} from '../../src/common/boards/BoardName';
import {BonusCardId} from '../../src/common/automa/AutomaTypes';
import {AUTOMA_SUPPORTED_BOARDS} from '../../src/common/automa/automaCompatibility';
import {RandomMAOptionType} from '../../src/common/ma/RandomMAOptionType';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {TileType} from '../../src/common/TileType';
import {IGame} from '../../src/server/IGame';
import {Space} from '../../src/server/boards/Space';
import {RemoveAnyPlants} from '../../src/server/deferredActions/RemoveAnyPlants';
import {AutomaResolver} from '../../src/server/automa/AutomaResolver';
import {AutomaState} from '../../src/server/automa/AutomaState';
import {resolveBonusCard} from '../../src/server/automa/AutomaBonusCards';
import {MARSBOT_BOARDS, botMapProfile, marsBotMapProfile} from '../../src/server/automa/boards/MarsBotMapProfile';
import {THARSIS_MARSBOT_BOARD} from '../../src/server/automa/boards/TharsisMarsBot';
import {botSetBriefing} from '../../src/server/automa/ma/botMABriefing';
import {matBase} from '../../src/server/automa/ma/matGenerator';
import {matViolations} from '../../src/server/automa/ma/matLaw';
import {libraryRows, rowKey} from '../../src/server/automa/ma/matRowLibrary';
import {Server} from '../../src/server/models/ServerModel';
import {testAutomaGame} from './AutomaTestGame';

/**
 * HOLLANDIA (`BoardName.HOLLANDIA`) + MarsBot — the fifth fan map and the last map of the game to get the bot
 * (docs/AUTOMA_DATA_AUDIT.md §2j / §23). It prints NO milestone / award row, so nothing here is a home-made board: every
 * game draws its set, the random-set generator deals the bot a mat on the BORROWED Tharsis base (the A&M module's own
 * rule, RB-C p.12) and the B14 «Corporate Competition · this game's set». The map's one mechanic — the Asteroid
 * Deflection Zone — holds for the bot as for any player.
 */
const HOLLANDIA = {boardName: BoardName.HOLLANDIA} as const;

function hollandiaGame(options?: object, suffix = ''): ReturnType<typeof testAutomaGame> {
  return testAutomaGame({...HOLLANDIA, ...options}, suffix);
}

function zone(game: IGame): Array<Space> {
  return game.board.spaces.filter((space) => space.spaceType === SpaceType.DEFLECTION_ZONE);
}

function plainLand(game: IGame): Array<Space> {
  return game.board.spaces.filter((space) => space.spaceType === SpaceType.LAND && space.tile === undefined);
}

function allBonusCards(automa: AutomaState): Array<BonusCardId> {
  const inActionDeck = automa.actionDeck
    .filter((c): c is {kind: 'bonus', id: BonusCardId} => c.kind === 'bonus')
    .map((c) => c.id);
  const inDeck = automa.bonusDeck.flatMap((c) => c.kind === 'bonus' ? [c.id] : []);
  return [...inDeck, ...inActionDeck];
}

const PRINTED_COMPETITIONS: ReadonlyArray<BonusCardId> = [
  BonusCardId.B08_CORPORATE_COMPETITION, BonusCardId.B09_CORPORATE_COMPETITION_HELLAS, BonusCardId.B10_CORPORATE_COMPETITION_ELYSIUM,
  BonusCardId.B11_CORPORATE_COMPETITION_UTOPIA, BonusCardId.B12_CORPORATE_COMPETITION_CIMMERIA, BonusCardId.B13_CORPORATE_COMPETITION_BOREALIS,
];

describe('HOLLANDIA (fan map) + MarsBot — the map with no row of its own', () => {
  it('is covered: in both lists, on a BORROWED Tharsis board — and it lends the row library nothing', () => {
    expect(AUTOMA_SUPPORTED_BOARDS).to.include(BoardName.HOLLANDIA);
    expect([...MARSBOT_BOARDS].sort()).deep.eq([...AUTOMA_SUPPORTED_BOARDS].sort());

    const profile = marsBotMapProfile(BoardName.HOLLANDIA);
    expect(profile.boardName).eq(BoardName.HOLLANDIA);
    expect(profile.borrowedBoard, 'the A&M module\'s «Tharsis board»').eq(BoardName.THARSIS);
    expect(profile.tracks, 'the very rows of Tharsis — nothing transcribed, nothing invented').eq(THARSIS_MARSBOT_BOARD);
    expect(profile.corporateCompetition).eq(BonusCardId.B14_CORPORATE_COMPETITION_MA);
    expect(profile.placementTiebreakers.map((t) => t.id), 'the base rulebook\'s pair').deep.eq(['oceans', 'reward-icons']);
    expect(profile.tiebreakRewardBonus).is.undefined;
    // No other map borrows a board.
    expect(MARSBOT_BOARDS.filter((b) => marsBotMapProfile(b).borrowedBoard !== undefined)).deep.eq([BoardName.HOLLANDIA]);

    // The generator's base is the LENDER, and the loan is named.
    expect(matBase(BoardName.HOLLANDIA)).deep.eq({profile: marsBotMapProfile(BoardName.THARSIS), fallback: true});
    expect(matBase(BoardName.THARSIS).fallback).is.false;
    // The library holds Tharsis' rows once, under Tharsis' name.
    for (const row of THARSIS_MARSBOT_BOARD) {
      const boards = libraryRows(rowKey(row.role, row.tags)).flatMap((r) => r.boards);
      expect(boards, `${row.role} row`).to.include(BoardName.THARSIS);
      expect(boards, `${row.role} row`).not.to.include(BoardName.HOLLANDIA);
    }
  });

  it('every game DRAWS its set — the box off or on — so the bot always plays a generated mat and B14', () => {
    for (const randomMA of [RandomMAOptionType.NONE, RandomMAOptionType.ALL]) {
      const [game] = hollandiaGame({randomMA}, `-${randomMA}`);
      expect(game.milestones, 'a drawn milestone set').has.length(5);
      expect(game.awards, 'a drawn award set').has.length(5);

      const automa = game.automa!;
      expect(automa.mat, 'a mat dealt for the drawn set').is.not.undefined;
      expect(automa.mat!.base, 're-cut from Tharsis').eq(BoardName.THARSIS);
      expect(automa.mat!.report.baseIsFallback).is.true;
      expect(matViolations(automa.mat!.tracks), 'the law of the six boards').deep.eq([]);

      const cards = allBonusCards(automa);
      expect(cards).contains(BonusCardId.B14_CORPORATE_COMPETITION_MA);
      expect(cards.filter((id) => PRINTED_COMPETITIONS.includes(id)), 'no printed map\'s card').deep.eq([]);
      expect(botMapProfile(game).corporateCompetition).eq(BonusCardId.B14_CORPORATE_COMPETITION_MA);
      expect(botMapProfile(game).boardName).eq(BoardName.HOLLANDIA);
    }
  });

  it('the same deal gives the same mat (the generator through the real setup)', () => {
    const [a] = hollandiaGame({seed: 0.31}, '-a');
    const [b] = hollandiaGame({seed: 0.31}, '-b');
    expect(a.milestones.map((m) => m.name)).deep.eq(b.milestones.map((m) => m.name));
    expect(JSON.stringify(a.automa!.mat)).eq(JSON.stringify(b.automa!.mat));
  });

  it('the briefing tells the player the board is borrowed', () => {
    const [game] = hollandiaGame();
    const lines = botSetBriefing(game).map((m) => m.message);
    expect(lines[0]).eq('This map has no MarsBot board of its own — the bot plays the Tharsis board, re-cut for this set');
    expect(Server.getGameModel(game).automa!.briefing?.[0]?.message).eq(lines[0]);
  });
});

describe('HOLLANDIA (fan map) + MarsBot — the Asteroid Deflection Zone holds for the bot as for any player', () => {
  it('the zone is twelve cells of land the bot may place on', () => {
    const [game, , bot] = hollandiaGame();
    expect(zone(game)).has.length(12);
    const legal = game.board.getAvailableSpacesOnLand(bot);
    expect(zone(game).every((space) => legal.includes(space)), 'every zone cell is a legal land cell for the bot').is.true;
  });

  it('a bot whose every tile is inside the zone is sheltered: the human\'s plant removal names it protected', () => {
    const [game, human, bot] = hollandiaGame();
    bot.megaCredits = 12; // the bot's plant stand-in (its M€ supply) — something to take
    const attack = () => new RemoveAnyPlants(human, 3);
    expect(attack().opponentOptions(), 'no tile yet — an ordinary target').has.length(1);

    game.addTile(bot, zone(game)[0], {tileType: TileType.GREENERY});
    expect(bot.withinDeflectionZone).is.true;
    expect(bot.plantsAreProtected()).is.true;
    expect(attack().opponentOptions(), 'inside the zone — not a target').deep.eq([]);
    const disabled = attack().disabledOpponents();
    expect(disabled).has.length(1);
    expect(disabled[0].reason, 'shown, with the reason — never hidden').eq('Plants are protected');

    // One tile outside and the shelter is gone — the rule's own «ALL your tiles».
    game.addTile(bot, plainLand(game)[0], {tileType: TileType.GREENERY});
    expect(bot.withinDeflectionZone).is.false;
    expect(attack().opponentOptions()).has.length(1);
  });

  it('a human inside the zone is safe from B01 Meteor Shower — the card is destroyed, the plants stay', () => {
    const [game, human] = hollandiaGame();
    human.plants = 7;
    game.addTile(human, zone(game)[1], {tileType: TileType.GREENERY});
    expect(human.plantsAreProtected()).is.true;
    expect(resolveBonusCard(game, BonusCardId.B01_METEOR_SHOWER)).eq('destroy');
    expect(human.plants).eq(7);

    // …and outside it the card bites as printed.
    game.addTile(human, plainLand(game)[0], {tileType: TileType.GREENERY});
    expect(human.plantsAreProtected()).is.false;
    resolveBonusCard(game, BonusCardId.B01_METEOR_SHOWER);
    expect(human.plants).is.lessThan(7);
  });

  it('the journal names the moment the shelter turns on and off — for the bot too', () => {
    const [game, , bot] = hollandiaGame();
    const lines = () => game.gameLog.map((entry) => entry.message);
    const on = '${0}\'s plants are now protected by the Deflection Zone';
    const off = '${0}\'s plants are no longer protected by the Deflection Zone';

    game.addTile(bot, zone(game)[0], {tileType: TileType.GREENERY});
    expect(lines().filter((m) => m === on)).has.length(1);
    // A second tile inside changes nothing — nothing is said twice.
    game.addTile(bot, zone(game)[1], {tileType: TileType.GREENERY});
    expect(lines().filter((m) => m === on)).has.length(1);
    expect(lines().filter((m) => m === off)).has.length(0);

    game.addTile(bot, plainLand(game)[0], {tileType: TileType.GREENERY});
    expect(lines().filter((m) => m === off)).has.length(1);
  });
});

describe('HOLLANDIA (fan map) + MarsBot — a real game runs, and a save keeps the mat', () => {
  it('resolves 30 track advances with Venus + Colonies + Redux without a dead end', () => {
    const [game] = testAutomaGame({
      ...HOLLANDIA, coloniesExtension: true, turmoilReduxExpansion: true, botParliamentMode: 'politics',
      venusNextExtension: true, preludeExtension: true, corporation: 'random',
    });
    game.automa!.lobbyMandate = {generation: game.generation, card: 0, sent: 0};
    for (let i = 0; i < 30; i++) {
      expect(() => AutomaResolver.advanceTrack(game, i % 8)).does.not.throw();
    }
    expect(game.automa!.board.tracks.every((t) => t.position <= t.maxPosition)).is.true;
  });

  it('the server model carries the dealt mat, the set\'s card and the bot\'s rule for every name of the set', () => {
    const [game] = hollandiaGame();
    const model = Server.getGameModel(game).automa!;
    expect(model.tracks).has.length(7);
    expect(model.competition, 'B14\'s face — a row per award of this game').has.length(game.awards.length);
    const names = [...game.milestones.map((m) => m.name), ...game.awards.map((a) => a.name)];
    expect(model.maRules?.map((r) => r.name).sort()).deep.eq([...names].sort());
  });

  it('round-trips through JSON — the SAVE path — with the mat whole and the profile the map\'s', () => {
    const [game] = hollandiaGame({venusNextExtension: true});
    const automa = game.automa!;
    automa.board.getTrackOfRole('power')!.position = 7;
    const restored = AutomaState.deserialize(JSON.parse(JSON.stringify(automa.serialize())), game.gameOptions);
    expect(restored.board.getTrackOfRole('power')!.position).eq(7);
    expect(JSON.stringify(restored.mat)).eq(JSON.stringify(automa.mat));
    expect(restored.profile?.boardName).eq(BoardName.HOLLANDIA);
    expect(restored.profile?.corporateCompetition).eq(BonusCardId.B14_CORPORATE_COMPETITION_MA);
    expect(restored.profile?.placementTiebreakers.map((t) => t.id)).deep.eq(automa.profile!.placementTiebreakers.map((t) => t.id));
  });
});
