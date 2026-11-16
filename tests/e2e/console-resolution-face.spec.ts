import {test, expect, Page} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {bootFixtureSeats, closeZoomViewer, openZoomViewer, pressUntil, settle} from './consoleStart';
import {
  answerAsksAs, enterSittingByPass, focusParliamentZone, openParliament, PARLIAMENT_PRESETS, sittingStage, waitSittingAtRest,
} from './parliamentDrive';
import {readSettled} from './settledRead';
import {armWitness, witnessOf} from './witness';

/**
 * THE FACE OF A RESOLUTION — «THE BILL» (docs/claude/resolution-face-progress.md).
 *
 * A resolution is not a project card and must not read as one. The probe
 * carries the face through every place the game paints it, on the three
 * display profiles, and holds it to the brief's criteria that a machine can
 * hold:
 *
 *   (а) THE OLD FACE IS NOWHERE — no resolution on screen wears the project's
 *       anatomy (gold frame, nameplate, cost corner, tag rail, «при розыгрыше»
 *       rail), and every one is the bill (sheet · band · seal · footnote);
 *   (б) THE QUEST IS A FOOTNOTE — no caption (the footnote prints no words when
 *       a graphic exists) and at most a tenth of the face's height (the old
 *       plate with its margins took a fifth);
 *   (в) THE PARTY READS WITHOUT WORDS — the seal is the party's own emblem and
 *       the band's edge is dyed the party's accent (two cards of different
 *       parties never share them);
 *   (г) NOTHING OF THE FACE LEAVES ITS PAGE, at any zoom a host solves: every
 *       part stands inside the 320×460 box, the articles reach neither the
 *       band nor the footnote, the title is whole (never clamped);
 *   (д) THE FACE FITS ITS HOST on every profile (the voting slot, the vote
 *       row, the government's ruling row, the payout's hero column) — the
 *       box is still 320×460, so this is the regression net for the solver;
 *   (е) A CARD IN THE AIR IS THE BILL TOO — the face on one side, the bill's
 *       own back on the other, never the project card's back texture; and the
 *       Parliament's pile is a pile of bills.
 *
 * …and it shoots what only an eye can judge: the stand's acceptance rows
 * (beside project cards · across the zoom range · the back), the overview, the
 * vote row, the inspector, the government, the verdict, the payout's hero and
 * the table after the deal. Screenshots: screenshots/resolution-face/<preset>/.
 *
 * Probes are DOM reads AT REST (`readSettled` — two equal reads a frame apart) and RECORDINGS of the cards in the air
 * (`armWitness` — every change the product writes, armed before the press) — never a sampler of our own.
 */
const OUT_ROOT = path.resolve('screenshots', 'resolution-face');

async function shoot(page: Page, preset: string, name: string): Promise<void> {
  const dir = path.join(OUT_ROOT, preset);
  fs.mkdirSync(dir, {recursive: true});
  await page.screenshot({path: path.join(dir, `${name}.png`)});
}

type FaceReport = {
  count: number;
  problems: Array<string>;
  accents: Array<string>;
  questShare: number;
};

