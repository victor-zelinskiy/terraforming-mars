import {expect} from 'chai';
import {testGame} from '../TestGame';
import {setOxygenLevel, setTemperature} from '../TestingUtils';
import {cast} from '../../src/common/utils/utils';
import {MAX_OXYGEN_LEVEL, MAX_TEMPERATURE} from '../../src/common/constants';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {Server} from '../../src/server/models/ServerModel';

/*
 * THE FINAL-GREENERY MARKER IS THE CONTRACT.
 *
 * Structurally this prompt is an ordinary two-branch `OrOptions`, and one of
 * those branches ENDS THE PLAYER'S GAME (`playerIsDoneWithGame`) while their
 * leftover plants are still worth victory points. The console renders it as a
 * dedicated finale screen where that branch is destructive and two-step — and
 * it may NOT recognise the prompt from its title ("Place any final greenery
 * from plants"), because i18n rewrites `Message.message` in place and an
 * English match dies after the first render.
 *
 * So the marker must be there, and it must survive serialization.
 */
describe('finalGreeneryPrompt marker', () => {
  /** Drive a 2-player game to the point where the greenery phase asks. */
  function finalGreeneryPrompt() {
    const [game, player, other] = testGame(2);
    setTemperature(game, MAX_TEMPERATURE);
    setOxygenLevel(game, MAX_OXYGEN_LEVEL);
    // Only ONE player can afford a greenery, so the phase asks exactly them.
    player.plants = 8;
    other.plants = 0;

    game.takeNextFinalGreeneryAction();
    return {game, player, prompt: cast(player.popWaitingFor(), OrOptions)};
  }

  it('the endgame conversion prompt is marked, with the board fact only the server knows', () => {
    const {game, player, prompt} = finalGreeneryPrompt();

    expect(prompt.finalGreeneryPrompt).is.not.undefined;
    expect(prompt.finalGreeneryPrompt?.spaces)
      .eq(game.board.getAvailableSpacesForGreenery(player).length)
      .and.greaterThan(0);
  });

  it('survives serialization — the CLIENT is what has to see it', () => {
    const {player, prompt} = finalGreeneryPrompt();

    const model = Server.getWaitingFor(player, prompt);
    expect(model?.type).eq('or');
    expect(model?.finalGreeneryPrompt).deep.eq(prompt.finalGreeneryPrompt);
    // The two branches stay tellable apart by TYPE, which is how the client
    // decides which one places and which one ends the game.
    const options = model?.type === 'or' ? model.options : [];
    expect(options.map((o) => o.type)).deep.eq(['space', 'option']);
  });

  it('an ordinary mid-game choice carries no such marker', () => {
    // Guard against the marker leaking onto every OrOptions: only the finale
    // beat gets the destructive screen.
    const [/* game */, player] = testGame(2);
    const plain = new OrOptions().setTitle('Select an action');
    expect(plain.finalGreeneryPrompt).is.undefined;
    expect(Server.getWaitingFor(player, plain)?.finalGreeneryPrompt).is.undefined;
  });
});
