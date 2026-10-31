#!/usr/bin/env node
/*
 * THE FIELD OPENING INDEX — phase 2 of the start director (docs/claude/console/start-director.md § Next phases):
 * every real table's OPENING, as the server asked it, read off the box's per-step saves.
 *
 *   node scripts/field-opening-index.cjs <build-dir> <db-files-dir> <out-dir> [maxGames]
 *
 * For every game under <db-files-dir> (live `*.json` + `completed/*.json`) the per-step saves
 * `history/<game>-NNNNN.json` of GENERATION 1 are deserialized through the COMPILED server (`<build-dir>/src/server/
 * Game.js` — the real `Game.deserialize`, the resume block re-primes the prompt) and every seat's `getWaitingFor()` is
 * written as one token per seat per step: `type[:startKind][:bonus][:menu][:choice:<source>]`. With the save's mtime
 * (= the move's time) the index tells (a) which opening SHAPES the field actually walks, (b) where a human seat stood
 * for minutes on one prompt, (c) which openings never reached the action menu. No save leaves the box — the index is
 * a few KB per game. Runs ON THE BOX (`~/tm-e2e/node/bin/node`, the repo's node_modules beside it).
 */
const fs = require('fs');
const path = require('path');
// The engine's resume block asks the database to persist what it re-primed; there is no database here — the
// rejections are swallowed (they fire after the synchronous walk and would otherwise end the process at exit).
process.on('unhandledRejection', () => {});

const [buildDir, dbDir, outDir, maxGamesArg] = process.argv.slice(2);
if (!buildDir || !dbDir || !outDir) {
  console.error('usage: field-opening-index.cjs <build-dir> <db-files-dir> <out-dir> [maxGames]');
  process.exit(2);
}
const {Game} = require(path.resolve(buildDir, 'src/server/Game.js'));
const {isActionMenuTitle} = require(path.resolve(buildDir, 'src/common/inputs/actionMenuTitles.js'));
fs.mkdirSync(outDir, {recursive: true});

const historyDir = path.join(dbDir, 'history');
const gameIds = [
  ...fs.readdirSync(dbDir).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)),
  ...(fs.existsSync(path.join(dbDir, 'completed')) ? fs.readdirSync(path.join(dbDir, 'completed')).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)) : []),
];
const completed = new Set(fs.existsSync(path.join(dbDir, 'completed')) ? fs.readdirSync(path.join(dbDir, 'completed')).map((f) => f.slice(0, -5)) : []);
const allHistory = fs.readdirSync(historyDir);
const byGame = new Map();
for (const f of allHistory) {
  const m = /^(.+)-(\d+)\.json$/.exec(f);
  if (m === null) continue;
  if (!byGame.has(m[1])) byGame.set(m[1], []);
  byGame.get(m[1]).push({file: f, step: Number(m[2])});
}

function titleOf(wf) {
  const t = wf.title;
  return typeof t === 'string' ? t : t?.message;
}
function tokenOf(wf) {
  if (wf === undefined || wf === null) return '-';
  const parts = [wf.type];
  if (wf.startGamePrompt?.kind) parts.push(wf.startGamePrompt.kind);
  if (wf.bonusActionPrompt) parts.push('bonus');
  if (wf.type === 'or' && isActionMenuTitle(titleOf(wf))) parts.push('menu');
  if (wf.choiceContext?.source?.kind) parts.push('choice:' + wf.choiceContext.source.kind);
  if (wf.partyActionPrompt) parts.push('party');
  if (wf.resolutionActionPrompt) parts.push('law');
  if (wf.votePrompt) parts.push('vote');
  // An UNMARKED prompt names itself by its title (a key, never a rendered text) — the only way to tell a start-queue
  // SelectCard from a card's own question in the index.
  if (parts.length === 1 && wf.type !== 'initialCards') parts.push('«' + String(titleOf(wf) ?? '').slice(0, 48) + '»');
  return parts.join(':');
}

const max = maxGamesArg ? Number(maxGamesArg) : Infinity;
let done = 0;
const summary = [];
for (const id of gameIds) {
  if (done >= max) break;
  const saves = (byGame.get(id) ?? []).sort((a, b) => a.step - b.step);
  if (saves.length === 0) continue;
  const lines = [];
  let options;
  let reachedGen2 = false;
  for (const {file, step} of saves) {
    const full = path.join(historyDir, file);
    let raw;
    try {
      raw = JSON.parse(fs.readFileSync(full, 'utf8'));
    } catch (e) {
      lines.push({step, error: 'unreadable: ' + e.message});
      continue;
    }
    if (options === undefined) {
      const o = raw.gameOptions ?? {};
      options = {
        players: raw.players.length,
        bots: raw.players.filter((p) => p.isMarsBot).length,
        prelude: !!o.preludeExtension, prelude2: !!o.prelude2Expansion, colonies: !!o.coloniesExtension, venus: !!o.venusNextExtension,
        turmoilRedux: !!o.turmoilReduxExpansion, turmoil: !!o.turmoilExtension, ares: !!o.aresExtension, moon: !!o.moonExpansion,
        pathfinders: !!o.pathfindersExpansion, draft: !!o.initialDraftVariant, campaign: raw.campaign !== undefined || o.campaign !== undefined,
        corporations: o.corporationsDraft ?? undefined, fastMode: !!o.fastMode,
      };
    }
    if ((raw.generation ?? 1) > 1) {
      reachedGen2 = true;
      lines.push({step, t: fs.statSync(full).mtimeMs, gen: raw.generation, phase: raw.phase, end: true});
      break;
    }
    let game;
    try {
      game = Game.deserialize(raw);
    } catch (e) {
      lines.push({step, error: 'deserialize: ' + String(e.message).slice(0, 160)});
      continue;
    }
    const seats = game.players.map((p) => {
      let wf;
      let err;
      try {
        wf = p.getWaitingFor();
      } catch (e) {
        err = String(e.message).slice(0, 80);
      }
      return {
        c: p.color, bot: !!p.isMarsBot, wf: err ? 'ERR:' + err : tokenOf(wf),
        pend: p.pendingInitialActions?.length ?? 0, prel: p.preludeCardsInHand?.length ?? 0,
        hand: p.cardsInHand?.length ?? 0, corp: (() => { try { return p.tableau?.corporations?.length ?? p.tableau?.length ?? 0; } catch { return -1; } })(),
      };
    });
    lines.push({
      step, t: fs.statSync(full).mtimeMs, gen: raw.generation ?? 1, phase: raw.phase, age: raw.gameAge,
      active: game.activePlayer?.color, seats,
    });
  }
  const out = {game: id, completed: completed.has(id), options, reachedGen2, saves: lines};
  fs.writeFileSync(path.join(outDir, `${id}.json`), JSON.stringify(out));
  summary.push({game: id, saves: lines.length, reachedGen2, completed: completed.has(id)});
  done++;
  if (done % 10 === 0) console.error(`[field-opening] ${done}/${Math.min(max, gameIds.length)} games`);
}
fs.writeFileSync(path.join(outDir, '_summary.json'), JSON.stringify(summary, null, 1));
console.error(`[field-opening] done: ${done} games → ${outDir}`);
