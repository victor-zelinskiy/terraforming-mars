import {expect} from 'chai';
import {SpaceBonus} from '@/common/boards/SpaceBonus';
import {SpaceModel} from '@/common/models/SpaceModel';
import {TileType} from '@/common/TileType';
import {
  placementBonuses, verifyPlacement, applySpacePreview, detectFreshPlacements,
  tileFlightPlan, tileFlightPoint, tileScaleAt, tileTiltAt, tileShadowAt,
  TILE_START_SCALE, TILE_FLIGHT_MS, TILE_SETTLE_MS,
  OWN_FLIGHT_PROFILE, REMOTE_FLIGHT_PROFILE,
  BONUS_PRELIFT_START_T, BONUS_RISE_MS,
  oceanEdgePoint, oceanShoreDirection, oceanTransferSpecs, oceanWaveLeadMs,
  OCEAN_COIN_T, OCEAN_PULSE_T, OCEAN_COIN_LEAD_MS, OCEAN_COIN_FORM_MS,
  departureLiftPx, departingCubePose,
  TILE_DEPART_MS, TILE_DEPART_LIFT, TILE_DEPART_FADE_T,
  TILE_DEPART_REVEAL_T, TILE_DEPART_REVEAL_MS, TILE_DEPART_BREATH_MS,
} from '@/client/console/tilePlacement/tilePlacementModel';
import {
  holdRemoteReveal, releaseRemoteReveal, isRemoteRevealHeld, clearRemoteRevealHolds, heldPrevTileOf,
} from '@/client/console/tilePlacement/remoteRevealHold';

function space(id: string, over: Partial<SpaceModel> = {}): SpaceModel {
  return {id, x: 0, y: 0, spaceType: 'land', bonus: [], ...over} as unknown as SpaceModel;
}

