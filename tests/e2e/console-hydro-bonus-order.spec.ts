/*
 * ONE PLACEMENT, TWO DEMANDS — AND ONLY EVER ONE OF THEM ON SCREEN.
 *
 * Placing an ocean on a card-draw hex while Dynamic Ocean Barrier is in play
 * makes the server produce TWO things in a single response: the hex's own draw
 * (`grantSpaceBonus` → `player.drawCard`, synchronous) and the card's bonus-move
 * offer (`BonusDeltaAdvance`, queued at BACK_OF_THE_LINE). The server is right
 * to ask immediately, so the ORDER the player experiences is the client's to
 * guarantee — and the guarantee is the door asking `admits('followUp')`, whose
 * policy waits out the whole arrival chain («processed» for a draw means every
 * card TAKEN).
 *
 * This watches that order in the real DOM. The claim is about the MIDDLE of the
 * episode, not its end state, so the probe is armed BEFORE the confirming press
 * and samples with a MutationObserver + setInterval — never `requestAnimationFrame`
 * (headless Chromium drives rAF off the compositor and stops sampling exactly
 * when the screen goes quiet, which is when this bug fires) and never a
 * `waitForTimeout` standing in for a state.
 *
 * The deterministic sibling — `tests/client/components/console/hydroBonusDoorOrder.spec.ts`
 * — proves the same order at the policy seam and names the exact missing block
 * when it regresses. This one proves the product really behaves that way.
 */
import {expect, test, Page, APIRequestContext} from '@playwright/test';

/** The card that grants the bonus move — and, conveniently, a BUILDING tag,
 *  which is exactly what track position 1 requires, so the offer is FREE. */
const BARRIER = 'Dynamic Ocean Barrier';
/** Cost 11, no requirement, `behavior: {ocean: {}}` — the whole play is the ocean. */
const OCEAN_CARD = 'Subterranean Reservoir';
/** Cost 23, no requirement, `ocean: {count: 2}` — the SECOND ocean source. */
const OCEAN_CARD_2 = 'Ice Asteroid';
const FILLER = ['Acquired Company'];

/** Tharsis y=1, last space: `ocean(DRAW_CARD, DRAW_CARD)` — two cards, so the
 *  reveal is unmistakable. `shuffleMapOption: false` keeps the printed layout. */
const DRAW_OCEAN_SPACE = '13';

function newGameConfig() {
  const expansions: Record<string, boolean> = {
    corpera: true, promo: false, venus: false, colonies: false,
    prelude: false, prelude2: false, turmoil: false, community: false,
    ares: false, moon: false, pathfinders: false, ceo: false,
    starwars: false, underworld: false, deltaProject: true,
  };
  return {
    players: [{name: 'HydroOrder', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions,
    board: 'tharsis',
    seed: 0.42,
    randomFirstPlayer: false,
    clonedGamedId: undefined,
    undoOption: false,
    showTimers: false,
    fastModeOption: false,
    showOtherPlayersVP: false,
    testMode: true,
    aresExtremeVariant: false,
    politicalAgendasExtension: 'Standard',
    solarPhaseOption: false,
    removeNegativeGlobalEventsOption: false,
    modularMA: false,
    draftVariant: false,
    initialDraft: false,
    preludeDraftVariant: false,
    ceosDraftVariant: false,
    startingCorporations: 1,
    shuffleMapOption: false,
    randomMA: 'No randomization',
    includeFanMA: false,
    soloTR: false,
    customCorporationsList: ['CrediCor'],
    bannedCards: [],
    includedCards: [],
    customColoniesList: [],
    customPreludes: [],
    customProjectCards: [BARRIER, OCEAN_CARD, OCEAN_CARD_2, ...FILLER],
    requiresMoonTrackCompletion: false,
    requiresVenusTrackCompletion: false,
    moonStandardProjectVariant: false,
    moonStandardProjectVariant1: false,
    altVenusBoard: false,
    escapeVelocity: undefined,
    twoCorpsVariant: false,
    customCeos: [],
    startingCeos: 3,
    startingPreludes: 4,
  };
}

async function key(page: Page, code: string, settleMs = 400): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settleMs);
}

