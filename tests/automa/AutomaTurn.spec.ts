import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {BonusCardId} from '../../src/common/automa/AutomaTypes';
import {IGame} from '../../src/server/IGame';
import {TestPlayer} from '../TestPlayer';
import {testAutomaGame} from './AutomaTestGame';

const SCIENCE = 3;

/** Research (initial) → the human's action window. */
function startActionPhase(game: IGame, human: TestPlayer) {
  game.playerIsFinishedWithResearchPhase(human);
  expect(game.phase).eq('action');
  expect(game.activePlayer.id).eq(human.id);
}

/** The human passes; the engine hands the turn to MarsBot. */
function humanPasses(game: IGame, human: TestPlayer) {
  human.popWaitingFor();
  game.playerHasPassed(human);
  game.playerIsFinishedTakingActions();
}

describe('AutomaController — MarsBot turn', () => {
  it('reveals a project card, resolves its tags, moves it to the played pile', () => {
    const [game, human] = testAutomaGame();
    const automa = game.automa!;
    startActionPhase(game, human);

    // One known card: Gene Repair = a single science tag.
    // Science 0→1 ('advance') → cascades to 2.
    automa.actionDeck = [{kind: 'project', name: CardName.GENE_REPAIR}];
    humanPasses(game, human);

    // Bot turn 1: revealed + resolved Gene Repair. Bot turn 2: empty deck → passed.
    // Everyone passed → production (skipped for the bot) → generation 2 research.
    expect(automa.board.tracks[SCIENCE].position).eq(2);
    expect(automa.playedPile).deep.eq([CardName.GENE_REPAIR]);
    expect(automa.revealedCard).is.undefined;
    expect(game.generation).eq(2);
    expect(game.phase).eq('research');
    // The reveal is journaled.
    expect(game.gameLog.some((m) => m.message.includes('revealed'))).is.true;
  });

  it('a revealed bonus card resolves and routes to the right pile', () => {
    const [game, human] = testAutomaGame();
    const automa = game.automa!;
    startActionPhase(game, human);
    human.plants = 5;
    automa.actionDeck = [{kind: 'bonus', id: BonusCardId.B01_METEOR_SHOWER}];
    humanPasses(game, human);

    expect(human.plants).eq(0);
    expect(automa.destroyedBonusCards).contains(BonusCardId.B01_METEOR_SHOWER);
    expect(automa.revealedCard).is.undefined;
    expect(game.gameLog.some((m) => m.message.includes('revealed a bonus card'))).is.true;
  });

  it('alternates: human acts, bot resolves exactly one card, human acts again', () => {
    const [game, human] = testAutomaGame();
    const automa = game.automa!;
    startActionPhase(game, human);
    automa.actionDeck = [
      {kind: 'project', name: CardName.GENE_REPAIR},
      {kind: 'project', name: CardName.GENE_REPAIR},
    ];

    // The human ends their turn WITHOUT passing (2 actions taken → next player).
    human.popWaitingFor();
    game.playerIsFinishedTakingActions();

    // The bot resolved exactly ONE card and the turn came back to the human.
    expect(automa.playedPile).has.length(1);
    expect(automa.actionDeck).has.length(1);
    expect(game.activePlayer.id).eq(human.id);
    expect(human.getWaitingFor()).is.not.undefined;
  });
});
