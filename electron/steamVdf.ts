// Electron — Steam Non-Steam-Game shortcut helpers (PURE, no electron/fs/network).
//
// The Windows "Add to Steam" flow (electron/steamShortcut.ts) needs three pure pieces,
// all mirrored from scripts/steamdeck/install-steamdeck.sh so the Windows shortcut is
// byte-compatible with the Steam Deck one:
//   1. crc32 → the DETERMINISTIC shortcut appid (the same scheme steam-rom-manager / Decky
//      use), so the artwork we drop into userdata/<id>/config/grid/ actually attaches;
//   2. a minimal binary VDF (shortcuts.vdf) reader/writer;
//   3. the shortcut-entry template.
//
// Kept electron-free so it unit-tests under the plain server mocha runner (tests/electron/
// steamVdf.spec.ts) — the IO orchestration (registry detection, art copy, Steam shutdown)
// lives in the sibling steamShortcut.ts.

/** A node in shortcuts.vdf: a nested map, a string, an int32, or an int64. */
export type VdfValue = string | number | bigint | VdfMap;
export interface VdfMap { [key: string]: VdfValue; }

// ── crc32 + deterministic appid ──────────────────────────────────────────────

const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) !== 0 ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
})();

/** Standard IEEE crc32 over UTF-8 bytes (matches Python's zlib.crc32). */
export function crc32(text: string): number {
  const buf = Buffer.from(text, 'utf8');
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

/**
 * The shortcut appid Steam stores in shortcuts.vdf: crc32(Exe+AppName) with the high bit
 * set (`| 0x80000000`). The `>>> 0` keeps it an unsigned 32-bit value for LE serialization.
 */
export function appId32(exeAndName: string): number {
  return (crc32(exeAndName) | 0x80000000) >>> 0;
}

/**
 * The 64-bit "Big Picture" grid id derived from a 32-bit shortcut appid:
 * `(appid << 32) | 0x02000000`. Used only to name the `<id>p.png` / `<id>_hero.png` /
 * `<id>.jpg` / `<id>_logo.png` grid variants (Steam looks for both the 32- and 64-bit names).
 */
export function gridId64(appId: number): bigint {
  return (BigInt(appId >>> 0) << 32n) | 0x02000000n;
}

// ── binary VDF (shortcuts.vdf) reader / writer ───────────────────────────────
// Type tags: 0x00 nested map, 0x01 string, 0x02 int32, 0x07 int64, 0x08 end-of-map.

/** Parse a binary VDF map starting at `offset`; returns the map and the next offset. */
export function readMap(b: Buffer, offset: number): [VdfMap, number] {
  const map: VdfMap = {};
  let i = offset;
  for (;;) {
    const type = b[i];
    i += 1;
    if (type === 0x08) {
      return [map, i];
    }
    const keyEnd = b.indexOf(0, i);
    if (keyEnd < 0) {
      throw new Error('malformed VDF: unterminated key');
    }
    const key = b.toString('utf8', i, keyEnd);
    i = keyEnd + 1;
    if (type === 0x00) {
      const [nested, next] = readMap(b, i);
      map[key] = nested;
      i = next;
    } else if (type === 0x01) {
      const valEnd = b.indexOf(0, i);
      if (valEnd < 0) {
        throw new Error('malformed VDF: unterminated string');
      }
      map[key] = b.toString('utf8', i, valEnd);
      i = valEnd + 1;
    } else if (type === 0x02) {
      map[key] = b.readUInt32LE(i);
      i += 4;
    } else if (type === 0x07) {
      map[key] = b.readBigUInt64LE(i);
      i += 8;
    } else {
      throw new Error('unsupported VDF type 0x' + type.toString(16));
    }
  }
}

function pushBytes(out: Array<number>, buf: Buffer): void {
  for (let i = 0; i < buf.length; i++) {
    out.push(buf[i]);
  }
}

function pushKey(out: Array<number>, type: number, key: string): void {
  out.push(type);
  pushBytes(out, Buffer.from(key, 'utf8'));
  out.push(0);
}

/** Serialize a VDF map into `out`. Booleans map to int32; bigints to int64. */
export function writeMap(map: VdfMap, out: Array<number>): void {
  for (const [key, value] of Object.entries(map)) {
    if (typeof value === 'bigint') {
      pushKey(out, 0x07, key);
      let x = value & 0xFFFFFFFFFFFFFFFFn;
      for (let i = 0; i < 8; i++) {
        out.push(Number(x & 0xFFn));
        x >>= 8n;
      }
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      pushKey(out, 0x02, key);
      const n = (typeof value === 'boolean' ? (value ? 1 : 0) : value) >>> 0;
      out.push(n & 0xFF, (n >>> 8) & 0xFF, (n >>> 16) & 0xFF, (n >>> 24) & 0xFF);
    } else if (typeof value === 'string') {
      pushKey(out, 0x01, key);
      pushBytes(out, Buffer.from(value, 'utf8'));
      out.push(0);
    } else {
      pushKey(out, 0x00, key);
      writeMap(value, out);
    }
  }
  out.push(0x08);
}

/** Read a whole shortcuts.vdf buffer into its root map (with a guaranteed `shortcuts` map). */
export function parseShortcuts(b: Buffer): VdfMap {
  const [root] = readMap(b, 0);
  if (typeof root.shortcuts !== 'object' || root.shortcuts === null) {
    root.shortcuts = {};
  }
  return root;
}

/** Serialize a root map back to shortcuts.vdf bytes. */
export function serializeShortcuts(root: VdfMap): Buffer {
  const out: Array<number> = [];
  writeMap(root, out);
  return Buffer.from(out);
}

/**
 * The canonical Non-Steam shortcut entry (mirrors the fields the Deck installer writes).
 * `exeQuoted` / `startDirQuoted` must already be quoted the way Steam stores them.
 */
export function newShortcutEntry(opts: {
  appId: number;
  appName: string;
  exeQuoted: string;
  startDirQuoted: string;
  icon: string;
}): VdfMap {
  return {
    appid: opts.appId >>> 0,
    AppName: opts.appName,
    Exe: opts.exeQuoted,
    StartDir: opts.startDirQuoted,
    icon: opts.icon,
    ShortcutPath: '',
    LaunchOptions: '',
    IsHidden: 0,
    AllowDesktopConfig: 1,
    AllowOverlay: 1,
    OpenVR: 0,
    Devkit: 0,
    DevkitGameID: '',
    DevkitOverrideAppID: 0,
    LastPlayTime: 0,
    tags: {},
  };
}

/**
 * Find the existing shortcut key for our app (by matching Exe or appid), or the next free
 * numeric index. Mirrors the Deck installer's upsert so a re-run REPLACES rather than
 * duplicates the entry.
 */
export function findOrNextKey(shortcuts: VdfMap, exeQuoted: string, appId: number): string {
  for (const [k, v] of Object.entries(shortcuts)) {
    // Only nested maps are shortcut entries (string/number/bigint values are scalar fields).
    if (typeof v === 'object') {
      const entry = v as VdfMap;
      const aid = entry.appid;
      const aidMatches = typeof aid === 'number' && (aid >>> 0) === (appId >>> 0);
      if (entry.Exe === exeQuoted || aidMatches) {
        return k;
      }
    }
  }
  const indices = Object.keys(shortcuts)
    .filter((k) => /^\d+$/.test(k))
    .map((k) => parseInt(k, 10));
  return String(indices.length > 0 ? Math.max(...indices) + 1 : 0);
}

/**
 * Whether a shortcut for our app (matching the quoted Exe OR our deterministic appid) already
 * exists in this shortcuts map. Mirrors findOrNextKey's match, but reports PRESENCE — used to
 * hide the "Add to Steam" prompt/button once it's already there.
 */
export function shortcutExists(shortcuts: VdfMap, exeQuoted: string, appId: number): boolean {
  for (const v of Object.values(shortcuts)) {
    if (typeof v === 'object') {
      const entry = v as VdfMap;
      const aid = entry.appid;
      const aidMatches = typeof aid === 'number' && (aid >>> 0) === (appId >>> 0);
      if (entry.Exe === exeQuoted || aidMatches) {
        return true;
      }
    }
  }
  return false;
}
