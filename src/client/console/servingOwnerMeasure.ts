/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE MEASURE OF THE ONE FUNCTION (FREEZE ZERO, stage 2, step ① — docs/claude/console/freeze-zero/PLAN.md § 8).
 *
 * `servingOwnerOf` names ONE owner for every question. Before a single surface is DERIVED from it, it has to agree
 * with what the shell shows today on every settled look of every table — and where it does not, that is either a bug
 * of the function or an ambiguity of today's shell (two copies of one condition apart), and each is read. This module
 * is the counter: once a second, beside the screen shadow's own verdict (the leak detector's pass — the same probe of
 * what PAINTS), the function's answer is compared with the screen.
 *
 * STATS ONLY. It prints nothing, changes nothing and judges nothing: no line, no hold, no cure — a wrong function is
 * not a defect of the game. Read through `window.__conServingOwner()` (the monkey's harvest sums it per table).
 */
import {sessionState} from '@/client/console/session/consoleSession';
import type {ScreenOwner} from '@/client/console/screenDirector';
import {Ownership} from '@/client/console/servingOwner';

/**
 * How one look read:
 *   · `agree`            — the function says X serves, and X paints;
 *   · `held:<kind>`      — the function names a hold, and X does not paint (it waits, as said);
 *   · `MISS:<shadow>`    — the function says X serves and X does NOT paint; `<shadow>` is what the screen shadow made
 *                          of the same look (`held` · `beat` · `unserved` · `misserved` · `agree` on another owner) —
 *                          a hold the function's facts do not know yet, or a strand;
 *   · `EXTRA:<kind>`     — the function names a hold and X paints all the same (a presence the facts do not explain);
 *   · `unsettled`        — the FIRST look of a disagreement: a surface mounts and leaves across a look (a door opening,
 *                          a leave in flight), and a look that falls into it is no settled look. The same disagreement
 *                          on the very next look is counted as what it is.
 */
export type OwnerLookVerdict = string;

export type ServingOwnerLog = {
  looks: number,
  /** shape → verdict → count. */
  rows: Record<string, Record<OwnerLookVerdict, number>>,
  /** The last disagreements, each ONCE per (shape, verdict, owner, what painted) — newest last. */
  disagreements: Array<{shape: string, verdict: OwnerLookVerdict, owner: string, host: string, hold: string, present: ReadonlyArray<string>, shadow: string, facts: string}>,
};

const MAX_DISAGREEMENTS = 60;

export const servingOwnerLog: ServingOwnerLog = {looks: 0, rows: {}, disagreements: []};

/** The disagreement the last look read (its picture) — a second look of the same picture in a row is SETTLED. */
let unsettledPicture = '';
/** The rung of the pad's ladder that took the press in flight (`notePadRung` — the pad's measure, below). */
let padRung = '';
/** WHO SERVES RIGHT NOW, as the function reads the shell's facts — supplied by the shell's wiring while it stands. */
type OwnerNow = {shape: string, ownership: Ownership, facts: () => string};
let ownerNowProbe: (() => OwnerNow) | undefined;

export function resetServingOwnerLog(): void {
  servingOwnerLog.looks = 0;
  servingOwnerLog.rows = {};
  servingOwnerLog.disagreements = [];
  unsettledPicture = '';
  padRung = '';
  ownerNowProbe = undefined;
}

// (Evidence of ONE game screen: a new session starts its own count — the harvest reads it before the screen leaves.)
sessionState('serving-owner-measure', resetServingOwnerLog, 960);

/** PURE: how the function's answer reads against what paints (`shadow` — the screen shadow's verdict of the same look). */
export function ownerLookVerdict(ownership: Ownership, present: ReadonlyArray<ScreenOwner>, shadow: string): OwnerLookVerdict {
  if (!ownership.asked) {
    return 'free';
  }
  // A STEP IN A FLOW's ZONE is seen by the probe as its HOST (the step's own surface is teleported inside the host's
  // root): where the shadow itself reads the look as served (`agree:…`), the host painting is the step served. (The
  // first measure in a real browser, CI `fz3` · `reload`, 2026-11-19: «says draw@parliament, painted parliament» was
  // no disagreement.) Under a beat or a hold of the shadow's the host standing proves nothing of the step — and
  // under a hold of the FUNCTION's neither: a step held for its host's own beat is held while that host paints.
  const paints = present.includes(ownership.owner);
  if (ownership.hold === undefined) {
    const hostServes = ownership.host !== undefined && shadow.startsWith('agree') && (present as ReadonlyArray<string>).includes(ownership.host);
    return paints || hostServes ? 'agree' : `MISS:${shadow}`;
  }
  // THE BOARD IS ALWAYS THERE: that it paints says nothing of whether it SERVES (a placement the player set aside
  // leaves them on that very board). A held board is held as said — the probe cannot tell otherwise.
  if (ownership.owner === 'board') {
    return `held:${ownership.hold.kind}`;
  }
  return paints ? `EXTRA:${ownership.hold.kind}` : `held:${ownership.hold.kind}`;
}

/** One look of the leak detector's pass: counted; a disagreement is kept once per its own shape. */
export function noteServingOwnerLook(shape: string, ownership: Ownership, present: ReadonlyArray<ScreenOwner>, shadow: string, facts: () => string = () => ''): void {
  const read = ownerLookVerdict(ownership, present, shadow);
  const disagrees = ownership.asked && (read.startsWith('MISS') || read.startsWith('EXTRA'));
  // THE FUNCTION IS HELD TO EVERY SETTLED LOOK — and one look alone is not one: the first look of a disagreement is
  // `unsettled`; the same picture on the next look is the disagreement. (The fifth reading in a real browser, CI
  // `fz0` plain, 2026-11-19: one look of 3408 — the Parliament's door a second from opening.)
  const picture = disagrees ? `${shape}|${read}|${present.join(',')}` : '';
  const verdict = disagrees && picture !== unsettledPicture ? 'unsettled' : read;
  unsettledPicture = picture;
  servingOwnerLog.looks++;
  const row = servingOwnerLog.rows[shape] ?? (servingOwnerLog.rows[shape] = {});
  row[verdict] = (row[verdict] ?? 0) + 1;
  if (!ownership.asked || (!verdict.startsWith('MISS') && !verdict.startsWith('EXTRA'))) {
    return;
  }
  const entry = {
    shape, verdict, owner: ownership.owner, host: ownership.host ?? '', hold: ownership.hold === undefined ? '' : `${ownership.hold.kind}:${ownership.hold.by}`,
    present: [...present], shadow,
    // (THE FACTS THE FUNCTION WAS GIVEN on that look — read only for a picture kept: a disagreement is read by them.)
    facts: facts(),
  };
  const key = JSON.stringify([entry.shape, entry.verdict, entry.owner, entry.host, entry.present]);
  if (servingOwnerLog.disagreements.some((d) => JSON.stringify([d.shape, d.verdict, d.owner, d.host, d.present]) === key)) {
    return;
  }
  servingOwnerLog.disagreements.push(entry);
  if (servingOwnerLog.disagreements.length > MAX_DISAGREEMENTS) {
    servingOwnerLog.disagreements.shift();
  }
}

/*
 * ── THE PAD AGAINST THE FUNCTION (stage 2, step ② — measured before it is wired) ───────────────────────────────────
 *
 * The pad's ladder (`padRouterController.handleIntent` — thirty-odd ordered rungs) decides by itself whose press it
 * is; the function says who SERVES the question. Before the ladder's prompt rungs read the function, every press
 * says which rung took it, and that is compared with the function's owner on the facts as they stood BEFORE the
 * press:
 *   · `pad-agree`           — the function says X serves, and X's rung took the press;
 *   · `pad-held:<kind>`     — the function names a hold (whoever took the press — not judged: a hold has its own rung
 *                              or absorbs);
 *   · `pad-MISS:<rung>`     — the function says X serves and ANOTHER rung took the press: a fact the ladder knows
 *                              and the function does not (the player's own look, a scene) — or the ladder's own drift;
 *   · `pad-look:<rung>`     — a view the PLAYER opened over the question took it (the inspection, a zoom, the wheel);
 *   · `pad-beat:<rung>`     — a beat of the game absorbed it (a cinematic, the settle of a decision just shown);
 *   · `pad-free`            — nothing is asked.
 * Counted under the shape `pad:<question's shape>` in the same log (the walks carry it as they carry the looks); a
 * disagreement is kept once per its picture, with the facts. STATS ONLY — nothing is said, nothing is routed by it.
 */
/** A rung of the pad's ladder took the press (named by the rung itself; the last word wins — the ladder returns there). */
export function notePadRung(rung: string): void {
  padRung = rung;
}

/** A press enters the ladder. */
export function beginPadPress(): void {
  padRung = '';
}

/** The owner's own rungs beyond the generic `section:<kind>` / `sheet:<kind>`. */
const RUNGS_OF_OWNER: Readonly<Record<string, ReadonlyArray<string>>> = {
  'task': ['taskHost'],
  'decision': ['effectDecision'],
  'deck-pick': ['deckPick'],
  'gov-support': ['govSupport'],
  'prod-loss': ['prodLoss'],
  'lanes': ['spendHeat', 'venusBonus'],
  'ares': ['ares'],
  'bot-attack': ['botAttack'],
  'corp-first': ['corpFirst'],
  'draft': ['draft'],
  'start': ['start'],
  'external-draw': ['externalDraw'],
  'endgame': ['endgame'],
  'repeat-pick': ['repeatPick'],
};

/** A view the PLAYER opened over the question — B is one press back to it. */
const LOOK_RUNGS: ReadonlySet<string> = new Set(['info', 'zoom', 'quick', 'journal', 'played', 'botReview', 'confirm', 'colonyFocus', 'toast', 'draftTray']);
/** A beat of the game that owns the moment and absorbs the press (bounded by its own hold). */
const BEAT_RUNGS: ReadonlySet<string> = new Set(['alert', 'handoff', 'cinematic', 'settle', 'stagedBack', 'reveal', 'govScaleFocus', 'announce']);

function rungsOf(owner: string): ReadonlyArray<string> {
  const camel = owner.replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase());
  return [...(RUNGS_OF_OWNER[owner] ?? []), `section:${owner}`, `sheet:${camel}`];
}

