/*
 * A VISIBLE DECISION ANSWERS ITS FIRST PRESS — chained effect decisions.
 *
 * The guarded regression: «Конференция на Олимпе» and «Марсианский
 * университет» are both on the table, so playing a science tag raises TWO
 * effect decisions in a row (Olympus asks first — its Priority unshifts).
 * `ConsoleEffectDecision` is ONE persistent instance for both prompts, and
 * with no reveal between them (the «положить жетон» branch draws nothing) it
 * never unmounts across the transition. Its per-prompt local state therefore
 * MUST be re-armed by the response (`playerView` watcher — the
 * ConsoleTaskHost contract): a `submitting` latched by the first answer
 * swallowed EVERY A on the second decision — a visible «Сбросить карту» that
 * answered nothing, for as long as the game stood (reported as a ~20 s lock).
 *
 * Both shapes are pinned: the draw branch (a reveal stands between the two
 * decisions — the component remounts and was always fine) and the no-draw
 * branch (the direct choice → choice hand-off, the broken one). Since TR51 the
 * table's questions are asked in the play's COMPOSER, so a LIVE decision is
 * one the composer could not ask — a hand pick the play's own draw (or an
 * answer above it that draws) makes an honest follow-up; both variants are
 * built on exactly that road (`answerTableQuestions` answers the rest). The spec
 * MEASURES the second decision's reaction to its first press, while a witness
 * (FLAKE ZERO — `armWitness`, the product's own writes + a frame tick) records
 * every workspace-outcome / stack state the product wrote, so a reproduced lock
 * names its holder.
 *
 * Since the DECLINE became a button (2026-10-13 — `optionalChoice.ts`) the
 * university's question IS its pick: the album opens directly, «Не сбрасывать»
 * is RT with its plate in the album's question line. The chain is the same
 * chain — a decision (or album) answered, the next one standing in the very
 * next response — and the measurement is the same: the second one answers its
 * FIRST press.
 */
import {expect, test, APIRequestContext, Page} from './consoleTest';
import {answerTableQuestions, bootIntoGame, cinematicBeat, press, pressUntil, settle, soloGameConfig, TableQuestionAnswer,
  takeRevealCard} from './consoleStart';
import {armWitness, pageNow, witnessOf} from './witness';

const OLYMPUS = 'Olympus Conference';
const MARS_UNIVERSITY = 'Mars University';
/** TWO science tags AND a draw of two: with the university on the table its question is asked TWICE, and both may
 *  wait for that draw (2026-10-15, `tableQuestionDeferral`) — left for after it (the composer's default; the driver
 *  walks past them), they arrive LIVE, one after another. */
const RESEARCH = 'Research';
const FILLER = ['Acquired Company', 'Rover Construction', 'Investment Loan'];

async function bootWithHand(page: Page, request: APIRequestContext, cards: ReadonlyArray<string>): Promise<void> {
  await bootIntoGame(page, request, {
    config: soloGameConfig({customProjectCards: [...cards]}),
    cards: [...cards],
  });
}

/** Same walk as console-effect-decision-embed.spec.ts — the ordinary road, the table's questions answered in the composer. */
async function playFromHand(page: Page, card: string, answers: Readonly<Record<string, TableQuestionAnswer>> = {}): Promise<void> {
  for (let i = 0; i < 6 && await page.locator('.con-hand__frame').count() === 0; i++) {
    await press(page, 'Period', 800);
    await press(page, 'Enter', 1100);
  }
  await expect(page.locator('.con-hand__frame')).toBeVisible({timeout: 20_000});
  await expect(page.locator('.con-hand__slot').first()).toBeVisible({timeout: 20_000});
  // The album's entrance at rest before the cursor is walked.
  await settle(page);

  const onTarget = () => page.locator(`.con-hand__slot--selected[data-zoom-slot="${card}"]`).count();
  const selectedCard = () => page.evaluate(() =>
    document.querySelector('.con-hand__slot--selected')?.getAttribute('data-zoom-slot') ?? '');
  // Right along the row; a hop that moved nothing (the row's end) steps DOWN. Each hop is verified by the selection
  // moving within its window — never a selection read a beat late taken for a wall.
  let dir = 'ArrowRight';
  for (let i = 0; i < 60 && await onTarget() === 0; i++) {
    const at = await selectedCard();
    const moved = await pressUntil(page, dir, async () => (await selectedCard()) !== at, {tries: 1, settleMs: 260});
    dir = moved ? 'ArrowRight' : 'ArrowDown';
  }
  await expect.poll(onTarget, {message: `the hand cursor never reached ${card}`}).toBeGreaterThan(0);
  await press(page, 'Enter', 900);
  await expect(page.locator('.con-hand__stage .con-composer--play')).toBeVisible({timeout: 20_000});
  await settle(page);
  await answerTableQuestions(page, answers);
  await expect(page.locator('.con-composer__cta--ready')).toBeVisible({timeout: 20_000});
  // The sheet at rest before its commit.
  await settle(page);
  await page.keyboard.press('Enter');
}

