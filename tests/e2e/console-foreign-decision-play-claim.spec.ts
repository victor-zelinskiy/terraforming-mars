import {test, expect, Page, APIRequestContext} from './consoleTest';
import {NO_PAYMENT, bootFixtureSeats, fetchPlayerModel, playCardFromHand} from './consoleStart';

/**
 * THE FOREIGN DECISION A PLAY'S CLAIM ADOPTED (the owner's field lock of 2026-11-02, game-pdb745eb: «при розыгрыше
 * "Обсерватории Лагранжа" после забора карты workspace завис и его даже нельзя закрыть»).
 *
 * The field chain: blue's SECOND action is a draw card played from the hand → the turn passes (the server asks blue
 * nothing) → another seat places an ocean → blue's Neptunian Power Consultants asks «pay 5 M€?». The hand stood
 * `committed` on the stage «ЭФФЕКТ» with an EMPTY body for minutes: the play's optimistic `effect` claim (kept alive by
 * its own draw landing) adopted a decision of ANOTHER seat's chain, the decision was not the answer to blue's press so
 * the announce gate held it — and the announce was never shown, because the workspace owned the question.
 *
 * The stand replays it with red as the other seat over the API, fired the moment blue's turn passes. The question must
 * be ANNOUNCED where the player stands — the chip's beacon over the hand they are reading (never forced open over it:
 * focus is the player's, the owner 2026-11-02), or the plate / the decision itself — and answerable by the player's
 * own road: leave the hand, A on the plate, the decision.
 *
 * Functional class.
 */

const TV = {width: 3840, height: 2160};
const QUERY = '&consoleProfile=tv';

type Wf = {type?: string, title?: string | {message?: string}, promptId?: number, options?: Array<{title?: string | {message?: string}}>, spaces?: Array<string>, choiceContext?: {source?: {card?: string}}};

const titleOf = (o: {title?: string | {message?: string}}) => typeof o.title === 'string' ? o.title : o.title?.message;

async function waitingOf(request: APIRequestContext, seat: string): Promise<Wf | undefined> {
  return (await fetchPlayerModel(request, seat) as {waitingFor?: Wf}).waitingFor;
}

async function answer(request: APIRequestContext, seat: string, body: unknown): Promise<void> {
  const post = await request.post(`/player/input?id=${seat}`, {data: body});
  expect(post.ok(), `the answer was accepted (${post.status()} ${await post.text().catch(() => '')})`).toBeTruthy();
}

