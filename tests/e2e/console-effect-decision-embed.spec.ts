/*
 * A TRIGGERED EFFECT IS A STAGE OF THE PLAY THAT SET IT OFF.
 *
 * A card of the player's answers a tag they have JUST played, and until now
 * that question left the workspace the press was made in: the hand folded on
 * the landing beat, «ЭФФЕКТ КАРТЫ» rose as a full-bleed band over the board,
 * its discard opened a freshly-created hand and the drawn card arrived in a
 * fullscreen reveal. One press, four unrelated-looking screens.
 *
 * The North-Star reading is ONE flow, and the crumb proves it:
 *
 *   КАРТЫ В РУКЕ › <карта> › ЭФФЕКТ › [СБРОС КАРТЫ] › ДОБОР КАРТ → and only
 *   then does the workspace leave.
 *
 * TWO SHAPES, ONE CONTRACT — because the mechanism is structural (the server's
 * `choiceContext` + the play's claim), never a per-card branch:
 *   A. «Марсианский университет» — the offer OPENS the workspace's own shelf
 *      for a discard, so the chain has an extra stage between the question and
 *      the card.
 *   B. «Конференция на Олимпе» — both branches RESOLVE ON THE PRESS, so the
 *      draw follows the answer directly. It is the shape that proves the tail
 *      is HANDED ON at a submit rather than retracted.
 *
 * Watched FRAME BY FRAME, because every failure guarded here is a one-frame
 * ownership question: «did the workspace let go before its own effect was
 * finished?».
 */
import {expect, test, APIRequestContext, Page} from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import {bootIntoGame, press, soloGameConfig} from './consoleStart';

const OUT_DIR = path.join(__dirname, '..', '..', 'screenshots', 'effect-decision-embed');

/** ACTIVE, science tag, and its effect triggers on its OWN play («including
 *  this») — so ONE press from the hand reaches the decision. */
const MARS_UNIVERSITY = 'Mars University';
/** Same trigger, but it must first HOLD a resource to have anything to remove:
 *  its own play seeds one (no prompt), and the NEXT science tag asks. */
const OLYMPUS = 'Olympus Conference';
/** A plain science tag with no follow-up of its own — the second play, i.e.
 *  the one «Конференция на Олимпе» answers. */
const SCIENCE_TAG = 'Adaptation Technology';
/** Science tag AND `drawCard: 2` — ONE press produces a BATCH и an effect
 *  question in the SAME response (the user-reported «Акведуки + Рециклон»
 *  shape, on in-scope cards). */
const DRAW_AND_TAG = 'Technology Demonstration';
/** Filler, so the hand still holds something to discard after the play (Mars
 *  University's own guard returns nothing on an empty hand) and the cursor has
 *  somewhere to walk. */
const FILLER = ['Acquired Company', 'Rover Construction', 'Investment Loan'];

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_DIR, {recursive: true});
  await page.screenshot({path: path.join(OUT_DIR, `${name}.png`)});
}

/**
 * The workspace crumb's live tail — the ONE segment allowed to change.
 *
 * ⚠️ EVERY step node, not the first. The tail CROSSFADES (deliberately, never
 * `mode="out-in"` — see `ConsoleWsHead`), so the outgoing and incoming words
 * coexist for the whole transition, and reading `querySelector` there reports
 * the stage the player has just LEFT: this probe first accused the flow of
 * never naming its effect while the word was on screen beside the old one.
 * The LAST node is the incoming one.
 */
async function crumbTail(page: Page): Promise<string> {
  return page.evaluate(() => {
    const steps = Array.from(document.querySelectorAll(
      '.con-wshead__layer--deep:not(.con-wshead__layer--out) .con-wshead__step'))
      .map((el) => (el.textContent ?? '').trim())
      .filter((t) => t !== '');
    return steps[steps.length - 1] ?? '';
  });
}

async function bootWithHand(page: Page, request: APIRequestContext, cards: ReadonlyArray<string>): Promise<void> {
  await bootIntoGame(page, request, {
    config: soloGameConfig({customProjectCards: [...cards]}),
    cards: [...cards],
  });
}

/**
 * Open the hand workspace, walk the cursor onto `card`, descend into it and
 * CONFIRM the play — the ordinary console road, verified at every step (a press
 * landing on a busy frame is deliberately consumed).
 */
