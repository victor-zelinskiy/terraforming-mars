import {test, expect, Page} from './consoleTest';
import {bootIntoGame, cinematicBeat, openQuickWheel, press, settle, soloGameConfig} from './consoleStart';
import {armWitness} from './witness';

/**
 * DIAGNOSTIC (not a guard): record the hand dock's POSE TRANSITIONS as the
 * player's eye sees them — rest ↔ raised (RT wheel), rest ↔ compact (a
 * surface opens), raised → compact (wheel commit into a sheet), plus a fast
 * open/close flutter. The numeric story (edge card rects → amplitude +
 * velocity profile) is RECORDED off the product's writes and every frame
 * (`armWitness`, armed before the press — FLAKE ZERO), plus static
 * screenshots of the three poses.
 *
 * Run with `--trace on` and pull the screencast JPEGs for perceptual review.
 */

type Frame = {
  t: number,
  cls: string,
  n: number,
  // leftmost / middle / rightmost docked card: left x, top y, width, rotation-ish
  backs: Array<{x: number, y: number, w: number, h: number}>,
};
type Pose = Omit<Frame, 't'>;

/** The ride's witness key — one ride at a time (re-arming starts a fresh record). */
const POSE_RIDE = 'hand-dock-pose-ride';

/**
 * Record ONE ride: arm the witness, run `act` (the press(es) that start it), keep recording for the ride's window
 * (`ms` — the old sampler's budget: the ride's length is what is being recorded, a beat, never a wait for a state),
 * and return the story — every distinct pose, stamped with the page's clock from the arm. `settled`: the population
 * claim is about what a FRAME can paint (a fan rebuilt within one task is never painted half-built).
 */
async function recordRide(page: Page, ms: number, act: () => Promise<void>): Promise<Array<Frame>> {
  const ride = await armWitness<Pose>(page, POSE_RIDE, () => {
    const backs = Array.from(document.querySelectorAll<HTMLElement>('[data-hand-dock-card]'))
      .filter((el) => (el.getAttribute('data-hand-body-mode') ?? 'docked') === 'docked');
    const idx = [0, Math.floor(backs.length / 2), backs.length - 1].filter((i) => i >= 0 && i < backs.length);
    const dock = document.querySelector<HTMLElement>('.con-handdock');
    return {
      cls: dock === null ? '-' : [...dock.classList].filter((c) => c !== 'con-handdock').map((c) => c.replace('con-handdock--', '')).join(','),
      n: document.querySelectorAll('[data-hand-dock-card]').length,
      backs: idx.map((i) => {
        const r = backs[i].getBoundingClientRect();
        return {
          x: Math.round(r.left * 10) / 10, y: Math.round(r.top * 10) / 10,
          w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10,
        };
      }),
    };
  }, {settled: true});
  await act();
  await cinematicBeat(page, ms, 'the recording window of the ride — the pose story is recorded for this long');
  const samples = await ride.stop();
  const t0 = samples[0]?.t ?? 0;
  return samples.map((s) => ({t: s.t - t0, ...s.v}));
}

function logStory(label: string, frames: Array<Frame>): void {
  console.log(`=== ${label} ===`);
  for (const f of frames) {
    const b = f.backs.map((k) => `${k.x},${k.y} ${k.w}x${k.h}`).join(' | ');
    console.log(`t=${f.t} cls=[${f.cls}] :: ${b}`);
  }
  // The two invariants a pose ride owes on every frame: the recorder was
  // alive (only a DEAD witness records nothing — a count of frames is a
  // count of the machine's speed), and no card vanished/appeared mid-ride
  // (the pack's population is constant — poses re-seat the same bodies, never
  // rebuild the fan).
  expect(frames.length, `${label}: the ride's witness recorded nothing`).toBeGreaterThan(0);
  const counts = new Set(frames.map((f) => f.n));
  expect([...counts], `${label}: the docked population changed mid-ride`).toHaveLength(1);
}

async function shoot(page: Page, name: string): Promise<void> {
  await page.screenshot({path: `screenshots/hand-dock-pose/${name}.png`, clip: {x: 560, y: 640, width: 800, height: 440}});
}

test.describe('hand dock pose transitions probe', () => {
  test.use({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1});

  test('record the pose transition story (13 cards)', async ({page, request}) => {
    test.setTimeout(420_000);
    await bootIntoGame(page, request, {
      buy: 13,
      config: soloGameConfig({
        players: [{name: 'PoseStory', color: 'red', beginner: false, handicap: 0, first: true}],
        customCorporationsList: ['CrediCor', 'Helion'],
      }),
    });
    await settle(page);
    await shoot(page, '1-rest');

    // rest → raised (RT wheel opens)
    logStory('rest→raised (RT open)', await recordRide(page, 1100, () => page.keyboard.press('Period')));
    await settle(page);
    await shoot(page, '2-raised');

    // raised → rest (RT toggles the wheel closed)
    logStory('raised→rest (RT close)', await recordRide(page, 1100, () => page.keyboard.press('Period')));
    await settle(page);

    // rest → compact (the journal panel opens — a surface owns the screen)
    logStory('rest→compact (journal opens)', await recordRide(page, 1200, () => page.keyboard.press('KeyR')));
    await settle(page);
    await shoot(page, '3-compact');

    // compact → rest (journal closes)
    logStory('compact→rest (journal closes)', await recordRide(page, 1200, () => page.keyboard.press('Escape')));
    await settle(page);

    // FLUTTER: fast open/close/open/close of the RT wheel — the presses' rhythm IS the subject (beats, not waits)
    logStory('flutter (RT ×4)', await recordRide(page, 2600 - 680, async () => {
      await page.keyboard.press('Period');
      await cinematicBeat(page, 200, 'the rhythm of the flutter');
      await page.keyboard.press('Period');
      await cinematicBeat(page, 280, 'the rhythm of the flutter');
      await page.keyboard.press('Period');
      await cinematicBeat(page, 200, 'the rhythm of the flutter');
      await page.keyboard.press('Period');
    }));
    await settle(page);

    // raised → compact (wheel commit «Действия карт» → the sheet opens)
    await openQuickWheel(page);
    logStory('raised→compact (wheel commit → sheet)', await recordRide(page, 1400 - 120, async () => {
      await page.keyboard.press('ArrowUp');
      await cinematicBeat(page, 120, 'the rhythm of the commit gesture');
      await page.keyboard.press('Enter');
    }));
    await settle(page);
    await shoot(page, '4-sheet-compact');
    await press(page, 'Escape', 900);

    expect(true).toBe(true);
  });
});
