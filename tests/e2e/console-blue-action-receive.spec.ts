import {test, expect, Page} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {WS_STAGE_BOX, WS_STAGE_HEAD, stageProbe} from './wsStageParity';
import {
  bootWithCards, composerLoaded, openActionFocus, openCardActions, playCardFromHand, pressUntil, settle,
} from './consoleStart';
import {readSettled} from './settledRead';
import {armWitness, pageNow} from './witness';

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

/** A box rounded to the pixel — a subpixel that jitters is not motion (`readSettled` compares reads). */
function roundBox(b: {x: number, y: number, width: number, height: number} | null) {
  return b === null ? null : {x: Math.round(b.x), y: Math.round(b.y), width: Math.round(b.width), height: Math.round(b.height)};
}

const PROFILES = [
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

      // ── The pregame: the shared driver seeds a game with Development Center
      //    already in hand and opens the console on a live board. The road is
      //    SETUP — this spec's subject is the blue action, so a start-flow
      //    change is adapted in `consoleStart`, never here.
      await bootWithCards(page, request, {
        cards: ['Development Center'],
        config: newGameConfig(),
        seed: 0.47,
        step: 0.019,
        query: profile.query,
      });
      await settle(page);

      // ── Play Development Center from the hand. ─────────────────────────────
      // Retried as a WHOLE: on a heavy 4K frame a press can be swallowed
      // mid-flight and the card simply stays in hand — the run then reaches
      // the workspace with «Нет действий карт» and fails somewhere far from
      // the real cause. The exit condition is the honest one: the card has
      // left the hand — the SERVER's hand (`playCardFromHand`: every press on
      // the sheet act → verify, the whole play retried while the card stays).
      const inHand = page.locator('.con-hand [data-zoom-slot="Development Center"]');
      await playCardFromHand(page, 'Development Center');
      await expect.poll(() => inHand.count(), {message: 'Development Center must have been played'}).toBe(0);
      await settle(page); // the play's landing at rest before the next workspace opens

      // ── Workspace → setup → COMMIT. ─────────────────────────────────────
      // Retry discipline (the 4K profile's heavy frames swallow a press that
      // lands mid-flight): back out of whatever opened instead, and try the
      // wheel again — the drive must not depend on a lucky frame
      // (`openCardActions`); the descent is retried only while no stage stands
      // (`openActionFocus` — a second A on an open stage would CONFIRM it).
      await openCardActions(page);
      await expect(page.locator('.con-cardactions')).toHaveCount(1, {timeout: 10_000});
      await openActionFocus(page);
      await expect(page.locator('.con-cardactions__stagewrap .con-composer--stage')).toHaveCount(1);
      // The setup stage loaded and at rest before the commit goes out.
      await composerLoaded(page);
      await settle(page);
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
      // H — the arrival is timed on the PAGE's clock: a reading before the press, the stage's first recorded moment.
      const stageUp = await armWitness(page, 'buy-stage-up', () =>
        document.querySelector('[data-embed-slot="workspace-reveal"] .con-reveal--embedded') !== null);
      const tPress = await pageNow(page);
      await page.keyboard.press('Enter'); // CTA confirm — the Action Commit starts

      // ── 1. The BEAT actually flies: the flight layer mounts after the
      //       commit handoff (it NEVER did when a fast answer cancelled the
      //       delayed launch — the backstop bug this spec exists to catch). ──
      await expect(page.locator('.con-composer__revealfly')).toHaveCount(1, {timeout: 4000});

      // ── 2. The embedded receive stage, in the BUY voice. ────────────────
      const embedded = page.locator('[data-embed-slot="workspace-reveal"] .con-reveal--embedded');
      await expect(embedded).toHaveCount(1, {timeout: 10_000});
      const arriveMs = ((await stageUp.firstWhere((up) => up))?.t ?? Infinity) - tPress;
      // A LOOSE sanity ceiling on purpose: under a full parallel run a healthy
      // chain has measured 5.2 s of pure runner contention. The REGRESSION
      // probe is the backstop log below — it names the failure path directly
      // instead of inferring it from wall-clock, which cannot tell a slow
      // healthy chain from a dead one.
      expect(arriveMs, `stage arrived in ${arriveMs}ms`).toBeLessThan(12_000);
      expect(wsLogs.some((l) => l.includes('BACKSTOP FIRED')),
        `the beat fell back to the backstop:\n${wsLogs.join('\n')}`).toBe(false);
      await expect(page.locator('.con-ws-stage-title')).toContainText('Получена карта');
      // Every number below is the stage AT REST (FLAKE ZERO, class C — `readSettled`: the console settled, then two
      // equal reads a frame apart): a box read the moment the stage mounts is wherever its arrival had got to.
      const parity = await readSettled(page, async () => ({
        // PRIMARY-HEADING PARITY: the title reads the SHARED .con-ws-stage-heading
        // role — the same computed voice the buy stage's «Купить открытую карту?»
        // gets (its spec asserts the identical numbers; fhd: 1.3rem = 26px/700).
        headStyle: await page.locator('.con-ws-stage-title').evaluate((el) => {
          const cs = window.getComputedStyle(el);
          return {size: cs.fontSize, weight: cs.fontWeight};
        }),
        // HERO PARITY — printed next to the purchase spec's baseline line; the
        // shared fit formula + shared chrome must land the SAME card box.
        rxHero: roundBox(await page.locator('[data-embed-slot="workspace-reveal"] .con-cards__slot .pcard')
          .first().boundingBox()),
        // ONE STAGE, TWO HOSTS: the chassis box from the SHARED baseline file.
        // Same layout engine + same chassis ⇒ the received card's stage must land
        // on the same numbers as the buy stage's, not merely "look similar".
        stageBox: await page.locator('.con-reveal--embedded').evaluate(stageProbe),
        // THE CHROME BREAKDOWN. Every past divergence in this flow was found by
        // MEASURING both stages on one profile rather than by reading the CSS —
        // the fit subtracts these numbers, so a stage that spends more chrome
        // silently gets a smaller card. Printed on both specs, same shape.
        chrome: await page.locator('.con-reveal--embedded').evaluate((root) => {
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
        }),
      }), {message: 'the embedded receive stage'});
      const {headStyle, rxHero, stageBox, chrome} = parity;
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
      await expect.poll(() => page.locator('.con-ws-stage-badge').count(), {message: 'no count badge for ONE card'}).toBe(0);
      await expect.poll(() => page.locator('.con-start__slot-a').count(), {message: 'no on-card command pill'}).toBe(0);
      // The status line names the focused card — and carries NO take verb:
      // the ONE bottom command bar already reads «A Взять», and the rail's
      // second voice is the card's factual availability (rendered only when
      // the card has something to answer for — this batch may not).
      await expect(page.locator('.con-reveal__namebar .con-cards__verdict-name')).toBeVisible();
      await expect.poll(() => page.locator('.con-reveal__namebar .con-cards__verdict--ok').count(), {message: 'no duplicated take verb in the status rail'}).toBe(0);
      // HERO size — the same weight the buy stage gives its card (fhd: an
      // unscaled 320px face; anything under ~300 is the old 0.79 ladder).
      const slotBox = await readSettled(page, async () =>
        roundBox(await page.locator('.con-reveal--embedded .con-cards__slot').first().boundingBox()),
      {message: 'the receive stage\'s hero slot'});
      expect(slotBox).not.toBeNull();
      expect(slotBox!.width, `slot width ${slotBox!.width}`).toBeGreaterThan(300);
      // The kicker mirrors the stage, never a generic «КАРТЫ».
      await expect(page.locator('.con-cmdbar')).toContainText(/Добор карт/i);
      await settle(page);
      await shoot(page, `${profile.tag}-01-receive-stage`);

      // ── 2b. L3 = the SOURCE, lifted PHYSICALLY out of the hero column. ──
      // The source card is a real object on screen, so the fullscreen must
      // raise THAT card (its slot is held empty while the viewer is up) — a
      // textual entrance left the hero standing in its column while an
      // identical card rose in the middle: two of the same card at once.
      // THE ARRIVAL GATE HAS OPENED. Input is live only once every card has
      // landed AND the flight proxies have handed over — until then the focus
      // ring, the card's name and every verb are suppressed and presses are
      // absorbed (a ring over a slot the card has not reached yet promises a
      // card that is not there). The ring IS that signal, so the drive waits
      // for it instead of racing it.
      await expect(page.locator('[data-embed-slot="workspace-reveal"] .con-cards__slot--focused'))
        .toHaveCount(1, {timeout: 12_000});

      const srcZoom = page.locator('dialog.con-zoom[open]');
      // Act → verify: each L3 gets its whole window for the viewer to open before another is sent.
      await pressUntil(page, 'KeyC', async () => await srcZoom.count() > 0, {tries: 5, settleMs: 1500});
      await expect(srcZoom).toHaveCount(1, {timeout: 8000});
      // The composer's hero slot is HELD (the zoom motion empties it) — the
      // proof that the viewer's card IS that card and not a second copy.
      await expect(page.locator('[data-motion-surface="action-composer"] .con-zoom-hold'))
        .toHaveCount(1, {timeout: 4000});
      await shoot(page, `${profile.tag}-01b-source-fullscreen`);
      // ONE press closes it. The retry is for a press DROPPED on a heavy 4K
      // frame, never for spamming: a second Escape that reaches the stage
      // underneath is B = «Взять всё», which ends the whole flow early (that
      // is how this drive used to fold the workspace and then assert on a
      // stage that was already gone). So each press waits for the dialog to
      // actually detach before another one is considered.
      // ⚠️ THE RETRY BUDGET IS THE RACE. A press is only «dropped» if the app
      // never acts on it — but the viewer's close is a RETURN FLIGHT, and on a
      // 4K frame it can take longer than the window we give it. Assuming a drop
      // too early is how the second Escape reaches the stage underneath as
      // B = «Взять всё»: the flow ends, the stage unmounts, and the assertions
      // below then report «element not found» — a fold, described as a missing
      // card. So the wait is long enough to cover the close itself, and each
      // retry re-checks that the dialog is genuinely still open.
      for (let tries = 0; tries < 3 && await srcZoom.count() > 0; tries++) {
        await page.keyboard.press('Escape');
        await srcZoom.waitFor({state: 'detached', timeout: 8000}).catch(() => { /* dropped — retry */ });
      }
      await expect(srcZoom).toHaveCount(0, {timeout: 8000});
      // …and it comes BACK: no slot left empty, no stranded hold.
      // Wait on the CARD first — it is the LAST event of the return (the hold is
      // released before it paints), so asserting it first makes the hold check
      // below a statement about a settled state rather than a second race.
      await expect(page.locator('[data-embed-slot="workspace-reveal"] .con-cards__slot .pcard'),
        'the source card returned to its slot (if this is «not found», the flow folded early — see above)')
        .toBeVisible({timeout: 8000});
      await expect(page.locator('.con-zoom-hold')).toHaveCount(0, {timeout: 6000});

      // ── 3. TAKE → NO SEAM, then fold + dock landing. ────────────────────
      // A RECORD of the HOLE the player reported: the card vanished, the
      // workspace folded, and only THEN the flight began. It exists whenever
      // the take's state commit runs before the flight's proxies stand over the
      // card (`commitAt: 'staged'` is the fix), so the honest test is "was
      // there ever a state with no card and no proxy, before the first proxy
      // appeared". A WITNESS (`armWitness`, `settled` — a hole is a state a
      // task LEAVES, never the gap between two writes of one task), armed
      // before the take: every state the product writes is kept, at any frame
      // rate — never a frame-clocked sampler that headless Chromium stops
      // driving the moment the screen goes quiet.
      const seamWitness = await armWitness<{card: boolean, proxy: boolean}>(page, 'receive-take-seam', () => ({
        card: document.querySelector('[data-embed-slot="workspace-reveal"] .pcard') !== null,
        proxy: document.querySelector('.con-handdelivery-layer .con-deal-proxy') !== null,
      }), {settled: true});
      //
      // ── THE DOUBLE-DRAW PROBE (the reported bug), watching the same press. ──
      // This batch was flown by the workspace's OWN execution beat, so nothing
      // may deal it a second time on the way out. The take is exactly where the
      // window was: the workspace drops its claim one tick before the batch is
      // dismissed (`result-detached`), and the deck-draw cinematic — whose every
      // «not ours» answer was derived from that LIVE claim — then saw an unowned
      // batch, armed, re-held the HUD counter at the PRE-draw number and flew a
      // ghost card off the pile across the take already in flight. Both symptoms
      // are watched structurally: the scene layer must never mount, and the HUD
      // counter may fall or hold but never climb. RECORDED off the product's
      // own writes (a counter that changes by text alone is a write too).
      const nodupWitness = await armWitness<{deck: number, drawScene: boolean}>(page, 'receive-take-nodup', () => {
        const el = document.querySelector('.con-deckstack__count .con-flipval__card:not(.con-flipval__card--out)');
        const n = Number.parseInt((el?.textContent ?? '').trim(), 10);
        return {deck: Number.isFinite(n) ? n : -1, drawScene: document.querySelector('.con-deckdraw') !== null};
      });
      await pressUntil(page, 'Enter', async () => (await seamWitness.values()).some((s) => s.proxy) ||
        await page.locator('.con-cardactions').count() === 0, {tries: 1, settleMs: 600});
      // The seam is judged up to the first proxy: wait for the flight to stand (bounded — a flight that never stands
      // is the fold check's red below).
      await seamWitness.waitFor((s) => s.proxy, {timeoutMs: 10_000}).catch(() => undefined);
      const seamStates = await seamWitness.stop();
      const firstProxy = seamStates.findIndex((s) => s.v.proxy);
      const hole = seamStates.slice(0, firstProxy < 0 ? seamStates.length : firstProxy).filter((s) => !s.v.card).length;
      expect(hole, `states with neither the card nor its proxy (of ${seamStates.length})`).toBe(0);
      // THE TAKE IS ONE PRESS — but a press dropped on a heavy frame is
      // indistinguishable from «the workspace refused to fold», and that is what
      // this assertion reported (3 of 5 repeats, always here). Re-pressing is
      // safe by construction: while the take is in flight the reveal ABSORBS
      // every verb (`taking|collecting`), so a second A cannot double-take — it
      // can only replace a press that never landed.
      const workspace = page.locator('.con-cardactions');
      for (let tries = 0; tries < 3 && await workspace.count() > 0; tries++) {
        const folded = await workspace.waitFor({state: 'detached', timeout: 8000})
          .then(() => true).catch(() => false);
        if (folded) {
          break;
        }
        await page.keyboard.press('Enter');
      }
      await expect(workspace, 'the finished activation left the workspace').toHaveCount(0, {timeout: 8000});
      // No proxy left hanging: the delivery layer empties once the flight lands.
      await expect(page.locator('.con-handdelivery-layer .con-deal-proxy')).toHaveCount(0, {timeout: 8000});
      // The intake LANDED: the dock's own count moves (a poll — the counter ticks on the touchdown).
      await expect.poll(() => page.locator('.con-handdock').innerText().catch(() => ''),
        {message: `dock ${dockCountBefore} → (the count after the take)`}).not.toEqual(dockCountBefore);
      // ── 3b. NO SECOND DRAW. Read only now, the whole take at rest: the
      //       duplicate fired DURING the take flight, i.e. after the fold, which
      //       is why «it looked fine and then a card came off the deck again».
      await settle(page);
      const nodup = (await nodupWitness.stop()).map((s) => s.v);
      const dup = {
        deckFrom: nodup[0]?.deck ?? -1,
        deckMax: Math.max(...nodup.map((s) => s.deck)),
        drawScene: nodup.filter((s) => s.drawScene).length,
        samples: nodup.length,
      };
      console.log(`[NODUP:${profile.tag}] ${JSON.stringify(dup)}`);
      // A dead witness must never pass: it recorded at least the state it was armed in.
      expect(dup.samples, 'the probe itself must have been alive across the take').toBeGreaterThan(0);
      expect(dup.deckFrom, 'the HUD deck counter must be readable for this probe to mean anything')
        .toBeGreaterThan(0);
      expect(dup.deckMax,
        `the deck counter climbed back up (${dup.deckFrom} → ${dup.deckMax}) — a second draw re-held it at the pre-draw size`)
        .toBeLessThanOrEqual(dup.deckFrom);
      expect(dup.drawScene,
        `the deck-draw cinematic armed for a batch this workspace had already flown (${dup.drawScene} samples)`)
        .toBe(0);
      // …and the turn is live again (the workspace released the player).
      await expect(page.locator('.con-status', {hasText: 'ДЕЙСТВИЕ'})).toHaveCount(1, {timeout: 15_000});
      await shoot(page, `${profile.tag}-02-after-take`);
    });
  });
}
