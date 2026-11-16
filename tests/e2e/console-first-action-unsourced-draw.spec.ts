import {test, expect, Page} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootIntoGame, soloGameConfig} from './consoleStart';
import {armWitness} from './witness';

/**
 * Console-native · A FIRST ACTION THAT DRAWS WITHOUT SAYING SO.
 *
 * Celestic's mandatory first action reveals cards off the deck until it finds
 * two floater cards. It draws through `player.drawCard` — and until this was
 * fixed it ran outside any event scope, so the batch reached the client with
 * NO SOURCE. The claim, keyed on a card-name match, therefore belonged to
 * nobody and the cards opened a standalone full-bleed «Получены карты» over
 * the start workspace that was standing right behind it, source seat and all.
 *
 * The contract this guards is the project's north star: while a workspace is
 * open it HOSTS every draw — a modal over an open workspace is never right.
 */

const OUT = path.resolve('screenshots', 'console-first-action-unsourced-draw');

const GAME_CONFIG = soloGameConfig({
  players: [{name: 'CelesticTester', color: 'red', beginner: false, handicap: 0, first: true}],
  seed: 0.42,
  startingCorporations: 1,
  customCorporationsList: ['Celestic'],
  expansions: {corpera: true, venus: true},
});

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

test.describe('console first action · an unattributed draw (Celestic)', () => {
  test.use({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1, screen: {width: 1920, height: 1080}});

  test('the drawn cards present INSIDE the workspace, never in a modal over it', async ({page, request}) => {
    test.setTimeout(300_000);

    await bootIntoGame(page, request, {
      config: GAME_CONFIG,
      corporation: 'Celestic',
      until: 'startRelease',
    });

    const stage = page.locator('.con-start__firstact');
    await stage.waitFor({state: 'visible', timeout: 60_000});
    // The stage's OWN readiness marker (the first action actionable now) — the state the old fixed beat waited for.
    await expect(page.locator('.con-start__firstact--ready'), 'the first action is actionable').toBeVisible({timeout: 30_000});
    await shoot(page, '01-stage');

    // RECORD the presentation for the whole beat, armed before the press (FLAKE ZERO: `armWitness`; `settled` —
    // «never a modal over it» is a claim about what a frame paints): the reveal must appear INSIDE the workspace's own
    // zone, and the workspace must still be there.
    type Seen = {reveal: boolean, embedded: boolean, scene: boolean, zone: boolean, startPainted: boolean, take: string};
    const story = await armWitness<Seen>(page, 'unsourced-draw', () => {
      const reveal = document.querySelector('.con-reveal');
      const start = document.querySelector('.con-start');
      return {
        reveal: reveal !== null,
        embedded: document.querySelector('.con-start__embed .con-reveal') !== null,
        // The deck-draw cinematic is what withholds the overlay until the
        // zone exists and then lands the cards in it.
        scene: document.querySelector('.con-deckdraw') !== null,
        zone: document.querySelector('.con-start__embed') !== null,
        startPainted: start !== null &&
          (start as HTMLElement).checkVisibility({opacityProperty: true, visibilityProperty: true}),
        // The batch's own take state — `ready` once it stands whole for the player's take.
        take: reveal?.getAttribute('data-take') ?? '',
      };
    }, {settled: true});

    // A performs the mandatory first action — it draws two floater cards.
    await page.keyboard.press('Enter');

    // The window ends on the END STATE, never a duration: the batch standing READY for its take (or already taken).
    await expect.poll(async () => {
      const seen = await story.values();
      const first = seen.findIndex((v) => v.reveal);
      return first >= 0 && seen.slice(first).some((v) => !v.reveal || v.take === 'ready');
    }, {timeout: 60_000, message: 'the drawn batch was presented'}).toBe(true).catch(() => undefined);
    let sawReveal = false;
    let sawStandalone = false;
    let sawScene = false;
    let startGoneWhileRevealing = false;
    // The first offending frame, WITH its context. «It was standalone» has two
    // very different causes — the deck-draw scene never armed (so the overlay
    // mounted before the workspace published its zone), or the zone was there
    // and the teleport still missed — and the failure has to say which.
    let firstStandalone: unknown;
    for (const [i, {t, v: s}] of (await story.stop()).entries()) {
      if (s.scene) {
        sawScene = true;
      }
      if (s.reveal) {
        sawReveal = true;
        if (!s.embedded) {
          sawStandalone = true;
          firstStandalone = firstStandalone ?? {state: i, t, ...s, sawScene};
        }
        if (!s.startPainted) {
          startGoneWhileRevealing = true;
        }
      }
      if (sawReveal && !s.reveal) {
        break; // the batch has been taken
      }
    }
    await shoot(page, '02-draw-presentation');
    console.log(`[UNSOURCED] scene=${sawScene} standalone=${sawStandalone} first=${JSON.stringify(firstStandalone)}`);

    expect(sawReveal, 'Celestic\'s first action must produce a drawn batch').toBeTruthy();
    expect(sawStandalone,
      `an unattributed draw must be hosted by the open workspace, never a modal over it — ${JSON.stringify(firstStandalone)}`).toBeFalsy();
    expect(startGoneWhileRevealing,
      'the workspace may not let go while its own action is presenting').toBeFalsy();
  });
});
