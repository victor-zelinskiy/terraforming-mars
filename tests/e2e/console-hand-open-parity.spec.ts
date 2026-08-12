import {test, expect, Page} from '@playwright/test';
import {bootIntoGame} from './consoleStart';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * THE HAND OPENS WITHOUT A FLICKER — the flying card IS the landing card.
 *
 * The dock → shelf open is a physical transition: one proxy per card flies out
 * of the dock and hands off to the real grid slot underneath it. That only
 * reads as ONE object moving if the two faces are the same PICTURE. They were
 * not: the proxy was built from the card NAME alone, so it flew without the
 * discount chip, without the stored-resource capsule, without the disabled
 * wash, with a differently-inset (and therefore differently sized and wrapped)
 * title, and at the richer `normal` quality tier while the grid draws `thumb`.
 * A whole shelf of cards visibly re-drew at the handoff.
 *
 * WHY THE ASSERTION IS ON CLASSES, NOT ON PIXELS. `PremiumCard`'s root class
 * list IS its composition — theme, mechanics density, quality tier, cost
 * modifier, resource capsule, VP variant, disabled state. Two faces carrying
 * the same signature cannot differ in any of the things that flickered, and a
 * class diff NAMES what drifted, where a screenshot comparison would only say
 * "different". `pcard--<slug>` is the join key: both faces carry it, so proxy
 * and slot can be paired without any test-only markup.
 *
 * Screenshots land in screenshots/console-hand-open-parity/ for the eye.
 */

const OUT = path.resolve('screenshots', 'console-hand-open-parity');

/* The proxy is INERT by construction (no click → fullscreen, no teleport
 * anchors), which is a behaviour difference and deliberately not a visual one:
 * the flight layer is `pointer-events: none`, so nothing keyed on this class
 * can paint. It is the ONE class the two faces are allowed to disagree on. */
const BEHAVIOURAL = new Set(['pcard--interactive']);

type Faces = Record<string, Array<string>>;

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

async function key(page: Page, code: string, settleMs = 450): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(settleMs);
}

/** Every `.pcard` under `root`, keyed by its own `pcard--<slug>` class. */
function readFaces(page: Page, root: string): Promise<Faces> {
  return page.evaluate((sel) => {
    const out: Record<string, Array<string>> = {};
    for (const el of Array.from(document.querySelectorAll(`${sel} .pcard`))) {
      const classes = Array.from(el.classList);
      // The slug class is the card's identity; the theme/tier/state classes are
      // what must match. `--vp-`/`--mech-`/`--theme-` are prefixed too, so the
      // slug is found by elimination against the known prefixes.
      const slug = classes.find((c) => c.startsWith('pcard--') &&
        !/^pcard--(theme|mech|tier|vp)-/.test(c) &&
        !['pcard--interactive', 'pcard--unavailable', 'pcard--selected',
          'pcard--cost-mod', 'pcard--has-res', 'pcard--no-mech'].includes(c));
      if (slug !== undefined) {
        out[slug] = classes.sort();
      }
    }
    return out;
  }, root);
}

function signature(classes: ReadonlyArray<string>): string {
  return classes.filter((c) => !BEHAVIOURAL.has(c)).join(' ');
}

/**
 * How much ART is actually PAINTING on each side. `complete && naturalWidth`
 * is the browser's own answer to «is there a picture in this element», and it
 * is the only honest one: a decoded webp and a pending request look identical
 * in the DOM, and an `<img>` that has not arrived paints nothing whatever its
 * opacity says. Reported as a ratio so the failure states the SCALE of the
 * mismatch («14 flying, 0 painted») rather than just naming a card.
 */
function readArt(page: Page): Promise<{flying: number, flyingPainted: number, landed: number, landedPainted: number}> {
  return page.evaluate(() => {
    const count = (sel: string) => {
      const imgs = Array.from(document.querySelectorAll<HTMLImageElement>(`${sel} .pcard__art img`));
      // PAINTED = decoded AND not hidden. `complete` alone answers «has the
      // picture arrived», which is only half the question: the premium face
      // also fades its art in from `opacity: 0` on the image's own load, so an
      // arrived-but-still-transparent art is just as black to the player.
      const painted = imgs.filter((i) =>
        i.complete && i.naturalWidth > 0 && Number(getComputedStyle(i).opacity) > 0.9);
      return {all: imgs.length, painted: painted.length};
    };
    const fly = count('.con-handreveal-layer');
    const land = count('.con-hand__grid');
    return {flying: fly.all, flyingPainted: fly.painted, landed: land.all, landedPainted: land.painted};
  });
}

