import {expect, test} from './consoleTest';
import {openConsole, press, settle, waitForBoardHome} from './consoleStart';
import {drive} from './consoleEndgameHarness';
import {campaignModelAs, createCampaign, devCommit, launchMission, openMapAs} from './campaignFixtures';

/**
 * CAMPAIGN OVERVIEW — the two equal surfaces of one campaign
 * (docs/CAMPAIGN_MODE_ARCHITECTURE.md, «Campaign overview iteration»).
 *
 * Pinned here:
 *  · the STANDALONE MAP got the shared bodies: A on a seat row opens the
 *    participant LEGACY (composition with mission-of-origin badges, the
 *    start bonus with its status, the carried projects as real card faces,
 *    X → the ONE fullscreen zoom), X on a committed card opens the full
 *    RESULTS (historic corporations, titles + TP, the outgoing legacy —
 *    start bonus M€ and carried counts/names within privacy);
 *  · the IN-GAME overview: the «Кампания» zone in the Information workspace
 *    (campaign missions only), A → the full overview (four REAL board
 *    miniatures + participant rows), nested layers «Итоги миссии» /
 *    «Наследие», B walks exactly one level, the summary ring returns to the
 *    campaign zone, Y closes into the intact game;
 *  · TP semantics is SPOKEN, not implied: missions 1–3 read «учитываются
 *    только в финальной миссии» on both surfaces;
 *  · viewing NEVER launches or re-grants: the campaign document rev is the
 *    witness (unchanged across the whole inspection).
 */

const SHOT_DIR = 'screenshots/console-campaign-overview';

type Preset = {id: string, viewport: {width: number, height: number}, profileQuery: string};
/** The three supported display profiles — the same trio the Information
 *  workspace suite sweeps (couch 1080 / TV 4K / Steam Deck). */
const PRESETS: ReadonlyArray<Preset> = [
  {id: 'standard-1080', viewport: {width: 1920, height: 1080}, profileQuery: '&consoleProfile=auto'},
  {id: 'tv-4k', viewport: {width: 3840, height: 2160}, profileQuery: '&consoleProfile=tv'},
  {id: 'deck-handheld', viewport: {width: 1280, height: 800}, profileQuery: '&consoleProfile=handheld'},
];

