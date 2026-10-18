import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {GlobalParameter} from '@/common/GlobalParameter';
import {RequirementType} from '@/common/cards/RequirementType';
import {PartyName} from '@/common/turmoil/PartyName';
import {partyNameKey} from '@/client/console/parliament/partyNames';
import {ArmedPlayEffectModel, RequirementEasingModel} from '@/common/models/ArmedPlayEffectModel';
import {EffectForecast, emptyEffectForecast} from '@/common/models/EffectForecastModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {
  compactForecastChips,
  discountTail,
  forecastGroups,
  forecastItemCard,
  forecastLayerAvailable,
  modifierItemsOf,
} from '@/client/console/effectForecastModel';
import {derivePlayResultSections} from '@/client/console/consolePlayCardResult';
import {
  composerConsumeNotes,
  composerRequirementViews,
  requirementStateText,
  withRequirementEasing,
} from '@/client/console/composerRequirementRow';
import {armedEffectsOf} from '@/client/console/armedEffects';
import {
  armedEffectsChange,
  armedFlightState,
  presentedArmedEffects,
  releaseArmedEffectHolds,
  settleArmedEffectHolds,
} from '@/client/console/armedEffectFlight';

/**
 * THE ONE-PLAY CLASS IN THE PLAY'S OWN SURFACES (TR49): the «Сработает» row and its R3 layer, the composer's
 * requirement row and consume note, the result's `armed` section, the payment head's one-play discount, and the
 * flights' presentation holds. Every number is the server's (`ArmedPlayForecast`); these specs pin the arrangement.
 */
const CED = CardName.CUTTING_EDGE_DESIGN;
const SD = CardName.SPECIAL_DESIGN;
const IW = CardName.INDENTURED_WORKERS;

const waiver: ArmedPlayEffectModel = {source: CED, sourceType: CardType.EVENT, effect: {kind: 'requirementWaiver'}, expires: 'next-play'};
const shift: ArmedPlayEffectModel = {source: SD, sourceType: CardType.EVENT, effect: {kind: 'requirementShift', steps: 2}, expires: 'next-play'};
const discount: ArmedPlayEffectModel = {source: IW, sourceType: CardType.EVENT, effect: {kind: 'discount', amount: 8}, expires: 'next-play'};

const waived: RequirementEasingModel = {
  key: 'req:temperature', index: 0, type: RequirementType.TEMPERATURE, parameter: GlobalParameter.TEMPERATURE, max: false,
  printed: 0, effective: 'waived', current: -20, met: true, decisive: true,
  sources: [{source: {kind: 'card', card: CED}, kind: 'waive', oneShot: true}],
};
const standing: RequirementEasingModel = {
  key: 'req:oxygen', index: 0, type: RequirementType.OXYGEN, parameter: GlobalParameter.OXYGEN, max: false,
  printed: 5, effective: 3, current: 3, met: true, decisive: true,
  sources: [{source: {kind: 'card', card: CardName.ADAPTATION_TECHNOLOGY}, kind: 'shift', steps: 2, oneShot: false}],
};

/** SEVERAL modifiers at once — Inventrix + Adaptation Technology + an armed Special Design: ±6, Grass at −20 °C. */
const several: RequirementEasingModel = {
  key: 'req:temperature', index: 0, type: RequirementType.TEMPERATURE, parameter: GlobalParameter.TEMPERATURE, max: false,
  printed: -16, effective: -28, current: -20, met: true, decisive: true,
  sources: [
    {source: {kind: 'corporation', card: CardName.INVENTRIX}, kind: 'shift', steps: 2, oneShot: false},
    {source: {kind: 'card', card: CardName.ADAPTATION_TECHNOLOGY}, kind: 'shift', steps: 2, oneShot: false},
    {source: {kind: 'card', card: SD}, kind: 'shift', steps: 2, oneShot: true},
  ],
};
/** Met ANYWAY under a shift — the standing ±2 changes nothing for this card. */
const quiet: RequirementEasingModel = {
  key: 'req:temperature', index: 0, type: RequirementType.TEMPERATURE, parameter: GlobalParameter.TEMPERATURE, max: true,
  printed: -18, effective: -14, current: -20, met: true, decisive: false,
  sources: [{source: {kind: 'corporation', card: CardName.INVENTRIX}, kind: 'shift', steps: 2, oneShot: false}],
};

