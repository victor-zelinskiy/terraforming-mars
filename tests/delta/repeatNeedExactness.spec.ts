import {expect} from 'chai';
import {testGame} from '../TestGame';
import {ALL_MODULE_MANIFESTS} from '../../src/server/cards/AllManifests';
import {ICard, isIActionCard} from '../../src/server/cards/ICard';
import {CardName} from '../../src/common/cards/CardName';
import {inPremiumScope} from '../../src/common/cards/premiumScope';
import {actionSteelFrontier, actionStockNeed, withProjectedStock} from '../../src/server/delta/deltaAdvancePlan';
import {DELTA_TRACK_TAGS} from '../../src/server/delta/DeltaProjectExpansion';
import {fakeCard} from '../TestingUtils';
import {Units} from '../../src/common/Units';
import {Tardigrades} from '../../src/server/cards/base/Tardigrades';
import {Birds} from '../../src/server/cards/base/Birds';
import {Dirigibles} from '../../src/server/cards/venusNext/Dirigibles';
import {RestrictedArea} from '../../src/server/cards/base/RestrictedArea';

/**
 * THE REPEAT'S SERVED PRICE IS EXACT — the guard behind «a Hydronetwork move
 * never promises a repeat the commit refuses» (the owner, 2026-11-09).
 *
 * The client threads ONE number per repeat candidate (`reuseActionCosts` =
 * {@link actionStockNeed}) through the movement payment; the server's commit
 * gate is the card's own `canAct` at the projected stock. The two agree only
 * if, along the resources a move can TAKE (energy, and stock steel under
 * Delta Works — every other resource only grows on the way), «canAct» is
 * exactly what the served reading says: «stock ≥ need», or — for an
 * OR-price a vector cannot state (Focused Organization on a table holding
 * only energy and steel) — the served FRONTIER (`actionSteelFrontier`). A
 * card whose availability is not monotone in them breaks both — and this
 * sweep names it, card by card, for every in-scope action card, on a rich and
 * on a lean table.
 *
 * A card the fixture cannot make actable is skipped (its availability hangs
 * on table state — cities, colonies, TR raised — not on energy/steel); the
 * floor below keeps the sweep from quietly collecting nothing.
 */
describe('repeat need exactness (every in-scope action card)', function() {
  // A sweep over the whole card catalogue, not a timing.
  // eslint-disable-next-line no-invalid-this
  this.timeout(30_000);

  it('canAct ⇔ stock ≥ the served need, over the energy × steel grid', () => {
    const offenders: Array<string> = [];
    let probed = 0;
    for (const manifest of ALL_MODULE_MANIFESTS) {
      for (const deck of [manifest.projectCards, manifest.corporationCards, manifest.preludeCards]) {
        for (const [name, entry] of Object.entries(deck as Record<string, {Factory: new () => ICard}>)) {
          if (!inPremiumScope({module: manifest.module, name}) || !isIActionCard(new entry.Factory())) {
            continue;
          }
          for (const lean of [false, true]) {
            const card = new entry.Factory();
            if (!isIActionCard(card)) {
              continue;
            }
            const [game, player] = testGame(2, {
              deltaProjectExpansion: true, coloniesExtension: true, venusNextExtension: true,
              turmoilExtension: true, preludeExtension: true,
            });
            player.playedCards.push(fakeCard({tags: DELTA_TRACK_TAGS.filter((t) => t !== undefined)}));
            player.deltaProjectData!.position = 4;
            // A table the common actions can act on: holders to add to, a used
            // action to copy, production to trade down, cards in hand.
            for (const holder of [new Tardigrades(), new Birds(), new Dirigibles()].filter((h) => h.name !== card.name)) {
              holder.resourceCount = 2;
              player.playedCards.push(holder);
            }
            if (card.name !== CardName.RESTRICTED_AREA) {
              const used = new RestrictedArea();
              player.playedCards.push(used);
              player.actionsThisGeneration.add(used.name);
            }
            player.production.override({megacredits: 5, steel: 2, titanium: 2, plants: 2, energy: 4, heat: 2});
            player.cardsInHand.push(...game.projectDeck.drawN(game, 4));
            if (card.resourceType !== undefined) {
              card.resourceCount = 6;
            }
            player.playedCards.push(card);
            player.actionsThisGeneration.add(card.name);

            const other = lean ? 0 : 20;
            const live: Units = {megacredits: lean ? 0 : 60, steel: 6, titanium: other, plants: other, energy: 6, heat: other};
            const actsAt = (stock: Units) => withProjectedStock(player, stock, () => card.canAct(player));
            if (!actsAt(live)) {
              continue;
            }
            probed++;
            const need = withProjectedStock(player, live, () => actionStockNeed(player, card.name));
            const frontier = withProjectedStock(player, live, () => actionSteelFrontier(player, card.name, need));
            grid: for (let e = 0; e <= live.energy; e++) {
              for (let s = 0; s <= live.steel; s++) {
                const real = actsAt({...live, energy: e, steel: s});
                const least = frontier?.[e];
                const served = frontier !== undefined ?
                  least !== null && least !== undefined && s >= least :
                  e >= (need.energy ?? 0) && s >= (need.steel ?? 0);
                if (real !== served) {
                  offenders.push(`${name} (${lean ? 'lean' : 'rich'} table): served need ${JSON.stringify(need)} ` +
                    `frontier ${JSON.stringify(frontier)}, ` +
                    `but canAct is ${String(real)} at ${e} energy / ${s} steel`);
                  break grid;
                }
              }
            }
          }
        }
      }
    }
    expect(offenders, offenders.join('\n')).deep.eq([]);
    expect(probed, 'the sweep reached the action cards (a fixture regression would collect nothing)').gte(250);
  });
});

describe('the OR-price frontier (Focused Organization: «any 1 standard resource»)', () => {
  it('a table holding only energy and steel: the vector says nothing, the frontier says «one of the two»', () => {
    const [game, player] = testGame(2, {deltaProjectExpansion: true, preludeExtension: true});
    const card = ALL_MODULE_MANIFESTS.flatMap((m) => Object.entries(m.preludeCards as Record<string, {Factory: new () => ICard}>))
      .find(([n]) => n === CardName.FOCUSED_ORGANIZATION)?.[1];
    const fo = new card!.Factory();
    player.playedCards.push(fo);
    player.actionsThisGeneration.add(fo.name);
    player.cardsInHand.push(...game.projectDeck.drawN(game, 2));
    player.megaCredits = 0;
    player.energy = 2;
    player.steel = 1;
    const need = actionStockNeed(player, fo.name);
    expect(need).deep.eq({});
    // energy 0 → 1 steel needed; any energy → none.
    expect(actionSteelFrontier(player, fo.name, need)).deep.eq([1, 0, 0]);
    player.megaCredits = 5;
    expect(actionSteelFrontier(player, fo.name, actionStockNeed(player, fo.name)), 'a vector-exact table serves no frontier').is.undefined;
  });
});
