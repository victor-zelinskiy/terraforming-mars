import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {Parliament} from '../../src/server/parliament/Parliament';
import {
  DEV_VENUS_STEP_RESOLUTION_ID, DEV_VENUS_STEP_REWARD, REDUX_RESOLUTION_CATALOG,
} from '../../src/server/parliament/resolutions/ResolutionCatalog';
import {GAS_EXPORT_ID} from '../../src/server/parliament/resolutions/reds/GasExport';
import {endGenerationThroughParliament, seatResolution, settleParliamentGates} from './parliamentArrange';
import {Phase} from '../../src/common/Phase';
import {resolutionInstanceId} from '../../src/common/parliament/ParliamentTypes';
import {winnerParameterStepKey} from '../../src/common/parliament/winnerReward';
import {getParliamentModel} from '../../src/server/parliament/ParliamentModel';
import {runAllActions, setVenusScaleLevel} from '../TestingUtils';
import {Resource} from '../../src/common/Resource';

/**
 * THE WINNER'S VENUS STEP ON THE ALTERNATIVE BOARD (P89 · ledger EJ) — the
 * parliament's road to the alt-board bonus. No real law steps Venus for its
 * winner yet; the family's shared executor already does, so the never-dealt
 * development card `RDX_DEV_VENUS_STEP` proves the road end to end:
 *  · the winner's step is REWARDED (the engine's own gate), so it earns the
 *    track's bonus — asked of the WINNER inside the political phase, with the
 *    raise that earned it on the marker (`venusBonusPrompt.step`);
 *  · the phase WAITS for the answer (the engine's tail of a mutating step is
 *    drained before the next seat — the 0 °C ocean's law);
 *  · the model names the bonus as the step's own ask (`pending`), so every
 *    seat reads the honest wait and the winner's client a step of its sitting;
 *  · a WORLD move (Gas Export) still earns nobody any bonus.
 */
const DEV = resolutionInstanceId(DEV_VENUS_STEP_RESOLUTION_ID, 0);

function stage(venus: number): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true, venusNextExtension: true, altVenusBoard: true});
  game.phase = Phase.ACTION;
  const parliament = game.parliament!;
  seatResolution(parliament, 0, DEV);
  parliament.placeVote(p1, parliament.slots[0], 'lobby');
  setVenusScaleLevel(game, venus);
  p1.megaCredits = 0;
  p2.megaCredits = 0;
  p1.steel = 0;
  return [game, p1, p2, parliament];
}

function stepOutcome(parliament: Parliament, player: TestPlayer) {
  return (parliament.phase?.summary?.outcomes ?? parliament.lastPhase?.outcomes ?? []).find((o) => o.player === player.id && o.step === 'venus' && o.kind !== 'reaction');
}

describe('WinnerVenusStep (the dev law RDX_DEV_VENUS_STEP)', () => {
  it('is a never-dealt Venus card whose winner part is the family\'s parameter step', () => {
    const def = REDUX_RESOLUTION_CATALOG.get(DEV_VENUS_STEP_RESOLUTION_ID);
    expect(def?.copies).eq(0);
    expect(def?.compatibility).deep.eq(['venus']);
    expect(def?.winnerReward).deep.eq({kind: 'parameter', parameter: 'venus', steps: 2});
    expect((def?.winnerSteps ?? []).map((s) => s.key)).deep.eq([winnerParameterStepKey(DEV_VENUS_STEP_REWARD)]);
    expect(REDUX_RESOLUTION_CATALOG.dealtInstances(() => true)).not.includes(DEV);
  });

  it('16 → 20 % on the alternative board: the WINNER is asked the bonus with the raise on the marker, the phase waits, the model names the ask', () => {
    const [game, p1, p2, parliament] = stage(16);
    const tr = p1.terraformRating;
    endGenerationThroughParliament(game);
    expect(game.getVenusScaleLevel()).eq(20);
    expect(stepOutcome(parliament, p1), 'the step is recorded as the winner\'s').deep.include({kind: 'globalParameter', amount: 2, tr: 2});
    expect(p1.terraformRating, 'rewarded: +1 TR per step').eq(tr + 2);
    const bonus = p1.getWaitingFor();
    expect(bonus?.venusBonusPrompt?.kind).eq('standard');
    expect(bonus?.venusBonusPrompt?.step, 'the raise that earned it rides the marker').deep.eq({from: 16, to: 20});
    // THE MODEL names the tail as the step's own ask: the other seat reads WHO is answering.
    const pending = getParliamentModel(game, p2)?.phase?.pending;
    expect(pending?.player).eq(p1.color);
    expect(pending?.key).eq('venus');
    expect(getParliamentModel(game, p1)?.phase?.pending?.player, 'the winner\'s own view names its step too').eq(p1.color);
    expect(p2.getWaitingFor()?.venusBonusPrompt, 'nobody else is asked').is.undefined;
  });

  it('the answer lets the sitting go on: the resource lands, nothing is pending, the sitting ends', () => {
    const [game, p1, p2, parliament] = stage(16);
    endGenerationThroughParliament(game);
    const bonus = p1.getWaitingFor()!;
    const count = bonus.venusBonusPrompt!.baseCount;
    expect(count, '18 % and 20 % earn one standard resource each').eq(2);
    // A standard-only bonus is a GainResources: answer it with steel × count.
    p1.process({type: 'and', responses: [{type: 'amount', amount: 0}, {type: 'amount', amount: count}, {type: 'amount', amount: 0}, {type: 'amount', amount: 0}, {type: 'amount', amount: 0}, {type: 'amount', amount: 0}]});
    runAllActions(game);
    settleParliamentGates(game);
    expect(p1.steel, 'the bonus paid its count in the resource chosen').eq(count);
    expect(getParliamentModel(game, p2)?.phase?.pending, 'nothing pending once answered').is.undefined;
    expect(parliament.phase, 'the sitting is over').is.undefined;
  });

  it('below 18 % nothing is asked: the step pays its rating and the sitting walks on', () => {
    const [game, p1, , parliament] = stage(10);
    endGenerationThroughParliament(game);
    expect(game.getVenusScaleLevel()).eq(14);
    expect(p1.getWaitingFor()?.venusBonusPrompt).is.undefined;
    expect(parliament.phase).is.undefined;
    expect(stepOutcome(parliament, p1)).deep.include({kind: 'globalParameter', amount: 2, tr: 2});
  });

  it('a WORLD move earns nobody the bonus (Gas Export — unrewarded parity)', () => {
    const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true, venusNextExtension: true, altVenusBoard: true});
    game.phase = Phase.ACTION;
    const parliament = game.parliament!;
    seatResolution(parliament, 0, resolutionInstanceId(GAS_EXPORT_ID, 0));
    parliament.placeVote(p1, parliament.slots[0], 'lobby');
    setVenusScaleLevel(game, 16);
    endGenerationThroughParliament(game);
    expect(game.getVenusScaleLevel()).eq(20);
    expect(p1.getWaitingFor()?.venusBonusPrompt).is.undefined;
    expect(p2.getWaitingFor()?.venusBonusPrompt).is.undefined;
    expect(p1.stock.get(Resource.STEEL)).eq(p1.steel);
  });
});
