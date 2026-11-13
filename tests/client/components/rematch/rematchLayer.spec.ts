/*
 * RematchLayer — the app-level host of the rematch flow: it polls the rematch state for THIS viewer and (outside the
 * console, where it stands `headless`) shows the vote prompt, its minimized pill, the «rematch is ready» dialog and the
 * «declined» toast off the module state `rematchState`. A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md): two props in, no emit, nothing exposed — the spec is what it renders for the state
 * and what its verbs ask of the server. No mount below hands it a translator or a directive: the layer brings its own.
 */
import {flushPromises, mount} from '@vue/test-utils';
import {expect} from 'chai';
import {defineComponent, nextTick} from 'vue';
import RematchLayer from '@/client/components/rematch/RematchLayer.vue';
import {rematchState, resetRematchState} from '@/client/components/rematch/rematchState';
import {RematchModel} from '@/common/models/RematchModel';
import {ViewModel} from '@/common/models/PlayerModel';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';
import {$t} from '@/client/directives/i18n';
import {fakeViewModel} from '../testHelpers';

// The prompt is its own component with its own spec: here it is a stub that shows what the layer hands it.
const PromptStub = defineComponent({
  name: 'RematchPromptModal',
  props: {
    model: {type: Object, required: true},
    submitting: {type: Boolean, default: false},
  },
  emits: ['accept', 'decline', 'minimize'],
  template: '<div class="prompt-stub"></div>',
});

type FetchCall = {url: string, method: string};

