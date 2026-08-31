import {test, expect, Page, APIRequestContext} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootSeededGame, bootWithCards, openCardActions, press, soloGameConfig} from './consoleStart';
import {
  LAUNCHPAD, TRADE_CORP, cardTradeConfig, focusTradeVariantTile, playLaunchpad,
} from './cardTradeDoor';

/**
 * PAST THE COMMIT THE COLONY STAGE IS A RECEIPT, AND ITS BEATS TAKE TURNS.
 *
 * Two faults lived in the window between «A Подтвердить» and the workspace
 * leaving, and both are ORDER faults rather than paint ones:
 *
 *  1 · THE CONFIGURATION RE-LIT. The stage pinned only `{mode, available,
 *      payment}` and re-derived the rest from LIVE props, on the assumption
 *      «past the commit the server takes the options away». That holds for the
 *      «Колонии» door and is false for every other one — a card-action trade is
 *      answered while the player still owns the action, so the very next
 *      response offers the NEXT trade. Three live payment rows and a fresh
 *      «ИТОГ ТОРГОВЛИ» then stood over a marker still gliding home.
 *  2 · THE BEATS CROSS-FADED. The presented host card began its 280 ms leave in
 *      the same flush the working area began its 280 ms return, and the closing
 *      glide launched into that overlap — «карта продолжает висеть посреди
 *      экрана в момент анимации трека».
 *
 * Both are stated here as invariants over a CONTINUOUS in-page sample of the
 * post-commit window, because that is what they are: a claim about every frame
 * between the press and the conclusion, not about one screenshot.
 *
 * ⚠️ `MutationObserver` + `setInterval`, never `requestAnimationFrame` —
 * headless Chromium drives rAF off the compositor and stops it exactly when the
 * screen goes quiet. The sampler's own count is asserted, so a dead probe can
 * never pass as «nothing went wrong».
 */

const OUT = path.resolve('screenshots', 'colony-trade-receipt');
/**
 * ⚠️ THE DEAL IS NOT REPRODUCIBLE — `seed` in a create-game config is ignored,
 * and a solo game deals a SUBSET of the offered colonies. So the spec names a
 * pool of pure-RESOURCE colonies (chips + the closing glide, no card payout to
 * complicate the window) and trades with whichever one it is actually given.
 */
const POOL = ['Ceres', 'Luna', 'Europa', 'Triton', 'Io'];

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

async function key(page: Page, code: string, settleMs = 450): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settleMs);
}

async function createGame(request: APIRequestContext): Promise<string> {
  const created = await request.post('/api/creategame', {
    data: soloGameConfig({
      players: [{name: 'Receipt', color: 'red', beginner: false, handicap: 0, first: true}],
      expansions: {colonies: true},
      customColoniesList: POOL,
    }),
  });
  expect(created.ok(), `create-game failed: ${created.status()} ${await created.text()}`).toBeTruthy();
  const model = await created.json() as {players: Array<{id: string, name: string}>};
  return (model.players.find((p) => p.name === 'Receipt') ?? model.players[0]).id;
}

type Sample = {
  at: number,
  /** Payment rows the stage OFFERS (the receipt row included). */
  payRows: number,
  /** Refused paths ('✕ …' rows) — a menu the committed move cannot use. */
  offRows: number,
  /** The stage's working area is painting. */
  mainLit: boolean,
  /** The presented host card is painting (opacity > 0). */
  cardLit: boolean,
  /** The white track marker proxy is in flight. */
  markerUp: boolean,
  /** The stage is PAST ITS OWN COMMIT (its own `--resolving` pose). */
  resolving: boolean,
  /** The colony focus stage is mounted at all. */
  stageUp: boolean,
};

