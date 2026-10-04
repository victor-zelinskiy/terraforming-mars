/*
 * «THE LEDGER PAYS» — the payout of a CARD that gains «all your colony bonuses»
 * (src/client/console/colonyLedger/colonyBonusPayout.ts — TR23 Habitat Science).
 * Pins the module's laws:
 *
 *  1. THE PLAN IS FROZEN AT THE PRESS — the rows in the server's order, the
 *     amounts by cubes, the targets as the composer collected them.
 *  2. SEEDING — the supply rows with the press's answer; a resource onto a card
 *     with the response that actually carries it (the amount is the plan's);
 *     a batch is tallied once.
 *  3. THE PARK — scoped to the payout's own batches (`via`), released by the
 *     walk standing on the row, never touching anybody else's draw.
 *  4. SETTLE — a draw / pairs row finishes on server facts.
 *  5. EVERY END releases what the rail still holds.
 */
import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {CardResource} from '@/common/CardResource';
import {ColonyBenefit} from '@/common/colonies/ColonyBenefit';
import {ColonyName} from '@/common/colonies/ColonyName';
import {Resource} from '@/common/Resource';
import {AllColonyBonusesModel, ColonyLedgerEntryModel} from '@/common/models/ColonyBonusLedgerModel';
import {CardDrawRevealSource} from '@/common/models/CardDrawRevealModel';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {
  armColonyBonusPayout, COLONY_LEDGER_STAGE, colonyBonusPayout, colonyBonusPayoutArmed, colonyBonusPayoutLive, colonyBonusPayoutOf,
  colonyBonusPayoutParksReveal, finishColonyBonusPayout, markPayoutRowLanded, nextPayoutRow, payoutDiscardDue, PayoutFacts,
  payoutPromptColony, payoutRowSettled, payoutRowsOf, payoutServerOwes, payoutUntaken, resetColonyBonusPayout, seedColonyBonusPayoutHolds,
} from '@/client/console/colonyLedger/colonyBonusPayout';
import {drawnCardsState} from '@/client/components/drawnCards/drawnCardsState';
import {clearPanelRewardHold, heldCardResource, heldStock} from '@/client/console/resourceTransfer/consoleResourceTransfer';

const HS = CardName.HABITAT_SCIENCE;

const LUNA: ColonyLedgerEntryModel = {colony: ColonyName.LUNA, grant: {benefit: ColonyBenefit.GAIN_RESOURCES, quantity: 2, resource: Resource.MEGACREDITS}, description: 'Gain 2 M€', cubes: 1};
const MIRANDA: ColonyLedgerEntryModel = {colony: ColonyName.MIRANDA, grant: {benefit: ColonyBenefit.DRAW_CARDS, quantity: 1}, description: 'Draw 1 card', cubes: 1, asks: 'draw'};
const PLUTO: ColonyLedgerEntryModel = {colony: ColonyName.PLUTO, grant: {benefit: ColonyBenefit.DRAW_CARDS_AND_DISCARD_ONE, quantity: 1}, description: 'Draw 1 card and then discard 1 card', cubes: 1, asks: 'draw-discard'};
const TITAN: ColonyLedgerEntryModel = {colony: ColonyName.TITAN, grant: {benefit: ColonyBenefit.ADD_RESOURCES_TO_CARD, quantity: 1, cardResource: CardResource.FLOATER}, description: 'Add 1 floater to ANY card', cubes: 1, asks: 'card'};

/** The reference table's ledger, in the order the engine pays: Luna · Miranda · Pluto · Titan. */
const LEDGER: AllColonyBonusesModel = {entries: [LUNA, MIRANDA, PLUTO, TITAN]};

function view(age: number, opts: {mc?: number, floaters?: number, data?: number, reveals?: Array<{id: number, source: CardDrawRevealSource, cards: number}>, waitingFor?: PlayerInputModel} = {}): PlayerViewModel {
  return {
    game: {gameAge: age},
    thisPlayer: {
      megaCredits: opts.mc ?? 0,
      tableau: [
        {name: CardName.DIRIGIBLES, resources: opts.floaters ?? 0},
        {name: HS, resources: opts.data ?? 4},
      ],
    },
    cardDrawReveals: (opts.reveals ?? []).map((r) => ({id: r.id, source: r.source, cards: Array.from({length: r.cards}, () => ({name: CardName.ANTS}))})),
    waitingFor: opts.waitingFor,
  } as unknown as PlayerViewModel;
}