/** Boot + drive the start wizard, buying the probe's cards into the hand. */
async function openAtBoard(page: Page, request: APIRequestContext): Promise<void> {
  const created = await request.post('/api/creategame', {data: newGameConfig()});
  expect(created.ok(), `create-game failed: ${created.status()}`).toBeTruthy();
  const model = await created.json() as {players: Array<{id: string}>};
  await page.goto(`/player?id=${model.players[0].id}&console=1`);
  await page.waitForSelector('.con-start__frame, .con-root', {timeout: 45_000});
  await page.waitForSelector('.boot-loader', {state: 'detached', timeout: 150_000}).catch(() => {});
  await page.waitForTimeout(3000);

  const buy = [BARRIER, OCEAN_CARD, OCEAN_CARD_2, ...FILLER];
  let lastFocused = '';
  let stalls = 0;
  for (let i = 0; i < 240 && await page.locator('.con-start__frame').count() > 0; i++) {
    const s = await page.evaluate(() => ({
      active: (document.querySelector('.con-jrail__item--current')?.textContent ?? '').toUpperCase(),
      focused: document.querySelector('.con-cards__slot--focused')?.getAttribute('data-zoom-slot') ?? '',
      picked: Array.from(document.querySelectorAll('.con-cards__slot--picked'))
        .filter((el) => (el as HTMLElement).offsetParent !== null)
        .map((el) => el.getAttribute('data-zoom-slot') ?? ''),
      ceremony: document.querySelector('.con-start--ceremony') !== null,
    }));
    if (s.ceremony) {
      break;
    }
    const walk = async () => {
      stalls = s.focused === lastFocused ? stalls + 1 : 0;
      await key(page, stalls >= 1 ? 'ArrowDown' : 'ArrowRight', 240);
      lastFocused = s.focused;
    };
    if (s.active.includes('КОРПОРАЦ')) {
      if (s.picked.includes('CrediCor')) {
        await key(page, 'Period', 1100);
      } else if (s.focused === 'CrediCor') {
        await key(page, 'Enter', 600);
      } else {
        await walk();
      }
      continue;
    }
    if (s.active.includes('ПРОЕКТ')) {
      const missing = buy.filter((c) => !s.picked.includes(c));
      if (missing.length === 0) {
        await key(page, 'Period', 1100);
      } else if (missing.includes(s.focused)) {
        await key(page, 'Enter', 420);
        lastFocused = '';
      } else {
        await walk();
      }
      continue;
    }
    await key(page, 'Enter', 1200);
  }
  for (let i = 0; i < 120 && await page.locator('.con-start').count() > 0; i++) {
    if (await page.locator('.con-start__slot-a').count() > 0) {
      await key(page, 'Enter', 700);
    } else {
      await page.waitForTimeout(300);
    }
  }
  await expect(page.locator('.con-start')).toHaveCount(0, {timeout: 60_000});
  await page.waitForTimeout(3500);
}

/**
 * Focus `card` in the hand ALBUM. The album is PAGED and its ring CLAMPS, so a
 * one-way walk parks against a wall and the caller then presses A on whatever it
 * was already sitting on — which is exactly how an earlier version of this probe
 * played the ocean card instead of the barrier (measured: twelve
 * `.board-space--available` cells where there should have been none). So: turn
 * around when a hop moves nothing, and turn the PAGE when a whole lane does.
 */
async function focusHandCard(page: Page, card: string): Promise<boolean> {
  let dir: 'ArrowRight' | 'ArrowLeft' = 'ArrowRight';
  let last = '';
  let stalls = 0;
  for (let i = 0; i < 80; i++) {
    const focused = await page.evaluate(() =>
      document.querySelector('.con-hand__slot--selected')?.getAttribute('data-zoom-slot') ?? '');
    if (focused === card) {
      return true;
    }
    if (focused === last) {
      stalls++;
      // A hop that moved nothing: reverse; a whole lane that moved nothing: page.
      if (stalls >= 3) {
        await key(page, 'KeyE', 260); // RB — next album page
        stalls = 0;
      } else {
        dir = dir === 'ArrowRight' ? 'ArrowLeft' : 'ArrowRight';
      }
    } else {
      stalls = 0;
    }
    last = focused;
    await key(page, dir, 200);
  }
  return false;
}

