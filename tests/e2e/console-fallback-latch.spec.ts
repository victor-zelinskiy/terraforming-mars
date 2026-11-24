import {test, expect} from './consoleTest';
import {openConsole, seedGameOverApi, soloGameConfig} from './consoleStart';

/**
 * THE FALLBACK LATCH LETS GO WITH ITS SCOPE (FREEZE ZERO, stage 6 — the one-owner law's last row in a real browser:
 * `bar-APART:fallback>start`, the gated passes of whole games, 2026-11-24).
 *
 * A layer the console does not own (the loading curtain's buttons, a native dialog, a detail modal) is driven by the
 * DOM focus engine, and the shell learns of it where a press falls through to the scope resolver:
 * `consoleState.fallbackActive`. It used to learn that the layer LEFT only at the next press — so between the two the
 * command bar read the generic «Выбрать · Назад» over whatever had come up, the board home was «not idle» (its plate
 * withheld) and the hand dock inert.
 *
 * The contract: a layer of that kind stands, a press meets it, the layer leaves BY ITSELF — and with no further press
 * the bar is the board home's again. (The layer here is planted — a detail modal's root, the scope the resolver
 * knows by its class; the latch does not care whose it was.)
 */
test.describe('the fallback latch — a layer the console does not own', () => {
  test('a press met the layer, the layer left by itself: the bar is the board home\'s again with no further press', async ({page, request}) => {
    const created = await request.post('/api/creategame', {data: soloGameConfig({
      expansions: {}, board: 'tharsis', seed: 0.31, testMode: true, draftVariant: false,
    })});
    expect(created.ok(), `create-game refused the table: ${created.status()}`).toBeTruthy();
    const {players} = await created.json() as {players: Array<{id: string}>};
    const viewer = players[0].id;
    await seedGameOverApi(request, viewer, {buy: 2});
    await openConsole(page, viewer);
    const bar = async (): Promise<string> => ((await page.locator('.con-cmdbar').textContent()) ?? '').replace(/\s+/g, ' ').trim();
    await expect.poll(bar, {timeout: 30_000, message: 'the board home\'s bar stands'}).toMatch(/Базовые/);

    // A LAYER OF THE FOCUS ENGINE's stands over the board (the resolver knows it by its root's class).
    await page.evaluate(() => {
      const layer = document.createElement('div');
      layer.className = 'effect-detail-modal';
      layer.setAttribute('data-test-layer', '');
      layer.style.cssText = 'position:fixed;left:40%;top:40%;width:10rem;height:4rem;z-index:99999;background:#123;';
      layer.textContent = 'a layer of the focus engine';
      document.body.appendChild(layer);
    });
    // A press meets it: the shell hands it over, and the bar says so.
    await page.keyboard.press('ArrowDown');
    await expect.poll(bar, {timeout: 10_000, message: 'the press met the layer — the generic bar of a layer the console does not own'}).toMatch(/Выбрать.*Назад/);

    // THE LAYER LEAVES BY ITSELF — nobody presses anything.
    await page.evaluate(() => document.querySelector('[data-test-layer]')?.remove());
    await expect.poll(bar, {timeout: 10_000, message: 'the latch let go with its layer: the board home\'s bar, with no further press'}).toMatch(/Базовые/);
    expect(await bar(), 'no verb of the layer that left').not.toMatch(/Выбрать/);
  });
});
