import {expect} from 'chai';
import {testGame} from '../TestGame';
import {runAllActions} from '../TestingUtils';
import {Phase} from '../../src/common/Phase';
import {Server} from '../../src/server/models/ServerModel';
import {TharsisRepublic} from '../../src/server/cards/corporation/TharsisRepublic';
import {PreludesExpansion} from '../../src/server/preludes/PreludesExpansion';
import {AlliedBanks} from '../../src/server/cards/prelude/AlliedBanks';
import {Loan} from '../../src/server/cards/prelude/Loan';

describe('start-of-game prompt marker (server)', () => {
  it('marks the corp first-action OrOptions as corporationInitialAction', () => {
    const [game, player] = testGame(1);
    player.pendingInitialActions.push(new TharsisRepublic());
    game.phase = Phase.ACTION;
    player.takeAction();
    runAllActions(game);
    const model = Server.getPlayerModel(player);
    expect(model.waitingFor?.startGamePrompt).to.deep.eq({kind: 'corporationInitialAction'});
  });

  it("marks the player's starting-prelude prompt as preludeSelection/hand", () => {
    const [game, player] = testGame(1, {preludeExtension: true});
    game.phase = Phase.PRELUDES;
    player.preludeCardsInHand = [new AlliedBanks(), new Loan()];
    player.takeAction();
    runAllActions(game);
    const model = Server.getPlayerModel(player);
    expect(model.waitingFor?.startGamePrompt).to.deep.eq({kind: 'preludeSelection', preludeMode: 'hand'});
  });

  it('marks a drew-N-choose-ONE prelude prompt as preludeSelection/draw', () => {
    const [, player] = testGame(1, {preludeExtension: true});
    // Drawn preludes are NOT in the player's prelude hand (New Partner / Valley
    // Trust). selectPreludeToPlay must classify this as 'draw'.
    const drawn = [new AlliedBanks(), new Loan()];
    const input = PreludesExpansion.selectPreludeToPlay(player, drawn);
    expect(input.startGamePrompt).to.deep.eq({kind: 'preludeSelection', preludeMode: 'draw'});
  });
});
