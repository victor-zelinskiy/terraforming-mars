import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixtureSeats, fetchPlayerModel, focusCard, press, pressUntil, settle, waitForBoardHome} from './consoleStart';
import {armLeakWitness, enterSittingByPass, openParliament, strandedReports, waitSittingAtRest} from './parliamentDrive';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';

/**
 * TR64 «АЛЬЯНС ПРОМЕТЕЯ» — the law of access's fourth road for the Scientists = the Industrialists, and a PRODUCTION
 * answer to a change of power (docs/TURMOIL_REDUX_PROMETHEAN_ALLIANCE.md). «While the Scientists are ruling or you have
 * 2 delegates there, you may also use the Industrialists' effect and cards. And vice versa. Gain 2 M€ production when
 * either of those parties becomes ruling.»
 *
 *   A. THE PLAY (`promethean-alliance` — two of blue's cubes on the Scientists): the composer names what opens NOW (the
 *      Industrialists, by the delegates road) and the production at a change of power; A → exactly ONE POST; after it
 *      the server reads the Industrialists by the ALLIANCE road and the chamber shows it as objects.
 *   B. THE ENACTMENT (`promethean-alliance-enact` — the Scientists win the sitting): after the seals change places the
 *      production token is BORN on the seal of the party that came to power and LANDS on the M€ row (both ends
 *      witnessed, nothing over glass), the production plate shows the old value until then; the band names the tail
 *      (the card, «Производство М€ 2», the party); no reveal, no deck scene; the server's M€ production +2.
 */

const CARD = 'Promethean Alliance';
const SCIENTISTS = 'Scientists';
const INDUSTRIALISTS = 'Industrialists';
const OUT = path.resolve('screenshots', 'tr64');
const COMPOSER = '.con-composer--play';
const PROD = '.con-res .con-res__row--megacredits .con-res__prod';

const PRESETS = [
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
  {id: 'deck', viewport: {width: 1280, height: 800}, query: '&consoleProfile=handheld'},
] as const;

type Access = {party: string, hasEffect: boolean, satisfiesRequirement: boolean,
  allied?: Array<{via: string, source: string, road: string}>};
type Wire = {
  cardsInHand?: Array<{name: string}>;
  thisPlayer: {color: string, megacredits: number, megacreditProduction: number, tableau: Array<{name: string}>};
  game: {parliament: {rulingParty: string, players: Array<{color: string, access: Array<Access>}>}};
};

async function wireOf(request: APIRequestContext, playerId: string): Promise<Wire> {
  try {
    return await fetchPlayerModel(request, playerId) as unknown as Wire;
  } catch (err) {
    if (!/ECONNRESET|socket hang up/.test(String(err))) {
      throw err;
    }
    return await fetchPlayerModel(request, playerId) as unknown as Wire;
  }
}

const accessOf = (wire: Wire, color: string, party: string): Access | undefined =>
  wire.game.parliament.players.find((p) => p.color === color)?.access.find((a) => a.party === party);

async function shoot(page: Page, preset: string, name: string): Promise<void> {
  fs.mkdirSync(path.join(OUT, preset), {recursive: true});
  await page.screenshot({path: path.join(OUT, preset, `${name}.png`)});
}

type Seal = {ring: string | null, ally: string | null, partner: string | null, badge: boolean};
async function sealOf(page: Page, party: string): Promise<Seal> {
  return page.evaluate((p) => {
    const seal = document.querySelector(`.con-parl__party[data-party="${p}"] .con-pseal`);
    return {
      ring: seal?.getAttribute('data-pseal-ring') ?? null,
      ally: seal?.getAttribute('data-pseal-ally') ?? null,
      partner: seal?.getAttribute('data-pseal-ally-partner') ?? null,
      badge: (seal?.querySelector('.con-pseal__ally') ?? null) !== null,
    };
  }, party);
}

