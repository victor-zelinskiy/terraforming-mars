import {expect} from 'chai';
import {MarsBotCorpId} from '../../src/common/automa/AutomaTypes';
import {DIVIDEND_GOAL_LINE, MarsBotDividendDetail, bonusTerm, dividendResult, perUnitTerm, withDividendGoal} from '../../src/common/automa/MarsBotDividend';
import {marsBotDividendInfo} from '../../src/common/automa/MarsBotDividendData';
import {PublicPlayerModel} from '../../src/common/models/PlayerModel';
import {botDividendDetailOf, botDividendReading} from '../../src/client/components/marsbot/botDividendReading';
import {marsBotDividendAnnotation, marsBotDividendGroupId, marsBotHoldingAnnotations} from '../../src/client/components/marsbot/marsBotCorpRules';

/**
 * THE LIVE DIVIDEND LEDGER's reading (the owner, 2026-10-27; three tiers on one
 * scale, 2026-10-28): a further corporation's inspected rules state the goal's
 * three thresholds, how far the operand has come, which tiers are paid and what
 * each adds, what the next one still needs, and the total WITH the goal. Every
 * number is the server's row (`detailsDividends`) — the reading only finds the
 * three goal terms `withDividendGoal` appended.
 */

/** Ecoline's dividend row exactly as the server builds it: the clause, then the box's goal (8 / 10 / 11 greeneries). */
function ecoline(greeneries: number): MarsBotDividendDetail {
  const r = marsBotDividendInfo(MarsBotCorpId.C02_ECOLINE).rates;
  const clause = dividendResult([
    perUnitTerm('Greenery tiles', greeneries, r.each),
    bonusTerm('Threshold bonus', greeneries, r.at, r.bonus),
  ]);
  return {corporation: MarsBotCorpId.C02_ECOLINE, ...withDividendGoal(clause, marsBotDividendInfo(MarsBotCorpId.C02_ECOLINE).goal)};
}

