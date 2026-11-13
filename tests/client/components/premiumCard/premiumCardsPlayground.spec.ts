/*
 * PremiumCardsPlayground — the dev-only showcase of the premium card face (`?premiumCardsPlayground`). A
 * `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): what it renders for its one prop (`embedded`),
 * what it hands to every face it stands — the reference quartet, the requirement cassette, the tiers and states — and
 * the catalog that follows the module chip. It emits nothing and exposes nothing.
 *
 * The face and the requirement cassette are stubbed by name: the spec asserts what the stand HANDS them, never how a
 * card is drawn.
 */
import {expect} from 'chai';
import {defineComponent, h, PropType} from 'vue';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {PREMIUM_FACE_SCOPE_MODULES, inPremiumScope} from '@/common/cards/premiumScope';
import {getCardOrThrow, getCards} from '@/client/cards/ClientCardManifest';
import {isPremiumFaceType} from '@/client/components/premiumCard/premiumCardTheme';
import {normalizeRequirement, NormalizedRequirement} from '@/client/components/premiumCard/premiumCardViewModel';
import PremiumCardsPlayground from '@/client/components/premiumCard/PremiumCardsPlayground.vue';

const CardStub = defineComponent({
  name: 'PremiumCard',
  props: {
    card: {type: Object as PropType<CardModel>, required: true},
    tier: {type: String, default: undefined},
    selected: {type: Boolean, default: false},
    lightweight: {type: Boolean, default: false},
  },
  render() {
    return h('i', {'class': 'card-stub'});
  },
});

const RequirementsStub = defineComponent({
  name: 'PremiumRequirementsBar',
  props: {
    requirements: {type: Array as PropType<Array<NormalizedRequirement>>, required: true},
  },
  render() {
    return h('i', {'class': 'req-stub'});
  },
});

/** The cards the showcase covers — the face's own scope gate, read the way the stand reads it. */
const SCOPE = getCards((c) => inPremiumScope(c, PREMIUM_FACE_SCOPE_MODULES) && isPremiumFaceType(c.type));

function standOf(embedded = false) {
  return mount(PremiumCardsPlayground, {
    global: {...globalConfig.global, stubs: {PremiumCard: CardStub, PremiumRequirementsBar: RequirementsStub}},
    props: {embedded},
  });
}

type Stand = ReturnType<typeof standOf>;

/** The section of the stand whose heading starts with `title`. */
function sectionOf(stand: Stand, title: string): Element {
  const found = stand.findAll('.pcpg__section').find((section) => section.find('h2').text().startsWith(title));
  if (found === undefined) {
    throw new Error(`the stand has no section «${title}»`);
  }
  return found.element;
}

/** The face stubs standing inside the section «title», in the stand's order. */
function cardsIn(stand: Stand, title: string) {
  const section = sectionOf(stand, title);
  return stand.findAllComponents(CardStub).filter((card) => section.contains(card.element as Element));
}

// O(cards): every mount of the stand builds the view-model of every card in scope (the density buckets, the tag
// extremes) — each test takes mocha's budget for that walk.
const WALK_MS = 15_000;

describe('PremiumCardsPlayground — the showcase of the premium card face', () => {
  it('renders the showcase for its prop: the scope\'s size in the head, the reference quartet at its printed cost, its own chrome only when nobody hosts it', () => {
    const stand = standOf();
    expect(stand.classes()).to.include('pcpg');
    expect(stand.classes()).to.not.include('pcpg--embedded');
    expect(stand.find('.pcpg__hint').text()).to.include(`${SCOPE.length} карт в скоупе`);

    const quartet = [CardName.TREES, CardName.PREDATORS, CardName.COMET, CardName.DONATION];
    const reference = cardsIn(stand, 'Референс');
    expect(reference.map((card) => card.props('card').name)).to.deep.eq(quartet);
    expect(reference.map((card) => card.props('card').calculatedCost)).to.deep.eq(quartet.map((name) => getCardOrThrow(name).cost));

    expect(standOf(true).classes()).to.include('pcpg--embedded');
  }).timeout(WALK_MS);

  it('the requirement cassette: ten synthetic cases, each handed to the bar at full size and in the reduced strip', () => {
    const stand = standOf();
    const bars = stand.findAllComponents(RequirementsStub);
    expect(bars).to.have.length(20);
    expect(bars[0].props('requirements')).to.deep.eq([normalizeRequirement({oceans: 5})]);
    expect(bars[1].props('requirements')).to.deep.eq([normalizeRequirement({oceans: 3, max: true})]);
    // The reduced strip repeats the cases in the same order; the last one carries two requirements.
    expect(bars[10].props('requirements')).to.deep.eq(bars[0].props('requirements'));
    expect(bars[19].props('requirements')).to.have.length(2);
  }).timeout(WALK_MS);

  it('a curated case carries its override, and the states row hands each state to its face', () => {
    const stand = standOf();
    const comet = cardsIn(stand, 'Эталонные кейсы')[0];
    expect(comet.props('card')).to.deep.eq({name: CardName.COMET, calculatedCost: 17});

    const states = cardsIn(stand, 'Тиры и состояния');
    expect(states.map((card) => card.props('card').name)).to.deep.eq(Array.from({length: 6}, () => CardName.PREDATORS));
    expect(states.map((card) => card.props('tier'))).to.deep.eq(['thumb', undefined, 'full', undefined, undefined, undefined]);
    expect(states.map((card) => card.props('selected'))).to.deep.eq([false, false, false, true, false, false]);
    expect(states[4].props('card').isDisabled).to.eq(true);
    expect(states[5].props('card').resources).to.eq(4);
  }).timeout(WALK_MS);

  it('the catalog follows the module chip: `base` at first, the module of the chip that was pressed after it', async () => {
    const stand = standOf();
    const chips = stand.findAll('.pcpg__chip');
    expect(chips.map((chip) => chip.text())).to.deep.eq([...PREMIUM_FACE_SCOPE_MODULES]);
    expect(stand.findAll('.pcpg__chip--on').map((chip) => chip.text())).to.deep.eq(['base']);
    const namesOf = (module: string) => SCOPE.filter((card) => card.module === module).map((card) => card.name);
    const catalog = cardsIn(stand, 'Полный каталог');
    expect(catalog.map((card) => card.props('card').name)).to.deep.eq(namesOf('base'));
    expect(catalog.every((card) => card.props('lightweight') === true)).to.eq(true);

    const other = chips.find((chip) => chip.text() !== 'base' && namesOf(chip.text()).length > 0);
    if (other === undefined) {
      throw new Error('the scope has no second module with a card');
    }
    await other.trigger('click');

    expect(stand.findAll('.pcpg__chip--on').map((chip) => chip.text())).to.deep.eq([other.text()]);
    expect(cardsIn(stand, 'Полный каталог').map((card) => card.props('card').name)).to.deep.eq(namesOf(other.text()));
  }).timeout(WALK_MS);
});
