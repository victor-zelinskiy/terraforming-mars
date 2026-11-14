import {test, expect, EXPECTS_LIVENESS_STALL, Page, APIRequestContext} from './consoleTest';
import {bootFixture, cinematicBeat, fetchPlayerModel, playCardFromHand, press, reloadConsole, settle, walkFocusUntil} from './consoleStart';

/**
 * A STALL NAMES ITS CAUSE, SAYS HOW IT ENDED — AND NEVER LEAVES THE PLAYER ON A DEAD SCREEN
 * (FREEZE ZERO · parts A and C·6 — docs/claude/console/freeze-zero/PLAN.md §2, §4 · 6; docs/claude/diagnostics.md § 2.4 – 2.5).
 *
 * The positive control of the arbiter's own episode, on a real page: a play-from-hand question is stripped of its
 * hand (`?waitGraphControl=strand` → `__conStrandQuestion()`) and the wait graph is told to act on nothing
 * (`__conDisarmWaitCures()`), so the stranded question is the ARBITER's to judge. What the page's journal must have
 * made of it — the very record the hub sends:
 *
 *  · ONE episode, filed under its cause class: `liveness/stall/unserved/<task>/<top>/stranded…` — the holder is named;
 *  · with WHAT STOOD when it began: the question (asked, who may serve it, that nobody did), the holders, the kernel's
 *    flow tree, the kernel's last records.
 *
 * And what the PLAYER gets, past the ladder's last rung:
 *
 *  · THE LAST LINE (`session/sessionRebuild.ts`): the console session is rebuilt from the server's view — the page
 *    replaces itself behind the curtain, the question's own surface stands again, and the episode is filed `rebuilt`
 *    (never a cure: a defect the program's bar counts);
 *  · BOUNDED: the same question stripped again is NOT rebuilt for a second time — the refusal is said once and the
 *    page stays (a rebuild that can repeat is a loop);
 *  · with the line switched off (`?rebuild=0`) the page stays as it stood, and the player's own reload under the
 *    episode ends it as `reload` — «не вылечено, ушло в перезагрузку».
 */
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv&waitGraphControl=strand'} as const;

type Entry = {
  id: string, family: string, kind: string, text: string,
  cause?: {cls: string, shape: string, tier: string, dims: Record<string, string>},
  evidence?: {question: string, holders: Array<string>, tree: Array<string>, waits: Array<string>, graph: Array<string>, trace: Array<string>, input: string},
  episode?: {state: string, outcome?: string, durationMs: number, steps: Array<string>, cure?: {by: string, did: string, changed: Array<string>}, nets?: Array<{cls: string, tier: string, n: number}>},
};

const journal = (page: Page): Promise<Array<Entry>> =>
  page.evaluate(() => (window as unknown as {__conDiagnostics?: {journal: () => Array<unknown>}}).__conDiagnostics?.journal() ?? []) as Promise<Array<Entry>>;

/** WG Project's prelude → «play a card from your hand»: the hand serves the server's `projectCard` question. */
async function reachPlayFromHand(page: Page, request: APIRequestContext, query: string): Promise<void> {
  const id = await bootFixture(page, request, 'ecology-experts-wg', {query});
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
  // THE PLANT'S PRECONDITION IS ASSERTED, never hoped for: the hand has finished opening. A hold of its opening still
  // live when the frame is taken away is «something in flight» — another net's case, another class (measured on a
  // loaded box, 2026-11-14: `animation:hand-open` outlived the stripped hand and the foreground rung cured it).
  await expect.poll(() => page.evaluate(() => (window as unknown as {__conReady?: () => {holds?: Array<string>}}).__conReady?.().holds ?? []),
    {timeout: 60_000, message: 'no animation hold is live before the plant'}).toEqual([]);
}

/** THE PLANT: the graph acts on nothing, the hand's frame leaves, the question stays asked. */
async function strand(page: Page): Promise<void> {
  await page.evaluate(() => (window as unknown as {__conDisarmWaitCures?: () => void}).__conDisarmWaitCures?.());
  const stripped = await page.evaluate(() => (window as unknown as {__conStrandQuestion?: () => string}).__conStrandQuestion?.() ?? '');
  expect(stripped, 'the seam took the serving frame off the stack').toBe('hand');
}

function watchLines(page: Page): {stalls: Array<string>, rebuilds: Array<string>} {
  const lines = {stalls: [] as Array<string>, rebuilds: [] as Array<string>};
  page.on('console', (m) => {
    const text = m.text();
    if (text.startsWith('[liveness] stall')) {
      lines.stalls.push(text);
    } else if (text.startsWith('[session-rebuild]')) {
      lines.rebuilds.push(text);
    }
  });
  return lines;
}

/** The record the hub would send for the arbiter's episode — asserted, and returned for the «after». */
async function expectEpisodeWithItsCause(page: Page, stalls: ReadonlyArray<string>): Promise<Entry> {
  // THE LINE names its holder — the words the cause class is made of.
  expect(stalls[0]).toMatch(/; task: \S+; top: \S+; holder: stranded/);
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
  return open as Entry;
}

/** The console stands again after a navigation the PRODUCT made (the waits of `reloadConsole`, without its reload). */
async function consoleStandsAgain(page: Page): Promise<void> {
  await page.waitForSelector('.con-start__frame, .con-root', {timeout: 90_000});
  await page.waitForSelector('.con-load', {state: 'detached', timeout: 45_000}).catch(() => {});
  await page.waitForSelector('.boot-loader', {state: 'detached', timeout: 150_000});
}

