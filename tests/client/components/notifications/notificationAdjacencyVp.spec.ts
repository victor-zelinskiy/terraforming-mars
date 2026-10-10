import {expect} from 'chai';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {Phase} from '@/common/Phase';
import {TileType} from '@/common/TileType';
import {GameEvent} from '@/common/events/GameEvent';
import {EventImpact} from '@/common/events/EventImpact';
import {AdjacencyVpChange} from '@/common/boards/TileMove';
import {viewerImpactOfChain} from '@/client/components/notifications/notificationSemantics';
import {buildEventChildren} from '@/client/components/journal/journalEventChild';

/**
 * A CAPITAL OF THE VIEWER'S RECOUNTED BY SOMEBODY ELSE'S MOVE (PL-041, the
 * TR39 walk — the owner's decision 2026-10-10). The ocean beside red's Capital
 * is carried away by blue's «Прорезание каньона»: the move's event is blue's,
 * red has no event of their own — the fact rides `tileMove.adjacencyVp`,
 * addressed by owner. Red's notification must read the loss («ПО −1», blue
 * the attacker, the card the cause), the journal must print it as red's row,
 * and a move that recounts nobody must say nothing.
 */
const RED: Color = 'red';
const BLUE: Color = 'blue';
const CARD = 'Canyon Carving' as CardName;

function event(partial: Partial<GameEvent> & {id: number; type: GameEvent['type']; correlationId: number; impact: EventImpact}): GameEvent {
  return {generation: 1, phase: Phase.ACTION, visibility: 'journal', ...partial} as GameEvent;
}

function moveChain(adjacencyVp?: ReadonlyArray<AdjacencyVpChange>): Array<GameEvent> {
  return [
    event({id: 1, type: 'action', player: BLUE, correlationId: 1, source: {kind: 'card', card: CARD, owner: BLUE}, impact: {}}),
    event({id: 2, type: 'tile-moved', player: BLUE, correlationId: 1, parentId: 1, source: {kind: 'card', card: CARD, owner: BLUE},
      space: '34' as never, tile: TileType.OCEAN,
      impact: {tileMove: {from: '33' as never, to: '34' as never, tileType: TileType.OCEAN, ...(adjacencyVp === undefined ? {} : {adjacencyVp})}}}),
    event({id: 3, type: 'resource-changed', player: BLUE, correlationId: 1, parentId: 1, impact: {stock: {megacredits: 2}}}),
  ];
}

const LOSS = [{space: '24' as never, player: RED, tile: TileType.CAPITAL, before: 1, after: 0}];
const GAIN = [{space: '24' as never, player: RED, tile: TileType.CAPITAL, before: 0, after: 1}];

