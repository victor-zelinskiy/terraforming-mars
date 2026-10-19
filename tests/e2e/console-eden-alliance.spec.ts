import * as fs from 'fs';
import * as path from 'path';
import {test, expect, Page, APIRequestContext} from './consoleTest';
import {bootFixtureSeats, fetchPlayerModel, focusCard, openMandatoryAnnounce, press, pressUntil, settle, waitForBoardHome} from './consoleStart';
import {answerGateAs, answerGateOnScreen, armLeakWitness, mandatoryPlate, openParliament, parliament, sittingStage, strandedReports, waitSittingAtRest} from './parliamentDrive';
import {armTransferWitness, endsOverGlass, transferTrail, transferWitness} from './transferWitness';

/**
 * TR63 «АЛЬЯНС ЭДЕМА» — the law of access's fourth road for Unity = the Greens, and a RATING answer to a change of power
 * (docs/TURMOIL_REDUX_EDEN_ALLIANCE.md). «While Unity is ruling or you have 2 delegates there, you may also use the
 * Greens' effect and cards. And vice versa. Gain 1 TR when either of those parties becomes ruling.»
 *
 *   A. THE PLAY (`eden-alliance` — the Greens rule by the starting rule): the composer names what opens NOW («Союз», by
 *      the alliance — the Greens are ruling) and the rating at a change of power; A → exactly ONE POST; after it the
 *      server reads Unity by the ALLIANCE road and the chamber shows it as objects (the badge, the borrowed ring).
 *   B. THE ENACTMENT (`eden-alliance-enact` — Unity wins the sitting): after the seals change places the rating token is
 *      BORN on the seal of the party that came to power and LANDS on the rating cell (both ends witnessed, nothing over
 *      glass), the cell shows the old rating until then; the band names the tail (the card, «РТ 1», the party); no
 *      reveal, no deck scene; the server's rating +1 and the Greens' answer (+2 M€, the Greens blue's by the alliance).
 */

const CARD = 'Eden Alliance';
const UNITY = 'Unity';
const GREENS = 'Greens';
const OUT = path.resolve('screenshots', 'tr63');
const COMPOSER = '.con-composer--play';

const PRESETS = [
  {id: 'tv4k', viewport: {width: 3840, height: 2160}, query: '&consoleProfile=tv'},
  {id: 'fhd', viewport: {width: 1920, height: 1080}, query: '&consoleProfile=auto'},
  {id: 'deck', viewport: {width: 1280, height: 800}, query: '&consoleProfile=handheld'},
] as const;

type Access = {party: string, hasEffect: boolean, satisfiesRequirement: boolean, byDelegates: boolean,
  allied?: Array<{via: string, source: string, road: string}>};
