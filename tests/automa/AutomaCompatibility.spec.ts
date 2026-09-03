import {expect} from 'chai';
import {BoardName} from '../../src/common/boards/BoardName';
import {RandomBoardOption} from '../../src/common/boards/RandomBoardOption';
import {AutomaCompatibilityInput, automaConflicts, conflictFor} from '../../src/common/automa/automaCompatibility';

function cleanInput(): AutomaCompatibilityInput {
  return {
    boardName: BoardName.THARSIS,
    turmoil: false,
    prelude2: false,
    community: false,
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
    shuffleMapOption: false,
    customColonyList: false,
  };
}

describe('automaCompatibility — the shared UI/server conflict rules', () => {
  it('the POC configuration has no conflicts', () => {
    expect(automaConflicts(cleanInput())).is.empty;
  });

  it('Hellas is supported — it has a MarsBot board, reference card and B09', () => {
    expect(automaConflicts({...cleanInput(), boardName: BoardName.HELLAS})).is.empty;
  });

  it('Elysium is supported — its own MarsBot board, reference card and B10', () => {
    expect(automaConflicts({...cleanInput(), boardName: BoardName.ELYSIUM})).is.empty;
  });

  it('Utopia Planitia is supported — its own MarsBot board, reference card and B11', () => {
    expect(automaConflicts({...cleanInput(), boardName: BoardName.UTOPIA_PLANITIA})).is.empty;
  });

  it('Terra Cimmeria NOVA is supported — its own MarsBot board, reference card and B12', () => {
    expect(automaConflicts({...cleanInput(), boardName: BoardName.TERRA_CIMMERIA_NOVA})).is.empty;
  });

  it('a RANDOM board request is never a conflict — the server rolls it from the supported pool', () => {
    // src/server/boards/randomBoard.ts narrows the pool to
    // AUTOMA_SUPPORTED_BOARDS for automa games, so the resolved board is
    // always one the bot covers. This branch is what lets the create UI keep
    // «случайная карта» selectable with MarsBot seated.
    expect(automaConflicts({...cleanInput(), boardName: RandomBoardOption.ALL})).is.empty;
    expect(automaConflicts({...cleanInput(), boardName: RandomBoardOption.OFFICIAL})).is.empty;
  });

  it('…but the fork\'s OLDER Terra Cimmeria is a different map, and is not', () => {
    // Same name, different board: no MSL Curiosity hex and a different
    // milestone/award row, so none of B12's rules would apply to it.
    const conflicts = automaConflicts({...cleanInput(), boardName: BoardName.TERRA_CIMMERIA});
    expect(conflicts.map((c) => c.key)).deep.eq(['board']);
  });

  it('a board without a MarsBot profile conflicts and names it', () => {
    const conflicts = automaConflicts({...cleanInput(), boardName: BoardName.AMAZONIS});
    expect(conflicts).has.length(1);
    expect(conflicts[0].key).eq('board');
    expect(conflicts[0].reason)
      .eq('the amazonis p. board yet — MarsBot covers tharsis, hellas, elysium, utopia planitia and terra cimmeria nova');
  });

  it('reports EVERY conflict (the UI highlights all of them at once)', () => {
    // NOTE: PROMO is deliberately NOT a conflict anymore — the official FAQ
    // (rulebook p.11) covers it; see AutomaPromoCards.spec.ts.
    const conflicts = automaConflicts({
      ...cleanInput(),
      community: true,
      moon: true,
      shuffleMapOption: true,
      randomMA: true,
    });
    expect(conflicts.map((c) => c.key)).deep.eq(
      ['expansion:community', 'expansion:moon', 'rule:randomMilestonesAwards', 'rule:randomBoardTiles']);
    expect(conflictFor(conflicts, 'expansion:moon')?.reason).eq('The Moon');
    expect(conflictFor(conflicts, 'expansion:community')?.reason).eq('community cards');
    expect(conflictFor(conflicts, 'expansion:turmoil')).is.undefined;
  });

  it('keeps the exact server reject wording for the first conflict', () => {
    // AutomaSetup.validateOptions throws `MarsBot (Automa) does not support ${reason}`
    // with the FIRST conflict — these suffixes are the historical messages.
    expect(automaConflicts({...cleanInput(), turmoil: true})[0].reason).eq('Turmoil in the POC');
    expect(automaConflicts({...cleanInput(), soloTR: true})[0].reason)
      .eq('the 63 TR solo variant (the win condition is beating MarsBot)');
    expect(automaConflicts({...cleanInput(), solarPhaseOption: true})[0].reason)
      .eq('the Solar Phase / WGT option (Government Intervention covers it)');
    expect(automaConflicts({...cleanInput(), customColonyList: true})[0].reason)
      .eq('a custom colony list (its shipping board covers the 11 base colony tiles)');
  });

  it('a custom COLONY list conflicts — it is direct MarsBot data', () => {
    const conflicts = automaConflicts({...cleanInput(), customColonyList: true});
    expect(conflicts.map((c) => c.key)).deep.eq(['variant:customColonies']);
  });
});