const viaSource = (colony: ColonyName, via: CardName = HS): CardDrawRevealSource => ({type: 'colony', colonyName: colony, via});

function facts(over: Partial<PayoutFacts> = {}): PayoutFacts {
  return {waitingFor: undefined, untaken: () => 0, inFlight: false, ...over};
}

function discardOf(colony: ColonyName, index = 1, total = 1, card: CardName = HS): PlayerInputModel {
  return {type: 'card', discardPrompt: {min: 1, max: 1, source: {kind: 'card', card}, colonyRepeat: {colonyName: colony, index, total}}} as unknown as PlayerInputModel;
}

describe('colonyBonusPayout — «the ledger pays»', () => {
  beforeEach(() => {
    resetColonyBonusPayout();
    clearPanelRewardHold();
  });
  after(() => {
    resetColonyBonusPayout();
    clearPanelRewardHold();
  });

  describe('payoutRowsOf — the plan, frozen at the press', () => {
    it('one row per ledger entry, IN THE LEDGER\'S ORDER, each paying by its shape', () => {
      const rows = payoutRowsOf(LEDGER, [CardName.DIRIGIBLES]);
      expect(rows.map((r) => [r.colony, r.kind, r.state, r.cards])).deep.eq([
        ['Luna', 'chips', 'pending', 0],
        ['Miranda', 'draw', 'pending', 1],
        ['Pluto', 'pairs', 'pending', 1],
        ['Titan', 'chips', 'pending', 0],
      ]);
      expect(rows[0].specs).deep.eq([{channel: 'stock', resource: 'megacredits', amount: 2}]);
      expect(rows[3].specs).deep.eq([{channel: 'card-resource', resource: 'floater', amount: 1, targetCard: CardName.DIRIGIBLES}]);
    });

    it('every cube pays: two cubes on Luna are ONE chip of 4, two on Pluto are 2 pairs, two on Miranda 2 cards', () => {
      const rows = payoutRowsOf({entries: [{...LUNA, cubes: 2}, {...MIRANDA, cubes: 2}, {...PLUTO, cubes: 2}]}, []);
      expect(rows[0].specs[0].amount).eq(4);
      expect(rows[1].cards).eq(2);
      expect(rows[2].cards).eq(2);
    });

    it('`times` (Yvonne\'s «twice») multiplies like a cube', () => {
      expect(payoutRowsOf({entries: [LUNA], times: 2}, [])[0].specs[0].amount).eq(4);
    });

    it('a resource onto a card takes ONE target per cube, in the composer\'s order — the same card merges, two cards are two chips', () => {
      const two = {...TITAN, cubes: 2};
      const same = payoutRowsOf({entries: [two]}, [CardName.DIRIGIBLES, CardName.DIRIGIBLES]);
      expect(same[0].specs).deep.eq([{channel: 'card-resource', resource: 'floater', amount: 2, targetCard: CardName.DIRIGIBLES}]);
      const split = payoutRowsOf({entries: [two]}, [CardName.DIRIGIBLES, CardName.ATMO_COLLECTORS]);
      expect(split[0].specs.map((s) => [s.targetCard, s.amount])).deep.eq([[CardName.DIRIGIBLES, 1], [CardName.ATMO_COLLECTORS, 1]]);
    });

    it('a row the server refused (no holder) is SKIPPED — it takes no target and flies nothing', () => {
      const rows = payoutRowsOf({entries: [{...TITAN, asks: undefined, skipped: {reason: 'No card can hold floaters', amount: 1}}, LUNA]}, []);
      expect(rows.map((r) => [r.colony, r.kind, r.state])).deep.eq([['Titan', 'skipped', 'skipped'], ['Luna', 'chips', 'pending']]);
      expect(rows[0].specs).deep.eq([]);
    });

    it('a target the composer could not collect leaves the row chip-less (the live prompt asks), never a guessed card', () => {
      expect(payoutRowsOf({entries: [TITAN]}, [])[0]).deep.include({kind: 'other', specs: []});
    });
  });

  describe('the state: armed from the press to the scene\'s end, keyed by the CARD', () => {
    it('armed · live · of — and `done` ends «live» while the record still stands', () => {
      expect(colonyBonusPayoutArmed()).is.false;
      armColonyBonusPayout(HS, payoutRowsOf(LEDGER, [CardName.DIRIGIBLES]), 2);
      expect(colonyBonusPayoutArmed()).is.true;
      expect(colonyBonusPayoutLive()).is.true;
      expect(colonyBonusPayoutOf(HS)).is.true;
      expect(colonyBonusPayoutOf(CardName.PRODUCTIVE_OUTPOST), 'another card\'s press is not this payout').is.false;
      expect(colonyBonusPayoutOf('')).is.false;
      finishColonyBonusPayout();
      expect(colonyBonusPayoutLive()).is.false;
      expect(colonyBonusPayoutArmed()).is.true;
      resetColonyBonusPayout();
      expect(colonyBonusPayoutArmed()).is.false;
    });
  });

  describe('seedColonyBonusPayoutHolds — the apply block', () => {
    it('is a no-op with nothing armed', () => {
      seedColonyBonusPayoutHolds(view(1), view(2, {mc: 2}));
      expect(heldStock('megacredits')).eq(0);
      expect(colonyBonusPayout.answered).is.false;
    });

    it('THE ANSWER seeds the supply row (the rail keeps the pre-payout number); the resource onto a card is NOT there yet — it waits behind Pluto\'s discard', () => {
      armColonyBonusPayout(HS, payoutRowsOf(LEDGER, [CardName.DIRIGIBLES]), 2);
      seedColonyBonusPayoutHolds(view(1, {mc: 0, data: 4}), view(2, {
        mc: 2, data: 2,
        reveals: [{id: 11, source: viaSource(ColonyName.MIRANDA), cards: 1}, {id: 12, source: viaSource(ColonyName.PLUTO), cards: 1}],
        waitingFor: discardOf(ColonyName.PLUTO),
      }));
      expect(colonyBonusPayout.answered).is.true;
      expect(heldStock('megacredits'), 'Luna\'s 2 M€ are held until its chip lands').eq(2);
      expect(heldCardResource('floater'), 'Titan has not been paid by the server yet').eq(0);
      expect(colonyBonusPayout.rows.map((r) => r.ready)).deep.eq([true, false, false, false]);
      expect(colonyBonusPayout.drawn).deep.eq({Miranda: 1, Pluto: 1});
    });

    it('…and the response that CARRIES the floater seeds its row — the diff is the trigger, the amount is the plan\'s', () => {
      armColonyBonusPayout(HS, payoutRowsOf(LEDGER, [CardName.DIRIGIBLES]), 2);
      seedColonyBonusPayoutHolds(view(1, {floaters: 0}), view(2, {mc: 2, floaters: 0}));
      seedColonyBonusPayoutHolds(view(2, {mc: 2, floaters: 0}), view(3, {mc: 2, floaters: 1}));
      expect(colonyBonusPayout.rows[3].ready).is.true;
      expect(heldCardResource('floater')).eq(1);
      // An echo of the same view seeds nothing twice.
      seedColonyBonusPayoutHolds(view(3, {mc: 2, floaters: 1}), view(3, {mc: 2, floaters: 1}));
      expect(heldCardResource('floater')).eq(1);
      expect(heldStock('megacredits')).eq(2);
    });

    it('a resource landing with the FIRST answer (no pair in front of it) is seeded at once', () => {
      armColonyBonusPayout(HS, payoutRowsOf({entries: [LUNA, TITAN]}, [CardName.DIRIGIBLES]), 2);
      seedColonyBonusPayoutHolds(view(1, {floaters: 0}), view(2, {mc: 2, floaters: 1}));
      expect(colonyBonusPayout.rows.map((r) => r.ready)).deep.eq([true, true]);
    });

    it('a resource onto the SOURCE card itself is read past the press\'s own cost (data 4 − 2 + 1 = 3)', () => {
      const data: ColonyLedgerEntryModel = {...TITAN, colony: ColonyName.IAPETUS_II, grant: {benefit: ColonyBenefit.ADD_RESOURCES_TO_CARD, quantity: 1, cardResource: CardResource.DATA}};
      armColonyBonusPayout(HS, payoutRowsOf({entries: [data]}, [HS]), 2);
      seedColonyBonusPayoutHolds(view(1, {data: 4}), view(2, {data: 3}));
      expect(colonyBonusPayout.rows[0].ready).is.true;
      expect(heldCardResource('data')).eq(1);
    });

    it('a batch is tallied ONCE for its colony — a later view still carrying it adds nothing; a foreign batch is never counted', () => {
      armColonyBonusPayout(HS, payoutRowsOf(LEDGER, [CardName.DIRIGIBLES]), 2);
      const reveals = [
        {id: 11, source: viaSource(ColonyName.MIRANDA), cards: 1},
        {id: 40, source: {type: 'colony', colonyName: ColonyName.PLUTO} as CardDrawRevealSource, cards: 1},
        {id: 41, source: viaSource(ColonyName.PLUTO, CardName.PRODUCTIVE_OUTPOST), cards: 1},
      ];
      seedColonyBonusPayoutHolds(view(1), view(2, {reveals}));
      seedColonyBonusPayoutHolds(view(2, {reveals}), view(2, {reveals}));
      expect(colonyBonusPayout.drawn).deep.eq({Miranda: 1});
    });
  });

  describe('colonyBonusPayoutParksReveal — a row\'s batch waits for its turn', () => {
    it('parks the payout\'s own batch until the walk stands on its row — and nobody else\'s', () => {
      armColonyBonusPayout(HS, payoutRowsOf(LEDGER, [CardName.DIRIGIBLES]), 2);
      expect(colonyBonusPayoutParksReveal(viaSource(ColonyName.MIRANDA))).is.true;
      expect(colonyBonusPayoutParksReveal({type: 'colony', colonyName: ColonyName.MIRANDA}), 'a trade\'s / build\'s batch keeps its surface').is.false;
      expect(colonyBonusPayoutParksReveal(viaSource(ColonyName.MIRANDA, CardName.PRODUCTIVE_OUTPOST)), 'another card\'s payout').is.false;
      expect(colonyBonusPayoutParksReveal({type: 'card', cardName: HS})).is.false;
      expect(colonyBonusPayoutParksReveal(undefined)).is.false;
      colonyBonusPayout.active = 'Miranda';
      expect(colonyBonusPayoutParksReveal(viaSource(ColonyName.MIRANDA)), 'its row is up').is.false;
      expect(colonyBonusPayoutParksReveal(viaSource(ColonyName.PLUTO)), 'the next row still waits').is.true;
    });

    it('parks nothing once the payout is over, and nothing with no payout armed', () => {
      expect(colonyBonusPayoutParksReveal(viaSource(ColonyName.MIRANDA))).is.false;
      armColonyBonusPayout(HS, payoutRowsOf(LEDGER, []), 2);
      finishColonyBonusPayout();
      expect(colonyBonusPayoutParksReveal(viaSource(ColonyName.MIRANDA))).is.false;
    });
  });

  describe('the walk\'s facts', () => {
    it('payoutPromptColony: the discard (the card as its source + `colonyRepeat`) and the target (`via`) name their row — a trade\'s own never does', () => {
      expect(payoutPromptColony(discardOf(ColonyName.PLUTO), HS)).eq('Pluto');
      expect(payoutPromptColony(discardOf(ColonyName.PLUTO, 1, 1, CardName.PRODUCTIVE_OUTPOST), HS), 'another card\'s discard').is.undefined;
      const colonyBonus = {type: 'card', discardPrompt: {min: 1, max: 1, source: {kind: 'colony'}, colonyBonus: {colonyName: ColonyName.PLUTO, index: 1, total: 1}}} as unknown as PlayerInputModel;
      expect(payoutPromptColony(colonyBonus, HS), 'the colony workspace\'s discard').is.undefined;
      const target = {type: 'card', choiceContext: {source: {kind: 'colony', name: 'Titan', via: HS}}} as unknown as PlayerInputModel;
      expect(payoutPromptColony(target, HS)).eq('Titan');
      expect(payoutPromptColony(undefined, HS)).is.undefined;
      expect(payoutPromptColony(target, '')).is.undefined;
    });

    it('a DRAW row settles when every promised card is drawn and taken', () => {
      armColonyBonusPayout(HS, payoutRowsOf(LEDGER, [CardName.DIRIGIBLES]), 2);
      const miranda = colonyBonusPayout.rows[1];
      expect(payoutRowSettled(miranda, facts()), 'nothing drawn yet').is.false;
      colonyBonusPayout.drawn = {Miranda: 1};
      expect(payoutRowSettled(miranda, facts({untaken: (c) => c === 'Miranda' ? 1 : 0})), 'the card is still on the table').is.false;
      expect(payoutRowSettled(miranda, facts({inFlight: true})), 'a request is in flight').is.false;
      expect(payoutRowSettled(miranda, facts())).is.true;
    });

    it('a PAIRS row settles only once its discard is answered too', () => {
      armColonyBonusPayout(HS, payoutRowsOf({entries: [{...PLUTO, cubes: 2}]}, []), 2);
      const pluto = colonyBonusPayout.rows[0];
      colonyBonusPayout.drawn = {Pluto: 1};
      expect(payoutRowSettled(pluto, facts({waitingFor: discardOf(ColonyName.PLUTO, 1, 2)})), 'pair 1: the discard stands').is.false;
      expect(payoutRowSettled(pluto, facts()), 'pair 2 has not been drawn').is.false;
      colonyBonusPayout.drawn = {Pluto: 2};
      expect(payoutRowSettled(pluto, facts({waitingFor: discardOf(ColonyName.PLUTO, 2, 2)}))).is.false;
      expect(payoutRowSettled(pluto, facts())).is.true;
    });

    it('payoutServerOwes: a prompt of the payout\'s, an untaken batch or a request in flight — a reading player is not a stall', () => {
      armColonyBonusPayout(HS, payoutRowsOf(LEDGER, [CardName.DIRIGIBLES]), 2);
      expect(payoutServerOwes(facts())).is.false;
      expect(payoutServerOwes(facts({inFlight: true}))).is.true;
      expect(payoutServerOwes(facts({waitingFor: discardOf(ColonyName.PLUTO)}))).is.true;
      expect(payoutServerOwes(facts({untaken: (c) => c === 'Pluto' ? 1 : 0}))).is.true;
    });

    /**
     * THE DISCARD IS OWED LONG BEFORE IT IS DUE. The engine raises Pluto's discard with the press's own answer —
     * its queue runs the pair ahead of anything the player has been shown — while Luna's chips are still in the
     * air and Miranda's card has not been taken. The hand's door and the crumb's «СБРОС» ask ONE fact, and it is
     * true only when the walk stands on that tile's row with the pair's card drawn AND taken.
     */
    it('payoutDiscardDue: the walk stands on the tile\'s row, its pair\'s card is drawn and taken — never merely «the prompt stands»', () => {
      armColonyBonusPayout(HS, payoutRowsOf(LEDGER, [CardName.DIRIGIBLES]), 2);
      const asked = discardOf(ColonyName.PLUTO);
      colonyBonusPayout.drawn = {Miranda: 1, Pluto: 1};
      expect(payoutDiscardDue(facts({waitingFor: asked})), 'Luna is paying: the prompt stands, the step is not due').is.false;
      colonyBonusPayout.active = 'Miranda';
      expect(payoutDiscardDue(facts({waitingFor: asked})), 'Miranda\'s take is on: not due').is.false;
      colonyBonusPayout.active = 'Pluto';
      expect(payoutDiscardDue(facts({waitingFor: asked, untaken: (c) => c === 'Pluto' ? 1 : 0})), 'Pluto\'s card is still on the table').is.false;
      expect(payoutDiscardDue(facts({waitingFor: asked})), 'taken — the discard is the step the walk stands on').is.true;
      expect(payoutDiscardDue(facts()), 'no prompt').is.false;
      const target = {type: 'card', choiceContext: {source: {kind: 'colony', name: 'Pluto', via: HS}}} as unknown as PlayerInputModel;
      expect(payoutDiscardDue(facts({waitingFor: target})), 'a target pick of the payout is not a discard').is.false;
      expect(payoutDiscardDue(facts({waitingFor: discardOf(ColonyName.PLUTO, 1, 1, CardName.PRODUCTIVE_OUTPOST)})), 'another card\'s discard').is.false;
    });

    it('…and by PAIR: the second discard of a two-cube tile is due only once the second card is drawn', () => {
      armColonyBonusPayout(HS, payoutRowsOf({entries: [{...PLUTO, cubes: 2}]}, []), 2);
      colonyBonusPayout.active = 'Pluto';
      colonyBonusPayout.drawn = {Pluto: 1};
      expect(payoutDiscardDue(facts({waitingFor: discardOf(ColonyName.PLUTO, 1, 2)}))).is.true;
      expect(payoutDiscardDue(facts({waitingFor: discardOf(ColonyName.PLUTO, 2, 2)})), 'pair 2 asked, its card not seen yet').is.false;
      colonyBonusPayout.drawn = {Pluto: 2};
      expect(payoutDiscardDue(facts({waitingFor: discardOf(ColonyName.PLUTO, 2, 2)}))).is.true;
    });

    it('payoutUntaken: the reveal queue\'s own count of the payout\'s cards for a tile — never a foreign batch, never a dismissed one', () => {
      const event = (id: number, source: CardDrawRevealSource, cards: number, taken: Array<number> = [], dismissed = false) =>
        ({id, source, cards: Array.from({length: cards}, () => ({name: CardName.ANTS})), takenIndices: new Set(taken), dismissed});
      const before = drawnCardsState.events;
      try {
        armColonyBonusPayout(HS, payoutRowsOf(LEDGER, [CardName.DIRIGIBLES]), 2);
        drawnCardsState.events = [
          event(1, viaSource(ColonyName.MIRANDA), 1),
          event(2, viaSource(ColonyName.PLUTO), 1, [0]),
          event(3, viaSource(ColonyName.PLUTO, CardName.PRODUCTIVE_OUTPOST), 1),
          event(4, {type: 'colony', colonyName: ColonyName.PLUTO} as CardDrawRevealSource, 1),
          event(5, viaSource(ColonyName.MIRANDA), 2, [], true),
        ] as unknown as typeof drawnCardsState.events;
        expect(payoutUntaken('Miranda'), 'one card on the table (the dismissed batch is gone)').eq(1);
        expect(payoutUntaken('Pluto'), 'the payout\'s own card is taken; another card\'s and a trade\'s are not counted').eq(0);
        expect(payoutUntaken('Luna')).eq(0);
        resetColonyBonusPayout();
        expect(payoutUntaken('Miranda'), 'no payout armed — nothing is the payout\'s').eq(0);
      } finally {
        drawnCardsState.events = before;
      }
    });

    it('the stage\'s one word — the crumb\'s tail and the bar\'s context read the same key', () => {
      expect(COLONY_LEDGER_STAGE).eq('Colony bonuses');
    });

    it('nextPayoutRow walks in order past the paid and the skipped', () => {
      armColonyBonusPayout(HS, payoutRowsOf({entries: [{...TITAN, asks: undefined, skipped: {reason: 'x', amount: 1}}, LUNA, MIRANDA]}, []), 2);
      expect(nextPayoutRow()?.colony).eq('Luna');
      colonyBonusPayout.rows[1].state = 'paid';
      expect(nextPayoutRow()?.colony).eq('Miranda');
      colonyBonusPayout.rows[2].state = 'paid';
      expect(nextPayoutRow()).is.undefined;
    });
  });

  describe('every end releases what the rail still holds', () => {
    function seeded(): void {
      armColonyBonusPayout(HS, payoutRowsOf({entries: [LUNA, TITAN]}, [CardName.DIRIGIBLES]), 2);
      seedColonyBonusPayoutHolds(view(1, {floaters: 0}), view(2, {mc: 2, floaters: 1}));
      expect(heldStock('megacredits')).eq(2);
      expect(heldCardResource('floater')).eq(1);
    }

    it('finish (the stall net, the hold\'s expiry): no hold left, every row reads as landed, the scene is over — and it says it was degraded', () => {
      seeded();
      finishColonyBonusPayout(true);
      expect(heldStock('megacredits')).eq(0);
      expect(heldCardResource('floater')).eq(0);
      expect(colonyBonusPayout.landed).deep.eq(['Luna', 'Titan']);
      expect(colonyBonusPayout.done).is.true;
      expect(colonyBonusPayout.degraded).is.true;
    });

    it('reset (a refused submit): no hold left, no record', () => {
      seeded();
      resetColonyBonusPayout();
      expect(heldStock('megacredits')).eq(0);
      expect(heldCardResource('floater')).eq(0);
      expect(colonyBonusPayout.rows).deep.eq([]);
    });

    it('a row that already LANDED is not released twice', () => {
      seeded();
      // Luna's chip landed through the wave (its hold released there).
      colonyBonusPayout.rows[0].state = 'paid';
      markPayoutRowLanded('Luna');
      clearPanelRewardHold();
      finishColonyBonusPayout();
      expect(heldStock('megacredits'), 'never negative, never a phantom').eq(0);
    });
  });
});
