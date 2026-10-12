/*
 * THE «RE-ASKED» WITNESS — the client half of the pre-select law
 * (`common/inputs/preselectAddress.ts`, `server/inputs/deferredInputBatch.ts`).
 *
 * A composer collects the player's choices BEFORE the one submit; the batch
 * carries every answer ADDRESSED to the question it was collected for, and the
 * server lands each only on its own prompt. If, after the batch, the prompt
 * standing is one of those very questions again — the same asker, the same
 * kind — the player was asked twice: the one thing a pre-select must never do
 * (the owner's report of 2026-10-11, Sponsored Academies' discard).
 *
 * Nothing renders this. It is a DETECTOR: one `console.warn('RE-ASKED
 * PRE-SELECT …')` per re-asked prompt (in every build — a warn is cheap, and a
 * re-ask is never a legal state), which the e2e harness turns into a red test
 * on EVERY spec (`tests/e2e/consoleTest.ts`, `preselectGuard`). The stranded-
 * prompt detector could never see this class: a re-asked prompt IS served
 * (the hand screen serves a discard), so nothing is stranded.
 *
 * The memory is the answers of the LAST batch, kept until the action is over
 * (the action menu stands again) or another batch replaces it — an
 * interloper answered in between (Olympus Conference in front of the card's
 * own question) does not end it, because the parked answer lands only after.
 *
 * Pure — no Vue, no DOM: the server runner tests it.
 */
import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {isActionMenuTitle} from '@/common/inputs/actionMenuTitles';
import {AddressableInput, PreselectAddress, promptAddressOf, reaskedBy} from '@/common/inputs/preselectAddress';

let pending: ReadonlyArray<PreselectAddress> = [];

/** The marker of the warn the e2e harness listens for — ONE spelling. */
export const REASKED_PRESELECT = 'RE-ASKED PRE-SELECT';

/**
 * A batch was posted: remember the addresses of its answers (the head answers the standing prompt — never a pre-select).
 *
 * Only an answer ADDRESSED with `for` is a pre-select this witness judges. A STAGED tail (`stagedFor` — a cell, a
 * resolution, a colony tile picked before the play) has its own honest re-ask BY DESIGN (the pinned cell changed
 * while parked → «RE-ASKED», `deferredInputBatch.stagedParkStale`) and a multi-tile card's SECOND placement carries
 * the very same address as the staged first (Ice Asteroid's two oceans) — a re-ask by address there is a false alarm.
 */
export function notePreselectBatch(responses: ReadonlyArray<unknown>): void {
  const addresses: Array<PreselectAddress> = [];
  for (const response of responses.slice(1)) {
    if (response === null || typeof response !== 'object') {
      continue;
    }
    const address = (response as {for?: PreselectAddress}).for;
    if (address !== undefined) {
      addresses.push(address);
    }
  }
  pending = addresses;
}

/** Every node of a prompt's tree — an `or` / `and` nests the real question (a discard as one branch of a choice). */
function nodesOf(input: PlayerInputModel): Array<PlayerInputModel> {
  const out: Array<PlayerInputModel> = [input];
  const options = (input as {options?: ReadonlyArray<PlayerInputModel>}).options;
  for (const option of options ?? []) {
    out.push(...nodesOf(option));
  }
  return out;
}

/** The text a re-ask is reported with: the role and the asker, never a title (titles are i18n-mutated). */
function describe(address: PreselectAddress): string {
  const source = address.source;
  const asker = source === undefined ? 'an unnamed asker' :
    source.card ?? source.resolution ?? source.party ?? (typeof source.name === 'string' ? source.name : source.kind);
  return `${address.role} of ${asker}`;
}

/**
 * A view arrived: is its prompt a question the last batch already answered?
 * Returns the reports (and warns each once); the memory ends with the action.
 */
export function checkPreselectReask(waitingFor: PlayerInputModel | undefined): ReadonlyArray<string> {
  if (pending.length === 0 || waitingFor === undefined) {
    return [];
  }
  const title = typeof waitingFor.title === 'string' ? waitingFor.title : undefined;
  if (waitingFor.type === 'or' && isActionMenuTitle(title)) {
    // The action is over: nothing of the batch can be asked any more.
    pending = [];
    return [];
  }
  const reports: Array<string> = [];
  for (const node of nodesOf(waitingFor)) {
    const hit = pending.find((address) => reaskedBy(address, node as unknown as AddressableInput));
    if (hit !== undefined) {
      reports.push(`${REASKED_PRESELECT}: the ${describe(hit)} was answered in the batch and is asked again`);
    }
  }
  if (reports.length > 0) {
    // One report per re-ask: the same view applied twice must not warn twice.
    pending = [];
    for (const report of reports) {
      console.warn(`[console-preselect] ${report}`);
    }
  }
  return reports;
}

