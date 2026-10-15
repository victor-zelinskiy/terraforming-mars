import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {CardModel} from '@/common/models/CardModel';
import {GlobalParameter} from '@/common/GlobalParameter';
import {RequirementType} from '@/common/cards/RequirementType';
import {RequirementEasingModel} from '@/common/models/ArmedPlayEffectModel';
import {UnplayableReason} from '@/common/cards/UnplayableReason';
import {armedEffectsOf} from '@/client/console/armedEffects';
import {handEasingPlate} from '@/client/console/handEasingPlate';
import {buildCardAvailability, buildZoomAvailability} from '@/client/console/cardAvailability';
import {easingCompact, easingLine, easingSourcesText} from '@/client/console/requirementEasingText';
import ConsoleArmedEffectsStrip from '@/client/components/console/ConsoleArmedEffectsStrip.vue';
import PremiumRequirementsBar from '@/client/components/premiumCard/PremiumRequirementsBar.vue';
import {normalizeRequirement} from '@/client/components/premiumCard/premiumCardViewModel';
import PremiumModifierMarks from '@/client/components/premiumCard/PremiumModifierMarks.vue';
import {easingIsQuiet, modifierSourcesOf, modifierSymbolOf} from '@/client/components/premiumCard/premiumModifierSources';
import {PartyName} from '@/common/turmoil/PartyName';
import {globalConfig} from '../components/getLocalVue';

/**
 * THE ONE-PLAY CLASS on the client (TR49): the «ВЗВЕДЕНО» reading, the hand
 * plate, the availability's EASED voice, the cassette's three states — every
 * word and number off the server's models, nothing derived.
 */
const SD = CardName.SPECIAL_DESIGN;
const CED = CardName.CUTTING_EDGE_DESIGN;

const shifted: RequirementEasingModel = {
  key: 'req:C', index: 0, type: RequirementType.TEMPERATURE, parameter: GlobalParameter.TEMPERATURE, max: false,
  printed: 0, effective: -4, current: -18, met: false, decisive: false,
  sources: [{source: {kind: 'card', card: SD}, kind: 'shift', steps: 2, oneShot: true}],
};
const waived: RequirementEasingModel = {
  key: 'req:C', index: 0, type: RequirementType.TEMPERATURE, parameter: GlobalParameter.TEMPERATURE, max: false,
  printed: 0, effective: 'waived', current: -30, met: true, decisive: true,
  sources: [{source: {kind: 'card', card: CED}, kind: 'waive', oneShot: true}],
};
const decisiveShift: RequirementEasingModel = {...shifted, printed: 2, effective: -2, current: -2, met: true, decisive: true};
/** SEVERAL modifiers at once — Inventrix + Adaptation Technology + an armed Special Design: ±6, Grass at −20 °C. */
const several: RequirementEasingModel = {
  key: 'req:C', index: 0, type: RequirementType.TEMPERATURE, parameter: GlobalParameter.TEMPERATURE, max: false,
  printed: -16, effective: -28, current: -20, met: true, decisive: true,
  sources: [
    {source: {kind: 'corporation', card: CardName.INVENTRIX}, kind: 'shift', steps: 2, oneShot: false},
    {source: {kind: 'card', card: CardName.ADAPTATION_TECHNOLOGY}, kind: 'shift', steps: 2, oneShot: false},
    {source: {kind: 'card', card: SD}, kind: 'shift', steps: 2, oneShot: true},
  ],
};
/** Met ANYWAY under a shift — Archaebacteria (≤ −18) at −20 °C with ±2. */
const quiet: RequirementEasingModel = {
  key: 'req:C', index: 0, type: RequirementType.TEMPERATURE, parameter: GlobalParameter.TEMPERATURE, max: true,
  printed: -18, effective: -14, current: -20, met: true, decisive: false,
  sources: [{source: {kind: 'corporation', card: CardName.INVENTRIX}, kind: 'shift', steps: 2, oneShot: false}],
};

