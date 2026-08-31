import {expect} from 'chai';
import {
  colonyGridLayout,
  colonyGridCols,
  colonyRailIsCatalog,
  colonyNavStep,
  colonyFocusState,
  openColonyFocus,
  closeColonyFocus,
  setColonyFocusStage,
  markColonyFocusCommitting,
  resetColonyFocus,
  colonyWorkspacePhase,
  colonyWorkspaceBackVerb,
  consoleColoniesUi,
  resetConsoleColoniesUi,
} from '@/client/console/consoleColoniesModel';
import {ColonyName} from '@/common/colonies/ColonyName';

describe('consoleColoniesModel — the COLONY WORKSPACE model', () => {
  // Module state is BUNDLE-SHARED under mochapack: a leaked open focus stage
  // would leave every later spec inside a phantom descent.
  afterEach(() => {
    resetColonyFocus();
    resetConsoleColoniesUi();
  });

  describe('count-aware grid layouts (the smart composition — unchanged)', () => {
    it('maps every in-game count to its designed layout', () => {
      expect(colonyGridLayout(1, false)).to.eq('solo');
      expect(colonyGridLayout(3, false)).to.eq('trio');
      expect(colonyGridLayout(4, false)).to.eq('four');
      expect(colonyGridLayout(5, false)).to.eq('five');
      expect(colonyGridLayout(6, false)).to.eq('six');
    });

    it('the >6 add-a-tile catalog is its own compact mode', () => {
      expect(colonyGridLayout(9, true)).to.eq('catalog');
    });

    it('columns drive both CSS and the 2D d-pad stepping', () => {
      expect(colonyGridCols('five', 5)).to.eq(3);
      expect(colonyGridCols('four', 4)).to.eq(2);
    });
  });

  /**
   * THE CATALOG IS NOT THE GAME'S COLONIES — and the one derivation that says
   * so answers for BOTH consumers (which tiles to rail, and whether anything
   * server-scoped may be asked about them).
   *
   * Aridor's first action offers the game's UNUSED colonies. Descending into
   * one asked `/api/game/colony-trade-preview?colony=Ceres` for a colony that
   * is not in the game: the server could only decline, so the request logged a
   * 404 on both ends and the stage learned nothing it did not already have from
   * the manifest.
   */
  describe('the add-a-tile catalog', () => {
    it('a pick-a-NEW-tile prompt rails colonies that are NOT in the game', () => {
      expect(colonyRailIsCatalog('addNewColonyToGame', true)).to.eq(true);
    });

    it('a Build-Colony pick rails IN-GAME colonies', () => {
      expect(colonyRailIsCatalog('selectExistingColony', true)).to.eq(false);
      expect(colonyRailIsCatalog(undefined, true)).to.eq(false);
    });

    it('a grid standing for any other reason is never a catalog', () => {
      // A trade, or a plain visit: whatever a prompt elsewhere says, this rail
      // shows the game's own colonies and their previews are askable.
      expect(colonyRailIsCatalog('addNewColonyToGame', false)).to.eq(false);
    });
  });

  describe('2D d-pad stepping (edge-clamped, no wrap)', () => {
    it('walks rows and columns over the 3+2 layout', () => {
      // 5 colonies, 3 columns: [0 1 2] / [3 4].
      expect(colonyNavStep('right', 0, 5, 3)).to.eq(1);
      expect(colonyNavStep('down', 1, 5, 3)).to.eq(4);
      expect(colonyNavStep('up', 4, 5, 3)).to.eq(1);
      expect(colonyNavStep('left', 3, 5, 3)).to.eq(2);
    });

    it('the edges are felt — never a wrap', () => {
      expect(colonyNavStep('up', 1, 5, 3)).to.eq(1);
      expect(colonyNavStep('right', 4, 5, 3)).to.eq(4);
    });
  });

  describe('the FOCUS STAGE flow (browse ⇄ focus, the workspace family)', () => {
    it('opens on a colony with an intent and publishes its crumb tail', () => {
      openColonyFocus(ColonyName.PLUTO, 'trade');
      expect(colonyFocusState.open).to.eq(true);
      expect(colonyFocusState.colonyName).to.eq(ColonyName.PLUTO);
      setColonyFocusStage('Trading');
      expect(colonyFocusState.stage).to.eq('Trading');
    });

    it('closing lands back on the browse surface with nothing carried over', () => {
      openColonyFocus(ColonyName.PLUTO, 'inspect');
      setColonyFocusStage('Inspection');
      closeColonyFocus();
      expect(colonyFocusState.open).to.eq(false);
      expect(colonyFocusState.colonyName).to.eq('');
      expect(colonyFocusState.stage).to.eq('');
    });

    it('the stage name is ignored while browsing (no phantom tail)', () => {
      setColonyFocusStage('Trading');
      expect(colonyFocusState.stage).to.eq('');
    });

    it('carries every intent — build and pick descend too (nothing commits from the overview)', () => {
      openColonyFocus(ColonyName.PLUTO, 'build');
      expect(colonyFocusState.intent).to.eq('build');
      closeColonyFocus();
      openColonyFocus(ColonyName.PLUTO, 'pick');
      expect(colonyFocusState.intent).to.eq('pick');
      closeColonyFocus();
      openColonyFocus(ColonyName.PLUTO, 'inspect');
      expect(colonyFocusState.intent).to.eq('inspect');
    });
  });

  describe('the workspace PHASE + B\'s verb (derived, never hand-rolled)', () => {
    it('browse → close; focus → back (one reversible level)', () => {
      expect(colonyWorkspacePhase(false)).to.eq('browse');
      expect(colonyWorkspaceBackVerb(false)).to.eq('close');
      openColonyFocus(ColonyName.PLUTO, 'trade');
      expect(colonyWorkspacePhase(false)).to.eq('configure');
      expect(colonyWorkspaceBackVerb(false)).to.eq('back');
    });

    it('a live transaction is an EXECUTING beat — input absorbed, B none', () => {
      expect(colonyWorkspacePhase(true)).to.eq('executing');
      expect(colonyWorkspaceBackVerb(true)).to.eq('none');
    });

    it('the confirm fold marks committing until the flight owns the moment', () => {
      openColonyFocus(ColonyName.PLUTO, 'trade');
      markColonyFocusCommitting();
      expect(colonyWorkspacePhase(false)).to.eq('executing');
      closeColonyFocus();
      expect(colonyWorkspacePhase(false)).to.eq('browse');
    });
  });

  describe('the command-bar mirror', () => {
    it('resets atomically (no stale hints after the section closes)', () => {
      consoleColoniesUi.composerSub = 'lanes';
      consoleColoniesUi.composerReady = true;
      consoleColoniesUi.composerEditable = true;
      resetConsoleColoniesUi();
      expect(consoleColoniesUi.composerSub).to.eq('');
      expect(consoleColoniesUi.composerReady).to.eq(false);
      expect(consoleColoniesUi.composerEditable).to.eq(false);
    });
  });
});
