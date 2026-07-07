import {expect} from 'chai';
import {BonusCardId} from '../../src/common/automa/AutomaTypes';
import {buildBonusCardView} from '../../src/common/automa/BonusCardData';

const BASE = {venus: false, colonies: false};
const VENUS = {venus: true, colonies: false};
const COLONIES = {venus: false, colonies: true};

describe('buildBonusCardView — the card face resolved for THIS game', () => {
  it('Meteor Shower states BOTH fates honestly (the discard is never a mystery)', () => {
    const view = buildBonusCardView(BonusCardId.B01_METEOR_SHOWER, BASE);
    expect(view.fate.kind).eq('conditional');
    expect(view.fate.text).to.include('discarded otherwise');
    expect(view.lines[0].icon).eq('plants');
    expect(view.lines[0].params).deep.eq(['5']);
  });

  it('Invasive Species resolves the expansion fork instead of narrating it', () => {
    const base = buildBonusCardView(BonusCardId.B02_INVASIVE_SPECIES, BASE);
    expect(base.lines[0]).to.deep.include({icon: 'megacredits', params: ['5']});
    expect(base.lines.some((l) => l.icon === 'floater')).is.false;

    const venus = buildBonusCardView(BonusCardId.B02_INVASIVE_SPECIES, VENUS);
    expect(venus.lines[0]).to.deep.include({icon: 'megacredits', params: ['2']});
    expect(venus.lines.some((l) => l.icon === 'floater')).is.true;

    const colonies = buildBonusCardView(BonusCardId.B02_INVASIVE_SPECIES, COLONIES);
    expect(colonies.lines[0]).to.deep.include({icon: 'megacredits', params: ['2']});
  });

  it('the Lobbyists variants differ in their third option and fate', () => {
    const base = buildBonusCardView(BonusCardId.B06_LOBBYISTS, BASE);
    expect(base.lines.some((l) => l.icon === 'ocean')).is.true;
    expect(base.lines.some((l) => l.icon === 'venus')).is.false;

    const venus = buildBonusCardView(BonusCardId.B15_LOBBYISTS_VENUS, VENUS);
    expect(venus.lines.some((l) => l.icon === 'venus')).is.true;
    expect(venus.lines.some((l) => l.icon === 'ocean')).is.false;
    expect(venus.fate.text).to.not.eq(base.fate.text);
  });

  it('recurring cards say so; the Neural Instance is an always-destroy', () => {
    expect(buildBonusCardView(BonusCardId.B16_GOVERNMENT_INTERVENTION, VENUS).fate.kind).eq('recurring');
    expect(buildBonusCardView(BonusCardId.B19_SHIPPING_LINES, COLONIES).fate.kind).eq('recurring');
    expect(buildBonusCardView(BonusCardId.B07_LOCAL_NEURAL_INSTANCE, BASE).fate.kind).eq('alwaysDestroy');
  });

  it('wording is future-proof: no bare "You …" lines on the POC set', () => {
    const pocIds = [
      BonusCardId.B01_METEOR_SHOWER, BonusCardId.B02_INVASIVE_SPECIES,
      BonusCardId.B03_RESEARCH_AND_DEVELOPMENT, BonusCardId.B04_OVERACHIEVEMENT,
      BonusCardId.B05_EXPEDITED_CONSTRUCTION, BonusCardId.B06_LOBBYISTS,
      BonusCardId.B07_LOCAL_NEURAL_INSTANCE, BonusCardId.B08_CORPORATE_COMPETITION,
      BonusCardId.B15_LOBBYISTS_VENUS, BonusCardId.B16_GOVERNMENT_INTERVENTION,
      BonusCardId.B17_EXPEDITED_CONSTRUCTION_COLONIES, BonusCardId.B18_OUTER_SYSTEM_FOOTHOLD,
      BonusCardId.B19_SHIPPING_LINES, BonusCardId.B20_EXTENDED_SHIPPING_LINES,
    ];
    for (const id of pocIds) {
      const view = buildBonusCardView(id, {venus: true, colonies: true});
      for (const line of view.lines) {
        expect(line.text, `${id}: "${line.text}"`).to.not.match(/^You\b/i);
      }
    }
  });

  it('an out-of-scope card degrades to its printed summary', () => {
    const view = buildBonusCardView(BonusCardId.B21_PARTY_POLITICS, BASE);
    expect(view.lines).has.length(1);
    expect(view.name).eq('Party Politics');
  });
});
