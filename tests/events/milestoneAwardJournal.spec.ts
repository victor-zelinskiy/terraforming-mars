import {expect} from 'chai';
import {IGame} from '@/server/IGame';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {runAllActions} from '../TestingUtils';
import {cast} from '@/common/utils/utils';
import {OrOptions} from '@/server/inputs/OrOptions';
import {VanAllen} from '@/server/cards/ceos/VanAllen';

/**
 * Regression guard for the milestone/award notification gap: claiming a
 * milestone and funding an award must produce JOURNAL ROOT events — a LogMessage
 * with a `correlationId` + role 'root-action' + the right category, AND an
 * 'action' GameEvent with the milestone/award source. Without the `beginAction`
 * scope these were bare ungrouped logs that the notification system skipped.
 */
describe('milestone / award journal coverage', () => {
  let game: IGame;
  let player: TestPlayer;

  beforeEach(() => {
    [game, player] = testGame(2, {ceoExtension: true});
  });

  it('a claimed milestone is a journal root event (correlationId + category)', () => {
    player.playedCards.push(new VanAllen()); // claim for free → synchronous claim
    player.megaCredits = 0;
    player.setTerraformRating(35); // Terraformer claimable
    const actions = cast(player.getActions(), OrOptions);
    const claim = cast(actions.options.find((o) => o.title === 'Claim a milestone'), OrOptions);
    claim.options[0].cb();
    runAllActions(game);

    const log = game.gameLog.find((m) => m.category === 'milestone');
    expect(log, 'milestone claim log').to.not.be.undefined;
    expect(log!.correlationId, 'correlationId').to.be.a('number');
    expect(log!.role).to.eq('root-action');

    const ev = game.events.events.find((e) => e.type === 'action' && e.source?.kind === 'milestone');
    expect(ev, 'milestone action event').to.not.be.undefined;
    expect(ev!.correlationId).to.eq(log!.correlationId);
  });

  it('a funded award is a journal root event (correlationId + category)', () => {
    const award = game.awards[0];
    game.fundAward(player, award);

    const log = game.gameLog.find((m) => m.category === 'award');
    expect(log, 'award funding log').to.not.be.undefined;
    expect(log!.correlationId, 'correlationId').to.be.a('number');
    expect(log!.role).to.eq('root-action');

    const ev = game.events.events.find((e) => e.type === 'action' && e.source?.kind === 'award');
    expect(ev, 'award action event').to.not.be.undefined;
    expect(ev!.correlationId).to.eq(log!.correlationId);
  });
});