/** Play `card` from the hand workspace, VERIFYING it is the card that opened. */
async function playFromHand(page: Page, card: string): Promise<void> {
  for (let i = 0; i < 8 && await page.locator('.con-hand__frame').count() === 0; i++) {
    await key(page, 'Period', 800);
    await key(page, 'Enter', 1100);
  }
  await expect(page.locator('.con-hand__frame')).toBeVisible({timeout: 20_000});

  for (let attempt = 0; attempt < 3; attempt++) {
    expect(await focusHandCard(page, card), `never focused ${card} in the album`).toBeTruthy();
    await key(page, 'Enter', 1400); // open the play composer
    // ⭐ THE CARD THE COMPOSER OPENED IS THE ONLY THING THAT COUNTS. The album
    // focus can move under a re-sort between the read and the press.
    const subject = await page.evaluate(() =>
      document.querySelector('.con-wshead__subject')?.textContent?.trim() ?? '');
    if (subject !== '') {
      break;
    }
    await key(page, 'Escape', 700); // wrong card / nothing opened — back out
  }
  // Confirm through the composer / payment until the board or a prompt takes over.
  for (let i = 0; i < 12; i++) {
    if (await page.locator('.board-space--available').count() > 0) {
      return;
    }
    await key(page, 'Enter', 900);
  }
}

/** Home the board cursor at a reproducible corner (both axes clamp). */
async function homeCursor(page: Page): Promise<void> {
  for (let i = 0; i < 12; i++) {
    await key(page, 'ArrowUp', 80);
  }
  for (let i = 0; i < 12; i++) {
    await key(page, 'ArrowLeft', 80);
  }
}

/** Serpentine the cursor until it stands on `spaceId`. */
async function walkToSpace(page: Page, spaceId: string): Promise<void> {
  await homeCursor(page);
  const lane = [
    ...Array(9).fill('ArrowRight'), 'ArrowDown',
    ...Array(9).fill('ArrowLeft'), 'ArrowDown',
  ];
  const seen = new Set<string>();
  for (let i = 0; i < 150; i++) {
    const id = await page.evaluate(() =>
      document.querySelector('.con-cell-sel[data_space_id]')?.getAttribute('data_space_id') ?? '');
    seen.add(id);
    if (id === spaceId) {
      return;
    }
    await key(page, lane[i % lane.length], 90);
  }
  throw new Error(`the cursor never reached space ${spaceId}; it visited ${seen.size} cells: ${[...seen].join(',')}`);
}

type Sample = {t: number, reveal: boolean, bonusZone: boolean, hydro: boolean, modal: boolean, stranded: boolean};

/** One frame of the COMMIT episode: is the workspace still standing, and is
 *  anything of the advance still physically moving? */
type MoveSample = {t: number, hydro: boolean, marker: boolean, transfer: boolean, commitScene: boolean};
/**
 * One frame of the INSPECT episode. `visible` counts every PAINTED face of the
 * source card; `apart` counts them only when they are NOT standing on the same
 * rect — which is the distinction that matters. The canonical close flight
 * deliberately cross-fades the returning stage OVER the revealed slot card for
 * ~60 ms («the card materializes back into its slot», the same handoff language
 * the deal uses), and that is ONE card arriving, not two on screen. Two faces
 * in DIFFERENT places is the defect: a fullscreen copy while the original still
 * sits in the source zone.
 */
type CardSample = {t: number, visible: number, apart: number, zoom: boolean, where: string};

/**
 * Arm the order probe BEFORE the press that starts the episode. Samples on
 * every DOM mutation AND on a 40 ms interval, so a state that exists only
 * between two mutations is still seen.
 */
