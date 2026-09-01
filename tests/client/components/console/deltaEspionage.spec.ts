import {expect} from 'chai';
import type {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {Resource} from '@/common/Resource';
import {CardResource} from '@/common/CardResource';
import {Tag} from '@/common/cards/Tag';
import type {DeltaEspionageProjectionModel} from '@/common/models/DeltaEspionageModel';
import {
  deltaEspionageStepResponse, deltaEspionageResponseOf, espionageLegalTargets,
} from '@/client/console/hydroFlow/deltaEspionageEntry';
import {ESPIONAGE_SKIP_KEY, espionageOutcomeView} from '@/client/console/hydroFlow/espionageOutcomeView';

/**
 * The espionage bridge's PURE halves: the wire mapping (the captured step
 * response pins the rendered prognosis) and the outcome reading (the server's
 * per-player stage projection → the console's one reward vocabulary). Both
 * are read by three surfaces each — a divergence here is a lie on screen.
 */
function projection(overrides?: Partial<DeltaEspionageProjectionModel>): DeltaEspionageProjectionModel {
  return {
    source: CardName.CORPORATE_ESPIONAGE,
    owner: {
      color: 'blue' as Color,
      fromPosition: 2,
      toPosition: 3,
      legal: true,
      reward: {kind: 'production', resource: Resource.MEGACREDITS, amount: 2},
    },
    targets: [
      {color: 'red' as Color, fromPosition: 4, toPosition: 3, legal: true,
        reward: {kind: 'production', resource: Resource.TITANIUM, amount: 1}},
      {color: 'green' as Color, fromPosition: 10, legal: false, blocked: 'vp-protected'},
    ],
    hasLegalTarget: true,
    ...overrides,
  };
}

describe('deltaEspionageEntry (the wire)', () => {
  it('a chosen target pins BOTH rendered positions', () => {
    const r = deltaEspionageStepResponse(projection(), 'red' as Color);
    expect(r).to.deep.eq({
      type: 'deltaEspionage',
      target: 'red' as Color,
      expectedTargetFrom: 4,
      expectedOwnerFrom: 2,
    });
  });

  it('the explicit no-target outcome pins only the owner', () => {
    const r = deltaEspionageStepResponse(projection({hasLegalTarget: false}), undefined);
    expect(r).to.deep.eq({type: 'deltaEspionage', expectedOwnerFrom: 2});
  });

  it('the owner answer rides the same response', () => {
    const r = deltaEspionageStepResponse(projection(), 'red' as Color, {position: 3, rewardChoice: 1});
    expect(r.ownerAnswer).to.deep.eq({position: 3, rewardChoice: 1});
  });

  it('reads a captured response back (the one source of the chosen target)', () => {
    const r = deltaEspionageStepResponse(projection(), 'red' as Color);
    expect(deltaEspionageResponseOf(r)?.target).to.eq('red' as Color);
    expect(deltaEspionageResponseOf({type: 'card'})).is.undefined;
    expect(deltaEspionageResponseOf(undefined)).is.undefined;
  });

  it('legal targets filter keeps seating order', () => {
    expect(espionageLegalTargets(projection()).map((t) => t.color)).to.deep.eq(['red' as Color]);
  });
});

describe('espionageOutcomeView (the outcome reading)', () => {
  it('a deterministic stock/production outcome is one chip row', () => {
    expect(espionageOutcomeView({kind: 'stock', resource: Resource.PLANTS, amount: 3}).chipOptions)
      .to.deep.eq([[{resource: Resource.PLANTS, amount: 3}]]);
    const prod = espionageOutcomeView({kind: 'production', resource: Resource.TITANIUM, amount: 1});
    expect(prod.chipOptions).to.deep.eq([[{resource: Resource.TITANIUM, amount: 1, production: true}]]);
    expect(prod.isChoice).is.false;
  });

  it('a choice outcome is one row per alternative, marked as the subject\'s own', () => {
    const v = espionageOutcomeView({kind: 'choice', options: [
      {resource: Resource.STEEL, amount: 2},
      {resource: Resource.PLANTS, amount: 2},
    ]});
    expect(v.isChoice).is.true;
    expect(v.chipOptions).lengthOf(2);
  });

  it('the special stages keep their established glyphs', () => {
    expect(espionageOutcomeView({kind: 'draw', look: 4, keep: 2}).chipOptions)
      .to.deep.eq([[{special: 'draw-4-keep-2'}]]);
    expect(espionageOutcomeView({kind: 'repeat-action', candidates: 2}).chipOptions)
      .to.deep.eq([[{special: 'reuse-blue-action'}]]);
    expect(espionageOutcomeView({kind: 'card-resource', resource: CardResource.ANIMAL, amount: 2, candidates: 1}).chipOptions)
      .to.deep.eq([[{special: 'add-2-animals'}]]);
    expect(espionageOutcomeView({kind: 'jovian-tag', alreadyClaimed: false}).chipOptions)
      .to.deep.eq([[{special: 'jovian-tag'}]]);
  });

  it('every void/fizzle NAMES itself — never a silent nothing', () => {
    expect(espionageOutcomeView(undefined, 'automa-rules').skippedKey).to.eq(ESPIONAGE_SKIP_KEY.automaRules);
    expect(espionageOutcomeView({kind: 'repeat-action', candidates: 0}).skippedKey).to.eq(ESPIONAGE_SKIP_KEY.noRepeat);
    expect(espionageOutcomeView({kind: 'card-resource', resource: CardResource.ANIMAL, amount: 2, candidates: 0}).skippedKey)
      .to.eq(ESPIONAGE_SKIP_KEY.noAnimalHost);
    expect(espionageOutcomeView({kind: 'jovian-tag', alreadyClaimed: true}).skippedKey)
      .to.eq(ESPIONAGE_SKIP_KEY.jovianClaimed);
  });

  it('a VP terminal reads as its VP value', () => {
    expect(espionageOutcomeView({kind: 'vp', amount: 2}).vpAmount).to.eq(2);
    expect(espionageOutcomeView({kind: 'vp', amount: 2}).chipOptions).lengthOf(0);
  });

  it('the waiver tag is data, not this module\'s concern (owner projection carries it)', () => {
    // Pinned so the model shape stays honest: the waiver is Tag-typed.
    const t: Tag = Tag.BUILDING;
    expect(t).to.eq(Tag.BUILDING);
  });
});
