/*
 * ConsoleWildChoiceStep — the ONE inner step of «a standard resource OR a resource on a card». A `<script setup>`
 * component (step A of docs/claude/vapor/RECIPES.md): no emits, nothing exposed — it draws a SPECIFICATION
 * (`WildChoiceSpec`) and a draft (`WildParts`) under a cursor (`WildFocus`), so the spec is what it renders for them in
 * its two hosts' shapes (the Venus dial, the exclusive radio), that it FOLLOWS them, and that the slot it measures is
 * what it hands the host's own target step. The shared variant grammar is rendered for real (the plates' bodies are
 * this component's slot); the card face and the glyph are stubbed by name.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {$t, translateText, translateTextWithParams} from '@/client/directives/i18n';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {WILD_LANES, WildChoiceSpec, WildFocus, WildParts} from '@/client/console/wildChoice/wildChoiceInner';
import ConsoleWildChoiceStep from '@/client/components/console/foundation/ConsoleWildChoiceStep.vue';

// (Render functions, not template strings: the runtime compiler is not in this build.)
const FaceStub = defineComponent({
  name: 'ConsoleCardFaceLite',
  props: {name: {type: String, default: ''}, card: {type: Object, default: undefined}, lightweight: Boolean},
  render: () => h('i', {class: 'face-stub'}),
});
const GlyphStub = defineComponent({
  name: 'GamepadGlyph',
  props: {control: {type: String, default: ''}},
  render: () => h('i', {class: 'glyph-stub'}),
});

type StepProps = {
  spec: WildChoiceSpec,
  parts: WildParts,
  focus: WildFocus,
  head: {title: string, reading: string},
  orTitle?: string,
  candidates?: ReadonlyArray<CardModel>,
  vpBox?: Partial<Record<string, {from: number, to: number}>>,
  resourceByCard?: Partial<Record<string, string>>,
  stock?: Partial<Record<string, number>>,
  venus?: boolean,
};

const HOLDERS: ReadonlyArray<CardName> = [CardName.DIRIGIBLES, CardName.AERIAL_MAPPERS];
const FLOATERS = {[CardName.DIRIGIBLES]: 'floater', [CardName.AERIAL_MAPPERS]: 'floater'};

function holder(name: CardName, resources: number): CardModel {
  return {name, resources} as unknown as CardModel;
}

/** The Venus host's shape: a base always laid out on the dial grid, the OR above it. */
function venusSpec(extra: Partial<WildChoiceSpec> = {}): WildChoiceSpec {
  return {or: {}, holders: HOLDERS, amount: (wild) => (wild === 'asStandard' ? 3 : 2), exclusive: false, lanes: 'dial', ...extra};
}

function step(props: StepProps, slots: Record<string, (given: {width: number, height: number}) => unknown> = {}) {
  return mount(ConsoleWildChoiceStep, {
    props,
    slots,
    global: {...globalConfig.global, stubs: {ConsoleCardFaceLite: FaceStub, GamepadGlyph: GlyphStub}},
  });
}

/** A «current → resulting» line with the template's whitespace taken out. */
function reading(text: string): string {
  return text.replace(/\s+/g, '');
}

