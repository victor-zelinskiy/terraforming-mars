import {expect} from 'chai';
import {POLITICAL_THINK_TANK_REWARD, PoliticalThinkTank} from '../../../src/server/cards/turmoilRedux/PoliticalThinkTank';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {actionPreview} from '../../../src/server/models/actionPreview';
import {actionUnavailableReasons} from '../../../src/server/models/actionUnavailableReasons';
import {newProjectCard} from '../../../src/server/createCard';
import {IProjectCard} from '../../../src/server/cards/IProjectCard';
import {hasPartyRequirement, partyRequirementCardsInGame} from '../../../src/server/cards/requirements/partyRequirementCards';
import {TURMOIL_REDUX_CARD_MANIFEST} from '../../../src/server/cards/turmoilRedux/TurmoilReduxCardManifest';
import {formatMessage} from '../../TestingUtils';

/**
 * TR13 — POLITICAL THINK TANK: the third deck check and the first that KEEPS
 * the revealed card. Every rule reading of the card file's header is pinned
 * here — above all what a «party requirement» is (the `party` kind, any party,
 * events included; never the chairman / leaders / delegates / influence) and
 * that the check reads whether the card HAS one, never whether it is met.
 */
function reduxTable(): [IGame, TestPlayer, TestPlayer] {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  return [game, p1, p2];
}

function topCard(game: IGame, name: CardName): IProjectCard {
  const card = newProjectCard(name);
  if (card === undefined) {
    throw new Error(`no card ${name}`);
  }
  game.projectDeck.drawPile.push(card);
  return card;
}

/** How many cards of the Turmoil Redux SET print a party requirement — the pool of a clean Redux table. */
function setPartyRequirementCards(): number {
  return Object.values(TURMOIL_REDUX_CARD_MANIFEST.projectCards)
    .map((entry) => entry?.Factory === undefined ? undefined : new entry.Factory())
    .filter((c) => c !== undefined && hasPartyRequirement(c)).length;
}

function skipped(game: IGame) {
  return game.events.events.filter((e) => e.type === 'effect-skipped');
}

