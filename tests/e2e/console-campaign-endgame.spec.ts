import {expect, test, Page} from './consoleTest';
import {reloadConsole} from './consoleStart';
import {
  createCampaign, devCommit, launchMission, campaignModelAs,
} from './campaignFixtures';
import {
  journeyToEndgame, waitWithFrames, forceFrame, shoot,
} from './consoleEndgameHarness';

/*
 * CAMPAIGN FINALE — the mandatory CHAMPION ceremony inside the endgame
 * workspace (docs/CAMPAIGN_MODE_ARCHITECTURE.md §7.7).
 *
 * A REAL final mission, never a fixture: missions 1–3 are committed over the
 * dev fast-forward (ONE corporation per seat, so mission 4's deployment is
 * the base corporation alone — no merges for the generic API driver to
 * navigate), mission 4 is LAUNCHED and actually played to Phase.END through
 * the shared endgame harness. The ceremony under test therefore fires from
 * the real completion signal of the real scoring sequence — Title Points
 * included as the ordinary «Титулы» category.
 *
 * Pinned here:
 *  · the champion phase arrives ONLY after the full ordinary sequence;
 *  · the ceremony is MANDATORY — X/B/A/dpad land on nothing, no stale hints;
 *  · the row layout NEVER re-flows under the ceremony (decorative layer only);
 *  · the settled campaign state (× header, plate, keel, «Хроника кампании»
 *    focus) — and that A actually opens the campaign map scene;
 *  · a reload lands SETTLED (no uninvited replay);
 *  · «Повторить подсчёт» replays the full act, champion beat included.
 */

const SHOT_DIR = 'screenshots/console-campaign-endgame';

