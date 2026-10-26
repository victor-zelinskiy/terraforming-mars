import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {Resource} from '../../src/common/Resource';
import {LogMessageDataType} from '../../src/common/logs/LogMessageDataType';
import {CardReactionRecord} from '../../src/common/models/CardReactionModel';
import {reactionGroupOf} from '../../src/client/console/cardReaction/cardReactionModel';
import {
  REACTION_SUMMARY_LABEL_KEY, REACTION_SUMMARY_LINE_KEY, buildCardReactionSummaryNotification, reactionSummaryChips,
} from '../../src/client/console/cardReaction/cardReactionSummary';

/**
 * PL-1056 — the groups past the chain's ceiling are told ONCE: one feed card, the viewer's merged deltas leading,
 * one line per reactor with its card token, never a silent tick and never a card per reactor.
 */
const BLUE = 'blue';

function record(seq: number, card: CardName, impacts: CardReactionRecord['impacts']): CardReactionRecord {
  return {seq, root: {}, owner: BLUE, kind: 'card', card, channel: 'tile-placed', impacts};
}

describe('cardReactionSummary — one card for what the ceiling cut', () => {
  const tharsis = reactionGroupOf(record(1, CardName.THARSIS_REPUBLIC, [
    {kind: 'production', resource: Resource.MEGACREDITS, amount: 1, to: BLUE}, {kind: 'stock', resource: Resource.MEGACREDITS, amount: 3, to: BLUE},
  ]), BLUE);
  const rover = reactionGroupOf(record(2, CardName.ROVER_CONSTRUCTION, [{kind: 'stock', resource: Resource.MEGACREDITS, amount: 2, to: BLUE}]), BLUE);
  const pets = reactionGroupOf(record(3, CardName.PETS, [{kind: 'card-resource', resource: 'Animal' as never, amount: 1, target: CardName.PETS, to: BLUE}]), BLUE);

  it('merges the deltas per row — the cash of two reactors as one chip, a production step on its frame, a card resource by its kind', () => {
    const chips = reactionSummaryChips([tharsis, rover, pets]);
    expect(chips).deep.eq([
      {icon: 'megacredits', text: '+1', production: true},
      {icon: 'megacredits', text: '+5'},
      {icon: 'animal', text: '+1'},
    ]);
  });

  it('a loss keeps its sign and the card reads MIXED; a draw is a cards chip', () => {
    const loss = reactionGroupOf(record(4, CardName.DECOMPOSERS, [{kind: 'stock', resource: Resource.PLANTS, amount: -2, to: BLUE}, {kind: 'draw', amount: 1, to: BLUE}]), BLUE);
    const chips = reactionSummaryChips([loss]);
    expect(chips).deep.eq([{icon: 'plants', text: '−2'}, {icon: 'cards', text: '+1'}]);
    const model = buildCardReactionSummaryNotification([loss], BLUE, 5);
    expect(model?.sign).eq('mixed');
    expect(model?.viewerImpact?.losses).to.have.lengthOf(1);
    expect(model?.viewerImpact?.gains).to.have.lengthOf(1);
  });

  it('ONE card: the viewer leads with the merged gains, one line per reactor with its CARD token, the journal as the way in', () => {
    const model = buildCardReactionSummaryNotification([tharsis, rover], BLUE, 1234);
    expect(model).is.not.undefined;
    expect(model?.id).eq('reaction-summary:1.2');
    expect(model?.kind).eq('normal');
    expect(model?.variant).eq('passive-effect');
    expect(model?.sign).eq('positive');
    expect(model?.importance).eq('notable');
    expect(model?.typeLabelKey).eq(REACTION_SUMMARY_LABEL_KEY);
    expect(model?.actor).eq(BLUE);
    expect(model?.viewerImpact?.gains.map((c) => c.text)).deep.eq(['+1', '+5']);
    expect(model?.summaryLines?.map((l) => l.message.message)).deep.eq([REACTION_SUMMARY_LINE_KEY, REACTION_SUMMARY_LINE_KEY]);
    expect(model?.summaryLines?.map((l) => l.message.data[0])).deep.eq([
      {type: LogMessageDataType.CARD, value: CardName.THARSIS_REPUBLIC}, {type: LogMessageDataType.CARD, value: CardName.ROVER_CONSTRUCTION},
    ]);
    expect(model?.cta?.action).eq('open-journal');
    expect(model?.createdAt).eq(1234);
    expect(model?.persistent).is.false;
  });

  it('nothing to tell → no card', () => {
    expect(buildCardReactionSummaryNotification([], BLUE, 0)).is.undefined;
  });
});
