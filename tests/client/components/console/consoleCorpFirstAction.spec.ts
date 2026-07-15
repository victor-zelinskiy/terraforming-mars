import {expect} from 'chai';
import {taskFor, SHELL_SECTION_KINDS, NATIVE_KINDS, taskServedByHost} from '@/client/console/consoleTaskRouter';
import {runLeakDetection, leakDetectorState} from '@/client/console/consoleLeakDetector';
import {PlayerViewModel} from '@/common/models/PlayerModel';

/**
 * The corporation's MANDATORY FIRST ACTION is a FIRST-TURN prompt served by
 * the «Разыграно» table in action mode (never the start scene, never the
 * generic task host). It arrives as an OrOptions with NO title of its own —
 * so it MUST be routed by its structural marker; the untitled prompt is
 * exactly what used to fall through to the honest stranded guard
 * («This prompt is not available in console mode yet»).
 */
function corpActionView(): PlayerViewModel {
  return {
    id: 'p1',
    cardsInHand: [],
    thisPlayer: {color: 'red', tableau: [{name: 'Tharsis Republic'}], selfReplicatingRobotsCards: []},
    waitingFor: {
      type: 'or',
      // The REAL prompt carries no title (Player.takeAction builds a bare
      // OrOptions) — the client renders «Select one option» for it.
      title: '',
      options: [],
      startGamePrompt: {kind: 'corporationInitialAction'},
    },
  } as unknown as PlayerViewModel;
}

describe('corporation first action (console routing)', () => {
  it('routes the untitled corp-action OrOptions to the played table, not the host', () => {
    const view = corpActionView();
    const task = taskFor(view);
    expect(task?.kind).to.eq('corpFirstAction');
    // Served by a SHELL SECTION (the table), never by the generic task host.
    expect(SHELL_SECTION_KINDS.has('corpFirstAction')).to.be.true;
    expect(NATIVE_KINDS.has('corpFirstAction')).to.be.true;
    expect(taskServedByHost(view)).to.eq(undefined);
  });

  it('the leak detector accepts the played table as its serving surface', () => {
    const view = corpActionView();
    // Nothing rendered → the honest guard (this is what the player saw when
    // the table was closed by the hard-block race).
    document.body.innerHTML = '';
    runLeakDetection(view);
    runLeakDetection(view); // the guard is debounced by 2 consecutive passes
    expect(leakDetectorState.stranded?.taskKind).to.eq('corpFirstAction');

    // The table on screen IS the surface — the guard must clear. (JSDOM has no
    // layout, so the detector's rect probe is stubbed: it only asks whether the
    // node actually paints.)
    const table = document.createElement('div');
    table.className = 'con-played';
    table.getClientRects = () => ([{}] as unknown as DOMRectList);
    document.body.appendChild(table);
    runLeakDetection(view);
    expect(leakDetectorState.stranded).to.eq(undefined);
    document.body.innerHTML = '';
  });
});
