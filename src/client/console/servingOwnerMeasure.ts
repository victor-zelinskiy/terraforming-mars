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
import {bandRungOf, Ownership} from '@/client/console/servingOwner';

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
/** The branch of the command bar's chain that made the bar on screen (`noteBarRung` — the bar's half, below). */
let barRung = '';
/** The disagreement of the surfaces' own conditions the last look read — the same rule of the settled look. */
let unsettledFlags = '';
/** WHO SERVES RIGHT NOW, as the function reads the shell's facts — supplied by the shell's wiring while it stands.
 *  `bar` — the branch the command bar stands on as the press arrives (the shell reads its own bar first). */
type OwnerNow = {shape: string, ownership: Ownership, facts: () => string, steps?: ReadonlyArray<string>, bar?: string, kind?: string};
let ownerNowProbe: (() => OwnerNow) | undefined;

export function resetServingOwnerLog(): void {
  servingOwnerLog.looks = 0;
  servingOwnerLog.rows = {};
  servingOwnerLog.disagreements = [];
  unsettledPicture = '';
  padRung = '';
  barRung = '';
  bandFallback = '';
  unsettledFlags = '';
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
 *   · `pad-held:<kind>:<who>` — the function names a hold; `<who>` is who took the press under it — `own` (the held
 *                              owner's rung all the same), `look` / `beat` (the ladder's upper half), or the rung by its
 *                              name. Not judged: this is THE MAP the ladder is to be derived from — which rung a hold
 *                              of each kind hands the pad to (a hold has its own rung, or absorbs);
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
  bandFallback = '';
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

/** A view the PLAYER opened over the question — B is one press back to it. (`<view>:open` — the press that OPENS it.) */
const LOOK_RUNGS: ReadonlySet<string> = new Set(['info', 'zoom', 'quick', 'journal', 'played', 'botReview', 'confirm', 'colonyFocus', 'toast', 'draftTray', 'fallback']);
/** …and the views that carry a command strip of THEIR OWN: the bar never stands on them (the card viewer, a toast). */
const OWN_STRIP_RUNGS: ReadonlySet<string> = new Set(['zoom', 'toast']);

function isLookRung(rung: string): boolean {
  return LOOK_RUNGS.has(rung.replace(/:open$/, ''));
}
/** A beat of the game that owns the moment and absorbs the press (bounded by its own hold). */
const BEAT_RUNGS: ReadonlySet<string> = new Set(['alert', 'handoff', 'cinematic', 'settle', 'stagedBack', 'reveal', 'govScaleFocus', 'announce']);

function rungsOf(owner: string): ReadonlyArray<string> {
  const camel = owner.replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase());
  return [...(RUNGS_OF_OWNER[owner] ?? []), `section:${owner}`, `sheet:${camel}`];
}

/** PURE: how the rung that took a press reads against the function's answer. */
export function padRungVerdict(ownership: Ownership, rung: string, steps: ReadonlyArray<string> = []): OwnerLookVerdict {
  if (!ownership.asked) {
    return 'pad-free';
  }
  // (A step in a flow's zone is reached through its own rung — or through its host's, which hands it the press. And a
  // workspace that owns the question hands the pad to the STEPS of its own flow standing above it on the stack: a
  // prelude's colony pick inside the opening is the opening's question, answered on the colonies' screen.)
  const own = [...rungsOf(ownership.owner), ...(ownership.host !== undefined ? rungsOf(ownership.host) : []), ...steps.flatMap((step) => rungsOf(step))];
  if (ownership.hold !== undefined) {
    const who = own.includes(rung) ? 'own' : isLookRung(rung) ? 'look' : BEAT_RUNGS.has(rung) ? 'beat' : rung === '' ? 'unnamed' : rung;
    return `pad-held:${ownership.hold.kind}:${who}`;
  }
  if (own.includes(rung)) {
    return 'pad-agree';
  }
  // THE LADDER'S UPPER HALF IS NOT THE QUESTION's: a view the player opened over it (the inspection, a card's zoom,
  // the wheel, the journal) and a beat that absorbs every press (a cinematic, the settle of a decision just shown)
  // take the pad ABOVE whoever serves — by design, and the function has no word for either. Counted apart: what is
  // left under `pad-MISS` is a press the owner should have had.
  if (isLookRung(rung)) {
    return `pad-look:${rung}`;
  }
  if (BEAT_RUNGS.has(rung)) {
    return `pad-beat:${rung}`;
  }
  return `pad-MISS:${rung === '' ? 'unnamed' : rung}`;
}

