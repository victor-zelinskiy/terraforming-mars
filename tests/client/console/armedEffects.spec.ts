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
        items: [{iconClass: 'wgt-icon wgt-icon--temperature', kind: 'shift', steps: 2}], decisive: false, oneShot: true,
      });
      expect(handEasingPlate({name: CardName.LAKE_MARINERIS, requirementEasing: [waived]} as CardModel)?.items[0].kind).eq('waive');
      expect(handEasingPlate({name: CardName.LAKE_MARINERIS, requirementEasing: [waived]} as CardModel)?.decisive).is.true;
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
      const req = {...normalizeRequirement({temperature: 0}), ...(easing === undefined ? {} : {easing: {
        effective: easing.effective, met: easing.met, decisive: easing.decisive,
        steps: easing.sources.reduce((s, x) => s + (x.steps ?? 0), 0), oneShot: true,
      }})};
      return mount(PremiumRequirementsBar, {...globalConfig, props: {requirements: [req]}});
    }
    it('a negative bound prints the typographic minus, printed and effective alike', () => {
      const req = {...normalizeRequirement({temperature: -16}), easing: {effective: -20, met: true, decisive: true, steps: 2, oneShot: true}};
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
      expect(w.find('[data-req-decisive]').exists()).is.false;
      expect(w.find('.pcard__reqs--eased').exists()).is.true;
    });
    it('waived + decisive: the segment is struck, the printed value stays, the check is a form', () => {
      const w = bar(waived);
      expect(w.find('[data-req-state]').attributes('data-req-state')).eq('waived');
      expect(w.find('.pcard-req--waived').exists()).is.true;
      expect(w.find('.pcard-req__value').text()).eq('0°C');
      expect(w.find('[data-req-decisive]').exists()).is.true;
      expect(w.find('.pcard__reqs--waived').exists()).is.true;
    });
  });
});
