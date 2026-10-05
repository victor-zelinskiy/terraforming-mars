import {expect} from 'chai';
import {ColonyName} from '../../src/common/colonies/ColonyName';
import {CardName} from '../../src/common/cards/CardName';
import {SpaceName} from '../../src/common/boards/SpaceName';
import {TileType} from '../../src/common/TileType';
import {ColonyModel, simpleColonyModel} from '../../src/common/models/ColonyModel';
import {ColonyTileSite} from '../../src/common/colonies/ColonyTileSite';
import {
  CITY_CONTACT_AT, CITY_PRESS_MS, CITY_REDUCED_MS, CITY_TILT_OUT_AT, COLONY_CITY_NOTE, ColonyCityArm, OWN_CITY_PROFILE,
  WATCHER_CITY_PROFILE, armedLandingOf, cityDescentAt, colonyCityBeats, colonyCityLandings, colonyCityReading,
  colonyCityTimeline, landingMatchesArm, landingSignature,
} from '../../src/client/console/colonyCity/colonyCityModel';
import {colonyPickIntent} from '../../src/client/console/consoleColoniesModel';
import {TILE_START_TILT_DEG} from '../../src/client/console/tilePlacement/tilePlacementModel';

const {LUNA, CERES, TITAN} = ColonyName;
const NOVA = SpaceName.NOVA_CITY;

function table(...withCity: Array<[ColonyName, 'blue' | 'red']>): Array<ColonyModel> {
  return [CERES, LUNA, TITAN].map((name) => {
    const model = simpleColonyModel(name);
    const city = withCity.find(([colony]) => colony === name);
    if (city !== undefined) {
      model.tiles = [{spaceId: NOVA, tileType: TileType.CITY, color: city[1], card: CardName.NOVA_CITY}];
    }
    return model;
  });
}

const ARM: ColonyCityArm = {colony: LUNA, space: NOVA, color: 'blue', card: CardName.NOVA_CITY};

/**
 * A CITY LANDS ON A COLONY TILE — the pure half (Turmoil Redux TR22 Nova City):
 * which landing the answer carried, the beats and their timings, the descent's
 * one progress, the stage's reading of the server's `tileSite` marker.
 */
