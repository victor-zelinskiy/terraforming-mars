import {expect} from 'chai';
import {UtopiaInvest} from '../../../src/server/cards/turmoil/UtopiaInvest';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {cast} from '@/common/utils/utils';
import {testGame} from '../../TestGame';
import {churn, runAllActions} from '../../TestingUtils';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {Phase} from '../../../src/common/Phase';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Tag} from '../../../src/common/cards/Tag';
import {Resource} from '../../../src/common/Resource';
import {isTurmoilCardHeldBackUnderRedux} from '../../../src/server/cards/turmoil/turmoilReduxAdaptation';
import {actionPreview} from '../../../src/server/models/actionPreview';
import {actionUnavailableReasons} from '../../../src/server/models/actionUnavailableReasons';
import {potentialActions} from '../../../src/server/models/potentialActions';

describe('UtopiaInvest', () => {
  it('Should play', () => {
    const card = new UtopiaInvest();
    const [/* game */, player] = testGame(2, {turmoilExtension: true});
    cast(card.play(player), undefined);

    expect(player.production.titanium).to.eq(1);
    expect(player.production.steel).to.eq(1);

    const action = cast(churn(card.action(player), player), OrOptions);
    action.options[2].cb();

    expect(player.titanium).to.eq(4);
    expect(player.production.titanium).to.eq(0);
  });
});

/**
 * R33 — UTOPIA INVEST ON A TURMOIL REDUX TABLE: the third classic Turmoil corporation adapted in place
 * (`docs/TURMOIL_REDUX_CLASSIC_CARDS.md` §3.1). No live hook and no politics — the action is six DECLARATIVE `or`
 * variants «production −1 → +4 of that resource», so the preview, the availability, the composer's tiles and the
 * ACTION COMMIT read it from the box. The work is the proof: every variant pinned at its floor against the server.
 */
