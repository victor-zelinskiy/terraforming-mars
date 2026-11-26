import {test, expect} from './consoleTest';
import {bootFixtureSeats, fetchPlayerModel, openMandatoryAnnounce, press, pressUntil, settle} from './consoleStart';
import {enterSittingByPass} from './parliamentDrive';

/**
 * A PAYOUT PICK INSIDE THE SITTING, SET ASIDE AND TAKEN BACK — it stands again in the sitting's stage, and it answers.
 *
 * WHY THIS SPEC EXISTS (FREEZE ZERO, the autopilot's zero bar — the sixth count, game 1676): the sitting enacted a law
 * whose payout asks «onto which card»; the player pressed B (the sitting folds, its plate says «Вернуться к
 * заседанию»), then A on the plate — and the sitting came back with no pick in its stage: the bar said only «B
 * Свернуть», and B did nothing either. Eight seconds of a deaf screen until the liveness arbiter's ladder cured it
 * (`liveness/stall/presses-no-effect/cardselect/parliament:committed/deaf`).
 *
 * «Done» is the SERVER's word (the pick answered); the pick's presence is the page's (its cards in the stage's zone).
 */
test.describe('a payout pick inside the sitting, set aside and taken back', () => {
  test('B folds the sitting over its pick, A on the plate brings it back — the pick stands in the stage and answers', async ({page, request}) => {
    test.setTimeout(240_000);
    const {playerId} = await bootFixtureSeats(page, request, 'parliament-aquifer-enact', {landing: 'prompt'});
    const asked = async (): Promise<string | undefined> => ((await fetchPlayerModel(request, playerId)) as unknown as {waitingFor?: {type: string}}).waitingFor?.type;
    expect(await asked(), 'the server asks the pick').toBe('card');
    const slots = page.locator('.con-parl [data-embed-slot="parliament-stage"] .con-cards__slot');
    expect(await openMandatoryAnnounce(page), 'A on the plate opens the sitting').toBe(true);
    await expect(slots, 'the pick stands inside the sitting').toHaveCount(2, {timeout: 30_000});
    await settle(page, {timeoutMs: 20_000});
    // B — the sitting folds over its pick (the decision stays live, the plate offers the way back).
    expect(await pressUntil(page, 'Escape', async () => await page.locator('.con-mandatory').count() > 0, {tries: 3, settleMs: 1500}),
      'B folds the sitting — its plate offers the way back').toBe(true);
    await expect(page.locator('.con-mandatory .con-mandatory__open')).toHaveText(/Вернуться к заседанию|Return to the sitting/i);
    // A — back to the sitting: the SAME pick in the same zone.
    expect(await openMandatoryAnnounce(page), 'A on the plate brings the sitting back').toBe(true);
    await expect(slots, 'the pick stands again inside the sitting').toHaveCount(2, {timeout: 30_000});
    // …and it ANSWERS: A on the focused card is the server's answer.
    expect(await pressUntil(page, 'Enter', async () => await asked() !== 'card', {tries: 4, settleMs: 2000}), 'the pick answers').toBe(true);
  });

  test('B folds, A brings it back, and B folds it AGAIN — the way back never goes deaf', async ({page, request}) => {
    test.setTimeout(240_000);
    const {playerId} = await bootFixtureSeats(page, request, 'parliament-aquifer-enact', {landing: 'prompt'});
    const slots = page.locator('.con-parl [data-embed-slot="parliament-stage"] .con-cards__slot');
    expect(await openMandatoryAnnounce(page)).toBe(true);
    await expect(slots).toHaveCount(2, {timeout: 30_000});
    for (let round = 0; round < 2; round++) {
      expect(await pressUntil(page, 'Escape', async () => await page.locator('.con-mandatory').count() > 0, {tries: 3, settleMs: 1500}),
        `round ${round + 1}: B folds the sitting`).toBe(true);
      expect(await openMandatoryAnnounce(page), `round ${round + 1}: A brings it back`).toBe(true);
      await expect(slots, `round ${round + 1}: the pick stands again`).toHaveCount(2, {timeout: 30_000});
      await press(page, 'ArrowRight', 400);
    }
    expect(((await fetchPlayerModel(request, playerId)) as unknown as {waitingFor?: {type: string}}).waitingFor?.type, 'nothing was answered for the player').toBe('card');
  });

  /*
   * …AND THE TABLE's ANSWER TO THE CAREER's STEP — the very question of game 1676 (TR78 Arwind Inc.: the winner's step
   * of the Career pauses the sitting's chain on «add 1 fighter to ANY card», hosted on the sitting's ANSWER layer,
   * `[data-embed-slot="parliament-answer"]`). B over it, A on the plate: the answer layer and its pick stand again.
   */
  test('the table\'s answer to the Career\'s step: B folds the sitting, A brings it back — the pick stands in the answer layer and answers', async ({page, request}) => {
    test.setTimeout(360_000);
    const {playerId} = await bootFixtureSeats(page, request, 'arwind-sitting-win');
    type Wire = {waitingFor?: {type: string, agendaWalkPrompt?: {reason?: string}}};
    const wire = async (): Promise<Wire> => await fetchPlayerModel(request, playerId) as unknown as Wire;
    await enterSittingByPass(page, request, playerId);
    await expect.poll(async () => (await wire()).waitingFor?.agendaWalkPrompt?.reason, {timeout: 60_000, message: 'the winner is asked'}).toBe('phase');
    const pick = page.locator('.con-parl [data-sit-answer-layer] [data-parl-answer][data-tans-mode="question"] [data-embed-slot="parliament-answer"] .con-cards__slot');
    await expect(pick, 'the pick stands in the sitting\'s answer layer').toHaveCount(2, {timeout: 90_000});
    await settle(page, {timeoutMs: 20_000});
    expect(await pressUntil(page, 'Escape', async () => await page.locator('.con-mandatory').count() > 0, {tries: 3, settleMs: 1500}),
      'B folds the sitting — its plate offers the way back').toBe(true);
    expect(await openMandatoryAnnounce(page), 'A on the plate brings the sitting back').toBe(true);
    await expect(pick, 'the pick stands again in the answer layer').toHaveCount(2, {timeout: 30_000});
    expect(await pressUntil(page, 'Enter', async () => (await wire()).waitingFor?.agendaWalkPrompt === undefined, {tries: 4, settleMs: 2000}),
      'the pick answers').toBe(true);
  });

  /*
   * …AND THE CHAIRMAN QUEST's STEP (the same question, `reason: 'quest'`). The quest's flow ends with its section by
   * design (its beats have nowhere to play — `killChairmanQuestBeats`), so a Parliament taken back has no quest to stand
   * the question in: it is served where any live pick is — the card target's own surface. Never deaf: it stands, and
   * it answers.
   */
  test('the chairman quest\'s answer: B folds the Parliament, A brings it back — the pick is served and answers', async ({page, request}) => {
    test.setTimeout(300_000);
    const {playerId} = await bootFixtureSeats(page, request, 'arwind-chairman-quest', {landing: 'prompt'});
    type Wire = {waitingFor?: {type: string, agendaWalkPrompt?: {reason?: string}}};
    const wire = async (): Promise<Wire> => await fetchPlayerModel(request, playerId) as unknown as Wire;
    const pick = page.locator('.con-parl [data-embed-slot="parliament-answer"] .con-cards__slot');
    await expect(page.locator('.con-mandatory'), 'the quest\'s plate').toHaveCount(1, {timeout: 25_000});
    expect(await openMandatoryAnnounce(page), 'A on the plate opens the Parliament').toBe(true);
    await expect(pick, 'the pick stands in the answer stage\'s zone').toHaveCount(2, {timeout: 60_000});
    await settle(page, {timeoutMs: 20_000});
    expect(await pressUntil(page, 'Escape', async () => await page.locator('.con-mandatory').count() > 0, {tries: 3, settleMs: 1500}),
      'B folds the Parliament — its plate offers the way back').toBe(true);
    expect(await openMandatoryAnnounce(page), 'A on the plate brings it back').toBe(true);
    await expect(page.locator('.con-cmdbar'), 'the pick is served — its verb on the bar').toContainText(/Выбрать|Select/, {timeout: 30_000});
    expect(await pressUntil(page, 'Enter', async () => (await wire()).waitingFor?.agendaWalkPrompt === undefined, {tries: 4, settleMs: 2000}),
      'the pick answers').toBe(true);
  });
});
