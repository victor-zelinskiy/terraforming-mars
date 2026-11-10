# `scripts/shell-extract/` — how `ConsoleShell.vue` was taken apart

Console architecture v2 (`docs/claude/console/architecture-v2/PLAN.md` §5 · S2, S1, S6). The tool is
`scripts/shell-extract.mjs` (its header is the manual). This folder is the INPUT of the one-time mechanical extraction —
kept so the extraction can be re-run, not because anything here runs in a build.

| File | What it is |
| --- | --- |
| `pipeline.sh <pristine-ref>` | the whole extraction, from the monolith to the 33 controllers (read its header for when you would run it) |
| `s2_prep.py` · `s1_prep.py` · `s6_prep.py` | the hand edits the monolith needed BEFORE the tool could move its members verbatim (a conformance method, a constant two domains read, the supervisor's start / stop as methods, shared module state → `shellFlowState.ts`, the session, the `$refs` answer typed by name, the input gates that register where they are noted) |
| `s2_post_viewer.py` · `s2_post_padRouter.py` | the hand edits AFTER a controller is written: a registration that was a row of the shell's `mounted` becomes the controller's own `onMounted` |
| `specs/<domain>.json` | one spec per controller: its name, its module, its members, the port types the tool could not read off a declaration |
| `cluster.py <graph.json>` | how the members were assigned to domains — seeds by name, then affinity over `shell-extract.mjs graph` (writes `domains.json`) |
| `gen_specs.py` | `domains.json` + `shell-graph.json` (both in this folder) → `specs/*.json` |
| `vue_types_out.mjs` | the one-time codemod that moved the types the shell shares with its SFC children into sibling `<component>Types.ts` modules (already applied — it skips a module that exists) |

**The controllers are ordinary source.** Edit them by hand. Do not regenerate them to make a change — the lifecycle
slices (S5 onward) are hand edits on top of the pipeline's output, and a re-run would drop them.

**The one reason to re-run:** a change made against the monolith that must be carried over (a branch cut before the
extraction). Run the pipeline on the pristine ref into one tree and on that branch's shell into another, and diff the
two sets of controllers: the difference is the change, already in the controllers' dialect.

To take ANOTHER member set out of the shell (or out of a controller that grew too large), you do not need this folder:
`node scripts/shell-extract.mjs report|apply <sfc> <spec.json>` with a spec of your own.
