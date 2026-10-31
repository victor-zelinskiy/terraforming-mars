import {expect} from 'chai';
import {CORRIDORS_OF_POWER_DELEGATES, CORRIDORS_OF_POWER_MEGACREDITS, CorridorsOfPowerRedux} from '../../../src/server/cards/turmoilRedux/CorridorsOfPowerRedux';
import {CorridorsOfPower} from '../../../src/server/cards/prelude2/CorridorsOfPower';
import {TURMOIL_REDUX_CARD_MANIFEST} from '../../../src/server/cards/turmoilRedux/TurmoilReduxCardManifest';
import {ActivePreludeCard} from '../../../src/server/cards/prelude2/ActivePreludeCard';
import {actionPreview} from '../../../src/server/models/actionPreview';
import {actionFutility} from '../../../src/server/models/actionFutility';
import {GameCards} from '../../../src/server/GameCards';
import {Game} from '../../../src/server/Game';
import {IGame} from '../../../src/server/IGame';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {DEFAULT_GAME_OPTIONS, GameOptions} from '../../../src/server/game/GameOptions';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {runAllActions} from '../../TestingUtils';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {inPremiumScope} from '../../../src/common/cards/premiumScope';
import {replacementCardNumber} from '../../../src/common/cards/turmoilReduxReplacements';
import {toName} from '../../../src/common/utils/utils';

/**
 * TRP0 — CORRIDORS OF POWER (the Redux replacement of the classic Prelude 2 P47): a Prelude with an ACTION, Earth;
 * the play +4 M€; «Action: draw 1 card for each RESOLUTION you have at least 2 delegates on» — the Parliament's counted
 * term through the political facade. Every rule reading of the card file's header is pinned here.
 */
type Table = {game: IGame, parliament: Parliament, player: TestPlayer, rival: TestPlayer, card: CorridorsOfPowerRedux};

function table(): Table {
  const [game, player, rival] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true, preludeExtension: true});
  game.phase = Phase.ACTION;
  const parliament = game.parliament;
  if (parliament === undefined) {
    throw new Error('a Redux table has a Parliament');
  }
  const card = new CorridorsOfPowerRedux();
  player.playedCards.push(card);
  return {game, parliament, player, rival, card};
}

/** `n` of `who`'s own delegates onto slot `index` straight from the reserve (the ledger's own mutation). */
function vote(t: Table, who: TestPlayer, index: number, n: number): void {
  for (let i = 0; i < n; i++) {
    t.parliament.placeVote(who, t.parliament.slots[index], 'reserve');
  }
}

function options(overrides: Partial<GameOptions>): GameOptions {
  return {...DEFAULT_GAME_OPTIONS, ...overrides};
}

