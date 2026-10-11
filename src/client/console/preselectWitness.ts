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
import {AddressableInput, PreselectAddress, answerAddressOf, reaskedBy} from '@/common/inputs/preselectAddress';

let pending: ReadonlyArray<PreselectAddress> = [];

/** The marker of the warn the e2e harness listens for — ONE spelling. */
export const REASKED_PRESELECT = 'RE-ASKED PRE-SELECT';

/** A batch was posted: remember the addresses of its answers (the head answers the standing prompt — never a pre-select). */
export function notePreselectBatch(responses: ReadonlyArray<unknown>): void {
  const addresses: Array<PreselectAddress> = [];
  for (const response of responses.slice(1)) {
    if (response === null || typeof response !== 'object') {
      continue;
    }
    const address = answerAddressOf(response as {type: string, for?: PreselectAddress});
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
