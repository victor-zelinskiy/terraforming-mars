import {test, expect, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {WS_STAGE_BOX, WS_STAGE_HEAD, stageProbe} from './wsStageParity';

/**
 * Console BLUE ACTION · the RECEIVE (plain draw) stage — the twin of the
 * purchase stage, ONE premium language (iteration 21).
 *
 * Drives Development Center («Центр разработки»: spend 1 energy → draw a
 * card — no on-play tile, the cleanest plain-draw archetype) and proves, at
 * the real surface, the receive-specific contracts:
 *
 *  1. the EXECUTION BEAT actually flies — the face-down pull launches after
 *     the Action Commit's handoff and the stage NEVER falls back to the
 *     2.6 s backstop («delta-chip → дилей → карта появляется»);
 *  2. the embedded presentation speaks the BUY voice: centred instruction
 *     close over a HERO-sized card, no count chip for one card, no on-card
 *     command pill, the status line = name + the ONE take verb («A Взять»);
 *  3. taking the card FOLDS the workspace (atomically) and the hand intake
 *     actually lands — the dock count grows, no proxy is left hanging.
 */

const OUT_DIR = path.resolve('screenshots', 'console-blue-action-receive');

function newGameConfig() {
  return {
    players: [{name: 'DrawTester', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions: {
      corpera: true, promo: false, venus: false, colonies: false,
      prelude: false, prelude2: false, turmoil: false, community: false,
      ares: false, moon: false, pathfinders: false, ceo: false,
      starwars: false, underworld: false, deltaProject: false,
    },
    board: 'tharsis',
    seed: 0.47,
    randomFirstPlayer: false,
    clonedGamedId: undefined,
    undoOption: false,
    showTimers: false,
    fastModeOption: false,
    showOtherPlayersVP: false,
    testMode: true,
    aresExtremeVariant: false,
    politicalAgendasExtension: 'Standard',
    solarPhaseOption: false,
    removeNegativeGlobalEventsOption: false,
    modularMA: false,
    draftVariant: false,
    initialDraft: false,
    preludeDraftVariant: false,
    ceosDraftVariant: false,
    startingCorporations: 2,
    shuffleMapOption: false,
    randomMA: 'No randomization',
    includeFanMA: false,
    soloTR: false,
    customCorporationsList: [],
    bannedCards: [],
    includedCards: [],
    customColoniesList: [],
    customPreludes: [],
    requiresMoonTrackCompletion: false,
    requiresVenusTrackCompletion: false,
    moonStandardProjectVariant: false,
    moonStandardProjectVariant1: false,
    altVenusBoard: false,
    escapeVelocity: undefined,
    twoCorpsVariant: false,
    customCeos: [],
    startingCeos: 3,
    startingPreludes: 4,
  };
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_DIR, {recursive: true});
  await page.screenshot({path: path.join(OUT_DIR, `${name}.png`)});
}

async function key(page: Page, code: string, settleMs = 450): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settleMs);
}

const PROFILES = [
  {tag: 'fhd', width: 1920, height: 1080, query: ''},
  // The 4K TV is the target platform AND the profile where the two stages
  // drifted apart last (the tv ladder re-sized only the buy heading) — the
  // parity probe below runs here too.
  {tag: 'tv4k', width: 3840, height: 2160, query: '&consoleProfile=tv'},
] as const;

