import {test, expect, Page} from './consoleTest';
import {bootFixture, fetchPlayerModel, press, pressUntil, settle} from './consoleStart';
import {openParliament} from './parliamentDrive';

/**
 * ЧУЖИЕ ИСХОДЫ — the vote panel's SUBJECT (Turmoil Redux).
 *
 * The row of seats under the reading answers «who does this card favour» in
 * zero presses; LB/RB then move the SUBJECT of the big reading along that row,
 * so a player can read another seat's honest breakdown without leaving the
 * vote. This spec holds the four things that make that safe:
 *
 *   (а) the subject moves and NAMES ITSELF — the kicker carries the seat's
 *       cube and its display name, and never reads «Для вас» while it stands
 *       on somebody else;
 *   (б) the numbers on screen are THAT SEAT's — the chip in the row and the
 *       block above agree, and both agree with the SERVER's own model;
 *   (в) ◀ ▶ keep the subject (the player compares one seat across the three
 *       proposals) while the card under the reading changes;
 *   (г) A IS ALWAYS THE VIEWER'S DELEGATE: with a rival subject the vote is
 *       still the viewer's own — the server records THEIR cube — and the
 *       reading comes home to them at the commit.
 *
 * Probes are DOM reads and server truth, never rAF.
 */
const FIXTURE = 'parliament-aquifer-vote';

type Wire = {
  game: {parliament: {
    slots: Array<{instance: string, votes: Array<{owner: string}>, viewerVotes: number}>,
    players: Array<{color: string, participates: boolean, influence: number}>,
  }},
  thisPlayer: {color: string},
};

