import {test, expect, APIRequestContext, Page} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {NO_PAYMENT, fetchPlayerModel, openConsole, seedGameOverApi, sendPlayerInput, soloGameConfig} from './consoleStart';

/**
 * THE BOT ATTACK, END TO END — the bot plays Invasive Species, the player is
 * ANNOUNCED (never interrupted), opens the demand with A, sees who attacked them
 * and with what, reads what the choice costs, and confirms with a second,
 * deliberate press.
 *
 * WHY AN E2E AT ALL (the repo default is a unit spec): three of this feature's
 * claims are claims about PIXELS, and nothing cheaper can settle them —
 *   · the modal is COMPACT and does not read as a second workspace;
 *   · nothing scrolls, clips or overflows at the target TV resolution;
 *   · no raw English survives in a Russian session.
 * The rules, the preview arithmetic and the pad semantics are unit-tested
 * (tests/automa/AutomaBotAttackPrompt.spec.ts + botAttackModel.spec.ts); this
 * file deliberately asserts only what those cannot see.
 *
 * THE SCENARIO IS REAL, not injected. `customBonusCards` (the automa twin of
 * the existing `customProjectCards` dev seam) seats Invasive Species near the
 * top of MarsBot's bonus deck, so it reaches the action deck within the first
 * couple of generations; the human's own microbe cards are played and stocked
 * through the ordinary action menu. Every request below is the one the real
 * client makes.
 */

/** The visual record of the two states a reviewer actually looks at. */
const SHOTS = path.resolve('screenshots', 'bot-attack');

/**
 * TWO candidates, because that is the only composition this modal still has.
 *
 * A lone candidate is no choice at all: the bot takes that cube during its own
 * turn and the loss is presented (the bot-turn card's red band + the journal
 * line), never asked about. The demand becomes a QUESTION only when the victim
 * holds several cards of the SAME cube rate — so the scenario needs a real tie.
 *
 * Both cards score NOTHING per cube (no `resourcesHere` victory points), which
 * makes them rate-0 equals; both are base-game and requirement-free, so the
 * pair is reachable in generation 1. Nitrite Reducing Bacteria enters play
 * already holding 3 microbes; Regolith Eaters needs one activation, and its
 * first one is prompt-free (the «spend 2» branch is not executable at 0, so the
 * card's `or` auto-selects «add 1 microbe»).
 */
const NITRITE = 'Nitrite Reducing Bacteria'; // 11 M€, enters with 3 microbes
const REGOLITH = 'Regolith Eaters'; //          13 M€, one action to stock
const CUBE_CARDS = [NITRITE, REGOLITH];

/** The one that has to be ACTIVATED before it holds a cube (see above). */
const NEEDS_ACTION = REGOLITH;

/**
 * A rich corporation, NAMED: the pair costs 24 M€ to play and the bot flips its
 * bonus card within its first few turns, so «afford both in generation 1» is
 * part of the scenario rather than a happy accident of the deal.
 */
const CORPORATION = 'CrediCor';

/**
 * B02 is the SECOND bonus card on purpose. Setup lifts only the deck's TOP card
 * into the STARTING action deck (and shuffles it among 3 projects), so `['B02']`
 * alone gives it a 1-in-4 chance of being the bot's very first flip — before the
 * human has taken a single action. That was survivable while the scenario needed
 * one stocked card; a TIE needs two, and two cards cannot both hold a cube
 * within the two actions of one turn. With B03 on top, B02 waits in the bonus
 * deck and joins the action deck at the generation-2 Research Phase — by which
 * time the pair has been played and stocked with room to spare.
 */
const CONFIG = soloGameConfig({
  automa: {difficulty: 'normal'},
  customBonusCards: ['B03', 'B02'],
  customProjectCards: CUBE_CARDS,
  customCorporationsList: [CORPORATION],
});