/** Arm the post-commit sampler IN the page (see the header). */
async function armReceiptProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as Record<string, unknown>;
    const samples: Array<Sample> = [];
    (w as Record<string, unknown>).__receipt = samples;
    const t0 = performance.now();
    const lit = (sel: string): boolean => {
      const el = document.querySelector(sel);
      if (el === null) {
        return false;
      }
      return Number(getComputedStyle(el).opacity) > 0.02;
    };
    const scan = () => {
      samples.push({
        at: Math.round(performance.now() - t0),
        payRows: document.querySelectorAll('.con-colfocus__payrow').length,
        offRows: document.querySelectorAll('.con-colfocus__payrow--off').length,
        mainLit: lit('.con-colfocus__main'),
        cardLit: lit('.con-colfocus__cardland'),
        markerUp: document.querySelector('.con-coltrade-marker') !== null,
        resolving: document.querySelector('.con-colfocus--resolving') !== null,
        stageUp: document.querySelector('.con-colfocus') !== null,
      });
    };
    const obs = new MutationObserver(scan);
    obs.observe(document.body, {childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style']});
    (w as Record<string, unknown>).__receiptObs = obs;
    (w as Record<string, unknown>).__receiptTimer = window.setInterval(scan, 40);
    scan();
  });
}

async function readReceiptProbe(page: Page): Promise<Array<Sample>> {
  return page.evaluate(() => {
    const w = window as unknown as Record<string, unknown>;
    (w.__receiptObs as MutationObserver | undefined)?.disconnect();
    window.clearInterval(w.__receiptTimer as number);
    return w.__receipt as Array<Sample>;
  });
}

/**
 * THE POST-COMMIT WINDOW: from the first frame the stage wears its own
 * `--resolving` pose to the frame it leaves the screen.
 *
 * ⚠️ NOT «every `--resolving` sample». The pin is released on that pose's
 * FALLING edge while the stage is still mounted for the conclusion's own beat,
 * so a window defined by the pose alone would look away exactly where a re-lit
 * list would flash. The probe is armed a beat BEFORE the press (the cover
 * flight starts on the very next frames), so the leading samples are honest
 * pre-commit configuration and are dropped.
 */
function postCommit(samples: Array<Sample>): Array<Sample> {
  const start = samples.findIndex((s) => s.resolving);
  return start < 0 ? [] : samples.slice(start).filter((s) => s.stageUp);
}

/** Open «Колонии» through the quick wheel; the section focuses a tile itself. */
async function openColonies(page: Page): Promise<void> {
  const colonies = page.locator('.con-colonies');
  for (let i = 0; i < 4 && await colonies.count() === 0; i++) {
    await key(page, 'Period', 1100); // RT — the action-categories wheel
    await key(page, 'ArrowRight', 1300); // «Торговля»
  }
  expect(await colonies.count(), 'the colonies section did not open').toBeGreaterThan(0);
  expect(await page.locator('.con-coltile--focused').count(), 'a colony tile is focused').toBeGreaterThan(0);
}

