/*
 * FinalScoringInspector — the explainability panel of the final-scoring reveal. A `<script setup>` component (step A
 * of docs/claude/vapor/RECIPES.md): one prop (`content`), two emits (`keep` / `release` — the host's close timer
 * bridges the cursor's way into the panel), nothing exposed — so the spec is what it renders for its content, what it
 * emits, and the card row's delayed hover preview. The preview popover is its own subject and is stubbed by name.
 * Mounted WITHOUT the i18n plugin on purpose: the component imports `v-i18n` itself, and a Vue warning fails the test.
 */
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick} from 'vue';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import {CardName} from '@/common/cards/CardName';
import FinalScoringInspector from '@/client/components/endgame/FinalScoringInspector.vue';
import {FinalScoringInspectorContent} from '@/client/components/endgame/finalScoringRevealModel';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';

// (A render function, not a template string: the runtime compiler is not in this build.)
const PopoverStub = defineComponent({name: 'CardPreviewPopover', props: ['name', 'visible', 'anchor'], render: () => h('i', {class: 'popover-stub'})});

/** A per-player breakdown of the «cards» category — sub-rows, scoring cards, sources. */
function content(overrides: Partial<FinalScoringInspectorContent> = {}): FinalScoringInspectorContent {
  return {
    group: 'cards',
    accent: 'cards',
    label: 'Cards',
    description: 'Victory points printed on played cards.',
    playerName: 'Victor',
    playerColor: 'red',
    total: 7,
    subRows: [
      {key: 'cards-animals', label: 'Animals', accent: 'animals', value: 5},
      {key: 'cards-penalty', label: 'Penalties', accent: 'penalty', value: -2},
    ],
    cards: [
      {name: CardName.PETS, kindLabel: 'Animals', vp: 3, resourcesText: '6'},
      {name: (CardName.BIRDS + ':2') as CardName, kindLabel: '', vp: -1},
    ],
    cardsLabel: 'Scoring cards',
    hint: 'Showing the top cards',
    sources: [{text: 'Terraformer', vp: 5}, {text: 'Lost a bet', vp: -2}],
    sourcesLabel: 'Sources',
    compare: [],
    ...overrides,
  };
}

function inspector(c: FinalScoringInspectorContent) {
  return mount(FinalScoringInspector, {
    props: {content: c},
    global: {config: globalConfig.global.config, stubs: {CardPreviewPopover: PopoverStub}},
  });
}