/** One state of the chain, as the product wrote it: the decision / album surfaces and the shell's own diagnosis. */
type DiagSeen = {
  decision: boolean,
  decline: boolean,
  focusedRow: boolean,
  picking: boolean,
  revealEmbedded: boolean,
  diag: unknown,
};
type DiagSample = DiagSeen & {t: number};
const DIAG_WITNESS = 'chain-lock-diag';

/**
 * The lock's holder, RECORDED from here to the end (`armWitness` — every state the product wrote, the last 600 kept:
 * the end of the episode is where a lock stands). Diagnostic only: it is printed, never asserted.
 */
async function armDiagWitness(page: Page): Promise<void> {
  await armWitness<DiagSeen>(page, DIAG_WITNESS, () => {
    const diagFn = (window as unknown as Record<string, unknown>).__conColonyDiag as (() => unknown) | undefined;
    return {
      decision: document.querySelector('.con-decision') !== null,
      decline: document.querySelector('[data-decline-plate]') !== null,
      focusedRow: document.querySelector('.con-decision .con-vchoice__opt--focused') !== null,
      picking: document.querySelector('.con-hand[data-flow="picking"]') !== null,
      revealEmbedded: document.querySelector('.con-hand__outcome .con-reveal') !== null,
      diag: diagFn === undefined ? null : diagFn(),
    };
  }, {max: 600});
}

/** What the diag witness recorded, ms since its first sample. */
async function diagRecord(page: Page): Promise<Array<DiagSample>> {
  const samples = await witnessOf<DiagSeen>(page, DIAG_WITNESS).stop();
  const t0 = samples[0]?.t ?? 0;
  return samples.map((s) => ({...s.v, t: s.t - t0}));
}

/** The university's question stands as its ALBUM: the hand in pick mode, the RT decline named in its question line. */
async function albumAsks(page: Page): Promise<boolean> {
  return page.evaluate(() => document.querySelector('.con-hand__question [data-decline-plate]') !== null);
}

/**
 * Drive the chain's middle until the university's ALBUM stands: an embedded drawn card is TAKEN (act → verify —
 * `takeRevealCard`), and while neither stands the driver waits for whichever comes next (bounded), never a fixed tick.
 * Deliberately no press on the album itself — its first press is the measurement.
 */
async function driveToAlbum(page: Page, maxMs = 60_000): Promise<boolean> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline && !await albumAsks(page)) {
    if (await page.locator('.con-hand__outcome .con-reveal').count() > 0) {
      await takeRevealCard(page, 15_000);
      continue;
    }
    await page.waitForFunction(() => document.querySelector('.con-hand__question [data-decline-plate]') !== null ||
      document.querySelector('.con-hand__outcome .con-reveal') !== null,
    undefined, {polling: 100, timeout: Math.max(1, deadline - Date.now())}).catch(() => undefined);
  }
  return albumAsks(page);
}

/** How many presses the standing album took to REACT (0 = it never did), and the page-clock time of the reaction. */
type Reaction = {presses: number, ms: number};

/**
 * Press A once per second until the standing album REACTS — its answer goes out (the submit funnel busy) or it
 * leaves — RECORDED from before the first press (`armWitness`, the page's own clock). The presses are RAW: a lock is a
 * press the product swallows, so the driver's absorb gate must not wait it out. Each press's window ends the moment the
 * album reacts; the claim is ORDINAL — which press it answered — never a duration of the driver's clock.
 */
