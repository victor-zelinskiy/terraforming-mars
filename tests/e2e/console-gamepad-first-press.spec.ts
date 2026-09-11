import {expect, test} from './consoleTest';
import {cinematicBeat} from './consoleStart';
import {createCampaign, openMapAs} from './campaignFixtures';

/**
 * THE RELOAD-BOUNDARY FIRST PRESS (the "A works only on the second press" bug).
 *
 * Every screen boundary in this shell is a full reload (navigateWithCurtain:
 * menu ↔ campaign map ↔ game), and Chromium's privacy gate hides a connected
 * pad from a fresh document until a button goes down — so the pad's first
 * appearance and the player's first deliberate press are THE SAME EVENT. The
 * old first-sighting rule seeded that press away as a "pad wake gesture",
 * eating exactly one A after every transition: the campaign mission under a
 * visible focus did not launch, the corporation under a visible focus did not
 * select. The fix (`firstSightingFrame`): a LATE first-ever sighting IS the
 * press and emits its edges; the carry-over window + re-sighting keep the
 * held-over A of an exit click silent.
 *
 * This spec emulates the gate faithfully against the REAL input core:
 * `getGamepads()` answers empty until the press, and the press itself makes
 * the pad appear (gamepadconnected fires with A already down). The witness is
 * the product's own navigation: ONE press on the focused mission card must
 * enter the mission.
 */

/** `PAD_WAKE_CARRYOVER_MS` (1500) + margin — how long after the page's own
 *  `[gamepad] installed` line the press must wait to be unambiguously
 *  deliberate. Anchored to the log, not to page load: install time is the
 *  window's anchor in the product too. */
const CARRYOVER_LAPSE_MS = 2200;

test.describe('gamepad first press after a reload boundary', () => {
  test('ONE press on the freshly-loaded campaign map launches the focused mission', async ({page, request}) => {
    const {id} = await createCampaign(request);

    // The [gamepad] diagnostics are the anchor (install time) and the
    // failure narrative (which branch the press took) — collect them first.
    const gpLines: Array<string> = [];
    let installedAtWallMs = 0;
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.startsWith('[gamepad]')) {
        gpLines.push(text);
        if (installedAtWallMs === 0 && text.includes('installed')) {
          installedAtWallMs = Date.now();
        }
      }
    });

    // The FAKE PAD shim — re-installed on every navigation of this page.
    // Faithful to the privacy gate: invisible until the first button press,
    // and the press IS the appearance. (On the page AFTER the navigation the
    // shim re-seats with `connected: false`, so the game page boots padless.)
    await page.addInitScript(() => {
      const state = {
        connected: false,
        buttons: Array.from({length: 17}, () => ({pressed: false, value: 0, touched: false})),
        axes: [0, 0, 0, 0],
      };
      const pad = {
        id: 'E2E Virtual Pad (STANDARD GAMEPAD)',
        index: 0,
        mapping: 'standard',
        timestamp: 0,
        get connected() {
          return state.connected;
        },
        get buttons() {
          return state.buttons;
        },
        get axes() {
          return state.axes;
        },
      };
      (navigator as unknown as {getGamepads: () => Array<unknown>}).getGamepads =
        () => (state.connected ? [pad] : []);
      (window as unknown as {__pressFakePadA: () => void}).__pressFakePadA = () => {
        state.buttons[0] = {pressed: true, value: 1, touched: true};
        state.connected = true;
        const evt = new Event('gamepadconnected');
        Object.defineProperty(evt, 'gamepad', {value: pad});
        window.dispatchEvent(evt);
      };
    });

    await openMapAs(page, id, 'Alice');

    // The reported picture: the focus is VISIBLY on the first mission card.
    await expect(page.locator('.cmap__card--cursor')).toHaveCount(1);
    expect(installedAtWallMs, `the gamepad core never logged its install — [gamepad] lines:\n${gpLines.join('\n')}`).toBeGreaterThan(0);

    // Let the carry-over window lapse so the press is unambiguously a
    // deliberate one (the product classifies by time-since-install; a real
    // player's press on a rendered screen is always past it).
    const remaining = installedAtWallMs + CARRYOVER_LAPSE_MS - Date.now();
    if (remaining > 0) {
      await cinematicBeat(page, remaining, 'the PAD_WAKE_CARRYOVER window must lapse — the fix classifies a press by its time since install');
    }

    // THE press: the pad appears WITH A down — the privacy-gate shape of a
    // player's first press. Exactly one; the mission must launch from it.
    await page.evaluate(() => (window as unknown as {__pressFakePadA: () => void}).__pressFakePadA());

    await page.waitForURL(/player\?id=p/, {timeout: 30_000}).catch((err) => {
      throw new Error(
        'the FIRST gamepad press did not launch the focused mission — the reload-boundary press was eaten.\n' +
        `[gamepad] log:\n${gpLines.join('\n')}\n${err}`);
    });
  });
});
