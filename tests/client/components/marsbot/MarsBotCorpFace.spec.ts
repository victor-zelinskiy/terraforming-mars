import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {MARS_BOT_CORP_IDS, MarsBotCorpId} from '@/common/automa/AutomaTypes';
import MarsBotCorpFace from '@/client/components/marsbot/MarsBotCorpFace.vue';
import PremiumCard from '@/client/components/premiumCard/PremiumCard.vue';
import {buildMarsBotCorpPremiumVm} from '@/client/components/marsbot/marsBotCorpPremiumVm';
import {marsBotCorpAnnotations} from '@/client/components/marsbot/marsBotCorpRules';

function mountFace(id: MarsBotCorpId, resources = 0, large = false) {
  return mount(MarsBotCorpFace, {
    props: {id, resources, large},
    global: {
      mocks: {$t: (s: string) => s},
      // In the app `premium-card-face` is registered globally (main.ts);
      // register it here the same way (a static import in the COMPONENT
      // would close the PremiumCard → CardZoomModal → CardZoomCard cycle).
      components: {'premium-card-face': PremiumCard},
    },
  });
}

/**
 * The bot corporation renders ONE-TO-ONE through the ordinary premium
 * `.pcard` corporation template — same nameplate, tag rail, art viewport,
 * mechanics zone, resource capsule and expansion medallion as a human
 * corporation. Only the CONTENT differs (the bot card's own boxes + the
 * 'automa' stamp), which is what these specs pin.
 */
