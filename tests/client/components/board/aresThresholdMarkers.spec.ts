import {expect} from 'chai';
import {AresData} from '@/common/ares/AresData';
import {aresThresholdMarkers, aresDynamicMarkerView} from '@/client/components/board/aresThresholdMarkers';

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
