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
   * CAMPAIGN: THE LEGACY OVERVIEW door (R3) exists on EVERY wizard page —
   * the card steps, the summary AND the sent-and-awaiting summary (the read
   * informs the picks, so it may never be page-gated) — and never outside
   * the wizard. The open overview owns the bar: X inspect + B one level back.
   */
  it('R3 «Наследие» is advertised on every wizard page when legacy exists', () => {
    for (const shape of [
      state({legacyAvailable: true}),
      state({legacyAvailable: true, onSummary: true}),
      state({legacyAvailable: true, onSummary: true, awaiting: true}),
    ]) {
      expect(labelOf(startSceneCommands(shape), 'stickR'), JSON.stringify(shape)).to.eq('Legacy');
    }
    // No legacy → no door; and the ceremony never advertises it.
    expect(startSceneCommands(state({})).some((c) => c.control === 'stickR')).to.eq(false);
    expect(startSceneCommands(state({mode: 'ceremony', legacyAvailable: true}))
      .some((c) => c.control === 'stickR')).to.eq(false);
  });

  it('the open legacy overview owns the bar: inspect + one-level Back only', () => {
    const cmds = startSceneCommands(state({legacyAvailable: true, legacyOverview: true}));
    expect(cmds.map((c) => c.control)).to.deep.eq(['secondary', 'back']);
    expect(labelOf(cmds, 'back'), 'B is ONE logical level, never the workspace minimize').to.eq('Back');
    // …from the summary and the awaiting summary too — the stage is the same.
    const fromAwait = startSceneCommands(state({legacyAvailable: true, legacyOverview: true, onSummary: true, awaiting: true}));
    expect(fromAwait.map((c) => c.control)).to.deep.eq(['secondary', 'back']);
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
   * THE BONUS-ACTION STAGE — a prelude granted actions the workspace cannot
   * host, so the one press HANDS THE SCREEN to the board. The verb therefore
   * names the DESTINATION: «Выполнить» would read as «this press performs the
   * action», and the press performs nothing — it moves the player.
   */
  it('the bonus-action READY carries a CTA that names where the press GOES', () => {
    const cmds = startSceneCommands(state({mode: 'ceremony', bonusAction: 'ready'}));
    const a = cmds.find((c) => c.control === 'confirm');
    expect(a?.label).to.eq('Go to the board');
    expect(a?.highlight).to.eq(true);
    expect(labelOf(cmds, 'back'), 'B stays the ordinary minimize').to.eq('Minimize');
  });

  it('the bonus-action WAIT advertises no A at all', () => {
    const cmds = startSceneCommands(state({mode: 'ceremony', bonusAction: 'waiting'}));
    expect(cmds.map((c) => c.control)).to.deep.eq(['secondary', 'back']);
  });

  it('the bonus stage outranks the first-action stage (the bonuses are taken first)', () => {
    // Head Start grants the actions «immediately»; when a corporation also owes
    // its opening move, that move is served ON THE BOARD as one of them.
    const cmds = startSceneCommands(state({
      mode: 'ceremony', bonusAction: 'ready', firstAction: 'ready',
    }));
    expect(labelOf(cmds, 'confirm')).to.eq('Go to the board');
  });

  it('no bonus stage → the first-action stage is untouched', () => {
    const cmds = startSceneCommands(state({mode: 'ceremony', bonusAction: 'off', firstAction: 'ready'}));
    expect(labelOf(cmds, 'confirm')).to.eq('Take first action');
  });

  it('a focused GAIN row relabels A to «Получить» on BOTH stages', () => {
    // The cursor stands on a claimable gain (Head Start's «до или после») —
    // the A the bar advertises must be the A the press performs.
    expect(labelOf(startSceneCommands(state({
      mode: 'ceremony', bonusAction: 'ready', stageGainFocused: true,
    })), 'confirm')).to.eq('Claim now');
    expect(labelOf(startSceneCommands(state({
      mode: 'ceremony', firstAction: 'ready', stageGainFocused: true,
    })), 'confirm')).to.eq('Claim now');
    // …and never off the rows: the stage CTA keeps its own verb.
    expect(labelOf(startSceneCommands(state({
      mode: 'ceremony', bonusAction: 'ready', stageGainFocused: false,
    })), 'confirm')).to.eq('Go to the board');
  });

  /**
   * THE RISK STAGE — A was pressed on a prelude whose effect cannot resolve.
   * The press did NOT commit; it opened the stage that explains why. The bar
   * must now say exactly what the next input does, in the SAME words the
   * warning uses, because the defect being fixed here was two true sentences
   * that together meant something false: «Сначала разыграйте другой пролог»
   * over «A — Подтвердить» reads as «press A to go to the other prelude».
   */
  it('the risk stage names the LOSS on A and «back to selection» on B', () => {
    const cmds = startSceneCommands(state({
      mode: 'ceremony', riskCommitLabel: 'Play with no effect', riskHold: true,
    }));
    expect(cmds.map((c) => c.control)).to.deep.eq(['confirm', 'secondary', 'back']);
    expect(labelOf(cmds, 'confirm')).to.eq('Play with no effect');
    expect(labelOf(cmds, 'back')).to.eq('Back to selection');
  });

  it('…and the verb is never a generic confirmation', () => {
    for (const label of ['Play with no effect', 'Play anyway']) {
      const a = startSceneCommands(state({mode: 'ceremony', riskCommitLabel: label}))
        .find((c) => c.control === 'confirm');
      expect(a?.label, 'the commit verb must name what is lost').to.eq(label);
      expect(['Confirm', 'Press again to confirm', 'Play now'],
        'a generic verb beside an order-dependency warning is the whole bug')
        .to.not.include(a?.label);
    }
  });

  it('a HELD commit is advertised as held (the ring), a tapped one is not', () => {
    const held = startSceneCommands(state({
      mode: 'ceremony', riskCommitLabel: 'Play with no effect', riskHold: true,
    })).find((c) => c.control === 'confirm');
    expect(held?.hold).to.eq(true);
    const tapped = startSceneCommands(state({
      mode: 'ceremony', riskCommitLabel: 'Play anyway', riskHold: false,
    })).find((c) => c.control === 'confirm');
    expect(tapped?.hold).to.eq(false);
  });

  it('the risk stage never earns the launch highlight (a lost effect is not what the game waits for)', () => {
    const a = startSceneCommands(state({mode: 'ceremony', riskCommitLabel: 'Play with no effect'}))
      .find((c) => c.control === 'confirm');
    expect(a?.highlight).to.be.undefined;
  });

  it('the risk stage yields to the beats that own the bar outright (pay / first action)', () => {
    expect(startSceneCommands(state({
      mode: 'ceremony', riskCommitLabel: 'Play with no effect', payBeat: true,
    })).map((c) => c.label)).to.deep.eq(['Pay', 'Minimize']);
    expect(labelOf(startSceneCommands(state({
      mode: 'ceremony', riskCommitLabel: 'Play with no effect', firstAction: 'ready',
    })), 'confirm')).to.eq('Take first action');
  });
});
