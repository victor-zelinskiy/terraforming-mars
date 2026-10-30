import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {Tag} from '@/common/cards/Tag';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {discardExchangeCommitSpecs, discardExchangeOwed, discardExchangeRailKey, discardExchangeSpecs, releaseDiscardExchange} from '@/client/console/cardDiscard/discardExchangeBeat';
import {ActionPreviewBranch} from '@/common/models/ActionPreviewModel';
import {railRewardPending, resetRailRewards, seedRailReward} from '@/client/console/resourceTransfer/railReward';
import {clearPanelRewardHold, heldStock} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {activeAnimationHoldLabels} from '@/client/components/presentation/animationHold';

/*
 * «ОДИН ФРЕЙМВОРК» — a party discard's payout is a WAVE off the printed icon, never a panel computed as
 * `megacredits − mcBefore`: one token per paying printed tag, at the prompt's own rate. The views decide the rest.
 */
describe('discardExchangeBeat', () => {
  const REDS = {icon: 'megacredits', amount: 2, perTag: [Tag.PLANT, Tag.MICROBE, Tag.ANIMAL]};
  const tags: Partial<Record<string, ReadonlyArray<Tag>>> = {
    'Trees': [Tag.PLANT],
    'Tardigrades': [Tag.MICROBE],
    'Livestock': [Tag.ANIMAL],
    'Space Elevator': [Tag.SPACE, Tag.BUILDING],
    'Ecology Experts': [Tag.PLANT, Tag.MICROBE],
  };
  const tagsOf = (card: CardName) => tags[card] ?? [];

  it('one token per paying printed tag, each the rate\'s amount — a card with two paying tags pays twice', () => {
    const specs = discardExchangeSpecs(['Trees', 'Ecology Experts'] as Array<CardName>, REDS, tagsOf);
    expect(specs).to.deep.eq([
      {channel: 'stock', resource: 'megacredits', amount: 2},
      {channel: 'stock', resource: 'megacredits', amount: 2},
      {channel: 'stock', resource: 'megacredits', amount: 2},
    ]);
  });

  it('no paying tag, no token (the server names the skip); no per-tag rate, nothing to read', () => {
    expect(discardExchangeSpecs(['Space Elevator'] as Array<CardName>, REDS, tagsOf)).to.deep.eq([]);
    expect(discardExchangeSpecs(['Trees'] as Array<CardName>, {icon: 'megacredits', amount: 3}, tagsOf)).to.deep.eq([]);
  });

  /* CS · «ВЫПЛАТА СБРОСА — ОДНА ВОЛНА ДЛЯ ЛЮБОГО ИСТОЧНИКА» (P68 Ceres Tech Market): the same rate reader for a card's
   * per-CARD exchange — one token per thrown card, each the rate's amount; an exchange in cards (or with a second payout
   * in cards — the deck's own scene) is not a stock wave. */
  const CERES = {icon: 'megacredits', amount: 2, perCard: true};

  it('perCard: one token per thrown card, each the rate\'s amount — the tags do not matter', () => {
    expect(discardExchangeSpecs(['Space Elevator', 'Trees'] as Array<CardName>, CERES, tagsOf)).to.deep.eq([
      {channel: 'stock', resource: 'megacredits', amount: 2},
      {channel: 'stock', resource: 'megacredits', amount: 2},
    ]);
    expect(discardExchangeSpecs([], CERES, tagsOf)).to.deep.eq([]);
  });

  it('not a stock wave: an exchange in cards (Mars University), a second payout in cards (Open IP Trade), a zero rate', () => {
    expect(discardExchangeSpecs(['Trees'] as Array<CardName>, {icon: 'cards', amount: 1, perCard: false}, tagsOf)).to.deep.eq([]);
    expect(discardExchangeSpecs(['Trees'] as Array<CardName>, {icon: 'megacredits', amount: 3, perCard: true, draw: 1}, tagsOf)).to.deep.eq([]);
    expect(discardExchangeSpecs(['Trees'] as Array<CardName>, {...CERES, amount: 0}, tagsOf)).to.deep.eq([]);
  });

  it('the pre-collected door: the answered discard step of the pressed branch, read off its SERVER marker', () => {
    const marker = {min: 1, max: 3, source: {kind: 'card', card: 'Ceres Tech Market'}, exchange: CERES};
    const branch = {
      index: -1, title: '', available: true, effects: [],
      steps: [
        {kind: 'input', input: {type: 'card', title: 'Discard cards for 2 M€ each', buttonLabel: 'Discard', cards: [], min: 1, max: 3, discardPrompt: marker}},
      ],
    } as unknown as ActionPreviewBranch;
    expect(discardExchangeCommitSpecs(branch, {0: {type: 'card', cards: ['Research', 'Tardigrades']}}, tagsOf)).to.deep.eq([
      {channel: 'stock', resource: 'megacredits', amount: 2},
      {channel: 'stock', resource: 'megacredits', amount: 2},
    ]);
    expect(discardExchangeCommitSpecs(branch, {}, tagsOf), 'an unanswered step pays nothing').to.deep.eq([]);
    const plain = {...branch, steps: [{kind: 'input', input: {type: 'card', title: '', buttonLabel: 'Select', cards: [], min: 1, max: 1}}]} as unknown as ActionPreviewBranch;
    expect(discardExchangeCommitSpecs(plain, {0: {type: 'card', cards: ['Research']}}, tagsOf), 'a pick that is not a discard').to.deep.eq([]);
    expect(discardExchangeCommitSpecs(undefined, {}, tagsOf)).to.deep.eq([]);
  });

  it('the rail key is the source\'s', () => {
    expect(discardExchangeRailKey('PARTY_Reds')).to.eq('discard-exchange:PARTY_Reds');
  });

  /* THE OWNER LEAVES (field 2026-10-24 / 25 — «"rail-reward" held for over 35000ms … discard-exchange:PARTY_Reds …
   * phase "held"»): the composer is the payout's ONE flyer; a composer closing for good, or the stall net tearing its
   * workspace down, releases what it would have flown — the rows tick now, the blocking hold falls. */
  it('releaseDiscardExchange: the held payout of a source is released, its blocking hold falls; an absent source is a no-op', () => {
    const view = (mc: number) => ({
      id: 'p-viewer',
      thisPlayer: {color: 'blue', terraformRating: 20, megacredits: mc, energy: 0, steel: 0, titanium: 0, plants: 0, heat: 0,
        megacreditProduction: 0, steelProduction: 0, titaniumProduction: 0, plantProduction: 0, energyProduction: 0, heatProduction: 0},
    } as unknown as PlayerViewModel);
    resetRailRewards();
    clearPanelRewardHold();
    const key = discardExchangeRailKey('PARTY_Reds');
    expect(seedRailReward(key, {cause: [{channel: 'stock', resource: 'megacredits', amount: 2}], reactions: []}, view(10), view(12))).to.eq(true);
    expect(discardExchangeOwed('PARTY_Reds')).to.eq(true);
    expect(heldStock('megacredits')).to.eq(2);
    expect(activeAnimationHoldLabels().some((label) => label.startsWith('rail-reward'))).to.eq(true);
    releaseDiscardExchange(undefined, 'test');
    releaseDiscardExchange('PARTY_Greens', 'test');
    expect(railRewardPending(key), 'another source releases nothing').to.eq(true);
    releaseDiscardExchange('PARTY_Reds', 'composer-closed');
    expect(railRewardPending(key)).to.eq(false);
    expect(heldStock('megacredits'), 'the row ticks now, honestly late').to.eq(0);
    expect(activeAnimationHoldLabels().some((label) => label.startsWith('rail-reward'))).to.eq(false);
    releaseDiscardExchange('PARTY_Reds', 'twice');
  });
});
