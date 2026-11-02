import {expect} from 'chai';
import {BoardName} from '../../src/common/boards/BoardName';
import {SpaceBonus} from '../../src/common/boards/SpaceBonus';
import {SpaceId} from '../../src/common/Types';
import {IGame} from '../../src/server/IGame';
import {Space} from '../../src/server/boards/Space';
import {SelectColony} from '../../src/server/inputs/SelectColony';
import {SelectParty} from '../../src/server/inputs/SelectParty';
import {SelectPayment} from '../../src/server/inputs/SelectPayment';
import {Payment} from '../../src/common/inputs/Payment';
import {choiceSourceView} from '../../src/client/console/promptSource';
import {getSpecialCellInfo} from '../../src/client/components/board/specialCellInfo';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {runAllActions} from '../TestingUtils';

/**
 * A BOARD CELL THAT ASKS SPEAKS ONE LANGUAGE (the polish of 2026-11-01 — Vastitas Borealis' Viking, Terra Cimmeria's
 * MSL Curiosity). Every prompt a printed cell bonus raises names that cell — its id AND what it prints — and the
 * console's ONE source model turns it into the plate every host wears (`ConsoleSourceDock`): «ИСТОЧНИК · <the cell's
 * name> [its printed icons]». The two steps of MSL (the 5 M€ bill, the colony pick it buys) carry the SAME giver.
 */
function cellWith(game: IGame, bonus: SpaceBonus): Space {
  const space = game.board.spaces.find((s) => s.bonus.includes(bonus) && s.tile === undefined);
  expect(space, `a cell printing ${bonus}`).is.not.undefined;
  return space!;
}

describe('a board cell that asks — the server names it by its id and its printed face', () => {
  it('Viking (Vastitas Borealis Nova): the grant\'s giver is the cell, printing the delegate', () => {
    const [game, player] = testGame(2, {boardName: BoardName.VASTITAS_BOREALIS_NOVA, coloniesExtension: true, turmoilReduxExpansion: true}) as [IGame, TestPlayer];
    const viking = cellWith(game, SpaceBonus.DELEGATE);
    game.addGreenery(player, viking);
    runAllActions(game);
    const prompt = player.popWaitingFor();
    expect(prompt).instanceOf(SelectParty);
    expect(prompt!.choiceContext?.source).deep.eq({kind: 'space', space: viking.id, name: 'Placement bonus', bonus: [SpaceBonus.DELEGATE]});
  });

  it('MSL Curiosity (Terra Cimmeria Nova): the bill AND the colony pick it buys name the same cell', () => {
    const [game, player] = testGame(2, {boardName: BoardName.TERRA_CIMMERIA_NOVA, coloniesExtension: true}) as [IGame, TestPlayer];
    const msl = cellWith(game, SpaceBonus.COLONY);
    const giver = {kind: 'space', space: msl.id, name: 'Placement bonus', bonus: [...msl.bonus]};
    player.megaCredits = 20;
    player.heat = 10; // a second currency, so the 5 M€ bill is ASKED rather than paid at once
    game.addGreenery(player, msl);
    runAllActions(game);
    let prompt = player.popWaitingFor();
    if (prompt instanceof SelectPayment) {
      expect(prompt.choiceContext?.source, 'the bill names the cell').deep.eq(giver);
      prompt.process({type: 'payment', payment: Payment.of({megacredits: 5})}, player);
      runAllActions(game);
      prompt = player.popWaitingFor();
    }
    expect(prompt).instanceOf(SelectColony);
    expect(prompt!.choiceContext?.source, 'the colony pick names the cell').deep.eq(giver);
  });
});

describe('a board cell that asks — the pay-to-use bills name their cell', () => {
  it('the North Pole (the fan map and Nova alike): the 4 M€ bill names the cell, printing the temperature plate', () => {
    for (const boardName of [BoardName.VASTITAS_BOREALIS, BoardName.VASTITAS_BOREALIS_NOVA]) {
      const [game, player] = testGame(2, {boardName}, `-pole-${boardName.length}`) as [IGame, TestPlayer];
      const pole = cellWith(game, SpaceBonus.TEMPERATURE_4MC);
      player.megaCredits = 20;
      player.heat = 10; // a second currency, so the bill is ASKED rather than paid at once
      game.addGreenery(player, pole);
      runAllActions(game);
      const prompt = player.popWaitingFor();
      if (prompt instanceof SelectPayment) {
        expect(prompt.choiceContext?.source, `${boardName}: the bill names the pole`)
          .deep.eq({kind: 'space', space: pole.id, name: 'Placement bonus', bonus: [SpaceBonus.TEMPERATURE_4MC]});
      }
    }
  });

  it('Hellas\' South Pole: the 6 M€ ocean bill names the cell too', () => {
    const [game, player] = testGame(2, {boardName: BoardName.HELLAS}, '-south-pole') as [IGame, TestPlayer];
    const pole = cellWith(game, SpaceBonus.OCEAN);
    player.megaCredits = 20;
    player.heat = 10;
    game.addGreenery(player, pole);
    runAllActions(game);
    const prompt = player.popWaitingFor();
    if (prompt instanceof SelectPayment) {
      expect(prompt.choiceContext?.source).deep.eq({kind: 'space', space: pole.id, name: 'Placement bonus', bonus: [...pole.bonus]});
    }
  });
});

describe('a board cell that asks — the console\'s ONE source model', () => {
  it('a cell source carries the cell and its printed icons, and reads «Клетка поля»', () => {
    const view = choiceSourceView({kind: 'space', space: '28' as SpaceId, name: 'Placement bonus', bonus: [SpaceBonus.DELEGATE]});
    expect(view?.kindKey).eq('Board cell');
    expect(view?.cell).deep.eq({space: '28', icons: ['resource_icon--delegate']});
    expect(view?.inspectable).is.false;
  });

  it('MSL Curiosity prints the colony tile; the North Pole its own premium plate', () => {
    expect(choiceSourceView({kind: 'space', space: '16' as SpaceId, bonus: [SpaceBonus.COLONY]})?.cell?.icons).deep.eq(['resource_icon--colony-tile']);
    expect(choiceSourceView({kind: 'space', space: '33' as SpaceId, bonus: [SpaceBonus.TEMPERATURE_4MC]})?.cell?.icons).deep.eq(['resource_icon--bonus-temperature-4mc']);
  });

  it('the plate names both cells by their proper names on their own boards only', () => {
    expect(getSpecialCellInfo('59' as SpaceId, BoardName.VASTITAS_BOREALIS_NOVA)?.title).eq('Viking 1 landing site');
    expect(getSpecialCellInfo('16' as SpaceId, BoardName.TERRA_CIMMERIA_NOVA)?.title).eq('MSL Curiosity landing site');
    expect(getSpecialCellInfo('33' as SpaceId, BoardName.VASTITAS_BOREALIS)?.title, 'the fan map\'s pole').eq('North Pole');
    expect(getSpecialCellInfo('33' as SpaceId, BoardName.VASTITAS_BOREALIS_NOVA)?.title).eq('North Pole');
    expect(getSpecialCellInfo('59' as SpaceId, BoardName.THARSIS)?.title).not.eq('Viking 1 landing site');
  });
});
