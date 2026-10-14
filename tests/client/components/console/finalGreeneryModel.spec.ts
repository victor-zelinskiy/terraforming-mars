import {expect} from 'chai';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {
  FINISH_LABEL,
  YIELD_TR,
  YIELD_VP,
  buildFinalGreenery,
  finaleQueue,
  finaleStageOf,
  finaleStock,
  finaleWaitingOn,
  finaleYieldKey,
  finalGreeneryBank,
  finalGreeneryFinishCommand,
} from '@/client/console/finalGreenery/finalGreeneryModel';
import {placementCommands} from '@/client/console/tilePlacement/placementCommands';

/*
 * The finale beat, played ON THE BOARD (PL-295 / PL-296, the owner's decision 2026-10-14). One branch converts
 * plants; the other ENDS THE GAME. These tests pin the two facts the board pick stands on: the plant stock read as
 * objects (the arithmetic the old dialog printed as three numbers), and the finish being a HOLD in the danger tone
 * beside A — never a press, never dropped by the bar's fit.
 */
describe('finalGreeneryModel', () => {
  const viewer = {plants: 23, plantsNeededForGreenery: 8};

  const prompt = (over: Record<string, unknown> = {}) => ({
    type: 'or',
    title: 'Place any final greenery from plants',
    buttonLabel: 'Confirm',
    options: [
      {type: 'space', title: 'Select space for greenery tile', buttonLabel: 'Confirm', spaces: ['05', '06']},
      {type: 'option', title: 'Don\'t place a greenery', buttonLabel: 'Confirm'},
    ],
    finalGreeneryPrompt: {spaces: 12},
    ...over,
  } as unknown as PlayerInputModel);

  it('is recognised by the MARKER, never by its title', () => {
    expect(buildFinalGreenery(prompt(), viewer)).is.not.undefined;
    // The identical prompt without the marker keeps its existing UI.
    const unmarked = prompt({finalGreeneryPrompt: undefined});
    expect(buildFinalGreenery(unmarked, viewer)).is.undefined;
    expect(buildFinalGreenery(undefined, viewer)).is.undefined;
    // No viewer numbers → nothing honest to show.
    expect(buildFinalGreenery(prompt(), undefined)).is.undefined;
  });

  it('tells the branches apart by TYPE — the board pick vs the leaf', () => {
    const vm = buildFinalGreenery(prompt(), viewer)!;
    expect(vm.placeIndex).eq(0);
    expect(vm.stopIndex).eq(1);
    // Server order reversed: the roles follow the TYPES, not the positions.
    const flipped = buildFinalGreenery(prompt({options: [
      {type: 'option', title: 'x', buttonLabel: 'Confirm'},
      {type: 'space', title: 'y', buttonLabel: 'Confirm', spaces: []},
    ]}), viewer)!;
    expect(flipped.placeIndex).eq(1);
    expect(flipped.stopIndex).eq(0);
    // A prompt missing either branch is not the finale.
    expect(buildFinalGreenery(prompt({options: [{type: 'option', title: 'x', buttonLabel: 'Confirm'}]}), viewer)).is.undefined;
  });

  it('does the arithmetic the player would otherwise do in their head', () => {
    const vm = buildFinalGreenery(prompt(), viewer)!;
    expect(vm.plants).eq(23);
    expect(vm.cost, 'the DISCOUNTED cost, straight from the player model').eq(8);
    expect(vm.affordable, '23 plants at 8 each').eq(2);
    expect(vm.remainder, '23 = 2 × 8 + 7').eq(7);
    expect(vm.spaces, 'a board rule — only the server knows it').eq(12);
    // A discount to 0 would divide by zero; the cost floors at 1.
    const free = buildFinalGreenery(prompt(), {plants: 5, plantsNeededForGreenery: 0})!;
    expect(free.cost).eq(1);
    expect(free.affordable).eq(5);
    expect(free.remainder).eq(0);
  });

  it('draws the STOCK as objects — one hex per greenery, the rest as a part-filled hex', () => {
    const bank = finalGreeneryBank(buildFinalGreenery(prompt(), viewer)!);
    expect(bank.slots).deep.eq([{kind: 'full'}, {kind: 'full'}, {kind: 'part', have: 7, need: 8}]);
    expect(bank.overflow).eq(0);
    expect(bank.affordable).eq(2);
    expect(bank.burns, 'finishing now leaves every plant in stock unused').eq(23);
    // An exact stock has no part hex.
    const exact = finalGreeneryBank(buildFinalGreenery(prompt(), {plants: 16, plantsNeededForGreenery: 8})!);
    expect(exact.slots).deep.eq([{kind: 'full'}, {kind: 'full'}]);
    // A huge stock is CAPPED and states the cut — the row never outgrows its column.
    const huge = finalGreeneryBank(buildFinalGreenery(prompt(), {plants: 81, plantsNeededForGreenery: 8})!, 6);
    expect(huge.slots.filter((s) => s.kind === 'full')).has.length(6);
    expect(huge.overflow).eq(4);
    expect(huge.slots[huge.slots.length - 1]).deep.eq({kind: 'part', have: 1, need: 8});
  });

  it('THE FINISH IS A HOLD in the danger tone, never dropped by the fit', () => {
    const cmd = finalGreeneryFinishCommand();
    expect(cmd).to.include({control: 'triggerR', label: FINISH_LABEL, hold: true, tone: 'danger', priority: 0});
  });

  it('the finale\'s board pick: B MINIMIZES and the finish stands beside A — only at the cell-choice level', () => {
    const base = {twoStep: true, legal: true, cancellable: true, freeRoam: false, sourceInspectable: false};
    const finale = {finish: finalGreeneryFinishCommand()};
    const nav = placementCommands({...base, phase: 'navigate', finale});
    expect(nav.find((c) => c.control === 'back')?.label).eq('Minimize');
    expect(nav.find((c) => c.control === 'triggerR')).to.include({hold: true, tone: 'danger'});
    expect(nav.some((c) => c.label === 'Cancel placement'), 'there is no screen behind the pick to cancel to').is.false;
    // A locked cell is a placement in progress — its own two verbs; the finish waits for B.
    const locked = placementCommands({...base, phase: 'locked', finale});
    expect(locked.some((c) => c.control === 'triggerR')).is.false;
    // Any other placement keeps its own B.
    const plain = placementCommands({...base, phase: 'navigate'});
    expect(plain.find((c) => c.control === 'back')?.label).eq('Cancel placement');
  });
  // ── the SESSION's readers (PL-303 / PL-304 / PL-305) ──────────────────────

  it('THE BANK IS DRAWN TO THE COUNT (PL-305): big hexes for two, a wrapping grid for twelve, a cut only past 24', () => {
    const two = finalGreeneryBank(finaleStock(16, 8));
    expect(two.slots.map((s) => s.kind)).to.deep.eq(['full', 'full']);
    expect(two.tier).to.eq('xl');
    expect(finalGreeneryBank(finaleStock(23, 8)).tier, 'two whole + the rest = three').to.eq('lg');
    expect(finalGreeneryBank(finaleStock(60, 8)).tier, 'seven whole + the rest').to.eq('md');
    expect(finalGreeneryBank(finaleStock(96, 8)).tier, 'twelve').to.eq('sm');
    const huge = finalGreeneryBank(finaleStock(8 * 30, 8));
    expect(huge.slots, 'cut at 24').to.have.length(24);
    expect(huge.overflow).to.eq(6);
    expect(huge.tier).to.eq('xs');
    // The stock without a prompt (the wait stage) reads the same arithmetic as the prompt's view.
    expect(finaleStock(23, 8)).to.deep.eq({plants: 23, cost: 8, affordable: 2, remainder: 7});
    expect(finaleStock(5, 0).cost, 'a zero cost is read as one — never a division by zero').to.eq(1);
  });

  it('the STAGE is read from facts: the pick out → pick; a prompt or a commit in flight → landing; nothing of ours → wait', () => {
    expect(finaleStageOf({pickOut: true, promptStands: true, committing: false})).to.eq('pick');
    expect(finaleStageOf({pickOut: false, promptStands: true, committing: false})).to.eq('landing');
    expect(finaleStageOf({pickOut: false, promptStands: false, committing: true})).to.eq('landing');
    expect(finaleStageOf({pickOut: false, promptStands: false, committing: false})).to.eq('wait');
  });

  it("the FINALE ORDER names every seat's place: done by the server's list, placing by the asked seat's kind, the rest waiting", () => {
    const seats = finaleQueue([
      {color: 'blue', name: 'player1', isWaitingForInput: true, waitingForKind: 'finalgreenery'},
      {color: 'red', name: 'player2', isWaitingForInput: false},
      {color: 'green', name: 'player3', isWaitingForInput: true}, // a triggered pick — not the finale's
    ], ['red'], 'blue');
    expect(seats.map((s) => `${s.color}:${s.state}${s.viewer ? ':you' : ''}`)).to.deep.eq([
      'blue:placing:you', 'red:done', 'green:waiting',
    ]);
    // The viewer's own finale in progress (the session stands) reads «placing» even while a triggered pick elsewhere holds the prompt.
    const waiting = finaleQueue([
      {color: 'blue', name: 'player1', isWaitingForInput: false},
      {color: 'red', name: 'player2', isWaitingForInput: true},
    ], [], 'blue', true);
    expect(waiting.map((s) => `${s.color}:${s.state}`)).to.deep.eq(['blue:placing', 'red:waiting']);
  });

  it('WHO the table waits on: the live poll outranks the snapshot, and it is never the viewer', () => {
    const players = [
      {color: 'blue', name: 'player1', isWaitingForInput: false},
      {color: 'red', name: 'player2', isWaitingForInput: true},
    ] as const;
    expect(finaleWaitingOn(players, 'blue', undefined)).to.deep.eq({color: 'red', name: 'player2'});
    expect(finaleWaitingOn(players, 'blue', ['blue']), 'the viewer is never the answer').to.be.undefined;
    expect(finaleWaitingOn([{color: 'blue', name: 'p1', isWaitingForInput: true}, {color: 'red', name: 'p2', isWaitingForInput: true}], 'blue', ['red']))
      .to.deep.eq({color: 'red', name: 'p2'});
    expect(finaleWaitingOn(players, 'red', undefined), 'nobody else is waited on').to.be.undefined;
  });

  it('the yield follows the ruleset: a VP for the tile, a TR under the Parliament', () => {
    expect(finaleYieldKey(false)).to.eq(YIELD_VP);
    expect(finaleYieldKey(true)).to.eq(YIELD_TR);
  });
});