async function armProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__hydroOrder?: Array<Sample>, __hydroStop?: () => void};
    type Sample = {t: number, reveal: boolean, bonusZone: boolean, hydro: boolean, modal: boolean, stranded: boolean};
    const out: Array<Sample> = [];
    const t0 = performance.now();
    const sample = () => {
      out.push({
        t: Math.round(performance.now() - t0),
        // Any drawn-cards presentation: the overlay, or the workspace-embedded one.
        reveal: document.querySelector('.con-reveal, .con-deckpick, .con-deckdraw') !== null,
        bonusZone: document.querySelector('.con-hydro__layer--bonus') !== null,
        hydro: document.querySelector('.con-hydro') !== null,
        // The generic contextual-choice surface — the thing a dedicated
        // workspace must make impossible.
        modal: document.querySelector('.con-decision, .con-task-host .con-task') !== null,
        // The leak detector's amber guard. It rose OVER a Hydronetwork that was
        // rendering the offer perfectly underneath, because the detector read
        // the registry's DEFAULT `serves` and never the frame's earned one.
        stranded: document.querySelector('.con-stranded') !== null,
      });
    };
    const mo = new MutationObserver(sample);
    mo.observe(document.body, {subtree: true, childList: true, attributes: true, attributeFilter: ['class']});
    const iv = window.setInterval(sample, 40);
    w.__hydroOrder = out;
    w.__hydroStop = () => {
      mo.disconnect();
      window.clearInterval(iv);
    };
    sample();
  });
}

async function readProbe(page: Page): Promise<Array<Sample>> {
  return page.evaluate(() => {
    const w = window as unknown as {__hydroOrder?: Array<Sample>, __hydroStop?: () => void};
    w.__hydroStop?.();
    return w.__hydroOrder ?? [];
  });
}

