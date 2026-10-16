import {expect} from 'chai';
import {testGame} from '../TestGame';
import {ALL_MODULE_MANIFESTS} from '../../src/server/cards/AllManifests';
import {isIActionCard, ICard, IActionCard} from '../../src/server/cards/ICard';
import {GameModule} from '../../src/common/cards/GameModule';
import {CardModel} from '../../src/common/models/CardModel';
import {CardName} from '../../src/common/cards/CardName';
import {CardRenderItemType} from '../../src/common/cards/render/CardRenderItemType';
import {ICardRenderEffect, ItemType, isICardRenderEffect, isICardRenderItem, isICardRenderProductionBox} from '../../src/common/cards/render/Types';
import {actionPreview} from '../../src/server/models/actionPreview';
import {IPlayer} from '../../src/server/IPlayer';
import {playerActionGroups} from '../../src/client/components/actions/actionExtraction';
import {assignPrintedAlternatives, branchPositionsForNode, buildBranchViews, printedAlternatives, printedSegmentDescription} from '../../src/client/components/actions/actionBranchView';
import {AtmoCollectors} from '../../src/server/cards/colonies/AtmoCollectors';
import {AsteroidRights} from '../../src/server/cards/promo/AsteroidRights';

const SCOPE = new Set<GameModule>(['base', 'corpera', 'promo', 'venus', 'colonies', 'prelude', 'ares', 'deltaProject', 'turmoilRedux']);

/**
 * THE PRINTED ROW OF ONE BRANCH (`BranchView.printed`) — the option tile's headline.
 *
 * The owner's 4K photo of 2026-10-13: «Сбор атмосферы» draws ONE action row the server splits into THREE branches
 * («аэростат → 2 титан / 3 энергия / 4 тепло»), and every option tile printed the WHOLE row — three tiles, each
 * promising all three outcomes. The slice: a row shared by several branches is cut at its printed «/» and «ИЛИ»
 * (`printedAlternatives`), and each branch CLAIMS the segment its title names (`assignPrintedAlternatives`) —
 * unambiguous or nothing, because a wrong graphic on an option is the lie the slice exists to end.
 *
 * The corpus walk is the worklist: every in-scope action card whose row is shared is either sliced whole (every
 * branch of the row has its own segment, each a reference into the face's own tree) or not sliced at all, and the
 * cards the print cannot split are a frozen list — a new card that lands on it, or a slice that stops working, fails
 * here with its name.
 */
const typeOf = (node: ItemType): string | undefined => (node !== undefined && node !== null && typeof node !== 'string' && isICardRenderItem(node) ? node.type : undefined);
const amountOf = (node: ItemType): number | undefined => (node !== undefined && node !== null && typeof node !== 'string' && isICardRenderItem(node) ? node.amount : undefined);

function groupOf(card: ICard) {
  const group = playerActionGroups([{name: card.name} as CardModel])[0];
  expect(group, `${card.name}: an action group`).is.not.undefined;
  return group;
}

