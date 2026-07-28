import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {ColonyName} from '@/common/colonies/ColonyName';
import {DiscardPromptMeta, PlayerInputModel} from '@/common/models/PlayerInputModel';
import {
  deriveDiscardIntent,
  discardExchangeFor,
  discardHeadline,
  discardMetaOf,
  isDiscardPrompt,
  nestedDiscardBranch,
} from '@/client/console/cardDiscard/discardIntent';

/*
 * The ONE derivation behind every console discard. Its whole point is that a
 * card effect, a colony bonus and a game rule produce the SAME shape from the
 * SAME server marker — so these cases are asserted side by side.
 */
describe('discardIntent', () => {
  const meta = (over: Partial<DiscardPromptMeta> = {}): DiscardPromptMeta =>
    ({min: 1, max: 1, source: {kind: 'card', card: CardName.MARS_UNIVERSITY}, ...over});

  it('classifies structurally — never by the (translatable) title', () => {
    const plain = {type: 'card', title: 'Select a card to discard', buttonLabel: 'Discard'} as unknown as PlayerInputModel;
    expect(isDiscardPrompt(plain)).is.false;
    expect(discardMetaOf(plain)).is.undefined;

    const marked = {...plain, discardPrompt: meta()} as unknown as PlayerInputModel;
    expect(isDiscardPrompt(marked)).is.true;
    expect(discardMetaOf(marked)).deep.eq(meta());
  });

  it('phrases the ask per shape (exact / plural / up-to)', () => {
    expect(discardHeadline(meta())).deep.eq({key: 'Discard 1 card'});
    expect(discardHeadline(meta({min: 3, max: 3}))).deep.eq({key: 'Discard ${0} cards', amount: 3});
    expect(discardHeadline(meta({min: 0, max: 4}))).deep.eq({key: 'Discard up to ${0} cards', amount: 4});
  });

  it('resolves a per-card payout against the LIVE pick count', () => {
    const perCard = meta({min: 0, max: 5, exchange: {icon: 'megacredits', amount: 2, perCard: true}});
    expect(discardExchangeFor(perCard, 0)?.amount).eq(0);
    expect(discardExchangeFor(perCard, 3)?.amount).eq(6);

    const flat = meta({exchange: {icon: 'cards', amount: 3}});
    expect(discardExchangeFor(flat, 1)?.amount).eq(3);
    expect(discardExchangeFor(meta(), 1)).is.undefined;
  });

  it('names the source per kind, and previews the card when there is one', () => {
    const card = deriveDiscardIntent(meta(), 0);
    expect(card.sourceKey).eq('Card effect');
    expect(card.card).eq(CardName.MARS_UNIVERSITY);
    expect(card.single).is.true;

    const colony = deriveDiscardIntent(meta({source: {kind: 'colony'}}), 0);
    expect(colony.sourceKey).eq('Colony');
    expect(colony.card).is.undefined;

    // A discard with NO source marker still names itself honestly.
    const bare = deriveDiscardIntent({min: 2, max: 2}, 0);
    expect(bare.sourceKey).eq('Game rule');
    expect(bare.single).is.false;
  });

  it('carries the colony-bonus position (Pluto resolves one cube at a time)', () => {
    const intent = deriveDiscardIntent(
      meta({source: {kind: 'colony'}, colonyBonus: {colonyName: ColonyName.PLUTO, index: 2, total: 3}}), 1);
    expect(intent.sequence).deep.eq({index: 2, total: 3});
    expect(intent.picked).eq(1);
  });

  it('finds the discard BRANCH of an OrOptions (Mars University) and ignores the rest', () => {
    const or = {
      type: 'or',
      title: 'Select an option',
      buttonLabel: 'Confirm',
      options: [
        {type: 'option', title: 'Do nothing', buttonLabel: 'Confirm'},
        {type: 'card', title: 'Select a card to discard', buttonLabel: 'Discard', cards: [], min: 1, max: 1, discardPrompt: meta()},
      ],
    } as unknown as PlayerInputModel;
    expect(nestedDiscardBranch(or)?.index).eq(1);

    const noDiscard = {
      type: 'or',
      title: 'Select an option',
      buttonLabel: 'Confirm',
      options: [{type: 'option', title: 'Do nothing', buttonLabel: 'Confirm'}],
    } as unknown as PlayerInputModel;
    expect(nestedDiscardBranch(noDiscard)).is.undefined;
    // A top-level card prompt is not a nested branch.
    expect(nestedDiscardBranch({type: 'card', discardPrompt: meta()} as unknown as PlayerInputModel)).is.undefined;
  });
});
