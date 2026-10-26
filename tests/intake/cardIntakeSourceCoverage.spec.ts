import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {CardName} from '../../src/common/cards/CardName';
import {cast} from '../../src/common/utils/utils';
import {Celestic} from '../../src/server/cards/venusNext/Celestic';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {formatMessage, runAllActions} from '../TestingUtils';
import {testGame} from '../TestGame';

/**
 * Ф6 of «ОДНО ДЕЙСТВИЕ — ОДИН ЗАБОР» — THE AUDIT OF EVERY PRODUCER (invariant 11: a guard is a worklist).
 *
 * A draw merges only under an action ROOT (`EventRecorder.currentRootId()`); a draw made outside any scope arrives
 * with no `actionId` and merges with nothing — honest, but every such site must be a DECISION, never an oversight.
 * The card tree is scoped by construction (a card's `play` / `action` / `onCardPlayed` / `initialAction` /
 * `onProductionPhase` all run inside `playCard` / `getPlayActionCard` / the play's chain / the first-action scope /
 * `beginProductionPhase`), so this guard enumerates the draw sites OUTSIDE it: every file is declared with the root
 * it runs under (or the reason it has none), a new site fails by name until it declares itself, and a stale row
 * fails too.
 */
const ROOT = path.resolve(__dirname, '..', '..');
const SERVER = path.join(ROOT, 'src', 'server');
const DRAW_CALL = /\.drawCard\(|DrawCards\.keep(All|Some)\(/;

/** Every imperative draw site outside `src/server/cards`, with the ROOT it runs under. */
const DECLARED: ReadonlyArray<{file: string, root: string}> = [
  {file: 'Game.ts', root: 'the placement bonus (`grantSpaceBonus`) — inside the placement\'s own action root (the play / the standard project / the finale)'},
  {file: 'Player.ts', root: 'the funnel itself (`drawCard` / `drawCardKeepSome`) and the Vermin / first-action scopes it opens'},
  {file: 'behavior/Executor.ts', root: 'the declarative DSL — inside the play / action root that runs the behavior'},
  {file: 'colonies/Colony.ts', root: 'a colony bonus — the trade door\'s root (`tradeDoor.beginAction`) or the paying card\'s; a detached delivery runs in the recipient\'s answer scope, which is the trade\'s root'},
  {file: 'delta/DeltaProjectExpansion.ts', root: 'the Delta Project advance — its own `beginAction`'},
  {file: 'moon/MoonExpansion.ts', root: 'FRONTIER (moon) — out of the premium scope; no claim'},
  {file: 'parliament/parties/PartyEffects.ts', root: 'a party\'s passive — inside the press\'s root (`withEffectSource`); a party action — its own `beginAction`'},
  {file: 'parliament/quests/ChairmanSeat.ts', root: 'the Agenda walk — inside the sitting\'s root or the card\'s'},
  {file: 'parliament/resolutions/ResolutionCatalog.ts', root: 'a resolution\'s action — `ResolutionAction.beginAction`'},
  {file: 'parliament/resolutions/marsFirst/UrbanDevelopment.ts', root: 'a law\'s passive — inside the press\'s root'},
  {file: 'parliament/resolutions/scientists/OpenIpTrade.ts', root: 'the law\'s action — `ResolutionAction.beginAction`'},
  {file: 'parliament/resolutions/unity/ColonialAffairs.ts', root: 'an EXTERNAL intake (R5) under the sitting\'s root — never merged by law'},
  {file: 'pathfinders/PathfindersExpansion.ts', root: 'FRONTIER (pathfinders) — out of the premium scope; no claim'},
  {file: 'turmoil/TurmoilHandler.ts', root: 'the classic Turmoil driver — FRONTIER; no root, each draw its own batch'},
  {file: 'turmoil/globalEvents/CorrosiveRain.ts', root: 'a classic global event — FRONTIER; no root, each draw its own batch'},
  {file: 'turmoil/globalEvents/SnowCover.ts', root: 'a classic global event — FRONTIER; no root, each draw its own batch'},
  {file: 'turmoil/globalEvents/SponsoredProjects.ts', root: 'a classic global event — FRONTIER; no root, each draw its own batch'},
  {file: 'turmoil/parties/MarsFirst.ts', root: 'a classic party policy — FRONTIER (the Redux parties live in `parliament/`)'},
  {file: 'turmoil/parties/Party.ts', root: 'a classic party policy — FRONTIER'},
  {file: 'turmoil/parties/Scientists.ts', root: 'a classic party policy — FRONTIER'},
  {file: 'turmoil/parties/Unity.ts', root: 'a classic party policy — FRONTIER'},
  {file: 'underworld/UnderworldExpansion.ts', root: 'FRONTIER (underworld) — out of the premium scope; no claim'},
];

function walk(dir: string, out: Array<string>): void {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'cards') {
        continue;
      }
      walk(full, out);
    } else if (entry.name.endsWith('.ts') && DRAW_CALL.test(fs.readFileSync(full, 'utf8'))) {
      out.push(path.relative(SERVER, full).split(path.sep).join('/'));
    }
  }
}

describe('cardIntakeSourceCoverage — every draw site outside the card tree declares its action root', () => {
  it('reads a real corpus (anti-vacuous)', () => {
    const found: Array<string> = [];
    walk(SERVER, found);
    expect(found.length).to.be.greaterThan(10);
  });

  it('every draw site is declared with its root, and every declared row still exists', () => {
    const found: Array<string> = [];
    walk(SERVER, found);
    const declared = new Set(DECLARED.map((d) => d.file));
    const undeclared = found.filter((f) => !declared.has(f));
    const stale = DECLARED.filter((d) => !found.includes(d.file)).map((d) => d.file);
    expect(undeclared, `draw site(s) with no declared root — open one (beginAction / beginProductionPhase / rejoinAction) or declare why there is none:\n  ${undeclared.join('\n  ')}`).deep.eq([]);
    expect(stale, `declared row(s) whose file no longer draws:\n  ${stale.join('\n  ')}`).deep.eq([]);
  });

  it('the corporation\'s first action (Celestic\'s floater search) draws under its own root — the batch carries actionId and source', () => {
    const [game, player] = testGame(2, {venusNextExtension: true});
    const celestic = new Celestic();
    // The HeadStart spec's idiom: the corporation's first action is owed, the turn opens on it.
    player.pendingInitialActions.push(celestic);
    player.takeAction();
    const [prompt, cb] = player.popWaitingFor2();
    const menu = cast(prompt, OrOptions);
    const first = menu.options.find((o) => formatMessage(o.title).includes('first action'));
    expect(first, 'the first-action option stands in the menu').is.not.undefined;
    first!.cb(undefined);
    cb?.();
    runAllActions(game);
    expect(player.cardDrawReveals.length).to.be.greaterThan(0);
    const batch = player.cardDrawReveals[0];
    expect(batch.actionId, 'the first action opened a root').is.a('number');
    expect(batch.source).deep.eq({type: 'card', cardName: CardName.CELESTIC});
  });
});