describe('the ONE-PLAY class on the client (TR49)', () => {
  describe('armedEffectsOf — the «ВЗВЕДЕНО» reading', () => {
    it('nothing armed → nothing to show', () => {
      expect(armedEffectsOf({armedPlayEffects: undefined})).deep.eq([]);
      expect(armedEffectsOf(undefined)).deep.eq([]);
    });

    it('a waiver, a shift, a discount — badge and formula from the one formatter', () => {
      const views = armedEffectsOf({armedPlayEffects: [
        {source: CED, sourceType: CardType.EVENT, effect: {kind: 'requirementWaiver'}, expires: 'next-play'},
        {source: SD, sourceType: CardType.EVENT, effect: {kind: 'requirementShift', steps: 2}, expires: 'next-play'},
        {source: CardName.INDENTURED_WORKERS, sourceType: CardType.EVENT, effect: {kind: 'discount', amount: 8}, expires: 'next-play'},
      ]});
      expect(views.map((v) => [v.kind, v.badge, v.formula])).deep.eq([
        ['requirementWaiver', 'Ignored', 'Global requirements ignored'],
        ['requirementShift', '±2', 'Global requirements ±2'],
        ['discount', '−8', 'Next card −8 M€'],
      ]);
      expect(views[0].expiry).eq('Until your next card play');
    });

    it('a prelude source is marked (it hosts its own next play)', () => {
      const [view] = armedEffectsOf({armedPlayEffects: [{source: CardName.ECOLOGY_EXPERTS, sourceType: CardType.PRELUDE, effect: {kind: 'requirementWaiver'}, expires: 'next-play'}]});
      expect(view.prelude).is.true;
    });
  });

  describe('the strip renders only what is armed — never a reserved hole', () => {
    it('empty: no element at all', () => {
      const wrapper = mount(ConsoleArmedEffectsStrip, {...globalConfig, props: {effects: []}});
      expect(wrapper.find('[data-armed-strip]').exists()).is.false;
    });

    it('armed: the source, the kind, the expiry — strip and chip densities', () => {
      const effects = armedEffectsOf({armedPlayEffects: [{source: CED, sourceType: CardType.EVENT, effect: {kind: 'requirementWaiver'}, expires: 'next-play'}]});
      const strip = mount(ConsoleArmedEffectsStrip, {...globalConfig, props: {effects, variant: 'strip'}});
      expect(strip.find('[data-armed-strip]').attributes('data-armed-source')).eq(CED);
      expect(strip.find('[data-armed-kind="requirementWaiver"]').exists()).is.true;
      expect(strip.find('.con-armed__struck').exists(), 'the waiver is the struck plate').is.true;
      expect(strip.text()).contains('Until your next card play');
      const chip = mount(ConsoleArmedEffectsStrip, {...globalConfig, props: {effects, variant: 'chip'}});
      expect(chip.find('.con-armed--chip').exists()).is.true;
      expect(chip.find('.con-armed__kicker').exists(), 'the chip carries no kicker').is.false;
    });
  });

  describe('the hand plate — the third reader', () => {
    it('no reading → no plate', () => {
      expect(handEasingPlate({name: CardName.LAKE_MARINERIS} as CardModel)).is.undefined;
    });
    it('a shift reads «±2», a waiver is struck, decisive and one-shot are the card\'s', () => {
      expect(handEasingPlate({name: CardName.LAKE_MARINERIS, requirementEasing: [shifted]} as CardModel)).deep.eq({
        items: [{iconClass: 'wgt-icon wgt-icon--temperature', kind: 'shift', steps: 2,
          sources: [{key: 'card:' + SD, symbol: 'once', card: SD, kind: 'shift', steps: 2, oneShot: true}]}], decisive: false, oneShot: true,
      });
      expect(handEasingPlate({name: CardName.LAKE_MARINERIS, requirementEasing: [waived]} as CardModel)?.items[0].kind).eq('waive');
      expect(handEasingPlate({name: CardName.LAKE_MARINERIS, requirementEasing: [waived]} as CardModel)?.decisive).is.true;
    });
    it('several sources: ONE item with the TOTAL and every mark, in the server\'s order', () => {
      const plate = handEasingPlate({name: CardName.GRASS, requirementEasing: [several]} as CardModel)!;
      expect(plate.items.map((i) => [i.steps, i.sources.map((s) => s.card)])).deep.eq([[6, [CardName.INVENTRIX, CardName.ADAPTATION_TECHNOLOGY, SD]]]);
      expect(plate.decisive).is.true;
    });
    it('met ANYWAY says nothing on the tile — a standing ±2 never marks the whole hand', () => {
      expect(handEasingPlate({name: CardName.ARCHAEBACTERIA, requirementEasing: [quiet]} as CardModel)).is.undefined;
    });
  });

  describe('what bends it — the source model and its marks (a symbol of the KIND, never the art)', () => {
    it('quiet = met anyway under a SHIFT; a waiver, a decisive or a still-short bend is never quiet', () => {
      expect(easingIsQuiet(quiet)).is.true;
      expect(easingIsQuiet(several)).is.false;
      expect(easingIsQuiet(shifted)).is.false;
      expect(easingIsQuiet(waived)).is.false;
    });
    it('one source per share, the SYMBOL of its kind: a card / corporation on the table, a one-play bolt, a policy, a rule', () => {
      expect(modifierSourcesOf(several).map((s) => [s.key, s.symbol, s.card, s.steps, s.oneShot])).deep.eq([
        ['card:' + CardName.INVENTRIX, 'card', CardName.INVENTRIX, 2, false],
        ['card:' + CardName.ADAPTATION_TECHNOLOGY, 'card', CardName.ADAPTATION_TECHNOLOGY, 2, false],
        ['card:' + SD, 'once', SD, 2, true],
      ]);
      const policy = modifierSourcesOf({sources: [{source: {kind: 'party', name: PartyName.SCIENTISTS}, kind: 'shift', steps: 2, oneShot: false}]});
      expect([policy[0].symbol, policy[0].party, policy[0].card]).deep.eq(['party', PartyName.SCIENTISTS, undefined]);
      expect(modifierSymbolOf({kind: 'system'}, false)).eq('system');
      expect(modifierSymbolOf({kind: 'system'}, true), 'one play is a bolt whoever armed it').eq('once');
    });
    it('the seal: the standing cards first as a pile (the first on top), the bolt last; the names ride the aria-label', () => {
      const reversed = [...modifierSourcesOf(several)].reverse();
      const w = mount(PremiumModifierMarks, {...globalConfig, props: {sources: reversed}});
      const marks = w.findAll('[data-req-mark]');
      expect(w.find('[data-req-marks]').attributes('data-req-marks')).eq('3');
      expect(marks.map((m) => m.attributes('data-req-mark'))).deep.eq(['card', 'card', 'once']);
      expect(marks.map((m) => m.attributes('data-req-mark-source'))).deep.eq([CardName.ADAPTATION_TECHNOLOGY, CardName.INVENTRIX, SD]);
      expect(marks.map((m) => Number((m.element as HTMLElement).style.zIndex))).deep.eq([3, 2, 1]);
      expect(marks.every((m) => (m.element as HTMLElement).style.backgroundImage === ''), 'no art on a mark').is.true;
      expect(w.find('[data-req-marks]').attributes('aria-label')).contains(CardName.INVENTRIX);
    });
    it('a policy wears its party\'s emblem; past max a «+N» mark takes the rest; no source → no seal at all', () => {
      const policy = mount(PremiumModifierMarks, {...globalConfig, props: {sources: [{key: 'party:0', symbol: 'party', party: PartyName.SCIENTISTS, kind: 'shift', steps: 2, oneShot: false}]}});
      expect((policy.find('.pcard-modmark--party').element as HTMLElement).style.backgroundImage).contains('scientists');
      const many = mount(PremiumModifierMarks, {...globalConfig, props: {sources: modifierSourcesOf(several), max: 2}});
      expect(many.findAll('[data-req-mark]')).has.length(1);
      expect(many.find('.pcard-modmark--more').text()).eq('+2');
      expect(mount(PremiumModifierMarks, {...globalConfig, props: {sources: []}}).find('.pcard-modmarks').exists()).is.false;
    });
  });

  describe('the availability\'s EASED voice', () => {
    it('a card playable ONLY thanks to a modifier says so — never «nothing to say»', () => {
      const v = buildCardAvailability({reasons: undefined, easing: [waived]}, 'play')!;
      expect(v.severity).eq('eased');
      expect(v.tone).eq('eased');
      expect(v.icon).eq('✓');
      expect(v.title).eq('Playable now');
      expect(v.primary?.compact).eq('thanks to ' + CED);
      expect(v.reasons[0].text).eq('Temperature ≥ 0°C — Requirement ignored');
      expect(v.coveredRequirementIds, 'a bent rule is still printed — never hidden').deep.eq([]);
    });

    it('a modifier on a requirement met anyway says nothing (not decisive)', () => {
      expect(buildCardAvailability({reasons: undefined, easing: [{...shifted, met: true}]}, 'play')).is.undefined;
    });

    it('a still-short requirement NAMES its modifiers beside the effective bound', () => {
      const reason: UnplayableReason = {
        type: 'globalParameter', globalParameter: 'temperature', requirement: true, requirementKey: 'req:C',
        message: 'Requires ${0}°C', params: ['0'], current: -18, effectiveCount: -4,
      };
      const v = buildCardAvailability({reasons: [reason], easing: [shifted]}, 'play')!;
      expect(v.severity).eq('blocked');
      expect(v.reasons[0].modifiers).eq('With your modifiers: -4°C · ±2 ' + SD + ' · One play');
    });

    it('the zoom: a PLAYABLE hand entry still gets the eased panel', () => {
      const v = buildZoomAvailability({context: 'play', card: {name: CardName.FISH, requirementEasing: [decisiveShift]}, handEntry: {playable: true}});
      expect(v?.severity).eq('eased');
      expect(v?.reasons[0].text).eq('Temperature ≥ 2°C → -2°C');
    });

    it('the one formatter: line, compact, sources', () => {
      expect(easingLine(shifted)).eq('Temperature ≥ 0°C → -4°C');
      expect(easingCompact(shifted)).eq('Temperature ≥ -4°C ±2');
      expect(easingCompact(waived)).eq('Temperature Ignored');
      expect(easingSourcesText(waived)).eq(CED + ' · One play');
    });
  });

  describe('the cassette — three states on ONE plate, the printed value always stands', () => {
    function bar(easing: RequirementEasingModel | undefined) {
      const req = {...normalizeRequirement(easing?.max === true ? {temperature: easing.printed, max: true} : {temperature: easing?.printed ?? 0}),
        ...(easing === undefined ? {} : {easing: {
          effective: easing.effective, met: easing.met, decisive: easing.decisive,
          steps: easing.sources.reduce((s, x) => s + (x.steps ?? 0), 0), oneShot: easing.sources.some((x) => x.oneShot),
          sources: modifierSourcesOf(easing), quiet: easingIsQuiet(easing),
        }})};
      return mount(PremiumRequirementsBar, {...globalConfig, props: {requirements: [req]}});
    }
    it('a negative bound prints the typographic minus, printed and effective alike', () => {
      const req = {...normalizeRequirement({temperature: -16}), easing: {effective: -20, met: true, decisive: true, steps: 2, oneShot: true, sources: [], quiet: false}};
      const w = mount(PremiumRequirementsBar, {...globalConfig, props: {requirements: [req]}});
      expect(w.find('.pcard-req__value--printed').text()).eq('−16');
      expect(w.find('[data-req-effective]').text()).eq('−20°C');
    });
    it('printed', () => {
      const w = bar(undefined);
      expect(w.find('[data-req-state]').attributes('data-req-state')).eq('printed');
      expect(w.find('[data-req-effective]').exists()).is.false;
    });
    it('eased: the printed value steps back, the effective follows, the badge names the shift', () => {
      const w = bar(shifted);
      expect(w.find('[data-req-state]').attributes('data-req-state')).eq('eased');
      expect(w.find('.pcard-req__value--printed').text()).eq('0');
      expect(w.find('[data-req-effective]').text()).eq('−4°C');
      expect(w.find('[data-req-mod]').text()).eq('±2');
      expect(w.find('[data-req-mod] [data-req-mark]').attributes('data-req-mark'), 'the seal says what kind bends it').eq('once');
      expect(w.find('[data-req-decisive]').exists()).is.false;
      expect(w.find('.pcard__reqs--eased').exists()).is.true;
    });
    it('several modifiers: the FINAL bound, one mark per source, the TOTAL bend', () => {
      const w = bar(several);
      expect(w.find('[data-req-state]').attributes('data-req-state')).eq('eased');
      expect(w.find('[data-req-effective]').text()).eq('−28°C');
      expect(w.find('[data-req-mod]').attributes('data-req-mod-steps')).eq('6');
      expect(w.findAll('[data-req-mod] [data-req-mark]').map((m) => m.attributes('data-req-mark'))).deep.eq(['card', 'card', 'once']);
      expect(w.find('[data-req-mod]').text()).eq('±6');
      expect(w.find('[data-req-decisive]').exists()).is.true;
    });
    it('met anyway: QUIET — printed as printed, no seal, no effective bound', () => {
      const w = bar(quiet);
      expect(w.find('[data-req-state]').attributes('data-req-state')).eq('quiet');
      expect(w.find('[data-req-mod]').exists()).is.false;
      expect(w.find('[data-req-effective]').exists()).is.false;
      expect(w.find('.pcard__reqs--eased').exists()).is.false;
    });
    it('waived + decisive: the segment is struck, the printed value stays, the check is a form', () => {
      const w = bar(waived);
      expect(w.find('[data-req-state]').attributes('data-req-state')).eq('waived');
      expect(w.find('.pcard-req--waived').exists()).is.true;
      expect(w.find('.pcard-req__value').text()).eq('0°C');
      expect(w.find('[data-req-decisive]').exists()).is.true;
      expect(w.find('.pcard__reqs--waived').exists()).is.true;
      expect(w.find('[data-req-mod] [data-req-mark]').attributes('data-req-mark-source'), 'the seal marks what lifted it').eq(CED);
    });
  });
});