type Wire = {type: string, title?: unknown, options?: Array<Wire>, cards?: Array<{name: string, calculatedCost?: number}>,
  botAttackPrompt?: unknown, min?: number, buttonLabel?: string};
type Model = {waitingFor?: Wire, game: {phase: string, generation: number}};

/** The action menu's branch INDEX for a structurally identified option. */
function branchIndex(menu: Wire, match: (o: Wire) => boolean): number {
  return (menu.options ?? []).findIndex(match);
}

/** Wait until this player is asked something again (the bot's turn is paced
 *  server-side and bounded — this is a wait, never a retry). */
async function awaitPrompt(request: APIRequestContext, id: string, maxMs = 60_000): Promise<Model> {
  const deadline = Date.now() + maxMs;
  let model = await fetchPlayerModel(request, id) as unknown as Model;
  while (model.waitingFor === undefined && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 400));
    model = await fetchPlayerModel(request, id) as unknown as Model;
  }
  return model;
}

/** How this drive is meant to end — the ONE thing the two scenarios differ in. */
type Arrival = {
  /** Cards to play out of hand, in whatever order the menu offers them. */
  play: ReadonlyArray<string>;
  /** The card to ACTIVATE, once ever (see `NEEDS_ACTION`). */
  activate?: string;
  /** True when the scenario the spec came for has arrived. */
  done: (model: Model) => boolean;
  /** What to say if it never does. */
  never: string;
};

/**
 * Drive the game over the API until the scenario arrives.
 *
 * The plan: play the microbe cards while they are still in hand, activate the
 * one that enters empty (ONCE — a second activation would be a real `or` and
 * this drive is not what should be answering it), then pass. Everything else
 * the game asks (the research buy, a stray effect) takes its own minimum.
 */
