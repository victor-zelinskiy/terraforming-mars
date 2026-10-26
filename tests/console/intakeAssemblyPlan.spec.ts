import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {GlobalParameter} from '../../src/common/GlobalParameter';
import {CardIntakeSegment} from '../../src/common/models/CardDrawRevealModel';
import {cardArrivalTimings, planCardArrival} from '../../src/client/console/consoleCardArrival';
import {
  intakeAssemblyOwnsBatch, intakeAssemblyPresentsBatch, intakeAssemblyTimings, intakeOriginOf, intakeSearchRun, planIntakeAssembly, rowRectOf, triggerSeatRect,
} from '../../src/client/console/cardIntake/intakeAssemblyPlan';

/**
 * THE ASSEMBLY SCENE's plan («ОДНО ДЕЙСТВИЕ — ОДИН ЗАБОР», Ф3): every run starts from its own place, in the server's
 * order, one cause dealing at a time; a trigger card surfaces before it deals and recedes after; the degradations
 * are named facts, never a guess.
 */
describe('intakeAssemblyPlan — one row, several causes, in the rules\' order', () => {
  const research: CardIntakeSegment = {source: {type: 'card', cardName: CardName.RESEARCH}, count: 2};
  const olympus: CardIntakeSegment = {source: {type: 'card', cardName: CardName.OLYMPUS_CONFERENCE}, count: 1};
  const marsU: CardIntakeSegment = {source: {type: 'card', cardName: CardName.MARS_UNIVERSITY}, count: 1};
  const cell: CardIntakeSegment = {source: {type: 'tile', spaceId: '12'}, count: 1};
  const arrival = cardArrivalTimings();
  const t = intakeAssemblyTimings();

  it('owns a batch of more than one cause only', () => {
    expect(intakeAssemblyOwnsBatch({segments: [research]})).is.false;
    expect(intakeAssemblyOwnsBatch({segments: [research, olympus]})).is.true;
    expect(intakeAssemblyOwnsBatch(undefined)).is.false;
  });

  it('PRESENTS a one-cause batch too when its cause is a card NOT on the stage — the single hook\'s trigger rises («СРАБАТЫВАНИЕ КАРТЫ», decision 5)', () => {
    expect(intakeAssemblyPresentsBatch({segments: [research, olympus]}, undefined), 'a merged batch — always').is.true;
    expect(intakeAssemblyPresentsBatch({segments: [olympus]}, undefined), 'Olympus Conference\'s own draw, nobody on stage').is.true;
    expect(intakeAssemblyPresentsBatch({segments: [olympus]}, CardName.RESEARCH), 'the stage card is another card').is.true;
    expect(intakeAssemblyPresentsBatch({segments: [research]}, CardName.RESEARCH), 'the stage card\'s own draw comes off the deck').is.false;
    expect(intakeAssemblyPresentsBatch({segments: [cell]}, undefined), 'a cell\'s draw keeps its family\'s scene').is.false;
    expect(intakeAssemblyPresentsBatch({segments: [{source: undefined, count: 1}]}, undefined), 'an unattributed draw').is.false;
    expect(intakeAssemblyPresentsBatch(undefined, undefined)).is.false;
  });

  it('R4 · the SEARCH RUN of a merged batch: one segment with rejects, judged on its own tape; the others plain', () => {
    const step = (name: CardName, matched: boolean) => ({card: {name} as never, matched});
    const search: CardIntakeSegment = {
      source: {type: 'card', cardName: CardName.SCIENTIFIC_BREAKTHROUGH}, count: 2,
      sequence: [step(CardName.COMET, false), step(CardName.FISH, false), step(CardName.RESEARCH, true), step(CardName.PHYSICS_COMPLEX, true)],
    };
    expect(intakeSearchRun({segments: [olympus, search]}), 'Olympus first, the search after: the span and the tape').deep.eq({index: 1, first: 1, count: 2, steps: 4});
    expect(intakeSearchRun({segments: [search, marsU]}), 'the search first').deep.eq({index: 0, first: 0, count: 2, steps: 4});
    expect(intakeSearchRun({segments: [search]}), 'one cause keeps its family\'s scene').eq(undefined);
    expect(intakeSearchRun({segments: [olympus, research]}), 'no rejects — plain runs').eq(undefined);
    const clean: CardIntakeSegment = {...search, sequence: [step(CardName.RESEARCH, true), step(CardName.PHYSICS_COMPLEX, true)]};
    expect(intakeSearchRun({segments: [olympus, clean]}), 'a search that threw nothing away is a plain run').eq(undefined);
    expect(intakeSearchRun({segments: [search, {...search, source: {type: 'card', cardName: CardName.RESEARCH}}]}), 'two searches — the batch-level tape').eq(undefined);
    expect(intakeSearchRun(undefined)).eq(undefined);
  });

  it('origins: the stage card deals off the deck; another card SURFACES; a visible cell deals itself; a covered board degrades to the deck, named', () => {
    expect(intakeOriginOf(research, {stageCard: CardName.RESEARCH, boardVisible: true})).deep.eq({origin: {kind: 'deck'}, degraded: 'on-stage'});
    expect(intakeOriginOf(olympus, {stageCard: CardName.RESEARCH, boardVisible: true})).deep.eq({origin: {kind: 'card', card: CardName.OLYMPUS_CONFERENCE}});
    expect(intakeOriginOf(cell, {boardVisible: true})).deep.eq({origin: {kind: 'board-cell', spaceId: '12'}});
    expect(intakeOriginOf(cell, {boardVisible: false})).deep.eq({origin: {kind: 'deck'}, degraded: 'board-covered'});
    expect(intakeOriginOf({source: {type: 'globalParameter', parameter: GlobalParameter.VENUS}, count: 1}, {boardVisible: true})).deep.eq({origin: {kind: 'deck'}, degraded: 'no-place'});
    expect(intakeOriginOf({count: 1}, {boardVisible: true})).deep.eq({origin: {kind: 'deck'}});
  });

  it('Ф-А · Research + Olympus + Mars University: three runs in the server\'s order, each dealing after the previous has (nearly) landed', () => {
    const plan = planIntakeAssembly({segments: [research, olympus, marsU], stageCard: CardName.RESEARCH, boardVisible: false}, arrival, t);
    expect(plan.runs.map((r) => [r.index, r.origin.kind, r.first, r.count])).deep.eq([
      [0, 'deck', 0, 2], [1, 'card', 2, 1], [2, 'card', 3, 1],
    ]);
    const [r0, r1, r2] = plan.runs;
    expect(r0.dealAtMs).eq(0);
    expect(r0.settledAtMs).eq(planCardArrival(2, arrival, 'in-flight-reveal').totalMs);
    // The trigger surfaces as the previous run is about to land, holds a beat, then deals.
    expect(r1.surfaceAtMs).eq(r0.settledAtMs - t.overlapMs);
    expect(r1.dealAtMs).eq(r1.surfaceAtMs! + t.surfaceMs + t.holdMs);
    expect(r1.dealAtMs, 'one cause deals at a time').to.be.greaterThan(r0.settledAtMs - t.overlapMs);
    expect(r1.recedeAtMs).eq(r1.settledAtMs);
    expect(r2.surfaceAtMs).eq(r1.settledAtMs - t.overlapMs);
    expect(plan.totalMs).eq(r2.recedeAtMs! + t.recedeMs);
    // Every card of the batch is dealt by exactly one run.
    expect(plan.runs.reduce((n, r) => n + r.count, 0)).eq(4);
  });

  it('Ф-Б · a cell then a card: the cell deals first from the board, the trigger surfaces after', () => {
    const plan = planIntakeAssembly({segments: [cell, marsU], boardVisible: true}, arrival, t);
    expect(plan.runs[0].origin).deep.eq({kind: 'board-cell', spaceId: '12'});
    expect(plan.runs[0].surfaceAtMs).is.undefined;
    expect(plan.runs[1].origin).deep.eq({kind: 'card', card: CardName.MARS_UNIVERSITY});
    expect(plan.runs[1].surfaceAtMs).eq(plan.runs[0].settledAtMs - t.overlapMs);
  });

  it('an empty segment is skipped; a batch of one cause plans one run', () => {
    const plan = planIntakeAssembly({segments: [{source: research.source, count: 0}, marsU], boardVisible: false}, arrival, t);
    expect(plan.runs).has.lengthOf(1);
    expect(plan.runs[0].first).eq(0);
  });

  describe('the trigger seat — beside the row, inside the stage, never over a slot', () => {
    const stage = {left: 0, top: 0, width: 2000, height: 1000};
    const row = rowRectOf([{left: 700, top: 400, width: 200, height: 288}, {left: 940, top: 400, width: 200, height: 288}])!;

    it('left of the row when there is room — the row\'s height (a touch smaller), card-shaped', () => {
      const seat = triggerSeatRect(stage, row);
      expect(seat.left + seat.width).to.be.lessThan(row.left);
      expect(seat.height).to.be.closeTo(row.height * 0.92, 0.01);
      expect(seat.width).to.be.closeTo(seat.height / (460 / 320), 0.01);
      expect(seat.top).to.be.closeTo(row.top + (row.height - seat.height) / 2, 0.01);
    });

    it('right of the row when the left has no room; above it when neither side has; the corner as the last resort', () => {
      const tight = rowRectOf([{left: 20, top: 400, width: 200, height: 288}])!;
      const right = triggerSeatRect(stage, tight);
      expect(right.left).to.be.greaterThan(tight.left + tight.width);
      const narrow = {left: 0, top: 0, width: 420, height: 1000};
      const wide = rowRectOf([{left: 10, top: 500, width: 400, height: 288}])!;
      const above = triggerSeatRect(narrow, wide);
      expect(above.top + above.height).to.be.lessThan(wide.top);
      const flat = {left: 0, top: 0, width: 420, height: 400};
      const top = rowRectOf([{left: 10, top: 30, width: 400, height: 288}])!;
      const corner = triggerSeatRect(flat, top);
      expect(corner.left).to.be.lessThan(20);
      expect(corner.height).to.be.at.most(flat.height * 0.3);
    });
  });
});
