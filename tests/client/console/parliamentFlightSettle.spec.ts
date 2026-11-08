import {expect} from 'chai';
import {nextTick} from 'vue';
import {dropFlight, flyDelegate, flySeatDelegate, killParliamentFlights, parliamentFlights} from '@/client/console/parliament/parliamentFlights';
import {runDelegateFlight} from '@/client/console/parliament/consoleParliamentVoteMotion';

/*
 * EVERY WAY A FLIGHT ENDS SETTLES ITS WAITER — EXACTLY ONCE (`parliamentFlights.ts` § flightWaiters). A director waiting
 * on a touchdown wedged when the flight it waited on was dropped, killed, or lost its proxy before the launch: the hold's
 * ceiling then dropped only the COUNT. The one exception is a SILENT teardown, asked for by name.
 */
const FROM = {left: 10, top: 10, width: 20, height: 24};
const TO = {left: 200, top: 120, width: 20, height: 24};

function counter() {
  const c = {lifted: 0, landed: 0};
  return {
    c,
    onLanded: () => {
      c.landed++;
    },
    onLifted: () => {
      c.lifted++;
    },
  };
}

describe('parliament flights — every ending settles the waiter once', () => {
  afterEach(() => {
    killParliamentFlights();
  });

  it('a proxy that never renders: the figure is simply there — lift and touchdown heard once', async () => {
    const w = counter();
    const id = flyDelegate('red', FROM, TO, 0, w.onLanded, {onLifted: w.onLifted});
    expect(id).to.be.a('string');
    await nextTick();
    await nextTick();
    expect(w.c).deep.eq({lifted: 1, landed: 1});
    dropFlight(id!);
    expect(w.c).deep.eq({lifted: 1, landed: 1});
  });

  it('a drop before the launch settles the waiter at once — and never a second time', async () => {
    const w = counter();
    const id = flyDelegate('red', FROM, TO, 0, w.onLanded, {onLifted: w.onLifted});
    dropFlight(id!);
    expect(w.c).deep.eq({lifted: 1, landed: 1});
    expect(parliamentFlights.flights.some((f) => f.id === id)).eq(false);
    await nextTick();
    await nextTick();
    expect(w.c).deep.eq({lifted: 1, landed: 1});
  });

  it('a SILENT drop and the scene teardown forget the waiter unfired', async () => {
    const a = counter();
    const b = counter();
    const ida = flyDelegate('red', FROM, TO, 0, a.onLanded, {onLifted: a.onLifted});
    flyDelegate('blue', FROM, TO, 0, b.onLanded, {onLifted: b.onLifted});
    dropFlight(ida!, {silent: true});
    killParliamentFlights();
    await nextTick();
    await nextTick();
    expect(a.c).deep.eq({lifted: 0, landed: 0});
    expect(b.c).deep.eq({lifted: 0, landed: 0});
  });

  it('the seat delegate with nothing measurable lands once (never the unmeasurable path twice)', () => {
    const w = counter();
    flySeatDelegate(document.createElement('div'), 'red', FROM, w.onLanded);
    expect(w.c.landed).eq(1);
  });

  it('a running handle killed mid-flight settles lift → leave → touchdown once; a silent kill settles nothing', () => {
    const seen: Array<string> = [];
    const proxy = document.createElement('div');
    const handle = runDelegateFlight({
      proxy, from: FROM, to: TO,
      onLifted: () => seen.push('lifted'), onDeparted: () => seen.push('departed'), onLanded: () => seen.push('landed'),
    });
    handle.kill();
    handle.kill();
    expect(seen).deep.eq(['lifted', 'departed', 'landed']);

    const quiet: Array<string> = [];
    const silent = runDelegateFlight({proxy: document.createElement('div'), from: FROM, to: TO, onLanded: () => quiet.push('landed')});
    silent.kill({silent: true});
    silent.kill();
    expect(quiet).deep.eq([]);
  });
});
