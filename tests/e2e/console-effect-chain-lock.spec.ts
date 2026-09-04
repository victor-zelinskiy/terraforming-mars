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
 * branch (the direct choice → choice hand-off, the broken one). The spec
 * MEASURES the second decision's reaction to its first press, while an
 * in-page sampler (setInterval — never rAF, headless Chromium parks rAF on a
 * quiet screen) records the workspace-outcome / stack state every 250 ms so
 * a reproduced lock names its holder.
 */
import {expect, test, APIRequestContext, Page} from '@playwright/test';
import {bootIntoGame, press, soloGameConfig} from './consoleStart';

const OLYMPUS = 'Olympus Conference';
const MARS_UNIVERSITY = 'Mars University';
const FILLER = ['Acquired Company', 'Rover Construction', 'Investment Loan'];

async function bootWithHand(page: Page, request: APIRequestContext, cards: ReadonlyArray<string>): Promise<void> {
  await bootIntoGame(page, request, {
    config: soloGameConfig({customProjectCards: [...cards]}),
    cards: [...cards],
  });
}

/** Same walk as console-effect-decision-embed.spec.ts — the ordinary road. */
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

type DiagSample = {
  t: number,
  decision: boolean,
  decline: boolean,
  focusedRow: boolean,
  picking: boolean,
  revealEmbedded: boolean,
  diag: unknown,
};

test.describe('two triggered effects in a row', () => {
  test.setTimeout(300_000);

  /**
   * VARIANT B — the reported shape: prompt 1 is answered with «добавить
   * жетон» (option 1 — NO draw), so the SECOND decision arrives in the very
   * next response with no reveal in between. The decision component then has
   * no reason to unmount between the two prompts — the case where any local
   * per-prompt state (submitting, armed) that is not reset survives into the
   * second decision.
   */
  test('choice → choice with NO draw between: the second decision answers its FIRST press', async ({page, request}) => {
    await bootWithHand(page, request, [OLYMPUS, MARS_UNIVERSITY, ...FILLER]);

    await playFromHand(page, OLYMPUS);
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
          decline: document.querySelector('.con-decision__action--decline') !== null,
          focusedRow: document.querySelector('.con-decision__action--focused') !== null,
          picking: document.querySelector('.con-hand[data-flow="picking"]') !== null,
          revealEmbedded: document.querySelector('.con-hand__outcome .con-reveal') !== null,
          diag: diagFn === undefined ? null : diagFn(),
        });
      }, 250);
    });

    await playFromHand(page, MARS_UNIVERSITY);

    // Prompt 1 — Olympus (no decline row).
    await expect(page.locator('.con-decision')).toBeVisible({timeout: 60_000});
    await expect(page.locator('.con-decision__action--focused')).toBeVisible({timeout: 20_000});
    await page.waitForTimeout(1200);

    // Walk DOWN to option 1 («добавить жетон» — no draw) and answer.
    await press(page, 'ArrowDown', 400);
    await page.keyboard.press('Enter');

    // Prompt 2 — the Mars University decision (it has a decline row). No
    // reveal stands between the two here.
    let secondUp = false;
    for (let i = 0; i < 120 && !secondUp; i++) {
      const s = await page.evaluate(() => ({
        decline: document.querySelector('.con-decision__action--decline') !== null,
        focusedRow: document.querySelector('.con-decision__action--focused') !== null,
      }));
      if (s.decline && s.focusedRow) {
        secondUp = true;
        break;
      }
      await page.waitForTimeout(300);
    }
    expect(secondUp, 'the second decision (Mars University) reached the screen').toBeTruthy();

    const t0 = Date.now();
    let reactedAt = -1;
    for (let i = 0; i < 35; i++) {
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
      const reacted = await page.evaluate(() =>
        document.querySelector('.con-hand[data-flow="picking"]') !== null ||
        document.querySelector('.con-decision') === null);
      if (reacted) {
        reactedAt = Date.now() - t0;
        break;
      }
    }

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

    expect(reactedAt, 'the second decision never reacted at all').toBeGreaterThanOrEqual(0);
    expect(reactedAt, 'the visible «Сбросить карту» must answer its first press (≤4s), not a 20 s lock')
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
          decline: document.querySelector('.con-decision__action--decline') !== null,
          focusedRow: document.querySelector('.con-decision__action--focused') !== null,
          picking: document.querySelector('.con-hand[data-flow="picking"]') !== null,
          revealEmbedded: document.querySelector('.con-hand__outcome .con-reveal') !== null,
          diag: diagFn === undefined ? null : diagFn(),
        });
      }, 250);
    });

    // Play 2: Mars University — Olympus asks first, then the university.
    await playFromHand(page, MARS_UNIVERSITY);

    // Prompt 1 — the Olympus decision (no decline row: two real branches).
    const decision = page.locator('.con-decision');
    await expect(decision).toBeVisible({timeout: 60_000});
    await expect(page.locator('.con-decision__action--focused')).toBeVisible({timeout: 20_000});
    await page.waitForTimeout(1200);

    // Answer with the FOCUSED row (index 0 — «снять жетон и взять карту», the
    // default the reporter would have pressed).
    await page.keyboard.press('Enter');

    // Drive the middle of the chain: take any embedded drawn card; stop the
    // moment the SECOND decision (it has a decline row) is up with a focused
    // row. Deliberately no presses on the decision here — its first press is
    // the measurement.
    let secondUp = false;
    for (let i = 0; i < 120 && !secondUp; i++) {
      const s = await page.evaluate(() => ({
        revealEmbedded: document.querySelector('.con-hand__outcome .con-reveal') !== null,
        decline: document.querySelector('.con-decision__action--decline') !== null,
        focusedRow: document.querySelector('.con-decision__action--focused') !== null,
      }));
      if (s.decline && s.focusedRow) {
        secondUp = true;
        break;
      }
      if (s.revealEmbedded) {
        await press(page, 'Enter', 700);
      } else {
        await page.waitForTimeout(300);
      }
    }
    expect(secondUp, 'the second decision (Mars University) reached the screen').toBeTruthy();

    // ── THE MEASUREMENT ──────────────────────────────────────────────────
    // Press A once per second and time how long until the surface REACTS:
    // the focused row is «Сбросить карту» (a handPick), so the reaction is
    // the hand switching to picking mode — or the decision resolving.
    const t0 = Date.now();
    let reactedAt = -1;
    for (let i = 0; i < 35; i++) {
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
      const reacted = await page.evaluate(() =>
        document.querySelector('.con-hand[data-flow="picking"]') !== null ||
        document.querySelector('.con-decision') === null);
      if (reacted) {
        reactedAt = Date.now() - t0;
        break;
      }
    }

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

    expect(reactedAt, 'the second decision never reacted at all').toBeGreaterThanOrEqual(0);
    expect(reactedAt, 'the visible «Сбросить карту» must answer its first press (≤4s), not a 20 s lock')
      .toBeLessThan(4000);
  });
});
