import {expect} from 'chai';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {CardName} from '@/common/cards/CardName';
import {startPreludeDiscardOf, taskFor} from '@/client/console/consoleTaskRouter';

/*
 * P55 · FN — A START PRELUDE'S OWN DISCARD IS A STEP OF THE START (Old Mining Colony: the colony first, then «discard 1
 * card»). The shell hosts it INSIDE the deployment's body and never announces it; this pins the one structural reading
 * it stands on: the server's `discardPrompt` marker naming a PRELUDE in the opening generation — never a colony's bonus
 * discard (a step of the colony flow), never a project card's discard, never a later generation.
 */
describe('startPreludeDiscardOf', () => {
  const view = (meta: object | undefined, generation = 1) => ({
    id: 'p-viewer',
    waitingFor: {
      type: 'card', title: 'Select 1 card to discard', buttonLabel: 'Discard',
      cards: [{name: CardName.BIRDS}, {name: CardName.FISH}], min: 1, max: 1,
      discardPrompt: meta,
    },
    cardsInHand: [{name: CardName.BIRDS}, {name: CardName.FISH}],
    thisPlayer: {tableau: []},
    game: {phase: 'preludes', generation, gameOptions: {}},
  } as unknown as PlayerViewModel);

  const prelude = {min: 1, max: 1, source: {kind: 'card', card: CardName.OLD_MINING_COLONY}};

  it('names the prelude of a start discard — and the router serves it as a hand pick', () => {
    expect(startPreludeDiscardOf(view(prelude))).to.eq(CardName.OLD_MINING_COLONY);
    expect(taskFor(view(prelude))?.kind).to.eq('handSelect');
  });

  it('a colony bonus discard (Pluto) is the colony flow\'s step, never the start\'s', () => {
    expect(startPreludeDiscardOf(view({...prelude, colonyBonus: {colony: 'Pluto'}}))).is.undefined;
    expect(startPreludeDiscardOf(view({...prelude, colonyRepeat: {colony: 'Pluto'}}))).is.undefined;
  });

  it('a PROJECT card\'s discard, a system discard, or a later generation is not a start prelude\'s', () => {
    expect(startPreludeDiscardOf(view({min: 1, max: 1, source: {kind: 'card', card: CardName.MARS_UNIVERSITY}}))).is.undefined;
    expect(startPreludeDiscardOf(view({min: 1, max: 1, source: {kind: 'system'}}))).is.undefined;
    expect(startPreludeDiscardOf(view(undefined))).is.undefined;
    expect(startPreludeDiscardOf(view(prelude, 2))).is.undefined;
  });
});
