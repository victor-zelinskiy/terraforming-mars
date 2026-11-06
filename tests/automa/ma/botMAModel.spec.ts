import {expect} from 'chai';
import {Server} from '../../../src/server/models/ServerModel';
import {AutomaMilestonesAwards} from '../../../src/server/automa/AutomaMilestonesAwards';
import {testAutomaRandomSetGame} from './matTestGame';
import {testAutomaGame} from '../AutomaTestGame';

/**
 * WHAT THE CLIENT RECEIVES (stage 6 of the framework): the bot's generated rule line for every milestone / award of the
 * game, the threshold MARKS of its single-track milestones on its tracks (decision R6), its tokens, and — for a random
 * set — the briefing. Generated on the server; the client renders and re-derives nothing.
 */
describe('the bot model — rules, thresholds, tokens, briefing', () => {
  it('a fixed-row game: a rule line per milestone and award, the marks of its track milestones, no briefing', () => {
    const [game] = testAutomaGame({}, '-model-fixed');
    const model = Server.getGameModel(game).automa!;
    expect(model.maRules!.filter((l) => l.kind === 'milestone').map((l) => l.name)).deep.eq(game.milestones.map((m) => m.name));
    expect(model.maRules!.filter((l) => l.kind === 'award').map((l) => l.name)).deep.eq(game.awards.map((a) => a.name));
    const award = model.maRules!.find((l) => l.kind === 'award' && l.name === 'Thermalist')!;
    expect(award.kind === 'award' && award.helper.message).eq('advances ${0}');
    // Tharsis: Builder reads the building-tag track — space 8.
    expect(model.thresholds).deep.eq([{trackIndex: 0, cell: 8, milestone: 'Builder'}]);
    expect(model.briefing, 'a fixed row plays its printed board').is.undefined;
    expect(model.tokens, 'no token cell on a printed board').is.undefined;
  });

  it('a claimed milestone loses its mark', () => {
    const [game, , bot] = testAutomaGame({}, '-model-claimed');
    game.automa!.board.tracks[0].position = 8;
    game.milestones.splice(0, game.milestones.length, game.milestones.find((m) => m.name === 'Builder')!);
    expect(AutomaMilestonesAwards.tryClaimMilestone(game)).is.true;
    expect(game.claimedMilestones[0].player).eq(bot);
    expect(Server.getGameModel(game).automa!.thresholds).is.undefined;
  });

  it('a random-set game: the briefing names what the set changed; the token count rides the model', () => {
    const [game] = testAutomaRandomSetGame({milestones: ['Energizer', 'Rim Settler', 'Dataminer', 'Polar Explorer', 'Builder'],
      awards: ['Highlander', 'Scientist', 'Banker', 'Thermalist', 'Miner']}, {}, '-model-random');
    const model = Server.getGameModel(game).automa!;
    const messages = model.briefing!.map((m) => m.message);
    expect(messages, 'Jovian left the energy-badge track').contains('For this set the ${0} moves to ${1}');
    expect(messages).contains('For ${0} the bot places its tiles towards ${1}');
    expect(messages).contains('Token cells on its tracks count for ${0}');
    expect(model.tokens).deep.eq({});
    expect(model.thresholds!.some((t) => t.milestone === 'Rim Settler')).is.true;
    expect(model.thresholds!.some((t) => t.milestone === 'Energizer')).is.true;
  });
});
