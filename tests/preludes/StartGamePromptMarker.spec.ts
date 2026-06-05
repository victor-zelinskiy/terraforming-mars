import {expect} from 'chai';
import {testGame} from '../TestGame';
import {runAllActions} from '../TestingUtils';
import {Phase} from '../../src/common/Phase';
import {Server} from '../../src/server/models/ServerModel';
import {TharsisRepublic} from '../../src/server/cards/corporation/TharsisRepublic';
import {PreludesExpansion} from '../../src/server/preludes/PreludesExpansion';
import {AlliedBanks} from '../../src/server/cards/prelude/AlliedBanks';
import {Loan} from '../../src/server/cards/prelude/Loan';
import {Merger} from '../../src/server/cards/promo/Merger';
import {SaturnSystems} from '../../src/server/cards/corporation/SaturnSystems';
import {TharsisRepublic as TharsisRepublic2} from '../../src/server/cards/corporation/TharsisRepublic';
import {Teractor} from '../../src/server/cards/corporation/Teractor';
import {Helion} from '../../src/server/cards/corporation/Helion';
import {BeginnerCorporation} from '../../src/server/cards/corporation/BeginnerCorporation';

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

  it('marks a Double Down copy-source prompt as preludeSelection/copy', () => {
    const [, player] = testGame(1, {preludeExtension: true});
    // Double Down passes already-played preludes via cardAction 'double-down'.
    // The mode MUST be 'copy' (not 'draw') so the modal keeps the source in the
    // grid — `cardAction` is the discriminator, never the cards.
    const played = [new AlliedBanks(), new Loan()];
    const input = PreludesExpansion.selectPreludeToPlay(player, played, undefined, 'double-down');
    expect(input.startGamePrompt).to.deep.eq({kind: 'preludeSelection', preludeMode: 'copy'});
  });

  it('marks the Merger corp-selection SelectCard as corporationSelection', () => {
    const [game, player] = testGame(1, {preludeExtension: true});
    game.corporationDeck.drawPile = [new SaturnSystems(), new TharsisRepublic2(), new Teractor(), new Helion()];
    player.playedCards.push(new BeginnerCorporation()); // vestigial corp
    player.megaCredits = 60; // enough for the 42 M€ cost
    new Merger().play(player);
    runAllActions(game);
    const input = player.popWaitingFor();
    expect(input?.startGamePrompt).to.deep.eq({kind: 'corporationSelection'});
  });
});
