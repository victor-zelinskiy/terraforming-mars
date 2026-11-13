/*
 * ConsoleArmedFlightLayer — the one-play class's flight layer (TR49): one chip and one contact beat per token of the
 * module's `armedFlightState`, each chip the armed effect's own badge. A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md): it takes no props, emits and exposes nothing — the shared transfer director reaches
 * its pieces through the stage the layer registers while it is mounted.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {nextTick} from 'vue';
import {gsap} from 'gsap';
import {globalConfig} from '../getLocalVue';
import {$t} from '@/client/directives/i18n';
import {CardName} from '@/common/cards/CardName';
import {ArmedEffectView} from '@/client/console/armedEffects';
import {ArmedFlightToken, armedFlightState, releaseArmedEffectHolds} from '@/client/console/armedEffectFlight';
import ConsoleArmedFlightLayer from '@/client/components/console/ConsoleArmedFlightLayer.vue';

function view(kind: ArmedEffectView['kind'], badge: string, source: CardName): ArmedEffectView {
  return {key: `${source}:${kind}:0`, source, sourceKey: source, sourceName: source, prelude: false, kind, formula: '', badge, expiry: ''};
}

function token(id: number, direction: ArmedFlightToken['direction'], effect: ArmedEffectView): ArmedFlightToken {
  return {id, view: effect, direction};
}

function layer(attached = false) {
  return mount(ConsoleArmedFlightLayer as any, {...globalConfig, ...(attached ? {attachTo: document.body} : {})});
}

describe('ConsoleArmedFlightLayer — the flight layer of an armed effect', () => {
  // The layer draws module state — none of it may leak into the next spec.
  const reset = () => {
    armedFlightState.tokens.splice(0);
    armedFlightState.trail.splice(0);
  };
  beforeEach(reset);
  afterEach(reset);

  it('nothing flies: the layer is idle and empty, and its trail reads the module\'s', () => {
    armedFlightState.trail.push('arm:landed', 'spend:no-source');
    const w = layer();
    // The template STARTS WITH ITS ROOT.
    expect((w.element as Element).tagName).to.eq('DIV');
    expect(w.classes()).to.include.members(['con-armfly', 'con-armfly--idle']);
    expect(w.attributes('aria-hidden')).to.eq('true');
    expect(w.attributes('data-armed-flight')).to.not.eq(undefined);
    expect(w.attributes('data-armed-flight-trail')).to.eq('arm:landed spend:no-source');
    expect((w.element as Element).children.length).to.eq(0);
  });

  it('one chip and one beat per token — the chip wears the token\'s hooks and the armed effect\'s own badge', () => {
    armedFlightState.tokens.push(
      token(7, 'arm', view('requirementWaiver', 'ignored', CardName.SPECIAL_DESIGN)),
      token(8, 'spend', view('discount', '−8', CardName.INDENTURED_WORKERS)),
      token(9, 'arm', view('partyWaiver', '', CardName.POLITICAL_THINK_TANK)),
    );
    const w = layer();
    expect(w.classes()).to.not.include('con-armfly--idle');
    const chips = w.findAll('.con-armfly__chip');
    expect(chips.map((c) => c.attributes('data-armfly-id'))).to.deep.eq(['7', '8', '9']);
    expect(chips.map((c) => c.attributes('data-armfly-direction'))).to.deep.eq(['arm', 'spend', 'arm']);
    expect(chips.map((c) => c.attributes('data-armfly-source')))
      .to.deep.eq([CardName.SPECIAL_DESIGN, CardName.INDENTURED_WORKERS, CardName.POLITICAL_THINK_TANK]);
    expect(w.findAll('.con-armfly__beat').length, 'a contact beat beside every chip').to.eq(3);
    expect(chips.every((c) => c.find('.con-armfly__spark').exists()), 'every token is the dock chip it becomes').to.eq(true);
    // The three faces of a token: the waiver's struck plate, a plain badge, the party requirement's glyph.
    expect(chips[0].find('.con-armed__struck').text()).to.eq($t('Reqs'));
    expect(chips[0].find('.con-armed__badge').exists()).to.eq(false);
    expect(chips[1].find('.con-armed__badge').text()).to.eq('−8');
    expect(chips[2].find('.pprq').classes()).to.include.members(['pprq--waived', 'con-armed__pprq', 'con-armed__pprq--chip']);
    expect(chips[2].find('.con-armed__badge').exists()).to.eq(false);
  });

  it('follows the module\'s state: a token launched later appears, a token taken down leaves', async () => {
    const w = layer();
    expect(w.find('.con-armfly__chip').exists()).to.eq(false);
    armedFlightState.tokens.push(token(1, 'arm', view('requirementShift', '±2', CardName.SPECIAL_DESIGN)));
    await nextTick();
    expect(w.classes()).to.not.include('con-armfly--idle');
    expect(w.findAll('.con-armfly__chip').map((c) => c.attributes('data-armfly-id'))).to.deep.eq(['1']);
    expect(w.find('.con-armed__badge').text()).to.eq('±2');
    armedFlightState.tokens.splice(0);
    await nextTick();
    expect(w.classes()).to.include('con-armfly--idle');
    expect(w.find('.con-armfly__chip').exists()).to.eq(false);
  });

  it('the stage it registers hands the director the MOUNTED chip of a token — an abort takes that chip\'s flight down', () => {
    armedFlightState.tokens.push(token(4, 'spend', view('discount', '−8', CardName.INDENTURED_WORKERS)));
    const w = layer(true);
    const chip = w.find('[data-armfly-id="4"]').element as HTMLElement;
    // A flight in the air on the chip (paused: nothing ticks in the spec).
    gsap.to(chip, {x: 10, duration: 5, paused: true});
    expect(gsap.getTweensOf(chip).length).to.eq(1);
    releaseArmedEffectHolds();
    expect(gsap.getTweensOf(chip).length, 'the abort reached the chip through the layer\'s stage').to.eq(0);
    expect(armedFlightState.tokens.length).to.eq(0);
  });
});
