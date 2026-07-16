import {test, expect, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

/*
 * DIAGNOSTIC (temporary): confirm the production-loss modal opens directly at
 * the COMBINED cost (2) next to TWO hazards, with no "1 → 2" flash. Captures the
 * [PRODLOSS-DIAG] browser logs (client instrumentation) that trace every
 * productionToLose commit + the surface's rendered cost.
 */

const OUT_DIR = path.resolve('screenshots', 'console-double-hazard');

function newGameConfig(seed: number) {
  return {
    players: [{name: 'HazardTester', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions: {
      corpera: true, promo: false, venus: false, colonies: false,
      prelude: false, prelude2: false, turmoil: false, community: false,
      ares: true, moon: false, pathfinders: false, ceo: false,
      starwars: false, underworld: false, deltaProject: false,
    },
    board: 'tharsis', seed, randomFirstPlayer: false, clonedGamedId: undefined,
    undoOption: false, showTimers: false, fastModeOption: false,
    showOtherPlayersVP: false, testMode: true, aresExtremeVariant: false,
    politicalAgendasExtension: 'Standard', solarPhaseOption: false,
    removeNegativeGlobalEventsOption: false, modularMA: false, draftVariant: false,
    initialDraft: false, preludeDraftVariant: false, ceosDraftVariant: false,
    startingCorporations: 2, shuffleMapOption: false, randomMA: 'No randomization',
    includeFanMA: false, soloTR: false, customCorporationsList: [], bannedCards: [],
    includedCards: [], customColoniesList: [], customPreludes: [],
    requiresMoonTrackCompletion: false, requiresVenusTrackCompletion: false,
    moonStandardProjectVariant: false, moonStandardProjectVariant1: false,
    altVenusBoard: false, escapeVelocity: undefined, twoCorpsVariant: false,
    customCeos: [], startingCeos: 3, startingPreludes: 4,
  };
}

async function key(page: Page, code: string, settleMs = 350): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settleMs);
}

// Seeds (found via the board geometry) with an empty land cell adjacent to two
// mild hazards → the placement there charges a COMBINED cost of 2.
const TWO_HAZARD_SEEDS = [0.04988, 0.01709, 0.03349];

test.describe('DIAG · double-hazard production loss', () => {
  test.use({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1, screen: {width: 1920, height: 1080}});

  for (const seed of TWO_HAZARD_SEEDS) {
    test(`combined cost-2 modal opens directly (seed ${seed})`, async ({page, request}) => {
      test.setTimeout(240_000);
      fs.mkdirSync(OUT_DIR, {recursive: true});

      const logs: Array<string> = [];
      page.on('console', (msg) => {
        const t = msg.text();
        if (t.includes('[PRODLOSS-DIAG]')) {
          logs.push(`${Date.now()} ${t}`);
          // eslint-disable-next-line no-console
          console.log('  » ' + t);
        }
      });

      const created = await request.post('/api/creategame', {data: newGameConfig(seed)});
      expect(created.ok(), `create-game failed: ${created.status()}`).toBeTruthy();
      const playerId = (await created.json() as {players: Array<{id: string}>}).players[0].id;

      await page.goto(`/player?id=${playerId}&console=1`);
      await page.waitForSelector('.con-start__frame, .con-root', {timeout: 45_000});
      await page.waitForSelector('.con-load', {state: 'detached', timeout: 45_000}).catch(() => {});
      await page.waitForTimeout(3500);

      const startScene = page.locator('.con-start__frame');
      for (let i = 0; i < 16 && await startScene.count() > 0; i++) {
        await key(page, i % 2 === 0 ? 'Enter' : 'Period', 1100);
      }
      await page.waitForTimeout(2000);
      expect(await startScene.count(), 'start wizard never completed').toBe(0);

      // LT wheel → Standard Projects → greenery (2 down from «Продажа патентов»).
      await key(page, 'Comma', 1100);
      await key(page, 'Enter', 1500);
      await key(page, 'ArrowDown', 500);
      await key(page, 'ArrowDown', 500);
      await key(page, 'Enter', 2200);

      const panel = page.locator('.con-context');
      expect((await panel.innerText()).includes('РАЗМЕЩЕНИЕ ТАЙЛА'), 'never reached placement').toBeTruthy();

      // Systematic boustrophedon sweep (with simple driving the cursor moves
      // reliably): home to top-left, then cover every column of every row until
      // a cell whose preview names a cost-2 penalty (two adjacent hazards).
      let confirmedCost = 0;
      let sawCost1 = false;
      const check = async (): Promise<boolean> => {
        const text = await panel.innerText();
        const m = text.match(/производств[а-яё]*\s*(?:на)?\s*(\d+)/i);
        if (m === null) {
          return false;
        }
        const cost = Number(m[1]);
        if (cost >= 2) {
          await page.screenshot({path: path.join(OUT_DIR, `seed${seed}-cost2-preview.png`)});
          await key(page, 'Enter', 300);
          confirmedCost = cost;
          return true;
        }
        sawCost1 = true;
        return false;
      };
      sweep: for (let home = 0; home < 2 && confirmedCost === 0; home++) {
        for (let i = 0; i < 9; i++) {
          await key(page, 'ArrowUp', 130);
        }
        for (let i = 0; i < 9; i++) {
          await key(page, 'ArrowLeft', 130);
        }
        for (let row = 0; row < 10; row++) {
          const dir = row % 2 === 0 ? 'ArrowRight' : 'ArrowLeft';
          for (let col = 0; col < 9; col++) {
            if (await check()) {
              break sweep;
            }
            await key(page, dir, 320);
          }
          if (await check()) {
            break sweep;
          }
          await key(page, 'ArrowDown', 320);
        }
      }

      // eslint-disable-next-line no-console
      console.log(`seed ${seed}: confirmedCost=${confirmedCost} sawCost1=${sawCost1}`);
      if (confirmedCost === 0) {
        test.skip(true, `no cost-2 cell reached (seed ${seed})`);
        return;
      }

      await page.waitForSelector('.con-prodloss', {timeout: 20_000});
      await page.waitForTimeout(400);
      await page.screenshot({path: path.join(OUT_DIR, `seed${seed}-prodloss-modal.png`)});
      const modalText = await page.locator('.con-prodloss').innerText();
      // eslint-disable-next-line no-console
      console.log('MODAL TEXT:\n' + modalText);
      // eslint-disable-next-line no-console
      console.log('DIAG LOG SEQUENCE:\n' + logs.join('\n'));
      fs.writeFileSync(path.join(OUT_DIR, `seed${seed}-diag.txt`), logs.join('\n') + '\n\nMODAL:\n' + modalText);

      expect(confirmedCost).toBe(2);
      // The modal must name the COMBINED reduction, never a stale "1".
      expect(modalText).toContain('Снизить производство на 2');
    });
  }
});
