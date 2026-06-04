import {shallowMount} from '@vue/test-utils';
import {globalConfig} from './getLocalVue';
import {expect} from 'chai';
import CardSelectionContent from '@/client/components/CardSelectionContent.vue';
import {InputResponse} from '@/common/inputs/InputResponse';

// Minimal fake cards — shallowMount stubs <Card>, so only `name` is read.
function card(name: string) {
  return {name};
}

function mountSelection(playerinput: any, onsave: (out: InputResponse) => void) {
  return shallowMount(CardSelectionContent, {
    ...globalConfig,
    props: {
      playerView: {
        thisPlayer: {megacredits: 50, cardCost: 3},
        game: {phase: 'action'},
      },
      playerinput,
      onsave,
    },
  });
}

describe('CardSelectionContent generic selection', () => {
  it('multi-select discard does NOT commit on a single click; confirm submits all', async () => {
    let saved: InputResponse | undefined;
    let saveCount = 0;
    const c = mountSelection(
      {
        type: 'card',
        title: 'Select a card to discard',
        buttonLabel: 'Discard',
        cards: [card('A'), card('B'), card('C')],
        min: 2,
        max: 2,
        showOnlyInLearnerMode: false,
        selectBlueCardAction: false,
        showOwner: false,
        showSelectAll: false,
      },
      (out) => {
        saved = out;
        saveCount++;
      },
    );
    const actions = c.findAll('[data-test="card-selection-action"]');
    expect(actions.length).to.eq(3);
    // A single click must only toggle selection — no premature submit.
    await actions[0].trigger('click');
    expect(saveCount).to.eq(0);
    await actions[1].trigger('click');
    expect(saveCount).to.eq(0);
    // Confirm footer commits the full multi-selection.
    await c.find('[data-test="card-selection-confirm"]').trigger('click');
    expect(saved).to.deep.eq({type: 'card', cards: ['A', 'B']});
  });

  it('single forced pick commits on one click', async () => {
    let saved: InputResponse | undefined;
    const c = mountSelection(
      {
        type: 'card',
        title: 'Select a card to copy',
        buttonLabel: 'Copy',
        cards: [card('A'), card('B')],
        min: 1,
        max: 1,
        showOnlyInLearnerMode: false,
        selectBlueCardAction: false,
        showOwner: false,
        showSelectAll: false,
      },
      (out) => {
        saved = out;
      },
    );
    // No confirm footer in single-select mode.
    expect(c.find('[data-test="card-selection-confirm"]').exists()).to.be.false;
    await c.findAll('[data-test="card-selection-action"]')[1].trigger('click');
    expect(saved).to.deep.eq({type: 'card', cards: ['B']});
  });
});
