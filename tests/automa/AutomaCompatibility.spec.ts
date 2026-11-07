import {expect} from 'chai';
import {BoardName} from '../../src/common/boards/BoardName';
import {RandomBoardOption} from '../../src/common/boards/RandomBoardOption';
import {AutomaCompatibilityInput, automaConflicts, conflictFor} from '../../src/common/automa/automaCompatibility';

function cleanInput(): AutomaCompatibilityInput {
  return {
    boardName: BoardName.THARSIS,
    turmoil: false,
    turmoilRedux: false,
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

  it('Vastitas Borealis NOVA is supported (B13), and so is the fork\'s FAN Vastitas Borealis — its own home-made board and BF1', () => {
    expect(automaConflicts({...cleanInput(), boardName: BoardName.VASTITAS_BOREALIS_NOVA})).is.empty;
    expect(automaConflicts({...cleanInput(), boardName: BoardName.VASTITAS_BOREALIS})).is.empty;
  });

  it('the fan-made Amazonis Planitia is supported — its own home-made board and BF2', () => {
    expect(automaConflicts({...cleanInput(), boardName: BoardName.AMAZONIS})).is.empty;
  });

  it('the OLD (fan) Terra Cimmeria is supported — its own home-made board and BF3, beside the official Nova (B12)', () => {
    expect(automaConflicts({...cleanInput(), boardName: BoardName.TERRA_CIMMERIA})).is.empty;
    expect(automaConflicts({...cleanInput(), boardName: BoardName.TERRA_CIMMERIA_NOVA})).is.empty;
  });

  it('the fan-made Arabia Terra is supported — its own home-made board and BF4', () => {
    expect(automaConflicts({...cleanInput(), boardName: BoardName.ARABIA_TERRA})).is.empty;
  });

  it('a RANDOM board request is never a conflict — the server rolls it from the supported pool', () => {
    // src/server/boards/randomBoard.ts narrows the pool to
    // AUTOMA_SUPPORTED_BOARDS for automa games, so the resolved board is
    // always one the bot covers. This branch is what lets the create UI keep
    // «случайная карта» selectable with MarsBot seated.
    expect(automaConflicts({...cleanInput(), boardName: RandomBoardOption.ALL})).is.empty;
    expect(automaConflicts({...cleanInput(), boardName: RandomBoardOption.OFFICIAL})).is.empty;
  });

  it('a board without a MarsBot profile conflicts and names it', () => {
    // Every board of the game is covered since Hollandia joined (2026-11-06), so the rule now stands for a map a future
    // sync brings — its subject here is a board name the engine does not know.
    const conflicts = automaConflicts({...cleanInput(), boardName: 'Nowhere Planitia' as BoardName});
    expect(conflicts).has.length(1);
    expect(conflicts[0].key).eq('board');
    expect(conflicts[0].reason)
      .eq('the Nowhere Planitia board yet — MarsBot covers tharsis, hellas, elysium, utopia planitia, terra cimmeria nova, vastitas borealis nova, vastitas borealis, amazonis p., t. cimmeria, arabia terra, Hollandia and amazonis planitia');
  });

  it('Hollandia — the map with no milestone row of its own — is covered, with and without the random-set box', () => {
    expect(automaConflicts({...cleanInput(), boardName: BoardName.HOLLANDIA})).is.empty;
    expect(automaConflicts({...cleanInput(), boardName: BoardName.HOLLANDIA, randomMA: true})).is.empty;
    // …and the random-set rule still names a map nobody covers.
    expect(automaConflicts({...cleanInput(), boardName: 'Nowhere Planitia' as BoardName, randomMA: true}).map((c) => c.key))
      .deep.eq(['board', 'rule:randomMilestonesAwards']);
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
    expect(conflicts.map((c) => c.key), 'random milestones and awards play on a supported board (the random-set framework)').deep.eq(
      ['expansion:community', 'expansion:moon', 'rule:randomBoardTiles']);
    expect(conflictFor(conflicts, 'expansion:moon')?.reason).eq('The Moon');
    expect(conflictFor(conflicts, 'expansion:community')?.reason).eq('community cards');
    expect(conflictFor(conflicts, 'expansion:turmoil')).is.undefined;
  });

  it('TURMOIL REDUX is allowed — a stated fact of the matrix, not an omission (the bot is a seat at the Parliament)', () => {
    // docs/TURMOIL_REDUX_MARSBOT.md: the bot votes through Party Politics and
    // Lobbying, may win a vote and take the chairmanship; an enacted law never
    // pays it. Classic Turmoil stays a conflict — the two engines are exclusive.
    expect(automaConflicts({...cleanInput(), turmoilRedux: true})).deep.eq([]);
    expect(automaConflicts({...cleanInput(), turmoilRedux: true, turmoil: true}).map((c) => c.key)).deep.eq(['expansion:turmoil']);
  });

  it('PRELUDE 2 is allowed — a stated fact of the matrix (the full inclusion, 2026-11-05: every card adapted against the bot)', () => {
    expect(automaConflicts({...cleanInput(), prelude2: true})).deep.eq([]);
    expect(automaConflicts({...cleanInput(), prelude2: true, turmoilRedux: true})).deep.eq([]);
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