describe('actionBranchView · the printed row of ONE branch', () => {
  it('Atmo Collectors — three branches off one printed row: each tile prints ITS outcome, the add-a-floater row stays whole', () => {
    const [/* game */, player] = testGame(2);
    const card = new AtmoCollectors();
    const group = groupOf(card);
    const preview = actionPreview(player, card as ICard & IActionCard);
    const views = buildBranchViews(card.name, group, preview.branches);
    const byTitle = new Map(views.map((v) => [typeof v.branch.title === 'string' ? v.branch.title : v.branch.title.message, v]));

    const titanium = byTitle.get('Remove 1 floater to gain 2 titanium')!.printed!;
    const energy = byTitle.get('Remove 1 floater to gain 3 energy')!.printed!;
    const heat = byTitle.get('Remove 1 floater to gain 4 heat')!.printed!;
    expect(titanium.map(typeOf)).deep.eq([CardRenderItemType.TITANIUM]);
    expect(energy.map(typeOf)).deep.eq([CardRenderItemType.ENERGY]);
    expect(heat.map(typeOf)).deep.eq([CardRenderItemType.HEAT]);
    expect([titanium, energy, heat].map((seg) => amountOf(seg[0]))).deep.eq([2, 3, 4]);

    // References into the card's own render tree — the slice is the face, never a copy.
    const spendRow = group.nodes[1].actionNode as ICardRenderEffect;
    expect(spendRow.rows[2]).to.include(titanium[0]);
    expect(spendRow.rows[2]).to.include(energy[0]);
    expect(spendRow.rows[2]).to.include(heat[0]);

    // The row the add-a-floater branch has to itself prints WHOLE (its printed OR stripped), as before.
    const add = byTitle.get('Add 1 floater to this card')!.printed!;
    expect(add).has.length(1);
    expect(isICardRenderEffect(add[0] as never), 'the whole action box').is.true;
  });

  it('Asteroid Rights — an interior OR: the M€-production branch prints the production box, the titanium branch its 2 titanium', () => {
    const [/* game */, player] = testGame(2);
    const card = new AsteroidRights();
    const group = groupOf(card);
    const preview = actionPreview(player, card);
    const views = buildBranchViews(card.name, group, preview.branches);
    const byTitle = new Map(views.map((v) => [typeof v.branch.title === 'string' ? v.branch.title : v.branch.title.message, v]));

    const production = byTitle.get('Remove 1 asteroid on this card to increase M€ production 1 step')!.printed!;
    const titanium = byTitle.get('Remove 1 asteroid on this card to gain 2 titanium')!.printed!;
    expect(production).has.length(1);
    expect(isICardRenderProductionBox(production[0] as never), 'the production plate').is.true;
    expect(titanium.map(typeOf)).deep.eq([CardRenderItemType.TITANIUM]);
    expect(amountOf(titanium[0])).eq(2);
    const spendRow = group.nodes[1].actionNode as ICardRenderEffect;
    expect(spendRow.rows[2]).to.include(production[0]);
    expect(spendRow.rows[2]).to.include(titanium[0]);
  });

  describe('assignPrintedAlternatives — unambiguous or nothing', () => {
    const item = (type: CardRenderItemType, amount: number): ItemType => ({is: 'item', type, amount} as unknown as ItemType);
    const segments = [[item(CardRenderItemType.TITANIUM, 2)], [item(CardRenderItemType.ENERGY, 3)], [item(CardRenderItemType.HEAT, 4)]];

    it('each title claims the segment its words name, in ANY order', () => {
      expect(assignPrintedAlternatives(['gain 4 heat', 'gain 2 titanium', 'gain 3 energy'], segments)).deep.eq([2, 0, 1]);
    });

    it('a title that names no segment, or two titles that name the same one, refuse the slice', () => {
      expect(assignPrintedAlternatives(['gain 4 heat', 'gain 2 titanium', 'draw a card'], segments)).is.undefined;
      expect(assignPrintedAlternatives(['gain 4 heat', 'gain more heat', 'gain 3 energy'], segments)).is.undefined;
      expect(assignPrintedAlternatives(['gain 4 heat', 'gain 2 titanium'], segments), 'a count that does not match').is.undefined;
    });

    it('«M€» in a title names the printed megacredits (the sign is not a letter)', () => {
      const money = [[{is: 'production-box', rows: [[item(CardRenderItemType.MEGACREDITS, 1)]]} as unknown as ItemType], [item(CardRenderItemType.TITANIUM, 2)]];
      expect(printedSegmentDescription(money[0])).to.contain('production');
      expect(assignPrintedAlternatives(['increase M€ production 1 step', 'gain 2 titanium'], money)).deep.eq([0, 1]);
    });

    it('a plural in the title still names a singular print («2 plants» ↔ plants, «floaters» ↔ floater)', () => {
      const plants = [[item(CardRenderItemType.PLANTS, 2)], [{is: 'item', type: CardRenderItemType.RESOURCE, amount: 1, resource: 'Floater'} as unknown as ItemType]];
      expect(assignPrintedAlternatives(['gain 2 plants', 'add 2 floaters to this card'], plants)).deep.eq([0, 1]);
    });

    it('a row without a printed seam has no alternatives', () => {
      expect(printedAlternatives({is: 'effect', rows: [[], [], [item(CardRenderItemType.TITANIUM, 2)]]} as unknown as ICardRenderEffect)).deep.eq([]);
    });
  });

  /**
   * THE WORKLIST. In-scope action cards whose printed row is shared by several branches and which the print cannot
   * split today (no «/» / «ИЛИ» seam on the row — the whole action drawn as one line over N outcomes, or a seam whose
   * segments the titles do not name). Their tiles speak in words and chips. A card leaving this list is progress —
   * lock it in here; a card ARRIVING on it is a regression (or a new card whose row wants a seam) — name it.
   */
  const KNOWN_UNSLICED: ReadonlyArray<string> = [
    // ONE printed row («→ +1 production of your lowest») over six branches — no seam to cut: words and chips.
    'Robinson Industries [prelude]',
    // TR58 «3 [plant] OR 5 [heat] → 3 [floater]*» — the seam on the PRICE side; the price slice lands with the
    // composer's price plates (TR58 §2.Е) and removes this row in the same diff.
    'Reprocessing Plant [turmoilRedux]',
  ];

  it('corpus: a shared printed row is sliced WHOLE or not at all, every segment a face reference, no two branches the same', () => {
    const [/* game */, player] = testGame(2);
    const sliced: Array<string> = [];
    const unsliced: Array<string> = [];
    const gaps: Array<string> = [];
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
          let branches;
          try {
            branches = actionPreview(player as IPlayer, card as ICard & IActionCard).branches;
          } catch {
            continue;
          }
          const actionGroup = playerActionGroups([{name: card.name} as CardModel])[0];
          if (actionGroup === undefined || branches.length < 2) {
            continue;
          }
          walked++;
          const views = buildBranchViews(card.name as CardName, actionGroup, branches);
          actionGroup.nodes.forEach((node, ni) => {
            const positions = branchPositionsForNode(actionGroup, branches, ni);
            if (positions.length < 2 || node.actionNode === undefined) {
              return;
            }
            const where = `${card.name} [${manifest.module}] row ${ni + 1}/${actionGroup.nodes.length} over ${positions.length} branches`;
            const prints = positions.map((p) => views[p].printed);
            const defined = prints.filter((p) => p !== undefined);
            if (defined.length === 0) {
              unsliced.push(where);
              return;
            }
            if (defined.length !== prints.length) {
              gaps.push(`${where}: HALF sliced (${defined.length} of ${prints.length})`);
              return;
            }
            sliced.push(where);
            const result = node.actionNode.rows[2] ?? [];
            const seen = new Set<ItemType>();
            prints.forEach((print, k) => {
              for (const item of print!) {
                if (!result.includes(item)) {
                  gaps.push(`${where}: branch ${positions[k]} prints an item that is not on the row (a copy, not a reference)`);
                }
              }
              const head = print![0];
              if (seen.has(head)) {
                gaps.push(`${where}: two branches print the same segment`);
              }
              seen.add(head);
            });
          });
        }
      }
    }
    expect(walked, 'no branching action cards walked — the manifest walk broke?').is.greaterThan(30);
    expect(sliced.some((w) => w.startsWith('Atmo Collectors')), 'Atmo Collectors is sliced').is.true;
    expect(sliced.some((w) => w.startsWith('Asteroid Rights')), 'Asteroid Rights is sliced').is.true;
    expect(sliced.some((w) => w.startsWith('AstroDrill')), 'AstroDrill\'s «[asteroid]* / [?]» row is sliced').is.true;
    expect(gaps, `shared rows sliced wrongly:\n  ${gaps.join('\n  ')}`).to.deep.eq([]);
    expect(unsliced.map((w) => w.split(' row ')[0]).sort(), `the shared rows the print cannot split — the worklist (sliced: ${sliced.length})`)
      .to.deep.eq([...KNOWN_UNSLICED].sort());
  });
});
