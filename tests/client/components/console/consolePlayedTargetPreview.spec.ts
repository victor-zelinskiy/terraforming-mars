import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {SelectCardModel} from '@/common/models/PlayerInputModel';
import {ActionEffect, ActionPreviewStep} from '@/common/models/ActionPreviewModel';
import {playedTargetPreviewFor, playedTargetResourceFor} from '@/client/console/played/consolePlayedTargetPreview';
import {playedTargetQuickImpacts} from '@/client/console/played/consolePlayedTargetModel';

const input = (cards: ReadonlyArray<{name: string, resources?: number}>, amount?: number): SelectCardModel =>
  ({type: 'card', title: 't', buttonLabel: 'b', cards: cards as ReadonlyArray<CardModel>, min: 1, max: 1, amount} as never);

const onCardGain = (icon: string, amount: number): ActionEffect =>
  ({direction: 'gain', icon, amount, note: 'to a card'});

/**
 * THE STATUS RAIL'S PAYLOAD.
 *
 * The rail worked for copy-production and said nothing but a card's NAME for
 * every «потратьте X, чтобы добавить Y на карту» action — «ОБСТРЕЛ КОМЕТАМИ»
 * and nothing else. The cause was structural, not cosmetic: those cards put the
 * target on the BRANCH (`optionInput`) rather than on a step, and only a step
 * carries a per-target `amount`. The delta was there all along, one level up,
 * in the branch's own effects.
 */
describe('consolePlayedTargetPreview — what the rail actually says', () => {
  describe('card resources', () => {
    /** THE REPORTED CASE. Comet Aiming: the branch says «+1 asteroid to a
     *  card», the candidate says it holds 0 — «0 → 1» is the whole point. */
    it('reads a branch-level «to a card» gain as before → after', () => {
      const sections = playedTargetPreviewFor(
        undefined,
        input([{name: 'Comet Aiming', resources: 0}]),
        'Comet Aiming' as CardName,
        [onCardGain('asteroids', 1)],
      );
      const impacts = playedTargetQuickImpacts(sections);
      expect(impacts).to.have.length(1);
      expect(impacts[0].from).to.eq(0);
      expect(impacts[0].to).to.eq(1);
      expect(impacts[0].icon).to.eq('asteroids');
    });

    /** A card with no counter at all reads as 0 — the honest statement of what
     *  the press does. Requiring a counter is what made the rail mute. */
    it('treats a card with NO counter as zero, not as «no information»', () => {
      const sections = playedTargetPreviewFor(
        undefined, input([{name: 'X'}]), 'X' as CardName, [onCardGain('floaters', 2)]);
      expect(playedTargetQuickImpacts(sections)[0]).to.include({from: 0, to: 2});
    });

    /** A REMOVAL is the same reading with the sign the server gave it, and it
     *  never goes below zero. */
    it('reads a removal as a decrease, floored at zero', () => {
      const sections = playedTargetPreviewFor(
        undefined, input([{name: 'Y', resources: 1}]), 'Y' as CardName,
        [{direction: 'cost', icon: 'animals', amount: 3, note: 'to a card'}]);
      expect(playedTargetQuickImpacts(sections)[0]).to.include({from: 1, to: 0});
    });

    /** A STEP's own amount still wins where it exists (Predators and the whole
     *  add-to-card family) — the branch reading is an addition, not a swap. */
    it('keeps the step\'s own amount as the primary source', () => {
      const step: ActionPreviewStep = {kind: 'input', input: {} as never, amount: 2, cardResource: 'microbes'};
      const sections = playedTargetPreviewFor(step, input([{name: 'Z', resources: 4}], 2), 'Z' as CardName);
      const impacts = playedTargetQuickImpacts(sections);
      expect(impacts[0]).to.include({from: 4, to: 6});
      expect(impacts[0].icon).to.eq('microbes');
    });

    /** An effect that lands in the PLAYER's stock is not a change to the card —
     *  the marker is what separates them, and a screen that confused the two
     *  would state a number about the wrong object. */
    it('ignores effects that do NOT land on the chosen card', () => {
      const sections = playedTargetPreviewFor(
        undefined, input([{name: 'W', resources: 0}]), 'W' as CardName,
        [{direction: 'gain', icon: 'titanium', amount: 3}]);
      expect(playedTargetQuickImpacts(sections)).to.have.length(0);
    });
  });

  describe('copy production', () => {
    /** The shape that already worked keeps working, unchanged. */
    it('still reads a copy-production box as signed production impacts', () => {
      const step: ActionPreviewStep = {
        kind: 'input', input: {} as never,
        copyProductionBox: {['Domed Crater' as CardName]: {megacredits: 3, steel: 0, titanium: 0, plants: 0, energy: -1, heat: 0}},
      };
      const impacts = playedTargetQuickImpacts(
        playedTargetPreviewFor(step, input([{name: 'Domed Crater'}]), 'Domed Crater' as CardName));
      expect(impacts.map((i) => i.amount)).to.deep.eq([3, -1]);
      expect(impacts.map((i) => i.icon)).to.deep.eq(['megacredits', 'energy']);
    });

    /** A card the console has no data for says nothing rather than inventing a
     *  claim — the rail then shows its identity alone. */
    it('says nothing at all when there is nothing authoritative to say', () => {
      const sections = playedTargetPreviewFor(undefined, input([{name: 'Q'}]), 'Q' as CardName, []);
      expect(sections).to.have.length(0);
    });
  });

  describe('the resource badge', () => {
    /** Unchanged contract: a badge only where the resource IS the choice. */
    it('appears only for a step that actually moves the card\'s resource', () => {
      expect(playedTargetResourceFor(input([{name: 'A', resources: 4}], 1), 'animals', ({name: 'A', resources: 4} as unknown as CardModel)))
        .to.deep.eq({icon: 'animals', count: 4});
      expect(playedTargetResourceFor(input([{name: 'A', resources: 4}]), 'animals', ({name: 'A', resources: 4} as unknown as CardModel)))
        .to.eq(undefined);
    });
  });
});