test.describe('console hand open — no flicker at the handoff', () => {
  test.use({viewport: {width: 1920, height: 1080}});

  test('every flying proxy is the same picture as the slot it lands on', async ({page, request}) => {
    // A hand worth opening: the whole initial deal, so the shelf has real rows
    // and the sample covers cards of several themes / densities / VP variants.
    await bootIntoGame(page, request, {buy: 20});

    // Open the hand and SAMPLE MID-FLIGHT: the subject is the transition, so
    // the probe must be inside it. Poll fast (the whole flight is ~750ms) and
    // keep the first frame where both the proxies and the held slots exist.
    let proxies: Faces = {};
    let slots: Faces = {};
    let art = {flying: 0, flyingPainted: 0, landed: 0, landedPainted: 0};
    for (let attempt = 0; attempt < 6 && Object.keys(proxies).length === 0; attempt++) {
      if (await page.locator('.con-zoom, .con-quick, .con-composer').count() > 0) {
        await key(page, 'Escape', 900);
      }
      if (await page.locator('.con-hand').count() > 0) {
        await key(page, 'Escape', 1600); // a hand already open cannot be opened
      }
      await key(page, 'Period', 700);
      await page.keyboard.press('Enter');
      for (let frame = 0; frame < 60; frame++) {
        const flying = await page.locator('.con-handreveal-layer .con-deal-proxy__face .pcard').count();
        if (flying > 0) {
          // MID-flight, not frame zero: the proxies exist from the moment they
          // spawn (still stacked in the dock), and a sample there would prove
          // the wiring while showing the eye nothing. The lift is 140ms and the
          // flight 600ms, so this lands the frame with the cards genuinely in
          // the air and the shelf still held empty underneath.
          await page.waitForTimeout(320);
          // MEASURE BEFORE SHOOTING. A full-page screenshot costs a few hundred
          // ms, and this transition is 740ms long — reading after it samples a
          // later, calmer moment than the picture shows, which is exactly how a
          // probe ends up disagreeing with its own evidence.
          art = await readArt(page);
          proxies = await readFaces(page, '.con-handreveal-layer');
          slots = await readFaces(page, '.con-hand__grid');
          await shoot(page, 'mid-flight');
          break;
        }
        await page.waitForTimeout(40);
      }
      if (Object.keys(proxies).length === 0) {
        await page.waitForTimeout(2000);
      }
    }

    expect(Object.keys(proxies).length,
      'the open flew card faces to sample (the episode must not have been skipped)').toBeGreaterThan(0);

    // Pair by card. Off-window tail proxies fly back-only, so the join is over
    // the cards that genuinely had both a face in the air and a slot to land in.
    const paired = Object.keys(proxies).filter((slug) => slots[slug] !== undefined);
    expect(paired.length, `proxies and slots must name the same cards ` +
      `(flew ${Object.keys(proxies).join(', ')}; shelf ${Object.keys(slots).join(', ')})`)
      .toBeGreaterThan(0);

    const drifted = paired
      .filter((slug) => signature(proxies[slug]) !== signature(slots[slug]))
      .map((slug) => `${slug}\n    flying: ${signature(proxies[slug])}\n    landed: ${signature(slots[slug])}`);
    expect(drifted, `these cards change appearance at the handoff:\n  ${drifted.join('\n  ')}`).toEqual([]);

    // The tier is the half that no state can excuse — spell it out separately
    // so a regression names itself rather than hiding in a class diff.
    for (const slug of paired) {
      expect(proxies[slug], `${slug} flies at the grid's own quality tier`).toContain('pcard--tier-thumb');
    }

    // ART — the first thing the report named («карты без артов»). The claim is
    // deliberately RELATIVE: the flight may never know LESS than the shelf it
    // is landing on.
    //
    // ⚠️ AND IT IS A NECESSARY CONDITION, NOT A SUFFICIENT ONE. No cheap DOM
    // question answers «is this picture on screen right now»: `complete` means
    // the BYTES arrived, and a `complete`, fully-opaque, correctly-sized
    // `<img>` still paints nothing until the browser has rasterized it — this
    // very spec reported 15/15 "painted" while the capture beside it showed
    // fifteen black art windows. The decode is what `preloadPremiumCardArt`
    // now moves ahead of the flight, and the honest evidence for it is the
    // PICTURE: screenshots/console-hand-open-parity/. Deliberately not a decode
    // TIMING threshold — that is a flake generator on a loaded CI box.
    expect(art.flyingPainted, `art mid-flight vs. on the shelf: ` +
      `${art.flyingPainted}/${art.flying} flying, ${art.landedPainted}/${art.landed} landed`)
      .toBeGreaterThanOrEqual(Math.min(art.landedPainted, art.flying));

    // The settled shelf, for the eye: it must look like the frame before it.
    await page.waitForTimeout(2500);
    await shoot(page, 'settled');
  });
});