/** Every resolution face standing under `scope`, held to (а)–(г). */
const readFaces = (page: Page, scope: string) => page.evaluate((sel) => {
  const problems: Array<string> = [];
  const accents: Array<string> = [];
  let questShare = 0;
  const faces = Array.from(document.querySelectorAll<HTMLElement>(`${sel} .pcard--theme-resolution`)).filter((face) => face.getBoundingClientRect().width > 0);
  for (const face of faces) {
    const id = Array.from(face.classList).find((c) => c.startsWith('pcard--rdx-')) ?? 'resolution';
    if (!face.classList.contains('pcard--bill')) {
      problems.push(`${id}: not the bill anatomy`);
    }
    for (const old of ['.pcard__frame', '.pcard-nameplate', '.pcard__cost', '.pcard__tags', '.pcard-play-rail', '.pcard__rim']) {
      if (face.querySelector(old) !== null) {
        problems.push(`${id}: wears the project's ${old}`);
      }
    }
    for (const part of ['.pcard-bill__sheet', '.pcard-bill__band', '.pcard-bill__seal .pcard__party-emblem', '.pcard-bill__foot', '.pcard-bill__fold']) {
      if (face.querySelector(part) === null) {
        problems.push(`${id}: no ${part}`);
      }
    }
    const box = face.getBoundingClientRect();
    // (г) every part inside the page — a px of rounding allowed. The tails hang rotated under the seal and the
    // fold is the corner itself: both are inside the box by construction and measured by their own parents.
    for (const el of Array.from(face.querySelectorAll<HTMLElement>('.pcard-bill__sheet *, .pcard-bill__seal, .pcard-bill__seal *'))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || el.closest('.pcard-bill__tails, .pcard-bill__fold') !== null) {
        continue;
      }
      if (r.left < box.left - 1 || r.right > box.right + 1 || r.top < box.top - 1 || r.bottom > box.bottom + 1) {
        problems.push(`${id}: ${String(el.className) || el.tagName} leaves the page (${Math.round(r.left - box.left)},${Math.round(r.top - box.top)} → ${Math.round(r.right - box.left)},${Math.round(r.bottom - box.top)} of ${Math.round(box.width)}×${Math.round(box.height)})`);
      }
    }
    const mech = face.querySelector<HTMLElement>('.pcard-bill__articles .pcard__mech');
    const foot = face.querySelector<HTMLElement>('.pcard-bill__foot');
    const band = face.querySelector<HTMLElement>('.pcard-bill__band');
    if (mech !== null && foot !== null && band !== null) {
      const m = mech.getBoundingClientRect();
      if (m.bottom > foot.getBoundingClientRect().top + 1) {
        problems.push(`${id}: the articles reach into the footnote`);
      }
      if (m.top < band.getBoundingClientRect().bottom - 1) {
        problems.push(`${id}: the articles reach under the band`);
      }
    }
    const title = face.querySelector<HTMLElement>('.pcard-bill__title span');
    if (title !== null && title.scrollHeight > title.clientHeight + 1) {
      problems.push(`${id}: the title is clamped`);
    }
    // (б) the footnote: no words beside a graphic, a tenth of the face at most.
    const quest = face.querySelector<HTMLElement>('.pcard-bill__quest');
    if (quest !== null) {
      // Words BESIDE the graphic — the text left once the graphic itself is taken out: a printed plate's own label
      // (RX36's yellow «MIN» requirement plate, the scan's glyph) is part of the graphic, not a word next to it.
      const beside = quest.cloneNode(true) as HTMLElement;
      beside.querySelectorAll('.pcard__quest-graphic').forEach((g) => g.remove());
      if (quest.querySelector('.pcard__quest-graphic') !== null && (beside.textContent ?? '').replace(/[\s\d+−/:*]/g, '') !== '') {
        problems.push(`${id}: the footnote prints words («${(beside.textContent ?? '').trim()}»)`);
      }
      questShare = Math.max(questShare, (foot?.getBoundingClientRect().height ?? 0) / box.height);
    }
    // (в) the party: the seal's emblem and the dyed edge.
    const emblem = face.querySelector<HTMLImageElement>('.pcard-bill__seal .pcard__party-emblem');
    const accent = getComputedStyle(face).getPropertyValue('--pcard-party-accent').trim();
    if (emblem === null || !(emblem.getAttribute('src') ?? '').includes('assets/parties/redux/')) {
      problems.push(`${id}: the seal is not a party emblem`);
    }
    if (accent === '') {
      problems.push(`${id}: no party accent`);
    }
    accents.push(`${emblem?.getAttribute('src') ?? ''}|${accent}`);
  }
  return {count: faces.length, problems, accents, questShare};
}, scope) as Promise<FaceReport>;

/**
 * `inChain` — the read stands INSIDE a sitting (a step or a gate the player still owes, a blocking hold of the sitting may
 * legitimately stand): read at rest without the console-wide settle.
 */
async function expectFaces(page: Page, label: string, scope: string, atLeast: number, inChain = false): Promise<FaceReport> {
  const report = await readSettled(page, () => readFaces(page, scope), {settle: !inChain, message: `${label}: the faces`});
  expect(report.count, `${label}: resolution faces on screen`).toBeGreaterThanOrEqual(atLeast);
  expect(report.problems, `${label}: every face is the bill, whole and inside its page`).toEqual([]);
  expect(report.questShare, `${label}: the quest is a footnote (≤ 10 % of the face)`).toBeLessThanOrEqual(0.1);
  return report;
}

