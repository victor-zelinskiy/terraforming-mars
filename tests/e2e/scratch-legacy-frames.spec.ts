import {test} from '@playwright/test';
import {openConsole, press, waitStepDealSettled} from './consoleStart';
import {createCampaign, devCommit, launchMission} from './campaignFixtures';

// SCRATCH (not committed): perceptual frame series of the legacy overview
// open/close cycle — take bloom, arc, landings, tile press, park/unpark and
// header stability are judged from these frames.
test('legacy overview motion frames', async ({page, request}) => {
  test.setTimeout(240_000);
  const {id} = await createCampaign(request);
  await devCommit(request, id, [0, 1], {
    lineages: {0: ['Tharsis Republic'], 1: ['Helion']},
    carryover: {0: ['Ants', 'Algae'], 1: []},
  });
  const {yourPlayerId} = await launchMission(request, id);
  await openConsole(page, yourPlayerId!);
  await page.waitForSelector('.con-start__frame', {timeout: 60_000});
  await waitStepDealSettled(page);
  await page.waitForTimeout(900);
  await page.screenshot({path: 'screenshots/lf-open-00-before.png'});
  await press(page, 'KeyV', 40);
  for (let i = 1; i <= 12; i++) {
    await page.screenshot({path: `screenshots/lf-open-${String(i).padStart(2, '0')}.png`});
    await page.waitForTimeout(120);
  }
  await page.waitForSelector('.con-legview--live', {timeout: 12_000});
  await page.waitForTimeout(400);
  await page.screenshot({path: 'screenshots/lf-open-99-live.png'});
  await press(page, 'Escape', 40);
  for (let i = 1; i <= 12; i++) {
    await page.screenshot({path: `screenshots/lf-close-${String(i).padStart(2, '0')}.png`});
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(800);
  await page.screenshot({path: 'screenshots/lf-close-99-back.png'});
});
