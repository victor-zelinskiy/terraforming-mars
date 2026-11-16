import {test, expect, Page} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootWithCards, composerLoaded, openActionFocus, openCardActions, playCardFromHand, press, pressUntil, settle, soloGameConfig, waitForTurn} from './consoleStart';
import {armWitness} from './witness';

/**
 * Console VIRON REPEAT · a copied DRAW presents INSIDE the workspace.
 *
 * THE BUG THIS GUARDS (reported 2026-09-05). Viron copies a drawing action
 * («Центр ИИ» in the report; Development Center here — the clean plain-draw
 * archetype the receive spec already drives) and the drawn card opened as the
 * STANDALONE full-bleed reveal over the open ДЕЙСТВИЯ КАРТ workspace. Root
 * cause: the direct-path outcome claim in `onComposerConfirm` was gated
 * `payload.repeat === undefined`, so the final Viron submit armed NO claim —
 * and the adoption net deliberately excludes the `card-actions` host, so
 * nothing rescued the batch. The claim must be derived from the CHOSEN card's
 * own branch preview (scope 'chain' — the server attributes the copied
 * effects to the card that RAN), which is what the hydro stage-7 copy and the
 * Project Inspection play already do.
 *
 * The unit half is pinned in `consoleRepeatPickFrame.spec.ts` («the source's
 * final submit (Viron)»); this spec proves the whole chain at the real
 * surface: final submit → the workspace's own pending stage → the batch lands
 * EMBEDDED (`[data-embed-slot="workspace-reveal"] .con-reveal--embedded`) —
 * and the standalone band NEVER mounts, not even for a frame (a RECORDING armed
 * before the press — `armWitness`; a dead recorder fails on its own sample count).
 */

const OUT_DIR = path.resolve('screenshots', 'console-viron-repeat-draw');

const GAME_CONFIG = soloGameConfig({
  players: [{name: 'VironDraw', color: 'red', beginner: false, handicap: 0, first: true}],
  expansions: {venus: true},
  customCorporationsList: ['Viron'],
  seed: 0.23,
});

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_DIR, {recursive: true});
  await page.screenshot({path: path.join(OUT_DIR, `${name}.png`)});
}

/** The inspector names the FOCUSED tile's source card in English. */
async function focusedSource(page: Page): Promise<string> {
  return page.locator('.con-cardactions .con-cardactions__detail-cardwrap').first()
    .getAttribute('data-zoom-slot').then((v) => v ?? '').catch(() => '');
}

async function walkToSource(page: Page, card: string, steps = 12): Promise<boolean> {
  for (let i = 0; i < steps; i++) {
    if (await focusedSource(page) === card) {
      return true;
    }
    await press(page, 'ArrowDown', 350);
  }
  return await focusedSource(page) === card;
}

/** Take the (single) card out of the embedded receive stage and let the
 *  workspace conclude. The take is one press; a press dropped on a heavy
 *  frame is re-tried — safe by construction, the reveal absorbs verbs while
 *  the take is in flight. */
async function takeEmbeddedCard(page: Page): Promise<void> {
  await expect(page.locator('[data-embed-slot="workspace-reveal"] .con-cards__slot--focused'))
    .toHaveCount(1, {timeout: 15_000});
  const workspace = page.locator('.con-cardactions');
  await pressUntil(page, 'Enter', async () => await workspace.count() === 0, {tries: 4, settleMs: 8000});
  await expect(workspace, 'the taken outcome concludes the workspace').toHaveCount(0, {timeout: 10_000});
}

