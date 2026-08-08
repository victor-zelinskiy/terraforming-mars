import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {SelectCardModel} from '../../src/common/models/PlayerInputModel';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {CorporateArchives} from '../../src/server/cards/promo/CorporateArchives';
import {BusinessContacts} from '../../src/server/cards/base/BusinessContacts';
import {InventorsGuild} from '../../src/server/cards/base/InventorsGuild';
import {JunkVentures} from '../../src/server/cards/community/JunkVentures';
import {churn, runAllActions} from '../TestingUtils';
import {cast} from '../../src/common/utils/utils';
import {testGame} from '../TestGame';

/**
 * THE DECK-PICK MARKER (`deckPickPrompt`) — the structural signal that a
 * `SelectCard`'s candidates were just turned over FOR this decision.
 *
 * The console's whole draw-and-select flow keys off it, and on the wire the
 * prompt is otherwise byte-identical to "pick a card in someone's tableau", so
 * these are the assertions that stop the family silently falling back to the
 * generic card browser: it must be ATTACHED (by `ChooseCards`, the one funnel),
 * it must AGREE with the input it rides, it must SURVIVE serialization, and it
 * must name WHO asked.
 */
describe('deckPickPrompt marker', () => {
  it('a look-at-N/keep-K prelude marks its pick — bounds, count, origin, source', () => {
    const [/* game */, player] = testGame(2);
    const card = new CorporateArchives();

    card.play(player);
    runAllActions(player.game);

    const select = cast(player.popWaitingFor(), SelectCard);
    const meta = select.deckPickPrompt;
    expect(meta, 'the keep-some prompt must carry the marker').to.not.be.undefined;
    expect(meta?.revealed).to.eq(7);
    expect(meta?.min).to.eq(2);
    expect(meta?.max).to.eq(2);
    expect(meta?.origin).to.eq('deck');
    expect(meta?.mode).to.eq('keep');
    // The pick is a CONTINUATION of playing the card, so it must name it —
    // that attribution is what anchors the console flow on the source card.
    expect(meta?.source).to.deep.eq({kind: 'card', card: CardName.CORPORATE_ARCHIVES});
  });

  it('the marker AGREES with the input it rides (bounds are copied, not re-derived)', () => {
    const [/* game */, player] = testGame(2);

    new BusinessContacts().play(player);
    runAllActions(player.game);

    const select = cast(player.popWaitingFor(), SelectCard);
    expect(select.deckPickPrompt?.revealed).to.eq(select.cards.length);
    expect(select.deckPickPrompt?.min).to.eq(select.config.min);
    expect(select.deckPickPrompt?.max).to.eq(select.config.max);
  });

  it('it SURVIVES serialization on the input itself (nesting-safe, like discardPrompt)', () => {
    const [/* game */, player] = testGame(2);

    new BusinessContacts().play(player);
    runAllActions(player.game);

    const select = cast(player.popWaitingFor(), SelectCard);
    const model = select.toModel(player) as SelectCardModel;
    expect(model.deckPickPrompt).to.not.be.undefined;
    expect(model.deckPickPrompt?.mode).to.eq('keep');
    expect(model.deckPickPrompt?.revealed).to.eq(4);
  });

  it('a PAYING reveal is marked as such — the client keeps its own purchase flow', () => {
    const [/* game */, player] = testGame(2);
    const card = new InventorsGuild();
    player.megaCredits = 30;

    const select = cast(churn(card.action(player), player), SelectCard);
    expect(select.deckPickPrompt?.mode).to.eq('buy');
    expect(select.config.buyMode).to.be.true;
    expect(select.deckPickPrompt?.source).to.deep.eq({kind: 'card', card: CardName.INVENTORS_GUILD});
  });

  it('a DISCARD-PILE digger says so — the cards never left the deck', () => {
    const [game, player] = testGame(2);
    const corp = new JunkVentures();
    player.playCorporationCard(corp);
    // Three real cards in the discard pile for the action to turn over.
    game.projectDeck.discardPile = [
      game.projectDeck.drawOrThrow(game),
      game.projectDeck.drawOrThrow(game),
      game.projectDeck.drawOrThrow(game),
    ];

    cast(corp.action(player), undefined);
    runAllActions(game);

    const select = cast(player.popWaitingFor(), SelectCard);
    expect(select.deckPickPrompt?.origin).to.eq('discard');
    expect(select.deckPickPrompt?.source).to.deep.eq({kind: 'corporation', card: CardName.JUNK_VENTURES});
  });

  it('an ordinary card TARGET pick carries no marker (the fallback must stay honest)', () => {
    const [/* game */, player] = testGame(2);
    const select = new SelectCard('Select a card', 'Add', [], {max: 1, min: 1});
    expect(select.deckPickPrompt).to.be.undefined;
    expect((select.toModel(player) as SelectCardModel).deckPickPrompt).to.be.undefined;
  });
});
