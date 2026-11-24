import {test, expect, APIRequestContext} from './consoleTest';
import {bootFixtureSeats, crumbText, fetchPlayerModel, press, pressUntil, settle, walkFocusUntil} from './consoleStart';
import {armLeakWitness, closeSitting, enterSittingByPass, sittingStage, strandedReports} from './parliamentDrive';
import {armWitness} from './witness';

/**
 * COLONY CONTEST × THE REDUX VENUS — the winner's free colony of a sitting, built on the tile that pays «add 2
 * delegates to a resolution»: a question of the Parliament's own VOTE step, raised by a COLONY, inside a SITTING.
 *
 * WHY THIS SPEC EXISTS (FREEZE ZERO — the autopilot in a real browser, CI run 45464328216, game 55, 2026-11-24;
 * issues #134 · #135 · #136). The delegate grant of a colony is hosted as a Parliament frame INSIDE the colonies that
 * paid it. Here those colonies stand inside the Parliament's own surface (the sitting's stage) — and the Parliament
 * is ONE component: the step asked the DOM to move it into a node inside itself. `HierarchyRequestError`, the section
 * gone, the question on no surface, no verb on the bar; the game went on only by reload.
 *
 * WHAT THE PLAYER HAS NOW. A surface never stands inside itself (`consoleWorkspaceStack.pushWouldNestInItself`): the
 * build lands, the colonies leave, and the SITTING gives its stage to the vote — «ПАРЛАМЕНТ › ГОЛОСОВАНИЕ», past the
 * commit (B = «Свернуть», the same question on return). The delegates sent, the sitting takes its stage back and walks
 * on to its results by itself.
 *
 * The table is fixture `parliament-colony-venus-assembly` (Colony Contest's table with the Venus Next board and the
 * Redux Venus among the colonies). «Done» is the SERVER's word at every step; the hand-over is RECORDED from before
 * the build's press (`armWitness`) — it lasts a moment and no look after the fact can know what stood.
 */
const STAGE = '.con-parl [data-embed-slot="parliament-stage"]';
const GRID = `${STAGE} .con-colonies`;
const FOCUS = `${STAGE} .con-colfocus`;
const VENUS = 'Venus Redux';

type Wire = {
  waitingFor?: {
    type?: string, promptId?: number,
    votePrompt?: {source?: string, count?: number},
    choiceContext?: {source?: {kind?: string, name?: string}},
    parliamentPhasePrompt?: {stage?: string},
  },
};
type Seen = {
  /** The Parliament's own stage, as the section says it (`data-stage`; '' — no Parliament on screen). */
  stage: string,
  /** Parliament surfaces in the document — one component, one node. */
  parls: number,
  /** A Parliament inside a Parliament — what the DOM refused. */
  nested: boolean,
  /** The colonies grid stands in the sitting's zone. */
  grid: boolean,
};

const wire = async (request: APIRequestContext, seat: string): Promise<Wire> => await fetchPlayerModel(request, seat) as unknown as Wire;

