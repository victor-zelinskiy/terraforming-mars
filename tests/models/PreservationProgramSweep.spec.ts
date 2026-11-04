import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {isIActionCard} from '../../src/server/cards/ICard';
import {IProjectCard} from '../../src/server/cards/IProjectCard';
import {CardType} from '../../src/common/cards/CardType';
import {CardName} from '../../src/common/cards/CardName';
import {Phase} from '../../src/common/Phase';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {ActionPreview} from '../../src/common/models/ActionPreviewModel';
import {cardPlayPreview} from '../../src/server/models/cardPlayPreview';
import {actionPreview} from '../../src/server/models/actionPreview';
import {skippedStepsOf} from '../../src/server/models/skippedRating';
import {PreservationProgram} from '../../src/server/cards/prelude2/PreservationProgram';
import {testGame} from '../TestGame';
import {runAllActions} from '../TestingUtils';
import {Table, Walk, answerOf, candidates, walkPrompts} from './ratingRefusalWalk';

/*
 * P57 PRESERVATION PROGRAM'S SKIP, SWEPT OVER THE WHOLE SCOPE (invariant 11 — the guard is the worklist; the mirror
 * of RX42's `UnmiVetoSweep`) — THE OWNER'S REQUIREMENT, PROVED: a seat whose first rating of the generation's action
 * phase will lose a step must be told so by every preview, and never lose a step it was not told about.
 *
 * With the card on the table and its skip ARMED (the action phase, nothing gained yet), every in-scope card whose
 * PLAY or ACTION raises a rating is walked for real, its prompts answered the cheapest valid way, and:
 *  · PROMISED ↔ PERFORMED: the steps the preview's exit pass struck under the CARD's mark (`skippedStepsOf`) equal
 *    the steps the funnel skipped live (`effect-skipped` under the card's own `rating-skipped` marker) — 0 or 1;
 *  · a skip that happened is NAMED (the marker carries the card) and leaves the flag down.
 * A preview whose walked branch cannot be told, or a card the walk cannot drive, is INFO, never a failure.
 *
 * `LEFTOVER_SKIP_WORKLIST` is EMPTY ON PURPOSE and fails BOTH ways.
 */
const LEFTOVER_SKIP_WORKLIST = new Set<string>([]);

function table(): Table {
  const [game, player, opponent] = testGame(2, {coloniesExtension: true, venusNextExtension: true});
  game.phase = Phase.ACTION;
  player.playedCards.push(new PreservationProgram());
  player.preservationProgram = true;
  player.trThisGeneration = 0;
  player.megaCredits = 200;
  player.steel = 20;
  player.titanium = 20;
  player.plants = 20;
  player.energy = 20;
  player.heat = 40;
  opponent.megaCredits = 20;
  opponent.plants = 10;
  return {game, player, opponent};
}

/** What the CARD skipped live for the seat — the magnitudes of its named skips under its own marker, summed. */
function skippedLive(t: Table): number {
  const marks = new Set(t.game.events.events
    .filter((e) => e.type === 'effect-triggered' && e.source?.kind === 'card' && e.source.card === CardName.PRESERVATION_PROGRAM && e.trigger === 'rating-skipped')
    .map((e) => e.id));
  return t.game.events.events
    .filter((e) => e.type === 'effect-skipped' && e.player === t.player.color && e.parentId !== undefined && marks.has(e.parentId))
    .reduce((sum, e) => sum + (e.impact.skipped?.effect?.amount ?? 0), 0);
}

function promised(preview: ActionPreview, branch: number | undefined): number | undefined {
  if (preview.kind === 'dynamic') {
    return undefined;
  }
  if (preview.branches.length === 1) {
    return skippedStepsOf(preview.branches[0].effects);
  }
  if (branch === undefined || preview.branches[branch] === undefined) {
    return undefined;
  }
  return skippedStepsOf(preview.branches[branch].effects);
}

type Verdict = {failure?: string, info?: string};

function judge(t: Table, walk: Walk, label: string, expected: number | undefined): Verdict {
  const live = skippedLive(t);
  const problems: Array<string> = [];
  if (live > 1) {
    problems.push(`the card skipped ${live} steps live (one per generation)`);
  }
  if (live > 0 && t.player.preservationProgram) {
    problems.push('a step was skipped and the flag still stands');
  }
  if (expected !== undefined && walk.unwalkable === undefined && live !== expected) {
    problems.push(`the preview struck ${expected} rating step(s) under the card, the funnel skipped ${live} live`);
  }
  if (problems.length > 0) {
    return {failure: `${label} :: ${problems.join('; ')}`};
  }
  if (walk.unwalkable !== undefined) {
    return {info: `${label} :: ${walk.unwalkable}`};
  }
  if (expected === undefined) {
    return {info: `${label} :: the walked branch cannot be matched to a preview branch (skipped ${live} live)`};
  }
  return {};
}

