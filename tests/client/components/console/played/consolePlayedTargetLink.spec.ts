/*
 * ConsolePlayedTargetLink — the SELF-TARGET CONNECTOR: the wire between the «Эта карта» proxy of the target selector
 * and the real source card in the workspace's hero column. A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md): no props, no emits, nothing exposed — its contract is two marker attributes it finds
 * in the band it is mounted in (`[data-ptsel-source]`, `[data-ptsel-self]`) and the link's module state.
 *
 * The unit environment has no frame source, so the connector measures on the tick (its own headless path).
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick} from 'vue';
import {globalConfig} from '../../getLocalVue';
import ConsolePlayedTargetLink from '@/client/components/console/played/ConsolePlayedTargetLink.vue';
import {
  bumpPlayedTargetSelfGeometry, playedTargetSelfState, resetPlayedTargetSelf, setPlayedTargetSelfLink,
} from '@/client/console/played/consolePlayedTargetSelf';

const rect = (left: number, top: number, width: number, height: number): DOMRect =>
  ({left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({})}) as DOMRect;

/** The band both hosts mount the connector in: the hero card's box, the proxy's box, and the connector beside them. */
const Band = defineComponent({
  render: () => h('div', {class: 'band'}, [
    h('div', {'data-ptsel-source': ''}),
    h('div', {'data-ptsel-self': ''}),
    h(ConsolePlayedTargetLink, {ref: 'link'}),
  ]),
});

/** A watcher's flush, the measure it schedules for the tick after, and the render of what it solved. */
async function settle(): Promise<void> {
  for (let i = 0; i < 4; i++) {
    await nextTick();
  }
}

function mountBand(source: DOMRect, proxy: DOMRect) {
  const host = mount(Band, {...globalConfig});
  const place = (selector: string, box: DOMRect) => {
    (host.find(selector).element as HTMLElement).getBoundingClientRect = () => box;
  };
  place('[data-ptsel-source]', source);
  place('[data-ptsel-self]', proxy);
  return {host, place};
}

/** The hero card: its right edge at 300, standing from 100 to 500. */
const CARD = rect(100, 100, 200, 400);
/** The proxy to the RIGHT of the card, its middle (280) inside the card's height: 120 px of wire. */
const PROXY = rect(420, 250, 180, 60);

