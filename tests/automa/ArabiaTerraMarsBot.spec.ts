import {expect} from 'chai';
import {BoardName} from '../../src/common/boards/BoardName';
import {BonusCardId, MarsBotTrackRole} from '../../src/common/automa/AutomaTypes';
import {CardName} from '../../src/common/cards/CardName';
import {SpaceBonus} from '../../src/common/boards/SpaceBonus';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {Tag} from '../../src/common/cards/Tag';
import {TileType} from '../../src/common/TileType';
import {Board} from '../../src/server/boards/Board';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {CosmicSettler} from '../../src/server/awards/arabiaTerra/CosmicSettler';
import {GanymedeColony} from '../../src/server/cards/base/GanymedeColony';
import {Mine} from '../../src/server/cards/base/Mine';
import {AquiferPumping} from '../../src/server/cards/base/AquiferPumping';
import {AutomaMAEvaluation} from '../../src/server/automa/AutomaMAEvaluation';
import {AutomaResolver} from '../../src/server/automa/AutomaResolver';
import {AutomaSetup} from '../../src/server/automa/AutomaSetup';
import {AutomaState} from '../../src/server/automa/AutomaState';
import {AutomaTilePlacer} from '../../src/server/automa/AutomaTilePlacer';
import {botCoveredIconMegacredits, botRewardIcons} from '../../src/server/automa/AutomaPlacementBonus';
import {marsBotMapProfile} from '../../src/server/automa/boards/MarsBotMapProfile';
import {ARABIA_TERRA_TRACK} from '../../src/server/automa/boards/ArabiaTerraMarsBot';
import {resolveBonusCard, routeBonusCard} from '../../src/server/automa/AutomaBonusCards';
import {Server} from '../../src/server/models/ServerModel';
import {testAutomaGame} from './AutomaTestGame';

/**
 * ARABIA TERRA (`BoardName.ARABIA_TERRA`) + MarsBot — the fourth map with a HOME-MADE board, Corporate Competition
 * (BF4) and milestone / award rules (docs/AUTOMA_DATA_AUDIT.md §2i / §21, the owner's decisions of 2026-11-05). Seven
 * of the ten names carry a rule from another map (Pioneer, Land Specialist, Botanist — Utopia Planitia's official
 * ones; Terran — Amazonis; Promoter; Zoologist by the A&M list); the home rules are Economizer, Martian, A.
 * Manufacturer and Cosmic Settler. The map's own cells: coves (an ocean OR a land tile) and data / science /
 * energy-production bonuses — ordinary icons for the bot.
 */
const ARABIA = {boardName: BoardName.ARABIA_TERRA} as const;
const BF4 = BonusCardId.BF4_CORPORATE_COMPETITION_ARABIA_TERRA;

function arabiaGame(options?: object, suffix = ''): ReturnType<typeof testAutomaGame> {
  return testAutomaGame({...ARABIA, ...options}, suffix);
}

function position(game: IGame, role: MarsBotTrackRole): number {
  return game.automa!.board.getTrackOfRole(role)!.position;
}

function setPosition(game: IGame, role: MarsBotTrackRole, value: number): void {
  game.automa!.board.getTrackOfRole(role)!.position = value;
}

function milestone(game: IGame, name: string) {
  const found = game.milestones.find((m) => m.name === name);
  expect(found, `the map's milestone ${name}`).is.not.undefined;
  return found!;
}

function award(game: IGame, name: string) {
  const found = game.awards.find((a) => a.name === name);
  expect(found, `the map's award ${name}`).is.not.undefined;
  return found!;
}

function met(game: IGame, name: string): boolean {
  return AutomaMAEvaluation.botMilestoneMet(milestone(game, name), game);
}

function score(game: IGame, name: string): number {
  return AutomaMAEvaluation.botAwardScore(award(game, name), game);
}

function resolve(game: IGame, id: BonusCardId) {
  const outcome = resolveBonusCard(game, id);
  routeBonusCard(game, id, outcome);
  return outcome;
}

function fund(game: IGame, human: IPlayer, name: string) {
  game.fundAward(human, award(game, name));
}

