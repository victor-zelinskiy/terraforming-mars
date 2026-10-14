import {expect} from 'chai';
import {testGame} from '../TestGame';
import {runAllActions, setOxygenLevel, setTemperature} from '../TestingUtils';
import {MAX_OXYGEN_LEVEL, MAX_TEMPERATURE} from '../../src/common/constants';
import {Server} from '../../src/server/models/ServerModel';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {Phase} from '../../src/common/Phase';
import {cast} from '../../src/common/utils/utils';

/*
 * THE FINAL GREENERY PHASE IS A FACT OF THE SERVER (PL-302). The console's finale context lives through the whole
 * phase — including while another seat answers a triggered pick — and the status strip names every seat's place in
 * it. Both read the model: `game.finalGreenery` (present exactly while the phase stands, `done` = the seats that
 * finished) and `waitingForKind: 'finalgreenery'` on the seat being asked (its structural marker, never a title).
 */
describe('finalGreenery phase model', () => {
  it('absent before the loop; present with the asked seat marked and nobody done once it is entered', () => {
    const [game, first, second] = testGame(2);
    setTemperature(game, MAX_TEMPERATURE);
    setOxygenLevel(game, MAX_OXYGEN_LEVEL);
    first.plants = 16;
    second.plants = 8;
    runAllActions(game);

    expect(Server.getPlayerModel(first).game.finalGreenery, 'no finale before the loop').is.undefined;

    game.takeNextFinalGreeneryAction();
    const model = Server.getPlayerModel(second);
    expect(model.game.finalGreenery, 'the phase stands').to.deep.eq({done: []});
    const firstSeat = model.players.find((p) => p.color === first.color)!;
    const secondSeat = model.players.find((p) => p.color === second.color)!;
    expect(firstSeat.waitingForKind, 'the asked seat carries the kind').to.eq('finalgreenery');
    expect(firstSeat.isWaitingForInput).to.be.true;
    expect(secondSeat.waitingForKind, 'a seat waiting for its turn carries none').to.be.undefined;
  });

  it('a seat that stops is DONE; the phase leaves the model with the END', () => {
    const [game, first, second] = testGame(2);
    setTemperature(game, MAX_TEMPERATURE);
    setOxygenLevel(game, MAX_OXYGEN_LEVEL);
    first.plants = 16;
    second.plants = 8;
    runAllActions(game);
    game.takeNextFinalGreeneryAction();

    cast(first.getWaitingFor(), OrOptions).options[1].cb(); // «I am done»
    const afterFirst = Server.getPlayerModel(first).game;
    expect(afterFirst.finalGreenery?.done, 'the first seat is done, the second is being asked').to.deep.eq([first.color]);
    expect(Server.getPlayerModel(first).players.find((p) => p.color === second.color)?.waitingForKind).to.eq('finalgreenery');

    cast(second.getWaitingFor(), OrOptions).options[1].cb();
    expect(game.phase).to.eq(Phase.END);
    expect(Server.getPlayerModel(first).game.finalGreenery, 'gone with the END').is.undefined;
  });
});
