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
 * RECORDED STATE BY STATE (FLAKE ZERO — a witness armed before the confirm,
 * `settled`: every state a task leaves), because every failure guarded here is
 * a one-frame ownership question: «did the workspace let go before its own
 * effect was finished?». The driver only DRIVES (each press act → verify on the
 * chain's own state); what the chain was is read off the record.
 */
import {expect, test, APIRequestContext, Page} from './consoleTest';
import * as fs from 'fs';
import * as path from 'path';
import {
  answerTableQuestions, bootIntoGame, cinematicBeat, finiteMotion, press, pressUntil, settle, soloGameConfig,
  TableQuestionAnswer, walkFocusUntil,
} from './consoleStart';
import {armWitness, Witness, witnessOf} from './witness';
import type {ObservedSample} from './observeCore';

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

/** One state of the chain as the page painted it — what the record keeps and what the driver reads to press. */
type ChainState = {
  hand: boolean,
  decision: boolean,
  decisionEmbedded: boolean,
  reveal: boolean,
  revealEmbedded: boolean,
  /** The overlay stands in its own STANDALONE (full-bleed) mode. */
  revealStandalone: boolean,
  viewer: boolean,
  /** The pick BRIDGE has borrowed the shelf — the workspace's own browse layer IS the picker («--stagepaused» →
   *  data-flow) — or an album that IS the question (its decline plate in the question line). */
  picking: boolean,
  focusedDecisionRow: boolean,
  /** The decision's cursor stands on its DECLINE row. */
  onDecline: boolean,
  /** The workspace crumb's live tail — the ONE segment allowed to change. */
  stage: string,
  /** The reveal's own take state (what a take changes). */
  revealSig: string,
};

/**
 * The reader of {@link ChainState} — in the page, self-contained.
 *
 * ⚠️ The crumb tail is EVERY step node, not the first. The tail CROSSFADES (deliberately, never
 * `mode="out-in"` — see `ConsoleWsHead`), so the outgoing and incoming words
 * coexist for the whole transition, and reading `querySelector` there reports
 * the stage the player has just LEFT: this probe first accused the flow of
 * never naming its effect while the word was on screen beside the old one.
 * The LAST node is the incoming one.
 */
function readChain(): ChainState {
  const steps = Array.from(document.querySelectorAll(
    '.con-wshead__layer--deep:not(.con-wshead__layer--out) .con-wshead__step'))
    .map((el) => (el.textContent ?? '').trim())
    .filter((t) => t !== '');
  const reveal = document.querySelector('.con-reveal');
  return {
    hand: document.querySelector('.con-hand__frame') !== null,
    decision: document.querySelector('.con-decision') !== null,
    decisionEmbedded: document.querySelector('.con-hand__outcome .con-decision') !== null,
    reveal: reveal !== null,
    revealEmbedded: document.querySelector('.con-hand__outcome .con-reveal') !== null,
    // A FULL-BLEED band is the overlay in its own standalone mode — never the embedded one caught between two tasks of
    // its host's teardown (the frame leaves a task before its teleported stage does).
    revealStandalone: document.querySelector('.con-reveal:not(.con-reveal--embedded)') !== null,
    viewer: document.querySelector('dialog.con-zoom[open]') !== null,
    picking: document.querySelector('.con-hand[data-flow="picking"], .con-hand__question [data-decline-plate]') !== null,
    focusedDecisionRow: document.querySelector('.con-decision .con-vchoice__opt--focused') !== null,
    onDecline: document.querySelector('.con-decision .con-vchoice__opt--focused[data-decision-role="decline"]') !== null,
    stage: steps[steps.length - 1] ?? '',
    revealSig: reveal === null ? '' :
      `${reveal.querySelectorAll('[data-zoom-slot]').length}|${reveal.querySelectorAll('.con-reveal__takenmark').length}|${reveal.getAttribute('data-take') ?? ''}`,
  };
}

const CHAIN_WITNESS = 'effect-chain';

/** Arm the chain's record — before the press that starts it. `settled`: «the workspace never let go while its own
 *  effect was asking» and «the decision never stood as a band of its own» are coexistence claims. */
async function armChainWitness(page: Page): Promise<Witness<ChainState>> {
  return armWitness<ChainState>(page, CHAIN_WITNESS, readChain, {settled: true});
}

/** The motion of an arrival at rest (bounded — a screenshot's pacing, never a claim). */
async function motionAtRest(page: Page): Promise<void> {
  await expect.poll(() => finiteMotion(page), {timeout: 5_000}).toBe(0).catch(() => undefined);
}

async function bootWithHand(page: Page, request: APIRequestContext, cards: ReadonlyArray<string>): Promise<void> {
  await bootIntoGame(page, request, {
    config: soloGameConfig({customProjectCards: [...cards]}),
    cards: [...cards],
  });
}

/**
 * Open the hand workspace, walk the cursor onto `card`, descend into it, answer
 * the table's questions in its composer and CONFIRM the play — the ordinary
 * console road, verified at every step (a press landing on a busy frame is
 * deliberately consumed). `beforeConfirm` arms what must record the play from
 * before its press.
 */
async function playFromHand(page: Page, card: string, answers: Readonly<Record<string, TableQuestionAnswer>> = {},
  beforeConfirm?: (page: Page) => Promise<unknown>): Promise<void> {
  const frame = page.locator('.con-hand__frame');
  // RT wheel → the centre slot (the hand): each round verified by the frame standing, given the press's whole window.
  for (let i = 0; i < 6 && await frame.count() === 0; i++) {
    await press(page, 'Period', 800);
    await pressUntil(page, 'Enter', async () => await frame.count() > 0, {tries: 1, settleMs: 1100});
  }
  await expect(frame).toBeVisible({timeout: 20_000});
  await expect(page.locator('.con-hand__slot').first()).toBeVisible({timeout: 20_000});
  // The dock-to-hand reveal gates input on purpose — the hand is walked once it has landed.
  await page.locator('.con-hand:not(.con-hand--transit)').first().waitFor({state: 'visible', timeout: 20_000}).catch(() => undefined);

  const onTarget = page.locator(`.con-hand__slot--selected[data-zoom-slot="${card}"]`);
  const selected = () => page.evaluate(() =>
    document.querySelector('.con-hand__slot--selected')?.getAttribute('data-zoom-slot') ?? '');
  await walkFocusUntil(page, async () => await onTarget.count() > 0, selected, 60, 260);
  await expect(onTarget, `the hand cursor never reached ${card}`).not.toHaveCount(0);
  await pressUntil(page, 'Enter', async () => await page.locator('.con-hand__stage .con-composer--play').count() > 0, {tries: 1, settleMs: 900});
  await expect(page.locator('.con-hand__stage .con-composer--play')).toBeVisible({timeout: 20_000});
  await settle(page);
  await answerTableQuestions(page, answers);
  await expect(page.locator('.con-composer__cta--ready')).toBeVisible({timeout: 20_000});
  await settle(page);
  await beforeConfirm?.(page);
  await press(page, 'Enter', 400);
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
  /** Answer the question with its DECLINE instead of the offer — RT on an album that IS the decision (its plate in
   *  the album's question line), or the decline CARD of a YES / NO (walk down to it, then press). */
  decline?: boolean,
};

/**
 * Drive the whole episode after the confirm, pressing A through it (every stage
 * of this chain is answered with A by contract) — each press act → verify on
 * the chain's own state (the press's whole window before the next look) — and
 * read off the RECORD, state by state, WHO owned the screen and what the
 * crumb's tail said. The record is armed BEFORE the confirm (`armChainWitness`);
 * the driver never decides what happened, only what to press next.
 */
async function watchEffectChain(page: Page, shotPrefix: string, opts: ChainOpts = {}): Promise<ChainLog> {
  let shotDecision = false;
  let shotPick = false;
  let shotDraw = false;
  for (let i = 0; i < 160; i++) {
    const s = await page.evaluate(readChain);
    if (!s.hand) {
      // The workspace LEFT — the chain is over once the console is at rest and the frame has not come back.
      await settle(page);
      if (!(await page.evaluate(readChain)).hand) {
        break;
      }
      continue;
    }
    // The screenshots are evidence of the arrival frames (diagnostic only — every claim is judged on the record).
    if (s.decisionEmbedded && !shotDecision) {
      shotDecision = true;
      // The ARRIVAL frame (the relieved tableau is still dissolving under it)
      // and the SETTLED one — the handoff is only continuous if BOTH read as
      // one surface.
      await shoot(page, `${shotPrefix}-arriving`);
      await motionAtRest(page);
      await shoot(page, `${shotPrefix}-decision`);
    }
    if (s.picking && !shotPick) {
      shotPick = true;
      await shoot(page, `${shotPrefix}-discard`);
    }
    if (s.revealEmbedded && !shotDraw) {
      shotDraw = true;
      await shoot(page, `${shotPrefix}-draw`);
    }
    // A drives the whole chain: take the offer, discard the focused card, take
    // the drawn one. Every one of them is «A» by contract — with two OPT-IN
    // variations that mirror real gestures: RT takes a whole batch at once
    // («Забрать все» — the reported bug's own press), and a declining player
    // walks the cursor to the decline row before pressing.
    let key = '';
    let settleMs = 800;
    if (s.revealEmbedded && opts.takeAll === true) {
      key = 'Period';
    } else if (s.picking && opts.decline === true) {
      // The decline is a BUTTON (2026-10-13): RT in the album, whose question line names it.
      key = 'Period';
    } else if (s.focusedDecisionRow && opts.decline === true) {
      key = s.onDecline ? 'Enter' : 'ArrowDown';
      settleMs = s.onDecline ? 800 : 300;
    } else if (s.focusedDecisionRow || s.picking || s.revealEmbedded) {
      key = 'Enter';
    }
    if (key === '') {
      // Nothing to answer yet (a beat between two stages): wait for the next state the chain ASKS — or its leave.
      await expect.poll(async () => {
        const n = await page.evaluate(readChain);
        return !n.hand || n.focusedDecisionRow || n.picking || n.revealEmbedded;
      }, {timeout: 5_000}).toBe(true).catch(() => undefined);
      continue;
    }
    const before = JSON.stringify(s);
    await pressUntil(page, key, async () => JSON.stringify(await page.evaluate(readChain)) !== before, {tries: 1, settleMs});
  }
  return foldChain(await witnessOf<ChainState>(page, CHAIN_WITNESS).stop());
}

/** What the record says the chain was — the same per-state reading the old frame loop made, on every state kept. */
function foldChain(samples: ReadonlyArray<ObservedSample<ChainState>>): ChainLog {
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
  /** The chain's first surface has shown — the play's OWN stage is over. A
   *  state with nothing on it after that is a hand-off gap between two stages
   *  (batch gone, decision not mounted yet), never the play again. */
  let chainStarted = false;
  const t0 = samples[0]?.t ?? 0;
  for (const {t, v: s} of samples) {
    const stage = s.stage;
    noteStage(stage);
    log.trace.push(`${t - t0} h:${s.hand ? 1 : 0} d:${s.decision ? 1 : 0}/${s.decisionEmbedded ? 'e' : '-'} ` +
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
    // STAGE CAPTURES ARE FIRST-STATE, deliberately. The tail moves FORWARD at
    // a hand-off (the take names the coming effect while the batch is still
    // painting its leave — «they never coexist» is true of the decision, not
    // of the DOM), so the LAST state of a departing surface legitimately reads
    // the NEXT stage's name. What each stage was ANNOUNCED as is its first
    // state's read.
    if (s.decisionEmbedded) {
      log.decisionEmbedded = true;
      log.stageAtDecision = log.stageAtDecision === '' ? stage : log.stageAtDecision;
    }
    if (s.decision && !s.decisionEmbedded) {
      log.decisionStandaloneFrames++;
    }
    if (s.decision && !s.hand) {
      log.decisionOrphanFrames++;
    }
    if (s.picking) {
      log.pickedInPlace = true;
      log.stageAtPick = log.stageAtPick === '' ? stage : log.stageAtPick;
    }
    if (s.revealEmbedded) {
      log.drawEmbedded = true;
      log.stageAtDraw = log.stageAtDraw === '' ? stage : log.stageAtDraw;
    }
    if (s.revealStandalone) {
      log.revealStandaloneFrames++;
    }
    if (s.reveal && s.viewer) {
      log.viewerFrames++;
    }
  }
  return log;
}

/**
 * The shared verdict — the same contract for every shape of the chain. `asked: false` — a question answered BEFORE the
 * press (TR51): no live decision may stand at all, the chain is the play and what it drew. `asked: 'album'` — a live
 * question whose one answer is a card from the hand: it stands as the ALBUM, in place, with no decision screen before
 * it (the owner, 2026-10-13).
 */
function assertOneFlow(log: ChainLog, stages: ReadonlyArray<'play' | 'effect' | 'discard' | 'draw'>, opts: {asked?: false | 'decision' | 'album'} = {}): void {
  const seen = `[${log.stages.join(' › ')}]`;
  if (opts.asked === false) {
    expect(log.decisionEmbedded,
      'no live decision — the question was answered in the composer, before the press').toBeFalsy();
  } else if (opts.asked === 'album') {
    expect(log.pickedInPlace, 'the triggered effect asked as the album, INSIDE the workspace the play was made in').toBeTruthy();
    expect(log.decisionEmbedded, 'no decision screen stood before the album — there was nothing to decide on one').toBeFalsy();
  } else {
    expect(log.decisionEmbedded,
      'the triggered effect asked INSIDE the workspace the play was made in').toBeTruthy();
  }
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

  /**
   * «МАРСИАНСКИЙ УНИВЕРСИТЕТ» — its own science tag's question is a ROW of the play's composer since TR51, and its
   * discard is chosen in the HAND ALBUM before the press (the owner's rule 2026-10-13; the door's own probe is
   * `console-hand-pick-preselect`). What this contract still owns is the rest of the chain: the answer rides the ONE
   * POST, no decision rises after it, and the card it draws arrives in the SAME workspace.
   */
  test('«Марсианский университет»: answered before the press — the draw arrives in the same zone, one crumb', async ({page, request}) => {
    await bootWithHand(page, request, [MARS_UNIVERSITY, ...FILLER]);
    await playFromHand(page, MARS_UNIVERSITY, {[MARS_UNIVERSITY]: 'discard'}, armChainWitness);
    const log = await watchEffectChain(page, 'mu');
    console.log(`[mars university trace]\n${log.trace.join('\n')}`);
    console.log(`[crumb stages] ${log.stages.join(' › ')}`);

    expect(log.pickedInPlace,
      'nothing is picked after the press — the discard was chosen before it').toBeFalsy();
    assertOneFlow(log, ['play', 'draw'], {asked: false});
    // …and the flow ENDS by leaving: a finished operation is not a place to
    // come back to.
    await expect(page.locator('.con-hand__frame')).toHaveCount(0, {timeout: 60_000});
  });

  /**
   * «КОНФЕРЕНЦИЯ НА ОЛИМПЕ» — the OTHER shape, and the reason this contract is
   * structural rather than a card's own arrangement.
   *
   * Its own play seeds the first resource with no question at all; the NEXT
   * science tag then asks «снять жетон и взять карту / положить жетон» — a row
   * of that card's composer since TR51, answered before the press with the
   * draw. So the chain after the press is the play and the card its answer
   * drew — which proves the crumb's tail is HANDED ON at a submit instead of
   * being retracted into the play's own «РАЗЫГРАНО».
   */
  test('«Конференция на Олимпе»: the answer rides the press and its draw stays home', async ({page, request}) => {
    await bootWithHand(page, request, [OLYMPUS, SCIENCE_TAG, ...FILLER]);

    // The FIRST play only seeds the resource (`resourceCount === 0` → the card
    // takes one silently), so this workspace finishes on its own.
    await playFromHand(page, OLYMPUS);
    await expect(page.locator('.con-hand__frame')).toHaveCount(0, {timeout: 60_000});
    await settle(page); // the first play's leave and landing at rest before the next one opens

    // The SECOND science tag is the one the conference answers — «remove to draw», in the composer.
    await playFromHand(page, SCIENCE_TAG, {[OLYMPUS]: 'first'}, armChainWitness);
    const log = await watchEffectChain(page, 'olympus');
    console.log(`[olympus trace]\n${log.trace.join('\n')}`);
    console.log(`[crumb stages] ${log.stages.join(' › ')}`);

    expect(log.pickedInPlace,
      'nothing is picked from hand here — both branches resolve on the press').toBeFalsy();
    assertOneFlow(log, ['play', 'draw'], {asked: false});
    await expect(page.locator('.con-hand__frame')).toHaveCount(0, {timeout: 60_000});
  });

  /**
   * «СВЕРНУТЬ» AND BACK — the round trip, on an EMBEDDED stage.
   *
   * B past the commit boundary parks the whole stack: the workspace unmounts,
   * the decision stays live, and the board-home card is the way back. What the
   * park destroys is the workspace's DOM — including the very node the embedded
   * decision is teleported into — while the CLAIM (and with it the published
   * zone SELECTOR) deliberately survives.
   *
   * That asymmetry is the bug this guards. A `<Teleport>` re-resolves its target
   * only when `to` CHANGES, so a selector left published across the park kept
   * Vue pointing at the DETACHED div: on the way back the decision mounted into
   * a node that is not in the document. The crumb read
   * «КАРТЫ В РУКЕ › <карта> › ЭФФЕКТ», the kicker and the command bar advertised
   * the stage — and the screen was empty, with
   * `[console-leak-detector] STRANDED PROMPT: waitingFor "or"` as the only
   * evidence. So the assertion is deliberately made on BOTH sides: the surface
   * is back INSIDE the zone (a detached mount matches no selector at all), and
   * the strand guard never rises while the player reads it.
   */
  test('«свернуть» → back: the embedded question returns INSIDE the workspace', async ({page, request}) => {
    await bootWithHand(page, request, [MARS_UNIVERSITY, DRAW_AND_TAG, ...FILLER]);
    // A LIVE decision needs a question the composer could not ask: the university on the table (its own question
    // declined in its composer), then a science tag whose play DRAWS — the university's question may wait for that card
    // (2026-10-15, `tableQuestionDeferral`); left for after the draw, it is asked LIVE.
    await playFromHand(page, MARS_UNIVERSITY, {[MARS_UNIVERSITY]: 'decline'});
    await expect(page.locator('.con-hand__frame')).toHaveCount(0, {timeout: 60_000});
    await cinematicBeat(page, 1500, 'the first play\'s workspace finishes its leave before the next one opens');
    await playFromHand(page, DRAW_AND_TAG);

    // The batch presents first (surfaces go in turn) — take it (RT «Забрать все»); the question follows IN the
    // workspace: the university's one answer is a card from the hand, so it stands as the ALBUM (the shelf picks in
    // place), its decline named in the album's question line — no decision screen before it.
    const embedded = page.locator('.con-hand .con-hand__question [data-decline-plate]');
    const batch = page.locator('.con-hand__outcome .con-reveal');
    for (let i = 0; i < 12 && await embedded.count() === 0; i++) {
      await page.locator('.con-hand__outcome .con-reveal, .con-hand__question [data-decline-plate]').first().waitFor({timeout: 60_000});
      if (await batch.count() > 0) {
        // RT takes the batch — verified by the reveal's own take state moving (busy, a card taken, or the reveal gone);
        // then its leave runs out, so a second RT can never land on the album the take hands over to (RT there DECLINES).
        const takeSig = () => batch.first().evaluate((r) =>
          `${r.getAttribute('data-take') ?? ''}|${r.querySelectorAll('.con-reveal__takenmark').length}`, undefined, {timeout: 1_000}).catch(() => 'gone');
        const before = await takeSig();
        await pressUntil(page, 'Period', async () => await takeSig() !== before, {tries: 1, settleMs: 800});
        await batch.first().waitFor({state: 'detached', timeout: 15_000}).catch(() => undefined);
      }
    }
    await expect(embedded).toBeVisible({timeout: 60_000});
    await expect(page.locator('.con-decision'), 'no decision screen before the album').toHaveCount(0);
    await motionAtRest(page); // the arrival at rest before minimizing
    await shoot(page, 'collapse-before');

    // B = «свернуть». The stack parks at full depth and the board-home card
    // becomes the door back (never a close: nothing is submitted here).
    await press(page, 'Escape', 1800);
    await expect(page.locator('.con-hand__frame')).toHaveCount(0, {timeout: 30_000});
    await expect(embedded, 'the album left with its workspace').toHaveCount(0, {timeout: 30_000});
    await expect(page.locator('.con-decision')).toHaveCount(0, {timeout: 30_000});
    const card = page.locator('[data-test="con-mandatory-announce"]');
    await expect(card).toBeVisible({timeout: 30_000});
    await shoot(page, 'collapse-parked');

    // A on that card = RESUME — the same instance, the same depth, the same
    // decision, no second trip to the server.
    await press(page, 'Enter', 2500);
    await expect(page.locator('.con-hand__frame')).toBeVisible({timeout: 30_000});
    await expect(embedded, 'the question came back INSIDE the workspace it was minimized from')
      .toBeVisible({timeout: 30_000});
    await shoot(page, 'collapse-restored');

    // …and it STAYS served. The strand guard is debounced over two 1 Hz passes,
    // so a broken restore needs a few seconds to shout — the WHOLE window is
    // RECORDED (`armWitness`, every state the page stands in), and the window is
    // the detector's own: five of its passes after the restore
    // (`__conScreenShadow` counts every pass it judges), never a wall-clock pause.
    const served = await armWitness<{stranded: number, decision: number}>(page, 'collapse-restore-served', () => ({
      stranded: document.querySelectorAll('.con-stranded').length,
      decision: document.querySelectorAll('.con-decision').length,
    }));
    const detectorPasses = () => page.evaluate(() => {
      const shadow = (window as unknown as {__conScreenShadow?: () => {stats?: {verdicts?: Record<string, number>}}}).__conScreenShadow?.();
      return Object.values(shadow?.stats?.verdicts ?? {}).reduce((a, b) => a + b, 0);
    });
    const passesAtRestore = await detectorPasses();
    await expect.poll(async () => await detectorPasses() - passesAtRestore,
      {timeout: 20_000, message: 'the leak detector judged the restored screen over several of its passes'}).toBeGreaterThanOrEqual(5);
    const servedStates = (await served.stop()).map((s) => s.v);
    expect(servedStates.some((s) => s.stranded > 0), 'no stranded-prompt guard over a restored embedded question').toBe(false);
    expect(servedStates.some((s) => s.decision > 0), 'the restored question never fell back to a decision band of its own').toBe(false);

    // The round trip cost the flow nothing: it still finishes, and it still
    // finishes by LEAVING — recorded from here on.
    await armChainWitness(page);
    const log = await watchEffectChain(page, 'collapse-resume');
    console.log(`[collapse+resume trace]\n${log.trace.join('\n')}`);
    expect(log.decisionStandaloneFrames,
      'the resumed decision never stood as a band of its own').toBe(0);
    expect(log.decisionOrphanFrames,
      'the workspace never let go while its own effect was still asking').toBe(0);
    expect(log.drawEmbedded,
      'the card the resumed effect produced arrived in the same zone').toBeTruthy();
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
   * report; the question (the album — its one answer is a card from the hand)
   * is answered with its DECLINE, RT, so the chain ends there and the stage
   * names stay unique for the crumb assertion.
   */
  test('a draw AND an effect from one press: the take does not end the chain', async ({page, request}) => {
    await bootWithHand(page, request, [MARS_UNIVERSITY, DRAW_AND_TAG, ...FILLER]);

    // The FIRST play puts the university on the table; its own science tag's
    // question is a row of its composer (TR51) — declined there, and the
    // workspace finishes.
    await playFromHand(page, MARS_UNIVERSITY, {[MARS_UNIVERSITY]: 'decline'});
    await expect(page.locator('.con-hand__frame')).toHaveCount(0, {timeout: 60_000});
    await settle(page); // the first play's leave and landing at rest before the next one opens

    // The SECOND play is the subject: batch + effect, one response.
    await playFromHand(page, DRAW_AND_TAG, {}, armChainWitness);
    const log = await watchEffectChain(page, 'batch-effect', {takeAll: true, decline: true});
    console.log(`[batch+effect trace]\n${log.trace.join('\n')}`);
    console.log(`[crumb stages] ${log.stages.join(' › ')}`);

    // The question is the album (its one answer is a card from the hand), declined with RT — the crumb names it
    // «СБРОС КАРТЫ», after the draw and never before it.
    assertOneFlow(log, ['play', 'draw', 'discard'], {asked: 'album'});
    await expect(page.locator('.con-hand__frame')).toHaveCount(0, {timeout: 60_000});
  });
});
