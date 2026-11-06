import {expect} from 'chai';
import {readFileSync} from 'node:fs';
import {BoardName} from '../../src/common/boards/BoardName';
import {isBoardInPremiumScope} from '../../src/common/boards/boardPremiumScope';
import {SpaceBonus} from '../../src/common/boards/SpaceBonus';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {cellBonusIcons} from '../../src/client/console/revealStageHead';
import {placementBonuses} from '../../src/client/console/tilePlacement/tilePlacementModel';
import {testGame} from '../TestGame';

/**
 * EVERY PRINTED BONUS OF EVERY BOARD HAS A FACE AND A STORY — the audit of 2026-11-05 («карты РЕАЛЬНО в премиум
 * скоупе, а не только на словах»).
 *
 * A map is adapted cell by cell, and three hand-written tables decide what the player SEES of a printed bonus:
 *  · the board's own sprite (`Bonus.vue` → `board.less` `.board-space-bonus--*`),
 *  · the cell's FACE off the board — its portrait in the dossier and the source plate of a pick the cell caused
 *    (`cellBonusIcons`, `revealStageHead.ts`),
 *  · what the landing PLAYS — a token of the printed beat (`placementBonuses`) or a scene of its own.
 * A new map brought kinds no table knew: Amazonis Planitia's ANIMAL cells and Arabia Terra's ENERGY-PRODUCTION cove
 * had no portrait icon (the portrait stood empty), and the cove's production ticked on the rail with no token. This
 * spec walks the boards the game can deal and fails with the kind and the map.
 */
describe('a printed cell bonus has a face and a story on every board', () => {
  /** Every kind printed anywhere on a board (Colonies on — Terra Cimmeria Nova prints its colony cell only then). */
  function printedKinds(boardName: BoardName): Set<SpaceBonus> {
    const [game] = testGame(1, {boardName, coloniesExtension: true});
    const kinds = new Set<SpaceBonus>();
    for (const space of game.board.spaces) {
      if (space.spaceType !== SpaceType.COLONY) {
        space.bonus.forEach((b) => kinds.add(b));
      }
    }
    return kinds;
  }

  /**
   * Kinds with NO icon of their own in the portrait, each with its reason. A row that is no longer needed fails the
   * last test below.
   */
  const NO_FACE: ReadonlyMap<SpaceBonus, string> = new Map([
    [SpaceBonus.OCEAN, 'Hellas\' South Pole — a pay-to-use offer, named by its marker and its dossier row, not a resource'],
  ]);

  /**
   * How a printed kind is TOLD at the landing, when it is not a token of the printed beat: the scene that owns it.
   */
  const OWN_SCENE: ReadonlyMap<SpaceBonus, string> = new Map([
    [SpaceBonus.DRAW_CARD, 'the card bonus cinematic (ConsoleBoardCardBonusLayer)'],
    [SpaceBonus.OCEAN, 'a pay-to-use offer: the payment, then the ocean\'s own placement'],
    [SpaceBonus.TEMPERATURE_4MC, 'a pay-to-use offer: the payment, then the scale\'s story'],
    [SpaceBonus.DELEGATE, 'the Parliament\'s grant step'],
    [SpaceBonus.COLONY, 'a pay-to-use offer: the payment, then the colony pick'],
    [SpaceBonus.MICROBE, 'the board pays a card (`space-bonus`)'],
    [SpaceBonus.ANIMAL, 'the board pays a card (`space-bonus`)'],
    [SpaceBonus.DATA, 'the board pays a card (`space-bonus`)'],
    [SpaceBonus.SCIENCE, 'the board pays a card (`space-bonus`)'],
    [SpaceBonus.ASTEROID, 'the board pays a card (`space-bonus`)'],
  ]);

  // A board outside the premium scope (Amazonis Planitia's standard-resource cell) gets its faces with its full adaptation.
  const boards = Object.values(BoardName).filter(isBoardInPremiumScope);
  const seen = new Set<SpaceBonus>();

  for (const boardName of boards) {
    it(`${boardName}: every printed kind has a portrait icon, a board sprite and a landing story`, () => {
      const bonusVue = readFileSync('src/client/components/Bonus.vue', 'utf8');
      const boardLess = readFileSync('src/styles/board.less', 'utf8');
      for (const kind of printedKinds(boardName)) {
        seen.add(kind);
        const name = SpaceBonus[kind];
        // 1. The portrait / source-plate face.
        if (!NO_FACE.has(kind)) {
          expect(cellBonusIcons([kind]), `${name}: no icon in the cell's portrait (revealStageHead BONUS_ICON)`).to.have.length(1);
        }
        // 2. The board's own sprite: Bonus.vue names a css suffix for the kind, and board.less paints it.
        const suffix = new RegExp(`\\[SpaceBonus\\.${name}\\]: '([a-z0-9-]+)'`).exec(bonusVue)?.[1];
        expect(suffix, `${name}: Bonus.vue names no sprite`).to.not.be.undefined;
        expect(boardLess, `${name}: board.less paints no .board-space-bonus--${suffix}`).to.include(`.board-space-bonus--${suffix}`);
        // 3. The landing: a token of the printed beat, or a scene that owns the kind — never a silent counter.
        const flown = placementBonuses([kind]).length === 1;
        expect(flown || OWN_SCENE.has(kind), `${name}: the landing neither flies it nor hands it to a scene of its own`).is.true;
        expect(flown && OWN_SCENE.has(kind), `${name}: told twice — a token AND a scene`).is.false;
      }
    });
  }

  it('no board sprite is a legacy Pathfinders raster (the energy-production cove was the last)', () => {
    const boardLess = readFileSync('src/styles/board.less', 'utf8');
    const rules = boardLess.match(/\.board-space-bonus--[a-z0-9-]+\s*\{[^}]*\}/g) ?? [];
    expect(rules.length).to.be.greaterThan(8);
    expect(rules.filter((r) => /assets\/pathfinders\//.test(r)).map((r) => r.slice(0, r.indexOf('{')).trim())).deep.eq([]);
  });

  it('the allow-lists hold only kinds a board really prints', () => {
    // (Runs after the per-board walk: `seen` is every kind the eleven boards print.)
    for (const kind of NO_FACE.keys()) {
      expect(seen.has(kind), `NO_FACE: ${SpaceBonus[kind]} is printed nowhere`).is.true;
    }
  });
});