async function playFromHand(page: Page, card: string): Promise<void> {
  for (let i = 0; i < 6 && await page.locator('.con-hand__frame').count() === 0; i++) {
    await press(page, 'Period', 800);
    await press(page, 'Enter', 1100);
  }
  await expect(page.locator('.con-hand__frame')).toBeVisible({timeout: 20_000});
  await expect(page.locator('.con-hand__slot').first()).toBeVisible({timeout: 20_000});
  await page.waitForTimeout(800);

  const onTarget = () => page.locator(`.con-hand__slot--selected[data-zoom-slot="${card}"]`).count();
  let lastSelected = '';
  for (let i = 0; i < 60 && await onTarget() === 0; i++) {
    const selected = await page.evaluate(() =>
      document.querySelector('.con-hand__slot--selected')?.getAttribute('data-zoom-slot') ?? '');
    await press(page, selected === lastSelected && i > 0 ? 'ArrowDown' : 'ArrowRight', 260);
    lastSelected = selected;
  }
  expect(await onTarget(), `the hand cursor never reached ${card}`).toBeGreaterThan(0);
  await press(page, 'Enter', 900);
  await expect(page.locator('.con-hand__stage .con-composer--play')).toBeVisible({timeout: 20_000});
  await expect(page.locator('.con-composer__cta--ready')).toBeVisible({timeout: 20_000});
  await page.waitForTimeout(1000);
  await page.keyboard.press('Enter');
}

type ChainLog = {
  decisionEmbedded: boolean,
  decisionStandaloneFrames: number,
  decisionOrphanFrames: number,
  pickedInPlace: boolean,
  drawEmbedded: boolean,
  revealStandaloneFrames: number,
  viewerFrames: number,
  stages: Array<string>,
  stageAtPlay: string,
  stageAtDecision: string,
  stageAtPick: string,
  stageAtDraw: string,
  trace: Array<string>,
};

type ChainOpts = {
  /** Take an embedded batch with RT («Забрать все») instead of per-card A —
   *  the exact gesture of the reported bug. */
  takeAll?: boolean,
  /** Answer the decision with its DECLINE (the last row) instead of the offer —
   *  walk down until the decline row holds the focus, then press. */
  decline?: boolean,
};

/**
 * Watch the whole episode after the confirm, pressing A through it (every stage
 * of this chain is answered with A by contract) and recording — per frame — WHO
 * owns the screen and what the crumb's tail says.
 */
