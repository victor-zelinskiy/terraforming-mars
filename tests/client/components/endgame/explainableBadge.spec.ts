/*
 * ExplainableBadge — an analytical badge / chip with its explanation popover: hover or keyboard focus opens it, a
 * click toggles it, Escape closes it; a badge with no detail is plain text. A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md): four props (`label`, `detail`, `badgeClass`, `markless`), no emits, nothing exposed —
 * so the spec is what it renders for them and how it answers the pointer and the keys. Mounted WITHOUT the i18n plugin
 * on purpose: the component imports `$t` and `v-i18n` itself, and a Vue warning (an unresolved directive) fails the
 * test. The popover's close delay is an owned wait of the flow kernel — the spec drives the kernel's clock.
 */
import {mount} from '@vue/test-utils';
import {nextTick} from 'vue';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import ExplainableBadge from '@/client/components/endgame/ExplainableBadge.vue';
import type {ChipDetail} from '@/client/components/endgame/insightDetail';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';

function badge(props: {label: string, detail?: ChipDetail, badgeClass?: string, markless?: boolean}) {
  return mount(ExplainableBadge, {
    props,
    // The teleport is stubbed so the popover is read where it is rendered (its target is the document's body).
    global: {config: globalConfig.global.config, stubs: {teleport: true}},
  });
}

function detail(overrides: Partial<ChipDetail> = {}): ChipDetail {
  return {
    title: 'Engine builder',
    explanation: 'Most of the score came from production.',
    evidence: [{t: 'raw', v: '12 M€'}, {t: 'i18n', v: 'Above the table', tone: 'good'}],
    ...overrides,
  };
}

