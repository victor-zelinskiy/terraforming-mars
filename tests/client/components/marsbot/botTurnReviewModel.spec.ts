import {expect} from 'chai';
import {Tag} from '@/common/cards/Tag';
import {CardName} from '@/common/cards/CardName';
import {Color} from '@/common/Color';
import {Resource} from '@/common/Resource';
import {TileType} from '@/common/TileType';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {LogMessage} from '@/common/logs/LogMessage';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {MarsBotTurn, MarsBotTurnStep} from '@/common/automa/MarsBotTurn';
import {MarsBotTrackModel} from '@/common/models/MarsBotModel';
import {buildBotTurnReview, BotTurnReviewSource} from '@/client/components/marsbot/botTurnReviewModel';

const TRACK_TAGS = [Tag.BUILDING, Tag.SCIENCE];
// Track 0 = Building (single tag); track 1 = a COMPOSITE Science+Jovian track,
// with a bonus at cell 3 (city) so the mini-scale + reached-cell tests have data.
const TRACKS = [
  {tags: [Tag.BUILDING], position: 4, maxPosition: 18, layout: [undefined, 'advance', undefined, 'city', undefined, 'tr1'], regressed: []},
  {tags: [Tag.SCIENCE, Tag.JOVIAN], position: 3, maxPosition: 18, layout: [undefined, undefined, 'advance', 'city', undefined, 'ocean'], regressed: []},
] as unknown as ReadonlyArray<MarsBotTrackModel>;

function log(message: string, data: LogMessage['data'] = []): LogMessage {
  return {message, data} as unknown as LogMessage;
}

function src(steps: ReadonlyArray<MarsBotTurnStep>, visual?: MarsBotTurn['visual']): BotTurnReviewSource {
  return {
    botColor: 'red' as Color,
    botName: 'MarsBot',
    difficulty: 'normal',
    ctx: {venus: false, colonies: true},
    turn: {id: 1, generation: 3, steps, ...(visual !== undefined ? {visual} : {})},
    trackTags: TRACK_TAGS,
    tracks: TRACKS,
  };
}