describe('UtopiaInvest — on a Turmoil Redux table', () => {
  /** The printed order of the six variants (the card's `or.behaviors`). */
  const ORDER: ReadonlyArray<Resource> = [Resource.MEGACREDITS, Resource.STEEL, Resource.TITANIUM, Resource.PLANTS, Resource.ENERGY, Resource.HEAT];

  function table(): {game: IGame, p1: TestPlayer, p2: TestPlayer, card: UtopiaInvest} {
    const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
    game.phase = Phase.ACTION;
    const card = new UtopiaInvest();
    p1.playCorporationCard(card);
    runAllActions(game);
    return {game, p1, p2, card};
  }

  /** Set every production to an exact value (the table starts with steel 1 / titanium 1 from the play). */
  function setProduction(p: TestPlayer, units: Partial<Record<Resource, number>>): void {
    for (const r of ORDER) {
      p.production.override({...p.production.asUnits(), [r]: units[r] ?? 0});
    }
  }

  it('rule 1 — the printed corporation: 40 M€, Building, steel + titanium production, no first action, R33', () => {
    const c = new UtopiaInvest();
    expect(c.name).eq(CardName.UTOPIA_INVEST);
    expect(c.type).eq(CardType.CORPORATION);
    expect(c.startingMegaCredits).eq(40);
    expect(c.tags).deep.eq([Tag.BUILDING]);
    expect(c.behavior?.production).deep.eq({steel: 1, titanium: 1});
    expect(c.firstAction).is.undefined;
    expect(c.metadata.cardNumber).eq('R33');
    expect(c.metadata.infoText?.map((line) => line.text)).deep.eq(['Lower any production 1 step: gain 4 of that resource']);
    expect(c.actionBehavior?.or?.behaviors.map((b) => b.production)).deep.eq(ORDER.map((r) => ({[r]: -1})));
    expect(c.actionBehavior?.or?.behaviors.map((b) => b.stock)).deep.eq(ORDER.map((r) => ({[r]: 4})));
    expect(c.actionBehavior?.or?.autoSelect).is.not.true;
  });

  it('rule 1 — Turmoil Redux deals it: no longer held back; the play gives 40 M€ and +1 steel / titanium production', () => {
    const {game, p1} = table();
    expect(isTurmoilCardHeldBackUnderRedux(CardName.UTOPIA_INVEST, game.gameOptions)).is.false;
    expect(p1.playedCards.corporations().map((c) => c.name)).deep.eq([CardName.UTOPIA_INVEST]);
    expect(p1.megaCredits).eq(40);
    expect(p1.production.steel).eq(1);
    expect(p1.production.titanium).eq(1);
  });

  describe('rule 2 — the six variants', () => {
    it('the starting table: M€ (0 → −1), steel and titanium are live; plants, energy and heat are refused with their reason', () => {
      const {p1, card} = table();
      const preview = actionPreview(p1, card);
      expect(preview.branches.map((b) => b.available)).deep.eq([true, true, true, false, false, false]);
      // The runtime OrOptions index is the position among the EXECUTABLE variants; a refused one is −1.
      expect(preview.branches.map((b) => b.index)).deep.eq([0, 1, 2, -1, -1, -1]);
      // The owner's call (2026-10-23): the classic line — the tile's own picture names the resource.
      expect(preview.branches.slice(3).map((b) => b.unavailableReason)).deep.eq(['Cannot reduce production', 'Cannot reduce production', 'Cannot reduce production']);
    });

    it('every variant states BOTH axes with the server\'s numbers: production current → resulting, stock current → resulting', () => {
      const {p1, card} = table();
      setProduction(p1, {megacredits: 2, steel: 1, titanium: 1, plants: 3, energy: 1, heat: 2});
      p1.stock.override({megacredits: 7, steel: 2, titanium: 0, plants: 5, energy: 1, heat: 9});
      const preview = actionPreview(p1, card);
      expect(preview.branches).length(6);
      preview.branches.forEach((b, i) => {
        const r = ORDER[i];
        const prod = b.effects.find((e) => e.note === 'production');
        const stock = b.effects.find((e) => e.note === undefined);
        expect(prod, r).to.deep.include({direction: 'cost', icon: r, amount: 1, current: p1.production[r], resulting: p1.production[r] - 1});
        expect(stock, r).to.deep.include({direction: 'gain', icon: r, amount: 4, current: p1.stock.get(r), resulting: p1.stock.get(r) + 4});
      });
    });

    it('the floors: steel 1 → live, 0 → refused; M€ −4 → live, −5 → refused', () => {
      const {p1, card} = table();
      setProduction(p1, {megacredits: -4, steel: 1});
      let b = actionPreview(p1, card).branches;
      expect(b[0].available, 'M€ at −4').is.true;
      expect(b[1].available, 'steel at 1').is.true;
      setProduction(p1, {megacredits: -5, steel: 0, titanium: 1});
      b = actionPreview(p1, card).branches;
      expect(b[0].available, 'M€ at −5').is.false;
      expect(b[0].unavailableReason).eq('Cannot reduce production');
      expect(b[1].available, 'steel at 0').is.false;
      expect(b.map((x) => x.index)).deep.eq([-1, -1, 0, -1, -1, -1]);
    });

    for (const r of ORDER) {
      it(`executing the ${r} variant: production −1, +4 ${r} in stock, journalled with the card as the source`, () => {
        const {game, p1, card} = table();
        setProduction(p1, {megacredits: 1, steel: 1, titanium: 1, plants: 1, energy: 1, heat: 1});
        const before = {prod: p1.production[r], stock: p1.stock.get(r)};
        const logBefore = game.gameLog.length;
        const or = cast(churn(card.action(p1), p1), OrOptions);
        expect(or.options).length(6);
        or.options[ORDER.indexOf(r)].cb();
        runAllActions(game);
        expect(p1.production[r]).eq(before.prod - 1);
        expect(p1.stock.get(r)).eq(before.stock + 4);
        // The other five productions never move.
        for (const other of ORDER.filter((o) => o !== r)) {
          expect(p1.production[other], other).eq(1);
        }
        expect(game.gameLog.length, 'the executor logs the change').greaterThan(logBefore);
      });
    }

    it('the runtime index lands on the right variant when the refused ones are skipped (only titanium + heat live)', () => {
      const {game, p1, card} = table();
      setProduction(p1, {megacredits: -5, titanium: 1, heat: 2});
      const preview = actionPreview(p1, card);
      expect(preview.branches.map((b) => b.index)).deep.eq([-1, -1, 0, -1, -1, 1]);
      const or = cast(churn(card.action(p1), p1), OrOptions);
      expect(or.options).length(2);
      or.options[preview.branches[5].index].cb();
      runAllActions(game);
      expect(p1.production.heat).eq(1);
      expect(p1.heat).eq(4);
      expect(p1.production.titanium).eq(1);
    });

    it('a SOLE live variant is still a choice the player sees — never auto-selected by the server', () => {
      const {p1, card} = table();
      setProduction(p1, {megacredits: -5, steel: 1});
      const preview = actionPreview(p1, card);
      expect(preview.branches.filter((b) => b.available)).length(1);
      expect(preview.branches[1].index, 'the lone branch keeps its runtime index (no autoSelect)').eq(0);
    });

    it('ALL six dead (M€ at −5, every other production 0): the action is unavailable with ONE reason', () => {
      const {p1, card} = table();
      setProduction(p1, {megacredits: -5});
      expect(card.canAct(p1)).is.false;
      expect(actionUnavailableReasons(p1, card)).deep.eq([{type: 'production', message: 'Cannot reduce production'}]);
      expect(p1.getPlayableActionCards().map((c) => c.name)).not.include(CardName.UTOPIA_INVEST);
    });

    it('once per generation: used → not actable again until the next generation', () => {
      const {game, p1, card} = table();
      expect(p1.getPlayableActionCards().map((c) => c.name)).include(CardName.UTOPIA_INVEST);
      p1.actionsThisGeneration.add(card.name);
      expect(p1.getPlayableActionCards().map((c) => c.name)).not.include(CardName.UTOPIA_INVEST);
      expect(potentialActions(p1).cardActions).eq(p1.getPlayableActionCards().length);
      void game;
    });
  });

  it('rule 3 — the model: the action counts in the owner\'s potential actions', () => {
    const {p1} = table();
    expect(p1.getPlayableActionCards().map((c) => c.name)).include(CardName.UTOPIA_INVEST);
    expect(potentialActions(p1).cardActions).greaterThanOrEqual(1);
  });
});
