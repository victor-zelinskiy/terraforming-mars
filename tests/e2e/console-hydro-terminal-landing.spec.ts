import {test, expect, Page, APIRequestContext} from './consoleTest';
import {
  NO_PAYMENT, bootFixture, createGameWithCards, fetchPlayerModel, openConsole, press,
  seedGameOverApi, sendPlayerInput, settle, soloGameConfig, waitForBoardHome,
} from './consoleStart';

/**
 * THE TERMINAL LANDING CLOSES ITSELF — the finale-wedge regression.
 *
 * The field report (2026-09-09/10, twice): a multi-step advance onto the 5 VP
 * finish slot plays its ceremony («Архитектор гидросети», the value rises,
 * the burst fires) — and then the screen WEDGES: no summary, no close, B
 * dead, un-sticking only when some unrelated 20–30 s safety happens to shake
 * the state. The close chain is edge-driven (busy falling edge → result →
 * the read-hold timer → finish → the workspace leaves), so ANY missed edge
 * or stuck busy term is this exact symptom.
 *
 * This spec pins the whole chain BY TIME on the real surface: fixture at
 * track position 5 with the four remaining row tags and energy → «К
 * дальнему» → one press → the marker walks 5→11 → the ceremony seat appears
 * → and the workspace must LEAVE ON ITS OWN within the chain's honest
 * budget. On a wedge the failure dumps the flow's own transition trail
 * (`__conHydroDiag`), the presentation ledger and the readiness snapshot —
 * the next occurrence names its stuck term instead of demanding a hunt.
 *
 * Budget arithmetic (motion scale 1): glide ≈1.6 s + ceremony 0.56+2.1 s +
 * result hold 2.4 s + transitions ≈1.5 s ≈ 8 s. The bound is 14 s — far
 * over any honest run, far under the 20–30 s accidental recoveries the bug
 * hides behind.
 */

type Diag = {
  commit: {phase: string, toPosition: number, kind: string} | null,
  resolutionBusy: boolean,
  busyTerms: Record<string, boolean>,
  trail: Array<string>,
} | null;

async function hydroDiag(page: Page): Promise<Diag> {
  return await page.evaluate(() =>
    (window as unknown as {__conHydroDiag?: () => unknown}).__conHydroDiag?.() ?? null) as Diag;
}

async function wedgeDump(page: Page): Promise<string> {
  const diag = await hydroDiag(page);
  const ledger = await page.evaluate(() =>
    (window as unknown as {__presentationLedgerDiag?: () => unknown}).__presentationLedgerDiag?.() ?? null);
  return `diag=${JSON.stringify(diag)} ledger=${JSON.stringify(ledger)}`;
}