describe('ExplainableBadge — a badge that explains itself', () => {
  let clock: ManualFlowClock;

  beforeEach(() => {
    clock = createManualClock(0);
    setFlowClock(clock);
  });
  afterEach(() => {
    setFlowClock(undefined);
  });

  it('with no detail it is plain text in its class — not focusable, no marker, nothing to open', async () => {
    const w = badge({label: 'Leader'});
    expect(w.classes()).to.deep.eq(['eg-xbadge', 'eg-insight__badge']);
    expect(w.text()).to.eq('Leader');
    expect(w.attributes('aria-label')).to.eq('Leader');
    expect(w.attributes('tabindex')).to.eq(undefined);
    expect(w.attributes('role')).to.eq(undefined);
    expect(w.attributes('aria-expanded')).to.eq(undefined);
    expect(w.find('.eg-xbadge__mark').exists()).to.eq(false);

    await w.trigger('mouseenter');
    await w.trigger('click');
    expect(w.find('.eg-detail').exists(), 'nothing to explain').to.eq(false);
  });

  it('with a detail it is a button that carries the explanation — its own class, the marker unless told otherwise', () => {
    const w = badge({label: 'Leader', detail: detail(), badgeClass: 'eg-term eg-term--strategy'});
    expect(w.classes()).to.deep.eq(['eg-xbadge', 'eg-term', 'eg-term--strategy', 'eg-xbadge--interactive']);
    expect(w.attributes('tabindex')).to.eq('0');
    expect(w.attributes('role')).to.eq('button');
    expect(w.attributes('aria-label')).to.eq('Leader — Most of the score came from production.');
    expect(w.attributes('aria-expanded')).to.eq('false');
    expect(w.find('.eg-xbadge__mark').text()).to.eq('✦');
    expect(w.find('teleport-stub').attributes('to')).to.eq('body');
    expect(w.find('.eg-detail').exists(), 'closed until asked').to.eq(false);

    const inline = badge({label: 'Leader', detail: detail(), markless: true});
    expect(inline.find('.eg-xbadge__mark').exists(), 'an inline term\'s underline is its affordance').to.eq(false);
  });

  it('the popover says what the detail holds — title, confidence, explanation, evidence, breakdown, why, caveat — and nothing it lacks', async () => {
    const w = badge({label: 'Leader', detail: detail()});
    await w.trigger('mouseenter');
    const pop = w.find('.eg-detail');
    expect(pop.attributes('role')).to.eq('tooltip');
    expect(pop.classes(), 'no family — the generic accent').to.deep.eq(['eg-detail', 'eg-detail--fam-generic']);
    // Fixed at the badge (jsdom's rect is the origin): 8 below it, 360 wide.
    const style = (pop.element as HTMLElement).style;
    expect([style.position, style.left, style.top, style.width, style.bottom]).to.deep.eq(['fixed', '0px', '8px', '360px', '']);
    expect(pop.find('.eg-detail__title').text()).to.eq('Engine builder');
    expect(pop.find('.eg-detail__explain').text()).to.eq('Most of the score came from production.');
    expect(pop.find('.eg-detail__conf').exists(), 'no confidence given').to.eq(false);
    const chips = pop.findAll('.eg-detail__evidence > .eg-chip');
    expect(chips.map((chip) => chip.text())).to.deep.eq(['12 M€', 'Above the table']);
    expect(chips.map((chip) => chip.classes())).to.deep.eq([['eg-chip', 'eg-chip--neutral'], ['eg-chip', 'eg-chip--good']]);
    expect(chips.map((chip) => chip.find('span').exists()), 'a raw value is not a translation key').to.deep.eq([false, true]);
    expect(pop.find('.eg-detail__breakdown').exists()).to.eq(false);
    expect(pop.find('.eg-detail__why').exists()).to.eq(false);
    expect(pop.find('.eg-detail__caveat').exists()).to.eq(false);

    await w.setProps({
      detail: detail({
        evidence: [],
        confidence: 'measured',
        accent: 'economy',
        breakdown: [{label: 'Pets', value: '3'}, {label: 'Birds', value: '2'}],
        whyItMatters: 'It decided the game.',
        caveat: 'Card draw is not counted.',
      }),
    });
    const full = w.find('.eg-detail');
    expect(full.classes()).to.deep.eq(['eg-detail', 'eg-detail--fam-economy']);
    expect(full.find('.eg-detail__conf').classes()).to.deep.eq(['eg-detail__conf', 'eg-detail__conf--measured']);
    expect(full.find('.eg-detail__conf').text()).to.eq('Measured');
    expect(full.find('.eg-detail__evidence').exists(), 'no evidence — no row').to.eq(false);
    const rows = full.findAll('.eg-detail__breakdown > .eg-detail__bd-row');
    expect(rows.map((row) => row.find('.eg-detail__bd-label').text())).to.deep.eq(['Pets', 'Birds']);
    expect(rows.map((row) => row.find('.eg-detail__bd-val').text().replace(/\s+/g, ' '))).to.deep.eq(['3 VP', '2 VP']);
    expect(full.findAll('.eg-detail__why > span').map((part) => part.text())).to.deep.eq(['Why it matters', 'It decided the game.']);
    expect(full.find('.eg-detail__why > span').classes()).to.deep.eq(['eg-detail__why-lbl']);
    expect(full.find('.eg-detail__caveat').text()).to.eq('Card draw is not counted.');
  });

  it('hover and focus open it; leaving closes it after a short delay a quick return takes back; a click toggles; Escape closes', async () => {
    const w = badge({label: 'Leader', detail: detail()});
    const isOpen = () => w.find('.eg-detail').exists();
    const idle = clock.pending();

    await w.trigger('mouseenter');
    expect(isOpen()).to.eq(true);
    expect(w.attributes('aria-expanded')).to.eq('true');

    // A flick of the cursor does not strobe the popover: the close waits 90 ms…
    await w.trigger('mouseleave');
    clock.advance(89);
    await nextTick();
    expect(isOpen(), 'not before the delay').to.eq(true);
    // …and coming back inside it takes the close back.
    await w.trigger('focus');
    clock.advance(500);
    await nextTick();
    expect(isOpen(), 'the delay was taken back').to.eq(true);
    expect(clock.pending(), 'nothing left armed').to.eq(idle);

    await w.trigger('blur');
    clock.advance(90);
    await nextTick();
    expect(isOpen()).to.eq(false);
    expect(w.attributes('aria-expanded')).to.eq('false');

    await w.trigger('click');
    expect(isOpen(), 'a click opens (the touch fallback)').to.eq(true);
    await w.trigger('click');
    expect(isOpen(), 'and closes').to.eq(false);

    await w.trigger('click');
    await w.trigger('keydown', {key: 'Escape'});
    expect(isOpen()).to.eq(false);
  });
});
