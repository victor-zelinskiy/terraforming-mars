#!/bin/sh
# THE SHELL'S MECHANICAL EXTRACTION AS ONE REPRODUCIBLE PIPELINE (architecture v2 — PLAN.md §5 · S2 / S1 / S6).
#
#   sh scripts/shell-extract/pipeline.sh <pristine-ref>        (cwd = the repo root)
#
# <pristine-ref> is a commit whose ConsoleShell.vue is still the MONOLITH (b25f0727ba is the last one). The pipeline
# takes that file and reproduces what the slices committed: the hand preps → every watcher's body delegated to a method
# → the module-level declarations several domains read lifted into shellShared.ts → the 33 domain specs applied in
# order (imports kept whole until the last step) → the post-steps → prune → eslint --fix.
#
# WHY IT IS KEPT. The controllers are ordinary source now — edit them by hand; this is not a build step. It is here for
# ONE case: a change made against the monolith (another branch, another session) that has to be carried over. Re-run
# the pipeline on THAT version of the shell and diff its controllers against the pipeline's output on the pristine ref:
# the difference is the change, already in the controllers' dialect.
set -e
PRISTINE=${1:?usage: pipeline.sh <pristine-ref>}
HERE=scripts/shell-extract
SFC=src/client/components/console/ConsoleShell.vue
ISLANDS="viewer ma info notice wheel cell convert rail journal surface supervisor"
DOMAINS="seat draft finale played staged cardActions stdProjects start hydro parliament colony placement mandatory reveal outcome router playCard handSelect hand workspace commandBar padRouter"
LIFT="SeriesVisit PendingPlayCard PendingClientPayment PendingClientPick CLIENT_PAYMENT_TASK CLIENT_PICK_TASK STAGED_VOTE_RELEASE_MS PARLIAMENT_LEAVE_NET_MS PARLIAMENT_STEP_LEAVE_MS"

git show "$PRISTINE:$SFC" > "$SFC"
rm -f src/client/console/shell/*Controller.ts src/client/console/supervisor/supervisorController.ts src/client/console/shell/shellShared.ts
python "$HERE/s2_prep.py"
python "$HERE/s1_prep.py"
python "$HERE/s6_prep.py"
node scripts/shell-extract.mjs delegate-watchers "$SFC"
node scripts/shell-extract.mjs lift "$SFC" src/client/console/shell/shellShared.ts $LIFT
for spec in $ISLANDS $DOMAINS; do
  SHELL_EXTRACT_KEEP_IMPORTS=1 node scripts/shell-extract.mjs apply "$SFC" "$HERE/specs/$spec.json"
  if [ -f "$HERE/s2_post_$spec.py" ]; then
    python "$HERE/s2_post_$spec.py"
  fi
done
node scripts/shell-extract.mjs prune "$SFC"
npx eslint --fix src/client/console/shell src/client/console/supervisor "$SFC" | tail -15
wc -l "$SFC"
