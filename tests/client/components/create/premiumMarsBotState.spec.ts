import {expect} from 'chai';
import {BoardName} from '@/common/boards/BoardName';
import {RandomBoardOption} from '@/common/boards/RandomBoardOption';
import {
  HUMANS_WITH_BOT_MAX,
  canCreateGame,
  createGameState,
  firstBlocker,
  resetCreateGameState,
  setGameMode,
  setBotDifficulty,
  setPlayerCount,
  setSeatMarsBot,
  setSlotName,
  stateAutomaConflicts,
  stateAutomaConflictKeys,
} from '@/client/components/create/premium/createGameState';
import {buildCreateGamePayloadFromPremiumState} from '@/client/components/create/premium/buildCreateGamePayload';

describe('premium create — MarsBot mode', () => {
  beforeEach(() => {
    resetCreateGameState();
  });

  it('multiplayer mode never reports automa conflicts', () => {
    createGameState.config.selectedExpansions.promo = true;
    createGameState.config.rules.randomMilestonesAwards = true;
    expect(stateAutomaConflicts()).is.empty;
  });

  it('marsbot mode keeps exactly one human seat and restores two on switch back', () => {
    expect(createGameState.config.players.length).to.be.gte(2);
    setGameMode('marsbot');
    expect(createGameState.config.players).has.length(1);
    expect(createGameState.config.players[0].isCreator).is.true;
    setGameMode('multiplayer');
    expect(createGameState.config.players).has.length(2);
  });

  it('conflicting options are highlighted and block creation with a readable reason', () => {
    setGameMode('marsbot');
    setSlotName(0, 'Astronaut');
    createGameState.config.mapMode = 'specific';
    createGameState.config.mapId = BoardName.THARSIS;
    expect(canCreateGame()).is.true;

    // Promo is SUPPORTED with MarsBot (official FAQ p.11) — never a conflict; the shuffled map too (2026-11-07).
    createGameState.config.selectedExpansions.promo = true;
    createGameState.config.rules.randomBoardTiles = true;
    expect(stateAutomaConflictKeys().has('expansion:promo')).is.false;
    expect(stateAutomaConflictKeys().has('rule:randomBoardTiles')).is.false;
    expect(canCreateGame()).is.true;
    createGameState.config.selectedExpansions.moon = true;
    const keys = stateAutomaConflictKeys();
    expect(keys.has('expansion:moon')).is.true;
    expect(canCreateGame()).is.false;
    expect(firstBlocker()).eq('This option is not supported with MarsBot yet');
  });

  it('random milestones and awards are no conflict on a supported board — only beside an uncovered one', () => {
    createGameState.config.rules.randomMilestonesAwards = true;
    setGameMode('marsbot');
    expect(createGameState.config.rules.randomMilestonesAwards, 'the preset keeps the random set').is.true;
    createGameState.config.mapMode = 'specific';
    createGameState.config.mapId = BoardName.ELYSIUM;
    expect(stateAutomaConflictKeys().has('rule:randomMilestonesAwards')).is.false;
    // Hollandia (no row of its own — always a random set) is covered since 2026-11-06…
    createGameState.config.mapId = BoardName.HOLLANDIA;
    expect(stateAutomaConflictKeys().size).eq(0);
    // …so «an uncovered board» is a name the engine does not know.
    createGameState.config.mapId = 'Nowhere Planitia' as BoardName;
    const keys = stateAutomaConflictKeys();
    expect(keys.has('board')).is.true;
    expect(keys.has('rule:randomMilestonesAwards')).is.true;
  });

  it('entering marsbot mode keeps promo enabled (the preset only drops genuine conflicts)', () => {
    createGameState.config.selectedExpansions.promo = true;
    setGameMode('marsbot');
    expect(createGameState.config.selectedExpansions.promo).is.true;
    expect(stateAutomaConflicts()).is.empty;
  });

  describe('mode B — the multiplayer bot seat (§12 Q14)', () => {
    it('seating the bot applies the compatibility preset and gates the same conflict rules', () => {
      createGameState.config.rules.randomMilestonesAwards = true;
      expect(stateAutomaConflicts()).is.empty; // No bot — no automa rules.
      setSeatMarsBot(true);
      expect(createGameState.config.seatMarsBot).is.true;
      // A random set plays with the bot on a board it covers — the preset keeps it (the dynamic-M&A framework).
      expect(createGameState.config.rules.randomMilestonesAwards).is.true;
      expect(stateAutomaConflicts()).is.empty;
      createGameState.config.rules.randomBoardTiles = true;
      expect(stateAutomaConflicts(), 'the shuffled map plays with the bot (2026-11-07)').is.empty;
    });

    it('the payload seats the bot and turns the solar phase off; drafts stay for the humans', () => {
      setSeatMarsBot(true);
      setBotDifficulty('hard');
      createGameState.config.selectedExpansions.venus = true;
      const payload = buildCreateGamePayloadFromPremiumState(createGameState.config);
      expect(payload.automa).deep.eq({difficulty: 'hard', secondShift: true, extraCorporations: false});
      // The switch rides the same option — off is sent as off, never dropped.
      createGameState.config.botSecondShift = false;
      expect(buildCreateGamePayloadFromPremiumState(createGameState.config).automa).deep.eq({difficulty: 'hard', secondShift: false, extraCorporations: false});
      createGameState.config.botSecondShift = true;
      // «Дополнительные корпорации бота» ride the same option — OFF by default, sent either way.
      createGameState.config.botExtraCorporations = true;
      expect(buildCreateGamePayloadFromPremiumState(createGameState.config).automa).deep.eq({difficulty: 'hard', secondShift: true, extraCorporations: true});
      createGameState.config.botExtraCorporations = false;
      expect(payload.solarPhaseOption).is.false;
      expect(payload.players).has.length(createGameState.config.players.length);
      // Mode B keeps the start-of-game draft template values (§12 Q8) —
      // unlike the SOLO marsbot mode, which forces them off.
      expect(payload.preludeDraftVariant).eq(buildCreateGamePayloadFromPremiumState({...createGameState.config, seatMarsBot: false}).preludeDraftVariant);
    });

    it('the human roster caps at 4 while the bot is seated', () => {
      setSeatMarsBot(true);
      setPlayerCount(5);
      expect(createGameState.config.players).has.length(HUMANS_WITH_BOT_MAX);
    });

    it('a mode switch never carries the bot seat flag', () => {
      setSeatMarsBot(true);
      setGameMode('marsbot');
      expect(createGameState.config.seatMarsBot).is.false;
      setGameMode('multiplayer');
      expect(createGameState.config.seatMarsBot).is.false;
    });
  });

  it('a RANDOM map is supported in marsbot mode — the server rolls from the adapted pool', () => {
    setGameMode('marsbot');
    setSlotName(0, 'Astronaut');
    createGameState.config.mapMode = 'random-all';
    expect(stateAutomaConflictKeys().has('board')).is.false;
    expect(canCreateGame()).is.true;
    // The payload sends the random request as-is; ApiCreateGame narrows the pool.
    const payload = buildCreateGamePayloadFromPremiumState(createGameState.config);
    expect(payload.board).eq(RandomBoardOption.ALL);
  });

  it('entering marsbot mode keeps a random map (the preset only pins explicit unsupported ones)', () => {
    createGameState.config.mapMode = 'random-all';
    setGameMode('marsbot');
    expect(createGameState.config.mapMode).eq('random-all');
    expect(stateAutomaConflicts()).is.empty;

    setGameMode('multiplayer');
    createGameState.config.mapMode = 'specific';
    createGameState.config.mapId = 'Nowhere Planitia' as BoardName;
    setGameMode('marsbot');
    expect(createGameState.config.mapMode).eq('specific');
    expect(createGameState.config.mapId).eq(BoardName.THARSIS);

    // A covered map is kept — Hollandia, the last one to join (2026-11-06), included.
    setGameMode('multiplayer');
    createGameState.config.mapId = BoardName.HOLLANDIA;
    setGameMode('marsbot');
    expect(createGameState.config.mapId).eq(BoardName.HOLLANDIA);
  });

  it('a map without a MarsBot board conflicts in marsbot mode', () => {
    setGameMode('marsbot');
    setSlotName(0, 'Astronaut');
    createGameState.config.mapMode = 'specific';
    createGameState.config.mapId = 'Nowhere Planitia' as BoardName;
    expect(stateAutomaConflictKeys().has('board')).is.true;
    expect(canCreateGame()).is.false;

    // Hellas has its own MarsBot board, reference card and B09.
    createGameState.config.mapId = BoardName.HELLAS;
    expect(stateAutomaConflictKeys().has('board')).is.false;
    expect(canCreateGame()).is.true;

    // …and Elysium its own board, reference card and B10.
    createGameState.config.mapId = BoardName.ELYSIUM;
    expect(stateAutomaConflictKeys().has('board')).is.false;
    expect(canCreateGame()).is.true;

    createGameState.config.mapId = BoardName.THARSIS;
    expect(canCreateGame()).is.true;
  });

  it('the POC set (Tharsis + corpera/prelude/venus/colonies + draft) is clean', () => {
    setGameMode('marsbot');
    setSlotName(0, 'Astronaut');
    createGameState.config.mapMode = 'specific';
    createGameState.config.mapId = BoardName.THARSIS;
    createGameState.config.selectedExpansions.corpera = true;
    createGameState.config.selectedExpansions.prelude = true;
    createGameState.config.selectedExpansions.venus = true;
    createGameState.config.selectedExpansions.colonies = true;
    createGameState.config.rules.draftVariant = true;
    expect(stateAutomaConflicts()).is.empty;
    expect(canCreateGame()).is.true;
  });

  it('the payload carries automa difficulty, one player and no solar phase', () => {
    setGameMode('marsbot');
    setSlotName(0, 'Astronaut');
    setBotDifficulty('brutal');
    createGameState.config.mapMode = 'specific';
    createGameState.config.mapId = BoardName.THARSIS;
    createGameState.config.selectedExpansions.venus = true;

    const payload = buildCreateGamePayloadFromPremiumState(createGameState.config);
    expect(payload.automa).deep.eq({difficulty: 'brutal', secondShift: true, extraCorporations: false});
    expect(payload.players).has.length(1);
    expect(payload.players[0].first).is.true;
    expect(payload.solarPhaseOption).is.false;
    expect(payload.board).eq(BoardName.THARSIS);
    // The start-of-game draft variants degenerate with one human — never sent
    // (the fork's default template ships the prelude draft ON, which used to
    // 500 the automa create until the server normalization landed).
    expect(payload.initialDraft).is.false;
    expect(payload.preludeDraftVariant).is.false;
    expect(payload.ceosDraftVariant).is.false;
    // The between-generations draft IS supported and follows the rule toggle.
    expect(payload.draftVariant).eq(createGameState.config.rules.draftVariant);
  });

  it('a multiplayer payload never carries automa', () => {
    setSlotName(0, 'Astronaut');
    setSlotName(1, 'Botanist');
    const payload = buildCreateGamePayloadFromPremiumState(createGameState.config);
    expect(payload.automa).is.undefined;
    expect(payload.players).has.length(2);
  });
});