describe('a Capital recounted by another player\'s move (PL-041)', () => {
  it('red reads the loss: a VP chip «−1», blue the attacker, the move\'s card the cause, the scope «vp»', () => {
    const meta = viewerImpactOfChain(moveChain(LOSS), RED, BLUE);
    expect(meta.sign).to.eq('negative');
    expect(meta.losses).to.deep.eq([{icon: 'vp', text: '−1'}]);
    expect(meta.gains).to.deep.eq([]);
    expect(meta.attacker).to.eq(BLUE);
    expect(meta.scope).to.eq('vp');
    expect(meta.sourceCard).to.eq(CARD);
    expect(meta.causes).to.have.length(1);
    expect(meta.causes[0].losses).to.deep.eq([{icon: 'vp', text: '−1'}]);
  });

  it('…and a gain when the ocean comes to its side', () => {
    const meta = viewerImpactOfChain(moveChain(GAIN), RED, BLUE);
    expect(meta.sign).to.eq('positive');
    expect(meta.gains).to.deep.eq([{icon: 'vp', text: '+1'}]);
    expect(meta.losses).to.deep.eq([]);
  });

  it('a move with no recount says nothing to red; the mover never reads their own chain', () => {
    expect(viewerImpactOfChain(moveChain(undefined), RED, BLUE).sign).to.eq('neutral');
    expect(viewerImpactOfChain(moveChain(LOSS), BLUE, BLUE).sign).to.eq('neutral');
    // Somebody else's Capital is not the viewer's business.
    expect(viewerImpactOfChain(moveChain(LOSS), 'green' as Color, BLUE).sign).to.eq('neutral');
  });

  it('PL-141 — a PLACEMENT and a REMOVAL carry the same fact on their own events (`impact.adjacencyVp`): red reads the gain of an ocean placed beside their Capital, the loss of one lifted off', () => {
    const placedChain = [
      event({id: 1, type: 'action', player: BLUE, correlationId: 1, source: {kind: 'card', card: CARD, owner: BLUE}, impact: {}}),
      event({id: 2, type: 'tile-placed', player: BLUE, correlationId: 1, parentId: 1, source: {kind: 'card', card: CARD, owner: BLUE},
        space: '33' as never, tile: TileType.OCEAN, impact: {tilesPlaced: 1, adjacencyVp: GAIN}}),
    ];
    const gained = viewerImpactOfChain(placedChain, RED, BLUE);
    expect(gained.sign).to.eq('positive');
    expect(gained.gains).to.deep.eq([{icon: 'vp', text: '+1'}]);
    const removedChain = [
      event({id: 1, type: 'action', player: BLUE, correlationId: 1, source: {kind: 'card', card: CARD, owner: BLUE}, impact: {}}),
      event({id: 2, type: 'tile-removed', player: BLUE, correlationId: 1, parentId: 1, source: {kind: 'card', card: CARD, owner: BLUE},
        space: '33' as never, tile: TileType.OCEAN, impact: {adjacencyVp: LOSS}}),
    ];
    const lost = viewerImpactOfChain(removedChain, RED, BLUE);
    expect(lost.sign).to.eq('negative');
    expect(lost.losses).to.deep.eq([{icon: 'vp', text: '−1'}]);
    expect(lost.attacker).to.eq(BLUE);
    // The journal: the placement's / the removal's own row, then the Capital's row in RED's name.
    const placedRows = buildEventChildren(placedChain, 1, BLUE);
    expect(placedRows.find((r) => r.source.kind === 'label' && r.source.label === 'Placement'), 'the placement row').to.not.eq(undefined);
    const gainRow = placedRows.find((r) => r.source.kind === 'label' && r.source.label === 'Capital gains an adjacent ocean');
    expect(gainRow?.player).to.eq(RED);
    expect(gainRow?.chips).to.deep.eq([{icon: 'vp', text: '+1'}]);
    const removedRows = buildEventChildren(removedChain, 1, BLUE);
    const removal = removedRows.find((r) => r.source.kind === 'label' && r.source.label === 'Tile removal');
    expect(removal, 'the removal row').to.not.eq(undefined);
    expect(removal?.space).to.eq('33');
    const lossRow = removedRows.find((r) => r.source.kind === 'label' && r.source.label === 'Capital loses an adjacent ocean');
    expect(lossRow?.player).to.eq(RED);
    expect(lossRow?.chips).to.deep.eq([{icon: 'vp', text: '−1'}]);
  });

  it('the journal: the move\'s own row, then the Capital\'s recount as RED\'s row with a VP chip and the Capital\'s cell', () => {
    const rows = buildEventChildren(moveChain(LOSS), 1, BLUE);
    const move = rows.find((r) => r.source.kind === 'label' && r.source.label === 'Tile relocation');
    expect(move, 'the relocation row').to.not.eq(undefined);
    const capital = rows.find((r) => r.source.kind === 'label' && r.source.label === 'Capital loses an adjacent ocean');
    expect(capital, 'the recount row').to.not.eq(undefined);
    expect(capital?.player).to.eq(RED);
    expect(capital?.chips).to.deep.eq([{icon: 'vp', text: '−1'}]);
    expect(capital?.space).to.eq('24');
    // Another seat's rows stand after the actor's own (the journal's reading order) — after the move, never before it.
    expect(rows.indexOf(capital!), 'after the move').to.be.greaterThan(rows.indexOf(move!));
  });
});