for (const profile of PROFILES) {
  test.describe(`console blue-action receive · ${profile.tag}`, () => {
    test.use({
      viewport: {width: profile.width, height: profile.height},
      deviceScaleFactor: 1,
      screen: {width: profile.width, height: profile.height},
    });

    test('commit → beat flight → embedded receive (buy voice) → take → fold + dock landing', async ({page, request}) => {
      test.setTimeout(480_000);

      let playerId = '';
      for (let attempt = 0; attempt < 40 && playerId === ''; attempt++) {
        const config = {...newGameConfig(), seed: 0.47 + attempt * 0.019};
        const created = await request.post('/api/creategame', {data: config});
        expect(created.ok()).toBeTruthy();
        const {players} = await created.json();
        const pv = await (await request.get(`/api/player?id=${players[0].id}`)).json();
        const dealt = (pv.waitingFor?.options ?? [])
          .flatMap((o: {cards?: Array<{name: string}>}) => (o.cards ?? []).map((c) => c.name));
        if (dealt.includes('Development Center')) {
          playerId = players[0].id;
        }
      }
      expect(playerId, 'a deal containing Development Center').not.toBe('');
      await page.goto(`/player?id=${playerId}&console=1${profile.query}`);
      // 4K + a full parallel run makes the first paint genuinely slow; this is a
      // load budget, not a behaviour assertion.
      await page.waitForSelector('.con-start__frame, .con-root', {timeout: 90_000});
      await page.waitForSelector('.con-load', {state: 'detached'}).catch(() => {});
      await page.waitForTimeout(3800);

      // ── The start wizard (the shared drive). ────────────────────────────
      const startScene = page.locator('.con-start__frame');
      await page.waitForSelector('.con-start__frame .con-cards__slot', {timeout: 25_000});
      const corpWithFirstAction = new Set(['Inventrix', 'Tharsis Republic', 'CrediCor', 'United Nations Mars Initiative', 'Helion']);
      for (let step = 0; step < 12; step++) {
        const focusedCorp = await page.locator('.con-start__frame .con-cards__slot[class*="--focused"]').first()
          .getAttribute('data-zoom-slot').catch(() => null);
        if (focusedCorp !== null && !corpWithFirstAction.has(focusedCorp)) {
          break;
        }
        await key(page, 'ArrowRight', 240);
      }
      const targetSlot = page.locator('.con-cards__slot[data-zoom-slot="Development Center"]');
      for (let tries = 0; tries < 4; tries++) {
        await key(page, 'Enter', 1400);
        const picked = await page.locator('.con-start__frame', {hasText: 'Выбрано 1'}).count() > 0;
        if (picked || await targetSlot.count() > 0) {
          break;
        }
      }
      for (let hop = 0; hop < 5 && await targetSlot.count() === 0; hop++) {
        const onSummary = await page.locator('.con-start__frame', {hasText: 'Сводка'}).count() > 0;
        await key(page, onSummary ? 'Comma' : 'Period', 1400);
      }
      await targetSlot.waitFor({timeout: 8000});
      for (let step = 0; step < 40; step++) {
        const focused = await page.locator('.con-cards__slot[data-zoom-slot="Development Center"][class*="--focused"]').count() > 0;
        if (focused) {
          break;
        }
        await key(page, 'ArrowRight', 230);
      }
      const pickedTarget = page.locator('.con-cards__slot[data-zoom-slot="Development Center"][class*="--picked"]');
      for (let tries = 0; tries < 3 && await pickedTarget.count() === 0; tries++) {
        await key(page, 'Enter', 700);
      }
      expect(await pickedTarget.count(), 'Development Center must be picked').toBeGreaterThan(0);
      await key(page, 'Period', 1400);
      for (let i = 0; i < 10 && await startScene.count() > 0; i++) {
        await key(page, i % 2 === 0 ? 'Enter' : 'Period', 1100);
      }
      await page.waitForSelector('.con-start__frame', {state: 'detached', timeout: 30_000});
      const turnChip = page.locator('.con-status', {hasText: 'ДЕЙСТВИЕ'});
      for (let i = 0; i < 12 && await turnChip.count() === 0; i++) {
        if (await page.locator('.con-start').count() > 0) {
          await key(page, 'Enter', 1300);
        } else {
          await page.waitForTimeout(1000);
        }
      }
      await expect(turnChip).toHaveCount(1, {timeout: 20_000});
      await page.waitForTimeout(4000);

      // ── Play Development Center from the hand. ─────────────────────────────
      // Retried as a WHOLE: on a heavy 4K frame a press can be swallowed
      // mid-flight and the card simply stays in hand — the run then reaches
      // the workspace with «Нет действий карт» and fails somewhere far from
      // the real cause. The exit condition is the honest one: the card has
      // left the hand.
      const inHand = page.locator('.con-hand [data-zoom-slot="Development Center"]');
      for (let attempt = 0; attempt < 3; attempt++) {
        await key(page, 'Period', 600);
        await key(page, 'Enter', 1600);
        await expect(inHand).toBeVisible({timeout: 10_000});
        for (let step = 0; step < 14; step++) {
          const focusedName = await page.locator('.con-hand .con-hand__slot--selected[data-zoom-slot]').first()
            .getAttribute('data-zoom-slot').catch(() => null);
          if (focusedName === 'Development Center') {
            break;
          }
          await key(page, 'ArrowRight', 260);
        }
        await key(page, 'Enter', 900);
        for (let i = 0; i < 5 && await page.locator('.con-composer--play, .con-play').count() > 0; i++) {
          await key(page, 'Enter', 900);
        }
        await page.waitForTimeout(4200);
        if (await inHand.count() === 0) {
          break;
        }
        // Still in hand — close whatever is open and try the play again.
        for (let i = 0; i < 3 && await page.locator('.con-hand, .con-play, .con-composer--play').count() > 0; i++) {
          await key(page, 'Escape', 700);
        }
      }
      expect(await inHand.count(), 'Development Center must have been played').toBe(0);

      // ── Workspace → setup → COMMIT. ─────────────────────────────────────
      // Retry discipline (the 4K profile's heavy frames swallow a press that
      // lands mid-flight): back out of whatever opened instead, and try the
      // wheel again — the drive must not depend on a lucky frame.
      for (let tries = 0; tries < 10 && await page.locator('.con-cardactions').count() === 0; tries++) {
        if (tries > 0 && await page.locator('.con-hand, .con-play').count() > 0) {
          await key(page, 'Escape', 600);
        }
        await key(page, 'Period', 800);
        await key(page, 'ArrowUp', 1400);
      }
      await expect(page.locator('.con-cardactions')).toHaveCount(1, {timeout: 10_000});
      await key(page, 'Enter', 1200);
      await expect(page.locator('.con-cardactions__stagewrap .con-composer--stage')).toHaveCount(1);
      await page.waitForTimeout(600);
      // The precise beat-health probe: the [WSBEAT] diagnostics name the
      // backstop explicitly when the flight dies — wall-clock alone cannot
      // distinguish a slow healthy chain from the 2.6 s failure path.
      const wsLogs: Array<string> = [];
      page.on('console', (m) => {
        const t = m.text();
        if (t.includes('WSBEAT')) {
          wsLogs.push(t);
        }
      });
      const dockCountBefore = await page.locator('.con-handdock').innerText().catch(() => '');
      const tPress = Date.now();
      await page.keyboard.press('Enter'); // CTA confirm — the Action Commit starts

      // ── 1. The BEAT actually flies: the flight layer mounts after the
      //       commit handoff (it NEVER did when a fast answer cancelled the
      //       delayed launch — the backstop bug this spec exists to catch). ──
      await expect(page.locator('.con-composer__revealfly')).toHaveCount(1, {timeout: 4000});

      // ── 2. The embedded receive stage, in the BUY voice. ────────────────
      const embedded = page.locator('[data-embed-slot="workspace-reveal"] .con-reveal--embedded');
      await expect(embedded).toHaveCount(1, {timeout: 10_000});
      const arriveMs = Date.now() - tPress;
      // A LOOSE sanity ceiling on purpose: under a full parallel run a healthy
      // chain has measured 5.2 s of pure runner contention. The REGRESSION
      // probe is the backstop log below — it names the failure path directly
      // instead of inferring it from wall-clock, which cannot tell a slow
      // healthy chain from a dead one.
      expect(arriveMs, `stage arrived in ${arriveMs}ms`).toBeLessThan(12_000);
      expect(wsLogs.some((l) => l.includes('BACKSTOP FIRED')),
        `the beat fell back to the backstop:\n${wsLogs.join('\n')}`).toBe(false);
      await expect(page.locator('.con-ws-stage-title')).toContainText('Получена карта');
      // PRIMARY-HEADING PARITY: the title reads the SHARED .con-ws-stage-heading
      // role — the same computed voice the buy stage's «Купить открытую карту?»
      // gets (its spec asserts the identical numbers; fhd: 1.3rem = 26px/700).
      const headStyle = await page.locator('.con-ws-stage-title').evaluate((el) => {
        const cs = window.getComputedStyle(el);
        return {size: cs.fontSize, weight: cs.fontWeight};
      });
      // HERO PARITY — printed next to the purchase spec's baseline line; the
      // shared fit formula + shared chrome must land the SAME card box.
      const rxHero = await page.locator('[data-embed-slot="workspace-reveal"] .con-cards__slot .pcard')
        .first().boundingBox();
      // ONE STAGE, TWO HOSTS: the chassis box from the SHARED baseline file.
      // Same layout engine + same chassis ⇒ the received card's stage must land
      // on the same numbers as the buy stage's, not merely "look similar".
      const stageBox = await page.locator('.con-reveal--embedded')
        .evaluate(stageProbe);
      // THE CHROME BREAKDOWN. Every past divergence in this flow was found by
      // MEASURING both stages on one profile rather than by reading the CSS —
      // the fit subtracts these numbers, so a stage that spends more chrome
      // silently gets a smaller card. Printed on both specs, same shape.
      const chrome = await page.locator('.con-reveal--embedded').evaluate((root) => {
        const box = (sel: string) => {
          const el = root.querySelector(sel) as HTMLElement | null;
          return el === null ? null : {h: el.offsetHeight, w: el.offsetWidth};
        };
        return {
          rootH: root.clientHeight,
          frame: box('.con-ws-stage-frame'),
          head: box('.con-ws-stage-head'),
          row: box('.con-ws-stage-row'),
          status: box('.con-ws-stage-status'),
          zoom: getComputedStyle(root.querySelector('.con-ws-stage-row') as HTMLElement)
            .getPropertyValue('--con-cards-zoom'),
          // The profile's rem factor — the ladders and every px constant ride
          // it, so a heading that measures "wrong" is usually a profile that
          // did not resolve rather than a font rule that lost.
          ui: getComputedStyle(document.documentElement).getPropertyValue('--con-ui-scale'),
          profile: document.documentElement.className,
        };
      });
      console.log(`[PARITY:${profile.tag}] receive hero=${JSON.stringify(rxHero)} head=${JSON.stringify(headStyle)} chrome=${JSON.stringify(chrome)}`);
      // The numbers are the PURCHASE stage's own — one shared baseline file,
      // so the two stages cannot be re-synced one at a time. Asserted AFTER the
      // print-out, so a failure always comes with the measurements that explain it.
      expect(headStyle, `heading ${JSON.stringify(headStyle)}`).toEqual(WS_STAGE_HEAD[profile.tag]);
      // The chassis is asserted whole: head, row box, status and the zoom the
      // shared engine solved from them. Transform-free by construction, so it
      // cannot disagree with the buy spec for a reason (a focused card's
      // emphasis) that has nothing to do with either stage.
      expect(stageBox, `stage ${JSON.stringify(stageBox)}`).toEqual(WS_STAGE_BOX[profile.tag]);
      expect(rxHero).not.toBeNull();
      // ONE card: the stage states no count — «ПОЛУЧЕНО 1» beside a single
      // card is a mass-batch instrument (the same rule that folds the buy
      // pickline). The badge is the SHARED entity both stages use.
      expect(await page.locator('.con-ws-stage-badge').count(), 'no count badge for ONE card').toBe(0);
      expect(await page.locator('.con-start__slot-a').count(), 'no on-card command pill').toBe(0);
      // The status line: focused card's name + the ONE take verb.
      await expect(page.locator('.con-reveal__namebar .con-cards__verdict-name')).toBeVisible();
      await expect(page.locator('.con-reveal__namebar .con-cards__verdict--ok')).toBeVisible();
      // HERO size — the same weight the buy stage gives its card (fhd: an
      // unscaled 320px face; anything under ~300 is the old 0.79 ladder).
      const slotBox = await page.locator('.con-reveal--embedded .con-cards__slot').first().boundingBox();
      expect(slotBox).not.toBeNull();
      expect(slotBox!.width, `slot width ${slotBox!.width}`).toBeGreaterThan(300);
      // The kicker mirrors the stage, never a generic «КАРТЫ».
      await expect(page.locator('.con-cmdbar')).toContainText(/Добор карт/i);
      await page.waitForTimeout(700);
      await shoot(page, `${profile.tag}-01-receive-stage`);

      // ── 2b. L3 = the SOURCE, lifted PHYSICALLY out of the hero column. ──
      // The source card is a real object on screen, so the fullscreen must
      // raise THAT card (its slot is held empty while the viewer is up) — a
      // textual entrance left the hero standing in its column while an
      // identical card rose in the middle: two of the same card at once.
      const srcZoom = page.locator('dialog.con-zoom[open]');
      for (let tries = 0; tries < 5 && await srcZoom.count() === 0; tries++) {
        await key(page, 'KeyC', 1500);
      }
      await expect(srcZoom).toHaveCount(1, {timeout: 8000});
      // The composer's hero slot is HELD (the zoom motion empties it) — the
      // proof that the viewer's card IS that card and not a second copy.
      await expect(page.locator('[data-motion-surface="action-composer"] .con-zoom-hold'))
        .toHaveCount(1, {timeout: 4000});
      await shoot(page, `${profile.tag}-01b-source-fullscreen`);
      for (let tries = 0; tries < 5 && await srcZoom.count() > 0; tries++) {
        await key(page, 'Escape', 1400);
      }
      await expect(srcZoom).toHaveCount(0, {timeout: 8000});
      // …and it comes BACK: no slot left empty, no stranded hold.
      await expect(page.locator('.con-zoom-hold')).toHaveCount(0, {timeout: 6000});
      await expect(page.locator('[data-embed-slot="workspace-reveal"] .con-cards__slot .pcard')).toBeVisible();

      // ── 3. TAKE → NO SEAM, then fold + dock landing. ────────────────────
      // A per-frame sampler for the HOLE the player reported: the card
      // vanished, the workspace folded, and only THEN the flight began. It
      // exists whenever the take's state commit runs before the flight's
      // proxies stand over the card (`commitAt: 'staged'` is the fix), so the
      // honest test is "was there ever a frame with no card and no proxy,
      // before the first proxy appeared".
      await page.evaluate(() => {
        const w = window as unknown as {__seam?: {hole: number, frames: number, seenProxy: boolean}};
        w.__seam = {hole: 0, frames: 0, seenProxy: false};
        const tick = () => {
          const s = w.__seam;
          if (s === undefined || s.frames > 300) {
            return;
          }
          const card = document.querySelector('[data-embed-slot="workspace-reveal"] .pcard');
          const proxy = document.querySelector('.con-handdelivery-layer .con-deal-proxy');
          if (proxy !== null) {
            s.seenProxy = true;
          }
          if (!s.seenProxy && card === null) {
            s.hole++;
          }
          s.frames++;
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      await key(page, 'Enter', 600);
      const seam = await page.evaluate(() => (window as unknown as {__seam: {hole: number, frames: number}}).__seam);
      expect(seam.hole, `frames with neither the card nor its proxy (of ${seam.frames})`).toBe(0);
      await expect(page.locator('.con-cardactions')).toHaveCount(0, {timeout: 8000});
      // No proxy left hanging: the delivery layer empties once the flight lands.
      await expect(page.locator('.con-handdelivery-layer .con-deal-proxy')).toHaveCount(0, {timeout: 8000});
      await page.waitForTimeout(1200);
      const dockCountAfter = await page.locator('.con-handdock').innerText().catch(() => '');
      expect(dockCountAfter, `dock ${dockCountBefore} → ${dockCountAfter}`).not.toEqual(dockCountBefore);
      await expect(turnChip).toHaveCount(1, {timeout: 15_000});
      await shoot(page, `${profile.tag}-02-after-take`);
    });
  });
}