/** (д) every face inside the host box that holds it — measured at rest (`inChain` as in `expectFaces`). */
async function expectInsideHosts(page: Page, label: string, pairs: Array<{host: string, face: string}>, inChain = false): Promise<void> {
  const out = await readSettled(page, () => page.evaluate((list) => {
    const problems: Array<string> = [];
    let seen = 0;
    for (const {host, face} of list) {
      for (const hostEl of Array.from(document.querySelectorAll<HTMLElement>(host))) {
        const h = hostEl.getBoundingClientRect();
        for (const faceEl of Array.from(hostEl.querySelectorAll<HTMLElement>(face))) {
          const f = faceEl.getBoundingClientRect();
          if (f.width === 0) {
            continue;
          }
          seen++;
          if (f.left < h.left - 1 || f.right > h.right + 1 || f.top < h.top - 1 || f.bottom > h.bottom + 1) {
            // The solver's inputs beside the verdict — a 2 px overflow is a fit that ran a beat too early.
            const root = document.querySelector<HTMLElement>('.con-parl');
            const q = (s: string) => Math.round((document.querySelector(s)?.getBoundingClientRect().height ?? -1) * 10) / 10;
            const solver = root === null ? '' : ` [gov-zoom=${root.style.getPropertyValue('--con-parl-gov-zoom')} quest-h=${root.style.getPropertyValue('--con-parl-quest-h')} quest=${q('[data-parl-quest]')} head=${q('.con-parl__gov-head')} gov=${document.querySelector('.con-parl__gov')?.clientHeight}]`;
            problems.push(`${face} leaves ${host}: ${Math.round(f.width)}×${Math.round(f.height)} in ${Math.round(h.width)}×${Math.round(h.height)}${solver}`);
          }
        }
      }
    }
    return {problems, seen};
  }, pairs), {settle: !inChain, message: `${label}: the hosted faces`});
  expect(out.seen, `${label}: hosted faces measured (an empty set proves nothing)`).toBeGreaterThan(0);
  expect(out.problems, `${label}: the face fits its host`).toEqual([]);
}

type FlightWitness = {faces: number, backs: number, foreign: Array<string>, faceUp: number, blankArt: number, blankTrail: Array<string>};

/** One card proxy in the air as the frame shows it — the reading of one recorded moment. */
type ProxySeen = {
  flight: string,
  /** A face is on the body, and it is the bill. */
  face: boolean, bill: boolean,
  /** The face is turned TOWARDS the player (cos θ > 0.25) and carries an illustration; whether that is painted. */
  up: boolean, painted: boolean, blank: string,
  /** The body carries a back, and it is the project card's back texture. */
  back: boolean, projectBack: boolean,
  /** Wide enough to be a card (≥ 40 px) — and, for the frame of the deal, turned past the edge (cos θ < 0.35). */
  wide: boolean, showsBack: boolean,
};
const FLIGHT_WITNESS = 'resolution-face-flights';

/**
 * (е) Every CARD PROXY in the air is RECORDED (FLAKE ZERO — `armWitness`, armed before the press): a card in the air
 * is the bill too — the face on one side, the bill's own back on the other, never the project card's back texture.
 * «Never a blank face turned to the player» is a claim about what a FRAME shows, so the record is `settled` — the
 * state a task leaves (a proxy mid-construction, its art not yet faded in by the same task, is no frame).
 */