function botColonies(game: IGame, bot: IPlayer): number {
  return game.colonies.filter((c) => c.colonies.includes(bot.id)).length;
}

describe('ARABIA TERRA (fan map) + MarsBot — setup', () => {
  it('is playable, on the fan map, with the map\'s own rows', () => {
    const [game] = arabiaGame();
    expect(game.gameOptions.boardName).eq(BoardName.ARABIA_TERRA);
    expect(game.automa).is.not.undefined;
    expect(game.automa!.board.tracks.map((t) => t.definition.layout)).deep.eq(marsBotMapProfile(BoardName.ARABIA_TERRA).tracks.map((t) => t.layout));
    expect(game.milestones.map((m) => m.name)).deep.eq(['Economizer', 'Pioneer', 'Land Specialist', 'Martian', 'Terran']);
    expect(game.awards.map((a) => a.name)).deep.eq(['Cosmic Settler', 'Botanist', 'Promoter', 'Zoologist', 'A. Manufacturer']);
    expect(game.board.spaces.filter((s) => s.spaceType === SpaceType.COVE).map((s) => s.id), 'the five coves').deep.eq(['20', '32', '44', '46', '48']);
  });

  it('builds the bonus deck with BF4, and no other map\'s card', () => {
    const deck = AutomaSetup.bonusDeckContents({boardName: BoardName.ARABIA_TERRA} as never);
    expect(deck).contains(BF4);
    for (const other of [
      BonusCardId.B08_CORPORATE_COMPETITION, BonusCardId.B09_CORPORATE_COMPETITION_HELLAS, BonusCardId.B10_CORPORATE_COMPETITION_ELYSIUM,
      BonusCardId.B11_CORPORATE_COMPETITION_UTOPIA, BonusCardId.B12_CORPORATE_COMPETITION_CIMMERIA, BonusCardId.B13_CORPORATE_COMPETITION_BOREALIS,
      BonusCardId.BF1_CORPORATE_COMPETITION_VASTITAS_FAN, BonusCardId.BF2_CORPORATE_COMPETITION_AMAZONIS,
      BonusCardId.BF3_CORPORATE_COMPETITION_TERRA_CIMMERIA_FAN,
    ]) {
      expect(deck, other).does.not.contain(other);
    }
    expect(AutomaSetup.bonusDeckContents({boardName: BoardName.UTOPIA_PLANITIA} as never)).does.not.contain(BF4);
  });
});

describe('ARABIA TERRA (fan map) + MarsBot — tag → track resolution', () => {
  it('a Jovian tag advances the SCIENCE track, a Power tag the standalone power track, a City tag the City/EARTH track', () => {
    const [game] = arabiaGame();
    const board = game.automa!.board;
    expect(board.getTrackIndexForTag(Tag.JOVIAN)).eq(ARABIA_TERRA_TRACK.SCIENCE);
    expect(board.getTrackIndexForTag(Tag.POWER)).eq(ARABIA_TERRA_TRACK.POWER);
    expect(board.getTrackIndexForTag(Tag.CITY)).eq(ARABIA_TERRA_TRACK.EARTH);
    expect(board.getTrackIndexForTag(Tag.MARS), 'the Mars tag has no track — the home «flip» rule plays it').is.undefined;
  });
});

describe('ARABIA TERRA (fan map) + MarsBot — the free colony cell (the official Pioneer\'s, space 5)', () => {
  it('with Colonies: reaching the cell builds a colony and costs nothing', () => {
    const [game, , bot] = arabiaGame({coloniesExtension: true});
    setPosition(game, 'space', 4);
    bot.megaCredits = 9;
    const before = botColonies(game, bot);
    AutomaResolver.advanceTrack(game, ARABIA_TERRA_TRACK.SPACE);
    expect(position(game, 'space')).eq(5);
    expect(botColonies(game, bot)).eq(before + 1);
    expect(bot.megaCredits, 'the cell is free (Amazonis\' paid cells are its own)').eq(9);
  });

  it('WITHOUT Colonies the icon is ignored — no Failed Action', () => {
    const [game, , bot] = arabiaGame();
    setPosition(game, 'space', 4);
    bot.megaCredits = 9;
    AutomaResolver.advanceTrack(game, ARABIA_TERRA_TRACK.SPACE);
    expect(position(game, 'space')).eq(5);
    expect(bot.megaCredits).eq(9);
  });
});

