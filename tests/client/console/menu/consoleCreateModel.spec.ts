import {expect} from 'chai';
import {BoardName} from '@/common/boards/BoardName';
import {
  createGameState,
  resetCreateGameState,
  setSlotName,
} from '@/client/components/create/premium/createGameState';
import {
  CREATE_DECKS,
  addDisabledReason,
  addHuman,
  botSeated,
  clampCreateCursors,
  consoleCreateUi,
  crewRows,
  cycleCreateDeck,
  cycleSlotColor,
  deckNavStep,
  editorFields,
  expansionRows,
  jumpToFirstIssue,
  launchIssues,
  launchReady,
  mapRows,
  participantTypeOptions,
  removeHuman,
  resetConsoleCreateUi,
  ruleRows,
  seatBot,
  seatBotNeedsConfirm,
  selectMap,
  toggleExpansion,
  toggleRule,
  unseatBot,
} from '@/client/console/menu/consoleCreateModel';

describe('consoleCreateModel', () => {
  beforeEach(() => {
    resetCreateGameState();
    resetConsoleCreateUi();
    createGameState.config.players.forEach((_, i) => setSlotName(i, `Player ${i + 1}`));
  });

  describe('deck ring + navigation', () => {
    it('cycles decks in both directions with wrap-around', () => {
      expect(cycleCreateDeck('crew', 1)).to.eq('rules');
      expect(cycleCreateDeck('map', 1)).to.eq('crew');
      expect(cycleCreateDeck('crew', -1)).to.eq('map');
    });

    it('steps vertical lists and clamps at the edges', () => {
      expect(deckNavStep('crew', 0, 'down', 3)).to.eq(1);
      expect(deckNavStep('crew', 0, 'up', 3)).to.eq(0);
      expect(deckNavStep('crew', 2, 'down', 3)).to.eq(2);
      // left/right are not meaningful on a vertical deck → undefined.
      expect(deckNavStep('crew', 0, 'left', 3)).to.eq(undefined);
    });

    it('walks the 2-column expansions grid without row wrap', () => {
      // 7 items → rows: [0,1], [2,3], [4,5], [6].
      expect(deckNavStep('expansions', 0, 'right', 7)).to.eq(1);
      expect(deckNavStep('expansions', 1, 'right', 7)).to.eq(1); // right edge
      expect(deckNavStep('expansions', 2, 'left', 7)).to.eq(2); // left edge
      expect(deckNavStep('expansions', 1, 'down', 7)).to.eq(3);
      expect(deckNavStep('expansions', 5, 'down', 7)).to.eq(5); // would exit grid
      expect(deckNavStep('expansions', 4, 'down', 7)).to.eq(6);
      expect(deckNavStep('expansions', 6, 'up', 7)).to.eq(4);
    });

    it('steps the map carousel horizontally only', () => {
      expect(deckNavStep('map', 0, 'right', 5)).to.eq(1);
      expect(deckNavStep('map', 4, 'right', 5)).to.eq(4);
      expect(deckNavStep('map', 0, 'up', 5)).to.eq(undefined);
    });
  });

  describe('crew roster', () => {
    it('lists humans + the ADD plate for a fresh multiplayer party', () => {
      const rows = crewRows();
      expect(rows).to.have.length(3); // 2 default players + add
      expect(rows[0].kind).to.eq('human');
      expect(rows[2].kind).to.eq('add');
      expect(botSeated()).to.eq(false);
    });

    it('adds a human up to the max, then disables the ADD plate', () => {
      for (let i = createGameState.config.players.length; i < 6; i++) {
        expect(addHuman()).to.eq(i);
        setSlotName(i, `P${i}`);
      }
      expect(createGameState.config.players).to.have.length(6);
      expect(addHuman()).to.eq(undefined);
      expect(addDisabledReason()).to.eq('The party is full');
      const add = crewRows().at(-1);
      expect(add?.kind).to.eq('add');
      expect(add?.kind === 'add' && add.enabled).to.eq(false);
    });

    it('removes a specific non-creator participant and re-slots', () => {
      addHuman();
      const names = createGameState.config.players.map((p) => p.name);
      removeHuman(1);
      const after = createGameState.config.players;
      expect(after).to.have.length(2);
      expect(after[0].name).to.eq(names[0]);
      expect(after[1].name).to.eq(names[2]);
      expect(after[1].slot).to.eq(1);
      expect(after[0].isCreator).to.eq(true);
    });

    it('never removes the creator or shrinks below the minimum', () => {
      removeHuman(0);
      expect(createGameState.config.players).to.have.length(2);
      removeHuman(1);
      expect(createGameState.config.players).to.have.length(2);
    });

    it('keeps colours unique when cycling into a taken colour (swap)', () => {
      const [a, b] = createGameState.config.players;
      const colorA = a.color;
      const colorB = b.color;
      cycleSlotColor(0, 1); // red → green (taken by b) → swap
      expect(createGameState.config.players[0].color).to.eq(colorB);
      expect(createGameState.config.players[1].color).to.eq(colorA);
    });
  });

  describe('MarsBot participant', () => {
    it('seats the bot as a roster row and blocks further adds with a reason', () => {
      seatBot();
      expect(botSeated()).to.eq(true);
      const rows = crewRows();
      expect(rows.map((r) => r.kind)).to.deep.eq(['human', 'bot', 'add']);
      expect(addDisabledReason()).to.eq('MarsBot currently plays one-on-one only');
      const options = participantTypeOptions();
      expect(options[0].enabled).to.eq(false);
      expect(options[1].enabled).to.eq(false);
      expect(options[1].disabledReasonKey).to.eq('Only one MarsBot per party');
    });

    it('warns before seating the bot when humans would be dropped, and restores them on unseat', () => {
      expect(seatBotNeedsConfirm()).to.eq(true); // 2 humans
      const names = createGameState.config.players.map((p) => p.name);
      seatBot();
      expect(createGameState.config.players).to.have.length(1);
      unseatBot();
      expect(createGameState.config.players.map((p) => p.name)).to.deep.eq(names);
    });

    it('exposes difficulty + remove fields for the bot editor', () => {
      seatBot();
      const fields = editorFields({kind: 'bot'}).map((f) => f.id);
      expect(fields).to.deep.eq(['difficulty', 'remove']);
    });

    it('hides trBoost editor field until the rule is on', () => {
      expect(editorFields({kind: 'human', index: 0}).map((f) => f.id)).to.deep.eq(['name', 'color']);
      createGameState.config.rules.trBoostEnabled = true;
      expect(editorFields({kind: 'human', index: 1}).map((f) => f.id)).to.deep.eq(['name', 'color', 'trBoost', 'remove']);
    });
  });

  describe('rules / expansions / map decks', () => {
    it('toggles rules and hides the alt-Venus rule without the Venus expansion', () => {
      expect(ruleRows().map((r) => r.meta.id)).to.include('alternativeVenusBoard');
      toggleExpansion('venus');
      expect(ruleRows().map((r) => r.meta.id)).to.not.include('alternativeVenusBoard');
      const before = createGameState.config.rules.draftVariant;
      toggleRule('draftVariant');
      expect(createGameState.config.rules.draftVariant).to.eq(!before);
    });

    it('shows the test-mode rule only while a seat is taken by admin', () => {
      expect(ruleRows().map((r) => r.meta.id)).to.not.include('testMode');
      setSlotName(0, ' Admin ');
      expect(ruleRows().map((r) => r.meta.id)).to.include('testMode');
      setSlotName(0, 'Player 1');
      expect(ruleRows().map((r) => r.meta.id)).to.not.include('testMode');
    });

    it('selects a specific map and the random rotation', () => {
      selectMap(BoardName.HELLAS);
      expect(createGameState.config.mapMode).to.eq('specific');
      expect(createGameState.config.mapId).to.eq(BoardName.HELLAS);
      expect(mapRows().find((m) => m.selected)?.meta.id).to.eq(BoardName.HELLAS);
      selectMap('random-all');
      expect(createGameState.config.mapMode).to.eq('random-all');
    });

    it('flags MarsBot conflicts on the exact rows', () => {
      seatBot();
      // Promo is SUPPORTED with MarsBot (official FAQ p.11) — never flagged.
      // Every OFFERED expansion is now automa-compatible, so the flaggable
      // conflicts left in the console decks are the map and the rules.
      toggleExpansion('promo');
      const promoRow = expansionRows().find((r) => r.meta.id === 'promo');
      expect(promoRow?.conflictKey).to.eq(undefined);
      selectMap(BoardName.HELLAS);
      expect(mapRows().find((m) => m.selected)?.conflict).to.eq(true);
    });
  });

  describe('launch readiness + jump-to-issue', () => {
    it('is ready with a clean default party', () => {
      expect(launchIssues()).to.deep.eq([]);
      expect(launchReady()).to.eq(true);
    });

    it('reports an empty name as a crew issue targeting the row', () => {
      setSlotName(1, '');
      const issues = launchIssues();
      expect(issues).to.have.length(1);
      expect(issues[0].textKey).to.eq('Fill in every player name');
      expect(issues[0].target).to.deep.eq({deck: 'crew', row: 1});
      expect(launchReady()).to.eq(false);
    });

    it('reports duplicate names', () => {
      setSlotName(1, 'Player 1');
      expect(launchIssues().some((i) => i.textKey === 'Player names must be unique')).to.eq(true);
    });

    it('maps automa conflicts to their decks', () => {
      seatBot();
      // Promo is automa-supported now — a RULES conflict stands in for the
      // former expansions-deck one.
      createGameState.config.rules.randomBoardTiles = true;
      selectMap(BoardName.HELLAS);
      const issues = launchIssues();
      const decks = issues.map((i) => i.target.deck);
      expect(decks).to.include('rules');
      expect(decks).to.include('map');
    });

    it('jump-to-issue lands the cursor on the first problem', () => {
      setSlotName(1, '');
      consoleCreateUi.deck = 'map';
      expect(jumpToFirstIssue()).to.eq(true);
      expect(consoleCreateUi.deck).to.eq('crew');
      expect(consoleCreateUi.cursor.crew).to.eq(1);
      expect(consoleCreateUi.shakeNonce).to.eq(1);
    });

    it('jump-to-issue is a no-op when ready', () => {
      expect(jumpToFirstIssue()).to.eq(false);
    });
  });

  describe('cursor hygiene', () => {
    it('clamps cursors after a mutation shrinks a deck', () => {
      addHuman();
      consoleCreateUi.cursor.crew = crewRows().length - 1;
      seatBot(); // roster shrinks to 1 human + bot + add
      clampCreateCursors();
      expect(consoleCreateUi.cursor.crew).to.be.lessThan(crewRows().length);
      for (const deck of CREATE_DECKS) {
        expect(consoleCreateUi.cursor[deck.id]).to.be.at.least(0);
      }
    });
  });
});