describe('CorridorsOfPowerRedux', () => {
  describe('rule 1 — the printed card and its registration', () => {
    it('a PRELUDE with an action — Earth, +4 M€, no cost, no VP — TRP0, reimplementing P47', () => {
      const card = new CorridorsOfPowerRedux();
      expect(card).instanceOf(ActivePreludeCard);
      expect(card.name).eq('Corridors of Power:redux');
      expect(card.type).eq(CardType.PRELUDE);
      expect(card.tags).deep.eq([Tag.EARTH]);
      expect(card.cost).eq(0);
      expect(card.victoryPoints).is.undefined;
      expect(card.behavior).deep.eq({stock: {megacredits: CORRIDORS_OF_POWER_MEGACREDITS}});
      expect(card.actionBehavior).deep.eq({drawCard: {count: {delegates: {resolutionsWithAtLeast: CORRIDORS_OF_POWER_DELEGATES}}}});
      expect(card.metadata.cardNumber).eq('TRP0');
      expect(replacementCardNumber(CardName.CORRIDORS_OF_POWER)).eq('TRP0');
      expect(card.metadata.reimplements).eq(CardName.CORRIDORS_OF_POWER);
    });

    it('a prelude of the Redux manifest, dealt only beside the Prelude expansion; the classic stands in cardsToRemove', () => {
      expect(TURMOIL_REDUX_CARD_MANIFEST.preludeCards[CardName.CORRIDORS_OF_POWER_REDUX]?.compatibility).eq('prelude');
      expect(TURMOIL_REDUX_CARD_MANIFEST.cardsToRemove.has(CardName.CORRIDORS_OF_POWER)).is.true;
    });

    it('a Redux table deals the replacement and never the classic; a classic-Turmoil table keeps the classic', () => {
      const redux = new GameCards(options({
        turmoilReduxExpansion: true, coloniesExtension: true, preludeExtension: true, prelude2Expansion: true,
      })).getPreludeCards().map(toName);
      expect(redux).to.contain(CardName.CORRIDORS_OF_POWER_REDUX);
      expect(redux).not.to.contain(CardName.CORRIDORS_OF_POWER);
      const classic = new GameCards(options({turmoilExtension: true, preludeExtension: true, prelude2Expansion: true})).getPreludeCards().map(toName);
      expect(classic).to.contain(CardName.CORRIDORS_OF_POWER);
      expect(classic).not.to.contain(CardName.CORRIDORS_OF_POWER_REDUX);
    });

    it('the premium scope: the replacement in (turmoilRedux), the classic out forever (the registry)', () => {
      expect(inPremiumScope({module: 'turmoilRedux', name: CardName.CORRIDORS_OF_POWER_REDUX})).is.true;
      expect(inPremiumScope({module: 'prelude2', name: CardName.CORRIDORS_OF_POWER})).is.false;
    });

    it('the classic\'s party-leader hook is not carried over — the classic keeps its own +1 TR', () => {
      expect(new CorridorsOfPower().behavior).deep.eq({tr: 1, stock: {megacredits: 4}});
      expect(new CorridorsOfPowerRedux().behavior?.tr).is.undefined;
    });
  });

  describe('rule 2 — the play', () => {
    it('+4 M€, nothing asked, never a gate (it never burns)', () => {
      const [game, player] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true, preludeExtension: true});
      const card = new CorridorsOfPowerRedux();
      expect(card.canPlay(player)).is.true;
      const before = player.megaCredits;
      const tr = player.terraformRating;
      player.playCard(card);
      runAllActions(game);
      expect(player.megaCredits).eq(before + 4);
      expect(player.terraformRating).eq(tr);
      expect(player.popWaitingFor()).is.undefined;
    });

    it('its Earth tag counts like any played tag', () => {
      const [game, player] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true, preludeExtension: true});
      const earth = player.tags.count(Tag.EARTH, 'raw');
      player.playCard(new CorridorsOfPowerRedux());
      runAllActions(game);
      expect(player.tags.count(Tag.EARTH, 'raw')).eq(earth + 1);
    });
  });

  describe('rule 3 — the action counts resolutions with 2+ of the player\'s OWN delegates', () => {
    it('0 / 1 / 2 resolutions → 0 / 1 / 2 cards, one batch', () => {
      const t = table();
      expect(t.parliament.slots.length).to.be.at.least(2);
      vote(t, t.player, 0, 1);
      expect(t.game.politics?.resolutionsWithDelegates(t.player, 2)).eq(0);
      vote(t, t.player, 0, 1);
      expect(t.game.politics?.resolutionsWithDelegates(t.player, 2)).eq(1);
      vote(t, t.player, 1, 2);
      expect(t.game.politics?.resolutionsWithDelegates(t.player, 2)).eq(2);
      const hand = t.player.cardsInHand.length;
      const batches = t.player.cardDrawReveals.length;
      t.player.playActionCard().process({type: 'card', cards: [CardName.CORRIDORS_OF_POWER_REDUX]}, t.player);
      runAllActions(t.game);
      expect(t.player.cardsInHand.length).eq(hand + 2);
      expect(t.player.cardDrawReveals.length).eq(batches + 1, 'one draw — one batch');
      expect(t.player.cardDrawReveals.at(-1)?.cards.length).eq(2);
    });

    it('neutral delegates and the rival\'s never count', () => {
      const t = table();
      vote(t, t.player, 0, 1);
      t.parliament.addNeutralVote(t.parliament.slots[0]);
      vote(t, t.rival, 1, 2);
      expect(t.game.politics?.resolutionsWithDelegates(t.player, 2)).eq(0);
      expect(t.game.politics?.resolutionsWithDelegates(t.rival, 2)).eq(1);
    });

    it('the lobby, the chairman\'s seat and the reserve never count', () => {
      const t = table();
      t.parliament.lobby.add(t.player.id);
      t.parliament.chairman = t.player.id;
      expect(t.game.politics?.resolutionsWithDelegates(t.player, 2)).eq(0);
      expect(t.game.politics?.resolutionsWithDelegates(t.player, 1)).eq(0);
    });

    it('an enacted resolution\'s slot is gone — its cubes no longer count', () => {
      const t = table();
      vote(t, t.player, 0, 2);
      expect(t.game.politics?.resolutionsWithDelegates(t.player, 2)).eq(1);
      t.parliament.slots.splice(0, 1);
      expect(t.game.politics?.resolutionsWithDelegates(t.player, 2)).eq(0);
    });

    it('0 → the action stays AVAILABLE and draws nothing, with the verdict in the term\'s own words', () => {
      const t = table();
      vote(t, t.player, 0, 1);
      expect(t.card.canAct(t.player)).is.true;
      expect(t.player.getPlayableActionCards().map((c) => c.name)).to.include(CardName.CORRIDORS_OF_POWER_REDUX);
      expect(actionFutility(t.player, t.card)).deep.eq({verdict: {kind: 'zero-yield', reason: 'No resolution with 2 of your delegates'}});
      const hand = t.player.cardsInHand.length;
      t.card.action(t.player);
      runAllActions(t.game);
      expect(t.player.cardsInHand.length).eq(hand);
    });

    it('a count above zero has value — no verdict', () => {
      const t = table();
      vote(t, t.player, 0, 2);
      expect(actionFutility(t.player, t.card)).is.undefined;
    });

    it('the classic engine reads PARTIES with 2+ of the player\'s delegates', () => {
      const [game, player] = testGame(2, {turmoilExtension: true, preludeExtension: true});
      const turmoil = game.turmoil!;
      const party = turmoil.parties[0];
      party.delegates.add(player);
      party.delegates.add(player);
      expect(game.politics?.resolutionsWithDelegates(player, 2)).eq(1);
      expect(game.politics?.resolutionDelegates(player)).is.undefined;
    });

    it('no political engine at all → 0', () => {
      const [game, player] = testGame(1, {preludeExtension: true});
      expect(game.politics).is.undefined;
      const card = new CorridorsOfPowerRedux();
      player.playedCards.push(card);
      const hand = player.cardsInHand.length;
      card.action(player);
      runAllActions(game);
      expect(player.cardsInHand.length).eq(hand);
    });
  });

  describe('rule 4 — the preview IS the execution, with the Parliament basis', () => {
    it('«+N [card]» naming every resolution of the voting area — counted and not — read-only', () => {
      const t = table();
      vote(t, t.player, 0, 2);
      vote(t, t.player, 1, 1);
      t.parliament.addNeutralVote(t.parliament.slots[1]);
      const before = JSON.stringify(t.game.serialize());
      const preview = actionPreview(t.player, t.card);
      expect(JSON.stringify(t.game.serialize())).eq(before, 'the preview mutates nothing');
      const chip = preview.branches.flatMap((b) => b.effects).find((e) => e.icon === 'cards');
      expect(chip?.amount).eq(1);
      const term = chip?.basis?.[0];
      expect(term?.count).eq(1);
      expect(term?.label).eq('Resolutions with 2+ of your delegates');
      expect(term?.zero).eq('No resolution with 2 of your delegates');
      const rows = term?.resolutions ?? [];
      expect(rows).to.have.lengthOf(t.parliament.slots.length);
      expect(rows.map((r) => r.party)).deep.eq(t.parliament.partiesInVotingArea());
      expect(rows[0]).to.include({own: 2, total: 2, counted: true});
      expect(rows[1]).to.include({own: 1, total: 2, counted: false});
    });

    it('a zero count: the chip reads 0 and the basis names its zero', () => {
      const t = table();
      const chip = actionPreview(t.player, t.card).branches.flatMap((b) => b.effects).find((e) => e.icon === 'cards');
      expect(chip?.amount).eq(0);
      expect(chip?.basis?.[0].count).eq(0);
      expect(chip?.basis?.[0].resolutions?.every((r) => !r.counted)).is.true;
    });
  });

  describe('rule 5 — save / load', () => {
    it('an ordinary card on the table, the generation\'s action flag kept', () => {
      const t = table();
      vote(t, t.player, 0, 2);
      t.player.playActionCard().process({type: 'card', cards: [CardName.CORRIDORS_OF_POWER_REDUX]}, t.player);
      runAllActions(t.game);
      expect(t.player.actionsThisGeneration.has(CardName.CORRIDORS_OF_POWER_REDUX)).is.true;
      const reloaded = Game.deserialize(structuredClone(t.game.serialize()));
      const again = reloaded.getPlayerById(t.player.id);
      expect(again.tableau.has(CardName.CORRIDORS_OF_POWER_REDUX)).is.true;
      expect(again.actionsThisGeneration.has(CardName.CORRIDORS_OF_POWER_REDUX)).is.true;
    });
  });
});
