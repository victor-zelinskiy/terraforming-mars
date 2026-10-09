import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page} from './consoleTest';
import {bootFixtureSeats, openCardActions, press, pressUntil, settle, waitForBoardHome} from './consoleStart';
import {ActionDescTier, actionDescTier} from '../../src/client/console/descTier';

/**
 * THE SLOT CAPTION'S TIER, FITTED TO ITS COLUMN (PL-123) — both hosts of the
 * one length ladder («Действия карт» and «Информация › Эффекты»), 1080 + 4K.
 *
 * The ladder (`actionDescTier`) picks a starting face by LENGTH; it was
 * calibrated against a ~292 logical px couch column, and the column did not
 * stay there (278 px in the action centre, 222 px in the explorer by
 * 2026-10-09): on the TV 18 action and 30 explorer captions in the brief /
 * regular tiers were cut by their own clamp — «Метки Земли дешевле на 3…» on
 * Teractor's tile. Every host now runs `fitDescTiers` after it lays out, and
 * a caption its face does not hold steps DOWN a tier instead of being cut.
 *
 * Two halves:
 *  · LIVE — the real tiles of the council-seat fixture (Teractor's effect,
 *    Council Seat's, the Tardigrades' action, the parties'): no brief /
 *    regular caption is clipped; on 4K the fit has visibly run (a step is
 *    standing), at 1080 the ladder alone holds.
 *  · CORPUS — every caption the information model can print (the curated
 *    `short`s and the uncurated first rule lines, RU) poured through a clone
 *    of a live caption, in the host's real column and real font, stepped by
 *    the product's own rule: an AUTHORED short is never cut at any tier (that
 *    is its whole job — a new one too long for the narrowest column fails
 *    here, and the answer is a shorter short); at 1080 the ladder needs no
 *    step at all (it is calibrated there); on 4K a short rule still keeps the
 *    bigger face (the fit only takes what the column refuses).
 */

const PRESETS = [
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
] as const;

type Caption = {kind: 'effect' | 'action', curated: boolean, text: string, tier: ActionDescTier};

/** Every caption the two hosts can print, from the generated information model, translated to RU. */
function corpus(kind: 'effect' | 'action'): Array<Caption> {
  type Block = {kind?: string, text?: string, short?: string};
  const cards = JSON.parse(fs.readFileSync(path.resolve('src', 'genfiles', 'cards.json'), 'utf8')) as Array<{metadata?: {information?: {groups?: Array<{blocks?: Array<Block>}>}}}>;
  const translations = JSON.parse(fs.readFileSync(path.resolve('src', 'genfiles', 'translations.json'), 'utf8')) as Record<string, {ru?: string} | undefined>;
  const ru = (key: string) => translations[key]?.ru ?? key;
  const seen = new Set<string>();
  const out: Array<Caption> = [];
  for (const card of cards) {
    for (const group of card.metadata?.information?.groups ?? []) {
      for (const block of group.blocks ?? []) {
        if (block.kind !== kind) {
          continue;
        }
        const curated = typeof block.short === 'string' && block.short !== '';
        const text = (curated ? ru(block.short!) : ru(block.text ?? '')).replace(/^(Effect|Action|Действие|Эффект):\s*/i, '').trim();
        if (text === '' || seen.has(text)) {
          continue;
        }
        seen.add(text);
        out.push({kind, curated, text, tier: actionDescTier(text)});
      }
    }
  }
  return out;
}

const OUT = path.resolve('screenshots', 'desc-tier-fit');

async function shoot(page: Page, preset: string, name: string): Promise<void> {
  fs.mkdirSync(path.join(OUT, preset), {recursive: true});
  await page.screenshot({path: path.join(OUT, preset, `${name}.png`)});
}

type Host = {selector: string, prefix: string};
const EXPLORER: Host = {selector: '.con-efx__desc', prefix: 'con-efx__desc'};
const ACTIONS: Host = {selector: '.con-cardactions__desc', prefix: 'con-cardactions__desc'};

/** The live captions: their text, the tier they RENDER (the fitted step over the ladder class), clipped or not. */
async function liveCaptions(page: Page, host: Host): Promise<Array<{text: string, tier: string, stepped: boolean, clipped: boolean}>> {
  return await page.evaluate(({selector, prefix}) => Array.from(document.querySelectorAll<HTMLElement>(selector)).map((el) => {
    const stepped = el.getAttribute('data-desc-fit');
    const tier = stepped ?? (['brief', 'regular', 'dense'].find((t) => el.classList.contains(`${prefix}--${t}`)) ?? '?');
    return {text: (el.textContent ?? '').trim(), tier, stepped: stepped !== null, clipped: el.clientHeight > 0 && el.scrollHeight > el.clientHeight + 1};
  }), host);
}

/** The corpus through a clone of the narrowest live caption, stepped by the product's rule (`descTier.fitDescTiers`). */
async function sweep(page: Page, host: Host, captions: Array<Caption>): Promise<Array<{text: string, curated: boolean, start: string, end: string, clipped: boolean}>> {
  return await page.evaluate(({host, captions}) => {
    const lives = Array.from(document.querySelectorAll<HTMLElement>(host.selector)).filter((el) => el.clientWidth > 0);
    const live = lives.sort((a, b) => a.clientWidth - b.clientWidth)[0];
    if (live === undefined) {
      return [];
    }
    const order = ['brief', 'regular', 'dense'];
    const probe = live.cloneNode(false) as HTMLElement;
    probe.removeAttribute('data-desc-fit');
    (live.parentElement as HTMLElement).appendChild(probe);
    const base = live.className.replace(new RegExp(`\\s*${host.prefix}--\\w+`, 'g'), '');
    const clipped = () => probe.scrollHeight > probe.clientHeight + 1;
    const out = captions.map(({text, curated, tier}) => {
      probe.className = `${base} ${host.prefix}--${tier}`;
      probe.removeAttribute('data-desc-fit');
      probe.textContent = text;
      let at = order.indexOf(tier);
      while (at < order.length - 1 && clipped()) {
        at++;
        probe.setAttribute('data-desc-fit', order[at]);
      }
      return {text, curated, start: tier, end: order[at], clipped: clipped()};
    });
    probe.remove();
    return out;
  }, {host, captions});
}