describe('PreservationProgram — the sweep over the scope (the worklist): promised ↔ performed', () => {
  it('every in-scope card that raises a rating on its PLAY or ACTION is warned exactly as the armed skip eats it', () => {
    const leaking = new Map<string, string>();
    const infos: Array<string> = [];
    let walked = 0;
    let matched = 0;
    let struck = 0;
    for (const c of candidates()) {
      const module = `${c.module}/${c.name}`;
      if (c.name === CardName.PRESERVATION_PROGRAM) {
        continue;
      }
      if ((c.play > 0 || c.bespoke) && new c.Factory().type !== CardType.CORPORATION) {
        const t = table();
        const card = new c.Factory();
        const walk: Walk = {};
        let expected: number | undefined;
        try {
          expected = promised(cardPlayPreview(t.player, card), 0);
          t.player.playCard(card as IProjectCard);
          walkPrompts(t, walk);
        } catch (e) {
          walk.unwalkable = `the play threw: ${(e as Error).message}`;
        }
        walked++;
        struck += expected ?? 0;
        const verdict = judge(t, walk, `${module} [play]`, expected);
        if (verdict.failure !== undefined) {
          leaking.set(`${c.name}:play`, verdict.failure);
        } else if (verdict.info !== undefined) {
          infos.push(verdict.info);
        } else {
          matched++;
        }
      }
      if (c.action > 0 || c.bespoke) {
        const probe = new c.Factory();
        if (!isIActionCard(probe)) {
          continue;
        }
        for (let branch = 0; branch < 4; branch++) {
          const t = table();
          const card = new c.Factory();
          t.player.playedCards.push(card);
          if (card.resourceType !== undefined) {
            card.resourceCount = 4;
          }
          t.player.hasIncreasedTerraformRatingThisGeneration = true; // the UNMI corporation's gate
          if (!isIActionCard(card) || !card.canAct(t.player)) {
            break;
          }
          const walk: Walk = {};
          let branches = 1;
          let expected: number | undefined;
          try {
            const preview = actionPreview(t.player, card);
            const own = card.action(t.player);
            if (own !== undefined) {
              t.player.defer(own);
            }
            runAllActions(t.game);
            const live = t.player.getWaitingFor();
            if (live instanceof OrOptions) {
              branches = live.options.length;
              if (branch >= branches) {
                break;
              }
              expected = promised(preview, branch);
              const inner = answerOf(live.options[branch], walk);
              if (inner === undefined) {
                walk.unwalkable = `branch ${branch} the guard cannot answer`;
              } else {
                t.player.process({type: 'or', index: branch, response: inner});
              }
            } else {
              expected = promised(preview, 0);
              if (live !== undefined) {
                const response = answerOf(live, walk);
                if (response === undefined) {
                  walk.unwalkable = `a ${live.type} prompt the guard cannot answer`;
                } else {
                  t.player.process(response);
                }
              }
            }
            if (walk.unwalkable === undefined) {
              walkPrompts(t, walk);
            }
          } catch (e) {
            walk.unwalkable = `the action threw: ${(e as Error).message}`;
          }
          walked++;
          struck += expected ?? 0;
          const verdict = judge(t, walk, `${module} [action · branch ${branch}]`, expected);
          if (verdict.failure !== undefined) {
            leaking.set(`${c.name}:action:${branch}`, verdict.failure);
          } else if (verdict.info !== undefined) {
            infos.push(verdict.info);
          } else {
            matched++;
          }
          if (branch + 1 >= branches) {
            break;
          }
        }
      }
    }
    expect(walked, 'the sweep walked something (anti-vacuity)').greaterThan(60);
    expect(matched, 'the sweep matched promises to skips (anti-vacuity)').greaterThan(40);
    expect(struck, 'the previews struck something (anti-vacuity)').greaterThan(30);
    const regressions = [...leaking.entries()].filter(([key]) => !LEFTOVER_SKIP_WORKLIST.has(key));
    expect(regressions.map(([, where]) => where),
      `\nCards breaking the armed skip (the funnel / the exit pass are the fix, never the card):\n${regressions.map(([, where]) => where).join('\n')}\n\nINFO:\n${infos.join('\n')}\n`).is.empty;
    const stale = [...LEFTOVER_SKIP_WORKLIST].filter((key) => !leaking.has(key));
    expect(stale, `\nFIXED — remove from LEFTOVER_SKIP_WORKLIST:\n${stale.join('\n')}\n`).is.empty;
  }).timeout(240_000);

  it('EVERY DOOR of the veto pass (RX42) runs the skip pass too (P57) — the two refusals stand in the same doors', () => {
    const root = path.join(__dirname, '../../src/server');
    const VETO_PASS = /\b(vetoEffects|withVetoedRating)\(/;
    const SKIP_PASS = /\b(skipEffects|withSkippedRating)\(/;
    const missing: Array<string> = [];
    const walk = (d: string): void => {
      for (const entry of fs.readdirSync(d, {withFileTypes: true})) {
        const full = path.join(d, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (entry.name.endsWith('.ts')) {
          const rel = path.relative(root, full).replaceAll('\\', '/');
          if (rel === 'models/vetoedRating.ts' || rel === 'models/skippedRating.ts') {
            continue;
          }
          const text = fs.readFileSync(full, 'utf8');
          if (VETO_PASS.test(text) !== SKIP_PASS.test(text)) {
            missing.push(`${rel}: ${VETO_PASS.test(text) ? 'runs the veto pass without the skip pass' : 'runs the skip pass without the veto pass'}`);
          }
        }
      }
    };
    walk(root);
    expect(missing, 'the two refusal passes stand in the same doors').deep.eq([]);
  });
});