async function watchEffectChain(page: Page, shotPrefix: string, opts: ChainOpts = {}): Promise<ChainLog> {
  const log: ChainLog = {
    decisionEmbedded: false,
    decisionStandaloneFrames: 0,
    decisionOrphanFrames: 0,
    pickedInPlace: false,
    drawEmbedded: false,
    revealStandaloneFrames: 0,
    viewerFrames: 0,
    stages: [],
    stageAtPlay: '',
    stageAtDecision: '',
    stageAtPick: '',
    stageAtDraw: '',
    trace: [],
  };
  const noteStage = (stage: string) => {
    if (stage !== '' && stage !== log.stages[log.stages.length - 1]) {
      log.stages.push(stage);
    }
  };
  let shotDecision = false;
  let shotDraw = false;
  let goneStreak = 0;
  /** The chain's first surface has shown — the play's OWN stage is over. A
   *  frame with nothing on it after that is a hand-off gap between two stages
   *  (batch gone, decision not mounted yet), never the play again. */
  let chainStarted = false;
  for (let i = 0; i < 160; i++) {
    const s = await page.evaluate(() => {
      const decision = document.querySelector('.con-decision');
      const reveal = document.querySelector('.con-reveal');
      return {
        hand: document.querySelector('.con-hand__frame') !== null,
        decision: decision !== null,
        decisionEmbedded: document.querySelector('.con-hand__outcome .con-decision') !== null,
        reveal: reveal !== null,
        revealEmbedded: document.querySelector('.con-hand__outcome .con-reveal') !== null,
        viewer: document.querySelector('dialog.con-zoom[open]') !== null,
        // The pick BRIDGE has borrowed the shelf — the workspace's own browse
        // layer IS the picker («--stagepaused» → data-flow).
        picking: document.querySelector('.con-hand[data-flow="picking"]') !== null,
        focusedDecisionRow: document.querySelector('.con-decision__action--focused') !== null,
      };
    });
    const stage = await crumbTail(page);
    noteStage(stage);
    log.trace.push(`${i} h:${s.hand ? 1 : 0} d:${s.decision ? 1 : 0}/${s.decisionEmbedded ? 'e' : '-'} ` +
      `p:${s.picking ? 1 : 0} r:${s.reveal ? 1 : 0}/${s.revealEmbedded ? 'e' : '-'} «${stage}»`);

    if (s.decision || s.picking || s.reveal) {
      chainStarted = true;
    } else if (!chainStarted && log.stageAtPlay === '') {
      // FIRST non-empty read — the play's own stage. The crumb legitimately
      // advances BEFORE the next surface mounts (the deck names «ДОБОР КАРТ»
      // while the cards are still flying and no reveal exists yet), so a
      // last-write capture here reads the chain's first stage, not the play's.
      log.stageAtPlay = stage;
    }
    // STAGE CAPTURES ARE FIRST-FRAME, deliberately. The tail moves FORWARD at
    // a hand-off (the take names the coming effect while the batch is still
    // painting its leave — «they never coexist» is true of the decision, not
    // of the DOM), so the LAST frame of a departing surface legitimately reads
    // the NEXT stage's name. What each stage was ANNOUNCED as is its first
    // frame's read.
    if (s.decisionEmbedded) {
      log.decisionEmbedded = true;
      log.stageAtDecision = log.stageAtDecision === '' ? stage : log.stageAtDecision;
      if (!shotDecision) {
        shotDecision = true;
        // The ARRIVAL frame (the relieved tableau is still dissolving under it)
        // and the SETTLED one — the handoff is only continuous if BOTH read as
        // one surface.
        await shoot(page, `${shotPrefix}-arriving`);
        await page.waitForTimeout(900);
        await shoot(page, `${shotPrefix}-decision`);
      }
    }
    if (s.decision && !s.decisionEmbedded) {
      log.decisionStandaloneFrames++;
    }
    if (s.decision && !s.hand) {
      log.decisionOrphanFrames++;
    }
    if (s.picking) {
      if (!log.pickedInPlace) {
        await shoot(page, `${shotPrefix}-discard`);
      }
      log.pickedInPlace = true;
      log.stageAtPick = log.stageAtPick === '' ? stage : log.stageAtPick;
    }
    if (s.revealEmbedded) {
      log.drawEmbedded = true;
      log.stageAtDraw = log.stageAtDraw === '' ? stage : log.stageAtDraw;
      if (!shotDraw) {
        shotDraw = true;
        await shoot(page, `${shotPrefix}-draw`);
      }
    }
    if (s.reveal && !s.revealEmbedded) {
      log.revealStandaloneFrames++;
    }
    if (s.reveal && s.viewer) {
      log.viewerFrames++;
    }

    if (!s.hand) {
      goneStreak++;
      if (goneStreak >= 12) {
        break;
      }
    } else {
      goneStreak = 0;
    }
    // A drives the whole chain: take the offer, discard the focused card, take
    // the drawn one. Every one of them is «A» by contract — with two OPT-IN
    // variations that mirror real gestures: RT takes a whole batch at once
    // («Забрать все» — the reported bug's own press), and a declining player
    // walks the cursor to the decline row before pressing.
    if (s.revealEmbedded && opts.takeAll === true) {
      await press(page, 'Period', 800);
    } else if (s.focusedDecisionRow && opts.decline === true) {
      const onDecline = await page.evaluate(() =>
        document.querySelector('.con-decision__action--decline.con-decision__action--focused') !== null);
      await press(page, onDecline ? 'Enter' : 'ArrowDown', onDecline ? 800 : 300);
    } else if (s.focusedDecisionRow || s.picking || s.revealEmbedded) {
      await press(page, 'Enter', 800);
    } else {
      await page.waitForTimeout(250);
    }
  }
  return log;
}

/** The shared verdict — the same contract for every shape of the chain. */
function assertOneFlow(log: ChainLog, stages: ReadonlyArray<'play' | 'effect' | 'discard' | 'draw'>): void {
  const seen = `[${log.stages.join(' › ')}]`;
  expect(log.decisionEmbedded,
    'the triggered effect asked INSIDE the workspace the play was made in').toBeTruthy();
  expect(log.decisionStandaloneFrames,
    'the decision never stood as a band of its own').toBe(0);
  expect(log.decisionOrphanFrames,
    'the workspace never let go while its own effect was still asking').toBe(0);
  expect(log.drawEmbedded,
    'the card the effect produced arrived in the same zone').toBeTruthy();
  expect(log.revealStandaloneFrames,
    'the drawn card never left for a full-bleed band').toBe(0);
  expect(log.viewerFrames,
    'no fullscreen viewer — the card is the workspace\'s, not the board\'s').toBe(0);

  // ── THE CRUMB IS ONE CONTINUOUS LINE, AND IT ONLY MOVES FORWARD ──────
  //
  // Asserted on what was READ at each stage rather than on the words
  // themselves: the tail is translated (and CSS-uppercased), so pinning it to
  // «ЭФФЕКТ» would test the RU locale file, not the flow. What the flow
  // promises is structural — every stage names itself, none of them reuses
  // another's name, and none of them is ever returned to.
  const read: Record<string, string> = {
    play: log.stageAtPlay, effect: log.stageAtDecision,
    discard: log.stageAtPick, draw: log.stageAtDraw,
  };
  for (const name of stages) {
    expect(read[name], `the tail named the ${name} stage ${seen}`).not.toBe('');
  }
  expect(new Set(stages.map((n) => read[n])).size,
    `${stages.length} stages, ${stages.length} names ${seen} read=${JSON.stringify(read)}`).toBe(stages.length);
  expect(log.stages, 'the tail never returned to a stage already left')
    .toHaveLength(new Set(log.stages).size);
}

