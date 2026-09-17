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

/** A COUNTED reading: every input the number stands on (the count, the influence, the sum before the cap, the MAX mark). */
type Counted = {context: string | null, count: string | null, influence: string | null, amount: string | null, uncapped: string | null, max: string | null, skipped: string | null};

const countedIn = (page: Page, scope: string) => page.evaluate((sel) => {
  return Array.from(document.querySelectorAll<HTMLElement>(`${sel} [data-yield-context]`)).map((el) => ({
    context: el.getAttribute('data-yield-context'),
    count: el.getAttribute('data-yield-count'),
    influence: el.getAttribute('data-yield-influence'),
    amount: el.getAttribute('data-yield-amount'),
    uncapped: el.getAttribute('data-yield-uncapped'),
    max: el.getAttribute('data-yield-max'),
    skipped: el.getAttribute('data-yield-skipped'),
  }));
}, scope) as Promise<Array<Counted>>;

const counted = (context: string, count: number, influence: number, amount: number, uncapped: number, skipped: string | null = null): Counted => ({
  context, count: String(count), influence: String(influence), amount: String(amount), uncapped: String(uncapped),
  max: amount >= 5 && skipped === null ? 'true' : null, skipped,
});

/** Each card of a seat's synthetic tableau with the shared predicate's verdict. */
const tableauOf = (page: Page, color: string) => page.evaluate((c) => {
  return Array.from(document.querySelectorAll<HTMLElement>(`[data-rxpg-tableau="${c}"] [data-rxpg-card]`))
    .map((el) => `${el.getAttribute('data-rxpg-card')}:${el.getAttribute('data-rxpg-counts')}`);
}, color);
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

      // ── The catalog: the real resolution leads, its code printed UNDER the face (the stand's own catalog key) —
      //    the face itself follows «Настройки» → «Номера карт», OFF by default.
      const first = page.locator('[data-rxpg-catalog] .con-rxpg__slot').first();
      await expect(first).toHaveAttribute('data-rxpg-code', 'RX01');
      await expect(first.locator('.con-rxpg__code')).toHaveText('RX01');
      await expect(first).toHaveClass(/con-rxpg__slot--cursor/);
      await expect(page.locator('[data-resolutions-playground] .pcard__code'), 'no face stamps its number by default').toHaveCount(0);
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
      // The shared picker with the resolution source: four holders, the dock drawing the resolution's face.
      await expect(page.locator('[data-rxpg-picker] .con-ptsel')).toHaveCount(1);
      await expect(page.locator('[data-rxpg-picker] .con-src__card--resolution .pcard')).toHaveCount(1);
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
      await expect(zoom.locator('.card-zoom-stage .pcard').first(), 'the resolution on the stage').toHaveClass(/rdx-greens-aquifer-contest/);
      await expect.poll(() => readingsIn(page, 'dialog.con-zoom [data-zoom-yield]'), {timeout: 10_000}).toEqual([reading('estimate', 4, 4)]);
      // The open flight has landed (the viewer drops its flight class at touchdown).
      await expect(page.locator('dialog.con-zoom.con-zoom--parliament[open]:not(.con-zoom--flight)')).toHaveCount(1, {timeout: 10_000});
      await shoot(page, preset.id, '06-fullscreen');
      await press(page, 'Escape', 900);
      await expect(zoom).toHaveCount(0, {timeout: 10_000});
      await expect(page.locator('.cm-stand')).toHaveCount(1);

      // ── ▶ ▶: past the second real resolution (RX02), the next catalog entry is a dummy — no scaled part, the instrument says so.
      await press(page, 'ArrowRight', 400);
      await expect(page.locator('[data-rxpg-catalog] .con-rxpg__slot').nth(1)).toHaveAttribute('data-rxpg-code', 'RX02');
      await press(page, 'ArrowRight', 400);
      await expect(page.locator('[data-rxpg-catalog] .con-rxpg__slot').nth(2)).toHaveClass(/con-rxpg__slot--cursor/);
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

    test(`Architecture Award: the counted family — real cards through the shared predicate, the cap on the sum, every seat, the quest (${preset.id})`, async ({page}) => {
      test.setTimeout(240_000);
      await page.goto(`/?resolutionsPlayground${preset.query}`);
      await expect(page.locator('[data-resolutions-playground]')).toHaveCount(1, {timeout: 30_000});
      // ▶: RX02 — its own art, the counted object drawn as a CARD with a VP plate on the face.
      await press(page, 'ArrowRight', 500);
      const slot = page.locator('[data-rxpg-catalog] .con-rxpg__slot').nth(1);
      await expect(slot).toHaveAttribute('data-rxpg-code', 'RX02');
      await expect(slot).toHaveClass(/con-rxpg__slot--cursor/);
      await expect(slot.locator('.pcard')).toHaveClass(/pcard--resolution-art/);
      await expect(slot.locator('.pcard__mech .pvpcard[data-vp-card-tag="building"]')).toHaveCount(1);
      await press(page, 'BracketRight', 700);
      // The inspector's columns name the counted cards for the test player (the rules panel).
      await expect(page.locator('[data-rxpg-inspect] .con-rxpg__rules')).toContainText(/Учтены сейчас|Counted right now/);
      await shoot(page, preset.id, '10-award-sizes');
      await press(page, 'BracketRight', 700);

      // ── The family's opening scenario: below the maximum — A counts Artificial Lake + Domed Crater
      //    (Biomass Combustors prints a NEGATIVE icon) at influence 2 → «2 + 2 → +4».
      await expectScenario(page, 'counted-below-cap');
      expect(await countedIn(page, '[data-rxpg-yield]')).toEqual([counted('estimate', 2, 2, 4, 4)]);
      expect(await tableauOf(page, 'blue')).toEqual(['Artificial Lake:true', 'Domed Crater:true', 'Biomass Combustors:false']);
      await expect(page.locator('[data-rxpg-tableau="blue"] [data-rxpg-count]')).toHaveText('2');
      await expect(page.locator('[data-rxpg-tableau="blue"] [data-rxpg-card="Biomass Combustors"]')).toContainText(/Отрицательный значок ПО|Negative VP icon/);
      await shoot(page, preset.id, '11-award-below-cap');

      // ── RT: exactly +5 — three counted (Tundra Farming prints VP but no building tag).
      await press(page, 'Period', 400);
      await expectScenario(page, 'counted-exact-cap');
      expect(await countedIn(page, '[data-rxpg-yield]')).toEqual([counted('estimate', 3, 2, 5, 5)]);
      await expect(page.locator('[data-rxpg-tableau="blue"] [data-rxpg-card="Tundra Farming"]')).toContainText(/Нет метки строительства|No building tag/);

      // ── RT: over the maximum — 4 counted (Physics Complex counts at 0 VP) + influence 3 = 7 → +5, MAX.
      await press(page, 'Period', 400);
      await expectScenario(page, 'counted-over-cap');
      expect(await countedIn(page, '[data-rxpg-yield]')).toEqual([counted('estimate', 4, 3, 5, 7)]);
      await expect(page.locator('[data-rxpg-yield] .con-iyield__max')).toHaveCount(1);
      expect(await tableauOf(page, 'blue')).toContain('Physics Complex:true');
      await shoot(page, preset.id, '12-award-over-cap');

      // ── RT: every seat its own result (recorded): A 1 + 1 → +2 (the winner's step 1 → 2 is a TR step), B 3 + 4 → +5 of 7.
      await press(page, 'Period', 400);
      await expectScenario(page, 'counted-seats');
      expect(await countedIn(page, '[data-rxpg-seat="blue"]')).toEqual([counted('applied', 1, 1, 2, 2)]);
      expect(await countedIn(page, '[data-rxpg-seat="red"]')).toEqual([counted('applied', 3, 4, 5, 7)]);
      expect(await tableauOf(page, 'red')).toEqual(['Domed Crater:true', 'Space Elevator:true', 'Capital:true', 'Biomass Combustors:false']);
      await shoot(page, preset.id, '13-award-seats');

      // ── RT: the winner's Agenda step first — now 2 + 2 → +4; winning (step 5 = influence 3) → 2 + 3 → +5, the maximum.
      await press(page, 'Period', 400);
      await expectScenario(page, 'counted-winner-agenda');
      expect(await countedIn(page, '[data-rxpg-yield]')).toEqual([counted('estimate', 2, 2, 4, 4), counted('forecast', 2, 3, 5, 5)]);

      // ── RT: the recorded result — A received +4; B (the winner, step 1 = influence 1, no counted card) +1.
      await press(page, 'Period', 400);
      await expectScenario(page, 'counted-applied');
      expect(await countedIn(page, '[data-rxpg-yield]')).toEqual([counted('applied', 2, 2, 4, 4)]);
      expect(await countedIn(page, '[data-rxpg-seat="red"]')).toEqual([counted('applied', 0, 1, 1, 1)]);

      // ── RT ×3: the chairman quest at 0/2, 1/2 and completed (the seat taken).
      await press(page, 'Period', 400);
      await expectScenario(page, 'counted-quest-0');
      await expect(page.locator('[data-rxpg-quest-row="blue"] .con-parl__tick')).toHaveText('0');
      await press(page, 'Period', 400);
      await expectScenario(page, 'counted-quest-1');
      await expect(page.locator('[data-rxpg-quest-row="blue"] .con-parl__tick')).toHaveText('1');
      await shoot(page, preset.id, '14-award-quest-1');
      await press(page, 'Period', 400);
      await expectScenario(page, 'counted-quest-done');
      await expect(page.locator('[data-rxpg-quest-done]')).toHaveCount(1);
      await expect(page.locator('[data-rxpg-quest-progress]')).toHaveCount(0);

      // ── RT wraps inside the family: nothing counted, no influence — a NAMED zero, no gain.
      await press(page, 'Period', 400);
      await expectScenario(page, 'counted-zero');
      expect(await countedIn(page, '[data-rxpg-yield]')).toEqual([counted('applied', 0, 0, 0, 0, 'No qualifying cards and no influence')]);
      await expect(page.locator('[data-rxpg-tableau="blue"] [data-rxpg-card="Mine"]')).toContainText(/Нет значка ПО|No VP icon/);
      await shoot(page, preset.id, '15-award-zero');
      // RT: influence alone (a building card without an icon and a negative one count nothing) / cards alone.
      await press(page, 'Period', 400);
      await expectScenario(page, 'counted-influence-only');
      expect(await countedIn(page, '[data-rxpg-yield]')).toEqual([counted('estimate', 0, 2, 2, 2)]);
      await press(page, 'Period', 400);
      await expectScenario(page, 'counted-cards-only');
      expect(await countedIn(page, '[data-rxpg-yield]')).toEqual([counted('estimate', 2, 0, 2, 2), counted('forecast', 2, 1, 3, 3)]);

      // ── View: test player B — ITS own tableau and influence; A (the pad) moves B's influence and the reading follows.
      await press(page, 'KeyR', 400);
      await expect(page.locator('[data-rxpg-player="red"]')).toHaveCount(1);
      expect(await countedIn(page, '[data-rxpg-yield]')).toEqual([counted('estimate', 0, 1, 1, 1)]);
      await press(page, 'Enter', 400);
      expect(await countedIn(page, '[data-rxpg-yield]')).toEqual([counted('estimate', 0, 2, 2, 2)]);
      await expect(page.locator('[data-rxpg-tableau="red"]')).toHaveCount(1);

      // ── X: the REAL fullscreen on RX02 — the footer reads the test player's numbers.
      await press(page, 'BracketLeft', 500);
      await press(page, 'BracketLeft', 700);
      await openZoomViewer(page, 'KeyX');
      const zoom = page.locator('dialog.con-zoom.con-zoom--parliament');
      await expect(zoom).toHaveCount(1, {timeout: 10_000});
      await expect(zoom.locator('.card-zoom-stage .pcard').first()).toHaveClass(/rdx-mars-architecture-award/);
      await expect.poll(() => countedIn(page, 'dialog.con-zoom [data-zoom-yield]'), {timeout: 10_000}).toEqual([counted('estimate', 0, 2, 2, 2)]);
      await expect(page.locator('dialog.con-zoom.con-zoom--parliament[open]:not(.con-zoom--flight)')).toHaveCount(1, {timeout: 10_000});
      await shoot(page, preset.id, '16-award-fullscreen');
      await press(page, 'Escape', 900);
      await expect(zoom).toHaveCount(0, {timeout: 10_000});
    });
  });
}
