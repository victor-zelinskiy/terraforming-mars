import {expect} from 'chai';
import {
  buildRtQuickEntries,
  buildLtQuickEntries,
  buildStdProjectItems,
  QUICK_SLOT_GLYPH,
} from '@/client/console/consoleQuickModel';
import {CardName} from '@/common/cards/CardName';

/**
 * P27: the main-board command model view-models — the RT/LT quick-selector
 * entries (slot map + honest reasons) and the premium Standard-Projects rows
 * (Patent sale as a first-class basic action, M€ deficits named).
 * All pure — guarded here without a DOM.
 */
describe('consoleQuickModel (P27)', () => {
  describe('RT — action categories', () => {
    it('maps the spec slots: Cards center, Card actions up, Trading right, Voting down, Hydro left', () => {
      const entries = buildRtQuickEntries({
        cardsPlayable: 3, cardsTotal: 5, actionsAvailable: 2, tradesAvailable: 2, hydroAvailable: 1,
        hasColonies: true, hasTurmoil: false, hasHydro: true,
      });
      const bySlot = new Map(entries.map((e) => [e.slot, e]));
      expect(bySlot.get('center')?.id).to.eq('cards');
      expect(bySlot.get('up')?.id).to.eq('cardActions');
      expect(bySlot.get('right')?.id).to.eq('trading');
      expect(bySlot.get('down')?.id).to.eq('voting');
      expect(bySlot.get('left')?.id).to.eq('hydro');
      expect(bySlot.get('center')?.badge).to.eq(3);
      expect(bySlot.get('up')?.badge).to.eq(2);
    });

    /*
     * ONE MEANING FOR EVERY GREEN NUMBER (potential availability).
     *
     * «Карты» and «Действия карт» carried a count; «Гидросеть» and «Торговля»
     * carried none, so the same wheel spoke two languages — one half told the
     * player how much there was to do, the other half only that the category
     * existed. All four now read the same way, and the trade badge is the
     * number of TRADES still possible (min(colonies, free fleets)), never the
     * number of colonies on the board.
     */
    it('all four action categories carry a potential count', () => {
      const bySlot = new Map(buildRtQuickEntries({
        cardsPlayable: 4, cardsTotal: 7, actionsAvailable: 3, tradesAvailable: 2, hydroAvailable: 1,
        hasColonies: true, hasTurmoil: false, hasHydro: true,
      }).map((e) => [e.slot, e]));
      expect(bySlot.get('center')?.badge, 'cards').to.eq(4);
      expect(bySlot.get('up')?.badge, 'card actions').to.eq(3);
      expect(bySlot.get('right')?.badge, 'trading').to.eq(2);
      expect(bySlot.get('left')?.badge, 'hydronetwork').to.eq(1);
    });

    it('a category with nothing to do keeps its slot and shows no badge', () => {
      // The template renders a badge only for `badge > 0`, so a zero count
      // degrades to the plain tile — never a «0» chip screaming at the player.
      const bySlot = new Map(buildRtQuickEntries({
        cardsPlayable: 0, cardsTotal: 7, actionsAvailable: 0, tradesAvailable: 0, hydroAvailable: 0,
        hasColonies: true, hasTurmoil: false, hasHydro: true,
      }).map((e) => [e.slot, e]));
      expect(bySlot.get('right')?.badge).to.eq(0);
      expect(bySlot.get('left')?.badge).to.eq(0);
      // …and both categories are still REACHABLE (the player may inspect them).
      expect(bySlot.get('right')?.available).to.eq(true);
      expect(bySlot.get('left')?.available).to.eq(true);
    });

    it('keeps unavailable categories VISIBLE with honest reasons', () => {
      const entries = buildRtQuickEntries({
        cardsPlayable: 0, cardsTotal: 0, actionsAvailable: 0, tradesAvailable: 0, hydroAvailable: 0,
        hasColonies: false, hasTurmoil: false, hasHydro: false,
      });
      const bySlot = new Map(entries.map((e) => [e.slot, e]));
      expect(bySlot.get('right')?.available).to.eq(false);
      expect(bySlot.get('right')?.reason).to.eq('No colonies in this game');
      expect(bySlot.get('left')?.available).to.eq(false);
      // Voting stays a reserved (disabled) slot in every game.
      expect(bySlot.get('down')?.available).to.eq(false);
      expect(bySlot.get('down')?.reason).to.eq('Not in this game');
    });

    it('names the Turmoil-reserved reason when the expansion is on', () => {
      const entries = buildRtQuickEntries({
        cardsPlayable: 0, cardsTotal: 0, actionsAvailable: 0, tradesAvailable: 0, hydroAvailable: 0,
        hasColonies: true, hasTurmoil: true, hasHydro: false,
      });
      const voting = entries.find((e) => e.id === 'voting');
      expect(voting?.reason).to.eq('Voting arrives with a future update');
    });

    it('every slot has a glyph mapping', () => {
      for (const e of buildRtQuickEntries({cardsPlayable: 0, cardsTotal: 0, actionsAvailable: 0, tradesAvailable: 0, hydroAvailable: 0, hasColonies: true, hasTurmoil: false, hasHydro: true})) {
        expect(QUICK_SLOT_GLYPH[e.slot]).to.not.eq(undefined);
      }
    });
  });

  describe('LT — basic actions', () => {
    const ctx = (over: Partial<Parameters<typeof buildLtQuickEntries>[0]> = {}) => ({
      myTurn: true,
      awaitingInput: true,
      stdAvailable: true,
      endTurnAvailable: false,
      passAvailable: true,
      convertPlantsAvailable: false,
      convertHeatAvailable: true,
      plantsNeeded: 8,
      heatNeeded: 8,
      ...over,
    });

    it('maps the spec slots: Std projects center, Skip up, Pass down, Plants left, Heat right', () => {
      const bySlot = new Map(buildLtQuickEntries(ctx()).map((e) => [e.slot, e]));
      expect(bySlot.get('center')?.id).to.eq('standardProjects');
      expect(bySlot.get('up')?.id).to.eq('skipTurn');
      expect(bySlot.get('down')?.id).to.eq('pass');
      expect(bySlot.get('left')?.id).to.eq('convertPlants');
      expect(bySlot.get('right')?.id).to.eq('convertHeat');
    });

    /*
     * A MINIMIZED DECISION OUTRANKS EVERY PER-VERB REASON.
     *
     * Shipped bug: with the sponsor's play-from-hand set aside, this wheel read
     * «Сейчас недоступно» on Standard Projects and Pass, «Недостаточно
     * растений», «Недостаточно тепла», «Доступно после первого действия в этом
     * ходу». Each line was individually true and together they were a lie about
     * why the game would not move — the player was told five wrong things
     * instead of the one right one. Worse, `myTurn` was TRUE (the parked
     * prompt is itself a play-card offer), so the shared off-turn reason never
     * got a chance to speak.
     */
    it('a set-aside decision is the ONLY reason any basic action gives', () => {
      const entries = buildLtQuickEntries(ctx({
        blockedReason: 'Finish your current action first',
        // …including the ones the server genuinely still offers.
        stdAvailable: true,
        passAvailable: true,
        convertHeatAvailable: true,
      }));
      for (const e of entries) {
        expect(e.available, `'${e.id}' must not be startable`).to.eq(false);
        expect(e.reason, `'${e.id}' must name the real blocker`)
          .to.eq('Finish your current action first');
      }
    });

    it('…and says nothing extra once there is nothing set aside', () => {
      const entries = buildLtQuickEntries(ctx({blockedReason: ''}));
      const std = entries.find((e) => e.id === 'standardProjects');
      expect(std?.available, 'the server offers it, so it is offered').to.eq(true);
      const plants = entries.find((e) => e.id === 'convertPlants');
      expect(plants?.reason, 'and a real arithmetic blocker still speaks').to.eq('Not enough plants');
    });

    it('every basic action carries a VISUAL (barIcon | iconClass | glyph) — no blank slot', () => {
      // Skip / Pass had none — blank squares in the wheel (visible on a TV).
      for (const e of buildLtQuickEntries(ctx())) {
        const hasVisual = e.barIcon !== undefined || e.iconClass !== undefined || e.glyph !== undefined;
        expect(hasVisual, `slot '${e.id}' has no visual`).to.eq(true);
      }
    });

    it('skip turn is distinct from pass and explains its own availability', () => {
      const bySlot = new Map(buildLtQuickEntries(ctx()).map((e) => [e.slot, e]));
      expect(bySlot.get('up')?.available).to.eq(false);
      expect(bySlot.get('up')?.reason).to.eq('Available after your first action this round');
      expect(bySlot.get('down')?.available).to.eq(true);
    });

    it('genuine opponent turn: every blocked entry reads «not your turn»', () => {
      const entries = buildLtQuickEntries(ctx({
        myTurn: false, awaitingInput: false, stdAvailable: false, passAvailable: false, convertHeatAvailable: false,
      }));
      for (const e of entries.filter((x) => !x.available)) {
        expect(e.reason).to.eq('Not your turn to take any actions');
      }
    });

    it('mid a mandatory decision (menu withheld, server still awaits me): «finish your current action first»', () => {
      const entries = buildLtQuickEntries(ctx({
        myTurn: false, awaitingInput: true, stdAvailable: false, passAvailable: false, convertHeatAvailable: false,
      }));
      for (const e of entries.filter((x) => !x.available)) {
        expect(e.reason).to.eq('Finish your current action first');
      }
    });

    it('on-turn conversion blockers name the resource', () => {
      const bySlot = new Map(buildLtQuickEntries(ctx()).map((e) => [e.slot, e]));
      expect(bySlot.get('left')?.reason).to.eq('Not enough plants');
    });

    /* SOFT vs HARD blockers — presentation semantics, one source.
     * Every LT gate is an EXECUTION gate (turn order / parked decision /
     * arithmetic a turn changes) → `soft: true`: the tile keeps presence.
     * RT's structural absences («Not in this game», the reserved Voting
     * slot) stay hard — a de-energized plate is the honest pose there. */
    it('every LT blocker is SOFT; RT structural absences stay HARD', () => {
      for (const e of buildLtQuickEntries(ctx({
        blockedReason: 'Finish your current action first',
      }))) {
        expect(e.soft, `'${e.id}' is a temporary gate`).to.eq(true);
      }
      for (const e of buildLtQuickEntries(ctx({
        myTurn: false, awaitingInput: false, stdAvailable: false, passAvailable: false, convertHeatAvailable: false,
      })).filter((x) => !x.available)) {
        expect(e.soft, `'${e.id}' off-turn is a temporary gate`).to.eq(true);
      }
      const rt = buildRtQuickEntries({
        cardsPlayable: 0, cardsTotal: 0, actionsAvailable: 0, tradesAvailable: 0, hydroAvailable: 0,
        hasColonies: false, hasTurmoil: false, hasHydro: false,
      });
      for (const e of rt.filter((x) => !x.available)) {
        expect(e.soft, `'${e.id}' is a structural absence`).to.eq(undefined);
      }
    });
  });

  describe('Standard-Projects screen rows', () => {
    /* Same rule one surface over: the screen may be OPENED and read while a
     * decision is set aside, but no row on it may be started, and every row
     * says the same true thing instead of its own price arithmetic. */
    it('a set-aside decision blocks every row, patent sale included', () => {
      const items = buildStdProjectItems({
        cards: [{name: CardName.POWER_PLANT_STANDARD_PROJECT, calculatedCost: 11}],
        blockedReason: 'Finish your current action first',
        myTurn: true,
        awaitingInput: true,
        myMegacredits: 500,
        sellAvailable: true,
        cardsInHand: 4,
      });
      for (const item of items) {
        expect(item.available, `'${item.key}' must not be startable`).to.eq(false);
        expect(item.reason, `'${item.key}' must name the real blocker`)
          .to.eq('Finish your current action first');
      }
    });

    it('leads with Patent sale, then the server cards (canonical order)', () => {
      const items = buildStdProjectItems({
        cards: [
          {name: CardName.POWER_PLANT_STANDARD_PROJECT, calculatedCost: 11},
          {name: CardName.ASTEROID_STANDARD_PROJECT, calculatedCost: 14, isDisabled: true},
        ],
        myTurn: true,
        awaitingInput: true,
        myMegacredits: 12,
        sellAvailable: true,
        cardsInHand: 4,
      });
      expect(items.map((i) => i.key)).to.deep.eq([
        'sell-patents',
        CardName.POWER_PLANT_STANDARD_PROJECT,
        CardName.ASTEROID_STANDARD_PROJECT,
      ]);
      const sell = items[0];
      expect(sell.available).to.eq(true);
      expect(sell.gain).to.eq('+1');
      expect(sell.title).to.eq('Patent sale');
    });

    it('a disabled project names the CONCRETE M€ deficit', () => {
      const items = buildStdProjectItems({
        cards: [{name: CardName.ASTEROID_STANDARD_PROJECT, calculatedCost: 14, isDisabled: true}],
        myTurn: true,
        awaitingInput: true,
        myMegacredits: 12,
        sellAvailable: false,
        cardsInHand: 0,
      });
      // items[0] is Patent sale now; the server project is items[1].
      expect(items[1].reason).to.eq('Need ${0} more M€');
      expect(items[1].reasonParams).to.deep.eq(['2']);
    });

    it('the SERVER reason wins over the client M€ guess', () => {
      const items = buildStdProjectItems({
        cards: [{
          name: CardName.BUILD_COLONY_STANDARD_PROJECT,
          calculatedCost: 17,
          isDisabled: true,
          // The real blocker: no open colony slot. The client's own guess would
          // have said "Need 5 more M€" and been wrong.
          actionReasons: [{type: 'target', message: 'Every colony tile is full', current: 5}],
        }],
        myTurn: true,
        awaitingInput: true,
        myMegacredits: 12,
        sellAvailable: false,
        cardsInHand: 0,
      });
      expect(items[1].reason).to.eq('Every colony tile is full');
      expect(items[1].reasonParams).to.eq(undefined);
    });

    it('carries the server reason PARAMS through', () => {
      const items = buildStdProjectItems({
        cards: [{
          name: CardName.BUILD_COLONY_STANDARD_PROJECT,
          calculatedCost: 17,
          isDisabled: true,
          actionReasons: [{
            type: 'target',
            message: 'No colony has a free slot for you: ${0} full, ${1} already yours',
            params: ['3', '2'],
          }],
        }],
        myTurn: true,
        awaitingInput: true,
        myMegacredits: 500,
        sellAvailable: false,
        cardsInHand: 0,
      });
      expect(items[1].reasonParams).to.deep.eq(['3', '2']);
    });

    it('passes the server preview/warnings through and derives the GENERIC discount', () => {
      const items = buildStdProjectItems({
        cards: [{
          // Venus-variant Air Scrapping: printed 15 (client manifest), the
          // server already folded the tag discount into calculatedCost — the
          // row derives `−3` from the one subtraction, no per-project case.
          name: CardName.AIR_SCRAPPING_STANDARD_PROJECT_VARIANT,
          calculatedCost: 12,
          warnings: ['maxvenus'],
          standardProjectPreview: {
            effects: [{direction: 'gain', icon: 'venus', amount: 2, current: 26, resulting: 28, unit: '%'}],
          },
        }],
        myTurn: true,
        awaitingInput: true,
        myMegacredits: 500,
        sellAvailable: false,
        cardsInHand: 0,
      });
      const row = items[1];
      expect(row.cost).to.eq(12);
      expect(row.discount).to.eq(3);
      expect(row.warnings).to.deep.eq(['maxvenus']);
      expect(row.preview?.effects[0].icon).to.eq('venus');
      // No saving → no capsule at all (never an empty/zero block).
      const plain = buildStdProjectItems({
        cards: [{name: CardName.ASTEROID_STANDARD_PROJECT, calculatedCost: 14}],
        myTurn: true, awaitingInput: true, myMegacredits: 500, sellAvailable: false, cardsInHand: 0,
      });
      expect(plain[1].discount).to.eq(undefined);
    });

    it('patent sale is blocked honestly (opponent turn vs mid-action vs empty hand)', () => {
      const noTurn = buildStdProjectItems({cards: [], myTurn: false, awaitingInput: false, myMegacredits: 0, sellAvailable: false, cardsInHand: 3});
      expect(noTurn[0].reason).to.eq('Not your turn to take any actions');
      const midAction = buildStdProjectItems({cards: [], myTurn: false, awaitingInput: true, myMegacredits: 0, sellAvailable: false, cardsInHand: 3});
      expect(midAction[0].reason).to.eq('Finish your current action first');
      const noCards = buildStdProjectItems({cards: [], myTurn: true, awaitingInput: true, myMegacredits: 0, sellAvailable: true, cardsInHand: 0});
      expect(noCards[0].reason).to.eq('No cards in hand');
    });
  });

  // (The right-rail Milestones/Awards HUD projection has its own model —
  // consoleMaHudModel — and its own spec: consoleMaHudModel.spec.ts.)
});
