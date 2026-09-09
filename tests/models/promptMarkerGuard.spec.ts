import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

/*
 * PROMPT-MARKER GUARD — the standing worklist of docs/PROMPT_PREMIUM_AUDIT.md.
 *
 * The console routes a prompt to its premium surface off STRUCTURAL markers
 * (`choiceContext` and its siblings — cross-cutting invariant 1 forbids title
 * detection). An unmarked top-level `OrOptions` therefore falls into the
 * generic two-step list with no source dock — exactly the «legacy modal»
 * class waves 1–4 of the premium-prompt plan emptied. This guard keeps the
 * corpus empty: a NEW producer of an unmarked prompt fails HERE, by file name,
 * until it either attaches a marker (`inputs/choiceContext.ts` builders — for
 * a card that is one co-located line) or is allow-listed with a written
 * reason.
 *
 * FILE granularity, on purpose. One marked construction vouches for its file:
 * the guard is a RATCHET against new anonymous producers (a brand-new card
 * file with a naked OrOptions fails immediately), not a per-occurrence proof —
 * that would need AST work whose maintenance cost is the thing that kills
 * guards. The per-shape behaviour stays pinned by the focused specs
 * (`promptCause.spec.ts`, the card specs, `AresAdjacencyGrants.spec.ts`).
 *
 * SCOPE = the fork's premium modules. The frontier (turmoil, moon,
 * pathfinders, underworld, community, …) enters via
 * `docs/claude/expansion-adaptation-checklist.md` — widening `SCAN_ROOTS`
 * (and emptying the turmoil allow-list rows below) is that checklist's step,
 * like every other coverage guard's SCOPE set.
 */

const SERVER_ROOT = path.join(__dirname, '..', '..', 'src', 'server');

/** Premium-scope directories whose files can build player prompts. */
const SCAN_ROOTS: ReadonlyArray<string> = [
  'cards/base', 'cards/corporation', 'cards/promo', 'cards/venusNext',
  'cards/colonies', 'cards/prelude', 'cards/ares', 'cards/delta',
  'deferredActions', 'colonies', 'ares', 'behavior', 'automa', 'venusNext',
  'inputs',
];

/**
 * Evidence that a file attaches SOME structural marker to what it builds.
 * The chainable `mark*` family plus the two field-assignment shapes that
 * predate it (`SelectSpace.placementContext`, set by the mars helper and
 * `BuildColony`).
 */
const MARKER_EVIDENCE: ReadonlyArray<string> = [
  'markChoiceContext(',
  'markVenusBonusPrompt(',
  'markSpendHeatPrompt(',
  'markBotAttackPrompt(',
  'markDeckPickPrompt(',
  'markDiscardPrompt(',
  'markStartGamePrompt(',
  'markAwardFundingPrompt(',
  'markExternalDrawPrompt(',
  'markPlacementContext(',
  'markResourceGainPrompt(',
  '.placementContext =',
];

/**
 * Files allowed to build an `OrOptions` with no marker — each with the reason
 * it is exempt. A row here is a DEBT with a name, never a shrug.
 */
const OR_OPTIONS_ALLOWLIST: Readonly<Record<string, string>> = {
  // The Hydronetwork workspace OWNS these cards' prompts (the deltaBonus
  // family + the release funnel's ownership terms) — a choiceContext there
  // risks a second surface over a dedicated one. Revisit only WITH that
  // family's own review (PROMPT_PREMIUM_AUDIT § C, the delta carve-out).
  'cards/delta/ModularFloodgates.ts': 'Hydronetwork-owned prompts — deliberate carve-out',
  'cards/delta/StormSurgeBarrier.ts': 'Hydronetwork-owned prompts — deliberate carve-out',
  // Turmoil-only callers living in the shared directory — frontier; adapt
  // with the expansion (empty these rows in that checklist).
  'deferredActions/ChooseAlliedParty.ts': 'turmoil-only — frontier',
  'deferredActions/ChoosePolicyBonus.ts': 'turmoil-only — frontier',
  'deferredActions/ChoosePoliticalAgenda.ts': 'turmoil-only — frontier',
  'deferredActions/CorrosiveRainDeferredAction.ts': 'turmoil global event — frontier',
};