test('the committed trade presents a RECEIPT, and its closing beats take turns', async ({page, request}) => {
  test.setTimeout(240_000);
  const playerId = await createGame(request);
  await bootSeededGame(page, request, playerId, {buy: 2});
  await page.waitForTimeout(1200);

  await openColonies(page);
  await key(page, 'Enter', 1400); // A → the colony focus stage
  const stage = page.locator('.con-colfocus');
  expect(await stage.count(), 'the colony focus stage did not open').toBeGreaterThan(0);
  await shoot(page, 'configure');

  // PRE-COMMIT the stage is a FORM: the payment paths are a real list.
  const rowsBefore = await page.locator('.con-colfocus__payrow').count();
  expect(rowsBefore, 'the configuration offers its payment paths').toBeGreaterThan(1);

  await armReceiptProbe(page);
  await key(page, 'KeyX', 200); // X = confirm
  // The whole post-commit window: fleet → chips → the closing glide → conclude.
  await page.waitForTimeout(14_000);
  await shoot(page, 'after');
  const samples = await readReceiptProbe(page);

  expect(samples.length, 'the in-page sampler ran').toBeGreaterThan(20);
  const after = postCommit(samples);
  expect(after.length, `the commit window was observed (${samples.length} samples)`).toBeGreaterThan(10);

  // ── 1 · THE RECEIPT. From the commit on, the stage never offers a LIST
  //        again: at most the one locked row that names what was chosen, and
  //        never a refused path. (Samples with the stage gone report 0.)
  const relit = after.filter((s) => s.payRows > 1 || s.offRows > 0);
  expect(relit.slice(0, 6),
    `the configuration must not re-light past the commit (${after.length} post-commit samples)`).toEqual([]);
  // …and the claim is not vacuous: the stage DOES keep showing the chosen path
  // («была ли вообще панель?» — a blank zone would satisfy the line above).
  expect(after.some((s) => s.payRows === 1),
    'the chosen path stands as the receipt').toBeTruthy();

  // ── 2 · THE BEATS TAKE TURNS. The presented host card and the working area
  //        are never both painting, and the marker never glides over a standing
  //        card.
  const overlap = after.filter((s) => s.cardLit && s.mainLit);
  expect(overlap.slice(0, 6), 'the card and the working area never paint together').toEqual([]);
  const gliding = after.filter((s) => s.markerUp);
  const badGlide = gliding.filter((s) => s.cardLit);
  expect(badGlide.slice(0, 6),
    `the closing glide never runs under the presented card (${gliding.length} gliding samples)`).toEqual([]);
});

/**
 * …AND THE SECOND DOOR IS WHERE IT ACTUALLY BROKE.
 *
 * Through «Колонии» the server withdraws the trade options at the commit, so
 * the stage's old assumption («past the commit there is nothing to re-derive»)
 * happened to hold. A CARD-ACTION trade is answered while the player still owns
 * the action, so the very next response offers the NEXT trade — a fresh
 * `OrOptions`, a fresh preview, the spent card now carrying «уже использовано в
 * этом поколении». That is the screenshot the rework started from: three live
 * payment rows and a refused fourth, standing over a marker still gliding home.
 */
test('the CARD door commits into a receipt too — the next trade never re-lights it', async ({page, request}) => {
  test.setTimeout(420_000);
  await bootWithCards(page, request, {
    config: cardTradeConfig(),
    cards: [LAUNCHPAD],
    corporation: TRADE_CORP,
  });
  await playLaunchpad(page);

  await openCardActions(page);
  await focusTradeVariantTile(page);
  await press(page, 'Enter', 2000); // → the action's setup stage
  await press(page, 'Enter', 2200); // → the colony grid, inside the workspace
  await press(page, 'Enter', 2600); // → the colony's focus stage, fee pinned
  const stage = page.locator('.con-colfocus');
  expect(await stage.count(), 'the hosted colony focus stage opened').toBeGreaterThan(0);
  await shoot(page, 'card-door-configure');

  // PRE-COMMIT the fee is FIXED by the entry, so the list is a single locked
  // row — the other paths are unreachable, not merely unpicked.
  expect(await page.locator('.con-colfocus__payrow').count(),
    'the entry pins exactly one payment path').toBeLessThanOrEqual(1);

  await armReceiptProbe(page);
  await press(page, 'KeyX', 200); // X = confirm
  await page.waitForTimeout(14_000);
  await shoot(page, 'card-door-after');
  const samples = await readReceiptProbe(page);
  const after = postCommit(samples);
  expect(after.length, `the commit window was observed (${samples.length} samples)`).toBeGreaterThan(10);

  const relit = after.filter((s) => s.payRows > 1 || s.offRows > 0);
  expect(relit.slice(0, 6),
    `the NEXT trade's options must never re-light this one (${after.length} post-commit samples)`).toEqual([]);
  expect(after.some((s) => s.payRows === 1),
    'the chosen path stands as the receipt').toBeTruthy();
  const badGlide = after.filter((s) => s.markerUp && s.cardLit);
  expect(badGlide.slice(0, 6), 'the closing glide never runs under the presented card').toEqual([]);
});
