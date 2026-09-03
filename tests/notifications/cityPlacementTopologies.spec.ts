import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {cast} from '../../src/common/utils/utils';
import {runAllActions} from '../TestingUtils';
import {Payment} from '../../src/common/inputs/Payment';
import {TileType, CITY_TILES} from '../../src/common/TileType';
import {IGame} from '../../src/server/IGame';
import {SelectSpace} from '../../src/server/inputs/SelectSpace';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {ResearchOutpost} from '../../src/server/cards/base/ResearchOutpost';
import {NoctisCity} from '../../src/server/cards/base/NoctisCity';
import {Capital} from '../../src/server/cards/base/Capital';
import {Asteroid} from '../../src/server/cards/base/Asteroid';
import {HiredRaiders} from '../../src/server/cards/base/HiredRaiders';
import {CityStandardProject} from '../../src/server/cards/base/standardProjects/CityStandardProject';
import {OceanCity} from '../../src/server/cards/ares/OceanCity';
import {NewHolland} from '../../src/server/cards/promo/NewHolland';
import {TharsisRepublic} from '../../src/server/cards/corporation/TharsisRepublic';
import {consumerSnapshot, consumeDoor, freshConsumer} from './consumerHarness';
import {captureLedger, verifyCrossPlayerDelivery} from './stateChangeOracle';

/**
 * CITY-PLACEMENT EXECUTION TOPOLOGIES × THE INDEPENDENT ORACLE.
 *
 * The 2026-09-03 audit's core methodology finding: «каждая карта
 * классифицирована» is not coverage — the same declarative effect reaches the
 * board through DIFFERENT execution topologies, and each topology is its own
 * failure surface. This spec drives ONE real door per topology end to end
 * (server mutation → event stream → serialized player view → the REAL console
 * ingest), then hands the result to the state-change oracle, which verifies
 * delivery by COMPARING independent sources (the game objects' own before /
 * after state vs the recipient bands the consumer presented) — never by
 * trusting the notification system's own metadata.
 *
 * Topology inventory for city tiles in the premium scope (full table in the
 * audit; sources sharing a topology are LINKED to its proof by code-level
 * assertions below, never by resemblance):
 *  - deferred `PlaceCityTile` → SelectSpace continuation (the whole
 *    `behavior.city` family incl. `on:'isolated'`, bespoke PlaceCityTile
 *    cards, Tharsis firstAction) — proven by T1 (+ S8 in the corpus);
 *  - synchronous `game.addCity` inside `bespokePlay` (Noctis City's reserved
 *    space; the off-Mars `city:{space}` family) — proven by T2;
 *  - special city tile via `behavior.tile` → `PlaceTile` → `game.addTile`
 *    (NEVER `addCity`: Capital, Capital:ares, Ocean City, New Holland) —
 *    proven by T3, linkage asserted in T6;
 *  - pay-on-commit standard project (chain rooted AT the commit — born
 *    closed, no open-prompt window) — proven by T4;
 *  - MarsBot placements — proven by the corpus (S10, bot city → Tharsis).
 */

function tharsisOwner(owner: TestPlayer): void {
  owner.playedCards.push(new TharsisRepublic());
  owner.production.override({megacredits: 0});
}

/** Drive a door and verify with the oracle: real ledger diff vs what each
 *  viewer's REAL consumer presents for it. */
function verifyDoor(game: IGame, actor: TestPlayer, players: ReadonlyArray<TestPlayer>, door: string,
  preLedger: ReturnType<typeof captureLedger>,
  pre: Map<TestPlayer, ReturnType<typeof consumerSnapshot>>): void {
  const after = captureLedger(game);
  verifyCrossPlayerDelivery({
    actor: actor.color,
    before: preLedger,
    after,
    players: players.map((p) => p.color),
    door,
    presentedFor: (viewer) => {
      const player = players.find((p) => p.color === viewer)!;
      return consumeDoor(game, player, pre.get(player)!);
    },
  });
  freshConsumer();
}

