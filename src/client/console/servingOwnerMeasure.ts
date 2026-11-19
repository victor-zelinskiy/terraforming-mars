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

export function resetServingOwnerLog(): void {
  servingOwnerLog.looks = 0;
  servingOwnerLog.rows = {};
  servingOwnerLog.disagreements = [];
  unsettledPicture = '';
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