function withModifiers(modifiers: EffectForecast['modifiers'], base = 20): EffectForecast {
  return {...emptyEffectForecast(base), modifiers};
}

function viewOf(armed: ReadonlyArray<ArmedPlayEffectModel>): PlayerViewModel {
  return {thisPlayer: {armedPlayEffects: armed}} as unknown as PlayerViewModel;
}

describe('the ONE-PLAY class in the play surfaces (TR49)', () => {
  describe('the forecast — «Сработает» and its R3 layer', () => {
    it('an armed waiver this play USES is a modifier item, with the requirement it lifts', () => {
      const items = modifierItemsOf(withModifiers({consumes: [{armed: waiver, used: true}], easings: [waived]}));
      expect(items).has.length(1);
      expect(items[0]).to.include({kind: 'modifier', used: true, oneShot: true, waive: true, badge: ''});
      expect(items[0].easings.map((e) => e.key)).deep.eq(['req:temperature']);
      expect(forecastItemCard(items[0])).eq(CED);
    });

    it('an armed PARTY waiver (TR70) is a modifier item that names the party family — the struck plate is the party plate', () => {
      const partyWaiver: ArmedPlayEffectModel = {source: CardName.BACKROOM_DEAL, sourceType: CardType.EVENT, effect: {kind: 'partyWaiver'}, expires: 'next-play'};
      const partyWaived: RequirementEasingModel = {
        key: 'req:party', index: 0, type: RequirementType.PARTY, party: PartyName.MARS, max: false,
        printed: 2, effective: 'waived', current: 0, met: true, decisive: true,
        sources: [{source: {kind: 'card', card: CardName.BACKROOM_DEAL}, kind: 'waive', oneShot: true}],
      };
      const items = modifierItemsOf(withModifiers({consumes: [{armed: partyWaiver, used: true}], easings: [partyWaived]}));
      expect(items).has.length(1);
      expect(items[0]).to.include({kind: 'modifier', used: true, oneShot: true, waive: true, partyWaive: true, badge: ''});
      expect(items[0].easings.map((e) => e.party)).deep.eq([PartyName.MARS]);
      const [chip] = compactForecastChips(withModifiers({consumes: [{armed: partyWaiver, used: true}], easings: [partyWaived]})).chips;
      expect(chip).to.include({kind: 'modifier', waive: true, partyWaive: true});
      // The composer's row: the party's name, its two roads as the bound, the delegates road as «now».
      const [row] = composerRequirementViews([partyWaived]);
      expect(row).to.include({waived: true, met: true, decisive: true, label: partyNameKey(PartyName.MARS), printed: 'ruling or 2 delegates', iconClass: '', emblem: 'assets/parties/redux/mars-first.png'});
      expect(row.now).eq('your delegates on the resolution of that party: 0 of 2');
      expect(requirementStateText(row)).eq('Requirement ignored');
    });

    it('a party requirement met THROUGH AN ALLIANCE (TR62) is a standing modifier of the party family — the partner named', () => {
      const allied: RequirementEasingModel = {
        key: 'req:party', index: 0, type: RequirementType.PARTY, party: PartyName.REDS, max: false,
        printed: 2, effective: 'allied', via: PartyName.MARS, current: 0, met: true, decisive: true,
        sources: [{source: {kind: 'card', card: CardName.THARSIS_ALLIANCE}, kind: 'ally', via: PartyName.MARS, road: 'ruling', oneShot: false}],
      };
      const items = modifierItemsOf(withModifiers({consumes: [], easings: [allied]}));
      expect(items).has.length(1);
      expect(items[0]).to.include({kind: 'modifier', used: true, oneShot: false, waive: false, badge: ''});
      expect(forecastItemCard(items[0])).eq(CardName.THARSIS_ALLIANCE);
      // The composer's row: the printed party and its two roads stay; the bound is «through» the partner; «now» reads BOTH parties.
      const [row] = composerRequirementViews([allied]);
      expect(row).to.include({waived: false, allied: true, met: true, decisive: true, label: partyNameKey(PartyName.REDS), printed: 'ruling or 2 delegates', emblem: 'assets/parties/redux/reds.png'});
      expect(row.effective).eq(`through ${partyNameKey(PartyName.MARS)}`);
      expect(row.now).eq(`your delegates on the resolution of that party: 0 of 2 · ${partyNameKey(PartyName.MARS)} is ruling`);
      expect(requirementStateText(row)).eq('Met through the alliance');
      expect(row.shares[0].source).to.include({symbol: 'ally', via: PartyName.MARS, card: CardName.THARSIS_ALLIANCE});
      // Met ANYWAY (the Reds' own road holds) — quiet: no row, no chip.
      expect(composerRequirementViews([{...allied, decisive: false}])).deep.eq([]);
      expect(modifierItemsOf(withModifiers({consumes: [], easings: [{...allied, decisive: false}]}))).deep.eq([]);
    });

    it('an armed shift spent FOR NOTHING is still named — muted, never hidden', () => {
      const items = modifierItemsOf(withModifiers({consumes: [{armed: shift, used: false}], easings: []}));
      expect(items.map((i) => [i.badge, i.used, i.easings.length])).deep.eq([['±2', false, 0]]);
    });

    it('a USED armed discount is the discounts group\'s — no second tile; an unused one is a modifier', () => {
      expect(modifierItemsOf(withModifiers({consumes: [{armed: discount, used: true}], easings: []}))).deep.eq([]);
      expect(modifierItemsOf(withModifiers({consumes: [{armed: discount, used: false}], easings: []})).map((i) => i.badge)).deep.eq(['−8']);
    });

    it('a STANDING modifier (Adaptation Technology) is one item per source, not one-shot', () => {
      const items = modifierItemsOf(withModifiers({consumes: [], easings: [standing]}));
      expect(items.map((i) => [i.oneShot, i.badge, i.armed === undefined])).deep.eq([[false, '±2', true]]);
    });

    it('several sources: the armed one first, then every standing source — each chip wears the mark of its kind', () => {
      const forecast = withModifiers({consumes: [{armed: shift, used: true}], easings: [several]});
      const items = modifierItemsOf(forecast);
      expect(items.map((i) => [forecastItemCard(i), i.oneShot, i.badge])).deep.eq([
        [SD, true, '±2'], [CardName.INVENTRIX, false, '±2'], [CardName.ADAPTATION_TECHNOLOGY, false, '±2'],
      ]);
      const chips = compactForecastChips(forecast).chips.filter((c) => c.kind === 'modifier');
      expect(chips.map((c) => c.kind === 'modifier' ? [c.mark.card, c.mark.symbol] : [])).deep.eq([
        [SD, 'once'], [CardName.INVENTRIX, 'card'], [CardName.ADAPTATION_TECHNOLOGY, 'card'],
      ]);
    });

    it('a standing modifier on a requirement met ANYWAY is no fact of this play — only the armed one it spends stays', () => {
      expect(modifierItemsOf(withModifiers({consumes: [], easings: [quiet]}))).deep.eq([]);
      const spent = modifierItemsOf(withModifiers({consumes: [{armed: shift, used: false}], easings: [quiet]}));
      expect(spent.map((i) => [forecastItemCard(i), i.used])).deep.eq([[SD, false]]);
    });

    it('the row leads with the modifier chips; the layer opens on a modifiers-only forecast', () => {
      const forecast = withModifiers({consumes: [{armed: waiver, used: true}], easings: [waived]});
      const row = compactForecastChips(forecast);
      expect(row.chips.map((c) => c.kind)).deep.eq(['modifier']);
      expect(forecastLayerAvailable(forecast)).is.true;
      expect(forecastLayerAvailable(emptyEffectForecast(20))).is.false;
    });

    it('the layer\'s FIRST group is «Модификаторы розыгрыша»', () => {
      const groups = forecastGroups(withModifiers({consumes: [{armed: shift, used: true}], easings: []}));
      expect(groups[0].id).eq('modifiers');
      expect(groups[0].items.map((i) => i.kind)).deep.eq(['modifier']);
    });

    it('the payment head names a ONE-PLAY discount the play spends — a standing one stays in the layer', () => {
      const forecast: EffectForecast = {...emptyEffectForecast(21), discounts: {base: 21, final: 13, other: 0, items: [
        {source: {kind: 'card', card: IW}, amount: 8, oneShot: true},
      ]}};
      expect(discountTail(forecast)).deep.eq({base: 21, final: 13, saved: 8, armedSource: IW});
      const plain: EffectForecast = {...emptyEffectForecast(21), discounts: {base: 21, final: 19, other: 0, items: [
        {source: {kind: 'card', card: CardName.EARTH_OFFICE}, amount: 2},
      ]}};
      expect(discountTail(plain)?.armedSource).is.undefined;
    });
  });

  describe('the composer', () => {
    it('the requirement row: printed · effective (absent when ignored) · now · who', () => {
      const [w, s] = composerRequirementViews([waived, standing]);
      expect(w).to.include({waived: true, met: true, decisive: true, now: '-20°C'});
      expect(w.effective).is.undefined;
      expect(s).to.include({waived: false});
      expect(s.effective).is.not.undefined;
      expect(requirementStateText(w)).eq('Requirement ignored');
      expect(requirementStateText(s)).eq('Met thanks to the modifier');
    });

    it('several modifiers: the row reads the FINAL bound, then each source with its own mark and share', () => {
      const [row] = composerRequirementViews([several]);
      expect(row).to.include({waived: false, met: true, decisive: true});
      expect(row.shares.map((s) => [s.source.card, s.source.oneShot, s.text])).deep.eq([
        [CardName.INVENTRIX, false, '±2 ' + CardName.INVENTRIX],
        [CardName.ADAPTATION_TECHNOLOGY, false, '±2 ' + CardName.ADAPTATION_TECHNOLOGY],
        [SD, true, '±2 ' + SD + ' · One play'],
      ]);
      expect([row.stacked, row.total], 'the composition is its own line, ending on the sum').deep.eq([true, '±6']);
      expect(requirementStateText(row)).eq('Met thanks to the modifiers');
      const [one] = composerRequirementViews([standing]);
      expect([one.stacked, one.total], 'one source keeps the one line').deep.eq([false, undefined]);
    });

    it('a requirement met ANYWAY has no row and no rules line — it is no decision of this play', () => {
      expect(composerRequirementViews([quiet])).deep.eq([]);
      const t = {text: (k: string) => k, params: (k: string, p: Array<string>) => `${k}|${p.join('|')}`};
      const groups = withRequirementEasing([{kind: 'requirement', rows: [
        {id: 'req:temperature', text: 'x', params: [], special: false, anyPlayer: false},
      ]} as never], [quiet], t);
      expect((groups[0] as unknown as {rows: Array<{id: string}>}).rows.map((r) => r.id)).deep.eq(['req:temperature']);
    });

    it('the consume note says USED or FOR NOTHING, naming the source', () => {
      const notes = composerConsumeNotes({consumes: [{armed: shift, used: false}, {armed: waiver, used: true}], easings: []});
      expect(notes.map((n) => [n.source, n.used])).deep.eq([[SD, false], [CED, true]]);
      expect(notes[0].text).eq('This play spends Special Design for nothing — this card does not need it');
      expect(notes[1].text).eq('This play spends Cutting-Edge Design: Global requirements ignored');
    });

    it('the rules panel gains a line right under the requirement a modifier bends', () => {
      const t = {text: (k: string) => k, params: (k: string, p: Array<string>) => `${k}|${p.join('|')}`};
      const groups = withRequirementEasing([{kind: 'requirement', rows: [
        {id: 'req:temperature', text: 'x', params: [], special: false, anyPlayer: false},
        {id: 'req:ocean', text: 'y', params: [], special: false, anyPlayer: false},
      ]} as never], [waived], t);
      expect((groups[0] as unknown as {rows: Array<{id: string}>}).rows.map((r) => r.id)).deep.eq(['req:temperature', 'req:temperature:eased', 'req:ocean']);
    });

    it('the result names what the play ARMS (К-E5) — an event with no behavior is no longer «event tags» alone', () => {
      const sections = derivePlayResultSections(
        {tags: [], hasAction: false, hasEffect: false, isEvent: true, arms: [{kind: 'requirementWaiver'}]},
        {hasImmediate: false, hasFollowUp: false});
      expect(sections.map((s) => s.kind)).deep.eq(['armed']);
      expect(sections[0]).to.include({text: 'Arms your next card', note: 'Until your next card play'});
    });
  });

  describe('the flights\' presentation holds', () => {
    afterEach(() => releaseArmedEffectHolds());

    it('a spent effect stops being drawn from its token\'s launch; an armed one is drawn invisible until it lands', () => {
      const live = armedEffectsOf({armedPlayEffects: [shift]});
      armedFlightState.gone.push(live[0]);
      armedFlightState.arriving.push({view: armedEffectsOf({armedPlayEffects: [waiver]})[0], landed: false, committed: false});
      expect(presentedArmedEffects(live).map((e) => [e.source, e.held === true])).deep.eq([[CED, true]]);
      armedFlightState.arriving[0].landed = true;
      expect(presentedArmedEffects(live).map((e) => [e.source, e.held === true])).deep.eq([[CED, false]]);
    });

    it('once the view carries the effect, the hold is the view\'s — never drawn twice', () => {
      armedFlightState.arriving.push({view: armedEffectsOf({armedPlayEffects: [waiver]})[0], landed: false, committed: false});
      const live = armedEffectsOf({armedPlayEffects: [waiver]});
      expect(presentedArmedEffects(live)).has.length(1);
      releaseArmedEffectHolds();
      expect(presentedArmedEffects(live)).deep.eq(live);
    });

    it('the commit settles: a landed arm lets go; one still in the air keeps the VIEW chip invisible until its touchdown', () => {
      const waiverView = armedEffectsOf({armedPlayEffects: [waiver]})[0];
      armedFlightState.arriving.push({view: waiverView, landed: false, committed: false});
      armedFlightState.gone.push(armedEffectsOf({armedPlayEffects: [shift]})[0]);
      settleArmedEffectHolds();
      expect(armedFlightState.gone).deep.eq([]);
      const live = armedEffectsOf({armedPlayEffects: [waiver]});
      expect(presentedArmedEffects(live).map((e) => e.held === true)).deep.eq([true]);
      // Committed + unlanded never draws a SECOND copy, even when the view no longer carries it.
      expect(presentedArmedEffects([])).deep.eq([]);
    });

    it('the scene asks whether the answer arms or spends anything', () => {
      expect(armedEffectsChange(viewOf([]), viewOf([waiver]))).is.true;
      expect(armedEffectsChange(viewOf([shift]), viewOf([]))).is.true;
      expect(armedEffectsChange(viewOf([shift]), viewOf([shift]))).is.false;
      expect(armedEffectsChange(undefined, viewOf([shift]))).is.false;
    });
  });
});
