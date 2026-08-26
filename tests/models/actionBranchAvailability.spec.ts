import {expect} from 'chai';
import {testGame} from '../TestGame';
import {ALL_MODULE_MANIFESTS} from '../../src/server/cards/AllManifests';
import {isIActionCard, ICard, IActionCard} from '../../src/server/cards/ICard';
import {GameModule} from '../../src/common/cards/GameModule';
import {CardModel} from '../../src/common/models/CardModel';
import {CardName} from '../../src/common/cards/CardName';
import {ActionPreview} from '../../src/common/models/ActionPreviewModel';
import {CardResource} from '../../src/common/CardResource';
import {actionPreview} from '../../src/server/models/actionPreview';
import {IPlayer} from '../../src/server/IPlayer';
import {playerActionGroups} from '../../src/client/components/actions/actionExtraction';
import {nodeAvailability} from '../../src/client/components/actions/actionBranchView';
import {ActionEntry} from '../../src/client/components/actions/actionModel';
import {buildConsoleActionsModel} from '../../src/client/console/consoleCardActions';

const SCOPE = new Set<GameModule>(['base', 'corpera', 'promo', 'venus', 'colonies', 'prelude', 'ares', 'deltaProject']);

/**
 * THE TWO LEVELS OF «CAN THIS BE ACTIVATED» MUST AGREE.
 *
 * A blue-card action is offered twice: the CARD is listed as actable (server
 * `canAct` → the `Perform an action from a played card` membership), and each
 * printed VARIANT row inside it is offered on its own. The bug this file exists
 * to prevent: «Права на астероиды» with 0 asteroids stored offered its whole
 * «астероид отсюда → производство M€ ИЛИ титан» row as available, because that
 * ONE row covers TWO server branches and the client resolved it to a single
 * branch — got `undefined` (ambiguous by construction) and fell back to the
 * CARD's verdict, which was legitimately «yes» thanks to the OTHER row. The
 * player descended into the row and found both options refused with
 * «Недостаточно ресурсов на этой карте» and nothing to press but B.
 *
 * So the corpus is walked at BOTH levels, behaviourally (never a source sniff):
 *  1. the SERVER's own two answers agree — `canAct` never says yes over a
 *     preview whose every branch says no (that would be a dead card offered);
 *  2. the CLIENT's variant verdict — a row whose every branch is blocked is
 *     never `available`, and it always names a concrete reason.
 */
