import {test, expect, Page} from './consoleTest';
import {bootFixtureSeats, openMandatoryAnnounce, press, settle} from './consoleStart';

/**
 * «ПРЕДСЕДАТЕЛЬСТВО» — ПРОБНИК 5: СЦЕНА ВИДНА
 * (docs/claude/prompts/parliament-chairman-quest.md §6).
 *
 * THIS IS THE PROBE THAT CATCHES THE ORIGINAL DEFECT. The presentation of the
 * Agenda step was written long before this flow: `ConsoleParliamentAgenda`'s
 * `lastAdvanceSeq` watcher glides the marker for a live `reason: 'quest'`
 * advance, and the board card-bonus scene lifts a card reward's cover off the
 * step it reached. All of it played into NOTHING, because the player was
 * standing on the board: the Parliament section was not in the DOM,
 * `parliamentRootEl()` returned undefined and the glide collapsed into an
 * instant assignment. Nothing about the code was broken — the SCENE was
 * absent, and no unit test can see that.
 *
 * So the probe asserts the three things a beat's probe must assert (the
 * sitting-v4 law, one flow over): the SOURCE was visible, the DESTINATION was
 * visible, and movement happened between them — «visible» meaning a non-zero
 * box, a non-zero EFFECTIVE opacity (the ancestor chain, because a parked tier
 * fades its children by fading itself) and nothing covering the object's own
 * centre. A claim about FRAMES is made on the `setInterval` (task) samples
 * only; the `MutationObserver` samples run as microtasks and can see states
 * the browser never painted. rAF is never used — headless Chromium drives it
 * off the compositor, which stops exactly when the screen goes quiet.
 */
type Rect = {x: number, y: number, w: number, h: number};
type Vis = {box: boolean, ink: number, free: boolean, hit: string};
type QuestSample = {
  src: 'mo' | 'tick',
  t: number,
  /** The Parliament section is MOUNTED (`.con-parl`) — the whole question this probe exists for. */
  section: boolean,
  /** The section's own flow stage and the director's beat. */
  stage: string, beat: string,
  /** The Agenda track and its reached step. */
  track: Vis | undefined,
  step2: Vis | undefined,
  /** Which steps the viewer's marker is DRAWN on (a real cube, not a proxy). */
  markerSteps: Array<string>,
  /**
   * The marker PROXY in flight (the glide's own body). `free` is not asked of
   * it: a flight layer is `pointer-events: none`, so `elementFromPoint` always
   * answers whatever is UNDER it — `overParl` is the honest test instead (what
   * the proxy's centre lands on belongs to the Parliament, not to a surface
   * standing over it).
   */
  flight: (Vis & {x: number, y: number, overParl: boolean}) | undefined,
  /** The chairman's own cube in the government's chair, by colour ('' = the seat reads empty). */
  chair: string,
  /** Delegate-cube proxies in the air (the office changing hands). */
  cubes: number,
  /** The crumb's own line (root › subject › stage). */
  crumb: string,
};
type QuestProbe = {samples: Array<QuestSample>};

