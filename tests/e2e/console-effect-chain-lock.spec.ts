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
 * MEASURES the second decision's reaction to its first press, while an
 * in-page sampler (setInterval — never rAF, headless Chromium parks rAF on a
 * quiet screen) records the workspace-outcome / stack state every 250 ms so
 * a reproduced lock names its holder.
 *
 * Since the DECLINE became a button (2026-10-13 — `optionalChoice.ts`) the
 * university's question IS its pick: the album opens directly, «Не сбрасывать»
 * is RT with its plate in the album's question line. The chain is the same
 * chain — a decision (or album) answered, the next one standing in the very
 * next response — and the measurement is the same: the second one answers its
 * FIRST press.
 */
import {expect, test, APIRequestContext, Page} from './consoleTest';
import {answerTableQuestions, bootIntoGame, cinematicBeat, press, settle, soloGameConfig, TableQuestionAnswer} from './consoleStart';

const OLYMPUS = 'Olympus Conference';
const MARS_UNIVERSITY = 'Mars University';
/** TWO science tags AND a draw of two: with the university on the table its question is asked TWICE, and both are
 *  honest follow-ups (the play draws before them — TR51, `HIDDEN_DRAW_NOTE`), so they arrive LIVE, one after another. */
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
  await settle(page);
  await answerTableQuestions(page, answers);
  await expect(page.locator('.con-composer__cta--ready')).toBeVisible({timeout: 20_000});
  await page.waitForTimeout(1000);
  await page.keyboard.press('Enter');
}

type DiagSample = {
  t: number,
  decision: boolean,
  decline: boolean,
  focusedRow: boolean,
  picking: boolean,
  revealEmbedded: boolean,
  diag: unknown,
};

/** The university's question stands as its ALBUM: the hand in pick mode, the RT decline named in its question line. */
async function albumAsks(page: Page): Promise<boolean> {
  return page.evaluate(() => document.querySelector('.con-hand__question [data-decline-plate]') !== null);
}

