import {expect} from 'chai';
import {ALL_MODULE_MANIFESTS} from '../../src/server/cards/AllManifests';
import {ICard} from '../../src/server/cards/ICard';
import {GameModule} from '../../src/common/cards/GameModule';
import {Behavior} from '../../src/server/behavior/Behavior';
import {ActionEffect} from '../../src/common/models/ActionPreviewModel';
import {cardPlayPreview} from '../../src/server/models/cardPlayPreview';
import {actionPreview} from '../../src/server/models/actionPreview';
import {IActionCard} from '../../src/server/cards/ICard';
import {testGame} from '../TestGame';

/**
 * A VARIABLE AMOUNT NEVER DISAPPEARS FROM A PREVIEW.
 *
 * «+1 M€ production per space tag your OPPONENTS have» IS Toll Station — it is
 * the whole thing the player is spending 12 M€ on. The preview used to drop any
 * chip whose amount computed to zero, so against an opponent with no space tags
 * the card previewed as nothing but its own tag: the one number worth thinking
 * about was the one number the screen refused to show, and «I get nothing right
 * now» became indistinguishable from «this card has no production clause».
 *
 * Zero is the answer, not the absence of one. This guard fixes the board in the
 * state where the answer IS zero — a fresh game, empty board, empty tableaux —
 * and requires every declared variable clause to still be reported. It is a
 * WORKLIST: it fails naming the exact cards, so a new card (or a new bespoke
 * hook that builds its chips by hand) cannot quietly reintroduce the hole.
 */

const SCOPE = new Set<GameModule>(['base', 'corpera', 'promo', 'venus', 'colonies', 'prelude', 'ares', 'deltaProject']);

/** The chip a declared clause must produce, as `icon` + whether it is production. */
type Clause = {field: string, icon: string, production: boolean};

const STANDARD_RESOURCES = ['megacredits', 'steel', 'titanium', 'plants', 'energy', 'heat'] as const;

/** TRUE for a `Countable` OBJECT — an amount read from live game state. A plain
 *  number is fixed, cannot be zero in practice, and is not this guard's subject. */
function isVariable(raw: unknown): boolean {
  return raw !== null && typeof raw === 'object';
}

/** Every variable clause a behavior declares, including its `or` sub-behaviors
 *  (the branch chips are all previewed, available or not). */
function variableClauses(behavior: Behavior | undefined): Array<Clause> {
  if (behavior === undefined) {
    return [];
  }
  const out: Array<Clause> = [];
  for (const res of STANDARD_RESOURCES) {
    if (isVariable(behavior.stock?.[res])) {
      out.push({field: `stock.${res}`, icon: res, production: false});
    }
    if (isVariable(behavior.production?.[res])) {
      out.push({field: `production.${res}`, icon: res, production: true});
    }
  }
  if (isVariable(behavior.tr)) {
    out.push({field: 'tr', icon: 'tr', production: false});
  }
  const draw = behavior.drawCard;
  if (draw !== undefined && typeof draw !== 'number' && isVariable(draw.count)) {
    out.push({field: 'drawCard', icon: 'cards', production: false});
  }
  for (const sub of behavior.or?.behaviors ?? []) {
    out.push(...variableClauses(sub));
  }
  return out;
}

function reports(effects: ReadonlyArray<ActionEffect>, clause: Clause): boolean {
  return effects.some((e) => e.icon === clause.icon && (e.note === 'production') === clause.production);
}

function forEachInScopeCard(cb: (card: ICard, module: GameModule) => void): void {
  for (const manifest of ALL_MODULE_MANIFESTS) {
    if (!SCOPE.has(manifest.module)) {
      continue;
    }
    for (const name of Object.keys(manifest.projectCards)) {
      const Factory = (manifest.projectCards as Record<string, {Factory: new () => ICard}>)[name]?.Factory;
      if (Factory === undefined) {
        continue;
      }
      let card: ICard;
      try {
        card = new Factory();
      } catch {
        continue;
      }
      cb(card, manifest.module);
    }
  }
}

describe('variable-amount preview guard — a "per X" clause is never silently dropped', () => {
  it('every ON-PLAY variable clause is still reported when it counts to zero', () => {
    const [/* game */, player] = testGame(2);
    const missing: Array<string> = [];
    const covered: Array<string> = [];

    forEachInScopeCard((card) => {
      const clauses = variableClauses(card.behavior);
      if (clauses.length === 0) {
        return;
      }
      const effects = cardPlayPreview(player, card).branches.flatMap((b) => b.effects);
      for (const clause of clauses) {
        const id = `${card.name} · ${clause.field}`;
        (reports(effects, clause) ? covered : missing).push(id);
      }
    });

    // The set is real — a guard that silently matched nothing would pass forever.
    expect(covered.length + missing.length, 'in-scope cards with a variable on-play amount').is.greaterThan(15);
    expect(missing, `these cards lose a declared clause from their play preview:\n  ${missing.join('\n  ')}`)
      .to.deep.equal([]);
  });

  it('every blue-card ACTION variable clause is still reported when it counts to zero', () => {
    const [/* game */, player] = testGame(2);
    const missing: Array<string> = [];
    let checked = 0;

    forEachInScopeCard((card) => {
      const behavior = (card as {actionBehavior?: Behavior}).actionBehavior;
      const clauses = variableClauses(behavior);
      if (clauses.length === 0) {
        return;
      }
      // The action preview reads the tableau, so the card has to be on it.
      player.playedCards.set(card);
      const effects = actionPreview(player, card as ICard & IActionCard).branches.flatMap((b) => b.effects);
      player.playedCards.set();
      for (const clause of clauses) {
        checked++;
        if (!reports(effects, clause)) {
          missing.push(`${card.name} · ${clause.field}`);
        }
      }
    });

    expect(checked, 'in-scope blue cards with a variable action amount').is.greaterThan(0);
    expect(missing, `these cards lose a declared clause from their action preview:\n  ${missing.join('\n  ')}`)
      .to.deep.equal([]);
  });
});
