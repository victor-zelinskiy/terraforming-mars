import {expect} from 'chai';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {
  PLACE_LEAD,
  STOP_ARMED,
  STOP_TITLE,
  buildFinalGreenery,
  finalGreeneryCommandKeys,
  finalGreeneryFocusStep,
  finalGreeneryPressIntent,
} from '@/client/console/finalGreenery/finalGreeneryModel';

/*
 * The finale beat. One branch converts plants; the other ENDS THE GAME. These
 * tests exist for the second one: it must be impossible to end your game with a
 * single press, and impossible to end it because you were looking elsewhere.
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
    expect(vm.actions.map((a) => a.role)).deep.eq(['place', 'stop']);
    expect(vm.actions[0].optionIndex).eq(0);
    expect(vm.actions[1].optionIndex).eq(1);
    expect(vm.actions[0].destructive, 'placing is reversible in spirit — you can stop after').is.false;
    expect(vm.actions[1].destructive, 'stopping ends the game').is.true;

    // Server order reversed: the roles follow the TYPES, not the positions.
    const flipped = buildFinalGreenery(prompt({options: [
      {type: 'option', title: 'x', buttonLabel: 'Confirm'},
      {type: 'space', title: 'y', buttonLabel: 'Confirm', spaces: []},
    ]}), viewer)!;
    expect(flipped.actions[0]).to.include({role: 'place', optionIndex: 1});
    expect(flipped.actions[1]).to.include({role: 'stop', optionIndex: 0});
  });

  it('does the arithmetic the player would otherwise do in their head', () => {
    const vm = buildFinalGreenery(prompt(), viewer)!;
    expect(vm.plants).eq(23);
    expect(vm.cost, 'the DISCOUNTED cost, straight from the player model').eq(8);
    expect(vm.affordable, '23 plants at 8 each').eq(2);
    expect(vm.spaces, 'a board rule — only the server knows it').eq(12);

    // A discount of 0 would divide by zero; the cost floors at 1.
    const free = buildFinalGreenery(prompt(), {plants: 5, plantsNeededForGreenery: 0})!;
    expect(free.cost).eq(1);
    expect(free.affordable).eq(5);
  });

  it('ENDING THE GAME TAKES TWO PRESSES', () => {
    const vm = buildFinalGreenery(prompt(), viewer)!;
    // First press only arms — nothing is submitted.
    expect(finalGreeneryPressIntent(vm, 1, 'primary', false)).deep.eq({kind: 'arm'});
    // The second one commits.
    expect(finalGreeneryPressIntent(vm, 1, 'primary', true)).deep.eq({kind: 'finish', optionIndex: 1});
  });

  it('placing never arms — only the irreversible branch does', () => {
    const vm = buildFinalGreenery(prompt(), viewer)!;
    expect(finalGreeneryPressIntent(vm, 0, 'primary', false)).deep.eq({kind: 'placement', optionIndex: 0});
    // …and an already-armed state must not leak across to it.
    expect(finalGreeneryPressIntent(vm, 0, 'primary', true)).deep.eq({kind: 'placement', optionIndex: 0});
  });

  it('ignores every button that is not the confirm', () => {
    const vm = buildFinalGreenery(prompt(), viewer)!;
    for (const action of ['back', 'inspect', 'nextTab', undefined]) {
      expect(finalGreeneryPressIntent(vm, 1, action, true), String(action)).is.undefined;
    }
  });

  it('names which of the two the confirm is about', () => {
    const vm = buildFinalGreenery(prompt(), viewer)!;
    expect(finalGreeneryCommandKeys(vm, 0, false)).deep.eq(['Navigate', PLACE_LEAD, 'Minimize']);
    expect(finalGreeneryCommandKeys(vm, 1, false)).deep.eq(['Navigate', STOP_TITLE, 'Minimize']);
    // Armed, the bar says what the next press actually does.
    expect(finalGreeneryCommandKeys(vm, 1, true)).deep.eq(['Navigate', STOP_ARMED, 'Minimize']);
  });

  it('wraps focus in both directions', () => {
    const vm = buildFinalGreenery(prompt(), viewer)!;
    expect(finalGreeneryFocusStep(vm, 1, 1)).eq(0);
    expect(finalGreeneryFocusStep(vm, 0, -1)).eq(1);
  });
});
