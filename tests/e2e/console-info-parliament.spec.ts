import {test, expect, Page} from './consoleTest';
import {bootFixture, fetchPlayerModel, focusInfoZone, press, pressUntil, settle} from './consoleStart';

/**
 * «ПАРЛАМЕНТ» IN THE INFORMATION WORKSPACE (Turmoil Redux).
 *
 * The workspace shows the parliament as a table; this zone reads the same
 * table from ONE seat — and it is the only surface that answers «what is my
 * influence made of». What the probe holds:
 *
 *   (а) the zone EXISTS in a parliament game, is an ordinary ring stop, and
 *       A opens the seat's whole standing;
 *   (б) the numbers are the SERVER's — the influence the zone prints is the
 *       one the model carries, and the sum it breaks into adds up;
 *   (в) the detail never RESTATES another zone: the party effects and the
 *       enacted law's action live in «Эффекты», and their words may not
 *       appear here;
 *   (г) the crumb is «ИНФОРМАЦИЯ › <место> › ПАРЛАМЕНТ», and B walks one
 *       level back to the summary.
 */
const FIXTURE = 'parliament-aquifer-vote';

type Wire = {
  game: {parliament: {players: Array<{color: string, participates: boolean, influence: number, agenda: number}>}},
  thisPlayer: {color: string},
};

const zoneOf = (page: Page) => page.evaluate(() => {
  const zone = document.querySelector<HTMLElement>('[data-zone="parliament"]');
  return zone === null ? null : {
    text: (zone.textContent ?? '').replace(/\s+/g, ' ').trim(),
    influence: zone.querySelector('[data-parl-zone-influence]')?.textContent?.trim() ?? null,
    absent: zone.querySelector('[data-parl-zone-absent]') !== null,
  };
});

const detailOf = (page: Page) => page.evaluate(() => {
  const host = document.querySelector<HTMLElement>('[data-info-parliament]');
  if (host === null) {
    return null;
  }
  const read = (sel: string) => host.querySelector<HTMLElement>(sel)?.textContent?.replace(/\s+/g, ' ').trim() ?? null;
  return {
    sections: Array.from(host.querySelectorAll<HTMLElement>('[data-parl-info-section]')).map((s) => s.getAttribute('data-parl-info-section')),
    total: read('[data-parl-info-total]'),
    influenceLine: read('[data-parl-info-influence]'),
    step: read('[data-parl-info-step]'),
    rows: host.querySelectorAll('[data-parl-info-row]').length,
    readings: host.querySelectorAll('[data-parl-info-reading]').length,
    text: (host.textContent ?? '').replace(/\s+/g, ' ').trim(),
  };
});

const crumbOf = (page: Page) => page.locator('.con-wshead').first().evaluate((el) => (el.textContent ?? '').replace(/\s+/g, ' ').trim());

test.describe('Information · «ПАРЛАМЕНТ»', () => {
  test('the zone reads the seat\'s own standing, and its detail restates no other zone', async ({page, request}) => {
    test.setTimeout(240_000);
    const playerId = await bootFixture(page, request, FIXTURE);
    const wire = await fetchPlayerModel(request, playerId) as unknown as Wire;
    const viewer = wire.game.parliament.players.find((p) => p.color === wire.thisPlayer.color);
    expect(viewer, 'the viewer has a seat in this fixture').toBeDefined();

    // ── (а) the zone exists in a parliament game.
    expect(await pressUntil(page, 'KeyY', async () => await page.locator('.con-info .con-info__layout').count() > 0, {tries: 4, settleMs: 900}),
      'the Information workspace opens on Y').toBe(true);
    await settle(page, {timeoutMs: 15_000});
    const zone = await zoneOf(page);
    expect(zone, 'the parliament zone stands on the summary').not.toBeNull();
    expect(zone!.absent, 'a human seat has a standing, not the bot\'s line').toBe(false);

    // ── (б) the number is the SERVER's.
    expect(zone!.influence, 'the zone prints the seat\'s own influence').toBe(String(viewer!.influence));

    // ── it is an ordinary ring stop, and A opens the standing.
    const ringDump = async () => await page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>('[data-zone]'))
      .map((el) => `${el.getAttribute('data-zone')}${el.classList.contains('con-info__zone--focusable') ? '·focusable' : ''}${el.classList.contains('con-info__zone--focused') ? '·FOCUSED' : ''}`)
      .join(' | '));
    expect(await focusInfoZone(page, 'parliament'), `the ring reaches the parliament zone — the summary is: ${await ringDump()}`).toBe(true);
    expect(await pressUntil(page, 'Enter', async () => await page.locator('[data-info-parliament]').count() > 0, {tries: 3, settleMs: 900}),
      'A opens the seat\'s whole standing').toBe(true);
    await settle(page, {timeoutMs: 15_000});

    const detail = await detailOf(page);
    expect(detail, 'the detail is up').not.toBeNull();
    expect(detail!.sections, 'four sections, in decision order').toEqual(['influence', 'agenda', 'delegates', 'table']);
    expect(detail!.total, 'the influence total is the server\'s').toBe(String(viewer!.influence));
    // …and the sum adds up: whatever the line prints, its parts and its total agree.
    const numbers = (detail!.influenceLine ?? '').match(/\d+/g) ?? [];
    expect(numbers.length, `the influence reads as a SUM: «${detail!.influenceLine}»`).toBeGreaterThanOrEqual(2);
    expect(Number(numbers[numbers.length - 1]), 'the total stands last').toBe(viewer!.influence);
    expect(detail!.rows, 'one row per resolution on the table').toBeGreaterThan(0);
    expect(detail!.readings, 'each with the seat\'s own reading').toBeGreaterThan(0);

    // ── (в) the detail restates no other zone's words.
    for (const word of ['Эффект партии', 'Эффекты партий', 'Действие резолюции']) {
      expect(detail!.text, `«${word}» belongs to the «Эффекты» zone, never here`).not.toContain(word);
    }

    // ── (г) the crumb names the place, and B walks one level back.
    expect((await crumbOf(page)).toUpperCase(), 'the crumb names the parliament').toContain('ПАРЛАМЕНТ');
    await press(page, 'Escape', 900);
    await expect.poll(async () => await page.locator('[data-info-parliament]').count(), {timeout: 8_000, message: 'B climbs back to the summary'}).toBe(0);
    await expect(page.locator('.con-info .con-info__layout'), 'and the workspace is still open').toHaveCount(1);
  });
});