/** Red's ocean, the moment blue's turn passes: Subterranean Reservoir, its ocean on the first legal cell. */
async function redOceanWhenBlueDone(request: APIRequestContext, blue: string, red: string): Promise<number> {
  const started = Date.now();
  let blueAsked = false;
  for (;;) {
    const blueWf = await waitingOf(request, blue);
    const redWf = await waitingOf(request, red);
    blueAsked ||= blueWf?.type === 'or';
    if (blueAsked && blueWf === undefined && (redWf?.options ?? []).some((o) => titleOf(o) === 'Play project card')) {
      break;
    }
    if (Date.now() - started > 60_000) {
      throw new Error(`blue's turn never passed (blue ${blueWf?.type}, asked before: ${blueAsked} · red ${redWf?.type}: ${titleOf(redWf ?? {})} [${(redWf?.options ?? []).map(titleOf).join(' · ')}])`);
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  const menu = await waitingOf(request, red);
  const index = (menu?.options ?? []).findIndex((o) => titleOf(o) === 'Play project card');
  expect(index, 'red can play a card').toBeGreaterThanOrEqual(0);
  await answer(request, red, {type: 'or', index, response: {type: 'projectCard', card: 'Subterranean Reservoir', payment: {...NO_PAYMENT, megacredits: 11}}});
  const ask = await waitingOf(request, red);
  expect(ask?.type, 'red is asked the ocean').toBe('space');
  await answer(request, red, {type: 'space', spaceId: ask!.spaces![0]});
  return Date.now() - started;
}

type Screen = {decision: boolean, plate: boolean, task: boolean, hand: boolean, beacon: boolean, crumb: string, ready: unknown};

/** What stands on screen, as DATA — the spec decides on it. (It used to be a JSON string sliced to 2500 characters for the
 *  log, and the spec PARSED that slice: once `__conReady()` grew, every read was cut mid-string and threw — CI 2026-11-03,
 *  red on all three attempts before a single assertion ran.) */
async function screenOf(page: Page): Promise<Screen> {
  return page.evaluate(() => {
    const vis = (s: string) => [...document.querySelectorAll<HTMLElement>(s)].some((e) => e.getClientRects().length > 0);
    const ready = (window as unknown as {__conReady?: () => unknown}).__conReady?.();
    return {
      decision: vis('.con-decision'), plate: vis('.con-mandatory'), task: vis('.con-task-host'), hand: vis('.con-hand'),
      beacon: vis('.con-status__beacon'),
      crumb: document.querySelector('.con-wshead')?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      ready,
    };
  });
}

/** The same picture for a MESSAGE — capped, never parsed. */
async function screenText(page: Page): Promise<string> {
  return JSON.stringify(await screenOf(page)).slice(0, 2500);
}

test.describe('a foreign decision is never adopted by the play that happened to be landing', () => {
  test.use({viewport: TV});

  test('Lagrange Observatory as the second action, red\'s ocean wakes Neptunian: the decision stands on screen and is answered', async ({page, request}) => {
    test.setTimeout(300_000);
    const {seats} = await bootFixtureSeats(page, request, 'npc-remote-ocean-draw', {query: QUERY});
    const [blue, red] = seats;
    const ocean = redOceanWhenBlueDone(request, blue, red);
    expect(await playCardFromHand(page, 'Lagrange Observatory'), 'blue played Lagrange Observatory').toBe(true);
    console.log(`[foreign-decision] red's ocean ${await ocean} ms after the press loop started`);

    // The server asks blue the Neptunian question.
    await expect.poll(async () => (await waitingOf(request, blue))?.choiceContext?.source?.card ?? '',
      {timeout: 30_000, message: 'red\'s ocean woke blue\'s Neptunian Power Consultants'}).toBe('Neptunian Power Consultants');
    const asked = (await waitingOf(request, blue))!.promptId;

    // The DRAWN CARD is the player's first: while it stands to be taken («Получена карта», A «Взять») the question waits
    // behind it (the reveal holds the announcement's first presentation) and is never opened over it — then the player
    // takes it, as on the field («после забора карты»).
    const announced = () => page.locator('.con-status__beacon, .con-mandatory, .con-decision, .con-task-host').first();
    for (let i = 0; i < 8 && !await announced().isVisible().catch(() => false); i++) {
      const now = await screenOf(page);
      expect(now.hand && now.decision, 'the question is not forced open over the card being taken').toBe(false);
      await page.keyboard.press('Enter');
      await new Promise((r) => setTimeout(r, 1500));
    }

    // …and it is ANNOUNCED where the player stands: the chip's beacon over the hand, the plate on the board home, or the
    // decision itself — never an empty workspace with no announcement anywhere.
    const shown = await expect(announced(), 'the question is announced').toBeVisible({timeout: 25_000}).then(() => true, () => false);
    if (!shown) {
      console.log('[foreign-decision] stranded screen', await screenText(page));
    }
    expect(shown, `the Neptunian question is announced — ${await screenText(page)}`).toBe(true);
    // The hand the player reads is never taken from under them by the question.
    const first = await screenOf(page);
    console.log('[foreign-decision] announced as', await screenText(page));
    expect(first.hand && first.decision, 'the question is not forced open over the hand being read').toBe(false);

    // …and the player answers by their own road: B leaves the hand, A opens the plate, A answers the decision.
    for (let i = 0; i < 10 && (await waitingOf(request, blue))?.promptId === asked; i++) {
      const now = await screenOf(page);
      // A YES / NO keeps its two cards (Neptunian is one): A answers the focused card; the task host declines on RT.
      await page.keyboard.press(now.plate || now.decision ? 'Enter' : now.task ? 'Period' : 'Escape');
      await new Promise((r) => setTimeout(r, 1500));
    }
    expect((await waitingOf(request, blue))?.promptId, `the question was answered from the screen — ${await screenText(page)}`).not.toBe(asked);
  });
});
