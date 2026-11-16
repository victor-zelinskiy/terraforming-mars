import {test, expect, Page} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootWithCards, cinematicBeat, openCardActions, openActionFocus, press, pressUntil, pressUntilGone, takeRevealCard} from './consoleStart';
import {
  LAUNCHPAD, TRADE_CORP, cardTradeConfig, playLaunchpad, focusTradeVariantTile,
} from './cardTradeDoor';
import {readSettled} from './settledRead';

/**
 * THE SUSPENDED SECOND-DOOR CHAIN — resume ≠ fresh-open.
 *
 * «Летающая платформа» → «Выбрать колонию» → Плутон → торговля → the payout →
 * the MANDATORY discard, then «B Свернуть». The parked flow is a three-frame
 * chain (`card-actions ⊃ colonies ⊃ hand`), and the contract under test is the
 * navigation-intent split:
 *
 *  · a WHEEL open of «Действия карт» while the chain is parked is a FRESH
 *    read-only browse — clean crumb (no Pluto, no card subject), no adopted
 *    claim, no colonies inside, activations blocked with the one honest
 *    reason — and closing it leaves the park untouched;
 *  · «A» on the board-home prompt card RESUMES the EXACT instance: the same
 *    workspace root, the same origin card in the crumb, the same colony, the
 *    same discard phase with the hand grid standing EMBEDDED at full depth —
 *    never the blue-actions browse under the parked flow's breadcrumb (the
 *    shipped «ДЕЙСТВИЯ КАРТ › ПЛУТОН › ПЛУТОН · СБРОС КАРТЫ» half-restore),
 *    and never a second workspace root;
 *  · the cycle survives repetition (park → look → close → resume), and the
 *    flow then completes normally.
 *
 * The PLAIN-chain twin of this spec is `console-colony-pluto-embed.spec.ts`'s
 * parked leg; the door's own pre-commit contract is
 * `console-card-trade-entry.spec.ts`.
 */

const OUT = path.resolve('screenshots', 'card-trade-resume');

/** Pluto plus three resource colonies: the solo setup removal can take one and
 *  Pluto still survives into the action phase (`keepColony`). */
const CFG = cardTradeConfig({
  customColoniesList: ['Pluto', 'Luna', 'Triton', 'Callisto'],
});

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

/** The card-actions header crumb, read as the player does. */
async function crumb(page: Page): Promise<{subject: string, stage: string, overlap: boolean}> {
  return page.evaluate(() => {
    const head = document.querySelector('.con-cardactions__head');
    const text = (sel: string): string =>
      (head?.querySelector(sel) as HTMLElement | null)?.innerText.replace(/\s+/g, ' ').trim() ?? '';
    const root = head?.querySelector('.con-wshead__root')?.getBoundingClientRect();
    const subj = head?.querySelector('.con-wshead__subject')?.getBoundingClientRect();
    return {
      subject: text('.con-wshead__subject'),
      stage: text('.con-wshead__step'),
      // The subject painting over the root's letters — the shrunk-identity
      // overflow a full line (fleet dock + chips) once produced on 1280.
      overlap: root !== undefined && subj !== undefined && subj.width > 0 && subj.left < root.right - 1,
    };
  });
}

/**
 * The crumb AT REST (FLAKE ZERO — `readSettled`: the same reading on two frames in a row). Never after a `settle`: the
 * chain stands inside Pluto's draw → discard, where the discard's `[blocking]` hold legitimately stands until the
 * answer (tests.md — inside a chain, quiet is the wrong predicate).
 */
async function settledCrumb(page: Page, what: string): Promise<{subject: string, stage: string, overlap: boolean}> {
  return readSettled(page, () => crumb(page), {settle: false, message: what});
}

