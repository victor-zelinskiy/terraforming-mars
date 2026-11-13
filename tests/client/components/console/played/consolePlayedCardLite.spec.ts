/*
 * ConsolePlayedCardLite — THE tableau card face of the «Разыграно» overlay: the cheapest honest printed face. A
 * `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): one flat manifest lookup decides the face —
 * every card type is a premium-face type, so the REAL premium face renders inert at the thumb quality tier, with the
 * host's peek / art tier / optional live model handed through. It emits and exposes nothing.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {CardName} from '@/common/cards/CardName';
import ConsolePlayedCardLite from '@/client/components/console/played/ConsolePlayedCardLite.vue';

// The premium face (and the dead legacy fallback) are their own subjects; this spec reads what each is HANDED.
// (A render function, not a template string: the runtime compiler is not in this build.)
const PremiumStub = defineComponent({
  name: 'PremiumCard',
  props: {name: String, card: Object, inert: Boolean, lightweight: Boolean, peek: Boolean, artTier: String},
  render: () => h('i', {class: 'premium-stub'}),
});
const FallbackStub = defineComponent({
  name: 'ConsoleCardFaceLite',
  props: {name: String},
  render: () => h('i', {class: 'fallback-stub'}),
});

function face(props: Record<string, unknown>, attrs: Record<string, unknown> = {}) {
  return mount(ConsolePlayedCardLite as any, {
    ...globalConfig,
    props,
    attrs,
    global: {...globalConfig.global, stubs: {PremiumCard: PremiumStub, ConsoleCardFaceLite: FallbackStub}},
  });
}

describe('ConsolePlayedCardLite — the tableau card face', () => {
  it('a card of the manifest is the REAL premium face — name-only, inert, lightweight, the art at its full tier', () => {
    const w = face({name: CardName.TREES}, {'class': 'from-host', 'data-played-key': CardName.TREES});
    const premium = w.findComponent(PremiumStub);
    expect(premium.exists()).to.eq(true);
    expect(premium.props('name')).to.eq(CardName.TREES);
    expect(premium.props('card'), 'the table at rest is name-only').to.eq(undefined);
    expect(premium.props('inert')).to.eq(true);
    expect(premium.props('lightweight')).to.eq(true);
    expect(premium.props('peek')).to.eq(false);
    expect(premium.props('artTier')).to.eq('full');
    expect(w.findComponent(FallbackStub).exists()).to.eq(false);

    // The template STARTS WITH ITS ROOT: the face IS the root, so the host's attributes land on it.
    expect(w.classes()).to.include.members(['premium-stub', 'from-host']);
    expect(w.attributes('data-played-key')).to.eq(CardName.TREES);
    expect(w.attributes('aria-hidden')).to.eq('true');
  });

  it('hands the host\'s choices through: the peek crop (unless the art is kept), the art tier, the live model', async () => {
    const w = face({name: CardName.TREES, peek: true, artTier: 'thumb'});
    const premium = w.findComponent(PremiumStub);
    expect(premium.props('peek'), 'covered in a pile — the header band only').to.eq(true);
    expect(premium.props('artTier')).to.eq('thumb');

    // KEEP THE ART: the host stays in its peek layout, the face keeps its art subtree mounted.
    await w.setProps({keepArt: true});
    expect(premium.props('peek')).to.eq(false);

    await w.setProps({peek: false, keepArt: false});
    expect(premium.props('peek')).to.eq(false);

    const model = {name: CardName.TREES, resources: 2};
    await w.setProps({card: model});
    expect(premium.props('card')).to.deep.eq(model);
    expect(premium.props('inert'), 'a live model never makes the face interactive').to.eq(true);
  });

  it('follows its name — and a name the manifest does not know falls to the lite face, never a premium one', async () => {
    const w = face({name: CardName.TREES});
    await w.setProps({name: CardName.BUSHES});
    expect(w.findComponent(PremiumStub).props('name')).to.eq(CardName.BUSHES);

    await w.setProps({name: 'No Such Card'});
    expect(w.findComponent(PremiumStub).exists()).to.eq(false);
    const fallback = w.findComponent(FallbackStub);
    expect(fallback.exists()).to.eq(true);
    expect(fallback.props('name')).to.eq('No Such Card');
  });
});