test.describe('a play\'s TRIGGERED effect resolves inside the workspace it was played in', () => {
  test.setTimeout(300_000);

  test('«Марсианский университет»: decision → discard → draw, all embedded, one crumb', async ({page, request}) => {
    await bootWithHand(page, request, [MARS_UNIVERSITY, ...FILLER]);
    await playFromHand(page, MARS_UNIVERSITY);
    const log = await watchEffectChain(page, 'mu');
    console.log(`[mars university trace]\n${log.trace.join('\n')}`);
    console.log(`[crumb stages] ${log.stages.join(' › ')}`);

    expect(log.pickedInPlace,
      'the discard ran on THIS workspace\'s shelf, not a freshly opened hand').toBeTruthy();
    assertOneFlow(log, ['play', 'effect', 'discard', 'draw']);
    // …and the flow ENDS by leaving: a finished operation is not a place to
    // come back to.
    await expect(page.locator('.con-hand__frame')).toHaveCount(0, {timeout: 60_000});
  });

  /**
   * «КОНФЕРЕНЦИЯ НА ОЛИМПЕ» — the OTHER shape, and the reason this contract is
   * structural rather than a card's own arrangement.
   *
   * Its own play seeds the first resource with no question at all; the NEXT
   * science tag then asks «снять жетон и взять карту / положить жетон», and
   * BOTH branches resolve ON THE PRESS. So there is no discard stage between
   * the answer and the card — which is exactly the case that proves the crumb's
   * tail is HANDED ON at a submit instead of being retracted into the play's
   * own «РАЗЫГРАНО», two steps behind the flow.
   */
  test('«Конференция на Олимпе»: the branch resolves on the press and its draw stays home', async ({page, request}) => {
    await bootWithHand(page, request, [OLYMPUS, SCIENCE_TAG, ...FILLER]);

    // The FIRST play only seeds the resource (`resourceCount === 0` → the card
    // takes one silently), so this workspace finishes on its own.
    await playFromHand(page, OLYMPUS);
    await expect(page.locator('.con-hand__frame')).toHaveCount(0, {timeout: 60_000});
    await page.waitForTimeout(1500);

    // The SECOND science tag is the one the conference answers.
    await playFromHand(page, SCIENCE_TAG);
    const log = await watchEffectChain(page, 'olympus');
    console.log(`[olympus trace]\n${log.trace.join('\n')}`);
    console.log(`[crumb stages] ${log.stages.join(' › ')}`);

    expect(log.pickedInPlace,
      'nothing is picked from hand here — both branches resolve on the press').toBeFalsy();
    assertOneFlow(log, ['play', 'effect', 'draw']);
    await expect(page.locator('.con-hand__frame')).toHaveCount(0, {timeout: 60_000});
  });

  /**
   * A BATCH AND AN EFFECT IN THE SAME RESPONSE — the reported «Акведуки +
   * Рециклон» shape, on in-scope cards: «Демонстрация технологий» draws 2
   * cards AND its science tag wakes «Марсианский университет», both delivered
   * with one answer. The batch presents first (surfaces go in turn), and the
   * TAKE is where the flow used to end: `result-detached`/`drawn-complete`
   * released the claim and folded the workspace under a prompt that had been
   * standing in `waitingFor` the whole time — the decision then rose as a
   * standalone band over the board.
   *
   * The take is the batch-wide RT («Забрать все»), the exact press of the bug
   * report; the decision is answered with its DECLINE, so the chain ends there
   * and the stage names stay unique for the crumb assertion.
   */
  test('a draw AND an effect from one press: the take does not end the chain', async ({page, request}) => {
    await bootWithHand(page, request, [MARS_UNIVERSITY, DRAW_AND_TAG, ...FILLER]);

    // The FIRST play puts the university on the table; its own science tag
    // asks at once — decline, and the workspace finishes.
    await playFromHand(page, MARS_UNIVERSITY);
    const setup = await watchEffectChain(page, 'setup-mu', {decline: true});
    console.log(`[setup trace]\n${setup.trace.join('\n')}`);
    await expect(page.locator('.con-hand__frame')).toHaveCount(0, {timeout: 60_000});
    await page.waitForTimeout(1500);

    // The SECOND play is the subject: batch + effect, one response.
    await playFromHand(page, DRAW_AND_TAG);
    const log = await watchEffectChain(page, 'batch-effect', {takeAll: true, decline: true});
    console.log(`[batch+effect trace]\n${log.trace.join('\n')}`);
    console.log(`[crumb stages] ${log.stages.join(' › ')}`);

    assertOneFlow(log, ['play', 'draw', 'effect']);
    await expect(page.locator('.con-hand__frame')).toHaveCount(0, {timeout: 60_000});
  });
});