async function armFlightWitness(page: Page): Promise<void> {
  await armWitness<Array<ProxySeen>>(page, FLIGHT_WITNESS, () => Array.from(document.querySelectorAll<HTMLElement>('.con-parl__flight--card'))
    .filter((proxy) => getComputedStyle(proxy).visibility !== 'hidden')
    .map((proxy) => {
      const face = proxy.querySelector('.pcard');
      // A face TURNED TOWARDS the player must carry its illustration: a blank window in the air is the
      // old «the card flies black» defect (the art re-fading in on a proxy, or never warmed for a deal).
      // (rotateY → m11 = cos θ of the matrix; the pattern is a string so the reader's source stays bracket-balanced)
      const body = proxy.querySelector<HTMLElement>('.con-card3d');
      const m = body === null ? null : new RegExp('matrix3d\\(([^,]+),').exec(getComputedStyle(body).transform);
      const cos = m === null ? 1 : parseFloat(m[1]);
      const img = face?.querySelector<HTMLImageElement>('.pcard__art img') ?? null;
      const up = face !== null && cos > 0.25 && img !== null;
      const painted = img !== null && img.complete && img.naturalWidth > 0 && parseFloat(getComputedStyle(img).opacity) > 0.95;
      const back = proxy.querySelector<HTMLElement>('.con-parl__cardback');
      return {
        flight: proxy.getAttribute('data-parl-flight') ?? '',
        face: face !== null,
        bill: face?.classList.contains('pcard--bill') === true,
        up,
        painted,
        blank: up && !painted ? `complete=${img?.complete} natural=${img?.naturalWidth} opacity=${img === null ? '' : getComputedStyle(img).opacity} cos=${cos.toFixed(2)}` : '',
        back: back !== null,
        projectBack: back !== null && getComputedStyle(back).backgroundImage.includes('card.webp'),
        wide: proxy.getBoundingClientRect().width >= 40,
        showsBack: m !== null && cos < 0.35,
      };
    }), {settled: true, max: 20_000});
}

/** The record folded: how many recorded moments showed a face / a back / a face turned up / a blank face, and what was foreign. */
async function readFlightWitness(page: Page): Promise<FlightWitness> {
  const witness: FlightWitness = {faces: 0, backs: 0, foreign: [], faceUp: 0, blankArt: 0, blankTrail: []};
  const note = (what: string) => {
    if (!witness.foreign.includes(what)) {
      witness.foreign.push(what);
    }
  };
  for (const proxies of await witnessOf<Array<ProxySeen>>(page, FLIGHT_WITNESS).values()) {
    for (const p of proxies) {
      if (p.face) {
        witness.faces++;
        if (!p.bill) {
          note('a flying face that is not the bill');
        }
        if (p.up) {
          witness.faceUp++;
          if (!p.painted) {
            witness.blankArt++;
            if (witness.blankTrail.length < 6) {
              witness.blankTrail.push(`${p.flight}: ${p.blank}`);
            }
          }
        }
      }
      if (p.back) {
        witness.backs++;
        if (p.projectBack) {
          note('a flying back that is the project card back');
        }
      }
    }
  }
  return witness;
}

/**
 * A FRAME OF A CARD IN THE AIR — for the eye only (best effort, never an assertion: a frame taken a moment late
 * shows the table at rest, and that is harmless). Asks the FLIGHT RECORD (`armFlightWitness`, armed BEFORE the press
 * that starts the flights); `part` picks the proxy: a body that carries a back (a deal) or any flying face.
 */
function shootInTheAir(page: Page, preset: string, name: string, part: 'back' | 'face'): Promise<void> {
  const flights = witnessOf<Array<ProxySeen>>(page, FLIGHT_WITNESS);
  const inTheAir = (proxies: Array<ProxySeen>) => proxies.some((p) => p.wide && p.face && (part === 'face' || p.showsBack));
  return expect.poll(() => flights.ever(inTheAir), {timeout: 120_000, intervals: [25]}).toBe(true)
    .then(() => shoot(page, preset, name))
    .catch(() => undefined);
}