describe('ConsolePlayedTargetLink — the self-target connector', () => {
  afterEach(() => {
    // The link is module state, shared by the whole bundle.
    resetPlayedTargetSelf();
    playedTargetSelfState.geometry = 0;
  });

  it('no self-target on offer: the frame stands (the coordinate space), and no wire is drawn', async () => {
    const {host} = mountBand(CARD, PROXY);
    await settle();
    const frame = host.find('.con-ptlink');
    expect(frame.exists()).to.eq(true);
    expect(frame.attributes('aria-hidden')).to.eq('true');
    expect(host.find('.con-ptlink__wire').exists(), 'nothing to connect').to.eq(false);
  });

  it('the wire is solved from the two real boxes, in the frame\'s own px — and re-solved when the step says its boxes moved', async () => {
    setPlayedTargetSelfLink({present: true, focused: false, locked: false});
    const {host, place} = mountBand(CARD, PROXY);
    const frame = host.find('.con-ptlink').element as HTMLElement;
    frame.getBoundingClientRect = () => rect(40, 20, 800, 600);
    await settle();

    const wire = () => host.find('.con-ptlink__wire').element as HTMLElement;
    expect(host.find('.con-ptlink__wire').exists()).to.eq(true);
    // From the card's right edge, at the proxy's mid-height, as long as the gap between the columns.
    expect([wire().style.left, wire().style.top, wire().style.width]).to.deep.eq(['260px', '260px', '120px']);
    expect(host.find('.con-ptlink__anchor').exists(), 'the bracket on the card\'s edge').to.eq(true);

    // The proxy moved (a re-solved card size): the step bumps the geometry nonce, the connector measures again.
    place('[data-ptsel-self]', rect(360, 300, 180, 60));
    bumpPlayedTargetSelfGeometry();
    await settle();
    expect([wire().style.left, wire().style.top, wire().style.width]).to.deep.eq(['260px', '310px', '60px']);

    // CLIENT px → LOCAL px through the shared zoom ratio: a frame laid out at half its painted width halves every number.
    Object.defineProperty(frame, 'offsetWidth', {value: 400, configurable: true});
    bumpPlayedTargetSelfGeometry();
    await settle();
    expect([wire().style.left, wire().style.top, wire().style.width]).to.deep.eq(['130px', '155px', '30px']);
  });

  it('the wire weighs itself by the link: the cursor on the proxy, the confirmed choice', async () => {
    setPlayedTargetSelfLink({present: true, focused: false, locked: false});
    const {host} = mountBand(CARD, PROXY);
    await settle();
    const classes = () => host.find('.con-ptlink__wire').classes();
    expect(classes()).to.deep.eq(['con-ptlink__wire']);

    setPlayedTargetSelfLink({present: true, focused: true, locked: false});
    await settle();
    expect(classes()).to.include('con-ptlink__wire--focused').and.to.not.include('con-ptlink__wire--locked');

    setPlayedTargetSelfLink({present: true, focused: true, locked: true});
    await settle();
    expect(classes()).to.include('con-ptlink__wire--focused').and.to.include('con-ptlink__wire--locked');
  });

  it('it degrades by disappearing: a stacked row draws no wire, and a proxy that left takes the wire with it', async () => {
    setPlayedTargetSelfLink({present: true, focused: false, locked: false});
    const {host, place} = mountBand(CARD, PROXY);
    await settle();
    expect(host.find('.con-ptlink__wire').exists()).to.eq(true);

    // The row fell back to a stack: the proxy stands UNDER the card, no longer to its right.
    place('[data-ptsel-self]', rect(100, 520, 180, 60));
    bumpPlayedTargetSelfGeometry();
    await settle();
    expect(host.find('.con-ptlink__wire').exists(), 'a wire there would describe a layout that is not on screen').to.eq(false);

    // Back beside the card…
    place('[data-ptsel-self]', PROXY);
    bumpPlayedTargetSelfGeometry();
    await settle();
    expect(host.find('.con-ptlink__wire').exists()).to.eq(true);
    // …and beside it, but past the card's bottom edge: not a height the card occupies.
    place('[data-ptsel-self]', rect(420, 520, 180, 60));
    bumpPlayedTargetSelfGeometry();
    await settle();
    expect(host.find('.con-ptlink__wire').exists()).to.eq(false);

    place('[data-ptsel-self]', PROXY);
    bumpPlayedTargetSelfGeometry();
    await settle();
    expect(host.find('.con-ptlink__wire').exists()).to.eq(true);
    // The step is gone: the wire goes in the same flush — never a frame of wire to an element that is not there.
    resetPlayedTargetSelf();
    await nextTick();
    expect(host.find('.con-ptlink__wire').exists()).to.eq(false);
  });

  it('the arrival light is ONE SHOT: seeded from the live nonce at mount, consumed when it ends, replayed only by a new arrival', async () => {
    // The host mounts the connector in the same patch that publishes the first focus: the nonce already stands.
    setPlayedTargetSelfLink({present: true, focused: true, locked: false});
    expect(playedTargetSelfState.pulse).to.eq(1);
    const {host} = mountBand(CARD, PROXY);
    await settle();
    const first = host.find('.con-ptlink__pulse');
    expect(first.exists(), 'the first arrival of the step is announced').to.eq(true);

    await first.trigger('animationend');
    expect(host.find('.con-ptlink__pulse').exists(), 'consumed — a wire that merely re-resolves replays nothing').to.eq(false);
    bumpPlayedTargetSelfGeometry();
    await settle();
    expect(host.find('.con-ptlink__wire').exists()).to.eq(true);
    expect(host.find('.con-ptlink__pulse').exists()).to.eq(false);

    // The cursor leaves the proxy and comes back: a new arrival, a new light.
    setPlayedTargetSelfLink({present: true, focused: false, locked: false});
    await settle();
    expect(host.find('.con-ptlink__pulse').exists()).to.eq(false);
    setPlayedTargetSelfLink({present: true, focused: true, locked: false});
    await settle();
    expect(playedTargetSelfState.pulse).to.eq(2);
    expect(host.find('.con-ptlink__pulse').exists()).to.eq(true);
  });

  it('a parent\'s ref reaches nothing — the two composers mount it and stand no ref on it', async () => {
    const {host} = mountBand(CARD, PROXY);
    await settle();
    expect(host.find('.con-ptlink').exists()).to.eq(true);
    expect(Object.keys((host.vm.$refs.link ?? {}) as object), 'no `defineExpose`').to.deep.eq([]);
  });
});
