import {expect} from 'chai';
import {
  amountOperationVm,
  conversionCommitLabel,
  conversionHeadlineKey,
  conversionPromptVm,
  PoolReader,
} from '@/client/console/conversionPromptModel';
import {SelectAmountModel} from '@/common/models/PlayerInputModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';

/* Synthetic models — only the fields the VM reads. */
function player(fields: Partial<Record<string, number>>): PublicPlayerModel {
  return fields as unknown as PublicPlayerModel;
}

function amount(overrides: Partial<SelectAmountModel>): SelectAmountModel {
  return {
    type: 'amount',
    title: 'Choose how much energy to convert to heat',
    buttonLabel: 'OK',
    min: 0,
    max: 3,
    maxByDefault: true,
    icon: 'energy',
    conversion: {from: 'energy', to: 'heat'},
    ...overrides,
  } as SelectAmountModel;
}

describe('conversionPromptModel', () => {
  it('no conversion hint → no composition (the generic dial keeps the prompt)', () => {
    expect(conversionPromptVm(amount({conversion: undefined}), player({}), 1)).to.be.undefined;
    expect(conversionPromptVm(undefined, player({}), 1)).to.be.undefined;
  });

  it('states BOTH sides of the operation for the dialed value (the server-mirroring preview)', () => {
    const vm = conversionPromptVm(amount({max: 3}), player({energy: 3, heat: 5}), 2);
    expect(vm).to.not.be.undefined;
    // Energy 3 → 1 (−2), exactly what the server's andThen will apply.
    expect(vm!.from).to.deep.include({icon: 'energy', labelKey: 'Energy', current: 3, after: 1, delta: -2});
    // Heat 5 → 7 (+2).
    expect(vm!.to).to.deep.include({icon: 'heat', labelKey: 'Heat', current: 5, after: 7, delta: 2});
    expect(vm!.neutral).to.be.false;
    expect(vm!.binary).to.be.false;
  });

  it('value 0 is NEUTRAL: both sides unchanged, zero deltas — no false positive signal', () => {
    const vm = conversionPromptVm(amount({max: 1}), player({energy: 1, heat: 3}), 0);
    expect(vm!.from).to.deep.include({current: 1, after: 1, delta: 0});
    expect(vm!.to).to.deep.include({current: 3, after: 3, delta: 0});
    expect(vm!.neutral).to.be.true;
  });

  it('0..1 is a BINARY choice; wider ranges are a dial', () => {
    expect(conversionPromptVm(amount({max: 1}), player({energy: 1, heat: 0}), 0)!.binary).to.be.true;
    expect(conversionPromptVm(amount({max: 2}), player({energy: 2, heat: 0}), 0)!.binary).to.be.false;
    // A forced minimum (min 1) is not a refusable binary either.
    expect(conversionPromptVm(amount({min: 1, max: 1}), player({energy: 1, heat: 0}), 1)!.binary).to.be.false;
  });

  it('clamps an out-of-range value into [min, max] (no wrap-around, no overdraw)', () => {
    const over = conversionPromptVm(amount({max: 3}), player({energy: 3, heat: 0}), 99)!;
    expect(over.value).to.eq(3);
    expect(over.from.after).to.eq(0);
    const under = conversionPromptVm(amount({max: 3}), player({energy: 3, heat: 0}), -5)!;
    expect(under.value).to.eq(0);
    expect(under.neutral).to.be.true;
  });

  it('honours the conversion ratio on the receiving side', () => {
    const vm = conversionPromptVm(
      amount({max: 2, conversion: {from: 'energy', to: 'heat', ratio: 2}}),
      player({energy: 2, heat: 1}), 2)!;
    expect(vm.from.delta).to.eq(-2);
    expect(vm.to.delta).to.eq(4);
    expect(vm.to.after).to.eq(5);
  });

  it('production-scope sides read the production figure and say so', () => {
    const vm = conversionPromptVm(
      amount({max: 2, conversion: {from: 'heat', to: 'megacredits', fromScope: 'production', toScope: 'production'}}),
      player({heatProduction: 4, megacreditProduction: 1}), 1)!;
    expect(vm.from).to.deep.include({production: true, current: 4, after: 3});
    expect(vm.to).to.deep.include({production: true, current: 1, after: 2});
  });

  it('a non-standard resource side keeps the icon but has no figures to preview', () => {
    const vm = conversionPromptVm(
      amount({max: 2, conversion: {from: 'energy', to: 'floaters'}}),
      player({energy: 2}), 1)!;
    expect(vm.to.current).to.be.undefined;
    expect(vm.to.after).to.be.undefined;
    expect(vm.to.delta).to.eq(1);
  });

  it('headline: the stock energy→heat shape is recognised; others fall back to the server title', () => {
    expect(conversionHeadlineKey({from: 'energy', to: 'heat'})).to.eq('Energy conversion');
    expect(conversionHeadlineKey({from: 'energy', to: 'heat', fromScope: 'production'})).to.be.undefined;
    expect(conversionHeadlineKey({from: 'heat', to: 'megacredits'})).to.be.undefined;
  });

  it('commit verb: 0 is a stated refusal, N names the magnitude — never a generic OK', () => {
    expect(conversionCommitLabel(0)).to.deep.eq({key: 'Do not convert', params: []});
    expect(conversionCommitLabel(2)).to.deep.eq({key: 'Convert ${0}', params: ['2']});
  });

  // ── The generalized OPERATION shapes (the composers' amount rows) ─────────

  it('amountResult: spend the dialed icon, receive result×perUnit — both sides previewed', () => {
    // Sulphur Eating Bacteria: remove X microbes (the CARD's own store, via the
    // caller's pool reader), gain 3 M€ each.
    const pool: PoolReader = (icon) => icon === 'microbe' ? 4 : icon === 'megacredits' ? 10 : undefined;
    const vm = amountOperationVm(amount({
      min: 1, max: 4, icon: 'microbe', conversion: undefined,
      amountResult: {icon: 'megacredits', perUnit: 3},
    }), 2, pool)!;
    expect(vm.kind).to.eq('result');
    expect(vm.from).to.deep.include({icon: 'microbe', labelKey: 'Microbes', current: 4, after: 2, delta: -2});
    expect(vm.to).to.deep.include({icon: 'megacredits', labelKey: 'M€', current: 10, after: 16, delta: 6});
    expect(vm.binary).to.be.false;
    expect(vm.headlineKey).to.be.undefined;
  });

  it('amountResult: a non-standard receiving side keeps the server label and drops the figures', () => {
    // Hi-Tech Lab: spend X energy → draw X cards («Cards drawn»).
    const pool: PoolReader = (icon) => icon === 'energy' ? 3 : undefined;
    const vm = amountOperationVm(amount({
      min: 1, max: 3, icon: 'energy', conversion: undefined,
      amountResult: {icon: 'cards', perUnit: 1, label: 'Cards drawn'},
    }), 3, pool)!;
    expect(vm.from).to.deep.include({current: 3, after: 0, delta: -3});
    expect(vm.to).to.deep.include({icon: 'cards', labelKey: 'Cards drawn', current: undefined, after: undefined, delta: 3});
  });

  it('amountCost: the dial counts the GAIN; the price leaves the other pool', () => {
    // Energy Market: gain X energy for 2X M€.
    const pool: PoolReader = (icon) => icon === 'energy' ? 1 : icon === 'megacredits' ? 21 : undefined;
    const vm = amountOperationVm(amount({
      min: 1, max: 10, icon: 'energy', conversion: undefined,
      amountCost: {icon: 'megacredits', perUnit: 2},
    }), 3, pool)!;
    expect(vm.kind).to.eq('cost');
    expect(vm.from).to.deep.include({icon: 'megacredits', current: 21, after: 15, delta: -6});
    expect(vm.to).to.deep.include({icon: 'energy', current: 1, after: 4, delta: 3});
  });

  it('a result/cost hint without the spent icon degrades honestly (no half-stated operation)', () => {
    const pool: PoolReader = () => undefined;
    expect(amountOperationVm(amount({icon: undefined, conversion: undefined, amountResult: {icon: 'megacredits'}}), 1, pool)).to.be.undefined;
    expect(amountOperationVm(amount({icon: undefined, conversion: undefined, amountCost: {icon: 'megacredits'}}), 1, pool)).to.be.undefined;
  });

  it('a hint-less dial stays a bare stepper (no operation to state)', () => {
    expect(amountOperationVm(amount({conversion: undefined}), 1, () => 5)).to.be.undefined;
  });
});