test.describe('Hydronetwork terminal landing · fhd', () => {
  test.use({
    viewport: {width: 1920, height: 1080},
    deviceScaleFactor: 1,
    screen: {width: 1920, height: 1080},
  });

  test('a multi-step advance onto the 5 VP slot: ceremony → summary → the workspace LEAVES by itself', async ({page, request}) => {
    test.setTimeout(240_000);
    const playerId = await bootFixture(page, request, 'hydro-terminal');
    await settle(page);

    // ── Open the Hydronetwork (the wheel route every hydro spec drives). ──
    await press(page, 'Period', 1100);
    await press(page, 'ArrowLeft', 1600);
    await page.waitForSelector('.con-hydro', {timeout: 10_000});

    // RT — «К дальнему»: with the four track tags played and 12 energy the
    // farthest legal stage is the 5 VP finish slot, six cells away — the
    // report's exact «сразу через несколько делений на финальную клетку».
    await press(page, 'Period', 900);
    const focused = await page.evaluate(() =>
      document.querySelector('.con-hydro__stop--focused')?.getAttribute('data-hydro-stop') ?? '');
    expect(focused, 'the farthest legal stage is the 5 VP slot').toBe('11');

    // ── Commit. A plain multi-step advance owes no picks — one A arms the
    //    glide and submits. The commit record is the positive witness. ──
    await press(page, 'Enter', 900);
    await expect.poll(async () => (await hydroDiag(page))?.commit?.kind ?? 'none',
      {timeout: 15_000, message: 'the ceremony-kind commit stands after A'}).toBe('ceremony');

    // ── The culmination plays (the seat exists only from the marker's
    //    physical arrival on the finish stop). ──
    await page.waitForSelector('.con-hydro__cere', {timeout: 30_000});
    const cereAt = Date.now();

    // ── THE CONTRACT: the flow closes ITSELF — ceremony → summary (the
    //    result read hold) → the workspace leaves. No press, no help. ──
    const closed = await page.waitForSelector('.con-hydro', {state: 'detached', timeout: 25_000})
      .then(() => true).catch(() => false);
    const closeMs = Date.now() - cereAt;
    if (!closed) {
      expect(closed, `the workspace never left after the ceremony — ${await wedgeDump(page)}`).toBe(true);
    }
    expect(closeMs,
      `ceremony→close took ${closeMs}ms (the wedge hides behind 20–30 s accidental safeties) — ${await wedgeDump(page)}`)
      .toBeLessThanOrEqual(14_000);

    // ── The server agrees: the move happened and the VP slot is taken. ──
    const model = await fetchPlayerModel(request, playerId) as {thisPlayer?: {deltaProject?: {position?: number}}};
    expect(model.thisPlayer?.deltaProject?.position, 'the server position is the finish slot').toBe(11);
    await settle(page);
  });

  test('THE FIELD SHAPE: a Delta-Surge traversal ENDING on the animal stage closes itself', async ({page, request}) => {
    // The 2026-09-10 wedge, exactly: a Surge traversal finished every
    // segment, the animals landed on the presented stage-9 card («Океанский
    // заповедник» in the field, Pets here) — and the walk hung on «Маркер
    // движется по треку» for ~30 s, because the LAST leg awaited its
    // presented card's exit and the destination's own face never leaves.
    test.setTimeout(240_000);
    const playerId = await bootFixture(page, request, 'hydro-terminal-surge');
    await settle(page);
    await press(page, 'Period', 1100);
    await press(page, 'ArrowLeft', 1600);
    await page.waitForSelector('.con-hydro', {timeout: 10_000});
    await press(page, 'Period', 900);
    const focused = await page.evaluate(() =>
      document.querySelector('.con-hydro__stop--focused')?.getAttribute('data-hydro-stop') ?? '');
    expect(focused, 'two energy bounds «К дальнему» at the animal stage').toBe('9');

    // ── Answer every open rail decision by its OWN markup (the Miranda law:
    //    the step list is data-dependent — drive the unanswered marks). ──
    for (let i = 0; i < 6; i++) {
      const open = await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('.con-hydro__pickrow'));
        return rows.filter((r) => r.querySelector('.con-hydro__bonus-tick') === null).length;
      });
      if (open === 0) {
        break;
      }
      await press(page, 'Enter', 1200);
      if (await page.locator('.con-hydro__layer--target').count() > 0) {
        await press(page, 'Enter', 1200); // A — Pets, the single candidate
        await page.waitForSelector('.con-hydro__layer--target', {state: 'detached', timeout: 10_000});
      } else if (await page.locator('.con-hydro__layer--choice').count() > 0) {
        await press(page, 'Enter', 1200); // A — the first choice option
        await page.waitForSelector('.con-hydro__layer--choice', {state: 'detached', timeout: 10_000});
      }
    }
    expect(await page.evaluate(() =>
      Array.from(document.querySelectorAll('.con-hydro__pickrow'))
        .filter((r) => r.querySelector('.con-hydro__bonus-tick') === null).length),
    'every rail decision is answered').toBe(0);

    // ── Commit (the seat holds the CTA once nothing is left open). ──
    await press(page, 'Enter', 900);
    await expect.poll(async () => (await hydroDiag(page))?.commit?.kind ?? 'none',
      {timeout: 15_000, message: 'the card-resource commit stands after A'}).toBe('card-resource');
    const commitAt = Date.now();

    // ── THE CONTRACT: 7→8→9, the animals land on the presented card, and
    //    the flow CLOSES ITSELF. Pre-fix this hung ~30 s to the plan net. ──
    const closed = await page.waitForSelector('.con-hydro', {state: 'detached', timeout: 25_000})
      .then(() => true).catch(() => false);
    const closeMs = Date.now() - commitAt;
    if (!closed) {
      expect(closed, `the workspace never left after the terminal presenting leg — ${await wedgeDump(page)}`).toBe(true);
    }
    expect(closeMs,
      `commit→close took ${closeMs}ms (the deadlock hid behind the 30 s plan net) — ${await wedgeDump(page)}`)
      .toBeLessThanOrEqual(20_000);

    const model = await fetchPlayerModel(request, playerId) as {thisPlayer?: {deltaProject?: {position?: number}}};
    expect(model.thisPlayer?.deltaProject?.position, 'the server position is the animal stage').toBe(9);
  });
});

