/*
 * ConsoleDeckMeter — the creator's DECK METER (T04 «the deck is visible before launch»): what the party's decks will
 * hold, read off the server's own count (`deckCompositionState`) through the pure `deckMeterView`. A `<script setup>`
 * component (step A of docs/claude/vapor/RECIPES.md): one prop (`variant` — the expansions deck's head or the
 * briefing), no emit; every number on it is the module state's. It exposes nothing.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {$t, translateTextWithParams} from '@/client/directives/i18n';
import {DeckCompositionModel} from '@/common/models/DeckCompositionModel';
import {deckCompositionState, resetDeckCompositionState} from '@/client/console/menu/deckCompositionState';
import ConsoleDeckMeter from '@/client/components/console/menu/ConsoleDeckMeter.vue';

// The flip is the readout's own subject; this spec reads the NUMBER the meter hands it.
// (A render function, not a template string: the runtime compiler is not in this build.)
const FlipStub = defineComponent({
  name: 'ConsoleFlipValue',
  props: {value: Number, accent: String, flipOnDecrease: Boolean},
  render: () => h('i', {class: 'flip-stub'}),
});

// Shares that are exact binary fractions (1/2 · 1/4 · 1/4) — the bar's offsets are then exact too.
const composition: DeckCompositionModel = {
  projects: {total: 200, byModule: {}, byType: {automated: 100, active: 50, event: 50}},
  corporations: {total: 12, byModule: {}},
  preludes: {total: 35, byModule: {}},
  extras: {colonies: {pool: 11, inPlay: 5, byExpansion: {}}, resolutions: 42},
  contributions: {},
};

function meter(props: {variant?: 'deck' | 'brief'} = {}) {
  return mount(ConsoleDeckMeter, {
    ...globalConfig,
    props,
    global: {...globalConfig.global, stubs: {ConsoleFlipValue: FlipStub}},
  });
}

describe('ConsoleDeckMeter — the party\'s decks as the server counts them', () => {
  afterEach(() => {
    resetDeckCompositionState();
  });

  it('before the first answer the frame stands and prints no number — and nothing is «pending» with nothing to dim', () => {
    deckCompositionState.status = 'loading';
    const w = meter();
    expect(w.classes()).to.include.members(['cm-meter', 'cm-meter--deck']);
    expect(w.classes()).to.not.include('cm-meter--ready');
    expect(w.classes()).to.not.include('cm-meter--pending');
    expect(w.attributes('data-deck-meter')).to.not.eq(undefined);
    expect(w.attributes('data-deck-meter-status')).to.eq('loading');
    expect(w.attributes('aria-label')).to.eq($t('Decks'));
    expect(w.find('.cm-meter__title').text()).to.eq($t('Decks'));
    expect(w.findAll('[data-deck-tile]')).to.have.length(0);
    expect(w.findAll('[data-deck-segment]')).to.have.length(0);
    expect(w.find('.cm-meter__extras').exists()).to.eq(false);
    expect(w.find('[data-deck-meter-error]').exists()).to.eq(false);
  });

  it('the DECK variant: the three totals, the project deck by colour in its fixed order, what else the party deals', () => {
    deckCompositionState.composition = composition;
    deckCompositionState.status = 'ok';
    const w = meter({variant: 'deck'});
    expect(w.classes()).to.include.members(['cm-meter--deck', 'cm-meter--ready']);
    expect(w.attributes('data-deck-meter-status')).to.eq('ok');

    const tiles = w.findAll('[data-deck-tile]');
    expect(tiles.map((t) => t.attributes('data-deck-tile'))).to.deep.eq(['projects', 'corporations', 'preludes']);
    expect(tiles.map((t) => t.attributes('data-deck-total'))).to.deep.eq(['200', '12', '35']);
    expect(tiles.map((t) => t.classes().find((c) => c.startsWith('cm-meter__tile--')))).to.deep.eq(
      ['cm-meter__tile--projects', 'cm-meter__tile--corporations', 'cm-meter__tile--preludes']);
    expect(tiles.map((t) => t.find('.cm-meter__label').text())).to.deep.eq([$t('Projects'), $t('Corporations'), $t('Preludes')]);
    const flips = w.findAllComponents(FlipStub);
    expect(flips.map((f) => f.props('value'))).to.deep.eq([200, 12, 35]);
    expect(flips.every((f) => f.props('accent') === 'gold' && f.props('flipOnDecrease') === true), 'gold, and a shrinking deck flips too').to.eq(true);

    const keys = w.findAll('[data-deck-segment]');
    expect(keys.map((k) => k.attributes('data-deck-segment'))).to.deep.eq(['automated', 'active', 'event']);
    expect(keys.map((k) => k.find('.cm-meter__key-label').text())).to.deep.eq([
      translateTextWithParams('${0} automated', ['100']),
      translateTextWithParams('${0} active', ['50']),
      translateTextWithParams('${0} events', ['50']),
    ]);
    // Each segment starts where the shares before it end; a gap line stands on each inner seam.
    const transform = (selector: string) => w.findAll(selector).map((s) => (s.element as HTMLElement).style.transform);
    expect(transform('.cm-meter__segment')).to.deep.eq(['translateX(0%) scaleX(0.5)', 'translateX(50%) scaleX(0.25)', 'translateX(75%) scaleX(0.25)']);
    expect(transform('.cm-meter__gap')).to.deep.eq(['translateX(50%)', 'translateX(75%)']);

    expect(w.find('.cm-meter__extras-label').text()).to.eq($t('Also in the party'));
    const extras = w.findAll('[data-deck-extra]');
    expect(extras.map((e) => e.attributes('data-deck-extra'))).to.deep.eq(['colonies', 'resolutions']);
    expect(extras.map((e) => e.text())).to.deep.eq([
      translateTextWithParams('${0} colony tiles', ['11']),
      translateTextWithParams('${0} resolutions', ['42']),
    ]);
  });

  it('the BRIEF variant prints the totals and the extras — no colour bar; an ask in flight dims the previous numbers, a failed one says so and keeps them', async () => {
    deckCompositionState.composition = {...composition, extras: {}};
    deckCompositionState.status = 'loading';
    const w = meter({variant: 'brief'});
    expect(w.classes()).to.include.members(['cm-meter--brief', 'cm-meter--ready', 'cm-meter--pending']);
    expect(w.findAll('[data-deck-tile]')).to.have.length(3);
    expect(w.find('.cm-meter__bar').exists()).to.eq(false);
    expect(w.find('.cm-meter__legend').exists()).to.eq(false);
    expect(w.find('.cm-meter__extras').exists(), 'no expansion brings an extra — no row').to.eq(false);
    expect(w.find('[data-deck-meter-error]').exists()).to.eq(false);

    deckCompositionState.status = 'error';
    await nextTick();
    expect(w.classes()).to.not.include('cm-meter--pending');
    expect(w.attributes('data-deck-meter-status')).to.eq('error');
    expect(w.find('[data-deck-meter-error]').text()).to.eq($t('The deck counts could not be refreshed'));
    expect(w.findAll('[data-deck-tile]').map((t) => t.attributes('data-deck-total')), 'the previous numbers stay').to.deep.eq(['200', '12', '35']);
  });
});