describe('colonyCityModel', () => {
  describe('the act of the pick — the marker decides', () => {
    it('a pick carrying `tileSite` is `city`; the track and the roster outrank it; a build stays a build', () => {
      const site = {tile: TileType.CITY};
      expect(colonyPickIntent({tileSite: site})).eq('city');
      expect(colonyPickIntent({tileSite: site, buildSites: []}), 'the city outranks a build marker').eq('city');
      expect(colonyPickIntent({trackMoves: [], tileSite: site})).eq('track');
      expect(colonyPickIntent({roster: {}, tileSite: site})).eq('roster');
      expect(colonyPickIntent({buildSites: []})).eq('build');
      expect(colonyPickIntent({})).eq('pick');
    });
  });

  describe('the pair of views', () => {
    it('a tile that lies on a colony tile NOW and did not before is a landing', () => {
      expect(colonyCityLandings(table(), table([LUNA, 'blue']))).deep.eq([
        {colony: LUNA, tile: {spaceId: NOVA, tileType: TileType.CITY, color: 'blue', card: CardName.NOVA_CITY}},
      ]);
    });

    it('a tile that merely stayed is no landing; nothing landed between equal tables; a first view lands nothing', () => {
      expect(colonyCityLandings(table([LUNA, 'blue']), table([LUNA, 'blue']))).deep.eq([]);
      expect(colonyCityLandings(table(), table())).deep.eq([]);
      expect(colonyCityLandings(undefined, undefined)).deep.eq([]);
      expect(colonyCityLandings(table(), undefined)).deep.eq([]);
    });

    it('the ARMED landing: exactly the declared tile of the viewer\'s colour on the declared colony tile', () => {
      const landing = armedLandingOf(table(), table([LUNA, 'blue']), ARM);
      expect(landing?.colony).eq(LUNA);
      expect(landingMatchesArm(landing!, ARM)).is.true;
    });

    it('another colony tile, another colour, another cell or another card is NOT the armed landing — the arm is dropped', () => {
      expect(armedLandingOf(table(), table([CERES, 'blue']), ARM), 'another tile').is.undefined;
      expect(armedLandingOf(table(), table([LUNA, 'red']), ARM), 'another seat\'s city').is.undefined;
      expect(armedLandingOf(table(), table(), ARM), 'a parked tail / a re-ask: nothing landed').is.undefined;
      const landing = {colony: LUNA, tile: {spaceId: NOVA, tileType: TileType.CITY, color: 'blue' as const, card: CardName.NOVA_CITY}};
      expect(landingMatchesArm(landing, {...ARM, space: SpaceName.GANYMEDE_COLONY})).is.false;
      expect(landingMatchesArm(landing, {...ARM, card: CardName.ANTS})).is.false;
      expect(landingMatchesArm(landing, {colony: LUNA, space: NOVA, color: 'blue'}), 'an arm that names no card').is.true;
    });

    it('the signature tells one landing from another (the watcher\'s seed never replays the player\'s own)', () => {
      const [own] = colonyCityLandings(table(), table([LUNA, 'blue']));
      const [rival] = colonyCityLandings(table(), table([LUNA, 'red']));
      const [other] = colonyCityLandings(table(), table([CERES, 'blue']));
      expect(landingSignature(own)).eq(`${LUNA}|${NOVA}|blue`);
      expect(new Set([landingSignature(own), landingSignature(rival), landingSignature(other)]).size).eq(3);
    });
  });

  describe('the beats and their timings (base ms — the storyboard\'s table)', () => {
    it('the player\'s OWN landing: materialize 0–340 · weight 340–460 · landing 460–840 · contact at 80 % · cube 840–1180 · read 680', () => {
      expect(colonyCityTimeline(OWN_CITY_PROFILE)).deep.eq({
        materializeAt: 0,
        weightAt: 340,
        landAt: 460,
        contactAt: 764,
        cubeAt: 840,
        cubeLandAt: 1180,
        readAt: 1180,
        totalMs: 1860,
      });
      expect(OWN_CITY_PROFILE).deep.include({liftHexes: 0.9, startScale: 1.22, edgeMs: 140, artFromMs: 100});
      expect(CITY_CONTACT_AT).eq(0.8);
      expect(CITY_TILT_OUT_AT).eq(0.6);
      expect(CITY_PRESS_MS).eq(120);
      expect(CITY_REDUCED_MS).eq(120);
    });

    it('a WATCHER\'s landing: the same phrase at the tile\'s scale — 1.12, no weight pause, ~260 + 320 + 240, no read', () => {
      expect(WATCHER_CITY_PROFILE).deep.include({startScale: 1.12, weightMs: 0, materializeMs: 260, landMs: 320, readMs: 0});
      expect(WATCHER_CITY_PROFILE.cubeApproachMs + WATCHER_CITY_PROFILE.cubeDropMs).eq(240);
      const t = colonyCityTimeline(WATCHER_CITY_PROFILE);
      expect(t.landAt, 'the landing follows the materialization at once').eq(260);
      expect(t.totalMs).eq(820);
    });

    it('the beats in order — the watcher skips the weight and the read; reduced motion plays none', () => {
      expect(colonyCityBeats(OWN_CITY_PROFILE)).deep.eq(['handover', 'materialize', 'weight', 'land', 'cube', 'read']);
      expect(colonyCityBeats(WATCHER_CITY_PROFILE)).deep.eq(['handover', 'materialize', 'land', 'cube']);
      expect(colonyCityBeats(OWN_CITY_PROFILE, {reduced: true})).deep.eq([]);
    });

    it('the tile always lands BEFORE its cube, and the count flips on the cube\'s touchdown — never before the contact', () => {
      for (const profile of [OWN_CITY_PROFILE, WATCHER_CITY_PROFILE]) {
        const t = colonyCityTimeline(profile);
        expect(t.contactAt).to.be.greaterThan(t.landAt);
        expect(t.cubeAt).to.be.greaterThan(t.contactAt);
        expect(t.cubeLandAt).to.be.greaterThan(t.cubeAt);
      }
    });
  });

  describe('the descent — ONE progress, the resting pose written at the end', () => {
    it('hangs a lift above its seat, larger and tilted, over a wide faint shadow', () => {
      const pose = cityDescentAt(0, OWN_CITY_PROFILE);
      expect(pose.lift).eq(0.9);
      expect(pose.scale).eq(1.22);
      expect(pose.tilt).eq(TILE_START_TILT_DEG);
      expect(pose.shadowScale).eq(1.55);
      expect(pose.shadowAlpha).closeTo(0.22, 1e-9);
      expect(pose.touched).is.false;
    });

    it('q = 1 IS the resting pose: seated, square, at scale 1, the shadow tight and dark', () => {
      const pose = cityDescentAt(1, OWN_CITY_PROFILE);
      expect(pose.lift).eq(0);
      expect(pose.scale).closeTo(1, 1e-9);
      expect(Math.abs(pose.tilt)).eq(0);
      expect(pose.shadowScale).closeTo(1, 1e-9);
      expect(pose.shadowAlpha).closeTo(0.7, 1e-9);
      expect(pose.touched).is.true;
    });

    it('the piece is LAID DOWN: the fall accelerates (monotonic, the second half faster than the first) and reaches the seat at the contact', () => {
      const lifts = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8].map((q) => cityDescentAt(q, OWN_CITY_PROFILE).lift);
      for (let i = 1; i < lifts.length; i++) {
        expect(lifts[i], `q=${i / 10}`).to.be.lessThan(lifts[i - 1]);
      }
      const firstHalf = lifts[0] - lifts[4];
      const secondHalf = lifts[4] - lifts[8];
      expect(secondHalf, 'power2.in — never a float-in').to.be.greaterThan(firstHalf);
      expect(cityDescentAt(CITY_CONTACT_AT, OWN_CITY_PROFILE).lift).eq(0);
      expect(cityDescentAt(CITY_CONTACT_AT, OWN_CITY_PROFILE).touched).is.true;
      expect(cityDescentAt(CITY_CONTACT_AT - 0.01, OWN_CITY_PROFILE).touched).is.false;
      // Past the contact nothing moves — no bounce.
      expect(cityDescentAt(0.9, OWN_CITY_PROFILE)).deep.eq(cityDescentAt(1, OWN_CITY_PROFILE));
    });

    it('the tilt is unwound by 60 % of the landing, and the shadow only ever tightens and darkens', () => {
      expect(Math.abs(cityDescentAt(CITY_TILT_OUT_AT, OWN_CITY_PROFILE).tilt)).eq(0);
      expect(Math.abs(cityDescentAt(0.3, OWN_CITY_PROFILE).tilt)).closeTo(Math.abs(TILE_START_TILT_DEG) / 2, 1e-9);
      let scale = Infinity;
      let alpha = -Infinity;
      for (let q = 0; q <= 1.0001; q += 0.05) {
        const pose = cityDescentAt(q, OWN_CITY_PROFILE);
        expect(pose.shadowScale).to.be.at.most(scale);
        expect(pose.shadowAlpha).to.be.at.least(alpha);
        scale = pose.shadowScale;
        alpha = pose.shadowAlpha;
      }
    });

    it('out-of-range progress is clamped — a late frame cannot overshoot the seat', () => {
      expect(cityDescentAt(-1, OWN_CITY_PROFILE)).deep.eq(cityDescentAt(0, OWN_CITY_PROFILE));
      expect(cityDescentAt(7, OWN_CITY_PROFILE)).deep.eq(cityDescentAt(1, OWN_CITY_PROFILE));
    });
  });

  describe('the stage\'s reading — the server\'s marker, phrased', () => {
    const site: ColonyTileSite = {
      tile: TileType.CITY, space: NOVA, color: 'blue', card: CardName.NOVA_CITY,
      spaceCities: {before: 1, after: 2}, victoryPoints: 4,
    };

    it('the city, whose it is, the count now → after and the card\'s VP — the server\'s numbers, untouched', () => {
      expect(colonyCityReading(site, LUNA)).deep.eq({
        colony: LUNA,
        card: CardName.NOVA_CITY,
        color: 'blue',
        cities: {before: 1, after: 2},
        victoryPoints: 4,
        note: COLONY_CITY_NOTE,
      });
    });

    it('a card that scores nothing by its city carries no VP line', () => {
      const plain: ColonyTileSite = {tile: TileType.CITY, space: NOVA, color: 'red', card: CardName.NOVA_CITY, spaceCities: {before: 0, after: 1}};
      const reading = colonyCityReading(plain, TITAN);
      expect(reading).to.not.have.property('victoryPoints');
      expect(reading.cities).deep.eq({before: 0, after: 1});
    });

    it('the reading is a copy — the marker is never handed out by reference', () => {
      const reading = colonyCityReading(site, LUNA);
      expect(reading.cities).not.eq(site.spaceCities);
    });
  });
});
