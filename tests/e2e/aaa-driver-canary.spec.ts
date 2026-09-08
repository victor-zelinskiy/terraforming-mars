import {expect, test} from './consoleTest';
import {
  bootFixture, crumbText, fetchPlayerModel, handCount, openQuickWheel, placementState,
  press, pressUntilGone, readiness, reloadConsole, settle, workspaceOpen,
} from './consoleStart';

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
});
