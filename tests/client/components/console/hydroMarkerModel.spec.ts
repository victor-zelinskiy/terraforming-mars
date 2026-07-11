import {expect} from 'chai';
import {
  arriveReadyMs, markerTimings, markerTotalMs, reducedMarkerTimings,
} from '@/client/console/hydroMarker/hydroMarkerModel';

describe('hydroMarkerModel', () => {
  it('is a crisp, bounded advance — calmer than the trade fleet', () => {
    const t = markerTimings();
    expect(arriveReadyMs(t)).to.be.within(500, 900); // the client-side leg
    expect(markerTotalMs(t)).to.be.within(900, 1500); // incl. arrive + lock + pulse
    // The arrival leg strictly precedes the lock (pending honesty).
    expect(arriveReadyMs(t)).to.be.lessThan(markerTotalMs(t));
  });

  it('reduced motion is short but still a full path (old → new → locked)', () => {
    const r = reducedMarkerTimings();
    const full = markerTimings();
    expect(markerTotalMs(r)).to.be.lessThan(markerTotalMs(full));
    expect(r.glideMs).to.be.greaterThan(0);
    expect(r.lockMs).to.be.greaterThan(0);
  });
});