test.describe('campaign finale — the champion ceremony', () => {
  test('final mission: mandatory champion ceremony, settled state, reload, replay', async ({page, request}) => {
    test.setTimeout(600_000);

    // ── the campaign, fast-forwarded to its finale ─────────────────────────
    const {id} = await createCampaign(request, {testMode: true});
    await devCommit(request, id, [0, 1], {lineages: {0: ['Ecoline'], 1: ['Helion']}});
    await devCommit(request, id, [0, 1]);
    await devCommit(request, id, [0, 1]);
    const {yourPlayerId: aliceId} = await launchMission(request, id);
    expect(aliceId, 'launch must hand the creator her mission seat').toBeTruthy();
    const bruno = await campaignModelAs(request, id, 'Bruno');
    const brunoId = bruno.missions[3]?.yourPlayerId;
    expect(brunoId, 'the second seat must be addressable').toBeTruthy();

    // ── play mission 4 to Phase.END (the viewer on the page) ───────────────
    await journeyToEndgame(page, request, [aliceId!, brunoId!]);

    // ── the champion phase arrives from the REAL scoring-completion signal ─
    await waitWithFrames(page, async () =>
      (await page.locator('.con-endgame--champion').count()) > 0,
    150_000, 'the champion phase (after the full scoring sequence)');
    await shoot(page, SHOT_DIR, '2p-champion-enter');

    // The results layout is FROZEN under the ceremony — decorative layer only.
    const rectsNow = () => page.evaluate(() =>
      Array.from(document.querySelectorAll('.con-eg__row')).map((el) => {
        const r = el.getBoundingClientRect();
        return `${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.width)},${Math.round(r.height)}`;
      }));
    const rowsBefore = await rectsNow();
    expect(rowsBefore.length).toBe(2);

    // MANDATORY: skip (X), collapse (B), confirm (A) and navigation all land
    // on nothing — mashing cannot fast-forward, collapse or break the act.
    for (const key of ['KeyX', 'Escape', 'Enter', 'ArrowDown', 'Enter', 'KeyX']) {
      await page.keyboard.press(key);
      await forceFrame(page);
    }
    expect(await page.locator('.con-eg__actions').count(),
      'input during the champion ceremony must not fast-forward it').toBe(0);
    await expect(page.locator('.con-endgame'), 'B must not collapse the mandatory scene').toBeVisible();

    // The plate transformation: «ПОБЕДИТЕЛЬ» → «ЧЕМПИОН КАМПАНИИ» + 4 pips.
    await waitWithFrames(page, async () =>
      (await page.locator('.con-eg__champline').count()) > 0,
    30_000, 'the champion plate');
    await shoot(page, SHOT_DIR, '2p-champion-plate');
    await expect(page.locator('.con-eg__champline').first()).toContainText(/Чемпион кампании/i);
    expect(await page.locator('.con-eg__champline-pip').count()).toBe(4);

    // Control returns ATOMICALLY at the settle; the layout never moved.
    await waitWithFrames(page, async () =>
      (await page.locator('.con-eg__actions').count()) > 0,
    60_000, 'the settled actions after the ceremony');
    expect(await rectsNow(), 'the results layout re-flowed under the ceremony').toEqual(rowsBefore);

    // The settled CAMPAIGN state: header, plate, keel — and the logical next
    // focus is the campaign map door («Хроника кампании», the list's head).
    await expect(page.locator('.con-eg__kicker').first()).toContainText(/Кампания завершена/i);
    expect(await page.locator('.con-eg__champline').count()).toBeGreaterThan(0);
    expect(await page.locator('.con-eg__champ-keel').count()).toBeGreaterThan(0);
    await expect(page.locator('.con-eg__action--focused')).toContainText(/Хроника кампании/i);
    await shoot(page, SHOT_DIR, '2p-champion-settled');

    // A opens the already-implemented campaign map (chronicle state) as an
    // internal scene; B returns to the results.
    await page.keyboard.press('Enter');
    await waitWithFrames(page, async () =>
      (await page.locator('.con-eg-campaign-scene .cmap').count()) > 0,
    30_000, 'the campaign map scene');
    await shoot(page, SHOT_DIR, '2p-chronicle');
    await page.keyboard.press('Escape');
    await waitWithFrames(page, async () =>
      (await page.locator('.con-eg-campaign-scene').count()) === 0,
    15_000, 'back to the settled results');

    // ── reload lands SETTLED — the ceremony never replays uninvited ────────
    await reloadConsole(page);
    await waitWithFrames(page, async () =>
      (await page.locator('.con-eg__actions').count()) > 0,
    90_000, 'the settled state after reload');
    let sawChampionPhase = false;
    for (let i = 0; i < 20; i++) {
      if ((await page.locator('.con-endgame--champion').count()) > 0) {
        sawChampionPhase = true;
        break;
      }
      await forceFrame(page);
      await page.waitForTimeout(140);
    }
    expect(sawChampionPhase, 'a reload must land settled, never replay the ceremony').toBe(false);
    await expect(page.locator('.con-eg__kicker').first()).toContainText(/Кампания завершена/i);
    expect(await page.locator('.con-eg__champline').count()).toBeGreaterThan(0);
    await shoot(page, SHOT_DIR, '2p-reload-settled');

    // ── «Повторить подсчёт» replays the FULL act, champion beat included ───
    for (let i = 0; i < 8; i++) {
      const txt = await page.locator('.con-eg__action--focused').innerText().catch(() => '');
      if (/Повторить подсчёт/i.test(txt)) {
        break;
      }
      await page.keyboard.press('ArrowRight');
      await forceFrame(page);
    }
    await expect(page.locator('.con-eg__action--focused')).toContainText(/Повторить подсчёт/i);
    await page.keyboard.press('Enter');
    await waitWithFrames(page, async () =>
      (await page.locator('.con-eg__actions').count()) === 0,
    15_000, 'the replay start (actions yield to the count)');
    await waitWithFrames(page, async () =>
      (await page.locator('.con-endgame--champion').count()) > 0,
    150_000, 'the replayed champion phase');
    await waitWithFrames(page, async () =>
      (await page.locator('.con-eg__actions').count()) > 0,
    60_000, 'the replayed ceremony settles');
    await expect(page.locator('.con-eg__kicker').first()).toContainText(/Кампания завершена/i);
    await shoot(page, SHOT_DIR, '2p-replay-settled');
  });
});

