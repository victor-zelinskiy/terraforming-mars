import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {DELTA_TRACK_TAGS, DeltaProjectExpansion} from '../../src/server/delta/DeltaProjectExpansion';
import {TitanFloatingLaunchPad} from '../../src/server/cards/colonies/TitanFloatingLaunchPad';
import {MarsNomads} from '../../src/server/cards/promo/MarsNomads';
import {testGame} from '../TestGame';
import {fakeCard, runAllActions} from '../TestingUtils';
import {cast} from '../../src/common/utils/utils';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {SelectColony} from '../../src/server/inputs/SelectColony';
import {SelectSpace} from '../../src/server/inputs/SelectSpace';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {drainBatchTail} from '../../src/server/inputs/deferredInputBatch';

/**
 * A REPEAT PLAN ANSWERS WHAT IT CAN AND DEFERS THE REST.
 *
 * A stage-7 «reuse a used blue card action» reward is PRE-SELECTED on the
 * Hydronetwork summary, generations before the action runs. Some branches ask
 * for something that does not exist yet: «Летающая платформа» spends a floater
 * to TRADE (which colony?), «Кочевники Марса» move their token (which space?).
 * Neither can be answered at plan time — there is no live trade prompt, and no
 * placement is open.
 *
 * The server already models this: `repeatResponses` is a PARKED TAIL, drained
 * against whatever the copied action asks, and anything the plan did not answer
 * simply surfaces as its own prompt. So the composer's job is to stop at the
 * BRANCH — which is what these specs pin, on the exact wire it emits.
 *
 * (The client half — the composer no longer refusing its own confirm over a
 * trade prompt that cannot exist — is
 * `tests/client/components/console/composerRuntimeNavigation.spec.ts`.)
 */
describe('a repeat plan defers its runtime-navigation step', () => {
  let game: IGame;
  let player: TestPlayer;

  beforeEach(() => {
    [game, player] = testGame(2, {coloniesExtension: true, deltaProjectExpansion: true});
  });

  /** Stand the marker on `position` with every tag the track demands. */
  function reachStage(position: number): void {
    player.playedCards.push(fakeCard({tags: DELTA_TRACK_TAGS.filter((t) => t !== undefined)}));
    player.deltaProjectData!.position = position;
  }

  it('«Летающая платформа»: the branch is planned, the COLONY is asked for at the repeat', () => {
    const pad = new TitanFloatingLaunchPad();
    pad.resourceCount = 1;
    player.playedCards.push(pad);
    player.actionsThisGeneration.add(pad.name);
    reachStage(6);
    player.energy = 1;

    // EXACTLY what the fixed composer emits for the trade branch: the card, the
    // branch, and nothing else. `{type:'or', index:0, response:{type:'option'}}`
    // is `buildActionBatch`'s branch slot with an empty prefix and no steps
    // (branch 0 of this card's own `OrOptions` is «отдать аэростат ради
    // бесплатной торговли»; branch 1 puts a floater on a Jovian card).
    DeltaProjectExpansion.advance(player, 1, undefined, {
      answers: [{
        position: 7,
        selectedCard: pad.name,
        repeatResponses: [{type: 'or', index: 0, response: {type: 'option'}}],
      }],
    });
    runAllActions(game);
    // The route drains the parked tail against whatever the copy is asking —
    // the same call `routes/PlayerInput` makes after every submit.
    drainBatchTail(player);
    runAllActions(game);

    // The branch was consumed by the parked tail; what STANDS is the colony
    // pick — an honest follow-up of the copy, attributed to the copied card.
    const colony = cast(player.getWaitingFor(), SelectColony);
    expect(colony.copiedActionSource, 'the copy owns it').to.eq(pad.name);
    expect(colony.colonies.length, 'and it offers real colonies').to.be.greaterThan(0);
    // The floater is NOT spent by the plan — the trade's own confirm spends it.
    expect(pad.resourceCount, 'nothing is charged before the colony answers').to.eq(1);
  });

  it('«Кочевники Марса»: the branch is planned, the SPACE is asked for at the repeat', () => {
    const nomads = new MarsNomads();
    player.playedCards.push(nomads);
    player.actionsThisGeneration.add(nomads.name);
    // The camp is already seated (its PLAY does that); the ACTION moves it, and
    // the move's destination is the thing no plan can know.
    game.nomadSpace = game.board.getNonReservedLandSpaces()[0].id;
    reachStage(6);
    player.energy = 1;

    DeltaProjectExpansion.advance(player, 1, undefined, {
      answers: [{position: 7, selectedCard: nomads.name}],
    });
    runAllActions(game);

    const space = cast(player.getWaitingFor(), SelectSpace);
    expect(space.copiedActionSource, 'the copy owns the placement').to.eq(nomads.name);
    expect(space.spaces.length, 'and it offers real destinations').to.be.greaterThan(0);
  });

  it('a plan that answers NOTHING still reaches the branch prompt', () => {
    // The degenerate case the composer also produces (no branch chosen, e.g. a
    // single-branch action): the card is consumed, the action runs, and its own
    // first question is the follow-up.
    const pad = new TitanFloatingLaunchPad();
    pad.resourceCount = 1;
    player.playedCards.push(pad);
    player.actionsThisGeneration.add(pad.name);
    reachStage(6);
    player.energy = 1;

    DeltaProjectExpansion.advance(player, 1, undefined, {
      answers: [{position: 7, selectedCard: pad.name}],
    });
    runAllActions(game);

    const branches = cast(player.getWaitingFor(), OrOptions);
    expect(branches.copiedActionSource).to.eq(CardName.TITAN_FLOATING_LAUNCHPAD);
    expect(branches.options.length, 'both branches offered').to.eq(2);
  });
});
