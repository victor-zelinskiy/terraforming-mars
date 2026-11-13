import {flushPromises, shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import LogPanel from '@/client/components/logpanel/LogPanel.vue';
import {fakeViewModel} from '../testHelpers';

type FetchHolder = {fetch: unknown};
type Call = {url: string, signal: AbortSignal};

describe('LogPanel', () => {
  let originalFetch: unknown;

  beforeEach(() => {
    originalFetch = (globalThis as unknown as FetchHolder).fetch;
    (globalThis as unknown as FetchHolder).fetch = () => Promise.resolve({ok: false, statusText: 'stubbed'});
  });

  afterEach(() => {
    (globalThis as unknown as FetchHolder).fetch = originalFetch;
  });

  function mountPanel(generation = 1) {
    const viewModel = fakeViewModel();
    viewModel.game.generation = generation;
    return shallowMount(LogPanel, {
      ...globalConfig,
      props: {viewModel, color: 'blue'},
    });
  }

  /** A fetch that records every request and answers the given messages. */
  function recordingFetch(messages: ReadonlyArray<unknown>): Array<Call> {
    const calls: Array<Call> = [];
    (globalThis as unknown as FetchHolder).fetch = (url: string, init: {signal: AbortSignal}) => {
      calls.push({url, signal: init.signal});
      return Promise.resolve({ok: true, json: () => Promise.resolve(messages)});
    };
    return calls;
  }

  it('mounts without errors', () => {
    const wrapper = mountPanel();
    expect(wrapper.exists()).to.be.true;
  });

  it('asks for the CURRENT generation\'s log on mount and marks that generation selected', async () => {
    const calls = recordingFetch([]);
    const wrapper = mountPanel(3);
    await flushPromises();

    expect(calls).to.have.length(1);
    expect(calls[0].url).to.contain('generation=3');
    const indicators = wrapper.findAll('.log-gen-indicator');
    expect(indicators.map((i) => i.text())).to.deep.eq(['1', '2', '3']);
    expect(indicators.map((i) => i.classes().includes('log-gen-indicator--selected'))).to.deep.eq([false, false, true]);
  });

  it('picking another generation asks for it, selects it — and ABORTS the request before it', async () => {
    const calls = recordingFetch([]);
    const wrapper = mountPanel(3);
    await flushPromises();

    await wrapper.findAll('.log-gen-indicator')[0].trigger('click');
    await flushPromises();

    expect(calls.map((c) => c.url.replace(/^.*generation=/, ''))).to.deep.eq(['3', '1']);
    expect(calls[0].signal.aborted, 'the first request was aborted by the second (one request at a time)').to.eq(true);
    expect(calls[1].signal.aborted).to.eq(false);
    expect(wrapper.findAll('.log-gen-indicator').map((i) => i.classes().includes('log-gen-indicator--selected'))).to.deep.eq([true, false, false]);
  });

  it('picking the generation already shown asks for nothing', async () => {
    const calls = recordingFetch([]);
    const wrapper = mountPanel(2);
    await flushPromises();

    await wrapper.findAll('.log-gen-indicator')[1].trigger('click');
    await flushPromises();
    expect(calls).to.have.length(1);
  });
});
