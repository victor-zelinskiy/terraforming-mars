import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {ColonyName} from '@/common/colonies/ColonyName';
import {PartyName} from '@/common/turmoil/PartyName';
import {DiscardPromptMeta, PlayerInputModel} from '@/common/models/PlayerInputModel';
import {
  deriveDiscardIntent,
  discardExchangeFor,
  discardHeadline,
  discardMetaOf,
  discardPickedTags,
  isDiscardPrompt,
  nestedDiscardBranch,
} from '@/client/console/cardDiscard/discardIntent';
import {Tag} from '@/common/cards/Tag';

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

  it('«any number» (1 to the whole hand — the sale\'s form, the resolution action\'s pick) names no count, and the LAW that asks is carried by id', () => {
    const meta: DiscardPromptMeta = {min: 1, max: 5, source: {kind: 'resolution', resolution: 'RDX_SCIENTISTS_OPEN_IP_TRADE'},
      exchange: {icon: 'megacredits', amount: 3, perCard: true, draw: 1}};
    expect(discardHeadline(meta)).to.deep.eq({key: 'Discard any number of cards'});
    expect(discardHeadline({min: 1, max: 1})).to.deep.eq({key: 'Discard 1 card'});
    expect(discardHeadline({min: 2, max: 5})).to.deep.eq({key: 'Discard ${0} cards', amount: 2});
    const intent = deriveDiscardIntent(meta, 2);
    expect(intent.resolution).to.eq('RDX_SCIENTISTS_OPEN_IP_TRADE');
    expect(intent.sourceKey).to.eq('Resolution');
    expect(intent.exchange).to.deep.eq({icon: 'megacredits', amount: 6, perCard: true});
    expect(deriveDiscardIntent({min: 1, max: 1, source: {kind: 'card', card: CardName.MARS_UNIVERSITY}}, 0).resolution).to.eq(undefined);
  });

  it('resolves a per-card payout against the LIVE pick count', () => {
    const perCard = meta({min: 0, max: 5, exchange: {icon: 'megacredits', amount: 2, perCard: true}});
    expect(discardExchangeFor(perCard, 0)?.amount).eq(0);
    expect(discardExchangeFor(perCard, 3)?.amount).eq(6);

    const flat = meta({exchange: {icon: 'cards', amount: 3}});
    expect(discardExchangeFor(flat, 1)?.amount).eq(3);
    expect(discardExchangeFor(meta(), 1)).is.undefined;
  });

  it('resolves a per-TAG payout against the tags of the picked cards (the Reds recycle), never per card', () => {
    const perTag = meta({min: 2, max: 2, exchange: {icon: 'megacredits', amount: 2, perTag: [Tag.PLANT, Tag.MICROBE, Tag.ANIMAL]}});
    // Two cards picked, three matching tags between them (a space tag does not count).
    const tags = discardPickedTags(perTag, [[Tag.PLANT, Tag.SPACE], [Tag.MICROBE, Tag.ANIMAL]]);
    expect(tags).eq(3);
    expect(discardExchangeFor(perTag, 2, tags)?.amount).eq(6);
    expect(discardExchangeFor(perTag, 2, 0)?.amount, 'tagless picks buy nothing').eq(0);
    expect(deriveDiscardIntent(perTag, 2, tags).exchange?.amount).eq(6);
    // A per-card exchange ignores the tag count.
    const perCard = meta({min: 0, max: 5, exchange: {icon: 'megacredits', amount: 2, perCard: true}});
    expect(discardPickedTags(perCard, [[Tag.PLANT]])).eq(0);
    expect(discardExchangeFor(perCard, 3, 5)?.amount).eq(6);
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

    // Turmoil Redux: a PARTY's action asks — the header names the party, never «a game rule».
    const party = deriveDiscardIntent(meta({min: 2, max: 2, source: {kind: 'party', party: PartyName.REDS}}), 0);
    expect(party.sourceKey).eq('Party action');
    expect(party.partyName).eq(PartyName.REDS);
    expect(party.card).is.undefined;
  });

  it('carries the colony-bonus position (Pluto resolves one cube at a time)', () => {
    const intent = deriveDiscardIntent(
      meta({source: {kind: 'colony'}, colonyBonus: {colonyName: ColonyName.PLUTO, index: 2, total: 3}}), 1);
    expect(intent.sequence).deep.eq({index: 2, total: 3});
    expect(intent.colonyName).eq(ColonyName.PLUTO);
    expect(intent.picked).eq(1);
  });

  /* Turmoil Redux — Colonial Affairs repeats Pluto's bonus k times: the resolution is the source, the
   * tile and the pair's position ride `colonyRepeat` (deliberately NOT `colonyBonus`, which would route the
   * COLONY workspace's step), and the header reads the same planet and the same «n of k». */
  it('a RESOLUTION\'s repeat of a colony bonus names the resolution and carries the tile + position through `colonyRepeat`', () => {
    const intent = deriveDiscardIntent(
      meta({source: {kind: 'resolution', resolution: 'RDX_UNITY_COLONIAL_AFFAIRS'}, colonyRepeat: {colonyName: ColonyName.PLUTO, index: 1, total: 2}}), 0);
    expect(intent.sourceKey).eq('Resolution');
    expect(intent.card).is.undefined;
    expect(intent.sequence).deep.eq({index: 1, total: 2});
    expect(intent.colonyName).eq(ColonyName.PLUTO);
    expect(intent.single).is.true;
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
