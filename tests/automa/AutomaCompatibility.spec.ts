import {expect} from 'chai';
import {BoardName} from '../../src/common/boards/BoardName';
import {AutomaCompatibilityInput, automaConflicts, conflictFor} from '../../src/common/automa/automaCompatibility';

function cleanInput(): AutomaCompatibilityInput {
  return {
    boardName: BoardName.THARSIS,
    turmoil: false,
    prelude2: false,
    promo: false,
    community: false,
    ares: false,
    moon: false,
    pathfinders: false,
    ceo: false,
    starwars: false,
    underworld: false,
    randomMA: false,
    soloTR: false,
    twoCorpsVariant: false,
    escapeVelocity: false,
    solarPhaseOption: false,
    requiresVenusTrackCompletion: false,
    altVenusBoard: false,
    shuffleMapOption: false,
    customLists: false,
  };
}

describe('automaCompatibility — the shared UI/server conflict rules', () => {
  it('the POC configuration has no conflicts', () => {
    expect(automaConflicts(cleanInput())).is.empty;
  });

  it('a non-Tharsis board conflicts and names the board', () => {
    const conflicts = automaConflicts({...cleanInput(), boardName: BoardName.HELLAS});
    expect(conflicts).has.length(1);
    expect(conflicts[0].key).eq('board');
    expect(conflicts[0].reason).eq('the hellas board yet — the POC covers Tharsis');
  });

  it('reports EVERY conflict (the UI highlights all of them at once)', () => {
    const conflicts = automaConflicts({
      ...cleanInput(),
      promo: true,
      ares: true,
      shuffleMapOption: true,
      randomMA: true,
    });
    expect(conflicts.map((c) => c.key)).deep.eq(
      ['expansion:promo', 'expansion:ares', 'rule:randomMilestonesAwards', 'rule:randomBoardTiles']);
    expect(conflictFor(conflicts, 'expansion:ares')?.reason).eq('Ares');
    expect(conflictFor(conflicts, 'expansion:promo')?.reason).eq('promo cards in the POC');
    expect(conflictFor(conflicts, 'expansion:moon')).is.undefined;
  });

  it('keeps the exact server reject wording for the first conflict', () => {
    // AutomaSetup.validateOptions throws `MarsBot (Automa) does not support ${reason}`
    // with the FIRST conflict — these suffixes are the historical messages.
    expect(automaConflicts({...cleanInput(), turmoil: true})[0].reason).eq('Turmoil in the POC');
    expect(automaConflicts({...cleanInput(), soloTR: true})[0].reason)
      .eq('the 63 TR solo variant (the win condition is beating MarsBot)');
    expect(automaConflicts({...cleanInput(), solarPhaseOption: true})[0].reason)
      .eq('the Solar Phase / WGT option (Government Intervention covers it)');
    expect(automaConflicts({...cleanInput(), customLists: true})[0].reason)
      .eq('custom card/colony lists in the POC');
  });
});
