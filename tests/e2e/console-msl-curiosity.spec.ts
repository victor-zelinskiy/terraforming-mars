import {test, expect, Page} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  bootSeededGame, cinematicBeat, commitFocusedSpace, createGameWithCards, fetchPlayerModel, NO_PAYMENT, press,
  sendPlayerInput, settle, soloGameConfig, walkToSpace,
} from './consoleStart';
import {strandedReports} from './parliamentDrive';

/**
 * TERRA CIMMERIA NOVA's MSL CURIOSITY — a board cell that asks speaks the SAME language as Vastitas Borealis'
 * Viking (the polish of 2026-11-01): a greenery on the landing site pays 5 M€ for a free colony, and every step it
 * raises names the cell with the ONE source plate (`ConsoleSourceDock` — «ИСТОЧНИК · Место посадки марсохода
 * «Кьюриосити» [the printed colony tile]»): the bill (when it is asked) in the task host's dock, the colony pick at
 * the colonies head's trailing edge. Nothing is stranded on the way.
 * Evidence → screenshots/msl-curiosity/.
 */

const OUT = path.resolve('screenshots', 'msl-curiosity');
const MSL = '16';

const PROFILES = [{id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'}] as const;

function config() {
  return soloGameConfig({board: 'terra cimmeria nova', expansions: {colonies: true}, customCorporationsList: ['CrediCor']});
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

type Wire = {
  waitingFor?: {type?: string, coloniesModel?: Array<{name: string}>},
  thisPlayer: {megacredits: number},
  game: {colonies: Array<{name: string, colonies: Array<string>}>},
};

for (const profile of PROFILES) {
  test.describe(`MSL Curiosity · ${profile.id}`, () => {
    test.use({viewport: profile.viewport, deviceScaleFactor: 1, screen: profile.viewport});

    test('a greenery on the landing site: the bill and the colony pick name the cell with the one source plate', async ({page, request}) => {
      test.setTimeout(420_000);
      const playerId = await createGameWithCards(request, [], {config: config()});
      // CrediCor places no tile of its own, so the first greenery may stand anywhere — MSL included.
      await bootSeededGame(page, request, playerId, {buy: 0, corporation: 'CrediCor', query: profile.query});
      await settle(page);
      const wire = async () => await fetchPlayerModel(request, playerId) as unknown as Wire;

      // LT wheel → Standard Projects → «Озеленение».
      await press(page, 'Comma', 1200);
      await press(page, 'Enter', 1400);
      expect(await page.locator('.con-stdp').count(), 'standard projects did not open').toBeGreaterThan(0);
      const focusedName = async () => (await page.locator('.con-stdp__card--focused .con-stdp__name').textContent().catch(() => '')) ?? '';
      const walk = ['ArrowDown', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp'];
      for (let i = 0; i < 18 && !/озеленение/i.test(await focusedName()); i++) {
        await press(page, walk[i % walk.length], 300);
      }
      expect(/озеленение/i.test(await focusedName()), 'could not focus «Озеленение»').toBeTruthy();
      await press(page, 'Enter', 1800);
      if (/ОПЛАТА/.test(await page.locator('.con-root').innerText())) {
        await press(page, 'KeyX', 2200);
      }
      await expect.poll(async () => (await wire()).waitingFor?.type ?? '', {timeout: 30_000, message: 'the greenery asks for its cell'}).toBe('space');

      await walkToSpace(page, MSL);
      await shoot(page, '00-msl-aimed');
      expect(await commitFocusedSpace(page), 'the greenery landed on MSL Curiosity').toBeTruthy();

      // THE BILL — asked only when another currency could pay; the task host's dock names the cell.
      await expect.poll(async () => (await wire()).waitingFor?.type ?? 'none', {timeout: 40_000, message: 'the cell asks its colony'})
        .toMatch(/^(payment|colony)$/);
      if ((await wire()).waitingFor?.type === 'payment') {
        await page.waitForSelector('.con-src__plate-cell', {timeout: 30_000});
        await shoot(page, '01-bill');
        const bill = (await page.locator('.con-src').first().innerText()).replace(/\s+/g, ' ');
        console.log('── the bill\'s source ──', bill);
        expect(bill, 'the bill names the cell').toMatch(/Кьюриосити/);
        await sendPlayerInput(request, playerId, {type: 'payment', payment: {...NO_PAYMENT, megacredits: 5}});
      }

      // THE COLONY PICK — the colonies head names the cell at its trailing edge.
      await expect.poll(async () => (await wire()).waitingFor?.type ?? 'none', {timeout: 40_000, message: 'the colony is asked'}).toBe('colony');
      await page.waitForSelector('[data-colonies-cell-giver]', {timeout: 40_000});
      await cinematicBeat(page, 900, 'the colonies grid settles');
      await shoot(page, '02-colony-pick');
      const head = await page.evaluate(() => {
        const t = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
        return {
          giver: t(document.querySelector('[data-colonies-cell-giver]')),
          icon: document.querySelector('[data-colonies-cell-giver] [data-source-cell] .resource_icon--colony-tile') !== null,
          crumb: t(document.querySelector('.con-colonies__head')),
        };
      });
      console.log('── the colony head ──', JSON.stringify(head));
      expect(head.giver, 'the head names MSL Curiosity').toMatch(/Кьюриосити/);
      expect(head.icon, 'the plate wears the printed colony tile').toBe(true);

      const asked = (await wire()).waitingFor;
      const colony = asked?.coloniesModel?.[0]?.name;
      expect(colony, 'a colony to build').toBeDefined();
      await sendPlayerInput(request, playerId, {type: 'colony', colonyName: colony!});
      await expect.poll(async () => (await wire()).waitingFor?.type ?? 'none', {timeout: 30_000, message: 'the build was answered'}).not.toBe('colony');
      await settle(page);
      await shoot(page, '03-after');
      expect(await strandedReports(page), 'no prompt was stranded on the way').toEqual([]);
    });
  });
}
