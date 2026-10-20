import {expect} from 'chai';
import {actionUsesFor, ResolutionActionUses} from '../../src/common/parliament/actionUses';
import {actionUsesReadingOf, actionUsesRule, influenceIfWinning} from '../../src/client/console/parliament/actionUsesReading';
import {MANUFACTURING_RUN_USES} from '../../src/server/parliament/resolutions/industrialists/ManufacturingRun';
import {AGENDA_TRACK, influenceAtAgenda} from '../../src/common/parliament/ParliamentTypes';

/*
 * HOW MANY TIMES A LAW'S ACTION IS TAKEN — the client's ONE reading of the declaration (Manufacturing Run RX37):
 * the rule, the seat's count on / below the line, the win's forecast only where it changes the count; every number
 * the declaration's own function (`actionUsesFor`), never a client constant.
 */
const RUN: ResolutionActionUses = MANUFACTURING_RUN_USES;

/** The Agenda step that reads exactly `influence` on the track. */
function agendaFor(influence: number): number {
  for (let step = 0; step <= AGENDA_TRACK.length; step++) {
    if (influenceAtAgenda(step) === influence) {
      return step;
    }
  }
  throw new Error(`no Agenda step reads influence ${influence}`);
}

describe('actionUsesReading — the count of a law\'s action, read from its declaration', () => {
  it('the rule prints the base and the threshold; a law that declares nothing has no reading', () => {
    expect(actionUsesRule(RUN)).deep.eq({label: '${0} times a generation · ${1} with influence ${2}+', params: ['2', '3', '2']});
    expect(actionUsesRule({base: 2})).deep.eq({label: '${0} times a generation', params: ['2']});
    expect(actionUsesRule(undefined)).is.undefined;
    expect(actionUsesReadingOf(undefined, {influence: 3, agenda: 3})).is.undefined;
  });

  it('without a seat — the rule alone', () => {
    expect(actionUsesReadingOf(RUN)).deep.eq({rule: actionUsesRule(RUN)});
  });

  it('a seat at influence 0 / 1 / 2 / 3 reads 2 / 2 / 3 / 3 — below the line it names how much influence is missing', () => {
    const at = (influence: number) => actionUsesReadingOf(RUN, {influence, agenda: agendaFor(influence)});
    expect(at(0)?.seat).deep.eq({label: 'For you: ${0} times · ${1} more influence for ${2}', params: ['2', '2', '3']});
    expect(at(1)?.seat).deep.eq({label: 'For you: ${0} times · ${1} more influence for ${2}', params: ['2', '1', '3']});
    expect(at(2)?.seat).deep.eq({label: 'For you: ${0} times a generation', params: ['3']});
    expect(at(3)?.seat).deep.eq({label: 'For you: ${0} times a generation', params: ['3']});
    for (const influence of [0, 1, 2, 3]) {
      expect(at(influence)?.uses, `influence ${influence}`).eq(actionUsesFor(RUN, influence));
    }
  });

  it('THE WIN\'S FORECAST — the winner\'s Agenda step: a seat whose NEXT step is an influence step goes 1 → 2 and its count 2 → 3, said in its own line; a step that pays no influence (or a seat already on the line) changes nothing and prints nothing', () => {
    // The track: influence rises only on its influence steps — find a seat at influence 1 standing right before one.
    const before = [...Array(AGENDA_TRACK.length).keys()].find((step) => influenceAtAgenda(step) === 1 && influenceAtAgenda(step + 1) === 2);
    const flat = [...Array(AGENDA_TRACK.length).keys()].find((step) => influenceAtAgenda(step) === 1 && influenceAtAgenda(step + 1) === 1);
    expect(before, 'the track has an influence step from 1 to 2 (anti-vacuous)').is.not.undefined;
    expect(flat, 'and a step at influence 1 that pays something else').is.not.undefined;
    const rising = actionUsesReadingOf(RUN, {influence: 1, agenda: before!}, true);
    expect(influenceIfWinning({influence: 1, agenda: before!})).eq(2);
    expect(rising?.ifWin).deep.eq({label: 'If you win: ${0} times a generation', params: ['3']});
    expect(rising?.usesIfWin).eq(3);
    expect(actionUsesReadingOf(RUN, {influence: 1, agenda: flat!}, true)?.ifWin, 'the next step pays no influence').is.undefined;
    expect(actionUsesReadingOf(RUN, {influence: 2, agenda: agendaFor(2)}, true)?.ifWin, 'already on the line').is.undefined;
    expect(actionUsesReadingOf(RUN, {influence: 1, agenda: before!}, false)?.ifWin, 'no forecast asked').is.undefined;
  });

  it('the win keeps the influence beyond the track (a bonus) — the step only replaces the track\'s part', () => {
    const seat = {influence: influenceAtAgenda(0) + 1, agenda: 0};
    expect(influenceIfWinning(seat)).eq(influenceAtAgenda(1) + 1);
  });
});
