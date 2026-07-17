// Electron — read the DISPLAY name (persona name) of the account currently signed into Steam,
// so first-run game creation can prefill the player's name from Steam on a Steam Deck / Steam
// Machine (and desktop). Cross-platform and dependency-free: it parses Steam's plain-text
// `config/loginusers.vdf` (which lists every remembered account with its PersonaName + a
// MostRecent flag) — NO Steamworks SDK / native module, so it works in the EXISTING Linux
// (Deck/Steam Machine), Windows and macOS builds with zero extra packaging or per-arch rebuild.
//
// This file imports NOTHING from 'electron' on purpose, so the pure VDF logic
// (personaNameFromLoginUsers) is unit-testable under the plain mocha runner
// (tests/electron/steamPersona.spec.ts), mirroring steamVdf.ts.

import {execFileSync} from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/** A parsed VDF value: a leaf string or a nested object. */
type VdfNode = string | {[key: string]: VdfNode};

/** Tokenize Valve's text KeyValues: `"quoted"` strings, `{`, `}`, and `//` line comments. */
function tokenizeVdf(text: string): Array<string> {
  const tokens: Array<string> = [];
  const n = text.length;
  let i = 0;
  while (i < n) {
    const c = text[i];
    if (c === ' ' || c === '\t' || c === '\r' || c === '\n') {
      i++;
      continue;
    }
    if (c === '/' && text[i + 1] === '/') {
      while (i < n && text[i] !== '\n') {
        i++;
      }
      continue;
    }
    if (c === '{' || c === '}') {
      tokens.push(c);
      i++;
      continue;
    }
    if (c === '"') {
      i++;
      let s = '';
      while (i < n && text[i] !== '"') {
        if (text[i] === '\\' && i + 1 < n) {
          const e = text[i + 1];
          s += e === 'n' ? '\n' : e === 't' ? '\t' : e; // \" and \\ collapse to the literal char
          i += 2;
        } else {
          s += text[i];
          i++;
        }
      }
      i++; // closing quote
      tokens.push(s);
      continue;
    }
    // Bare (unquoted) token — uncommon in these files; read to the next delimiter.
    let s = '';
    while (i < n && !' \t\r\n{}"'.includes(text[i])) {
      s += text[i];
      i++;
    }
    tokens.push(s);
  }
  return tokens;
}

/** Parse the token stream into a nested object (best-effort; malformed tails are ignored). */
function parseVdf(text: string): {[key: string]: VdfNode} {
  const tokens = tokenizeVdf(text);
  let i = 0;
  function parseObject(): {[key: string]: VdfNode} {
    const obj: {[key: string]: VdfNode} = {};
    while (i < tokens.length) {
      const key = tokens[i];
      if (key === '}') {
        i++;
        break;
      }
      i++;
      const next = tokens[i];
      if (next === '{') {
        i++;
        obj[key] = parseObject();
      } else if (next === undefined || next === '}') {
        obj[key] = ''; // dangling key — record empty, let the outer close handle the brace
      } else {
        obj[key] = next;
        i++;
      }
    }
    return obj;
  }
  return parseObject();
}

/** Case-insensitive string-field lookup on a parsed VDF object. */
function field(obj: {[key: string]: VdfNode}, name: string): string | undefined {
  const lower = name.toLowerCase();
  for (const key of Object.keys(obj)) {
    if (key.toLowerCase() === lower) {
      const v = obj[key];
      return typeof v === 'string' ? v : undefined;
    }
  }
  return undefined;
}

/**
 * Extract the DISPLAY name of the account the user is currently signed in as, from the text of a
 * `loginusers.vdf`. Picks the account flagged `MostRecent "1"` (the one Steam is running as), and
 * falls back to the newest `Timestamp` when no flag is set. Returns undefined when the file has no
 * usable PersonaName. PURE — no filesystem, unit-tested.
 */
export function personaNameFromLoginUsers(text: string): string | undefined {
  let root: {[key: string]: VdfNode};
  try {
    root = parseVdf(text);
  } catch {
    return undefined;
  }
  // The top level is a single "users" block.
  let users: VdfNode | undefined;
  for (const key of Object.keys(root)) {
    if (key.toLowerCase() === 'users') {
      users = root[key];
      break;
    }
  }
  if (users === undefined || typeof users === 'string') {
    return undefined;
  }
  const accounts: Array<{persona: string, mostRecent: boolean, timestamp: number}> = [];
  for (const id of Object.keys(users)) {
    const acct = users[id];
    if (typeof acct === 'string') {
      continue;
    }
    const persona = field(acct, 'PersonaName');
    if (persona === undefined || persona.trim() === '') {
      continue;
    }
    accounts.push({
      persona: persona.trim(),
      mostRecent: field(acct, 'MostRecent') === '1',
      timestamp: Number(field(acct, 'Timestamp') ?? '') || 0,
    });
  }
  if (accounts.length === 0) {
    return undefined;
  }
  const recent = accounts.find((a) => a.mostRecent);
  if (recent !== undefined) {
    return recent.persona;
  }
  return accounts.slice().sort((a, b) => b.timestamp - a.timestamp)[0].persona;
}

/** Steam's Windows install path, from the registry (HKCU) — Windows only, best-effort. */
function windowsSteamPath(): string | undefined {
  try {
    const out = execFileSync(
      'reg', ['query', 'HKCU\\Software\\Valve\\Steam', '/v', 'SteamPath'],
      {encoding: 'utf8', windowsHide: true, timeout: 5000},
    );
    const m = out.match(/SteamPath\s+REG_SZ\s+(.+)/i);
    if (m !== null) {
      return m[1].trim().replace(/\//g, '\\');
    }
  } catch {
    // Steam not installed / reg unavailable.
  }
  return undefined;
}

/** Candidate Steam base dirs (each should contain `config/loginusers.vdf`), per platform. */
function steamBaseDirs(): Array<string> {
  const home = os.homedir();
  const candidates: Array<string> = [];
  if (process.platform === 'win32') {
    const reg = windowsSteamPath();
    if (reg !== undefined) {
      candidates.push(reg);
    }
    candidates.push('C:\\Program Files (x86)\\Steam', 'C:\\Program Files\\Steam');
  } else if (process.platform === 'darwin') {
    candidates.push(path.join(home, 'Library', 'Application Support', 'Steam'));
  } else {
    // Linux / SteamOS — Steam Deck & Steam Machine. Native, Debian, and the two Flatpak layouts.
    candidates.push(
      path.join(home, '.steam', 'steam'),
      path.join(home, '.local', 'share', 'Steam'),
      path.join(home, '.steam', 'root'),
      path.join(home, '.var', 'app', 'com.valvesoftware.Steam', '.local', 'share', 'Steam'),
      path.join(home, '.var', 'app', 'com.valvesoftware.Steam', 'data', 'Steam'),
    );
  }
  return candidates;
}

/**
 * The Steam display name (persona name) of the account currently signed into Steam on this machine,
 * or undefined when Steam / a logged-in account can't be found. Cross-platform, read-only,
 * best-effort — never throws. Backs the `desktop:getSteamName` IPC (first-run name prefill).
 */
export function readSteamPersonaName(): string | undefined {
  for (const base of steamBaseDirs()) {
    const file = path.join(base, 'config', 'loginusers.vdf');
    let text: string;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch {
      continue; // not this candidate — try the next
    }
    const persona = personaNameFromLoginUsers(text);
    if (persona !== undefined && persona !== '') {
      return persona;
    }
  }
  return undefined;
}