async function firstPressReaction(page: Page): Promise<Reaction> {
  type ReactionSeen = {album: boolean, posting: boolean};
  const witness = await armWitness<ReactionSeen>(page, 'chain-lock-reaction', () => ({
    album: document.querySelector('.con-hand__question [data-decline-plate]') !== null,
    posting: (window as unknown as {__conReady?: () => {transport?: {requestInProgress?: boolean}}})
      .__conReady?.()?.transport?.requestInProgress === true,
  }));
  const t0 = await pageNow(page);
  const reacted = async () => (await witness.samples()).find((s) => s.t >= t0 && (!s.v.album || s.v.posting));
  let presses = 0;
  do {
    await page.keyboard.press('Enter');
    presses++;
    await expect.poll(async () => await reacted() !== undefined, {timeout: 1000}).toBe(true).catch(() => undefined);
  } while (presses < 35 && await reacted() === undefined);
  const hit = await reacted();
  await witness.stop();
  return hit === undefined ? {presses: 0, ms: -1} : {presses, ms: hit.t - t0};
}

/** The verdict on a reaction: it came, and by the THIRD press at one a second (≤ 4 s) — never a 20 s lock. */
function expectAnsweredFirstPress(reaction: Reaction): void {
  expect(reaction.presses, 'the second question never reacted at all').toBeGreaterThan(0);
  expect(reaction.presses, 'the visible album must answer its first press (≤4s), not a 20 s lock')
    .toBeLessThanOrEqual(3);
}

