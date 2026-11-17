import * as fs from 'fs';
import * as path from 'path';
import {expect, test, Page} from './consoleTest';
import {cinematicBeat, fillPicks, openConsole, pickedCards, press, pressUntil, waitStepDealSettled, walkFocusUntil} from './consoleStart';
import {campaignBase, createCampaign, devCommit, launchMission} from './campaignFixtures';
import {titleOf} from './consoleEndgameHarness';
import {readSettled} from './settledRead';
import {readTransient, recordTransient} from './transientRecorder';

/*
 * CAMPAIGN «ТЕНДЕРЫ» — THE STORYBOARD ON THE PRODUCT (the owner, 2026-11-09: «TV-профиль — это продукт; все кейсы
 * проверить и провести углублённую визуальную полировку»). The finale's start at TV 4K, every beat a CDP-screencast
 * storyboard (`screenshots/tenders-4k/story-<beat>/t<ms>.jpg`) plus a still per stand:
 *   the door lit · the list rising out of the dock · the restructuring's sheet and row · «Открытый конкурс» (+2 preludes —
 *   the standing cards GLIDE, only the new ones deal) · the purchase ledger and «Субсидия» (the price ticks in place) ·
 *   «Широкий портфель» (+4 projects — the row re-scales into its new layout) · «Целевой запрос» (the tag tiles, +3).
 * The same physical witnesses as the functional spec ride every beat: no card already on the table is dealt again, no
 * certificate is painted twice in two places. The threshold's legacy tenders are filmed by `console-carryover-album` F
 * (its table is tv4k already).
 */

type WirePrompt = {type: string, title: string | {message: string}, options?: Array<WirePrompt>, cards?: Array<{name: string}>};
type WireModel = {waitingFor?: WirePrompt};

const OUT = path.resolve('screenshots', 'tenders-4k');
const EXPANSIONS = {
  corpera: true, promo: false, venus: false, colonies: false, prelude: true,
  prelude2: false, turmoil: false, community: false, ares: false, moon: false,
  pathfinders: false, ceo: false, starwars: false, underworld: false, deltaProject: false,
};

test.use({viewport: {width: 3840, height: 2160}});

async function model(request: Parameters<typeof createCampaign>[0], id: string): Promise<WireModel> {
  const res = await request.get(`${campaignBase()}/api/player?id=${id}`);
  expect(res.ok()).toBeTruthy();
  return res.json();
}

function stepCards(m: WireModel, title: RegExp): Array<string> {
  const step = (m.waitingFor?.options ?? []).find((o) => title.test(titleOf(o as never)));
  return (step?.cards ?? []).map((c) => c.name);
}