for (const preset of PRESETS) {
  test.describe(`TR64 Promethean Alliance · the Scientists = the Industrialists, production at a change of power · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`A: the play opens the Industrialists by the alliance — named before the press, ONE POST, objects after (${preset.id})`, async ({page, request}) => {
      test.setTimeout(300_000);
      const pageErrors: Array<string> = [];
      const posts: Array<string> = [];
      page.on('pageerror', (e) => pageErrors.push(e.message));
      page.on('request', (r) => {
        if (r.method() === 'POST' && /\/player\/input/.test(r.url())) {
          posts.push(r.postData() ?? '');
        }
      });
      const {playerId} = await bootFixtureSeats(page, request, 'promethean-alliance', {query: preset.query});
      await settle(page);
      await armLeakWitness(page);
      const before = await wireOf(request, playerId);
      const blue = before.thisPlayer.color;
      expect(before.cardsInHand?.map((c) => c.name), 'the fixture: TR64 in hand').toContain(CARD);
      expect(accessOf(before, blue, INDUSTRIALISTS), 'before: the Industrialists are not blue\'s').toMatchObject({hasEffect: false});

      // RT → «КАРТЫ» → TR64 → A: its play composer, nothing sent.
      await press(page, 'Period', 600);
      await press(page, 'Enter', 1600);
      await page.locator(`.con-hand [data-zoom-slot="${CARD}"]`).waitFor({timeout: 20_000});
      await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
      await settle(page);
      const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
      expect(await focusCard(page, CARD, slots * 2 + 6), 'the cursor reached TR64 in the hand').toBe(true);
      expect(await pressUntil(page, 'Enter', async () => await page.locator(COMPOSER).count() > 0, {tries: 3, settleMs: 900}),
        'A opens TR64\'s play composer').toBe(true);
      await settle(page);
      await expect(page.locator(`${COMPOSER} .con-composer__next`).first(), 'the Industrialists open NOW — two of blue\'s delegates on the Scientists')
        .toContainText(/Откроет сейчас: эффект и карты «Индустриалисты» — два ваших делегата на «[^»]+»/);
      await expect(page.locator(COMPOSER), 'the production at a change of power is named before the press').toContainText(/\+2 к производству M€ всякий раз/);
      expect(posts.length, 'nothing sent before A').toBe(0);
      await shoot(page, preset.id, '01-composer');
      for (let attempt = 0; attempt < 3 && posts.length === 0; attempt++) {
        for (let i = 0; i < 8 && await page.locator('.con-composer__cta--focused').count() === 0; i++) {
          await press(page, 'ArrowDown', 300);
        }
        await press(page, 'Enter', 300);
        await expect.poll(() => posts.length, {timeout: 3_000}).toBeGreaterThan(0).catch(() => undefined);
      }
      expect(posts.length, 'the play is ONE POST').toBe(1);
      await waitForBoardHome(page, 25);
      await settle(page, {timeoutMs: 30_000});

      const after = await wireOf(request, playerId);
      expect(after.thisPlayer.tableau.map((c) => c.name), 'the card is on the table').toContain(CARD);
      expect(accessOf(after, blue, INDUSTRIALISTS)?.allied?.[0], 'the Industrialists by the alliance — two delegates on the Scientists')
        .toMatchObject({via: SCIENTISTS, source: CARD, road: 'delegates'});
      await openParliament(page);
      await expect.poll(() => sealOf(page, INDUSTRIALISTS), {timeout: 15_000, message: 'the Industrialists\' seal: the borrowed ring and the active badge'})
        .toMatchObject({ring: 'allied', ally: 'active', partner: SCIENTISTS, badge: true});
      expect(await sealOf(page, SCIENTISTS), 'the Scientists\' seal: the active badge of the pair').toMatchObject({ally: 'active', partner: INDUSTRIALISTS, badge: true});
      await shoot(page, preset.id, '02-parliament-after');
      expect(await strandedReports(page), 'the leak witness saw nothing').toEqual([]);
      expect(pageErrors, 'no page error').toEqual([]);
    });

    test(`B: the enactment of the Scientists — the production token from their seal to the M€ row, the band names it (${preset.id})`, async ({page, request}) => {
      test.setTimeout(420_000);
      // The table stands ONE PASS before its sitting (the soft gates): the viewer's own pass carries the whole sitting.
      const {playerId} = await bootFixtureSeats(page, request, 'promethean-alliance-enact', {query: preset.query});
      const before = await wireOf(request, playerId);
      const prod = before.thisPlayer.megacreditProduction;
      await armTransferWitness(page);
      // The scene's own facts across the enactment (MutationObserver + setInterval — never rAF): the reveal surfaces, the
      // band's line, and the production the plate SHOWS while the token is in the air.
      await page.evaluate((sel) => {
        const w = window as unknown as {__tr64: {samples: number, reveal: boolean, band: boolean, bandWhileFlying: boolean, prodAtBirth: string | null, prods: Array<string>}};
        w.__tr64 = {samples: 0, reveal: false, band: false, bandWhileFlying: false, prodAtBirth: null, prods: []};
        const sample = () => {
          const p = w.__tr64;
          p.samples++;
          if (document.querySelector('.con-reveal, .con-deckdraw') !== null) {
            p.reveal = true;
          }
          const flying = document.querySelectorAll('.con-transfer__chip').length;
          const shown = (document.querySelector(sel)?.firstChild?.textContent ?? '').trim();
          if (p.prods[p.prods.length - 1] !== shown) {
            p.prods.push(shown);
          }
          if (flying > 0 && p.prodAtBirth === null) {
            p.prodAtBirth = shown;
          }
          const band = document.querySelector('[data-parl-band-zone]')?.getAttribute('data-parl-band') ?? '';
          if (band.startsWith('enact:ruling-draw:')) {
            p.band = true;
            if (flying > 0) {
              p.bandWhileFlying = true;
            }
          }
        };
        new MutationObserver(sample).observe(document.body, {subtree: true, childList: true, attributes: true});
        window.setInterval(sample, 30);
      }, PROD);
      await enterSittingByPass(page, request, playerId);
      if (process.env.TM_E2E_STORYBOARD === '1') {
        fs.mkdirSync(path.join(OUT, preset.id), {recursive: true});
        for (let frame = 0; frame < 28; frame++) {
          await page.screenshot({path: path.join(OUT, preset.id, `story-enact-${String(frame).padStart(2, '0')}.jpg`), type: 'jpeg', quality: 70});
        }
      }
      await expect.poll(async () => (await wireOf(request, playerId)).game.parliament.rulingParty, {timeout: 60_000}).toBe(SCIENTISTS);
      const after = await wireOf(request, playerId);
      expect(after.thisPlayer.megacreditProduction, 'the server: two M€ production steps for the change of power').toBe(prod + 2);
      expect(accessOf(after, after.thisPlayer.color, INDUSTRIALISTS)?.allied?.[0], 'the Industrialists by the alliance — the Scientists rule')
        .toMatchObject({via: SCIENTISTS, road: 'ruling'});
      await expect.poll(async () => (await transferWitness(page)).births.some((b) => b.under === `seal:${SCIENTISTS}`), {timeout: 60_000, message: 'the production token was born'})
        .toBe(true);
      await waitSittingAtRest(page, 30_000);
      await page.locator('[data-sit-results]:not([data-sit-results-hidden])').first().waitFor({timeout: 20_000}).catch(() => undefined);
      await settle(page);
      await shoot(page, preset.id, '03-enact-after');
      const witness = await transferWitness(page);
      const trail = transferTrail(witness);
      const born = witness.births.find((b) => b.under === `seal:${SCIENTISTS}`);
      expect(born, `the production token is born on the Scientists' seal:\n${trail}`).toBeDefined();
      expect(born?.value, 'the token reads +2').toBe('+2');
      const landed = witness.landings.find((l) => l.id === born?.id);
      expect(landed?.under, `…and lands on the M€ row:\n${trail}`).toBe('rail:megacredits');
      expect(endsOverGlass(witness), `no end over glass:\n${trail}`).toEqual([]);
      const probe = await page.evaluate(() => (window as unknown as {__tr64: {samples: number, reveal: boolean, band: boolean, bandWhileFlying: boolean, prodAtBirth: string | null, prods: Array<string>}}).__tr64);
      expect(probe.samples, 'the probe ran').toBeGreaterThan(20);
      expect(probe.reveal, 'no reveal and no deck-draw scene over the sitting').toBe(false);
      expect(probe.band, 'the band names the tail of the enactment — the card that answered the change of power').toBe(true);
      expect(probe.bandWhileFlying, '…while the token is in the air').toBe(true);
      expect(probe.prodAtBirth, `the production plate shows the OLD value while the token flies (seen: ${probe.prods.join(' → ')})`).toBe(`+${prod}`);
      await expect.poll(() => page.locator(PROD).first().evaluate((el) => (el.firstChild?.textContent ?? '').trim()), {timeout: 20_000})
        .toBe(`+${prod + 2}`);
      expect(await strandedReports(page)).toEqual([]);
    });
  });
}
