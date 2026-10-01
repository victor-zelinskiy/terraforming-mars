import {expect} from 'chai';
import {
  REVEAL_POOL_EMPTY_WARNING, revealCheckGlyph, revealKey, revealKeptCardHeld, revealPreviewReading,
  revealRewardStock, revealVerdictReading,
} from '@/client/console/revealReading';
import {RevealResultModel} from '@/common/models/RevealResultModel';
import {ActionRevealDescriptor} from '@/common/models/ActionPreviewModel';
import {CardName} from '@/common/cards/CardName';
import {Tag} from '@/common/cards/Tag';
import {PartyName} from '@/common/turmoil/PartyName';

const M5 = {direction: 'gain', icon: 'megacredits', amount: 5, current: 12, resulting: 17} as const;

function verdict(over: Partial<RevealResultModel>): RevealResultModel {
  return {
    action: CardName.POLITICAL_THINK_TANK,
    revealed: {name: CardName.WILDLIFE_DOME} as RevealResultModel['revealed'],
    conditionMet: true,
    ...over,
  };
}

/**
 * WHAT A DECK CHECK SAYS — the pure reading behind the composer's «до» and the
 * verdict panel (ConsoleRevealVerdict only draws it). TR13 is what it was
 * written for: a NON-tag check, a STOCK reward, a KEPT card.
 */
describe('revealReading', () => {
  describe('the check glyph — one symbol, one concept', () => {
    it('a tag check draws the tag, a party requirement its plate, nothing else draws nothing', () => {
      expect(revealCheckGlyph({tag: Tag.MICROBE})).deep.eq({kind: 'tag', url: 'assets/tags/microbe.png'});
      expect(revealCheckGlyph({icon: 'party-requirement'})).deep.eq({kind: 'party-requirement'});
      expect(revealCheckGlyph({})).deep.eq({kind: 'none'});
      expect(revealCheckGlyph(undefined)).deep.eq({kind: 'none'});
    });
  });

  describe('the composer «до»', () => {
    const tank = (count: number): ActionRevealDescriptor => ({
      deck: 'project', check: {icon: 'party-requirement', label: 'Party requirement'}, reward: M5, keepsCard: true, pool: {count},
    });

    it('a kept reveal gains TWO chips: the card «в руку» first, then the reward', () => {
      const r = revealPreviewReading(tank(3));
      expect(r.gains).deep.eq([{direction: 'gain', icon: 'cards', amount: 1, note: 'to hand'}, M5]);
      expect(r.check).deep.eq({glyph: {kind: 'party-requirement'}, label: 'Party requirement'});
      expect(r.pool).deep.eq({count: 3, empty: false, key: 'Cards with a party requirement in this game: ${0}'});
    });

    it('a zero pool is EMPTY (the surface warns; the action stays legal)', () => {
      expect(revealPreviewReading(tank(0)).pool?.empty).eq(true);
      expect(REVEAL_POOL_EMPTY_WARNING).eq('The check cannot succeed now: this game has no such cards');
    });

    it('a tag check without a pool: one reward chip, no pool line (Search For Life unchanged)', () => {
      const r = revealPreviewReading({deck: 'project', check: {tag: Tag.MICROBE, label: 'Microbe tag'},
        reward: {direction: 'gain', icon: 'science', amount: 1, note: 'on this card'}});
      expect(r.gains.map((g) => g.icon)).deep.eq(['science']);
      expect(r.pool).is.undefined;
      expect(r.check.glyph.kind).eq('tag');
    });
  });

  describe('the verdict', () => {
    it('a MATCH that keeps the card: the party found, the card + M€ reward, the fate «в руку»', () => {
      const r = revealVerdictReading(verdict({
        check: {icon: 'party-requirement', label: 'Party requirement', party: PartyName.GREENS},
        reward: M5, destination: 'hand',
      }));
      expect(r.met).eq(true);
      expect(r.check).deep.eq({glyph: {kind: 'party-requirement'}, label: 'Party requirement',
        found: {key: 'party name: Greens', tone: 'yes'}});
      expect(r.reward).deep.eq([{direction: 'gain', icon: 'cards', amount: 1}, M5]);
      expect(r.fate).deep.eq({card: CardName.WILDLIFE_DOME, destination: 'hand', key: 'to hand'});
      expect(r.vpGain).eq(0);
    });

    it('a MISS: «не найдено», no reward chips («не получена»), the fate «в сброс»', () => {
      const r = revealVerdictReading(verdict({
        conditionMet: false, revealed: {name: CardName.ASTEROID} as RevealResultModel['revealed'],
        check: {icon: 'party-requirement', label: 'Party requirement'}, destination: 'discard',
      }));
      expect(r.met).eq(false);
      expect(r.check?.found).deep.eq({key: 'not found', tone: 'no'});
      expect(r.reward).is.empty;
      expect(r.fate).deep.eq({card: CardName.ASTEROID, destination: 'discard', key: 'to the discard pile'});
    });

    it('a TAG check (Search For Life): «найдено», the reward on the card, the VP gain, the card discarded', () => {
      const r = revealVerdictReading(verdict({
        action: CardName.SEARCH_FOR_LIFE,
        check: {tag: Tag.MICROBE, label: 'Microbe tag'},
        reward: {direction: 'gain', icon: 'science', amount: 1, note: 'on this card'},
        vp: {from: 0, to: 3},
      }));
      expect(r.check?.glyph).deep.eq({kind: 'tag', url: 'assets/tags/microbe.png'});
      expect(r.check?.found).deep.eq({key: 'found', tone: 'yes'});
      expect(r.reward.map((c) => c.icon)).deep.eq(['science']);
      expect(r.vpGain).eq(3);
      // No `destination` on the wire (a pre-TR13 record) reads as the discard.
      expect(r.fate.destination).eq('discard');
    });

    it('a classic party keeps its upstream key (the verdict prints what the card prints)', () => {
      const r = revealVerdictReading(verdict({check: {icon: 'party-requirement', label: 'Party requirement', party: PartyName.KELVINISTS}}));
      expect(r.check?.found.key).eq('Kelvinists');
    });
  });

  describe('the outcome plan', () => {
    it('only a met STOCK reward is a rail transfer — a card resource has its own beat', () => {
      expect(revealRewardStock(verdict({reward: M5}))).deep.eq({resource: 'megacredits', amount: 5});
      expect(revealRewardStock(verdict({conditionMet: false, reward: M5}))).is.undefined;
      expect(revealRewardStock(verdict({reward: {direction: 'gain', icon: 'science', amount: 1, note: 'on this card'}}))).is.undefined;
      expect(revealRewardStock(verdict({reward: undefined}))).is.undefined;
    });

    it('the dock withholds a KEPT card until its verdict is acknowledged — and only a kept one', () => {
      const kept = verdict({reward: M5, destination: 'hand'});
      expect(revealKeptCardHeld(kept, '')).eq(CardName.WILDLIFE_DOME);
      expect(revealKeptCardHeld(kept, revealKey(kept))).is.undefined;
      expect(revealKeptCardHeld(verdict({destination: 'discard'}), '')).is.undefined;
      expect(revealKeptCardHeld(verdict({conditionMet: false, destination: 'hand'}), '')).is.undefined;
      expect(revealKeptCardHeld(undefined, '')).is.undefined;
      expect(revealKey(kept)).eq('Political Think Tank|Wildlife Dome');
    });
  });
});
