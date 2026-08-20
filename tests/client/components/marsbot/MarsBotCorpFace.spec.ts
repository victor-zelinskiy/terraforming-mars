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