/** Walk the (already open) colony grid until Pluto is the focused tile. */
async function focusPluto(page: Page): Promise<void> {
  const focused = page.locator('.con-coltile--focused[data-test="con-colony-Pluto"]');
  await pressUntil(page, 'ArrowRight', async () => await focused.count() > 0, {tries: 10, settleMs: 380});
  for (let i = 0; i < 4 && await focused.count() === 0; i++) {
    await press(page, 'ArrowDown', 380);
    for (let j = 0; j < 5 && await focused.count() === 0; j++) {
      await press(page, 'ArrowLeft', 320);
    }
  }
  await expect.poll(() => focused.count(), {message: 'could not focus Pluto in the hosted colony grid'}).toBeGreaterThan(0);
}

/**
 * BUILD a colony on Pluto (the standard project), so the later trade owes the
 * OWNER-BONUS cycle — Pluto's «draw 1, then the MANDATORY discard 1» — which
 * is the suspended phase under test. The condensed test-3 route of
 * `console-colony-pluto-embed.spec.ts`.
 */
async function buildOnPluto(page: Page): Promise<void> {
  // Every press verified by the surface it opens (the twin route of `console-colony-pluto-embed`).
  await press(page, 'Comma', 1200);
  await pressUntil(page, 'Enter', async () => await page.locator('.con-stdp').count() > 0, {tries: 1, settleMs: 1400});
  await expect.poll(() => page.locator('.con-stdp').count(), {message: 'standard projects did not open'}).toBeGreaterThan(0);
  const focusedName = async () => (await page.locator('.con-stdp__card--focused .con-stdp__name').textContent().catch(() => '')) ?? '';
  const walk = ['ArrowDown', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp'];
  for (let i = 0; i < 18 && !/колони/i.test(await focusedName()); i++) {
    await press(page, walk[i % walk.length], 300);
  }
  expect(/колони/i.test(await focusedName()), 'could not focus the colony standard project').toBeTruthy();
  await pressUntil(page, 'Enter', async () => await page.locator('.con-colonies').count() > 0, {tries: 1, settleMs: 1800});
  await page.waitForSelector('.con-colonies', {timeout: 15_000});
  await focusPluto(page);
  // Descend — build intent; verified by the focus stage standing.
  await pressUntil(page, 'Enter', async () => await page.locator('.con-colfocus').count() > 0, {tries: 1, settleMs: 2000});
  // A = build confirm — verified by the build's own draw standing (or the stage letting go).
  await pressUntil(page, 'Enter', async () => await page.locator('.con-reveal').count() > 0 ||
    await page.locator('.con-colfocus').count() === 0, {tries: 1, settleMs: 2600});
  // Collect the build's two bonus cards (A per focused card — each take act → verify on the reveal's own take state).
  await page.locator('.con-reveal').first().waitFor({timeout: 15_000}).catch(() => undefined);
  for (let i = 0; i < 4 && await page.locator('.con-reveal').count() > 0; i++) {
    if (!await takeRevealCard(page)) {
      break;
    }
  }
  // Pacing as the twin route paces it: never a `settle` here — a blocking hold legitimately stands until the next answer.
  await cinematicBeat(page, 2500, 'pacing INSIDE the mandatory chain — a blocking hold legitimately stands until the next answer');
}

/** The user-facing matrix (desktop + 4K TV) plus the handheld width, where a
 *  full header line (dock + chips) is tightest — the shrunk-identity overlap
 *  was only ever visible there. */
const RESUME_PROFILES = [
  {tag: 'deck', width: 1280, height: 800, query: ''},
  {tag: 'tv4k', width: 3840, height: 2160, query: '&consoleProfile=tv'},
] as const;

for (const profile of RESUME_PROFILES) {
  test.describe(`console — the suspended second-door chain · ${profile.tag}`, () => {
    test.use({
      viewport: {width: profile.width, height: profile.height},
      deviceScaleFactor: 1,
      screen: {width: profile.width, height: profile.height},
    });

    test('B parks the deep chain, the wheel opens a FRESH list, A resumes the exact discard', async ({page, request}) => {
      test.setTimeout(600_000);

      // ── 1 · The second door, all the way to the mandatory discard. ──────
      await bootWithCards(page, request, {
        config: CFG, cards: [LAUNCHPAD], corporation: TRADE_CORP, keepColony: 'Pluto',
        query: profile.query,
      });
      await playLaunchpad(page);
      await buildOnPluto(page);
      await openCardActions(page);
      await focusTradeVariantTile(page);
      await openActionFocus(page);
      await press(page, 'Enter', 2000); // «Выбрать колонию» → the hosted grid
      await expect.poll(() => page.locator('.con-cardactions .con-colonies').count(), {message: 'the colony step did not open inside the card-actions workspace'}).toBeGreaterThan(0);
      await focusPluto(page);
      await press(page, 'Enter', 2600); // the colony focus stage, fee pinned
      await expect.poll(() => page.locator('.con-colfocus').count(), {message: 'the trade stage did not open'}).toBeGreaterThan(0);
      await page.keyboard.press('KeyX'); // the trade's own confirm — the one commit
      await page.waitForSelector('.con-reveal .con-cards__slot--focused', {timeout: 30_000});
      await shoot(page, `${profile.tag}-01-payout`);

      // Work the table with A until the mandatory discard opens EMBEDDED.
      const embeddedHand = page.locator('.con-colonies .con-hand.con-hand--embedded');
      await pressUntil(page, 'Enter', async () => await embeddedHand.count() > 0, {tries: 14, settleMs: 2400});
      await expect(embeddedHand, 'the mandatory discard did not open embedded in the deep chain')
        .toBeVisible({timeout: 12_000});
      const atDiscard = await settledCrumb(page, 'the crumb at the discard');
      expect(atDiscard.subject.toUpperCase(), 'the origin card leads the crumb at the discard')
        .toContain('ЛЕТАЮЩАЯ');
      expect(atDiscard.overlap, 'the crumb subject painted over the workspace name').toBe(false);
      // The hand-open reveal has finished: the album's page strip goes LIVE once its open flight has landed
      // (`ConsoleHandSection` — armed after the first paint settles, held off while the transit stands).
      await page.locator('.con-colonies .con-hand--embedded .con-hand__pagestrip--live').first()
        .waitFor({state: 'visible', timeout: 20_000}).catch(() => undefined);
      await shoot(page, `${profile.tag}-02-discard-deep`);

      // ── 2 · «B Свернуть» — the whole chain parks; the board offers the card. ─
      await page.keyboard.press('Escape');
      await expect(page.locator('.con-cardactions'), 'the workspace did not park on collapse')
        .toHaveCount(0, {timeout: 8_000});
      await expect(page.locator('.con-mandatory'), 'no return card after the park')
        .toHaveCount(1, {timeout: 8_000});
      await shoot(page, `${profile.tag}-03-parked`);

      // ── 3 · TWO LOOK-AND-LEAVE CYCLES: the wheel's «Действия карт» is a FRESH
      //    instance every time — and closing it never touches the park. ────────
      for (let cycle = 0; cycle < 2; cycle++) {
        await openCardActions(page);
        const fresh = await settledCrumb(page, `cycle ${cycle}: the fresh crumb`);
        expect(fresh.subject, `cycle ${cycle}: a fresh open carries NO subject`).toBe('');
        expect(fresh.stage, `cycle ${cycle}: …and NO stage`).toBe('');
        await expect(page.locator('.con-cardactions__head'), `cycle ${cycle}: no Pluto context in a fresh open`)
          .not.toContainText(/ПЛУТОН/i);
        await expect.poll(() => page.locator('.con-cardactions .con-colonies').count(), {message: `cycle ${cycle}: the parked colonies never render under a fresh open`}).toBe(0);
        await expect.poll(() => page.locator('.con-composer--stage').count(), {message: `cycle ${cycle}: no adopted composer in a fresh open`}).toBe(0);
        const browse = page.locator('.con-cardactions__browse');
        await expect(browse, `cycle ${cycle}: the plain browse owns the fresh open`).toBeVisible();
        // The one honest reason, stated on the surface — when a tile is on screen
        // at all (this solo's only action card is the used launch-pad, which the
        // default «not activated» filter honestly hides into the empty state).
        if (await page.locator('.con-cardactions__tile').count() > 0) {
          await expect(page.locator('.con-cardactions'), `cycle ${cycle}: the blocked reason is stated`)
            .toContainText(/завершите|недоступно|не сейчас/i);
        }
        // A must NOT descend while the decision is owed (empty grid: A is inert).
        await press(page, 'Enter', 1200);
        await expect.poll(() => page.locator('.con-composer--stage').count(), {message: `cycle ${cycle}: A cannot start another action while one is owed`}).toBe(0);
        if (cycle === 0) {
          await shoot(page, `${profile.tag}-04-fresh-look`);
        }
        // B closes the LOOK — the park (and its return card) survives.
        await press(page, 'Escape', 1600);
        await expect(page.locator('.con-cardactions'), `cycle ${cycle}: the fresh look did not close`)
          .toHaveCount(0, {timeout: 6_000});
        await expect(page.locator('.con-mandatory'), `cycle ${cycle}: the return card must survive the look`)
          .toHaveCount(1, {timeout: 6_000});
      }

      // ── 4 · «A» on the prompt card — RESUME THE EXACT INSTANCE. ─────────────
      await press(page, 'Enter', 2600);
      await expect(embeddedHand, 'the discard did not come back embedded on resume')
        .toBeVisible({timeout: 12_000});
      await expect.poll(() => page.locator('.con-cardactions .con-colonies').count(), {message: 'the resumed colonies are not hosted by the card-actions root'}).toBeGreaterThan(0);
      const resumed = await settledCrumb(page, 'the resumed crumb');
      expect(resumed.subject.toUpperCase(), 'the resumed crumb keeps the origin card')
        .toContain('ЛЕТАЮЩАЯ');
      expect(resumed.subject.toUpperCase(), 'the subject is never the colony (the ПЛУТОН › ПЛУТОН dup)')
        .not.toContain('ПЛУТОН');
      expect(resumed.stage.toUpperCase(), 'the tail is the suspended phase').toMatch(/СБРОС/);
      expect(resumed.overlap, 'the resumed crumb painted over the workspace name').toBe(false);
      // One workspace root, no board-level band.
      await expect.poll(() => page.evaluate(() => Array.from(document.querySelectorAll('.con-ws'))
        .filter((el) => (el as HTMLElement).getClientRects().length > 0).length), {message: 'exactly one workspace root after the resume'}).toBe(1);
      await shoot(page, `${profile.tag}-05-resumed-discard`);

      // ── 5 · Complete: discard → the resolution finishes → the chain closes. ─
      // act → verify → retry. The resume REPLAYS the dock → grid reveal, and A
      // waits that episode out BY DESIGN (`handleSectionConfirm` swallows a
      // confirm under the flying proxies — the key bridge still reports it
      // «consumed»). At 4K the replay can still be in the air when the hand
      // first reads visible and the screenshot above is done, so ONE blind
      // press was swallowed about one run in four and the flow then waited
      // 25 s for a discard nobody had made (measured: a press at the resume's
      // first visible frame leaves the hand standing with no discard armed; the
      // next press arms it within ~0.1 s). The witness is the hand step leaving
      // (it pops once the answer is in); a repeat A while the discard is
      // already in flight is absorbed (`isCardDiscardActive`), so a retry can
      // never submit twice.
      const discarded = await pressUntilGone(page, 'Enter', '.con-colonies .con-hand.con-hand--embedded',
        {tries: 4, settleMs: 1600});
      expect(discarded, 'the discard press never took — the hand step still stands').toBe(true);
      // The discard flight + the track reset are waited out by the conclusion itself — the colonies leaving.
      await expect(page.locator('.con-colonies'), 'the resolution never concluded after the resume')
        .toHaveCount(0, {timeout: 25_000});
      await shoot(page, `${profile.tag}-06-concluded`);
    });
  });
}
