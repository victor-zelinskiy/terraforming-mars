/*
 * T05 · CG — THE TOP STRIP: MATERIAL, NOT FORM (2) — the stand of «ВЕРХНЯЯ ПОЛОСА — ПРИБОРНАЯ ДОСКА» (CF's pattern).
 *
 * The status strip (the seats' chips on their conveyor ribbon, the seat INTAKE under a chip, the three global
 * parameters, the terraforming rail, the deck, the generation) may change its PAINT and never its BOXES: a rival's
 * payout lands on the intake's number (`statusIntake.seatIntakeEnd`), a city's payout on the chip (`cityDataPayoutBeat`),
 * the scale swing reads a parameter cell (`scaleSwingDirector`), the deck deals from its pile, every delta chip hangs
 * from the beam's seam — and the strip's height is ONE token (`--con-hud-h`, the architectural invariant). This stand
 * reads every ANCHOR's rect on three profiles and:
 *   A · writes them (`screenshots/t05/status/<tag>/<profile>/anchors.json`) with the strip's frames — «before» is the
 *       base client (`TM_E2E_SHOTS_TAG=before`); then POSES every state the product writes on the strip (the viewer's
 *       attention, a passed seat, the conveyor's window, a ghost-ringed parameter, the final generation, an intake
 *       expecting and received) and re-reads every anchor — a state may not move a box either;
 *   B · with `TM_E2E_STATUS_MOCK=M1|M2|M3` injects a MOCKUP's paint (`statusMaterialMocks.ts`) over the live scene,
 *       re-reads every anchor and fails on a move of more than 1 px — a mockup may not move a box either;
 *   C · against a checked-in BASELINE (`tests/e2e/statusAnchorsBaseline.json` — the base client of `1c260ed8bc`'s strip,
 *       written by A) fails on any anchor that moved more than 1 px — the parity guard of the shipped material.
 *
 * FUNCTIONAL class (no motion is measured; CSS one-shots are waited out before a read). Fixture `event-analysts`
 * (blue's board home on its turn, red waiting).
 */
import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page} from './consoleTest';
import {bootFixtureSeats, settle} from './consoleStart';
import {STATUS_MOCKS, StatusMock} from './statusMaterialMocks';

const PROFILES = [
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: ''},
  {id: 'deck', viewport: {width: 1280, height: 800}, query: '&consoleProfile=handheld'},
] as const;

const TAG = process.env.TM_E2E_SHOTS_TAG ?? 'after';
const MOCK = process.env.TM_E2E_STATUS_MOCK as StatusMock | undefined;
const OUT = path.resolve('screenshots', 't05', 'status', (MOCK ?? TAG) + (process.env.TM_E2E_STATUS_FIXTURE === undefined ? '' : '-' + process.env.TM_E2E_STATUS_FIXTURE));
const BASELINE = path.resolve('tests', 'e2e', 'statusAnchorsBaseline.json');
/** The table the stand reads (`TM_E2E_STATUS_FIXTURE` — a mid-game table for the mockups' frames; the baseline is `event-analysts`'s). */
const FIXTURE = (process.env.TM_E2E_STATUS_FIXTURE ?? 'event-analysts') as 'event-analysts';

type Rect = {x: number, y: number, w: number, h: number};
type Anchors = Record<string, Rect>;

/** Every anchor a flight, a probe or a seam reads off the strip — the selectors are the contract, never renamed. */
async function readAnchors(page: Page): Promise<Anchors> {
  return page.evaluate(() => {
    const out: Record<string, {x: number, y: number, w: number, h: number}> = {};
    const put = (key: string, el: Element | null | undefined) => {
      if (el === null || el === undefined) {
        return;
      }
      const r = el.getBoundingClientRect();
      out[key] = {x: Math.round(r.left * 10) / 10, y: Math.round(r.top * 10) / 10, w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10};
    };
    const strip = document.querySelector('.con-status');
    put('strip', strip);
    put('players', strip?.querySelector('.con-status__players'));
    put('ribbon', strip?.querySelector('.con-status__ribbon'));
    strip?.querySelectorAll('.con-status__ribbon > .con-status__player[data-color]').forEach((chip) => {
      const color = chip.getAttribute('data-color');
      put(`player.${color}`, chip);
      put(`dot.${color}`, chip.querySelector('.con-status__dot'));
      put(`pname.${color}`, chip.querySelector('.con-status__pname'));
      put(`pstatus.${color}`, chip.querySelector('.con-status__pstatus'));
    });
    strip?.querySelectorAll('.con-status__intake').forEach((intake) => {
      const seat = intake.getAttribute('data-intake-seat');
      put(`intake.${seat}`, intake);
      put(`intake-num.${seat}`, intake.querySelector('.con-status__intake-num'));
    });
    put('params', strip?.querySelector('.con-status__params'));
    put('terra', strip?.querySelector('.con-status__terra'));
    strip?.querySelectorAll('.con-status__param').forEach((param, i) => {
      put(`param.${i}`, param);
      put(`param.${i}.icon`, param.querySelector('.con-status__icon'));
      put(`param.${i}.value`, param.querySelector('.con-status__value'));
    });
    put('terra-pct', strip?.querySelector('.con-status__terra-pct'));
    put('terra-rail', strip?.querySelector('.con-status__terra-rail'));
    put('deck', strip?.querySelector('.con-deckstack'));
    put('deck.pile', strip?.querySelector('.con-deckstack__pile'));
    put('deck.count', strip?.querySelector('.con-deckstack__count'));
    put('gen', strip?.querySelector('.con-status__gen'));
    put('gen.value', strip?.querySelector('.con-status__gen .con-status__value'));
    const hud = getComputedStyle(document.querySelector('.con-root') ?? document.documentElement).getPropertyValue('--con-hud-h').trim();
    out['hud-h'] = {x: 0, y: 0, w: 0, h: strip === null || strip === undefined ? 0 : Math.round(strip.getBoundingClientRect().height * 10) / 10};
    out['hud-h.token'] = {x: 0, y: 0, w: Number.parseFloat(hud) || 0, h: 0};
    return out;
  });
}