/** Test seam / session reset. */
export function resetPreselectWitness(): void {
  pending = [];
}

/*
 * THE «POST-COMMIT CHOICE» WITNESS — the second half of «strictly pre-select» (TR51, the owner's decision of
 * 2026-10-12). RE-ASKED catches a question the batch answered and the server asked again; this one catches a question
 * the composer NEVER collected although its answer was known before the press: after a composer's commit, the next
 * views may not raise a CHOICE (an `or`, a card pick, an amount, a player) whose asker is the committed card itself
 * or a card of the player's own table the commit's forecast named as asking — unless the composer DECLARED it an
 * honest follow-up (a question the preview hands on with its reason: a pick over cards hidden at the press, a question
 * that depends on an answer above it, a follow-up the play composer routes on — `playChoiceMode === 'followup'`).
 * A deck pick («look at the top N») is never a pre-select by construction. One `console.warn('POST-COMMIT CHOICE …')`
 * per commit; the e2e harness turns it red on every spec (`tests/e2e/consoleTest.ts`, `postCommitGuard`).
 */

/** The marker of the warn the e2e harness listens for — ONE spelling. */
export const POST_COMMIT_CHOICE = 'POST-COMMIT CHOICE';

/** A question the composer declared an honest follow-up: its asker and its role (`*` — any role of that asker). */
export type HonestFollowUp = {card: string, role: string};

type CommitWatch = {source: string, askers: ReadonlySet<string>, honest: ReadonlyArray<HonestFollowUp>};

let commitWatch: CommitWatch | undefined;

/** The prompt types that are a CHOICE the player makes (a placement, a payment, a colony door are not this witness's). */
const CHOICE_TYPES: ReadonlySet<string> = new Set(['or', 'card', 'amount', 'player']);

/**
 * A composer committed: watch the next views for a choice of its own card or of its table's askers it did not collect.
 * `askers` — the cards the commit's forecast named as asking (`asks`); `honest` — what the composer handed on, named.
 */
export function armPostCommitWitness(source: string, askers: ReadonlyArray<string>, honest: ReadonlyArray<HonestFollowUp>): void {
  commitWatch = {source, askers: new Set(askers), honest};
}

/**
 * A view arrived: is its prompt a choice the commit should have collected? Returns the reports (and warns once per
 * commit); the watch ends with the action (the action menu stands again).
 */
export function checkPostCommitChoice(waitingFor: PlayerInputModel | undefined): ReadonlyArray<string> {
  const watch = commitWatch;
  if (watch === undefined || waitingFor === undefined) {
    return [];
  }
  const title = typeof waitingFor.title === 'string' ? waitingFor.title : undefined;
  if (waitingFor.type === 'or' && isActionMenuTitle(title)) {
    commitWatch = undefined;
    return [];
  }
  const askers = new Set<string>();
  for (const node of nodesOf(waitingFor)) {
    if (!CHOICE_TYPES.has(node.type) || (node as {deckPickPrompt?: unknown}).deckPickPrompt !== undefined) {
      continue;
    }
    const address = promptAddressOf(node as unknown as AddressableInput);
    const card = address.source?.card;
    if (card === undefined || (card !== watch.source && !watch.askers.has(card))) {
      continue;
    }
    if (watch.honest.some((h) => h.card === card && (h.role === '*' || h.role === address.role))) {
      continue;
    }
    askers.add(`${address.role} of ${card}`);
  }
  if (askers.size === 0) {
    return [];
  }
  commitWatch = undefined;
  const reports = [...askers].map((a) => `${POST_COMMIT_CHOICE}: the ${a} is asked after the commit — its answer was known before the press`);
  for (const report of reports) {
    console.warn(`[console-preselect] ${report}`);
  }
  return reports;
}

/** Test seam / session reset. */
export function resetPostCommitWitness(): void {
  commitWatch = undefined;
}