/** Press A once per second until the standing album REACTS (its answer is POSTed, or it leaves); ms, -1 = never. */
async function firstPressLatency(page: Page): Promise<number> {
  let posted = false;
  const onPost = (r: {method(): string, url(): string}) => {
    if (r.method() === 'POST' && /\/player\/input/.test(r.url())) {
      posted = true;
    }
  };
  page.on('request', onPost);
  const t0 = Date.now();
  let reactedAt = -1;
  for (let i = 0; i < 35 && reactedAt < 0; i++) {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
    const gone = await page.evaluate(() => document.querySelector('.con-hand__question [data-decline-plate]') === null);
    if (posted || gone) {
      reactedAt = Date.now() - t0;
    }
  }
  page.off('request', onPost);
  return reactedAt;
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
    await page.waitForTimeout(1500);

    await page.evaluate(() => {
      const w = window as unknown as Record<string, unknown>;
      const samples: Array<unknown> = [];
      w.__lockSamples = samples;
      const t0 = performance.now();
      w.__lockSamplerId = setInterval(() => {
        const diagFn = w.__conColonyDiag as (() => unknown) | undefined;
        samples.push({
          t: Math.round(performance.now() - t0),
          decision: document.querySelector('.con-decision') !== null,
          decline: document.querySelector('[data-decline-plate]') !== null,
          focusedRow: document.querySelector('.con-decision__action--focused') !== null,
          picking: document.querySelector('.con-hand[data-flow="picking"]') !== null,
          revealEmbedded: document.querySelector('.con-hand__outcome .con-reveal') !== null,
          diag: diagFn === undefined ? null : diagFn(),
        });
      }, 250);
    });

    await playFromHand(page, RESEARCH);

    // The play's own batch presents first (surfaces go in turn) — take it; prompt 1 follows, as its ALBUM.
    for (let i = 0; i < 120 && !await albumAsks(page); i++) {
      if (await page.locator('.con-hand__outcome .con-reveal').count() > 0) {
        await press(page, 'Period', 800);
      } else {
        await page.waitForTimeout(300);
      }
    }
    expect(await albumAsks(page), 'the university\'s first question stands as its album').toBe(true);
    await cinematicBeat(page, 1200, 'the first album settles before its answer');

    // RT — the decline (nothing drawn, nothing discarded); its response carries prompt 2.
    const answered = page.waitForResponse((r) => r.request().method() === 'POST' && /\/player\/input/.test(r.url()));
    await page.keyboard.press('Period');
    await answered;

    // Prompt 2 — the university's SECOND question, its album again. No reveal stands between the two here.
    let secondUp = false;
    for (let i = 0; i < 120 && !secondUp; i++) {
      secondUp = await albumAsks(page);
      if (!secondUp) {
        await page.waitForTimeout(300);
      }
    }
    expect(secondUp, 'the second question (the university\'s second) reached the screen').toBeTruthy();
    await cinematicBeat(page, 800, 'the second album settles before the measured press');

    const reactedAt = await firstPressLatency(page);

    const samples = await page.evaluate(() => {
      const w = window as unknown as Record<string, unknown>;
      clearInterval(w.__lockSamplerId as number);
      return w.__lockSamples as Array<unknown>;
    }) as Array<DiagSample>;
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
    console.log(`[no-draw reaction latency] ${reactedAt} ms`);

    expect(reactedAt, 'the second question never reacted at all').toBeGreaterThanOrEqual(0);
    expect(reactedAt, 'the visible album must answer its first press (≤4s), not a 20 s lock')
      .toBeLessThan(4000);
  });

  test('the second decision answers its FIRST press', async ({page, request}) => {
    await bootWithHand(page, request, [OLYMPUS, MARS_UNIVERSITY, ...FILLER]);

    // Play 1: Olympus alone — seeds its own resource silently, no decision.
    await playFromHand(page, OLYMPUS);
    await expect(page.locator('.con-hand__frame')).toHaveCount(0, {timeout: 60_000});
    await page.waitForTimeout(1500);

    // In-page sampler: state every 250 ms from here to the end.
    await page.evaluate(() => {
      const w = window as unknown as Record<string, unknown>;
      const samples: Array<unknown> = [];
      w.__lockSamples = samples;
      const t0 = performance.now();
      w.__lockSamplerId = setInterval(() => {
        const diagFn = w.__conColonyDiag as (() => unknown) | undefined;
        samples.push({
          t: Math.round(performance.now() - t0),
          decision: document.querySelector('.con-decision') !== null,
          decline: document.querySelector('[data-decline-plate]') !== null,
          focusedRow: document.querySelector('.con-decision__action--focused') !== null,
          picking: document.querySelector('.con-hand[data-flow="picking"]') !== null,
          revealEmbedded: document.querySelector('.con-hand__outcome .con-reveal') !== null,
          diag: diagFn === undefined ? null : diagFn(),
        });
      }, 250);
    });

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
    let secondUp = false;
    for (let i = 0; i < 120 && !secondUp; i++) {
      secondUp = await albumAsks(page);
      if (secondUp) {
        break;
      }
      if (await page.locator('.con-hand__outcome .con-reveal').count() > 0) {
        await press(page, 'Enter', 700);
      } else {
        await page.waitForTimeout(300);
      }
    }
    expect(secondUp, 'the second question (Mars University) reached the screen').toBeTruthy();
    await cinematicBeat(page, 800, 'the album settles before the measured press');

    // ── THE MEASUREMENT ──────────────────────────────────────────────────
    // Press A once per second and time how long until the album REACTS: A on
    // the focused candidate discards it — the answer is POSTed, the album leaves.
    const reactedAt = await firstPressLatency(page);

    // Dump the sampler regardless of the verdict — the lock's holder is in it.
    const samples = await page.evaluate(() => {
      const w = window as unknown as Record<string, unknown>;
      clearInterval(w.__lockSamplerId as number);
      return w.__lockSamples as Array<unknown>;
    }) as Array<DiagSample>;
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
    console.log(`[reaction latency] ${reactedAt} ms`);

    expect(reactedAt, 'the second question never reacted at all').toBeGreaterThanOrEqual(0);
    expect(reactedAt, 'the visible album must answer its first press (≤4s), not a 20 s lock')
      .toBeLessThan(4000);
  });
});