test.describe('campaign finale — five players at 4K TV scale', () => {
  test.use({viewport: {width: 3840, height: 2160}, deviceScaleFactor: 1});
  test('the champion ceremony reads at couch distance and never re-flows the dense table', async ({page, request}) => {
    test.setTimeout(600_000);

    // The fourth name rides the PLAYER_NAME_MAX_LENGTH cap (32 code points) —
    // the long-name readability case of the champion table.
    const names = ['Alice', 'Bruno', 'Клара', 'Дмитрий-Длинное-Имя-Экспедиции', 'Ева'];
    const colors = ['blue', 'red', 'green', 'yellow', 'purple'];
    const {id} = await createCampaign(request, {
      testMode: true,
      players: names.map((name, i) => ({name, color: colors[i], beginner: false, handicap: 0, first: i === 0})),
      // The wider corp pools (the testMode 8-corps-per-seat deal needs them
      // for a five-seat table — the createTable precedent).
      expansions: {
        corpera: true, promo: true, venus: false, colonies: false, prelude: false,
        prelude2: false, turmoil: false, community: true, ares: false, moon: false,
        pathfinders: false, ceo: false, starwars: false, underworld: false, deltaProject: false,
      },
    });
    const lineages = {0: ['Ecoline'], 1: ['Helion'], 2: ['CrediCor'], 3: ['Thorgate'], 4: ['Mining Guild']};
    await devCommit(request, id, [0, 1, 2, 3, 4], {lineages});
    await devCommit(request, id, [1, 0, 2, 3, 4]);
    await devCommit(request, id, [0, 1, 2, 3, 4]);
    await launchMission(request, id);
    const ids: Array<string> = [];
    for (const name of names) {
      const model = await campaignModelAs(request, id, name);
      const pid = model.missions[3]?.yourPlayerId;
      expect(pid, `no mission seat for ${name}`).toBeTruthy();
      ids.push(pid!);
    }

    await journeyToEndgame(page, request, ids);
    expect(await page.locator('.con-eg__row').count()).toBe(5);

    await waitWithFrames(page, async () =>
      (await page.locator('.con-endgame--champion').count()) > 0,
    150_000, 'the champion phase (5p)');
    const rectsNow = () => page.evaluate(() =>
      Array.from(document.querySelectorAll('.con-eg__row')).map((el) => {
        const r = el.getBoundingClientRect();
        return `${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.width)},${Math.round(r.height)}`;
      }));
    const rowsBefore = await rectsNow();
    await shoot(page, SHOT_DIR, '5p-4k-champion-enter');

    await waitWithFrames(page, async () =>
      (await page.locator('.con-eg__champline').count()) > 0,
    30_000, 'the champion plate (5p)');
    await shoot(page, SHOT_DIR, '5p-4k-champion-plate');

    await waitWithFrames(page, async () =>
      (await page.locator('.con-eg__actions').count()) > 0,
    60_000, 'the settle (5p)');
    expect(await rectsNow(), 'the dense table re-flowed under the ceremony').toEqual(rowsBefore);
    await expect(page.locator('.con-eg__kicker').first()).toContainText(/Кампания завершена/i);
    expect(await page.locator('.con-eg__champline-pip').count()).toBe(4);
    await shoot(page, SHOT_DIR, '5p-4k-settled');

    // Everything fits at TV scale — the workspace never scrolls.
    const overflow = await page.evaluate(() => {
      const el = document.querySelector('.con-endgame');
      if (el === null) {
        return 'missing';
      }
      return el.scrollHeight > el.clientHeight + 1 ? 'scrolls' : 'fits';
    });
    expect(overflow).toBe('fits');
  });
});

/*
 * THE HONOURS NEVER COVER A FACE, THE LINEAGE STANDS BEHIND IT (2026-10-22 — the owner: «бейджи (губернатор и т. д.)
 * не должны закрывать важную инфу», «первая корпорация всегда главная, дополнительные — премиально сзади»).
 * What every seat's marks overlap, read off the live DOM: the campaign title's CREST (the seat's top edge — its
 * insignia included), the ribbon, the place medal (beside the name now, never on the face's starting row) and each
 * charter's nameplate (whole above the card in front of it). Contract: docs/claude/console/endgame-workspace.md
 * § THE PODIUM.
 */
async function seatCoverage(page: Page) {
  return page.evaluate(() => {
    type R = {l: number, t: number, r: number, b: number};
    const rect = (el: Element | null): R | undefined => {
      if (el === null) {
        return undefined;
      }
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 ? {l: r.left, t: r.top, r: r.right, b: r.bottom} : undefined;
    };
    const share = (a?: R, b?: R): number => {
      if (a === undefined || b === undefined) {
        return 0;
      }
      const w = Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l));
      const h = Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));
      return Math.round(1000 * w * h / ((a.r - a.l) * (a.b - a.t))) / 1000;
    };
    return [...document.querySelectorAll('.con-eg__row')].map((row) => {
      const seat = rect(row)!;
      const face = rect(row.querySelector('.con-eg__face .pcard'));
      const ident = rect(row.querySelector('.con-eg__ident'));
      const crestEl = row.querySelector('.con-eg__title');
      const crest = rect(crestEl);
      const charters = [...row.querySelectorAll('.con-eg__charter')].map((c) => ({
        name: c.getAttribute('data-eg-charter') ?? '',
        depth: Number(getComputedStyle(c).getPropertyValue('--eg-k')),
        card: rect(c.querySelector('.pcard')),
        plate: rect(c.querySelector('.pcard-nameplate')),
      }));
      return {
        color: row.getAttribute('data-eg-row') ?? '',
        title: crestEl?.getAttribute('data-eg-title') ?? undefined,
        crestOnFace: Math.max(share(crest, face), share(rect(row.querySelector('.con-eg__title-emblem')), face)),
        crestOnName: share(crest, ident),
        crestInsideSeat: crest === undefined || (crest.l >= seat.l - 1 && crest.r <= seat.r + 1),
        ribbonOnFace: share(rect(row.querySelector('.con-eg__ribbon')), face),
        placeOnFace: share(rect(row.querySelector('.con-eg__place')), face),
        plates: charters.map((ch) => ({
          name: ch.name,
          covered: Math.max(share(ch.plate, face), ...charters.filter((o) => o.depth < ch.depth).map((o) => share(ch.plate, o.card)), 0),
          underCrest: share(ch.plate, crest),
        })),
        inside: charters.every((c) => c.card === undefined || c.card.t >= seat.t - 0.5) && (face === undefined || face.b <= seat.b + 0.5),
      };
    });
  });
}

