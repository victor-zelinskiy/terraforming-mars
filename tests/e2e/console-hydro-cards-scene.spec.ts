import {test, expect, Page, APIRequestContext} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  createGameWithCards, fetchPlayerModel, openConsole, press, seedGameOverApi,
  sendPlayerInput, soloGameConfig, waitForBoardHome,
} from './consoleStart';

/**
 * THE HYDRONETWORK CARD SCENE — «Гидромоделирование» (stage 5, draw 4 keep 2)
 * as a FULL-SURFACE card selection, played once.
 *
 * The two contracts of the second polish iteration, live:
 *
 *  · IMMERSIVE: while the embedded deck pick is the active input, the cards
 *    own the whole work surface — the identity/action columns and the commit
 *    line dissolve (opacity, the grid never re-lays), the embed zone takes
 *    the frame, the cards get TV-readable size; everything returns after.
 *
 *  · DEAL-ONCE: the deal plays exactly once per REWARD BATCH. «Свернуть» and
 *    the mandatory-prompt reopen re-mount the surface over the same server
 *    ask — the cards must stand already settled (no second flight off the
 *    deck), with the draft picks and the cursor restored.
 *
 * The route to stage 5 is honest: four tag cards played over the API
 * (building/power + earth + space + science), then ONE five-step advance
 * committed through the UI. No stubs — the server deals the real batch.
 *
 * Screenshots → `screenshots/hydro-cards/`.
 */

const OUT = path.resolve('screenshots', 'hydro-cards');

/** The path tags for a 0 → 5 jump, in four cheap no-requirement cards. */
const TAG_CARDS = ['Solar Power', 'Development Manager', 'Space Station', 'Research'];

const CFG = soloGameConfig({
  players: [{name: 'CardsProbe', color: 'red', beginner: false, handicap: 0, first: true}],
  expansions: {deltaProject: true},
  customProjectCards: TAG_CARDS,
  customCorporationsList: ['ThorGate'],
  seed: 0.41,
});

type Wire = Record<string, any>;

