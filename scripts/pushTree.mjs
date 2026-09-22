// What `npm run push` may push over, and what it must refuse — the working tree, classified.
//
// The push rebases and may amend the tip, so anything REAL in the tree (a modified, staged,
// deleted or conflicted tracked file) has to be committed first: an amend sweeps the whole
// index into the tip, and a rebase over local edits either refuses or mixes them in. The
// script never stashes — the tree may hold another session's work.
//
// Two kinds of entry are NOT work, and blocking on them is how a push got stuck with
// nothing to commit:
//   · a PHANTOM — `AD`: added to the index, then deleted from disk. The file exists in
//     neither HEAD nor the working tree; the only thing left is a stale index entry (a
//     temporary file somebody `git add`ed and removed). Committing it would resurrect a file
//     its owner deleted; the honest fix is to drop the entry. Its content stays in git's
//     object store, so the caller prints the blob id for recovery.
//   · UNTRACKED files (`??`): a rebase and an amend never touch them. A rebase that would
//     overwrite one stops on its own, and the script aborts it cleanly.
//
// Pure: parses `git status --porcelain=v1 -z` output, runs nothing.

/**
 * @typedef {{code: string, path: string}} TreeEntry
 * @typedef {{phantoms: Array<TreeEntry>, untracked: Array<TreeEntry>, blocking: Array<TreeEntry>}} TreeVerdict
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

/**
 * @param {Array<TreeEntry>} entries
 * @returns {TreeVerdict}
 */
export function classifyTree(entries) {
  const verdict = {phantoms: [], untracked: [], blocking: []};
  for (const entry of entries) {
    if (entry.code === 'AD') {
      verdict.phantoms.push(entry);
    } else if (entry.code === '??' || entry.code === '!!') {
      verdict.untracked.push(entry);
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