describe('RematchLayer', () => {
  let clock: ManualFlowClock;
  let calls: Array<FetchCall>;
  let originalFetch: unknown;
  const globalFetch = globalThis as {fetch: unknown};

  function model(overrides: Partial<RematchModel> = {}): RematchModel {
    return {
      status: 'offered',
      offeredBy: 'blue',
      votes: [
        {color: 'blue', name: 'Nastya', status: 'accepted'},
        {color: 'red', name: 'Victor', status: 'pending'},
      ],
      viewerIsPlayer: true,
      viewerColor: 'red',
      viewerMustVote: true,
      viewerIsOfferer: false,
      ...overrides,
    };
  }

  // The teleports are stubbed so every surface is read where it is rendered (their target is the document's body).
  function mountLayer(props: {view: ViewModel, headless?: boolean}) {
    return mount(RematchLayer, {props, global: {stubs: {RematchPromptModal: PromptStub, teleport: true}}});
  }

  beforeEach(() => {
    clock = createManualClock(0);
    setFlowClock(clock);
    calls = [];
    originalFetch = globalFetch.fetch;
    // The server answers every request with the state the spec has set — the layer's poll changes nothing by itself.
    globalFetch.fetch = (input: unknown, init?: {method?: string}): Promise<unknown> => {
      calls.push({url: String(input), method: init?.method ?? 'GET'});
      const served = rematchState.model;
      return Promise.resolve({ok: served !== undefined, json: () => Promise.resolve(served)});
    };
    resetRematchState();
  });
  afterEach(() => {
    globalFetch.fetch = originalFetch;
    setFlowClock(undefined);
    resetRematchState();
  });

  it('headless (the console): it polls for THIS viewer and renders nothing but its root — the template starting with it', async () => {
    rematchState.model = model();
    const wrapper = mountLayer({view: fakeViewModel(), headless: true});
    await flushPromises();
    expect(wrapper.element.tagName).to.eq('DIV');
    expect(wrapper.classes()).to.deep.eq(['rematch-layer']);
    expect(wrapper.element.children).to.have.length(0);
    expect(calls).to.have.length(1);
    expect(calls[0].method).to.eq('GET');
    expect(calls[0].url).to.contain('id=p-blue-id');

    // A viewer with no id asks the server nothing.
    calls = [];
    mountLayer({view: fakeViewModel({id: undefined}), headless: true});
    await flushPromises();
    expect(calls).to.deep.eq([]);
    wrapper.unmount();
  });

  it('a vote owed: the prompt gets the model and the submitting flag, its verbs go to the server for the viewer, and a minimized prompt is a pill a fresh offer re-opens', async () => {
    rematchState.model = model();
    const wrapper = mountLayer({view: fakeViewModel()});
    await flushPromises();
    const prompt = wrapper.findComponent(PromptStub);
    expect(prompt.exists()).to.eq(true);
    expect(prompt.props('model')).to.deep.eq(model());
    expect(prompt.props('submitting')).to.eq(false);
    expect(wrapper.find('.rematch-pill').exists()).to.eq(false);

    calls = [];
    prompt.vm.$emit('accept');
    prompt.vm.$emit('decline');
    await flushPromises();
    expect(calls.map((c) => c.method)).to.deep.eq(['POST', 'POST']);
    expect(calls[0].url).to.contain('id=p-blue-id').and.to.contain('action=accept');
    expect(calls[1].url).to.contain('id=p-blue-id').and.to.contain('action=decline');

    prompt.vm.$emit('minimize');
    await nextTick();
    expect(wrapper.findComponent(PromptStub).exists()).to.eq(false);
    const pill = wrapper.find('.rematch-pill.rematch-pill--prompt');
    expect(pill.exists()).to.eq(true);
    expect(pill.find('.rematch-pill__label').attributes('tm-has-i18n')).to.eq('true');

    await pill.trigger('click');
    expect(wrapper.findComponent(PromptStub).exists()).to.eq(true);
    expect(wrapper.find('.rematch-pill').exists()).to.eq(false);

    // Minimized again — and ANOTHER player's offer brings the prompt back by itself.
    wrapper.findComponent(PromptStub).vm.$emit('minimize');
    await nextTick();
    expect(wrapper.findComponent(PromptStub).exists()).to.eq(false);
    rematchState.model = model({offeredBy: 'green'});
    await nextTick();
    expect(wrapper.findComponent(PromptStub).exists()).to.eq(true);
    wrapper.unmount();
  });

  it('the new game exists: a labelled dialog with the viewer\'s OWN join link — a player joins, a spectator watches — and «Later» puts it away', async () => {
    rematchState.model = model({status: 'created', viewerMustVote: false, newGameId: 'g-new', joinKind: 'player', joinId: 'p-new'});
    const wrapper = mountLayer({view: fakeViewModel({id: undefined})});
    await nextTick();
    expect(wrapper.findComponent(PromptStub).exists()).to.eq(false);
    const dialog = wrapper.find('.rematch-modal.rematch-modal--created');
    expect(dialog.attributes('role')).to.eq('dialog');
    expect(dialog.attributes('aria-label')).to.eq($t('Rematch ready'));
    expect(dialog.find('.rematch-modal__min').attributes('title')).to.eq($t('Close'));
    const join = dialog.find('a.cab-rematch--accept');
    expect(join.attributes('href')).to.eq('player?id=p-new');
    expect(join.text()).to.eq($t('Join rematch'));

    rematchState.model = model({status: 'created', viewerIsPlayer: false, viewerMustVote: false, newGameId: 'g-new', joinKind: 'spectator', joinId: 's-new'});
    await nextTick();
    const watchLink = wrapper.find('a.cab-rematch--accept');
    expect(watchLink.attributes('href')).to.eq('spectator?id=s-new');
    expect(watchLink.text()).to.eq($t('Watch rematch'));

    await wrapper.find('.cab-rematch--decline').trigger('click');
    expect(wrapper.find('.rematch-modal--created').exists()).to.eq(false);
    wrapper.unmount();
  });

  it('a decline: the toast names the decliner in their colour, closes on ✕ — and dismisses itself on the layer\'s own clock', async () => {
    const declined = (): RematchModel => model({
      status: 'declined', offeredBy: undefined, declinedBy: 'red', viewerMustVote: false,
      votes: [
        {color: 'blue', name: 'Nastya', status: 'accepted'},
        {color: 'red', name: 'Victor', status: 'declined'},
      ],
    });
    const wrapper = mountLayer({view: fakeViewModel({id: undefined})});
    expect(wrapper.find('.rematch-toast').exists()).to.eq(false);

    rematchState.model = declined();
    await nextTick();
    const toast = wrapper.find('.rematch-toast.rematch-toast--declined');
    expect(toast.attributes('role')).to.eq('status');
    expect(toast.find('.rematch-toast__dot').classes()).to.include('player_bg_color_red');
    expect(toast.find('.rematch-toast__name').text()).to.eq('Victor');
    expect(toast.find('.rematch-toast__close').attributes('title')).to.eq($t('Close'));

    await toast.find('.rematch-toast__close').trigger('click');
    expect(wrapper.find('.rematch-toast').exists()).to.eq(false);

    // A new offer, then a second decline: the toast is back, and seven seconds later it has left by itself.
    rematchState.model = model({viewerMustVote: false});
    await nextTick();
    rematchState.model = declined();
    await nextTick();
    expect(wrapper.find('.rematch-toast').exists()).to.eq(true);
    clock.advance(6999);
    await nextTick();
    expect(wrapper.find('.rematch-toast').exists()).to.eq(true);
    clock.advance(1);
    await nextTick();
    expect(wrapper.find('.rematch-toast').exists()).to.eq(false);
    wrapper.unmount();
  });
});
