import {expect} from 'chai';
import {AresData} from '@/common/ares/AresData';
import {aresThresholdMarkers, aresDynamicMarkerView, resolveScaleEventState} from '@/client/components/board/aresThresholdMarkers';
import {GlobalParameterThresholdMarker} from '@/client/components/board/oceanThresholdMarkers';

function aresData(over: Partial<{erosion: number, remove: number, temp: number, oxy: number}> = {}): AresData {
  return {
    includeHazards: true,
    hazardData: {
      erosionOceanCount: {threshold: over.erosion ?? 3, available: true},
      removeDustStormsOceanCount: {threshold: over.remove ?? 6, available: true},
      severeErosionTemperature: {threshold: over.temp ?? -4, available: true},
      severeDustStormOxygen: {threshold: over.oxy ?? 5, available: true},
    },
    milestoneResults: [],
  };
}

describe('aresThresholdMarkers', () => {
  it('builds the four planetary-event markers from the live thresholds', () => {
    const markers = aresThresholdMarkers(aresData());
    expect(markers.map((m) => m.parameter)).to.have.members(['oceans', 'oceans', 'temperature', 'oxygen']);
    const byId = new Map(markers.map((m) => [m.id, m]));
    expect(byId.get('ares-erosions')?.value).to.eq(3);
    expect(byId.get('ares-remove-dust-storms')?.value).to.eq(6);
    expect(byId.get('ares-severe-erosions')?.value).to.eq(-4);
    expect(byId.get('ares-severe-dust-storms')?.value).to.eq(5);
  });

  it('tracks extreme-variant / shifted thresholds (Butterfly Effect)', () => {
    const markers = aresThresholdMarkers(aresData({erosion: 2, remove: 7, temp: -6, oxy: 7}));
    const byId = new Map(markers.map((m) => [m.id, m]));
    expect(byId.get('ares-erosions')?.value).to.eq(2);
    expect(byId.get('ares-remove-dust-storms')?.value).to.eq(7);
    expect(byId.get('ares-severe-erosions')?.value).to.eq(-6);
    expect(byId.get('ares-severe-dust-storms')?.value).to.eq(7);
  });

  it('only the dust-storm-removal event pays the triggering player (+1 TR); hazards have no payout', () => {
    const markers = aresThresholdMarkers(aresData());
    const remove = markers.find((m) => m.id === 'ares-remove-dust-storms');
    expect(remove?.reward?.recipient).to.eq('triggering-player');
    expect(remove?.rewardLabel).to.eq('+1 TR');
    expect(markers.filter((m) => m.id !== 'ares-remove-dust-storms').every((m) => m.reward?.recipient === 'none')).to.be.true;
  });

  it('reads the FIRED lifecycle + triggering-player colour straight off the live hazard data', () => {
    const data = aresData();
    data.hazardData.removeDustStormsOceanCount.available = false; // fired
    data.hazardData.removeDustStormsOceanCount.triggeredByColor = 'red';
    data.hazardData.erosionOceanCount.available = false; // a hazard that fired
    const markers = aresThresholdMarkers(data);
    const remove = markers.find((m) => m.id === 'ares-remove-dust-storms')!;
    const erosion = markers.find((m) => m.id === 'ares-erosions')!;
    const severe = markers.find((m) => m.id === 'ares-severe-erosions')!;
    expect(remove.fired).to.be.true;
    expect(remove.claimedByColor).to.eq('red');
    expect(erosion.fired).to.be.true;
    expect(erosion.claimedByColor).to.be.undefined; // hazard recorded none here
    expect(severe.fired).to.be.false; // still available
  });

  it('positions temperature/oxygen markers and reports reached only when the parameter has crossed', () => {
    const markers = aresThresholdMarkers(aresData());
    const temp = markers.find((m) => m.parameter === 'temperature')!;
    const below = aresDynamicMarkerView(temp, -8); // below -4
    const at = aresDynamicMarkerView(temp, -4); // at threshold
    expect(below.reached).to.be.false;
    expect(at.reached).to.be.true;
    // Geometry resolves to finite coordinates (no NaN from a missing digit).
    expect(Number.isFinite(at.top)).to.be.true;
    expect(Number.isFinite(at.left)).to.be.true;
    expect(at.size).to.be.greaterThan(0);
  });
});

describe('resolveScaleEventState', () => {
  const players = [{color: 'red', name: 'Ann'}, {color: 'blue', name: 'Bob'}];

  function marker(over: Partial<GlobalParameterThresholdMarker> = {}): GlobalParameterThresholdMarker {
    return {
      id: 'ares-remove-dust-storms',
      parameter: 'oceans',
      value: 6,
      kind: 'planetary-event',
      icon: 'bonus-zone-icon--tr',
      title: 'Planetary event',
      reward: {recipient: 'triggering-player', deltas: [{resource: 'tr', amount: 1}]},
      enabled: true,
      visible: true,
      ...over,
    };
  }
  const hazard = (over: Partial<GlobalParameterThresholdMarker> = {}) =>
    marker({id: 'ares-erosions', kind: 'hazard-event', reward: {recipient: 'none', deltas: []}, ...over});

  it('UPCOMING — not fired → available, no colour', () => {
    const s = resolveScaleEventState(marker({fired: false}), false, players);
    expect(s.lifecycle).to.eq('upcoming');
    expect(s.chipState).to.eq('available');
    expect(s.claimColor).to.eq('');
    expect(s.claimKey).to.eq('');
  });

  it('RESOLVED — a fired hazard event (no reward) is neutral, never player-coloured', () => {
    const s = resolveScaleEventState(hazard({fired: true, claimedByColor: 'red'}), true, players);
    expect(s.lifecycle).to.eq('resolved');
    expect(s.chipState).to.eq('resolved');
    expect(s.claimColor).to.eq(''); // a no-reward event stays neutral even with a recorded colour
  });

  it('CLAIMED — a fired reward event is painted in the triggering player colour + names them', () => {
    const s = resolveScaleEventState(marker({fired: true, claimedByColor: 'red'}), true, players);
    expect(s.lifecycle).to.eq('claimed');
    expect(s.chipState).to.eq('claimed');
    expect(s.claimColor).to.match(/^rgb/); // a real hex/rgb colour, not ''
    expect(s.claimKey).to.eq('ares-remove-dust-storms');
    expect(s.claimedByName).to.eq('Ann');
  });

  it('falls back to `reached` when the live `fired` flag is absent (dev markers)', () => {
    expect(resolveScaleEventState(hazard({}), true, players).lifecycle).to.eq('resolved');
    expect(resolveScaleEventState(hazard({}), false, players).lifecycle).to.eq('upcoming');
  });

  it('a reward event fired without a recorded colour (old save) degrades to neutral resolved', () => {
    const s = resolveScaleEventState(marker({fired: true}), true, players);
    expect(s.lifecycle).to.eq('resolved');
    expect(s.claimColor).to.eq('');
  });
});