describe('botDividendReading — the live ledger of a further corporation', () => {
  it('no tier reached: the three thresholds and prizes, the next one\'s distance, the scale inside its first segment', () => {
    const reading = botDividendReading(ecoline(7));
    expect(reading).not.undefined;
    expect(reading!.goal.operand).deep.eq({label: 'Greenery tiles', count: 7});
    expect(reading!.goal.tiers.map((t) => [t.ordinal, t.at, t.vp, t.reached, t.paid])).deep.eq([[1, 8, 7, false, 0], [2, 10, 8, false, 0], [3, 11, 10, false, 0]]);
    expect(reading!.goal.next).deep.eq({ordinal: 1, vp: 7, remaining: 1});
    expect(reading!.goal.progress).closeTo((7 / 8) / 3, 1e-9);
    expect(reading!.formulaVp).eq(7 * 2 + 2);
    expect(reading!.goalsVp).eq(0);
    expect(reading!.goal.vp).eq(0);
    expect(reading!.totalVp).eq(16);
  });

  it('the mechanic: the name, the printed rule WITHOUT the goal line, the formula\'s live terms', () => {
    const reading = botDividendReading(ecoline(7))!;
    const info = marsBotDividendInfo(MarsBotCorpId.C02_ECOLINE);
    expect(reading.name).eq('Green Belt');
    expect(reading.rule.map((l) => l.text)).deep.eq(info.lines.filter((l) => l.text !== DIVIDEND_GOAL_LINE).map((l) => l.text));
    expect(reading.rule.map((l) => l.muted)).deep.eq([false, true]);
    expect(reading.terms.map((t) => [t.label, t.vp])).deep.eq([['Greenery tiles', 14], ['Threshold bonus', 2]]);
    expect(reading.terms[0].formula).deep.eq({label: '${0} × ${1} VP', params: [7, 2]});
    expect(reading.terms.reduce((s, t) => s + t.vp, 0), 'the terms add up to the formula').eq(reading.formulaVp);
  });

  it('the first tier reached: it pays +7, the next names what is missing, the scale halfway through its second segment', () => {
    const reading = botDividendReading(ecoline(9))!;
    expect(reading.goal.tiers.map((t) => [t.reached, t.paid])).deep.eq([[true, 7], [false, 0], [false, 0]]);
    expect(reading.goal.next).deep.eq({ordinal: 2, vp: 8, remaining: 1});
    expect(reading.goal.progress).closeTo((1 + 1 / 2) / 3, 1e-9);
    expect(reading.formulaVp).eq(9 * 2 + 2);
    expect(reading.goalsVp).eq(7);
    expect(reading.totalVp).eq(9 * 2 + 2 + 7);
  });

  it('two tiers reached: +7 +8, the last one still ahead — no step above +10 anywhere', () => {
    const reading = botDividendReading(ecoline(10))!;
    expect(reading.goal.tiers.map((t) => t.paid)).deep.eq([7, 8, 0]);
    expect(reading.goal.next).deep.eq({ordinal: 3, vp: 10, remaining: 1});
    expect(reading.goal.progress).closeTo(2 / 3, 1e-9);
    expect(Math.max(...reading.goal.tiers.map((t) => t.vp)), 'the biggest single step').eq(10);
  });

  it('all three reached: +7 +8 +10 on top of the formula, the scale full, nothing next', () => {
    const reading = botDividendReading(ecoline(12))!;
    expect(reading.goal.tiers.map((t) => [t.reached, t.paid])).deep.eq([[true, 7], [true, 8], [true, 10]]);
    expect(reading.goal.next).undefined;
    expect(reading.goal.progress).eq(1);
    expect(reading.goalsVp).eq(25);
    expect(reading.totalVp).eq(12 * 2 + 2 + 25);
    expect(reading.formulaVp + reading.goalsVp, 'the split adds up to the dividend').eq(reading.totalVp);
  });

  it('a goal measured on another term names THAT term\'s operand (Robinson Industries: term 1)', () => {
    const id = MarsBotCorpId.C15_ROBINSON_INDUSTRIES;
    const goal = marsBotDividendInfo(id).goal;
    expect(goal.term).eq(1);
    const clause = dividendResult([perUnitTerm('Tracks at the first mark', 6, 3), perUnitTerm('Tracks at the second mark', 4, 2)]);
    const reading = botDividendReading({corporation: id, ...withDividendGoal(clause, goal)})!;
    expect(reading.goal.operand).deep.eq({label: 'Tracks at the second mark', count: 4});
    expect(reading.goal.tiers[0].reached).eq(4 >= goal.tiers[0].at);
  });

  it('nothing to read: no row, or a row without its goal terms — the printed line stands instead', () => {
    expect(botDividendReading(undefined)).undefined;
    expect(botDividendReading({corporation: MarsBotCorpId.C02_ECOLINE, ...dividendResult([perUnitTerm('Greenery tiles', 3, 2)])})).undefined;
  });

  it('the row is found on the BOT\'s open breakdown, by the corporation', () => {
    const row = ecoline(5);
    const players = [
      {color: 'red', victoryPointsBreakdown: {}},
      {color: 'neutral', isMarsBot: true, victoryPointsBreakdown: {automa: {detailsDividends: [row]}}},
    ] as unknown as ReadonlyArray<PublicPlayerModel>;
    expect(botDividendDetailOf(players, MarsBotCorpId.C02_ECOLINE)).eq(row);
    expect(botDividendDetailOf(players, MarsBotCorpId.C10_THARSIS_REPUBLIC)).undefined;
  });
});

describe('the «ДИВИДЕНДЫ» box beside a live ledger', () => {
  const id = MarsBotCorpId.C02_ECOLINE;
  const printed = marsBotDividendInfo(id).lines.length;

  it('names the dividend and when it pays, then the printed formula WITH its goal line while nothing live stands under it', () => {
    const box = marsBotDividendAnnotation(id, 0);
    expect(box.id).eq(marsBotDividendGroupId(id));
    expect(box.rows.length).eq(1 + printed);
  });

  it('carries no rows of its own once the live ledger draws the whole box', () => {
    const live = marsBotHoldingAnnotations(id, {ledger: true})[0];
    expect(live.id).eq(marsBotDividendGroupId(id));
    expect(live.labelKey).eq('Dividends');
    expect(live.rows).deep.eq([]);
    expect(marsBotHoldingAnnotations(id)[0].rows.length, 'without a ledger the printed box stands').eq(1 + printed);
  });
});
