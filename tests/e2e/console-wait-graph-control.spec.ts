import {test, expect} from './consoleTest';
import {bootFixtureSeats, cinematicBeat} from './consoleStart';

/**
 * THE WAIT GRAPH's POSITIVE CONTROL (docs/claude/console/wait-graph.md, phase Э2 — a shadow).
 *
 * A run where the graph reported nothing proves something only beside a run where it DID: the shell's control seam
 * (`?waitGraphControl=1` — never in a game) puts the chairman quest's field shape in on purpose — a conclusion waiting
 * for a question, the question for its plate, the plate for the conclusion — and this stand reads, in the live page,
 * that the shadow saw the cycle, confirmed it on its third tick, logged it ONCE with the member that yields first, and
 * counted it in `__conWaitGraph()`.
 */
test('the wait graph sees, confirms and logs a planted mutual wait — once, with the member that yields — and BREAKS it through the door of that member', async ({page, request}) => {
  const lines: Array<string> = [];
  const cures: Array<string> = [];
  page.on('console', (message) => {
    if (message.text().includes('[wait-graph] cycle')) {
      lines.push(message.text());
    }
    if (message.text().includes('[wait-graph] cure')) {
      cures.push(message.text());
    }
  });
  await bootFixtureSeats(page, request, 'parliament', {query: '&waitGraphControl=1', landing: 'board'});
  await expect.poll(() => lines.length, {timeout: 20_000, message: 'the planted cycle is confirmed and logged'}).toBeGreaterThan(0);
  await cinematicBeat(page, 4_000, 'a standing cycle is logged once, never once a tick — four more ticks pass');
  expect(lines, 'logged ONCE while it stands').toHaveLength(1);
  expect(lines[0]).toContain('control:conclusion');
  expect(lines[0]).toContain('yields: control:plate');
  // Э3: the confirming tick broke it — through the plate's own door, named once; the planted waits are gone after.
  expect(cures, 'the cycle broken through its yielding member').toHaveLength(1);
  expect(cures[0]).toContain('cure cycle at control:plate through «control-door» — the planted plate yielded');
  const graph = await page.evaluate(() => (window as unknown as {__conWaitGraph: () => {stats: {confirmed: {cycle: number}, ticks: number}, nodes: Array<{id: string}>, cures: Array<{member: string}>}}).__conWaitGraph());
  expect(graph.stats.confirmed.cycle).toBe(1);
  expect(graph.stats.ticks).toBeGreaterThan(3);
  expect(graph.cures.map((c) => c.member)).toEqual(['control:plate']);
  expect(graph.nodes.map((n) => n.id).filter((id) => id.startsWith('control:')), 'nothing planted stands after the cure').toEqual([]);
});
