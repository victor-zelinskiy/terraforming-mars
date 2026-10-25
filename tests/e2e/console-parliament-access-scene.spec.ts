import {test, expect, Page} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootFixtureSeats, crumbText, fetchPlayerModel, pressUntil, settle, waitForBoardHome} from './consoleStart';
import {openParliament} from './parliamentDrive';

/**
 * THE ACCESS SCENE (the owner, 2026-10-25: «момент, когда игрок располагает второго делегата в партию и получает её
 * эффект — workspace просто закрывается и игрок получает слабую визуально обычную нотификацию; надо, чтобы получение
 * эффекта партии обыгрывалось на самом workspace … и связь визуально с тем делегатом»).
 *
 * Fixture `parliament-access-edge`: blue holds ONE delegate on the Mars First bill (from the reserve) and its lobby's
 * free delegate is still its own — the next vote there crosses the threshold. ONE press of A, and the hall plays:
 *   ① the delegate lands (the vote's own landing);
 *   ② the vote layer lets go of the chamber; «ВАШИ ЭФФЕКТЫ» stands with the new tile's place RESERVED (`arriving`);
 *   ③ the party's SEAL flies (a `seal` proxy) from the delegate into that place;
 *   ④ the tile is won (`won`), the zone's head says «Эффект партии получен», the crumb's tail names the stage;
 *   ⑤ the flow leaves by itself — and the feed tells the gain NOWHERE (the hall told it: no party-effect card).
 * The order is a claim about time, so a MutationObserver + setInterval probe samples it from BEFORE the press.
 */
const PRESET = {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'} as const;
const OUT_ROOT = path.resolve('screenshots', 'parliament-access-scene', PRESET.id);

type Sample = {t: number, arriving: boolean, won: boolean, seal: boolean, kicker: boolean, crumb: string, notif: boolean};

async function armProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__accessProbe: {samples: Array<unknown>, t0: number}};
    w.__accessProbe = {samples: [], t0: performance.now()};
    const sample = () => {
      w.__accessProbe.samples.push({
        t: performance.now() - w.__accessProbe.t0,
        arriving: document.querySelector('[data-parl-effects-arrival="arriving"][data-party="Mars First"]') !== null,
        won: document.querySelector('[data-parl-effects-arrival="won"][data-party="Mars First"]') !== null,
        seal: document.querySelector('[data-parl-flight-body="seal"]') !== null,
        kicker: document.querySelector('[data-parl-effects-won]') !== null,
        crumb: (document.querySelector('.con-wshead')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
        notif: document.querySelector('.con-notif.notification-card--variant-party-effect') !== null,
      });
    };
    new MutationObserver(sample).observe(document.body, {subtree: true, childList: true, attributes: true});
    window.setInterval(sample, 40);
  });
}

async function readProbe(page: Page): Promise<Array<Sample>> {
  return page.evaluate(() => (window as unknown as {__accessProbe: {samples: Array<Sample>}}).__accessProbe.samples);
}

test.describe('parliament · the access scene', () => {
  test.use({viewport: PRESET.viewport});

  test('the second delegate wins the party effect ON the workspace: the seal travels into «ВАШИ ЭФФЕКТЫ», then the flow leaves', async ({page, request}) => {
    test.setTimeout(240_000);
    const {playerId} = await bootFixtureSeats(page, request, 'parliament-access-edge', {query: PRESET.query});
    const before = await fetchPlayerModel(request, playerId) as unknown as {game: {parliament: {players: Array<{color: string, access: Array<{party: string, hasEffect: boolean}>}>}}, thisPlayer: {color: string}};
    const mine = before.game.parliament.players.find((p) => p.color === before.thisPlayer.color);
    expect(mine?.access.find((a) => a.party === 'Mars First')?.hasEffect, 'the fixture: Mars First is not blue\'s yet').toBe(false);

    await openParliament(page);
    expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-parl__vote.con-parl__vote--up').count() > 0, {tries: 4, settleMs: 1200}),
      'the vote mode opens').toBe(true);
    await settle(page, {timeoutMs: 15_000});
    expect(await page.locator('.con-parl__slot--selected').getAttribute('data-instance'), 'the Mars First bill is selected').toContain('ARCHITECTURE');
    await armProbe(page);
    await page.keyboard.press('Enter');

    // ④ the zone's head says it — and the crumb's tail names the stage while it does.
    await expect(page.locator('[data-parl-effects-won]'), 'the zone\'s head: «Эффект партии получен»').toHaveCount(1, {timeout: 20_000});
    await expect(page.locator('[data-parl-effects-won]')).toContainText(/Эффект партии получен/i);
    expect(await crumbText(page), 'the crumb\'s tail names the stage').toMatch(/эффект партии/i);
    fs.mkdirSync(OUT_ROOT, {recursive: true});
    await page.screenshot({path: path.join(OUT_ROOT, '01-won.png')});

    // ⑤ the flow leaves by itself.
    await waitForBoardHome(page, 40);
    await expect(page.locator('.con-parl')).toHaveCount(0);
    const samples = await readProbe(page);
    const first = (pred: (s: Sample) => boolean) => samples.find(pred)?.t;
    const tArriving = first((s) => s.arriving);
    const tSeal = first((s) => s.seal);
    const tWon = first((s) => s.won);
    test.info().annotations.push({type: 'access scene', description: `arriving ${tArriving?.toFixed(0)} · seal ${tSeal?.toFixed(0)} · won ${tWon?.toFixed(0)} (ms after the press)`});
    expect(tArriving, '② the new tile\'s place stood reserved before the seal came').not.toBe(undefined);
    expect(tSeal, '③ the seal flew').not.toBe(undefined);
    expect(tWon, '④ the tile was won').not.toBe(undefined);
    expect(tArriving!, 'the place stands before the seal flies').toBeLessThanOrEqual(tSeal!);
    expect(tSeal!, 'the seal flies before the tile is won').toBeLessThanOrEqual(tWon!);
    expect(samples.some((s) => s.notif), '⑤ the feed tells the gain nowhere — the hall told it').toBe(false);
    await expect(page.locator('.con-notif.notification-card--variant-party-effect')).toHaveCount(0);

    const after = await fetchPlayerModel(request, playerId) as unknown as typeof before;
    const now = after.game.parliament.players.find((p) => p.color === after.thisPlayer.color);
    expect(now?.access.find((a) => a.party === 'Mars First')?.hasEffect, 'the server: blue holds Mars First').toBe(true);
  });
});
