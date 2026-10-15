import {expect} from 'chai';
import {groupDecided, heroFigure, heroOfEffect, paletteOf, printedVariantRows, variantOptionClasses, variantRecedes, VariantChoiceState} from '../../src/client/console/variantChoiceModel';
import {OverclockedEquipment} from '../../src/server/cards/turmoilRedux/OverclockedEquipment';
import {cardPlayPreview} from '../../src/server/models/cardPlayPreview';
import {sharedLeadingEffects} from '../../src/client/console/consolePlayCardComposer';
import {testGame} from '../TestGame';
import {Phase} from '../../src/common/Phase';
import {ActionEffect} from '../../src/common/models/ActionPreviewModel';
import {InfluentialDiscovery} from '../../src/server/cards/turmoilRedux/InfluentialDiscovery';
import {IchtiologyGrant} from '../../src/server/cards/turmoilRedux/IchtiologyGrant';
import {ExpeditionMechs} from '../../src/server/cards/turmoilRedux/ExpeditionMechs';
import {Algae} from '../../src/server/cards/base/Algae';
import {CardRenderItemType} from '../../src/common/cards/render/CardRenderItemType';
import {isICardRenderEffect, isICardRenderItem, ItemType} from '../../src/common/cards/render/Types';
import {CardComponent} from '../../src/common/cards/render/CardComponent';

/**
 * THE VARIANT CHOICE — the pure half of the ONE grammar of «choose one of these» (TR51, `variantChoiceModel.ts`).
 * Three facts, three paints (cursor · answer · rules); a decided group's other options recede; and the PRINTED ROW of
 * each option is the card face's own node references, sliced at the printed OR — never a copy, never a guess.
 */
const state = (focused: boolean, selected: boolean, off: boolean): VariantChoiceState => ({focused, selected, off});
const render = (card: {metadata: {renderData?: unknown}}) => card.metadata.renderData as CardComponent;
const typeOf = (node: ItemType): string | undefined => (node !== undefined && node !== null && typeof node !== 'string' && isICardRenderItem(node) ? node.type : undefined);

