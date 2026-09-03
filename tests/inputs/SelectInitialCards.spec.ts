import {expect} from 'chai';
import {testGame} from '../TestGame';
import {SelectInitialCards} from '../../src/server/inputs/SelectInitialCards';
import {TestPlayer} from '../TestPlayer';
import {CardName} from '../../src/common/cards/CardName';
import {ICorporationCard} from '../../src/server/cards/corporation/ICorporationCard';
import {cardsFromJSON, ceosFromJSON, corporationCardsFromJSON, preludesFromJSON} from '../../src/server/createCard';
import {toName} from '../../src/common/utils/utils';
import {SelectCardModel} from '../../src/common/models/PlayerInputModel';

describe('SelectInitialCards', () => {
  let player: TestPlayer;
  let corp: ICorporationCard | undefined = undefined;
  let selectInitialCards: SelectInitialCards;

  function cb(corporation: ICorporationCard | undefined) {
    corp = corporation!;
    return undefined;
  }

  beforeEach(() => {
    [/* game */, player] = testGame(1);
    player.dealtCorporationCards = corporationCardsFromJSON([CardName.INVENTRIX, CardName.HELION]);
    player.dealtProjectCards = cardsFromJSON([CardName.ANTS, CardName.BACTOVIRAL_RESEARCH, CardName.COMET_AIMING, CardName.DIRIGIBLES]);
    selectInitialCards = new SelectInitialCards(player, cb);
  });

  it('fail, no corporations', () => {
    expect(() =>
      selectInitialCards.process({type: 'initialCards', responses: [
        {type: 'card', cards: []},
        {type: 'card', cards: []},
      ]}, player))
      .to.throw(/Not enough cards selected/);
  });

  it('fail, invalid corporation', () => {
    expect(() =>
      selectInitialCards.process({type: 'initialCards', responses: [
        {type: 'card', cards: [CardName.THARSIS_REPUBLIC]},
        {type: 'card', cards: []},
      ]}, player))
      .to.throw(/Card Tharsis Republic not found/);
  });

  it('fail, too many corporations', () => {
    expect(() =>
      selectInitialCards.process({type: 'initialCards', responses: [
        {type: 'card', cards: [CardName.INVENTRIX, CardName.HELION]},
        {type: 'card', cards: []},
      ]}, player))
      .to.throw(/Too many cards selected/);
  });

  it('Simple', () => {
    player.game.projectDeck.discardPile.length = 0; // Emptying the discard pile, which has 4 cards setting up the solo opponent.
    // player.game.corporationDeck.discardPile.length = 0;

    selectInitialCards.process({type: 'initialCards', responses: [
      {type: 'card', cards: [CardName.INVENTRIX]},
      {type: 'card', cards: [CardName.ANTS]},
    ]}, player);

    expect(player.playedCards.corporations()).is.empty; // This input object doesn't set the player's corporation card
    expect(corp!.name).eq(CardName.INVENTRIX);
    expect(player.cardsInHand.map(toName)).to.have.members([CardName.ANTS]); // But it does set their cards in hand.

    expect(player.game.projectDeck.discardPile.map(toName)).to.have.members([CardName.BACTOVIRAL_RESEARCH, CardName.COMET_AIMING, CardName.DIRIGIBLES]);
    expect(player.game.corporationDeck.discardPile.map(toName)).to.have.members([CardName.HELION]);
  });

  // ── The starting hand's REQUIREMENT HEADS-UP ────────────────────────────
  // The initial buy is a pick FOR LATER, exactly like a draft pick, so the
  // project step opts into the same structured reasons the draft carries
  // (`showUnplayableReasons`). The console renders them in the DRAFT voice:
  // only PRINTED REQUIREMENTS speak, read against the global parameters the
  // game will actually start at.
  describe('project requirement reasons', () => {
    function projectModel(name: CardName) {
      const model = selectInitialCards.toModel(player);
      const projects = model.options[model.options.length - 1] as SelectCardModel;
      return projects.cards.find((c) => c.name === name);
    }

    beforeEach(() => {
      player.dealtProjectCards = cardsFromJSON([CardName.ANTS, CardName.SEARCH_FOR_LIFE]);
      selectInitialCards = new SelectInitialCards(player, cb);
    });

    it('an unmet printed requirement is reported, read at the START-OF-GAME level', () => {
      // Ants requires 4% oxygen; the game starts at 0%.
      const reasons = projectModel(CardName.ANTS)?.unplayableReasons ?? [];
      const oxygen = reasons.find((r) => r.type === 'globalParameter');
      expect(oxygen).is.not.undefined;
      expect(oxygen?.globalParameter).eq('oxygen');
      expect(oxygen?.params).deep.eq(['4']);
      expect(oxygen?.current).eq(0);
      // A printed requirement (the draft voice shows ONLY these)…
      expect(oxygen?.requirement).is.true;
      // …that the game can still get to: amber «пока не выполнено», never red.
      expect(oxygen?.unattainable).is.not.true;
    });

    it('a SATISFIED requirement says nothing', () => {
      // Search For Life needs oxygen 6% or LESS — true at the start, so the
      // card carries no requirement reason (only the M€ line the player has
      // no corporation for yet, which the draft voice filters out).
      const reasons = projectModel(CardName.SEARCH_FOR_LIFE)?.unplayableReasons ?? [];
      expect(reasons.filter((r) => r.requirement === true)).is.empty;
    });

    it('the corporation step carries no reasons', () => {
      const model = selectInitialCards.toModel(player);
      const corps = model.options[0] as SelectCardModel;
      expect(corps.cards.every((c) => c.unplayableReasons === undefined)).is.true;
    });
  });

  it('Full', () => {
    const [/* game */, player] = testGame(1, {ceoExtension: true, preludeExtension: true});
    player.game.projectDeck.discardPile.length = 0; // Emptying the discard pile, which has 4 cards setting up the solo opponent.
    player.game.corporationDeck.discardPile.length = 0;
    player.dealtCorporationCards = corporationCardsFromJSON([CardName.INVENTRIX, CardName.HELION]);
    player.dealtProjectCards = cardsFromJSON([CardName.ANTS, CardName.BACTOVIRAL_RESEARCH, CardName.COMET_AIMING, CardName.DIRIGIBLES]);
    player.dealtPreludeCards = preludesFromJSON([CardName.LOAN, CardName.BIOLAB, CardName.DONATION, CardName.SUPPLIER]);
    player.dealtCeoCards = ceosFromJSON([CardName.ASIMOV, CardName.MUSK]);
    selectInitialCards = new SelectInitialCards(player, cb);

    selectInitialCards.process({type: 'initialCards', responses: [
      {type: 'card', cards: [CardName.INVENTRIX]},
      {type: 'card', cards: [CardName.LOAN, CardName.BIOLAB]},
      {type: 'card', cards: [CardName.ASIMOV]},
      {type: 'card', cards: [CardName.ANTS]},
    ]}, player);

    expect(player.playedCards.corporations()).is.empty; // This input object doesn't set the player's corporation card
    expect(corp!.name).eq(CardName.INVENTRIX);
    expect(player.cardsInHand.map(toName)).to.have.members([CardName.ANTS]); // But it does set their cards in hand.
    expect(Array.from(player.ceoCardsInHand).map(toName)).to.have.members([CardName.ASIMOV]);
    expect(player.preludeCardsInHand.map(toName)).to.have.members([CardName.LOAN, CardName.BIOLAB]);

    expect(player.game.projectDeck.discardPile.map(toName)).to.have.members([CardName.BACTOVIRAL_RESEARCH, CardName.COMET_AIMING, CardName.DIRIGIBLES]);
    expect(player.game.corporationDeck.discardPile.map(toName)).to.have.members([CardName.HELION]);
    expect(player.game.ceoDeck.discardPile.map(toName)).to.have.members([CardName.MUSK]);
    expect(player.game.preludeDeck.discardPile.map(toName)).to.have.members([CardName.DONATION, CardName.SUPPLIER]);
  });
});
