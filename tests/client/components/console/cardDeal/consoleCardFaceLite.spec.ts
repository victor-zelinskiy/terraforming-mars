/*
 * ConsoleCardFaceLite — the lite twin of the card face the console's motion layers fly. A `<script setup>` component
 * (step A of docs/claude/vapor/RECIPES.md): four props in, nothing out, nothing exposed — the spec is what it HANDS the
 * premium renderer for them («lite is a cost budget, never a different picture»), and that an unknown name renders
 * nothing.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import ConsoleCardFaceLite from '@/client/components/console/cardDeal/ConsoleCardFaceLite.vue';

// The premium renderer is its own subject; this spec reads what the lite face hands it. The props are declared BARE
// (no types, no defaults) so that what the stub holds is exactly what was passed.
// (A render function, not a template string: the runtime compiler is not in this build.)
const PremiumStub = defineComponent({
  name: 'PremiumCard',
  props: ['name', 'card', 'lightweight', 'artTier', 'inert'],
  render: () => h('i', {class: 'premium-stub'}),
});

function face(props: {name: CardName, card?: CardModel, lightweight?: boolean, artTier?: 'full' | 'thumb'}, attrs: Record<string, unknown> = {}) {
  return mount(ConsoleCardFaceLite, {props, attrs, global: {config: globalConfig.global.config, stubs: {PremiumCard: PremiumStub}}});
}

describe('ConsoleCardFaceLite — the lite face is the premium face, inert', () => {
  it('a known card: ONE premium face — the pristine print (no live model, the normal tier, the full art), inert and hidden from the reader', () => {
    const w = face({name: CardName.ANTS});
    const faces = w.findAllComponents(PremiumStub);
    expect(faces).to.have.length(1);
    expect(faces[0].props()).to.deep.eq({name: CardName.ANTS, card: undefined, lightweight: false, artTier: 'full', inert: true});
    expect(w.find('.premium-stub').attributes('aria-hidden')).to.eq('true');
  });

  it('what the host hands is what flies: the live model, the thumb tier and the thumb art reach the renderer — and follow the props', async () => {
    const live: CardModel = {name: CardName.ANTS, resources: 3};
    const w = face({name: CardName.ANTS, card: live, lightweight: true, artTier: 'thumb'});
    const handed = w.findComponent(PremiumStub).props();
    expect(handed.card, 'the live model, as the host holds it').to.deep.eq(live);
    expect(handed).to.deep.include({name: CardName.ANTS, lightweight: true, artTier: 'thumb', inert: true});

    await w.setProps({name: CardName.BIRDS, card: undefined, lightweight: false});
    expect(w.findComponent(PremiumStub).props()).to.deep.eq({name: CardName.BIRDS, card: undefined, lightweight: false, artTier: 'thumb', inert: true});
  });

  it('an unknown name renders nothing — and a face appears when the name becomes a card', async () => {
    const w = face({name: 'No Such Card' as CardName});
    expect(w.findComponent(PremiumStub).exists()).to.eq(false);
    expect(w.find('.premium-stub').exists()).to.eq(false);

    await w.setProps({name: CardName.ANTS});
    expect(w.findComponent(PremiumStub).props('name')).to.eq(CardName.ANTS);
  });

  it('the template STARTS WITH ITS ROOT — what a host lets fall through lands on the face itself', () => {
    const w = face({name: CardName.ANTS}, {'class': 'con-deal__face', 'data-from-host': 'yes'});
    expect((w.element as HTMLElement).tagName).to.eq('I');
    expect(w.classes()).to.include.members(['premium-stub', 'con-deal__face']);
    expect(w.attributes('data-from-host')).to.eq('yes');
    expect(w.attributes('aria-hidden')).to.eq('true');
  });
});
