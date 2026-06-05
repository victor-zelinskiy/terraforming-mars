import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import {fakePlayerViewModel} from '../testHelpers';
import WaitingFor from '@/client/components/WaitingFor.vue';
import {
  freeAwardFundingPrompt,
  awardFundingSignature,
} from '@/client/components/awards/awardFundingState';

// The serialized FREE award-funding OrOptions (Vitor start action), carrying the
// EXPLICIT server marker. Each option's title is the bare award NAME so the
// AwardsOverlay + shared submit machinery can map option → award.
function freeFundOrOptions(): any {
  return {
    title: 'Select award to fund',
    buttonLabel: 'Confirm',
    type: 'or',
    awardFundingPrompt: {free: true},
    options: [
      {title: 'Landlord', buttonLabel: 'Confirm', type: 'option'},
      {title: 'Scientist', buttonLabel: 'Confirm', type: 'option'},
    ],
  };
}

function mountWaitingFor(view: any) {
  return shallowMount(WaitingFor, {
    ...globalConfig,
    global: {
      ...globalConfig.global,
      stubs: {'player-input-factory': true, 'PlayerInputFactory': true},
    },
    props: {playerView: view, waitingfor: view.waitingFor},
  });
}

describe('award funding routing', () => {
  it('freeAwardFundingPrompt matches a marked free-funding OrOptions', () => {
    const view = fakePlayerViewModel({waitingFor: freeFundOrOptions()});
    expect(freeAwardFundingPrompt(view)).to.not.eq(undefined);
  });

  it('freeAwardFundingPrompt ignores a paid / unmarked OrOptions and non-or prompts', () => {
    // Same shape but no marker (the paid Fund-an-award action, nested in the
    // action menu, never carries it).
    const unmarked = fakePlayerViewModel({waitingFor: {...freeFundOrOptions(), awardFundingPrompt: undefined}});
    expect(freeAwardFundingPrompt(unmarked)).to.eq(undefined);
    // A non-or prompt with a stray marker is not matched.
    const nonOr = fakePlayerViewModel({waitingFor: {type: 'card', title: '', buttonLabel: '', awardFundingPrompt: {free: true}, cards: []} as any});
    expect(freeAwardFundingPrompt(nonOr)).to.eq(undefined);
    // No waitingFor at all.
    expect(freeAwardFundingPrompt(fakePlayerViewModel({waitingFor: undefined}))).to.eq(undefined);
  });

  it('awardFundingSignature is stable across identical prompts and varies by options', () => {
    const a = freeFundOrOptions();
    const b = freeFundOrOptions();
    expect(awardFundingSignature(a)).to.eq(awardFundingSignature(b));
    b.options.push({title: 'Banker', buttonLabel: 'Confirm', type: 'option'});
    expect(awardFundingSignature(a)).to.not.eq(awardFundingSignature(b));
  });

  it('WaitingFor suppresses the generic modal route for a free-funding prompt', () => {
    // Without suppression a top-level OrOptions routes to the modal; the marker
    // sends it to the AwardsOverlay instead.
    const view = fakePlayerViewModel({waitingFor: freeFundOrOptions()});
    const w = mountWaitingFor(view);
    expect((w.vm as any).useModalForCurrentInput).to.eq(false);
  });
});