test.describe('console viron repeat draw', () => {
  test.use({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1, screen: {width: 1920, height: 1080}});

  test('the copied draw lands EMBEDDED — the standalone band never mounts', async ({page, request}) => {
    test.setTimeout(600_000);

    await bootWithCards(page, request, {
      cards: ['Development Center'],
      corporation: 'Viron',
      config: GAME_CONFIG,
      step: 0.017,
    });
    await waitForTurn(page);
    await settle(page, {timeoutMs: 30_000});

    expect(await playCardFromHand(page, 'Development Center'), 'Development Center played').toBe(true);

    // ── Use Development Center directly, so Viron has a candidate to copy.
    //    (This is the receive spec's own flow — SETUP here, not the subject.) ──
    await openCardActions(page);
    expect(await walkToSource(page, 'Development Center'), 'focus Development Center').toBe(true);
    await openActionFocus(page);
    await press(page, 'Enter', 2000); // confirm — single branch, no decisions
    await takeEmbeddedCard(page);
    await settle(page, {timeoutMs: 30_000});

    // ── Viron's own action → the repeat pick → compose the copy. ──────────
    await waitForTurn(page);
    await openCardActions(page);
    expect(await walkToSource(page, 'Viron'), 'focus Viron').toBe(true);
    await openActionFocus(page);
    await press(page, 'Enter', 2500); // A on the repeat slot → the pick browser
    await expect(page.locator('.con-cardactions'), 'the repeat surface stands up').toHaveCount(2);
    await shoot(page, '01-repeat-pick');
    // A = «Выбрать» the (only) candidate — its composer opens inside the pick (the source's stays mounted, hidden):
    // the next A waits for THAT, never a blind second press (one press, verified — a retry would land on the CTA).
    expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-cardactions .con-composer').count() > 1, {tries: 1, settleMs: 5000}),
      'A on the candidate opens its composer in the pick').toBe(true);
    await press(page, 'Enter', 2500); // A = «Выбрать это действие» (its CTA)
    await expect(page.locator('.con-cardactions'), 'the pick resolved back to the source')
      .toHaveCount(1, {timeout: 10_000});
    // The source composer re-shows with the copy — its own readiness (the preview loaded), then the screen at rest.
    await composerLoaded(page);
    await settle(page);
    await shoot(page, '02-composed');

    // ── ARM THE STANDALONE-BAND RECORDING, then the FINAL submit. ─────────
    // RECORDED off the product's own writes (`armWitness`, `settled` — the state a task leaves: a teardown's
    // in-between is not a band on screen). The sample count is asserted, so a dead recorder fails instead of passing.
    const band = await armWitness(page, 'viron-standalone-band', () => document.querySelector('.con-reveal:not(.con-reveal--embedded)') !== null,
      {settled: true});

    // The final A submits from the composer — unless the cursor is still ON
    // the repeat slot, where A means «сменить» and re-opens the pick: close
    // it, step off the slot, and try again. Each A gets its whole window: the reveal stands, or the pick re-opened.
    const embedded = page.locator('[data-embed-slot="workspace-reveal"] .con-reveal--embedded');
    for (let tries = 0; tries < 4 && await embedded.count() === 0; tries++) {
      await pressUntil(page, 'Enter', async () => await embedded.count() > 0 || await page.locator('.con-cardactions').count() > 1,
        {tries: 1, settleMs: 1800});
      if (await page.locator('.con-cardactions').count() > 1) {
        await press(page, 'Escape', 1800); // the pick keeps the prior choice
        await press(page, 'ArrowDown', 500);
      }
    }

    // ── THE CLAIM: the copied draw presents INSIDE the workspace. ─────────
    await expect(embedded, 'the copied draw presents EMBEDDED in the workspace').toHaveCount(1, {timeout: 15_000});
    await expect.poll(() => page.locator('.con-cardactions').count(), {message: 'the workspace is still standing under its own outcome'}).toBeGreaterThan(0);
    await shoot(page, '03-embedded-draw');

    const recorded = await band.stop();
    const probe = {samples: recorded.length, standalone: recorded.filter((x) => x.v).length};
    // The recorder's liveness only (a dead recorder): it keeps distinct STATES, never frames.
    expect(probe.samples, 'the probe must actually have sampled').toBeGreaterThan(0);
    expect(probe.standalone,
      `the standalone reveal band mounted over the workspace (${probe.standalone} of ${probe.samples} states)`)
      .toBe(0);

    // ── …and the take concludes the flow, exactly like a direct draw. ─────
    await takeEmbeddedCard(page);
    await shoot(page, '04-concluded');
  });
});
