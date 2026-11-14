import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {computed, nextTick, ref, watch} from 'vue';

/*
 * THE COVER IS LATCHED BEFORE THE CAMERA IS TOLD — one reaction (PL-1840; the freeze of 2026-11-14).
 *
 * A server placement that waits for a scale story under a workspace releases the camera; the camera's exit raises its
 * own blocking hold; a live «nothing else holds» would then drop the story and bring the camera back — so the cover is
 * LATCHED for the prompt. The latch and the camera were two watchers, and the latch only works if it is set first.
 * Which of two queued watchers a mutation wakes first is not a contract (CLAUDE.md § ONE MUTATION — ONE REACTION): the
 * camera's job ran first, the candidate fell under its exit, the latch's job found «false, as before» and never ran its
 * body — a flush that never ended (`console-palladin-shipping` E: the page silent for 492 s on CI).
 *
 * ① the MECHANISM, on a model of the same graph, in both creation orders: as two watchers one order ping-pongs with
 *    the latch never set; as one watcher both orders latch at once;
 * ② the PRODUCT's wiring: the shell's table has the ONE row, and its body latches before it tells the camera.
 */
const ROOT = path.resolve(__dirname, '..', '..');
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** The graph in small: a story owed under a cover, a camera whose exit raises its own hold, a latch. */
function model() {
  const owed = ref(false); // the park owes a scale story under the cover
  const hold = ref(false); // the camera's own exit hold («something else holds the placement»)
  const latch = ref(false);
  const candidate = computed(() => owed.value && !hold.value);
  const story = computed(() => latch.value || candidate.value);
  const target = computed(() => !story.value); // the camera is wanted unless the placement waits for the story
  let flips = 0;
  /** The camera: released → its exit raises the hold; wanted → it comes in and the hold lets go. Bounded for the test. */
  const camera = (wanted: boolean): void => {
    flips++;
    if (flips > 40) {
      owed.value = false; // the test's own fuse — the product has none in a production build
      return;
    }
    hold.value = !wanted;
  };
  return {owed, latch, candidate, target, camera, flips: () => flips};
}

describe('planetFocusOrder — the cover is latched before the camera is told (PL-1840)', () => {
  it('① AS TWO WATCHERS the order is the scheduler\'s: with the camera\'s job first the latch NEVER runs and the camera ping-pongs', async () => {
    const m = model();
    let latchRuns = 0;
    // The camera's watcher created (and so woken) first — the order the product met.
    watch(m.target, (wanted) => m.camera(wanted));
    watch(m.candidate, (now) => {
      latchRuns++;
      if (now) {
        m.latch.value = true;
      }
    });
    m.owed.value = true;
    await nextTick();
    expect(m.flips(), 'the camera flipped until the test\'s fuse blew').to.be.greaterThan(40);
    expect(m.latch.value, 'the latch was never set').to.equal(false);
    expect(latchRuns, '…because its watcher\'s body never ran: every time its turn came the candidate had fallen back').to.equal(0);
  });

  it('① …and with the latch\'s job first the same two watchers work — the code was right by an order nobody wrote down', async () => {
    const m = model();
    watch(m.candidate, (now) => {
      if (now) {
        m.latch.value = true;
      }
    });
    watch(m.target, (wanted) => m.camera(wanted));
    m.owed.value = true;
    await nextTick();
    expect(m.latch.value).to.equal(true);
    expect(m.flips(), 'the camera was released once').to.equal(1);
  });

  for (const first of ['candidate', 'target'] as const) {
    it(`① AS ONE REACTION the order is written in its body — latched at once, the camera told once (the source reads the ${first} first)`, async () => {
      const m = model();
      const order = computed((): number => {
        const candidate = first === 'candidate' ? m.candidate.value : undefined;
        const target = m.target.value;
        return ((candidate ?? m.candidate.value) ? 1 : 0) | (target ? 2 : 0);
      });
      watch(order, (now, was) => {
        if ((now & 1) !== 0 && (was & 1) === 0) {
          m.latch.value = true; // 1. the cover
        }
        if ((now & 2) !== (was & 2)) {
          m.camera((now & 2) !== 0); // 2. the camera
        }
      });
      m.owed.value = true;
      await nextTick();
      expect(m.latch.value, 'latched').to.equal(true);
      expect(m.flips(), 'the camera was released once and stayed released').to.equal(1);
      expect(m.target.value).to.equal(false);
    });
  }

  it('② the shell\'s table has the ONE row — never a watcher of the candidate or of the camera\'s target on its own', () => {
    const table = read('src/client/console/shell/shellReactions.ts');
    expect(table).to.include('watch(() => shell.planetFocusOrder, (now, was) => shell.whenPlanetFocusOrderChanges(now, was));');
    expect(table, 'the latch as a watcher of its own loses its turn to the camera\'s').not.to.match(/watch\(\(\) => shell\.boardStoryCoverCandidate\b/);
    expect(table, 'the camera is told by the one reaction').not.to.match(/watch\(\(\) => shell\.planetFocusTarget\b/);
  });

  it('② the reaction\'s body latches the cover BEFORE it tells the camera', () => {
    const controller = read('src/client/console/shell/placementController.ts');
    const start = controller.indexOf('function whenPlanetFocusOrderChanges(');
    expect(start, 'the reaction').to.be.greaterThan(0);
    const body = controller.slice(start, controller.indexOf('\n  }\n', start));
    const latch = body.indexOf('latchBoardStoryCover()');
    const camera = body.indexOf('whenPlanetFocusTargetChanges(');
    expect(latch, 'the body latches').to.be.greaterThan(0);
    expect(camera, 'the body tells the camera').to.be.greaterThan(0);
    expect(latch, 'the latch first').to.be.lessThan(camera);
    expect(controller, 'the source is both facts in one value').to.match(/const planetFocusOrder = computed\(\(\): number => \{\s*return \(boardStoryCoverCandidate\.value \? 1 : 0\) \| \(planetFocusTarget\.value \? 2 : 0\);/);
  });
});