describe('tilePlacementModel (pure math of the placement hero scene)', () => {
  describe('placementBonuses (the printed-icon manifest)', () => {
    it('collects ONE unit per printed stock icon, index-aligned with the cell', () => {
      const out = placementBonuses([SpaceBonus.STEEL, SpaceBonus.STEEL, SpaceBonus.PLANT]);
      expect(out).to.have.length(3);
      expect(out[0]).to.deep.include({bonusIndex: 0, icon: 'steel'});
      expect(out[0].spec).to.deep.eq({channel: 'stock', resource: 'steel', amount: 1});
      expect(out[1].bonusIndex).to.eq(1);
      expect(out[2].spec.resource).to.eq('plants');
    });

    it('carries ONLY panel stock resources — cards / oceans / card-resources ride their own flows', () => {
      const out = placementBonuses([
        SpaceBonus.DRAW_CARD, SpaceBonus.OCEAN, SpaceBonus.ANIMAL, SpaceBonus.MICROBE,
        SpaceBonus.TEMPERATURE, SpaceBonus.ENERGY_PRODUCTION, SpaceBonus.DELEGATE,
        SpaceBonus.TITANIUM,
      ]);
      expect(out).to.have.length(1);
      expect(out[0].spec.resource).to.eq('titanium');
      expect(out[0].bonusIndex).to.eq(7); // the printed ordinal survives filtering
    });

    it('Ares megacredits transfer WITHOUT a printed sprite (hex-centre fallback)', () => {
      const out = placementBonuses([SpaceBonus.MEGACREDITS]);
      expect(out).to.have.length(1);
      expect(out[0].spec.resource).to.eq('megacredits');
      expect(out[0].icon).to.be.undefined;
    });
  });

  describe('verifyPlacement (the server-authoritative success proof)', () => {
    const prev = [space('05'), space('06')];

    it('accepts EMPTY → TILED on the armed space (carrying the owner for the cube drop)', () => {
      const next = [space('05', {tileType: TileType.CITY, color: 'red'}), space('06')];
      expect(verifyPlacement(prev, next, '05')).to.deep.eq({tileType: TileType.CITY, color: 'red'});
    });

    it('an ownerless landing (ocean) carries color undefined — no cube to drop', () => {
      const next = [space('05', {tileType: TileType.OCEAN}), space('06')];
      expect(verifyPlacement(prev, next, '05')).to.deep.eq({tileType: TileType.OCEAN, color: undefined});
    });

    it('rejects a placement the server did not make', () => {
      expect(verifyPlacement(prev, [space('05'), space('06')], '05')).to.be.undefined;
    });

    it('rejects an already-occupied cell (covered tiles ride their own sequence)', () => {
      const covered = [space('05', {tileType: TileType.EROSION_MILD}), space('06')];
      const next = [space('05', {tileType: TileType.CITY}), space('06')];
      expect(verifyPlacement(covered, next, '05')).to.be.undefined;
    });

    it('rejects a HAZARD materializing (its own ominous entrance owns it)', () => {
      const next = [space('05', {tileType: TileType.EROSION_MILD}), space('06')];
      expect(verifyPlacement(prev, next, '05')).to.be.undefined;
    });

    it('accepts a tile landing ON a plain ocean (Ares covers), carrying the water', () => {
      const onOcean = [space('05', {tileType: TileType.OCEAN}), space('06')];
      const next = [space('05', {tileType: TileType.OCEAN_CITY, color: 'red'}), space('06')];
      expect(verifyPlacement(onOcean, next, '05')).to.deep.eq(
        {tileType: TileType.OCEAN_CITY, color: 'red', covers: TileType.OCEAN});
    });

    it('rejects a non-ocean replacement (hazard cleanup rides its own sequence)', () => {
      const onCity = [space('05', {tileType: TileType.CITY, color: 'red'}), space('06')];
      const next = [space('05', {tileType: TileType.OCEAN_CITY, color: 'red'}), space('06')];
      expect(verifyPlacement(onCity, next, '05')).to.be.undefined;
    });

    describe('a DECLARED remove-and-replace (Kaguya Tech / Lunar Mine Urbanization)', () => {
      const onGreenery = [space('05', {tileType: TileType.GREENERY, color: 'red'}), space('06')];
      const toCity = [space('05', {tileType: TileType.CITY, color: 'red'}), space('06')];

      it('reads the tile→tile diff as a placement and reports what LEAVES', () => {
        expect(verifyPlacement(onGreenery, toCity, '05', {replacing: true})).to.deep.eq({
          tileType: TileType.CITY,
          color: 'red',
          replaces: {tileType: TileType.GREENERY, color: 'red'},
        });
      });

      it('is NOT `covers`: the server emptied the cell, so the printed bonuses ARE granted', () => {
        const landed = verifyPlacement(onGreenery, toCity, '05', {replacing: true});
        expect(landed?.covers).to.be.undefined;
      });

      it('WITHOUT the declaration the very same diff is still refused', () => {
        // The prompt's `hiddenTiles` marker is what licenses this reading — an
        // unexplained type change stays somebody else's sequence.
        expect(verifyPlacement(onGreenery, toCity, '05')).to.be.undefined;
        expect(verifyPlacement(onGreenery, toCity, '05', {replacing: false})).to.be.undefined;
      });

      it('a HAZARD on either side keeps its own ominous language', () => {
        const onHazard = [space('05', {tileType: TileType.EROSION_MILD}), space('06')];
        expect(verifyPlacement(onHazard, toCity, '05', {replacing: true})).to.be.undefined;
        const toHazard = [space('05', {tileType: TileType.EROSION_MILD}), space('06')];
        expect(verifyPlacement(onGreenery, toHazard, '05', {replacing: true})).to.be.undefined;
      });

      it('an unchanged cell is not a placement, declared or not', () => {
        const same = [space('05', {tileType: TileType.GREENERY, color: 'red'}), space('06')];
        expect(verifyPlacement(onGreenery, same, '05', {replacing: true})).to.be.undefined;
        expect(verifyPlacement(onGreenery, same, '05')).to.be.undefined;
      });
    });
  });

  describe('the DEPARTURE beat (the removal half of a remove-and-replace)', () => {
    it('the lift is a fraction of the LIVE hex — proportional under any board zoom', () => {
      expect(departureLiftPx({x: 0, y: 0, w: 46, h: 100})).to.eq(Math.round(100 * TILE_DEPART_LIFT));
      // …and twice the hex is twice the lift (the zoomed board reads the same).
      expect(departureLiftPx({x: 0, y: 0, w: 92, h: 200}))
        .to.eq(2 * departureLiftPx({x: 0, y: 0, w: 46, h: 100}));
    });

    it('a tiny hex still gets a readable lift (the floor)', () => {
      expect(departureLiftPx({x: 0, y: 0, w: 9, h: 9})).to.eq(16);
    });

    it('the tile CLEARS the cell before it starts to fade', () => {
      expect(TILE_DEPART_FADE_T).to.be.greaterThan(0.3);
      expect(TILE_DEPART_FADE_T).to.be.lessThan(1);
    });

    it('the uncovered bonus surfaces DURING the lift, and finishes before the replacement flies', () => {
      const revealStart = TILE_DEPART_REVEAL_T * TILE_DEPART_MS;
      // Late enough that the tile is no longer sitting on the icons…
      expect(revealStart).to.be.greaterThan(0);
      // …early enough to read as uncovered BY the departure, not after it…
      expect(revealStart).to.be.lessThan(TILE_DEPART_MS);
      // …and settled by the time the ordinary flight begins (lift + breath).
      expect(revealStart + TILE_DEPART_REVEAL_MS)
        .to.be.at.most(TILE_DEPART_MS + TILE_DEPART_BREATH_MS + TILE_FLIGHT_MS);
    });

    it('the whole removal is a PREFIX, not a second scene — it costs under a second', () => {
      expect(TILE_DEPART_MS + TILE_DEPART_BREATH_MS).to.be.lessThan(700);
    });

    describe('the owner marker travelling with its tile', () => {
      // The board authors the socket in px against the UNSCALED 46×51 cell
      // (`.player-cube.board-owner-cube { right: 7px; bottom: 14px }`,
      // `:size="12"`); a fixed proxy does not inherit the board's zoom, so
      // the pose is re-derived from the measured hex.
      it('reproduces the board socket exactly at board scale 1', () => {
        const pose = departingCubePose('red', {x: 0, y: 0, w: 46, h: 51});
        expect(pose).to.deep.eq({color: 'red', size: 12, right: 7, bottom: 14});
      });

      it('scales with the live hex — the twin never drifts out of its socket', () => {
        const pose = departingCubePose('blue', {x: 0, y: 0, w: 92, h: 102});
        expect(pose?.size).to.eq(24);
        expect(pose?.right).to.eq(14);
        expect(pose?.bottom).to.eq(28);
      });

      it('an ownerless tile (an ocean) carries no cube, and neither does a degenerate hex', () => {
        expect(departingCubePose(undefined, {x: 0, y: 0, w: 46, h: 51})).to.be.undefined;
        expect(departingCubePose('red', undefined)).to.be.undefined;
        expect(departingCubePose('red', {x: 0, y: 0, w: 2, h: 2})).to.be.undefined;
      });
    });
  });

  describe('detectFreshPlacements (the remote scene\'s diff)', () => {
    it('collects every fresh EMPTY → TILED cell with its owner, in board order', () => {
      const prev = [space('05'), space('06'), space('07', {tileType: TileType.OCEAN})];
      const next = [
        space('05', {tileType: TileType.CITY, color: 'red'}),
        space('06', {tileType: TileType.OCEAN}),
        space('07', {tileType: TileType.OCEAN}),
      ];
      expect(detectFreshPlacements(prev, next)).to.deep.eq([
        {spaceId: '05', tileType: TileType.CITY, color: 'red'},
        {spaceId: '06', tileType: TileType.OCEAN, color: undefined},
      ]);
    });

    it('excludes hazards (their ominous materialization is its own language) and covered cells', () => {
      const prev = [space('05'), space('06', {tileType: TileType.EROSION_MILD})];
      const next = [
        space('05', {tileType: TileType.EROSION_SEVERE}),
        space('06', {tileType: TileType.GREENERY, color: 'green'}),
      ];
      expect(detectFreshPlacements(prev, next)).to.deep.eq([]);
    });

    it('defensively skips id-misaligned entries (board variant / partial response)', () => {
      const prev = [space('05')];
      const next = [space('99', {tileType: TileType.CITY, color: 'red'})];
      expect(detectFreshPlacements(prev, next)).to.deep.eq([]);
    });

    it('collects an OCEAN → cover replacement WITH the water it lands on', () => {
      const prev = [space('05', {tileType: TileType.OCEAN}), space('06')];
      const next = [
        space('05', {tileType: TileType.OCEAN_SANCTUARY, color: 'blue'}),
        space('06'),
      ];
      expect(detectFreshPlacements(prev, next)).to.deep.eq([
        {spaceId: '05', tileType: TileType.OCEAN_SANCTUARY, color: 'blue', covers: TileType.OCEAN},
      ]);
    });
  });

  describe('the REMOTE flight profile (provenance carried by the pose)', () => {
    it('departs markedly smaller than the own pick-up — nobody lifted it off the viewer\'s hand', () => {
      expect(REMOTE_FLIGHT_PROFILE.startScale).to.be.lessThan(OWN_FLIGHT_PROFILE.startScale);
      expect(tileScaleAt(0, REMOTE_FLIGHT_PROFILE)).to.eq(REMOTE_FLIGHT_PROFILE.startScale);
    });

    it('the remote scale is monotone and EXACTLY 1 at touchdown — same landing physics', () => {
      expect(tileScaleAt(1, REMOTE_FLIGHT_PROFILE)).to.eq(1);
      let last = tileScaleAt(0, REMOTE_FLIGHT_PROFILE);
      for (let t = 0.05; t <= 1; t += 0.05) {
        const s = tileScaleAt(t, REMOTE_FLIGHT_PROFILE);
        expect(s).to.be.at.most(last + 1e-9);
        last = s;
      }
    });

    it('the carried tilt is MIRRORED (the other hand) and still lands square', () => {
      expect(Math.sign(tileTiltAt(0, REMOTE_FLIGHT_PROFILE)))
        .to.eq(-Math.sign(tileTiltAt(0, OWN_FLIGHT_PROFILE)));
      expect(tileTiltAt(0.75, REMOTE_FLIGHT_PROFILE)).to.eq(0);
      expect(tileTiltAt(1, REMOTE_FLIGHT_PROFILE)).to.eq(0);
    });
  });

  describe('remoteRevealHold (the committed-tile reveal gate)', () => {
    afterEach(() => {
      // Module state is bundle-shared under mochapack — never leak a hold.
      clearRemoteRevealHolds();
    });

    it('an ocean cover remembers the water it hides (heldPrevTileOf)', () => {
      holdRemoteReveal('05', TileType.OCEAN);
      holdRemoteReveal('06');
      expect(heldPrevTileOf('05')).to.eq(TileType.OCEAN);
      expect(heldPrevTileOf('06')).to.be.undefined;
      releaseRemoteReveal('05');
      expect(heldPrevTileOf('05')).to.be.undefined;
    });

    it('holds, releases idempotently, and clears wholesale', () => {
      holdRemoteReveal('05');
      holdRemoteReveal('06');
      expect(isRemoteRevealHeld('05')).to.eq(true);
      releaseRemoteReveal('05');
      releaseRemoteReveal('05'); // idempotent
      expect(isRemoteRevealHeld('05')).to.eq(false);
      expect(isRemoteRevealHeld('06')).to.eq(true);
      clearRemoteRevealHolds();
      expect(isRemoteRevealHeld('06')).to.eq(false);
    });
  });

  it('applySpacePreview paints JUST the armed space (colour + rotation included)', () => {
    const prev = [space('05'), space('06')];
    const next = [
      space('05', {tileType: TileType.GREENERY, color: 'green'}),
      space('06', {tileType: TileType.EROSION_MILD}),
    ];
    applySpacePreview(prev, next, '05');
    expect(prev[0].tileType).to.eq(TileType.GREENERY);
    expect(prev[0].color).to.eq('green');
    // The OTHER fresh tile is deliberately left for the generic hold.
    expect(prev[1].tileType).to.be.undefined;
  });

  describe('the flight profiles (one carried arc, board-perspective approach)', () => {
    const from = {x: 640, y: 700};
    const to = {x: 400, y: 300};

    it('the arc starts at the supply, ends at the hex, and stays LOW (carried, not tossed)', () => {
      const plan = tileFlightPlan(from, to);
      expect(tileFlightPoint(plan, 0)).to.deep.eq(from);
      expect(tileFlightPoint(plan, 1)).to.deep.eq(to);
      // The apex (t=0.5) rides above the HIGHER endpoint by the clamped
      // lift only — a carried, flat trajectory, never a chip-style toss.
      const mid = tileFlightPoint(plan, 0.5);
      expect(mid.y).to.be.lessThan(Math.min(from.y, to.y));
      expect(Math.min(from.y, to.y) - mid.y).to.be.at.most(110 + 0.001);
    });

    it('the scale departs large, never grows, and is EXACTLY 1 at touchdown', () => {
      expect(tileScaleAt(0)).to.eq(TILE_START_SCALE);
      expect(tileScaleAt(1)).to.eq(1);
      let last = tileScaleAt(0);
      for (let t = 0.05; t <= 1; t += 0.05) {
        const s = tileScaleAt(t);
        expect(s).to.be.at.most(last + 1e-9); // monotone approach into the board
        last = s;
      }
    });

    it('the carried tilt fully unwinds before the approach — the landing is square', () => {
      expect(Math.abs(tileTiltAt(0))).to.be.greaterThan(2);
      expect(tileTiltAt(0.75)).to.eq(0);
      expect(tileTiltAt(1)).to.eq(0);
    });

    it('the ground shadow tightens + darkens from hover to contact', () => {
      const air = tileShadowAt(0);
      const contact = tileShadowAt(1);
      expect(air.scale).to.be.greaterThan(contact.scale);
      expect(air.alpha).to.be.lessThan(contact.alpha);
      expect(contact.scale).to.be.closeTo(1, 0.001);
    });

    it('the bonus PRE-LIFT starts on the descent and completes by the settle — the tile always slides UNDER hovering icons', () => {
      const riseStart = BONUS_PRELIFT_START_T * TILE_FLIGHT_MS;
      // Starts in the second half of the flight (the displacement reads as
      // caused by the arriving tile, never a premature float)…
      expect(BONUS_PRELIFT_START_T).to.be.greaterThan(0.5);
      // …and the icons are FULLY hovering before the landing settles, so a
      // bonus is never covered and never pops out from beneath the tile.
      expect(riseStart + BONUS_RISE_MS).to.be.at.most(TILE_FLIGHT_MS + TILE_SETTLE_MS);
    });
  });

  describe('ocean adjacency geometry (one ocean, one coin, at ITS shore)', () => {
    // Two adjacent hexes, 100px apart on the x axis: the ocean on the left,
    // the freshly placed tile on the right. Rects are viewport-space (what
    // getBoundingClientRect returns), so board zoom / TV scale need no
    // compensation — they are already inside the numbers.
    const ocean = {x: 0, y: 0, w: 100, h: 100};
    const tile = {x: 100, y: 0, w: 100, h: 100};

    it('the coin is born INSIDE the water, on the side facing the new tile', () => {
      const p = oceanEdgePoint(ocean, tile, OCEAN_COIN_T);
      // Toward the tile from the ocean's centre…
      expect(p.x).to.be.greaterThan(50);
      // …but short of the shared border (the midpoint of the two centres), so
      // the coin never overlaps the tile that was just placed.
      expect(p.x).to.be.lessThan(100);
      expect(p.y).to.eq(50);
    });

    it('the water wakes NEARER the shared shore than the coin is born', () => {
      expect(OCEAN_PULSE_T).to.be.greaterThan(OCEAN_COIN_T);
      expect(OCEAN_PULSE_T).to.be.at.most(0.5); // never past the border
      const pulse = oceanEdgePoint(ocean, tile, OCEAN_PULSE_T);
      const coin = oceanEdgePoint(ocean, tile, OCEAN_COIN_T);
      expect(pulse.x).to.be.greaterThan(coin.x);
    });

    it('the coin floats ABOVE the surface so it never sits inside the tile art', () => {
      const lifted = oceanEdgePoint(ocean, tile, OCEAN_COIN_T, 12);
      expect(lifted.y).to.eq(oceanEdgePoint(ocean, tile, OCEAN_COIN_T).y - 12);
    });

    it('works in every direction — the shore is derived, never assumed', () => {
      const above = {x: 100, y: -100, w: 100, h: 100};
      const p = oceanEdgePoint(ocean, above, OCEAN_COIN_T);
      expect(p.x).to.be.greaterThan(50); // toward it on x…
      expect(p.y).to.be.lessThan(50); // …and up on y
      const dir = oceanShoreDirection(ocean, above);
      expect(Math.hypot(dir.x, dir.y)).to.be.closeTo(1, 1e-9);
      expect(dir.y).to.be.lessThan(0);
    });

    it('degenerate geometry (coincident hexes) degrades to the ocean centre', () => {
      const p = oceanEdgePoint(ocean, ocean, OCEAN_COIN_T, 5);
      expect(p).to.deep.eq({x: 50, y: 45});
      expect(oceanShoreDirection(ocean, ocean)).to.deep.eq({x: 0, y: -1});
    });

    it('one ocean = one coin: N specs of the per-ocean rate, never merged', () => {
      const specs = oceanTransferSpecs(3, 2);
      expect(specs).to.have.length(3);
      expect(specs.every((s) => s.channel === 'stock' && s.resource === 'megacredits' && s.amount === 2)).to.be.true;
      // A raised rate (Lakefront Resorts) rides the same shape.
      expect(oceanTransferSpecs(2, 3).map((s) => s.amount)).to.deep.eq([3, 3]);
      expect(oceanTransferSpecs(0, 2)).to.have.length(0);
    });

    it('the wave launches exactly when the first coin has finished forming', () => {
      expect(oceanWaveLeadMs()).to.eq(OCEAN_COIN_LEAD_MS + OCEAN_COIN_FORM_MS);
      // The condensation starts INSIDE the water's response, not after it —
      // the coin is made OF that light, not announced by it.
      expect(OCEAN_COIN_LEAD_MS).to.be.lessThan(OCEAN_COIN_FORM_MS);
    });
  });
});
