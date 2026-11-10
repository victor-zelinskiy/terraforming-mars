import {test, expect} from './consoleTest';
import {bootFixture, cinematicBeat, fetchPlayerModel, playCardFromHand, press, settle, walkFocusUntil} from './consoleStart';

/**
 * THE WAIT GRAPH's DEAD-END CURE — the positive control (docs/claude/console/wait-graph.md § Э3: `dead-end` armed
 * 2026-11-09). A question the server asks that NOTHING on screen serves — no frame, no plate, no admission block, nothing
 * in flight, the player did not set it aside — is a dead end, and its door gives the question its surface back through
 * the router's own road (the road it took when it arrived). The shape is the monkey's R15 (the start's play-from-hand
 * step lost to a B mid-open); here it is put in on purpose, mid-game: WG Project's prelude asks «play a card from your
 * hand», the hand serves it, and the control seam (`?waitGraphControl=strand` → `__conStrandQuestion()`) takes the hand's
 * frame off the stack WITHOUT setting the question aside. The graph must see the dead end, cure it through
 * «question-open», and the hand must stand for the question again — the player never needed a key.
 */
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv&waitGraphControl=strand'} as const;

test.describe('the wait graph cures a question asked of nobody', () => {
  test.use({viewport: PRESET.viewport});

  test('a play-from-hand question stripped of its hand gets it back by itself — dead end seen, cured through «question-open»', async ({page, request}) => {
    test.setTimeout(240_000);
    const graph: Array<string> = [];
    page.on('console', (m) => {
      if (m.text().startsWith('[wait-graph]')) {
        graph.push(m.text());
      }
    });
    const id = await bootFixture(page, request, 'ecology-experts-wg', {query: PRESET.query});
    await settle(page);
    expect(await playCardFromHand(page, 'WG Project'), 'WG Project was played').toBeTruthy();
    const pick = '.con-hand__outcome .con-deckpick--play';
    await expect(page.locator(`${pick}[data-flow="choosing"]`), 'the prelude pick stands in the hand').toHaveCount(1, {timeout: 40_000});
    const focused = () => page.evaluate(() => document.querySelector('.con-deckpick .con-cards__slot--focused')?.getAttribute('data-deckpick-slot') ?? '');
    expect(await walkFocusUntil(page, async () => await focused() === 'Ecology Experts', focused, 12), 'focused Ecology Experts').toBeTruthy();
    await press(page, 'Enter', 400);
    await press(page, 'Period', 300);
    await expect.poll(async () => ((await fetchPlayerModel(request, id)) as unknown as {waitingFor?: {type?: string}}).waitingFor?.type,
      {timeout: 20_000, message: 'the server asks the play from the hand'}).toBe('projectCard');
    await settle(page, {timeoutMs: 40_000}).catch(() => undefined);
    await expect(page.locator('.con-hand'), 'the hand serves the question').toHaveCount(1);
    // THE STRAND: the hand's frame leaves, the question stays asked, nothing set aside.
    const stripped = await page.evaluate(() => (window as unknown as {__conStrandQuestion?: () => string}).__conStrandQuestion?.() ?? '');
    expect(stripped, 'the seam took the serving frame off the stack').toBe('hand');
    await expect(page.locator('.con-hand'), 'the hand is gone — the question is asked of nobody').toHaveCount(0, {timeout: 10_000});
    // THE CURE: no key pressed — the graph names the dead end and its door opens the question's surface again.
    await expect.poll(() => graph.some((l) => /\[wait-graph\] cure dead-end at question:projectCard#\d+ through «question-open» — reopened/.test(l)),
      {timeout: 30_000, message: `the dead end was cured through its door (graph: ${graph.join(' | ').slice(0, 600)})`}).toBe(true);
    await expect(page.locator('.con-hand'), 'the hand stands for the question again').toHaveCount(1, {timeout: 15_000});
    await cinematicBeat(page, 3_000, 'the cured screen holds — one cure, no second finding');
    expect(graph.filter((l) => l.includes('cure dead-end')), 'cured ONCE').toHaveLength(1);
  });
  test('a claim placed for a host that is NOWHERE is released by itself — its question never stays suppressed (the Hi-Tech Lab freeze)', async ({page, request}) => {
    test.setTimeout(120_000);
    const lines: Array<string> = [];
    page.on('console', (m) => {
      if (m.text().startsWith('[workspace-outcome]')) {
        lines.push(m.text());
      }
    });
    await bootFixture(page, request, 'ecology-experts-wg', {query: PRESET.query});
    await settle(page);
    const planted = await page.evaluate(() => (window as unknown as {__conOrphanClaim?: () => boolean}).__conOrphanClaim?.() ?? false);
    expect(planted, 'the seam planted a claim for «card-actions» with no such frame').toBe(true);
    await expect.poll(() => lines.some((l) => l.includes('the claim of «card-actions» (Hi-Tech Lab [draw,pick]) outlived its host — released')),
      {timeout: 10_000, message: `the orphaned claim was released (lines: ${lines.join(' | ')})`}).toBe(true);
    expect(lines.filter((l) => l.includes('outlived its host')), 'released ONCE').toHaveLength(1);
  });
  test('a blocking hold with NOTHING moving on the page is a dead end — named, then ended through its owner\'s door («hold-expire»)', async ({page, request}) => {
    test.setTimeout(120_000);
    const lines: Array<string> = [];
    page.on('console', (m) => {
      if (m.text().startsWith('[liveness] still hold') || m.text().startsWith('[wait-graph]')) {
        lines.push(m.text());
      }
    });
    await bootFixture(page, request, 'ecology-experts-wg', {query: PRESET.query});
    await settle(page);
    const planted = await page.evaluate(() => (window as unknown as {__conStillHold?: () => boolean}).__conStillHold?.() ?? false);
    expect(planted, 'the seam planted a blocking hold').toBe(true);
    await expect.poll(() => lines.some((l) => l.startsWith('[liveness] still hold') && l.includes('wait-graph-control:still')),
      {timeout: 20_000, message: `the still hold was named (lines: ${lines.join(' | ').slice(0, 600)})`}).toBe(true);
    await expect.poll(() => lines.some((l) => /\[wait-graph\] cure dead-end at hold:wait-graph-control:still through «hold-expire»/.test(l)),
      {timeout: 15_000, message: `the still hold was ended through its door (lines: ${lines.join(' | ').slice(0, 600)})`}).toBe(true);
    // Well before its own 25 s ceiling — the cure is the graph's, not the leak net's.
    expect(lines.filter((l) => l.includes('force-released')), 'never the ceiling').toEqual([]);
    expect(lines.filter((l) => l.startsWith('[liveness] still hold')), 'named ONCE per still spell').toHaveLength(1);
  });
});
