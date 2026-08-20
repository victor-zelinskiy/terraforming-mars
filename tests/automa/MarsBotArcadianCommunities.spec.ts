import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {Tag} from '../../src/common/cards/Tag';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {TileType} from '../../src/common/TileType';
import {BonusCardId, MarsBotCorpId} from '../../src/common/automa/AutomaTypes';
import {corpOwningBonusCard, marsBotCorpInfo} from '../../src/common/automa/MarsBotCorpData';
import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {Space} from '../../src/server/boards/Space';
import {AutomaMarkerPlacer} from '../../src/server/automa/AutomaMarkerPlacer';
import {resolveBonusCard, routeBonusCard} from '../../src/server/automa/AutomaBonusCards';
import {runAllActions} from '../TestingUtils';
import {TestPlayer} from '../TestPlayer';
import {testAutomaGame} from './AutomaTestGame';

const B22 = BonusCardId.B22_SETTLERS;
/** The reserved-area bonus — the SAME 3 M€ the human Arcadian collects. */
const RESERVED_MC = 3;

/** A live Arcadian Communities game (setup + generation-1 BAP already run). */
function arcadianGame(suffix: string, corporation: MarsBotCorpId = MarsBotCorpId.C18_ARCADIAN_COMMUNITIES): [IGame, TestPlayer, IPlayer] {
  const [game, human, bot] = testAutomaGame({corporation}, suffix);
  game.playerIsFinishedWithResearchPhase(human);
  return [game, human, bot];
}

function markersOf(game: IGame, owner: IPlayer): Array<Space> {
  return game.board.spaces.filter((s) => s.tile === undefined && s.player?.id === owner.id);
}

function b22InDeck(game: IGame): number {
  return game.automa!.actionDeck.filter((e) => e.kind === 'bonus' && e.id === B22).length;
}

function stat(game: IGame, key: string): number {
  return game.automa!.corpStats[key] ?? 0;
}