describe('FinalScoringInspector — the reveal\'s explainability panel', () => {
  let clock: ManualFlowClock;

  beforeEach(() => {
    clock = createManualClock(0);
    setFlowClock(clock);
  });
  afterEach(() => {
    setFlowClock(undefined);
  });

  it('a player\'s lane reads its head — category, player, signed total — then the sub-rows, the scoring cards and the sources', () => {
    const w = inspector(content());
    expect(w.classes()).to.deep.eq(['fsr-insp', 'fsr-cat--cards']);
    expect(w.find('.fsr-insp__name').text()).to.eq('Cards');
    expect(w.find('.fsr-insp__player').text()).to.eq('Victor');
    expect(w.find('.fsr-insp__player-dot').classes()).to.include('player_bg_color_red');
    expect(w.find('.fsr-insp__total').text()).to.eq('+7');
    expect(w.find('.fsr-insp__desc').text()).to.eq('Victory points printed on played cards.');
    expect(w.find('.fsr-insp__compare').exists(), 'a lane is not a comparison').to.eq(false);

    const subs = w.findAll('.fsr-insp__sub');
    expect(subs.map((s) => s.classes().find((c) => c.startsWith('fsr-cat--')))).to.deep.eq(['fsr-cat--animals', 'fsr-cat--penalty']);
    expect(subs.map((s) => s.find('.fsr-insp__sub-label').text())).to.deep.eq(['Animals', 'Penalties']);
    expect(subs.map((s) => s.find('.fsr-insp__sub-val').text())).to.deep.eq(['+5', '-2']);

    expect(w.findAll('.fsr-insp__section-head').map((s) => s.text())).to.deep.eq(['Scoring cards', 'Sources']);
    const cards = w.findAll('.fsr-insp__card-row');
    expect(cards.map((c) => c.find('.fsr-insp__card-name').text()), 'a copy\'s suffix is not part of the name').to.deep.eq([CardName.PETS, CardName.BIRDS]);
    expect(cards.map((c) => c.find('.fsr-insp__card-vp').text())).to.deep.eq(['+3', '-1']);
    expect(cards.map((c) => c.classes().includes('fsr-insp__card-row--neg'))).to.deep.eq([false, true]);
    expect(cards[0].find('.fsr-insp__card-kind').text()).to.eq('Animals');
    expect(cards[0].find('.fsr-insp__card-res').text()).to.eq('6');
    expect(cards[1].find('.fsr-insp__card-kind').exists(), 'no kind — no chip').to.eq(false);
    expect(cards[1].find('.fsr-insp__card-res').exists()).to.eq(false);
    expect(w.find('.fsr-insp__hint').text()).to.eq('Showing the top cards');

    const sources = w.findAll('.fsr-insp__src-row');
    expect(sources.map((s) => s.find('.fsr-insp__src-text').text())).to.deep.eq(['Terraformer', 'Lost a bet']);
    expect(sources.map((s) => s.find('.fsr-insp__src-vp').text())).to.deep.eq(['+5', '-2']);
    expect(sources.map((s) => s.classes().includes('fsr-insp__src-row--neg'))).to.deep.eq([false, true]);
    expect(w.findComponent(PopoverStub).exists(), 'no card hovered — no preview').to.eq(false);
  });

  it('with no player it is a COMPARISON — one row per seat — and empty lists draw no section', async () => {
    const w = inspector(content({
      playerName: '', playerColor: undefined, total: 0,
      compare: [{color: 'red', name: 'Victor', value: 7}, {color: 'blue', name: 'Nastya', value: -1}],
    }));
    expect(w.find('.fsr-insp__player').exists()).to.eq(false);
    expect(w.find('.fsr-insp__total').exists()).to.eq(false);
    const rows = w.findAll('.fsr-insp__cmp-row');
    expect(rows.map((r) => r.find('.fsr-insp__cmp-name').text())).to.deep.eq(['Victor', 'Nastya']);
    expect(rows.map((r) => r.find('.fsr-insp__cmp-val').text())).to.deep.eq(['+7', '-1']);
    expect(rows.map((r) => r.find('.fsr-insp__player-dot').classes().find((c) => c.startsWith('player_bg_color_'))))
      .to.deep.eq(['player_bg_color_red', 'player_bg_color_blue']);
    expect(w.find('.fsr-insp__subs').exists(), 'the breakdown belongs to a lane').to.eq(false);
    expect(w.find('.fsr-insp__cards').exists()).to.eq(false);

    await w.setProps({content: content({subRows: [], cards: [], sources: [], cardsLabel: '', sourcesLabel: '', hint: ''})});
    expect(w.find('.fsr-insp__compare').exists()).to.eq(false);
    expect(w.find('.fsr-insp__subs').exists()).to.eq(false);
    expect(w.find('.fsr-insp__cards').exists()).to.eq(false);
    expect(w.find('.fsr-insp__sources').exists()).to.eq(false);
  });

  it('the cursor entering the panel emits `keep`, leaving it `release` — once each, with no payload', async () => {
    const w = inspector(content());
    await w.trigger('mouseenter');
    expect(w.emitted('keep')).to.deep.eq([[]]);
    expect(w.emitted('release')).to.eq(undefined);
    await w.trigger('mouseleave');
    expect(w.emitted('release')).to.deep.eq([[]]);
    expect(w.emitted('keep'), 'still one keep').to.deep.eq([[]]);
  });

  it('a card row\'s preview is named at once and shown after the hover delay; leaving hides it and takes a pending delay back', async () => {
    const w = inspector(content());
    const rows = w.findAll('.fsr-insp__card-row');
    const idle = clock.pending();

    await rows[0].trigger('mouseenter');
    const popover = w.findComponent(PopoverStub);
    expect(popover.props('name')).to.eq(CardName.PETS);
    expect(popover.props('anchor'), 'anchored at the row').to.not.eq(undefined);
    expect(popover.props('visible'), 'not before the delay').to.eq(false);
    clock.advance(149);
    await nextTick();
    expect(popover.props('visible')).to.eq(false);
    clock.advance(1);
    await nextTick();
    expect(popover.props('visible')).to.eq(true);

    await rows[0].trigger('mouseleave');
    expect(popover.props('visible')).to.eq(false);

    // A pass over a row shorter than the delay never shows it — and the next row starts its own delay.
    await rows[1].trigger('mouseenter');
    expect(popover.props('name')).to.eq(CardName.BIRDS + ':2');
    clock.advance(100);
    await rows[1].trigger('mouseleave');
    clock.advance(500);
    await nextTick();
    expect(popover.props('visible'), 'the delay was taken back').to.eq(false);
    expect(clock.pending(), 'nothing left armed').to.eq(idle);
  });
});
