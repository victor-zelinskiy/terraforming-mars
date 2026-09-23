// What `npm run push` may push over, and what it must refuse — the working tree, classified.
//
// The push rebases and may amend the tip, so anything REAL in the tree (a modified, staged,
// deleted or conflicted tracked file) has to be committed first: an amend sweeps the whole
// index into the tip, and a rebase over local edits either refuses or mixes them in. The
// script never stashes — the tree may hold another session's work.
//
// Three kinds of entry are NOT work, and blocking on them is how a push got stuck with
// nothing to commit:
//   · a PHANTOM — `AD`: added to the index, then deleted from disk. The file exists in
//     neither HEAD nor the working tree; the only thing left is a stale index entry (a
//     temporary file somebody `git add`ed and removed). Committing it would resurrect a file
//     its owner deleted; the honest fix is to drop the entry. Its content stays in git's
//     object store, so the caller prints the blob id for recovery.
//   · a STALE index entry: something IS staged, but the working tree already matches HEAD,
//     so the net change is ZERO — a staged edit the tree has since undone (the classic one:
//     package.json holding an older version than the tip that a previous amend already
//     wrote). There is nothing to commit, and leaving it staged is worse than useless: the
//     version amend sweeps the whole index into the tip, silently committing the stale blob.
//     The caller unstages it (content stays in the object store, blob id printed).
//     Undecidable from a status code alone — the caller passes the set of paths that really
//     differ from HEAD in the tree; without it nothing is reclassified.
//   · UNTRACKED files (`??`): a rebase and an amend never touch them. A rebase that would
//     overwrite one stops on its own, and the script aborts it cleanly.
//
// A CONFLICT is never any of those: an unmerged entry blocks even when the tree happens to
// match HEAD — the merge is still owed a resolution.
//
// Pure: parses `git status --porcelain=v1 -z` output, runs nothing.

/**
 * @typedef {{code: string, path: string}} TreeEntry
 * @typedef {{phantoms: Array<TreeEntry>, stale: Array<TreeEntry>, untracked: Array<TreeEntry>, blocking: Array<TreeEntry>}} TreeVerdict
 */

/**
 * Split `git status --porcelain=v1 -z` into entries. A rename / copy (`R` / `C` in either
 * column) carries its ORIGINAL path as the next NUL-separated field, which belongs to it.
 * @param {string} raw
 * @returns {Array<TreeEntry>}
 */
export function parsePorcelainZ(raw) {
  const fields = raw.split('\0');
  const out = [];
  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    if (field.length < 4) {
      continue;
    }
    const code = field.slice(0, 2);
    out.push({code, path: field.slice(3)});
    if (code.includes('R') || code.includes('C')) {
      i++;
    }
  }
  return out;
}

/** An unmerged entry — `DD`, `AA`, or any `U`. Always real work, whatever the tree holds. */
function isConflict(code) {
  return code.includes('U') || code === 'DD' || code === 'AA';
}

/**
 * @param {Array<TreeEntry>} entries
 * @param {Set<string>|undefined} netChanged paths whose WORKING TREE content really differs
 *   from HEAD (`git diff --name-only HEAD`). Omit when git could not say — then no entry is
 *   ever called stale, which is the safe direction: it only ever refuses a push.
 * @returns {TreeVerdict}
 */
export function classifyTree(entries, netChanged = undefined) {
  const verdict = {phantoms: [], stale: [], untracked: [], blocking: []};
  for (const entry of entries) {
    const staged = entry.code[0] !== ' ' && entry.code[0] !== '?';
    if (entry.code === 'AD') {
      verdict.phantoms.push(entry);
    } else if (entry.code === '??' || entry.code === '!!') {
      verdict.untracked.push(entry);
    } else if (netChanged !== undefined && staged && !isConflict(entry.code) && !netChanged.has(entry.path)) {
      verdict.stale.push(entry);
    } else {
      verdict.blocking.push(entry);
    }
  }
  return verdict;
}

/** One line per blocking entry, for the refusal (at most `limit`, then «…and N more»). */
export function describeBlocking(entries, limit = 12) {
  const lines = entries.slice(0, limit).map((e) => `  ${e.code} ${e.path}`);
  if (entries.length > limit) {
    lines.push(`  …and ${entries.length - limit} more`);
  }
  return lines.join('\n');
}
