import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {TileType} from '@/common/TileType';
import {GlobalParameter} from '@/common/GlobalParameter';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {ColonyName} from '@/common/colonies/ColonyName';
import {causeLineOf, causeLinesOf} from '@/client/components/notifications/notificationCauseView';
import {ViewerCauseOrigin, ViewerImpactCause, ViewerImpactMeta} from '@/client/components/notifications/notificationSemantics';

/**
 * The «почему»-zone's PURE presentation mapping — the guarantee that every
 * typed cause renders ONE stable grammar (label anchor → accent name →
 * trigger tail) and that no origin family degrades to an internal kind, an
 * enum, or a «Игровой эффект» placeholder.
 */

const GAIN = [{icon: 'megacredits', text: '+2'}];

function cause(origin: ViewerCauseOrigin, partial: Partial<ViewerImpactCause> = {}): ViewerImpactCause {
  return {origin, gains: GAIN, losses: [], ...partial};
}

function meta(causes: ReadonlyArray<ViewerImpactCause>): ViewerImpactMeta {
  return {sign: 'positive', gains: GAIN, losses: [], causes};
}

describe('notificationCauseView (the «почему» grammar)', () => {
  it('EVERY EventSource family renders a nameable line — the exhaustive worklist', () => {
    // A new EventSource kind fails the mapper's compile-time `never` guard;
    // THIS list is the render-side worklist: every kind that can carry a
    // viewer delta must yield a line whose name is a real i18n key.
    const rendered: Array<[ViewerCauseOrigin, string]> = [
      [{kind: 'card', card: CardName.PREDATORS, owner: 'red'}, CardName.PREDATORS],
      [{kind: 'corporation', card: CardName.THARSIS_REPUBLIC, owner: 'blue'}, CardName.THARSIS_REPUBLIC],
      [{kind: 'standardProject', card: CardName.CITY_STANDARD_PROJECT}, CardName.CITY_STANDARD_PROJECT],
      [{kind: 'milestone', name: 'Mayor' as never}, 'Mayor'],
      [{kind: 'award', name: 'Landlord' as never}, 'Landlord'],
      [{kind: 'colony', name: ColonyName.LUNA}, ColonyName.LUNA],
      [{kind: 'globalEvent', name: 'Eco Sabotage' as never}, 'Eco Sabotage'],
      [{kind: 'party', name: 'Greens' as never}, 'Greens'],
      [{kind: 'globalParameter', parameter: GlobalParameter.TEMPERATURE}, 'Temperature'],
      [{kind: 'bonusCard', bonusCard: BonusCardId.B01_METEOR_SHOWER}, 'Meteor Shower'],
      [{kind: 'production'}, 'Production'],
      [{kind: 'spaceBonus'}, 'Cell bonus'],
      [{kind: 'oceanBonus'}, 'Ocean bonus'],
      [{kind: 'payment'}, 'Payment'],
      [{kind: 'action', category: 'solar-phase'}, 'Solar phase'],
    ];
    for (const [origin, expectedName] of rendered) {
      const line = causeLineOf(cause(origin));
      expect(line, `${JSON.stringify(origin)} renders`).is.not.undefined;
      expect(line!.nameKey, JSON.stringify(origin)).eq(expectedName);
    }
  });

  it('ownership changes the ANCHOR, never the name — «Ваша карта / Ваша корпорация»', () => {
    expect(causeLineOf(cause({kind: 'card', card: CardName.PETS, owner: 'blue'}, {own: true}))?.labelKey).eq('Your card');
    expect(causeLineOf(cause({kind: 'corporation', card: CardName.THARSIS_REPUBLIC, owner: 'blue'}, {own: true}))?.labelKey).eq('Your corporation');
    expect(causeLineOf(cause({kind: 'card', card: CardName.PREDATORS, owner: 'red'}))?.labelKey).eq('Source');
  });

  it('a colony benefit names its ROLE first, the colony as the detail', () => {
    const trade = causeLineOf(cause({kind: 'colony', name: ColonyName.LUNA, benefit: 'trade'}));
    expect(trade?.nameKey).eq('Trade income');
    expect(trade?.detailKey).eq(ColonyName.LUNA);
    const bonus = causeLineOf(cause({kind: 'colony', name: ColonyName.LUNA, benefit: 'colonyBonus'}));
    expect(bonus?.nameKey).eq('Colony bonus');
    expect(bonus?.detailKey).eq(ColonyName.LUNA);
  });

  it('the three base tiles read as COMPLETE phrases; a special tile rides the ${0} slot', () => {
    const city = causeLineOf(cause({kind: 'corporation', card: CardName.THARSIS_REPUBLIC, owner: 'blue'},
      {own: true, trigger: 'tile-placed', triggerTile: TileType.CITY}));
    expect(city?.triggerKey).eq('for a placed city');
    expect(city?.triggerParamKey).is.undefined;
    const special = causeLineOf(cause({kind: 'card', card: CardName.PETS, owner: 'blue'},
      {own: true, trigger: 'tile-placed', triggerTile: TileType.CAPITAL}));
    expect(special?.triggerKey).eq('for placing: ${0}');
    expect(special?.triggerParamKey).eq(CardName.CAPITAL);
  });

  it('a card-played trigger names the played card — unless it IS the source (no echo)', () => {
    const other = causeLineOf(cause({kind: 'card', card: CardName.POINT_LUNA, owner: 'blue'},
      {own: true, trigger: 'card-played', triggerCard: CardName.PREDATORS}));
    expect(other?.triggerKey).eq('for playing: ${0}');
    expect(other?.triggerParamKey).eq(CardName.PREDATORS);
    const self = causeLineOf(cause({kind: 'card', card: CardName.POINT_LUNA, owner: 'blue'},
      {own: true, trigger: 'card-played', triggerCard: CardName.POINT_LUNA}));
    expect(self?.triggerKey, 'the generic tail — never the same name twice').eq('for a played card');
    expect(self?.triggerParamKey).is.undefined;
  });

  it('a tile-placed trigger with NO unambiguous tile keeps the generic tail', () => {
    const line = causeLineOf(cause({kind: 'corporation', card: CardName.THARSIS_REPUBLIC, owner: 'blue'},
      {own: true, trigger: 'tile-placed'}));
    expect(line?.triggerKey).eq('for a placed tile');
  });

  it('ONE cause → no chips (the band owns the number); SEVERAL → each line carries its own', () => {
    const single = causeLinesOf(meta([cause({kind: 'spaceBonus'})]));
    expect(single).has.length(1);
    expect(single[0].chips).is.undefined;
    const multi = causeLinesOf(meta([
      cause({kind: 'spaceBonus'}, {gains: [{icon: 'steel', text: '+2'}]}),
      cause({kind: 'oceanBonus'}, {gains: [{icon: 'megacredits', text: '+2'}]}),
    ]));
    expect(multi).has.length(2);
    expect(multi[0].chips).deep.eq([{icon: 'steel', text: '+2'}]);
    expect(multi[1].chips).deep.eq([{icon: 'megacredits', text: '+2'}]);
  });

  it('an unattributable origin yields NO line — a guarded defect, never a placeholder', () => {
    expect(causeLineOf(cause({kind: 'system'}))).is.undefined;
    expect(causeLineOf(cause({kind: 'action'}))).is.undefined;
    // …but an action fallback WITH a card still names the card.
    expect(causeLineOf(cause({kind: 'action', card: CardName.PREDATORS}))?.nameKey).eq(CardName.PREDATORS);
  });
});
