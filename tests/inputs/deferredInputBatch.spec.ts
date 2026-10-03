import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {cast} from '../../src/common/utils/utils';
import {CardName} from '../../src/common/cards/CardName';
import {IProjectCard} from '../../src/server/cards/IProjectCard';
import {Payment} from '../../src/common/inputs/Payment';
import {InputResponse} from '../../src/common/inputs/InputResponse';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {AstraMechanica} from '../../src/server/cards/promo/AstraMechanica';
import {BribedCommittee} from '../../src/server/cards/base/BribedCommittee';
import {SubterraneanReservoir} from '../../src/server/cards/base/SubterraneanReservoir';
import {OlympusConference} from '../../src/server/cards/base/OlympusConference';
import {PharmacyUnion} from '../../src/server/cards/promo/PharmacyUnion';
import {Asteroid} from '../../src/server/cards/base/Asteroid';
import {DeltaSurge} from '../../src/server/cards/delta/DeltaSurge';
import {RegolithEaters} from '../../src/server/cards/base/RegolithEaters';
import {DELTA_TRACK_TAGS} from '../../src/server/delta/DeltaProjectExpansion';
import {fakeCard, setRulingParty} from '../TestingUtils';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {NuclearZone} from '../../src/server/cards/base/NuclearZone';
import {AresHazards} from '../../src/server/ares/AresHazards';
import {Comet} from '../../src/server/cards/base/Comet';
import {GiantIceAsteroid} from '../../src/server/cards/base/GiantIceAsteroid';
import {AquiferPumping} from '../../src/server/cards/base/AquiferPumping';
import {SelectSpace} from '../../src/server/inputs/SelectSpace';
import {TileType} from '../../src/common/TileType';
import {setTemperature, runAllActions} from '../TestingUtils';
import {SelectParty} from '../../src/server/inputs/SelectParty';
import {SelectOption} from '../../src/server/inputs/SelectOption';
import {Priority} from '../../src/server/deferredActions/Priority';
import {PlaceDelegatesOnResolution} from '../../src/server/parliament/PlaceDelegatesOnResolution';
import {Parliament} from '../../src/server/parliament/Parliament';
import {colonySource} from '../../src/server/inputs/choiceContext';
import {ColonyName} from '../../src/common/colonies/ColonyName';
import {Phase} from '../../src/common/Phase';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {isSelectColonyResponse, isSelectPartyResponse} from '../../src/common/inputs/InputResponse';
import {SelectColony} from '../../src/server/inputs/SelectColony';
import {MaximizeColonyTrack} from '../../src/server/deferredActions/MaximizeColonyTrack';
import {BuildColony} from '../../src/server/deferredActions/BuildColony';
import {Luna} from '../../src/server/colonies/Luna';
import {Ceres} from '../../src/server/colonies/Ceres';
import {Europa} from '../../src/server/colonies/Europa';
import {Io} from '../../src/server/colonies/Io';
import {Titan} from '../../src/server/colonies/Titan';
import {ReplaceColonyTile} from '../../src/server/deferredActions/ReplaceColonyTile';
import {COLONY_TILE_HAS_COLONIES_REASON, ColoniesHandler} from '../../src/server/colonies/ColoniesHandler';
import {quietResolutionOf, seatResolution} from '../parliament/parliamentArrange';
import {MartianCensus} from '../../src/server/cards/turmoilRedux/MartianCensus';
import {DiscardPopularSupport} from '../../src/server/parliament/DiscardPopularSupport';
import {REDUX_PARTIES} from '../../src/common/parliament/ParliamentTypes';
import {
  clearBatchTail,
  drainBatchTail,
  expireSupersededStagedTail,
  parkedBatchTailLength,
  parkedStagedPlacement,
  replayBatch,
} from '../../src/server/inputs/deferredInputBatch';

/**
 * A PRE-SELECTED CHOICE MUST NEVER COME BACK AS A LIVE PROMPT.
 *
 * The console play composer (and the desktop play modal) pre-collect a card's
 * on-play choice and submit it in ONE batch. The batch is replayed positionally,
 * but an effect the SAME play triggers can queue AHEAD of the card's own input:
 * every SCIENCE tag wakes Olympus Conference (`Priority.OLYMPUS_CONFERENCE`) and
 * Pharmacy Union (`Priority.PHARMACY_UNION`), both well ahead of the
 * `Priority.DEFAULT` the played card's own `bespokePlay` input sits at.
 *
 * The replay used to DROP everything after the first mismatch, so Astra
 * Mechanica's "return up to 2 events" — chosen inside the composer, on the real
 * cards — was thrown away and asked again as a standalone prompt a moment later.
 */
