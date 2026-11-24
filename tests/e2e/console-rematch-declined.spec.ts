import {test, expect, APIRequestContext, Page} from './consoleTest';
import {walkFocusUntil} from './consoleStart';
import {fixtureTable, journeyToEndgame, waitWithFrames} from './consoleEndgameHarness';
import {readSettled} from './settledRead';

/**
 * THE REMATCH OF TWO HUMAN SEATS — offered, DECLINED, offered again, accepted: the whole vote on the console's
 * results screen, where it is one action of the list («Предложить реванш» → «Отменить · 1/2» → …).
 *
 * WHY THIS SPEC EXISTS (FREEZE ZERO, stage 4 — «the state space is walked, not sampled»): `surface:rematch-layer`
 * stood on the ledger of the UNWALKED (`tests/client/bottle/kernelUnwalked.json` — «a rematch offered and declined by
 * the other seat»). No spec of the suite touched the rematch at all: the autopilot's whole games are solo or against
 * MarsBot, where an offer creates the new game at once and nobody can say no.
 *
 * WHAT ITS FIRST WALK FOUND. The console's rematch layer is headless — the «declined the rematch» toast is the
 * desktop's — so when the other seat declined, the offerer's «Отменить · 1/2» silently turned back into «Предложить
 * реванш»: another player's answer, lost without a word. The action now says who declined.
 *
 * The table is fixture `finale-rich-2p`, brought to its end by the harness. The other seat answers over the API (to
 * this page exactly what another player's console does). «Done» is the SERVER's word at every step — the rematch
 * model of each seat; the page is read by state, never by a pause.
 */
type Rematch = {
  status: string, offeredBy?: string, declinedBy?: string, joinKind?: string, joinId?: string,
  votes: Array<{color: string, name: string, status: string}>,
  viewerColor?: string, viewerMustVote: boolean, viewerIsOfferer: boolean,
};

const rematchOf = async (request: APIRequestContext, seat: string): Promise<Rematch> =>
  await (await request.get(`/api/game/rematch?id=${seat}`)).json() as Rematch;

async function answerAs(request: APIRequestContext, seat: string, action: 'accept' | 'decline'): Promise<void> {
  const res = await request.post(`/api/game/rematch?id=${seat}&action=${action}`);
  expect(res.ok(), `the other seat's «${action}» was taken (status ${res.status()})`).toBeTruthy();
}

const action = (page: Page, id: string) => page.locator(`.con-eg__action[data-eg-action="${id}"]`);
const focusedAction = (page: Page): Promise<string> =>
  page.evaluate(() => document.querySelector('.con-eg__action--focused')?.getAttribute('data-eg-action') ?? '');

/** Walk the results' action list until `id` holds the cursor (each hop verified by the cursor itself). */
async function focusAction(page: Page, id: string): Promise<void> {
  await walkFocusUntil(page, async () => await focusedAction(page) === id, () => focusedAction(page), 12, 400);
  await expect.poll(() => focusedAction(page), {message: `the cursor reaches «${id}»`}).toBe(id);
}

/** A on the focused rematch action — pressed only while the server has not moved to `status` (act → verify → retry). */
async function pressUntilStatus(page: Page, request: APIRequestContext, seat: string, id: string, status: string): Promise<void> {
  for (let tries = 0; tries < 3 && (await rematchOf(request, seat)).status !== status; tries++) {
    await focusAction(page, id);
    await page.keyboard.press('Enter');
    try {
      await expect.poll(async () => (await rematchOf(request, seat)).status, {timeout: 10_000}).toBe(status);
    } catch {
      // not taken (a beat still held the pad): the loop reads the server again and presses only if it still stands
    }
  }
  expect((await rematchOf(request, seat)).status, `A on «${id}» is taken by the server`).toBe(status);
}

