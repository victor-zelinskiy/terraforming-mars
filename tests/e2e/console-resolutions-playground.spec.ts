import {test, expect, Page} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {openZoomViewer, press} from './consoleStart';

/**
 * THE REDUX RESOLUTIONS PLAYGROUND («Полигон» → «Витрина резолюций Redux»;
 * deep link `?resolutionsPlayground`): the catalog comes from the client
 * manifest (Aquifer Contest RX01 first); the SCENARIOS reproduce influence 0 /
 * 1 / several, the winner's Agenda step counted before the enactment,
 * influence beyond the track, a forfeited payout, a recorded payout and a
 * spectator; the pad moves one parameter at a time (View the test player,
 * A influence, Y the context, L3 the winner); X opens the REAL fullscreen
 * viewer reading the stand's table; the shared recipient picker stands with a
 * resolution source; no profile shows a native scrollbar. Screenshots under
 * screenshots/resolutions-playground/<preset>/.
 */
const OUT_ROOT = path.resolve('screenshots', 'resolutions-playground');

async function shoot(page: Page, preset: string, name: string): Promise<void> {
  const dir = path.join(OUT_ROOT, preset);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

type Reading = {context: string | null, influence: string | null, amount: string | null, skipped: string | null};

const readingsIn = (page: Page, scope: string) => page.evaluate((sel) => {
  return Array.from(document.querySelectorAll<HTMLElement>(`${sel} [data-yield-context]`)).map((el) => ({
    context: el.getAttribute('data-yield-context'),
    influence: el.getAttribute('data-yield-influence'),
    amount: el.getAttribute('data-yield-amount'),
    skipped: el.getAttribute('data-yield-skipped'),
  }));
}, scope) as Promise<Array<Reading>>;

const heroReadings = (page: Page) => readingsIn(page, '[data-rxpg-yield]');
const seatReadings = (page: Page, color: string) => readingsIn(page, `[data-rxpg-seat="${color}"]`);

const reading = (context: string, influence: number, amount: number, skipped: string | null = null): Reading =>
  ({context, influence: String(influence), amount: String(amount), skipped});

async function expectScenario(page: Page, key: string): Promise<void> {
  await expect(page.locator(`[data-rxpg-scenario="${key}"]`)).toHaveClass(/con-rxpg__scenario--active/);
}

const PRESETS = [
  {id: 'standard-1080', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'tv-4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
  {id: 'deck-handheld', viewport: {width: 1280, height: 800}, query: '&consoleProfile=handheld'},
] as const;

for (const preset of PRESETS) {
  test.describe(`resolutions playground · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`the catalog, the scenarios, the fullscreen and the shared picker follow the pad (${preset.id})`, async ({page}) => {
      test.setTimeout(240_000);
      await page.goto(`/?resolutionsPlayground${preset.query}`);
      await expect(page.locator('.cm-stand')).toHaveCount(1, {timeout: 30_000});
      await expect(page.locator('[data-resolutions-playground]')).toHaveCount(1, {timeout: 30_000});

      // ── The catalog: the real resolution leads, its code printed on the face and under it.
      const first = page.locator('[data-rxpg-catalog] .con-rxpg__slot').first();
      await expect(first).toHaveAttribute('data-rxpg-code', 'RX01');
      await expect(first).toHaveClass(/con-rxpg__slot--cursor/);
      await expect(first.locator('.pcard__code')).toHaveText('RX01');
      await expect(first.locator('.pcard')).toHaveClass(/pcard--resolution-art/);
      await expect.poll(() => first.locator('.pcard__art img').evaluate((img) => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0), {timeout: 15_000}).toBe(true);
      await shoot(page, preset.id, '00-catalog');
      // RB: the stand's sections — the face at the game's sizes, then the instrument.
      await press(page, 'BracketRight', 700);
      await shoot(page, preset.id, '00b-sizes');
      await press(page, 'BracketRight', 700);

      // ── Default scenario «influence 3»: a live payout of 3 for test player A; B (the winner) is paid
      //    by ITS OWN influence after its Agenda step (1 → 2 = influence 1) and carries the winner's part.
      await expectScenario(page, 'influence-3');
      expect(await heroReadings(page)).toEqual([reading('resolving', 3, 3)]);
      expect(await seatReadings(page, 'blue')).toEqual([reading('resolving', 3, 3)]);
      expect(await seatReadings(page, 'red')).toEqual([reading('resolving', 1, 1)]);
      await expect(page.locator('[data-rxpg-seat="red"] [data-rxpg-seat-advance]')).toHaveCount(1);
      await expect(page.locator('[data-rxpg-seat="red"] [data-rxpg-seat-winner-part]')).toHaveCount(1);
      // The shared picker with the resolution source: four holders, the dock naming the resolution with its code.
      await expect(page.locator('[data-rxpg-picker] .con-ptsel')).toHaveCount(1);
      await expect(page.locator('[data-rxpg-picker] .con-src__card--resolution .pcard__code')).toHaveText('RX01');
      await shoot(page, preset.id, '01-influence-3');

      // ── RT: «the winner advances on the Agenda first» — Agenda 4 (influence 2) → step 5 (influence 3) BEFORE the payout.
      await press(page, 'Period', 400);
      await expectScenario(page, 'winner-agenda');
      expect(await heroReadings(page)).toEqual([reading('resolving', 3, 3)]);
      await expect(page.locator('[data-rxpg-agenda]')).toHaveClass(/con-rxpg__agenda--advanced/);
      await expect(page.locator('[data-rxpg-seat="blue"] [data-rxpg-seat-advance]')).toHaveCount(1);
      await shoot(page, preset.id, '02-winner-agenda');
      // Y: the context cycles — applied (the RECORDED 3), reference (the formula alone), proposal (the estimate 2 and,
      // apart from it, the «if you win» forecast at Agenda step 5 = 3).
      await press(page, 'KeyY', 400);
      expect(await heroReadings(page)).toEqual([reading('applied', 3, 3)]);
      await press(page, 'KeyY', 400);
      expect(await heroReadings(page)).toEqual([]);
      await expect(page.locator('[data-rxpg-yield] .con-iyield__formula')).toHaveCount(1);
      await expect(page.locator('[data-rxpg-seats]')).toHaveCount(0);
      await press(page, 'KeyY', 400);
      expect(await heroReadings(page)).toEqual([reading('estimate', 2, 2), reading('forecast', 3, 3)]);
      await shoot(page, preset.id, '03-winner-agenda-proposal');

      // ── RT: influence beyond the track rides along — Agenda 4 + 1 = 3 now, step 5 + 1 = 4 if the vote is won.
      await press(page, 'Period', 400);
      await expectScenario(page, 'beyond-track');
      expect(await heroReadings(page)).toEqual([reading('estimate', 3, 3), reading('forecast', 4, 4)]);

      // ── RT: no eligible card — the payout keeps its size and names the skip; the picker yields to the skip line.
      await press(page, 'Period', 400);
      await expectScenario(page, 'no-recipient');
      expect(await heroReadings(page)).toEqual([reading('resolving', 2, 2, 'No card can hold animals')]);
      await expect(page.locator('[data-rxpg-skip]')).toHaveCount(1);
      await expect(page.locator('[data-rxpg-picker] .con-ptsel')).toHaveCount(0);
      await shoot(page, preset.id, '04-no-recipient');

      // ── RT: the recorded payout — A received 3 (after the winner's step), B's zero influence is a named skip.
      await press(page, 'Period', 400);
      await expectScenario(page, 'applied');
      expect(await heroReadings(page)).toEqual([reading('applied', 3, 3)]);
      expect(await seatReadings(page, 'red')).toEqual([reading('applied', 0, 0, 'No influence')]);

      // ── RT: a spectator reads the formula alone; the seats still show their own numbers; the picker says why it is silent.
      await press(page, 'Period', 400);
      await expectScenario(page, 'spectator');
      await expect(page.locator('[data-rxpg-player="spectator"]')).toHaveCount(1);
      expect(await heroReadings(page)).toEqual([]);
      await expect(page.locator('[data-rxpg-seats] [data-rxpg-seat]')).toHaveCount(2);
      await expect(page.locator('[data-rxpg-skip]')).toHaveCount(1);

      // ── RT wraps: influence 0 — nothing is owed, nothing is asked, the skip is named.
      await press(page, 'Period', 400);
      await expectScenario(page, 'influence-0');
      expect(await heroReadings(page)).toEqual([reading('resolving', 0, 0, 'No influence')]);
      await expect(page.locator('[data-rxpg-skip]')).toHaveCount(1);
      await shoot(page, preset.id, '05-influence-0');

      // ── RT: influence 1 — one animal.
      await press(page, 'Period', 400);
      await expectScenario(page, 'influence-1');
      expect(await heroReadings(page)).toEqual([reading('resolving', 1, 1)]);
      await expect(page.locator('[data-rxpg-picker] .con-ptsel')).toHaveCount(1);
      // RB: the shared picker section — LT walks its cursor (the focused holder's own «current → resulting» and VP).
      await press(page, 'BracketRight', 700);
      await press(page, 'Comma', 400);
      await shoot(page, preset.id, '05b-picker');
      await press(page, 'BracketLeft', 700);

      // ── View: the test player is B (the winner: Agenda 5 → 6 = influence 3); the scenario is marked modified.
      await press(page, 'KeyR', 400);
      await expect(page.locator('[data-rxpg-player="red"]')).toHaveCount(1);
      await expect(page.locator('[data-rxpg-modified]')).toHaveCount(1);
      expect(await heroReadings(page)).toEqual([reading('resolving', 3, 3)]);
      // A: B's influence 3 → 4 (Agenda 8, the winner's step to 9 keeps 4).
      await press(page, 'Enter', 400);
      await expect(page.locator('[data-rxpg-influence]')).toHaveText('4');
      expect(await heroReadings(page)).toEqual([reading('resolving', 4, 4)]);
      // L3: the winner cycles B → neutral — nobody advances, nobody takes the winner's part.
      await press(page, 'KeyC', 400);
      await expect(page.locator('[data-rxpg-winner="neutral"]')).toHaveCount(1);
      await expect(page.locator('[data-rxpg-seat-winner-part]')).toHaveCount(0);
      expect(await heroReadings(page)).toEqual([reading('resolving', 4, 4)]);

      // ── Y ×3 → proposal; X: the REAL fullscreen viewer — party left, rules right, the test player's estimate in the footer.
      await press(page, 'KeyY', 300);
      await press(page, 'KeyY', 300);
      await press(page, 'KeyY', 300);
      await expect(page.locator('[data-rxpg-context]')).toHaveText(/Предложение|Proposal/);
      // LB back to the catalog, so the viewer lifts the cursored face out of its visible slot.
      await press(page, 'BracketLeft', 500);
      await press(page, 'BracketLeft', 700);
      await openZoomViewer(page, 'KeyX');
      const zoom = page.locator('dialog.con-zoom.con-zoom--parliament');
      await expect(zoom).toHaveCount(1, {timeout: 10_000});
      await expect(zoom.locator('.con-zoom-asidecol')).toHaveCount(1, {timeout: 10_000});
      await expect(zoom.locator('.con-zoom-sidecol')).toHaveCount(1);
      await expect(zoom.locator('.pcard__code').first()).toHaveText('RX01');
      await expect.poll(() => readingsIn(page, 'dialog.con-zoom [data-zoom-yield]'), {timeout: 10_000}).toEqual([reading('estimate', 4, 4)]);
      // The open flight has landed (the viewer drops its flight class at touchdown).
      await expect(page.locator('dialog.con-zoom.con-zoom--parliament[open]:not(.con-zoom--flight)')).toHaveCount(1, {timeout: 10_000});
      await shoot(page, preset.id, '06-fullscreen');
      await press(page, 'Escape', 900);
      await expect(zoom).toHaveCount(0, {timeout: 10_000});
      await expect(page.locator('.cm-stand')).toHaveCount(1);

      // ── ▶: the next catalog entry (a dummy — no scaled part, the instrument says so).
      await press(page, 'ArrowRight', 400);
      await expect(page.locator('[data-rxpg-catalog] .con-rxpg__slot').nth(1)).toHaveClass(/con-rxpg__slot--cursor/);
      await expect(page.locator('[data-rxpg-yield-none]')).toHaveCount(1);

      // No native scrollbar anywhere on the stand (the console rule).
      const overflow = await page.evaluate(() => {
        const out: Array<string> = [];
        for (const el of Array.from(document.querySelectorAll<HTMLElement>('.cm-stand *'))) {
          const style = getComputedStyle(el);
          if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 1 && !el.classList.contains('con-scroll-area__viewport')) {
            out.push(el.className.toString().split(' ')[0]);
          }
        }
        return out;
      });
      expect(overflow, 'only the stand\'s own scroll area scrolls').toEqual([]);
    });
  });
}
