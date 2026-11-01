import {test, expect, Page, APIRequestContext} from './consoleTest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  bootSeededGame, cinematicBeat, commitFocusedSpace, createGameWithCards, fetchPlayerModel, press, settle,
  soloGameConfig, walkToSpace,
} from './consoleStart';
import {armLeakWitness, parliamentWire, strandedReports} from './parliamentDrive';

/**
 * VASTITAS BOREALIS NOVA on the console — the official map in the premium scope.
 *
 *  1. THE BOARD. The legacy SVG captions are gone; the named cells (four volcanoes, the North Pole, both Viking
 *     sites) are premium hover markers; the North Pole prints the premium «temperature · −4» plate; a Viking hex
 *     prints the Parliament's DELEGATE figure (`delegate.svg`, the card faces' and the Redux Venus colony's) whole —
 *     never the square slot that cut its feet off.
 *  2. THE VIKING STEP. A city (the standard project — a greenery must touch the seat's own tiles, a city only keeps
 *     away from other cities) placed on Viking 1 → the cell's printed delegate is the Parliament's own grant: the vote mode stands, A sends the delegate, it lands on a resolution, and nothing is
 *     stranded on the way.
 * Evidence → screenshots/vastitas-borealis/.
 */

const OUT = path.resolve('screenshots', 'vastitas-borealis');
const VIKING_1 = '59';
const NORTH_POLE = '33';
const VIKING_2 = '28';

