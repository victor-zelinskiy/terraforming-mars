import {expect, test} from './consoleTest';
import {
  bootFixture, crumbText, fetchPlayerModel, handCount, openQuickWheel, placementState,
  press, pressUntilGone, readiness, reloadConsole, settle, syncClient, workspaceOpen,
} from './consoleStart';
import {readTransient, recordTransient, stopTransient, transientDocuments} from './transientRecorder';

/**
 * DRIVER CANARY — every load-bearing primitive lands ONCE, fast, first
 * (the `aaa-` prefix sorts it to the head of the suite).
 *
 * Phase 5 of docs/E2E_ARCHITECTURE_REWORK.md: when a UI grammar rework breaks
 * the shared driver, this spec goes red FIRST and names the primitive — the
 * difference between «update consoleStart.ts once» and forty specs failing
 * three screens from the cause. It also exercises the whole phase-3/4
 * substrate on every run: the per-worker server, the fixture door, the
 * readiness probe and the input echo.
 *
 * Kept deliberately CHEAP (~1 min): no cinematics are awaited beyond settle,
 * no placement is committed (the two-phase grammar has its own specs) — this
 * is a smoke of the DRIVER, not of the product's flows.
 */
test.describe('driver canary', () => {
  test('fixture boot · echo · settle · witnesses · wheel · reload', async ({page, request}) => {
    // ── PHASE 4: the fixture door. Boots a generated SerializedGame through
    //    the real deserializer and opens the console on the resumed prompt. ──
    const playerId = await bootFixture(page, request, 'solo-actions');
    expect(playerId.startsWith('p')).toBeTruthy();

    // ── PHASE 2: the readiness probe is installed and answers. ──
    await settle(page);
    const snap = await readiness(page);
    expect(snap, 'window.__conReady must be installed by ConsoleShell').toBeDefined();
    expect(snap!.transport, 'the transport facts must be live in-game').toBeDefined();

    // ── PHASE 2: the input echo counts a real key. ──
    const before = snap!.input.seq;
    await press(page, 'ArrowRight', 250);
    const after = await readiness(page);
    expect(after!.input.seq, 'the key bridge must SEE the press').toBeGreaterThan(before);

    // ── WITNESSES: server truth + the three shared readers. ──
    const model = await fetchPlayerModel(request, playerId) as {cardsInHand?: Array<unknown>};
    expect(model.cardsInHand, 'the server answers the fixture player').toBeDefined();
    expect(await handCount(page)).toBeGreaterThan(0);
    expect(await placementState(page), 'no placement stands on a fresh fixture').toBe('none');
    expect(typeof await crumbText(page)).toBe('string');
    expect(await workspaceOpen(page), 'no workspace band on board home').toBe(false);

    // ── The quick wheel opens and B closes it (press-until family). ──
    await openQuickWheel(page);
    const closed = await pressUntilGone(page, 'Escape', '.con-quick', {tries: 4, settleMs: 400});
    expect(closed, 'B must close the quick wheel').toBeTruthy();

    // ── The veil-aware reload lands back on a drivable console. ──
    await reloadConsole(page);
    await settle(page);
    expect(await handCount(page)).toBeGreaterThan(0);
  });

  /**
   * THE THREE FLAKE CLASSES' PRIMITIVES (the flake architecture, 2026-11-04) — each must be LIVE, or every spec that
   * leans on them silently loses its protection.
   */
  test('the absorb ledger · the transient recorder across a reload · syncClient', async ({page, request}) => {
    const playerId = await bootFixture(page, request, 'solo-actions');
    await settle(page);

    // CLASS 1 — the ledger is wired into the page: the global gates are registered, the echo knows «absorbed».
    const ledger = await page.evaluate(() => {
      const w = window as unknown as {
        __conInputAbsorb?: (code?: string) => {registered: Array<string>, activeGlobal: Array<string>},
        __conInputEcho?: () => {absorbed?: number},
      };
      return {absorb: w.__conInputAbsorb?.('Enter'), echoAbsorbed: w.__conInputEcho?.().absorbed};
    });
    expect(ledger.absorb, 'window.__conInputAbsorb is installed by the key bridge').toBeDefined();
    for (const gate of ['prompt-settle', 'commit-arrival', 'scene-curtain']) {
      expect(ledger.absorb!.registered, `the global gate «${gate}» is on the ledger`).toContain(gate);
    }
    expect(typeof ledger.echoAbsorbed, 'the echo counts absorbed presses').toBe('number');

    // CLASS 2 — the recorder sees a product write, and SURVIVES the page being replaced.
    await recordTransient(page, 'canary-mark', () => document.body.getAttribute('data-canary-mark'));
    await page.evaluate(() => document.body.setAttribute('data-canary-mark', 'one'));
    await expect.poll(async () => (await readTransient<string | null>(page, 'canary-mark')).map((x) => x.v))
      .toContain('one');
    await reloadConsole(page);
    await settle(page);
    await page.evaluate(() => document.body.setAttribute('data-canary-mark', 'two'));
    await expect.poll(async () => (await readTransient<string | null>(page, 'canary-mark')).map((x) => x.v),
      {message: 'the recording went on in the NEW document'}).toContain('two');
    const samples = await stopTransient<string | null>(page, 'canary-mark');
    expect(samples.map((x) => x.v), 'nothing recorded before the reload was lost').toContain('one');
    expect(transientDocuments(samples).length, 'the samples name the two documents').toBeGreaterThanOrEqual(2);

    // CLASS 3 — the page has applied the server's now.
    await syncClient(page, request, playerId);
    const age = (await readiness(page))?.transport?.gameAge ?? -1;
    const server = ((await fetchPlayerModel(request, playerId)) as unknown as {game: {gameAge: number}}).game.gameAge;
    expect(age, 'syncClient returned with the client at the server game age').toBeGreaterThanOrEqual(server);
  });
});