test.describe('a stall names its cause and says how it ended', () => {
  test.use({viewport: PRESET.viewport});

  test('a stranded question the arbiter judges: ONE episode under its cause class, with what stood — and past the last rung the session is REBUILT, once', async ({page, request}) => {
    test.setTimeout(420_000);
    test.info().annotations.push({type: EXPECTS_LIVENESS_STALL, description: 'the arbiter\'s own episode and the last line are this control\'s subject — the stall is planted'});
    const lines = watchLines(page);
    await reachPlayFromHand(page, request, PRESET.query);

    const left = page.waitForEvent('framenavigated', {predicate: (frame) => frame === page.mainFrame(), timeout: 120_000});
    await strand(page);
    await expect.poll(() => lines.stalls.length, {timeout: 40_000, message: 'the arbiter named the stall'}).toBeGreaterThan(0);
    const open = await expectEpisodeWithItsCause(page, lines.stalls);

    // THE LAST LINE. No rung can serve a question that has no frame: the ladder is spent, the screen still stands —
    // and the page replaces itself behind the curtain. No key was pressed.
    await expect.poll(() => lines.rebuilds.length, {timeout: 40_000, message: `the last line spoke (stalls: ${lines.stalls.length})`}).toBeGreaterThan(0);
    expect(lines.rebuilds[0]).toMatch(/^\[session-rebuild\] page — «projectCard» \(projectCard#\d+\) — by liveness: the ladder is spent and the screen stood \d+s$/);
    await left;
    await consoleStandsAgain(page);
    // The rebuild IS the cure the player gets: the question's own surface stands again (the same step, restored).
    await expect(page.locator('.con-hand'), 'the hand stands for the question again').toHaveCount(1, {timeout: 30_000});
    // The episode was never cured by a net — and the next page says exactly how it ended.
    const after = (await journal(page)).find((e) => e.id === open.id);
    expect(after, 'the next page adopted the episode').toBeDefined();
    expect(after?.episode).toMatchObject({state: 'unhealed', outcome: 'rebuilt'});
    expect(after?.episode?.nets?.some((net) => net.cls.startsWith('session-rebuild/page')), 'the last line is a net of the episode').toBe(true);
    expect(after?.cause?.cls).toBe(open.cause?.cls);
    expect(after?.evidence?.tree.length, 'with what stood at its START').toBe(open.evidence?.tree.length);

    // BOUNDED. The same question stripped again: the arbiter judges it, the ladder is spent — and the page STAYS.
    // (A question no rebuild can serve is a defect of the table itself: said once, by name, never retried.)
    await expect.poll(() => page.evaluate(() => (window as unknown as {__conReady?: () => {holds?: Array<string>}}).__conReady?.().holds ?? []),
      {timeout: 60_000, message: 'no animation hold is live before the second plant'}).toEqual([]);
    const stallsBefore = lines.stalls.length;
    let navigatedAgain = false;
    page.once('framenavigated', (frame) => {
      navigatedAgain = navigatedAgain || frame === page.mainFrame();
    });
    await strand(page);
    await expect.poll(() => lines.stalls.length, {timeout: 40_000, message: 'the arbiter named the second stall'}).toBeGreaterThan(stallsBefore);
    await expect.poll(() => lines.rebuilds.filter((l) => l.includes('refused (again)')).length,
      {timeout: 40_000, message: `the refusal was said (lines: ${lines.rebuilds.join(' | ').slice(0, 500)})`}).toBe(1);
    await cinematicBeat(page, 8_000, 'the arbiter keeps looking at the standing screen — the refusal is one fact, not a line a second');
    expect(lines.rebuilds.filter((l) => l.includes('refused (again)')), 'said ONCE').toHaveLength(1);
    expect(lines.rebuilds.filter((l) => l.startsWith('[session-rebuild] page')), 'rebuilt ONCE').toHaveLength(1);
    expect(navigatedAgain, 'the page stayed').toBe(false);
  });

  test('with the last line switched off the page stays as it stood — and the player\'s own reload under the episode ends it as «reload»', async ({page, request}) => {
    test.setTimeout(300_000);
    test.info().annotations.push({type: EXPECTS_LIVENESS_STALL, description: 'the arbiter\'s own episode is this control\'s subject — the stall is planted'});
    const lines = watchLines(page);
    await reachPlayFromHand(page, request, `${PRESET.query}&rebuild=0`);
    await strand(page);
    await expect.poll(() => lines.stalls.length, {timeout: 40_000, message: 'the arbiter named the stall'}).toBeGreaterThan(0);
    const open = await expectEpisodeWithItsCause(page, lines.stalls);
    // The switch is SAID (once) — an episode that stands on a spent ladder is never silently left there.
    await expect.poll(() => lines.rebuilds.length, {timeout: 40_000, message: 'the switched-off line said so'}).toBe(1);
    expect(lines.rebuilds[0]).toContain('[session-rebuild] refused (off)');
    await expect(page.locator('.con-hand'), 'nothing came back by itself').toHaveCount(0);

    // THE PLAYER GIVES UP AND RELOADS. The episode was never cured on that page — and the next page says so.
    await reloadConsole(page);
    const after = (await journal(page)).find((e) => e.id === open.id);
    expect(after, 'the next page adopted the episode').toBeDefined();
    expect(after?.episode).toMatchObject({state: 'unhealed', outcome: 'reload'});
    expect(after?.cause?.cls).toBe(open.cause?.cls);
    expect(after?.evidence?.tree.length, 'with what stood at its START').toBe(open.evidence?.tree.length);
    // …and the reload itself is the cure: the question's own surface stands again (the same step, restored).
    await expect(page.locator('.con-hand'), 'the hand stands for the question again').toHaveCount(1, {timeout: 30_000});
  });
});