describe('deferredInputBatch', () => {
  /** Astra Mechanica's own on-play question — the one that must never re-appear. */
  const RETURN_EVENTS = 'Select up to 2 events to return to your hand';

  /** The action-menu OR index of "Play project card". */
  function playCardOptionIndex(player: TestPlayer): number {
    const menu = cast(player.getWaitingFor(), OrOptions);
    return menu.options.findIndex((o) => o.title === 'Play project card');
  }

  function playBatch(player: TestPlayer, card: IProjectCard, tail: ReadonlyArray<InputResponse>): Array<InputResponse> {
    return [
      {
        type: 'or',
        index: playCardOptionIndex(player),
        response: {type: 'projectCard', card: card.name, payment: Payment.of({megacredits: player.getCardCost(card)})},
      },
      ...tail,
    ];
  }

  /** Astra Mechanica + the two events its play offers to return. */
  function astraGame(interloper?: 'olympus' | 'pharmacyUnion') {
    const [game, player] = testGame(2);
    const astra = new AstraMechanica();
    const event1 = new BribedCommittee();
    const event2 = new SubterraneanReservoir();
    player.playedCards.push(event1, event2);
    if (interloper === 'olympus') {
      const olympus = new OlympusConference();
      // A stored science resource is what turns the trigger into a QUESTION —
      // with none it silently adds one and never reaches the player.
      olympus.resourceCount = 1;
      player.playedCards.push(olympus);
    }
    if (interloper === 'pharmacyUnion') {
      // NO disease stored is what turns its science trigger into a question
      // («turn this card face down and gain 3 TR, or do nothing») — and it
      // queues at `Priority.SUPERPOWER`, earlier still than Olympus.
      player.playedCards.push(new PharmacyUnion());
    }
    player.cardsInHand = [astra];
    player.megaCredits = 50;
    player.takeAction();
    return {game, player, astra, event1, event2};
  }

  it('lands the pre-collected choice when nothing jumps the queue', () => {
    const {player, astra, event1, event2} = astraGame();

    replayBatch(player, playBatch(player, astra, [{type: 'card', cards: [event1.name, event2.name]}]));

    expect(player.cardsInHand.map((c) => c.name)).to.have.members([event1.name, event2.name]);
    expect(parkedBatchTailLength(player)).eq(0);
  });

  const INTERLOPERS = [
    {kind: 'olympus', answer: 'Add a science resource to this card'},
    {kind: 'pharmacyUnion', answer: 'Do nothing'},
  ] as const;

  for (const interloper of INTERLOPERS) {
    it(`does NOT re-ask the pre-collected choice when ${interloper.kind} jumps the queue`, () => {
      const {player, astra, event1, event2} = astraGame(interloper.kind);

      replayBatch(player, playBatch(player, astra, [{type: 'card', cards: [event1.name, event2.name]}]));

      // The trigger's own question is in front — the card's choice is PARKED,
      // not discarded.
      const jumped = cast(player.getWaitingFor(), OrOptions);
      expect(jumped.title).is.not.eq(RETURN_EVENTS);
      expect(parkedBatchTailLength(player)).eq(1);
      expect(player.cardsInHand).is.empty;

      // The player answers the trigger (the branch that touches nothing else).
      // The choice they already made lands with it — no second prompt for
      // something they had already decided.
      player.process({type: 'or', index: jumped.options.findIndex((o) => o.title === interloper.answer), response: {type: 'option'}});
      drainBatchTail(player);

      expect(player.cardsInHand.map((c) => c.name)).to.have.members([event1.name, event2.name]);
      expect(parkedBatchTailLength(player)).eq(0);
      expect(player.getWaitingFor()?.title).is.not.eq(RETURN_EVENTS);
    });
  }

  it('does NOT re-ask the pre-collected plant target when the REDS TAX jumps the queue', () => {
    // The widest reach of this class: `Priority.COST` is the FIRST thing in the
    // ladder, so under Reds every card that raises a global parameter puts a
    // payment prompt in front of its own pre-collected step — 11 of the 12
    // reachable in-scope cards are asteroids/comets exactly like this one.
    const [game, player, opponent] = testGame(2, {turmoilExtension: true});
    setRulingParty(game, PartyName.REDS);
    player.megaCredits = 100;
    // Heat-as-M€ (Helion) is what makes the tax a QUESTION rather than a silent
    // deduction — see the payment class in docs/claude/action-prompt-audit.md.
    player.heat = 10;
    player.canUseHeatAsMegaCredits = true;
    opponent.plants = 8;
    const asteroid = new Asteroid();
    player.cardsInHand = [asteroid];
    player.takeAction();

    replayBatch(player, playBatch(player, asteroid, [{type: 'or', index: 0, response: {type: 'option'}}]));

    expect(player.getWaitingFor()?.type).eq('payment');
    expect(parkedBatchTailLength(player)).eq(1);
    expect(opponent.plants, 'the attack has not run yet').eq(8);

    player.process({type: 'payment', payment: Payment.of({megacredits: 3})});
    drainBatchTail(player);

    expect(opponent.plants, 'the target chosen in the play modal was used').eq(5);
    expect(parkedBatchTailLength(player)).eq(0);
  });

  it('DROPS a response the live prompt itself refuses (a genuine divergence, not a queue jump)', () => {
    const {player, astra, event1} = astraGame();

    // The same question is being asked, and the pre-collected answer names a
    // card that is not a candidate: the preview is stale, so the player has to
    // answer for real — holding this response would risk landing it on an
    // unrelated card prompt later in the action.
    replayBatch(player, playBatch(player, astra, [{type: 'card', cards: [CardName.ANTS]}]));

    cast(player.getWaitingFor(), SelectCard);
    expect(parkedBatchTailLength(player)).eq(0);
    expect(player.cardsInHand.map((c) => c.name)).to.not.include(event1.name);
  });

  it('expires the parked choice with the action it was collected for', () => {
    const {player, astra, event1, event2} = astraGame('olympus');

    replayBatch(player, playBatch(player, astra, [{type: 'card', cards: [event1.name, event2.name]}]));
    expect(parkedBatchTailLength(player)).eq(1);

    // `takeAction` runs once the deferred queue has drained — the action is
    // over, so an answer that never found its prompt must not survive into the
    // next one.
    clearBatchTail(player);
    expect(parkedBatchTailLength(player)).eq(0);
  });

  it('rethrows when the FIRST response fails — that is a real error, not a queue jump', () => {
    const {player} = astraGame();

    expect(() => replayBatch(player, [{type: 'card', cards: [CardName.ANTS]}])).to.throw();
    expect(parkedBatchTailLength(player)).eq(0);
  });

  /**
   * THE ADDRESSED STAGED CELL — the interleaved-placement bug class.
   *
   * A staged play picks the CELL before the batch submits, so the space
   * response is the batch's tail — and the first SelectSpace the server
   * surfaces is not always the card's own placement: `global.temperature`
   * executes SYNCHRONOUSLY at play time and a raise past 0°C defers a bonus
   * ocean at `PLACE_OCEAN_TILE`, strictly ahead of the card's DEFAULT-priority
   * tile. Untyped, the tail was either CONSUMED by the bonus ocean (an
   * ocean-placing card — same legal set) or DROPPED as a stale divergence (a
   * land tile — «Space not available» with matching types), and the player was
   * asked to place the SAME tile again («Ядерная зона» placed, vanished,
   * re-asked). The address (`stagedFor` = the server's own
   * `SelectSpace.sourceCard`) makes «not my prompt» structural.
   */
  describe('addressed staged cell', () => {
    it('lands immediately when nothing interposes (Nuclear Zone, no threshold)', () => {
      const [game, player] = testGame(2);
      const nz = new NuclearZone();
      player.cardsInHand = [nz];
      player.megaCredits = 50;
      player.takeAction();
      const pin = game.board.getAvailableSpacesOnLand(player)[0].id;

      replayBatch(player, playBatch(player, nz, [{type: 'space', spaceId: pin, stagedFor: nz.name}]));

      expect(game.board.getSpaceOrThrow(pin).tile?.tileType).eq(TileType.NUCLEAR_ZONE);
      expect(parkedBatchTailLength(player)).eq(0);
    });

    it('PARKS the cell past the 0°C bonus ocean and auto-lands it after (Nuclear Zone at −4°C)', () => {
      const [game, player] = testGame(2);
      setTemperature(game, -4);
      const nz = new NuclearZone();
      player.cardsInHand = [nz];
      player.megaCredits = 50;
      player.takeAction();
      const pin = game.board.getAvailableSpacesOnLand(player)[0].id;

      replayBatch(player, playBatch(player, nz, [{type: 'space', spaceId: pin, stagedFor: nz.name}]));

      // The temperature raise's bonus ocean is in front — and it is NOT ours.
      const ocean = cast(player.getWaitingFor(), SelectSpace);
      expect(ocean.sourceCard, 'the threshold ocean carries no sourceCard').is.undefined;
      expect(game.board.getSpaceOrThrow(pin).tile, 'nothing placed on the pin yet').is.undefined;
      expect(parkedBatchTailLength(player)).eq(1);
      expect(parkedStagedPlacement(player)).deep.eq({card: nz.name, spaceId: pin});

      // The player answers the ocean; the pinned Nuclear Zone lands with it —
      // no re-ask, upstream prompt order untouched.
      player.process({type: 'space', spaceId: ocean.spaces[0].id});
      drainBatchTail(player);

      expect(game.board.getSpaceOrThrow(pin).tile?.tileType).eq(TileType.NUCLEAR_ZONE);
      expect(parkedBatchTailLength(player)).eq(0);
      expect(parkedStagedPlacement(player)).is.undefined;
      const after = player.getWaitingFor();
      expect(after instanceof SelectSpace && after.sourceCard === nz.name, 'the placement is never re-asked').is.false;
      const zones = game.board.spaces.filter((s) => s.tile?.tileType === TileType.NUCLEAR_ZONE);
      expect(zones, 'exactly ONE tile — no double placement').has.length(1);
    });

    it('is NOT consumed by the bonus ocean even when the cell is legal for it (Comet)', () => {
      const [game, player, opponent] = testGame(2);
      setTemperature(game, -2);
      opponent.plants = 0; // keep removeAnyPlants silent
      const comet = new Comet();
      player.cardsInHand = [comet];
      player.megaCredits = 50;
      player.takeAction();
      const oceanSpaces = game.board.getAvailableSpacesForOcean(player);
      const pin = oceanSpaces[0].id;
      const other = oceanSpaces[1].id;

      replayBatch(player, playBatch(player, comet, [{type: 'space', spaceId: pin, stagedFor: comet.name}]));

      // The bonus ocean would ACCEPT the pinned cell — the address refuses it.
      const bonus = cast(player.getWaitingFor(), SelectSpace);
      expect(bonus.sourceCard).is.undefined;
      expect(game.board.getSpaceOrThrow(pin).tile, 'the pin was not eaten by the bonus prompt').is.undefined;
      expect(parkedBatchTailLength(player)).eq(1);

      player.process({type: 'space', spaceId: other});
      drainBatchTail(player);

      expect(game.board.getSpaceOrThrow(pin).tile?.tileType).eq(TileType.OCEAN);
      expect(game.board.getOceanSpaces()).has.length(2);
      expect(parkedBatchTailLength(player)).eq(0);
    });

    it('drops the cell honestly when the interloper OCCUPIES it (bonus ocean placed on the pin)', () => {
      const [game, player, opponent] = testGame(2);
      setTemperature(game, -2);
      opponent.plants = 0;
      const comet = new Comet();
      player.cardsInHand = [comet];
      player.megaCredits = 50;
      player.takeAction();
      const pin = game.board.getAvailableSpacesForOcean(player)[0].id;

      replayBatch(player, playBatch(player, comet, [{type: 'space', spaceId: pin, stagedFor: comet.name}]));
      expect(parkedBatchTailLength(player)).eq(1);

      // The player puts the BONUS ocean on the very cell they had pinned —
      // their own placement must now be re-asked live, not auto-guessed.
      player.process({type: 'space', spaceId: pin});
      drainBatchTail(player);

      expect(parkedBatchTailLength(player)).eq(0);
      const reAsk = cast(player.getWaitingFor(), SelectSpace);
      expect(reAsk.sourceCard).eq(comet.name);
    });

    it('a manual answer to its own prompt SUPERSEDES the parked cell (never lands on the next same-card prompt)', () => {
      const [game, player, opponent] = testGame(2);
      setTemperature(game, -2);
      opponent.plants = 0;
      const gia = new GiantIceAsteroid();
      player.cardsInHand = [gia];
      player.megaCredits = 50;
      player.takeAction();
      const oceanSpaces = game.board.getAvailableSpacesForOcean(player);
      const pin = oceanSpaces[0].id;

      replayBatch(player, playBatch(player, gia, [{type: 'space', spaceId: pin, stagedFor: gia.name}]));
      expect(parkedBatchTailLength(player)).eq(1);

      // The queue advances OUTSIDE our route (an opponent's request): the
      // bonus ocean is answered with no drain, so the card's own first ocean
      // surfaces LIVE with the tail still parked.
      const bonus = cast(player.getWaitingFor(), SelectSpace);
      expect(bonus.sourceCard).is.undefined;
      player.process({type: 'space', spaceId: oceanSpaces[1].id});
      const own1 = cast(player.getWaitingFor(), SelectSpace);
      expect(own1.sourceCard).eq(gia.name);

      // The single-input route's order: expire → process → drain. The manual
      // answer supersedes the pin; ocean #2 is asked live, never auto-filled.
      expireSupersededStagedTail(player);
      player.process({type: 'space', spaceId: own1.spaces.find((s) => s.id !== pin)!.id});
      drainBatchTail(player);

      expect(parkedBatchTailLength(player)).eq(0);
      const own2 = cast(player.getWaitingFor(), SelectSpace);
      expect(own2.sourceCard).eq(gia.name);
      expect(game.board.getSpaceOrThrow(pin).tile, 'the superseded pin never landed anywhere').is.undefined;
    });

    it('a HAZARD cell chosen at staging places in ONE replay — the standing hazard is not staleness', () => {
      // The shipped regression this pins: «размещение поверх опасной зоны
      // получилось только со второго раза». The hazard stood on the cell WHEN
      // THE PLAYER PICKED IT — the dossier priced the cleanup — so a tile on
      // the pin is only staleness when it APPEARED during the parked window,
      // never when it was the very thing the player chose to pay for.
      const [game, player] = testGame(2, {aresExtension: true, aresHazards: false});
      const nz = new NuclearZone();
      player.cardsInHand = [nz];
      player.megaCredits = 50;
      const pin = game.board.getAvailableSpacesOnLand(player)[0];
      AresHazards.putHazardAt(game, pin, TileType.DUST_STORM_MILD);
      player.takeAction();
      const before = player.megaCredits;

      replayBatch(player, playBatch(player, nz, [{type: 'space', spaceId: pin.id, stagedFor: nz.name}]));

      expect(game.board.getSpaceOrThrow(pin.id).tile?.tileType,
        'the tile lands over the hazard on the FIRST confirm').eq(TileType.NUCLEAR_ZONE);
      expect(parkedBatchTailLength(player)).eq(0);
      expect(player.megaCredits, 'card cost + the 8 M€ hazard cleanup the player saw in the dossier')
        .eq(before - player.getCardCost(nz) - 8);
    });

    it('a hazard standing at staging survives the PARK too (interposer answered → auto-lands over it)', () => {
      const [game, player] = testGame(2, {aresExtension: true, aresHazards: false});
      setTemperature(game, -4);
      const nz = new NuclearZone();
      player.cardsInHand = [nz];
      player.megaCredits = 50;
      const pin = game.board.getAvailableSpacesOnLand(player)[0];
      AresHazards.putHazardAt(game, pin, TileType.DUST_STORM_MILD);
      player.takeAction();

      replayBatch(player, playBatch(player, nz, [{type: 'space', spaceId: pin.id, stagedFor: nz.name}]));

      // Parked behind the 0°C bonus ocean, hazard still standing.
      const ocean = cast(player.getWaitingFor(), SelectSpace);
      expect(ocean.sourceCard).is.undefined;
      expect(parkedBatchTailLength(player)).eq(1);

      player.process({type: 'space', spaceId: ocean.spaces[0].id});
      drainBatchTail(player);

      expect(game.board.getSpaceOrThrow(pin.id).tile?.tileType,
        'the pin auto-lands over the hazard the player chose to clear').eq(TileType.NUCLEAR_ZONE);
      expect(parkedBatchTailLength(player)).eq(0);
    });

    it('a hazard that APPEARS on the pin during the park drops it — the toll was never seen', () => {
      const [game, player] = testGame(2, {aresExtension: true, aresHazards: false});
      setTemperature(game, -4);
      const nz = new NuclearZone();
      player.cardsInHand = [nz];
      player.megaCredits = 50;
      const pin = game.board.getAvailableSpacesOnLand(player)[0];
      player.takeAction();

      replayBatch(player, playBatch(player, nz, [{type: 'space', spaceId: pin.id, stagedFor: nz.name}]));
      const ocean = cast(player.getWaitingFor(), SelectSpace);
      expect(parkedBatchTailLength(player)).eq(1);

      // The world moves while the interloper stands: an erosion spawns on the
      // very cell the player pinned — a cost they never saw.
      AresHazards.putHazardAt(game, game.board.getSpaceOrThrow(pin.id), TileType.EROSION_MILD);

      player.process({type: 'space', spaceId: ocean.spaces[0].id});
      drainBatchTail(player);

      expect(parkedBatchTailLength(player)).eq(0);
      expect(game.board.getSpaceOrThrow(pin.id).tile?.tileType,
        'the pin must NOT auto-place over a hazard the player never saw').eq(TileType.EROSION_MILD);
      const reAsk = cast(player.getWaitingFor(), SelectSpace);
      expect(reAsk.sourceCard, 'the placement is re-asked live, with the hazard visible').eq(nz.name);
    });

    it('an ACTION-deferred ocean carries its sourceCard (the address has a prompt to match)', () => {
      const [game, player] = testGame(2);
      const aquifer = new AquiferPumping();
      player.playedCards.push(aquifer);
      player.megaCredits = 20;
      aquifer.action(player);
      // The payment auto-resolves (plain M€, no alternates) and the ocean
      // prompt surfaces in the same drain.
      runAllActions(game);
      const prompt = cast(player.getWaitingFor(), SelectSpace);
      expect(prompt.sourceCard).eq(aquifer.name);
    });
  });

  /**
   * THE ADDRESSED STAGED RESOLUTION — the cell's law, generalized to `party`.
   *
   * A card that places a delegate by being PLAYED (Turmoil Redux TR03) has its
   * resolution picked before the play batch is submitted, so the party answer
   * is the batch's tail. The type alone cannot tell whose question a
   * `SelectParty` is: the chairman's seat is one too, and «Greens» answered
   * there would choose which resolution GIVES UP a delegate. The address
   * (`stagedFor`) matches only a GRANT whose `choiceContext.source.card` is
   * that card; everything else parks the tail untried.
   */
  describe('addressed staged resolution (party)', () => {
    const G = PartyName.GREENS;
    const M = PartyName.MARS;
    const I = PartyName.INDUSTRIALISTS;

    type Staged = {game: IGame, player: TestPlayer, parliament: Parliament, card: IProjectCard, seatAnswers: Array<PartyName>};

    /**
     * A Redux table (the Greens' · Mars First's · the Industrialists' quiet
     * resolutions) and a card in hand whose play defers the shared delegate
     * step — behind `before`, a prompt the same play raises AHEAD of it.
     */
    function stagedGame(before?: (player: IPlayer, state: Staged) => void): Staged {
      const [game, player] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
      game.phase = Phase.ACTION;
      const parliament = game.parliament!;
      ([G, M, I] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
      const state = {game, player, parliament, seatAnswers: []} as unknown as Staged;
      const card = fakeCard({
        name: 'A card that adds a delegate' as CardName,
        cost: 4,
        play: (p: IPlayer) => {
          before?.(p, state);
          p.game.defer(new PlaceDelegatesOnResolution(p, 1, {kind: 'card', card: card.name}, {support: 3}));
          return undefined;
        },
      });
      state.card = card;
      player.cardsInHand = [card];
      player.megaCredits = 50;
      player.takeAction();
      return state;
    }

    function tailOf(state: Staged, party: PartyName): InputResponse {
      return {type: 'party', partyName: party, stagedFor: state.card.name};
    }

    function votes(state: Staged, party: PartyName): number {
      return state.parliament.votesOf(state.player, state.parliament.slotOf(party as never)!);
    }

    /** A two-way choice the play raises first (any `or` a triggered effect would ask). */
    function interposeChoice(onAnswer?: (state: Staged) => void) {
      return (p: IPlayer, state: Staged) => {
        p.defer(() => new OrOptions(
          new SelectOption('one').andThen(() => {
            onAnswer?.(state);
            return undefined;
          }),
          new SelectOption('two'),
        ), Priority.COST);
      };
    }

    /** The chairman's seat — a `SelectParty` that is NOT a grant — raised ahead of the card's own question. */
    function interposeSeat(p: IPlayer, state: Staged) {
      p.defer(() => new SelectParty('Choose which of your resolutions gives up a delegate for the chairman seat', 'Take', [G, M, I])
        .markVotePrompt({source: 'chairman-seat', cost: 0})
        .andThen((party) => {
          state.seatAnswers.push(party);
          return undefined;
        }), Priority.COST);
    }

    it('lands at once when nothing interposes: the delegate, then the party\'s support', () => {
      const state = stagedGame();
      replayBatch(state.player, playBatch(state.player, state.card, [tailOf(state, M)]));
      expect(votes(state, M)).eq(1);
      expect(state.parliament.popularSupportOf(M)).eq(3);
      expect(parkedBatchTailLength(state.player)).eq(0);
      expect(state.player.getWaitingFor() instanceof SelectParty, 'the resolution is never asked again').is.false;
    });

    it('PARKS behind a prompt that jumped the queue and auto-lands once it is answered', () => {
      const state = stagedGame(interposeChoice());
      replayBatch(state.player, playBatch(state.player, state.card, [tailOf(state, M)]));
      cast(state.player.getWaitingFor(), OrOptions);
      expect(parkedBatchTailLength(state.player), 'parked, untried').eq(1);
      expect(votes(state, M)).eq(0);
      expect(parkedStagedPlacement(state.player), 'a staged resolution is not a staged CELL').is.undefined;

      state.player.process({type: 'or', index: 0, response: {type: 'option'}});
      drainBatchTail(state.player);

      expect(votes(state, M)).eq(1);
      expect(state.parliament.popularSupportOf(M)).eq(3);
      expect(parkedBatchTailLength(state.player)).eq(0);
      expect(state.player.getWaitingFor() instanceof SelectParty).is.false;
    });

    it('the CHAIRMAN\'S SEAT in front of the card\'s own question does NOT eat the tail', () => {
      const state = stagedGame(interposeSeat);
      replayBatch(state.player, playBatch(state.player, state.card, [tailOf(state, M)]));
      const seat = cast(state.player.getWaitingFor(), SelectParty);
      expect(seat.votePrompt?.source).eq('chairman-seat');
      expect(state.seatAnswers, 'the seat was not answered by the staged resolution').deep.eq([]);
      expect(parkedBatchTailLength(state.player)).eq(1);

      // A drain while the seat stands leaves the tail parked, untried.
      drainBatchTail(state.player);
      expect(state.seatAnswers).deep.eq([]);
      expect(parkedBatchTailLength(state.player)).eq(1);

      // The player answers the seat for real; the resolution then lands on its own prompt.
      state.player.process({type: 'party', partyName: G});
      drainBatchTail(state.player);
      expect(state.seatAnswers).deep.eq([G]);
      expect(votes(state, M)).eq(1);
      expect(votes(state, G), 'the seat\'s answer placed nothing').eq(0);
      expect(parkedBatchTailLength(state.player)).eq(0);
    });

    it('a COLONY\'s grant is another giver\'s question: the tail parks past it', () => {
      const state = stagedGame((p) => {
        p.game.defer(new PlaceDelegatesOnResolution(p, 1, colonySource(ColonyName.VENUS_REDUX)), Priority.COST);
      });
      replayBatch(state.player, playBatch(state.player, state.card, [tailOf(state, M)]));
      const grant = cast(state.player.getWaitingFor(), SelectParty);
      expect(grant.choiceContext?.source.kind).eq('colony');
      expect(parkedBatchTailLength(state.player)).eq(1);
      expect(votes(state, M)).eq(0);

      state.player.process({type: 'party', partyName: I});
      drainBatchTail(state.player);
      expect(votes(state, I), 'the colony\'s delegate went where the player sent it').eq(1);
      expect(votes(state, M), 'the card\'s delegate where it was staged').eq(1);
      expect(state.parliament.popularSupportOf(M)).eq(3);
      expect(state.parliament.popularSupportOf(I), 'a colony\'s grant pays no support').eq(0);
    });

    it('the party LEFT the voting area while parked: the tail is dropped and the question stands live', () => {
      const state = stagedGame(interposeChoice((s) => {
        s.parliament.slots = s.parliament.slots.filter((slot) => s.parliament.resolutionOf(slot.instance).party !== M);
      }));
      replayBatch(state.player, playBatch(state.player, state.card, [tailOf(state, M)]));
      expect(parkedBatchTailLength(state.player)).eq(1);

      state.player.process({type: 'or', index: 0, response: {type: 'option'}});
      drainBatchTail(state.player);

      expect(parkedBatchTailLength(state.player), 'stale — dropped, never held for a later prompt').eq(0);
      const live = cast(state.player.getWaitingFor(), SelectParty);
      expect(live.votePrompt?.source).eq('grant');
      expect(live.choiceContext?.source.card).eq(state.card.name);
      expect(live.parties).deep.eq([G, I]);
      expect(state.parliament.votesOf(state.player), 'nothing was placed by the stale pick').eq(0);
    });

    it('a manual answer to its own prompt SUPERSEDES the parked resolution', () => {
      const state = stagedGame(interposeChoice());
      replayBatch(state.player, playBatch(state.player, state.card, [tailOf(state, M)]));
      expect(parkedBatchTailLength(state.player)).eq(1);

      // The queue advances OUTSIDE our drain window (an opponent's request):
      // the card's own question surfaces live and the player answers it by hand.
      state.player.process({type: 'or', index: 0, response: {type: 'option'}});
      const live = cast(state.player.getWaitingFor(), SelectParty);
      expect(live.choiceContext?.source.card).eq(state.card.name);
      expireSupersededStagedTail(state.player);
      expect(parkedBatchTailLength(state.player)).eq(0);
      state.player.process({type: 'party', partyName: G});
      drainBatchTail(state.player);
      expect(votes(state, G)).eq(1);
      expect(votes(state, M), 'the superseded pick never lands').eq(0);
    });

    it('expires with the action it was collected for', () => {
      const state = stagedGame(interposeChoice());
      replayBatch(state.player, playBatch(state.player, state.card, [tailOf(state, M)]));
      expect(parkedBatchTailLength(state.player)).eq(1);
      clearBatchTail(state.player);
      expect(parkedBatchTailLength(state.player)).eq(0);
    });

    it('an UNADDRESSED party answer replays positionally, exactly as before', () => {
      // …onto the grant it was (positionally) meant for:
      const direct = stagedGame();
      replayBatch(direct.player, playBatch(direct.player, direct.card, [{type: 'party', partyName: M}]));
      expect(votes(direct, M)).eq(1);
      // …and onto whatever `SelectParty` stands first — which is WHY a staged door must address its tail.
      const seat = stagedGame(interposeSeat);
      replayBatch(seat.player, playBatch(seat.player, seat.card, [{type: 'party', partyName: M}]));
      expect(seat.seatAnswers, 'the positional answer went to the seat').deep.eq([M]);
      expect(parkedBatchTailLength(seat.player)).eq(0);
    });

    /*
     * …AND THE HEAD MAY BE A CARD'S ACTION (Turmoil Redux TR15 Martian Census: «spend 3 data from here to
     * add a delegate to a resolution»). The console stages the vote from «Действия карт» exactly as from the
     * hand: the batch is `[perform the card's action, its branch B, {party, stagedFor}]`, and the address is
     * the same — the grant whose giver is the card.
     */
    describe('…with an ACTION head (a blue card\'s staged vote)', () => {
      /** Martian Census on the table with 3 data, its action unused; `interpose` raises the seat in the grant's drain. */
      function actionGame(interpose?: (p: IPlayer, state: Staged) => void): Staged & {census: MartianCensus} {
        const [game, player] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
        game.phase = Phase.ACTION;
        const parliament = game.parliament!;
        ([G, M, I] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
        const census = new MartianCensus();
        census.resourceCount = 3;
        player.playedCards.push(census);
        const state = {game, player, parliament, card: census, census, seatAnswers: []} as unknown as Staged & {census: MartianCensus};
        if (interpose !== undefined) {
          // The seat is raised in the SAME drain as the card's grant, ahead of it (the shape a triggered
          // chairman seat would take) — the grant's own deferral is the hook.
          const defer = game.defer.bind(game);
          game.defer = ((action: Parameters<IGame['defer']>[0], priority?: Priority) => {
            if (action instanceof PlaceDelegatesOnResolution) {
              interpose(player, state);
            }
            return defer(action, priority);
          }) as IGame['defer'];
        }
        player.takeAction();
        return state;
      }

      function actionBatch(state: Staged & {census: MartianCensus}, tail: ReadonlyArray<InputResponse>): Array<InputResponse> {
        const menu = cast(state.player.getWaitingFor(), OrOptions);
        const perform = menu.options.findIndex((o) => o.title === 'Perform an action from a played card');
        expect(perform, 'the action menu offers the card action').gte(0);
        return [
          {type: 'or', index: perform, response: {type: 'card', cards: [CardName.MARTIAN_CENSUS]}},
          // Branch B — «spend 3 data → a delegate» — the second option of the card's OrOptions.
          {type: 'or', index: 1, response: {type: 'option'}},
          ...tail,
        ];
      }

      it('lands at once: the data leave, the delegate lands on the staged resolution, nothing is asked again', () => {
        const state = actionGame();
        replayBatch(state.player, actionBatch(state, [tailOf(state, M)]));
        expect(votes(state, M)).eq(1);
        expect(state.census.resourceCount).eq(0);
        expect(state.parliament.popularSupportOf(M), 'the census pays no support').eq(0);
        expect(state.player.actionsThisGeneration.has(CardName.MARTIAN_CENSUS)).is.true;
        expect(parkedBatchTailLength(state.player)).eq(0);
        expect(state.player.getWaitingFor() instanceof SelectParty, 'the resolution is never asked again').is.false;
      });

      it('the CHAIRMAN\'S SEAT in front of the action\'s grant does NOT eat the tail — it parks, then lands', () => {
        const state = actionGame(interposeSeat);
        replayBatch(state.player, actionBatch(state, [tailOf(state, M)]));
        const seat = cast(state.player.getWaitingFor(), SelectParty);
        expect(seat.votePrompt?.source).eq('chairman-seat');
        expect(state.seatAnswers).deep.eq([]);
        expect(parkedBatchTailLength(state.player)).eq(1);
        expect(state.census.resourceCount, 'nothing paid while the tail is parked').eq(3);

        state.player.process({type: 'party', partyName: G});
        drainBatchTail(state.player);
        expect(state.seatAnswers).deep.eq([G]);
        expect(votes(state, M)).eq(1);
        expect(votes(state, G), 'the seat\'s answer placed nothing').eq(0);
        expect(state.census.resourceCount).eq(0);
        expect(parkedBatchTailLength(state.player)).eq(0);
      });
    });

    /*
     * …AND THE PARTY MAY BE A POPULAR SUPPORT AREA (Turmoil Redux TR12 Party Sanctions: «discard all neutral
     * delegates from ONE Popular Support Area of your choice»). The same addressed tail — the card's own party
     * question is now the AREA pick (`supportPrompt`, `DiscardPopularSupport`) — and the same refusals: the
     * chairman's seat in front of it parks the tail, never answers it.
     */
    describe('…a POPULAR SUPPORT AREA (a card that strips one)', () => {
      type Sanction = Staged & {walked: number};

      function sanctionGame(interpose?: (p: IPlayer, state: Staged) => void): Sanction {
        const [game, player] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
        game.phase = Phase.ACTION;
        const parliament = game.parliament!;
        ([G, M, I] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
        for (const party of REDUX_PARTIES) {
          parliament.popularSupport.set(party, 0);
        }
        parliament.popularSupport.set(M, 3);
        parliament.popularSupport.set(G, 1);
        const state = {game, player, parliament, seatAnswers: [], walked: 0} as unknown as Sanction;
        const card = fakeCard({
          name: 'A card that strips an area' as CardName,
          cost: 2,
          play: (p: IPlayer) => {
            interpose?.(p, state);
            p.game.defer(new DiscardPopularSupport(p, {kind: 'card', card: card.name}, () => {
              state.walked++;
            }));
            return undefined;
          },
        });
        state.card = card;
        player.cardsInHand = [card];
        player.megaCredits = 50;
        player.takeAction();
        return state;
      }

      it('lands at once: the area empties, the continuation runs, nothing is asked again', () => {
        const state = sanctionGame();
        const supply = state.parliament.neutralSupply();
        replayBatch(state.player, playBatch(state.player, state.card, [tailOf(state, M)]));
        expect(state.parliament.popularSupportOf(M)).eq(0);
        expect(state.parliament.popularSupportOf(G)).eq(1);
        expect(state.parliament.neutralSupply()).eq(supply + 3);
        expect(state.walked, 'the card\'s next effect ran inside the same answer').eq(1);
        expect(parkedBatchTailLength(state.player)).eq(0);
        expect(state.player.getWaitingFor() instanceof SelectParty, 'the area is never asked again').is.false;
      });

      it('the CHAIRMAN\'S SEAT in front of the area pick does NOT eat the tail — it parks, then lands', () => {
        const state = sanctionGame(interposeSeat);
        replayBatch(state.player, playBatch(state.player, state.card, [tailOf(state, M)]));
        const seat = cast(state.player.getWaitingFor(), SelectParty);
        expect(seat.votePrompt?.source).eq('chairman-seat');
        expect(state.seatAnswers).deep.eq([]);
        expect(parkedBatchTailLength(state.player)).eq(1);
        expect(state.parliament.popularSupportOf(M), 'nothing discarded while the tail is parked').eq(3);

        state.player.process({type: 'party', partyName: G});
        drainBatchTail(state.player);
        expect(state.seatAnswers).deep.eq([G]);
        expect(state.parliament.popularSupportOf(M)).eq(0);
        expect(state.parliament.popularSupportOf(G), 'the seat\'s answer discarded nothing').eq(1);
        expect(state.walked).eq(1);
        expect(parkedBatchTailLength(state.player)).eq(0);
      });

      it('ANOTHER card\'s area pick is another giver\'s question: the tail parks past it', () => {
        const state = sanctionGame((p) => {
          p.game.defer(new DiscardPopularSupport(p, {kind: 'card', card: CardName.ANTS}), Priority.COST);
        });
        replayBatch(state.player, playBatch(state.player, state.card, [tailOf(state, M)]));
        const other = cast(state.player.getWaitingFor(), SelectParty);
        expect(other.choiceContext?.source.card).eq(CardName.ANTS);
        expect(parkedBatchTailLength(state.player)).eq(1);
        expect(state.parliament.popularSupportOf(M)).eq(3);

        state.player.process({type: 'party', partyName: G});
        drainBatchTail(state.player);
        expect(state.parliament.popularSupportOf(G), 'the other pick went where the player sent it').eq(0);
        expect(state.parliament.popularSupportOf(M), 'the staged pick where it was staged').eq(0);
        expect(parkedBatchTailLength(state.player)).eq(0);
      });
    });

    it('the wire validator accepts both forms and nothing else', () => {
      expect(isSelectPartyResponse({type: 'party', partyName: M})).is.true;
      expect(isSelectPartyResponse({type: 'party', partyName: M, stagedFor: CardName.ANTS})).is.true;
      expect(isSelectPartyResponse({type: 'party', partyName: M, extra: 1} as unknown as InputResponse)).is.false;
      expect(isSelectPartyResponse({type: 'party', stagedFor: CardName.ANTS} as unknown as InputResponse)).is.false;
    });
  });

  describe('addressed staged colony', () => {
    type Staged = {game: IGame, player: TestPlayer, card: IProjectCard, luna: Luna, ceres: Ceres, europa: Europa};

    /**
     * A colonies table (Luna at 2, Ceres at 3, Europa at 1) and a card in hand
     * whose play defers the shared «move the chosen tile's marker to its top»
     * step — behind `before`, a prompt the same play raises AHEAD of it.
     */
    function stagedGame(before?: (player: IPlayer, state: Staged) => void): Staged {
      const [game, player] = testGame(2, {coloniesExtension: true});
      const luna = new Luna();
      const ceres = new Ceres();
      const europa = new Europa();
      game.colonies = [luna, ceres, europa];
      luna.trackPosition = 2;
      ceres.trackPosition = 3;
      europa.trackPosition = 1;
      const state = {game, player, luna, ceres, europa} as unknown as Staged;
      const card = fakeCard({
        name: 'A card that sets a colony track' as CardName,
        cost: 5,
        play: (p: IPlayer) => {
          before?.(p, state);
          p.game.defer(new MaximizeColonyTrack(p, {kind: 'card', card: card.name}));
          return undefined;
        },
      });
      state.card = card;
      player.cardsInHand = [card];
      player.megaCredits = 50;
      player.takeAction();
      return state;
    }

    function tailOf(state: Staged, colony: ColonyName): InputResponse {
      return {type: 'colony', colonyName: colony, stagedFor: state.card.name};
    }

    /** Another giver's colony question — a BUILD — raised by the same play ahead of the card's own. */
    function interposeBuild(p: IPlayer) {
      p.game.defer(new BuildColony(p), Priority.COST);
    }

    /** A two-way choice the play raises first (any `or` a triggered effect would ask). */
    function interposeChoice(onAnswer?: (state: Staged) => void) {
      return (p: IPlayer, state: Staged) => {
        p.defer(() => new OrOptions(
          new SelectOption('one').andThen(() => {
            onAnswer?.(state);
            return undefined;
          }),
          new SelectOption('two'),
        ), Priority.COST);
      };
    }

    it('lands at once when nothing interposes: the marker stands at the top', () => {
      const state = stagedGame();
      replayBatch(state.player, playBatch(state.player, state.card, [tailOf(state, ColonyName.LUNA)]));
      expect(state.luna.trackPosition).eq(6);
      expect(parkedBatchTailLength(state.player)).eq(0);
      expect(state.player.getWaitingFor() instanceof SelectColony, 'the tile is never asked again').is.false;
    });

    it('a BUILD in front of the card\'s own question does NOT eat the tail — it parks untried and lands after', () => {
      const state = stagedGame(interposeBuild);
      replayBatch(state.player, playBatch(state.player, state.card, [tailOf(state, ColonyName.LUNA)]));
      const build = cast(state.player.getWaitingFor(), SelectColony);
      expect(build.choiceContext?.source.card, 'the build names no card of ours').is.undefined;
      expect(state.luna.colonies, 'no colony was built by the staged answer').deep.eq([]);
      expect(state.luna.trackPosition).eq(2);
      expect(parkedBatchTailLength(state.player)).eq(1);

      // A drain while the build stands leaves the tail parked, untried.
      drainBatchTail(state.player);
      expect(state.luna.colonies).deep.eq([]);
      expect(parkedBatchTailLength(state.player)).eq(1);

      // The player answers the build for real (Ceres); the tile then lands on its own prompt.
      state.player.process({type: 'colony', colonyName: ColonyName.CERES});
      drainBatchTail(state.player);
      expect(state.ceres.colonies).deep.eq([state.player.id]);
      expect(state.luna.trackPosition, 'the staged tile went to its top').eq(6);
      expect(state.ceres.trackPosition, 'the build moved its own track only by the build rule').eq(3);
      expect(parkedBatchTailLength(state.player)).eq(0);
      expect(state.player.getWaitingFor() instanceof SelectColony).is.false;
    });

    it('PARKS behind a prompt of another type and auto-lands once it is answered', () => {
      const state = stagedGame(interposeChoice());
      replayBatch(state.player, playBatch(state.player, state.card, [tailOf(state, ColonyName.EUROPA)]));
      cast(state.player.getWaitingFor(), OrOptions);
      expect(parkedBatchTailLength(state.player)).eq(1);
      expect(parkedStagedPlacement(state.player), 'a staged colony is not a staged CELL').is.undefined;
      state.player.process({type: 'or', index: 0, response: {type: 'option'}});
      drainBatchTail(state.player);
      expect(state.europa.trackPosition).eq(6);
      expect(parkedBatchTailLength(state.player)).eq(0);
    });

    it('the track MOVED while parked but the tile is still a candidate — it lands, the steps re-read at the answer', () => {
      const state = stagedGame(interposeChoice((s) => {
        s.luna.trackPosition = 4;
      }));
      replayBatch(state.player, playBatch(state.player, state.card, [tailOf(state, ColonyName.LUNA)]));
      state.player.process({type: 'or', index: 0, response: {type: 'option'}});
      drainBatchTail(state.player);
      expect(state.luna.trackPosition).eq(6);
      const moved = state.game.events.events.filter((e) => e.type === 'colony-track-moved');
      expect(moved.map((e) => e.impact.colonyTrackMove)).deep.eq([{colony: ColonyName.LUNA, before: 4, after: 6}]);
    });

    it('the tile REACHED its top while parked: the tail is dropped and the question stands live — never a fall', () => {
      const state = stagedGame(interposeChoice((s) => {
        s.luna.trackPosition = 6;
      }));
      replayBatch(state.player, playBatch(state.player, state.card, [tailOf(state, ColonyName.LUNA)]));
      state.player.process({type: 'or', index: 0, response: {type: 'option'}});
      drainBatchTail(state.player);
      expect(parkedBatchTailLength(state.player), 'stale — dropped, never held for a later prompt').eq(0);
      const live = cast(state.player.getWaitingFor(), SelectColony);
      expect(live.choiceContext?.source.card).eq(state.card.name);
      expect(live.colonies.map((c) => c.name)).deep.eq([ColonyName.CERES, ColonyName.EUROPA]);
    });

    it('a manual answer to its own prompt SUPERSEDES the parked tile', () => {
      const state = stagedGame(interposeChoice());
      replayBatch(state.player, playBatch(state.player, state.card, [tailOf(state, ColonyName.LUNA)]));
      state.player.process({type: 'or', index: 0, response: {type: 'option'}});
      const live = cast(state.player.getWaitingFor(), SelectColony);
      expect(live.choiceContext?.source.card).eq(state.card.name);
      expireSupersededStagedTail(state.player);
      expect(parkedBatchTailLength(state.player)).eq(0);
      state.player.process({type: 'colony', colonyName: ColonyName.CERES});
      drainBatchTail(state.player);
      expect(state.ceres.trackPosition).eq(6);
      expect(state.luna.trackPosition, 'the superseded pick never lands').eq(2);
    });

    it('expires with the action it was collected for', () => {
      const state = stagedGame(interposeChoice());
      replayBatch(state.player, playBatch(state.player, state.card, [tailOf(state, ColonyName.LUNA)]));
      expect(parkedBatchTailLength(state.player)).eq(1);
      clearBatchTail(state.player);
      expect(parkedBatchTailLength(state.player)).eq(0);
    });

    it('an UNADDRESSED colony answer replays positionally, exactly as before', () => {
      // …onto the pick it was (positionally) meant for:
      const direct = stagedGame();
      replayBatch(direct.player, playBatch(direct.player, direct.card, [{type: 'colony', colonyName: ColonyName.LUNA}]));
      expect(direct.luna.trackPosition).eq(6);
      // …and onto whatever `SelectColony` stands first — which is WHY a staged door must address its tail.
      const build = stagedGame(interposeBuild);
      replayBatch(build.player, playBatch(build.player, build.card, [{type: 'colony', colonyName: ColonyName.LUNA}]));
      expect(build.luna.colonies, 'the positional answer BUILT a colony').deep.eq([build.player.id]);
    });

    /*
     * THE REPLACEMENT (Turmoil Redux TR10 Fringe Colony) — the fourth form of
     * the colony answer rides the SAME addressed branch: `{colonyName,
     * replaces, stagedFor}` lands only on the card's own `replace` prompt.
     */
    describe('the replacement — {colonyName, replaces, stagedFor}', () => {
      type Swap = {game: IGame, player: TestPlayer, other: TestPlayer, card: IProjectCard, luna: Luna, ceres: Ceres, europa: Europa, io: Io};

      /** In play: Luna, Ceres, Europa (all empty). The reserve: Io. A card whose play defers the shared replacement step. */
      function swapGame(before?: (player: IPlayer, state: Swap) => void): Swap {
        const [game, player, other] = testGame(2, {coloniesExtension: true});
        const luna = new Luna();
        const ceres = new Ceres();
        const europa = new Europa();
        const io = new Io();
        game.colonies = [luna, ceres, europa];
        game.discardedColonies = [io];
        const state = {game, player, other, luna, ceres, europa, io} as unknown as Swap;
        const card = fakeCard({
          name: 'A card that replaces a colony tile' as CardName,
          cost: 5,
          play: (p: IPlayer) => {
            before?.(p, state);
            p.game.defer(new ReplaceColonyTile(p, {kind: 'card', card: card.name}, {build: true}));
            return undefined;
          },
        });
        state.card = card;
        player.cardsInHand = [card];
        player.megaCredits = 50;
        player.takeAction();
        return state;
      }

      function swapTail(state: Swap, replaces: ColonyName): InputResponse {
        return {type: 'colony', colonyName: ColonyName.IO, replaces, stagedFor: state.card.name};
      }

      function names(state: Swap): Array<ColonyName> {
        return state.game.colonies.map((c) => c.name);
      }

      it('lands at once when nothing interposes: the tile is swapped in place and the colony built — never asked again', () => {
        const state = swapGame();
        replayBatch(state.player, playBatch(state.player, state.card, [swapTail(state, ColonyName.CERES)]));
        expect(names(state)).deep.eq([ColonyName.LUNA, ColonyName.IO, ColonyName.EUROPA]);
        expect(state.io.colonies).deep.eq([state.player.id]);
        expect(parkedBatchTailLength(state.player)).eq(0);
        expect(state.player.getWaitingFor() instanceof SelectColony).is.false;
      });

      it('a BUILD in front of the card\'s own question does NOT eat the tail — it parks untried and lands after', () => {
        const state = swapGame(interposeBuild);
        replayBatch(state.player, playBatch(state.player, state.card, [swapTail(state, ColonyName.CERES)]));
        const build = cast(state.player.getWaitingFor(), SelectColony);
        expect(build.rosterChange, 'another giver\'s colony question').is.undefined;
        expect(names(state), 'nothing was replaced by the staged answer').deep.eq([ColonyName.LUNA, ColonyName.CERES, ColonyName.EUROPA]);
        expect(parkedBatchTailLength(state.player)).eq(1);

        // The player builds on Luna for real; the card's own question is then asked and the tail lands on it.
        state.player.process({type: 'colony', colonyName: ColonyName.LUNA});
        drainBatchTail(state.player);
        expect(state.luna.colonies).deep.eq([state.player.id]);
        expect(names(state)).deep.eq([ColonyName.LUNA, ColonyName.IO, ColonyName.EUROPA]);
        expect(parkedBatchTailLength(state.player)).eq(0);
        expect(state.player.getWaitingFor() instanceof SelectColony).is.false;
      });

      it('the outgoing tile was TAKEN while parked: the tail is dropped and the question stands live with its reason — never a fall', () => {
        const state = swapGame(interposeBuild);
        replayBatch(state.player, playBatch(state.player, state.card, [swapTail(state, ColonyName.CERES)]));
        // The interposed build lands on the very tile the staged answer wanted to remove.
        state.player.process({type: 'colony', colonyName: ColonyName.CERES});
        drainBatchTail(state.player);
        expect(parkedBatchTailLength(state.player), 'stale — dropped, never held for a later prompt').eq(0);
        const live = cast(state.player.getWaitingFor(), SelectColony);
        expect(live.choiceContext?.source.card).eq(state.card.name);
        expect(live.rosterChange?.outgoing?.find((tile) => tile.colony === ColonyName.CERES)?.reason).eq(COLONY_TILE_HAS_COLONIES_REASON);
        expect(names(state)).deep.eq([ColonyName.LUNA, ColonyName.CERES, ColonyName.EUROPA]);
      });

      it('the incoming tile LEFT the reserve while parked: dropped, the question stands live', () => {
        const state = swapGame(interposeChoice((s) => {
          // A sibling effect seats Io into the game during the interloper.
          const swap = s as unknown as Swap;
          ColoniesHandler.seatColonyTile(swap.game, swap.other, swap.io);
          swap.game.discardedColonies.push(new Titan());
        }) as unknown as (player: IPlayer, state: Swap) => void);
        replayBatch(state.player, playBatch(state.player, state.card, [swapTail(state, ColonyName.CERES)]));
        state.player.process({type: 'or', index: 0, response: {type: 'option'}});
        drainBatchTail(state.player);
        expect(parkedBatchTailLength(state.player)).eq(0);
        const live = cast(state.player.getWaitingFor(), SelectColony);
        expect(live.colonies.map((c) => c.name), 'the reserve as it stands now').deep.eq([ColonyName.TITAN]);
        expect(names(state)).includes(ColonyName.CERES);
      });

      it('a manual answer to its own prompt SUPERSEDES the parked replacement', () => {
        const state = swapGame(interposeChoice() as unknown as (player: IPlayer, state: Swap) => void);
        replayBatch(state.player, playBatch(state.player, state.card, [swapTail(state, ColonyName.CERES)]));
        state.player.process({type: 'or', index: 0, response: {type: 'option'}});
        cast(state.player.getWaitingFor(), SelectColony);
        expireSupersededStagedTail(state.player);
        expect(parkedBatchTailLength(state.player)).eq(0);
        state.player.process({type: 'colony', colonyName: ColonyName.IO, replaces: ColonyName.EUROPA});
        drainBatchTail(state.player);
        expect(names(state), 'the live answer, not the superseded one').deep.eq([ColonyName.LUNA, ColonyName.CERES, ColonyName.IO]);
      });
    });

    it('the wire validator accepts the four forms and nothing else', () => {
      expect(isSelectColonyResponse({type: 'colony', colonyName: ColonyName.LUNA})).is.true;
      expect(isSelectColonyResponse({type: 'colony', fleetDock: CardName.ANTS})).is.true;
      expect(isSelectColonyResponse({type: 'colony', colonyName: ColonyName.LUNA, stagedFor: CardName.ANTS})).is.true;
      expect(isSelectColonyResponse({type: 'colony', colonyName: ColonyName.LUNA, replaces: ColonyName.CERES})).is.true;
      expect(isSelectColonyResponse({type: 'colony', colonyName: ColonyName.LUNA, replaces: ColonyName.CERES, stagedFor: CardName.ANTS})).is.true;
      expect(isSelectColonyResponse({type: 'colony', fleetDock: CardName.ANTS, replaces: ColonyName.CERES} as unknown as InputResponse), 'a dock is never a replacement').is.false;
      expect(isSelectColonyResponse({type: 'colony', fleetDock: CardName.ANTS, stagedFor: CardName.ANTS} as unknown as InputResponse), 'a dock is never staged').is.false;
      expect(isSelectColonyResponse({type: 'colony', colonyName: ColonyName.LUNA, fleetDock: CardName.ANTS} as unknown as InputResponse)).is.false;
      expect(isSelectColonyResponse({type: 'colony', stagedFor: CardName.ANTS} as unknown as InputResponse)).is.false;
    });
  });

  it('PARKS the tail behind a HIDDEN-INFORMATION prompt without even trying it', () => {
    // The real shape: a Delta Surge traversal crosses stage 5 («look at 4,
    // keep 2») with the stage-7 repeat pick pre-collected BEHIND it. Both are
    // `card` responses, so a try-and-refuse would read the refusal as a
    // genuine divergence and wipe the tail — and if the draw happened to
    // contain the very card the pick names, the DRAW would silently consume
    // the answer. A deck-pick prompt is hidden information: the batch can
    // never contain its answer by construction, so the tail parks untried.
    const [, player] = testGame(2, {deltaProjectExpansion: true});
    player.playedCards.push(new DeltaSurge());
    player.playedCards.push(fakeCard({tags: DELTA_TRACK_TAGS.filter((t) => t !== undefined)}));
    const regolith = new RegolithEaters();
    player.playedCards.push(regolith);
    player.actionsThisGeneration.add(CardName.REGOLITH_EATERS);
    player.energy = 3;
    player.deltaProjectData!.position = 4;
    player.takeAction();

    const menu = cast(player.getWaitingFor(), OrOptions);
    const idx = menu.options.findIndex((o) => o.title === 'Advance on the Hydronetwork track');
    expect(idx).gte(0);
    replayBatch(player, [
      {type: 'or', index: idx, response: {type: 'option'}},
      {type: 'deltaProject', amount: 3},
      {type: 'card', cards: [regolith.name]},
    ]);

    const draw = cast(player.getWaitingFor(), SelectCard);
    expect(draw.deckPickPrompt, 'the stage-5 draw carries the hidden-info marker').is.not.undefined;
    expect(parkedBatchTailLength(player)).eq(1);
    expect(regolith.resourceCount).eq(0);

    // A drain while the hidden prompt stands leaves the tail parked, untried.
    drainBatchTail(player);
    expect(parkedBatchTailLength(player)).eq(1);
    cast(player.getWaitingFor(), SelectCard);

    // The player answers the draw for real; the parked pick then lands on the
    // stage-7 prompt it was collected for.
    player.process({type: 'card', cards: [draw.cards[0].name, draw.cards[1].name]});
    drainBatchTail(player);
    expect(regolith.resourceCount, 'the pre-collected repeat pick landed').eq(1);
    expect(parkedBatchTailLength(player)).eq(0);
  });
});
