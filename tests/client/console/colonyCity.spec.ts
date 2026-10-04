import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {ColonyName} from '@/common/colonies/ColonyName';
import {ColonyModel} from '@/common/models/ColonyModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {CardName} from '@/common/cards/CardName';
import {SpaceName} from '@/common/boards/SpaceName';
import {TileType} from '@/common/TileType';
import {Color} from '@/common/Color';
import {
  abortColonyCity, ackColonyCitySeat, armColonyCity, clearColonyCity, colonyCityAnswered, colonyCityOwnSceneLive, colonyCityPending,
  colonyCitySceneDone, colonyCitySeatStands, colonyCitySeatView, colonyCityState, detectColonyCity, disarmColonyCity, endWatchedColonyCity,
  hurryColonyCity, isColonyCityInputLocked, resetColonyCity, runColonyCity, seedColonyCityHolds, setColonyCityHoming,
} from '@/client/console/colonyCity/consoleColonyCity';
import {COLONY_CITY_CUBE_PX, ColonyCityArm, colonyCityLandings} from '@/client/console/colonyCity/colonyCityModel';
import {isAnimationHoldActive} from '@/client/components/presentation/animationHold';
import {StagedColonyModel} from '@/common/models/ActionPreviewModel';
import {colonyPickIntent} from '@/client/console/consoleColoniesModel';
import {PlayDoor, playCommitVerb, playDoorNextStepKey} from '@/client/console/consolePlayCardComposer';
import ConsoleColonyCitySeat from '@/client/components/console/colonyCity/ConsoleColonyCitySeat.vue';

const {CERES, LUNA, TITAN} = ColonyName;
const NOVA = SpaceName.NOVA_CITY;

function tile(name: ColonyName, city?: Color): ColonyModel {
  const model: ColonyModel = {name, colonies: [], isActive: true, trackPosition: 1, visitor: undefined};
  if (city !== undefined) {
    model.tiles = [{spaceId: NOVA, tileType: TileType.CITY, color: city, card: CardName.NOVA_CITY}];
  }
  return model;
}

function view(city?: [ColonyName, Color]): PlayerViewModel {
  return {game: {colonies: [CERES, LUNA, TITAN].map((name) => tile(name, city?.[0] === name ? city[1] : undefined))}} as unknown as PlayerViewModel;
}

const BEFORE = view();
const LANDED = view([LUNA, 'blue']);
const ARM: ColonyCityArm = {colony: LUNA, space: NOVA, color: 'blue', card: CardName.NOVA_CITY};

/**
 * A CITY LANDS ON A COLONY TILE — the controller (docs/TURMOIL_REDUX_NOVA_CITY.md).
 * Two tempos, one owner each: the player's own landing is an ARMED transport
 * gate whose commit opens at the CONTACT; somebody else's is SEEDED from the
 * views' diff, only while a measurable seat of that tile stands. (jsdom has no
 * laid-out seat and no stage: a scene that cannot be measured CONFESSES and
 * lands in its final pose — which is what is pinned here.)
 */
