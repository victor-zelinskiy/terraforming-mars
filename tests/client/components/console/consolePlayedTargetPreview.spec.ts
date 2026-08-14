import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {SelectCardModel} from '@/common/models/PlayerInputModel';
import {ActionEffect, ActionPreviewStep} from '@/common/models/ActionPreviewModel';
import {playedTargetPreviewFor, playedTargetResourceFor} from '@/client/console/played/consolePlayedTargetPreview';
import {playedTargetQuickImpacts, playedTargetShowsResource} from '@/client/console/played/consolePlayedTargetModel';

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


  describe('victory points', () => {
    /** THE DECISION-RELEVANT HALF. Adding a resource to a scoring card moves
     *  VP, and that is usually what makes one target better than another — so
     *  the rail states it beside the resource line, from the server's own
     *  per-candidate reading. */
    it('states the VP move beside the resource move', () => {
      const sections = playedTargetPreviewFor(
        undefined, input([{name: 'Birds', resources: 2}]), 'Birds' as CardName,
        [onCardGain('animals', 1)], {['Birds' as CardName]: {from: 2, to: 3}});
      const impacts = playedTargetQuickImpacts(sections);
      expect(impacts).to.have.length(2);
      expect(impacts[0]).to.include({from: 2, to: 3});
      expect(impacts[1].label, 'the canonical abbreviation').to.eq('VP');
      expect(impacts[1]).to.include({from: 2, to: 3});
    });

    /** A candidate the server left OUT of the box has no VP move — and the
     *  rail must not imply one. The box's contents ARE the condition; nothing
     *  in the client decides when VP is interesting. */
    it('says nothing about VP for a candidate the server did not price', () => {
      const sections = playedTargetPreviewFor(
        undefined, input([{name: 'Ants', resources: 2}]), 'Ants' as CardName,
        [onCardGain('microbes', 1)], {['Birds' as CardName]: {from: 0, to: 1}});
      const impacts = playedTargetQuickImpacts(sections);
      expect(impacts).to.have.length(1);
      expect(impacts[0].label).to.eq('Resources on this card');
    });

    /** A STEP-borne reading works the same way — the two shapes are one line. */
    it('reads the STEP-borne vpBox for the pre-collected family', () => {
      const step: ActionPreviewStep = {
        kind: 'input', input: {} as never, amount: 1, cardResource: 'animals',
        vpBox: {['Birds' as CardName]: {from: 4, to: 5}},
      };
      const impacts = playedTargetQuickImpacts(
        playedTargetPreviewFor(step, input([{name: 'Birds', resources: 4}], 1), 'Birds' as CardName));
      expect(impacts.map((i) => i.label)).to.deep.eq(['Resources on this card', 'VP']);
      expect(impacts[1]).to.include({from: 4, to: 5});
    });

    /**
     * THE DELTA RIDES THE STEP — as the server actually sends it.
     *
     * `SelectCardModel` has no `amount` field and the server never invents one,
     * so a fixture that stamps the model tests a shape that does not exist. Read
     * from the step alone, with an effect stated on the SOURCE card (Predators:
     * «+1 животное на этой карте»), there was nothing to fall back to and the
     * target reading vanished entirely — on the one screen whose whole job is
     * comparing targets.
     */
    it('reads the delta from the STEP, with no help from the input model', () => {
      const step: ActionPreviewStep = {
        kind: 'input', input: {} as never, amount: -1, cardResource: 'animals',
        vpBox: {['Birds' as CardName]: {from: 3, to: 2}},
      };
      const impacts = playedTargetQuickImpacts(playedTargetPreviewFor(
        step,
        // No amount on the model, and the branch effect talks about the SOURCE
        // card — exactly Predators' shape.
        input([{name: 'Birds', resources: 3}]),
        'Birds' as CardName,
        [{direction: 'gain', icon: 'animals', amount: 1, note: 'on this card'} as never]));
      expect(impacts.map((i) => i.label)).to.deep.eq(['Resources on this card', 'VP']);
      expect(impacts[0], 'the target loses one').to.include({from: 3, to: 2});
      expect(impacts[1], 'and that costs its owner a point').to.include({from: 3, to: 2});
    });

    /**
     * A STATIC reading IS a reading — this reverses the earlier contract, on
     * purpose.
     *
     * It used to drop «1 → 1» as noise. But «эта карта даёт 1 ПО за каждую
     * фишку» and «эта — за каждые две, и там чётное число» are the entire
     * comparison when deciding what to take and from whom, and dropping the
     * second made it look identical to a card that scores nothing at all —
     * opposite answers, rendered the same. It is kept, and MARKED so the rail
     * can state it quietly instead of competing with the ones that move.
     */
    it('keeps a static VP entry in the SECTIONS, marked — and off the one-line reading', () => {
      const sections = playedTargetPreviewFor(
        undefined, input([{name: 'Ants', resources: 2}]), 'Ants' as CardName,
        [onCardGain('microbes', 1)], {['Ants' as CardName]: {from: 1, to: 1}});

      // The SECTIONS are the comparison, so the static reading is kept + marked.
      const vp = sections.flatMap((s) => s.impacts).filter((i) => i.label === 'VP');
      expect(vp, 'the comparison keeps it').to.have.length(1);
      expect(vp[0].static, 'stated, but stated quietly').to.eq(true);
      expect(vp[0]).to.include({from: 1, to: 1});

      // The ONE-LINE readings went the other way on 2026-08-12
      // (`playedTargetImpactMoves`): the focus rail summarises the card under the
      // cursor and the answered summary states a decision already made — neither
      // is a comparison, and «ПО 0 → 0» beside a real «0 → 1» is a second chip
      // that says nothing while taking the eye off the one that does.
      const impacts = playedTargetQuickImpacts(sections);
      expect(impacts.map((i) => i.label)).to.deep.eq(['Resources on this card']);
    });

    /** A MOVING reading is never marked static — the two must stay tellable
     *  apart, since that difference is the whole decision. */
    it('does not mark a moving reading', () => {
      const sections = playedTargetPreviewFor(
        undefined, input([{name: 'Birds', resources: 3}]), 'Birds' as CardName,
        [onCardGain('animals', -1)], {['Birds' as CardName]: {from: 3, to: 2}});
      const impacts = playedTargetQuickImpacts(sections);
      expect(impacts[1].static ?? false).to.eq(false);
      expect(impacts[1]).to.include({from: 3, to: 2});
    });
  });

  describe('the resource badge', () => {
    /**
     * Unchanged CONTRACT — a badge only where the resource IS the choice — but
     * the delta is now handed in rather than dug out of the input model, which
     * never carried one. Read from the model it was always `undefined`, so the
     * badge could not appear ANYWHERE: the gold «0» went away for the right
     * reason and took the legitimate counts (Predators eats animals — how many
     * each candidate holds IS the comparison) away with it.
     */
    it('appears only for a step that actually moves the card\'s resource', () => {
      const card = {name: 'A', resources: 4} as unknown as CardModel;
      expect(playedTargetResourceFor(1, 'animals', card)).to.deep.eq({icon: 'animals', count: 4, showZero: true});
      expect(playedTargetResourceFor(-1, 'animals', card), 'a REMOVAL is just as much a reason to show the count')
        .to.deep.eq({icon: 'animals', count: 4, showZero: true});
      expect(playedTargetResourceFor(undefined, 'animals', card)).to.eq(undefined);
      expect(playedTargetResourceFor(0, 'animals', card), 'a zero delta moves nothing').to.eq(undefined);
    });

    /**
     * ZERO IS A READING, NOT AN ABSENCE.
     *
     * Once the step moves this resource, every candidate the SERVER offered can
     * by construction hold it — so «сколько там сейчас» is part of the decision
     * on ALL of them. An empty card answering with no chip at all says something
     * else entirely («this card does not take floaters»), which is the opposite
     * of true and the one thing the player would act on. `card.resources` is
     * omitted rather than sent as 0 for an untouched card, so the absent field
     * IS the zero.
     */
    it('shows a ZERO count for an eligible card that holds none yet', () => {
      const empty = {name: 'B'} as unknown as CardModel;
      expect(playedTargetResourceFor(2, 'floater', empty)).to.deep.eq({icon: 'floater', count: 0, showZero: true});
      expect(playedTargetShowsResource(playedTargetResourceFor(2, 'floater', empty)),
        'and it is actually rendered').to.eq(true);
    });
  });
});
