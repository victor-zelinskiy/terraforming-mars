import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {Tag} from '../../src/common/cards/Tag';
import {MarsBotCorpId} from '../../src/common/automa/AutomaTypes';
import {MarsBotDraftPriority, marsBotCorpInfo} from '../../src/common/automa/MarsBotCorpData';
import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {IProjectCard} from '../../src/server/cards/IProjectCard';
import {AutomaCorporations} from '../../src/server/automa/corps/AutomaCorporations';
import {AutomaResolver} from '../../src/server/automa/AutomaResolver';
import {MarsBotBoard} from '../../src/server/automa/MarsBotBoard';
import {MarsBotDraftResolver} from '../../src/server/automa/corps/MarsBotDraftResolver';
import {THARSIS_MARSBOT_BOARD, THARSIS_TRACK} from '../../src/server/automa/boards/TharsisMarsBot';
import {cardsFromJSON} from '../../src/server/createCard';
import {TestPlayer} from '../TestPlayer';
import {testAutomaGame} from './AutomaTestGame';

const PRIORITY: MarsBotDraftPriority = {type: 'leastAdvancedTrack'};
/** Single-tag cards, probed from the corpus — no tag can cross-score. */
const BUILDING_CARD = CardName.CARBONATE_PROCESSING;
const SPACE_CARD = CardName.OPTIMAL_AEROBRAKING;
const PLANT_CARD = CardName.BUSHES;

/** A live Aridor game. Colonies are on, or the corporation could not be seated. */
function aridorGame(suffix: string, corporation: MarsBotCorpId = MarsBotCorpId.C30_ARIDOR,
  options: Record<string, unknown> = {}): [IGame, TestPlayer, IPlayer] {
  const [game, human, bot] = testAutomaGame({corporation, coloniesExtension: true, ...options}, suffix);
  game.playerIsFinishedWithResearchPhase(human);
  return [game, human, bot];
}

function stat(game: IGame, key: string): number {
  return game.automa!.corpStats[key] ?? 0;
}

function resolver(board: MarsBotBoard = new MarsBotBoard(THARSIS_MARSBOT_BOARD)): MarsBotDraftResolver {
  return new MarsBotDraftResolver(board, (() => {}) as never);
}

function cards(...names: Array<CardName>): Array<IProjectCard> {
  return cardsFromJSON(names);
}

/** Park a track one space below `position` so the next advance lands on it. */
function armCube(game: IGame, trackIndex: number, position: number) {
  game.automa!.board.tracks[trackIndex].position = position - 1;
}

