import {expect} from 'chai';
import {testGame} from '../TestGame';
import {setTemperature} from '../TestingUtils';
import {CardName} from '@/common/cards/CardName';
import {GlobalParameter} from '@/common/GlobalParameter';
import {effectOverlayStats} from '@/common/events/aggregate';
import {sourceKey} from '@/common/events/EventSource';
import {SpecialDesign} from '@/server/cards/base/SpecialDesign';
import {AdaptationTechnology} from '@/server/cards/base/AdaptationTechnology';
import {Fish} from '@/server/cards/base/Fish';
import {LakeMarineris} from '@/server/cards/base/LakeMarineris';
import {EcologyExperts} from '@/server/cards/prelude/EcologyExperts';
import {GameEvent} from '@/common/events/GameEvent';
import {IGame} from '@/server/IGame';
import {Message} from '@/common/logs/Message';

function eased(game: IGame): Array<GameEvent> {
  return game.events.events.filter((e) => e.type === 'requirement-eased');
}

function logLines(game: IGame): Array<Message> {
  return game.gameLog;
}

/**
 * A PLAY'S OWN RECORD OF WHO LET IT THROUGH (TR49 class, rule 10): one
 * `requirement-eased` event per modifier when a printed global requirement
 * was met ONLY thanks to it, a detail line under «played», a trigger counted
 * for the modifier — and nothing when the card needed no help.
 */
describe('requirement-eased', () => {
  it('an armed Special Design that lets Fish through: one event, named, one play', () => {
    const [game, player] = testGame(2);
    setTemperature(game, -2); // Fish requires +2 °C
    player.playCard(new SpecialDesign());
    player.playCard(new Fish());
    const [event, ...rest] = eased(game);
    expect(rest).has.length(0);
    expect(event.source).deep.eq({kind: 'card', card: CardName.SPECIAL_DESIGN, owner: player.color});
    expect(event.target).deep.eq({card: CardName.FISH});
    expect(event.impact.requirementEased).deep.eq({
      kind: 'shift', steps: 2, oneShot: true,
      requirements: [{type: 'C', parameter: GlobalParameter.TEMPERATURE, max: false, printed: 2, effective: -2}],
    });
    const line = logLines(game).find((m) => m.message === '${0} met the ${1} requirement of ${2} thanks to ${3}: ${4} → ${5}');
    expect(line, 'the detail line under «played»').is.not.undefined;
    // The modifier's own «Срабатываний» in «ЭФФЕКТЫ» (the passive overlay — its own play is not a firing).
    const stat = effectOverlayStats(game.events.events, player.color).find((s) => s.sourceKey === sourceKey({kind: 'card', card: CardName.SPECIAL_DESIGN}));
    expect(stat?.triggerCount).eq(1);
    expect(stat?.byChannel?.requirement?.triggerCount).eq(1);
  });

  it('a card that needed no help records nothing (the effect is still spent)', () => {
    const [game, player] = testGame(2);
    setTemperature(game, 4);
    player.playCard(new SpecialDesign());
    player.playCard(new Fish());
    expect(eased(game)).has.length(0);
  });

  it('a WAIVER (Ecology Experts) names the kind, not a number — and its line says «ignored»', () => {
    const [game, player] = testGame(2);
    setTemperature(game, -30);
    player.playedCards.push(new EcologyExperts());
    player.lastCardPlayed = CardName.ECOLOGY_EXPERTS;
    player.playCard(new LakeMarineris());
    const [event] = eased(game);
    expect(event.impact.requirementEased?.kind).eq('waive');
    expect(event.impact.requirementEased?.requirements[0].effective).eq('waived');
    expect(logLines(game).some((m) => m.message === '${0} ignored the global requirements of ${1} thanks to ${2}')).is.true;
  });

  it('a PERMANENT modifier records the same class, not one-shot (Adaptation Technology)', () => {
    const [game, player] = testGame(2);
    setTemperature(game, -2);
    player.playedCards.push(new AdaptationTechnology());
    player.playCard(new Fish());
    const [event] = eased(game);
    expect(event.source).deep.eq({kind: 'card', card: CardName.ADAPTATION_TECHNOLOGY, owner: player.color});
    expect(event.impact.requirementEased?.oneShot).is.false;
  });
});