test.describe('Colony Contest × the Redux Venus — the delegates of a colony built inside the sitting', () => {
  test('the build lands, the colonies leave, the sitting gives its stage to the vote and takes it back: one Parliament, never inside itself', async ({page, request}) => {
    // (A whole sitting with a hosted build, a vote and its landing: the server's round trips and the walk — never a timing.)
    test.setTimeout(420_000);
    const broken: Array<string> = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (/HierarchyRequestError|vue-error/.test(text)) {
        broken.push(text.slice(0, 240));
      }
    });
    const {playerId} = await bootFixtureSeats(page, request, 'parliament-colony-venus-assembly', {query: '&consoleProfile=auto'});
    await armLeakWitness(page);
    await enterSittingByPass(page, request, playerId);

    // THE WINNER'S COLONY: the colonies stand INSIDE the sitting's stage, and the server asks where.
    await expect(page.locator(GRID), 'the colonies stand in the sitting\'s stage zone').toBeVisible({timeout: 120_000});
    expect((await wire(request, playerId)).waitingFor?.type, 'the server asks the winner\'s colony').toBe('colony');

    // THE HAND-OVER IS RECORDED FROM BEFORE THE BUILD.
    const seen = await armWitness<Seen, {grid: string}>(page, 'venus-sitting', ({grid}) => ({
      stage: document.querySelector('.con-parl')?.getAttribute('data-stage') ?? '',
      parls: document.querySelectorAll('.con-parl').length,
      nested: document.querySelector('.con-parl .con-parl') !== null,
      grid: document.querySelector(grid) !== null,
    }), {args: {grid: GRID}, settled: true});

    // VENUS: the cursor walks to the tile, A descends into its build stage, A builds — «done» is the server's word.
    const venusFocused = page.locator(`${GRID} .con-coltile--focused[data-test="con-colony-${VENUS}"]`);
    const cursorAt = () => page.evaluate((grid) => document.querySelector(`${grid} .con-coltile--focused`)?.getAttribute('data-test') ?? '', GRID);
    await walkFocusUntil(page, async () => await venusFocused.count() > 0, cursorAt, 16, 380);
    await expect.poll(() => venusFocused.count(), {message: 'the cursor stands on the Redux Venus'}).toBeGreaterThan(0);
    expect(await pressUntil(page, 'Enter', async () => await page.locator(FOCUS).count() > 0, {tries: 3, settleMs: 1500}), 'A descends into the build stage').toBe(true);
    const asked = async (): Promise<string> => (await wire(request, playerId)).waitingFor?.type ?? '';
    for (let tries = 0; tries < 3 && await asked() === 'colony' && await page.locator(FOCUS).count() > 0; tries++) {
      await press(page, 'Enter', 1500);
    }
    await expect.poll(asked, {timeout: 30_000, message: 'the server built the colony and asks the tile\'s delegates'}).toBe('party');
    const grant = (await wire(request, playerId)).waitingFor;
    expect(grant?.votePrompt?.source, 'a delegate GRANT').toBe('grant');
    expect(grant?.choiceContext?.source?.kind, 'raised by the colony').toBe('colony');

    // THE SITTING GIVES ITS STAGE TO THE VOTE — once the build has landed and the colonies have left.
    await seen.waitFor((v) => v.stage === 'vote' && !v.grid, {timeoutMs: 90_000, message: 'the vote never took the stage after the colonies left — the grant stood on no surface'});
    const barText = async () => (await page.locator('.con-cmdbar__label').allTextContents()).map((t) => t.trim()).join(' | ');
    await expect.poll(barText, {timeout: 20_000, message: 'A sends the delegates'}).toMatch(/делегат|delegate/i);
    await expect.poll(barText, {message: 'B is «Свернуть» — the question is past the commit'}).toMatch(/свернуть|minimi[sz]e/i);
    await expect.poll(() => crumbText(page), {message: 'ONE crumb: the Parliament, the vote'}).toMatch(/парламент.*голосовани|parliament.*vot/i);
    await expect(page.locator('.con-parl')).toHaveCount(1);

    // B COLLAPSES, A COMES BACK — the same question, never a second trip to the server.
    expect(await pressUntil(page, 'Escape', async () => await page.locator('.con-parl').count() === 0, {tries: 3, settleMs: 1500}), 'B collapses the vote to the board').toBe(true);
    expect((await wire(request, playerId)).waitingFor?.promptId, 'the question still stands').toBe(grant?.promptId);
    expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-parl[data-stage="vote"]').count() > 0, {tries: 3, settleMs: 1500}),
      'A returns to the vote').toBe(true);
    expect((await wire(request, playerId)).waitingFor?.promptId, 'the same question, as it stood').toBe(grant?.promptId);

    // THE DELEGATES ARE SENT — pressed only while the server still asks; «done» is the server moving on.
    await settle(page, {timeoutMs: 30_000});
    for (let tries = 0; tries < 3 && await asked() === 'party' && await page.locator('.con-parl[data-stage="vote"]').count() > 0; tries++) {
      await press(page, 'Enter', 1500);
    }
    await expect.poll(asked, {timeout: 30_000, message: 'the server placed the delegates'}).not.toBe('party');

    // THE SITTING TAKES ITS STAGE BACK and walks to its results by itself; A closes it.
    await seen.waitFor((v) => v.stage === 'sitting', {timeoutMs: 90_000, message: 'the sitting never came back after the vote landed'});
    await expect.poll(() => sittingStage(page), {timeout: 120_000, message: 'the sitting walked on to its results'}).toBe('results');
    await closeSitting(page, request, playerId);

    // ONE PARLIAMENT, ALL THE WAY: never inside itself, never two, the stage handed sitting → vote → sitting.
    expect(await seen.ever((v) => v.nested), 'never a Parliament inside a Parliament').toBe(false);
    expect(await seen.ever((v) => v.parls > 1), 'never two Parliament surfaces').toBe(false);
    expect(await seen.happenedInOrder((v) => (v.stage === 'sitting' ? 'sitting' : v.stage === 'vote' ? 'vote' : 'other'), ['sitting', 'vote', 'sitting']),
      'the stage went sitting → vote → sitting').toBe(true);
    expect(await seen.ever((v) => v.stage === 'vote' && v.grid), 'the vote never stood over the colonies still in the zone').toBe(false);
    await seen.stop();
    expect(broken, 'the DOM refused nothing, no component threw').toEqual([]);
    expect(await strandedReports(page), 'no question was left on no surface').toEqual([]);
  });
});
