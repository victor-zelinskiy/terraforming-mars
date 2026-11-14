import {test, expect, EXPECTS_LIVENESS_STALL} from './consoleTest';
import {bootFixture, cinematicBeat, fetchPlayerModel, playCardFromHand, press, reloadConsole, settle, walkFocusUntil} from './consoleStart';

/**
 * A STALL NAMES ITS CAUSE, AND SAYS HOW IT ENDED (FREEZE ZERO · part A — docs/claude/console/freeze-zero/PLAN.md §2;
 * docs/claude/diagnostics.md § 2.4 – 2.5).
 *
 * The positive control of the arbiter's own episode, on a real page: a play-from-hand question is stripped of its
 * hand (`?waitGraphControl=strand` → `__conStrandQuestion()`) and the wait graph is told to act on nothing
 * (`__conDisarmWaitCures()`), so the stranded question is the ARBITER's to judge. What the page's journal must have
 * made of it — the very record the hub sends:
 *
 *  · ONE episode, filed under its cause class: `liveness/stall/unserved/<task>/<top>/stranded…` — the holder is named;
 *  · with WHAT STOOD when it began: the question (asked, who may serve it, that nobody did), the holders, the kernel's
 *    flow tree, the kernel's last records;
 *  · and, when the player gives up and RELOADS the page under it, the episode ends as `reload` — «не вылечено, ушло
 *    в перезагрузку» — with the evidence of its START kept; the reload itself stands the question's surface up again.
 */
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv&waitGraphControl=strand'} as const;

type Entry = {
  id: string, family: string, kind: string, text: string,
  cause?: {cls: string, shape: string, tier: string, dims: Record<string, string>},
  evidence?: {question: string, holders: Array<string>, tree: Array<string>, waits: Array<string>, graph: Array<string>, trace: Array<string>, input: string},
  episode?: {state: string, outcome?: string, durationMs: number, steps: Array<string>, cure?: {by: string, did: string, changed: Array<string>}},
};

const journal = (page: import('@playwright/test').Page): Promise<Array<Entry>> =>
  page.evaluate(() => (window as unknown as {__conDiagnostics?: {journal: () => Array<unknown>}}).__conDiagnostics?.journal() ?? []) as Promise<Array<Entry>>;

test.describe('a stall names its cause and says how it ended', () => {
  test.use({viewport: PRESET.viewport});

  test('a stranded question the arbiter judges: ONE episode under its cause class, with what stood — and a reload under it ends it as «reload»', async ({page, request}) => {
    test.setTimeout(300_000);
    test.info().annotations.push({type: EXPECTS_LIVENESS_STALL, description: 'the arbiter\'s own episode is this control\'s subject — the stall is planted'});
    const stalls: Array<string> = [];
    page.on('console', (m) => {
      if (m.text().startsWith('[liveness] stall')) {
        stalls.push(m.text());
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

    // THE PLANT: the graph acts on nothing, the hand's frame leaves, the question stays asked.
    await page.evaluate(() => (window as unknown as {__conDisarmWaitCures?: () => void}).__conDisarmWaitCures?.());
    const stripped = await page.evaluate(() => (window as unknown as {__conStrandQuestion?: () => string}).__conStrandQuestion?.() ?? '');
    expect(stripped, 'the seam took the serving frame off the stack').toBe('hand');
    await expect.poll(() => stalls.length, {timeout: 40_000, message: 'the arbiter named the stall'}).toBeGreaterThan(0);

    // THE LINE names its holder — the words the cause class is made of.
    expect(stalls[0]).toMatch(/; task: \S+; top: \S+; holder: stranded/);

    // THE RECORD — what the hub would send.
    const open = (await journal(page)).find((e) => e.family === 'liveness' && e.episode !== undefined);
    expect(open, 'the journal made ONE episode of the arbiter\'s lines').toBeDefined();
    expect(open?.cause?.cls, 'filed under what held the question').toMatch(/^liveness\/stall\/unserved\/[a-z-]+\/[a-z:.-]+\/stranded/);
    expect(open?.cause).toMatchObject({shape: 'liveness/stall', tier: 'defect'});
    expect(open?.cause?.dims.holder).toMatch(/^stranded/);
    // WHAT STOOD when it began.
    expect(open?.evidence?.question, 'the question, as asked').toContain('asked projectCard');
    expect(open?.evidence?.question, 'and that nothing served it').toMatch(/stranded: (?!no)\S+/);
    expect(open?.evidence?.holders[0]).toMatch(/^holder: stranded/);
    expect(open?.evidence?.tree.length, 'the kernel\'s flow tree').toBeGreaterThan(3);
    expect(open?.evidence?.tree.some((line) => line.includes('session:')), 'rooted at the game\'s session').toBe(true);
    expect(open?.evidence?.trace.length, 'the kernel\'s last records').toBeGreaterThan(5);
    expect(open?.evidence?.graph.some((line) => line.startsWith('question:')), 'the wait graph\'s question node').toBe(true);

    // THE PLAYER GIVES UP AND RELOADS. The episode was never cured on that page — and the next page says so.
    await cinematicBeat(page, 3_000, 'the ladder runs its rungs — none of them can serve a question that has no frame');
    await reloadConsole(page);
    const after = (await journal(page)).find((e) => e.id === open?.id);
    expect(after, 'the next page adopted the episode').toBeDefined();
    expect(after?.episode).toMatchObject({state: 'unhealed', outcome: 'reload'});
    expect(after?.cause?.cls).toBe(open?.cause?.cls);
    expect(after?.evidence?.tree.length, 'with what stood at its START').toBe(open?.evidence?.tree.length);
    // …and the reload itself is the cure: the question's own surface stands again (the same step, restored).
    await expect(page.locator('.con-hand'), 'the hand stands for the question again').toHaveCount(1, {timeout: 30_000});
  });
});
