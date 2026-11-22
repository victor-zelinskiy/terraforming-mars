import {expect} from 'chai';
import {Phase} from '../../src/common/Phase';
import {Game} from '../../src/server/Game';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {testGame} from '../TestGame';
import {cast} from '../../src/common/utils/utils';

/*
 * THE WORLD GOVERNMENT'S STEP IS A QUESTION OF ITS PHASE — a load asks it again (`Game.deserialize`).
 *
 * A save holds the Solar phase only while that step is asked. The sittings save inside it (a seat closing its sitting
 * while the first player still chooses), and a load of such a save fell through to «the action phase»: the first
 * player was asked their ordinary turn in the Solar phase, and the World Government never acted. The engine fuzz's
 * reload check — FREEZE ZERO stage 5, seed 90013.
 */
describe('a save in the Solar phase, loaded — the World Government still acts', () => {
  const WGT = 'Select action for World Government Terraforming';
  const titleOf = (input: OrOptions): string => (typeof input.title === 'string' ? input.title : input.title.message);

  it('the first player is asked the World Government\'s step again, and nobody is asked a turn', () => {
    const [game, first, second] = testGame(2, {solarPhaseOption: true});
    for (const seat of [first, second]) {
      seat.popWaitingFor();
    }
    game.phase = Phase.SOLAR;
    game.worldGovernmentTerraforming();
    expect(titleOf(cast(game.first.getWaitingFor(), OrOptions))).eq(WGT);

    const loaded = Game.deserialize(JSON.parse(JSON.stringify(game.serialize())));

    expect(loaded.phase).eq(Phase.SOLAR);
    const asked = loaded.players.filter((seat) => seat.getWaitingFor() !== undefined);
    expect(asked.map((seat) => seat.id), 'the first player alone').to.deep.eq([loaded.first.id]);
    expect(titleOf(cast(loaded.first.getWaitingFor(), OrOptions))).eq(WGT);
  });

  it('…and the step, answered on the loaded table, ends the generation as it does on a live one', () => {
    const [game, first, second] = testGame(2, {solarPhaseOption: true});
    for (const seat of [first, second]) {
      seat.popWaitingFor();
    }
    game.phase = Phase.SOLAR;
    game.worldGovernmentTerraforming();
    const loaded = Game.deserialize(JSON.parse(JSON.stringify(game.serialize())));
    const generation = loaded.generation;
    const step = cast(loaded.first.getWaitingFor(), OrOptions);
    const live = step.options.findIndex((option) => option.eligibleForDefault !== false);

    loaded.first.process({type: 'or', index: Math.max(0, live), response: {type: 'option'}});

    expect(loaded.generation, 'the next generation began').eq(generation + 1);
    expect(loaded.phase).not.eq(Phase.SOLAR);
  });
});
