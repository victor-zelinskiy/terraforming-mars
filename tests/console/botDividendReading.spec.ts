import {expect} from 'chai';
import {MarsBotCorpId} from '../../src/common/automa/AutomaTypes';
import {DIVIDEND_GOAL_LINE, MarsBotDividendDetail, bonusTerm, dividendResult, perUnitTerm, withDividendGoal} from '../../src/common/automa/MarsBotDividend';
import {marsBotDividendInfo} from '../../src/common/automa/MarsBotDividendData';
import {PublicPlayerModel} from '../../src/common/models/PlayerModel';
import {botDividendDetailOf, botDividendReading} from '../../src/client/components/marsbot/botDividendReading';
import {marsBotDividendAnnotation, marsBotDividendGroupId, marsBotHoldingAnnotations} from '../../src/client/components/marsbot/marsBotCorpRules';

/**
 * THE LIVE DIVIDEND LEDGER's reading (the owner, 2026-10-27): a further
 * corporation's inspected rules state both goals' thresholds, how far the
 * operand has come, whether each goal is reached and what it pays, and the
 * total WITH the goals. Every number is the server's row (`detailsDividends`)
 * — the reading only finds the two goal terms `withDividendGoal` appended.
 */

/** Ecoline's dividend row exactly as the server builds it: the clause, then the box's goals (9 / 10 greeneries). */
function ecoline(greeneries: number): MarsBotDividendDetail {
  const r = marsBotDividendInfo(MarsBotCorpId.C02_ECOLINE).rates;
  const clause = dividendResult([
    perUnitTerm('Greenery tiles', greeneries, r.each),
    bonusTerm('Threshold bonus', greeneries, r.at, r.bonus),
  ]);
  return {corporation: MarsBotCorpId.C02_ECOLINE, ...withDividendGoal(clause, marsBotDividendInfo(MarsBotCorpId.C02_ECOLINE).goal)};
}

describe('botDividendReading — the live ledger of a further corporation', () => {
  it('neither goal reached: the thresholds, how many are missing, the formula alone in the total', () => {
    const reading = botDividendReading(ecoline(7));
    expect(reading).not.undefined;
    expect(reading!.operand).deep.eq({label: 'Greenery tiles', count: 7});
    expect(reading!.goals.map((g) => [g.at, g.vp, g.reached, g.paid, g.remaining])).deep.eq([[9, 10, false, 0, 2], [10, 15, false, 0, 3]]);
    expect(reading!.goals[0].fill).closeTo(7 / 9, 1e-9);
    expect(reading!.formulaVp).eq(7 * 2 + 2);
    expect(reading!.goalsVp).eq(0);
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

  it('the first goal reached: it pays, the second still names what is missing; the total adds the goal', () => {
    const reading = botDividendReading(ecoline(9))!;
    expect(reading.goals.map((g) => [g.reached, g.paid, g.remaining, g.fill])).deep.eq([[true, 10, 0, 1], [false, 0, 1, 0.9]]);
    expect(reading.formulaVp).eq(9 * 2 + 2);
    expect(reading.goalsVp).eq(10);
    expect(reading.totalVp).eq(30);
  });

  it('both goals reached: +10 and +15 on top of the formula, the meters full', () => {
    const reading = botDividendReading(ecoline(12))!;
    expect(reading.goals.map((g) => [g.reached, g.paid, g.fill])).deep.eq([[true, 10, 1], [true, 15, 1]]);
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
    expect(reading.operand).deep.eq({label: 'Tracks at the second mark', count: 4});
    expect(reading.goals[0].reached).eq(4 >= goal.at);
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
