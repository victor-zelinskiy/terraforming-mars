import {expect, test} from './consoleTest';
import {fillPicks, openConsole, pickedCards, press, pressUntil, waitStepDealSettled} from './consoleStart';
import {campaignBase, campaignModelAs, createCampaign, devCommit, launchMission, seedIdentity} from './campaignFixtures';
import {readTransient, recordTransient} from './transientRecorder';
import {NO_PAYMENT, titleOf} from './consoleEndgameHarness';

/**
 * The «ДВЕРЬ» iteration's NEW copy (§19), read in either language: the box's locale bundle is ONE shared copy every
 * session syncs (`~/tm-e2e/repo/assets`), and a session on an older base re-sends its own bundle without these keys —
 * the behaviour is witnessed by the hooks; the RU wording is the i18n audit's (`lint:i18n`) and stands in the locale.
 */
const NEW_COPY = {
  canExecute: /можно исполнить|can execute/i,
  preludeStep: /шаге прологов|prelude step/i,
  projectStep: /шаге проектов|project step/i,
  executeTender: /исполнить тендер|execute the tender/i,
};

/*
 * CAMPAIGN «ТЕНДЕРЫ» — THE FINALE'S START (docs/CAMPAIGN_CONCESSIONS_DESIGN.md §16 · §19): no portfolio step — the dock's
 * «ТЕНДЕРЫ» block is the DOOR (L3) on every page, lit where a tender executes; the list puts this page's tenders first
 * and names the page of every other; a chosen tender STANDS on its page in its mode (the crumb names it, the dock's
 * plate reads what it gives, the deal's layout is untouched) and executes there; the summary warns before the terminal
 * press; the tenders left unexecuted are bought back by the deployment's BUYOUT. A real three-mission tenders campaign
 * fast-forwarded to its finale, Alice holding five tenders granted outright by the dev fixture. Since §20 every tender
 * chosen in the list first stands on its ACTIVATION SHEET (the certificate carried out of the list as the hero, the
 * RESULT in the table's numbers beside it, B back to the list); A on the sheet stamps it and hands the screen to the page,
 * where a deal that grows deals ONLY its new cards (a witness counts every card the deal layer holds):
 *  · the corporation page lights ONE (the restructuring — the lineage is on the dock of every page): two candidates over
 *    the page, a candidate and the lineage corporation it replaces, RT rewrites the lineage;
 *  · the prelude page lights two: «Открытый конкурс» stands in its CONFIRM mode (the deal's boxes unchanged), A deals two
 *    more; «Замена прологов» marks a card, RT exchanges it in its place;
 *  · the project page lights two: «Целевой запрос» names a tag on the dock's plate (the deal's boxes unchanged), RT brings
 *    three cards in; «Субсидия» is left — the summary warns, the buyout pays 3 M€ and the holding reads «выкуплен».
 */

type WirePrompt = {type: string, title: string | {message: string}, options?: Array<WirePrompt>, cards?: Array<{name: string}>, min?: number, max?: number, tenders?: Array<{instance: string, id: string, status: string}>};
/** The wire spells the viewer's money `megacredits` (`ServerModel`) — a camel-cased read is `undefined`, and `undefined >= NaN` is no witness. */
type WireModel = {waitingFor?: WirePrompt, thisPlayer: {megacredits: number}, campaignTenders?: Array<{id: string, status: string}>, campaignLineage?: Array<string>, game: {phase: string}};

const EXPANSIONS = {
  corpera: true, promo: false, venus: false, colonies: false, prelude: true,
  prelude2: false, turmoil: false, community: false, ares: false, moon: false,
  pathfinders: false, ceo: false, starwars: false, underworld: false, deltaProject: false,
};

async function model(request: Parameters<typeof createCampaign>[0], id: string): Promise<WireModel> {
  const res = await request.get(`${campaignBase()}/api/player?id=${id}`);
  expect(res.ok()).toBeTruthy();
  return res.json();
}

/** The cards of ONE selection step, found by its title (the server's `SELECT_*_TITLE` — «Select 2 Prelude cards»). */
function stepCards(m: WireModel, title: RegExp): Array<string> {
  const step = (m.waitingFor?.options ?? []).find((o) => title.test(titleOf(o as never)));
  return (step?.cards ?? []).map((c) => c.name);
}

/** The harness's generic start answer for a seat that is not on the page (a calm corporation, the minimum of the rest). */
async function finishSelectionOverApi(request: Parameters<typeof createCampaign>[0], id: string): Promise<void> {
  const m = await model(request, id);
  const wf = m.waitingFor;
  expect(wf?.type).toBe('initialCards');
  const responses = (wf?.options ?? []).map((step) => {
    const offered = (step.cards ?? []).map((c) => c.name);
    if (titleOf(step as never).startsWith('Select corporation')) {
      return {type: 'card', cards: [offered[0]]};
    }
    return {type: 'card', cards: offered.slice(0, step.min ?? 0)};
  });
  const res = await request.post(`${campaignBase()}/player/input?id=${id}`, {data: {type: 'initialCards', responses}});
  expect(res.ok(), await res.text()).toBeTruthy();
  void NO_PAYMENT;
}