describe('MarsBot Aridor (C30)', () => {
  describe('the printed card', () => {
    it('prints no starting tag, the least-advanced priority and a Colonies condition', () => {
      const info = marsBotCorpInfo(MarsBotCorpId.C30_ARIDOR);
      expect(info.original).eq(CardName.ARIDOR);
      expect(info.cardNumber).eq('C30');
      expect(info.startingTags, 'the corner carries the priority plate, not a tag').is.empty;
      expect(info.draftPriority).deep.eq(PRIORITY);
      expect(info.requiresModules).deep.eq(['colonies']);
      expect(info.requiresAnyModule).is.undefined;
      expect(info.resource).is.undefined;
      expect(info.corpBonusCards).is.empty;
      expect(info.reminderColumns, 'its cubes sit ON spaces — no column is marked').is.undefined;
      expect(info.sections.map((s) => s.kind)).deep.eq(['draftPriority', 'setup', 'effect']);
    });

    it('prints 5 white and 4 black cubes at exactly the listed spaces', () => {
      const cubes = marsBotCorpInfo(MarsBotCorpId.C30_ARIDOR).trackCubes ?? [];
      const at = (cubeType: string) => cubes
        .filter((c) => c.cubeType === cubeType)
        .map((c) => `${c.tag}#${c.position}`)
        .sort();
      expect(at('white')).deep.eq(
        [`${Tag.BUILDING}#3`, `${Tag.JOVIAN}#6`, `${Tag.POWER}#3`, `${Tag.SCIENCE}#3`, `${Tag.SPACE}#3`].sort());
      expect(at('black')).deep.eq(
        [`${Tag.CITY}#6`, `${Tag.EARTH}#3`, `${Tag.PLANT}#3`, `${Tag.PLANT}#6`].sort());
      expect(cubes).has.length(9);
    });

    it('says the SAME thing for both colours — here the colour is a component, not a rule', () => {
      const legend = marsBotCorpInfo(MarsBotCorpId.C30_ARIDOR).cubeLegend ?? {};
      expect(legend.white).is.a('string').and.not.empty;
      expect(legend.black, 'one printed sentence, one meaning').eq(legend.white);
      expect(legend.credit, 'it seeds no silver cubes').is.undefined;
    });
  });

  describe('the SETUP — where the cubes land', () => {
    it('seeds every track but the EVENT one, which is the track they all pay', () => {
      const [game] = aridorGame('-ar-cubes');
      const cubes = AutomaCorporations.cubesOf(game);
      expect(cubes).has.length(9);
      expect(cubes.map((c) => c.trackIndex), 'the event track is deliberately bare')
        .does.not.contain(THARSIS_TRACK.EVENT);
    });

    it('POWER and JOVIAN are ONE row of the mat, and so are EARTH and CITY', () => {
      // The card names four tracks there; the board has two. Cube positions
      // are addressed by TAG precisely so the data can say what the card says.
      const [game] = aridorGame('-ar-shared');
      const on = (trackIndex: number) => AutomaCorporations.cubesOf(game)
        .filter((c) => c.trackIndex === trackIndex)
        .map((c) => c.position)
        .sort((a, b) => a - b);
      expect(on(THARSIS_TRACK.ENERGY), 'power #3 + Jovian #6').deep.eq([3, 6]);
      expect(on(THARSIS_TRACK.EARTH), 'Earth #3 + city #6').deep.eq([3, 6]);
      expect(on(THARSIS_TRACK.BIO), 'the plant track is named twice by the card').deep.eq([3, 6]);
      expect(on(THARSIS_TRACK.BUILDING)).deep.eq([3]);
    });

    it('another corporation seeds none', () => {
      const [game] = aridorGame('-ar-cubes-other', MarsBotCorpId.C01_CREDICOR);
      expect(AutomaCorporations.cubesOf(game)).is.empty;
    });
  });

  describe('the SETUP — «Add an additional Colony tile to play»', () => {
    it('puts one more colony into the game, taken out of the unused pool', () => {
      const [control] = aridorGame('-ar-colony-control', MarsBotCorpId.C01_CREDICOR);
      const [game] = aridorGame('-ar-colony');

      expect(game.colonies.length, 'exactly one more than the same game without it')
        .eq(control.colonies.length + 1);
      expect(stat(game, 'aridorColonyAdded')).eq(1);
      const names = game.colonies.map((c) => c.name);
      expect(new Set(names).size, 'no colony was added twice').eq(names.length);
      expect(game.discardedColonies, 'and a MarsBot game always has spares — it ships all eleven base tiles')
        .is.not.empty;
      for (const discarded of game.discardedColonies) {
        expect(names, 'and the tile it took is out of the unused pool').does.not.contain(discarded.name);
      }
    });

    it('leaves the colonies sorted, exactly as the dealer left them', () => {
      const [game] = aridorGame('-ar-colony-sorted');
      const names = game.colonies.map((c) => c.name);
      expect(names).deep.eq([...names].sort());
    });

    it('an EMPTY pool is not an error — the box simply has nothing to add', () => {
      // A MarsBot game always ships the eleven base colony tiles and refuses a
      // custom colony list, so the pool is never actually empty (asserted
      // above). The guard is real code all the same — the human card's own
      // path carries the identical one — so it is exercised directly.
      const [game] = aridorGame('-ar-colony-empty');
      game.discardedColonies.length = 0;
      const colonies = game.colonies.length;
      const added = stat(game, 'aridorColonyAdded');

      AutomaCorporations.corpFor(MarsBotCorpId.C30_ARIDOR).setup?.(game);

      expect(game.colonies.length, 'nothing was left to add').eq(colonies);
      expect(stat(game, 'aridorColonyAdded'), 'and nothing was counted').eq(added);
    });

    it('the added colony survives a save/load round trip, and does not come back to the pool', () => {
      const [game] = aridorGame('-ar-colony-serialize');
      const names = game.colonies.map((c) => c.name).sort();

      const restored = Game.deserialize(structuredClone(game.serialize()));

      expect(restored.colonies.map((c) => c.name).sort()).deep.eq(names);
      expect(restored.discardedColonies.map((c) => c.name)).does.not.contain(names[0]);
    });

    it('another corporation adds none', () => {
      const [control] = aridorGame('-ar-colony-other-a', MarsBotCorpId.C01_CREDICOR);
      const [other] = aridorGame('-ar-colony-other-b', MarsBotCorpId.C14_POINT_LUNA);
      expect(other.colonies.length).eq(control.colonies.length);
    });
  });

  describe('the EFFECT — either colour, one track', () => {
    it('a WHITE cube advances the event track', () => {
      const [game] = aridorGame('-ar-white');
      const before = game.automa!.board.tracks[THARSIS_TRACK.EVENT].position;
      armCube(game, THARSIS_TRACK.BUILDING, 3);

      AutomaResolver.advanceTrack(game, THARSIS_TRACK.BUILDING);

      expect(game.automa!.board.tracks[THARSIS_TRACK.EVENT].position).is.greaterThan(before);
      expect(stat(game, 'aridorCubesHit')).eq(1);
      expect(stat(game, 'aridorSteps')).eq(1);
    });

    it('a BLACK cube does exactly the same — the card draws no distinction', () => {
      const [game] = aridorGame('-ar-black');
      const before = game.automa!.board.tracks[THARSIS_TRACK.EVENT].position;
      armCube(game, THARSIS_TRACK.EARTH, 3);

      AutomaResolver.advanceTrack(game, THARSIS_TRACK.EARTH);

      expect(game.automa!.board.tracks[THARSIS_TRACK.EVENT].position).is.greaterThan(before);
      expect(stat(game, 'aridorCubesHit')).eq(1);
    });

    it('the landed-on space keeps its own printed icon — no «instead of» is printed', () => {
      const [game] = aridorGame('-ar-also');
      const oxygen = game.getOxygenLevel();
      const greeneries = game.board.spaces.filter((s) => s.tile?.tileType === 8).length;
      armCube(game, THARSIS_TRACK.BIO, 3); // plant #3 prints a greenery.

      AutomaResolver.advanceTrack(game, THARSIS_TRACK.BIO);

      const planted = game.board.spaces.filter((s) => s.tile?.tileType === 8).length > greeneries ||
        game.getOxygenLevel() > oxygen;
      expect(planted, 'the space\'s own greenery still happened').is.true;
      expect(stat(game, 'aridorCubesHit'), 'and the cube paid on top of it').eq(1);
    });

    it('a spent cube never fires again, not even after a regression', () => {
      const [game] = aridorGame('-ar-spent');
      armCube(game, THARSIS_TRACK.BUILDING, 3);
      AutomaResolver.advanceTrack(game, THARSIS_TRACK.BUILDING);
      const hits = stat(game, 'aridorCubesHit');

      game.automa!.board.tracks[THARSIS_TRACK.BUILDING].regress();
      AutomaResolver.advanceTrack(game, THARSIS_TRACK.BUILDING);

      expect(stat(game, 'aridorCubesHit')).eq(hits);
    });

    it('another corporation reaching the same space collects nothing', () => {
      const [game] = aridorGame('-ar-eff-other', MarsBotCorpId.C01_CREDICOR);
      const before = game.automa!.board.tracks[THARSIS_TRACK.EVENT].position;
      armCube(game, THARSIS_TRACK.BUILDING, 3);

      AutomaResolver.advanceTrack(game, THARSIS_TRACK.BUILDING);

      expect(game.automa!.board.tracks[THARSIS_TRACK.EVENT].position).eq(before);
      expect(game.automa!.corpStats['aridorCubesHit']).is.undefined;
    });
  });

  describe('draft priority — «least-advanced» (RB-B Aridor)', () => {
    it('picks a card whose tag rides the least-advanced track', () => {
      // A fresh mat is all zeros, so the least-advanced is the TOPMOST —
      // the building track (the tie rule the wild tag already uses).
      const hand = cards(SPACE_CARD, BUILDING_CARD, PLANT_CARD);
      const {card} = resolver().pickCard(hand, PRIORITY);
      expect(card.name).eq(BUILDING_CARD);
    });

    it('follows the mat — the target moves when the tracks do', () => {
      const board = new MarsBotBoard(THARSIS_MARSBOT_BOARD);
      board.tracks[THARSIS_TRACK.BUILDING].position = 5;
      const hand = cards(SPACE_CARD, BUILDING_CARD, PLANT_CARD);

      const {card} = resolver(board).pickCard(hand, PRIORITY);

      expect(card.name, 'space is now the one lagging furthest behind').eq(SPACE_CARD);
    });

    it('a hand matching nothing is one big tie, decided at random', () => {
      const board = new MarsBotBoard(THARSIS_MARSBOT_BOARD);
      board.tracks[THARSIS_TRACK.BUILDING].position = 5;
      // Only the SPACE track lags least; neither card carries a space tag.
      const hand = cards(BUILDING_CARD, PLANT_CARD);

      const {tiedCount} = resolver(board).pickCard(hand, PRIORITY);

      expect(tiedCount).eq(hand.length);
    });

    it('protects a matching card from the post-draft discard', () => {
      const drafted = cards(BUILDING_CARD, SPACE_CARD, PLANT_CARD);
      const {kept, discarded} = resolver().discardAfterDraft(drafted, PRIORITY);
      expect(discarded, 'exactly one card leaves').has.length(1);
      expect(discarded[0].name, 'and it is never the one the priority protects').is.not.eq(BUILDING_CARD);
      expect(kept.map((c) => c.name)).contains(BUILDING_CARD);
    });

    it('runs through the shared AutomaCorporations.draftPick', () => {
      const [game] = aridorGame('-ar-draftpick');
      const hand = cards(SPACE_CARD, BUILDING_CARD, PLANT_CARD);

      const picked = AutomaCorporations.draftPick(game, hand);

      expect(picked.name).eq(BUILDING_CARD);
      expect(stat(game, 'draftPriorityPicks')).eq(1);
    });
  });

  describe('state', () => {
    it('the counters and the spent cube survive a save/load round trip', () => {
      const [game] = aridorGame('-ar-serialize');
      armCube(game, THARSIS_TRACK.BUILDING, 3);
      AutomaResolver.advanceTrack(game, THARSIS_TRACK.BUILDING);

      const restored = Game.deserialize(structuredClone(game.serialize()));

      expect(restored.automa!.corporation).eq(MarsBotCorpId.C30_ARIDOR);
      expect(restored.automa!.corpStats['aridorSteps']).eq(1);
      expect(AutomaCorporations.cubeModels(restored).filter((c) => c.spent)
        .map((c) => `${c.trackIndex}:${c.position}`)).deep.eq([`${THARSIS_TRACK.BUILDING}:3`]);
    });

    it('the corporation is reachable through the shared registry', () => {
      const [game] = aridorGame('-ar-registry');
      expect(AutomaCorporations.activeCorp(game)?.info.id).eq(MarsBotCorpId.C30_ARIDOR);
    });
  });
});