/** PURE: how the rung that took a press reads against the function's answer. */
export function padRungVerdict(ownership: Ownership, rung: string): OwnerLookVerdict {
  if (!ownership.asked) {
    return 'pad-free';
  }
  if (ownership.hold !== undefined) {
    return `pad-held:${ownership.hold.kind}`;
  }
  // (A step in a flow's zone is reached through its own rung — or through its host's, which hands it the press.)
  const own = [...rungsOf(ownership.owner), ...(ownership.host !== undefined ? rungsOf(ownership.host) : [])];
  if (own.includes(rung)) {
    return 'pad-agree';
  }
  // THE LADDER'S UPPER HALF IS NOT THE QUESTION's: a view the player opened over it (the inspection, a card's zoom,
  // the wheel, the journal) and a beat that absorbs every press (a cinematic, the settle of a decision just shown)
  // take the pad ABOVE whoever serves — by design, and the function has no word for either. Counted apart: what is
  // left under `pad-MISS` is a press the owner should have had.
  if (LOOK_RUNGS.has(rung)) {
    return `pad-look:${rung}`;
  }
  if (BEAT_RUNGS.has(rung)) {
    return `pad-beat:${rung}`;
  }
  return `pad-MISS:${rung === '' ? 'unnamed' : rung}`;
}

