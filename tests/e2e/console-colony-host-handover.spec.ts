import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootFixture, playCardFromHand, press, pressUntil, settle, walkFocusUntil} from './consoleStart';

/**
 * THE COLONIES CHANGE HOSTS — and the second host gets a working colony step (the field crash of 2026-11-07,
 * game-pdb19bfa).
 *
 * «Научная колония» played from the hand builds its colony INSIDE the hand, and the hand lends the hosted colonies its
 * header's fleet berth. Right after, the Build Colony STANDARD PROJECT opens the colonies again — hosted by the
 * standard projects, which lend none. The hand's berth used to outlive it: the colonies teleported their fleet dock
 * into a node that was no longer in the document, Vue mounted nothing, and the next patch threw
 * (`emitsOptions` of null) — the colony step went dark, `[console-leak-detector] STRANDED PROMPT: "colony"`.
 *
 * What this spec owns: the second host's colony step STANDS (tiles, the fleet dock in the section's own toolbar —
 * never a berth of the departed hand), and the build commits on the server. The harness's `vueErrorGuard` turns any
 * caught Vue patch error of the walk red.
 */

const OUT = path.resolve('screenshots', 'colony-host-handover');
const PRESETS = [
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

type Wire = {
  waitingFor?: {type: string},
  game: {colonies: Array<{name: string, colonies: Array<string>}>},
};

async function wireOf(request: APIRequestContext, id: string): Promise<Wire> {
  return await (await request.get(`/api/player?id=${id}`)).json() as Wire;
}

async function coloniesOn(request: APIRequestContext, id: string, colony: string): Promise<number> {
  return (await wireOf(request, id)).game.colonies.find((c) => c.name === colony)?.colonies.length ?? 0;
}

async function shoot(page: Page, preset: string, name: string): Promise<void> {
  const dir = path.join(OUT, preset);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

const focusedTile = async (page: Page): Promise<string> =>
  await page.locator('.con-coltile--focused').first().getAttribute('data-test').catch(() => null) ?? '';

/** On the standing colony grid: walk to `colony`, A opens its build stage, A builds — the server says it stands. */
async function buildOn(page: Page, request: APIRequestContext, playerId: string, colony: string): Promise<void> {
  const before = await coloniesOn(request, playerId, colony);
  expect(await walkFocusUntil(page, async () => await focusedTile(page) === `con-colony-${colony}`, () => focusedTile(page), 12),
    `the cursor reached ${colony}`).toBe(true);
  expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-colfocus').count() > 0, {tries: 3, settleMs: 1200}),
    `A opens ${colony}'s build stage`).toBe(true);
  await settle(page, {timeoutMs: 20_000});
  expect(await pressUntil(page, 'Enter', async () => await coloniesOn(request, playerId, colony) > before, {tries: 3, settleMs: 1500}),
    `the colony stands on ${colony}`).toBe(true);
}

for (const preset of PRESETS) {
  test.describe(`the colonies change hosts · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`a card's colony from the hand, then the Build Colony standard project — the second step stands (${preset.id})`, async ({page, request}) => {
      test.setTimeout(420_000);
      const playerId = await bootFixture(page, request, 'colony-host-handover', {query: preset.query});

      // ① THE HAND HOSTS: the card's colony step stands inside the hand, the dock in the hand's berth.
      expect(await playCardFromHand(page, 'Research Colony'), 'Research Colony was played').toBe(true);
      const grid = page.locator('.con-colonies .con-coltile');
      for (let i = 0; i < 12 && await grid.count() === 0; i++) {
        await page.locator('.con-reveal, .con-colonies .con-coltile').first().waitFor({timeout: 60_000});
        if (await page.locator('.con-reveal').count() > 0) {
          await press(page, 'Enter', 1200);
        }
      }
      await expect(grid.first(), 'the card\'s colony step stands (inside the hand)').toBeVisible({timeout: 60_000});
      await expect(page.locator('.con-hand .con-colonies'), 'the colonies are a step OF the hand').toHaveCount(1);
      await expect(page.locator('.con-hand__fleetberth .con-colonies__fleetbar'), 'the dock berths in the hand\'s header')
        .toHaveCount(1, {timeout: 10_000});
      await settle(page, {timeoutMs: 20_000});
      await shoot(page, preset.id, '01-hand-hosts');
      await buildOn(page, request, playerId, 'Luna');

      // The play ends: whatever it still shows is taken, and the hand leaves.
      expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-hand__frame').count() === 0, {tries: 6, settleMs: 1500}),
        'the play ends — the hand workspace leaves').toBe(true);
      await settle(page, {timeoutMs: 30_000});
      await expect.poll(async () => (await wireOf(request, playerId)).waitingFor?.type, {message: 'the action menu is back', timeout: 30_000})
        .toBe('or');

      // ② THE STANDARD PROJECTS HOST: the same colonies, a host with no berth.
      await press(page, 'Comma', 1200);
      await press(page, 'Enter', 1400);
      await expect(page.locator('.con-stdp').first(), 'the standard projects opened').toBeVisible({timeout: 20_000});
      const focusedName = async () => (await page.locator('.con-stdp__card--focused .con-stdp__name').textContent().catch(() => '')) ?? '';
      // The standard projects are a GRID — the walk of `console-colony-pluto-embed` (known to reach the colony card).
      const walk = ['ArrowDown', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp'];
      for (let i = 0; i < 18 && !/колони/i.test(await focusedName()); i++) {
        await press(page, walk[i % walk.length], 300);
      }
      expect(await focusedName(), 'the cursor reached the colony standard project').toMatch(/колони/i);
      expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-colonies .con-coltile').count() > 0, {tries: 3, settleMs: 1800}),
        'A opens the colony step of the standard project').toBe(true);

      // THE STEP STANDS: tiles on screen, the dock in the section's OWN toolbar — the departed hand lent nothing here.
      await expect(page.locator('.con-colonies .con-coltile').first(), 'the colony step stands for the second host').toBeVisible({timeout: 20_000});
      await expect(page.locator('.con-colonies__toolbar .con-colonies__fleetbar'), 'the dock stands in the section\'s own toolbar')
        .toHaveCount(1, {timeout: 10_000});
      await expect(page.locator('.con-hand__fleetberth'), 'no berth of the hand survives it').toHaveCount(0);
      await settle(page, {timeoutMs: 20_000});
      await shoot(page, preset.id, '02-stdp-hosts');
      await buildOn(page, request, playerId, 'Europa');
      await shoot(page, preset.id, '03-built');
    });
  });
}