describe('ARABIA TERRA (fan map) + MarsBot — the map\'s cells for the bot (§21.5)', () => {
  it('a COVE is a legal cell for an ocean AND for a land tile', () => {
    const [game, , bot] = arabiaGame();
    const cove = game.board.getSpaceOrThrow('44');
    expect(cove.spaceType).eq(SpaceType.COVE);
    expect(game.board.getAvailableSpacesForOcean(bot)).to.include(cove);
    expect(game.board.getAvailableSpacesForCity(bot)).to.include(cove);
  });

  it('an ocean the bot places on a cove counts as an ocean — for the count and for the oceans step', () => {
    const [game, , bot] = arabiaGame();
    const cove = game.board.getSpaceOrThrow('44');
    const before = game.board.getOceanSpaces().length;
    game.addOcean(bot, cove);
    expect(Board.isOceanSpace(cove)).is.true;
    expect(game.board.getOceanSpaces().length).eq(before + 1);
    const beside = game.board.getAdjacentSpaces(cove).find((s) => s.spaceType === SpaceType.LAND && s.tile === undefined)!;
    const away = game.board.spaces.find((s) => s.spaceType === SpaceType.LAND && s.tile === undefined && s.bonus.length === 2 &&
      !game.board.getAdjacentSpaces(s).some(Board.isOceanSpace))!;
    expect(AutomaTilePlacer.breakTie(game, [away, beside]), 'OCEANS come first: the hex beside the cove\'s ocean').eq(beside);
  });

  it('then the REWARD ICONS: with no ocean tile in sight the richer hex wins', () => {
    const [game] = arabiaGame();
    const inland = (s: {id: string}) => !game.board.getAdjacentSpaces(game.board.getSpaceOrThrow(s.id as never)).some(Board.isOceanSpace);
    const bare = game.board.spaces.find((s) => s.spaceType === SpaceType.LAND && s.bonus.length === 0 && inland(s))!;
    const rich = game.board.spaces.find((s) => s.spaceType === SpaceType.LAND && s.bonus.length === 2 && inland(s))!;
    expect(AutomaTilePlacer.breakTie(game, [bare, rich])).eq(rich);
  });

  it('data, science and energy-production icons are ordinary icons: counted, and paid 1 M€ each — never a resource', () => {
    const [game, , bot] = arabiaGame();
    for (const [id, bonus] of [['16', SpaceBonus.DATA], ['34', SpaceBonus.SCIENCE], ['32', SpaceBonus.ENERGY_PRODUCTION]] as const) {
      const cell = game.board.getSpaceOrThrow(id);
      expect(cell.bonus, id).to.include(bonus);
      expect(botRewardIcons(game, bot, cell), id).eq(cell.bonus.length);
      expect(botCoveredIconMegacredits(game, cell), id).eq(cell.bonus.length);
    }
  });

  it('a tile the bot lands on the energy-production cove pays its 1 M€ and moves NO production', () => {
    const [game, , bot] = arabiaGame();
    const cove = game.board.getSpaceOrThrow('32');
    bot.megaCredits = 0;
    const energy = bot.production.energy;
    AutomaTilePlacer.placeCity(game, {restrict: (s) => s === cove, onEmpty: 'impossible'});
    expect(cove.tile?.tileType).eq(TileType.CITY);
    expect(bot.production.energy, 'the bot keeps no production').eq(energy);
    expect(bot.megaCredits).is.at.least(1);
  });
});

