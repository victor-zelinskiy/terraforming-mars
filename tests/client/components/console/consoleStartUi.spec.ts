import {expect} from 'chai';
import {startSceneCommands, StartSceneCommandState} from '@/client/console/consoleStartUi';

/**
 * The initial-setup command contract (the 2026-07 polish pass): the bottom
 * command bar is the ONE controller-hint surface, and every hint must match
 * its handler exactly —
 *  - A carries its context-exact verb (Select / Deselect / the launch), and
 *    is ABSENT while the pick limit blocks the focused card;
 *  - LB / RB are the symmetric step navigation (RB gated on step validity,
 *    absent on the summary — starting the game is ONLY the A commit);
 *  - RT / LT never appear anywhere in the setup;
 *  - no generic «Навигация» hint.
 */

function state(overrides: Partial<StartSceneCommandState>): StartSceneCommandState {
  return {
    dealActive: false,
    mode: 'wizard',
    onSummary: false,
    singlePick: false,
    focusedPicked: false,
    canPickFocused: true,
    hasCards: true,
    stepComplete: false,
    hasPrevStep: false,
    launchVerb: 'Begin the game',
    launches: true,
    wizardReady: true,
    awaiting: false,
    payBeat: false,
    ceremonyVerb: 'Play now',
    hasFocusables: true,
    firstAction: 'off',
    burnArmed: false,
    ...overrides,
  };
}

function labelOf(cmds: ReturnType<typeof startSceneCommands>, control: string): string | undefined {
  return cmds.find((c) => c.control === control)?.label;
}