describe('variantChoiceModel', () => {
  describe('state → paint', () => {
    it('a group is DECIDED once one option is the answer', () => {
      expect(groupDecided([{state: state(false, false, false)}, {state: state(true, false, false)}])).is.false;
      expect(groupDecided([{state: state(false, true, false)}, {state: state(true, false, false)}])).is.true;
    });

    it('in a decided group the other LIVE options recede — never the answer, never the cursor\'s option, never a refused one', () => {
      const rows: Array<[VariantChoiceState, boolean, boolean]> = [
        // state, decided → recedes
        [state(false, false, false), false, false],
        [state(false, false, false), true, true],
        [state(true, false, false), true, false],
        [state(false, true, false), true, false],
        [state(false, false, true), true, false],
      ];
      for (const [state, decided, expected] of rows) {
        expect(variantRecedes(state, decided), JSON.stringify({state, decided})).eq(expected);
      }
    });

    it('the classes are the three facts, each its own class (the cursor and the answer may stand on one tile)', () => {
      expect(variantOptionClasses(state(true, true, false), true)).deep.eq({
        'con-vchoice__opt--focused': true, 'con-vchoice__opt--selected': true, 'con-vchoice__opt--off': false, 'con-vchoice__opt--recede': false,
      });
      expect(variantOptionClasses(state(false, false, true), false)).deep.include({'con-vchoice__opt--off': true, 'con-vchoice__opt--recede': false});
    });
  });

  describe('the PRINTED ROW — the face\'s own nodes of each option', () => {
    it('TR51 «[science]* OR 6 [data]*» — one printed row split at the interior OR: the science and its asterisk, the 6 data and its asterisk', () => {
      const card = new InfluentialDiscovery();
      const rows = printedVariantRows(render(card), 2)!;
      expect(rows).has.length(2);
      expect(rows[0].map(typeOf)[0]).eq(CardRenderItemType.RESOURCE);
      expect(rows[1].map(typeOf)[0]).eq(CardRenderItemType.RESOURCE);
      expect((rows[1][0] as {amount?: number}).amount).eq(6);
      expect(rows.every((r) => r.length === 2), 'each keeps its asterisk («to ANY card»)').is.true;
      // REFERENCES into the card's own tree — the slice is the face, never a copy.
      const tree = (render(card) as unknown as {rows: Array<Array<ItemType>>}).rows[0];
      expect(tree).to.include(rows[0][0]);
      expect(tree).to.include(rows[1][0]);
    });

    it('TR43 — the production row stands apart; the «2 [animal]* OR 4 [microbe]*» row is the choice', () => {
      const rows = printedVariantRows(render(new IchtiologyGrant()), 2)!;
      expect(rows.map((r) => (r[0] as {amount?: number}).amount)).deep.eq([2, 4]);
    });

    it('TR50 — an action\'s two variants are two rows joined by the face\'s «ИЛИ» divider: one effect box each', () => {
      const rows = printedVariantRows(render(new ExpeditionMechs()), 2)!;
      expect(rows).has.length(2);
      expect(rows.every((r) => r.length === 1 && isICardRenderEffect(r[0] as never))).is.true;
    });

    it('UNAMBIGUOUS or nothing: a card with no printed OR, a count that does not match, a single option', () => {
      expect(printedVariantRows(render(new Algae()), 2)).is.undefined;
      expect(printedVariantRows(render(new InfluentialDiscovery()), 3)).is.undefined;
      expect(printedVariantRows(render(new InfluentialDiscovery()), 1)).is.undefined;
      expect(printedVariantRows(undefined, 2)).is.undefined;
    });
  });

  describe('THE PALETTE (TR54) — N options of one kind, each led by its hero', () => {
    const gain = (icon: string, amount: number, note?: string): ActionEffect => ({direction: 'gain', icon, amount, current: 1, resulting: 1 + amount, ...(note !== undefined ? {note} : {})});

    it('a hero is a standard resource gained into the stock, or a production of one — nothing else', () => {
      expect(heroOfEffect(gain('plants', 3))).deep.eq({kind: 'resource', icon: 'plants', amount: 3, direction: 'gain'});
      expect(heroOfEffect(gain('steel', 1, 'production'))).deep.eq({kind: 'production', icon: 'steel', amount: 1, direction: 'gain'});
      expect(heroOfEffect({direction: 'cost', icon: 'heat', amount: 1, note: 'production'})).deep.include({kind: 'production', direction: 'loss'});
      expect(heroOfEffect(gain('microbe', 2)), 'a card resource has its own grammar').is.undefined;
      expect(heroOfEffect(gain('plants', 2, 'to a card')), 'a note of its own is not a stock gain').is.undefined;
      expect(heroOfEffect(gain('tr', 1))).is.undefined;
      expect(heroOfEffect(undefined)).is.undefined;
    });

    it('a palette: every option a hero, all of ONE kind, at least three (or the floor of the host)', () => {
      const r = (icon: string) => ({hero: heroOfEffect(gain(icon, 1))});
      const p = (icon: string) => ({hero: heroOfEffect(gain(icon, 1, 'production'))});
      expect(paletteOf([r('steel'), r('titanium'), r('plants')])).is.true;
      expect(paletteOf([r('steel'), r('titanium')]), 'two are a comparison, not a palette').is.false;
      expect(paletteOf([p('steel'), p('titanium')], 2), 'the «+1 production» row of the Industrialists').is.true;
      expect(paletteOf([r('steel'), p('titanium'), r('plants')]), 'two kinds').is.false;
      expect(paletteOf([r('steel'), {hero: undefined}, r('plants')]), 'an option without a hero').is.false;
      expect(paletteOf([])).is.false;
    });

    it('the number reads «+N», «−N», a zero bare', () => {
      expect(heroFigure({kind: 'resource', icon: 'plants', amount: 3, direction: 'gain'})).eq('+3');
      expect(heroFigure({kind: 'production', icon: 'heat', amount: 1, direction: 'loss'})).eq('−1');
      expect(heroFigure({kind: 'resource', icon: 'titanium', amount: 0, direction: 'gain'})).eq('0');
    });

    it('the play of TR54 is a palette of six: the price shared above the row, the own chip of every option a resource hero, no printed slice', () => {
      const [game, player] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
      game.phase = Phase.ACTION;
      player.energy = 5;
      player.production.override({megacredits: -1, steel: 2, titanium: 0, plants: 3, energy: 1, heat: 4});
      const card = new OverclockedEquipment();
      const branches = cardPlayPreview(player, card).branches;
      const shared = sharedLeadingEffects(branches);
      expect(shared.map((e) => [e.direction, e.icon, e.amount])).deep.eq([['cost', 'energy', 3]]);
      const heroes = branches.map((b) => heroOfEffect(b.effects[shared.length]));
      expect(heroes.map((h) => [h?.icon, h?.amount])).deep.eq([['megacredits', 0], ['steel', 2], ['titanium', 0], ['plants', 3], ['energy', 1], ['heat', 4]]);
      expect(paletteOf(heroes.map((hero) => ({hero})))).is.true;
      expect(printedVariantRows(render(card), 6), 'the printed «?» row has no OR to slice').is.undefined;
    });
  });
});
