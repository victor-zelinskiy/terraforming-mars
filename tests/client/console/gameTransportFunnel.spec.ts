import {expect} from 'chai';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';
import {dumpFlowTree, waitTable} from '@/client/console/kernel/flowScope';
import {
  __resetGameTransportForTesting, __setTransportPresenterForTesting, GATE_MAX_MS, onSubmitSettled, releaseTransportFunnel,
  startGameTransport, stopGameTransport, submitBatch, submitInput, SubmitSettle, transportHolds, transportRequestInProgress,
  TransportRoot, transportState,
} from '@/client/console/transport/gameTransport';
import {SUBMIT_NO_RESPONSE_MS, SUBMIT_PRESENT_MAX_MS} from '@/client/console/transport/submitMachine';
import {ViewModel} from '@/common/models/PlayerModel';

type FakeResponse = {ok: boolean, status: number, statusText?: string, json: () => Promise<unknown>};

async function flush(): Promise<void> {
  for (let i = 0; i < 12; i++) {
    await Promise.resolve();
  }
}

/**
 * THE SUBMIT FUNNEL (architecture v2, lifecycle 4) — one submit is one scope with its machine. The properties below are
 * the field classes of the funnel, stated as what can no longer happen:
 *   · a press the funnel cannot take is a typed refusal in the caller's hand, never a dropped line (inventory R11);
 *   · every submit settles exactly once, whichever way it went — and the funnel reopens with it;
 *   · a gate that never ends, throws, or outlives its bound does not hold the submit — the commit goes on;
 *   · a presentation that hangs outside any gate is abandoned, and can no longer apply a stale view.
 */
