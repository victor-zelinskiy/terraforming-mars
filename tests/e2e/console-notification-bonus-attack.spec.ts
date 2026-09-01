import {test, expect, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootWithCards, press, soloGameConfig, turnChip, waitForBoardHome, waitForTurn} from './consoleStart';

/**
 * THE P0 REGRESSION — the bot's bonus-card attack as ONE atomic notification.
 *
 * The reported defect (screenshot 2026-09-01): MarsBot plays Meteor Shower,
 * the player loses plants, and the card was suspected to arrive NEUTRAL and
 * grow its red hero later (it did — `viewerImpactOfBotTurn` read only the
 * impact steps, whose loss the server's `coveredByAttack` de-dup suppresses,
 * and the visible-card refresh then upgraded sign/importance/TTL in place),
 * with the victim line duplicated below the band and the bonus card's NAME
 * lost the moment the band led.
 *
 * This spec pins the ATOMIC contract on a LIVE run, frame-observed: a
 * MutationObserver samples every notification card from BEFORE the bot's
 * turn, so «the first visible frame already carries the final semantics» is
 * measured, never posed. A final screenshot cannot prove the absence of a
 * late hero — the sample stream can.
 *
 * DETERMINISM: `customBonusCards: ['B01']` (the automa dev seam) puts Meteor
 * Shower in the bot's starting action deck; the forced EcoLine corporation
 * starts the human with 3 plants, so the attack always has something to take.
 */

const SHOTS = path.resolve('screenshots', 'notification-bonus-attack');

const CHEAP_CARD = 'Power Plant';

const CONFIG = soloGameConfig({
  automa: {difficulty: 'normal'},
  customBonusCards: ['B01'],
  customCorporationsList: ['Ecoline'],
  customProjectCards: [CHEAP_CARD],
});

type Wire = {type: string, options?: Array<Wire>, cards?: Array<{name: string}>, min?: number, buttonLabel?: string};
type Model = {waitingFor?: Wire, game: {phase: string, generation: number}};

type CardSample = {
  id: string,
  sign: string,
  importance: string,
  hasBand: boolean,
  ttlDur: string,
  text: string,
  leaving: boolean,
};
type Sample = {
  t: number,
  cards: Array<CardSample>,
  tailVisible: boolean,
  evqVisible: boolean,
  /** Rounded boxes of the permanent top-bar slot + the «ПКЛ.» block — the
   *  «bar never shifts a pixel» polish claim, sampled every frame. */
  evqRect: string,
  genRect: string,
};

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(SHOTS, {recursive: true});
  await page.screenshot({path: path.join(SHOTS, `${name}.png`)});
}

/** Keep BeginFrames flowing (headless rAF starves on quiet frames). */
async function settle(page: Page, ms: number): Promise<void> {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    await page.screenshot({clip: {x: 0, y: 0, width: 8, height: 8}}).catch(() => {});
    await page.waitForTimeout(100);
  }
}

/**
 * Arm the lifecycle auditor: MutationObserver + a setInterval floor (NEVER
 * rAF — headless Chromium parks it on quiet frames, which is exactly when
 * these bugs fire). Every sample captures every visible notification card's
 * semantic identity + the two queue indicators.
 */