/*
 * ── THE BAR AGAINST THE PAD (stage 2 ② — the second copy of the same decision) ─────────────────────────────────────
 *
 * The command bar's chain (`commandBarController.commands` — some sixty ordered branches) decides by itself whose
 * commands the player is SHOWN; the pad's ladder decides whose press it IS. They are two copies of one decision in two
 * orders, and where they part the bar promises a button the pad gives to somebody else. Each branch of the bar names
 * itself in the pad's own vocabulary, and at every press the branch the bar stood on is read against the rung that
 * took the press:
 *   · `bar-agree`               — the bar showed X's commands and X's rung took the press;
 *   · `bar-look:<pad>`          — a view of the PLAYER's took it that the bar is not to stand on: the press OPENED it
 *                                 (`<view>:open`), or it carries a strip of its own (the card viewer, a toast). A
 *                                 view STANDING with the bar on somebody else's commands is APART, like any pair;
 *   · `bar-beat:<bar>><pad>`    — a beat of the game absorbed the press while the bar still stood on X's commands (the
 *                                 bar keeps still through a short beat; a LONG one is a promise the pad does not keep —
 *                                 read by its pairs);
 *   · `bar-APART:<bar>><pad>`   — the bar showed X's commands and ANOTHER rung took the press: the two copies apart.
 * Counted under `bar:<question's shape>`; a pair that parts is kept once, with the facts. STATS ONLY.
 */
/** A branch of the command bar's chain made the bar (named by the branch itself; the last word wins). */
export function noteBarRung(rung: string): void {
  barRung = rung;
}

/** The branch the bar stands on (the shell reads its bar, then asks). */
export function barRungNow(): string {
  return barRung;
}

/** PURE: how the branch the bar stood on reads against the rung that took the press. */
export function barRungVerdict(bar: string, pad: string): OwnerLookVerdict {
  // (THE ANNOUNCE's bar is the section's own bar plus ONE command — A opens the announced question; every other press
  // is the section's, as the bar says.)
  if (bar === pad || (bar === 'announce' && pad.startsWith('section:'))) {
    return 'bar-agree';
  }
  if (pad.endsWith(':open') || OWN_STRIP_RUNGS.has(pad)) {
    return `bar-look:${pad}`;
  }
  const pair = `${bar === '' ? 'unnamed' : bar}>${pad === '' ? 'unnamed' : pad}`;
  return BEAT_RUNGS.has(pad) ? `bar-beat:${pair}` : `bar-APART:${pair}`;
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
      endPadPress(before.shape, before.ownership, before.facts, before.steps);
      if (before.bar !== undefined) {
        endBarPress(before.shape, before.bar, before.ownership, before.facts);
      }
      endBandPress(before.shape, before.ownership, before.steps ?? [], before.kind ?? '', before.facts);
    } catch {
      // counted nowhere — the press went where it went
    }
  }
  return taken;
}