describe('MarsBot Arcadian Communities (C18) + B22 Settlers', () => {
  describe('the printed card', () => {
    it('prints a building starting tag, no priority, and owns Settlers', () => {
      const info = marsBotCorpInfo(MarsBotCorpId.C18_ARCADIAN_COMMUNITIES);
      expect(info.original).eq(CardName.ARCADIAN_COMMUNITIES);
      expect(info.cardNumber).eq('C18');
      expect(info.startingTags).deep.eq([Tag.BUILDING]);
      expect(info.draftPriority).is.undefined;
      expect(info.resource).is.undefined;
      expect(info.trackCubes).is.undefined;
      expect(info.corpBonusCards).deep.eq([B22]);
      expect(info.sections.map((s) => s.kind)).deep.eq(['setup', 'effect', 'beforeActionPhase']);
      expect(corpOwningBonusCard(B22)?.id, 'B22 belongs to Arcadian Communities').eq(MarsBotCorpId.C18_ARCADIAN_COMMUNITIES);
    });
  });

  describe('the SETUP box — «Resolve Settlers now»', () => {
    it('claims exactly one area the moment the corporation is seated', () => {
      const [game, , bot] = arcadianGame('-ac-setup');
      expect(markersOf(game, bot)).has.length(1);
      expect(stat(game, 'arcadianMarkers')).eq(1);
    });

    it('the claim is a MARKER, not a tile — no tile, no placement bonus taken', () => {
      const [game, , bot] = arcadianGame('-ac-marker');
      const claimed = markersOf(game, bot)[0];
      expect(claimed.tile, 'a claim places no tile').is.undefined;
      expect(claimed.spaceType).eq(SpaceType.LAND);
      // A marker collects nothing: claiming a bonus cell must not pay the bot
      // its covered-icon M€ (that is the BUILD's reward, later).
      const before = bot.megaCredits;
      const bonusCell = AutomaMarkerPlacer.availableSpaces(game).find((sp) => sp.bonus.length > 0);
      if (bonusCell !== undefined) {
        for (const space of AutomaMarkerPlacer.availableSpaces(game)) {
          if (space.id !== bonusCell.id) {
            space.player = bot;
          }
        }
        expect(AutomaMarkerPlacer.claimSpace(game)?.id).eq(bonusCell.id);
        expect(bot.megaCredits, 'the printed icons stay on the cell, uncollected').eq(before);
      }
    });

    it('another corporation claims nothing', () => {
      const [game, , bot] = arcadianGame('-ac-other', MarsBotCorpId.C01_CREDICOR);
      expect(markersOf(game, bot)).is.empty;
    });
  });

  describe('the EFFECT — the reservation', () => {
    it('a claimed area is refused to the human and kept for the bot', () => {
      const [game, human, bot] = arcadianGame('-ac-reserved');
      const claimed = markersOf(game, bot)[0];

      expect(game.board.getAvailableSpacesOnLand(human).map((s) => s.id),
        'the opponent may not build there').not.contains(claimed.id);
      expect(game.board.getAvailableSpacesOnLand(bot).map((s) => s.id),
        'only MarsBot may').contains(claimed.id);
    });

    it('building on its own claim pays the reserved-area bonus', () => {
      const [game, , bot] = arcadianGame('-ac-pays');
      const claimed = markersOf(game, bot)[0];
      const before = bot.megaCredits;

      game.addTile(bot, claimed, {tileType: TileType.CITY});
      runAllActions(game);

      // The stat and the real money agree — the constant in the corporation
      // file mirrors `Game.grantPlacementBonuses`, and this is what pins them.
      expect(stat(game, 'arcadianBuilds')).eq(1);
      expect(stat(game, 'arcadianMc')).eq(RESERVED_MC);
      expect(bot.megaCredits - before, 'at least the reserved-area bonus').is.at.least(RESERVED_MC);
    });

    it('building on an UNclaimed area pays no reserved-area bonus', () => {
      const [game, , bot] = arcadianGame('-ac-unclaimed');
      const free = game.board.getAvailableSpacesOnLand(bot)
        .find((s) => s.player === undefined && s.tile === undefined && s.bonus.length === 0)!;

      game.addTile(bot, free, {tileType: TileType.CITY});
      runAllActions(game);

      expect(stat(game, 'arcadianBuilds')).eq(0);
    });

    it('another corporation gets nothing for building on a marked cell', () => {
      const [game, , bot] = arcadianGame('-ac-othercorp', MarsBotCorpId.C01_CREDICOR);
      const space = game.board.getAvailableSpacesOnLand(bot)
        .find((s) => s.player === undefined && s.tile === undefined && s.bonus.length === 0)!;
      space.player = bot; // A marker from some other source.
      const before = bot.megaCredits;

      game.addTile(bot, space, {tileType: TileType.CITY});
      runAllActions(game);

      expect(game.automa!.corpStats['arcadianBuilds']).is.undefined;
      expect(bot.megaCredits - before, 'no reserved-area bonus').is.lessThan(RESERVED_MC);
    });
  });

  describe('B22 Settlers', () => {
    it('is in the deck and in the recurring pool from generation 1', () => {
      const [game] = arcadianGame('-ac-b22');
      expect(b22InDeck(game)).eq(1);
      expect(game.automa!.recurringBonusCards.filter((id) => id === B22)).has.length(1);
    });

    it('claims another area and stays in the holding pool', () => {
      const [game, , bot] = arcadianGame('-ac-b22-claim');
      const before = markersOf(game, bot).length;

      const outcome = resolveBonusCard(game, B22);
      routeBonusCard(game, B22, outcome);

      expect(markersOf(game, bot)).has.length(before + 1);
      expect(stat(game, 'settlersPlayed')).eq(1);
      expect(outcome).eq('discard');
      expect(game.automa!.bonusDiscard).not.contains(B22);
      expect(game.automa!.recurringBonusCards).contains(B22);
    });

    it('never claims a cell that is already reserved — by anyone', () => {
      const [game, human, bot] = arcadianGame('-ac-b22-nonreserved');
      const claimed = markersOf(game, bot)[0];
      const humanCell = game.board.getAvailableSpacesOnLand(human)
        .find((s) => s.player === undefined && s.tile === undefined)!;
      humanCell.player = human;

      for (let i = 0; i < 3; i++) {
        resolveBonusCard(game, B22);
      }

      expect(markersOf(game, bot).map((s) => s.id), 'the first claim was not re-claimed')
        .to.have.length(4).and.to.include(claimed.id);
      expect(humanCell.player, 'the opponent\'s claim is untouched').eq(human);
    });

    it('an exhausted map is the official Failed Action', () => {
      const [game, , bot] = arcadianGame('-ac-b22-full');
      const before = bot.megaCredits;
      // Reserve every remaining claimable cell.
      for (const space of AutomaMarkerPlacer.availableSpaces(game)) {
        space.player = bot;
      }

      resolveBonusCard(game, B22);

      expect(stat(game, 'settlersBlocked')).eq(1);
      expect(bot.megaCredits, 'the Failed Action compensation').is.greaterThan(before);
    });

    it('a foreign bonus card is refused by the corporation', () => {
      const [game] = arcadianGame('-ac-foreign');
      expect(() => resolveBonusCard(game, BonusCardId.B23_RAPID_SPROUTING)).to.throw();
    });
  });

  describe('the printed tiebreak — «most adjacent ocean-RESERVED spaces»', () => {
    it('wins the tie before the card flip', () => {
      const [game, , bot] = arcadianGame('-ac-tiebreak');
      // Leave exactly two candidates: one landlocked, one beside ocean-reserved
      // cells, both with the same adjacent-OCEAN count (zero — nothing placed)
      // and the same covered icons.
      const all = AutomaMarkerPlacer.availableSpaces(game);
      const shoreline = all.find((s) => s.bonus.length === 0 &&
        game.board.getAdjacentSpaces(s).some((adj) => adj.spaceType === SpaceType.OCEAN))!;
      const inland = all.find((s) => s.bonus.length === 0 && s.id !== shoreline.id &&
        game.board.getAdjacentSpaces(s).every((adj) => adj.spaceType !== SpaceType.OCEAN))!;
      for (const space of all) {
        if (space.id !== shoreline.id && space.id !== inland.id) {
          space.player = bot;
        }
      }

      const claimed = AutomaMarkerPlacer.claimSpace(game);

      expect(claimed?.id, 'the shoreline claim wins without a card flip').eq(shoreline.id);
    });
  });

  describe('state', () => {
    it('the markers and the counters survive a save/load round trip', () => {
      const [game, , bot] = arcadianGame('-ac-serialize');
      resolveBonusCard(game, B22);

      const restored = Game.deserialize(structuredClone(game.serialize()));
      const restoredBot = restored.players.find((p) => p.isMarsBot)!;

      expect(restored.automa!.corporation).eq(MarsBotCorpId.C18_ARCADIAN_COMMUNITIES);
      expect(restored.automa!.corpStats['arcadianMarkers']).eq(2);
      expect(markersOf(restored, restoredBot).map((s) => s.id).sort())
        .deep.eq(markersOf(game, bot).map((s) => s.id).sort());
    });
  });

  describe('the turn footprint the client animates', () => {
    it('a claim is reported as a MARKER, never as a tile', () => {
      const [game, human, bot] = arcadianGame('-ac-visual');
      // Take a bot turn whose only visible act is the Settlers claim.
      game.automa!.actionDeck = [{kind: 'bonus', id: B22}];
      human.popWaitingFor();
      game.playerIsFinishedTakingActions();

      const turn = game.automa!.lastTurn!;
      expect(turn.visual?.markers, 'the claim is in the turn footprint').is.not.undefined;
      expect(turn.visual?.markers).has.length(1);
      expect(turn.visual?.markers?.[0].color).eq(bot.color);
      expect(turn.visual?.tiles, 'a claim is not a tile').is.undefined;
    });
  });
});
