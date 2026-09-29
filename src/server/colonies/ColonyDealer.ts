import {IColony} from './IColony';
import {ColonyName} from '../../common/colonies/ColonyName';
import {Random} from '../../common/utils/Random';
import {ALL_COLONIES_TILES, BASE_COLONIES_TILES, COMMUNITY_COLONIES_TILES, IColonyFactory, PATHFINDERS_COLONIES_TILES, TURMOIL_REDUX_COLONIES_TILES} from './ColonyManifest';
import {GameOptions} from '../game/GameOptions';
import {isTurmoilReduxAddition, TURMOIL_REDUX_REPLACEMENTS} from '../../common/colonies/AllColonies';
import {Colony} from './Colony';

// TODO(kberg): Add ability to hard-code chosen colonies, separate from customColoniesList, so as to not be
// forced to rely on the RNG.
// TODO(kberg): Add ability to disable initial action that removes a colony in the solo game. (Or come up with
// a simple line of code to deal with solo games.)

export class ColonyDealer {
  private readonly gameColonies: ReadonlyArray<IColony>;
  public colonies: Array<IColony> = [];
  public discardedColonies: Array<IColony> = [];

  constructor(private rng: Random, private gameOptions: GameOptions) {
    let colonyTiles = BASE_COLONIES_TILES;

    if (ColonyDealer.includesCommunityColonies(gameOptions)) {
      colonyTiles = colonyTiles.concat(COMMUNITY_COLONIES_TILES);
    }
    if (gameOptions.pathfindersExpansion || gameOptions.moonExpansion) {
      colonyTiles = colonyTiles.concat(PATHFINDERS_COLONIES_TILES);
    }
    if (gameOptions.moonExpansion && !this.gameOptions.pathfindersExpansion) {
      // Leavitt II isn't built yet but this is pre-emptive
      colonyTiles.filter((c) => c.colonyName !== ColonyName.LEAVITT_II);
    }
    if (gameOptions.turmoilReduxExpansion) {
      // The Redux ADDITIONS join the pool (the replacements are swapped in
      // below, tile for tile — never added beside their base twin).
      colonyTiles = colonyTiles.concat(TURMOIL_REDUX_COLONIES_TILES.filter((c) => isTurmoilReduxAddition(c.colonyName)));
    }
    if (!gameOptions.venusNextExtension) {
      // THE REDUX VENUS TERRAFORMS VENUS ON EVERY TRADE — its fixed income.
      // Without Venus Next there is no scale to move: every trade would
      // silently lose its main effect, and a step of a track that is not in
      // the game is nothing the rules describe. A project decision (the Redux
      // rulebook is silent): the tile needs Venus Next, exactly as the
      // retired community Venus did and as the catalog's Venus-only
      // resolutions do (`compatibility: ['venus']`).
      colonyTiles = colonyTiles.filter((c) => c.colonyName !== ColonyName.VENUS_REDUX);
    }
    if (!gameOptions.turmoilExtension) {
      colonyTiles = colonyTiles.filter((c) => c.colonyName !== ColonyName.PALLAS);
    }
    if (!gameOptions.aresExtension) {
      colonyTiles = colonyTiles.filter((c) => c.colonyName !== ColonyName.DEIMOS);
    }
    // Every tile the dealer can seat has a MarsBot Shipping Board area (the Redux additions got their own
    // with MarsBot support for Turmoil Redux — `VenusAndShippingData.spec` guards the pool), so a MarsBot
    // table is dealt exactly what a human table is.
    this.gameColonies = ColonyDealer.withReduxReplacements(colonyTiles, gameOptions)
      .map((cf) => new cf.Factory());
  }

  private static includesCommunityColonies(gameOptions: GameOptions) : boolean {
    if (gameOptions.communityCardsOption) {
      return true;
    }
    const communityColonyNames = COMMUNITY_COLONIES_TILES.map((cf) => cf.colonyName);
    return gameOptions.customColoniesList.some((colonyName) => communityColonyNames.includes(colonyName));
  }