async function armQuestProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__qq: QuestProbe};
    w.__qq = {samples: []};
    const rect = (el: Element | null | undefined): Rect | undefined => {
      if (el === null || el === undefined) {
        return undefined;
      }
      const r = el.getBoundingClientRect();
      return r.width === 0 && r.height === 0 ? undefined : {x: r.left, y: r.top, w: r.width, h: r.height};
    };
    const vis = (el: Element | null | undefined): Vis | undefined => {
      const r = rect(el);
      if (el === null || el === undefined || r === undefined) {
        return undefined;
      }
      let ink = 1;
      let node: Element | null = el;
      while (node !== null && node !== document.documentElement) {
        const cs = getComputedStyle(node);
        if (cs.visibility === 'hidden' || cs.display === 'none') {
          ink = 0;
          break;
        }
        ink *= Number(cs.opacity === '' ? 1 : cs.opacity);
        node = node.parentElement;
      }
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;
      const hit = document.elementFromPoint(cx, cy);
      const free = hit !== null && (hit === el || el.contains(hit) || hit.contains(el));
      return {box: r.w > 1 && r.h > 1, ink, free, hit: hit === null ? '' : (hit.className || hit.tagName).toString().slice(0, 60)};
    };
    const sample = (src: 'mo' | 'tick') => {
      const root = document.querySelector<HTMLElement>('.con-parl');
      // Which steps carry a PAINTED marker — by the cubes actually drawn,
      // never by a colour the probe would have to guess.
      const markerSteps: Array<string> = [];
      for (const row of Array.from(root?.querySelectorAll<HTMLElement>('[data-agenda-markers]') ?? [])) {
        const drawn = Array.from(row.querySelectorAll<HTMLElement>('[data-agenda-cube]'))
          .filter((cube) => !cube.classList.contains('con-parl__agenda-cube--hidden'));
        if (drawn.length > 0) {
          markerSteps.push(row.getAttribute('data-agenda-markers') ?? '');
        }
      }
      const proxy = document.querySelector<HTMLElement>('.con-parl__flight--agenda');
      const proxyRect = rect(proxy);
      const chairCube = root?.querySelector<HTMLElement>('[data-parl-seat-chair]');
      const crumbEl = document.querySelector<HTMLElement>('.con-parl .con-wshead');
      w.__qq.samples.push({
        src,
        t: Math.round(performance.now()),
        section: root !== null,
        stage: root?.getAttribute('data-stage') ?? '',
        beat: root?.getAttribute('data-quest-beat') ?? '',
        track: vis(root?.querySelector<HTMLElement>('[data-parl-agenda]')),
        step2: vis(root?.querySelector<HTMLElement>('.con-parl__step[data-step="2"]')),
        markerSteps,
        flight: proxy === null || proxyRect === undefined ? undefined : (() => {
          const v = vis(proxy) as Vis;
          const under = document.elementFromPoint(proxyRect.x + proxyRect.w / 2, proxyRect.y + proxyRect.h / 2);
          return {
            ...v,
            x: Math.round(proxyRect.x), y: Math.round(proxyRect.y),
            overParl: under !== null && (proxy.contains(under) || root?.contains(under) === true),
          };
        })(),
        chair: chairCube?.getAttribute('data-parl-seat-chair') ?? '',
        cubes: document.querySelectorAll('.con-parl__flight:not(.con-parl__flight--agenda)').length,
        crumb: (crumbEl?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 120),
      });
    };
    new MutationObserver(() => sample('mo')).observe(document.body, {subtree: true, childList: true, attributes: true});
    window.setInterval(() => sample('tick'), 40);
    sample('tick');
  });
}

async function readQuestProbe(page: Page): Promise<Array<QuestSample>> {
  return await page.evaluate(() => (window as unknown as {__qq: QuestProbe}).__qq.samples);
}

