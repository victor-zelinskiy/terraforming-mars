import {test, expect, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {WS_STAGE_BOX, WS_STAGE_HEAD, stageProbe} from './wsStageParity';
import {bootWithCards, closeZoomViewer, openActionFocus, openCardActions, openZoomViewer, playCardFromHand, soloGameConfig, waitForTurn} from './consoleStart';

/**
 * Console BLUE ACTION · the COMMIT half — the EMBEDDED PURCHASE stage
 * (iteration 17 premium presentation).
 *
 * Drives Business Network («Коммерческая сеть») end to end and proves, at the
 * real surface, the parts console-action-focus.spec deliberately stops before:
 *
 *  1. SETUP — the stage marker reads «НАСТРОЙКА» (one word, never an echo of
 *     the root's noun) and the configuration plate carries the CTA;
 *  2. COMMIT → the outcome arrives EMBEDDED: the task host renders inside the
 *     workspace zone (`--embedded`), never as a standalone band;
 *  3. the ADAPTIVE single-card presentation: «Купить открытую карту?» instead
 *     of the mass-selector title, no «Выбрано 0/1» pickline, the economics on
 *     the card's own STATUS line (price / after-purchase), and NO duplicated
 *     A/X/RT glyph chips under the card (the bottom bar is the one command
 *     source);
 *  4. the SOURCE stays inspectable past the commit: the «ИСТОЧНИК» caption
 *     under the hero, the L3 hint in the bar, and the L3 → fullscreen source
 *     round trip that never unmounts the stage (selection survives);
 *  5. X inspects the RESULT (the X/L3 split);
 *  6. buying: A picks (the after-purchase readout appears), RT commits, the
 *     result leaves for the dock and the workspace folds — no stranded prompt.
 */

const OUT_DIR = path.resolve('screenshots', 'console-blue-action-purchase');

const GAME_CONFIG = soloGameConfig({
  players: [{name: 'BuyTester', color: 'red', beginner: false, handicap: 0, first: true}],
  seed: 0.31,
});

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
  {tag: 'tv4k', width: 3840, height: 2160, query: '&consoleProfile=tv'},
  {tag: 'deck', width: 1280, height: 800, query: '&consoleProfile=handheld'},
] as const;

