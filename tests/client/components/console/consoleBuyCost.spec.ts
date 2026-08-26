import {expect} from 'chai';
import ConsoleTaskHost from '@/client/components/console/ConsoleTaskHost.vue';
import ConsoleDraftWorkspace from '@/client/components/console/draft/ConsoleDraftWorkspace.vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';

/**
 * THE BUY PRICE IS SERVER-AUTHORITATIVE — the console never recomputes it.
 *
 * `PublicPlayerModel.cardCost` is what the server will actually charge
 * (`ChooseCards` → `selected.length × player.cardCost`, whose value already
 * carries the base price AND every permanent modifier — Polyphemos 5,
 * Terralabs 1, Quantum Research −1). Both console purchase surfaces must read
 * exactly that field, so the total the player sees, the affordability gate and
 * the charge can never disagree. The trap this guards is the historical
 * "2 × 17 = −34" bug: reading a card's PLAY cost instead of the buy price.
 *
 * The computeds are exercised directly against a stub `this` — the point is
 * WHICH number they read, and a mount of these two large surfaces would test
 * everything except that.
 */

type Computeds = Record<string, (this: unknown) => unknown>;

const taskHost = (ConsoleTaskHost as unknown as {computed: Computeds}).computed;
const draft = (ConsoleDraftWorkspace as unknown as {computed: Computeds}).computed;

function view(cardCost: number, megacredits: number): PlayerViewModel {
  return {thisPlayer: {cardCost, megacredits}} as unknown as PlayerViewModel;
}

describe('console buy cost (server-authoritative)', () => {
  describe('ConsoleTaskHost (research / deck-pick purchase)', () => {
    function host(cardCost: number, megacredits: number, picks: number) {
      return {
        playerView: view(cardCost, megacredits),
        picks: new Array(picks).fill('card'),
        isBuyMode: true,
      };
    }

    it('takes the per-card price straight off the player model', () => {
      expect(taskHost.buyCostPerCard.call(host(3, 40, 0))).to.eq(3);
      expect(taskHost.buyCostPerCard.call(host(2, 40, 0))).to.eq(2);
      expect(taskHost.buyCostPerCard.call(host(0, 40, 0))).to.eq(0);
    });

    it('totals picks × that price — every card discounted, not just one', () => {
      const ctx = host(2, 40, 3);
      const self = {...ctx, buyCostPerCard: taskHost.buyCostPerCard.call(ctx)};
      expect(taskHost.buyTotal.call(self)).to.eq(6);
    });

    it('affordability and the readout use the SAME total', () => {
      // 4 M€ in hand, 2 cards: unaffordable at 3 M€ each, affordable at 2.
      for (const [cardCost, affordable, remaining] of [[3, false, -2], [2, true, 0]] as const) {
        const ctx = host(cardCost, 4, 2);
        const self = {
          ...ctx,
          buyCostPerCard: taskHost.buyCostPerCard.call(ctx),
          get buyTotal(): number {
            return taskHost.buyTotal.call(this) as number;
          },
          get megacreditsOnHand(): number {
            return taskHost.megacreditsOnHand.call(this) as number;
          },
        };
        expect(self.buyTotal).to.eq(cardCost * 2);
        expect(taskHost.cardBuyAffordable.call(self)).to.eq(affordable);
        expect(taskHost.megacreditsAfterPurchase.call(self)).to.eq(remaining);
      }
    });
  });

  describe('ConsoleDraftWorkspace (between-generation draft buy)', () => {
    function ws(cardCost: number, megacredits: number, picks: number) {
      const ctx = {
        playerView: view(cardCost, megacredits),
        picks: new Array(picks).fill('card'),
        zone: 'buy',
      };
      return {
        ...ctx,
        buyCostPerCard: draft.buyCostPerCard.call(ctx),
        get buyTotal(): number {
          return draft.buyTotal.call(this) as number;
        },
        get megacreditsOnHand(): number {
          return draft.megacreditsOnHand.call(this) as number;
        },
      };
    }

    it('takes the per-card price straight off the player model', () => {
      expect(ws(3, 40, 0).buyCostPerCard).to.eq(3);
      expect(ws(2, 40, 0).buyCostPerCard).to.eq(2);
    });

    it('agrees with the task host on total, remainder and affordability', () => {
      const cheap = ws(2, 4, 2);
      expect(cheap.buyTotal).to.eq(4);
      expect(draft.megacreditsAfterPurchase.call(cheap)).to.eq(0);
      expect(draft.buyAffordable.call(cheap)).is.true;

      const full = ws(3, 4, 2);
      expect(full.buyTotal).to.eq(6);
      expect(draft.buyAffordable.call(full)).is.false;
    });
  });
});
