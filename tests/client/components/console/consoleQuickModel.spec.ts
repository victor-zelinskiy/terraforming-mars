import {expect} from 'chai';
import {
  buildRtQuickEntries,
  buildLtQuickEntries,
  buildStdProjectItems,
  buildHomeMaSummary,
  QUICK_SLOT_GLYPH,
} from '@/client/console/consoleQuickModel';
import {ConsoleMaSource} from '@/client/components/console/consoleMaModel';
import {CardName} from '@/common/cards/CardName';
import type {Color} from '@/common/Color';

/**
 * P27: the main-board command model view-models — the RT/LT quick-selector
 * entries (slot map + honest reasons), the premium Standard-Projects rows
 * (Patent sale as a first-class basic action, M€ deficits named) and the
 * right home panel's strategic Milestones/Awards summary (claimed-by /
 * leaders / slots left). All pure — guarded here without a DOM.
 */
describe('consoleQuickModel (P27)', () => {
  const me: Color = 'red';
  const rival: Color = 'blue';

  describe('RT — action categories', () => {
    it('maps the spec slots: Cards center, Card actions up, Trading right, Voting down, Hydro left', () => {
      const entries = buildRtQuickEntries({
        cardsPlayable: 3, cardsTotal: 5, actionsAvailable: 2,
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

    it('keeps unavailable categories VISIBLE with honest reasons', () => {
      const entries = buildRtQuickEntries({
        cardsPlayable: 0, cardsTotal: 0, actionsAvailable: 0,
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
        cardsPlayable: 0, cardsTotal: 0, actionsAvailable: 0,
        hasColonies: true, hasTurmoil: true, hasHydro: false,
      });
      const voting = entries.find((e) => e.id === 'voting');
      expect(voting?.reason).to.eq('Voting arrives with a future update');
    });

    it('every slot has a glyph mapping', () => {
      for (const e of buildRtQuickEntries({cardsPlayable: 0, cardsTotal: 0, actionsAvailable: 0, hasColonies: true, hasTurmoil: false, hasHydro: true})) {
        expect(QUICK_SLOT_GLYPH[e.slot]).to.not.eq(undefined);
      }
    });
  });

  describe('LT — basic actions', () => {
    const ctx = (over: Partial<Parameters<typeof buildLtQuickEntries>[0]> = {}) => ({
      myTurn: true,
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

    it('off-turn: every blocked entry names the turn as the reason', () => {
      const entries = buildLtQuickEntries(ctx({
        myTurn: false, stdAvailable: false, passAvailable: false, convertHeatAvailable: false,
      }));
      for (const e of entries.filter((x) => !x.available)) {
        expect(e.reason).to.eq('Not your turn to take any actions');
      }
    });

    it('on-turn conversion blockers name the resource', () => {
      const bySlot = new Map(buildLtQuickEntries(ctx()).map((e) => [e.slot, e]));
      expect(bySlot.get('left')?.reason).to.eq('Not enough plants');
    });
  });

  describe('Standard-Projects screen rows', () => {
    it('leads with Patent sale, then the server cards (canonical order)', () => {
      const items = buildStdProjectItems({
        cards: [
          {name: CardName.POWER_PLANT_STANDARD_PROJECT, calculatedCost: 11},
          {name: CardName.ASTEROID_STANDARD_PROJECT, calculatedCost: 14, isDisabled: true},
        ],
        myTurn: true,
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
        myMegacredits: 12,
        sellAvailable: false,
        cardsInHand: 0,
      });
      // items[0] is Patent sale now; the server project is items[1].
      expect(items[1].reason).to.eq('Need ${0} more M€');
      expect(items[1].reasonParams).to.deep.eq(['2']);
    });

    it('patent sale is blocked honestly (turn vs empty hand)', () => {
      const noTurn = buildStdProjectItems({cards: [], myTurn: false, myMegacredits: 0, sellAvailable: false, cardsInHand: 3});
      expect(noTurn[0].reason).to.eq('Not your turn to take any actions');
      const noCards = buildStdProjectItems({cards: [], myTurn: true, myMegacredits: 0, sellAvailable: true, cardsInHand: 0});
      expect(noCards[0].reason).to.eq('No cards in hand');
    });
  });

  describe('home Milestones/Awards summary', () => {
    const source = (over: Partial<ConsoleMaSource>): ConsoleMaSource => ({
      name: 'Mayor',
      playerName: undefined,
      color: undefined,
      scores: [],
      ...over,
    });

    it('claimed rows carry the claimant and sort first; slots derive', () => {
      const summary = buildHomeMaSummary('milestones', [
        source({name: 'Mayor', scores: [{color: me, score: 1}]}),
        source({name: 'Terraformer', playerName: 'Vika', color: rival, scores: []}),
      ], {myColor: me, availableNow: new Set(), maxSlots: 3});
      expect(summary.rows[0].name).to.eq('Terraformer');
      expect(summary.rows[0].takenBy).to.deep.eq({color: rival, name: 'Vika'});
      expect(summary.slotsLeft).to.eq(2);
      expect(summary.takenCount).to.eq(1);
    });

    it('milestones expose MY progress toward the threshold', () => {
      const summary = buildHomeMaSummary('milestones', [
        source({name: 'Mayor', threshold: 3, scores: [{color: me, score: 2}, {color: rival, score: 3}]}),
      ], {myColor: me, availableNow: new Set(), maxSlots: 3});
      expect(summary.rows[0].my).to.deep.eq({score: 2, threshold: 3, ready: false});
    });

    it('awards expose the live race leaders (ties included)', () => {
      const summary = buildHomeMaSummary('awards', [
        source({name: 'Banker', scores: [{color: me, score: 4}, {color: rival, score: 4}]}),
      ], {myColor: me, availableNow: new Set(), maxSlots: 3});
      expect(summary.rows[0].leaders).to.have.length(2);
      expect(summary.rows[0].leaders?.[0].score).to.eq(4);
    });

    it('awards KEEP the live leader after funding (funder is not necessarily the scorer)', () => {
      const summary = buildHomeMaSummary('awards', [
        source({name: 'Banker', playerName: 'Vika', color: rival,
          scores: [{color: me, score: 5}, {color: rival, score: 2}]}),
      ], {myColor: me, availableNow: new Set(), maxSlots: 3});
      const row = summary.rows[0];
      // Funder is preserved …
      expect(row.takenBy).to.deep.eq({color: rival, name: 'Vika'});
      // … AND the live leader (a DIFFERENT player) still shows.
      expect(row.leaders).to.deep.eq([{color: me, score: 5}]);
    });

    it('actionable counts only OPEN entries offered right now', () => {
      const summary = buildHomeMaSummary('awards', [
        source({name: 'Banker'}),
        source({name: 'Thermalist', playerName: 'Vika', color: rival}),
      ], {myColor: me, availableNow: new Set(['Banker', 'Thermalist']), maxSlots: 3});
      expect(summary.actionable).to.eq(1);
    });
  });
});