describe('consoleStartUi (initial-setup command contract)', () => {
  it('never advertises LB/RB or a generic Navigate anywhere in the setup', () => {
    const shapes: Array<StartSceneCommandState> = [
      state({}),
      state({focusedPicked: true, canPickFocused: false}),
      state({canPickFocused: false}),
      state({singlePick: true}),
      state({onSummary: true}),
      state({mode: 'ceremony'}),
      state({mode: 'ceremony', payBeat: true}),
      state({dealActive: true}),
    ];
    for (const s of shapes) {
      const cmds = startSceneCommands(s);
      expect(cmds.some((c) => c.control === 'bumperR' || c.control === 'bumperL'),
        JSON.stringify(s)).to.eq(false);
      expect(cmds.some((c) => c.label === 'Navigate'), JSON.stringify(s)).to.eq(false);
    }
  });

  it('A is context-exact on a multi-pick step: Select / Deselect / absent at the limit', () => {
    // Unpicked + pickable → Select.
    expect(labelOf(startSceneCommands(state({})), 'confirm')).to.eq('Select');
    // Picked → Deselect (even while further picks are possible).
    expect(labelOf(startSceneCommands(state({focusedPicked: true})), 'confirm')).to.eq('Deselect');
    // Unpicked at the limit → NO A at all (X stays; the rail explains).
    const blocked = startSceneCommands(state({canPickFocused: false}));
    expect(blocked.some((c) => c.control === 'confirm')).to.eq(false);
    expect(labelOf(blocked, 'secondary')).to.eq('Inspect');
  });

  it('a single-pick step (corp / CEO) always offers A Select (select replaces)', () => {
    expect(labelOf(startSceneCommands(state({singlePick: true, canPickFocused: false})), 'confirm')).to.eq('Select');
  });

  it('LT/RT are the step navigation: LT only past step 1, RT gated on validity', () => {
    const first = startSceneCommands(state({hasPrevStep: false, stepComplete: false}));
    expect(first.some((c) => c.control === 'triggerL')).to.eq(false);
    const rt = first.find((c) => c.control === 'triggerR');
    expect(rt?.label).to.eq('Next step');
    expect(rt?.enabled).to.eq(false);

    const mid = startSceneCommands(state({hasPrevStep: true, stepComplete: true}));
    expect(labelOf(mid, 'triggerL')).to.eq('Prev step');
    expect(mid.find((c) => c.control === 'triggerR')?.enabled).to.eq(true);
  });

  it('the summary: A carries the launch verb, RT does not exist', () => {
    const cmds = startSceneCommands(state({onSummary: true}));
    const a = cmds.find((c) => c.control === 'confirm');
    expect(a?.label).to.eq('Begin the game');
    expect(a?.enabled).to.eq(true);
    expect(a?.highlight).to.eq(true);
    expect(cmds.some((c) => c.control === 'triggerR')).to.eq(false);
    expect(labelOf(cmds, 'triggerL')).to.eq('Prev step');
    expect(labelOf(cmds, 'back')).to.eq('Minimize');
  });

  it('the summary while others still pick: the submit verb, no launch highlight', () => {
    const cmds = startSceneCommands(state({onSummary: true, launchVerb: 'Submit your choice', launches: false}));
    const a = cmds.find((c) => c.control === 'confirm');
    expect(a?.label).to.eq('Submit your choice');
    expect(a?.highlight).to.eq(false);
  });

  it('an invalid summary disables A (never hides the commit)', () => {
    const a = startSceneCommands(state({onSummary: true, wizardReady: false})).find((c) => c.control === 'confirm');
    expect(a?.enabled).to.eq(false);
    expect(a?.highlight).to.eq(false);
  });

  it('the deal cinematic advertises ONLY the skip', () => {
    expect(startSceneCommands(state({dealActive: true}))).to.deep.eq([{control: 'confirm', label: 'Skip'}]);
  });

  it('the ceremony: A verb + Inspect gated on an actionable focus; the pay beat is one press', () => {
    const cmds = startSceneCommands(state({mode: 'ceremony', ceremonyVerb: 'Play now'}));
    expect(labelOf(cmds, 'confirm')).to.eq('Play now');
    expect(labelOf(cmds, 'secondary')).to.eq('Inspect');
    const pay = startSceneCommands(state({mode: 'ceremony', payBeat: true}));
    expect(pay.map((c) => c.label)).to.deep.eq(['Pay', 'Minimize']);
  });
  /**
   * SENT — the setup is confirmed and the table is still finishing. Nothing
   * is asked of this player, so the bar must not advertise a verb that does
   * nothing: only the inspect (base behaviour) and «свернуть».
   */
  it('the WAITING summary offers no verb it cannot honour — inspect + minimize only', () => {
    const cmds = startSceneCommands(state({onSummary: true, awaiting: true}));
    expect(cmds.map((c) => c.control)).to.deep.eq(['secondary', 'back']);
    expect(labelOf(cmds, 'confirm'), 'A must not claim a press that does nothing').to.be.undefined;
    expect(labelOf(cmds, 'back')).to.eq('Minimize');
  });

  /**
   * THE FIRST-ACTION STAGE — the deployment's conditional last stage. The
   * waiting state must never advertise an active CTA (the action cannot be
   * performed until the player's turn arrives); READY carries the ONE clear
   * A verb; the rise / the submit round trip go honestly quiet.
   */
  it('the first-action WAIT advertises no A at all — inspect + minimize only', () => {
    const cmds = startSceneCommands(state({mode: 'ceremony', firstAction: 'waiting'}));
    expect(cmds.map((c) => c.control)).to.deep.eq(['secondary', 'back']);
    expect(labelOf(cmds, 'confirm'), 'no active CTA while the action cannot be performed').to.be.undefined;
  });

  it('the first-action READY carries the one highlighted CTA', () => {
    const cmds = startSceneCommands(state({mode: 'ceremony', firstAction: 'ready'}));
    const a = cmds.find((c) => c.control === 'confirm');
    expect(a?.label).to.eq('Take first action');
    expect(a?.highlight).to.eq(true);
    expect(labelOf(cmds, 'back')).to.eq('Minimize');
  });

  it('the first-action BUSY beat (rise / submit) goes honestly quiet', () => {
    expect(startSceneCommands(state({mode: 'ceremony', firstAction: 'busy'}))).to.deep.eq([]);
  });

  it('the first-action stage outranks the generic ceremony verb', () => {
    const cmds = startSceneCommands(state({mode: 'ceremony', firstAction: 'ready', hasFocusables: false}));
    expect(labelOf(cmds, 'confirm')).to.eq('Take first action');
  });

  /**
   * THE BURN GATE — A was pressed on a prelude carrying «СГОРИТ» (playing it
   * now discards it for 15 M€, which cannot be unmade, and is usually only a
   * matter of ORDER). The bar must say the two things true of this beat and
   * no other: A CONFIRMS the press already made, and B TAKES IT BACK — never
   * «свернуть», which would hide the gate with the arm still live and leave
   * the one moment that needs an undo without a button for it.
   */
  it('an armed burn turns A into the confirm and B into the cancel', () => {
    const cmds = startSceneCommands(state({mode: 'ceremony', burnArmed: true}));
    expect(cmds.map((c) => c.control)).to.deep.eq(['confirm', 'secondary', 'back']);
    expect(labelOf(cmds, 'confirm')).to.eq('Confirm');
    expect(labelOf(cmds, 'back')).to.eq('Cancel');
    expect(labelOf(cmds, 'back'), 'the way out of an armed burn is BACK, never a minimize').to.not.eq('Minimize');
  });

  it('an armed burn never earns the launch highlight (a burn is not what the game waits for)', () => {
    const a = startSceneCommands(state({mode: 'ceremony', burnArmed: true})).find((c) => c.control === 'confirm');
    expect(a?.highlight).to.be.undefined;
  });

  it('the burn gate yields to the beats that own the bar outright (pay / first action)', () => {
    expect(startSceneCommands(state({mode: 'ceremony', burnArmed: true, payBeat: true})).map((c) => c.label))
      .to.deep.eq(['Pay', 'Minimize']);
    expect(labelOf(startSceneCommands(state({mode: 'ceremony', burnArmed: true, firstAction: 'ready'})), 'confirm'))
      .to.eq('Take first action');
  });
});
