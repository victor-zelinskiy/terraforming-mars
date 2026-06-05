import {testGame} from './TestGame';
import {runAllActions} from './TestingUtils';
import {Phase} from '../src/common/Phase';
import {TharsisRepublic} from '../src/server/cards/corporation/TharsisRepublic';
import {Server} from '../src/server/models/ServerModel';

describe('DIAG corp first action serialization', () => {
  it('dumps corp OrOptions model', () => {
    const [game, player] = testGame(1);
    const corp = new TharsisRepublic();
    player.pendingInitialActions.push(corp);
    game.phase = Phase.ACTION;
    player.takeAction();
    runAllActions(game);
    const model = Server.getPlayerModel(player);
    // eslint-disable-next-line no-console
    console.log('WF_TYPE=' + (model.waitingFor && model.waitingFor.type));
    // eslint-disable-next-line no-console
    console.log('WF=' + JSON.stringify(model.waitingFor));
    // eslint-disable-next-line no-console
    console.log('PENDING=' + JSON.stringify(model.pendingInitialActions));
    // eslint-disable-next-line no-console
    console.log('GEN=' + model.game.generation + ' PHASE=' + model.game.phase);
  });
});
