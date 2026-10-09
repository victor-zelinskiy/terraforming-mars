import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

/*
 * THE CARD STEP'S COVER LIFTS ON THE MARKER'S OWN SIGNAL (TR37 Red Lawyers —
 * docs/TURMOIL_REDUX_MINORITY_REPRESENTATION.md §3, §7). A walk of several
 * steps may reach its CARD step before its last; the cover scene then has to
 * lift off node k the moment the marker has LOCKED on k — never when «the
 * track has settled», which is the END of the whole walk (TR04's «honestly
 * late»). Three facts, read off the sources so a regression names its line:
 *  · the walk's director arms the scene with `landed: true` — the marker's
 *    lock IS the signal;
 *  · the layer waits for the track to settle ONLY through the pure predicate
 *    `agendaCoverWaitsForSettle(source)` (false for a walk-armed scene);
 *  · the director waits for the card's TOUCHDOWN in the dock
 *    (`onIntakeTouchdown`) and on nothing timed — the no-timers law of the
 *    parliament tree holds for this file too (`parliamentNoTimers.spec`).
 */
const ROOT = path.join(__dirname, '..', '..');
const DIRECTOR = path.join(ROOT, 'src', 'client', 'console', 'parliament', 'agendaWalkDirector.ts');
const LAYER = path.join(ROOT, 'src', 'client', 'components', 'console', 'boardCardBonus', 'ConsoleBoardCardBonusLayer.vue');

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('the Agenda card step — the cover scene lifts on the marker\'s lock, never on «the track has settled» (static guard)', () => {
  it('the walk director arms the agenda-step scene with the marker\'s lock as its signal and waits for the dock\'s touchdown', () => {
    const src = stripComments(fs.readFileSync(DIRECTOR, 'utf8'));
    expect(src, 'the arm carries `landed: true`').to.match(/armBoardCardBonus\(\{kind: 'agenda-step', step, landed: true\}\)/);
    expect(src, 'the reward lands on the dock\'s touchdown').to.include('onIntakeTouchdown(');
    expect(src, 'the director never reads the settle flag — that is the layer\'s self-armed path only').to.not.include('agendaSettling');
  });

  it('the layer waits for the settle ONLY through `agendaCoverWaitsForSettle(source)`', () => {
    const src = stripComments(fs.readFileSync(LAYER, 'utf8'));
    const waits = src.match(/await this\.waitAgendaSettled\(\)/g) ?? [];
    expect(waits, 'one wait, in `beginScene`').to.have.lengthOf(1);
    const guarded = /if \(agendaCoverWaitsForSettle\(source\)\) \{[^}]*await this\.waitAgendaSettled\(\)/s.test(src);
    expect(guarded, 'the wait stands inside `if (agendaCoverWaitsForSettle(source))` — a walk-armed cover lifts at once').to.be.true;
    expect(src, 'a lifted agenda cover releases the park (`markAgendaCardLifted`)').to.include('markAgendaCardLifted(source.step)');
  });
});
