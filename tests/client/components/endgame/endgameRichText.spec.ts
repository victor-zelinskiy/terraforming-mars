import {mount} from '@vue/test-utils';
import {defineComponent, h} from 'vue';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import {buildNarrativeTokens, RichParam} from '@/client/components/endgame/endgameRichText';
import EndgameRichText from '@/client/components/endgame/EndgameRichText.vue';
import {endgamePlayerHex} from '@/client/components/endgame/endgameColors';
import {Color} from '@/common/Color';
import type {ChipDetail} from '@/client/components/endgame/insightDetail';

const detail = (): ChipDetail => ({title: 'x', explanation: 'y', evidence: []});

describe('endgameRichText.buildNarrativeTokens (Iteration 17 §4)', () => {
  it('splits a template into text + term tokens by ${n}', () => {
    const tokens = buildNarrativeTokens('Plans: ${0} vs ${1}.', [
      {text: 'Nastya', kind: 'player', color: 'red' as Color},
      {text: 'Cities & greenery', kind: 'strategy', detail: detail()},
    ]);
    expect(tokens.map((t) => t.type)).to.deep.eq(['text', 'term', 'text', 'term', 'text']);
    expect(tokens[1]).to.include({type: 'term', kind: 'player', text: 'Nastya'});
    expect(tokens[3]).to.include({type: 'term', kind: 'strategy', text: 'Cities & greenery'});
  });

  it('inlines a param without a kind as plain text (no term)', () => {
    const tokens = buildNarrativeTokens('A ${0} B', [{text: 'plain'}]);
    expect(tokens).to.deep.eq([{type: 'text', text: 'A '}, {type: 'text', text: 'plain'}, {type: 'text', text: ' B'}]);
  });

  it('leaves an out-of-range placeholder literal (never throws)', () => {
    const tokens = buildNarrativeTokens('x ${5} y', []);
    expect(tokens.some((t) => t.type === 'text' && t.text === '${5}')).to.be.true;
  });

  it('handles a template with no placeholders', () => {
    expect(buildNarrativeTokens('just text', [])).to.deep.eq([{type: 'text', text: 'just text'}]);
  });
});

/*
 * THE RENDERER of those tokens — `EndgameRichText.vue`, a `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md). It takes two props (the translated template and its params), emits nothing and
 * exposes nothing: the spec is what it renders for them. A Vue warning (an unresolved component) fails the test.
 */

// The hoverable term is `ExplainableBadge` (a popover, a teleport — its own subject); this spec reads what it is HANDED.
// (A render function, not a template string: the runtime compiler is not in this build.)
const BadgeStub = defineComponent({name: 'ExplainableBadge', props: ['label', 'detail', 'badgeClass'], render: () => h('i', {class: 'badge-stub'})});

function richText(template: string, params: ReadonlyArray<RichParam>) {
  return mount(EndgameRichText, {
    props: {template, params},
    global: {config: globalConfig.global.config, stubs: {ExplainableBadge: BadgeStub}},
  });
}

describe('EndgameRichText.vue — the inline rich-text renderer (Iteration 17 §4)', () => {
  it('renders plain runs as text and a term as a span of its kind — a player in their colour, a number accented', () => {
    const w = richText('${0} won by ${1} VP.', [
      {text: 'Nastya', kind: 'player', color: 'red' as Color},
      {text: '12', kind: 'score', accent: true},
    ]);
    expect((w.element as HTMLElement).tagName).to.eq('SPAN');
    expect(w.classes()).to.deep.eq(['eg-richtext']);
    expect(w.text()).to.eq('Nastya won by 12 VP.');
    const terms = w.findAll('span.eg-term');
    expect(terms.map((t) => t.text())).to.deep.eq(['Nastya', '12']);
    expect(terms[0].classes()).to.include('eg-term--player');
    expect(terms[0].classes()).to.not.include('eg-term--accent');
    expect((terms[0].element as HTMLElement).style.getPropertyValue('--eg-pc')).to.eq(endgamePlayerHex('red'));
    expect(terms[1].classes()).to.include.members(['eg-term--score', 'eg-term--accent']);
    expect((terms[1].element as HTMLElement).style.getPropertyValue('--eg-pc'), 'no colour — no player tint').to.eq('');
    expect(w.findComponent(BadgeStub).exists(), 'no detail — no hoverable badge').to.eq(false);
  });

  it('a term with a DETAIL is the hoverable badge — handed its text, its detail and the class of its kind', () => {
    const d = detail();
    const w = richText('Plan: ${0}', [{text: 'Cities & greenery', kind: 'strategy', detail: d}]);
    const badge = w.findComponent(BadgeStub);
    expect(badge.exists()).to.eq(true);
    expect(badge.props('label')).to.eq('Cities & greenery');
    expect(badge.props('detail')).to.deep.eq(d);
    expect(badge.props('badgeClass')).to.eq('eg-term eg-term--strategy');
    expect(w.find('span.eg-term').exists(), 'the badge stands instead of the plain term').to.eq(false);
    expect(w.text()).to.eq('Plan:');
  });

  it('a param without a kind is plain text — and the line follows its props', async () => {
    const w = richText('A ${0} B', [{text: 'plain'}]);
    expect(w.text()).to.eq('A plain B');
    expect(w.find('.eg-term').exists()).to.eq(false);

    await w.setProps({template: '${0}!', params: [{text: 'Victor', kind: 'player', color: 'blue' as Color}]});
    expect(w.text()).to.eq('Victor!');
    const term = w.find('span.eg-term--player');
    expect(term.text()).to.eq('Victor');
    expect((term.element as HTMLElement).style.getPropertyValue('--eg-pc')).to.eq(endgamePlayerHex('blue'));
  });
});
