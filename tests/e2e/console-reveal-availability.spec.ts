import {test, expect, Page, APIRequestContext} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * DRAW/REVEAL FACTUAL AVAILABILITY — the «Получены карты» screen is a
 * card-decision context, so its status rail and its fullscreen speak the SAME
 * shared availability model as the start buy / draft / hand — computed for
 * the RECIPIENT with every requirement modifier folded in.
 *
 * Fixture: INVENTRIX (first action: draw 3 cards; passive: ±2 steps on every
 * global requirement) over a deck of 23 MIN-REQUIREMENT base cards. The deal
 * is not reproducible (tests.md), so nothing assumes WHICH three come off the
 * top — every card of the pinned pool carries an unmet global minimum at the
 * game's start values, and every one stays unmet WITH Inventrix while its
 * bound shifts (so `effectiveCount` is serialized for each). The screen is
 * asserted AGAINST THE SERVER'S OWN reveal model, never a hand-computed rule.
 *
 * What only a live screen can answer:
 *  1. the reveal's status rail carries the shared one-row availability line
 *     (compact counter at the EFFECTIVE bound — the modifier is visible in
 *     the UI), and NO local take verb (the one command bar owns «A Взять»);
 *  2. the rail's box never moves between focused cards;
 *  3. X-fullscreen shows the detailed panel (same severity, «Сейчас», the
 *     modifier note) and B returns with the reveal + focus intact.
 */

const OUT = path.resolve('screenshots', 'reveal-availability');

/** 23 base cards, every one a MIN global requirement unmet at game start —
 *  and still unmet (bound shifted) under Inventrix's ±2 steps. */
const REQ_POOL = [
  'Algae', 'Ants', 'Artificial Lake', 'Biomass Combustors', 'Birds',
  'Breathing Filters', 'Bushes', 'Capital', 'Cloud Seeding',
  'Eos Chasma National Park', 'Farming', 'Fish', 'Grass', 'Great Dam',
  'Heather', 'Herbivores', 'Insects', 'Kelp Farming', 'Lake Marineris',
  'Lichen', 'Livestock', 'Mangrove', 'Moss',
];

const PRESETS = [
  {tag: 'tv-4k', width: 3840, height: 2160, query: '&consoleProfile=tv'},
  {tag: 'fhd', width: 1920, height: 1080, query: ''},
  {tag: 'handheld', width: 1280, height: 800, query: ''},
] as const;

function newGameConfig() {
  const expansions: Record<string, boolean> = {
    corpera: true, promo: false, venus: false, colonies: false,
    prelude: false, prelude2: false, turmoil: false, community: false,
    ares: false, moon: false, pathfinders: false, ceo: false,
    starwars: false, underworld: false, deltaProject: false,
  };
  return {
    players: [{name: 'RevealAvail', color: 'red', beginner: false, handicap: 0, first: true}],
    expansions,
    board: 'tharsis',
    seed: 0.42,
    randomFirstPlayer: false,
    clonedGamedId: undefined,
    undoOption: false,
    showTimers: false,
    fastModeOption: false,
    showOtherPlayersVP: false,
    testMode: true, // 500 of everything; the corp plays without a payment stop
    aresExtremeVariant: false,
    politicalAgendasExtension: 'Standard',
    solarPhaseOption: false,
    removeNegativeGlobalEventsOption: false,
    modularMA: false,
    draftVariant: false,
    initialDraft: false,
    preludeDraftVariant: false,
    ceosDraftVariant: false,
    startingCorporations: 1,
    shuffleMapOption: false,
    randomMA: 'No randomization',
    includeFanMA: false,
    soloTR: false,
    customCorporationsList: ['Inventrix'],
    bannedCards: [],
    includedCards: [],
    customColoniesList: [],
    customPreludes: [],
    // The whole visible deck: 20 dealt (test-mode deal) + 3 left on top for
    // the first-action draw — WHICH three is random, and deliberately does
    // not matter (see the header).
    customProjectCards: [...REQ_POOL],
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

async function key(page: Page, code: string, settleMs = 400): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settleMs);
}