/*
 * ══ THE FIELD SETUP: the SAME landing with a MarsBot turn arriving BEHIND
 * it ═══════════════════════════════════════════════════════════════════════
 *
 * Both field games were solo-vs-MarsBot, and the report's «параллельно
 * приходили нотификации» is the bot: the advance that ends the player's turn
 * brings the bot's whole turn with/right after the response — its cards, its
 * scale moves, its own Hydronetwork advance — all presenting while the
 * viewer's terminal ceremony/summary still owns the screen. This journey
 * reproduces that concurrency: seven tag plays (rows 1–9), then the advance
 * as the turn's LAST action, so the bot's turn lands during the finale.
 */

type Wire = Record<string, any>;

function titleOf(prompt: Wire | undefined): string {
  const t = prompt?.title;
  return typeof t === 'string' ? t : String(t?.message ?? '');
}

/** Settle every intermediate prompt until the action menu stands (the
 *  repeat-embed helper — bot turns interleave as quiet waits). */
async function toActionMenu(request: APIRequestContext, id: string): Promise<Wire> {
  let model = await fetchPlayerModel(request, id) as Wire;
  for (let i = 0; i < 60; i++) {
    const prompt = model.waitingFor as Wire | undefined;
    if (prompt !== undefined && prompt.type === 'or' && /Take your (first|next) action/.test(titleOf(prompt))) {
      return prompt;
    }
    if (prompt === undefined) {
      await new Promise((r) => setTimeout(r, 500));
      model = await fetchPlayerModel(request, id) as Wire;
      continue;
    }
    if (prompt.type === 'space') {
      model = await sendPlayerInput(request, id,
        {type: 'space', spaceId: (prompt.spaces ?? [])[0]} as never) as Wire;
      continue;
    }
    model = prompt.type === 'card' ?
      await sendPlayerInput(request, id, {type: 'card', cards: []} as never) as Wire :
      await sendPlayerInput(request, id, {type: 'or', index: 0, response: {type: 'option'}} as never) as Wire;
  }
  expect(false, `never reached the action menu (stuck on ${titleOf(model.waitingFor as Wire)})`).toBeTruthy();
  return {};
}

async function playCard(request: APIRequestContext, id: string, card: string): Promise<void> {
  const menu = await toActionMenu(request, id);
  const at = (menu.options ?? []).findIndex((o: Wire) => titleOf(o) === 'Play project card');
  expect(at, 'the menu offers «Play project card»').toBeGreaterThanOrEqual(0);
  const offered = ((menu.options ?? [])[at].cards ?? []).find((c: Wire) => c.name === card);
  expect(offered, `${card} is in hand`).toBeDefined();
  await sendPlayerInput(request, id, {
    type: 'or', index: at,
    response: {type: 'projectCard', card, payment: {...NO_PAYMENT, megacredits: offered.calculatedCost ?? 25}},
  } as never);
}

