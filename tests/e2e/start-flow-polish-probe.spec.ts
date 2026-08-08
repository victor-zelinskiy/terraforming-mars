/**
 * START-FLOW POLISH PROBE — four PHYSICAL claims about the start workspace,
 * each of which shipped broken and none of which a unit spec can see (they are
 * all about what is PAINTED, and when).
 *
 *  1. THE REVEAL GLINT STAYS ON THE CARD. Nothing clips a flight proxy (the
 *     card's own drop shadow has to escape), so a glint that moves by
 *     `transform` carries a bright wedge onto the room behind the card. The
 *     sweep must therefore be a BACKGROUND gliding inside a fixed `inset: 0`
 *     box — which cannot leave the silhouette by construction.
 *  2. THE LANDING IS FINAL. Once the materialization convoy is down, nothing
 *     re-flows: the preparation's own furniture (the selection shelf, the crew
 *     strip) retires UNDER the freeze snapshot, not after the cards land.
 *  3. ONE DELTA CHIP, NOT A ROW. Cards arriving one by one coalesce into a
 *     single chip counting up — never «+3 +4 +5 +6» printed side by side.
 *  4. THE PLAYED CARD IS THE TOP OF THE PILE. After it lands it must not sink
 *     under the previous card's still-open face.
 *
 * Sampling is per-frame-ish (~60 ms) because every one of these is a WINDOW,
 * not an end state — the defects were all invisible in the settled screenshot.
 */
import {test, expect, Page} from '@playwright/test';
import {
  soloGameConfig, walkToSummary, submitSummary, press, fillPicks,
  queueCards, waitQueueIdle, playQueueCard, startSceneGone, StepKind,
} from './consoleStart';

type Sample = {
  proxies: number,
  /** Every distinct rect of a deployment queue card / the played shelf. */
  rects: Record<string, string>,
  /** Chips living in the hand-dock counter host at this instant. */
  dockChips: number,
  dockChipText: string,
  /** Glint pseudo-element facts, sampled off a live flying face. */
  glint: {transform: string, backgroundSize: string, inset: string} | undefined,
  /** Played-pile paint order verdict while both slots exist. */
  pileTopWins: boolean | undefined,
};

/**
 * ONE evaluate = one frame of evidence. Everything is read structurally; the
 * pile verdict uses `elementFromPoint`, i.e. what the BROWSER says is on top,
 * never a z-index we would then have to interpret ourselves.
 */
async function sample(page: Page): Promise<Sample> {
  return page.evaluate(() => {
    const box = (el: Element) => {
      const r = el.getBoundingClientRect();
      return `${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.width)},${Math.round(r.height)}`;
    };
    const rects: Record<string, string> = {};
    document.querySelectorAll('.con-start__queue [data-queue-slot]').forEach((el) => {
      rects[`q:${el.getAttribute('data-queue-slot')}`] = box(el);
    });
    const shelf = document.querySelector('.con-splayed');
    if (shelf !== null) {
      rects['shelf'] = box(shelf);
    }
    const buy = document.querySelector('.con-start__buy');
    if (buy !== null) {
      rects['buy'] = box(buy);
    }

    const dockHost = document.querySelector('.con-handdock [data-metric-key="globals.hand-dock"]');
    const dockChipNodes = dockHost === null ? [] : Array.from(dockHost.querySelectorAll('.delta-chip'));

    // The glint rides `.con-deal-proxy__face::after`, and ONLY while its proxy
    // carries a `--revealing` modifier. A convoy is staggered, so at any frame
    // most airborne proxies are not glinting: walk every candidate and take the
    // first whose pseudo-element actually exists (a `querySelector` would keep
    // returning the document-first proxy, which is usually a quiet one).
    let glint: {transform: string, backgroundSize: string, inset: string} | undefined;
    const faces = document.querySelectorAll('.con-deal-proxy--revealing .con-deal-proxy__face, ' +
      '.con-deckdraw-proxy--revealing .con-deal-proxy__face, ' +
      '.con-coltrade-proxy--revealing .con-deal-proxy__face');
    for (const face of Array.from(faces)) {
      const cs = getComputedStyle(face, '::after');
      if (cs.content !== 'none' && cs.content !== '') {
        glint = {
          transform: cs.transform,
          backgroundSize: cs.backgroundSize,
          inset: [cs.top, cs.right, cs.bottom, cs.left].join(' '),
        };
        break;
      }
    }

    // THE PILE: while the previous top still stands open, is the LANDED card
    // painted above it? Probe the overlap — a point inside the top slot that
    // the prev card's overflowing face also covers.
    let pileTopWins: boolean | undefined;
    const prev = document.querySelector('.con-splayed__strip--prev');
    const top = document.querySelector('.con-splayed__top[data-played-key]');
    if (prev !== null && top !== null && !top.classList.contains('con-splayed__top--armed')) {
      const tr = top.getBoundingClientRect();
      if (tr.width > 4 && tr.height > 4) {
        const hit = document.elementFromPoint(
          Math.round(tr.x + tr.width / 2), Math.round(tr.y + Math.min(12, tr.height / 4)));
        pileTopWins = hit !== null && top.contains(hit);
      }
    }

    return {
      proxies: document.querySelectorAll('.con-startdock-proxy, .con-played-hero__proxy').length,
      rects,
      dockChips: dockChipNodes.length,
      dockChipText: dockChipNodes.map((n) => (n.textContent ?? '').trim()).join(' '),
      glint,
      pileTopWins,
    } as Sample;
  });
}