function titleOf(prompt: Wire | undefined): string {
  const t = prompt?.title;
  return typeof t === 'string' ? t : String(t?.message ?? '');
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

async function toActionMenu(request: APIRequestContext, id: string): Promise<Wire> {
  let model = await fetchPlayerModel(request, id) as Wire;
  for (let i = 0; i < 30; i++) {
    const prompt = model.waitingFor as Wire | undefined;
    if (prompt !== undefined && prompt.type === 'or' && /Take your (first|next) action/.test(titleOf(prompt))) {
      return prompt;
    }
    if (prompt === undefined) {
      await new Promise((r) => setTimeout(r, 400));
      model = await fetchPlayerModel(request, id) as Wire;
      continue;
    }
    model = prompt.type === 'card' ?
      await sendPlayerInput(request, id, {type: 'card', cards: []} as never) as Wire :
      await sendPlayerInput(request, id, {type: 'or', index: 0, response: {type: 'option'}} as never) as Wire;
  }
  expect(false, `never reached the action menu (stuck on ${titleOf(model.waitingFor as Wire)})`).toBeTruthy();
  return {};
}

function payMc(amount: number): Wire {
  return {
    megacredits: amount, steel: 0, titanium: 0, heat: 0, plants: 0, microbes: 0,
    floaters: 0, lunaArchivesScience: 0, spireScience: 0, seeds: 0, auroraiData: 0,
    graphene: 0, kuiperAsteroids: 0, corruption: 0,
  };
}

/** Play one hand card over the API, M€ only (testMode affords everything). */
async function playCard(request: APIRequestContext, id: string, card: string): Promise<void> {
  const menu = await toActionMenu(request, id);
  const at = (menu.options ?? []).findIndex((o: Wire) => titleOf(o) === 'Play project card');
  expect(at, 'the menu offers «Play project card»').toBeGreaterThanOrEqual(0);
  const offered = ((menu.options ?? [])[at].cards ?? []).find((c: Wire) => c.name === card);
  expect(offered, `${card} is in hand`).toBeDefined();
  await sendPlayerInput(request, id, {
    type: 'or', index: at,
    response: {type: 'projectCard', card, payment: payMc(offered.calculatedCost ?? 20)},
  } as never);
}

async function serverState(request: APIRequestContext, id: string): Promise<{position: number, hand: number}> {
  const model = await fetchPlayerModel(request, id) as Wire;
  return {
    position: model.thisPlayer?.deltaProject?.position ?? 0,
    hand: (model.cardsInHand ?? []).length,
  };
}

const PROFILES = [
  {tag: 'fhd', width: 1920, height: 1080, query: '', slotMin: 170},
  {tag: 'tv4k', width: 3840, height: 2160, query: '&consoleProfile=tv', slotMin: 340},
] as const;

for (const profile of PROFILES) {
  test.describe(`hydro card scene · ${profile.tag}`, () => {
    test.use({
      viewport: {width: profile.width, height: profile.height},
      deviceScaleFactor: 1,
      screen: {width: profile.width, height: profile.height},
    });

    test('stage 5: immersive full-surface selection; collapse → reopen never re-deals', async ({page, request}) => {
      test.setTimeout(480_000);
      const id = await createGameWithCards(request, TAG_CARDS, {config: CFG, seed: 0.41});
      await seedGameOverApi(request, id, {cards: TAG_CARDS, corporation: 'ThorGate'});
      for (const card of TAG_CARDS) {
        await playCard(request, id, card);
      }
      await openConsole(page, id, profile.query);
      await waitForBoardHome(page, 25);

      // ── Open the Hydronetwork; RT jumps to the farthest legal stage (5 —
      //    the four tag cards + ThorGate cover the whole path). ──
      await press(page, 'Period', 1100);
      await press(page, 'ArrowLeft', 1600);
      await page.waitForSelector('.con-hydro', {timeout: 10_000});
      await page.waitForSelector('.con-hydro__payline', {timeout: 10_000});
      await press(page, 'Period', 900); // RT — «К дальнему»
      const focused = await page.evaluate(() =>
        document.querySelector('.con-hydro__stop--focused')?.getAttribute('data-hydro-stop') ?? '');
      expect(focused, 'the farthest legal stage is 5').toBe('5');

      // ARM the deal probe BEFORE the commit: every `.con-deal-proxy` that
      // ever APPEARS is one dealt card body. The first presentation must fly
      // exactly one batch; the reopen must fly none.
      await page.evaluate(() => {
        const w = window as unknown as {__deals?: number, __dealStop?: () => void};
        w.__deals = 0;
        const seen = new WeakSet<Element>();
        const count = () => {
          document.querySelectorAll('.con-deal-proxy').forEach((el) => {
            if (!seen.has(el)) {
              seen.add(el);
              w.__deals = (w.__deals ?? 0) + 1;
            }
          });
        };
        const mo = new MutationObserver(count);
        mo.observe(document.body, {childList: true, subtree: true});
        const iv = setInterval(count, 120);
        w.__dealStop = () => {
          mo.disconnect();
          clearInterval(iv);
        };
      });

      // ── A: the ONE vocabulary commit («Укрепить гидросеть» — stage 5 has
      //    no choice and no pick), marker glide, then the card scene. ──
      await press(page, 'Enter', 2500);
      await page.waitForSelector('.con-deckpick', {timeout: 30_000});
      // The batch physically dealt — wait for the choosing state (the fit and
      // the handoff have settled once slots are interactive).
      await page.waitForSelector('.con-deckpick[data-flow="choosing"]', {timeout: 20_000});
      await page.waitForTimeout(900);

      const firstDeals = await page.evaluate(() =>
        (window as unknown as {__deals?: number}).__deals ?? 0);
      expect(firstDeals, 'the FIRST presentation deals the batch (proxies flew)').toBeGreaterThan(0);

      // ── IMMERSIVE: the cards own the whole surface. ──
      const scene = await page.evaluate(() => {
        const panel = document.querySelector('.con-hydro__panel');
        const embed = document.querySelector('.con-hydro__embed');
        const ctx = document.querySelector('.con-hydro__ctx') as HTMLElement | null;
        const commitline = document.querySelector('.con-hydro__commitline') as HTMLElement | null;
        const slots = Array.from(document.querySelectorAll('.con-deckpick .con-cards__slot'));
        const head = (document.querySelector('.con-deckpick__head') as HTMLElement | null)?.innerText ?? '';
        const pr = panel?.getBoundingClientRect();
        const er = embed?.getBoundingClientRect();
        return {
          immersive: panel?.classList.contains('con-hydro__panel--immersive') ?? false,
          ctxOpacity: ctx === null ? -1 : Number(getComputedStyle(ctx).opacity),
          commitOpacity: commitline === null ? -1 : Number(getComputedStyle(commitline).opacity),
          embedW: er?.width ?? 0,
          panelW: pr?.width ?? 0,
          slotCount: slots.length,
          slotW: slots.length > 0 ? slots[0].getBoundingClientRect().width : 0,
          spinner: document.querySelector('.con-hydro__commit-spin') !== null,
          head,
        };
      });
      expect(scene.immersive, 'the frame wears the immersive class').toBe(true);
      expect(scene.ctxOpacity, 'the identity column has dissolved').toBeLessThan(0.05);
      expect(scene.commitOpacity, 'the commit line has dissolved').toBeLessThan(0.05);
      expect(scene.embedW, 'the embed zone spans the frame').toBeGreaterThan(scene.panelW * 0.9);
      expect(scene.slotCount, 'the stage dealt four cards').toBe(4);
      expect(scene.slotW, `cards are TV-readable (${Math.round(scene.slotW)}px)`).toBeGreaterThan(profile.slotMin);
      expect(scene.spinner, 'no ambiguous spinner while the PLAYER holds the input').toBe(false);
      // The pluralization pipeline, live: never «карт(ы)».
      expect(scene.head, `the ask read «${scene.head}»`).not.toContain('(');
      expect(scene.head).toMatch(/2 карты/i);
      await shoot(page, `${profile.tag}-01-immersive`);

      // ── Pick ONE card, then COLLAPSE. ──
      await press(page, 'Enter', 700);
      expect(await page.locator('.con-cards__slot--picked').count(), 'one draft pick held').toBe(1);
      const pickedName = await page.evaluate(() =>
        document.querySelector('.con-cards__slot--picked')?.getAttribute('data-deckpick-slot') ?? '');
      await press(page, 'Escape', 1600);
      await expect(page.locator('.con-hydro')).toHaveCount(0, {timeout: 15_000});
      await shoot(page, `${profile.tag}-02-collapsed`);

      // Re-arm the deal counter for the REOPEN: it must stay at zero.
      await page.evaluate(() => {
        const w = window as unknown as {__deals?: number};
        w.__deals = 0;
      });

      // ── REOPEN through the mandatory prompt — the same batch, settled. ──
      await expect(page.locator('.con-mandatory')).toBeVisible({timeout: 20_000});
      await press(page, 'Enter', 2200);
      await page.waitForSelector('.con-deckpick[data-flow="choosing"]', {timeout: 20_000});
      await page.waitForTimeout(1200);
      const reopen = await page.evaluate(() => ({
        deals: (window as unknown as {__deals?: number}).__deals ?? 0,
        picked: Array.from(document.querySelectorAll('.con-cards__slot--picked'))
          .map((el) => el.getAttribute('data-deckpick-slot') ?? ''),
        immersive: document.querySelector('.con-hydro__panel--immersive') !== null,
        slots: document.querySelectorAll('.con-deckpick .con-cards__slot').length,
      }));
      expect(reopen.deals, 'the reopen dealt NOTHING — the batch adopts settled').toBe(0);
      expect(reopen.slots, 'all four cards stand').toBe(4);
      expect(reopen.picked, 'the draft pick survived the park').toEqual([pickedName]);
      expect(reopen.immersive, 'the card scene owns the frame again').toBe(true);
      await page.evaluate(() => (window as unknown as {__dealStop?: () => void}).__dealStop?.());
      await shoot(page, `${profile.tag}-03-reopened`);

      // ── Finish: pick a second card, RT commits, the picks reach the hand,
      //    the surface returns to the ordinary flow. ──
      const before = await serverState(request, id);
      expect(before.position, 'the marker already stands on 5').toBe(5);
      // Walk right until a second card is picked (the wall holds — bounded).
      for (let i = 0; i < 6 && await page.locator('.con-cards__slot--picked').count() < 2; i++) {
        await press(page, 'ArrowRight', 450);
        await press(page, 'Enter', 600);
      }
      expect(await page.locator('.con-cards__slot--picked').count(), 'two picks held').toBe(2);
      await press(page, 'Period', 2500); // RT — «Подтвердить»
      await expect.poll(async () => (await serverState(request, id)).hand,
        {timeout: 25_000, message: 'the two picks reached the hand'}).toBe(before.hand + 2);
      // The immersive dissolve returns the frame to the ordinary flow (the
      // result / browse states wear the ctx and act columns again).
      await expect.poll(async () => page.evaluate(() =>
        document.querySelector('.con-hydro__panel--immersive') === null ||
        document.querySelector('.con-hydro') === null),
      {timeout: 25_000, message: 'the immersive pose released'}).toBe(true);
      await shoot(page, `${profile.tag}-04-after`);
    });
  });
}
