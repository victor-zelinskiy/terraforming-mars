import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {CardModel} from '@/common/models/CardModel';
import {playedTargetQuickImpacts} from '@/client/console/played/consolePlayedTargetModel';
import {
  buildVenusWildTargetModel, venusWildCandidates, venusWildCardInput,
} from '@/client/console/venusBonus/venusWildTargetStep';

function card(name: CardName, resources?: number): CardModel {
  return (resources === undefined ? {name} : {name, resources}) as CardModel;
}

const PLAYERS = [
  {name: 'Viewer', color: 'blue', tableau: [
    {name: CardName.BIRDS}, {name: CardName.TARDIGRADES}, {name: CardName.SEARCH_FOR_LIFE},
    {name: CardName.FISH}, {name: CardName.PETS}, {name: CardName.LIVESTOCK},
    {name: CardName.EXTREME_COLD_FUNGUS}, {name: CardName.ANTS}, {name: CardName.DECOMPOSERS},
  ]},
  {name: 'Rival', color: 'red', tableau: [{name: CardName.PREDATORS}]},
];

/** The server's own final-step shape: `OrOptions(AndOptions(SelectCard, and), and)`. */
function finalPrompt(cards: ReadonlyArray<CardModel>): unknown {
  return {
    type: 'or',
    title: 'Choose your wild resource bonus.',
    buttonLabel: 'Save',
    options: [
      {
        type: 'and',
        options: [
          {type: 'card', title: 'Add resource to card', buttonLabel: 'Add resource', cards, min: 1, max: 1},
          {type: 'and', options: []},
        ],
      },
      {type: 'and', options: []},
    ],
  };
}

const base = {
  players: PLAYERS,
  viewerColor: 'blue',
  ask: '',
  typeOf: () => CardType.ACTIVE,
  resourceOf: (name: CardName) => (name === CardName.TARDIGRADES ? 'microbe' : 'animal'),
};

/**
 * THE VENUS WILD RESOURCE, ROUTED THROUGH THE ONE PICKER.
 *
 * What used to stand here was a Venus-owned `overflow-x` strip of card faces:
 * an index cursor, no `current → resulting`, no VP reading, no status rail, and
 * every candidate past the fourth off the edge of the panel. This module is the
 * whole replacement — the glue that hands the server's own `SelectCard` to the
 * shared played-target selector.
 */