/** Two at-rest reads agree to the half pixel — a subpixel that jitters is not motion. */
function samePx<T>(a: T, b: T): boolean {
  const px = (_key: string, v: unknown) => typeof v === 'number' ? Math.round(v * 2) / 2 : v;
  return JSON.stringify(a, px) === JSON.stringify(b, px);
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

/** A CDP screencast of one beat — every frame the compositor produced, named by its ms from the start. */
async function story(page: Page, name: string): Promise<() => Promise<number>> {
  const dir = path.join(OUT, `story-${name}`);
  fs.rmSync(dir, {recursive: true, force: true});
  fs.mkdirSync(dir, {recursive: true});
  const client = await page.context().newCDPSession(page);
  const t0 = Date.now();
  let frames = 0;
  client.on('Page.screencastFrame', (frame) => {
    frames++;
    fs.writeFileSync(path.join(dir, `t${String(Date.now() - t0).padStart(5, '0')}.jpg`), Buffer.from(frame.data, 'base64'));
    void client.send('Page.screencastFrameAck', {sessionId: frame.sessionId}).catch(() => undefined);
  });
  await client.send('Page.startScreencast', {format: 'jpeg', quality: 80, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1});
  return async () => {
    await client.send('Page.stopScreencast').catch(() => undefined);
    return frames;
  };
}

test.describe('campaign «Тендеры» — the storyboard at TV 4K', () => {
  test('every start tender\'s scene, filmed on the product profile', async ({page, request}) => {
    test.setTimeout(600_000);
    const {id} = await createCampaign(request, {testMode: false, expansions: EXPANSIONS}, {rewardMode: 'tenders', missionCount: 3});
    await launchMission(request, id);
    await devCommit(request, id, [0, 1], {
      lineages: {0: ['Ecoline'], 1: ['Helion']},
      tenders: {0: ['restructuring', 'openCall', 'broadPortfolio', 'researchSubsidy', 'targetedRequest']},
    });
    await launchMission(request, id);
    await devCommit(request, id, [0, 1], {lineages: {0: ['Ecoline', 'Mining Guild'], 1: ['Helion', 'Saturn Systems']}, tenders: {1: ['gamblePreludes']}});
    const {yourPlayerId: aliceId} = await launchMission(request, id);
    expect(aliceId).toBeTruthy();

    await openConsole(page, aliceId!, '&consoleProfile=tv');
    await page.waitForSelector('.con-start__frame', {timeout: 90_000});
    await waitStepDealSettled(page);
    const subject = () => page.locator('.con-wshead__subject').last().innerText();
    const list = page.locator('[data-tender-portfolio]');
    const sheet = page.locator('[data-tender-sheet]');

    // The physical witnesses (the functional spec's own): a certificate painted in two PLACES at once; every card the
    // deal layer held (= dealt).
    await recordTransient(page, 'tender-twins', () => {
      const places: Record<string, Array<DOMRect>> = {};
      for (const el of Array.from(document.querySelectorAll<HTMLElement>('[data-tender]'))) {
        const r = el.getBoundingClientRect();
        if (r.width < 4 || r.height < 4 || r.right < 0 || r.left > window.innerWidth || r.bottom < 0 || r.top > window.innerHeight) {
          continue;
        }
        let op = 1;
        let hidden = false;
        for (let n: HTMLElement | null = el; n !== null; n = n.parentElement) {
          const cs = window.getComputedStyle(n);
          if (cs.visibility === 'hidden' || cs.display === 'none') {
            hidden = true;
            break;
          }
          op *= Number(cs.opacity);
        }
        if (hidden || op < 0.35) {
          continue;
        }
        const tid = el.getAttribute('data-tender') ?? '?';
        const same = (a: DOMRect) => Math.abs((a.left + a.width / 2) - (r.left + r.width / 2)) < Math.max(a.width, r.width) * 0.3 &&
          Math.abs((a.top + a.height / 2) - (r.top + r.height / 2)) < Math.max(a.height, r.height) * 0.3;
        const known = places[tid] ?? [];
        if (!known.some(same)) {
          places[tid] = [...known, r];
        }
      }
      const dups = Object.entries(places).filter(([, at]) => at.length > 1).map(([tid, at]) => `${tid}x${at.length}`).sort().join(',');
      if (dups === '') {
        return '';
      }
      const where = Object.entries(places).filter(([, at]) => at.length > 1)
        .map(([k, at]) => `${k}@` + at.map((b) => `${Math.round(b.left)},${Math.round(b.top)},${Math.round(b.width)}`).join('/')).join(' ');
      const sheetId = document.querySelector('[data-tender-sheet]')?.getAttribute('data-tender-sheet-id') ?? '-';
      const live = document.querySelector('[data-tender-portfolio]')?.classList.contains('con-tport--live') ? 'live' : 'idle';
      return `${dups} | sheet=${sheetId} list=${live} | ${where}`;
      // `settled`: «painted twice AT ONCE» is a claim about a frame — the state a task leaves, never the one between
      // a tween's write and the reactive flush that empties the tile in the same task (transientRecorder.ts).
    }, {settled: true});
    const twins = async () => (await readTransient<string>(page, 'tender-twins')).map((x) => x.v).filter((v) => v !== '');
    await recordTransient(page, 'deal-held', () => Array.from(document.querySelectorAll<HTMLElement>('[data-deal-dealing="yes"][data-step-slot]'))
      .map((el) => (el.getAttribute('data-step-slot') ?? '').split('|')[1] ?? '').sort().join(','));
    let dealMark = 0;
    const markDeal = async () => {
      dealMark = (await readTransient<string>(page, 'deal-held')).length;
    };
    const dealtSinceMark = async () => [...new Set((await readTransient<string>(page, 'deal-held')).slice(dealMark)
      .flatMap((x) => x.v.split(',')).filter((n) => n !== ''))];

    const openDoor = async () => {
      await press(page, 'KeyC', 600);
      await expect(list).toHaveClass(/con-tport--live/, {timeout: 15_000});
    };
    // The certificate under the cursor — a focus walk is the shared primitive's (every hop given its window, a wall
    // turned around), never a private «ArrowRight until it reads».
    const focusedKind = () => page.evaluate(() =>
      document.querySelector('[data-tport-focused="yes"]')?.getAttribute('data-tport-kind') ?? '');
    const focusTender = async (kind: string) => {
      if (!await walkFocusUntil(page, async () => await focusedKind() === kind, focusedKind, 8, 250)) {
        throw new Error(`never focused the «${kind}» certificate`);
      }
    };
    const openSheetOf = async (kind: string, still: string) => {
      await openDoor();
      await focusTender(kind);
      await press(page, 'Enter', 900);
      await expect(sheet).toHaveAttribute('data-tender-sheet-id', kind, {timeout: 10_000});
      await expect(sheet).toHaveAttribute('data-tender-sheet-open', 'yes', {timeout: 10_000});
      await cinematicBeat(page, 400, 'the RESULT panel unfolds beside the landed hero');
      await shoot(page, still);
    };
    /** A deal that GROWS: the press, the hand-over, the glide, the new cards — filmed, then the physics judged. */
    const growBy = async (kind: string, pool: RegExp, slot: string, by: number, key: 'Enter' | 'Period') => {
      const before = stepCards(await model(request, aliceId!), pool);
      await markDeal();
      // The row's geometry through the beat: the strip's zoom, the first standing card's painted width, and the slide's
      // proxies' widths — a slide must never shrink a card it does not resize.
      await recordTransient(page, `geo-${kind}`, (args: {slot: string}) => {
        const strip = document.querySelector<HTMLElement>('.con-cards__strip:not([hidden])');
        const first = document.querySelector<HTMLElement>(`[data-step-slot^="${args.slot}|"] :is(.card-container, .pcard)`);
        const proxies = Array.from(document.querySelectorAll<HTMLElement>('.con-startdock-proxy'))
          .filter((el) => el.style.visibility !== 'hidden').map((el) => Math.round(el.getBoundingClientRect().width));
        return `z=${strip?.style.getPropertyValue('--con-cards-zoom') || strip?.style.getPropertyValue('--con-cards-grid-zoom') || '-'}` +
          ` w=${first === null ? '-' : Math.round(first.getBoundingClientRect().width)} p=${proxies.join('/')}`;
      }, {args: {slot}});
      const stop = await story(page, `${kind}-commit`);
      await press(page, key, 900);
      await expect.poll(async () => stepCards(await model(request, aliceId!), pool).length, {timeout: 12_000}).toBe(before.length + by);
      await expect(sheet).toHaveCount(0, {timeout: 10_000});
      await waitStepDealSettled(page);
      await cinematicBeat(page, 600, 'the last dealt card settles before the storyboard stops');
      const frames = await stop();
      // A floor only a DEAD screencast fails — how many frames a beat gets is the machine's (CI's software raster: ~3 a second).
      expect(frames, 'the screencast filmed the beat (it was alive)').toBeGreaterThan(0);
      await expect(page.locator(`[data-step-slot^="${slot}|"]`)).toHaveCount(before.length + by);
      const dealt = await dealtSinceMark();
      expect(dealt.filter((n) => before.includes(n)), `${kind}: no card already on the table is dealt again (${dealt.join(',')})`).toEqual([]);
      expect(dealt.length, `${kind}: exactly the new cards came off the deck`).toBe(by);
      // The grown row AT REST (class C): the storyboard's beats are over, so its geometry is read settled — the same
      // boxes twice in a row — never wherever the last glide had got to on a slow frame.
      const geometry = await readSettled(page, () => page.evaluate((s) => {
        const body = document.querySelector('.con-start__body--cards')!.getBoundingClientRect();
        const els = Array.from(document.querySelectorAll<HTMLElement>(`[data-step-slot^="${s}|"]`));
        const slots = els.map((el) => el.getBoundingClientRect());
        // The LAYOUT's card size (the cursor's lift scales the focused card by a transform — that is the cursor, not the row).
        const widths = [...new Set(els.map((el) => el.offsetWidth))];
        return {top: body.top, bottom: body.bottom, left: body.left, right: body.right, widths,
          minTop: Math.min(...slots.map((r) => r.top)), maxBottom: Math.max(...slots.map((r) => r.bottom)),
          minLeft: Math.min(...slots.map((r) => r.left)), maxRight: Math.max(...slots.map((r) => r.right))};
      }, slot), {message: `${kind}: the grown row`, same: samePx});
      expect(geometry.widths.length, `${kind}: one card size for the whole grown row ${JSON.stringify(geometry)}`).toBe(1);
      expect(geometry.minTop, `${kind}: the grown deal is whole in the body ${JSON.stringify(geometry)}`).toBeGreaterThanOrEqual(geometry.top - 1);
      expect(geometry.maxBottom, `${kind}: the grown deal is whole in the body ${JSON.stringify(geometry)}`).toBeLessThanOrEqual(geometry.bottom + 1);
      expect(geometry.minLeft).toBeGreaterThanOrEqual(geometry.left - 1);
      expect(geometry.maxRight).toBeLessThanOrEqual(geometry.right + 1);
      await shoot(page, `${kind}-grown`);
      const geo = (await readTransient<string>(page, `geo-${kind}`)).map((x) => `${x.t % 100000}:${x.v}`);
      test.info().annotations.push({type: `geo-${kind}`, description: geo.join(' | ').slice(0, 6000)});
    };

    // ── THE CORPORATION PAGE: the door lit; the list RISES out of the dock (filmed). ──
    await expect.poll(subject, {timeout: 5_000}).toMatch(/корпорац|слияни/i);
    await shoot(page, 's01-corp-door');
    let stop = await story(page, 'list-enter');
    await openDoor();
    await cinematicBeat(page, 900, 'the last certificate touches down in its slot');
    await stop();
    await shoot(page, 's02-list');

    // ── «Реструктуризация»: the sheet (filmed: the hero carried out of the list), then its row; the lineage kept. ──
    stop = await story(page, 'sheet-enter');
    await press(page, 'Enter', 900);
    await expect(sheet).toHaveAttribute('data-tender-sheet-open', 'yes', {timeout: 10_000});
    await cinematicBeat(page, 500, 'the RESULT unfolds');
    await stop();
    await shoot(page, 's03-restructure-sheet');
    stop = await story(page, 'restructure-row');
    await press(page, 'Enter', 900);
    await expect(page.locator('[data-tender-mode="restructure"]')).toHaveCount(1, {timeout: 15_000});
    await expect(page.locator('[data-tender-zone="offer"] [data-tender-mode-card]')).toHaveCount(2, {timeout: 15_000});
    await expect(page.locator('.con-restructure__slot--arriving')).toHaveCount(0, {timeout: 10_000});
    await cinematicBeat(page, 500, 'the candidates have landed');
    await stop();
    await shoot(page, 's04-restructure-row');
    await press(page, 'Period', 900);
    await expect(page.locator('[data-tender-mode="restructure"]')).toBeHidden({timeout: 10_000});

    // ── The corporation; RT to the preludes. «Открытый конкурс»: +2 preludes. ──
    await waitStepDealSettled(page);
    expect(await pressUntil(page, 'Enter', async () => (await pickedCards(page)).length >= 1, {tries: 8, settleMs: 900})).toBe(true);
    expect(await pressUntil(page, 'Period', async () => /пролог/i.test(await subject()), {tries: 4, settleMs: 900})).toBe(true);
    await waitStepDealSettled(page);
    await shoot(page, 's05-preludes');
    await openSheetOf('openCall', 's06-opencall-sheet');
    await growBy('openCall', /prelude/i, 'prelude', 2, 'Enter');

    // ── The projects: up to three picks (as many as the dealt money buys), the purchase LEDGER; «Субсидия» ticks the price
    //    in place (filmed). ──
    await fillPicks(page, 2);
    expect(await pressUntil(page, 'Period', async () => /проект/i.test(await subject()), {tries: 4, settleMs: 900})).toBe(true);
    await waitStepDealSettled(page);
    await fillPicks(page, 3, 24);
    const ledger = page.locator('[data-purchase-ledger]');
    await expect(ledger).toBeVisible();
    // The ledger's numbers as they STAND after the last pick — two equal reads, never the one the last pick's tick
    // had not reached yet (every price claim below is computed from these).
    const {price0, left0, picks0} = await readSettled(page, async () => ({
      price0: Number(await ledger.getAttribute('data-purchase-cost')),
      left0: Number(await ledger.getAttribute('data-purchase-left')),
      picks0: (await pickedCards(page)).length,
    }), {message: 'the purchase ledger before «Субсидия»'});
    // What a red needs to say (CI 43919360711: «left» moved by ONE M€ at a price one lower): the page's picks and the
    // router's trail of presses — never a guess at which press went where.
    const purchaseEvidence = async () => {
      const picks = await pickedCards(page);
      const trail = await page.evaluate(() =>
        (window as unknown as {__conInputEcho?: () => {trail?: string}}).__conInputEcho?.().trail ?? '');
      return `picks ${picks0} → ${picks.length} [${picks.join(', ')}] · presses: ${trail}`;
    };
    await shoot(page, 's08-projects-ledger');
    await openSheetOf('researchSubsidy', 's09-subsidy-sheet');
    // The price ticks on the PURCHASE page the player returns to — never under the sheet's stamp.
    await recordTransient(page, 'ledger-price', () => `${document.querySelector('[data-purchase-ledger]')?.getAttribute('data-purchase-cost') ?? '-'}` +
      `|${document.querySelector('[data-tender-sheet]') === null ? 'page' : 'sheet'}`);
    stop = await story(page, 'subsidy-commit');
    await press(page, 'Enter', 900);
    await expect(ledger, 'the price fell by one').toHaveAttribute('data-purchase-cost', String(Math.max(1, price0 - 1)), {timeout: 12_000});
    // Every PICK is one M€ cheaper — the picks the page really holds, never the three `fillPicks` asked for: the campaign's
    // deal is not seeded, and a lean finale (the lineage's 66 M€ against two 42 M€ merges, e.g. a 23 M€ corporation) can
    // afford one card at 3 M€ — the product refuses the second by its budget gate (CI 43919360711: one pick, 2 → 3).
    await expect(ledger, `${picks0} pick(s): ${picks0} M€ more left per M€ off the price`)
      .toHaveAttribute('data-purchase-left', String(left0 + picks0 * (price0 - Math.max(1, price0 - 1))))
      .catch(async (error: Error) => {
        throw new Error(`${error.message}\n${await purchaseEvidence()}`);
      });
    await expect(sheet).toHaveCount(0, {timeout: 10_000});
    await cinematicBeat(page, 900, 'the ledger\'s numbers tick in place');
    await stop();
    await shoot(page, 's10-ledger-after');
    const priceTrail = (await readTransient<string>(page, 'ledger-price')).map((x) => x.v);
    expect(priceTrail.filter((v) => v === `${Math.max(1, price0 - 1)}|sheet`), `the new price never stood under the sheet (${priceTrail.join(' → ')})`).toEqual([]);

    // ── «Широкий портфель»: +4 projects — the row re-scales into its new layout (filmed). ──
    await openSheetOf('broadPortfolio', 's11-broad-sheet');
    await growBy('broadPortfolio', /buy|project/i, 'projects', 4, 'Enter');

    // ── «Целевой запрос»: the tag tiles on the sheet (the pre-select grammar), +3 (filmed). ──
    await openSheetOf('targetedRequest', 's13-tag-sheet');
    await press(page, 'ArrowRight', 300);
    await press(page, 'ArrowDown', 300);
    await shoot(page, 's14-tag-focus');
    await press(page, 'Enter', 500);
    await expect(page.locator('[data-tender-mode="tag"] [data-tender-mode-picked="yes"]')).toHaveCount(1);
    await cinematicBeat(page, 300, 'the seal lands');
    await shoot(page, 's15-tag-picked');
    await growBy('targetedRequest', /buy|project/i, 'projects', 3, 'Period');

    expect(await twins(), 'through every list, sheet and hand-over: no certificate was ever painted twice at once').toEqual([]);
  });
});
