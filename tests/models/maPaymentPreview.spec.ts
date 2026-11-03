import {expect} from 'chai';
import {IGame} from '../../src/server/IGame';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {runAllActions} from '../TestingUtils';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {SelectPayment} from '../../src/server/inputs/SelectPayment';
import {cast} from '../../src/common/utils/utils';
import {Server} from '../../src/server/models/ServerModel';
import {Helion} from '../../src/server/cards/corporation/Helion';
import {replayBatch, parkedBatchTailLength} from '../../src/server/inputs/deferredInputBatch';
import {InputResponse} from '../../src/common/inputs/InputResponse';
import {Payment} from '../../src/common/inputs/Payment';
import {promptAddressOf} from '../../src/common/inputs/preselectAddress';

/*
 * PL-1622 — THE BILL A CLAIM / A FUNDING WILL ASK, published before the press (`maCosts.payments`) by the ONE builder the
 * live claim defers (`Player.milestonePayment` / `awardPayment`), its `choiceContext` naming the claim — so the console
 * stands «› ОПЛАТА» inside the detail stage and answers the claim AND its bill in ONE addressed batch.
 */
describe('Milestones / awards · the bill the claim will ask (PL-1622)', () => {
  let game: IGame;
  let player: TestPlayer;

  beforeEach(() => {
    [game, player] = testGame(2);
    player.setTerraformRating(35); // Terraformer29 can be claimed
  });

  function helion(heat: number, mc: number): void {
    player.playCorporationCard(new Helion());
    player.heat = heat;
    player.megaCredits = mc;
  }

  it('a player who can only pay in M€ is published NO bill (it is paid silently)', () => {
    player.megaCredits = 30;
    const model = Server.getPlayerModel(player);
    expect(model.maCosts?.payments).is.undefined;
  });

  it('Helion with heat: every open milestone and award publishes its bill — the claim\'s price, heat open, the claim named', () => {
    helion(10, 30);
    const payments = Server.getPlayerModel(player).maCosts?.payments ?? {};
    const terraformer = payments['Terraformer29'] ?? payments[Object.keys(payments).find((k) => k.startsWith('Terraformer')) ?? ''];
    expect(terraformer, JSON.stringify(Object.keys(payments))).is.not.undefined;
    expect(terraformer.amount).eq(8);
    expect(terraformer.paymentOptions.heat).is.true;
    expect(promptAddressOf(terraformer as never)).deep.include({role: 'payment'});
    expect(promptAddressOf(terraformer as never).source).deep.include({kind: 'system'});
    const award = game.awards[0].name;
    expect(payments[award]?.amount).eq(8);
  });

  it('ONE batch: the claim and its ADDRESSED bill — paid in heat, nothing asked, the milestone claimed', () => {
    helion(10, 3);
    const name = Object.keys(Server.getPlayerModel(player).maCosts?.payments ?? {}).find((k) => k.startsWith('Terraformer'))!;
    const bill = Server.getPlayerModel(player).maCosts!.payments![name];
    player.takeAction();
    runAllActions(game);
    const actions = cast(player.getWaitingFor(), OrOptions);
    const claimIdx = actions.options.findIndex((o) => o.title === 'Claim a milestone');
    const claims = cast(actions.options[claimIdx], OrOptions);
    const inner = claims.options.findIndex((o) => o.title === name);
    replayBatch(player, [
      {type: 'or', index: claimIdx, response: {type: 'or', index: inner, response: {type: 'option'}}},
      {type: 'payment', payment: Payment.of({heat: 5, megacredits: 3}), for: promptAddressOf(bill as never)},
    ] as Array<InputResponse>);
    runAllActions(game);
    expect(parkedBatchTailLength(player)).eq(0);
    // The bill was answered by the batch — what stands now is the turn's next action, never the payment.
    expect(player.getWaitingFor()).not.instanceOf(SelectPayment);
    expect(game.claimedMilestones.some((c) => c.milestone.name === name && c.player === player)).is.true;
    expect(player.heat).eq(5);
    expect(player.megaCredits).eq(0);
  });

  it('the live claim still asks the same bill when nothing was pre-collected', () => {
    helion(10, 30);
    const actions = cast(player.getActions(), OrOptions);
    const claims = cast(actions.options.find((o) => o.title === 'Claim a milestone'), OrOptions);
    claims.options[0].cb();
    runAllActions(game);
    const pay = cast(player.popWaitingFor(), SelectPayment);
    expect(pay.amount).eq(8);
    expect(pay.choiceContext?.source.kind).eq('system');
  });
});