describe('consoleColonyCity — the landing\'s controller', () => {
  afterEach(() => {
    resetColonyCity();
  });

  describe('the player\'s own flow — the armed gate', () => {
    it('the arm is consumed only by an answer that carries THAT landing', () => {
      armColonyCity(ARM);
      expect(colonyCityPending()).is.true;
      expect(colonyCityAnswered()).is.true;
      // A parked tail / a re-ask: nothing landed.
      expect(detectColonyCity(BEFORE, BEFORE)).is.undefined;
      expect(colonyCityState.armed, 'the arm stands for the answer that will carry it').is.not.undefined;
      // Another tile, or another seat's city, is not ours.
      expect(detectColonyCity(BEFORE, view([CERES, 'blue']))).is.undefined;
      expect(detectColonyCity(BEFORE, view([LUNA, 'red']))).is.undefined;
      const landing = detectColonyCity(BEFORE, LANDED);
      expect(landing?.colony).eq(LUNA);
      expect(colonyCityState.armed, 'consumed exactly once').is.undefined;
      expect(detectColonyCity(BEFORE, LANDED)).is.undefined;
    });

    it('nothing armed — nothing detected (every other answer passes straight through)', () => {
      expect(detectColonyCity(BEFORE, LANDED)).is.undefined;
    });

    it('the scene holds the foreground and the pad, names its receipt, opens the gate and ends — a seat that cannot be measured is CONFESSED', async () => {
      const [landing] = colonyCityLandings(BEFORE.game.colonies, LANDED.game.colonies);
      armColonyCity(ARM);
      const gate = runColonyCity(landing);
      expect(colonyCityState.live).is.true;
      expect(colonyCityState.scale).eq('stage');
      expect(isAnimationHoldActive(), 'the named hold stands').is.true;
      expect(isColonyCityInputLocked()).is.true;
      expect(colonyCityState.receipt).deep.eq({colony: LUNA, card: CardName.NOVA_CITY});
      // The landed tile is WITHHELD on its seat from the first frame (the commit arrives mid-scene).
      expect(colonyCityState.holds[LUNA]).eq('tile');
      await gate; // never hangs: the gate opens at the contact — here, at the confessed degrade
      await colonyCitySceneDone();
      expect(colonyCityState.live).is.false;
      expect(colonyCityState.degraded).contain('no seat');
      expect(colonyCityState.holds[LUNA], 'every hold of its own is released').is.undefined;
      expect(colonyCityState.counted, 'the final pose: the count has flipped').is.true;
      expect(colonyCityState.landed, 'the seat answered — once').eq(LUNA);
      expect(colonyCityState.receipt, 'the receipt outlives the scene (the homing beat reads it)').is.not.undefined;
    });

    it('a re-ask / a refusal: `disarm` drops the arm and the receipt — the door stands as it was', () => {
      armColonyCity(ARM);
      disarmColonyCity();
      expect(colonyCityState.armed).is.undefined;
      expect(colonyCityAnswered()).is.false;
    });

    it('the homing beat keeps the pad the scene\'s; `clear` ends the flow', () => {
      setColonyCityHoming(true);
      expect(isColonyCityInputLocked()).is.true;
      expect(colonyCityAnswered()).is.true;
      clearColonyCity();
      expect(isColonyCityInputLocked()).is.false;
      expect(colonyCityState.receipt).is.undefined;
    });

    it('an abort mid-scene frees the gate and the hold (it never hangs), and confesses why', async () => {
      const [landing] = colonyCityLandings(BEFORE.game.colonies, LANDED.game.colonies);
      const gate = runColonyCity(landing);
      abortColonyCity('safety');
      await gate;
      expect(colonyCityState.live).is.false;
      expect(isAnimationHoldActive()).is.false;
      expect(colonyCityState.degraded).contain('safety');
      expect(Object.keys(colonyCityState.holds)).deep.eq([]);
    });

    it('«дожать» during a scene is safe at any moment (and a no-op with none playing)', async () => {
      hurryColonyCity();
      const [landing] = colonyCityLandings(BEFORE.game.colonies, LANDED.game.colonies);
      const gate = runColonyCity(landing);
      hurryColonyCity();
      await gate;
      await colonyCitySceneDone();
      expect(colonyCityState.live).is.false;
    });
  });

  describe('a watcher — seeded from the views\' diff', () => {
    it('with NO measurable seat on screen nothing is seeded and nothing is held — the city simply stands', () => {
      expect(colonyCitySeatStands(LUNA)).is.false;
      seedColonyCityHolds(BEFORE, LANDED);
      expect(colonyCityState.live).is.false;
      expect(Object.keys(colonyCityState.holds)).deep.eq([]);
      expect(isAnimationHoldActive()).is.false;
    });

    it('the gate marks what it played: the apply block that follows never seeds the player\'s own landing a second time', async () => {
      const [landing] = colonyCityLandings(BEFORE.game.colonies, LANDED.game.colonies);
      const gate = runColonyCity(landing);
      await gate;
      await colonyCitySceneDone();
      seedColonyCityHolds(BEFORE, LANDED);
      expect(colonyCityState.live, 'not replayed for the grid').is.false;
    });

    it('a view with no landing, a first view, or equal tables seed nothing', () => {
      seedColonyCityHolds(undefined, LANDED);
      seedColonyCityHolds(LANDED, LANDED);
      seedColonyCityHolds(BEFORE, BEFORE);
      expect(colonyCityState.live).is.false;
    });

    it('the landing a WATCHER sees touches one seat and nothing else: no locked pad, no pending answer, no «answered» door', () => {
      // (jsdom lays out no seat, so the seed cannot start a scene — the state it would stand in is set directly.)
      colonyCityState.live = true;
      colonyCityState.scale = 'tile';
      expect(colonyCityOwnSceneLive()).is.false;
      expect(isColonyCityInputLocked(), 'the watcher keeps the pad').is.false;
      expect(colonyCityPending(), 'no stage of the viewer is pinned').is.false;
      expect(colonyCityAnswered(), 'no door of the viewer is answered').is.false;
      expect(isAnimationHoldActive(), 'the named hold still stands — the scene is bounded').is.true;
      // The SAME state at the stage's scale is the player's own scene — and that one owns the pad.
      colonyCityState.scale = 'stage';
      expect(colonyCityOwnSceneLive()).is.true;
      expect(isColonyCityInputLocked()).is.true;
      expect(colonyCityAnswered()).is.true;
    });

    it('a watched landing that lost its surface ends at once in its final poses — the own scene of the player is never ended that way', async () => {
      colonyCityState.live = true;
      colonyCityState.scale = 'tile';
      colonyCityState.holds[LUNA] = 'tile';
      endWatchedColonyCity();
      expect(colonyCityState.live).is.false;
      expect(Object.keys(colonyCityState.holds), 'the withheld tile is released — the seat shows the city').deep.eq([]);
      expect(colonyCityState.degraded, 'a lost surface is no failure to confess').eq('');
      const [landing] = colonyCityLandings(BEFORE.game.colonies, LANDED.game.colonies);
      const gate = runColonyCity(landing);
      endWatchedColonyCity();
      expect(colonyCityState.live, 'the own scene of the player stands').is.true;
      await gate;
      await colonyCitySceneDone();
    });
  });

  describe('the seat\'s presentation — ONE reading for the tile, the stage and the dossier', () => {
    it('empty by default; the projection only while a «city» door stands', () => {
      expect(colonyCitySeatView(tile(LUNA), undefined)).deep.eq({pose: 'empty', cube: false});
      expect(colonyCitySeatView(tile(LUNA), 'blue')).deep.eq({pose: 'projected', color: 'blue', cube: false});
    });

    it('a seated city: the board\'s tile and its owner\'s cube — whatever door stands', () => {
      expect(colonyCitySeatView(tile(LUNA, 'red'), undefined)).deep.eq({pose: 'seated', color: 'red', card: CardName.NOVA_CITY, cube: true});
      expect(colonyCitySeatView(tile(LUNA, 'red'), 'blue'), 'a taken seat is never a projection').deep.include({pose: 'seated', color: 'red'});
    });

    it('ANSWERED: the armed tile WAITS (the contour alone) and every other candidate drops its ghost', () => {
      armColonyCity(ARM);
      expect(colonyCitySeatView(tile(LUNA), 'blue')).deep.eq({pose: 'waiting', color: 'blue', cube: false});
      expect(colonyCitySeatView(tile(CERES), 'blue'), 'the door\'s prompt outlived its answer').deep.eq({pose: 'empty', cube: false});
    });

    it('the landed tile is never painted before the piece is at rest, and its cube never before the cube lands', () => {
      colonyCityState.holds[LUNA] = 'tile';
      expect(colonyCitySeatView(tile(LUNA, 'blue'), undefined)).deep.eq({pose: 'waiting', color: 'blue', cube: false});
      colonyCityState.holds[LUNA] = 'cube';
      expect(colonyCitySeatView(tile(LUNA, 'blue'), undefined)).deep.eq({pose: 'seated', color: 'blue', card: CardName.NOVA_CITY, cube: false});
      delete colonyCityState.holds[LUNA];
      expect(colonyCitySeatView(tile(LUNA, 'blue'), undefined).cube).is.true;
    });

    it('a one-shot answer is cleared by its own seat only', () => {
      colonyCityState.landed = LUNA;
      ackColonyCitySeat(CERES, 'landed');
      expect(colonyCityState.landed).eq(LUNA);
      ackColonyCitySeat(LUNA, 'landed');
      expect(colonyCityState.landed).eq('');
    });
  });

  describe('the seat component — one for three hosts', () => {
    it('the anchor is ALWAYS rendered — an empty seat is an invisible measurement slot', () => {
      const wrapper = mount(ConsoleColonyCitySeat, {props: {colony: tile(LUNA)}}).find('.con-colcity');
      expect(wrapper.attributes('data-colony-city-seat')).eq(LUNA);
      expect(wrapper.attributes('data-colony-city-pose')).eq('empty');
      expect(wrapper.find('[data-colony-city-cube]').exists(), 'the cube\'s box is measurable before the cube stands').is.true;
      expect(wrapper.find('[data-colony-city-tile]').exists()).is.false;
      expect(wrapper.find('.con-colcity__contour').exists()).is.false;
      expect(wrapper.text(), 'a seat carries no text').eq('');
    });

    it('projected: the dashed contour, the board\'s own art as a ghost, a translucent cube in the viewer\'s colour', () => {
      const wrapper = mount(ConsoleColonyCitySeat, {props: {colony: tile(LUNA), projection: 'blue', size: 'tile'}}).find('.con-colcity');
      expect(wrapper.classes()).to.include.members(['con-colcity--projected', 'con-colcity--tile']);
      expect(wrapper.find('.con-colcity__contour').exists()).is.true;
      expect(wrapper.find('[data-colony-city-tile]').classes()).to.include('board-space-tile--city');
      expect(wrapper.find('.con-colcity__ghost-cube').classes()).to.include('player_translucent_bg_color_blue');
      expect(wrapper.find('.player-cube').exists(), 'no real cube in a projection').is.false;
      expect(wrapper.find('.con-colcity__shadow').exists()).is.false;
    });

    it('seated: the tile, the owner\'s real cube and the contact shadow — the piece LIES on the tile', () => {
      const wrapper = mount(ConsoleColonyCitySeat, {props: {colony: tile(LUNA, 'red'), size: 'stage'}}).find('.con-colcity');
      expect(wrapper.attributes('data-colony-city-pose')).eq('seated');
      expect(wrapper.attributes('data-colony-city-owner')).eq('red');
      expect(wrapper.find('[data-colony-city-tile]').classes()).to.include('board-space-tile--city');
      expect(wrapper.find('.con-colcity__shadow').exists()).is.true;
      expect(wrapper.find('.player-cube').exists()).is.true;
      expect(wrapper.find('.con-colcity__contour').exists()).is.false;
    });

    it('the cube keeps the board\'s proportion in every host (a 21px cube on a 51px hex)', () => {
      // hex heights: 2.5rem · 4.4rem · 4.8rem at 20px per rem → 50 · 88 · 96 px.
      expect(COLONY_CITY_CUBE_PX.tile / 50).closeTo(21 / 51, 0.02);
      expect(COLONY_CITY_CUBE_PX.stage / 88).closeTo(21 / 51, 0.02);
      expect(COLONY_CITY_CUBE_PX.dossier / 96).closeTo(21 / 51, 0.02);
    });
  });

  describe('the door — the marker decides', () => {
    const site = {tile: TileType.CITY, space: NOVA, color: 'blue' as const, card: CardName.NOVA_CITY, spaceCities: {before: 0, after: 1}, victoryPoints: 2};
    const staged = {
      sourceCard: CardName.NOVA_CITY,
      prompt: {type: 'colony', title: 'x', buttonLabel: 'Select', coloniesModel: [], tileSite: site},
    } as unknown as StagedColonyModel;
    const door: PlayDoor = {kind: 'colonies', staged};

    it('the composer\'s verb is «Choose the colony» and the step row names a city on a colony tile', () => {
      expect(playCommitVerb(door)).eq('Choose the colony');
      expect(playDoorNextStepKey(door)).eq('City on a colony tile — chosen in the Colonies');
    });

    it('a staged prompt and a live one are ONE act: `city`', () => {
      expect(colonyPickIntent({buttonLabel: 'Select', tileSite: staged.prompt.tileSite})).eq('city');
    });
  });
});
