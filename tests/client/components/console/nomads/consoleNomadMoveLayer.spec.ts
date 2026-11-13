/*
 * ConsoleNomadMoveLayer — the shell-level stage of the Mars Nomads hop (the camp module flying to the adjacent cell).
 * A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md) with no props, no emits and nothing exposed:
 * it paints the proxies of the module's transaction (`nomadMoveState` — the two ground shadows, the REAL token at the
 * state's size, one printed-bonus proxy per captured icon), and the remote leg goes with its stage
 * (`abortRemoteNomadMoves` on the way out — no held token, no ghost left for the next board).
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick} from 'vue';
import {globalConfig} from '../../getLocalVue';
import ConsoleNomadMoveLayer from '@/client/components/console/nomads/ConsoleNomadMoveLayer.vue';
import NomadToken from '@/client/components/NomadToken.vue';
import {abortNomadMove, abortRemoteNomadMoves, nomadMoveState} from '@/client/console/nomads/consoleNomadMove';

function mountLayer() {
  // `globalConfig` promotes every Vue warning to a failure: «mounts without a warning» is part of each test.
  return mount(ConsoleNomadMoveLayer, {global: {config: globalConfig.global.config}});
}

describe('ConsoleNomadMoveLayer — the stage of the camp\'s hop', () => {
  afterEach(() => {
    // The transaction is module state, shared by the whole bundle.
    nomadMoveState.active = false;
    nomadMoveState.remoteActive = false;
    nomadMoveState.bonusProxies = [];
    nomadMoveState.tokenSizePx = 18;
    abortNomadMove();
    abortRemoteNomadMoves();
  });

  it('renders nothing while no hop stands; an own move or a remote one stands the SAME stage up', async () => {
    const wrapper = mountLayer();
    expect(wrapper.find('.con-nomadmove').exists(), 'idle — no stage').to.eq(false);

    nomadMoveState.active = true;
    await nextTick();
    const root = wrapper.find('.con-nomadmove');
    expect(root.classes()).to.deep.eq(['con-nomadmove', 'con-flight-to-board']);
    expect(root.attributes('data-flight-lands')).to.eq('board');
    expect(root.attributes('aria-hidden')).to.eq('true');
    expect(wrapper.findAll('.con-nomadmove > .con-nomadmove__shadow'), 'the source and the destination shadow').to.have.length(2);
    expect(wrapper.find('.con-nomadmove > .con-nomadmove__token').exists()).to.eq(true);

    nomadMoveState.active = false;
    await nextTick();
    expect(wrapper.find('.con-nomadmove').exists()).to.eq(false);

    nomadMoveState.remoteActive = true;
    await nextTick();
    expect(wrapper.find('.con-nomadmove').exists(), 'a remote hop is the same stage').to.eq(true);
  });

  it('the proxy is the REAL token at the state\'s size, with no shadow of its own', async () => {
    nomadMoveState.active = true;
    nomadMoveState.tokenSizePx = 42;
    const wrapper = mountLayer();
    const token = wrapper.find('.con-nomadmove__token').findComponent(NomadToken);
    expect(token.exists()).to.eq(true);
    expect(token.props('size')).to.eq(42);
    expect(token.props('shadow')).to.eq(false);

    nomadMoveState.tokenSizePx = 57;
    await nextTick();
    expect(token.props('size'), 'the size follows the director\'s measure').to.eq(57);
  });

  it('one bonus proxy per captured icon — its sprite class, its rounded live rect; a proxy that left gives its node back', async () => {
    nomadMoveState.active = true;
    nomadMoveState.bonusProxies = [
      {id: 5, icon: 'steel', rect: {x: 100.4, y: 50.6, w: 31.5, h: 30.2}},
      {id: 6, icon: 'plant', rect: {x: 140, y: 52, w: 32, h: 30}},
    ];
    const wrapper = mountLayer();
    const proxies = wrapper.findAll('.con-nomadmove > .con-nomadmove__bonus');
    expect(proxies.map((p) => p.classes())).to.deep.eq([
      ['con-nomadmove__bonus', 'board-space-bonus--steel'],
      ['con-nomadmove__bonus', 'board-space-bonus--plant'],
    ]);
    const styles = proxies.map((p) => (p.element as HTMLElement).style);
    expect(styles.map((s) => [s.left, s.top, s.width, s.height])).to.deep.eq([
      ['100px', '51px', '32px', '30px'],
      ['140px', '52px', '32px', '30px'],
    ]);

    const kept = proxies[1].element;
    nomadMoveState.bonusProxies = [nomadMoveState.bonusProxies[1]];
    await nextTick();
    const left = wrapper.findAll('.con-nomadmove__bonus');
    expect(left).to.have.length(1);
    expect(left[0].element, 'keyed by the proxy\'s id — the survivor keeps its node').to.eq(kept);
  });

  it('exposes nothing — no parent stands a ref on it', () => {
    const Host = defineComponent({render: () => h('div', [h(ConsoleNomadMoveLayer, {ref: 'child'})])});
    const host = mount(Host, {global: {config: globalConfig.global.config}});
    expect(Object.keys(host.vm.$refs.child as object)).to.deep.eq([]);
  });

  it('the remote leg goes with its stage: leaving mid-hop lowers it at once', async () => {
    nomadMoveState.remoteActive = true;
    nomadMoveState.remoteWaiting = true;
    nomadMoveState.remoteQueued = 1;
    const wrapper = mountLayer();
    await nextTick();
    expect(wrapper.find('.con-nomadmove').exists()).to.eq(true);

    wrapper.unmount();
    expect(nomadMoveState.remoteActive).to.eq(false);
    expect(nomadMoveState.remoteWaiting).to.eq(false);
    expect(nomadMoveState.remoteQueued).to.eq(0);
  });
});