for (const preset of PARLIAMENT_PRESETS) {
  test.describe(`resolution face · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test('the stand: beside project cards, across the zoom range, the back', async ({page}) => {
      test.setTimeout(240_000);
      await page.goto(`/?resolutionsPlayground${preset.query}`);
      await expect(page.locator('[data-resolutions-playground]')).toHaveCount(1, {timeout: 30_000});
      await page.waitForSelector('.boot-loader', {state: 'detached', timeout: 60_000}).catch(() => undefined);
      for (const lab of ['peripheral', 'ladder']) {
        const block = page.locator(`[data-rxpg-lab="${lab}"]`);
        await block.scrollIntoViewIfNeeded();
        // Lazy art: every picture of THIS block decoded before its frame (a blank window is not the face).
        await block.evaluate((el) => Promise.all(Array.from(el.querySelectorAll('img')).map((img) => {
          img.loading = 'eager';
          return img.complete && img.naturalWidth > 0 ? undefined : new Promise((res) => {
            img.addEventListener('load', res, {once: true});
            img.addEventListener('error', res, {once: true});
          });
        })));
        const dir = path.join(OUT_ROOT, preset.id);
        fs.mkdirSync(dir, {recursive: true});
        await block.screenshot({path: path.join(dir, `00-stand-${lab}.png`)});
      }
      // The peripheral row: project cards keep the project's anatomy, the resolutions between them do not.
      const projects = page.locator('[data-rxpg-lab="peripheral"] [data-rxpg-lab-project] .pcard');
      const projectCount = await projects.count();
      expect(projectCount, 'real project cards in the row').toBeGreaterThanOrEqual(3);
      for (let i = 0; i < projectCount; i++) {
        await expect(projects.nth(i).locator('.pcard__frame'), 'a project card keeps its gold frame').toHaveCount(1);
        await expect(projects.nth(i), 'a project card is not a bill').not.toHaveClass(/pcard--bill/);
      }
      const row = await expectFaces(page, `${preset.id} stand/peripheral`, '[data-rxpg-lab="peripheral"]', 3);
      expect(new Set(row.accents).size, 'the row holds at least two parties, told apart by seal and dye').toBeGreaterThanOrEqual(2);
      // The ladder: ONE face at every zoom the game solves — the same parts at each rung, nothing dropped on the way.
      const rungs = await page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>('[data-rxpg-lab="ladder"] [data-rxpg-lab-zoom]')).map((cell) => ({
        zoom: cell.getAttribute('data-rxpg-lab-zoom'),
        parts: cell.querySelectorAll('.pcard-bill__sheet *').length,
      })));
      expect(rungs.length, 'the ladder spans the zoom range of the game').toBeGreaterThanOrEqual(5);
      expect(new Set(rungs.map((r) => r.parts)).size, 'no level-of-detail switch: a FLIP between zones never pops a part').toBe(1);
      await expectFaces(page, `${preset.id} stand/ladder`, '[data-rxpg-lab="ladder"]', 5);
      // The catalog: every party of the catalog, every density of formula.
      await expectFaces(page, `${preset.id} stand/catalog`, '[data-rxpg-catalog]', 5);
    });

    test('the overview, the vote row and the inspector', async ({page, request}) => {
      test.setTimeout(420_000);
      await bootFixtureSeats(page, request, 'parliament', {query: preset.query});
      await openParliament(page);
      await focusParliamentZone(page, 'voting');
      await settle(page, {timeoutMs: 20_000});
      await expectFaces(page, `${preset.id} overview`, '.con-parl', 3);
      await expectInsideHosts(page, `${preset.id} overview`, [{host: '.con-parl__slot', face: '.pcard'}]);
      await shoot(page, preset.id, '01-overview');
      // THE VOTE ROW — the same DOM instances, grown.
      expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-parl__vote.con-parl__vote--up').count() > 0, {tries: 4, settleMs: 1200}), 'A opens the vote mode').toBe(true);
      await waitSittingAtRest(page, 20_000);
      await expectFaces(page, `${preset.id} vote row`, '.con-parl', 3);
      await expectInsideHosts(page, `${preset.id} vote row`, [{host: '.con-parl__slot', face: '.pcard'}]);
      await shoot(page, preset.id, '02-vote-row');
      // THE INSPECTOR — the face at its largest.
      await openZoomViewer(page);
      await expect(page.locator('dialog.con-zoom[open].con-zoom--parliament')).toHaveCount(1, {timeout: 15_000});
      await settle(page, {timeoutMs: 15_000});
      await expectFaces(page, `${preset.id} inspector`, 'dialog.con-zoom[open]', 1);
      await shoot(page, preset.id, '03-inspector');
      await closeZoomViewer(page);
    });

    test('the government: the enacted bill beside the ruling party', async ({page, request}) => {
      test.setTimeout(300_000);
      await bootFixtureSeats(page, request, 'parliament-recap', {query: preset.query});
      await openParliament(page);
      await settle(page, {timeoutMs: 20_000});
      await expect(page.locator('.con-parl__gov-card .pcard--bill'), 'the enacted card is the bill').toHaveCount(1, {timeout: 15_000});
      await expectFaces(page, `${preset.id} government`, '.con-parl', 3);
      await expectInsideHosts(page, `${preset.id} government`, [{host: '.con-parl__ruling', face: '.con-parl__gov-card .pcard'}, {host: '.con-parl__slot', face: '.pcard'}]);
      await shoot(page, preset.id, '04-government');
    });

    test('the sitting: the hero of the payout', async ({page, request}) => {
      test.setTimeout(420_000);
      // ONE PASS before its sitting (the soft gates): the pass runs it, the walk turns the verdict by itself (the table
      // as voted is the overview's — the bills stood there one pass before), the enacted card flies to its hero slot.
      const {playerId} = await bootFixtureSeats(page, request, 'parliament-aquifer-assembly', {query: preset.query});
      await armFlightWitness(page);
      const enactedInTheAir = shootInTheAir(page, preset.id, '05b-enacted-in-the-air', 'face');
      await enterSittingByPass(page, request, playerId);
      // THE HERO OF THE PAYOUT — the enacted card carried beside the recipient zone (it FLEW from its slot to get here).
      await expect(page.locator('.con-parl [data-embed-slot="parliament-stage"] .con-task'), 'the pick stands').toHaveCount(1, {timeout: 40_000});
      await waitSittingAtRest(page, 30_000);
      await expectFaces(page, `${preset.id} payout hero`, '.con-parl', 1, true);
      await expectInsideHosts(page, `${preset.id} payout hero`, [{host: '.con-sit__hero--field', face: '.pcard'}], true);
      const flights = await readFlightWitness(page);
      expect(flights.foreign, 'every card in the air is the bill').toEqual([]);
      expect(flights.faces, 'the enacted card was seen in the air (a dead sampler proves nothing)').toBeGreaterThan(0);
      expect(flights.blankArt, `a face turned to the player always carries its illustration (${flights.blankTrail.join(' · ')})`).toBe(0);
      await enactedInTheAir;
      await shoot(page, preset.id, '06-payout-hero');
    });

    test('the deal from the deck: a bill is born face-down and turns in flight', async ({page, request}) => {
      test.setTimeout(420_000);
      // A RELOAD lands on the final poses (nothing replays), so the deal is only ever seen inside one session:
      // the whole sitting of a resolution that asks nothing (Architecture Award) — verdict → … → the results,
      // where the losers leave and the fresh card comes off the pile.
      const {playerId, seats} = await bootFixtureSeats(page, request, 'parliament-architecture-assembly', {query: preset.query});
      await armFlightWitness(page);
      const dealInTheAir = shootInTheAir(page, preset.id, '07a-deal-in-the-air', 'back');
      await enterSittingByPass(page, request, playerId);
      await answerAsksAs(request, seats[1]);
      await expect.poll(() => sittingStage(page), {timeout: 90_000}).toBe('results');
      await waitSittingAtRest(page, 60_000);
      const flights = await readFlightWitness(page);
      expect(flights.foreign, 'every card in the air is the bill, both sides').toEqual([]);
      expect(flights.faces, 'the enacted card was seen in the air').toBeGreaterThan(0);
      expect(flights.backs, 'a dealt card showed its back on the way (a dead sampler proves nothing)').toBeGreaterThan(0);
      expect(flights.faceUp, 'a face was seen turned to the player in the air').toBeGreaterThan(0);
      expect(flights.blankArt, `a face turned to the player always carries its illustration (${flights.blankTrail.join(' · ')})`).toBe(0);
      // The Parliament's pile is a pile of BILLS.
      const pile = await page.evaluate(() => {
        const top = document.querySelector<HTMLElement>('[data-parl-deck-top]');
        if (top === null) {
          return 'no pile';
        }
        return getComputedStyle(top).backgroundImage.includes('card.webp') ? 'project back' : 'bill back';
      });
      expect(pile, 'the top card of the pile').toBe('bill back');
      await dealInTheAir;
      await expectFaces(page, `${preset.id} results`, '.con-parl', 1, true);
      await shoot(page, preset.id, '07-results-after-the-deal');
    });
  });
}