async function shoot(page: Page, preset: string, name: string): Promise<void> {
  const dir = path.join(OUT, preset);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

/** Drive the start WIZARD (corp → buy nothing → summary) — the state-driven
 *  walk console-play-draw-embed proved out (a blind key script drifts). */
async function runWizard(page: Page, corp: string): Promise<void> {
  const frame = page.locator('.con-start__frame');
  let lastFocused = '';
  let stalls = 0;
  const walk = async (focused: string) => {
    if (focused === '') {
      await page.waitForTimeout(400);
      return;
    }
    stalls = focused === lastFocused ? stalls + 1 : 0;
    await key(page, stalls >= 1 ? 'ArrowDown' : 'ArrowRight', 240);
    lastFocused = focused;
  };
  for (let i = 0; i < 220 && await frame.count() > 0; i++) {
    const s = await page.evaluate(() => ({
      active: (document.querySelector('.con-jrail__item--current')?.textContent ?? '').toUpperCase(),
      focused: document.querySelector('.con-cards__slot--focused')?.getAttribute('data-zoom-slot') ?? '',
      picked: Array.from(document.querySelectorAll('.con-cards__slot--picked'))
        .filter((el) => (el as HTMLElement).offsetParent !== null)
        .map((el) => el.getAttribute('data-zoom-slot') ?? ''),
      ceremony: document.querySelector('.con-start--ceremony') !== null,
    }));
    if (s.ceremony) {
      return; // the wizard flowed into the deployment inside the same root
    }
    if (s.active.includes('КОРПОРАЦ')) {
      if (s.picked.includes(corp)) {
        await key(page, 'Period', 1100);
        lastFocused = '';
      } else if (s.focused === corp) {
        await key(page, 'Enter', 600);
        lastFocused = '';
      } else {
        await walk(s.focused);
      }
      continue;
    }
    if (s.active.includes('ПРОЕКТ')) {
      await key(page, 'Period', 1100); // buy nothing — the draw is the subject
      lastFocused = '';
      continue;
    }
    await key(page, 'Enter', 1200); // the summary commits
  }
}

type ModelReason = {
  type: string, requirement?: boolean, current?: number,
  params?: Array<string>, effectiveCount?: number,
};
type ModelCard = {name: string, unplayableReasons?: Array<ModelReason>};

/** The SERVER's own reveal batch — the ground truth the screen must match. */
async function serverReveal(request: APIRequestContext, playerId: string): Promise<Array<ModelCard>> {
  const model = await (await request.get(`/api/player?id=${playerId}`)).json();
  return (model.cardDrawReveals?.[0]?.cards ?? []) as Array<ModelCard>;
}

/** The reveal's status rail, read whole (box + content). */
async function railReadout(page: Page) {
  return await page.evaluate(() => {
    const bar = document.querySelector<HTMLElement>('.con-reveal__namebar');
    const avail = bar?.querySelector<HTMLElement>('.con-cardavail');
    const r = bar?.getBoundingClientRect();
    return {
      box: r === undefined ? undefined : {top: Math.round(r.top), height: Math.round(r.height)},
      held: bar?.classList.contains('con-reveal__namebar--held') ?? true,
      name: (bar?.querySelector<HTMLElement>('.con-cards__verdict-name')?.innerText ?? '').trim(),
      severity: avail?.getAttribute('data-severity') ?? '',
      reason: (avail?.querySelector<HTMLElement>('.con-cardavail__text')?.innerText ?? '').replace(/\s+/g, ' ').trim(),
      verbChips: bar?.querySelectorAll('.con-cards__verdict--ok').length ?? 0,
      slotPills: document.querySelectorAll('.con-reveal .con-start__slot-a').length,
      focusedSlot: document.querySelector('.con-reveal .con-cards__slot--focused')?.getAttribute('data-zoom-slot') ?? '',
    };
  });
}

for (const preset of PRESETS) {
  test.describe(`reveal availability · ${preset.tag}`, () => {
    test.use({
      viewport: {width: preset.width, height: preset.height},
      deviceScaleFactor: 1,
      screen: {width: preset.width, height: preset.height},
    });

    test('the drawn batch states factual availability — rail (compact, modifier-aware) + fullscreen (detailed)', async ({page, request}) => {
      test.setTimeout(300_000);
      const created = await request.post('/api/creategame', {data: newGameConfig()});
      expect(created.ok(), `create-game failed: ${created.status()}`).toBeTruthy();
      const model = await created.json() as {players: Array<{id: string}>};
      const playerId = model.players[0].id;
      await page.goto(`/player?id=${playerId}&console=1${preset.query}`);
      await page.waitForSelector('.con-start__frame, .con-root', {timeout: 45_000});
      await page.waitForSelector('.con-load', {state: 'detached'}).catch(() => {});
      await page.waitForSelector('.boot-loader', {state: 'detached', timeout: 150_000}).catch(() => {});
      await page.waitForTimeout(3000); // deal cinematic settle
      await runWizard(page, 'Inventrix');

      // ── The deployment plays the corp; A performs the mandatory first
      //    action, which draws the pinned three (the Point Luna pattern:
      //    press A wherever a CTA or the briefing stands). ────────────────
      for (let i = 0; i < 80 && await page.locator('.con-reveal').count() === 0; i++) {
        const cta = await page.evaluate(() => ({
          pill: document.querySelector('.con-start__slot-a') !== null,
          briefing: document.querySelector('.con-start__firstact--ready') !== null,
          mandatory: document.querySelector('.con-mandatory') !== null,
        }));
        if (cta.pill || cta.briefing || cta.mandatory) {
          await key(page, 'Enter', 700);
        } else {
          await page.waitForTimeout(400);
        }
      }
      await expect(page.locator('.con-reveal'), 'the drawn batch presented').toHaveCount(1, {timeout: 30_000});

      // The ARRIVAL GATE opens: the rail publishes only past the commit.
      await expect.poll(async () => {
        const r = await railReadout(page);
        return !r.held && r.name.length > 0 ? 'ready' : JSON.stringify(r).slice(0, 120);
      }, {timeout: 30_000}).toBe('ready');

      // ── Ground truth: the server's own batch (subject = the recipient). ──
      const drawn = await serverReveal(request, playerId);
      expect(drawn.length, 'the first action drew a batch').toBeGreaterThan(0);
      for (const card of drawn) {
        const req = (card.unplayableReasons ?? []).find((r) => r.requirement === true);
        expect(req, `«${card.name}» carries its requirement reason in the reveal model`).toBeDefined();
        expect(req?.effectiveCount, `«${card.name}»: Inventrix's ±2 shifted the bound`).toBeDefined();
      }

      // ── 1 · the focused card: the rail speaks the model, compactly. ──
      const first = await railReadout(page);
      const focusedName = first.focusedSlot.split('#')[0];
      const focusedModel = drawn.find((c) => c.name === focusedName);
      expect(focusedModel, `the focused slot «${first.focusedSlot}» is one of the server's drawn cards`).toBeDefined();
      const req = (focusedModel?.unplayableReasons ?? []).find((r) => r.requirement === true)!;
      await shoot(page, preset.tag, '01-rail-requirement');
      expect(first.severity, `pending — the draft voice (${JSON.stringify(first)})`).toBe('pending');
      // The compact counter: current / EFFECTIVE bound — the modifier visible
      // right on the rail; never the full «Требуется … · Сейчас …» sentence.
      expect(first.reason).toContain(`${req.current}/`);
      expect(first.reason).toContain(`/${req.effectiveCount}`);
      expect(first.reason, 'the compact counter, never the full sentence').not.toContain('·');
      // …and NO duplicated controller verb anywhere near the cards.
      expect(first.verbChips, 'no local take verb — the command bar owns it').toBe(0);
      expect(first.slotPills, 'no on-card A-pill').toBe(0);
      await expect(page.locator('.con-cmdbar')).toContainText(/Взять/i);

      // ── 2 · the LAYOUT INVARIANT: focus moves, the rail box does not. ──
      if (drawn.length > 1) {
        await key(page, 'ArrowRight', 500);
        const second = await railReadout(page);
        expect(second.box, 'the rail box never moves with the focus').toEqual(first.box);
        expect(second.name.length, 'the rail names the newly focused card').toBeGreaterThan(0);
        await key(page, 'ArrowLeft', 500);
      }

      // ── 3 · X-fullscreen: the detailed panel, same severity; B returns. ──
      await key(page, 'KeyX', 400);
      await page.waitForSelector('dialog.con-zoom[open]', {timeout: 15_000});
      await page.waitForTimeout(1200);
      const panel = await page.evaluate(() => {
        const el = document.querySelector<HTMLElement>('.con-zoom-sidecol .con-cardavail--panel');
        return el === null ? undefined : {
          severity: el.getAttribute('data-severity') ?? '',
          text: (el.querySelector<HTMLElement>('.con-cardavail__text')?.innerText ?? '').replace(/\s+/g, ' ').trim(),
          mods: (el.querySelector<HTMLElement>('.con-cardavail__mods')?.innerText ?? '').replace(/\s+/g, ' ').trim(),
        };
      });
      await shoot(page, preset.tag, '02-fullscreen-panel');
      expect(panel, 'the fullscreen shows the availability panel').toBeDefined();
      expect(panel?.severity, 'one model — same verdict as the rail').toBe('pending');
      expect(panel?.text, 'the DETAILED sentence with the current value').toMatch(/Сейчас|Now/);
      expect(panel?.mods, 'the modifier note names the stretched bound').toContain(String(req.effectiveCount));

      await key(page, 'Escape', 600);
      await expect.poll(async () => page.locator('dialog.con-zoom[open]').count(), {timeout: 15_000}).toBe(0);
      const back = await railReadout(page);
      expect(back.name, 'B returned to the reveal with focus intact').toBe(first.name);
      expect(back.severity).toBe('pending');

      // ── 4 · take everything — the flow completes and cleans up. ──
      for (let i = 0; i < 8 && await page.locator('.con-reveal').count() > 0; i++) {
        await key(page, 'Enter', 900); // A takes card by card (embedded batch)
      }
      await expect.poll(async () => page.locator('.con-reveal').count(), {timeout: 45_000}).toBe(0);
      await shoot(page, preset.tag, '03-after-take');
    });
  });
}