async function playUntilArrival(request: APIRequestContext, id: string, plan: Arrival): Promise<Model> {
  const played = new Set<string>();
  /** Deliberately NOT cleared per generation — one cube is all a tie needs. */
  const stocked = new Set<string>();
  const trace: Array<string> = [];
  /** Is this `or` the per-turn ACTION MENU, or an effect asking something? */
  const isActionMenu = (menu: Wire): boolean =>
    (menu.options ?? []).some((o) => o.type === 'projectCard' || (o.type === 'option' && o.buttonLabel === 'Pass'));
  for (let round = 0; round < 90; round++) {
    const model = await awaitPrompt(request, id);
    const wf = model.waitingFor;
    trace.push(`g${model.game?.generation}/${model.game?.phase}:${wf?.type ?? 'none'}` +
      (wf?.type === 'or' ? `[${(wf.options ?? []).map((o) => o.type).join(',')}]` : ''));
    if (plan.done(model)) {
      return model;
    }
    expect(wf, `the table never came back (phase ${model.game?.phase}) — ${trace.join(' ')}`).toBeDefined();
    if (wf === undefined) {
      return model;
    }
    // The research buy — take nothing, the hand is already stocked.
    if (wf.type === 'card' && (wf.min ?? 1) === 0) {
      await sendPlayerInput(request, id, {type: 'card', cards: []});
      continue;
    }
    if (wf.type === 'or' && !isActionMenu(wf)) {
      // An EFFECT asking something mid-turn (a card action's own target pick).
      // Take a SKIP branch when one exists — a stray card pick could remove the
      // very cube this scenario is built on.
      const opts = wf.options ?? [];
      const skip = opts.map((o, i) => ({o, i})).reverse().find((e) => e.o.type === 'option');
      const at = skip?.i ?? 0;
      await sendPlayerInput(request, id, {
        type: 'or', index: at,
        response: opts[at]?.type === 'card' ?
          {type: 'card', cards: (opts[at].cards ?? []).slice(0, opts[at].min ?? 1).map((c) => c.name)} :
          {type: 'option'},
      });
      continue;
    }
    if (wf.type !== 'or') {
      // Anything else the game demands: its own minimum, so the drive never
      // stalls on an effect this spec is not about.
      await sendPlayerInput(request, id, wf.type === 'card' ?
        {type: 'card', cards: (wf.cards ?? []).slice(0, wf.min ?? 1).map((c) => c.name)} :
        {type: 'option'});
      continue;
    }

    // ── the ACTION MENU ────────────────────────────────────────────────
    const playIdx = branchIndex(wf, (o) => o.type === 'projectCard');
    const playable = (wf.options?.[playIdx]?.cards ?? []).filter((c) => !played.has(c.name));
    const wanted = playable.find((c) => plan.play.includes(c.name));
    if (playIdx >= 0 && wanted !== undefined) {
      played.add(wanted.name);
      await sendPlayerInput(request, id, {
        type: 'or', index: playIdx,
        response: {type: 'projectCard', card: wanted.name, payment: {...NO_PAYMENT, megacredits: wanted.calculatedCost ?? 0}},
      });
      continue;
    }
    const actionIdx = branchIndex(wf, (o) => o.type === 'card' && (o as {selectBlueCardAction?: boolean}).selectBlueCardAction === true);
    // ONLY the card the plan names, and only ONCE — see `NEEDS_ACTION`.
    const action = (wf.options?.[actionIdx]?.cards ?? [])
      .find((c) => c.name === plan.activate && !stocked.has(c.name));
    if (actionIdx >= 0 && action !== undefined) {
      stocked.add(action.name);
      await sendPlayerInput(request, id, {
        type: 'or', index: actionIdx, response: {type: 'card', cards: [action.name]},
      });
      continue;
    }
    // Nothing left to do this generation — pass, and let the bot act.
    // `buttonLabel` is a plain string the server SETS (never a `Message`), so
    // it is language-independent on the wire.
    const passIdx = branchIndex(wf, (o) => o.type === 'option' && o.buttonLabel === 'Pass');
    expect(passIdx, `the action menu offered no pass: ${JSON.stringify((wf.options ?? []).map((o) => o.type))}`)
      .toBeGreaterThanOrEqual(0);
    await sendPlayerInput(request, id, {type: 'or', index: passIdx, response: {type: 'option'}});
  }
  expect(false, `${plan.never} — ${trace.join(' ')}`).toBeTruthy();
  return await fetchPlayerModel(request, id) as unknown as Model;
}

/**
 * Headless Chromium starves rAF on a static frame, and the band's entrance is
 * a GSAP timeline — without a BeginFrame the tween is built (its `from` state
 * applied) and then never advances, so the panel reads opacity 0 forever. A
 * tiny screenshot is a BeginFrame; the surface then finishes its own arrival.
 */
async function settle(page: Page, ms = 900): Promise<void> {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    await page.screenshot({clip: {x: 0, y: 0, width: 8, height: 8}}).catch(() => {});
    await page.waitForTimeout(120);
  }
}

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(SHOTS, {recursive: true});
  await page.screenshot({path: path.join(SHOTS, `${name}.png`)});
}

/** The modal's own box, and the viewport it stands in. */
async function panelBox(page: Page) {
  return page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>('.con-botattack__panel');
    if (panel === null) {
      return undefined;
    }
    const r = panel.getBoundingClientRect();
    const overflowing = Array.from(panel.querySelectorAll<HTMLElement>('*')).filter((el) => {
      const b = el.getBoundingClientRect();
      return b.width > 0 && b.height > 0 &&
        (b.left < r.left - 1 || b.right > r.right + 1 || b.top < r.top - 1 || b.bottom > r.bottom + 1);
    }).map((el) => el.className);
    // A USER-SCROLLABLE box is the defect. `overflow-x: hidden` cannot be
    // scrolled at all — it is the console's truncation idiom, and it is honest
    // exactly when it SAYS it truncated (`text-overflow: ellipsis`). Without
    // that split the rail's own card name — which declares the ellipsis and is
    // designed to give way so the `current → resulting` reading always fits —
    // reads as a scroller the moment a long localisation lands in it.
    const scrollers = Array.from(document.querySelectorAll<HTMLElement>('.con-botattack *'))
      .filter((el) => {
        if (el.scrollWidth <= el.clientWidth + 1) {
          return false;
        }
        const s = getComputedStyle(el);
        return s.overflowX === 'auto' || s.overflowX === 'scroll' ||
          (s.overflowX === 'hidden' && !s.textOverflow.startsWith('ellipsis'));
      })
      .map((el) => el.className);
    const cs = getComputedStyle(panel);
    return {
      w: r.width, h: r.height,
      vw: window.innerWidth, vh: window.innerHeight,
      rootScrollW: document.documentElement.scrollWidth,
      // A surface that exists but does not PAINT is the failure mode a
      // presence check cannot see (two entrances fighting over one opacity).
      opacity: Number(cs.opacity), visibility: cs.visibility,
      overflowing, scrollers,
    };
  });
}