describe('PoliticalThinkTank', () => {
  let card: PoliticalThinkTank;
  let game: IGame;
  let player: TestPlayer;
  let opponent: TestPlayer;

  beforeEach(() => {
    card = new PoliticalThinkTank();
    [game, player, opponent] = reduxTable();
    player.playedCards.push(card);
  });

  it('registers with source-backed metadata', () => {
    expect(card.name).eq(CardName.POLITICAL_THINK_TANK);
    expect(card.type).eq(CardType.ACTIVE);
    expect(card.cost).eq(5);
    // The planet in the corner is the Mars tag; the plate beside the cost is empty.
    expect(card.tags).deep.eq([Tag.MARS]);
    expect(card.requirements).is.empty;
    expect(card.victoryPoints).is.undefined;
    expect(card.metadata.cardNumber).eq('TR13');
    expect(POLITICAL_THINK_TANK_REWARD).eq(5);
  });

  describe('rule 1 — a free action, blocked only by an empty deck', () => {
    it('acts with 0 M€', () => {
      player.megaCredits = 0;
      expect(card.canAct(player)).is.true;
      expect(actionUnavailableReasons(player, card)).is.empty;
    });

    it('an empty deck: the action is off with «The deck is empty»', () => {
      game.projectDeck.drawPile.length = 0;
      game.projectDeck.discardPile.length = 0;
      expect(card.canAct(player)).is.false;
      expect(actionUnavailableReasons(player, card)).deep.include({type: 'rule', message: 'The deck is empty'});
      expect(actionPreview(player, card).branches[0].unavailableReason).eq('The deck is empty');
    });
  });

  describe('rules 2 + 4 — a MATCH keeps the card and pays 5 M€', () => {
    it('the revealed card goes into the hand, +5 M€, the discard pile does not grow', () => {
      const top = topCard(game, CardName.WILDLIFE_DOME);
      const deck = game.projectDeck.drawPile.length;
      const discard = game.projectDeck.discardPile.length;
      player.megaCredits = 12;

      card.action(player);

      expect(player.cardsInHand.map((c) => c.name)).deep.eq([CardName.WILDLIFE_DOME]);
      expect(player.cardsInHand[0]).eq(top);
      expect(player.megaCredits).eq(17);
      expect(game.projectDeck.discardPile.length, 'nothing discarded').eq(discard);
      expect(game.projectDeck.drawPile.length, 'exactly ONE card revealed').eq(deck - 1);
    });

    it('records the verdict: met, destination hand, the check names the party, the reward chip', () => {
      topCard(game, CardName.WILDLIFE_DOME);
      player.megaCredits = 12;

      card.action(player);

      const reveal = player.lastReveal;
      expect(reveal?.action).eq(CardName.POLITICAL_THINK_TANK);
      expect(reveal?.revealed.name).eq(CardName.WILDLIFE_DOME);
      expect(reveal?.conditionMet).is.true;
      expect(reveal?.destination).eq('hand');
      expect(reveal?.check).deep.eq({icon: 'party-requirement', label: 'Party requirement', party: PartyName.GREENS});
      expect(reveal?.reward).deep.eq({direction: 'gain', icon: 'megacredits', amount: 5, current: 12, resulting: 17});
    });

    it('the journal: «revealed and kept» with the reveal marker, the M€ sourced to this card', () => {
      topCard(game, CardName.WILDLIFE_DOME);

      card.action(player);

      const kept = game.gameLog.find((m) => m.message === '${0} revealed and kept ${1}');
      expect(kept, 'the kept line').is.not.undefined;
      expect(kept?.reveal).deep.eq({origin: 'deck', result: 'kept', source: CardName.POLITICAL_THINK_TANK});
      const lines = game.gameLog.map((m) => formatMessage(m));
      expect(lines.some((l) => l.includes('megacredits') && l.includes(CardName.POLITICAL_THINK_TANK)),
        'the M€ gain names the card').is.true;
      const reveal = game.events.events.find((e) => e.type === 'card-revealed');
      expect(reveal?.impact.reveal).deep.eq({origin: 'deck', result: 'kept', count: 1, found: true});
      expect(reveal?.source).deep.include({card: CardName.POLITICAL_THINK_TANK});
    });

    it('an EVENT card with a party requirement is a match (Red Tourism Wave)', () => {
      topCard(game, CardName.RED_TOURISM_WAVE);
      card.action(player);
      expect(player.lastReveal?.conditionMet).is.true;
      expect(player.lastReveal?.check?.party).eq(PartyName.REDS);
      expect(player.cardsInHand.map((c) => c.name)).deep.eq([CardName.RED_TOURISM_WAVE]);
    });

    it('rule 4 — a requirement the player CANNOT meet is still a match (the card has one)', () => {
      // Generation 1 is ruled by the starting Greens — the Reds rule nothing and hold no delegate of ours.
      const wave = topCard(game, CardName.RED_TOURISM_WAVE);
      expect(game.politics?.satisfiesPartyRequirement(player, PartyName.REDS), 'the Reds requirement is not met').is.false;
      card.action(player);
      expect(player.lastReveal?.conditionMet).is.true;
      expect(player.lastReveal?.check?.party).eq(PartyName.REDS);
      expect(player.cardsInHand).includes(wave);
    });
  });

  describe('rules 3 + 5 — a MISS discards the card and gains nothing', () => {
    it('no requirement at all: the card is discarded, M€ unchanged, destination discard', () => {
      topCard(game, CardName.ASTEROID);
      const deck = game.projectDeck.drawPile.length;
      const discard = game.projectDeck.discardPile.length;
      player.megaCredits = 12;

      card.action(player);

      expect(player.cardsInHand).is.empty;
      expect(player.megaCredits).eq(12);
      expect(game.projectDeck.discardPile.map((c) => c.name)).includes(CardName.ASTEROID);
      expect(game.projectDeck.discardPile.length).eq(discard + 1);
      expect(game.projectDeck.drawPile.length, 'exactly ONE card revealed').eq(deck - 1);
      const reveal = player.lastReveal;
      expect(reveal?.conditionMet).is.false;
      expect(reveal?.destination).eq('discard');
      expect(reveal?.reward).is.undefined;
      expect(reveal?.check).deep.eq({icon: 'party-requirement', label: 'Party requirement'});
      expect(game.gameLog.some((m) => m.message === '${0} revealed and discarded ${1}')).is.true;
    });

    it('a miss is the printed outcome, not a skipped effect — no effect-skipped record', () => {
      topCard(game, CardName.ASTEROID);
      card.action(player);
      expect(skipped(game)).is.empty;
    });

    const notParty: ReadonlyArray<[string, CardName]> = [
      ['the chairman (Banned Delegate)', CardName.BANNED_DELEGATE],
      ['party leaders (Vote of No Confidence)', CardName.VOTE_OF_NO_CONFIDENCE],
      ['delegates on resolutions (Political Science)', CardName.POLITICAL_SCIENCE],
      ['influence (Minority Representation)', CardName.MINORITY_REPRESENTATION],
    ];
    for (const [label, name] of notParty) {
      it(`${label} is NOT a party requirement — a miss`, () => {
        topCard(game, name);
        card.action(player);
        expect(player.lastReveal?.conditionMet).is.false;
        expect(player.cardsInHand).is.empty;
        expect(game.projectDeck.discardPile.map((c) => c.name)).includes(name);
      });
    }
  });

  describe('the preview', () => {
    it('one branch, no fixed chips: the reveal descriptor (check · M€ reward · keeps the card · the pool)', () => {
      player.megaCredits = 3;
      const preview = actionPreview(player, card);
      expect(preview.branches.length).eq(1);
      const branch = preview.branches[0];
      expect(branch.available).is.true;
      expect(branch.effects, 'the card is NOT a cards gain — the claim would read it as a draw').is.empty;
      expect(branch.reveal).deep.eq({
        deck: 'project',
        check: {icon: 'party-requirement', label: 'Party requirement'},
        reward: {direction: 'gain', icon: 'megacredits', amount: 5, current: 3, resulting: 8},
        keepsCard: true,
        pool: {count: setPartyRequirementCards()},
      });
    });

    it('a clean Redux table holds exactly the SET\'s party-requirement cards — and the pool counts the cards ADDED, wherever they stand', () => {
      // A CLASS, never a literal: every Redux card printing a party requirement (TR15 Martian Census was the
      // first; TR14–TR27 follow) is dealt into the game — the count grows with the set, not with this spec.
      const base = setPartyRequirementCards();
      expect(base, 'TR15 joined the set').gte(1);
      expect(partyRequirementCardsInGame(game)).eq(base);
      topCard(game, CardName.WILDLIFE_DOME);
      expect(actionPreview(player, card).branches[0].reveal?.pool).deep.eq({count: base + 1});
      opponent.cardsInHand.push(newProjectCard(CardName.RED_TOURISM_WAVE)!);
      game.projectDeck.discardPile.push(newProjectCard(CardName.PR_OFFICE)!);
      opponent.playedCards.push(newProjectCard(CardName.SPONSORED_MOHOLE)!);
      expect(partyRequirementCardsInGame(game)).eq(base + 4);
      // A card with a NON-party political requirement is not in the pool.
      game.projectDeck.drawPile.push(newProjectCard(CardName.BANNED_DELEGATE)!);
      expect(partyRequirementCardsInGame(game)).eq(base + 4);
    });

    it('is read-only: the game serializes identically before and after', () => {
      topCard(game, CardName.WILDLIFE_DOME);
      const before = JSON.stringify(game.serialize());
      actionPreview(player, card);
      expect(JSON.stringify(game.serialize())).eq(before);
    });
  });

  it('save / load: the card survives a round trip and still acts', () => {
    const reloaded = Game.deserialize(structuredClone(game.serialize()));
    const again = reloaded.getPlayerById(player.id);
    const tank = again.tableau.get(CardName.POLITICAL_THINK_TANK);
    expect(tank).is.not.undefined;
    expect((tank as PoliticalThinkTank).canAct(again)).is.true;
  });
});