/**
 * Two posed states extend a FRAME by a net-zero padding + negative margin on purpose — the conveyor's window (the soft
 * fade bands live just outside the resting chips) and the ghost ring of the focused project's dial — so the frame's own
 * rect grows while nothing inside it moves; their contents (every chip, the parameter's icon and value) are read.
 */
const NET_ZERO_FRAMES: ReadonlySet<string> = new Set(['players', 'param.0']);

function drift(a: Anchors, b: Anchors, skip: ReadonlySet<string> = new Set()): Array<string> {
  const out: Array<string> = [];
  for (const key of Object.keys(a)) {
    if (skip.has(key)) {
      continue;
    }
    const p = a[key];
    const q = b[key];
    if (q === undefined) {
      out.push(`${key}: gone`);
      continue;
    }
    const d = Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y), Math.abs(p.w - q.w), Math.abs(p.h - q.h));
    if (d > 1) {
      out.push(`${key}: ${JSON.stringify(p)} → ${JSON.stringify(q)} (Δ ${d.toFixed(1)})`);
    }
  }
  return out;
}

/** The strip's own CSS one-shots (a turn burst, the attention bloom) have played out — a rect is read at rest. */
async function stripAtRest(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => (document.querySelector('.con-status')?.getAnimations({subtree: true}) ?? [])
    .filter((a) => a.playState === 'running' && a.effect?.getTiming().iterations !== Infinity).length), {timeout: 10_000, message: 'the strip\'s one-shots settle'}).toBe(0);
}

async function stripShot(page: Page, profile: string, name: string): Promise<void> {
  fs.mkdirSync(path.join(OUT, profile), {recursive: true});
  await page.screenshot({path: path.join(OUT, profile, `${name}.png`)});
  const box = await page.locator('.con-status').boundingBox();
  if (box !== null) {
    const vp = page.viewportSize()!;
    await page.screenshot({path: path.join(OUT, profile, `${name}-strip.png`), clip: {x: 0, y: 0, width: vp.width, height: Math.min(vp.height, box.height * 2.4)}});
    // …and the two halves at full size (the seats, the instruments) — the frames the owner reads the paint on.
    for (const [half, sel] of [['seats', '.con-status__players'], ['instruments', '.con-status__params']] as const) {
      const r = await page.locator(sel).boundingBox();
      if (r !== null) {
        const pad = box.height * .3;
        await page.screenshot({path: path.join(OUT, profile, `${name}-${half}.png`),
          clip: {x: Math.max(0, r.x - pad), y: 0, width: Math.min(vp.width - Math.max(0, r.x - pad), r.width + pad * 2), height: Math.min(vp.height, box.height * 1.6)}});
      }
    }
  }
}

/** The instruments' readings: `--con-param-fill` (0…1) and the oceans' `--con-param-steps`, from the strip's own readouts. */
async function writeInstrumentVars(page: Page): Promise<void> {
  await page.evaluate(() => {
    const params = Array.from(document.querySelectorAll<HTMLElement>('.con-status__terra > .con-status__param'));
    const num = (el: HTMLElement | undefined) => Number.parseFloat((el?.querySelector('.con-status__value')?.textContent ?? '0').replace('−', '-')) || 0;
    const [temp, oxy, oceans] = params;
    temp?.style.setProperty('--con-param-fill', String(Math.min(1, Math.max(0, (num(temp) + 30) / 38))));
    oxy?.style.setProperty('--con-param-fill', String(Math.min(1, Math.max(0, num(oxy) / 14))));
    oceans?.style.setProperty('--con-param-steps', String(Math.min(9, Math.max(0, num(oceans)))));
  });
}

/**
 * THE STATES ON THE STRIP — written onto the live strip by the stand (the paint is what is judged, not the logic that
 * sets them — each has its own spec): the viewer's chip in its attention state, the rival PASSED, the conveyor's window,
 * the temperature ringed as the focused project's dial, the final generation, and an INTAKE under the rival's chip
 * (expecting, then received) built from the product's own markup.
 */