function expectHonoursClear(rows: Awaited<ReturnType<typeof seatCoverage>>): void {
  for (const row of rows) {
    expect(row.inside, `${row.color}: the stand stays inside its seat`).toBe(true);
    expect(row.placeOnFace, `${row.color}: the place medal stands off the face`).toBe(0);
    expect(row.ribbonOnFace, `${row.color}: the ribbon stands off the face`).toBe(0);
    expect(row.crestOnFace, `${row.color}: the title crest stands off the face`).toBe(0);
    expect(row.crestOnName, `${row.color}: the title crest stands off the name`).toBe(0);
    expect(row.crestInsideSeat, `${row.color}: the title crest fits its seat`).toBe(true);
    for (const plate of row.plates) {
      expect(plate.covered, `${row.color}: ${plate.name}'s nameplate stands whole above the card in front`).toBeLessThanOrEqual(0.02);
      expect(plate.underCrest, `${row.color}: the crest leaves ${plate.name}'s nameplate`).toBe(0);
    }
  }
}

test.describe('campaign podium — the honours and the lineage (tv4k)', () => {
  test.use({viewport: {width: 3840, height: 2160}, deviceScaleFactor: 1});

  test('final mission, lineages of 4 / 3 / 2 / 1: the first corporation is the face, the rest stand behind it — every nameplate whole, the faces level', async ({page, request}) => {
    test.setTimeout(600_000);
    const names = ['Alice', 'Bruno', 'Clara', 'Dmitri'];
    const colors = ['blue', 'red', 'green', 'yellow'];
    const {id} = await createCampaign(request, {
      testMode: true,
      players: names.map((name, i) => ({name, color: colors[i], beginner: false, handicap: 0, first: i === 0})),
      expansions: {
        corpera: true, promo: true, venus: true, colonies: true, prelude: true,
        prelude2: false, turmoil: false, community: false, ares: false, moon: false,
        pathfinders: false, ceo: false, starwars: false, underworld: false, deltaProject: false,
      },
    });
    // The dev fast-forward grows each seat's lineage in acquisition order; mission 4 deploys it («Штаб»).
    await devCommit(request, id, [0, 1, 2, 3], {lineages: {0: ['Ecoline'], 1: ['Helion'], 2: ['Teractor'], 3: ['Point Luna']}});
    await devCommit(request, id, [1, 0, 3, 2], {lineages: {0: ['Ecoline', 'Mining Guild'], 1: ['Helion', 'Saturn Systems'], 2: ['Teractor', 'Thorgate']}});
    await devCommit(request, id, [0, 2, 1, 3], {lineages: {0: ['Ecoline', 'Mining Guild', 'Tharsis Republic', 'CrediCor'], 1: ['Helion', 'Saturn Systems', 'Inventrix']}});
    await launchMission(request, id);
    const ids: Array<string> = [];
    for (const name of names) {
      const pid = (await campaignModelAs(request, id, name)).missions[3]?.yourPlayerId;
      expect(pid, `no mission seat for ${name}`).toBeTruthy();
      ids.push(pid!);
    }
    await journeyToEndgame(page, request, ids);
    await waitWithFrames(page, async () => (await page.locator('.con-eg__lchip').count()) > 0, 60_000, 'the count');
    // The lineage RISES from behind the face as the scene enters — read it once every charter stands.
    await waitWithFrames(page, async () => page.evaluate(() =>
      document.querySelector('.con-endgame--entering') === null &&
      [...document.querySelectorAll('.con-eg__charter')].every((el) => el.getAnimations().every((a) => a.playState !== 'running'))),
    20_000, 'the lineage standing');

    // The count: four EQUAL seats — the deepest lineage's rise reserved on every one, the faces standing level.
    const count = await seatCoverage(page);
    expectHonoursClear(count);
    const faceTops = await page.locator('.con-eg__face .pcard').evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
    expect(Math.max(...faceTops) - Math.min(...faceTops), `the faces stand level while the count runs (${faceTops.join(', ')})`).toBeLessThanOrEqual(1);
    // Deepest first in paint order: the corporation acquired right after the base is the nearest charter.
    expect(Object.fromEntries(count.map((r) => [r.color, r.plates.map((p) => p.name)]))).toEqual({
      blue: ['CrediCor', 'Tharsis Republic', 'Mining Guild'],
      red: ['Inventrix', 'Saturn Systems'],
      green: ['ThorGate'],
      yellow: [],
    });
    await expect(page.locator('[data-eg-row="blue"] .con-eg__face .pcard'), 'the face is the base corporation alone').toHaveCount(1);
    await shoot(page, SHOT_DIR, '4p-4k-final-lineage-count');

    // Settled: the champion crowned — its plate above the deepest nameplate, still nothing over a face.
    await waitWithFrames(page, async () => (await page.locator('.con-eg__actions').count()) > 0, 240_000, 'the settled results');
    expectHonoursClear(await seatCoverage(page));
    const plateGap = await page.evaluate(() => {
      const plate = document.querySelector('.con-eg__champline')?.getBoundingClientRect();
      const tops = [...document.querySelectorAll('.con-eg__row--winner .con-eg__charter .pcard-nameplate')].map((el) => el.getBoundingClientRect().top);
      // A champion with one corporation has no nameplate to clear — the plate only has to exist.
      return plate === undefined ? -1 : tops.length === 0 ? 0 : Math.min(...tops) - plate.bottom;
    });
    expect(plateGap, 'the champion plate stands above the deepest nameplate').toBeGreaterThanOrEqual(0);
    await shoot(page, SHOT_DIR, '4p-4k-final-lineage-settled');
  });

  test('mission 1, four seats: the titles stand on the seats\' crests, the place medal beside the name — nothing over a face', async ({page, request}) => {
    test.setTimeout(600_000);
    const names = ['Alice', 'Bruno', 'Clara', 'Dmitri'];
    const colors = ['blue', 'red', 'green', 'yellow'];
    const {id} = await createCampaign(request, {
      testMode: true,
      players: names.map((name, i) => ({name, color: colors[i], beginner: false, handicap: 0, first: i === 0})),
      expansions: {
        corpera: true, promo: true, venus: false, colonies: false, prelude: false,
        prelude2: false, turmoil: false, community: true, ares: false, moon: false,
        pathfinders: false, ceo: false, starwars: false, underworld: false, deltaProject: false,
      },
    });
    await launchMission(request, id);
    const ids: Array<string> = [];
    for (const name of names) {
      const pid = (await campaignModelAs(request, id, name)).missions[0]?.yourPlayerId;
      expect(pid, `no mission seat for ${name}`).toBeTruthy();
      ids.push(pid!);
    }
    await journeyToEndgame(page, request, ids);
    await waitWithFrames(page, async () => (await page.locator('.con-eg__actions').count()) > 0, 200_000, 'the settled results');
    // The crests unfold in ascending order after the winner beat (Prefect → Administrator → Governor).
    await waitWithFrames(page, async () => (await page.locator('[data-eg-title="governor"]').count()) > 0, 15_000, 'the Governor crest');
    await waitWithFrames(page, async () => page.evaluate(() => {
      const crests = [...document.querySelectorAll('.con-eg__title')];
      return crests.length === 3 && crests.every((el) => Number(getComputedStyle(el).opacity) > 0.99 && el.getAnimations().every((anim) => anim.playState === 'finished'));
    }), 15_000, 'every crest unfolded');
    await shoot(page, SHOT_DIR, '4p-4k-mission1-titles');
    const rows = await seatCoverage(page);
    expect(rows.map((r) => r.title).filter((t) => t !== undefined).sort(), 'three titles on four seats').toEqual(['administrator', 'governor', 'prefect']);
    expectHonoursClear(rows);
    // The winner's «ПОБЕДИТЕЛЬ» yielded to its Governor crest — one anchor, one honour.
    const ribbon = await page.locator('.con-eg__ribbon').evaluateAll((els) => els.map((el) => Number(getComputedStyle(el).opacity)));
    expect(ribbon.every((o) => o < 0.05), `the ribbon yields to the Governor crest (opacities ${ribbon.join(', ')})`).toBe(true);
    expect(await page.locator('.con-eg__place-num').count(), 'every seat carries its place medal').toBe(4);
  });
});
