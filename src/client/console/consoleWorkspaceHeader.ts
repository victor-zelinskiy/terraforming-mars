/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE WORKSPACE HEADER MODEL — one breadcrumb grammar for every workspace.
 *
 * THE RULE (project NORTH STAR): **stable context comes BEFORE the mutable
 * stage.** The workspace and the object being worked on are the player's
 * anchor for the whole flow; the stage is the only thing that may change.
 *
 *     ДЕЙСТВИЯ КАРТ › СОЮЗ ИЗОБРЕТАТЕЛЕЙ › ПОКУПКА
 *     └── workspace ─┘ └──── subject ────┘ └ stage ┘
 *          fixed            fixed           changes
 *
 * The previous grammar put the stage in the middle and the card LAST
 * («ДЕЙСТВИЯ КАРТ › ПОКУПКА · СОЮЗ ИЗОБРЕТАТЕЛЕЙ»). Two things went wrong
 * with that, and both are structural rather than cosmetic:
 *
 *   1. The segment that changed sat between two that did not, so every phase
 *      re-flowed the line and the eye re-read the whole crumb. It looked like
 *      arriving somewhere else, which is precisely the impression the embedded
 *      flow exists to remove.
 *   2. The answer to «what am I inside of?» arrived last, after the answer to
 *      «what step is this?». The stable fact must be readable first.
 *
 * With the subject fixed in place, the tail is the ONLY thing that animates —
 * so the transition is a word changing, not a header rebuilding.
 *
 * PURE: builds a description; the component renders it. No DOM, no i18n
 * (segments carry i18n KEYS or already-resolved proper names — `translate`
 * says which), so this is unit-testable and reusable by every workspace.
 */

/** One rendered segment of the crumb. */
export type WorkspaceHeaderSegment = {
  /**
   * `root`    — the workspace itself (strongest weight, never changes);
   * `subject` — the object being worked on (a card, a colony, an award);
   * `stage`   — the current step (the ONLY animating segment).
   */
  role: 'root' | 'subject' | 'stage';
  /** i18n key, or a proper name when `translate` is false. */
  text: string;
  /** False for proper nouns already in the player's language (card names are
   *  i18n keys here, so this stays true for them — see `cardSubject`). */
  translate: boolean;
};

export type WorkspaceHeaderModel = {
  segments: ReadonlyArray<WorkspaceHeaderSegment>;
  /**
   * The KEY the stage transition is keyed on. Only this changes between
   * phases, so only the stage segment re-animates — the root and the subject
   * are the same vnodes across the whole flow and cannot move.
   */
  stageKey: string;
  /** The flow has crossed the commit boundary (the header dresses it calmly —
   *  a committed stage is a statement, not an invitation). */
  committed: boolean;
};

export type WorkspaceHeaderInput = {
  /** The workspace's own name (i18n key), e.g. 'Card actions'. */
  root: string;
  /** The object under work — omitted on a browse layer, where there is none. */
  subject?: {text: string, translate?: boolean};
  /** The current step (i18n key) — omitted on the browse layer. */
  stage?: string;
  committed?: boolean;
};

/**
 * Build the crumb. Segments are emitted in READ order, stable-first; absent
 * parts are simply not emitted, so the browse layer is `[root]` and grows to
 * `[root, subject, stage]` as the player descends — the line only ever gains
 * a tail, it never rearranges.
 */
export function buildWorkspaceHeader(input: WorkspaceHeaderInput): WorkspaceHeaderModel {
  const segments: Array<WorkspaceHeaderSegment> = [
    {role: 'root', text: input.root, translate: true},
  ];
  if (input.subject !== undefined && input.subject.text !== '') {
    segments.push({
      role: 'subject',
      text: input.subject.text,
      translate: input.subject.translate !== false,
    });
  }
  if (input.stage !== undefined && input.stage !== '') {
    segments.push({role: 'stage', text: input.stage, translate: true});
  }
  return {
    segments,
    stageKey: input.stage ?? '',
    committed: input.committed === true,
  };
}