describe('ARABIA TERRA (fan map) + MarsBot — milestones (§21.2)', () => {
  it('Economizer (HOME RULE, the owner\'s answer): the POWER track at 5 — never the earth row Terran reads', () => {
    const [game] = arabiaGame();
    setPosition(game, 'earth', 12);
    setPosition(game, 'power', 4);
    expect(met(game, 'Economizer')).is.false;
    setPosition(game, 'power', 5);
    expect(met(game, 'Economizer')).is.true;
  });

  it('Terran (Amazonis\' rule, by name): the City/Earth track at 6 — and it is not Economizer\'s track', () => {
    const [game] = arabiaGame();
    setPosition(game, 'power', 12);
    setPosition(game, 'earth', 5);
    expect(met(game, 'Terran')).is.false;
    setPosition(game, 'earth', 6);
    expect(met(game, 'Terran')).is.true;
  });

  it('Martian (HOME RULE, «as usual» in the played pile): 4 printed Mars tags', () => {
    const [game] = arabiaGame();
    const pile = game.automa!.playedPile;
    pile.push(CardName.LOBBYING_CAMPAIGN, CardName.LOBBYING_CAMPAIGN, CardName.LOBBYING_CAMPAIGN, CardName.MINE);
    expect(AutomaMAEvaluation.botMilestoneScore(milestone(game, 'Martian'), game)).eq(3);
    expect(met(game, 'Martian')).is.false;
    pile.push(CardName.LOBBYING_CAMPAIGN);
    expect(met(game, 'Martian')).is.true;
  });

  it('Pioneer: UNCHANGED (Utopia\'s official rule) — the bot\'s real colonies, 3 of them', () => {
    const [game, , bot] = arabiaGame({coloniesExtension: true});
    expect(met(game, 'Pioneer')).is.false;
    for (const colony of game.colonies.slice(0, 3)) {
      colony.colonies.push(bot.id);
    }
    expect(met(game, 'Pioneer')).is.true;
  });

  it('Land Specialist (Utopia\'s official rule): 3 destroyed bonus cards', () => {
    const [game] = arabiaGame();
    game.automa!.destroyedBonusCards = [BonusCardId.B04_OVERACHIEVEMENT, BonusCardId.B04_OVERACHIEVEMENT];
    expect(met(game, 'Land Specialist')).is.false;
    game.automa!.destroyedBonusCards.push(BonusCardId.B04_OVERACHIEVEMENT);
    expect(met(game, 'Land Specialist')).is.true;
  });
});

describe('ARABIA TERRA (fan map) + MarsBot — awards (§21.3)', () => {
  it('Botanist (OFFICIAL): bio − 2; Zoologist (OFFICIAL, A&M p.15): bio + 5; Promoter (OFFICIAL): the event track', () => {
    const [game] = arabiaGame();
    setPosition(game, 'bio', 6);
    setPosition(game, 'event', 7);
    expect(score(game, 'Botanist')).eq(4);
    expect(score(game, 'Zoologist')).eq(11);
    expect(score(game, 'Promoter')).eq(7);
  });

  it('A. Manufacturer (HOME RULE): the blue cards of the played pile', () => {
    const [game, , bot] = arabiaGame();
    game.automa!.playedPile.push(CardName.AQUIFER_PUMPING, CardName.MINE, CardName.AQUIFER_PUMPING);
    expect(score(game, 'A. Manufacturer')).eq(2);
    expect(award(game, 'A. Manufacturer').getScore(bot), 'the player evaluator would read the empty tableau').eq(0);
  });

  it('Cosmic Settler (HOME RULE): the cards of the played pile that place a city off Mars — the award\'s own predicate', () => {
    const [game, , bot] = arabiaGame();
    expect(CosmicSettler.placesCityOffMars(new GanymedeColony()), 'the fixture: Ganymede Colony is an off-Mars city').is.true;
    expect(CosmicSettler.placesCityOffMars(new Mine()), 'and Mine is not').is.false;
    game.automa!.playedPile.push(CardName.GANYMEDE_COLONY, CardName.MINE, CardName.PHOBOS_SPACE_HAVEN);
    expect(score(game, 'Cosmic Settler')).eq(2);
    expect(award(game, 'Cosmic Settler').getScore(bot), 'the bot owns no off-Mars city tile').eq(0);
  });
});

