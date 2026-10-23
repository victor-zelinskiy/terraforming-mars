import {expect} from 'chai';
import {testGame} from '../TestGame';
import {boardCellPreview} from '../../src/server/boards/BoardInformationEngine';
import {Herbivores} from '../../src/server/cards/base/Herbivores';
import {Pets} from '../../src/server/cards/base/Pets';
import {RoverConstruction} from '../../src/server/cards/base/RoverConstruction';
import {CardName} from '../../src/common/cards/CardName';
import {TestPlayer} from '../TestPlayer';

/**
 * THE TABLE ANSWERS THE TILE (T15 · CD): a fact of one of the PLACER's own cards' `tilePlacedPreview` is the table's
 * answer — marked `tableAnswer`, read by the dossier as «Сработает», never mixed into what the CELL gives. Another
 * seat's card answering is that seat's recipient fact, never a table answer of the placer's.
 */
describe('placement preview — the placer\'s own table answers the tile (T15 · CD)', () => {
  function greeneryCell(player: TestPlayer) {
    return player.game.board.getAvailableSpacesForGreenery(player)[0];
  }

  it('Herbivores on the placer\'s table: its animal for a greenery is a TABLE ANSWER, addressed to the placer', () => {
    const [, p1] = testGame(2);
    p1.playedCards.push(new Herbivores());
    const preview = boardCellPreview(p1, greeneryCell(p1), 'greenery', {sourceCard: CardName.WILDLIFE_DOME});
    const answers = [...preview.immediateFacts, ...preview.ruleFacts].filter((f) => f.tableAnswer === true);
    expect(answers.length, JSON.stringify(preview.immediateFacts)).greaterThan(0);
    const herbivores = answers.find((f) => f.delta?.icon === 'animal');
    expect(herbivores, JSON.stringify(answers)).is.not.undefined;
    expect(herbivores!.recipient.kind).eq('current-player');
    expect(preview.immediateFacts.filter((f) => f.tableAnswer !== true).some((f) => f.delta?.icon === 'animal'),
      'the cell itself gives no animal').is.false;
  });

  it('Pets and Rover Construction answer a CITY — both are table answers of the placer', () => {
    const [, p1] = testGame(2);
    p1.playedCards.push(new Pets(), new RoverConstruction());
    const space = p1.game.board.getAvailableSpacesForCity(p1)[0];
    const preview = boardCellPreview(p1, space, 'city');
    const answers = [...preview.immediateFacts, ...preview.ruleFacts].filter((f) => f.tableAnswer === true);
    expect(answers.some((f) => f.delta?.icon === 'animal'), JSON.stringify(answers)).is.true;
    expect(answers.some((f) => f.delta?.icon === 'megacredits'), JSON.stringify(answers)).is.true;
  });

  it('ANOTHER seat\'s card answering the placer\'s tile is that seat\'s fact — never the placer\'s table answer', () => {
    const [, p1, p2] = testGame(2);
    p2.playedCards.push(new Pets());
    const space = p1.game.board.getAvailableSpacesForCity(p1)[0];
    const preview = boardCellPreview(p1, space, 'city');
    const all = [...preview.immediateFacts, ...preview.ruleFacts, ...preview.recipientFacts];
    const theirs = all.filter((f) => f.id.startsWith(`${p2.color}-`));
    expect(theirs.length, JSON.stringify(all)).greaterThan(0);
    expect(theirs.every((f) => f.tableAnswer !== true)).is.true;
    expect(preview.recipientFacts.some((f) => f.id.startsWith(`${p2.color}-`)), 'it lands with the other players').is.true;
  });

  it('the preview stays read-only', () => {
    const [game, p1] = testGame(2);
    p1.playedCards.push(new Herbivores());
    const before = JSON.stringify(game.serialize());
    boardCellPreview(p1, greeneryCell(p1), 'greenery');
    expect(JSON.stringify(game.serialize())).eq(before);
  });
});