type Wire = {
  cardsInHand?: Array<{name: string}>;
  thisPlayer: {color: string, megacredits: number, terraformRating: number, tableau: Array<{name: string}>};
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
  test.describe(`TR63 Eden Alliance · Unity = the Greens, a rating at a change of power · ${preset.id}`, () => {
    test.use({viewport: preset.viewport});

    test(`A: the play opens Unity by the alliance — named before the press, ONE POST, objects after (${preset.id})`, async ({page, request}) => {
      test.setTimeout(300_000);
      const pageErrors: Array<string> = [];
      const posts: Array<string> = [];
      page.on('pageerror', (e) => pageErrors.push(e.message));
      page.on('request', (r) => {
        if (r.method() === 'POST' && /\/player\/input/.test(r.url())) {
          posts.push(r.postData() ?? '');
        }
      });
      const {playerId} = await bootFixtureSeats(page, request, 'eden-alliance', {query: preset.query});
      await settle(page);
      await armLeakWitness(page);
      const before = await wireOf(request, playerId);
      const blue = before.thisPlayer.color;
      expect(before.cardsInHand?.map((c) => c.name), 'the fixture: TR63 in hand').toContain(CARD);
      expect(accessOf(before, blue, UNITY), 'before: Unity is not blue\'s').toMatchObject({hasEffect: false});

      // RT → «КАРТЫ» → TR63 → A: its play composer, nothing sent.
      await press(page, 'Period', 600);
      await press(page, 'Enter', 1600);
      await page.locator(`.con-hand [data-zoom-slot="${CARD}"]`).waitFor({timeout: 20_000});
      await page.locator('.con-hand:not(.con-hand--transit)').waitFor({state: 'visible', timeout: 15_000});
      await settle(page);
      const slots = await page.locator('.con-hand__slot[data-zoom-slot]').count();
      expect(await focusCard(page, CARD, slots * 2 + 6), 'the cursor reached TR63 in the hand').toBe(true);
      expect(await pressUntil(page, 'Enter', async () => await page.locator(COMPOSER).count() > 0, {tries: 3, settleMs: 900}),
        'A opens TR63\'s play composer').toBe(true);
      await settle(page);
      await expect(page.locator(`${COMPOSER} .con-composer__next`).first(), 'Unity opens NOW, by the alliance — the Greens are ruling')
        .toContainText(/Откроет сейчас: эффект и карты «Союз» — «Зелёные» у власти/);
      await expect(page.locator(COMPOSER), 'the rating at a change of power is named before the press').toContainText(/1 РТ всякий раз/);
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
      expect(accessOf(after, blue, UNITY)?.allied?.[0], 'Unity by the alliance — the Greens rule').toMatchObject({via: GREENS, source: CARD, road: 'ruling'});
      await openParliament(page);
      await expect.poll(() => sealOf(page, UNITY), {timeout: 15_000, message: 'Unity\'s seal: the borrowed ring and the active badge'})
        .toMatchObject({ring: 'allied', ally: 'active', partner: GREENS, badge: true});
      expect(await sealOf(page, GREENS), 'the Greens\' seal: the active badge of the pair').toMatchObject({ally: 'active', partner: UNITY, badge: true});
      await shoot(page, preset.id, '02-parliament-after');
      expect(await strandedReports(page), 'the leak witness saw nothing').toEqual([]);
      expect(pageErrors, 'no page error').toEqual([]);
    });

    test(`B: the enactment of Unity — the rating token from Unity's seal to the rating cell, the band names it (${preset.id})`, async ({page, request}) => {
      test.setTimeout(420_000);
      const {playerId, seats} = await bootFixtureSeats(page, request, 'eden-alliance-enact', {query: preset.query, landing: 'prompt'});
      const before = await wireOf(request, playerId);
      const tr = before.thisPlayer.terraformRating;
      const mc = before.thisPlayer.megacredits;
      await expect(mandatoryPlate(page)).toHaveCount(1, {timeout: 30_000});
      expect(await openMandatoryAnnounce(page)).toBe(true);
      await expect(parliament(page)).toHaveCount(1, {timeout: 20_000});
      await expect.poll(() => sittingStage(page), {timeout: 15_000}).toBe('verdict');
      await waitSittingAtRest(page, 30_000);
      await armTransferWitness(page);
      // The scene's own facts across the enactment (MutationObserver + setInterval — never rAF): the reveal surfaces, the
      // band's line, and the rating the cell SHOWS while the token is in the air.
      await page.evaluate(() => {
        const w = window as unknown as {__tr63: {samples: number, reveal: boolean, band: boolean, bandWhileFlying: boolean, trAtBirth: string | null, trs: Array<string>}};
        w.__tr63 = {samples: 0, reveal: false, band: false, bandWhileFlying: false, trAtBirth: null, trs: []};
        const sample = () => {
          const p = w.__tr63;
          p.samples++;
          if (document.querySelector('.con-reveal, .con-deckdraw') !== null) {
            p.reveal = true;
          }
          const flying = document.querySelectorAll('.con-transfer__chip').length;
          const shown = (document.querySelector('.con-res .con-score__cell--tr .con-score__value')?.textContent ?? '').trim();
          if (p.trs[p.trs.length - 1] !== shown) {
            p.trs.push(shown);
          }
          if (flying > 0 && p.trAtBirth === null) {
            p.trAtBirth = shown;
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
      });
      await answerGateOnScreen(page, request, playerId, 'assembly');
      await answerGateAs(request, seats[1], 'assembly');
      if (process.env.TM_E2E_STORYBOARD === '1') {
        fs.mkdirSync(path.join(OUT, preset.id), {recursive: true});
        for (let frame = 0; frame < 28; frame++) {
          await page.screenshot({path: path.join(OUT, preset.id, `story-enact-${String(frame).padStart(2, '0')}.jpg`), type: 'jpeg', quality: 70});
        }
      }
      await expect.poll(async () => (await wireOf(request, playerId)).game.parliament.rulingParty, {timeout: 60_000}).toBe(UNITY);
      const after = await wireOf(request, playerId);
      expect(after.thisPlayer.terraformRating, 'the server: ONE rating for the change of power').toBe(tr + 1);
      expect(after.thisPlayer.megacredits, 'the Greens (blue\'s by the alliance) answer the rating with their M€').toBe(mc + 2);
      expect(accessOf(after, after.thisPlayer.color, GREENS)?.allied?.[0], 'the Greens by the alliance — Unity rules').toMatchObject({via: UNITY, road: 'ruling'});
      await expect.poll(async () => (await transferWitness(page)).landings.some((l) => l.under === 'rail:tr'), {timeout: 60_000, message: 'the rating token landed'})
        .toBe(true);
      await waitSittingAtRest(page, 30_000);
      await shoot(page, preset.id, '03-enact-after');
      const witness = await transferWitness(page);
      const trail = transferTrail(witness);
      const born = witness.births.find((b) => b.under === `seal:${UNITY}`);
      expect(born, `the rating token is born on Unity's seal:\n${trail}`).toBeDefined();
      expect(born?.value, 'the token reads +1').toBe('+1');
      const landed = witness.landings.find((l) => l.id === born?.id);
      expect(landed?.under, `…and lands on the rating cell:\n${trail}`).toBe('rail:tr');
      expect(endsOverGlass(witness), `no end over glass:\n${trail}`).toEqual([]);
      const probe = await page.evaluate(() => (window as unknown as {__tr63: {samples: number, reveal: boolean, band: boolean, bandWhileFlying: boolean, trAtBirth: string | null, trs: Array<string>}}).__tr63);
      expect(probe.samples, 'the probe ran').toBeGreaterThan(20);
      expect(probe.reveal, 'no reveal and no deck-draw scene over the sitting').toBe(false);
      expect(probe.band, 'the band names the tail of the enactment — the card that answered the change of power').toBe(true);
      expect(probe.bandWhileFlying, '…while the token is in the air').toBe(true);
      expect(probe.trAtBirth, `the rating cell shows the OLD rating while the token flies (seen: ${probe.trs.join(' → ')})`).toBe(String(tr));
      await expect.poll(() => page.locator('.con-res .con-score__cell--tr .con-score__value').first().textContent().then((s) => (s ?? '').trim()), {timeout: 20_000})
        .toBe(String(tr + 1));
      expect(await strandedReports(page)).toEqual([]);
    });
  });
}