export function registerOwnerNowProbe(probe: (() => OwnerNow) | undefined): void {
  ownerNowProbe = probe;
}

/**
 * ONE PRESS THROUGH THE PAD'S LADDER, MEASURED: the function is asked on the facts as they stand BEFORE the press
 * (the press may answer the question), the ladder routes it, and the rung that took it is read against the answer.
 * A measure never breaks the press it rides.
 */
export function measurePadPress<T>(route: () => T): T {
  let before: OwnerNow | undefined;
  try {
    before = ownerNowProbe?.();
  } catch {
    before = undefined;
  }
  beginPadPress();
  const taken = route();
  if (before !== undefined) {
    try {
      endPadPress(before.shape, before.ownership, before.facts);
    } catch {
      // counted nowhere — the press went where it went
    }
  }
  return taken;
}

/** The press left the ladder: counted; a disagreement is kept once per its picture. */
export function endPadPress(shape: string, ownership: Ownership, facts: () => string = () => ''): void {
  const verdict = padRungVerdict(ownership, padRung);
  const key = `pad:${shape}`;
  const row = servingOwnerLog.rows[key] ?? (servingOwnerLog.rows[key] = {});
  row[verdict] = (row[verdict] ?? 0) + 1;
  if (!ownership.asked || !verdict.startsWith('pad-MISS')) {
    return;
  }
  const entry = {
    shape: key, verdict, owner: ownership.owner, host: ownership.host ?? '', hold: '', present: [padRung === '' ? 'unnamed' : padRung], shadow: 'pad', facts: facts(),
  };
  const picture = JSON.stringify([entry.shape, entry.verdict, entry.owner, entry.host]);
  if (servingOwnerLog.disagreements.some((d) => JSON.stringify([d.shape, d.verdict, d.owner, d.host]) === picture)) {
    return;
  }
  servingOwnerLog.disagreements.push(entry);
  if (servingOwnerLog.disagreements.length > MAX_DISAGREEMENTS) {
    servingOwnerLog.disagreements.shift();
  }
}
