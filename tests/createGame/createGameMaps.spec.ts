import {expect} from 'chai';
import {readFileSync} from 'node:fs';
import {PREMIUM_MAPS} from '../../src/client/components/create/premium/createGameMeta';
import {AUTOMA_SUPPORTED_BOARDS} from '../../src/common/automa/automaCompatibility';
import {BoardName} from '../../src/common/boards/BoardName';
import {RandomBoardOption} from '../../src/common/boards/RandomBoardOption';
import {boardOptions} from '../../src/server/boards/randomBoard';

/**
 * THE CREATOR'S MAP CATALOG AGAINST WHAT THE GAME CAN DEAL.
 *
 * Arabia Terra shipped fully adapted — its MarsBot mat, its premium cells, a place in «random (all)» — and could not
 * be PICKED: `PREMIUM_MAPS` is a hand-written list, and nothing tied it to the pool or to the bot's registry
 * (2026-11-05). A board the pool rolls or the bot plays is a board the player may choose by name.
 */
describe('the creator\'s map catalog', () => {
  const offered = PREMIUM_MAPS.filter((m) => !m.random).map((m) => m.id as BoardName);

  it('offers every board «random (all)» can roll — for a human game and for a MarsBot game', () => {
    for (const pool of [boardOptions(RandomBoardOption.ALL), boardOptions(RandomBoardOption.ALL, {automa: true})]) {
      expect(pool.filter((board) => !offered.includes(board)), 'rolled but not selectable').deep.eq([]);
    }
  });

  it('offers every board MarsBot plays', () => {
    expect(AUTOMA_SUPPORTED_BOARDS.filter((board) => !offered.includes(board)), 'adapted for the bot but not selectable').deep.eq([]);
  });

  it('names every tile: a label and a description with a RU translation, one tile per board', () => {
    const ru = JSON.parse(readFileSync('src/locales/ru/create_game.json', 'utf8')) as Record<string, unknown>;
    const flat = new Map<string, string>();
    const walk = (node: unknown) => {
      for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
        if (typeof value === 'string') {
          flat.set(key, value);
        } else if (value !== null && typeof value === 'object') {
          walk(value);
        }
      }
    };
    walk(ru);
    for (const meta of PREMIUM_MAPS) {
      expect(flat.get(meta.labelKey), `${meta.id}: label`).is.a('string').and.not.empty;
      expect(flat.get(meta.descKey), `${meta.id}: description`).is.a('string').and.not.empty;
    }
    expect(new Set(offered).size, 'one tile per board').eq(offered.length);
  });

  it('marks exactly the fan boards as fan — the seven official maps wear no chip', () => {
    const official: ReadonlyArray<BoardName> = [
      BoardName.THARSIS, BoardName.HELLAS, BoardName.ELYSIUM, BoardName.UTOPIA_PLANITIA,
      BoardName.TERRA_CIMMERIA_NOVA, BoardName.VASTITAS_BOREALIS_NOVA, BoardName.AMAZONIS_PLANITIA,
    ];
    for (const meta of PREMIUM_MAPS.filter((m) => !m.random)) {
      expect(meta.fan === true, `${meta.id}`).eq(!official.includes(meta.id as BoardName));
    }
  });
});
