/*
 * ConsoleDeckPickLayer — the app-level stage the «draw & select» faces fly on. A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md): no props, no emits, nothing exposed — the surface names the faces
 * (`armDeckPickFlight`) and reads the bodies back (`deckPickProxyEls`), so the spec is what the layer mounts for the
 * named batch and what it registers. The lite face is stubbed by name (the spec reads the card it is handed).
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {CardName} from '@/common/cards/CardName';
import {armDeckPickFlight, clearDeckPickFlight, deckPickProxyEls} from '@/client/console/deckPick/consoleDeckPick';
import ConsoleDeckPickLayer from '@/client/components/console/deckPick/ConsoleDeckPickLayer.vue';

const FaceLiteStub = defineComponent({
  name: 'ConsoleCardFaceLite',
  props: {name: {type: String, default: ''}},
  render: () => h('i', {class: 'face-stub'}),
});

function layer() {
  // Attached: the director's read (`deckPickProxyEls`) answers only for bodies that are in the document.
  return mount(ConsoleDeckPickLayer, {
    attachTo: document.body,
    global: {...globalConfig.global, stubs: {ConsoleCardFaceLite: FaceLiteStub}},
  });
}

describe('ConsoleDeckPickLayer — the stage of the draw & select flight', () => {
  beforeEach(() => clearDeckPickFlight());
  afterEach(() => clearDeckPickFlight());

  it('is empty while no flight is armed', () => {
    const w = layer();
    expect(w.find('.con-deckpick-fly').exists()).to.eq(false);
    expect(deckPickProxyEls()).to.deep.eq([]);
  });

  it('mounts one flying body per named face, in batch order, and registers them for the director', async () => {
    const w = layer();
    armDeckPickFlight([CardName.ANTS, CardName.ALGAE]);
    await nextTick();
    expect(w.classes()).to.deep.eq(['con-deckpick-fly']);
    expect(w.attributes('aria-hidden')).to.eq('true');
    const bodies = w.findAll('.con-deckpick-fly > .con-deal-proxy');
    expect(bodies).to.have.length(2);
    expect(w.findAllComponents(FaceLiteStub).map((face) => face.props('name'))).to.deep.eq([CardName.ANTS, CardName.ALGAE]);
    for (const body of bodies) {
      expect(body.find('.con-deal-proxy__flip > .con-deal-proxy__face > .face-stub').exists(), 'the face').to.eq(true);
      expect(body.find('.con-deal-proxy__flip > .con-deal-proxy__back > .con-card-back--flyer').exists(), 'its back').to.eq(true);
    }
    const registered = deckPickProxyEls();
    expect(registered).to.have.length(2);
    expect(registered.every((el, i) => el === bodies[i].element), 'the very bodies, by batch index').to.eq(true);
  });

  it('follows the flight: a new arm re-creates the bodies, the flight\'s end takes them away', async () => {
    const w = layer();
    armDeckPickFlight([CardName.ANTS]);
    await nextTick();
    const first = w.find('.con-deal-proxy').element;

    armDeckPickFlight([CardName.ANTS]);
    await nextTick();
    const second = w.find('.con-deal-proxy').element;
    expect(second, 'the same face of a NEW flight is a new body').to.not.eq(first);
    const registered = deckPickProxyEls();
    expect(registered).to.have.length(1);
    expect(registered[0] === second, 'the director reads the new body').to.eq(true);

    clearDeckPickFlight();
    await nextTick();
    expect(w.find('.con-deckpick-fly').exists()).to.eq(false);
    expect(deckPickProxyEls()).to.deep.eq([]);
  });
});