const PROFILES = [{id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'}] as const;

function config() {
  return soloGameConfig({
    board: 'vastitas borealis nova',
    expansions: {colonies: true, turmoilRedux: true},
  });
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

type ParliamentView = {
  game: {parliament?: {slots: Array<{instance: string, party: string, votes: Array<{owner: string}>}>}},
  thisPlayer: {color: string, megacredits: number},
};

const view = async (request: APIRequestContext, playerId: string): Promise<ParliamentView> =>
  await fetchPlayerModel(request, playerId) as unknown as ParliamentView;

const myVotes = (v: ParliamentView): number =>
  (v.game.parliament?.slots ?? []).reduce((sum, s) => sum + s.votes.filter((x) => x.owner === v.thisPlayer.color).length, 0);

for (const profile of PROFILES) {
  test.describe(`Vastitas Borealis Nova · ${profile.id}`, () => {
    test.use({viewport: profile.viewport, deviceScaleFactor: 1, screen: profile.viewport});

    test('the board: premium markers instead of the SVG captions; the pole plate and the delegate figure print whole', async ({page, request}) => {
      test.setTimeout(300_000);
      const playerId = await createGameWithCards(request, [], {config: config()});
      await bootSeededGame(page, request, playerId, {buy: 0, query: profile.query});
      await settle(page);
      await shoot(page, '00-board');

      const board = await page.evaluate(([viking1, pole, viking2]) => {
        const cell = (id: string) => document.querySelector(`[data_space_id="${id}"]`);
        const bonus = (id: string, kind: string) => {
          const el = cell(id)?.querySelector<HTMLElement>(`.board-space-bonus--${kind}`);
          if (el === null || el === undefined) {
            return undefined;
          }
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          return {w: r.width, h: r.height, image: cs.backgroundImage, size: cs.backgroundSize};
        };
        return {
          captions: document.querySelector('#board_legend')?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
          markers: Array.from(document.querySelectorAll('.special-cell-marker')).map((m) =>
            Array.from(m.classList).find((c) => /^board-space-\d+$/.test(c)) ?? '?').sort(),
          viking1: bonus(viking1, 'delegate'),
          viking2: bonus(viking2, 'delegate'),
          pole: bonus(pole, 'bonustemperature4mc'),
        };
      }, [VIKING_1, NORTH_POLE, VIKING_2]);
      console.log('── the board ──', JSON.stringify(board, null, 2));

      expect(board.captions, 'no legacy SVG caption is left on this map').not.toMatch(/Hectates|Tholius|Viking|Uranius|Alba|Elysium/);
      for (const id of ['05', '13', '21', '28', '33', '46', '59']) {
        expect(board.markers, `a premium marker on cell ${id}`).toContain(`board-space-${id}`);
      }
      for (const [name, b] of [['Viking 1', board.viking1], ['Viking 2', board.viking2]] as const) {
        expect(b, `${name} prints the delegate bonus`).toBeDefined();
        expect(b!.image, `${name}: the Parliament's own figure`).toContain('delegate.svg');
        // The figure is PORTRAIT (40 × 52) — the slot is taller than wide, so nothing is cut.
        expect(b!.h / b!.w, `${name}: the slot keeps the figure's proportions`).toBeGreaterThan(1.2);
      }
      expect(board.pole, 'the North Pole prints its plate').toBeDefined();
      expect(board.pole!.image).toContain('bonus_temperature-4mc');

      // The premium plate is the new art, not the 107 px legacy sticker.
      const natural = await page.evaluate(async (url) => {
        const img = new Image();
        img.src = url;
        await img.decode();
        return img.naturalWidth;
      }, board.pole!.image.replace(/^url\("?/, '').replace(/"?\)$/, ''));
      expect(natural, 'the premium temperature plate').toBeGreaterThanOrEqual(200);

      // Hover the North Pole's marker region → its dossier names the step and the 4 M€.
      await page.locator(`[data_space_id="${NORTH_POLE}"]`).hover();
      await settle(page);
      await shoot(page, '01-north-pole-hover');
      await page.locator(`[data_space_id="${VIKING_1}"]`).hover();
      await settle(page);
      await shoot(page, '02-viking-hover');
    });

    test('Viking 1: a city on the landing site adds a delegate through the Parliament\'s own grant', async ({page, request}) => {
      test.setTimeout(420_000);
      const playerId = await createGameWithCards(request, [], {config: config()});
      await bootSeededGame(page, request, playerId, {buy: 0, query: profile.query});
      await settle(page);
      await armLeakWitness(page);
      const before = await view(request, playerId);
      expect(before.thisPlayer.megacredits, 'the seat can afford the 25 M€ city').toBeGreaterThanOrEqual(25);
      const votesBefore = myVotes(before);

      // LT wheel → Standard Projects → «Город».
      await press(page, 'Comma', 1200);
      await press(page, 'Enter', 1400);
      expect(await page.locator('.con-stdp').count(), 'standard projects did not open').toBeGreaterThan(0);
      const focusedName = async () => (await page.locator('.con-stdp__card--focused .con-stdp__name').textContent().catch(() => '')) ?? '';
      const walk = ['ArrowDown', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp'];
      for (let i = 0; i < 18 && !/^\s*город\s*$/i.test(await focusedName()); i++) {
        await press(page, walk[i % walk.length], 300);
      }
      expect(/^\s*город\s*$/i.test(await focusedName()), 'could not focus «Город»').toBeTruthy();
      await press(page, 'Enter', 1800);
      if (/ОПЛАТА/.test(await page.locator('.con-root').innerText())) {
        await press(page, 'KeyX', 2200);
      }
      await expect.poll(async () => (await fetchPlayerModel(request, playerId) as unknown as {waitingFor?: {type?: string}}).waitingFor?.type ?? '',
        {timeout: 30_000, message: 'the city asks for its cell'}).toBe('space');

      await walkToSpace(page, VIKING_1);
      await shoot(page, '10-viking-aimed');
      const panel = (await page.locator('.con-context').innerText().catch(() => '')).replace(/\s+/g, ' ');
      console.log('── the Viking dossier ──', panel);
      expect(panel, 'the dossier says the delegate goes to a resolution').toMatch(/Делегат на резолюцию/);
      expect(await commitFocusedSpace(page), 'the city landed on Viking 1').toBeTruthy();

      // THE GRANT: the server asks the party; the console stands the vote mode.
      await expect.poll(async () => (await parliamentWire(request, playerId)).waitingFor?.type ?? 'none',
        {timeout: 40_000, message: 'the Viking delegate is asked as a grant'}).toBe('party');
      await page.waitForSelector('.con-parl', {timeout: 40_000});
      await cinematicBeat(page, 1600, 'the vote pose settles');
      await shoot(page, '11-vote');
      const vote = await page.evaluate(() => {
        const t = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
        const parl = document.querySelector('.con-parl');
        return {
          parls: document.querySelectorAll('.con-parl').length,
          embedded: parl?.classList.contains('con-parl--embedded') ?? false,
          stage: parl?.getAttribute('data-stage') ?? '',
          count: document.querySelector('[data-parl-vote-count]')?.getAttribute('data-parl-vote-count') ?? '',
          cta: t(document.querySelector('.con-parl__cta')),
          crumbs: Array.from(document.querySelectorAll('.con-wshead')).map(t),
          giver: t(document.querySelector('[data-parl-cell-giver]')),
          giverIcon: document.querySelector('[data-parl-cell-giver] [data-source-cell] .resource_icon--delegate') !== null,
        };
      });
      console.log('── the vote ──', JSON.stringify(vote, null, 2));
      expect(vote.parls, 'ONE Parliament instance').toBe(1);
      expect(vote.stage, 'straight into the vote pose').toBe('vote');
      expect(vote.count, 'the cell grants ONE delegate').toBe('1');
      // WHO ASKED: the head names the cell — the ONE source plate (its proper name and its printed delegate).
      expect(vote.giver, 'the head names the Viking cell').toMatch(/Викинга-1/);
      expect(vote.giverIcon, 'the plate wears the printed delegate of the cell').toBe(true);

      await page.keyboard.press('Enter');
      await expect.poll(async () => (await parliamentWire(request, playerId)).waitingFor?.type ?? 'none',
        {timeout: 30_000, message: 'the grant was answered'}).not.toBe('party');
      await expect.poll(async () => page.locator('.con-parl').count(), {timeout: 40_000, message: 'the vote step leaves after the landing'}).toBe(0);
      await settle(page);
      await shoot(page, '12-after');

      const after = await view(request, playerId);
      expect(myVotes(after), 'one more of the seat\'s delegates stands on a resolution').toBe(votesBefore + 1);
      expect(await strandedReports(page), 'no prompt was stranded on the way').toEqual([]);
    });
  });
}
