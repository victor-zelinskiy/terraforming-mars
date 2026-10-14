import {expect} from 'chai';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {
  FINISH_LABEL,
  buildFinalGreenery,
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
});