for (const preset of PRESETS) {
  test.describe(`campaign overview · ${preset.id}`, () => {
    test.use({viewport: preset.viewport, screen: preset.viewport});

    const shoot = async (page: import('@playwright/test').Page, name: string): Promise<void> => {
      await page.screenshot({path: `${SHOT_DIR}/${preset.id}-${name}.png`, fullPage: false});
    };

    test('the map: seat legacy overlay + full mission results with the outgoing legacy', async ({page, request}) => {
    test.setTimeout(180_000);
    const {id} = await createCampaign(request);
    // Mission 1 committed by fixture: Bruno wins (Alice takes the comeback
    // bonus), a one-corp lineage each, Alice carries two projects.
    await devCommit(request, id, [1, 0], {
      lineages: {0: ['Tharsis Republic'], 1: ['Helion']},
      carryover: {0: ['Ants', 'Algae'], 1: []},
    });
    await openMapAs(page, id, 'Alice');
    // A direct goto rides the session boot-loader over the already-painted
    // map — wait it out so the screenshots show the surface, not the veil.
    await page.waitForSelector('.boot-loader', {state: 'detached', timeout: 20_000}).catch(() => {});

    // The rail TP carries its SEMANTICS note (never a bare number).
    const rail = (await page.locator('.cmap__rail').innerText()).toLowerCase();
    expect(/финальн|final/.test(rail), `the TP note must speak: ${rail}`).toBeTruthy();

    // ── A on a seat row → the participant LEGACY overlay. ────────────────
    await press(page, 'ArrowDown', 300);
    await press(page, 'Enter', 500);
    await expect(page.locator('.cmap__dossier--legacy')).toBeVisible();
    // Alice's ring: 1 lineage corporation + 2 carried projects, real faces.
    await expect(page.locator('.cleg__card')).toHaveCount(3);
    // The composition names its mission of origin.
    await expect(page.locator('.cleg__origin').first()).toBeVisible();
    // The start bonus is stated with an honest status (mission 2 is not
    // launched yet — the grant lies ahead).
    const facts = (await page.locator('.cleg__zone--facts').innerText()).toLowerCase();
    expect(facts).toContain('+5');
    await shoot(page, 'map-seat-legacy');

    // X inspects the focused card through the ONE zoom module (the physical
    // origin holds the slot — the card has one visual owner).
    await press(page, 'KeyX', 700);
    await expect(page.locator('.con-zoom-hold')).toHaveCount(1);
    await shoot(page, 'map-legacy-zoom');
    await press(page, 'Escape', 700);
    await expect(page.locator('.con-zoom-hold')).toHaveCount(0);
    await press(page, 'Escape', 400);
    await expect(page.locator('.cmap__dossier--legacy')).toHaveCount(0);

    // ── X on the committed card → the FULL results with the outgoing legacy.
    await press(page, 'ArrowUp', 300);
    await press(page, 'ArrowLeft', 300);
    await press(page, 'KeyX', 500);
    await expect(page.locator('.cmap__dossier--results')).toBeVisible();
    // Historic composition chips + the outgoing legacy block.
    await expect(page.locator('.cmres__corp').first()).toBeVisible();
    await expect(page.locator('.cmres__legacy-head')).toBeVisible();
    const legacyText = (await page.locator('.cmres__legacy').innerText()).toLowerCase();
    expect(legacyText).toContain('+5');
    // The viewer's own carried-out cards render as faces (2 for Alice).
    await expect(page.locator('.cmres__card')).toHaveCount(2);
    await shoot(page, 'map-mission-results');
    await press(page, 'Escape', 400);
    await expect(page.locator('.cmap__dossier--results')).toHaveCount(0);
  });

  test('in-game: the «Кампания» zone → overview → results → legacy → zoom → lossless returns', async ({page, request}) => {
    test.setTimeout(480_000);
    // Mission 2 LIVE with real legacy: mission 1 committed by fixture
    // (Bruno first — Alice carries the +5 M€ comeback), two carried
    // projects for Alice; the pregame (campaign deployment chain included)
    // is answered over the API for BOTH seats.
    const {id} = await createCampaign(request, {testMode: true});
    await devCommit(request, id, [1, 0], {
      lineages: {0: ['Tharsis Republic'], 1: ['Helion']},
      carryover: {0: ['Ants', 'Algae'], 1: []},
    });
    const {yourPlayerId: aliceId} = await launchMission(request, id);
    expect(aliceId).toBeTruthy();
    const bruno = await campaignModelAs(request, id, 'Bruno');
    const brunoId = bruno.missions[1]?.yourPlayerId;
    expect(brunoId).toBeTruthy();
    const revBefore = (await campaignModelAs(request, id, 'Alice') as unknown as {rev: number}).rev;

    // Answer the whole pregame (the campaign deployment chain included) for
    // BOTH seats over the API; stop the moment the ACTION phase reaches the
    // viewer — Alice stands on her own action menu, Bruno's research is done.
    await drive(request, [aliceId!, brunoId!],
      (m) => m.game.phase === 'action' && m.waitingFor !== undefined, 200);
    await openConsole(page, aliceId!, preset.profileQuery);
    await waitForBoardHome(page, 70);

    // ── Y → the Information workspace; the campaign zone EXISTS here. ────
    const workspace = page.locator('.con-info');
    for (let i = 0; i < 10 && await workspace.count() === 0; i++) {
      if (i > 0) {
        await press(page, 'Enter', 700);
        await press(page, 'Escape', 500);
      }
      await press(page, 'KeyY', 1100);
    }
    await expect(workspace).toHaveCount(1);
    const zone = page.locator('.con-info__zone--campaign');
    await expect(zone).toBeVisible();
    // The zone speaks: mission 2 of 4, the TP semantics note.
    const zoneText = (await zone.innerText()).toLowerCase();
    expect(zoneText).toContain('2');
    expect(/финальн|final/.test(zoneText), `TP note in the zone: ${zoneText}`).toBeTruthy();
    await shoot(page, 'info-summary-zone');

    // ── Ring → the campaign zone → A opens the overview. ─────────────────
    for (let i = 0; i < 4; i++) {
      await press(page, 'ArrowRight', 250);
    }
    for (let i = 0; i < 5 && await page.locator('.con-info__zone--campaign.con-info__zone--focused').count() === 0; i++) {
      await press(page, 'ArrowDown', 250);
    }
    await expect(page.locator('.con-info__zone--campaign.con-info__zone--focused')).toHaveCount(1);
    await press(page, 'Enter', 900);
    const overview = page.locator('.con-cmpov');
    await expect(overview).toBeVisible();
    // Four REAL board miniatures (61 hexes each) + both participant rows.
    await expect(page.locator('.con-cmpov .ccard')).toHaveCount(4);
    await expect(page.locator('.con-cmpov__seat')).toHaveCount(2);
    expect(await page.locator('.con-cmpov .map-fp__hex').count()).toBe(4 * 61);
    // The crumb tail names the place.
    const head = (await page.locator('.con-wshead').innerText()).toLowerCase();
    expect(/кампания|campaign/.test(head), `crumb: ${head}`).toBeTruthy();
    await settle(page, {timeoutMs: 15_000}).catch(() => {});
    await shoot(page, 'info-overview');

    // ── A on the committed mission → «Итоги миссии» inside the overview. ──
    for (let i = 0; i < 4 && await page.locator('.con-cmpov__layer').count() === 0; i++) {
      await press(page, 'ArrowLeft', 250);
      await press(page, 'Enter', 600);
    }
    await expect(page.locator('.con-cmpov__layer')).toBeVisible();
    await expect(page.locator('.cmres__rows')).toBeVisible();
    await expect(page.locator('.cmres__legacy-head')).toBeVisible();
    await shoot(page, 'info-mission-results');
    // B — exactly one level: the layer folds, the overview stands.
    await press(page, 'Escape', 500);
    await expect(page.locator('.con-cmpov__layer')).toHaveCount(0);
    await expect(overview).toBeVisible();

    // ── Down to the seats → A → «Наследие участника»; X → fullscreen. ─────
    for (let i = 0; i < 4 && await page.locator('.con-cmpov__seat--cursor').count() === 0; i++) {
      await press(page, 'ArrowDown', 250);
    }
    await press(page, 'Enter', 600);
    await expect(page.locator('.con-cmpov__layer')).toBeVisible();
    // The LIVE composition: the mission-1 lineage corp + the mission-2 pick
    // (read from the live tableau — the in-game context knows more than the
    // between-missions map) + the two carried projects.
    await expect(page.locator('.cleg__card')).toHaveCount(4);
    await shoot(page, 'info-seat-legacy');
    await press(page, 'KeyX', 800);
    await expect(page.locator('.con-zoom-hold')).toHaveCount(1);
    await shoot(page, 'info-legacy-zoom');
    await press(page, 'Escape', 800);
    await expect(page.locator('.con-zoom-hold')).toHaveCount(0);
    // B: legacy → overview; B: overview → summary with the ring RESTORED.
    await press(page, 'Escape', 500);
    await expect(page.locator('.con-cmpov__layer')).toHaveCount(0);
    await press(page, 'Escape', 700);
    await expect(page.locator('.con-info__zone--campaign.con-info__zone--focused')).toHaveCount(1);

    // ── Y closes into the intact game; the inspection changed NOTHING. ────
    await press(page, 'KeyY', 900);
    await expect(workspace).toHaveCount(0);
    const revAfter = (await campaignModelAs(request, id, 'Alice') as unknown as {rev: number}).rev;
    expect(revAfter, 'viewing must not mutate the campaign').toBe(revBefore);
  });
  });
}
