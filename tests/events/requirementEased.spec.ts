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
import {BackroomDeal} from '@/server/cards/turmoilRedux/BackroomDeal';
import {MartianCensus} from '@/server/cards/turmoilRedux/MartianCensus';
import {RequirementType} from '@/common/cards/RequirementType';
import {PartyName} from '@/common/turmoil/PartyName';
import {quietResolutionOf, seatEnacted} from '../parliament/parliamentArrange';
import {GameEvent} from '@/common/events/GameEvent';
import {IGame} from '@/server/IGame';
import {Message} from '@/common/logs/Message';
import {buildEventChildren} from '@/client/components/journal/journalEventChild';
import {easedLinesOf, recomputeRootImpact} from '@/client/components/notifications/notificationModel';

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

  it('the JOURNAL draws its own row under the play, and the card of a RIVAL names the modifier', () => {
    const [game, player, rival] = testGame(2);
    setTemperature(game, -2);
    player.playCard(new SpecialDesign());
    player.playCard(new Fish());
    const [event] = eased(game);
    const root = event.correlationId!;
    const chain = game.events.events.filter((e) => e.correlationId === root);
    const rows = buildEventChildren(chain, root, player.color);
    const row = rows.find((r) => r.eased !== undefined);
    expect(row?.source).deep.eq({kind: 'card', card: CardName.SPECIAL_DESIGN});
    expect(row?.bucket).eq('requirement');
    expect(row?.chips, 'nothing moved — no pill sums it').deep.eq([]);
    expect(row?.eased).deep.eq({kind: 'shift', steps: 2, oneShot: true,
      requirements: [{parameter: GlobalParameter.TEMPERATURE, printed: 2, effective: -2, max: false}]});
    expect(easedLinesOf(chain)).deep.eq([{source: CardName.SPECIAL_DESIGN, kind: 'shift', steps: 2, oneShot: true}]);
    // The rival's refresh path reads the same chain.
    expect(recomputeRootImpact(game.events.events, root, player.color, rival.color).childVMs.some((r) => r.eased !== undefined)).is.true;
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

  it('a PARTY waiver (Backroom Deal TR70) records the party, not a scale — and its line says «ignored the party requirement»', () => {
    const [game, player] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
    seatEnacted(game.parliament!, quietResolutionOf(PartyName.REDS));
    player.playedCards.push(new BackroomDeal());
    player.lastCardPlayed = CardName.BACKROOM_DEAL;
    player.playCard(new MartianCensus()); // Mars First's plate, Mars First out of power
    const [event] = eased(game);
    expect(event.impact.requirementEased).deep.eq({kind: 'waive', oneShot: true, requirements: [{type: RequirementType.PARTY, party: PartyName.MARS, max: false, printed: 2, effective: 'waived'}]});
    expect(logLines(game).some((m) => m.message === '${0} ignored the party requirement of ${1} thanks to ${2}')).is.true;
    expect(logLines(game).some((m) => m.message === '${0} ignored the global requirements of ${1} thanks to ${2}'), 'never the global family\'s words').is.false;
    const root = event.correlationId!;
    const row = buildEventChildren(game.events.events.filter((e) => e.correlationId === root), root, player.color).find((r) => r.eased !== undefined);
    expect(row?.eased?.requirements).deep.eq([{party: PartyName.MARS, printed: 2, effective: 'waived', max: false}]);
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
