import {expect} from 'chai';
import {testGame} from '../TestGame';
import {setOxygenLevel} from '../TestingUtils';
import {Server} from '../../src/server/models/ServerModel';
import {BreathingFilters} from '../../src/server/cards/base/BreathingFilters';
import {Inventrix} from '../../src/server/cards/corporation/Inventrix';
import {AdaptationTechnology} from '../../src/server/cards/base/AdaptationTechnology';
import {UnplayableReason} from '../../src/common/cards/UnplayableReason';

/**
 * DRAW/REVEAL AVAILABILITY — the «Получены карты» batch speaks with the SAME
 * evaluator, for the SAME subject player, as every other card-decision
 * surface.
 *
 * The server already serializes `cardDrawReveals` cards through the one
 * `cardsToModel(player, …, {unplayableReasons: true})` road (the exact
 * options `cardsInHand` uses), and the reveal queue lives ONLY on the batch
 * owner's own PlayerViewModel — so the reasons are computed against the
 * RECIPIENT with every requirement modifier the real `CardRequirement
 * .satisfies` folds in. This spec pins those two facts (consistency across
 * surfaces + subject-player modifiers), because the client rails and the
 * fullscreen panel now render exactly this data: a drift here is a drawn
 * card disagreeing with itself between the reveal, the hand and fullscreen.
 *
 * Fixture: «Дыхательные фильтры» (Breathing Filters, requires 7% oxygen).
 */

const oxygenReason = (reasons: ReadonlyArray<UnplayableReason> | undefined) =>
  (reasons ?? []).find((r) => r.type === 'globalParameter' && r.globalParameter === 'oxygen');

describe('cardDrawReveals — factual availability of drawn cards', () => {
  it('a drawn card carries the SAME reasons as the same card in hand (one evaluator)', () => {
    const [game, player] = testGame(2);
    setOxygenLevel(game, 5);
    player.cardsInHand.push(new BreathingFilters());
    player.enqueueCardDrawReveal([new BreathingFilters()]);

    const model = Server.getPlayerModel(player);
    const inHand = model.cardsInHand.find((c) => c.name === 'Breathing Filters');
    const revealed = model.cardDrawReveals[0]?.cards.find((c) => c.name === 'Breathing Filters');
    expect(inHand, 'the hand model carries the card').is.not.undefined;
    expect(revealed, 'the reveal model carries the card').is.not.undefined;
    expect(revealed?.unplayableReasons, 'reasons are present on the reveal card').is.not.undefined;
    expect(revealed?.unplayableReasons).to.deep.eq(inHand?.unplayableReasons);
    const oxy = oxygenReason(revealed?.unplayableReasons);
    expect(oxy, 'the printed requirement speaks').is.not.undefined;
    expect(oxy?.requirement).eq(true);
    expect(oxy?.current).eq(5);
    expect(oxy?.params).to.deep.eq(['7']);
  });

  it('Inventrix (±2 steps) satisfies the requirement — the reveal shows NO parameter reason', () => {
    const [game, player] = testGame(2);
    setOxygenLevel(game, 5); // 5 ≥ 7 − 2 → met for Inventrix, unmet for anyone else
    player.playedCards.push(new Inventrix());
    player.enqueueCardDrawReveal([new BreathingFilters()]);

    const revealed = Server.getPlayerModel(player).cardDrawReveals[0]?.cards[0];
    expect(oxygenReason(revealed?.unplayableReasons),
      'the modifier is folded into the reveal verdict — no orange/red for a met requirement').is.undefined;
  });

  it('…and a still-short Inventrix reports the EFFECTIVE bound, not the printed one', () => {
    const [game, player] = testGame(2);
    setOxygenLevel(game, 4); // 4 < 7 − 2 → unmet even with the bonus
    player.playedCards.push(new Inventrix());
    player.enqueueCardDrawReveal([new BreathingFilters()]);

    const oxy = oxygenReason(Server.getPlayerModel(player).cardDrawReveals[0]?.cards[0]?.unplayableReasons);
    expect(oxy, 'the requirement still speaks').is.not.undefined;
    expect(oxy?.current).eq(4);
    expect(oxy?.effectiveCount, 'the stretched bound rides the reveal model').eq(5);
  });

  it('one player\'s modifier never leaks onto another player\'s reveal', () => {
    const [game, player, other] = testGame(2);
    setOxygenLevel(game, 5);
    player.playedCards.push(new Inventrix());
    player.enqueueCardDrawReveal([new BreathingFilters()]);
    other.enqueueCardDrawReveal([new BreathingFilters()]);

    expect(oxygenReason(Server.getPlayerModel(player).cardDrawReveals[0]?.cards[0]?.unplayableReasons),
      'Inventrix: met').is.undefined;
    const otherOxy = oxygenReason(Server.getPlayerModel(other).cardDrawReveals[0]?.cards[0]?.unplayableReasons);
    expect(otherOxy, 'the unmodified player keeps the honest reason').is.not.undefined;
    expect(otherOxy?.effectiveCount, 'and no foreign bonus stretches their bound').is.undefined;
  });

  it('a played permanent modifier (Adaptation Technology) counts the same way', () => {
    const [game, player] = testGame(2);
    setOxygenLevel(game, 5);
    player.playedCards.push(new AdaptationTechnology());
    player.enqueueCardDrawReveal([new BreathingFilters()]);

    expect(oxygenReason(Server.getPlayerModel(player).cardDrawReveals[0]?.cards[0]?.unplayableReasons)).is.undefined;
  });

  it('a TEMPORARY requirement bonus counts too (the Ecology Experts window)', () => {
    const [game, player] = testGame(2);
    setOxygenLevel(game, 5);
    player.temporaryGlobalParameterRequirementBonus = 2;
    player.enqueueCardDrawReveal([new BreathingFilters()]);

    expect(oxygenReason(Server.getPlayerModel(player).cardDrawReveals[0]?.cards[0]?.unplayableReasons)).is.undefined;
  });

  it('the reveal queue is SELF-ONLY — another seat\'s model never carries it', () => {
    const [/* game */, player, other] = testGame(2);
    player.enqueueCardDrawReveal([new BreathingFilters()]);
    expect(Server.getPlayerModel(other).cardDrawReveals).to.deep.eq([]);
  });
});
