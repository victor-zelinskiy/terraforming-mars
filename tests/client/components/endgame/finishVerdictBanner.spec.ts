/*
 * FinishVerdictBanner — the finish VERDICT as a tier banner. A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md): one prop (`verdict`), no emits, nothing exposed — so the spec is what it renders for
 * the verdict it is given. Mounted WITHOUT the i18n plugin on purpose: the component imports `$t` and `v-i18n` itself,
 * and a Vue warning (an unresolved directive or component) fails the test.
 */
import {mount} from '@vue/test-utils';
import {defineComponent, h} from 'vue';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import {$t} from '@/client/directives/i18n';
import {Color} from '@/common/Color';
import FinishVerdictBanner from '@/client/components/endgame/FinishVerdictBanner.vue';
import type {FinishVerdict} from '@/client/components/endgame/finishVerdict';
import type {RichParam} from '@/client/components/endgame/endgameRichText';

// The line is the shared rich-text layer — its own spec's subject (`endgameRichText.spec.ts`); this one reads what the
// banner HANDS it. (A render function, not a template string: the runtime compiler is not in this build.)
const RichTextStub = defineComponent({name: 'EndgameRichText', props: ['template', 'params'], render: () => h('i', {class: 'rich-stub'})});

const LINE_KEY = 'The advantage for ${0} held and was sealed at the final count: +${1} VP.';

function verdict(over: Partial<FinishVerdict> = {}): FinishVerdict {
  return {
    scale: 'solid',
    pattern: 'normal',
    rarity: 'common',
    titleKey: 'Solid win',
    line: {
      key: LINE_KEY,
      params: [
        {t: 'raw', v: 'Victor', term: {kind: 'player', color: 'red' as Color}},
        {t: 'raw', v: '12', term: {kind: 'score', accent: true}},
      ],
    },
    glyph: '✦',
    chips: [],
    reason: 'spec',
    rareCandidates: [],
    ...over,
  };
}

function banner(props: {verdict?: FinishVerdict}) {
  return mount(FinishVerdictBanner, {
    props,
    global: {config: globalConfig.global.config, stubs: {EndgameRichText: RichTextStub}},
  });
}

describe('FinishVerdictBanner — the finish verdict as a tier banner', () => {
  it('renders nothing without a verdict; a common finish: the three axes on the root, the glyph, the title — no rarity tag, no chips', async () => {
    const w = banner({});
    expect(w.find('.eg-fv').exists()).to.eq(false);
    expect(w.findComponent(RichTextStub).exists()).to.eq(false);

    await w.setProps({verdict: verdict()});
    expect((w.element as HTMLElement).tagName).to.eq('DIV');
    expect(w.classes()).to.include.members(['eg-fv', 'eg-fv--p-normal', 'eg-fv--s-solid', 'eg-fv--r-common']);
    expect(w.find('.eg-fv__motif').attributes('aria-hidden')).to.eq('true');
    expect(w.find('.eg-fv__glyph').text()).to.eq('✦');
    expect(w.find('.eg-fv__title').text()).to.eq($t('Solid win'));
    expect(w.find('.eg-fv__tier').exists(), 'a common finish is not announced as rare').to.eq(false);
    expect(w.find('.eg-fv__chips').exists()).to.eq(false);
  });

  it('hands the line to the rich-text layer TRANSLATED — the template and every param with its term', () => {
    const w = banner({verdict: verdict({
      line: {
        key: LINE_KEY,
        params: [
          {t: 'raw', v: 'Victor', term: {kind: 'player', color: 'red' as Color}},
          {t: 'i18n', v: 'Cities & greenery', term: {kind: 'strategy'}},
          {t: 'raw', v: '12'},
        ],
      },
    })});
    expect(w.find('.eg-fv__line > .rich-stub').exists(), 'the line stands in its slot').to.eq(true);
    const line = w.findComponent(RichTextStub);
    expect(line.props('template')).to.eq($t(LINE_KEY));
    const expected: Array<RichParam> = [
      {text: 'Victor', kind: 'player', color: 'red' as Color, detail: undefined, accent: undefined},
      {text: $t('Cities & greenery'), kind: 'strategy', color: undefined, detail: undefined, accent: undefined},
      {text: '12', kind: undefined, color: undefined, detail: undefined, accent: undefined},
    ];
    expect(line.props('params')).to.deep.eq(expected);
  });

  it('a rare and a legendary finish wear their tier tag — and follow the verdict', async () => {
    const w = banner({verdict: verdict({rarity: 'rare', pattern: 'comeback', titleKey: 'A finish-line comeback'})});
    expect(w.classes()).to.include.members(['eg-fv--p-comeback', 'eg-fv--r-rare']);
    expect(w.find('.eg-fv__title').text()).to.eq($t('A finish-line comeback'));
    expect(w.find('.eg-fv__tier').text()).to.eq($t('Rare finish'));

    await w.setProps({verdict: verdict({rarity: 'legendary'})});
    expect(w.classes()).to.include('eg-fv--r-legendary');
    expect(w.find('.eg-fv__tier').text()).to.eq($t('Legendary finish'));

    await w.setProps({verdict: verdict({rarity: 'notable'})});
    expect(w.find('.eg-fv__tier').exists()).to.eq(false);
  });

  it('the evidence chips: a raw value with its unit, an i18n chip, each in its tone (neutral by default)', () => {
    const w = banner({verdict: verdict({chips: [
      {t: 'raw', v: '+14', label: 'VP', tone: 'good'},
      {t: 'i18n', v: 'Jovian tags'},
    ]})});
    const chips = w.findAll('.eg-fv__chips > .eg-chip');
    expect(chips).to.have.lengthOf(2);
    expect(chips[0].classes()).to.include('eg-chip--good');
    expect(chips[0].text().startsWith('+14'), chips[0].text()).to.eq(true);
    const parts = chips[0].findAll('span');
    expect(parts[parts.length - 1].text(), 'the unit after the value').to.eq($t('VP'));
    expect(chips[1].classes()).to.include('eg-chip--neutral');
    expect(chips[1].text()).to.eq($t('Jovian tags'));
  });
});