test.describe('two triggered effects in a row', () => {
  test.setTimeout(300_000);

  /**
   * VARIANT B — the reported shape: prompt 1 is answered with NO draw, so the
   * SECOND decision arrives in the very next response with no reveal in
   * between. The decision component then has no reason to unmount between the
   * two prompts — the case where any local per-prompt state (submitting, armed)
   * that is not reset survives into the second decision.
   *
   * Since TR51 the table's questions are asked in the COMPOSER, so two LIVE
   * decisions in a row need two questions the composer could not ask:
   * «Исследования» (two science tags, draws two) under the university — the
   * play draws before either question, so both are honest follow-ups. Prompt 1
   * is DECLINED (nothing drawn, nothing discarded) and prompt 2 stands in the
   * same instance.
   */
  test('choice → choice with NO draw between: the second decision answers its FIRST press', async ({page, request}) => {
    await bootWithHand(page, request, [MARS_UNIVERSITY, RESEARCH, ...FILLER]);

    await playFromHand(page, MARS_UNIVERSITY, {[MARS_UNIVERSITY]: 'decline'});
    await expect(page.locator('.con-hand__frame')).toHaveCount(0, {timeout: 60_000});
    await settle(page);

    await armDiagWitness(page);

    await playFromHand(page, RESEARCH);

    // The play's own batch presents first (surfaces go in turn) — take it; prompt 1 follows, as its ALBUM.
    await driveToAlbum(page);
    await expect.poll(() => albumAsks(page), {message: 'the university\'s first question stands as its album'}).toBe(true);
    await cinematicBeat(page, 1200, 'the first album settles before its answer');

    // RT — the decline (nothing drawn, nothing discarded); its response carries prompt 2.
    const answered = page.waitForResponse((r) => r.request().method() === 'POST' && /\/player\/input/.test(r.url()));
    await page.keyboard.press('Period');
    await answered;

    // Prompt 2 — the university's SECOND question, its album again. No reveal stands between the two here.
    await expect.poll(() => albumAsks(page), {timeout: 36_000,
      message: 'the second question (the university\'s second) reached the screen'}).toBe(true);
    await cinematicBeat(page, 800, 'the second album settles before the measured press');

    const reaction = await firstPressReaction(page);

    const samples = await diagRecord(page);
    const compact = samples.map((s) => {
      const d = s.diag as {
        outcomeSourceCard?: string, outcomeStage?: string, outcomeKinds?: Array<string>,
        arrivalPending?: boolean, owedStep?: boolean, wfType?: string,
        stack?: Array<{kind: string, phase: string}>, liveReveals?: Array<string>,
      } | null;
      return `${s.t}ms dec:${s.decision ? 1 : 0}${s.decline ? 'D' : ''}${s.focusedRow ? 'F' : ''} ` +
        `pick:${s.picking ? 1 : 0} rev:${s.revealEmbedded ? 1 : 0} ` +
        (d === null ? 'nodiag' :
          `src:${d.outcomeSourceCard || '-'} st:${d.outcomeStage} k:${(d.outcomeKinds ?? []).join('+') || '-'} ` +
          `arr:${d.arrivalPending ? 1 : 0} owed:${d.owedStep ? 1 : 0} wf:${d.wfType} ` +
          `stack:${(d.stack ?? []).map((f) => `${f.kind}/${f.phase}`).join(',')} rv:${(d.liveReveals ?? []).join(';')}`);
    });
    console.log(`[no-draw lock samples]\n${compact.join('\n')}`);
    console.log(`[no-draw reaction] press ${reaction.presses}, ${reaction.ms} ms after the first (page clock)`);

    expectAnsweredFirstPress(reaction);
  });

  test('the second decision answers its FIRST press', async ({page, request}) => {
    await bootWithHand(page, request, [OLYMPUS, MARS_UNIVERSITY, ...FILLER]);

    // Play 1: Olympus alone — seeds its own resource silently, no decision.
    await playFromHand(page, OLYMPUS);
    await expect(page.locator('.con-hand__frame')).toHaveCount(0, {timeout: 60_000});
    await settle(page);

    // The lock's holder, recorded from here to the end.
    await armDiagWitness(page);

    // Play 2: Mars University — Olympus asks first, then the university. Since
    // TR51 Olympus's question is a row of the composer, answered there with
    // «снять жетон и взять карту» (the first option, the default the reporter
    // would have pressed) — and because that answer DRAWS before the
    // university asks, the university's question is handed on: a LIVE decision
    // after the drawn card (`reaction.afterDraw`).
    await playFromHand(page, MARS_UNIVERSITY, {[OLYMPUS]: 'first'});

    // Drive the middle of the chain: take any embedded drawn card; stop the
    // moment the SECOND question (Mars University — its album, the decline
    // named in its question line) stands. Deliberately no presses on it here —
    // its first press is the measurement.
    //
    // A TAKE IS ACT → VERIFY (`takeRevealCard`: a press only on a reveal that TAKES — `data-take="ready"` — and never
    // a retry once it has landed). The blind `press(Enter)` here waited for quiet BEFORE its key, so on a starved CI
    // renderer the last take finished, the university's album rose in that window and the key landed IN it — the very
    // question this test exists to measure, answered by the driver (CI 2026-11-01: «the second question never reached
    // the screen», 55 s).
    const secondUp = await driveToAlbum(page);
    expect(secondUp, 'the second question (Mars University) reached the screen').toBeTruthy();
    await cinematicBeat(page, 800, 'the album settles before the measured press');

    // ── THE MEASUREMENT ──────────────────────────────────────────────────
    // Press A once per second and see which press the album REACTS to: A on
    // the focused candidate discards it — the answer goes out, the album leaves.
    const reaction = await firstPressReaction(page);

    // Dump the sampler regardless of the verdict — the lock's holder is in it.
    const samples = await diagRecord(page);
    const compact = samples.map((s) => {
      const d = s.diag as {
        outcomeSourceCard?: string, outcomeStage?: string, outcomeKinds?: Array<string>,
        arrivalPending?: boolean, owedStep?: boolean, wfType?: string,
        stack?: Array<{kind: string, phase: string}>, liveReveals?: Array<string>,
        releaseStack?: string,
      } | null;
      return `${s.t}ms dec:${s.decision ? 1 : 0}${s.decline ? 'D' : ''}${s.focusedRow ? 'F' : ''} ` +
        `pick:${s.picking ? 1 : 0} rev:${s.revealEmbedded ? 1 : 0} ` +
        (d === null ? 'nodiag' :
          `src:${d.outcomeSourceCard || '-'} st:${d.outcomeStage} k:${(d.outcomeKinds ?? []).join('+') || '-'} ` +
          `arr:${d.arrivalPending ? 1 : 0} owed:${d.owedStep ? 1 : 0} wf:${d.wfType} ` +
          `stack:${(d.stack ?? []).map((f) => `${f.kind}/${f.phase}`).join(',')} rv:${(d.liveReveals ?? []).join(';')}`);
    });
    console.log(`[lock samples]\n${compact.join('\n')}`);
    console.log(`[reaction] press ${reaction.presses}, ${reaction.ms} ms after the first (page clock)`);

    expectAnsweredFirstPress(reaction);
  });
});
