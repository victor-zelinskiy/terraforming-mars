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
      BonusCardId.B09_CORPORATE_COMPETITION_HELLAS,
      BonusCardId.B10_CORPORATE_COMPETITION_ELYSIUM,
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

  it('Corporate Competition (B10) shows the ELYSIUM helper list, and Venuphile only with Venus', () => {
    const base = buildBonusCardView(BonusCardId.B10_CORPORATE_COMPETITION_ELYSIUM, BASE);
    expect(base.name).eq('Corporate Competition (Elysium)');
    const text = base.lines.map((l) => l.text).join(' | ');
    // Every printed helper is on the face — this is what fullscreen inspect reads.
    expect(text).to.include('Celebrity');
    expect(text).to.include('Industrialist');
    expect(text).to.include('Desert Settler');
    expect(text).to.include('Estate Dealer');
    expect(text).to.include('Benefactor');
    // …and both greenery constraints are stated, not implied.
    expect(text).to.include('southern region');
    expect(text).to.include('adjacent to an ocean');
    expect(text, 'Venuphile is a Venus Next addition').to.not.include('Venuphile');
    expect(base.lines.some((l) => l.icon === 'megacredits' && l.params?.[0] === '5'),
      'the 5 M\u20ac payment is on the face').is.true;
    expect(base.fate.kind).eq('discard');

    const venus = buildBonusCardView(BonusCardId.B10_CORPORATE_COMPETITION_ELYSIUM, VENUS);
    expect(venus.lines.map((l) => l.text).join(' | ')).to.include('Venuphile');
  });

  it('Corporate Competition (B11) shows the UTOPIA helper list, and Venuphile only with Venus', () => {
    const base = buildBonusCardView(BonusCardId.B11_CORPORATE_COMPETITION_UTOPIA, BASE);
    expect(base.name).eq('Corporate Competition (Utopia Planitia)');
    const text = base.lines.map((l) => l.text).join(' | ');
    // Every printed helper is on the face — this is what fullscreen inspect reads.
    expect(text).to.include('Suburban');
    expect(text).to.include('Investor');
    expect(text).to.include('Botanist');
    expect(text).to.include('Incorporator');
    expect(text).to.include('Metropolist');
    // …and the greenery's hard constraint is stated, not implied.
    expect(text).to.include('on the board edge');
    expect(text, 'and the reveal-until threshold is a number, not a hint').to.include('10 M€ or less');
    expect(text, 'Venuphile is a Venus Next addition').to.not.include('Venuphile');
    expect(base.lines.some((l) => l.icon === 'megacredits' && l.params?.[0] === '5'),
      'the 5 M€ payment is on the face').is.true;
    expect(base.fate.kind).eq('discard');

    const venus = buildBonusCardView(BonusCardId.B11_CORPORATE_COMPETITION_UTOPIA, VENUS);
    expect(venus.lines.map((l) => l.text).join(' | ')).to.include('Venuphile');
  });

  it('the four Corporate Competition faces are the SAME card with different helpers', () => {
    const ids = [
      BonusCardId.B08_CORPORATE_COMPETITION,
      BonusCardId.B09_CORPORATE_COMPETITION_HELLAS,
      BonusCardId.B10_CORPORATE_COMPETITION_ELYSIUM,
      BonusCardId.B11_CORPORATE_COMPETITION_UTOPIA,
    ];
    for (const id of ids) {
      const view = buildBonusCardView(id, BASE);
      expect(view.lines[0].icon, id).eq('award');
      expect(view.lines[0].text, id).to.include('With 5+');
      expect(view.lines[view.lines.length - 1].text, `${id} states the fallback`)
        .to.include('draws another bonus card');
      expect(view.fate.kind, id).eq('discard');
    }
    // …and no two of them carry the same helper list.
    const bodies = ids.map((id) => buildBonusCardView(id, BASE).lines.map((l) => l.text).join('|'));
    expect(new Set(bodies).size, 'each map has its own helper list').eq(4);
  });

  it('Do It Right (B25) is Lobbyists without the destruction — and it says so', () => {
    const view = buildBonusCardView(BonusCardId.B25_DO_IT_RIGHT, BASE);
    expect(view.name).eq('Do It Right');
    expect(view.fate.kind, 'it recurs forever, it is never destroyed').eq('recurring');
    const icons = view.lines.map((l) => l.icon);
    expect(icons).contains('temperature');
    expect(icons).contains('greenery');
    expect(icons).contains('ocean');
    // The last line is the printed fallback — «no effect», not Lobbyists' one.
    expect(view.lines[view.lines.length - 1].text).to.include('no effect');
    // Venus Next does not fork this card (unlike Lobbyists).
    expect(buildBonusCardView(BonusCardId.B25_DO_IT_RIGHT, VENUS)).deep.eq(view);
  });

  it('Government Subsidy (B31) is one printed line and an ordinary discard', () => {
    const view = buildBonusCardView(BonusCardId.B31_GOVERNMENT_SUBSIDY, BASE);
    expect(view.name).eq('Government Subsidy');
    expect(view.lines).has.length(1);
    expect(view.lines[0]).to.deep.include({icon: 'tr', params: ['1']});
    expect(view.fate.kind, 'not recurring, not destroyed').eq('discard');
  });

  it('Interface Hyperlink (B30) states the variable draw, the chain and its own end', () => {
    const view = buildBonusCardView(BonusCardId.B30_INTERFACE_HYPERLINK, BASE);
    expect(view.name).eq('Interface Hyperlink');
    expect(view.lines).has.length(3);
    expect(view.lines[0].text, 'the DRAW is a fact about the mat, not a printed number')
      .to.include('power track');
    expect(view.lines[1].text, 'the whole priority chain, in printed order')
      .to.include('science tag').and.to.include('most expensive').and.to.include('at random');
    expect(view.fate.kind, 'it destroys itself').eq('alwaysDestroy');
  });

  it('Diversification (B28) states the push and the price it charges for it', () => {
    const view = buildBonusCardView(BonusCardId.B28_DIVERSIFICATION, BASE);
    expect(view.name).eq('Diversification');
    expect(view.lines).has.length(2);
    expect(view.lines[0].text).to.include('least-advanced');
    expect(view.lines[0].text, 'the printed tie-break is part of the rule').to.include('topmost');
    expect(view.lines[1]).to.deep.include({icon: 'megacredits', params: ['4']});
    expect(view.lines[1].text, '«if able» is stated, never silently dropped').to.include('only when it has that much');
    expect(view.fate.kind, 'it recurs forever, it is never destroyed').eq('recurring');
    // No expansion forks this card.
    expect(buildBonusCardView(BonusCardId.B28_DIVERSIFICATION, VENUS)).deep.eq(view);
  });

  it('Settlers (B22) states the claim, its tiebreak and what the claim is worth', () => {
    const view = buildBonusCardView(BonusCardId.B22_SETTLERS, BASE);
    expect(view.name).eq('Settlers');
    expect(view.lines).has.length(3);
    expect(view.lines[0].text).to.include('non-reserved area');
    expect(view.lines[1].text, 'the printed tiebreak is part of the rule').to.include('ocean-reserved');
    expect(view.lines[2]).to.deep.include({icon: 'megacredits', params: ['3']});
    expect(view.fate.kind, 'it recurs forever, it is never destroyed').eq('recurring');
    expect(buildBonusCardView(BonusCardId.B22_SETTLERS, VENUS)).deep.eq(view);
  });

  it('Supply and Demand (B24) states the PARTIAL take and the empty-card fallback', () => {
    const view = buildBonusCardView(BonusCardId.B24_SUPPLY_AND_DEMAND, BASE);
    expect(view.name).eq('Supply and Demand');
    expect(view.lines).has.length(2);
    expect(view.lines[0]).to.deep.include({icon: 'megacredits', params: ['3']});
    expect(view.lines[0].text, '\u00abor as much as possible\u00bb is stated, never dropped').to.include('everything left');
    expect(view.lines[1].text, 'the fallback names its own condition').to.include('completely empty');
    expect(view.fate.kind, 'it recurs forever, it is never destroyed').eq('recurring');
    expect(buildBonusCardView(BonusCardId.B24_SUPPLY_AND_DEMAND, VENUS)).deep.eq(view);
  });

  it('Build Build Build (B27) states the ladder, both prices and its own way back', () => {
    const view = buildBonusCardView(BonusCardId.B27_BUILD_BUILD_BUILD, BASE);
    expect(view.name).eq('Build Build Build');
    expect(view.lines).has.length(4);
    expect(view.lines[0].text, 'a FIRST-possible ladder, and the header says so').to.include('FIRST possible');
    expect(view.lines[1]).to.deep.include({icon: 'city', params: ['5']});
    expect(view.lines[2]).to.deep.include({icon: 'tile', params: ['3']});
    expect(view.lines[2].text, '«destroy that card» is part of the rule').to.include('destroyed');
    expect(view.lines[3]).to.deep.include({icon: 'megacredits', params: ['3']});
    expect(view.fate.kind, 'where it goes depends on the branch it took').eq('conditional');
    expect(view.fate.text, 'and the fallback\'s own destination is named').to.include('bonus deck');
    expect(buildBonusCardView(BonusCardId.B27_BUILD_BUILD_BUILD, VENUS)).deep.eq(view);
  });

  it('an out-of-scope card degrades to its printed summary', () => {
    const view = buildBonusCardView(BonusCardId.B21_PARTY_POLITICS, BASE);
    expect(view.lines).has.length(1);
    expect(view.name).eq('Party Politics');
  });
});
