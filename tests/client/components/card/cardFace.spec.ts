/*
 * CardFace — the FACADE every host imports as `Card`: the one routing point onto the premium card renderer. A
 * `<script setup>` component (step A of docs/claude/vapor/RECIPES.md). It has no visual logic of its own — the spec
 * is its contract with the hosts: a known card is the premium face with every prop and the slot handed through, an
 * unknown card name is NOTHING (never a crash), and what a host lets fall through lands on the face.
 */
import {mount} from '@vue/test-utils';
import {defineComponent, h} from 'vue';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import CardFace from '@/client/components/card/CardFace.vue';

// The premium renderer is its own specs' subject; this one reads what the facade HANDS it.
// (A render function, not a template string: the runtime compiler is not in this build.)
const PremiumStub = defineComponent({
  name: 'PremiumCard',
  props: ['card', 'actionUsed', 'robotCard', 'cubeColor', 'autoTall', 'lightweight', 'artTier', 'inert'],
  setup(_props, {slots}) {
    return () => h('i', {class: 'premium-stub'}, slots.default?.());
  },
});

const ANTS: CardModel = {name: CardName.ANTS};

function face(props: Record<string, unknown>, attrs: Record<string, unknown> = {}, slot?: string) {
  return mount(CardFace, {
    ...globalConfig,
    props,
    attrs,
    slots: slot === undefined ? {} : {default: () => h('b', {class: 'host-slot'}, slot)},
    global: {...globalConfig.global, stubs: {PremiumCard: PremiumStub}},
  });
}

describe('CardFace — the facade onto the premium card', () => {
  it('a known card is the premium face — the card handed over, every option at its default', () => {
    const w = face({card: ANTS});
    const premium = w.findComponent(PremiumStub);
    expect(premium.exists()).to.eq(true);
    expect(premium.props()).to.deep.eq({
      card: ANTS,
      actionUsed: false,
      robotCard: undefined,
      cubeColor: 'neutral',
      autoTall: false,
      lightweight: false,
      artTier: 'full',
      inert: false,
    });
  });

  it('hands every option and the host\'s slot through — and follows a change', async () => {
    const robot: CardModel = {name: CardName.BIRDS};
    const w = face({
      card: ANTS, actionUsed: true, robotCard: robot, cubeColor: 'red', autoTall: true, lightweight: true, artTier: 'thumb', inert: true,
    }, {}, 'over the card');
    const premium = w.findComponent(PremiumStub);
    expect(premium.props()).to.deep.eq({
      card: ANTS,
      actionUsed: true,
      robotCard: robot,
      cubeColor: 'red',
      autoTall: true,
      lightweight: true,
      artTier: 'thumb',
      inert: true,
    });
    expect(w.find('.premium-stub > .host-slot').text(), 'the slot lands INSIDE the face').to.eq('over the card');

    const fish: CardModel = {name: CardName.FISH, resources: 2};
    await w.setProps({card: fish, actionUsed: false});
    expect(premium.props('card')).to.deep.eq(fish);
    expect(premium.props('actionUsed')).to.eq(false);
  });

  it('an unknown card name renders NOTHING — and the face comes back with a known one', async () => {
    const w = face({card: {name: 'A Card Nobody Registered' as CardName}});
    expect(w.findComponent(PremiumStub).exists()).to.eq(false);
    expect(w.find('.premium-stub').exists()).to.eq(false);

    await w.setProps({card: ANTS});
    expect(w.findComponent(PremiumStub).exists()).to.eq(true);
  });

  it('the template STARTS WITH ITS ROOT — what a host lets fall through lands on the face itself', () => {
    const w = face({card: ANTS}, {'class': 'host-slot-card', 'data-from-host': 'yes'});
    expect((w.element as HTMLElement).tagName).to.eq('I');
    expect(w.classes()).to.include.members(['premium-stub', 'host-slot-card']);
    expect(w.attributes('data-from-host')).to.eq('yes');
  });
});