test.describe('the rematch of two seats — offered, declined, offered again, accepted', () => {
  test('the other seat declines: the action comes back and SAYS who declined; offered again and accepted, it becomes the way into the new game', async ({page, request}) => {
    // (A whole game brought to its end by the harness, then four server round trips of the vote — never a timing.)
    test.setTimeout(600_000);
    const ids = await fixtureTable(request, 'finale-rich-2p');
    const [viewer, other] = ids;
    await journeyToEndgame(page, request, ids);
    // X hurries the count (the podium is another spec's subject); the settled results hand the pad to the actions.
    await page.keyboard.press('KeyX');
    await waitWithFrames(page, async () => (await page.locator('.con-eg__actions').count()) > 0, 150_000, 'the settled results');
    await expect(action(page, 'rematch-offer'), 'two human seats: the rematch is an OFFER').toHaveCount(1, {timeout: 30_000});
    await expect(action(page, 'rematch-offer').locator('.con-eg__action-note'), 'nothing was declined yet: no note').toHaveCount(0);
    const table = await rematchOf(request, viewer);
    expect(table.votes.length, 'both seats vote').toBe(2);
    const otherName = table.votes.find((vote) => vote.color !== table.viewerColor)?.name ?? '';
    expect(otherName, 'the other seat has a name to be told by').not.toBe('');

    // ── ① THE OFFER: the action turns into its own cancel, with the tally.
    await pressUntilStatus(page, request, viewer, 'rematch-offer', 'offered');
    expect((await rematchOf(request, other)).viewerMustVote, 'the other seat owes its vote').toBe(true);
    await expect(action(page, 'rematch-cancel'), 'the offerer may take the offer back').toHaveCount(1, {timeout: 20_000});
    await expect(action(page, 'rematch-cancel').locator('.con-eg__action-note'), 'the tally: one of two').toHaveText('1/2', {timeout: 20_000});

    // ── ② THE OTHER SEAT DECLINES: the offer is back — and the action says WHO declined.
    await answerAs(request, other, 'decline');
    expect((await rematchOf(request, viewer)).status).toBe('declined');
    await expect(action(page, 'rematch-offer'), 'the offer is the player\'s to make again').toHaveCount(1, {timeout: 30_000});
    await expect(action(page, 'rematch-cancel'), 'the dead offer has nothing to cancel').toHaveCount(0);
    const note = action(page, 'rematch-offer').locator('.con-eg__action-note');
    await expect(note, 'the other seat\'s answer is SAID — never an offer that simply vanished').toContainText(otherName, {timeout: 20_000});
    await expect(note).toContainText(/отказ|declined/i);
    // …inside its plate: the note never spills out of the action or off the screen.
    const fits = await readSettled(page, () => page.evaluate(() => {
      const plate = document.querySelector('.con-eg__action[data-eg-action="rematch-offer"]');
      const text = plate?.querySelector('.con-eg__action-note');
      if (plate === null || plate === undefined || text === null || text === undefined) {
        return false;
      }
      const range = document.createRange();
      range.selectNodeContents(text);
      const ink = range.getBoundingClientRect();
      const box = plate.getBoundingClientRect();
      return ink.width > 0 && ink.left >= box.left - 1 && ink.right <= box.right + 1 && box.right <= window.innerWidth + 1 && box.left >= -1;
    }), {message: 'the declined note inside its action'});
    expect(fits, 'the note is drawn inside its action, inside the screen').toBe(true);

    // ── ③ OFFERED AGAIN, ACCEPTED: the note is gone with the state it described; the action is the way into the new game.
    await pressUntilStatus(page, request, viewer, 'rematch-offer', 'offered');
    await expect(action(page, 'rematch-cancel').locator('.con-eg__action-note'), 'a fresh tally, no stale «declined»').toHaveText('1/2', {timeout: 20_000});
    await answerAs(request, other, 'accept');
    const created = await rematchOf(request, viewer);
    expect(created.status, 'both accepted: the new game exists').toBe('created');
    expect(created.joinId, 'the viewer is told its own seat of the new game').not.toBe(undefined);
    await expect(action(page, 'rematch-join'), 'the action is the way into the new game').toHaveCount(1, {timeout: 30_000});
    await expect(action(page, 'rematch-offer')).toHaveCount(0);
    await expect(action(page, 'rematch-cancel')).toHaveCount(0);
  });
});
