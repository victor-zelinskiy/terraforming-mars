import {expect} from 'chai';
import {SCALE_BONUS_ZONES, scaleBonusZoneViews, resolveScaleBonusClaim, scaleBonusRewardKey} from '@/client/components/board/scaleBonusZones';

const CENTER = {x: 300, y: 301};
const radius = (z: {top: number; left: number; size: number}) =>
  Math.hypot(z.left + z.size / 2 - CENTER.x, z.top + z.size / 2 - CENTER.y);

describe('scaleBonusZones', () => {
  it('models every gameplay scale bonus by track', () => {
    const venus = SCALE_BONUS_ZONES.filter((z) => z.scale === 'venus');
    const oxygen = SCALE_BONUS_ZONES.filter((z) => z.scale === 'oxygen');
    const temperature = SCALE_BONUS_ZONES.filter((z) => z.scale === 'temperature');
    expect(venus).to.have.length(9); // card@8, TR@16 + 6 resources + 1 final
    expect(oxygen.map((z) => z.step)).to.deep.eq([8]);
    expect(temperature.map((z) => z.step)).to.deep.eq([-24, -20, 0]);
  });

  it('has exactly ONE final gold-cube Venus bonus anchored to 30%', () => {
    const final = SCALE_BONUS_ZONES.filter((z) => z.tier === 'final');
    expect(final).to.have.length(1);
    expect(final[0].step).to.eq(30);
    expect(final[0].icon).to.eq('bonus-zone-icon--gold-cube');
    // No leftover regular resource node at 30 — the gold cube IS step 30.
    expect(SCALE_BONUS_ZONES.filter((z) => z.scale === 'venus' && z.step === 30 && z.tier === 'regular')).to.have.length(0);
  });

  it('sizes oxygen/temperature/ocean larger; the Venus system stays small', () => {
    const byKey = (k: string) => SCALE_BONUS_ZONES.find((z) => z.key === k)!;
    for (const k of ['o-temp-8', 't-heat-24', 't-heat-20', 't-ocean-0']) {
      expect(byKey(k).size, k).to.eq(25);
    }
    for (const k of ['v-card-8', 'v-tr-16', 'v18', 'v30-final']) {
      expect(byKey(k).size, k).to.eq(18);
    }
  });

  // GEOMETRY: anchored to the division, not eyeballed. Venus markers sit INSIDE
  // the number band (radius < 268); oxygen/temperature OUTSIDE — and every node
  // carries a pointer angle + outward distance.
  it('anchors each marker on the right side of its band with a pointer', () => {
    for (const z of SCALE_BONUS_ZONES) {
      expect(z.point, `${z.key} point`).to.be.a('number');
      expect(z.pointerDist, `${z.key} pointerDist`).to.be.greaterThan(0);
      const r = radius(z);
      if (z.scale === 'venus') {
        expect(r, `${z.key} radius`).to.be.lessThan(260); // inner band
      } else {
        expect(r, `${z.key} radius`).to.be.greaterThan(290); // outer band
      }
    }
  });

  it('gives every zone a reward description for the premium hover', () => {
    for (const z of SCALE_BONUS_ZONES) {
      expect(z.reward, z.key).to.be.a('string').and.not.eq('');
    }
    expect(scaleBonusRewardKey('venus-8')).to.eq('Draw a card');
    expect(scaleBonusRewardKey('temperature-0')).to.eq('Place an ocean');
  });

  it('gates zones by active expansions', () => {
    expect(scaleBonusZoneViews({venus: false, altVenus: false})).to.have.length(4); // oxygen + 3 temp
    expect(scaleBonusZoneViews({venus: true, altVenus: false})).to.have.length(6); // + card/TR
    expect(scaleBonusZoneViews({venus: true, altVenus: true})).to.have.length(13);
  });

  it('resolves claims: available / player / government', () => {
    const players = [{color: 'red', name: 'Alice'}, {color: 'blue', name: 'Bob'}];
    expect(resolveScaleBonusClaim({}, 'venus', 8, players).state).to.eq('available');
    const claimed = resolveScaleBonusClaim({'venus-8': 'red'}, 'venus', 8, players);
    expect(claimed.state).to.eq('claimed');
    expect(claimed.claimedBy).to.eq('Alice');
    expect(claimed.claimColor).to.not.eq('');
    const gov = resolveScaleBonusClaim({'temperature-0': 'neutral'}, 'temperature', 0, players);
    expect(gov.state).to.eq('government');
    expect(gov.claimedBy).to.eq('');
  });
});