// Rows 1–9 in seven NON-EVENT cards: building+power / science / space /
// plant / microbe / jovian / animal+earth.
const BOT_TAG_CARDS = ['Solar Power', 'Research', 'Space Station', 'Adapted Lichen',
  'Regolith Eaters', 'Io Mining Industries', 'Pets'];

const BOT_CFG = soloGameConfig({
  players: [{name: 'TerminalBot', color: 'red', beginner: false, handicap: 0, first: true}],
  expansions: {deltaProject: true},
  automa: {difficulty: 'normal'},
  customProjectCards: BOT_TAG_CARDS,
  customCorporationsList: ['ThorGate'],
  seed: 0.29,
});

test.describe('Hydronetwork terminal landing under a MarsBot turn · fhd', () => {
  test.use({
    viewport: {width: 1920, height: 1080},
    deviceScaleFactor: 1,
    screen: {width: 1920, height: 1080},
  });

  test('the 0→11 landing whose turn-ending press brings the bot\'s turn still closes itself', async ({page, request}) => {
    test.setTimeout(480_000);
    const id = await createGameWithCards(request, BOT_TAG_CARDS, {config: BOT_CFG, seed: 0.29});
    await seedGameOverApi(request, id, {cards: BOT_TAG_CARDS, corporation: 'ThorGate'});
    // Seven plays = seven actions; the advance below is the EIGHTH — the
    // turn's second action, so the bot's turn arrives behind the landing.
    for (const card of BOT_TAG_CARDS) {
      await playCard(request, id, card);
    }
    await toActionMenu(request, id);
    await openConsole(page, id, '');
    // Research drew for the viewer over the API — its reveal is the first
    // thing the console serves on load. Take it before the hydro walk.
    if (await page.locator('.con-reveal').count() > 0 ||
        await page.waitForSelector('.con-reveal', {timeout: 6_000}).then(() => true).catch(() => false)) {
      for (let i = 0; i < 12 && await page.locator('.con-reveal').count() > 0; i++) {
        await press(page, 'Enter', 900);
      }
      await page.waitForSelector('.con-reveal', {state: 'detached', timeout: 25_000});
    }
    await waitForBoardHome(page, 40);

    // ── The walk: open the track, farthest = the 5 VP slot (all nine row
    //    tags stand, test-mode energy covers eleven steps), one A. ──
    await press(page, 'Period', 1100);
    await press(page, 'ArrowLeft', 1600);
    await page.waitForSelector('.con-hydro', {timeout: 10_000});
    await press(page, 'Period', 900);
    const focused = await page.evaluate(() =>
      document.querySelector('.con-hydro__stop--focused')?.getAttribute('data-hydro-stop') ?? '');
    expect(focused, 'the farthest legal stage is the 5 VP slot').toBe('11');
    await press(page, 'Enter', 900);
    await expect.poll(async () => (await hydroDiag(page))?.commit?.kind ?? 'none',
      {timeout: 15_000, message: 'the ceremony-kind commit stands after A'}).toBe('ceremony');

    await page.waitForSelector('.con-hydro__cere', {timeout: 40_000});
    const cereAt = Date.now();

    // ── THE CONTRACT under bot pressure: the flow still closes ITSELF. ──
    const closed = await page.waitForSelector('.con-hydro', {state: 'detached', timeout: 30_000})
      .then(() => true).catch(() => false);
    const closeMs = Date.now() - cereAt;
    if (!closed) {
      expect(closed, `the workspace never left after the ceremony (bot turn behind it) — ${await wedgeDump(page)}`).toBe(true);
    }
    expect(closeMs,
      `ceremony→close took ${closeMs}ms with the bot's turn behind the landing — ${await wedgeDump(page)}`)
      .toBeLessThanOrEqual(14_000);

    const model = await fetchPlayerModel(request, id) as {thisPlayer?: {deltaProject?: {position?: number}}};
    expect(model.thisPlayer?.deltaProject?.position, 'the server position is the finish slot').toBe(11);
  });
});
