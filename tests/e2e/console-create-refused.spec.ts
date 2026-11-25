import {test, expect, Page} from './consoleTest';
import {press, pressUntil} from './consoleStart';
import {campaignBase, seedIdentity} from './campaignFixtures';
import {armWitness} from './witness';

/**
 * THE CREATOR REFUSES OUT LOUD — a press on a row that cannot act shakes that row once and opens nothing.
 *
 * WHY THIS SPEC EXISTS (FREEZE ZERO, stage 4 — «the state space is walked, not sampled»): `surface:console-create-game`
 * stood on the ledger of the UNWALKED (`tests/client/bottle/kernelUnwalked.json` — «the game creator, and only on a
 * REFUSED press there»). The creator's scope waits for one thing in its whole life: the end of the refused row's
 * shake (`armShake` — the scope's own `after`). No spec of the suite pressed a row that refuses; every creator spec
 * walks rows that act.
 *
 * The refusal walked here is the product's own: a solo setup against MarsBot keeps ONE human seat, so «Добавить
 * участника» stands disabled WITH ITS REASON on the row (invariant 2: blocked is shown, never hidden) — and A on it
 * says «no» by the row's shake instead of silence. The shake is a transient of 460 ms: RECORDED from before the press
 * (`armWitness`), never sampled after it.
 */
const NAME = 'Alice';
const PROFILE = {viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;

async function toCrewDeck(page: Page): Promise<void> {
  await page.goto(`${campaignBase()}/?x=1${PROFILE.query}`);
  await page.waitForSelector('.cm-menu__items', {timeout: 60_000});
  await page.waitForSelector('.boot-loader', {state: 'detached', timeout: 60_000}).catch(() => undefined);
  expect(await pressUntil(page, 'ArrowDown', async () => await page.locator('.cm-item--cursor').getAttribute('data-menu-item') === 'create',
    {tries: 12, settleMs: 200}), 'the menu cursor reaches «create»').toBe(true);
  await press(page, 'Enter', 200);
  await page.waitForSelector('.cm-mode__tile', {timeout: 30_000});
  await expect(page.locator('.cm-mode__tile--cursor')).toHaveAttribute('data-mode', 'single');
  await press(page, 'Enter', 600);
  await page.waitForSelector('.cm-crew', {timeout: 30_000});
}

test.describe('the creator refuses out loud', () => {
  test.use({viewport: PROFILE.viewport});

  test('A on the disabled «Добавить участника» (solo against MarsBot): the row shakes once, its reason stands, nothing opens', async ({page}) => {
    test.setTimeout(180_000);
    await seedIdentity(page, NAME);
    // A solo setup with the bot — the creator's own saved settings (the same seed the bot editor's spec uses).
    await page.addInitScript((settings) => {
      window.localStorage.setItem('tm_last_game_settings', JSON.stringify(settings));
    }, {gameMode: 'marsbot', players: [{name: NAME, color: 'blue'}], rules: {randomMilestonesAwards: false, randomBoardTiles: false}});
    await toCrewDeck(page);

    const add = page.locator('.cm-row--add');
    await expect(add, 'the add row stands — blocked, never hidden').toHaveCount(1);
    await expect(add, 'and it is disabled').toHaveClass(/cm-row--disabled/);
    await expect(add.locator('.cm-row__issue'), 'with its reason on the row').toContainText('Соло против MarsBot');

    // The cursor onto the add row — walked (the crew is a short ROW of seats, the add tile its last).
    expect(await pressUntil(page, 'ArrowRight', async () => await add.evaluate((el) => el.classList.contains('cm-row--cursor')), {tries: 6, settleMs: 250}),
      'the cursor reaches the add row').toBe(true);

    // A — THE REFUSAL, recorded from before the press: the row's shake, and no overlay behind it.
    const seen = await armWitness<{shake: boolean, overlay: boolean}>(page, 'creator-refusal', () => ({
      shake: document.querySelector('.cm-row--add.cm-row--shake') !== null,
      overlay: document.querySelector('.cm-overlay') !== null,
    }));
    await page.keyboard.press('Enter');
    await seen.waitFor((v) => v.shake, {timeoutMs: 15_000, message: 'A on a disabled row said nothing — the row never shook'});
    await seen.waitFor((v) => !v.shake, {timeoutMs: 15_000, message: 'the shake never ended'});
    const record = await seen.stop();
    expect(record.some((sample) => sample.v.overlay), 'nothing opened behind the refusal').toBe(false);

    // The creator stands as it stood: the same row under the cursor, still disabled, still naming why.
    await expect(add).toHaveClass(/cm-row--cursor/);
    await expect(add).toHaveClass(/cm-row--disabled/);
    await expect(page.locator('.cm-overlay'), 'no type picker').toHaveCount(0);
    // …and the refusal can be asked again: the shake is one-shot, re-armed by the next press.
    const again = await armWitness<boolean>(page, 'creator-refusal-again', () => document.querySelector('.cm-row--add.cm-row--shake') !== null);
    await page.keyboard.press('Enter');
    await again.waitFor((v) => v, {timeoutMs: 15_000, message: 'a second A on the disabled row said nothing'});
    await again.waitFor((v) => !v, {timeoutMs: 15_000, message: 'the second shake never ended'});
    await again.stop();
  });
});