describe('MarsBotCorpFace (.pcard template)', () => {
  it('renders the real premium corporation face', () => {
    const wrapper = mountFace(MarsBotCorpId.C45_SPIRE);
    expect(wrapper.find('.pcard').exists()).is.true;
    expect(wrapper.find('.pcard-nameplate').exists()).is.true;
    expect(wrapper.find('.pcard__title').text()).contains('Spire');
    expect(wrapper.find('.pcard__mech').exists(), 'the symbolic mechanics zone').is.true;
    expect(wrapper.find('.pcard__exp-medallion').exists(), 'the expansion medallion').is.true;
  });

  it('the medallion carries the automa stamp — never the original\'s module icon', () => {
    for (const id of MARS_BOT_CORP_IDS) {
      const wrapper = mountFace(id);
      const style = wrapper.find('.pcard__exp-medallion').attributes('style') ?? '';
      expect(style, `${id} medallion`).contains('expansion_icon_automa.svg');
    }
  });

  it('shows the tag rail ONLY for a corporation that prints starting tags', () => {
    expect(mountFace(MarsBotCorpId.C45_SPIRE).find('.pcard__tags').exists()).is.true;
    expect(mountFace(MarsBotCorpId.C01_CREDICOR).find('.pcard__tags').exists()).is.false;
    expect(mountFace(MarsBotCorpId.C02_ECOLINE).find('.pcard__tags').exists()).is.false;
    expect(mountFace(MarsBotCorpId.C15_ROBINSON_INDUSTRIES).find('.pcard__tags').exists(),
      'C15 prints no starting tag at all').is.false;
    expect(mountFace(MarsBotCorpId.C16_VALLEY_TRUST).find('.pcard__tags').exists(),
      'C16\'s science symbol is its draft priority, not a starting tag').is.false;
    expect(mountFace(MarsBotCorpId.C17_VITOR).find('.pcard__tags').exists(),
      'C17 prints no starting tag — the human Vitor\'s Earth tag never leaks').is.false;
    expect(mountFace(MarsBotCorpId.C19_ASTRO_DRILL).find('.pcard__tags').exists(),
      'C19\'s space symbol is its draft priority, not a starting tag').is.false;
    expect(mountFace(MarsBotCorpId.C20_FACTORUM).findAll('.pcard__tags .pcard-tag'),
      'C20 prints ONE power starting tag').has.length(1);
    expect(mountFace(MarsBotCorpId.C21_PHARMACY_UNION).findAll('.pcard__tags .pcard-tag'),
      'C21 prints ONE science starting tag — never the human microbe pair').has.length(1);
    expect(mountFace(MarsBotCorpId.C22_PHILARES).findAll('.pcard__tags .pcard-tag'),
      'C22 prints NO starting tag — never the human building one').is.empty;
    expect(mountFace(MarsBotCorpId.C18_ARCADIAN_COMMUNITIES).findAll('.pcard__tags .pcard-tag'),
      'C18 prints ONE building starting tag').has.length(1);
    // C04 prints TWO event tags — both sit on the rail (the bot card's tags,
    // never the human card's single building tag).
    // Saturn Systems prints FOUR starting tags — the rail carries them all.
    const saturn = mountFace(MarsBotCorpId.C08_SATURN_SYSTEMS);
    expect(saturn.findAll('.pcard__tags .pcard-tag')).has.length(4);

    const ic = mountFace(MarsBotCorpId.C04_INTERPLANETARY_CINEMATICS);
    expect(ic.find('.pcard__tags').exists()).is.true;
    const medallions = ic.findAll('.pcard__tags .pcard-tag');
    expect(medallions).has.length(2);
    expect(medallions.every((m) => (m.attributes('style') ?? '').includes('event'))).is.true;
    expect(ic.find('.pcard__res').exists(), 'C04 stores nothing on its card').is.false;
  });

  it('the resource capsule is the ordinary .pcard__res socket with the live count', () => {
    const spire = mountFace(MarsBotCorpId.C45_SPIRE, 7);
    expect(spire.find('.pcard__res').exists()).is.true;
    expect(spire.find('.pcard__res-count').text()).eq('7');

    const ecoline = mountFace(MarsBotCorpId.C02_ECOLINE, 1);
    expect(ecoline.find('.pcard__res-count').text()).eq('1');
    // Ecoline stores PLANTS — the capsule shows the standard plants icon.
    expect(ecoline.find('.pcard__res-icon').attributes('style') ?? '').contains('plant');

    expect(mountFace(MarsBotCorpId.C01_CREDICOR).find('.pcard__res').exists()).is.false;
    expect(mountFace(MarsBotCorpId.C03_HELION).find('.pcard__res').exists(), 'Helion stores nothing on its card').is.false;
    expect(mountFace(MarsBotCorpId.C05_INVENTRIX).find('.pcard__res').exists(), 'Inventrix stores nothing either').is.false;

    // Mining Guild banks M€ ON the card — the same socket, the standard M€ icon.
    const guild = mountFace(MarsBotCorpId.C06_MINING_GUILD, 10);
    expect(guild.find('.pcard__res').exists()).is.true;

    // Factorum's card COLLECTS M€ — the same socket, filling instead of draining.
    const factorum = mountFace(MarsBotCorpId.C20_FACTORUM, 4);
    expect(factorum.find('.pcard__res-count').text()).eq('4');
    expect(factorum.find('.pcard__res-icon').attributes('style') ?? '').contains('megacredit');
    expect(guild.find('.pcard__res-count').text()).eq('10');
    expect(guild.find('.pcard__res-icon').attributes('style') ?? '').contains('megacredit');
  });

  it('no human corporation rule leaks onto the face', () => {
    for (const id of MARS_BOT_CORP_IDS) {
      const text = mountFace(id).text();
      expect(text).not.contains('57');
      expect(text).not.match(/Start with/i);
      expect(text).not.match(/draw 4/i);
      expect(text, 'no human Helion heat-for-M€ rule').not.match(/heat as/i);
    }
  });
});