describe('ConsoleWildChoiceStep — one inner step for «a standard resource OR a resource on a card»', () => {
  it('the Venus host: the OR with its answer, the candidates with «current → resulting», the dial grid and what is left', () => {
    const w = step({
      spec: venusSpec(),
      parts: {wild: {wild: 'onCard', card: CardName.AERIAL_MAPPERS}, spread: {megacredits: 1}},
      focus: {zone: 'lane', index: 0},
      head: {title: 'Venus bonus', reading: '16 % → 30 %'},
      orTitle: 'Final step · 30 %',
      candidates: [holder(CardName.DIRIGIBLES, 2), holder(CardName.AERIAL_MAPPERS, 0)],
      vpBox: {[CardName.DIRIGIBLES]: {from: 0, to: 0}, [CardName.AERIAL_MAPPERS]: {from: 1, to: 2}},
      resourceByCard: FLOATERS,
      stock: {megacredits: 40},
      venus: true,
    });

    // The root: the shared hooks, and the Venus host's historical ones beside them.
    expect(w.classes()).to.deep.eq(['con-wildstep']);
    expect(w.attributes('data-wild-inner')).to.eq('');
    expect(w.attributes('data-wild-focus-zone')).to.eq('lane');
    expect(w.attributes('data-wild-focus-index')).to.eq('0');
    expect(w.attributes('data-wild-choice')).to.eq('onCard');
    expect(w.attributes('data-wild-complete'), 'one unit is still to lay out').to.eq(undefined);
    expect(w.attributes('data-venus-inner')).to.eq('');
    expect(w.attributes('data-venus-focus-zone')).to.eq('lane');
    expect(w.attributes('data-venus-focus-index')).to.eq('0');
    expect(w.find('.con-wildstep__title').text()).to.eq($t('Venus bonus'));
    expect(w.find('[data-wild-step]').text()).to.eq('16 % → 30 %');

    // The OR: two plates of the shared grammar, the answer marked, each with ITS glyph in the body this step hands in.
    const plates = w.findAll('[data-wild-option]');
    expect(plates.map((p) => p.attributes('data-wild-option'))).to.deep.eq(['onCard', 'asStandard']);
    expect(plates.map((p) => p.attributes('data-chosen'))).to.deep.eq(['', undefined]);
    expect(plates.map((p) => p.attributes('data-venus-wild-option'))).to.deep.eq(['onCard', 'asStandard']);
    expect(plates.map((p) => p.attributes('aria-checked'))).to.deep.eq(['true', 'false']);
    expect(plates[0].find('[data-wild-glyph]').classes()).to.include.members(iconClassFor('wild').split(' ').filter((name) => name !== ''));
    expect(plates[1].findAll('.con-wildstep__mosaic-tile'), 'the six a standard resource may become').to.have.length(WILD_LANES.length);
    expect(w.find('[data-wild-or] .con-wildstep__zone-title').text()).to.eq($t('Final step · 30 %'));

    // The candidates: the chosen one marked, each «current → resulting», the VP line only where the +1 moves it.
    const cards = w.findAll('[data-wild-card]');
    expect(cards.map((c) => c.attributes('data-wild-card'))).to.deep.eq([...HOLDERS]);
    expect(cards.map((c) => c.attributes('data-chosen'))).to.deep.eq([undefined, '']);
    expect(cards.map((c) => c.attributes('data-venus-card'))).to.deep.eq([...HOLDERS]);
    expect(cards.map((c) => reading(c.find('.con-wildstep__card-count').text()))).to.deep.eq(['2→3', '0→1']);
    expect(cards.map((c) => c.find('[data-wild-card-vp]').exists())).to.deep.eq([false, true]);
    expect(reading(cards[1].find('[data-wild-card-vp]').text())).to.eq(reading(`${$t('VP')} 1 → 2`));
    expect(w.findAllComponents(FaceStub).map((f) => f.props('name')), 'a face per candidate, handed its live model').to.deep.eq([...HOLDERS]);
    expect(w.findAllComponents(FaceStub)[0].props('card')).to.deep.eq({name: CardName.DIRIGIBLES, resources: 2});

    // The standard resources: the fixed grid in the lanes' order, a dial — the bumpers and the pour on its head.
    const spread = w.find('[data-wild-spread]');
    expect(spread.attributes('data-wild-spread-amount')).to.eq('2');
    expect(spread.attributes('data-wild-spread-left')).to.eq('1');
    expect(spread.attributes('data-venus-spread-left')).to.eq('1');
    const lanes = spread.findAll('.con-wildstep__lane');
    expect(lanes.map((l) => l.attributes('data-lane-resource'))).to.deep.eq([...WILD_LANES]);
    expect(lanes.map((l) => l.attributes('data-lane-amount'))).to.deep.eq(['1', '0', '0', '0', '0', '0']);
    expect(lanes[0].classes()).to.include.members(['con-wildstep__lane--focused', 'con-wildstep__lane--filled']);
    expect(lanes[1].classes()).to.not.include('con-wildstep__lane--focused');
    expect(reading(lanes[0].find('.con-wildstep__lane-count').text())).to.eq('40→41');
    expect(lanes[0].find('.con-wildstep__lane-name').text()).to.eq($t('M€'));
    expect(w.findAllComponents(GlyphStub).map((g) => g.props('control')), 'the only glyphs of this shape are the dial\'s own').to.deep.eq(['bumperL', 'bumperR', 'triggerR']);
    expect(spread.findAll('[data-wild-dial-hint] .glyph-stub')).to.have.length(3);
    expect(spread.findAll('.con-wildstep__pill--off'), 'a unit to take back and a unit to lay — no pill is at its limit').to.have.length(0);
    expect(reading(w.find('[data-lanes-status]').text())).to.eq(reading(`${$t('Left')}: 1`));
  });

  it('the exclusive host (a spend): the grid is the slot\'s own face — a radio; a refused plate and a refused lane stay, with their reasons', async () => {
    const spec: WildChoiceSpec = {
      or: {onCardOff: 'No card can hold it'},
      holders: [],
      amount: () => 1,
      exclusive: true,
      lanes: 'radio',
      mode: 'spend',
      laneOff: (lane) => (lane === 'plants' ? 'Not enough plants' : undefined),
    };
    const w = step({
      spec,
      parts: {wild: {wild: 'asStandard'}, spread: {steel: 1}},
      focus: {zone: 'lane', index: 1},
      head: {title: 'Spend a resource', reading: ''},
      stock: {steel: 4},
    });

    expect(w.classes()).to.deep.eq(['con-wildstep', 'con-wildstep--exclusive']);
    expect(w.attributes('data-wild-complete'), 'the OR answered and the one unit laid').to.eq('');
    expect(w.attributes('data-venus-inner'), 'not the Venus host — none of its hooks').to.eq(undefined);
    expect(w.find('[data-wild-step]').exists(), 'an empty reading draws nothing').to.eq(false);
    expect(w.find('[data-wild-spread]').exists(), 'no dial grid under the slot').to.eq(false);

    const refused = w.find('[data-wild-option="onCard"]');
    expect(refused.attributes('aria-disabled')).to.eq('true');
    expect(refused.text()).to.contain(translateText('No card can hold it'));

    const face = w.find('[data-wild-face="lanes"]');
    expect(face.attributes('aria-hidden'), 'the chosen face is the one on stage').to.eq(undefined);
    const lanes = face.findAll('[role="radio"]');
    expect(lanes.map((l) => l.attributes('data-lane-resource'))).to.deep.eq([...WILD_LANES]);
    expect(lanes.map((l) => l.attributes('data-lane-mode'))).to.deep.eq(WILD_LANES.map(() => 'spend'));
    expect(lanes.map((l) => l.attributes('aria-checked'))).to.deep.eq(['false', 'true', 'false', 'false', 'false', 'false']);
    expect(lanes[1].classes()).to.include.members(['con-wildstep__lane--focused', 'con-wildstep__lane--filled']);
    expect(reading(lanes[1].find('.con-wildstep__lane-count').text()), 'a spend reads what LEAVES').to.eq('4→3');
    expect(lanes[1].find('.con-wildstep__lane-amount').text(), 'a true minus').to.eq('−1');
    const plants = lanes[WILD_LANES.indexOf('plants')];
    expect(plants.attributes('data-lane-off')).to.eq('');
    expect(plants.attributes('aria-disabled')).to.eq('true');
    expect(plants.find('[data-lane-reason]').text()).to.eq($t('Not enough plants'));
    expect(plants.find('.con-wildstep__lane-count').exists(), 'a refused lane promises no result').to.eq(false);

    // It FOLLOWS its draft: with the OR unanswered the grid steps back and the slot asks.
    await w.setProps({parts: {}});
    expect(w.attributes('data-wild-choice')).to.eq(undefined);
    expect(w.attributes('data-wild-complete')).to.eq(undefined);
    expect(w.find('[data-wild-face="lanes"]').attributes('aria-hidden')).to.eq('true');
    expect(w.find('.con-wildstep__note--ask').text()).to.eq($t('Choose: on a card or a standard resource'));
  });

  it('«on a card» behind ONE door (a nested pick): the ask with its count, then the chosen card — and it follows the cursor', async () => {
    const w = step({
      spec: venusSpec({nestedPick: true}),
      parts: {wild: {wild: 'onCard'}},
      focus: {zone: 'card', index: 0},
      head: {title: 'Venus bonus', reading: ''},
      candidates: [holder(CardName.DIRIGIBLES, 2), holder(CardName.AERIAL_MAPPERS, 0)],
      resourceByCard: FLOATERS,
    });
    const door = () => w.find('[data-wild-door] .con-wildstep__card--door');
    expect(w.findAll('[data-wild-door] .con-wildstep__card'), 'one row — never a strip of every holder').to.have.length(1);
    expect(door().classes()).to.include('con-wildstep__card--focused');
    expect(door().classes()).to.not.include('con-wildstep__card--chosen');
    expect(door().attributes('data-wild-card')).to.eq(undefined);
    expect(door().find('.con-wildstep__card-name').text()).to.eq($t('Choose a card for the wild resource'));
    expect(w.find('[data-wild-door-count]').text()).to.eq(translateTextWithParams('Cards to choose from: ${0}', ['2']));
    expect(w.findAll('.con-wildstep__door-face')).to.have.length(2);
    expect(w.find('.con-wildstep__door-verb').text()).to.eq($t('Choose'));
    expect(w.find('.con-wildstep__door-verb .glyph-stub').exists()).to.eq(true);
    expect(w.findAllComponents(GlyphStub).map((g) => g.props('control')), 'the door\'s verb, then the dial\'s pills').to.deep.eq(['confirm', 'bumperL', 'bumperR', 'triggerR']);

    await w.setProps({parts: {wild: {wild: 'onCard', card: CardName.DIRIGIBLES}}, focus: {zone: 'lane', index: 2}});
    expect(door().attributes('data-wild-card')).to.eq(CardName.DIRIGIBLES);
    expect(door().attributes('data-chosen')).to.eq('');
    expect(door().classes()).to.include('con-wildstep__card--chosen');
    expect(door().classes(), 'the cursor walked on to the grid').to.not.include('con-wildstep__card--focused');
    expect(door().find('.con-wildstep__card-name').text()).to.eq($t(CardName.DIRIGIBLES));
    expect(reading(door().find('.con-wildstep__card-count').text())).to.eq('2→3');
    expect(w.find('.con-wildstep__door-verb').text()).to.eq($t('Change the card'));
    expect(w.attributes('data-wild-focus-zone')).to.eq('lane');
    expect(w.findAll('[data-wild-spread] .con-wildstep__lane--focused').map((l) => l.attributes('data-lane-resource'))).to.deep.eq([WILD_LANES[2]]);
  });

  it('hands the host\'s target step the slot it MEASURED, follows a resize, and lets its observer go when it leaves', async () => {
    class FakeObserver {
      static made: Array<FakeObserver> = [];
      readonly targets: Array<Element> = [];
      disconnected = false;
      private readonly changed: () => void;
      constructor(changed: () => void) {
        this.changed = changed;
        FakeObserver.made.push(this);
      }
      observe(el: Element): void {
        this.targets.push(el);
      }
      disconnect(): void {
        this.disconnected = true;
      }
      fire(): void {
        this.changed();
      }
    }
    // JSDOM has no ResizeObserver (and lays nothing out): the spec lends one for this test and gives it back.
    const host = globalThis as unknown as {ResizeObserver?: unknown};
    const had = host.ResizeObserver;
    host.ResizeObserver = FakeObserver;
    try {
      const w = step({
        spec: venusSpec(),
        parts: {wild: {wild: 'onCard'}},
        focus: {zone: 'card', index: 0},
        head: {title: 'Venus bonus', reading: ''},
      }, {
        cards: (given: {width: number, height: number}) => h('i', {'class': 'host-cards', 'data-w': String(given.width), 'data-h': String(given.height)}),
      });
      const hostFace = w.find('[data-wild-face="cards"]');
      expect(hostFace.classes(), 'the host\'s step stands in the slot — no miniatures of this step\'s own').to.include('con-wildstep__face--host');
      expect(w.find('[data-wild-card]').exists()).to.eq(false);
      expect(w.find('.host-cards').attributes('data-w')).to.eq('0');

      // The observer stands on the slot this step mounted (no workspace band round it here).
      const slot = w.find('.con-wildstep__slot').element as Element;
      expect(FakeObserver.made).to.have.length(1);
      const observer = FakeObserver.made[0];
      expect(observer.targets).to.deep.eq([slot]);

      Object.defineProperty(slot, 'clientWidth', {value: 620.7, configurable: true});
      observer.fire();
      await nextTick();
      expect(w.find('.host-cards').attributes('data-w'), 'whole pixels of the slot\'s own width').to.eq('620');
      expect(w.find('.host-cards').attributes('data-h'), 'not exclusive — the slot keeps its natural height').to.eq('0');

      w.unmount();
      expect(observer.disconnected).to.eq(true);
    } finally {
      if (had === undefined) {
        delete host.ResizeObserver;
      } else {
        host.ResizeObserver = had;
      }
    }
  });
});