for (const profile of PROFILES) {
  test.describe(`console blue-action purchase · ${profile.tag}`, () => {
    test.use({
      viewport: {width: profile.width, height: profile.height},
      deviceScaleFactor: 1,
      screen: {width: profile.width, height: profile.height},
    });

    test('setup → commit → embedded buy stage → L3 source → buy → fold', async ({page, request}) => {
      test.setTimeout(480_000);

      // ── The pregame: the shared start driver puts Business Network (the
      //    reveal-and-buy archetype) in hand. The walk is SETUP, never the
      //    subject — this spec's claim is the embedded purchase stage, so a
      //    start-flow change is adapted in `consoleStart`, never here.
      await bootWithCards(page, request, {
        cards: ['Business Network'],
        config: GAME_CONFIG,
        query: profile.query,
      });
      await waitForTurn(page);
      await page.waitForTimeout(4000);

      // ── Play Business Network from the hand (RT wheel → КАРТЫ). ─────────
      expect(await playCardFromHand(page, 'Business Network'),
        'Business Network must have been played').toBe(true);

      // ── Into the workspace → ACTION FOCUS. ──────────────────────────────
      await openCardActions(page);
      await page.waitForTimeout(700); // the wheel-handoff enter fully settles
      const emblemInBrowse = await page.locator('.con-wshead__emblem').evaluate((el) => {
        const cs = getComputedStyle(el);
        return {opacity: cs.opacity, visibility: cs.visibility, inline: el.getAttribute('style') ?? ''};
      });
      await openActionFocus(page);
      // The one-word stage marker: «НАСТРОЙКА», never «НАСТРОЙКА ДЕЙСТВИЯ».
      expect((await page.locator('.con-wshead__step').innerText()).trim().toUpperCase()).toBe('НАСТРОЙКА');
      await page.waitForTimeout(600); // the entry FLIP fully settles
      // THE IDENTITY SYMBOL: the lightning is part of the parent anchor in
      // EVERY state — measurably drawn, not just a reserved box (a stranded
      // wheel-echo once left it at inline opacity 0 for the workspace's life).
      const emblemProbe = await page.locator('.con-wshead__emblem').evaluate((el) => {
        const cs = getComputedStyle(el);
        const svg = el.querySelector('svg');
        const r = el.getBoundingClientRect();
        return {opacity: cs.opacity, visibility: cs.visibility, inline: el.getAttribute('style') ?? '', w: r.width, h: r.height, hasSvg: svg !== null,
          svgOpacity: svg !== null ? getComputedStyle(svg).opacity : ''};
      });
      const emblemStory = `browse=${JSON.stringify(emblemInBrowse)} setup=${JSON.stringify(emblemProbe)}`;
      expect(emblemProbe.hasSvg, `emblem: ${emblemStory}`).toBe(true);
      expect(parseFloat(emblemProbe.opacity), `emblem: ${emblemStory}`).toBeGreaterThan(0.9);
      expect(emblemProbe.visibility, `emblem: ${emblemStory}`).toBe('visible');
      expect(emblemProbe.w).toBeGreaterThan(4);
      // The SOURCE STABILITY baseline: the hero card wrap's box at setup.
      /*
       * THE BASELINE MUST BE SETTLED, or the contract is measured against noise.
       *
       * A single `boundingBox()` here reads the hero WHILE the composer's
       * entrance is still settling, and the value it catches differs run to run
       * (838, 809, … observed) while the committed-stage reading is rock steady
       * (533 every time). So the failures blamed the buy stage for moving a card
       * that had never finished arriving — the baseline was the unstable half.
       * Poll until two consecutive frames agree, then that is the anchor.
       */
      const settledHeroBox = async () => {
        const box = page.locator('.con-composer__actcardwrap');
        let prev = await box.boundingBox();
        for (let i = 0; i < 40; i++) {
          await page.waitForTimeout(120);
          const next = await box.boundingBox();
          if (prev !== null && next !== null &&
              Math.abs(next.x - prev.x) <= 1 && Math.abs(next.y - prev.y) <= 1 &&
              Math.abs(next.width - prev.width) <= 1) {
            return next;
          }
          prev = next;
        }
        return prev;
      };
      const heroAtSetup = await settledHeroBox();
      expect(heroAtSetup).not.toBeNull();
      await shoot(page, `${profile.tag}-01-setup`);

      // ── COMMIT (the CTA is the focused row of a no-decision action). ────
      await key(page, 'Enter', 400);

      // ── The EMBEDDED purchase stage arrives inside the workspace zone. ──
      const embeddedHost = page.locator('[data-embed-slot="workspace-reveal"] .con-task-host--embedded');
      await expect(embeddedHost).toHaveCount(1, {timeout: 25_000});
      // Never a standalone band while the workspace owns the outcome.
      expect(await page.locator('.con-task-host:not(.con-task-host--embedded)').count()).toBe(0);
      // The workspace chrome and the source hero never went anywhere.
      await expect(page.locator('.con-cardactions')).toHaveCount(1);
      await expect(page.locator('.con-composer--stage [data-action-focus-card][data-zoom-slot="Business Network"]')).toHaveCount(1);
      // THE SOURCE STABILITY CONTRACT (NORTH STAR): the hero card is the same
      // spatial object across the commit — same box to the pixel. Any
      // stage-specific label leaking into its column shows up here.
      //
      // POLLED, because the assertion is about the SETTLED stage. The embedded
      // host reports `count === 1` the instant it mounts — which is the first
      // frame of the UNFOLD, while the band is still reflowing around the new
      // outcome column. Measuring there read a 196px offset and blamed the
      // product for a transition it is supposed to play. `toPass` keeps the
      // contract exact (still 1px) and only lets the motion finish; a hero that
      // genuinely lands somewhere else never satisfies it and still fails.
      await expect(async () => {
        const heroAtBuy = await page.locator('.con-composer__actcardwrap').boundingBox();
        expect(heroAtBuy).not.toBeNull();
        // DIAGNOSTIC, not decoration: six structural hypotheses for the tv4k
        // shift were checked against the stylesheet and all six were wrong
        // (a payment row appearing; the right column pushing a centred row —
        // guarded at console.less:18925; `--con-ws-left` moving — a static
        // token; the pregame state; `--stage`'s zoom — a static class;
        // `--committed` — paint-only). So when this fails it must hand over
        // the ANCESTOR CHAIN rather than one number, or the next person starts
        // guessing from zero too.
        const chain = await page.locator('.con-composer__actcardwrap').evaluate((el) => {
          const out: Array<string> = [];
          for (let n: HTMLElement | null = el as HTMLElement; n !== null && out.length < 6; n = n.parentElement) {
            const r = n.getBoundingClientRect();
            const cs = getComputedStyle(n);
            out.push(`${n.className || n.tagName}: x=${Math.round(r.x)} w=${Math.round(r.width)} ` +
              `just=${cs.justifyContent} align=${cs.alignItems} zoom=${cs.zoom} tf=${cs.transform}`);
          }
          return out.join('\n  ');
        });
        expect(Math.abs(heroAtBuy!.x - heroAtSetup!.x),
          `hero moved: setup.x=${Math.round(heroAtSetup!.x)} buy.x=${Math.round(heroAtBuy!.x)}\n  ${chain}`)
          .toBeLessThanOrEqual(1);
        expect(Math.abs(heroAtBuy!.y - heroAtSetup!.y)).toBeLessThanOrEqual(1);
        expect(Math.abs(heroAtBuy!.width - heroAtSetup!.width)).toBeLessThanOrEqual(1);
        expect(Math.abs(heroAtBuy!.height - heroAtSetup!.height)).toBeLessThanOrEqual(1);
      }).toPass({timeout: 15_000});
      // THE IDENTITY SYMBOL holds on the COMMITTED stage too (§ NORTH STAR:
      // present through every state, never re-hidden by a stage transition).
      const emblemAtBuy = await page.locator('.con-wshead__emblem').evaluate((el) => {
        const cs = getComputedStyle(el);
        return {opacity: cs.opacity, visibility: cs.visibility};
      });
      expect(parseFloat(emblemAtBuy.opacity), `emblem@buy: ${JSON.stringify(emblemAtBuy)}`).toBeGreaterThan(0.9);
      expect(emblemAtBuy.visibility).toBe('visible');
      // The breadcrumb advanced its TAIL only, into the committed accent.
      // (Both keyed words coexist in the swap cell during the crossfade —
      // wait for the leaving one to finish before asserting the survivor.)
      const step = page.locator('.con-wshead__step');
      await expect(step).toHaveCount(1, {timeout: 5000});
      await expect(step).toHaveClass(/--committed/);
      expect((await step.innerText()).trim().toUpperCase()).toBe('ПОКУПКА');
      // ADAPTIVE single-card copy: the actual question, not the mass selector.
      await expect(page.locator('.con-ws-stage-title')).toContainText('Купить открытую карту?', {timeout: 10_000});
      // PRIMARY-HEADING PARITY: the shared .con-ws-stage-heading role — the
      // receive spec asserts the IDENTICAL computed numbers on its title, so
      // the two stages cannot drift apart unnoticed (fhd: 1.3rem = 26px/700).
      if (profile.tag === 'fhd') {
        const headStyle = await page.locator('.con-ws-stage-title').evaluate((el) => {
          const cs = window.getComputedStyle(el);
          return {size: cs.fontSize, weight: cs.fontWeight};
        });
        expect(headStyle, `heading ${JSON.stringify(headStyle)}`).toEqual({size: '26px', weight: '700'});
      }
      expect(await page.locator('.con-ws-stage-badge').count(), 'the counters fold away for one card').toBe(0);
      // The status line carries the economics and NO duplicated command chips.
      await expect(page.locator('.con-cards__verdict--price')).toBeVisible();
      expect(await page.locator('.con-cards__verdictbar .con-cards__verdict--zoom').count()).toBe(0);
      expect(await page.locator('.con-cards__verdictbar .con-cards__verdict--go').count()).toBe(0);
      // No stage-specific labels under the SOURCE card — its column must be
      // byte-identical across phases (the stability contract); the L3 verb
      // lives in the ONE command bar only.
      expect(await page.locator('.con-composer__cardrole').count()).toBe(0);
      // (Source text, not the CSS uppercase; the Deck bar drops the
      //  self-evident hints first — this one must survive on every profile.)
      await expect(page.locator('.con-cmdbar')).toContainText(/Источник/i);
      // The deal cinematic has fully HANDED OVER (no slot still holds its
      // card for a flying proxy) — the screenshot shows the settled stage.
      await expect(page.locator('.con-cards__slot.con-deal-hold')).toHaveCount(0, {timeout: 12_000});
      // HERO PARITY BASELINE — the offered card's real box + the heading's
      // computed voice, printed for the receive spec's twin probe (which
      // asserts the SAME numbers at the same profile: one fit formula, one
      // heading class, therefore one geometry).
      const heroBox = await page.locator('[data-embed-slot="workspace-reveal"] .con-cards__slot .pcard')
        .first().boundingBox();
      const heroHead = await page.locator('.con-ws-stage-title').evaluate((el) => {
        const cs = window.getComputedStyle(el);
        return {size: cs.fontSize, weight: cs.fontWeight};
      });
      // THE CHROME BREAKDOWN — the receive spec prints the same shape, so the
      // two stages are compared by MEASUREMENT rather than by reading two CSS
      // files (every divergence in this flow was found this way).
      const chrome = await page.locator('.con-task-host--embedded').evaluate((root) => {
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
          ui: getComputedStyle(document.documentElement).getPropertyValue('--con-ui-scale'),
        };
      });
      console.log(`[PARITY:${profile.tag}] buy hero=${JSON.stringify(heroBox)} head=${JSON.stringify(heroHead)} chrome=${JSON.stringify(chrome)}`);
      expect(heroBox).not.toBeNull();
      // The ETALON lives in ONE file (`wsStageParity`) that the receive spec
      // reads too, so a change to the shared chassis fails BOTH specs against
      // the same constant and gets re-synced in a single deliberate edit —
      // never one stage silently drifting away from the other.
      const stageBox = await page.locator('.con-task-host--embedded')
        .evaluate(stageProbe);
      expect(stageBox, `stage ${JSON.stringify(stageBox)}`).toEqual(WS_STAGE_BOX[profile.tag]);
      expect(heroHead, `heading ${JSON.stringify(heroHead)}`).toEqual(WS_STAGE_HEAD[profile.tag]);
      await page.waitForTimeout(900);
      await shoot(page, `${profile.tag}-02-embedded-buy`);

      // ── L3: fullscreen the SOURCE over the living stage. ────────────────
      // (Retry discipline: a press during a still-settling flight on a heavy
      //  4K frame is deliberately consumed — same as every wizard step.)
      const zoom = page.locator('dialog.con-zoom[open]');
      for (let tries = 0; tries < 6 && await zoom.count() === 0; tries++) {
        await key(page, 'KeyC', 1900);
      }
      await expect(zoom).toHaveCount(1, {timeout: 8000});
      await expect(zoom).toContainText(/Коммерческая сеть/i);
      await shoot(page, `${profile.tag}-03-l3-source`);
      // (Close with the same retry discipline — a press inside the viewer's
      //  still-settling open flight is consumed on a heavy 4K frame.)
      for (let tries = 0; tries < 3 && await zoom.count() > 0; tries++) {
        await key(page, 'Escape', 1400);
      }
      await expect(zoom).toHaveCount(0);
      // The stage survived the round trip untouched.
      await expect(embeddedHost).toHaveCount(1);
      await expect(page.locator('.con-ws-stage-title')).toContainText('Купить открытую карту?');
      // The FULLSCREEN RETURN did not move the source either (§17): the hero
      // box after the zoom round trip equals the setup box to the pixel.
      // Polled for the same reason as the commit-boundary check above: a fixed
      // 400 ms is a guess about the return flight, and on a loaded 4K frame it
      // is the wrong guess. The tolerance stays 1px.
      await expect(async () => {
        const heroAfterZoom = await page.locator('.con-composer__actcardwrap').boundingBox();
        expect(heroAfterZoom).not.toBeNull();
        expect(Math.abs(heroAfterZoom!.x - heroAtSetup!.x)).toBeLessThanOrEqual(1);
        expect(Math.abs(heroAfterZoom!.y - heroAtSetup!.y)).toBeLessThanOrEqual(1);
        expect(Math.abs(heroAfterZoom!.width - heroAtSetup!.width)).toBeLessThanOrEqual(1);
      }).toPass({timeout: 10_000});

      // ── X: fullscreen the RESULT (the X/L3 split). ──────────────────────
      await openZoomViewer(page);
      await closeZoomViewer(page);
      await expect(embeddedHost).toHaveCount(1);

      // ── COLLAPSE (B) → the committed decision survives → reopen. ────────
      // (Retry: a press inside the zoom's still-settling return flight is
      //  consumed on a heavy 4K frame — the loop stops the moment the fold
      //  lands, so a second press can never hit the board home.)
      for (let tries = 0; tries < 3; tries++) {
        await key(page, 'Escape', 1700);
        if (await page.locator('.con-cardactions').count() === 0) {
          break;
        }
      }
      await expect(page.locator('.con-cardactions')).toHaveCount(0, {timeout: 8000});
      // The deferred-return card waits on the board home.
      const restore = page.locator('.con-mandatory');
      await expect(restore).toHaveCount(1, {timeout: 8000});
      await shoot(page, `${profile.tag}-04-collapsed`);
      // Restore: A on the return card is the primary path; B (the board
      // home's restore branch) is the fallback — either must land back in
      // the SAME committed stage.
      await key(page, 'Enter', 1800);
      if (await page.locator('[data-embed-slot="workspace-reveal"] .con-task-host--embedded').count() === 0) {
        await key(page, 'Escape', 1800);
      }
      // The SAME committed stage comes back: same phase, same title, no
      // replayed cinematic, no second server trip.
      await expect(page.locator('[data-embed-slot="workspace-reveal"] .con-task-host--embedded')).toHaveCount(1, {timeout: 15_000});
      await expect(page.locator('.con-ws-stage-title')).toContainText('Купить открытую карту?');
      await expect(step).toHaveCount(1, {timeout: 5000});
      await expect(step).toHaveClass(/--committed/);

      // ── Buy: A picks (the after-purchase readout appears), RT commits. ──
      await key(page, 'Enter', 700);
      await expect(page.locator('.con-cards__slot--picked')).toHaveCount(1);
      await expect(page.locator('.con-cards__verdict--picked')).toContainText('После покупки');
      await shoot(page, `${profile.tag}-04-picked`);
      await key(page, 'Period', 800);

      // ── The result leaves for the dock; the workspace folds; no strand. ──
      await expect(page.locator('.con-cardactions')).toHaveCount(0, {timeout: 25_000});
      await expect(page.locator('.con-task-host')).toHaveCount(0);
      await waitForTurn(page);
      await page.waitForTimeout(2500);
      await shoot(page, `${profile.tag}-05-after-buy`);
    });
  });
}