test.describe('campaign «Тендеры» — the finale\'s start', () => {
  test('THE DOOR (§19): L3 opens the tenders list on the page they change — the ones of THIS page first; a tender stands in its mode ON the page (the deal\'s layout untouched), executes there; the summary warns; the buyout pays exactly 3 M€', async ({page, request}) => {
    test.setTimeout(480_000);
    // NOT test mode: it deals every seat EIGHT corporations and the finale's small deck (base + corpera + prelude, minus
    // the two lineages) is then empty by the time «Реструктуризация» asks for two — «No corporation is left to deal».
    const {id} = await createCampaign(request, {testMode: false, expansions: EXPANSIONS}, {rewardMode: 'tenders', missionCount: 3});
    await launchMission(request, id);
    await devCommit(request, id, [0, 1], {
      lineages: {0: ['Ecoline'], 1: ['Helion']},
      tenders: {0: ['openCall', 'preludeReview', 'restructuring', 'researchSubsidy', 'targetedRequest']},
    });
    await launchMission(request, id);
    // Mission 2's grant is stated too: a fixture with NO `tenders` opens the real bidding and resolves it by the bot's
    // order — seat 0 would win a sixth lot, and the door below counts exactly five.
    await devCommit(request, id, [0, 1], {lineages: {0: ['Ecoline', 'Mining Guild'], 1: ['Helion', 'Saturn Systems']}, tenders: {1: ['gamblePreludes']}});
    const {yourPlayerId: aliceId} = await launchMission(request, id);
    expect(aliceId).toBeTruthy();
    const brunoId = (await campaignModelAs(request, id, 'Bruno')).missions[2]?.yourPlayerId;
    expect(brunoId).toBeTruthy();

    await openConsole(page, aliceId!);
    await page.waitForSelector('.con-start__frame', {timeout: 90_000});
    await waitStepDealSettled(page);
    const bar = () => page.locator('.con-cmdbar').innerText();
    // The head's whole text carries the journey rail too (every step's name) — a STEP is witnessed by the crumb's
    // SUBJECT segment alone; a MODE names its tender in the stage segment.
    const crumb = () => page.locator('.con-wshead').innerText();
    const subject = () => page.locator('.con-wshead__subject').last().innerText();
    const list = page.locator('[data-tender-portfolio]');
    const slot = (kind: string) => page.locator(`[data-tport-slot][data-tport-kind="${kind}"]`);
    const door = page.locator('[data-tender-dock]');
    const plate = page.locator('[data-tender-plate]');
    /**
     * The page's deal as LAID OUT — every slot's layout box (offset geometry: the cursor's lift is a transform on the
     * focused card and moves with the focus, the layout does not). A mode may change NOTHING of it (the owner's law of
     * 2026-11-09: «размер и раскладка карт не должны измениться»).
     */
    const layoutOf = (pool: string) => page.evaluate((p) => Array.from(document.querySelectorAll<HTMLElement>(`[data-step-slot^="${p}|"]`))
      .map((el) => `${el.getAttribute('data-step-slot')}@${el.offsetLeft},${el.offsetTop},${el.offsetWidth}x${el.offsetHeight}`).join(' '), pool);
    /**
     * L3 → the list stands. ONE press, then the state: L3 is the door's TOGGLE, so a re-press while the certificates are
     * still rising would close what the first one opened — a swallowed press is the driver's own retry (the door's
     * motion is on the absorber ledger, `tender-door-motion`), never a second L3 from here.
     */
    const openDoor = async () => {
      await press(page, 'KeyC', 600);
      await expect(list, 'L3 opens the door').toHaveClass(/con-tport--live/, {timeout: 15_000});
    };
    /**
     * ONE OBJECT, ONE TELLER (the owner's point 5, 2026-11-09: «тендеры раздаются на месте, где уже видна ЭТА ЖЕ
     * КАРТА»): every certificate face painted on screen, counted per tender kind, recorded off the product's own writes —
     * a kind painted twice at once in two PLACES (the dock's miniature still standing while its certificate rises, a list
     * slot standing while its proxy is still in the air) is a duplicate. A proxy lying exactly over its own source or
     * landing place is one object to the eye (the take-off / touchdown frame), and a face at a sliver of opacity is not a
     * second card.
     */
    await recordTransient(page, 'tender-twins', () => {
      const places: Record<string, Array<DOMRect>> = {};
      for (const el of Array.from(document.querySelectorAll<HTMLElement>('[data-tender]'))) {
        const r = el.getBoundingClientRect();
        if (r.width < 4 || r.height < 4 || r.right < 0 || r.left > window.innerWidth || r.bottom < 0 || r.top > window.innerHeight) {
          continue;
        }
        let op = 1;
        let hidden = false;
        for (let n: HTMLElement | null = el; n !== null; n = n.parentElement) {
          const cs = window.getComputedStyle(n);
          if (cs.visibility === 'hidden' || cs.display === 'none') {
            hidden = true;
            break;
          }
          op *= Number(cs.opacity);
        }
        if (hidden || op < 0.35) {
          continue;
        }
        const id = el.getAttribute('data-tender') ?? '?';
        const same = (a: DOMRect) => Math.abs((a.left + a.width / 2) - (r.left + r.width / 2)) < Math.max(a.width, r.width) * 0.3 &&
          Math.abs((a.top + a.height / 2) - (r.top + r.height / 2)) < Math.max(a.height, r.height) * 0.3;
        const known = places[id] ?? [];
        if (!known.some(same)) {
          places[id] = [...known, r];
        }
      }
      const dups = Object.entries(places).filter(([, at]) => at.length > 1).map(([id, at]) => `${id}x${at.length}`).sort().join(',');
      if (dups === '') {
        return '';
      }
      const where = Object.entries(places).filter(([, at]) => at.length > 1)
        .map(([k, at]) => `${k}@` + at.map((b) => `${Math.round(b.left)},${Math.round(b.top)},${Math.round(b.width)}`).join('/')).join(' ');
      const sheetId = document.querySelector('[data-tender-sheet]')?.getAttribute('data-tender-sheet-id') ?? '-';
      const live = document.querySelector('[data-tender-portfolio]')?.classList.contains('con-tport--live') ? 'live' : 'idle';
      return `${dups} | sheet=${sheetId} list=${live} | ${where}`;
    });
    const twins = async () => (await readTransient<string>(page, 'tender-twins')).map((x) => x.v).filter((v) => v !== '');
    /** Every card the deal layer held (= dealt) since the recorder was armed — a deal that grows deals its new cards only. */
    await recordTransient(page, 'deal-held', () => Array.from(document.querySelectorAll<HTMLElement>('[data-deal-dealing="yes"][data-step-slot]'))
      .map((el) => (el.getAttribute('data-step-slot') ?? '').split('|')[1] ?? '').sort().join(','));
    let dealMark = 0;
    const markDeal = async () => {
      dealMark = (await readTransient<string>(page, 'deal-held')).length;
    };
    const dealtSinceMark = async () => [...new Set((await readTransient<string>(page, 'deal-held')).slice(dealMark)
      .flatMap((x) => x.v.split(',')).filter((n) => n !== ''))];

    // ── THE CORPORATION page: no portfolio step — the dock's «ТЕНДЕРЫ» block is the door, lit for the ONE tender that
    //    executes here (the restructuring rewrites the lineage the dock carries on every page). ──
    await expect.poll(subject, {timeout: 5_000}).toMatch(/корпорац|слияни/i);
    await expect(list).toBeHidden();
    await expect(page.locator('[data-tender-dock-chip]')).toHaveCount(5);
    await expect(door).toHaveAttribute('data-tender-dock-ready', '1');
    await expect(page.locator('[data-tender-dock-ready-word]')).toContainText(NEW_COPY.canExecute);
    await expect(page.locator('.con-cmdbar .con-cmdbar__cmd--hot', {hasText: /тендеры/i}), 'the door verb is LIT on this page').toHaveCount(1, {timeout: 5_000});
    await expect.poll(bar, {timeout: 5_000, message: 'the lit door never pushes the step forward off the bar'}).toMatch(/след\. шаг/i);
    // The dock's «ТЕНДЕРЫ» block stands on the lineage's chassis — one row of miniature certificates, LEFT of «НАСЛЕДИЕ»
    // (the left stick for the left door), never taller than the lineage block.
    const dockBoxes = await page.evaluate(() => ({
      tenders: document.querySelector('[data-tender-dock]')?.getBoundingClientRect(),
      lineage: document.querySelector('.con-startdock__legacy:not(.con-startdock__tenders):not(.con-startdock__legacy--projects)')?.getBoundingClientRect(),
      cards: document.querySelectorAll('[data-tender-dock-chip] .con-tender').length,
    }));
    expect(dockBoxes.cards, 'every holding is a miniature certificate').toBe(5);
    expect(dockBoxes.tenders!.height, `the tenders block is no taller than the lineage block ${JSON.stringify(dockBoxes)}`).toBeLessThanOrEqual(dockBoxes.lineage!.height * 1.15);
    expect(dockBoxes.tenders!.right, `the tenders block stands LEFT of «НАСЛЕДИЕ» ${JSON.stringify(dockBoxes)}`).toBeLessThanOrEqual(dockBoxes.lineage!.left + 1);

    // ── L3: the LIST — the restructuring FIRST (it executes here), the others after it, each naming its page. ──
    await openDoor();
    await expect.poll(crumb, {timeout: 5_000}).toMatch(/тендеры/i);
    await expect(page.locator('[data-tport-slot]')).toHaveCount(5);
    await expect(page.locator('[data-tport-slot]').first()).toHaveAttribute('data-tport-kind', 'restructuring');
    await expect(slot('restructuring')).toHaveAttribute('data-tport-state', 'ready');
    await expect(slot('openCall')).toHaveAttribute('data-tport-state', 'elsewhere');
    await expect(slot('openCall').locator('[data-tport-reason]')).toContainText(NEW_COPY.preludeStep);
    await expect(slot('targetedRequest').locator('[data-tport-reason]')).toContainText(NEW_COPY.projectStep);
    await page.screenshot({path: 'screenshots/tenders/door-1-corp-list.png'});
    // THE LIST READS AT ONE GLANCE (the owner's point 6): the certificates of another page step back under a scrim (the
    // console strips every `filter`, so a filtered dim never painted), the one of THIS page stands bright; the row is
    // large, and the cursor's ring stands clear of the journey rail above the layer.
    const listLook = await page.evaluate(() => {
      const face = (state: string) => document.querySelector<HTMLElement>(`[data-tport-state="${state}"]:not([data-tport-focused]) > .con-tender`) ??
        document.querySelector<HTMLElement>(`[data-tport-state="${state}"] > .con-tender`);
      const ready = face('ready');
      const other = face('elsewhere');
      const focused = document.querySelector<HTMLElement>('[data-tport-focused="yes"]');
      const rail = document.querySelector<HTMLElement>('.con-start__flowhost');
      return {
        readyScrim: ready === null ? '?' : window.getComputedStyle(ready, '::after').content,
        otherScrim: other === null ? '?' : window.getComputedStyle(other, '::after').backgroundColor,
        w: other?.getBoundingClientRect().width ?? 0,
        vw: window.innerWidth,
        focusTop: focused?.getBoundingClientRect().top ?? 0,
        railBottom: rail?.getBoundingClientRect().bottom ?? 0,
      };
    });
    expect(listLook.readyScrim, `the certificate of THIS page stands bright ${JSON.stringify(listLook)}`).toBe('none');
    expect(listLook.otherScrim, `a certificate of another page steps back under a scrim ${JSON.stringify(listLook)}`).toMatch(/^rgba\(.+, 0\.[3-9]\d*\)$/);
    expect(listLook.w / listLook.vw, `the certificates are large ${JSON.stringify(listLook)}`).toBeGreaterThan(0.12);
    expect(listLook.focusTop, `the cursor's slot stands clear of the journey rail ${JSON.stringify(listLook)}`).toBeGreaterThan(listLook.railBottom + 2);
    expect(await twins(), 'entering the list: no certificate is painted twice at once').toEqual([]);
    // ▶ to a tender of another page: A is DISABLED (never hidden) and the press changes nothing.
    await press(page, 'ArrowRight', 250);
    await expect(page.locator('.con-cmdbar .con-cmdbar__cmd--disabled', {hasText: /исполнить/i}), 'A of another page stands DISABLED').toHaveCount(1, {timeout: 3_000});
    await press(page, 'ArrowLeft', 250);

    // ── THE ACTIVATION SHEET (§20): A on the certificate CARRIES it out of the list onto the sheet's hero seat — one
    //    object (the list lets go, no second copy), the RESULT beside it; B is one level back to the list. ──
    await press(page, 'Enter', 900);
    const sheet = page.locator('[data-tender-sheet]');
    await expect(sheet).toHaveAttribute('data-tender-sheet-id', 'restructuring', {timeout: 10_000});
    await expect(sheet).toHaveAttribute('data-tender-sheet-open', 'yes', {timeout: 10_000});
    await expect(list, 'the list yields the layer to the sheet').toBeHidden();
    await expect(page.locator('[data-tsheet-hero] .con-tender'), 'ONE certificate on the hero seat').toHaveCount(1);
    await expect(page.locator('[data-tport-slot] .con-tender:visible'), 'no copy of it left in the list').toHaveCount(0);
    await expect(sheet.locator('[data-tsheet-row="Your lineage"] [data-tsheet-to]')).toHaveText('2');
    await expect(sheet.locator('.con-tsheet__note[data-tone="warn"]'), 'the irreversible decision is said BEFORE the press').toHaveCount(1);
    await expect.poll(bar, {timeout: 5_000}).toMatch(/сдать кандидатов|deal the candidates/i);
    await page.screenshot({path: 'screenshots/tenders/door-1a-restructure-sheet.png'});
    await press(page, 'Escape', 700);
    await expect(list, 'B — one level back: the list').toHaveClass(/con-tport--live/, {timeout: 10_000});
    await expect(sheet).toHaveCount(0);
    await expect(slot('restructuring'), 'the cursor stands on the certificate the player had chosen').toHaveAttribute('data-tport-focused', 'yes');
    await press(page, 'Enter', 900);
    await expect(sheet).toHaveAttribute('data-tender-sheet-open', 'yes', {timeout: 10_000});

    // ── «Реструктуризация» (§19.7): ONE ROW over THIS page — the lineage first, already MARKED, then the two candidates
    //    off the deck. ONE lineage corporation out, ONE candidate in; RT resolves only a whole lineage; no decline. ──
    await press(page, 'Enter', 900);
    await expect(page.locator('[data-tender-mode="restructure"]')).toHaveCount(1, {timeout: 15_000});
    await expect(sheet, 'the sheet handed the screen over').toHaveCount(0, {timeout: 10_000});
    const lineageCards = page.locator('[data-tender-zone="lineage"] [data-tender-mode-card]');
    await expect(lineageCards, 'the lineage stands in the row').toHaveCount(2);
    await expect(page.locator('[data-tender-zone="lineage"] [data-tender-mode-picked="yes"]'), 'every lineage corporation starts MARKED').toHaveCount(2);
    const offer = page.locator('[data-tender-zone="offer"] [data-tender-mode-card]');
    await expect(offer, 'the candidates come off the deck').toHaveCount(2, {timeout: 15_000});
    await expect(page.locator('.con-restructure__slot--arriving'), 'every candidate has landed').toHaveCount(0, {timeout: 10_000});
    // ONE row: the two groups' card lines stand on one top (the focused card's lift is a transform — it moves with the
    // cursor, the layout does not), the lineage left of the candidates.
    const rowGeometry = await page.evaluate(() => {
      const lines = Array.from(document.querySelectorAll('[data-tender-mode="restructure"] .con-restructure__cards')).map((el) => el.getBoundingClientRect());
      const slots = Array.from(document.querySelectorAll<HTMLElement>('[data-tender-mode="restructure"] [data-tender-mode-card]'));
      return {tops: [...new Set(lines.map((r) => Math.round(r.top)))], lefts: slots.map((el) => Math.round(el.getBoundingClientRect().left))};
    });
    expect(rowGeometry.tops, `ONE row ${JSON.stringify(rowGeometry)}`).toHaveLength(1);
    expect([...rowGeometry.lefts].sort((x, y) => x - y), `the lineage first, the candidates after ${JSON.stringify(rowGeometry)}`).toEqual(rowGeometry.lefts);
    await expect.poll(crumb, {timeout: 5_000}).toMatch(/реструктуризац/i);
    await expect.poll(bar, {timeout: 5_000, message: 'no decline once the cards are drawn — B only folds'}).not.toMatch(/отказаться/i);
    // The lineage KEPT is a whole lineage: RT would resolve it now (2 / 2) — the player swaps instead.
    // A on the focused first lineage card (Ecoline) takes it OUT; a second «out» is refused by name.
    await press(page, 'Enter', 300);
    await expect(page.locator('[data-tender-zone="lineage"] [data-tender-mode-card="Ecoline"]')).not.toHaveAttribute('data-tender-mode-picked', 'yes');
    await press(page, 'ArrowRight', 150);
    await expect.poll(bar, {timeout: 5_000, message: 'a second «out» is refused by name'}).toMatch(/только одна корпорация|only one corporation/i);
    // → the first candidate: A takes it IN; RT resolves the swap.
    await press(page, 'ArrowRight', 150);
    const take = await offer.first().getAttribute('data-tender-mode-card');
    await press(page, 'Enter', 300);
    await expect(offer.first()).toHaveAttribute('data-tender-mode-picked', 'yes');
    await expect(page.locator('[data-tender-mode="restructure"]')).toHaveAttribute('data-restructure-valid', 'yes');
    await page.screenshot({path: 'screenshots/tenders/door-1b-restructure-row.png'});
    await press(page, 'Period', 900);
    await expect.poll(async () => (await model(request, aliceId!)).campaignLineage?.[0], {timeout: 10_000}).toBe(take);
    await expect(page.locator('[data-tender-mode="restructure"]')).toBeHidden({timeout: 10_000});
    await expect(page.locator('[data-tender-dock-chip][data-tender-dock-status="executed"]')).toHaveCount(1);
    await expect(door, 'nothing else executes on the corporation page').toHaveAttribute('data-tender-dock-ready', '0');

    // ── The corporation pick; RT to the preludes. ──
    await waitStepDealSettled(page);
    expect(await pressUntil(page, 'Enter', async () => (await pickedCards(page)).length >= 1, {tries: 8, settleMs: 900}), 'the corporation pick landed').toBe(true);
    expect(await pressUntil(page, 'Period', async () => /пролог/i.test(await subject()), {tries: 4, settleMs: 900}), 'RT to the preludes').toBe(true);
    await waitStepDealSettled(page);
    await expect(door, 'the prelude page lights two').toHaveAttribute('data-tender-dock-ready', '2');

    // ── «Открытый конкурс»: chosen in the list, its SHEET reads the result in the table's numbers («N → N+2»), the
    //    crumb names it; A stamps it and hands the screen to the page: the cards that stand GLIDE to their new places
    //    (never re-dealt), only the two new ones come off the tender deck. ──
    const dealtNames = stepCards(await model(request, aliceId!), /prelude/i);
    const dealt = dealtNames.length;
    expect(dealt, 'a prelude deal stands').toBeGreaterThanOrEqual(2);
    await openDoor();
    await expect(page.locator('[data-tport-slot]').first()).toHaveAttribute('data-tport-kind', 'openCall');
    await expect(page.locator('[data-tport-reading]').first()).toContainText(`${dealt} → ${dealt + 2}`);
    await press(page, 'Enter', 900);
    await expect(sheet).toHaveAttribute('data-tender-sheet-id', 'openCall', {timeout: 8_000});
    await expect(sheet).toHaveAttribute('data-tender-sheet-open', 'yes', {timeout: 8_000});
    await expect.poll(crumb, {timeout: 5_000, message: 'the crumb names the tender'}).toMatch(/открытый конкурс/i);
    const openRow = sheet.locator('[data-tsheet-row="Preludes in the deal"]');
    await expect(openRow.locator('[data-tsheet-from]')).toHaveText(String(dealt));
    await expect(openRow.locator('[data-tsheet-to]')).toHaveText(String(dealt + 2));
    await expect.poll(bar, {timeout: 5_000}).toMatch(NEW_COPY.executeTender);
    await page.screenshot({path: 'screenshots/tenders/door-2-open-call-sheet.png'});
    // A deal that GROWS is witnessed from the press on: every card that stood must never get a deal proxy of its own
    // (a re-deal of a card already on the table — the owner's frames of 2026-11-09), the new ones must.
    await markDeal();
    await press(page, 'Enter', 900);
    await expect.poll(async () => stepCards(await model(request, aliceId!), /prelude/i).length, {timeout: 10_000}).toBe(dealt + 2);
    await expect(sheet, 'the sheet handed the screen to the page').toHaveCount(0, {timeout: 10_000});
    await waitStepDealSettled(page);
    await expect(page.locator(`[data-step-slot^="prelude|"]`)).toHaveCount(dealt + 2);
    const redealt = await dealtSinceMark();
    expect(redealt.filter((n) => dealtNames.includes(n)), `no card already on the table is dealt again (dealt: ${redealt.join(',')})`).toEqual([]);
    expect(redealt.length, 'the witness saw the two new preludes come off the deck (a probe that saw nothing proves nothing)').toBe(2);
    await expect(plate).toHaveCount(0);
    await expect(page.locator('[data-tender-dock-chip][data-tender-dock-status="executed"]')).toHaveCount(2);
    await expect.poll(crumb, {timeout: 5_000}).not.toMatch(/открытый конкурс/i);

    // ── «Замена прологов»: its EXCHANGE mode on the same strip — A marks the focused card to return, RT exchanges the
    //    marked: fresh preludes take THEIR places, every card not marked stays where it lay. ──
    const preludeLayout = await layoutOf('prelude');
    await openDoor();
    await expect(page.locator('[data-tport-slot]').first()).toHaveAttribute('data-tport-kind', 'preludeReview');
    await press(page, 'Enter', 900);
    await expect(sheet).toHaveAttribute('data-tender-sheet-kind', 'review', {timeout: 8_000});
    await expect(sheet).toHaveAttribute('data-tender-sheet-open', 'yes', {timeout: 8_000});
    await expect.poll(bar, {timeout: 5_000, message: 'the sheet hands over to the marking on the deal'}).toMatch(/отметить карты|mark the cards/i);
    await press(page, 'Enter', 900);
    await expect(sheet).toHaveCount(0, {timeout: 10_000});
    await expect(plate).toHaveAttribute('data-tender-plate-id', 'preludeReview', {timeout: 8_000});
    await expect.poll(() => layoutOf('prelude'), {timeout: 5_000, message: 'the page comes back exactly as it was: the marking changes NOTHING of the deal layout'}).toBe(preludeLayout);
    await expect.poll(crumb, {timeout: 8_000, message: 'the prelude page with the exchange standing'}).toMatch(/замена прологов/i);
    await expect.poll(bar, {timeout: 5_000}).toMatch(/заменить карту/i);
    const dealBefore = stepCards(await model(request, aliceId!), /prelude/i);
    await press(page, 'Enter', 400);
    await expect(page.locator('[data-tender-release]')).toHaveCount(1);
    const returned = await page.locator('.con-cards__slot--release').first().getAttribute('data-zoom-slot');
    expect(returned).toBeTruthy();
    await expect.poll(bar, {timeout: 5_000}).toMatch(/заменить отмеченные/i);
    await press(page, 'Period', 900);
    await expect.poll(async () => {
      const deal = stepCards(await model(request, aliceId!), /prelude/i);
      const stayed = dealBefore.filter((n) => n !== returned).every((n) => deal.includes(n));
      return deal.length === dealt + 2 && !deal.includes(returned!) && stayed ? 'exchanged' : `deal=${deal.join(',')}`;
    }, {timeout: 10_000}).toBe('exchanged');
    await expect.poll(crumb, {timeout: 8_000, message: 'the mode ends — the page is the prelude selection again'}).not.toMatch(/замена/i);
    await waitStepDealSettled(page);
    await expect(door, 'nothing left for the prelude page').toHaveAttribute('data-tender-dock-ready', '0');

    // ── Two preludes; RT to the projects. ──
    await fillPicks(page, 2);
    expect((await pickedCards(page)).length, 'two preludes picked on the live step').toBe(2);
    expect(await pressUntil(page, 'Period', async () => /проект/i.test(await subject()), {tries: 4, settleMs: 900}), 'RT to the projects').toBe(true);
    await waitStepDealSettled(page);
    await expect(door, 'the project page lights two').toHaveAttribute('data-tender-dock-ready', '2');

    // ── THE PURCHASE LEDGER (§20.4): the project page says what the buy costs and what is left, in one line. ──
    const ledger = page.locator('[data-purchase-ledger]');
    await expect(ledger, 'the purchase ledger stands on the project page').toBeVisible({timeout: 5_000});
    const ledgerPrice = Number(await ledger.getAttribute('data-purchase-cost'));
    expect(ledgerPrice, 'a starting-hand card\'s price').toBeGreaterThanOrEqual(1);

    // ── «Целевой запрос»: its SHEET names the tag — each medallion with the deck's own count; A names the focused tag,
    //    RT asks: the sheet hands over and three cards with it join the deal (only the new ones off the deck). ──
    const projectNames = stepCards(await model(request, aliceId!), /buy|project/i);
    const projectsBefore = projectNames.length;
    expect(projectsBefore, 'the project deal stands').toBeGreaterThan(0);
    await openDoor();
    await press(page, 'ArrowRight', 250);
    await expect(slot('targetedRequest')).toHaveAttribute('data-tport-focused', 'yes');
    await press(page, 'Enter', 900);
    await expect(sheet).toHaveAttribute('data-tender-sheet-kind', 'tag', {timeout: 10_000});
    await expect(sheet.locator('[data-tender-mode="tag"]')).toHaveCount(1);
    await expect.poll(crumb, {timeout: 5_000}).toMatch(/целевой запрос/i);
    const tags = page.locator('[data-tender-mode="tag"] [data-tender-tag]');
    expect(await tags.count(), 'the printed tags of the table').toBeGreaterThanOrEqual(8);
    const counts = await tags.evaluateAll((els) => els.map((el) => Number(el.getAttribute('data-tender-tag-count'))));
    expect(counts.every((n) => Number.isFinite(n) && n >= 0), `server-counted tags: ${counts.join(',')}`).toBe(true);
    expect(counts[0], 'the first tag (Building) has cards to give').toBeGreaterThanOrEqual(3);
    await expect.poll(bar, {timeout: 5_000}).toMatch(/выбрать эту метку/i);
    await press(page, 'Enter', 300);
    await expect(page.locator('[data-tender-mode="tag"] [data-tender-mode-picked="yes"]')).toHaveCount(1);
    await expect(sheet.locator('[data-tsheet-row="Projects in the deal"] [data-tsheet-to]')).toHaveText(String(projectsBefore + 3));
    await page.screenshot({path: 'screenshots/tenders/door-3-tag-sheet.png'});
    const named = await page.locator('[data-tender-mode="tag"] [data-tender-mode-picked="yes"]').getAttribute('data-tender-tag');
    await markDeal();
    await press(page, 'Period', 900);
    await expect.poll(async () => stepCards(await model(request, aliceId!), /buy|project/i).length, {timeout: 10_000, message: `three ${named} cards joined the deal`}).toBe(projectsBefore + 3);
    await expect(sheet).toHaveCount(0, {timeout: 10_000});
    await waitStepDealSettled(page);
    await expect(page.locator(`[data-step-slot^="projects|"]`)).toHaveCount(projectsBefore + 3);
    const requestDealt = await dealtSinceMark();
    expect(requestDealt.filter((n) => projectNames.includes(n)), `the request deals only its three (dealt: ${requestDealt.join(',')})`).toEqual([]);
    expect(requestDealt.length, 'the three requested cards came off the deck').toBe(3);
    await expect(page.locator('[data-tender-dock-chip][data-tender-dock-status="executed"]')).toHaveCount(4);
    const grown = await page.evaluate(() => {
      const body = document.querySelector('.con-start__body--cards')!.getBoundingClientRect();
      const slots = Array.from(document.querySelectorAll('[data-step-slot^="projects|"]')).map((el) => el.getBoundingClientRect());
      return {bodyTop: body.top, bodyBottom: body.bottom, top: Math.min(...slots.map((r) => r.top)), bottom: Math.max(...slots.map((r) => r.bottom))};
    });
    expect(grown.top, `the grown deal's first row is whole in the body ${JSON.stringify(grown)}`).toBeGreaterThanOrEqual(grown.bodyTop - 1);
    expect(grown.bottom, `the grown deal's last row is whole above the dock ${JSON.stringify(grown)}`).toBeLessThanOrEqual(grown.bodyBottom + 1);
    await page.screenshot({path: 'screenshots/tenders/door-4-request-landed.png'});
    expect(await twins(), 'through every list, sheet and hand-over: no certificate was ever painted twice at once').toEqual([]);

    // ── To the summary: «Субсидия» left; the projects stay empty. ──
    expect(await pressUntil(page, 'Period', async () => await page.locator('.con-start__summary').isVisible(), {tries: 4, settleMs: 1200}), 'RT to the summary').toBe(true);
    await expect(page.locator('[data-summary-tenders]')).toContainText('4/5');

    // ── THE TERMINAL WARNING: «Субсидия» is still open — the first A warns, the second begins. ──
    await finishSelectionOverApi(request, brunoId!);
    await press(page, 'Enter', 700);
    await expect(page.locator('[data-start-tender-warning]')).toBeVisible();
    await expect(page.locator('[data-start-tender-warning]')).toContainText(/Субсидия/i);
    await press(page, 'Enter', 900);
    await page.waitForSelector('[data-tender-compensation]', {timeout: 60_000});
    await expect(page.locator('[data-buyout-card]')).toHaveCount(1);
    await expect(page.locator('[data-tender-compensation-sub]')).toContainText('1 × 3');

    // The deployment is a chain of presses (the base corporation, the merges, the payment…) — walk it with A until the
    // compensation has been paid: the holding reads «выкуплен» and the plate has left. The money is read before EVERY
    // press, so the press that cashed the tender is judged on its own: exactly 3 M€ for the one unexecuted tender.
    let mcBeforePress = (await model(request, aliceId!)).thisPlayer.megacredits;
    for (let i = 0; i < 14; i++) {
      const now = await model(request, aliceId!);
      if ((now.campaignTenders ?? []).some((t) => t.id === 'researchSubsidy' && t.status === 'cashed')) {
        break;
      }
      mcBeforePress = now.thisPlayer.megacredits;
      await press(page, 'Enter', 1100);
    }
    await expect.poll(async () => ((await model(request, aliceId!)).campaignTenders ?? []).find((t) => t.id === 'researchSubsidy')?.status, {timeout: 15_000}).toBe('cashed');
    await expect.poll(() => page.locator('[data-tender-compensation]').count(), {timeout: 10_000}).toBe(0);
    const after = await model(request, aliceId!);
    expect(after.thisPlayer.megacredits - mcBeforePress, 'the Committee paid exactly 3 M€ on the compensation press').toBe(3);
    expect((after.campaignTenders ?? []).filter((t) => t.status === 'executed').map((t) => t.id).sort()).toEqual(['openCall', 'preludeReview', 'restructuring', 'targetedRequest']);
  });
  test('the creator\'s reward dial: «Награды за миссии» heads the rules deck — ◄ ► and A flip titles ↔ tenders, the launch panel names the choice', async ({page}) => {
    test.setTimeout(180_000);
    await seedIdentity(page, 'Alice');
    await page.addInitScript((st) => {
      if (window.localStorage.getItem('tm_last_game_settings') === null) {
        window.localStorage.setItem('tm_last_game_settings', JSON.stringify(st));
      }
    }, {sessionMode: 'campaign', gameMode: 'multiplayer', players: [{name: 'Alice', color: 'blue'}, {name: 'Bruno', color: 'red'}]});
    await page.goto(`${campaignBase()}/?x=1&consoleProfile=tv`);
    await page.waitForSelector('.cm-menu__items', {timeout: 60_000});
    await page.waitForSelector('.boot-loader', {state: 'detached', timeout: 60_000}).catch(() => undefined);
    for (let i = 0; i < 12 && await page.locator('.cm-item--cursor').getAttribute('data-menu-item') !== 'create'; i++) {
      await press(page, 'ArrowDown', 120);
    }
    await press(page, 'Enter', 300);
    await page.waitForSelector('.cm-mode__tile', {timeout: 30_000});
    await press(page, 'Enter', 600);
    await page.waitForSelector('.cm-crew', {timeout: 30_000});
    for (let i = 0; i < 6 && await page.locator('[data-rule-sub="rewardMode"]').count() === 0; i++) {
      await press(page, 'KeyE', 400);
    }
    const dial = page.locator('[data-rule-sub="rewardMode"]');
    await expect(dial).toHaveCount(1, {timeout: 15_000});
    await expect(dial, 'the reward mode HEADS the deck — the cursor lands on it first').toHaveClass(/cm-row--cursor/);
    const value = dial.locator('[data-reward-mode-value]');
    await expect(value).toHaveText(/Титулы/i);
    await press(page, 'ArrowRight', 250);
    await expect(value).toHaveText(/Тендеры/i);
    await expect(dial).toHaveAttribute('data-reward-mode', 'tenders');
    await press(page, 'ArrowRight', 250);
    await expect(value, '◄ ► clamp').toHaveText(/Тендеры/i);
    await press(page, 'Enter', 250);
    await expect(value, 'A cycles').toHaveText(/Титулы/i);
    await press(page, 'Enter', 250);
    await expect(value).toHaveText(/Тендеры/i);
    // The launch panel's route line names the reward beside the length.
    await expect(page.locator('.cm-launch__map-name')).toContainText(/Тендеры/i);

    // ── THE OFFER DIAL (§17.3): under «Тендеры» ONE sub-row follows the mode — how many tenders a bidding deals. The
    //    default is «all but the last»; a two-seat table offers no «all but the last two», so ◄ from the default stays;
    //    ► reaches «every seat»; the sentence prints the table's numbers; the row leaves with the mode. ──
    const offer = page.locator('[data-rule-sub="tenderOffer"]');
    await expect(offer, 'the offer dial stands right under the reward mode').toHaveCount(1);
    const offerValue = offer.locator('[data-tender-offer-value]');
    await expect(offerValue).toHaveText(/кроме последнего/i);
    await expect(offer).toHaveAttribute('data-tender-offer', 'minusOne');
    await expect(offer.locator('.cm-rule__desc'), 'the sentence in the numbers of this table (two seats: two cards, one picker)').toContainText(/2.*1 из 2/);
    await press(page, 'ArrowDown', 250);
    await expect(offer, 'one step down lands on the dial').toHaveClass(/cm-row--cursor/);
    await press(page, 'ArrowLeft', 250);
    await expect(offer, 'no «all but the last two» on a two-seat table').toHaveAttribute('data-tender-offer', 'minusOne');
    await press(page, 'ArrowRight', 250);
    await expect(offerValue).toHaveText(/Каждому месту/i);
    await expect(offer).toHaveAttribute('data-tender-offer', 'all');
    await expect(offer.locator('.cm-rule__desc')).toContainText(/2 из 2/);
    await press(page, 'ArrowUp', 250);
    await press(page, 'Enter', 250);
    await expect(value, 'A on the mode cycles it back to titles').toHaveText(/Титулы/i);
    await expect(offer, 'the dial leaves with the mode').toHaveCount(0);
    await press(page, 'Enter', 250);
    await expect(value).toHaveText(/Тендеры/i);
    await expect(offer, 'and returns with it, its value kept').toHaveAttribute('data-tender-offer', 'all');
  });
});