/** The same contract for the two Select shapes the audit swept. */
const SELECT_TARGET_ALLOWLIST: Readonly<Record<string, string>> = {
  // The add-a-tile catalog: `SelectColony.purpose = addNewColonyToGame` IS its
  // structural marker, and the colonies section serves it natively.
  'colonies/ColoniesHandler.ts': 'SelectColony.purpose is the structural marker; section-served',
};

type Violation = {file: string, reason: string};

function walk(dir: string, out: Array<string>): void {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      out.push(full);
    }
  }
}

function scanFiles(): Array<{rel: string, content: string}> {
  const files: Array<string> = [];
  for (const root of SCAN_ROOTS) {
    walk(path.join(SERVER_ROOT, root), files);
  }
  return files.map((full) => ({
    rel: path.relative(SERVER_ROOT, full).replace(/\\/g, '/'),
    content: fs.readFileSync(full, 'utf8'),
  }));
}

function hasMarker(content: string): boolean {
  return MARKER_EVIDENCE.some((m) => content.includes(m));
}

function report(violations: Array<Violation>, fix: string): string {
  return 'Unmarked prompt producers:\n' +
    violations.map((v) => `  ${v.file} — ${v.reason}`).join('\n') +
    `\n${fix}\nSee docs/PROMPT_PREMIUM_AUDIT.md (the premium prompt standard).`;
}

describe('prompt-marker guard — every in-scope prompt producer declares itself', () => {
  const files = scanFiles();

  it('a file building an OrOptions carries a structural marker (or a named exemption)', () => {
    const violations: Array<Violation> = [];
    for (const f of files) {
      if (!f.content.includes('new OrOptions(')) {
        continue;
      }
      if (hasMarker(f.content) || OR_OPTIONS_ALLOWLIST[f.rel] !== undefined) {
        continue;
      }
      violations.push({file: f.rel, reason: 'builds `new OrOptions(` with no structural marker'});
    }
    expect(violations, report(violations,
      'Attach `.markChoiceContext(…)` (co-located builders: src/server/inputs/choiceContext.ts) ' +
      'or add an OR_OPTIONS_ALLOWLIST row with the reason.')).to.be.empty;
  });

  it('a file building a SelectPlayer / SelectColony carries a structural marker (or a named exemption)', () => {
    const violations: Array<Violation> = [];
    for (const f of files) {
      const builds = f.content.includes('new SelectPlayer(') || f.content.includes('new SelectColony(');
      if (!builds) {
        continue;
      }
      if (hasMarker(f.content) || SELECT_TARGET_ALLOWLIST[f.rel] !== undefined) {
        continue;
      }
      violations.push({file: f.rel, reason: 'builds a player/colony target pick with no structural marker'});
    }
    expect(violations, report(violations,
      'Attach `.markChoiceContext(…)` (attackEffect / cardEffect / systemChoice — ' +
      'src/server/inputs/choiceContext.ts) or add a SELECT_TARGET_ALLOWLIST row with the reason.')).to.be.empty;
  });

  it('every allow-list row is still earned (no stale exemptions)', () => {
    const stale: Array<string> = [];
    const check = (list: Readonly<Record<string, string>>, needle: (c: string) => boolean) => {
      for (const rel of Object.keys(list)) {
        const f = files.find((x) => x.rel === rel);
        if (f === undefined) {
          stale.push(`${rel} — file no longer exists`);
        } else if (!needle(f.content)) {
          stale.push(`${rel} — no longer builds the exempted prompt shape`);
        } else if (hasMarker(f.content)) {
          stale.push(`${rel} — now carries a marker; the exemption is dead weight`);
        }
      }
    };
    check(OR_OPTIONS_ALLOWLIST, (c) => c.includes('new OrOptions('));
    check(SELECT_TARGET_ALLOWLIST, (c) => c.includes('new SelectPlayer(') || c.includes('new SelectColony('));
    expect(stale, 'Stale allow-list rows (remove them):\n  ' + stale.join('\n  ')).to.be.empty;
  });

  // The scan must never silently shrink: if a root vanishes in a refactor the
  // guard would pass vacuously over the moved files. A floor on the corpus
  // (well below today's ~700) fails loudly instead.
  it('anti-vacuous: the scan still reads the corpus', () => {
    expect(files.length).to.be.greaterThan(400);
    expect(files.filter((f) => f.content.includes('new OrOptions(')).length).to.be.greaterThan(30);
  });
});
