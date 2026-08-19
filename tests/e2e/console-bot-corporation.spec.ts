import {expect, test} from '@playwright/test';
import {bootToBoard, soloGameConfig, visibleSurfaces} from './consoleStart';

/**
 * MarsBot CORPORATIONS (Rule Book B) — the participant surfaces, live.
 *
 * A real automa game with the corporation dev-forced to C45 Spire (the richest
 * face: a starting Earth tag, a science resource counter and all three rule
 * boxes). The probe walks the REAL pregame (the corporation is selected at the
 * generation-1 research → action gate, after the human corporation is played),
 * then asserts the two participant surfaces the feature ships:
 *
 *  1. the bot's «РАЗЫГРАНО» carries a CORPORATION slot rendering the MarsBot
 *     corporation face — bot rules only, never the human Spire's
 *     («50 M€» / «draw 4 cards» must be absent);
 *  2. A on the slot opens the fullscreen inspect: the large face + the
 *     ORIGINAL corporation's archive entry (the official identity/art/lore
 *     link) beside it.
 */

const BOT_CORP_CONFIG = soloGameConfig({
  automa: {difficulty: 'normal', corporation: 'C45'},
});

async function key(page: import('@playwright/test').Page, code: string, settle = 700): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settle);
}

test.describe('console: the MarsBot corporation card', () => {
  // The product surface is the TV profile — geometry claims at the e2e default
  // 720p viewport are claims about a viewport the product does not target.
  test.use({viewport: {width: 1920, height: 1080}});

  test('the bot tableau has a corporation slot; A opens the fullscreen inspect with the original lore', async ({page, request}) => {
    test.setTimeout(360_000);
    const created = await request.post('/api/creategame', {data: BOT_CORP_CONFIG});
    expect(created.ok(), 'the server accepted the automa config').toBeTruthy();
    const {players} = await created.json();
    await page.goto(`/player?id=${players[0].id}&console=1`);
    await page.waitForSelector('.con-start__frame, .con-root', {timeout: 45_000});
    await page.waitForSelector('.con-load', {state: 'detached'}).catch(() => {});

    await bootToBoard(page);

    // ── The info workspace, on the BOT seat ─────────────────────────────
    await key(page, 'KeyY', 1200);
    const infoRoot = page.locator('.con-info');
    await expect(infoRoot, `info mode must open; visible: ${(await visibleSurfaces(page)).join(', ')}`).toBeVisible();
    // LB/RB until the header names the bot's corporation (2 participants —
    // one bump lands on the bot; act → verify → retry per the driver rule).
    const corpLine = page.locator('.con-info__corp--bot');
    for (let i = 0; i < 4 && await corpLine.count() === 0; i++) {
      await key(page, 'KeyE', 900);
    }
    await expect(corpLine, 'the bot header wears its corporation as identity').toContainText('Spire');

    // The dashboard block renders the corporation face with its rule boxes.
    const dashFace = page.locator('.con-info__block--botcorp .mb-face--corp');
    await expect(dashFace).toBeVisible();

    // ── The bot's «РАЗЫГРАНО» — the corporation slot ────────────────────
    await key(page, 'KeyX', 1400);
    const slot = page.locator('.con-played__botcorp .mb-face--corp');
    await expect(slot, 'the corporation slot must stand in the bot tableau').toBeVisible();
    const slotText = (await slot.innerText()).replace(/\s+/g, ' ');
    expect(slotText, 'bot rules only — the draft priority box').toContain('Больше всего меток');
    expect(slotText, 'no human Spire rule may leak (50 M€ start)').not.toMatch(/50\s*M/);
    expect(slotText, 'no human Spire rule may leak (draw 4)').not.toMatch(/draw 4|4 карт/i);
    await page.screenshot({path: 'screenshots/bot-corp-slot.png', fullPage: false});

    // ── A on the slot → the fullscreen inspect ──────────────────────────
    await key(page, 'Enter', 1600);
    const zoomFace = page.locator('.con-zoom .mb-face--corp.mb-face--large');
    await expect(zoomFace, 'the fullscreen corporation face').toBeVisible();
    const zoomText = (await zoomFace.innerText()).replace(/\s+/g, ' ');
    expect(zoomText).toContain('Больше всего меток'); // DRAFT PRIORITY: Most tags
    expect(zoomText).toContain('науки'); // the science effect / counter
    expect(zoomText, 'no human rules on the bot card').not.toMatch(/50\s*M/);
    // The archive entry (lore) rides the ORIGINAL corporation's card number.
    await expect(page.locator('.con-zoom .card-zoom-lore')).toBeVisible();
    await page.screenshot({path: 'screenshots/bot-corp-fullscreen.png', fullPage: false});

    // B closes back to the tableau — the slot survives the round trip.
    await key(page, 'Escape', 1200);
    await expect(slot).toBeVisible();
  });
});
