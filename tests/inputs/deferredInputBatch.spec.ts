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
import {Comet} from '../../src/server/cards/base/Comet';
import {GiantIceAsteroid} from '../../src/server/cards/base/GiantIceAsteroid';
import {AquiferPumping} from '../../src/server/cards/base/AquiferPumping';
import {SelectSpace} from '../../src/server/inputs/SelectSpace';
import {TileType} from '../../src/common/TileType';
import {setTemperature, runAllActions} from '../TestingUtils';
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