describe('city placement topologies × the independent state-change oracle', () => {
  afterEach(() => {
    freshConsumer();
  });

  function fresh() {
    const [game, actor, owner] = testGame(2);
    tharsisOwner(owner);
    const players = [actor, owner];
    const preLedger = captureLedger(game);
    const pre = new Map(players.map((p) => [p, consumerSnapshot(game, p)] as const));
    return {game, actor, owner, players, preLedger, pre};
  }

  it('T1 — deferred PlaceCityTile continuation (Research Outpost, on:\'isolated\'): the oracle confirms delivery', () => {
    const {game, actor, owner, players, preLedger, pre} = fresh();
    actor.megaCredits = 30;
    actor.playCard(new ResearchOutpost());
    runAllActions(game);
    const placement = cast(actor.getWaitingFor(), SelectSpace);
    actor.process({type: 'space', spaceId: placement.spaces[0].id});
    runAllActions(game);
    expect(owner.production.megacredits).eq(1);
    verifyDoor(game, actor, players, 'ResearchOutpost/deferred-isolated', preLedger, pre);
  });

  it('T2 — SYNCHRONOUS addCity inside bespokePlay (Noctis City reserved space): the oracle confirms delivery', () => {
    const {game, actor, owner, players, preLedger, pre} = fresh();
    actor.production.override({energy: 1});
    actor.playCard(new NoctisCity());
    runAllActions(game);
    expect(owner.production.megacredits, 'Tharsis fired on the synchronous placement').eq(1);
    verifyDoor(game, actor, players, 'NoctisCity/sync-reserved-space', preLedger, pre);
  });

  it('T3 — SPECIAL city tile via PlaceTile→addTile, never addCity (Capital): the oracle confirms delivery', () => {
    const {game, actor, owner, players, preLedger, pre} = fresh();
    actor.production.override({energy: 2});
    actor.playCard(new Capital());
    runAllActions(game);
    const placement = cast(actor.getWaitingFor(), SelectSpace);
    actor.process({type: 'space', spaceId: placement.spaces[0].id});
    runAllActions(game);
    expect(owner.production.megacredits, 'Board.isCitySpace covers CAPITAL — Tharsis fired').eq(1);
    verifyDoor(game, actor, players, 'Capital/special-tile-addTile', preLedger, pre);
  });

  it('T4 — pay-on-commit STANDARD PROJECT (chain born closed at the commit): the oracle confirms delivery', () => {
    const {game, actor, owner, players, preLedger, pre} = fresh();
    actor.megaCredits = 30;
    new CityStandardProject().payAndExecute(actor, Payment.of({megacredits: 25}));
    runAllActions(game);
    const placement = cast(actor.getWaitingFor(), SelectSpace);
    actor.process({type: 'space', spaceId: placement.spaces[0].id});
    runAllActions(game);
    expect(owner.production.megacredits, 'Tharsis fired on the standard-project city').eq(1);
    verifyDoor(game, actor, players, 'CityStandardProject/pay-on-commit', preLedger, pre);
  });

  it('T5 — NEGATIVE cross-player change (Hired Raiders steal) and a NO-OP (Asteroid vs zero plants): the oracle confirms both', () => {
    // Negative: the victim's loss must be delivered with the exact magnitude.
    const [game, actor, victim] = testGame(2);
    victim.megaCredits = 10;
    const players = [actor, victim];
    const preLedger = captureLedger(game);
    const pre = new Map(players.map((p) => [p, consumerSnapshot(game, p)] as const));
    actor.playCard(new HiredRaiders());
    runAllActions(game);
    const choice = cast(actor.getWaitingFor(), OrOptions);
    actor.process({type: 'or', index: 0, response: {type: 'option'}});
    runAllActions(game);
    expect(choice.options.length).greaterThan(0);
    const stolen = 10 - victim.megaCredits;
    expect(stolen, 'the steal actually happened').greaterThan(0);
    verifyDoor(game, actor, players, 'HiredRaiders/steal', preLedger, pre);

    // No-op: a skipped effect (no plants to remove) must NOT produce a
    // personal band for the untouched viewer.
    const [game2, actor2, bystander] = testGame(2);
    bystander.plants = 0;
    const players2 = [actor2, bystander];
    const preLedger2 = captureLedger(game2);
    const pre2 = new Map(players2.map((p) => [p, consumerSnapshot(game2, p)] as const));
    actor2.playCard(new Asteroid());
    runAllActions(game2);
    expect(bystander.plants).eq(0);
    verifyDoor(game2, actor2, players2, 'Asteroid/no-op-vs-zero-plants', preLedger2, pre2);
  });

  it('T6 — the CITY_TILES worklist: every engine city tile type is classified, and topology links are proven from code', () => {
    // The engine's own definition of «counts as a city» is the worklist. A new
    // member of CITY_TILES fails this spec until it is classified here.
    const classification: Record<number, 'proven' | 'linked' | 'frontier'> = {
      [TileType.CITY]: 'proven', // T1/T2/T4 (+ corpus S8/S10)
      [TileType.CAPITAL]: 'proven', // T3
      [TileType.OCEAN_CITY]: 'linked', // same executor branch as CAPITAL — asserted below
      [TileType.NEW_HOLLAND]: 'linked', // same executor branch as CAPITAL — asserted below
      [TileType.RED_CITY]: 'frontier', // pathfinders — outside the premium scope
    };
    for (const tile of CITY_TILES) {
      expect(classification[tile],
        `city tile type ${TileType[tile]} (${tile}) has no topology classification — ` +
        'a new counts-as-city tile must be proven, linked to a proven topology, or explicitly frontier').is.not.undefined;
    }
    // The LINK is a code fact, not a resemblance: the linked cards reach the
    // board through the SAME `behavior.tile` executor branch (PlaceTile →
    // game.addTile) that T3 proves with Capital. If either card stops using
    // that branch, this spec fails and the card needs its own proof.
    expect(new Capital().behavior?.tile?.type).eq(TileType.CAPITAL);
    expect(new OceanCity().behavior?.tile?.type).eq(TileType.OCEAN_CITY);
    expect(new OceanCity().behavior?.city, 'Ocean City must not silently move to another topology').is.undefined;
    expect(new NewHolland().behavior?.tile?.type).eq(TileType.NEW_HOLLAND);
    expect(new NewHolland().behavior?.city, 'New Holland must not silently move to another topology').is.undefined;
    // …and the isolated-placement card of the reported scenario stays on the
    // deferred-continuation topology T1 proves.
    expect(new ResearchOutpost().behavior?.city?.on).eq('isolated');
  });
});
