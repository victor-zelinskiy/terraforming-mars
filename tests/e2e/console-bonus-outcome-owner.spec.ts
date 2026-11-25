import {test, expect, APIRequestContext, Page} from './consoleTest';
import {
  NO_PAYMENT, corporationsExcluding, createGameWithCards, fetchPlayerModel, openConsole, openQuickWheel, pressUntil, seedGameOverApi,
  sendPlayerInput, soloGameConfig,
} from './consoleStart';

/**
 * THE OPENING WAITS BEHIND THE OUTCOME OF ITS OWN BONUS ACTION — and the one-owner law says so.
 *
 * WHY THIS SPEC EXISTS (FREEZE ZERO, stage 6 — the third hundred of whole games, game 906, 2026-11-25). «Фора» gives
 * two ordinary actions in the middle of the preludes. The player spends the LAST of them on «Поиск жизни»: the answer
 * that carries the verdict of the revealed card is the very one that ends the window — the server already asks for
 * the second prelude. The product does the right thing: the verdict is the player's to read, and the start's frame
 * stays off the stack until they have (`startFrameLive`'s first hold). But that hold was known to the frame's door
 * alone: the function of the one owner (`servingOwnerOf`) read «the start serves» over the verdict, so the measure
 * named the press a MISS (`pad-MISS:sheet:cardActions` · `band-APART:own:start>sheet:cardActions`) — a false alarm
 * of the kind the owner's bar forbids, and a band word that named a surface which was not there.
 *
 * The law now: `startReturnBehindOutcome()` is ONE answer with two readers — the door, and the question's facts
 * (`QuestionFacts.startBehind` → the start owns the question, held `scene · outcome:<workspace>`).
 *
 * «Done» is the SERVER's word throughout (the bonus ledger, the prelude's marker); every press is act → verify → retry.
 */
const HEAD_START = 'Head Start';
const OTHER_PRELUDE = 'Allied Bank';
const SEARCH = 'Search For Life';

type Wire = {
  waitingFor?: {
    type?: string, promptId?: number, title?: unknown, startGamePrompt?: {kind?: string}, bonusActionPrompt?: unknown,
    options?: Array<{title?: unknown, type?: string, cards?: Array<{name: string, calculatedCost?: number}>}>,
  },
  thisPlayer: {bonusActions?: number, tableau?: Array<{name: string}>},
};
type OwnerLog = {rows: Record<string, Record<string, number>>, disagreements: Array<{what?: string}>};

const wire = async (request: APIRequestContext, seat: string): Promise<Wire> => await fetchPlayerModel(request, seat) as unknown as Wire;
const titleText = (title: unknown): string => (typeof title === 'string' ? title : String((title as {message?: string} | undefined)?.message ?? ''));
const ownerLog = (page: Page): Promise<OwnerLog> =>
  page.evaluate(() => (window as unknown as {__conServingOwner: () => OwnerLog}).__conServingOwner());
const bar = (page: Page): Promise<string> =>
  page.evaluate(() => (document.querySelector('.con-cmdbar')?.textContent ?? '').replace(/\s+/g, ' ').trim());

