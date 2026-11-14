/*
 * WHAT NEVER LEAVES BY ITSELF — the scrub every AUTOMATIC payload goes through before the hub sends it.
 *
 * An automatic event is sent without the player pressing anything, so it carries no key and no name:
 *
 *  · a GAME id and a PARTICIPANT id are keys (`/api/game?id=g…` hands out the seats' ids; a seat's id IS the seat) —
 *    each becomes a short, irreversible FINGERPRINT (`g#3fa9c1d2e0`): two events of one table still correlate, and
 *    nobody can enter the table with what was sent;
 *  · a player's NAME (a Steam persona becomes the player's name) becomes `<player>`;
 *  · an IP address, an e-mail, the OS account's name inside a path (`C:\Users\<user>\…`, `/home/<user>/…`).
 *
 * Sentry does not scrub attachments, and its own data scrubber knows nothing of this game's ids — so the scrub is
 * OURS and runs BEFORE anything is handed to the transport. An explicit report («Сообщить о проблеме») is the player's
 * own press and carries the full package unscrubbed; the surface says so before the press.
 *
 * Pure: the hash is injected (the hub's is SHA-256; `scripts/diag` computes the same to resolve a fingerprint back to a
 * save on a machine the agent can read).
 */

export type ScrubContext = {
  /** Ids known to be on this page (they are replaced even where the generic pattern would not see them). */
  ids: ReadonlyArray<string>;
  names: ReadonlyArray<string>;
};

export type ScrubHash = (value: string) => string;

/** `p`/`g`/`s` + the hex of `generateRandomId` (twelve digits at most today; eight is the shortest worth calling an id). */
const ID = /\b([pgs])([0-9a-f]{8,16})\b/g;
const IPV4 = /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const WIN_HOME = /([A-Za-z]:[\\/]+Users[\\/]+)([^\\/\s"'<>|:]+)/g;
const NIX_HOME = /(\/(?:home|Users)\/)([^/\s"'<>:]+)/g;

/** How many hex digits of the hash a fingerprint keeps. */
export const FINGERPRINT_DIGITS = 10;

/** `g1a2b3c4d5e6f` → `g#<10 hex of its hash>`. */
export function fingerprintId(id: string, hash: ScrubHash): string {
  return `${id.charAt(0)}#${hash(id).slice(0, FINGERPRINT_DIGITS)}`;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** A name worth replacing: two characters or more (a one-letter name would eat ordinary text). */
function scrubbableNames(names: ReadonlyArray<string>): Array<string> {
  return [...new Set(names.map((n) => n.trim()).filter((n) => n.length >= 2))].sort((a, b) => b.length - a.length);
}

export function scrubText(text: string, context: ScrubContext, hash: ScrubHash): string {
  let out = text;
  for (const id of context.ids) {
    if (id.length >= 2) {
      out = out.split(id).join(fingerprintId(id, hash));
    }
  }
  out = out.replace(ID, (whole) => fingerprintId(whole, hash));
  for (const name of scrubbableNames(context.names)) {
    out = out.replace(new RegExp(escapeRegExp(name), 'g'), '<player>');
  }
  return out
    .replace(EMAIL, '<email>')
    .replace(IPV4, (ip) => (ip === '127.0.0.1' || ip === '0.0.0.0' ? ip : '<ip>'))
    .replace(WIN_HOME, '$1<user>')
    .replace(NIX_HOME, '$1<user>');
}

/** Every string of a JSON-shaped value, scrubbed (keys too: a map keyed by a seat's id is a list of keys). */
export function scrubDeep<T>(value: T, context: ScrubContext, hash: ScrubHash): T {
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') {
      return scrubText(v, context, hash);
    }
    if (Array.isArray(v)) {
      return v.map(walk);
    }
    if (typeof v === 'object' && v !== null) {
      const out: Record<string, unknown> = {};
      for (const [k, inner] of Object.entries(v)) {
        out[scrubText(k, context, hash)] = walk(inner);
      }
      return out;
    }
    return v;
  };
  return walk(value) as T;
}