describe('botTurnReviewModel', () => {
  it('1. project card, tags only → project card + tag chains + honest quiet verdict', () => {
    const r = buildBotTurnReview(src([
      {kind: 'reveal', card: {kind: 'project', name: CardName.GENE_REPAIR}},
      {kind: 'tag', tag: Tag.SCIENCE, trackIndex: 1},
      {kind: 'advance', trackIndex: 1, from: 2, to: 3},
    ]));
    expect(r.card).deep.eq({kind: 'project', name: CardName.GENE_REPAIR, tags: [{tag: Tag.SCIENCE, trackTag: Tag.SCIENCE, ignored: false}]});
    expect(r.verdict.key).eq('Advanced its internal tracks');
    expect(r.quiet).is.true;
    expect(r.chains).lengthOf(1);
    expect(r.chains[0].cause).deep.eq({kind: 'tag', tag: Tag.SCIENCE, trackTag: Tag.SCIENCE});
    const line = r.chains[0].lines[0];
    expect(line.kind).eq('track');
    if (line.kind === 'track') {
      expect([line.from, line.to, line.depth]).deep.eq([2, 3, 1]);
    }
  });

  it('2. project card triggers a tile placement → verdict, board tile, primarySpaceId, nested consequence', () => {
    const r = buildBotTurnReview(src([
      {kind: 'reveal', card: {kind: 'project', name: CardName.GENE_REPAIR}},
      {kind: 'tag', tag: Tag.BUILDING, trackIndex: 0},
      {kind: 'advance', trackIndex: 0, from: 3, to: 4, action: 'ocean'},
      {kind: 'log', message: log('${0} raised oxygen 1 step')},
      {kind: 'impact', impact: {target: 'red' as Color, targetIsBot: true, changes: [{resource: 'megacredits' as Resource, scope: 'stock', before: 15, after: 19}]}},
    ], {tiles: [{spaceId: '05', tileType: TileType.OCEAN}], oceans: {before: 3, after: 4}}));
    expect(r.verdict.key).eq('Placed an ocean');
    expect(r.tiles).deep.eq([{spaceId: '05', tileType: TileType.OCEAN}]);
    expect(r.primarySpaceId).eq('05');
    expect(r.params).deep.eq([{icon: 'ocean', before: 3, after: 4}]);
    // The track move carries its action; the log consequence nests under it.
    const lines = r.chains[0].lines;
    const track = lines.find((l) => l.kind === 'track');
    const consequence = lines.find((l) => l.kind === 'log');
    expect(track?.kind === 'track' && track.action).eq('ocean');
    expect(consequence?.depth).eq(2);
    // Headline chips lead with the neutral param, then the bot's own gain.
    expect(r.headlineChips[0]).deep.eq({icon: 'ocean', text: '3→4', neutral: true});
    expect(r.headlineChips.some((c) => c.icon === 'megacredits' && c.text === '+4')).is.true;
  });

  it('3. cascade: a track action that advances again nests one deeper', () => {
    const r = buildBotTurnReview(src([
      {kind: 'reveal', card: {kind: 'project', name: CardName.GENE_REPAIR}},
      {kind: 'tag', tag: Tag.BUILDING, trackIndex: 0},
      {kind: 'advance', trackIndex: 0, from: 0, to: 1, action: 'advance'},
      {kind: 'advance', trackIndex: 0, from: 1, to: 2},
    ]));
    const tracks = r.chains[0].lines.filter((l) => l.kind === 'track');
    expect(tracks.map((l) => l.depth)).deep.eq([1, 2]);
  });

  it('4. failed action → its own chain + a M€ verdict', () => {
    const r = buildBotTurnReview(src([
      {kind: 'reveal', card: {kind: 'project', name: CardName.GENE_REPAIR}},
      {kind: 'failed', reason: 'no-tags', mc: 5, message: log('failed action money')},
      {kind: 'impact', impact: {target: 'red' as Color, targetIsBot: true, changes: [{resource: 'megacredits' as Resource, scope: 'stock', before: 10, after: 15}]}},
    ]));
    expect(r.verdict).deep.eq({key: 'Failed action — gained ${0} M€', params: ['5']});
    const failedChain = r.chains.find((c) => c.cause.kind === 'failed');
    expect(failedChain).is.not.undefined;
    expect(failedChain?.lines[0].kind).eq('log');
  });

  it('5. bonus attack → attacks row, verdict, victim outcome preserved', () => {
    const r = buildBotTurnReview(src([
      {kind: 'reveal', card: {kind: 'bonus', id: BonusCardId.B01_METEOR_SHOWER}, message: log('${0} revealed a bonus card')},
      {kind: 'attack', attack: {target: 'blue' as Color, resource: Resource.PLANTS, demanded: 5, removed: 4, before: 6, after: 2, outcome: 'hit'}},
      {kind: 'impact', impact: {target: 'blue' as Color, targetIsBot: false, changes: [{resource: 'plants' as Resource, scope: 'stock', before: 6, after: 2}]}},
    ]));
    expect(r.card).deep.eq({kind: 'bonus', id: BonusCardId.B01_METEOR_SHOWER});
    expect(r.verdict.key).eq('Attacked an opponent');
    expect(r.attacks).lengthOf(1);
    expect(r.attacks[0].outcome).eq('hit');
    expect(r.playerImpacts).deep.eq([{target: 'blue', changes: [{resource: 'plants', scope: 'stock', before: 6, after: 2}]}]);
    // The attack is grouped under the bonus card, not left loose.
    expect(r.chains[0].cause).deep.eq({kind: 'bonus', id: BonusCardId.B01_METEOR_SHOWER});
    expect(r.chains[0].lines.some((l) => l.kind === 'attack')).is.true;
  });

  it('6. Shipping Lines trade → trade chain + the M€ deduct is tagged as a trade cost (never a bare loss)', () => {
    const r = buildBotTurnReview(src([
      {kind: 'reveal', card: {kind: 'bonus', id: BonusCardId.B19_SHIPPING_LINES}, message: log('${0} revealed a bonus card')},
      {kind: 'log', message: log('${0} lost ${1} ${2}', [{type: LogMessageDataType.PLAYER, value: 'red'}, {type: LogMessageDataType.STRING, value: '1'}, {type: LogMessageDataType.STRING, value: 'M€'}] as never)},
      {kind: 'log', message: log('${0} trades with ${1}')},
      {kind: 'log', message: log('${0} gained ${1} resource(s) in its ${2} storage area')},
    ]));
    expect(r.verdict.key).eq('Traded with a colony');
    const chain = r.chains[0];
    expect(chain.cause).deep.eq({kind: 'trade', id: BonusCardId.B19_SHIPPING_LINES});
    const costLine = chain.lines.find((l) => l.kind === 'log' && l.tone === 'cost');
    expect(costLine, 'the −1 M€ deduct is labelled as the trade cost').is.not.undefined;
    if (costLine?.kind === 'log') {
      expect(costLine.labelKey).eq('Trade cost');
    }
  });

  it('7. an unused-expansion tag is shown as an ignored note, never dropped', () => {
    const r = buildBotTurnReview(src([
      {kind: 'reveal', card: {kind: 'project', name: CardName.GENE_REPAIR}},
      {kind: 'tag', tag: Tag.VENUS},
    ]));
    expect(r.card?.kind === 'project' && r.card.tags[0]).deep.eq({tag: Tag.VENUS, trackTag: undefined, ignored: true});
    expect(r.chains[0].lines[0]).deep.eq({kind: 'note', depth: 1, noteKey: 'tag of an unused expansion — ignored', tone: 'ignored'});
  });

  it('8. pass → quiet, pass verdict, no card', () => {
    const r = buildBotTurnReview(src([{kind: 'pass', message: log('${0} passed')}]));
    expect(r.verdict.key).eq('MarsBot passed this turn');
    expect(r.quiet).is.true;
    expect(r.card).is.undefined;
  });

  it('9. a global-parameter-only turn → param verdict + neutral chips', () => {
    const r = buildBotTurnReview(src([
      {kind: 'reveal', card: {kind: 'bonus', id: BonusCardId.B16_GOVERNMENT_INTERVENTION}, message: log('${0} revealed a bonus card')},
      {kind: 'log', message: log('${0} raised the temperature 1 step')},
    ], {temperature: {before: -26, after: -24}}));
    expect(r.verdict.key).eq('Advanced a global parameter');
    expect(r.params).deep.eq([{icon: 'temperature', before: -26, after: -24}]);
    expect(r.headlineChips[0]).deep.eq({icon: 'temperature', text: '-26°→-24°', neutral: true});
  });

  it('10. milestone claim → its own verdict (from the server log template)', () => {
    const r = buildBotTurnReview(src([
      {kind: 'reveal', card: {kind: 'bonus', id: BonusCardId.B04_OVERACHIEVEMENT}, message: log('${0} revealed a bonus card')},
      {kind: 'log', message: log('${0} claimed ${1} milestone')},
    ]));
    expect(r.verdict.key).eq('Claimed a milestone');
  });

  // ── Phase B: the server's `cause`/`depth`/`resolution` markers ────────────

  it('B1. cause markers group steps into one chain per tag — from data, not order', () => {
    const r = buildBotTurnReview(src([
      {kind: 'reveal', card: {kind: 'project', name: CardName.GENE_REPAIR}},
      {kind: 'tag', tag: Tag.BUILDING, trackIndex: 0, cause: {kind: 'tag', index: 0}},
      {kind: 'advance', trackIndex: 0, from: 3, to: 4, cause: {kind: 'tag', index: 0}},
      {kind: 'tag', tag: Tag.SCIENCE, trackIndex: 1, cause: {kind: 'tag', index: 1}},
      {kind: 'advance', trackIndex: 1, from: 2, to: 3, action: 'tr1', cause: {kind: 'tag', index: 1}},
      {kind: 'log', message: log('${0} gained 1 TR'), cause: {kind: 'tag', index: 1}},
    ]));
    expect(r.chains).lengthOf(2);
    expect(r.chains[0].cause).deep.eq({kind: 'tag', tag: Tag.BUILDING, trackTag: Tag.BUILDING});
    expect(r.chains[1].cause).deep.eq({kind: 'tag', tag: Tag.SCIENCE, trackTag: Tag.SCIENCE});
    // The TR log is grouped under the SECOND tag (its cause), nested under the track.
    const scienceLines = r.chains[1].lines;
    expect(scienceLines.map((l) => l.kind)).deep.eq(['track', 'log']);
    expect(scienceLines[1].depth).eq(2);
  });

  it('B2. advance.depth nests the cascade exactly (no order guessing)', () => {
    const r = buildBotTurnReview(src([
      {kind: 'reveal', card: {kind: 'project', name: CardName.GENE_REPAIR}},
      {kind: 'tag', tag: Tag.BUILDING, trackIndex: 0, cause: {kind: 'tag', index: 0}},
      {kind: 'advance', trackIndex: 0, from: 0, to: 1, action: 'advance', cause: {kind: 'tag', index: 0}},
      {kind: 'advance', trackIndex: 0, from: 1, to: 2, cause: {kind: 'tag', index: 0}, depth: 1},
    ]));
    const tracks = r.chains[0].lines.filter((l) => l.kind === 'track');
    expect(tracks.map((l) => l.depth)).deep.eq([1, 2]);
  });

  it('B3. a bonus card\'s resolved fate rides the card block', () => {
    const r = buildBotTurnReview(src([
      {kind: 'reveal', card: {kind: 'bonus', id: BonusCardId.B01_METEOR_SHOWER}, message: log('${0} revealed a bonus card'), resolution: {fate: 'destroyed'}},
      {kind: 'attack', attack: {target: 'blue' as Color, resource: Resource.PLANTS, demanded: 5, removed: 4, before: 6, after: 2, outcome: 'hit'}, cause: {kind: 'bonus'}},
    ]));
    expect(r.card).deep.eq({kind: 'bonus', id: BonusCardId.B01_METEOR_SHOWER, fate: 'destroyed'});
    // The bonus attack is grouped under the bonus chain via its cause.
    expect(r.chains[0].cause).deep.eq({kind: 'bonus', id: BonusCardId.B01_METEOR_SHOWER});
  });

  it('B4. colony cause → a trade chain with the fee tagged as a trade cost', () => {
    const r = buildBotTurnReview(src([
      {kind: 'reveal', card: {kind: 'bonus', id: BonusCardId.B19_SHIPPING_LINES}, message: log('${0} revealed a bonus card'), resolution: {fate: 'discarded'}},
      {kind: 'log', message: log('${0} lost ${1} ${2}', [{type: LogMessageDataType.PLAYER, value: 'red'}, {type: LogMessageDataType.STRING, value: '1'}, {type: LogMessageDataType.STRING, value: 'M€'}] as never), cause: {kind: 'colony'}},
      {kind: 'log', message: log('${0} trades with ${1}'), cause: {kind: 'colony'}},
    ]));
    expect(r.card?.kind === 'bonus' && r.card.fate).eq('discarded');
    expect(r.chains[0].cause).deep.eq({kind: 'trade', id: BonusCardId.B19_SHIPPING_LINES});
    const costLine = r.chains[0].lines.find((l) => l.kind === 'log' && l.tone === 'cost');
    expect(costLine).is.not.undefined;
  });

  it('11. bot + opponent impacts split into result vs affected, cardNames collected', () => {
    const r = buildBotTurnReview(src([
      {kind: 'reveal', card: {kind: 'project', name: CardName.BIRDS}},
      {kind: 'impact', impact: {target: 'blue' as Color, targetIsBot: false, changes: [{resource: 'plants' as Resource, scope: 'stock', before: 5, after: 3}]}},
      {kind: 'impact', impact: {target: 'red' as Color, targetIsBot: true, changes: [{resource: 'megacredits' as Resource, scope: 'stock', before: 0, after: 5}]}},
    ]));
    expect(r.botResult).deep.eq({target: 'red', changes: [{resource: 'megacredits', scope: 'stock', before: 0, after: 5}]});
    expect(r.playerImpacts).deep.eq([{target: 'blue', changes: [{resource: 'plants', scope: 'stock', before: 5, after: 3}]}]);
    expect(r.cardNames).deep.eq([CardName.BIRDS]);
    // The biggest opponent loss surfaces as a headline chip.
    expect(r.headlineChips.some((c) => c.icon === 'plants' && c.text === '−2')).is.true;
  });

  // ── layout iteration: capsule / mini-scale / service reveals ──────────────

  it('C1. a composite track shows ALL its tags as one capsule (no "icon → same icon")', () => {
    const r = buildBotTurnReview(src([
      {kind: 'reveal', card: {kind: 'project', name: CardName.GENE_REPAIR}},
      {kind: 'tag', tag: Tag.SCIENCE, trackIndex: 1, cause: {kind: 'tag', index: 0}},
      {kind: 'advance', trackIndex: 1, from: 2, to: 3, cause: {kind: 'tag', index: 0}},
    ]));
    const line = r.chains[0].lines.find((l) => l.kind === 'track');
    expect(line?.kind === 'track' && line.capsule).deep.eq([Tag.SCIENCE, Tag.JOVIAN]);
  });

  it('C2. the mini-scale windows around from→to with the reached bonus cell + upcoming cells', () => {
    const r = buildBotTurnReview(src([
      {kind: 'reveal', card: {kind: 'project', name: CardName.GENE_REPAIR}},
      {kind: 'tag', tag: Tag.SCIENCE, trackIndex: 1, cause: {kind: 'tag', index: 0}},
      // track 1 layout: [_, _, advance, city@3, _, ocean@5]; move 2 → 3 lands on the city cell.
      {kind: 'advance', trackIndex: 1, from: 2, to: 3, action: 'city', cause: {kind: 'tag', index: 0}},
    ]));
    const line = r.chains[0].lines.find((l) => l.kind === 'track');
    if (line?.kind !== 'track') {
      throw new Error('expected a track line');
    }
    // Window starts one cell before `from` (index 1) and shows a few upcoming cells.
    expect(line.cells[0].index).eq(1);
    const from = line.cells.find((c) => c.state === 'from');
    const to = line.cells.find((c) => c.state === 'to');
    expect(from?.index).eq(2);
    expect(to?.index).eq(3);
    expect(to?.action).eq('city');
    // An upcoming bonus (ocean at 5) is visible as a future cell.
    expect(line.cells.some((c) => c.state === 'future' && c.action === 'ocean')).is.true;
  });

  it('C3. a tie-break FLIP is a service reveal, kept OUT of the played-card list', () => {
    const r = buildBotTurnReview(src([
      {kind: 'reveal', card: {kind: 'project', name: CardName.BIRDS}},
      {kind: 'tag', tag: Tag.BUILDING, trackIndex: 0, cause: {kind: 'tag', index: 0}},
      {kind: 'advance', trackIndex: 0, from: 3, to: 4, action: 'city', cause: {kind: 'tag', index: 0}},
      {kind: 'log', message: log('${0} flipped ${1} (cost ${2}) to break a placement tie', [
        {type: LogMessageDataType.PLAYER, value: 'red'},
        {type: LogMessageDataType.CARD, value: CardName.GENE_REPAIR},
        {type: LogMessageDataType.STRING, value: '13'},
      ] as never), cause: {kind: 'tag', index: 0}},
    ]));
    // The played card is the ONLY inspectable card — the flip never appears there.
    expect(r.cardNames).deep.eq([CardName.BIRDS]);
    expect(r.technicalReveals).deep.eq([{name: CardName.GENE_REPAIR, reason: 'tiebreak'}]);
  });
});
