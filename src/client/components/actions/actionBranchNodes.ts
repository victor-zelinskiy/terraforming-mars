/**
 * Maps each preview BRANCH to the card action RENDER NODE that draws it, so the
 * confirmation modal can show a per-branch graphic. The render-node order (as
 * printed on the card) can differ from the behavior order the server reports
 * branches in (e.g. Regolith Eaters prints "add" first but lists "spend" first),
 * so a positional mapping is wrong. We match by TOKEN OVERLAP of the branch
 * title against each node's description (both English source strings at this
 * layer, before v-i18n), greedily, with an ordinal fallback.
 *
 * Purely COSMETIC: the submitted branch index comes from `branch.index` (server-
 * authoritative), never from this mapping — a mis-match only shows a slightly
 * wrong graphic, never an incorrect action. Pure + unit-tested.
 */

function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/\(.*?\)/g, ' ') // drop parenthetical prefixes, e.g. "(Action: …)"
      .replace(/[^a-zа-яё0-9\s]/gi, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2),
  );
}

function overlap(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const t of a) {
    if (b.has(t)) {
      n++;
    }
  }
  return n;
}

/**
 * For each branch title (in order) returns the index of the node it best maps
 * to, or -1 when there are no nodes left to assign. Greedy: each branch claims
 * the unused node with the highest token overlap; ties / no overlap fall back to
 * the first still-unused node (ordinal).
 */
export function assignBranchNodes(branchTitles: ReadonlyArray<string>, nodeDescriptions: ReadonlyArray<string>): Array<number> {
  const branchTokens = branchTitles.map(tokenize);
  const nodeTokens = nodeDescriptions.map(tokenize);
  const used = new Set<number>();

  return branchTitles.map((_title, bi) => {
    let best = -1;
    let bestScore = 0;
    for (let ni = 0; ni < nodeTokens.length; ni++) {
      if (used.has(ni)) {
        continue;
      }
      const score = overlap(branchTokens[bi], nodeTokens[ni]);
      if (score > bestScore) {
        bestScore = score;
        best = ni;
      }
    }
    if (best === -1) {
      best = nodeDescriptions.findIndex((_d, ni) => !used.has(ni));
    }
    if (best !== -1) {
      used.add(best);
    }
    return best;
  });
}