test('the start flow lands its cards, keeps its light on the card, coalesces its chips and stacks its pile', async ({page, request}) => {
  test.setTimeout(360_000);

  const created = await request.post('/api/creategame', {
    data: soloGameConfig({expansions: {prelude: true}}),
  });
  expect(created.ok(), `create-game failed: ${created.status()}`).toBeTruthy();
  const {players} = await created.json();
  await page.goto(`/player?id=${players[0].id}&console=1`);
  await page.waitForSelector('.con-start__frame, .con-root', {timeout: 45_000});
  await page.waitForSelector('.con-load', {state: 'detached'}).catch(() => {});
  await page.waitForSelector('.boot-loader', {state: 'detached', timeout: 150_000}).catch(() => {});

  const samples: Array<Sample> = [];
  let sampling = true;
  const pump = (async () => {
    while (sampling) {
      samples.push(await sample(page).catch(() => undefined as unknown as Sample));
      await page.waitForTimeout(40);
    }
  })();

  // ── the wizard: a corporation, both preludes, a handful of projects (the
  //    projects are what later arrive in the hand dock one by one). ──
  await walkToSummary(page, {
    onStep: async (p: Page, kind: StepKind) => {
      if (kind === 'corporation') {
        await press(p, 'Enter', 600);
      } else if (kind === 'prelude') {
        await fillPicks(p, 2);
      } else if (kind === 'project') {
        await fillPicks(p, 6);
      }
    },
  });
  const atSummary = samples.length;

  await submitSummary(page);
  // Long enough that the settled tail is EVIDENCE, not a rounding error: the
  // convoy plus its dissolve is ~3 s, and the sampler's cadence collapses while
  // GSAP owns the main thread, so a short wait leaves a handful of frames.
  await page.waitForTimeout(7000);
  const afterMaterialization = samples.length;

  // ── the deployment: play the queue so cards land on the РАЗЫГРАНО shelf. ──
  for (let i = 0; i < 8 && !(await startSceneGone(page)); i++) {
    await waitQueueIdle(page);
    const queue = await queueCards(page);
    if (queue.length === 0) {
      break;
    }
    await playQueueCard(page, queue[0]);
    await page.waitForTimeout(600);
  }
  await page.waitForTimeout(1200);

  sampling = false;
  await pump;
  const live = samples.filter((s) => s !== undefined);
  expect(live.length, 'the probe collected frames').toBeGreaterThan(60);

  // ── 1. THE GLINT NEVER LEAVES THE CARD ───────────────────────────────────
  // Soft throughout: every claim here is independent, and one run should report
  // ALL of them rather than stopping at the first.
  const glints = live.map((s) => s.glint).filter((g): g is NonNullable<Sample['glint']> => g !== undefined);
  expect.soft(glints.length, 'the probe saw the reveal glint at least once').toBeGreaterThan(0);
  const moved = glints.filter((g) => g.transform !== 'none' && g.transform !== '');
  expect.soft(moved, `the glint must never be TRANSFORMED off the card face (${moved[0]?.transform})`).toEqual([]);
  const unclipped = glints.filter((g) => g.inset !== '0px 0px 0px 0px');
  expect.soft(unclipped, `the glint box must be flush with the face (${unclipped[0]?.inset})`).toEqual([]);
  expect.soft(glints.every((g) => g.backgroundSize.startsWith('250%')),
    `the sweep is a wide background gliding inside the box (${glints[0]?.backgroundSize})`).toBeTruthy();

  // ── 2. THE LANDING IS FINAL ──────────────────────────────────────────────
  // From the frame the materialization convoy is down to the end of the
  // episode, no queue card / shelf may move.
  const mat = live.slice(atSummary, afterMaterialization);
  const lastAirborne = mat.map((s) => s.proxies > 0).lastIndexOf(true);
  expect.soft(lastAirborne, 'the materialization convoy was actually airborne').toBeGreaterThan(-1);
  const settled = mat.slice(lastAirborne + 1).filter((s) => Object.keys(s.rects).length > 0);
  expect.soft(settled.length, 'there are frames after the convoy landed').toBeGreaterThan(3);
  const baseline = settled[0]?.rects ?? {};
  const shifted: Array<string> = [];
  for (const s of settled) {
    for (const [key, value] of Object.entries(baseline)) {
      if (s.rects[key] !== undefined && s.rects[key] !== value) {
        shifted.push(`${key}: ${value} → ${s.rects[key]}`);
      }
    }
  }
  expect.soft([...new Set(shifted)],
    'nothing re-flows after the cards are down — the landing IS the final point').toEqual([]);

  // ── 3. ONE DELTA CHIP, NEVER A ROW ───────────────────────────────────────
  const worstChips = Math.max(0, ...live.map((s) => s.dockChips));
  const offender = live.find((s) => s.dockChips > 1);
  expect.soft(live.some((s) => s.dockChips > 0), 'the probe saw the hand-dock counter react at all').toBeTruthy();
  expect.soft(worstChips,
    `the hand-dock counter never stacks chips (saw «${offender?.dockChipText}»)`).toBeLessThanOrEqual(1);

  // ── 4. THE PLAYED CARD IS THE TOP OF THE PILE ────────────────────────────
  const verdicts = live.map((s) => s.pileTopWins).filter((v): v is boolean => v !== undefined);
  expect.soft(verdicts.length, 'the probe caught the pile with a landed card over a previous top').toBeGreaterThan(0);
  expect.soft(verdicts.filter((v) => !v).length,
    'the landed card is painted ABOVE the previous top in every frame — it never sinks under its art').toBe(0);
});
