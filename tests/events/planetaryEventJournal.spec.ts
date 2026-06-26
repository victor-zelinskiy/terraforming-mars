import {expect} from 'chai';
import {IGame} from '@/server/IGame';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {addOcean, setTemperature} from '../TestingUtils';
import {TileType} from '@/common/TileType';
import {SpaceType} from '@/common/boards/SpaceType';

/**
 * Ares PLANETARY EVENTS (erosions appear / hazards intensify / dust storms recede)
 * must be JOURNAL ROOT events: a LogMessage with correlationId + role 'root-action'
 * + category 'planetary-event', AND an 'action' GameEvent with that category — so
 * they group in the premium journal and surface as notifications, never as a bare
 * attribution-less log.
 */
describe('Ares planetary-event journal coverage', () => {
  let game: IGame;
  let player: TestPlayer;

  function planetaryLogs() {
    return game.gameLog.filter((m) => m.category === 'planetary-event' && m.role === 'root-action');
  }

  it('erosions appearing at the ocean threshold is a planetary-event root', () => {
    [game, player] = testGame(2, {aresExtension: true});
    for (let n = 0; n < 3; n++) {
      addOcean(player); // crosses the 3-ocean erosion threshold
    }
    const logs = planetaryLogs();
    expect(logs.length, 'a planetary-event root log').to.be.greaterThan(0);
    expect(logs[0].correlationId).to.be.a('number');
    const ev = game.events.events.find((e) => e.type === 'action' && e.category === 'planetary-event');
    expect(ev, 'planetary-event action GameEvent').to.not.be.undefined;
  });

  it('the dust-storm-removal event is a planetary-event root and its +TR is grouped under it', () => {
    [game, player] = testGame(2, {aresExtension: true});
    for (let n = 0; n < 6; n++) {
      addOcean(player); // crosses the 6-ocean dust-storm-removal threshold
    }
    const removal = game.gameLog.find((m) => m.category === 'planetary-event' && m.message.includes('dust storms recede'));
    expect(removal, 'dust-storm-removal root log').to.not.be.undefined;
    // The +1 TR is recorded INSIDE the planetary-event scope (same correlationId).
    const trEv = game.events.events.find((e) => e.type === 'tr-changed' && e.correlationId === removal!.correlationId);
    expect(trEv, 'TR change grouped under the planetary event').to.not.be.undefined;
  });

  it('strengthening mild hazards is a planetary-event root', () => {
    [game, player] = testGame(2, {aresExtension: true});
    // Two mild erosions on the surface, then cross the −4°C threshold.
    const lands = game.board.spaces.filter((s) => s.spaceType === SpaceType.LAND && s.tile === undefined).slice(0, 2);
    lands.forEach((s) => {
      s.tile = {tileType: TileType.EROSION_MILD, protectedHazard: false};
    });
    setTemperature(game, -6);
    game.increaseTemperature(player, 1); // −6 → −4

    const intensify = game.gameLog.find((m) => m.category === 'planetary-event' && m.message.includes('intensify'));
    expect(intensify, 'intensify root log').to.not.be.undefined;
    // Both mild erosions were upgraded.
    expect(game.board.spaces.filter((s) => s.tile?.tileType === TileType.EROSION_SEVERE).length).to.eq(2);
  });

  it('no leak: a non-Ares game emits no planetary-event', () => {
    [game, player] = testGame(2);
    for (let n = 0; n < 6; n++) {
      addOcean(player);
    }
    expect(planetaryLogs().length).to.eq(0);
    expect(game.events.events.some((e) => e.category === 'planetary-event')).to.be.false;
  });
});