test.describe('the opening waits behind the outcome of its own bonus action', () => {
  test('«Фора» → «Поиск жизни»: the verdict stands with the second prelude already asked — the start owns the question and WAITS; A takes the verdict, and the start comes back', async ({page, request}) => {
    test.setTimeout(240_000);
    const playerId = await createGameWithCards(request, [SEARCH], {
      config: soloGameConfig({
        expansions: {corpera: true, promo: true, prelude: true},
        customPreludes: [HEAD_START, OTHER_PRELUDE],
        customCorporationsList: corporationsExcluding(),
        startingPreludes: 2,
      }),
    });
    // The pregame over the API, to the first BONUS action («Фора» played first, the other prelude still in hand).
    await seedGameOverApi(request, playerId, {preludes: [HEAD_START, OTHER_PRELUDE], first: HEAD_START, cards: [SEARCH], buy: 2});
    const menu = (await wire(request, playerId)).waitingFor;
    expect(menu?.bonusActionPrompt, 'the server stands on the bonus action menu').toBeDefined();

    // THE FIRST BONUS ACTION, before the page exists (nobody's partial input to protect): «Поиск жизни» is played.
    const play = (menu?.options ?? []).findIndex((option) => titleText(option.title) === 'Play project card');
    expect(play, 'the bonus menu offers the hand').toBeGreaterThanOrEqual(0);
    const card = (menu?.options?.[play].cards ?? []).find((offered) => offered.name === SEARCH);
    expect(card, '«Поиск жизни» is playable').toBeDefined();
    await sendPlayerInput(request, playerId, {
      type: 'or', index: play, promptId: menu?.promptId,
      response: {type: 'projectCard', card: SEARCH, payment: {...NO_PAYMENT, megacredits: card?.calculatedCost ?? 3}},
    } as never);
    await expect.poll(async () => {
      const now = await wire(request, playerId);
      return `${now.thisPlayer.bonusActions}|${(now.thisPlayer.tableau ?? []).some((played) => played.name === SEARCH)}|${now.waitingFor?.bonusActionPrompt !== undefined}`;
    }, {timeout: 30_000, message: 'one bonus action left, the card on the table, the bonus menu again'}).toBe('1|true|true');

    await openConsole(page, playerId);
    // THE WINDOW's STAGE («2/2») hands the board over — A, verified by the start leaving the screen.
    await expect(page.locator('.con-start__bonusact'), 'the workspace announces the trip').toBeVisible({timeout: 30_000});
    expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-start__frame').count() === 0, {tries: 4, settleMs: 1500}),
      'A hands the board over').toBe(true);

    // THE LAST BONUS ACTION, by the pad: RT → ↑ «Действия карт» → A «Выполнить» → A «Подтвердить».
    await openQuickWheel(page);
    const frames = (): Promise<string> =>
      page.evaluate(() => (window as unknown as {__conReady: () => {wsFrames?: Array<string>}}).__conReady().wsFrames?.join(',') ?? '');
    expect(await pressUntil(page, 'ArrowUp', async () => (await frames()).startsWith('card-actions'), {tries: 3, settleMs: 1500}),
      'the ↑ of the wheel opens the card actions').toBe(true);
    expect(await pressUntil(page, 'Enter', async () => /Подтвердить/.test(await bar(page)), {tries: 4, settleMs: 1500}),
      'A «Выполнить» opens the set-up of the action').toBe(true);
    // («Done» is the SERVER's word: the window is spent — it asks for the second prelude.)
    expect(await pressUntil(page, 'Enter', async () => (await wire(request, playerId)).waitingFor?.startGamePrompt?.kind === 'preludeSelection', {tries: 3, settleMs: 6_000}),
      'A «Подтвердить»: the action is performed, the server asks for the second prelude').toBe(true);

    // THE VERDICT STANDS — the acting workspace's own outcome — and the start has NOT come back over it.
    await expect.poll(() => bar(page), {timeout: 30_000, message: 'the verdict\'s bar'}).toMatch(/A\s*ОК/);
    await expect(page.locator('.con-start__frame'), 'the start waits behind the verdict').toHaveCount(0);
    await expect.poll(frames, {timeout: 15_000, message: 'the card actions hold the stack'}).toMatch(/^card-actions/);

    // A — THE VERDICT IS TAKEN. The press was the outcome's, and the function of the one owner says so.
    expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-start__frame').count() > 0, {tries: 5, settleMs: 2500}),
      'A takes the verdict — and the start comes back for the prelude').toBe(true);
    const log = await ownerLog(page);
    expect(log.disagreements.map((entry) => entry.what ?? ''), 'the one-owner law: nothing parted').toEqual([]);
    const pad = Object.keys(log.rows['pad:startSequence'] ?? {});
    expect(pad.filter((verdict) => verdict.startsWith('pad-MISS')), 'no press of the opening\'s question was a MISS').toEqual([]);
    expect(pad.some((verdict) => verdict.startsWith('pad-held:scene')), `the press over the verdict was read «held behind the outcome» (${pad.join(' · ')})`).toBe(true);

    // …AND THE OPENING GOES ON: the second prelude is the start's to play.
    await expect.poll(() => bar(page), {timeout: 30_000, message: 'the start offers the prelude'}).toMatch(/Разыграть/);
    expect((await wire(request, playerId)).waitingFor?.startGamePrompt?.kind, 'the server still asks for the prelude').toBe('preludeSelection');
  });
});
