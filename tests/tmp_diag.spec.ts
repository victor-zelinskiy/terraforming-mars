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

    console.log('WF_TYPE=' + (model.waitingFor && model.waitingFor.type));

    console.log('WF=' + JSON.stringify(model.waitingFor));

    console.log('PENDING=' + JSON.stringify(model.pendingInitialActions));

    console.log('GEN=' + model.game.generation + ' PHASE=' + model.game.phase);
  });
});
