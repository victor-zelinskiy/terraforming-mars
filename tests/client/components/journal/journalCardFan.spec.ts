/*
 * JournalCardFan — a draw read as cards: the journal's fan of real faces. A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md): four props in, nothing out — the spec is what it renders for them.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h} from 'vue';
import {globalConfig} from '../getLocalVue';
import {$t} from '@/client/directives/i18n';
import {CardName} from '@/common/cards/CardName';
import JournalCardFan from '@/client/components/journal/JournalCardFan.vue';

// The lite face is the premium renderer — its own subject; this spec reads what the fan HANDS each face.
// (A render function, not a template string: the runtime compiler is not in this build.)
const FaceStub = defineComponent({
  name: 'ConsoleCardFaceLite',
  props: ['name', 'lightweight', 'artTier'],
  render: () => h('i', {class: 'face-stub'}),
});

const EIGHT = [
  CardName.ANTS, CardName.BIRDS, CardName.COMET, CardName.ALGAE, CardName.FISH, CardName.LICHEN, CardName.PETS, CardName.TREES,
];

function fan(props: Record<string, unknown>, attrs: Record<string, unknown> = {}) {
  // No i18n plugin on purpose: the component imports its own `$t` — the global one is not there to lean on.
  return mount(JournalCardFan, {props, attrs, global: {config: globalConfig.global.config, stubs: {ConsoleCardFaceLite: FaceStub}}});
}

describe('JournalCardFan — a draw read as cards', () => {
  it('a fan of the real faces, in order — each names its card, lightweight, on the thumb art', () => {
    const three = EIGHT.slice(0, 3);
    const w = fan({cards: three});
    expect(w.classes()).to.deep.eq(['journal-fan', 'journal-fan--kept']);
    expect(w.attributes('data-fan-kind')).to.eq('kept');
    expect(w.attributes('data-fan-count')).to.eq('3');
    const cards = w.findAll('.journal-fan__card');
    expect(cards.map((card) => card.attributes('data-card'))).to.deep.eq(three);
    expect(cards.map((card) => card.attributes('aria-label'))).to.deep.eq(three.map((name) => $t(name)));
    expect(cards.map((card) => Object.keys(card.attributes()).sort()), 'no hook asked — no stray attribute')
      .to.deep.eq(three.map(() => ['aria-label', 'class', 'data-card']));
    const faces = w.findAllComponents(FaceStub);
    expect(faces.map((face) => face.props())).to.deep.eq(three.map((name) => ({name, lightweight: true, artTier: 'thumb'})));
    expect(w.findAll('.journal-fan__card > .journal-fan__face > .face-stub')).to.have.length(3);
    expect(w.find('.journal-fan__more').exists(), 'nothing is hidden').to.eq(false);
  });

  it('beyond `max` the rest is ONE «+N» — the count stays the whole draw, and both follow the props', async () => {
    const w = fan({cards: EIGHT});
    expect(w.findAll('.journal-fan__card').map((card) => card.attributes('data-card'))).to.deep.eq(EIGHT.slice(0, 6));
    expect(w.find('.journal-fan__more').text()).to.eq('+2');
    expect(w.attributes('data-fan-count')).to.eq('8');

    await w.setProps({max: 3});
    expect(w.findAll('.journal-fan__card').map((card) => card.attributes('data-card'))).to.deep.eq(EIGHT.slice(0, 3));
    expect(w.find('.journal-fan__more').text()).to.eq('+5');

    await w.setProps({cards: EIGHT.slice(0, 2)});
    expect(w.findAll('.journal-fan__card')).to.have.length(2);
    expect(w.find('.journal-fan__more').exists()).to.eq(false);
    expect(w.attributes('data-fan-count')).to.eq('2');
  });

  it('a discard fan says so, and every face carries the host\'s hook', () => {
    const w = fan({cards: EIGHT.slice(0, 2), kind: 'discard', hook: 'data-journal-search-discard'});
    expect(w.classes()).to.deep.eq(['journal-fan', 'journal-fan--discard']);
    expect(w.attributes('data-fan-kind')).to.eq('discard');
    const hooked = w.findAll('[data-journal-search-discard]');
    expect(hooked.map((card) => card.attributes('data-card'))).to.deep.eq(EIGHT.slice(0, 2));
    expect(hooked.map((card) => card.classes())).to.deep.eq([['journal-fan__card'], ['journal-fan__card']]);
  });

  it('the template STARTS WITH ITS ROOT — what a host lets fall through lands on the fan itself', () => {
    const w = fan({cards: EIGHT.slice(0, 1)}, {'class': 'journal-child-row__search-fan', 'data-from-host': 'yes'});
    expect((w.element as HTMLElement).tagName).to.eq('SPAN');
    expect(w.classes()).to.include.members(['journal-fan', 'journal-fan--kept', 'journal-child-row__search-fan']);
    expect(w.attributes('data-from-host')).to.eq('yes');
  });
});
