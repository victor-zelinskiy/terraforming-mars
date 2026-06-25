import {expect} from 'chai';
import {cast} from '@/common/utils/utils';
import {ICard} from '../../../src/server/cards/ICard';
import {AirScrappingExpedition} from '../../../src/server/cards/venusNext/AirScrappingExpedition';
import {JetStreamMicroscrappers} from '../../../src/server/cards/venusNext/JetStreamMicroscrappers';
import {Celestic} from '../../../src/server/cards/venusNext/Celestic';
import {testGame} from '../../TestGame';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';

describe('AirScrappingExpedition', () => {
  it('No cards', () => {
    const card = new AirScrappingExpedition();
    const [game, player] = testGame(2);

    cast(card.play(player), undefined);

    expect(game.getVenusScaleLevel()).to.eq(2);
  });

  it('One option', () => {
    const card = new AirScrappingExpedition();
    const corp = new Celestic(); // Stores floaters, has Venus tag.
    const [game, player] = testGame(2);
    player.playedCards.push(corp);

    // Always asks which card, even with a single Venus floater card.
    const selectCard = cast(card.play(player), SelectCard<ICard>);
    expect(selectCard.cards).has.lengthOf(1);
    selectCard.cb([corp]);

    expect(corp.resourceCount).to.eq(3);
    expect(game.getVenusScaleLevel()).to.eq(2);
  });

  it('Play, multiple cards.', () => {
    const card = new AirScrappingExpedition();
    const celestic = new Celestic(); // Stores floaters. has Venus tag
    const jsr = new JetStreamMicroscrappers(); // Stores floaters, has Venus tag.
    const [game, player] = testGame(2);
    player.playedCards.push(celestic);
    player.playedCards.push(jsr);

    const selectCard = cast(card.play(player), SelectCard<ICard>);

    selectCard.cb([selectCard.cards[0]]);
    expect(celestic.resourceCount).to.eq(3);
    expect(game.getVenusScaleLevel()).to.eq(2);
  });

  it('cardPlayPreview: no eligible Venus floater card → a WARNING step (no silent loss), gain chip suppressed', () => {
    const card = new AirScrappingExpedition();
    const [/* game */, player] = testGame(2);

    const branch = cardPlayPreview(player, card).branches[0];
    // No card can hold the 3 floaters → the modal warns instead of dropping them silently.
    expect(branch.steps).has.length(1);
    expect(branch.steps[0].kind).eq('note');
    expect((branch.steps[0] as {noteKind?: string}).noteKind).eq('warning');
    expect((branch.steps[0] as {resource?: string}).resource).eq('floater');
    // The "+3 floaters to a card" gain chip is suppressed (it would be a lie).
    expect(branch.effects.some((e) => e.note === 'to a card')).is.false;
    // The Venus parameter chip still describes the on-play impact.
    expect(branch.effects.some((e) => e.icon === 'venus')).is.true;
  });

  it('cardPlayPreview: with an eligible card → a target picker + the gain chip (no warning)', () => {
    const card = new AirScrappingExpedition();
    const corp = new Celestic(); // Stores floaters, has Venus tag.
    const [/* game */, player] = testGame(2);
    player.playedCards.push(corp);

    const branch = cardPlayPreview(player, card).branches[0];
    expect(branch.steps.some((s) => s.kind === 'input' && s.input.type === 'card')).is.true;
    expect(branch.steps.some((s) => s.kind === 'note' && s.noteKind === 'warning')).is.false;
    expect(branch.effects.some((e) => e.note === 'to a card')).is.true;
  });
});