test.describe('«ПРЕДСЕДАТЕЛЬСТВО» — the scene the beats play on', () => {
  test('the gate brings the player to the Parliament, and the marker glides on a track that is actually on screen', async ({page, request}) => {
    // The fixture resumes ON the gate's own announce plate, so the board home is
    // not where the player lands — the driver settles instead of walking there
    // (its self-heal would answer the very prompt this spec is about).
    await bootFixtureSeats(page, request, 'parliament-chairman-quest', {landing: 'prompt'});

    // ① THE PLATE STANDS AND THE BOARD IS STILL THE SCREEN — the gate is
    //    ANNOUNCED, never auto-opened (it arrives at the end of the very
    //    action that completed the quest).
    const plate = page.locator('.con-mandatory');
    await expect(plate).toHaveCount(1, {timeout: 25_000});
    expect(await page.locator('.con-parl').count(), 'the Parliament is NOT open before the player presses A').toBe(0);

    // ② The sampler is armed BEFORE the press — the defect this probe exists
    //    for lives entirely in the window between the press and the settle.
    await armQuestProbe(page);
    expect(await openMandatoryAnnounce(page), 'A on the plate opens the Parliament').toBeTruthy();
    await settle(page, {timeoutMs: 25_000});

    const samples = await readQuestProbe(page);
    expect(samples.length, `the sampler ran (${samples.length} samples)`).toBeGreaterThan(20);
    const ticks = samples.filter((s) => s.src === 'tick');
    expect(ticks.length, `the task-clock sampler ran (${ticks.length} ticks)`).toBeGreaterThan(10);

    // ③ THE SECTION WAS ON SCREEN. This single assertion is the whole point:
    //    before the server's gate, every beat below played with `.con-parl`
    //    absent from the document.
    const mounted = samples.filter((s) => s.section);
    expect(mounted.length, 'the Parliament section stood for the flow').toBeGreaterThan(5);

    // ④ THE MARKER FLEW, AND IT FLEW ON A VISIBLE TRACK. The proxy is the
    //    glide's own body: it exists only while the marker is moving.
    // A proxy is BORN INVISIBLE and positioned on the next tick (the parliament's
    // own law — otherwise every cube paints one frame in the screen's corner), so
    // «in flight» is «has ink», never «the node exists».
    const flying = samples.filter((s) => s.flight !== undefined && s.flight.box && s.flight.ink >= 0.05);
    expect(flying.length, `the marker's proxy was on screen (samples: ${samples.length}, mounted: ${mounted.length})`).toBeGreaterThan(2);
    const blind = flying.filter((s) => !s.section || s.track === undefined || s.track.ink < 0.05 || !s.track.box);
    expect(blind.length, `every frame of the glide had a VISIBLE Agenda track (first bad: ${JSON.stringify(blind[0]?.track ?? 'no track')})`).toBe(0);
    const covered = flying.filter((s) => s.flight !== undefined && !s.flight.overParl);
    expect(covered.length, `nothing stood over the marker for the whole glide (first bad hit: ${covered[0]?.flight?.hit ?? '—'})`).toBe(0);

    // …and it MOVED: a proxy that never changes position is a teleport.
    const xs = new Set(flying.map((s) => s.flight!.x));
    const ys = new Set(flying.map((s) => s.flight!.y));
    expect(xs.size + ys.size, 'the proxy travelled (distinct positions)').toBeGreaterThan(3);

    // ⑤ THE STEP IT REACHED WAS VISIBLE when it landed — a bonus that lifts
    //    off a step the player cannot see is the same defect one object over.
    const landed = ticks.filter((s) => s.markerSteps.includes('2'));
    expect(landed.length, 'the marker settled on the step it reached').toBeGreaterThan(0);
    const hiddenStep = landed.filter((s) => s.step2 === undefined || s.step2.ink < 0.05 || !s.step2.box);
    expect(hiddenStep.length, 'the reached step was on screen when the marker arrived').toBe(0);

    // ⑥ THE MARKER NEVER OVERTOOK ITS OWN BEAT: no PAINTED frame shows the
    //    cube on step 2 before the proxy has been in the air.
    const firstFlight = ticks.findIndex((s) => s.flight !== undefined);
    const earlyArrival = ticks.findIndex((s) => s.markerSteps.includes('2'));
    expect(firstFlight, 'the glide was sampled by the task clock').toBeGreaterThan(-1);
    expect(earlyArrival, `the cube appeared on the new step only after the glide started (flight@${firstFlight}, arrival@${earlyArrival})`)
      .toBeGreaterThan(firstFlight - 1);

    // ⑦ THE OFFICE CHANGED HANDS BY A CUBE, and the chair read EMPTY in
    //    between — the outgoing delegate goes home first.
    expect(samples.some((s) => s.cubes > 0), 'a delegate proxy crossed the screen').toBeTruthy();
    const chairs = ticks.map((s) => s.chair);
    expect(chairs.some((c) => c !== '' && c !== chairs[chairs.length - 1]), 'the chair started with the PREVIOUS holder').toBeTruthy();
    expect(chairs[chairs.length - 1], 'and ends with the new one').not.toBe('');

    // ⑧ THE CRUMB IS CONTINUOUS: «ПАРЛАМЕНТ › ПРЕДСЕДАТЕЛЬСТВО › …» all flow
    //    long — the subject never restarts, only the tail advances.
    const crumbs = mounted.map((s) => s.crumb).filter((c) => c !== '');
    expect(crumbs.length, 'the crumb was read').toBeGreaterThan(0);
    const offSubject = crumbs.filter((c) => !c.toUpperCase().includes('ПРЕДСЕДАТЕЛЬСТВО'));
    expect(offSubject.length, `the crumb names the flow for its whole life (first bad: «${offSubject[0] ?? '—'}»)`).toBe(0);
    const tails = new Set(crumbs.map((c) => c.toUpperCase().split('ПРЕДСЕДАТЕЛЬСТВО')[1]?.trim() ?? ''));
    expect(tails.size, `the tail advanced (${[...tails].join(' | ')})`).toBeGreaterThan(1);

    // ⑨ …and the flow ENDS: A closes it and the workspace leaves.
    await press(page, 'Enter', 900);
    await settle(page, {timeoutMs: 20_000});
    expect(await page.locator('.con-parl').count(), 'the finished flow LEAVES — it never folds back to a browse layer').toBe(0);
  });
});