describe('the submit funnel', () => {
  let clock: ManualFlowClock;
  let root: TransportRoot & {updates: number, alerts: Array<string>};
  let fetches: Array<{url: string, signal: AbortSignal | undefined, resolve: (response: FakeResponse) => void, reject: (error: unknown) => void}>;
  let realFetch: typeof fetch;
  let warn: typeof console.warn;
  let error: typeof console.error;
  let warned: Array<string>;
  let settles: Array<SubmitSettle>;

  beforeEach(() => {
    __resetGameTransportForTesting();
    clock = createManualClock(0);
    setFlowClock(clock);
    warned = [];
    warn = console.warn;
    error = console.error;
    console.warn = (...args: Array<unknown>) => {
      warned.push(String(args[0]));
    };
    console.error = () => {};
    fetches = [];
    realFetch = globalThis.fetch;
    globalThis.fetch = ((url: string, init?: {signal?: AbortSignal}) => new Promise<FakeResponse>((resolve, reject) => {
      fetches.push({url, signal: init?.signal, resolve, reject});
    })) as unknown as typeof fetch;
    root = {
      // No `game` on the view: the poll chain has nothing to compare against and stays down — the funnel alone runs.
      playerView: {id: 'p-viewer', runId: 'run-1', waitingFor: undefined} as unknown as ViewModel,
      playerkey: 0,
      playersWaitingFor: [],
      isServerSideRequestInProgress: false,
      updates: 0,
      alerts: [],
      updatePlayer() {
        this.updates++;
      },
      showAlert(title: string) {
        this.alerts.push(title);
      },
    };
    startGameTransport(root);
    settles = [];
    onSubmitSettled((settle) => settles.push(settle));
    // The gate pipeline needs a whole game on screen; the funnel around it does not.
    __setTransportPresenterForTesting(async () => 'applied');
  });

  afterEach(() => {
    __resetGameTransportForTesting();
    setFlowClock(undefined);
    globalThis.fetch = realFetch;
    console.warn = warn;
    console.error = error;
  });

  const ok = (view: unknown = {id: 'p-viewer'}): FakeResponse => ({ok: true, status: 200, json: () => Promise.resolve(view)});

  it('a press gets a TICKET, and the funnel is busy exactly while its submit lives', async () => {
    expect(transportRequestInProgress()).to.eq(false);
    const ticket = submitInput({type: 'option'});
    expect(ticket.accepted).to.eq(true);
    expect(ticket.id).to.match(/^submit#\d+$/);
    expect(transportRequestInProgress()).to.eq(true);
    expect(root.isServerSideRequestInProgress).to.eq(true);
    expect(transportState.phase).to.eq('sending');
    expect(fetches.length).to.eq(1);
    expect(dumpFlowTree().some((line) => line.includes(ticket.id) && line.includes('sending'))).to.eq(true);

    fetches[0].resolve(ok());
    const settle = await ticket.settled;
    expect(settle).to.deep.eq({id: ticket.id, status: 'applied'});
    expect(transportRequestInProgress()).to.eq(false);
    expect(root.isServerSideRequestInProgress).to.eq(false);
    expect(transportState.phase).to.eq('idle');
    expect(settles).to.deep.eq([settle]);
    expect(dumpFlowTree().some((line) => line.includes('submit#')), 'the submit\'s scope is gone').to.eq(false);
    // What still stands on the clock is the SESSION's and the TRANSPORT's own (the presentation ledger's heartbeat over
    // the transport's truth witness, the poll's next look — owned ticks of the kernel since the coverage round), never
    // a bound of the submit.
    expect(waitTable().filter((row) => /^(submit|gate)[:#]/.test(row.owner) || row.ownerKind === 'submit' || row.ownerKind === 'gate').map((row) => row.what),
      'no bound outlives the submit').to.deep.eq([]);
  });

  it('a press the funnel cannot take is REFUSED IN THE CALLER\'S HAND — never dropped (inventory R11)', async () => {
    const first = submitInput({type: 'option'});
    const second = submitBatch([{type: 'option'}]);
    expect(second.accepted).to.eq(false);
    expect(second.reason).to.eq('busy');
    expect(await second.settled).to.deep.eq({id: '', status: 'rejected'});
    expect(fetches.length, 'nothing was sent for it').to.eq(1);
    expect(transportState.refusedWhileBusy).to.eq(1);
    expect(warned.filter((line) => line.startsWith('[transport] submit refused')).length).to.eq(1);
    // …and the refusal settles nothing on the broadcast: the standing submit is somebody else's.
    expect(settles).to.deep.eq([]);
    fetches[0].resolve(ok());
    await first.settled;
    expect(submitInput({type: 'option'}).accepted, 'the funnel reopened').to.eq(true);
  });

  it('the answer is handed to the presentation, then the submit is applied', async () => {
    const seen: Array<unknown> = [];
    __setTransportPresenterForTesting(async (view) => {
      seen.push(view);
      expect(transportState.phase).to.eq('presenting');
      expect(transportState.responseArrived).to.eq(true);
      return 'applied';
    });
    const ticket = submitInput({type: 'option'});
    fetches[0].resolve(ok({id: 'p-viewer', marker: 7}));
    expect((await ticket.settled).status).to.eq('applied');
    expect(seen).to.deep.eq([{id: 'p-viewer', marker: 7}]);
  });

  it('the staged MarsBot pipeline takes the commit: the submit settles `staged`', async () => {
    __setTransportPresenterForTesting(async () => 'staged');
    const ticket = submitInput({type: 'option'});
    fetches[0].resolve(ok());
    expect((await ticket.settled).status).to.eq('staged');
  });

  it('a server refusal: said, settled `refused`, the funnel reopens', async () => {
    const ticket = submitInput({type: 'option'});
    fetches[0].resolve({ok: false, status: 400, json: () => Promise.resolve({id: 'x', message: 'Not your turn'})});
    expect((await ticket.settled).status).to.eq('refused');
    expect(root.alerts).to.deep.eq(['Error with input']);
    expect(transportRequestInProgress()).to.eq(false);
  });

  it('a network failure: said, settled `failed`, the funnel reopens', async () => {
    const ticket = submitInput({type: 'option'});
    fetches[0].reject(new Error('offline'));
    expect((await ticket.settled).status).to.eq('failed');
    expect(root.alerts).to.deep.eq(['Error sending input,']);
    expect(transportRequestInProgress()).to.eq(false);
  });

  it('THE SERVER\'S SILENCE: the request is cancelled at the bound of `sending`, said in so many words, the state re-fetched', async () => {
    const ticket = submitInput({type: 'option'});
    clock.advance(SUBMIT_NO_RESPONSE_MS - 1);
    expect(fetches[0].signal?.aborted).to.eq(false);
    clock.advance(1);
    expect(fetches[0].signal?.aborted, 'the request is cancelled').to.eq(true);
    fetches[0].reject(new Error('aborted'));
    expect((await ticket.settled).status).to.eq('silent');
    expect(root.alerts).to.deep.eq(['The server is not responding']);
    expect(root.updates).to.eq(1);
    expect(warned.some((line) => line.includes('the server did not answer the submit'))).to.eq(true);
  });

  it('a server that ANSWERED is never cut by its silence bound', async () => {
    let finish: (v: 'applied') => void = () => {};
    __setTransportPresenterForTesting(() => new Promise((resolve) => {
      finish = resolve;
    }));
    const ticket = submitInput({type: 'option'});
    fetches[0].resolve(ok());
    await flush();
    clock.advance(SUBMIT_NO_RESPONSE_MS + 10_000);
    expect(fetches[0].signal?.aborted).to.eq(false);
    expect(transportState.phase).to.eq('presenting');
    finish('applied');
    expect((await ticket.settled).status).to.eq('applied');
  });

  describe('a gate is a bounded child of its submit', () => {
    it('raises its hold for exactly its own life', async () => {
      let land: () => void = () => {};
      __setTransportPresenterForTesting(async (_view, gate) => {
        expect(await gate('playedHero', () => new Promise<void>((resolve) => {
          land = resolve;
        }))).to.eq(true);
        return 'applied';
      });
      const ticket = submitInput({type: 'option'});
      fetches[0].resolve(ok());
      await flush();
      expect(transportHolds.playedHero).to.eq(true);
      expect(dumpFlowTree().some((line) => line.includes('gate:playedHero#'))).to.eq(true);
      land();
      expect((await ticket.settled).status).to.eq('applied');
      expect(transportHolds.playedHero).to.eq(false);
    });

    it('a scene that NEVER ENDS: the supervisor\'s release ends the gate and THE COMMIT GOES ON', async () => {
      let applied = false;
      __setTransportPresenterForTesting(async (_view, gate) => {
        const alive = await gate('tradeFleet', () => new Promise<void>(() => {}));
        expect(alive, 'the submit itself still lives').to.eq(true);
        applied = true;
        return 'applied';
      });
      const ticket = submitInput({type: 'option'});
      // A request still on the wire is never cut by the supervisor.
      expect(releaseTransportFunnel()).to.contain('left to the network');
      fetches[0].resolve(ok());
      await flush();
      expect(transportHolds.tradeFleet).to.eq(true);
      expect(releaseTransportFunnel()).to.contain('its gate «tradeFleet» never let go');
      expect((await ticket.settled).status, 'applied by the chain that owns the answer — never a stale re-fetch').to.eq('applied');
      expect(applied).to.eq(true);
      expect(transportHolds.tradeFleet).to.eq(false);
      expect(root.updates, 'no re-fetch was needed').to.eq(0);
      expect(warned.some((line) => line.includes('gate «tradeFleet»') && line.includes('released by the supervisor'))).to.eq(true);
    });

    it('a scene past its own bound is ended by it — the commit goes on', async () => {
      __setTransportPresenterForTesting(async (_view, gate) => {
        await gate('hydroMarker', () => new Promise<void>(() => {}));
        return 'applied';
      });
      const ticket = submitInput({type: 'option'});
      fetches[0].resolve(ok());
      await flush();
      clock.advance(GATE_MAX_MS - 1);
      await flush();
      expect(transportRequestInProgress()).to.eq(true);
      clock.advance(1);
      expect((await ticket.settled).status).to.eq('applied');
      expect(warned.some((line) => line.includes('gate «hydroMarker»') && line.includes('outlived its bound'))).to.eq(true);
    });

    it('a scene that THROWS is contained: said once, the commit goes on (it used to be a «network error» with the view never applied)', async () => {
      __setTransportPresenterForTesting(async (_view, gate) => {
        expect(await gate('patentSale', async () => {
          throw new Error('the terminal tripped');
        })).to.eq(true);
        return 'applied';
      });
      const ticket = submitInput({type: 'option'});
      fetches[0].resolve(ok());
      expect((await ticket.settled).status).to.eq('applied');
      expect(transportHolds.patentSale).to.eq(false);
      expect(root.alerts).to.deep.eq([]);
      expect(warned.filter((line) => line.includes('the task threw')).length).to.eq(1);
    });

    it('`keep` leaves the hold up for the commit to lower (the gates whose flag stands until the view is applied)', async () => {
      __setTransportPresenterForTesting(async (_view, gate) => {
        await gate('conversion', async () => {}, {keep: true});
        expect(transportHolds.conversion).to.eq(true);
        transportHolds.conversion = false;
        return 'applied';
      });
      const ticket = submitInput({type: 'option'});
      fetches[0].resolve(ok());
      expect((await ticket.settled).status).to.eq('applied');
    });
  });

  it('a presentation hung OUTSIDE any gate is abandoned: the funnel reopens, the truth is re-fetched, the late chain applies nothing', async () => {
    let wake: (v: 'applied') => void = () => {};
    __setTransportPresenterForTesting(() => new Promise((resolve) => {
      wake = resolve;
    }));
    const ticket = submitInput({type: 'option'});
    fetches[0].resolve(ok());
    await flush();
    expect(releaseTransportFunnel()).to.contain('its presentation never ended');
    const settle = await ticket.settled;
    expect(settle.status).to.eq('abandoned');
    expect(root.updates).to.eq(1);
    expect(transportRequestInProgress()).to.eq(false);
    // The hung chain wakes at last: nothing changes, nothing settles twice.
    wake('applied');
    await flush();
    expect(settles).to.deep.eq([settle]);
    expect(submitInput({type: 'option'}).accepted).to.eq(true);
  });

  it('…and so is one nobody releases — at the presentation\'s own bound', async () => {
    __setTransportPresenterForTesting(() => new Promise(() => {}));
    const ticket = submitInput({type: 'option'});
    fetches[0].resolve(ok());
    await flush();
    clock.advance(SUBMIT_PRESENT_MAX_MS);
    expect((await ticket.settled).status).to.eq('abandoned');
    expect(Object.values(transportHolds).some((held) => held)).to.eq(false);
  });

  it('a gate reports `false` once its submit is over — the pipeline stops, nothing of the answer is applied', async () => {
    let gateResult: boolean | undefined;
    __setTransportPresenterForTesting(async (_view, gate) => {
      gateResult = await gate('colonyBuild', () => new Promise<void>(() => {}));
      return gateResult ? 'applied' : 'over';
    });
    const ticket = submitInput({type: 'option'});
    fetches[0].resolve(ok());
    await flush();
    stopGameTransport();
    expect((await ticket.settled).status).to.eq('abandoned');
    await flush();
    expect(gateResult).to.eq(false);
    expect(transportHolds.colonyBuild).to.eq(false);
  });

  it('the transport stopping ends a standing submit with it (the game screen left)', async () => {
    const ticket = submitInput({type: 'option'});
    stopGameTransport();
    expect((await ticket.settled).status).to.eq('abandoned');
    expect(transportRequestInProgress()).to.eq(false);
    expect(dumpFlowTree().some((line) => /submit#|transport#/.test(line)), 'the transport\'s scope and its submit are gone').to.eq(false);
    expect(clock.pending()).to.eq(0);
  });

  it('the batch carries the prompt it was composed for', () => {
    submitBatch([{type: 'option'}], 41);
    expect(fetches[0].url).to.contain('id=p-viewer');
  });

  it('every submit settles exactly once across a run of answers, refusals and failures', async () => {
    const outcomes: Array<string> = [];
    for (const step of ['ok', 'refuse', 'ok', 'fail', 'ok']) {
      const ticket = submitInput({type: 'option'});
      const request = fetches[fetches.length - 1];
      if (step === 'ok') {
        request.resolve(ok());
      } else if (step === 'refuse') {
        request.resolve({ok: false, status: 500, statusText: 'boom', json: () => Promise.resolve({})});
      } else {
        request.reject(new Error('offline'));
      }
      outcomes.push((await ticket.settled).status);
    }
    expect(outcomes).to.deep.eq(['applied', 'refused', 'applied', 'failed', 'applied']);
    expect(settles.map((s) => s.status)).to.deep.eq(outcomes);
    expect(new Set(settles.map((s) => s.id)).size, 'five submits, five identities').to.eq(5);
  });
});
