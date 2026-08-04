import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {cardPlayPreview} from '../../src/server/models/cardPlayPreview';
import {BiofertilizerFacility} from '../../src/server/cards/ares/BiofertilizerFacility';
import {Extremophiles} from '../../src/server/cards/venusNext/Extremophiles';
import {Tardigrades} from '../../src/server/cards/base/Tardigrades';
import {testGame} from '../TestGame';

/*
 * "ADD RESOURCES TO ANY CARD" IS PART OF THE PLAY, NOT A PROMPT AFTER IT.
 *
 * A prompt is for something that needs its own confirmation, or that arrives on
 * SOMEBODY ELSE'S turn. A card the player just played themselves must resolve
 * inside the play flow: the target pick is pre-collected in the confirm surface
 * and submitted with the play as ONE batch.
 *
 * That only works if the play PREVIEW carries the pick as an `input` step. This
 * spec pins the server half — the walker every declarative card goes through —
 * so a card that adds a resource can never silently degrade into a follow-up
 * prompt again.
 */
describe('card play preview — a card target is pre-collected, never a follow-up prompt', () => {
  it('a declarative addResourcesToAnyCard emits an input step with the picker', () => {
    const [/* game */, player] = testGame(2, {aresExtension: true, venusNextExtension: true});
    // Two cards that can hold a microbe → a real choice.
    player.playedCards.push(new Extremophiles(), new Tardigrades());

    const card = new BiofertilizerFacility();
    const preview = cardPlayPreview(player, card);

    expect(preview.kind).to.eq('declarative');
    const steps = preview.branches[0].steps;
    const input = steps.find((s) => s.kind === 'input');
    expect(input, 'the microbe target must be part of the PLAY, not a prompt after it').is.not.undefined;
    expect(input?.input?.type).to.eq('card');
    // …offering both holders, so the pick is genuinely made in the modal.
    const model = input?.input as {cards: ReadonlyArray<{name: CardName}>};
    expect(model.cards.map((c) => c.name)).to.have.members([CardName.EXTREMOPHILES, CardName.TARDIGRADES]);
  });

  it('…and with ONE holder it is still shown (no silent single-apply)', () => {
    const [/* game */, player] = testGame(2, {aresExtension: true, venusNextExtension: true});
    player.playedCards.push(new Extremophiles());

    const preview = cardPlayPreview(player, new BiofertilizerFacility());
    const input = preview.branches[0].steps.find((s) => s.kind === 'input');
    expect(input, 'a lone candidate is still SHOWN — the player must see where it goes').is.not.undefined;
  });

  it('with NO holder it warns instead of promising a gain', () => {
    const [/* game */, player] = testGame(2, {aresExtension: true});
    const preview = cardPlayPreview(player, new BiofertilizerFacility());
    const steps = preview.branches[0].steps;
    expect(steps.some((s) => s.kind === 'input'), 'nothing to pick').is.false;
    expect(steps.some((s) => s.kind === 'note' && s.noteKind === 'warning'),
      'a lost resource must name itself').is.true;
  });
});