async function poseStates(page: Page, phase: 'expecting' | 'received'): Promise<void> {
  await page.evaluate((intakePhase) => {
    const chips = Array.from(document.querySelectorAll<HTMLElement>('.con-status__ribbon > .con-status__player[data-color]'));
    const me = chips.find((c) => c.classList.contains('con-status__player--me')) ?? chips[0];
    const rival = chips.find((c) => c !== me);
    me?.classList.add('con-status__player--attention');
    rival?.classList.add('con-status__player--passed');
    rival?.querySelector('.con-status__pstatus')?.classList.add('con-status__pstatus--passed');
    document.querySelector('.con-status__players')?.classList.add('con-status__players--conveyor');
    document.querySelector('.con-status__terra > .con-status__param')?.classList.add('con-status__param--ghost');
    document.querySelector('.con-status__gen')?.classList.add('con-status__gen--final');
    const ribbon = document.querySelector('.con-status__ribbon');
    if (ribbon !== null && rival !== undefined) {
      ribbon.querySelectorAll('[data-stand-intake]').forEach((el) => el.remove());
      const intake = document.createElement('span');
      intake.className = `con-status__intake con-status__intake--${intakePhase}`;
      intake.setAttribute('data-intake-seat', rival.getAttribute('data-color') ?? '');
      intake.setAttribute('data-stand-intake', '');
      intake.style.left = `${rival.offsetLeft}px`;
      intake.innerHTML = '<span class="con-status__intake-item"><i class="con-status__intake-icon resource_icon resource_icon--steel"></i>' +
        `<span class="con-status__intake-num">${intakePhase === 'expecting' ? '…' : '+2'}</span></span>`;
      ribbon.appendChild(intake);
    }
  }, phase);
}

for (const preset of PROFILES) {
  test.describe(`T05 · the strip's material · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`anchors, frames${MOCK !== undefined ? ` and mockup ${MOCK}` : ''} (${preset.id})`, async ({page, request}) => {
      test.setTimeout(180_000);
      await bootFixtureSeats(page, request, FIXTURE, {query: preset.query});
      await settle(page, {timeoutMs: 30_000});
      await stripAtRest(page);
      const base = await readAnchors(page);
      expect(Object.keys(base).filter((k) => k.startsWith('player.')).length, 'every seat read').toBeGreaterThanOrEqual(2);
      expect(Object.keys(base).filter((k) => /^param\.\d+$/.test(k)).length, 'the three parameters read').toBeGreaterThanOrEqual(3);
      expect(base['hud-h'].h, 'the strip is one token high').toBeGreaterThan(0);
      fs.mkdirSync(path.join(OUT, preset.id), {recursive: true});
      fs.writeFileSync(path.join(OUT, preset.id, 'anchors.json'), JSON.stringify(base, null, 1));
      if (MOCK === undefined) {
        await stripShot(page, preset.id, 'board');
        await poseStates(page, 'expecting');
        await stripAtRest(page);
        const intakeBase = await readAnchors(page);
        await stripShot(page, preset.id, 'states-expecting');
        const posed = drift(base, intakeBase, NET_ZERO_FRAMES);
        expect(posed, `a strip state moved an anchor:\n${posed.join('\n')}`).toEqual([]);
        await poseStates(page, 'received');
        await stripAtRest(page);
        const received = drift(intakeBase, await readAnchors(page));
        await stripShot(page, preset.id, 'states-received');
        expect(received, `the received intake moved an anchor:\n${received.join('\n')}`).toEqual([]);
        fs.writeFileSync(path.join(OUT, preset.id, 'anchors-states.json'), JSON.stringify(intakeBase, null, 1));
        if (fs.existsSync(BASELINE) && FIXTURE === 'event-analysts') {
          const baseline = (JSON.parse(fs.readFileSync(BASELINE, 'utf8')) as Record<string, {board: Anchors, states: Anchors}>)[preset.id];
          if (baseline !== undefined) {
            const moved = drift(baseline.board, base);
            expect(moved, `anchors moved against the base client:\n${moved.join('\n')}`).toEqual([]);
            const movedStates = drift(baseline.states, intakeBase);
            expect(movedStates, `posed anchors moved against the base client:\n${movedStates.join('\n')}`).toEqual([]);
          }
        }
        return;
      }
      await writeInstrumentVars(page);
      await page.addStyleTag({content: STATUS_MOCKS[MOCK]});
      await settle(page, {timeoutMs: 10_000});
      const mocked = await readAnchors(page);
      await stripShot(page, preset.id, `mock-${MOCK}`);
      const moved = drift(base, mocked);
      expect(moved, `mockup ${MOCK} moved an anchor:\n${moved.join('\n')}`).toEqual([]);
      await poseStates(page, 'received');
      await stripAtRest(page);
      await stripShot(page, preset.id, `mock-${MOCK}-states`);
    });
  });
}