async function armAuditor(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__notifSamples?: Array<Sample>};
    type Sample = {t: number, cards: Array<unknown>, tailVisible: boolean, evqVisible: boolean};
    w.__notifSamples = [];
    const visible = (el: Element | null): boolean => {
      if (el === null) {
        return false;
      }
      // A DEPARTING element (Vue leave transition) belongs to the PREVIOUS
      // state — the tail legitimately fades out WITH its card, so a mid-fade
      // sample must not read as «indicator without a card».
      if (el.classList.contains('notification-pop-leave-active')) {
        return false;
      }
      const r = (el as HTMLElement).getBoundingClientRect();
      if (r.width === 0 || r.height === 0) {
        return false;
      }
      const cs = getComputedStyle(el as HTMLElement);
      return cs.visibility !== 'hidden' && Number(cs.opacity) > 0.05;
    };
    const sample = (): void => {
      const cards = Array.from(document.querySelectorAll('.con-notif')).map((el) => {
        const cls = Array.from(el.classList);
        const progress = el.querySelector('.con-notif__progress') as HTMLElement | null;
        return {
          id: el.getAttribute('data-notif-id') ?? '',
          sign: cls.find((c) => c.startsWith('con-notif--sign-')) ?? '',
          importance: cls.find((c) => c.startsWith('con-notif--imp-')) ?? '',
          hasBand: el.querySelector('.con-notif__you') !== null,
          ttlDur: progress?.style.animationDuration ?? '',
          text: (el as HTMLElement).innerText.replace(/\s+/g, ' ').trim(),
          // A departing card belongs to the previous state — the indicator
          // invariants judge only settled presence.
          leaving: el.classList.contains('notification-pop-leave-active'),
        };
      });
      const rectOf = (sel: string): string => {
        const el = document.querySelector(sel);
        if (el === null) {
          return 'absent';
        }
        const r = el.getBoundingClientRect();
        return `${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)},${Math.round(r.height)}`;
      };
      w.__notifSamples!.push({
        t: Date.now(),
        cards,
        tailVisible: visible(document.querySelector('.con-notifq')),
        evqVisible: visible(document.querySelector('.con-status__evq--on')),
        evqRect: rectOf('.con-status__evq'),
        genRect: rectOf('.con-status__gen'),
      });
      if (w.__notifSamples!.length > 20_000) {
        w.__notifSamples!.splice(0, 5_000);
      }
    };
    const observer = new MutationObserver(sample);
    observer.observe(document.body, {childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'data-notif-id']});
    setInterval(sample, 120);
    sample();
  });
}

async function takeSamples(page: Page): Promise<Array<Sample>> {
  return await page.evaluate(() => (window as unknown as {__notifSamples: Array<Sample>}).__notifSamples);
}

/** Is the hostile bot card ON SCREEN right now (band present)? */
async function hostileCardLive(page: Page): Promise<boolean> {
  return await page.evaluate(() =>
    document.querySelector('.con-notif.notification-card--variant-bot-turn .con-notif__you') !== null);
}

/** Has the AUDITOR ever sampled a hostile bot card? (The drive's own research
 *  submit can auto-acknowledge a flow-holding card — the sample stream is the
 *  witness that outlives the live window.) */
async function hostileCardSampled(page: Page): Promise<boolean> {
  const samples = await takeSamples(page);
  return samples.some((frame) => frame.cards.some((c) => c.id.startsWith('bot:') && c.hasBand));
}

/**
 * Drive the game THROUGH THE PAGE UI until the bot's bonus attack presents.
 *
 * ⚠️ Never over the API: while the viewer holds a prompt the transport
 * deliberately skips the full view refresh (a partial input must not be
 * dropped), so an API-submitted pass leaves the OPEN page frozen on the old
 * state forever — the documented out-of-band trap. The wheel pass (LT →
 * «Пас») and `waitForBoardHome` (answers research and stray prompts) are the
 * real player's own road.
 */
async function passUntilHostileCard(page: Page): Promise<boolean> {
  let waitingShotTaken = false;
  for (let round = 0; round < 10; round++) {
    // Watch the feed for a while — the bot's run presents card by card.
    const watchUntil = Date.now() + 22_000;
    while (Date.now() < watchUntil) {
      if (await hostileCardLive(page)) {
        return true;
      }
      // Best-effort visual record of the WAITING slot (needs a ≥500 ms
      // blocked backlog with no card — a bot run's tile animation window).
      if (!waitingShotTaken &&
          await page.locator('.con-status__evq--on').count() > 0) {
        waitingShotTaken = true;
        await shoot(page, '00-evq-waiting');
      }
      await page.screenshot({clip: {x: 0, y: 0, width: 8, height: 8}}).catch(() => {});
      await page.waitForTimeout(300);
    }
    if (await hostileCardSampled(page)) {
      return true;
    }
    // Advance the game one step through the UI: pass when the action menu is
    // live, else let the home-walk answer whatever stands (the research buy).
    if (await turnChip(page).count() > 0) {
      await press(page, 'Comma', 900); // LT — the basic-actions wheel
      await press(page, 'ArrowDown', 500); // «Пас»
      await press(page, 'Enter', 1200);
    } else {
      await waitForBoardHome(page, 10).catch(() => {});
    }
  }
  return await hostileCardSampled(page);
}