test.describe('MarsBot attack — the compact mandatory modal', () => {
  test.use({viewport: {width: 3840, height: 2160}, deviceScaleFactor: 1, screen: {width: 3840, height: 2160}});
  test.setTimeout(360_000);

  test('announces, explains, previews the loss and commits on a second press', async ({page, request}) => {
    const created = await request.post('/api/creategame', {data: CONFIG});
    expect(created.ok(), 'the server accepted the automa config').toBeTruthy();
    const {players} = await created.json();
    const id = players[0].id;

    await seedGameOverApi(request, id, {cards: CUBE_CARDS, buy: 2, corporation: CORPORATION});
    const attacked = await playUntilArrival(request, id, {
      play: CUBE_CARDS,
      activate: NEEDS_ACTION,
      done: (m) => m.waitingFor?.botAttackPrompt !== undefined,
      never: 'the bot never raised the attack as a CHOICE',
    });
    expect(attacked.waitingFor?.botAttackPrompt, 'the attack context reached the wire').toBeDefined();
    // A demand with one candidate is answered by the SERVER (the bot simply
    // takes the cube) — reaching the modal at all means the tie is real.
    expect((attacked.waitingFor?.cards ?? []).length,
      'the scenario produced a genuine choice, not an «ОК»').toBeGreaterThan(1);

    await openConsole(page, id);

    // ── (1) IT IS ANNOUNCED, NEVER OPENED OVER THE PLAYER ──────────────
    // A hostile effect arrives during the BOT's turn; the modal must not
    // appear by itself. The mandatory announcement is its door.
    await page.waitForSelector('.con-mandatory', {timeout: 60_000});
    expect(await page.locator('.con-botattack').count(),
      'the modal does not open by itself').toBe(0);

    await page.keyboard.press('Enter');
    await page.waitForSelector('.con-botattack', {timeout: 20_000});
    await settle(page);

    // ── (2) WHO, WITH WHAT, AND WHAT NOW ───────────────────────────────
    const head = await page.evaluate(() => {
      const px = (sel: string): number => {
        const el = document.querySelector(sel);
        return el === null ? 0 : Number(getComputedStyle(el).fontSize.replace('px', ''));
      };
      const text = (sel: string): string => (document.querySelector(sel)?.textContent ?? '').trim();
      return {
        kicker: text('.con-botattack__kicker-word'),
        actor: text('.con-botattack__actor'),
        title: text('.con-botattack__title'),
        ask: text('.con-botattack__ask'),
        limit: text('.con-botattack__limit'),
        askPx: px('.con-botattack__ask'),
        limitPx: px('.con-botattack__limit'),
        // The bot's OWN card face — not a fake project card, and not a text
        // block hidden behind an inspect verb.
        botFace: document.querySelectorAll('.con-botattack__source .mb-face').length,
        botFaceName: text('.con-botattack__source .mb-face__name'),
        botFaceW: document.querySelector('.con-botattack__source .mb-face')?.getBoundingClientRect().width ?? 0,
        // …and the BRIDGE that makes source → target read as one sentence.
        bridge: document.querySelectorAll('.con-botattack__bridge-chip').length,
      };
    });
    await shoot(page, '01-opened');
    // THE ACTOR'S NAME comes from the ONE display-name helper: «Бот» in Russian,
    // never a hardcoded «MarsBot» and never a second hardcoded «Бот».
    expect(head.kicker.toUpperCase(), 'the attack names itself').toContain('АТАКА');
    expect(head.actor, 'the actor wears the helper\'s own label').toContain('Бот');
    expect(head.title, 'the headline names the actor').toContain('Бот');
    expect(head.title, '…and the card it played').toContain('Инвазивные виды');
    expect(head.botFace, 'the SOURCE is the bot\'s own card face').toBe(1);
    expect(head.botFaceName, '…with its localized name').toBe('Инвазивные виды');
    // …and it is REALLY on screen: a face this narrow would be the unreadable
    // text rectangle of the first iteration.
    expect(head.botFaceW, 'the bot card is drawn at a readable size').toBeGreaterThan(240);
    expect(head.bridge, 'the effect visibly travels from it').toBe(1);
    expect(head.ask.length, 'the effect is explained in words').toBeGreaterThan(10);
    expect(head.limit.length, 'and so is the rule that narrowed the targets').toBeGreaterThan(10);
    // TV READABILITY: the instruction is body text and the constraint under it
    // is one step down — never a microscopic disclaimer.
    expect(head.askPx, 'the instruction reads from a couch').toBeGreaterThanOrEqual(38);
    expect(head.limitPx, 'and so does the constraint').toBeGreaterThanOrEqual(34);

    // ── (3) NO RAW ENGLISH in a Russian session ────────────────────────
    const text = await page.locator('.con-botattack').innerText();
    expect(text, 'the legacy English sentence is gone').not.toContain('highest-scoring');
    expect(text).not.toContain('Invasive Species');
    // A Latin RUN of three or more letters would be an untranslated key. Card
    // names are drawn as art; «MarsBot» and «M€» are the fork's own proper
    // nouns and the seat name is the player's own — the only allowances.
    // (`innerText` returns the CSS-transformed text, so the eyebrow arrives
    // uppercased — the comparison is case-insensitive for that reason.)
    const latin = text.replace(/marsbot|m€|consoletester/gi, '').match(/[A-Za-z]{3,}/g) ?? [];
    expect(latin, `untranslated text: ${latin.join(', ')}`).toEqual([]);

    // ── (3b) ONE canonical hint per press ──────────────────────────────
    // The verb the bar publishes on A must not be the commit row's own words,
    // and the retired `L3 Источник` must be gone (the card is on screen).
    const bar = await page.locator('.con-cmdbar').innerText();
    expect(bar).not.toContain('ИСТОЧНИК');
    const barVerbs = bar.split('\n').map((l) => l.trim()).filter((l) => l !== '');
    expect(new Set(barVerbs).size, `the bar repeats a verb: ${barVerbs.join(' | ')}`).toBe(barVerbs.length);

    // ── (4) COMPACT, and no overflow at 4K ─────────────────────────────
    const box = await panelBox(page);
    expect(box, 'the panel is on screen').toBeDefined();
    expect(box!.opacity, 'the panel actually PAINTS').toBeGreaterThan(0.9);
    expect(box!.visibility, '…and is not left hidden by a killed tween').toBe('visible');
    // The panel is CONTENT-SIZED, so its width is a function of the candidate
    // count — and two candidates is this surface's smallest real composition
    // now that a lone one is answered by the server. The claim is «a dialog
    // with board on both sides», not a fixed fraction: a workspace takes the
    // WHOLE band (~0.75 of the viewport here, rail to rail).
    expect(box!.w / box!.vw, 'the modal does not compete with a workspace').toBeLessThan(0.65);
    expect(box!.h / box!.vh, '…nor claim the height of one').toBeLessThan(0.85);
    expect(box!.overflowing, `content sticking out of the panel: ${box!.overflowing.join(' | ')}`).toEqual([]);
    expect(box!.scrollers, `a horizontal scroller appeared: ${box!.scrollers.join(' | ')}`).toEqual([]);
    expect(box!.rootScrollW, 'the page itself never scrolls').toBeLessThanOrEqual(box!.vw);

    // ── (5) NOTHING IS CHOSEN ON OPEN ──────────────────────────────────
    const opened = await page.evaluate(() => {
      const cta = document.querySelector<HTMLElement>('.con-botattack__cta');
      const panel = document.querySelector<HTMLElement>('.con-botattack__panel');
      return {
        locked: document.querySelectorAll('.con-botattack .con-ptsel__slot--locked').length,
        ready: document.querySelectorAll('.con-botattack__cta--ready').length,
        held: document.querySelectorAll('.con-botattack__cta--held').length,
        label: (cta?.textContent ?? '').trim(),
        // The CTA is CONTENT-SIZED — a full-bleed row is the web-form look this
        // iteration removes.
        ctaShare: (cta?.getBoundingClientRect().width ?? 0) / (panel?.getBoundingClientRect().width ?? 1),
      };
    });
    expect(opened.locked, 'the cursor is not a choice').toBe(0);
    expect(opened.ready, 'the commit refuses to arm itself').toBe(0);
    expect(opened.held, 'and says so in the project\'s held state').toBe(1);
    expect(opened.label.length, 'naming what is missing').toBeGreaterThan(0);
    expect(opened.ctaShare, 'the commit is a compact rail, not a form button').toBeLessThan(0.55);

    // ── (6) A SELECTS — and the preview reads было → станет ────────────
    const targets = await page.locator('.con-botattack [data-ptsel-cell]').count();
    expect(targets, 'the real scenario produced a choice of candidates').toBeGreaterThan(1);
    await page.keyboard.press('Enter');
    await settle(page, 600);
    await page.waitForSelector('.con-botattack .con-ptsel__slot--locked', {timeout: 10_000});

    const chosen = await page.evaluate(() => ({
      ready: document.querySelectorAll('.con-botattack__cta--ready').length,
      focused: document.querySelectorAll('.con-botattack__cta--focused').length,
      label: (document.querySelector('.con-botattack__cta-label')?.textContent ?? '').trim(),
      rail: (document.querySelector('.con-botattack .con-ptsel__railimpacts')?.textContent ?? '')
        .replace(/\s+/g, ' ').trim(),
      // …and with SEVERAL candidates the rail leads with the card's own name —
      // it is what says WHICH one is being read.
      railCards: document.querySelectorAll('.con-botattack .con-ptsel__railcard').length,
    }));
    expect(chosen.ready, 'the commit is now live').toBe(1);
    expect(chosen.focused, 'and the cursor moved onto it').toBe(1);
    expect(chosen.label, 'the confirm names the ACT, never «выбрать»').toContain('Удалить');
    expect(chosen.rail, 'the current → resulting reading is on screen').toContain('→');
    expect(chosen.railCards, 'the rail names WHICH candidate is under the cursor').toBe(1);

    await shoot(page, '02-target-chosen');
    // The box did not move when the choice was made (a commit row that grows
    // under the cursor re-lays out the cards above it).
    const afterPick = await panelBox(page);
    expect(afterPick!.overflowing).toEqual([]);

    // ── (7) THE SECOND PRESS COMMITS, and the modal closes ─────────────
    await page.keyboard.press('Enter');
    await settle(page, 1500);
    await page.waitForSelector('.con-botattack', {state: 'detached', timeout: 30_000});
    const after = await fetchPlayerModel(request, id) as unknown as Model;
    expect(after.waitingFor?.botAttackPrompt, 'the demand is answered and gone').toBeUndefined();
  });
});

