import {expect} from 'chai';
import {availabilityContextFor, buildCardAvailability, buildZoomAvailability, CardEvaluationIntent} from '@/client/console/cardAvailability';
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
const OXYGEN_KEYED: UnplayableReason = {
  type: 'globalParameter', globalParameter: 'oxygen', requirement: true, requirementKey: 'req:O2',
  message: 'Requires ${0}% oxygen', params: ['9'], current: 0,
};
const PRODUCTION_BLOCKED: UnplayableReason = {type: 'production', message: 'Cannot reduce production'};
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

  // ── rules de-duplication ────────────────────────────────────────────────
  it('collects the RULES-BLOCK addresses of the requirements it restates', () => {
    const v = buildCardAvailability({reasons: [OXYGEN_KEYED, PRODUCTION_BLOCKED]}, 'play')!;
    // Only the printed requirement addresses a rules block; the blocked
    // EFFECT does not, so «ПРИ РОЗЫГРЫШЕ» keeps its own rule.
    expect(v.coveredRequirementIds).to.deep.eq(['req:O2']);
    expect(v.reasons).to.have.length(2);
  });

  it('a reason the view does NOT render can never hide a rule', () => {
    // In the draft voice the situational reason is filtered out entirely; a
    // keyed requirement still covers its block.
    const draft = buildCardAvailability({reasons: [OXYGEN_KEYED, PRODUCTION_BLOCKED]}, 'draft')!;
    expect(draft.reasons).to.have.length(1);
    expect(draft.coveredRequirementIds).to.deep.eq(['req:O2']);
    // …and a view built ONLY from situational reasons covers nothing.
    const play = buildCardAvailability({reasons: [PRODUCTION_BLOCKED, MONEY]}, 'play')!;
    expect(play.coveredRequirementIds).to.deep.eq([]);
  });

  it('a keyless requirement (partial restatement) leaves its rule alone', () => {
    const v = buildCardAvailability({reasons: [TAGS]}, 'draft')!;
    expect(v.reasons).to.have.length(1);
    expect(v.coveredRequirementIds).to.deep.eq([]);
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

describe('availabilityContextFor — the ONE applicability policy', () => {
  it('for-later DECISION intents speak the requirement (draft) voice', () => {
    const forLater: Array<CardEvaluationIntent> = [
      'start-pick', 'draft-pick', 'research-buy', 'deck-keep',
      'drafted-review', 'hand-sell', 'hand-give',
    ];
    for (const intent of forLater) {
      expect(availabilityContextFor(intent), intent).to.eq('draft');
    }
  });

  it('play-now DECISION intents speak the full-blocker (play) voice', () => {
    expect(availabilityContextFor('hand-play')).to.eq('play');
    expect(availabilityContextFor('project-play')).to.eq('play');
  });

  it('INFORMATIONAL intents are explicitly silent — history, foreigners, sources, reveals', () => {
    const informational: Array<CardEvaluationIntent> = [
      'played-browse', 'opponent-card', 'journal-link', 'endgame-review',
      'reveal-view', 'source-inspect', 'target-pick', 'bot-review',
    ];
    for (const intent of informational) {
      expect(availabilityContextFor(intent), intent).to.eq(undefined);
    }
  });

  it('an UNKNOWN / absent context is silent — the safe default is never a verdict', () => {
    expect(availabilityContextFor(undefined)).to.eq(undefined);
    // A future intent string nobody classified must fall to silence, not to a guess.
    expect(availabilityContextFor('some-new-surface' as CardEvaluationIntent)).to.eq(undefined);
  });
});

describe('buildZoomAvailability — the fullscreen viewer\'s one gated builder', () => {
  it('no context → nothing, whatever the card carries', () => {
    expect(buildZoomAvailability({context: undefined, card: {name: 'X', unplayableReasons: [TEMP_MIN]}})).to.eq(undefined);
  });

  it('no card → nothing (a viewer between cards publishes no verdict)', () => {
    expect(buildZoomAvailability({context: 'draft', card: undefined})).to.eq(undefined);
  });

  it('a non-card zoom entry (no reasons field) never grows a panel — not even a turn note', () => {
    // An Automa bonus plate reaches the viewer as a name-only entry: the play
    // voice must not paint the hand-flavoured turn note onto it (the note is
    // reserved for cards the viewer\'s own hand carries).
    expect(buildZoomAvailability({
      context: 'play', card: {name: 'bonus-entry'}, handEntry: undefined, turnReason: NOT_YOUR_TURN,
    })).to.eq(undefined);
  });

  it('play: the live hand offer WINS over stale reasons (a prompt-carried discount)', () => {
    expect(buildZoomAvailability({
      context: 'play',
      card: {name: 'X', unplayableReasons: [MONEY]},
      handEntry: {playable: true},
    })).to.eq(undefined);
  });

  it('play: a hand-carried blocked card gets the same view the verdict bar builds', () => {
    const zoom = buildZoomAvailability({
      context: 'play',
      card: {name: 'X', unplayableReasons: [TEMP_MIN, MONEY]},
      handEntry: {playable: false},
      turnReason: NOT_YOUR_TURN,
    })!;
    const rail = buildCardAvailability({reasons: [TEMP_MIN, MONEY], turnReason: NOT_YOUR_TURN}, 'play')!;
    expect(zoom).to.deep.eq(rail);
  });

  it('draft: the requirement voice over the card\'s own reasons — hand facts never leak in', () => {
    const zoom = buildZoomAvailability({
      context: 'draft',
      card: {name: 'X', unplayableReasons: [TEMP_MIN, MONEY]},
      // Even with a hand entry and a closed window, the draft voice stays
      // requirement-only — selling/keeping is never about the current turn.
      handEntry: {playable: false},
      turnReason: NOT_YOUR_TURN,
    })!;
    expect(zoom).to.deep.eq(buildCardAvailability({reasons: [TEMP_MIN, MONEY]}, 'draft')!);
    expect(zoom.reasons.every((r) => r.type !== 'turn')).is.true;
  });

  it('a card with no relevant requirement produces NO view — no empty frame to render', () => {
    expect(buildZoomAvailability({context: 'draft', card: {name: 'X', unplayableReasons: [MONEY]}})).to.eq(undefined);
    expect(buildZoomAvailability({context: 'draft', card: {name: 'X'}})).to.eq(undefined);
  });
});
