import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import {fakePlayerViewModel} from '../testHelpers';
import {CardName} from '@/common/cards/CardName';
import {Phase} from '@/common/Phase';
import WaitingFor from '@/client/components/WaitingFor.vue';
import {resetStartGameFlow} from '@/client/components/startGameFlow/startGameFlowState';

// The serialized corp first-action OrOptions, carrying the EXPLICIT server
// marker (startGamePrompt). `message` is the (translatable) option-title text —
// i18n mutates it in place on render, which once broke title-based detection.
// With the marker, the title is IRRELEVANT, so we vary it across tests to prove
// suppression no longer depends on it.
function realCorpOrOptions(message: string): any {
  return {
    title: 'Select one option',
    buttonLabel: 'Save',
    type: 'or',
    startGamePrompt: {kind: 'corporationInitialAction'},
    options: [
      {
        title: {data: [{type: 3, value: 'Tharsis Republic'}], message},
        buttonLabel: 'Place a city tile',
        type: 'option',
      },
      {title: 'Pass for this generation', buttonLabel: 'Pass', type: 'option', warnings: ['pass']},
    ],
    initialIdx: 0,
  };
}
const ENGLISH_TITLE = 'Take first action of ${0} corporation';
// The title AFTER i18n mutated it in place — once broke the old text detection.
const RUSSIAN_TITLE = 'Выполнить начальное действие корпорации «${0}»';

function mountWaitingFor(view: any) {
  return shallowMount(WaitingFor, {
    ...globalConfig,
    global: {
      ...globalConfig.global,
      // `player-input-factory` is registered globally in main.ts (absent in the
      // test app) — stub it so the v-else branch render doesn't warn. The other
      // children are local and shallowMount auto-stubs them.
      stubs: {'player-input-factory': true, 'PlayerInputFactory': true},
    },
    props: {playerView: view, waitingfor: view.waitingFor},
  });
}

describe('WaitingFor — corp first-action suppression (end-to-end)', () => {
  beforeEach(() => resetStartGameFlow());

  it('suppresses the modal route for the real corp OrOptions (untranslated title)', () => {
    const view = fakePlayerViewModel({
      waitingFor: realCorpOrOptions(ENGLISH_TITLE),
      pendingInitialActions: [CardName.THARSIS_REPUBLIC],
      game: {generation: 1, phase: Phase.ACTION} as any,
    });
    const w = mountWaitingFor(view);
    expect((w.vm as any).useModalForCurrentInput).to.eq(false);
  });

  // THE REGRESSION: i18n mutates the option title text in place (English →
  // Russian) on first render, which broke text-based detection and leaked the
  // legacy corp modal. Detection via the CARD token (corp name) survives it.
  it('STILL suppresses after the title was translated in place (the real bug)', () => {
    const view = fakePlayerViewModel({
      waitingFor: realCorpOrOptions(RUSSIAN_TITLE),
      pendingInitialActions: [CardName.THARSIS_REPUBLIC],
      game: {generation: 1, phase: Phase.ACTION} as any,
    });
    const w = mountWaitingFor(view);
    expect((w.vm as any).useModalForCurrentInput).to.eq(false);
  });
});