async function openExplorer(page: Page): Promise<void> {
  expect(await pressUntil(page, 'KeyY', async () => await page.locator('.con-info .con-info__layout').count() > 0, {tries: 4, settleMs: 1100}),
    'the Information workspace opens on Y').toBe(true);
  await settle(page, {timeoutMs: 15_000});
  // The effects zone sits BELOW the actions column — the ring walk needs the down arrow too (the gallery's route).
  const effectsFocused = () => page.locator('.con-info__zone--effects.con-info__zone--focused').count();
  for (const move of ['ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowRight', 'ArrowDown', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowDown']) {
    if (await effectsFocused() > 0) {
      break;
    }
    await press(page, move, 300);
  }
  expect(await effectsFocused(), 'the effects zone takes the focus').toBeGreaterThan(0);
  expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-efx__desc').count() > 0, {tries: 3, settleMs: 1100}),
    'the effects explorer opens with its captions').toBe(true);
  await settle(page, {timeoutMs: 15_000, notifications: false});
}

function expectHost(label: string, preset: string, live: Array<{text: string, tier: string, stepped: boolean, clipped: boolean}>,
  swept: Array<{text: string, curated: boolean, start: string, end: string, clipped: boolean}>, total: number): void {
  expect(live.length, `${label}: the fixture shows captions`).toBeGreaterThan(0);
  const cutLive = live.filter((c) => c.tier !== 'dense' && c.clipped);
  expect(cutLive, `${label} · ${preset}: no brief / regular caption is cut on screen`).toEqual([]);
  expect(swept.length, `${label} · ${preset}: the whole corpus went through the column`).toBe(total);
  const cutCurated = swept.filter((c) => c.curated && c.clipped).map((c) => `«${c.text}» (${c.end})`);
  expect(cutCurated, `${label} · ${preset}: an authored short is never cut, at any tier`).toEqual([]);
  const stepped = swept.filter((c) => c.end !== c.start);
  const kept = swept.filter((c) => c.start === 'brief' && c.end === 'brief').length;
  console.log(`[${label} ${preset}] corpus ${swept.length}: stepped ${stepped.length}, brief kept ${kept}, dense clipped (uncurated) ${swept.filter((c) => c.clipped).length}`);
  if (preset === 'fhd') {
    expect(stepped.map((c) => `«${c.text}» ${c.start}→${c.end}`), `${label}: at 1080 the ladder alone holds — it is calibrated there`).toEqual([]);
  } else {
    expect(kept, `${label}: on the TV a short rule still keeps the bigger face — the fit only takes what the column refuses`).toBeGreaterThan(4);
  }
}

for (const preset of PRESETS) {
  test.describe(`the slot caption fits its column · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});
    test(`the effects explorer and the action centre: no brief / regular caption is cut, the corpus included (${preset.id})`, async ({page, request}) => {
      test.setTimeout(300_000);
      const overflow: Array<string> = [];
      page.on('console', (m) => {
        if (m.text().includes('[console-overflow]')) {
          overflow.push(m.text().slice(0, 200));
        }
      });
      await bootFixtureSeats(page, request, 'council-seat', {query: preset.query});
      await settle(page);

      // ── «Информация › Эффекты» ──
      await openExplorer(page);
      const effects = corpus('effect');
      const liveEffects = await liveCaptions(page, EXPLORER);
      const teractor = liveEffects.find((c) => c.text.startsWith('Метки Земли дешевле'));
      expect(teractor, 'Teractor\'s effect caption stands in the explorer').toBeDefined();
      expect(teractor!.clipped, `«${teractor!.text}» reads whole (${teractor!.tier})`).toBe(false);
      if (preset.id === 'tv4k') {
        expect(liveEffects.some((c) => c.stepped), 'on 4K the fit has run — a step stands in the 222 px column').toBe(true);
      } else {
        expect(liveEffects.filter((c) => c.stepped).map((c) => c.text), 'at 1080 no step is needed').toEqual([]);
      }
      await shoot(page, preset.id, '01-explorer');
      expectHost('explorer', preset.id, liveEffects, await sweep(page, EXPLORER, effects), effects.length);
      for (let i = 0; i < 6 && await page.locator('.con-info, .con-efx').count() > 0; i++) {
        await press(page, 'Escape', 700);
      }

      // ── «Действия карт» ──
      await waitForBoardHome(page);
      await openCardActions(page);
      await page.locator(ACTIONS.selector).first().waitFor({timeout: 15_000});
      await settle(page, {timeoutMs: 15_000, notifications: false});
      await shoot(page, preset.id, '02-actions');
      const actions = corpus('action');
      expectHost('actions', preset.id, await liveCaptions(page, ACTIONS), await sweep(page, ACTIONS, actions), actions.length);
      expect(overflow, 'no [console-overflow]').toEqual([]);
    });
  });
}