test.describe('bonus-card attack — atomic notification lifecycle', () => {
  // NOTIF_VIEWPORT=4k reruns the same lifecycle at the TV target (3840×2160)
  // for the visual pass; the default stays the suite's 720p (lifecycle
  // invariants are resolution-independent, the pixels are checked at both).
  if (process.env.NOTIF_VIEWPORT === '4k') {
    test.use({viewport: {width: 3840, height: 2160}, deviceScaleFactor: 1, screen: {width: 3840, height: 2160}});
  }
  test.setTimeout(420_000);

  test('the hostile bot card is born final: no late hero, no second version, the card named, indicators exclusive', async ({page, request}) => {
    // Optional CPU throttle (NOTIF_THROTTLE=4 → 4× slowdown): late-enrichment
    // races widen under a starved main thread, which is exactly where a
    // non-atomic pipeline would betray itself. The invariants must hold at
    // ANY speed — the throttled run proves it.
    const throttle = Number(process.env.NOTIF_THROTTLE ?? '0');
    if (throttle > 1) {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', {rate: throttle});
    }
    await bootWithCards(page, request, {cards: [CHEAP_CARD], config: CONFIG, corporation: 'Ecoline'});
    await waitForTurn(page);

    await armAuditor(page);
    const found = await passUntilHostileCard(page);
    expect(found, 'the bot played its bonus attack and the hostile card presented').toBe(true);
    await settle(page, 700);
    await shoot(page, '01-hostile-card');

    const samples = await takeSamples(page);
    expect(samples.length, 'the auditor actually sampled').toBeGreaterThan(10);

    // ── Per-card lifecycle invariants over EVERY sampled frame ────────────
    const byId = new Map<string, Array<{idx: number, s: CardSample}>>();
    samples.forEach((frame, idx) => {
      for (const c of frame.cards) {
        if (c.id === '') {
          continue;
        }
        const arr = byId.get(c.id) ?? [];
        arr.push({idx, s: c});
        byId.set(c.id, arr);
      }
    });

    for (const [cardId, frames] of byId) {
      // 1) SIGN IS FROZEN AT MOUNT — a neutral → negative upgrade after the
      //    first visible frame is the late-hero defect.
      const signs = new Set(frames.map((f) => f.s.sign));
      expect([...signs], `card ${cardId} changed its sign mid-display`).toHaveLength(1);
      // 2) The hero band never ARRIVES later: if the card ever has it, it has
      //    it from its very first sampled frame.
      const everBand = frames.some((f) => f.s.hasBand);
      if (everBand) {
        expect(frames[0].s.hasBand, `card ${cardId} grew its hero band after mount`).toBe(true);
      }
      // 3) The TTL is armed once — an animationDuration change restarts the
      //    lifetime bar (the old hostile re-arm).
      const durations = new Set(frames.map((f) => f.s.ttlDur).filter((d) => d !== ''));
      expect([...durations], `card ${cardId} re-armed its lifetime`).toHaveLength(1);
      // 4) ONE presentation episode per id — an id that disappears and comes
      //    back was re-queued/re-mounted (the «two versions» defect). Allow a
      //    2-frame gap for the leave transition's unmount timing.
      let episodes = 1;
      for (let i = 1; i < frames.length; i++) {
        if (frames[i].idx - frames[i - 1].idx > 3) {
          episodes++;
        }
      }
      expect(episodes, `card ${cardId} presented more than once`).toBe(1);
    }

    // ── The hostile card's CONTENT (the causal chain on one card) ─────────
    const hostile = [...byId.values()].map((frames) => frames[frames.length - 1].s)
      .find((s) => s.hasBand && s.id.startsWith('bot:'));
    expect(hostile, 'the hostile bot-turn card was captured').toBeDefined();
    const text = hostile!.text;
    // The hero leads («ВЫ ПОТЕРЯЛИ» — CSS uppercases the band label)…
    expect(text).toContain('ВЫ ПОТЕРЯЛИ');
    // …the before → after readout is present…
    expect(text).toMatch(/\d+\s*→\s*\d+/);
    // …the CAUSE names the bonus card (the headline survives the band)…
    expect(text).toContain('Метеоритный дождь');
    // …the card's fate is stated…
    expect(text).toContain('уничтожена');
    // …and the victim's own summary line is NOT duplicated below the band
    // (lowercase «потерял…» — the band's own label is uppercase).
    expect(text).not.toMatch(/потерял /);
    // The head is the neutral event voice + the actor chip — never the actor
    // twice («ХОД ЗАВЕРШЁН» + [Бот], not «БОТ ЗАВЕРШИЛ ХОД» + [Бот]).
    expect(text).toContain('ХОД ЗАВЕРШЁН');

    // ── Queue indicators are mutually exclusive in EVERY sampled frame ────
    // (Settled presence only: a card in its leave transition belongs to the
    // previous state, and the top-bar engage hysteresis may fire inside it.)
    for (const frame of samples) {
      const active = frame.cards.some((c) => !c.leaving);
      if (frame.tailVisible) {
        expect(active, '«ДАЛЬШЕ +N» existed without an active card').toBe(true);
      }
      if (frame.evqVisible) {
        expect(active, 'the top-bar signal coexisted with an active card').toBe(false);
      }
      expect(frame.tailVisible && frame.evqVisible, 'both indicators in one frame').toBe(false);
    }

    // ── The permanent slot NEVER moves the top bar — not by one pixel ─────
    // The evq slot holds ONE box across every sampled frame of the whole run
    // (dormant, waiting, transitions — all of it). The «ПКЛ.» block beside it
    // may transiently WIDEN leftward while its value flip-swaps (the
    // pre-existing premium announcement, out of this polish's scope) — what
    // it may never do is displace its neighbours: its right edge and vertical
    // band are pinned.
    const evqRects = new Set(samples.map((f) => f.evqRect));
    expect([...evqRects], 'the pending-events slot moved/resized').toHaveLength(1);
    expect(samples[0].evqRect).not.toBe('absent');
    const genEdges = new Set(samples.map((f) => {
      if (f.genRect === 'absent') {
        return 'absent';
      }
      const [left, top, width, height] = f.genRect.split(',').map(Number);
      return `${left + width},${top},${height}`;
    }));
    expect([...genEdges], 'the «ПКЛ.» block displaced its neighbours').toHaveLength(1);
    const evqWaitingFrames = samples.filter((f) => f.evqVisible).length;
    console.log(`[notif-bonus] evq slot box: ${samples[0].evqRect}; waiting frames sampled: ${evqWaitingFrames}/${samples.length}`);

    // ── Best-effort WAITING visual: the turn review is a real ≥500 ms
    //    blocker — opening it from the live card (X-hold) dismisses the card,
    //    and a queued follow-up then waits blocked with nothing active: the
    //    exact dormant → waiting transition of the permanent top-bar slot.
    //    Purely opportunistic (needs a backlog at this moment) — the DOM
    //    specs carry the deterministic proof; this only records the pixels.
    if (await hostileCardLive(page) &&
        await page.locator('.con-notifq').count() > 0) {
      await page.keyboard.down('KeyX');
      await page.waitForTimeout(1_000);
      await page.keyboard.up('KeyX');
      if (await page.locator('.mbr').count() > 0) {
        const lit = await page.waitForSelector('.con-status__evq--on', {timeout: 2_500}).catch(() => null);
        await settle(page, 400);
        if (lit !== null) {
          await shoot(page, '03-evq-waiting');
        }
        await page.keyboard.press('Escape'); // close the review
        await settle(page, 900);
      }
    }

    // ── It leaves exactly once and never returns ──────────────────────────
    // Preferred exit: the player's B while it is live (the toast override).
    // If the drive's own submit auto-acknowledged it (a legal finish), the
    // single-episode assertion above already proved it never re-presented —
    // here we additionally verify the END state has no copy of it.
    const hostileId = hostile!.id;
    if (await hostileCardLive(page)) {
      await page.keyboard.press('Escape'); // B — the toast override closes the card
    }
    await settle(page, 1_800);
    const after = await takeSamples(page);
    const lastFrames = after.slice(-8);
    for (const frame of lastFrames) {
      expect(frame.cards.some((c) => c.id === hostileId), 'the dismissed card came back').toBe(false);
    }
    await shoot(page, '02-after-dismiss');
  });
});