describe('marsBotCorpPremiumVm (pure)', () => {
  it('builds a corporation-typed vm with the automa expansion and the original identity', () => {
    const vm = buildMarsBotCorpPremiumVm(MarsBotCorpId.C45_SPIRE, 3);
    expect(vm.type).eq('corporation');
    expect(vm.title).eq('Spire');
    expect(vm.expansion).eq('automa');
    expect(vm.tags).deep.eq(['earth']);
    expect(vm.cost).is.undefined; // Corporations print no cost; no human 50 M€.
    expect(vm.resource?.amount).eq(3);
    expect(vm.art, 'the original PC05 art resolves').is.not.undefined;
    expect(vm.mechanics.textOnly).is.not.true;
  });

  it('Ecoline\'s capsule overrides the icon to the standard plants resource', () => {
    const vm = buildMarsBotCorpPremiumVm(MarsBotCorpId.C02_ECOLINE, 1);
    expect(vm.resource?.iconUrl).contains('plant');
    const credicor = buildMarsBotCorpPremiumVm(MarsBotCorpId.C01_CREDICOR, 0);
    expect(credicor.resource).is.undefined;
  });
});

describe('marsBotCorpRules — the «§ ПРАВИЛА» groups', () => {
  it('shapes the printed boxes into annotation groups with their own kickers', () => {
    const groups = marsBotCorpAnnotations(MarsBotCorpId.C45_SPIRE);
    expect(groups.map((g) => g.labelKey)).deep.eq(['Draft priority', 'Corporation effect', 'Before action phase']);
    expect(groups.every((g) => g.rows.length > 0)).is.true;
  });

  it('Point Luna prints both cube colours and what each pushes', () => {
    const groups = marsBotCorpAnnotations(MarsBotCorpId.C14_POINT_LUNA);
    expect(groups.map((g) => g.labelKey)).deep.eq(['Draft priority', 'Corporation setup', 'Corporation effect']);
    const text = groups.flatMap((g) => g.rows.map((r) => r.text)).join(' ');
    expect(text).contains('1, 5, 9, 13, 17');
    expect(text).contains('3, 7, 11, 15');
    expect(text).contains('least-advanced');
    expect(text).contains('space track');
    // The human Point Luna draws a card per Earth tag — not a bot rule.
    expect(text).not.match(/draws a card/i);
  });

  it('Cheung Shing Mars prints its silver cubes, never the human building discount', () => {
    const groups = marsBotCorpAnnotations(MarsBotCorpId.C13_CHEUNG_SHING_MARS);
    expect(groups.map((g) => g.labelKey)).deep.eq(['Draft priority', 'Corporation setup', 'Corporation effect']);
    const text = groups.flatMap((g) => g.rows.map((r) => r.text)).join(' ');
    expect(text).contains('silver');
    expect(text).contains('#4');
    expect(text).contains('5');
    // The human Cheung Shing Mars starts with 3 M€ production and pays 2 less
    // for building cards.
    expect(text).not.match(/production|discount|2 less/i);
  });

  it('UNMI prints the trade it makes, never the human 40 M€ / TR action', () => {
    const groups = marsBotCorpAnnotations(MarsBotCorpId.C12_UNMI);
    expect(groups.map((g) => g.labelKey)).deep.eq(['Corporation setup', 'Before action phase']);
    const text = groups.flatMap((g) => g.rows.map((r) => r.text)).join(' ');
    expect(text).contains('Government Subsidy');
    expect(text).contains('bonus card');
    expect(text).contains('generation 2');
    // The human UNMI starts with 40 M€ and buys TR steps for 3 M€.
    expect(text).not.contains('40');
    expect(text).not.match(/action:/i);
  });

  it('Robinson Industries prints its war chest and its recurring card, never the human production action', () => {
    const groups = marsBotCorpAnnotations(MarsBotCorpId.C15_ROBINSON_INDUSTRIES);
    expect(groups.map((g) => g.labelKey)).deep.eq(['Corporation setup', 'Before action phase']);
    const text = groups.flatMap((g) => g.rows.map((r) => r.text)).join(' ');
    expect(text).contains('Diversification');
    expect(text).contains('10');
    expect(text).contains('least-advanced');
    // The human Robinson Industries starts with 47 M€ and spends 4 M€ to raise
    // its LOWEST PRODUCTION. The bot card echoes the shape (4 M€ for the
    // weakest thing it owns) but pays for a TRACK, and the 47 never appears.
    expect(text).not.contains('47');
    expect(text).not.match(/production/i);
  });

  it('Valley Trust prints its extra card, its cubes and the Prelude condition', () => {
    const groups = marsBotCorpAnnotations(MarsBotCorpId.C16_VALLEY_TRUST);
    expect(groups.map((g) => g.labelKey)).deep.eq(['Draft priority', 'Corporation setup', 'Corporation effect']);
    const text = groups.flatMap((g) => g.rows.map((r) => r.text)).join(' ');
    expect(text).contains('8, 16');
    expect(text).contains('extra project card');
    expect(text, 'the printed module condition is stated, not silently enforced').contains('Prelude');
    expect(text).contains('project deck');
    // The human Valley Trust starts with 37 M€ and draws preludes to choose from.
    expect(text).not.contains('37');
    expect(text).not.match(/prelude cards|choose one/i);
  });

  it('Vitor prints its toll and its standing claim, never the human 45 M€ start', () => {
    const groups = marsBotCorpAnnotations(MarsBotCorpId.C17_VITOR);
    expect(groups.map((g) => g.labelKey)).deep.eq(['Corporation setup', 'Corporation effect', 'Before action phase']);
    const text = groups.flatMap((g) => g.rows.map((r) => r.text)).join(' ');
    expect(text).contains('Overachievement');
    expect(text).contains('non-negative VP icon');
    expect(text, 'the printed exception is stated, never silently applied').contains('destroyed');
    // The human Vitor starts with 45 M€ and funds an award for free as its
    // first action. Its 3 M€ VP effect is on the BOT card too — printed there,
    // not leaked — but the start and the free award never are.
    expect(text).not.contains('45');
    expect(text).not.match(/first action|fund an award/i);
  });

  it('Arcadian Communities prints the reservation and its rent, never the human 40 M€ start', () => {
    const groups = marsBotCorpAnnotations(MarsBotCorpId.C18_ARCADIAN_COMMUNITIES);
    expect(groups.map((g) => g.labelKey)).deep.eq(['Corporation setup', 'Corporation effect', 'Before action phase']);
    const text = groups.flatMap((g) => g.rows.map((r) => r.text)).join(' ');
    expect(text).contains('Settlers');
    expect(text).contains('reserved');
    expect(text).contains('ocean-reserved');
    // The human Arcadian Communities starts with 40 M€ and 10 steel, and its
    // repeatable action needs a marker ADJACENT to its own — none of that is
    // on the bot card (the 3 M€ reserved-area rule is, and is printed there).
    expect(text).not.contains('40');
    expect(text).not.match(/steel|adjacent to one of your/i);
  });

  it('Astro Drill prints its space-track cubes, never the human asteroid action', () => {
    const groups = marsBotCorpAnnotations(MarsBotCorpId.C19_ASTRO_DRILL);
    expect(groups.map((g) => g.labelKey)).deep.eq(['Draft priority', 'Corporation setup', 'Corporation effect']);
    const text = groups.flatMap((g) => g.rows.map((r) => r.text)).join(' ');
    expect(text).contains('2, 4, 7, 10, 13');
    expect(text).contains('5, 11, 16');
    expect(text).contains('least-advanced');
    expect(text).contains('space track');
    // The human AstroDrill starts with 42 M€ and spends/gains asteroid
    // resources with a repeatable action — none of that is on the bot card.
    expect(text).not.contains('42');
    expect(text).not.match(/asteroid resource|remove 1 asteroid/i);
  });

  it('Factorum prints its till and its cash-out, never the human standard-project rule', () => {
    const groups = marsBotCorpAnnotations(MarsBotCorpId.C20_FACTORUM);
    expect(groups.map((g) => g.labelKey)).deep.eq(['Corporation setup', 'Corporation effect', 'Before action phase']);
    const text = groups.flatMap((g) => g.rows.map((r) => r.text)).join(' ');
    expect(text).contains('Supply and Demand');
    expect(text).contains('building track');
    expect(text, 'the store is ON the card, and the panel says so').contains('on this card');
    expect(text).contains('power track');
    // The human Factorum starts with 37 M€ + 4 steel and has a steel/energy
    // standard-project action — none of that is on the bot card.
    expect(text).not.contains('37');
    expect(text).not.match(/standard project|steel/i);
  });

  it('Pharmacy Union prints both directions of its effect, never the human disease action', () => {
    const groups = marsBotCorpAnnotations(MarsBotCorpId.C21_PHARMACY_UNION);
    expect(groups.map((g) => g.labelKey)).deep.eq(['Draft priority', 'Corporation setup', 'Corporation effect']);
    const text = groups.flatMap((g) => g.rows.map((r) => r.text)).join(' ');
    expect(text).contains('Meteor Shower');
    expect(text).contains('microbe tag');
    expect(text).contains('science tag');
    expect(text, 'the partial payment is stated, never dropped').contains('everything it has');
    // The human Pharmacy Union starts with 54 M€ and stores DISEASE resources
    // it may remove for TR — none of that is on the bot card.
    expect(text).not.contains('54');
    expect(text).not.match(/disease|face down/i);
  });

  it('Philares prints the border rule and its own card, never the human resource choice', () => {
    const groups = marsBotCorpAnnotations(MarsBotCorpId.C22_PHILARES);
    expect(groups.map((g) => g.labelKey)).deep.eq(['Corporation setup', 'Corporation effect']);
    const text = groups.flatMap((g) => g.rows.map((r) => r.text)).join(' ');
    expect(text).contains('Local Neural Instance');
    expect(text).contains('Build Build Build');
    expect(text, 'the symmetry is the rule, and the panel keeps it').contains('whoever placed the tile');
    expect(text).contains('science');
    // The human Philares starts with 47 M€ and takes a STANDARD RESOURCE OF
    // ITS CHOICE per adjacency — the bot takes science and spends it on a
    // track, and neither of the human's lines may appear here.
    expect(text).not.contains('47');
    expect(text).not.match(/of your choice|standard resource/i);
  });

  it('ThorGate prints its cubes and the first-tag clause, never the human discount', () => {
    const groups = marsBotCorpAnnotations(MarsBotCorpId.C11_THORGATE);
    expect(groups.map((g) => g.labelKey)).deep.eq(['Draft priority', 'Corporation setup', 'Corporation effect']);
    const text = groups.flatMap((g) => g.rows.map((r) => r.text)).join(' ');
    expect(text).contains('4, 6, 8, 10');
    expect(text).contains('first tag');
    expect(text).contains('temperature');
    // The human ThorGate pays 3 less for power cards and standard projects.
    expect(text).not.match(/discount|3 less|cheaper/i);
  });

  it('Tharsis Republic prints both halves of its city trigger', () => {
    const groups = marsBotCorpAnnotations(MarsBotCorpId.C10_THARSIS_REPUBLIC);
    expect(groups.map((g) => g.labelKey)).deep.eq(['Draft priority', 'Corporation setup', 'Corporation effect']);
    const text = groups.flatMap((g) => g.rows.map((r) => r.text)).join(' ');
    expect(text).contains('city');
    expect(text).contains('event track');
    expect(text).contains('setup');
    // The human Tharsis Republic gains M€ production per city and 3 M€ per
    // city placed on Mars — neither is a bot rule.
    expect(text).not.match(/production/i);
  });

  it('Teractor prints its Earth salary, never the human Earth-card discount', () => {
    const groups = marsBotCorpAnnotations(MarsBotCorpId.C09_TERACTOR);
    expect(groups.map((g) => g.labelKey)).deep.eq(['Draft priority', 'Corporation setup', 'Corporation effect']);
    const text = groups.flatMap((g) => g.rows.map((r) => r.text)).join(' ');
    expect(text).contains('25');
    expect(text).contains('Earth track');
    // The human Teractor starts with 60 M€ and pays 3 less for Earth cards.
    expect(text).not.contains('60');
    expect(text).not.match(/discount|cheaper/i);
  });

  it('Saturn Systems prints its Jovian trigger, never the human 42 M€ start', () => {
    const groups = marsBotCorpAnnotations(MarsBotCorpId.C08_SATURN_SYSTEMS);
    expect(groups.map((g) => g.labelKey)).deep.eq(['Draft priority', 'Corporation effect']);
    const text = groups.flatMap((g) => g.rows.map((r) => r.text)).join(' ');
    expect(text).contains('Jovian');
    expect(text).contains('event track');
    // The human Saturn Systems starts with 42 M€ and titanium production.
    expect(text).not.contains('42');
    expect(text).not.match(/titanium/i);
  });

  it('PhoboLog prints its seeding and its cubes, never the human titanium bonus', () => {
    const groups = marsBotCorpAnnotations(MarsBotCorpId.C07_PHOBOLOG);
    expect(groups.map((g) => g.labelKey)).deep.eq(['Corporation setup', 'Corporation effect']);
    const text = groups.flatMap((g) => g.rows.map((r) => r.text)).join(' ');
    expect(text).contains('space tag');
    expect(text).contains('bonus deck');
    expect(text).contains('7, 10, 13, 15');
    // The human PhoboLog starts with 10 titanium and a +1 titanium value.
    expect(text).not.match(/titanium/i);
  });

  it('Mining Guild prints its bank and its off-switch, never the human steel bonus', () => {
    const groups = marsBotCorpAnnotations(MarsBotCorpId.C06_MINING_GUILD);
    expect(groups.map((g) => g.labelKey)).deep.eq(['Corporation setup', 'Corporation effect']);
    const text = groups.flatMap((g) => g.rows.map((r) => r.text)).join(' ');
    expect(text).contains('10');
    expect(text).contains('building track');
    // The human Mining Guild gains steel for building/steel tiles — not a bot rule.
    expect(text).not.match(/steel/i);
  });

  it('Inventrix prints all three boxes, and never the human draw-3 rule', () => {
    const groups = marsBotCorpAnnotations(MarsBotCorpId.C05_INVENTRIX);
    expect(groups.map((g) => g.labelKey)).deep.eq(['Corporation setup', 'Corporation effect', 'Before action phase']);
    const text = groups.flatMap((g) => g.rows.map((r) => r.text)).join(' ');
    expect(text).contains('Lobbyists');
    expect(text).contains('Do It Right');
    expect(text).contains('requirement');
    // The human Inventrix draws 3 cards and eases requirements by 3 — neither
    // is a bot rule.
    expect(text).not.match(/3 science/i);
    expect(text).not.match(/draw 3/i);
  });

  it('Interplanetary Cinematics prints a SETUP reminder and its EFFECT', () => {
    const groups = marsBotCorpAnnotations(MarsBotCorpId.C04_INTERPLANETARY_CINEMATICS);
    expect(groups.map((g) => g.labelKey)).deep.eq(['Corporation setup', 'Corporation effect']);
    const text = groups.flatMap((g) => g.rows.map((r) => r.text)).join(' ');
    expect(text).contains('white cubes');
    expect(text).contains('2');
  });

  it('Helion prints a SETUP box and an EFFECT box (its cubes + what they do)', () => {
    const groups = marsBotCorpAnnotations(MarsBotCorpId.C03_HELION);
    expect(groups.map((g) => g.labelKey)).deep.eq(['Corporation setup', 'Corporation effect']);
    const text = groups.flatMap((g) => g.rows.map((r) => r.text)).join(' ');
    expect(text).contains('white cube');
    expect(text).contains('black cube');
  });

  it('resolves row params into the text (no raw ${0} reaches the panel)', () => {
    for (const id of MARS_BOT_CORP_IDS) {
      for (const group of marsBotCorpAnnotations(id)) {
        for (const row of group.rows) {
          expect(row.text).not.contains('${');
        }
      }
    }
  });
});