test.describe('the bonus offer never stands over the cards the placement drew', () => {
  test.setTimeout(420_000);

  test('reveal first, taken, gone — and ONLY THEN the Hydronetwork', async ({page, request}) => {
    await openAtBoard(page, request);

    // The barrier must be IN PLAY before the ocean, or there is no offer at all.
    await playFromHand(page, BARRIER);
    await page.waitForTimeout(2000);

    // …then the ocean, onto the two-card hex.
    await playFromHand(page, OCEAN_CARD);
    await expect(page.locator('.board-space--available').first()).toBeVisible({timeout: 25_000});
    await walkToSpace(page, DRAW_OCEAN_SPACE);

    // ⭐ ARM BEFORE THE PRESS — the claim is about the middle of the episode.
    await armProbe(page);
    await key(page, 'Enter', 0);

    // Let the whole chain play out: the reveal comes up, we take the cards,
    // the intake lands, and the offer follows.
    for (let i = 0; i < 90; i++) {
      const state = await page.evaluate(() => ({
        reveal: document.querySelector('.con-reveal, .con-deckpick') !== null,
        bonus: document.querySelector('.con-hydro__layer--bonus') !== null,
      }));
      if (state.bonus) {
        break;
      }
      // A live reveal is answered with A (take / OK); anything else just waits.
      await key(page, state.reveal ? 'Enter' : 'Escape', state.reveal ? 700 : 300);
    }
    await expect(page.locator('.con-hydro__layer--bonus')).toBeVisible({timeout: 30_000});
    await page.locator('.con-hydro__layer--bonus').screenshot({path: 'screenshots/hydro-bonus/free.png'}).catch(() => {});

    const samples = await readProbe(page);
    // A DEAD probe must fail loudly rather than pass vacuously.
    expect(samples.length, `the probe never sampled (${samples.length})`).toBeGreaterThan(20);

    const firstBonus = samples.findIndex((s) => s.bonusZone);
    const lastReveal = samples.map((s) => s.reveal).lastIndexOf(true);
    expect(firstBonus, 'the bonus zone never appeared in the samples').toBeGreaterThan(-1);
    expect(lastReveal, 'the placement never drew any cards — wrong hex?').toBeGreaterThan(-1);

    // ── THE ORDER ITSELF ──────────────────────────────────────────────────
    // 1. The reveal was up while the bonus zone was NOT: the cards came first.
    const revealAlone = samples.filter((s) => s.reveal && !s.bonusZone).length;
    expect(revealAlone, 'the drawn cards were never shown on their own').toBeGreaterThan(0);

    // 2. NOT ONE frame had both — the whole point of the door.
    const overlap = samples.filter((s) => s.reveal && s.bonusZone);
    expect(overlap.map((s) => s.t), 'the reveal and the bonus zone overlapped').toEqual([]);

    // 3. The zone's first appearance is strictly AFTER the reveal's last.
    expect(firstBonus, `bonus at #${firstBonus} vs last reveal at #${lastReveal}`)
      .toBeGreaterThan(lastReveal);

    // 4. THE BLOCKER: the offer has a dedicated workspace, so the generic
    //    contextual-choice modal must never rise beside it. Not once.
    const modalFrames = samples.filter((s) => s.modal);
    expect(modalFrames.map((s) => s.t), 'the legacy choice modal rose over the workspace').toEqual([]);

    // 5. …and the stranded guard never masked the zone either.
    expect(samples.filter((s) => s.stranded).map((s) => s.t),
      'the leak detector called a served prompt stranded').toEqual([]);

    // ══ NO FALSE «FINISH YOUR CURRENT ACTION FIRST» ══════════════════
    //
    // The player is standing in the workspace THIS PROMPT opened. Telling them
    // to go and finish the current action is telling them to finish the thing
    // they are looking at.
    const status = await page.evaluate(() => ({
      busy: document.querySelector('.con-hydro__chip--busy') !== null,
      text: document.querySelector('.con-hydro__chip--status')?.textContent?.trim() ?? '',
    }));
    expect(status.busy, `the status chip read «${status.text}»`).toBe(false);
    expect(status.text, `the status chip read «${status.text}»`).not.toMatch(/завершите/i);

    // ══ X — ONE PHYSICAL CARD, NEVER TWO ══════════════════════════
    //
    // The fullscreen viewer LIFTS the card out of the source dock and the dock
    // slot is held empty for the whole flight (`con-zoom-hold`). Sampled
    // frame-by-frame, because the end states of a FLIP and of a second card
    // fading in are identical — only the middle tells them apart.
    await page.evaluate(() => {
      const w = window as unknown as {__cardFrames?: Array<CardSample>, __cardStop?: () => void};
      type CardSample = {t: number, visible: number, zoom: boolean};
      const out: Array<CardSample> = [];
      const t0 = performance.now();
      /**
       * PAINTED, not merely present — and that question is asked of the whole
       * ANCESTOR CHAIN, never of the element alone. `opacity` does not inherit
       * as a computed value, so a card inside a transparent parent still
       * reports `opacity: 1`: the zoom flight proxy is authored `opacity: 0`
       * and revealed by its tween's from-state, and reading only the inner
       * `.pcard` counted an invisible proxy as a second card on screen.
       */
      const shown = (el: Element): boolean => {
        const r = el.getBoundingClientRect();
        if (r.width < 8 || r.height < 8) {
          return false;
        }
        let node: Element | null = el;
        while (node !== null && node !== document.documentElement) {
          const cs = getComputedStyle(node);
          if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) <= 0.02) {
            return false;
          }
          node = node.parentElement;
        }
        return true;
      };
      /** Do two rects stand on top of each other (a dissolve) or apart? */
      const overlaps = (a: DOMRect, b: DOMRect): boolean => {
        const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (w <= 0 || h <= 0) {
          return false;
        }
        const inter = w * h;
        return inter / Math.min(a.width * a.height, b.width * b.height) > 0.5;
      };
      const sample = () => {
        // Every rendered face of the SOURCE card, anywhere on screen: the dock,
        // the flight proxy, the dialog. The hold empties the dock via a
        // `:has(.con-zoom-hold)` rule on the wrapper, so a held slot no longer
        // paints its card — which is exactly what this counts.
        const zones: ReadonlyArray<[string, string]> = [
          ['dock', '.con-hydro__bonus-source :is(.card-container, .pcard)'],
          ['proxy', '.con-zoom-flight-proxy :is(.card-container, .pcard)'],
          ['stage', '.card-zoom-stage :is(.card-container, .pcard)'],
        ];
        const painted: Array<{zone: string, rect: DOMRect}> = [];
        for (const [zone, sel] of zones) {
          for (const el of Array.from(document.querySelectorAll(sel))) {
            if (shown(el)) {
              painted.push({zone, rect: el.getBoundingClientRect()});
            }
          }
        }
        let apart = 0;
        for (let i = 0; i < painted.length; i++) {
          for (let j = i + 1; j < painted.length; j++) {
            if (!overlaps(painted[i].rect, painted[j].rect)) {
              apart++;
            }
          }
        }
        out.push({
          t: Math.round(performance.now() - t0),
          visible: painted.length,
          apart,
          zoom: document.querySelector('.card-zoom-stage') !== null,
          where: painted.map((f) =>
            `${f.zone}@${Math.round(f.rect.left)},${Math.round(f.rect.top)} ${Math.round(f.rect.width)}x${Math.round(f.rect.height)}`).join(' + '),
        });
      };
      const mo = new MutationObserver(sample);
      mo.observe(document.body, {subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style']});
      const iv = window.setInterval(sample, 30);
      w.__cardFrames = out;
      w.__cardStop = () => {
        mo.disconnect();
        window.clearInterval(iv);
      };
      sample();
    });

    // Two full open/close cycles — a repeated inspect must not leave a hidden
    // card behind or lose the cursor.
    for (let cycle = 0; cycle < 2; cycle++) {
      await key(page, 'KeyX', 1400);
      await expect(page.locator('.card-zoom-stage')).toHaveCount(1, {timeout: 10_000});
      await key(page, 'Escape', 1400);
      await expect(page.locator('.card-zoom-stage')).toHaveCount(0, {timeout: 10_000});
    }

    const cardFrames: Array<CardSample> = await page.evaluate(() => {
      const w = window as unknown as {__cardFrames?: Array<CardSample>, __cardStop?: () => void};
      w.__cardStop?.();
      return w.__cardFrames ?? [];
    });
    expect(cardFrames.length, `the inspect probe never sampled (${cardFrames.length})`).toBeGreaterThan(20);
    // THE CLAIM: not one sampled frame shows the card in TWO PLACES. The only
    // frames where two faces are painted at all are the landing dissolve, where
    // they stand on the same rect and one is fading out over the other — the
    // console's own materialize-into-the-slot handoff.
    const doubled = cardFrames.filter((f) => f.apart > 0);
    expect(doubled.map((f) => `${f.t}ms → ${f.where}`),
      'the source card was painted in two different places').toEqual([]);
    // …and even the CO-LOCATED overlap must be a BEAT, not a state: it belongs
    // to the landing cross-fade of a flight, never to a standing fullscreen or
    // a standing dock. Measured as the ELAPSED span of each contiguous run of
    // overlapping samples — counting samples and multiplying by the interval
    // measures how often the observer fired, which during a GSAP tween is
    // «very often» and says nothing about how long anything was on screen.
    const runs: Array<number> = [];
    let runStart: number | undefined;
    let runEnd = 0;
    for (const f of cardFrames) {
      if (f.visible > 1) {
        runStart = runStart ?? f.t;
        runEnd = f.t;
      } else if (runStart !== undefined) {
        runs.push(runEnd - runStart);
        runStart = undefined;
      }
    }
    if (runStart !== undefined) {
      runs.push(runEnd - runStart);
    }
    const longest = runs.length > 0 ? Math.max(...runs) : 0;
    expect(longest, `the longest co-located overlap ran ${longest}ms (runs: ${runs.join(', ')}ms)`)
      .toBeLessThan(300);
    // …and the viewer really did open (a dead probe must not pass vacuously).
    expect(cardFrames.some((f) => f.zoom), 'the fullscreen viewer never opened').toBe(true);
    // …and the card came back: the dock paints it again once the flight is over.
    await expect(page.locator('.con-hydro__bonus-source :is(.card-container, .pcard)')).toBeVisible({timeout: 10_000});
    // The inspection answered nothing — the decision is still standing.
    await expect(page.locator('.con-hydro__layer--bonus')).toBeVisible();

    // ══ B IS «СВЕРНУТЬ» — IT MUST NOT ANSWER THE PROMPT ═══════════════
    const posBefore = await page.evaluate(async () => {
      const id = new URLSearchParams(location.search).get('id');
      const r = await fetch(`/api/player?id=${id}`);
      const v = await r.json();
      return {pos: v.thisPlayer.deltaProject?.position ?? 0, waiting: v.waitingFor !== undefined};
    });
    const backLabel = await page.evaluate(() => Array.from(
      document.querySelectorAll('.con-cmd__label, .con-cmdbar__label'))
      .map((e) => e.textContent?.trim() ?? '').join(' | '));
    expect(backLabel, `the command bar read «${backLabel}»`).not.toMatch(/Пропустить/i);

    await key(page, 'Escape', 1600);
    // The workspace is gone…
    await expect(page.locator('.con-hydro')).toHaveCount(0, {timeout: 15_000});
    // …the decision is NOT: the server is still asking, and nothing moved.
    const posAfter = await page.evaluate(async () => {
      const id = new URLSearchParams(location.search).get('id');
      const r = await fetch(`/api/player?id=${id}`);
      const v = await r.json();
      return {
        pos: v.thisPlayer.deltaProject?.position ?? 0,
        bonus: v.waitingFor?.deltaBonusPrompt !== undefined,
      };
    });
    expect(posBefore.waiting, 'the offer was not on the wire to begin with').toBe(true);
    expect(posAfter.pos, 'B moved the marker — it answered the prompt').toBe(posBefore.pos);
    expect(posAfter.bonus, 'B resolved the offer instead of minimizing it').toBe(true);

    // …and the board-home mandatory card is the way back INTO THE SAME PROMPT.
    await expect(page.locator('.con-mandatory')).toBeVisible({timeout: 20_000});
    await key(page, 'Enter', 2000);
    await expect(page.locator('.con-hydro__layer--bonus')).toBeVisible({timeout: 20_000});
    // No duplicate: exactly one workspace, one offer, one source card.
    expect(await page.locator('.con-hydro').count()).toBe(1);
    expect(await page.locator('.con-hydro__layer--bonus').count()).toBe(1);
    // …and no false warning on the way back in either.
    expect(await page.locator('.con-hydro__chip--busy').count(),
      'the re-entered workspace nagged about the current action').toBe(0);

    // ══ THE MOVE IS PRESENTED — AND THE WORKSPACE OUTLIVES IT ════════════
    //
    // A free bonus step must look exactly like a paid advance: the marker
    // glides, the landed stage pays out, the counters tick — and only then may
    // the workspace go. It used to submit and close in the same breath.
    await page.evaluate(() => {
      const w = window as unknown as {__move?: Array<MoveSample>, __moveStop?: () => void};
      type MoveSample = {t: number, hydro: boolean, marker: boolean, transfer: boolean, commitScene: boolean};
      const out: Array<MoveSample> = [];
      const t0 = performance.now();
      const sample = () => out.push({
        t: Math.round(performance.now() - t0),
        hydro: document.querySelector('.con-hydro') !== null,
        marker: document.querySelector('.con-hydromarker') !== null,
        transfer: document.querySelector('.con-transfer') !== null,
        commitScene: document.querySelector('.con-hydro__layer--commit, .con-hydro__layer--result') !== null,
      });
      const mo = new MutationObserver(sample);
      mo.observe(document.body, {subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style']});
      const iv = window.setInterval(sample, 30);
      w.__move = out;
      w.__moveStop = () => {
        mo.disconnect();
        window.clearInterval(iv);
      };
      sample();
    });

    // ══ THE PAID OFFER — the same flow, one stage further up the track ══
    //
    // Take the free step (it lands on position 1, «building», which the barrier's
    // OWN tag covers), then place another ocean. The next stage wants POWER,
    // which this player has not got — so the offer is no longer free: the server
    // decides it costs 1 energy to waive that one tag, and the zone must say so.
    // A on the focused CONFIRM takes the free step. Landing on position 1 asks
    // WHICH reward — and it asks INSIDE this workspace (the whole point), so
    // keep answering until the move is fully resolved.
    for (let i = 0; i < 20 && await page.locator('.con-hydro').count() > 0; i++) {
      const zone = await page.evaluate(() => ({
        bonus: document.querySelector('.con-hydro__layer--bonus') !== null,
        choice: document.querySelector('.con-hydro__layer--choice') !== null,
      }));
      // …and a reward asked here is NEVER a modal beside the workspace.
      expect(await page.locator('.con-decision').count(), 'a modal rose for the reward').toBe(0);
      await key(page, 'Enter', zone.bonus || zone.choice ? 1400 : 900);
    }

    // The offer was a visit the player did not ask for, so answering it HANDS
    // THE SCREEN BACK: the Hydronetwork must leave by itself.
    await expect(page.locator('.con-hydro')).toHaveCount(0, {timeout: 30_000});

    // ══ …AND THE CLOSE CAME LAST ═══════════════════════════════
    const move: Array<MoveSample> = await page.evaluate(() => {
      const w = window as unknown as {__move?: Array<MoveSample>, __moveStop?: () => void};
      w.__moveStop?.();
      return w.__move ?? [];
    });
    expect(move.length, `the move probe never sampled (${move.length})`).toBeGreaterThan(20);

    // 1. The marker ACTUALLY GLIDED. A bonus step that skips this is the
    //    original defect: the position simply changed while nobody looked.
    const glided = move.filter((m) => m.marker);
    expect(glided.length, 'the marker never glided for the free bonus step').toBeGreaterThan(0);

    // 2. The commit scene stood — the workspace narrated its own move.
    expect(move.some((m) => m.commitScene),
      'the workspace never showed the move it was making').toBe(true);

    // 3. THE CLAIM: the workspace never closed while the move was still
    //    physically happening. Not one frame with the marker (or a reward
    //    chip) in the air and no Hydronetwork under it.
    const closedEarly = move.filter((m) => !m.hydro && (m.marker || m.transfer));
    expect(closedEarly.map((m) => `${m.t}ms`),
      'the workspace closed while the advance was still animating').toEqual([]);

    // 4. …and the LAST frame in which anything was moving comes BEFORE the
    //    workspace's last frame: the close is the chain's completion event.
    const lastMoving = move.map((m) => m.marker || m.transfer).lastIndexOf(true);
    const lastHydro = move.map((m) => m.hydro).lastIndexOf(true);
    expect(lastHydro, `last moving #${lastMoving}, last workspace #${lastHydro}`)
      .toBeGreaterThanOrEqual(lastMoving);
    await playFromHand(page, OCEAN_CARD_2);
    await expect(page.locator('.board-space--available').first()).toBeVisible({timeout: 25_000});
    await key(page, 'Enter', 1500); // any legal ocean cell will do here

    for (let i = 0; i < 90; i++) {
      const state = await page.evaluate(() => ({
        reveal: document.querySelector('.con-reveal, .con-deckpick') !== null,
        bonus: document.querySelector('.con-hydro__layer--bonus') !== null,
        space: document.querySelector('.board-space--available') !== null,
      }));
      if (state.bonus) {
        break;
      }
      await key(page, state.reveal || state.space ? 'Enter' : 'Escape', 700);
    }
    await expect(page.locator('.con-hydro__layer--bonus')).toBeVisible({timeout: 30_000});

    // THE SERVER'S OWN VERDICT, rendered: the price is on the CTA and in the
    // body, and the free wording is gone. The client decided none of it.
    const paid = await page.evaluate(() => ({
      confirm: document.querySelector('.con-hydro__bonus-action .con-hydro__bonus-action-title')?.textContent?.trim() ?? '',
      body: document.querySelector('.con-hydro__bonus-text')?.textContent?.trim() ?? '',
      cost: document.querySelector('.con-hydro__route-cost')?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      free: document.querySelector('.con-hydro__route-cost--free') !== null,
    }));
    expect(paid.confirm, `paid CTA read «${paid.confirm}»`).toMatch(/энерги/i);
    expect(paid.body, `paid body read «${paid.body}»`).toMatch(/метк/i);
    expect(paid.cost, `paid cost chip read «${paid.cost}»`).toContain('1');
    await page.locator('.con-hydro__layer--bonus').screenshot({path: 'screenshots/hydro-bonus/paid.png'}).catch(() => {});
    expect(paid.free, 'the paid offer must not advertise itself as free').toBe(false);
  });
});