  /**
   * TURMOIL REDUX REPLACES ITS TWINS AND ADDS THE REST. With the expansion on,
   * a base tile that has a Redux twin (`TURMOIL_REDUX_REPLACEMENTS` — Pluto)
   * is swapped for it, in the dealt pool AND in a hand-picked
   * `customColoniesList` (a player who picked «Pluto» gets the game's Pluto);
   * a Redux name written into the custom list directly is honoured as is.
   * Without the expansion a Redux tile is never dealt — a custom list that
   * names a REPLACEMENT falls back to its base twin (an old preset keeps
   * working), and one that names an ADDITION (the Redux Venus — no twin to
   * fall back to) simply drops it.
   */
  private static withReduxReplacements(tiles: ReadonlyArray<IColonyFactory<Colony>>, gameOptions: GameOptions): Array<IColonyFactory<Colony>> {
    const redux = gameOptions.turmoilReduxExpansion === true;
    const out: Array<IColonyFactory<Colony>> = [];
    for (const tile of tiles) {
      const replacement = ColonyDealer.reduxReplacementFor(tile.colonyName, redux);
      if (replacement === undefined) {
        continue;
      }
      const entry = replacement === tile.colonyName ? tile : ALL_COLONIES_TILES.find((cf) => cf.colonyName === replacement);
      if (entry !== undefined && !out.some((cf) => cf.colonyName === entry.colonyName)) {
        out.push(entry);
      }
    }
    return out;
  }

  /** The name the game actually seats for `name` under this expansion setting — `undefined` for a Redux addition without the expansion. */
  private static reduxReplacementFor(name: ColonyName, redux: boolean): ColonyName | undefined {
    if (redux) {
      return TURMOIL_REDUX_REPLACEMENTS[name] ?? name;
    }
    if (isTurmoilReduxAddition(name)) {
      return undefined;
    }
    const base = (Object.keys(TURMOIL_REDUX_REPLACEMENTS) as Array<ColonyName>)
      .find((key) => TURMOIL_REDUX_REPLACEMENTS[key] === name);
    return base ?? name;
  }

  private shuffle(cards: Array<IColony> | ReadonlyArray<IColony>): Array<IColony> {
    const deck: Array<IColony> = [];
    const copy = cards.slice();
    while (copy.length) {
      deck.push(copy.splice(Math.floor(this.rng.nextInt(copy.length)), 1)[0]);
    }
    return deck;
  }

  public drawColonies(players: number): void {
    const customColonies = this.gameOptions.customColoniesList;
    let colonies = this.gameColonies;
    if (customColonies.length > 0) {
      const picked = ALL_COLONIES_TILES.filter((c) => customColonies.includes(c.colonyName));
      colonies = ColonyDealer.withReduxReplacements(picked, this.gameOptions)
        .map((cf) => new cf.Factory());
    }

    const count = (players + 2) +
      (players <= 2 ? 1 : 0); // Two-player games and solo games get one more colony.

    if (colonies.length < count) {
      throw new Error(`Not enough valid colonies to choose from (want ${count}, has ${colonies.length}.) Remember that colonies like Venus and Pallas are invalid without Venus or Turmoil.`);
    }

    const tempDeck = this.shuffle(colonies);
    for (let i = 0; i < count; i++) {
      const colony = tempDeck.pop();
      if (colony === undefined) {
        throw new Error('Not enough colonies');
      }
      this.colonies.push(colony);
    }

    this.discardedColonies.push(...tempDeck);
    this.discardedColonies.sort((a, b) => (a.name > b.name) ? 1 : -1);
    this.colonies.sort((a, b) => (a.name > b.name) ? 1 : -1);
  }

  public restore(activeColonies: Array<IColony>): void {
    this.colonies = [...activeColonies];
    this.discardedColonies = this.gameColonies.filter((c) => {
      return !activeColonies.some((ac) => ac.name === c.name);
    });
  }
}