describe('ARABIA TERRA (fan map) + MarsBot — BF4 Corporate Competition (§21.6)', () => {
  it('Zoologist advances the bio track and costs the 5 M€; Botanist does the same', () => {
    for (const name of ['Zoologist', 'Botanist']) {
      const [game, human, bot] = arabiaGame({}, `-${name}`);
      fund(game, human, name);
      setPosition(game, 'bio', 1); // lands on 2, which is empty
      bot.megaCredits = 6;
      resolve(game, BF4);
      expect(position(game, 'bio'), name).eq(2);
      expect(bot.megaCredits, name).eq(1);
    }
  });

  it('A. Manufacturer reveals until a BLUE card, resolves it and discards the rest', () => {
    const [game, human, bot] = arabiaGame();
    fund(game, human, 'A. Manufacturer');
    bot.megaCredits = 6;
    game.projectDeck.drawPile.push(new AquiferPumping()); // found second
    game.projectDeck.drawPile.push(new Mine()); // rejected first
    resolve(game, BF4);
    expect(game.automa!.playedPile).contains(CardName.AQUIFER_PUMPING);
    expect(game.projectDeck.discardPile.map((c) => c.name)).contains(CardName.MINE);
  });

  it('Cosmic Settler has NO helper — nothing happens, nothing is paid, the card moves on', () => {
    const [game, human, bot] = arabiaGame();
    fund(game, human, 'Cosmic Settler');
    bot.megaCredits = 6;
    game.automa!.bonusDeck = [];
    game.automa!.bonusDiscard = [];
    const tracks = game.automa!.board.tracks.map((t) => t.position);
    resolve(game, BF4);
    expect(game.automa!.board.tracks.map((t) => t.position)).deep.eq(tracks);
    expect(bot.megaCredits).eq(6);
  });

  it('Venuphile advances the Venus track (added to every version of the card)', () => {
    const [game, human, bot] = arabiaGame({venusNextExtension: true});
    fund(game, human, 'Venuphile');
    bot.megaCredits = 6;
    resolve(game, BF4);
    expect(position(game, 'venus')).is.at.least(1);
    expect(bot.megaCredits).eq(1);
  });
});

describe('ARABIA TERRA (fan map) + MarsBot — a real game runs', () => {
  it('resolves 30 track advances with Venus + Colonies + Redux without a dead end', () => {
    const result = testAutomaGame({
      ...ARABIA, coloniesExtension: true, turmoilReduxExpansion: true, botParliamentMode: 'politics',
      venusNextExtension: true, preludeExtension: true, corporation: 'random',
    });
    const game = result[0];
    game.automa!.lobbyMandate = {generation: game.generation, card: 0, sent: 0};
    for (let i = 0; i < 30; i++) {
      expect(() => AutomaResolver.advanceTrack(game, i % 8)).does.not.throw();
    }
    expect(game.automa!.board.tracks.every((t) => t.position <= t.maxPosition)).is.true;
  });
});

describe('ARABIA TERRA (fan map) + MarsBot — what the client receives, and what a save keeps', () => {
  it('the server model carries the cells and tag pairings — the colony cell included', () => {
    const [game] = arabiaGame();
    const model = Server.getGameModel(game).automa!;
    expect(model.tracks).has.length(7);
    expect(model.tracks[ARABIA_TERRA_TRACK.POWER].tags).deep.eq([Tag.POWER]);
    expect(model.tracks[ARABIA_TERRA_TRACK.SCIENCE].tags).deep.eq([Tag.JOVIAN, Tag.SCIENCE]);
    expect(model.tracks[ARABIA_TERRA_TRACK.SPACE].layout[5]).eq('colony');
  });

  it('round-trips through the map profile: only the map NAME is stored', () => {
    const [game] = arabiaGame({venusNextExtension: true});
    setPosition(game, 'power', 7);
    const restored = AutomaState.deserialize(game.automa!.serialize(), game.gameOptions);
    expect(restored.board.getTrackOfRole('power')!.position).eq(7);
    expect(restored.board.getTrackIndexForTag(Tag.JOVIAN)).eq(restored.board.trackIndexOfRoleOrThrow('science'));
  });
});