describe('action availability: card level vs variant level', () => {
  type Walk = {card: ICard & IActionCard, module: GameModule, preview: ActionPreview};

  /** Every in-scope action card, previewed against the CURRENT player state. */
  function eachActionCard(player: IPlayer, prep: (card: ICard) => void, fn: (w: Walk) => void): number {
    let walked = 0;
    for (const manifest of ALL_MODULE_MANIFESTS) {
      if (!SCOPE.has(manifest.module)) {
        continue;
      }
      for (const group of [manifest.projectCards, manifest.corporationCards, manifest.preludeCards]) {
        for (const key of Object.keys(group)) {
          const Factory = (group as Record<string, {Factory: new () => ICard}>)[key]?.Factory;
          if (Factory === undefined) {
            continue;
          }
          let card: ICard;
          try {
            card = new Factory();
          } catch {
            continue;
          }
          if (!isIActionCard(card)) {
            continue;
          }
          prep(card);
          let preview: ActionPreview;
          try {
            preview = actionPreview(player, card as ICard & IActionCard);
          } catch {
            // A card whose preview needs richer state than this bare fixture
            // (an expansion object, a played tableau) — out of this guard's reach.
            continue;
          }
          walked++;
          fn({card: card as ICard & IActionCard, module: manifest.module, preview});
        }
      }
    }
    return walked;
  }

  /**
   * `canAct === true` ⇒ at least one branch is available.
   *
   * This is what makes the client's variant rule SAFE: «every branch blocked»
   * can only ever block a row the server also considers blocked, so the console
   * can never refuse an action the engine would have performed. The converse is
   * deliberately NOT asserted — a branch models its own DIFFERENTIATING gate and
   * leaves the card's shared one (Bio Printing Facility's 2 energy) to `canAct`.
   */
  it('a card offered as actable always has a performable branch', () => {
    const fixtures: Array<{label: string, prep: (p: IPlayer, card: ICard) => void}> = [
      {
        label: 'destitute',
        prep: (p) => {
          p.megaCredits = 0; p.steel = 0; p.titanium = 0; p.plants = 0; p.energy = 0; p.heat = 0;
        },
      },
      {
        label: 'rich',
        prep: (p) => {
          p.megaCredits = 200; p.steel = 10; p.titanium = 10; p.plants = 10; p.energy = 10; p.heat = 10;
        },
      },
      {
        label: 'rich, cards loaded',
        prep: (p, card) => {
          p.megaCredits = 200; p.steel = 10; p.titanium = 10; p.plants = 10; p.energy = 10; p.heat = 10;
          if (card.resourceType !== undefined) {
            card.resourceCount = 5;
          }
        },
      },
    ];
    const dead: Array<string> = [];
    let walked = 0;
    let actable = 0;
    for (const fixture of fixtures) {
      const [/* game */, player] = testGame(2);
      walked += eachActionCard(player, (card) => fixture.prep(player, card), ({card, module, preview}) => {
        let can: boolean;
        try {
          can = card.canAct(player);
        } catch {
          return;
        }
        if (!can) {
          return;
        }
        actable++;
        if (preview.branches.length > 0 && preview.branches.every((b) => b.available === false)) {
          dead.push(`${card.name} [${module}] (${fixture.label}): canAct=true, all ${preview.branches.length} branches blocked`);
        }
      });
    }
    // Anti-vacuous floors: a guard that walked nothing, or found nothing
    // actable, is worthless however green it is.
    expect(walked, 'no action cards previewed — the manifest walk broke?').is.greaterThan(150);
    expect(actable, 'no actable cards found — the fixtures stopped enabling anything?').is.greaterThan(60);
    expect(dead, `cards offered as actable whose EVERY branch is refused (the console would open a dead screen):\n  ${dead.join('\n  ')}`)
      .to.deep.eq([]);
  });

  /**
   * The CONSOLE variant verdict, over the real corpus: every printed row whose
   * whole branch set is blocked must be refused with a concrete reason — even
   * while the CARD is offered as available (the exact «Права на астероиды»
   * state, and the two other in-scope cards with the same shape).
   */
  it('a variant whose every branch is blocked is never offered as available', () => {
    const [/* game */, player] = testGame(2);
    player.megaCredits = 0;
    player.steel = 0;
    player.titanium = 0;
    player.plants = 0;
    player.energy = 0;
    player.heat = 0;
    const gaps: Array<string> = [];
    let deadVariants = 0;
    let deadBranchingVariants = 0;
    const walked = eachActionCard(player, () => {}, ({card, module, preview}) => {
      const group = playerActionGroups([{name: card.name} as CardModel])[0];
      if (group === undefined) {
        return;
      }
      // The card itself is offered — the state in which the variant refinement is
      // the ONLY thing standing between the player and a dead screen.
      const entry: ActionEntry = {
        group,
        cardName: card.name,
        isCorporation: group.isCorporation,
        state: {status: 'available', activatable: true, reasons: [], softReason: undefined},
      };
      const previews = new Map<CardName, ActionPreview>([[card.name, preview]]);
      const model = buildConsoleActionsModel(
        [entry], previews, new Map<CardName, {type: CardResource, count: number}>(),
        {availability: 'all', activation: 'all'});
      const tiles = model.groups[0]?.tiles ?? [];
      group.nodes.forEach((_node, i) => {
        const verdict = nodeAvailability(group, preview.branches, i);
        if (!verdict.allBlocked) {
          return;
        }
        deadVariants++;
        if (verdict.branching) {
          deadBranchingVariants++;
        }
        const tile = tiles[i];
        const where = `${card.name} [${module}] variant ${i + 1}/${group.nodes.length}` +
          ` over ${verdict.branches.length} branch(es)`;
        if (tile === undefined) {
          gaps.push(`${where}: no tile built`);
          return;
        }
        if (tile.status === 'available') {
          gaps.push(`${where}: offered as AVAILABLE while every branch is refused`);
        }
        if (tile.reason === undefined) {
          gaps.push(`${where}: blocked with NO reason`);
        }
      });
    });
    expect(walked, 'no action cards previewed — the manifest walk broke?').is.greaterThan(50);
    expect(deadVariants, 'no dead variants found — the fixture stopped blocking?').is.greaterThan(20);
    // The regression's own shape: a printed row standing for SEVERAL server
    // branches, all of them refused. Asteroid Rights, Atmo Collectors and
    // Robinson Industries are in scope; a floor of 3 keeps the case covered.
    expect(deadBranchingVariants, 'no MULTI-branch dead variant found — the bug\'s own shape is no longer exercised').is.greaterThan(2);
    expect(gaps, `variants offered as available (or mute) while every branch inside is refused:\n  ${gaps.join('\n  ')}`)
      .to.deep.eq([]);
  });
});
