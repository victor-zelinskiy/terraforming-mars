import {expect} from 'chai';
import {buildCardAvailability} from '@/client/console/cardAvailability';
import {UnplayableReason} from '@/common/cards/UnplayableReason';

// Server-shaped fixtures (the exact objects `unplayableReasons.ts` emits).
// With no dictionary loaded the translators return the English templates with
// params interpolated — assertions read those.
const TEMP_MIN: UnplayableReason = {
  type: 'globalParameter', globalParameter: 'temperature', requirement: true,
  message: 'Requires ${0}°C', params: ['0'], current: -22,
};
const TEMP_MAX_MISSED: UnplayableReason = {
  type: 'globalParameter', globalParameter: 'temperature', requirement: true, unattainable: true,
  message: 'Requires ${0}°C or colder', params: ['-18'], current: -10, effectiveCount: -14,
};
const TAGS: UnplayableReason = {
  type: 'tag', requirement: true, message: 'Requires ${0} tag(s)', params: ['3'], current: 1,
};
const MONEY: UnplayableReason = {type: 'megacredits', message: 'Need ${0} more M€', params: ['4']};
const TARGET: UnplayableReason = {type: 'target', message: 'No valid target available'};
const NOT_YOUR_TURN = 'Not your turn to take any actions';

describe('cardAvailability — the ONE availability presentation model', () => {
  // ── the DRAFT voice (evaluation for later) ──────────────────────────────
  it('draft: an unmet requirement is the calm PENDING voice with the requirement-vs-now line', () => {
    const v = buildCardAvailability({reasons: [TEMP_MIN]}, 'draft')!;
    expect(v.severity).to.eq('pending');
    expect(v.tone).to.eq('warning');
    expect(v.icon).to.eq('◈');
    expect(v.title).to.eq('Requirement not met yet');
    expect(v.primary?.text).to.eq('Requires 0°C · Now: -22°C');
    expect(v.extraCount).to.eq(0);
  });

  it('draft: a provably-lost requirement turns the verdict MISSED and leads the list', () => {
    const v = buildCardAvailability({reasons: [TAGS, TEMP_MAX_MISSED]}, 'draft')!;
    expect(v.severity).to.eq('missed');
    expect(v.title).to.eq('Requirement can no longer be met');
    // The decisive verdict outranks the still-open one — in the headline AND the order.
    expect(v.reasons[0].type).to.eq('globalParameter');
    expect(v.reasons[0].severity).to.eq('missed');
    expect(v.reasons[0].tone).to.eq('danger');
    expect(v.reasons[1].severity).to.eq('pending');
    expect(v.primary).to.eq(v.reasons[0]);
    expect(v.extraCount).to.eq(1);
  });

  it('draft: an insufficient modifier is explained, never silently dropped', () => {
    const v = buildCardAvailability({reasons: [TEMP_MAX_MISSED]}, 'draft')!;
    expect(v.reasons[0].modifiers).to.eq('With your modifiers: -14°C');
  });

  it('draft: several open requirements pluralize the headline', () => {
    const v = buildCardAvailability({reasons: [TAGS, TEMP_MIN]}, 'draft')!;
    expect(v.title).to.eq('Requirements not met yet');
    expect(v.reasons).to.have.length(2);
  });

  it('draft: situational reasons (money, targets) NEVER speak — the card is taken for later', () => {
    expect(buildCardAvailability({reasons: [MONEY, TARGET]}, 'draft')).to.eq(undefined);
    const mixed = buildCardAvailability({reasons: [MONEY, TEMP_MIN]}, 'draft')!;
    expect(mixed.reasons).to.have.length(1);
    expect(mixed.reasons[0].type).to.eq('globalParameter');
  });

  it('draft: no reasons → no view (a met requirement set renders nothing)', () => {
    expect(buildCardAvailability({reasons: []}, 'draft')).to.eq(undefined);
    expect(buildCardAvailability({reasons: undefined}, 'draft')).to.eq(undefined);
  });

  it('draft: identical reasons collapse to one row (never two wordings of one requirement)', () => {
    const v = buildCardAvailability({reasons: [TEMP_MIN, {...TEMP_MIN}]}, 'draft')!;
    expect(v.reasons).to.have.length(1);
  });

  // ── the PLAY voice (immediate decision) ─────────────────────────────────
  it('play: every real blocker is equally red under «Unplayable now» — no пока/уже split', () => {
    const v = buildCardAvailability({reasons: [TEMP_MAX_MISSED, MONEY, TARGET]}, 'play')!;
    expect(v.severity).to.eq('blocked');
    expect(v.title).to.eq('Unplayable now');
    expect(v.icon).to.eq('✕');
    // The provably-lost nuance adds nothing to THIS decision: same red voice.
    for (const r of v.reasons) {
      expect(r.severity).to.eq('blocked');
    }
    expect(v.reasons.map((r) => r.type)).to.deep.eq(['globalParameter', 'megacredits', 'target']);
  });

  it('play: the turn note joins LAST and keeps its own amber voice under the red verdict', () => {
    const v = buildCardAvailability({reasons: [TEMP_MIN], turnReason: NOT_YOUR_TURN}, 'play')!;
    expect(v.severity).to.eq('blocked');
    const last = v.reasons[v.reasons.length - 1];
    expect(last.type).to.eq('turn');
    expect(last.severity).to.eq('waiting');
    expect(last.tone).to.eq('warning');
    expect(last.text).to.eq(NOT_YOUR_TURN);
  });

  it('play: ONLY the closed window → the amber WAITING state, never a red verdict', () => {
    const v = buildCardAvailability({reasons: [], turnReason: NOT_YOUR_TURN}, 'play')!;
    expect(v.severity).to.eq('waiting');
    expect(v.tone).to.eq('warning');
    expect(v.icon).to.eq('⏳');
    expect(v.title).to.eq(NOT_YOUR_TURN);
    expect(v.reasons).to.have.length(0);
  });

  it('play: nothing blocks → no view', () => {
    expect(buildCardAvailability({reasons: []}, 'play')).to.eq(undefined);
  });

  // ── parity ──────────────────────────────────────────────────────────────
  it('compact and fullscreen read the SAME view: primary is the first list row, deterministically', () => {
    const input = {reasons: [TAGS, TEMP_MAX_MISSED, MONEY], turnReason: NOT_YOUR_TURN};
    const a = buildCardAvailability(input, 'play')!;
    const b = buildCardAvailability(input, 'play')!;
    expect(a).to.deep.eq(b);
    expect(a.primary).to.eq(a.reasons[0]);
    expect(a.extraCount).to.eq(a.reasons.length - 1);
  });
});
