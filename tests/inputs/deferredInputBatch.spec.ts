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
import {
  clearBatchTail,
  drainBatchTail,
  parkedBatchTailLength,
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