/** The panel's reading, as the player reads it: whose it is, what it says, and what the row shows. */
const panelOf = (page: Page) => page.evaluate(() => {
  const own = document.querySelector<HTMLElement>('[data-parl-info="own"]');
  const kicker = own?.querySelector<HTMLElement>('[data-parl-kicker="reading"]') ?? null;
  const chips = Array.from(document.querySelectorAll<HTMLElement>('[data-parl-vote-ledger-row] [data-ledger-seat]'));
  return {
    subject: own?.getAttribute('data-parl-subject') ?? null,
    rival: own?.classList.contains('con-parl__info-own--rival') === true,
    kicker: (kicker?.textContent ?? '').replace(/\s+/g, ' ').trim(),
    kickerSubject: kicker?.getAttribute('data-parl-kicker-subject') ?? null,
    kickerName: kicker?.querySelector('[data-parl-kicker-name]')?.textContent?.trim() ?? null,
    kickerCubes: kicker?.querySelectorAll('.player-cube').length ?? 0,
    amounts: Array.from(document.querySelectorAll<HTMLElement>('[data-parl-vote-reading] [data-yield-context="estimate"]'))
      .map((el) => el.getAttribute('data-yield-amount')),
    influences: Array.from(document.querySelectorAll<HTMLElement>('[data-parl-vote-reading] [data-yield-context="estimate"]'))
      .map((el) => el.getAttribute('data-yield-influence')),
    marked: chips.filter((chip) => chip.getAttribute('data-ledger-subject') === 'true').map((chip) => chip.getAttribute('data-ledger-seat')),
    chips: chips.map((chip) => ({
      seat: chip.getAttribute('data-ledger-seat'),
      texts: Array.from(chip.querySelectorAll<HTMLElement>('[data-ledger-part] b')).map((b) => (b.textContent ?? '').trim()),
    })),
    // The VOTE half is the viewer's at every subject — its kicker never moves.
    voteKicker: (document.querySelector('[data-parl-kicker="vote"]')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
    cta: (document.querySelector('[data-parl-cta] .con-parl__cta-label')?.textContent ?? '').trim(),
  };
});

/** The selected card's instance — the mode's own witness. */
const selectedOf = (page: Page) => page.locator('.con-parl__slot--selected').getAttribute('data-instance');

async function openVoteMode(page: Page): Promise<void> {
  await openParliament(page);
  expect(await pressUntil(page, 'Enter', async () => await page.locator('.con-parl__vote.con-parl__vote--up').count() > 0, {tries: 4, settleMs: 1200}),
    'the vote mode opens').toBe(true);
  await settle(page, {timeoutMs: 15_000});
}

test.describe('the vote panel · чужие исходы', () => {
  test('LB/RB move the subject, ◀ keeps it, and A still sends the VIEWER\'s delegate', async ({page, request}) => {
    test.setTimeout(240_000);
    const playerId = await bootFixture(page, request, FIXTURE);
    const wire = await fetchPlayerModel(request, playerId) as unknown as Wire;
    const viewer = wire.thisPlayer.color;
    const seats = wire.game.parliament.players.filter((p) => p.participates).map((p) => p.color);
    const rival = seats.find((color) => color !== viewer);
    expect(rival, `the fixture seats somebody besides the viewer: ${seats.join(', ')}`).toBeDefined();

    await openVoteMode(page);

    // ── the mode opens on the VIEWER's own reading, and the row marks it.
    const mine = await panelOf(page);
    expect(mine.subject, 'the mode opens on the viewer').toBe(viewer);
    expect(mine.rival, 'the viewer\'s own block keeps the «mine» register').toBe(false);
    expect(mine.kickerName, 'no name on the viewer\'s own kicker').toBeNull();
    expect(mine.marked, 'the row marks the subject — the viewer').toEqual([viewer]);
    expect(mine.chips.map((c) => c.seat), 'the viewer\'s chip stands first').toEqual([viewer, ...seats.filter((c) => c !== viewer)]);

    // ── (а) RB moves the subject onto the next seat, and it NAMES ITSELF.
    await press(page, 'KeyE', 900);
    const theirs = await panelOf(page);
    expect(theirs.subject, 'RB moves the subject to the next seat').toBe(rival);
    expect(theirs.rival, 'a rival\'s block drops the cyan «mine» register').toBe(true);
    expect(theirs.kickerSubject, 'the kicker names the subject').toBe(rival);
    expect(theirs.kickerCubes, '…with its cube').toBe(1);
    expect(theirs.kickerName, '…and its display name').toBeTruthy();
    expect(theirs.kicker.toLowerCase(), `the kicker never reads «для вас» about a rival: «${theirs.kicker}»`).not.toContain('для вас');
    expect(theirs.marked, 'the row\'s cursor follows').toEqual([rival]);

    // ── (б) the numbers are THAT SEAT's — the block, its chip and the server model agree.
    const rivalSeat = wire.game.parliament.players.find((p) => p.color === rival);
    expect(theirs.influences, `the reading stands at the rival's own influence (${rivalSeat?.influence})`).toEqual([String(rivalSeat?.influence)]);
    expect(theirs.amounts.length, 'the rival\'s reading carries its estimate').toBeGreaterThan(0);
    const rivalChip = theirs.chips.find((c) => c.seat === rival);
    expect(rivalChip?.texts.join(' '), `the chip and the block agree: chip «${rivalChip?.texts.join(' ')}», block ${theirs.amounts.join(',')}`)
      .toContain(String(theirs.amounts[0]));
    // …and they are NOT the viewer's numbers (the two seats sit at different Agenda steps in this fixture).
    expect(theirs.influences, 'a rival\'s reading is not the viewer\'s').not.toEqual(mine.influences);

    // ── the VOTE half never moves with the subject.
    expect(theirs.voteKicker, '«ВАШ ГОЛОС» is the viewer\'s at every subject').toBe(mine.voteKicker);
    expect(theirs.cta, 'the confirm reads the same verb').toBe(mine.cta);

    // ── (в) ◀ ▶ change the CARD and keep the subject.
    const before = await selectedOf(page);
    await press(page, 'ArrowRight', 900);
    const moved = await panelOf(page);
    expect(await selectedOf(page), '◀ ▶ move the selection').not.toBe(before);
    expect(moved.subject, 'the subject survives the card change — one seat across the three proposals').toBe(rival);

    // ── LB walks back to the viewer's own chip (the row is a ring with the viewer at home).
    await press(page, 'KeyQ', 900);
    expect((await panelOf(page)).subject, 'LB steps back to the viewer').toBe(viewer);
    await press(page, 'KeyE', 900);
    expect((await panelOf(page)).subject, 'and RB out again').toBe(rival);

    // ── (г) A WITH A RIVAL SUBJECT SENDS THE VIEWER'S OWN DELEGATE.
    const selected = await selectedOf(page);
    const slotBefore = wire.game.parliament.slots.find((s) => s.instance === selected);
    const minePreviously = slotBefore?.votes.filter((v) => v.owner !== undefined).length ?? 0;
    await press(page, 'Enter', 1500);
    await settle(page, {timeoutMs: 20_000});
    const after = await fetchPlayerModel(request, playerId) as unknown as Wire;
    const slotAfter = after.game.parliament.slots.find((s) => s.instance === selected);
    expect(slotAfter, 'the card the delegate went to').toBeDefined();
    expect(slotAfter!.votes.length, `one delegate more on the selected card (${minePreviously} → ${slotAfter!.votes.length})`)
      .toBe((slotBefore?.votes.length ?? 0) + 1);
    expect(slotAfter!.viewerVotes, 'and it is the VIEWER\'s own — a rival subject is a reading, never a vote')
      .toBe((slotBefore?.viewerVotes ?? 0) + 1);
    // THE COMMIT BOUNDARY BRINGS THE READING HOME. A finished flow LEAVES — the workspace goes back to
    // the board with the vote — so the claim is made where it can be: walking back in starts on the
    // VIEWER, never on the seat the player happened to be reading about when they pressed A.
    await settle(page, {timeoutMs: 20_000});
    await openVoteMode(page);
    const reopened = await panelOf(page);
    expect(reopened.subject, 'a fresh open reads the viewer’s own outcome').toBe(viewer);
    expect(reopened.rival, 'and wears the «mine» register again').toBe(false);
  });
});