/** The press left the ladder: counted; a disagreement is kept once per its picture. */
export function endPadPress(shape: string, ownership: Ownership, facts: () => string = () => '', steps: ReadonlyArray<string> = []): void {
  const verdict = padRungVerdict(ownership, padRung, steps);
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

/** The same press, read against the bar it was made under: counted; a pair that parts is kept once. */
export function endBarPress(shape: string, bar: string, ownership: Ownership, facts: () => string = () => ''): void {
  const verdict = barRungVerdict(bar, padRung);
  const key = `bar:${shape}`;
  const row = servingOwnerLog.rows[key] ?? (servingOwnerLog.rows[key] = {});
  row[verdict] = (row[verdict] ?? 0) + 1;
  if (!verdict.startsWith('bar-APART')) {
    return;
  }
  const entry = {
    shape: key, verdict, owner: ownership.asked ? ownership.owner : 'nobody', host: ownership.asked ? ownership.host ?? '' : '',
    hold: ownership.asked && ownership.hold !== undefined ? `${ownership.hold.kind}:${ownership.hold.by}` : '',
    present: [padRung === '' ? 'unnamed' : padRung], shadow: 'bar', facts: facts(),
  };
  if (servingOwnerLog.disagreements.some((d) => d.shadow === 'bar' && d.verdict === verdict)) {
    return;
  }
  servingOwnerLog.disagreements.push(entry);
  if (servingOwnerLog.disagreements.length > MAX_DISAGREEMENTS) {
    servingOwnerLog.disagreements.shift();
  }
}

/*
 * ── THE SURFACES' OWN CONDITIONS AGAINST THE FUNCTION (stage 2 ③ — measured before a `v-if` is derived) ───────────
 *
 * Each prompt surface stands by a condition of its own (`govSupportActive`, `effectDecisionActive`, `deckPickServing`,
 * `taskHostOwnsInput`, … — what its `v-if`, its rung of the pad and its branch of the bar read today). Step ③ is to
 * DERIVE them: «the function says X serves» is to be X's whole condition. Before that, on every look, the conditions
 * that are TRUE are read against the function's answer — all of them at once, which the pad's ladder cannot show (it
 * stops at the first):
 *   · `flag-agree`              — the function says X serves and X's condition (its host's, a step's above it) is the
 *                                 one that holds; an owner that stands as a workspace has no such condition and none
 *                                 holds. `flag-agree:two:<a+b>` — a host and its step both (the ladder orders them);
 *   · `flag-held` · `flag-free` — the function names a hold / nothing is asked, and no prompt condition holds;
 *   · `flag-MISS:<owner>`       — the function says X serves and X's condition does NOT hold;
 *   · `flag-EXTRA:<why>:<flags>` — a condition holds that the function gives no surface for: under a hold (`<kind>`),
 *                                 with nothing asked (`free`), or beside the owner (`serves`) — two answers to one
 *                                 question, the class the function is there to end.
 * Counted under `flag:<question's shape>`; the first look of a disagreement is `unsettled`. STATS ONLY.
 */
/** PURE: how the prompt conditions that hold read against the function's answer. */
export function promptFlagsVerdict(ownership: Ownership, flags: ReadonlyArray<string>, steps: ReadonlyArray<string> = []): OwnerLookVerdict {
  if (!ownership.asked) {
    return flags.length === 0 ? 'flag-free' : `flag-EXTRA:free:${flags.join('+')}`;
  }
  if (ownership.hold !== undefined) {
    return flags.length === 0 ? 'flag-held' : `flag-EXTRA:${ownership.hold.kind}:${flags.join('+')}`;
  }
  const own = [ownership.owner, ...(ownership.host !== undefined ? [ownership.host] : []), ...steps].flatMap((who) => RUNGS_OF_OWNER[who] ?? []);
  const other = flags.filter((flag) => !own.includes(flag));
  if (other.length > 0) {
    return `flag-EXTRA:serves:${other.join('+')}`;
  }
  if (flags.length === 0) {
    // (A workspace that owns the question stands by its frame — no prompt condition is its own.)
    return (RUNGS_OF_OWNER[ownership.owner] ?? []).length === 0 ? 'flag-agree' : `flag-MISS:${ownership.owner}`;
  }
  return flags.length === 1 ? 'flag-agree' : `flag-agree:two:${flags.join('+')}`;
}

/** One look: the conditions that hold, counted against the function; a disagreement is kept once per its picture. */
export function notePromptFlagsLook(shape: string, ownership: Ownership, flags: ReadonlyArray<string>, steps: ReadonlyArray<string> = [], facts: () => string = () => ''): void {
  const read = promptFlagsVerdict(ownership, flags, steps);
  const disagrees = read.startsWith('flag-MISS') || read.startsWith('flag-EXTRA');
  const picture = disagrees ? `${shape}|${read}` : '';
  const verdict = disagrees && picture !== unsettledFlags ? 'flag-unsettled' : read;
  unsettledFlags = picture;
  const key = `flag:${shape}`;
  const row = servingOwnerLog.rows[key] ?? (servingOwnerLog.rows[key] = {});
  row[verdict] = (row[verdict] ?? 0) + 1;
  if (!verdict.startsWith('flag-MISS') && !verdict.startsWith('flag-EXTRA')) {
    return;
  }
  if (servingOwnerLog.disagreements.some((d) => d.shadow === 'flag' && d.shape === key && d.verdict === verdict)) {
    return;
  }
  servingOwnerLog.disagreements.push({
    shape: key, verdict, owner: ownership.asked ? ownership.owner : 'nobody', host: ownership.asked ? ownership.host ?? '' : '',
    hold: ownership.asked && ownership.hold !== undefined ? `${ownership.hold.kind}:${ownership.hold.by}` : '',
    present: flags.length === 0 ? ['no condition'] : [...flags], shadow: 'flag', facts: facts(),
  });
  if (servingOwnerLog.disagreements.length > MAX_DISAGREEMENTS) {
    servingOwnerLog.disagreements.shift();
  }
}

/*
 * ── THE BAND, DERIVED — and held against the ladder before it replaces it (stage 2 ②, the last measure) ─────────────
 *
 * `pad-agree` is generous: it takes the owner's rung, its host's, a step's. The switch that is to REPLACE the fifteen
 * ordered `if`s of the ladder's prompt band has to name ONE rung — so it is written here first, as a pure function of
 * the function's answer, and at every press its word is read against the rung the ladder really took:
 *   · `own:<rung>` — a surface with a rung of its own serves (the task host, a composite, a decision, the deck pick,
 *                    the draft, the opening, an external draw): the press is its;
 *   · `step`       — a workspace owns the question and a step of its flow stands above it: the press is that screen's;
 *   · `ws`         — a workspace owns the question and stands itself: the press is its section's / its sheet's;
 *   · `held:<kind>` · `free` — the owner waits, or nothing is asked: the press is the PLAYER's (where they stand).
 * `band-agree` — the ladder took that very rung (for the last four: a section or a sheet); `band-above` — the
 * ladder's upper half took it (a look, a beat — never the band's); `band-APART:<derived>><rung>` — the switch and
 * the ladder would part on this press.
 *
 * SINCE THE SWAP (`padRouterController.promptBandOf`) the band's word CHOOSES the rung among the surfaces that stand;
 * where it names none of them the ladder's old order still routes the press, and says so:
 * `band-fallback:<word>><rung>` — the copy that is left, counted (at zero it is deleted with step ③).
 */
/** The band fell back to the ladder's own order on the press in flight (`noteBandFallback`). */
let bandFallback = '';

/** The band's word named no standing surface and a prompt condition held: the ladder's order routed the press. */
export function noteBandFallback(word: string, rung: string): void {
  bandFallback = `${word}>${rung}`;
}

/** The derived band's word (`servingOwner.bandRungOf` — since the swap it is the ladder's own choice; kept by this name for the readings). */
export const derivedBandRung = bandRungOf;

/** PURE: how the rung the ladder took reads against the derived band's word. */
export function bandRungVerdict(derived: string, rung: string): OwnerLookVerdict {
  if (isLookRung(rung) || BEAT_RUNGS.has(rung)) {
    return 'band-above';
  }
  const agrees = derived.startsWith('own:') ? derived === `own:${rung}` : rung.startsWith('section:') || rung.startsWith('sheet:');
  return agrees ? 'band-agree' : `band-APART:${derived}>${rung === '' ? 'unnamed' : rung}`;
}

/** The same press, read against the derived band: counted; a pair that parts is kept once, with the facts. */
export function endBandPress(shape: string, ownership: Ownership, steps: ReadonlyArray<string>, kind: string, facts: () => string = () => ''): void {
  const verdict = bandFallback !== '' ? `band-fallback:${bandFallback}` : bandRungVerdict(derivedBandRung(ownership, steps, kind), padRung);
  const key = `band:${shape}`;
  const row = servingOwnerLog.rows[key] ?? (servingOwnerLog.rows[key] = {});
  row[verdict] = (row[verdict] ?? 0) + 1;
  if (!verdict.startsWith('band-APART') && !verdict.startsWith('band-fallback')) {
    return;
  }
  if (servingOwnerLog.disagreements.some((d) => d.shadow === 'band' && d.shape === key && d.verdict === verdict)) {
    return;
  }
  servingOwnerLog.disagreements.push({
    shape: key, verdict, owner: ownership.asked ? ownership.owner : 'nobody', host: ownership.asked ? ownership.host ?? '' : '',
    hold: ownership.asked && ownership.hold !== undefined ? `${ownership.hold.kind}:${ownership.hold.by}` : '',
    present: [padRung === '' ? 'unnamed' : padRung], shadow: 'band', facts: facts(),
  });
  if (servingOwnerLog.disagreements.length > MAX_DISAGREEMENTS) {
    servingOwnerLog.disagreements.shift();
  }
}

/*
 * ── THE ANSWER AT ITS LAST REACTIVE EDGE (stage 2 ③ — measured before a cache reads the function) ─────────────────
 *
 * A `v-if` and the command bar are CACHES: derived from the function, they re-evaluate only when a reactive
 * dependency of its facts moves. A fact read from a plain `let` / Set / Map moves the answer with no edge — and the
 * cache keeps the old owner for good (invariant 17: the dead board of 2026-10-30 was exactly this). So before
 * anything is derived, the shell keeps the function's answer as it stood at the LAST reactive edge of its facts (a
 * watcher of its own, flushed with the render), and every look reads a fresh answer beside it:
 *   · `edge-agree`  — the same answer: a cache evaluated since holds the truth;
 *   · `edge-LATCH`  — the answer moved with NO reactive edge; kept once per (shape, was → now), with the facts that
 *                     differ — each names a fact to make reactive before step ③ may read it.
 * Counted under `edge:<question's shape>`. STATS ONLY — nothing is healed and nothing is said.
 */
export function noteOwnerEdgeLook(shape: string, atEdge: {answer: string, facts: string}, now: {answer: string, facts: string}): void {
  const latched = atEdge.answer !== now.answer;
  const key = `edge:${shape}`;
  const row = servingOwnerLog.rows[key] ?? (servingOwnerLog.rows[key] = {});
  const verdict = latched ? 'edge-LATCH' : 'edge-agree';
  row[verdict] = (row[verdict] ?? 0) + 1;
  if (!latched) {
    return;
  }
  if (servingOwnerLog.disagreements.some((d) => d.shadow === 'edge' && d.shape === key && d.owner === now.answer && d.present[0] === atEdge.answer)) {
    return;
  }
  // (Only the facts that differ: `a · b · c` against `a · b' · c` → «b → b'».)
  const was = atEdge.facts.split(' · ');
  const is = now.facts.split(' · ');
  const moved = [...was.filter((part) => !is.includes(part)).map((part) => `− ${part}`), ...is.filter((part) => !was.includes(part)).map((part) => `+ ${part}`)];
  servingOwnerLog.disagreements.push({
    shape: key, verdict, owner: now.answer, host: '', hold: '', present: [atEdge.answer], shadow: 'edge',
    facts: moved.length > 0 ? moved.join(' · ') : 'the facts read the same — the answer moved inside one of them',
  });
  if (servingOwnerLog.disagreements.length > MAX_DISAGREEMENTS) {
    servingOwnerLog.disagreements.shift();
  }
}