describe('venusWildTargetStep', () => {
  describe('the candidate set is the SERVER input', () => {
    it('reads the wild `SelectCard` off the final prompt by SHAPE', () => {
      const prompt = finalPrompt([card(CardName.BIRDS, 2)]);
      expect(venusWildCardInput(prompt)?.cards.map((c) => c.name)).deep.eq([CardName.BIRDS]);
      expect(venusWildCandidates(prompt)).lengthOf(1);
    });

    /** The base bonus and a final bonus with NO eligible card are both a
     *  top-level `AndOptions` — no picker, and the branch is shown disabled. */
    it('yields nothing for a prompt that carries no on-card branch', () => {
      expect(venusWildCardInput({type: 'and', options: []})).eq(undefined);
      expect(venusWildCandidates({type: 'and', options: []})).lengthOf(0);
      expect(venusWildCandidates(undefined)).lengthOf(0);
    });

    /** ONE valid card is a real prompt, not a fast-path: the player still sees
     *  which card is hit and what it becomes before confirming. */
    it('builds a one-candidate model', () => {
      const model = buildVenusWildTargetModel({...base, candidates: [card(CardName.BIRDS, 4)]});
      expect(model.contract.targetCount).eq(1);
      expect(model.owners).lengthOf(1);
      expect(model.owners[0].candidates.map((c) => c.cardName)).deep.eq([CardName.BIRDS]);
    });

    /**
     * THE REPORTED BUG, as an assertion. Nine resource cards used to mean four
     * on screen and five unreachable. The model carries every candidate the
     * server offered — the fit and the scroll are the selector's problem.
     */
    it('carries EVERY candidate the server offered, however many', () => {
      const names = [
        CardName.BIRDS, CardName.TARDIGRADES, CardName.SEARCH_FOR_LIFE, CardName.FISH,
        CardName.PETS, CardName.LIVESTOCK, CardName.EXTREME_COLD_FUNGUS, CardName.ANTS,
        CardName.DECOMPOSERS,
      ];
      const model = buildVenusWildTargetModel({
        ...base,
        candidates: names.map((n) => card(n, 1)),
      });
      expect(model.contract.targetCount).eq(names.length);
      expect(model.owners[0].candidates.map((c) => c.cardName)).to.have.members(names);
    });
  });

  describe('what choosing a candidate says', () => {
    it('states the honest «было → стало» with the card\'s OWN resource icon', () => {
      const model = buildVenusWildTargetModel({
        ...base,
        candidates: [card(CardName.BIRDS, 4), card(CardName.TARDIGRADES, 3)],
      });
      const at = (name: CardName) => model.owners[0].candidates.find((c) => c.cardName === name);
      expect(at(CardName.BIRDS)?.preview[0]?.impacts[0]).to.include({from: 4, to: 5, icon: 'animal'});
      // The wild takes the shape of whatever it lands on — a per-candidate fact.
      expect(at(CardName.TARDIGRADES)?.preview[0]?.impacts[0]).to.include({from: 3, to: 4, icon: 'microbe'});
    });

    /** `SelectCard` omits the field rather than sending a zero, so the absent
     *  field IS the zero — and «0 → 1» is the whole point of the preview. */
    it('reads a card with no counter as zero, not as «no information»', () => {
      const model = buildVenusWildTargetModel({...base, candidates: [card(CardName.FISH)]});
      expect(model.owners[0].candidates[0].preview[0]?.impacts[0]).to.include({from: 0, to: 1});
    });

    /** A legal target that happens to be empty must still answer «сколько там
     *  сейчас» — the badge is asked for with `showZero`. */
    it('gives every candidate its resource badge, zero included', () => {
      const model = buildVenusWildTargetModel({...base, candidates: [card(CardName.FISH)]});
      expect(model.owners[0].candidates[0].resourceContext).to.deep.eq(
        {icon: 'animal', count: 0, showZero: true});
    });
  });

  describe('the ПО reading is the SERVER\'s, and only when it moves', () => {
    it('adds the VP impact when the resource really moves the card\'s points', () => {
      const model = buildVenusWildTargetModel({
        ...base,
        candidates: [card(CardName.BIRDS, 2)],
        vpBox: {[CardName.BIRDS]: {from: 2, to: 3}},
      });
      const impacts = playedTargetQuickImpacts(model.owners[0].candidates[0].preview);
      expect(impacts.map((i) => i.label)).deep.eq(['Resources on this card', 'VP']);
      expect(impacts[1]).to.include({from: 2, to: 3});
    });

    /** «1 ПО за каждые ЧЕТЫРЕ микроба, и там сейчас 0» — a true reading that
     *  does not move. It is a GIFT being placed, so a «ПО 0 → 0» chip beside
     *  «0 → 1» would be a number that does not move on a line whose whole job
     *  is the numbers that do. */
    it('drops a VP reading that does not move — no fake, no zero delta', () => {
      const model = buildVenusWildTargetModel({
        ...base,
        candidates: [card(CardName.TARDIGRADES, 0)],
        vpBox: {[CardName.TARDIGRADES]: {from: 0, to: 0}},
      });
      expect(playedTargetQuickImpacts(model.owners[0].candidates[0].preview).map((i) => i.label))
        .deep.eq(['Resources on this card']);
    });

    /** A card whose points ignore resources is ABSENT from the server's box,
     *  and renders exactly like the static case: its resource change alone. */
    it('says nothing about VP for a card the server did not score', () => {
      const model = buildVenusWildTargetModel({
        ...base,
        candidates: [card(CardName.SEARCH_FOR_LIFE, 1)],
        vpBox: {[CardName.BIRDS]: {from: 0, to: 1}},
      });
      expect(playedTargetQuickImpacts(model.owners[0].candidates[0].preview).map((i) => i.label))
        .deep.eq(['Resources on this card']);
    });
  });
});
