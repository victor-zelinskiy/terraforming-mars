import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {MARS_BOT_CORP_IDS, MarsBotCorpId} from '@/common/automa/AutomaTypes';
import MarsBotCorpFace from '@/client/components/marsbot/MarsBotCorpFace.vue';
import PremiumCard from '@/client/components/premiumCard/PremiumCard.vue';
import {buildMarsBotCorpPremiumVm} from '@/client/components/marsbot/marsBotCorpPremiumVm';
import {marsBotCorpAnnotations} from '@/client/components/marsbot/marsBotCorpRules';
import {marsBotCorpInfo} from '@/common/automa/MarsBotCorpData';

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
    expect(mountFace(MarsBotCorpId.C23_RECYCLON).findAll('.pcard__tags .pcard-tag'),
      'C23 prints ONE microbe starting tag — never the human microbe+building pair').has.length(1);
    expect(mountFace(MarsBotCorpId.C24_SPLICE).findAll('.pcard__tags .pcard-tag'),
      'C24 prints ONE plant starting tag — never the human microbe one').has.length(1);
    expect(mountFace(MarsBotCorpId.C25_VIRON).findAll('.pcard__tags .pcard-tag'),
      'C25 prints ONE microbe starting tag').has.length(1);
    expect(mountFace(MarsBotCorpId.C26_CELESTIC).findAll('.pcard__tags .pcard-tag'),
      'C26 prints ONE Venus starting tag').has.length(1);
    expect(mountFace(MarsBotCorpId.C27_MORNING_STAR).findAll('.pcard__tags .pcard-tag'),
      'C27 prints TWO Venus starting tags').has.length(2);
    expect(mountFace(MarsBotCorpId.C28_APHRODITE).findAll('.pcard__tags .pcard-tag'),
      'C28 prints ONE plant starting tag — never the human plant+Venus pair').has.length(1);
    expect(mountFace(MarsBotCorpId.C18_ARCADIAN_COMMUNITIES).findAll('.pcard__tags .pcard-tag'),
      'C18 prints ONE building starting tag').has.length(1);
    expect(mountFace(MarsBotCorpId.C29_MANUTECH).findAll('.pcard__tags .pcard-tag'),
      'C29 prints ONE building starting tag').has.length(1);
    expect(mountFace(MarsBotCorpId.C30_ARIDOR).find('.pcard__tags').exists(),
      'C30 prints NO starting tag — its corner carries the priority plate').is.false;
    expect(mountFace(MarsBotCorpId.C31_ARKLIGHT).findAll('.pcard__tags .pcard-tag'),
      'C31 prints ONE animal starting tag').has.length(1);
    expect(mountFace(MarsBotCorpId.C32_POLYPHEMOS).findAll('.pcard__tags .pcard-tag'),
      'C32 prints SIX starting tags — three space and three event').has.length(6);
    expect(mountFace(MarsBotCorpId.C33_POSEIDON).find('.pcard__tags').exists(),
      'C33 prints NO starting tag at all').is.false;
    expect(mountFace(MarsBotCorpId.C34_STORMCRAFT).findAll('.pcard__tags .pcard-tag'),
      'C34 prints ONE Jovian starting tag').has.length(1);
    expect(mountFace(MarsBotCorpId.C46_TYCHO_MAGNETICS).find('.pcard__tags').exists(),
      'C46 prints NO starting tag — its corner carries the priority plate').is.false;
    expect(mountFace(MarsBotCorpId.C35_LAKEFRONT_RESORTS).find('.pcard__tags').exists(),
      'C35 prints NO starting tag at all').is.false;
    expect(mountFace(MarsBotCorpId.C36_PRISTAR).find('.pcard__tags').exists(),
      'C36 prints NO starting tag either').is.false;
    expect(mountFace(MarsBotCorpId.C38_TERRALABS).findAll('.pcard__tags .pcard-tag'),
      'C38 prints ONE science starting tag (the corner box, not a priority plate)').has.length(1);
    expect(mountFace(MarsBotCorpId.C39_UTOPIA_INVEST).findAll('.pcard__tags .pcard-tag'),
      'C39 prints TWO — building and space').has.length(2);
    expect(mountFace(MarsBotCorpId.C40_ECOTEC).findAll('.pcard__tags .pcard-tag'),
      'C40 prints ONE plant starting tag').has.length(1);
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

  it('EVERY printed storage kind paints a real icon — none falls through to a bare cube', () => {
    // The socket resolver is exhaustive over `MarsBotCorpResource`, so a new
    // kind cannot compile without a case. This is the RENDERED half of that
    // claim: whatever a corporation stores, the capsule shows the right thing.
    const painted = new Map<string, string>();
    for (const id of MARS_BOT_CORP_IDS) {
      const kind = marsBotCorpInfo(id).resource;
      if (kind === undefined) {
        continue;
      }
      const face = mountFace(id, 2);
      expect(face.find('.pcard__res').exists(), `${id} stores ${kind} — the capsule must exist`).is.true;
      expect(face.find('.pcard__res-count').text(), `${id} shows the live count`).eq('2');
      const icon = face.find('.pcard__res-icon').attributes('style') ?? '';
      expect(icon, `${id} (${kind}) paints an icon`).matches(/url\(|background-image/);
      const previous = painted.get(kind);
      if (previous !== undefined) {
        expect(icon, `every ${kind} card paints the SAME icon`).eq(previous);
      }
      painted.set(kind, icon);
    }
    // Each kind is distinguishable from the others — a fall-through to the
    // generic cube would collapse two of these onto one picture.
    expect(painted.get('plant'), 'plants').contains('plant');
    expect(painted.get('megacredits'), 'M€').contains('megacredit');
    expect(painted.get('science'), 'a real card resource').contains('science');
    expect(painted.get('cube-white'), 'a white cube IS the cube').contains('cube');
    expect(new Set(painted.values()).size, 'four kinds, four pictures').eq(painted.size);
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

  it('Recyclon prints its cube ladder and the track it feeds, never the human microbe trade', () => {
    const groups = marsBotCorpAnnotations(MarsBotCorpId.C23_RECYCLON);
    expect(groups.map((g) => g.labelKey)).deep.eq(['Draft priority', 'Corporation setup', 'Corporation effect']);
    const text = groups.flatMap((g) => g.rows.map((r) => r.text)).join(' ');
    expect(text).contains('3, 6, 9, 12, 15, 18');
    expect(text).contains('building track');
    expect(text, 'the track it feeds is named').contains('plant track');
    // The human Recyclon starts with 38 M€ + 1 steel production and trades
    // MICROBES on its own card for plant production — none of that is here.
    expect(text).not.contains('38');
    expect(text).not.match(/steel|microbe|production/i);
  });

  it('Splice prints both directions of its toll, never the human 44 M€ start', () => {
    const groups = marsBotCorpAnnotations(MarsBotCorpId.C24_SPLICE);
    expect(groups.map((g) => g.labelKey)).deep.eq(['Draft priority', 'Corporation setup', 'Corporation effect']);
    const text = groups.flatMap((g) => g.rows.map((r) => r.text)).join(' ');
    expect(text).contains('Research and Development');
    expect(text).contains('microbe tag');
    expect(text, 'the opponent\'s own half of the effect is stated too').contains('or a microbe on that card');
    // The human Splice starts with 44 M€ and its first action reveals a
    // microbe card INTO HAND — the bot card has neither.
    expect(text).not.contains('44');
    expect(text).not.match(/into hand|first action/i);
  });

  it('Viron prints its floaters and its endgame points, never the human re-use action', () => {
    const groups = marsBotCorpAnnotations(MarsBotCorpId.C25_VIRON);
    expect(groups.map((g) => g.labelKey)).deep.eq(['Corporation setup', 'Corporation effect']);
    const text = groups.flatMap((g) => g.rows.map((r) => r.text)).join(' ');
    expect(text).contains('blue card with a red arrow');
    expect(text).contains('floater');
    expect(text, 'the endgame half is stated too').contains('end of the game');
    expect(text, 'and the printed module condition').contains('Venus Next or Colonies');
    // The human Viron starts with 48 M€ and RE-USES the action of a card it
    // already played — the bot card does neither.
    expect(text).not.contains('48');
    expect(text).not.match(/re-use|again this generation/i);
  });

  it('Celestic prints its failure clause and its round tick, never the human floater action', () => {
    const groups = marsBotCorpAnnotations(MarsBotCorpId.C26_CELESTIC);
    expect(groups.map((g) => g.labelKey))
      .deep.eq(['Draft priority', 'Corporation setup', 'Corporation effect', 'Round start']);
    const text = groups.flatMap((g) => g.rows.map((r) => r.text)).join(' ');
    expect(text).contains('Failed Action');
    expect(text, 'the printed «in addition» is kept').contains('on top of the usual');
    expect(text).contains('Research Phase');
    expect(text, 'and the printed module condition').contains('Venus Next or Colonies');
    // The human Celestic starts with 42 M€ and has an ACTION that adds a
    // floater to ANOTHER card, plus 1 VP per 3 floaters — none of that is here.
    expect(text).not.contains('42');
    expect(text).not.match(/another card|per 3 floaters/i);
  });

  it('Morning Star Inc. prints its cube run and its lobby, never the human Venus discount', () => {
    const groups = marsBotCorpAnnotations(MarsBotCorpId.C27_MORNING_STAR);
    expect(groups.map((g) => g.labelKey)).deep.eq(['Corporation setup', 'Corporation effect']);
    const text = groups.flatMap((g) => g.rows.map((r) => r.text)).join(' ');
    expect(text).contains('5, 6, 7, 8, 9, 11, 12');
    expect(text, 'the printed gap is visible to the reader too').not.contains('10');
    expect(text).contains('Lobbyists');
    expect(text).contains('Venusian Lobby');
    expect(text).contains('Venus Next');
    // The human Morning Star starts with 50 M€, draws a Venus card each
    // generation and pays 2 less for Venus cards — none of that is here.
    expect(text).not.contains('50');
    expect(text).not.match(/2 less|draw a card/i);
  });

  it('Aphrodite prints its Venus toll, never the human 47 M€ start', () => {
    const groups = marsBotCorpAnnotations(MarsBotCorpId.C28_APHRODITE);
    expect(groups.map((g) => g.labelKey)).deep.eq(['Draft priority', 'Corporation setup', 'Corporation effect']);
    const text = groups.flatMap((g) => g.rows.map((r) => r.text)).join(' ');
    expect(text).contains('Venus');
    expect(text, 'the printed «whoever raised it» is kept').contains('whoever raised it');
    expect(text, 'including the World Government half of the parenthetical').contains('World Government');
    expect(text).contains('Venus Next');
    // The human Aphrodite starts with 47 M€ and 1 plant production.
    expect(text).not.contains('47');
    expect(text).not.match(/plant production/i);
  });

  it('Manutech prints its two marked columns, never the human production rule', () => {
    const groups = marsBotCorpAnnotations(MarsBotCorpId.C29_MANUTECH);
    expect(groups.map((g) => g.labelKey)).deep.eq(['Corporation setup', 'Corporation effect']);
    const text = groups.flatMap((g) => g.rows.map((r) => r.text)).join(' ');
    expect(text, 'both reminder columns are named').contains('#5 and #12');
    expect(text, 'and the effect names them as the trigger').contains('#5 or #12');
    expect(text, 'the printed parenthetical about the Venus track is kept').contains('Venus');
    // The human Manutech starts with 35 M€ + 1 steel production and gains the
    // resource whenever it raises a production — none of that is here.
    expect(text).not.contains('35');
    expect(text).not.match(/production/i);
  });

  it('Aridor prints its nine cubes and the extra colony, never the human tag bonus', () => {
    const groups = marsBotCorpAnnotations(MarsBotCorpId.C30_ARIDOR);
    expect(groups.map((g) => g.labelKey)).deep.eq(['Draft priority', 'Corporation setup', 'Corporation effect']);
    const text = groups.flatMap((g) => g.rows.map((r) => r.text)).join(' ');
    expect(text).contains('Colonies');
    expect(text, 'the white run').contains('#3');
    expect(text, 'and the two spaces further up').contains('#6');
    expect(text, 'the extra tile is a printed setup line, not folklore').contains('colony tile');
    expect(text, 'and the effect names the track every cube pays').contains('event track');
    expect(text, 'both colours, one outcome').contains('either colour');
    // The human Aridor starts with 40 M€ and gains 1 M€ production for each
    // NEW tag type it puts in play — none of that is here.
    expect(text).not.contains('40');
    expect(text).not.match(/new type of tag|production/i);
  });

  it('Arklight prints both paying tags AND the microbe exclusion, never the human resource rule', () => {
    const groups = marsBotCorpAnnotations(MarsBotCorpId.C31_ARKLIGHT);
    expect(groups.map((g) => g.labelKey)).deep.eq(['Draft priority', 'Corporation setup', 'Corporation effect']);
    const text = groups.flatMap((g) => g.rows.map((r) => r.text)).join(' ');
    expect(text, 'the reminder on the mat').contains('white cube');
    expect(text, 'the two tags that pay').contains('plant or animal');
    expect(text, 'the printed «including the starting tag»').contains('starting tag');
    expect(text, 'and the exclamation the card exists for').contains('microbe');
    // The human Arklight starts with 45 M€ and adds an animal resource to a
    // card whenever it plays an animal/plant tag — none of that is here.
    expect(text).not.contains('45');
    expect(text).not.match(/animal resource|add a resource/i);
  });

  it('Polyphemos prints its gift and its deck thinning, never the human card prices', () => {
    const groups = marsBotCorpAnnotations(MarsBotCorpId.C32_POLYPHEMOS);
    expect(groups.map((g) => g.labelKey)).deep.eq(['Corporation setup', 'Before action phase']);
    const text = groups.flatMap((g) => g.rows.map((r) => r.text)).join(' ');
    expect(text, 'the opening gift').contains('25');
    expect(text, 'and what it does every generation').contains('fewest tags');
    expect(text, 'including which cards are NOT in that choice').contains('Bonus cards');
    // The human Polyphemos starts with 50 M€, pays 5 M€ per bought card and
    // draws 2 whenever it would draw 1 — none of that is here.
    expect(text).not.contains('50');
    expect(text).not.match(/buy a card|draw 2|instead of 3/i);
  });

  it('Poseidon prints both seats of its colony trigger, never the human trade bonus', () => {
    const groups = marsBotCorpAnnotations(MarsBotCorpId.C33_POSEIDON);
    expect(groups.map((g) => g.labelKey)).deep.eq(['Corporation setup', 'Corporation effect']);
    const text = groups.flatMap((g) => g.rows.map((r) => r.text)).join(' ');
    expect(text).contains('Colonies');
    expect(text, 'the setup founds one').contains('builds a colony');
    expect(text, 'and BOTH seats trigger it').contains('opponent');
    expect(text, 'including the printed «during setup» clause').contains('setup');
    expect(text, 'and the target').contains('least-advanced');
    // The human Poseidon starts with 45 M€, gains a colony for free and takes
    // 1 M€ whenever ANY colony is built — none of that is here.
    expect(text).not.contains('45');
    expect(text).not.match(/gain 1 M€|trade bonus/i);
  });

  it('Stormcraft prints its floater loop, never the human heat conversion', () => {
    const groups = marsBotCorpAnnotations(MarsBotCorpId.C34_STORMCRAFT);
    expect(groups.map((g) => g.labelKey))
      .deep.eq(['Corporation setup', 'Corporation effect', 'Round start']);
    const text = groups.flatMap((g) => g.rows.map((r) => r.text)).join(' ');
    expect(text, 'the printed module condition').contains('Venus Next or Colonies');
    expect(text, 'and what the spend buys').contains('temperature');
    expect(text, 'and the steady drip').contains('Research Phase');
    // The human Stormcraft starts with 48 M€ and turns each floater into 2
    // heat with an action — none of that is here.
    expect(text).not.contains('48');
    expect(text).not.match(/2 heat|spend a floater/i);
  });

  it('Lakefront Resorts prints the flipping cube and the waterfront rate, never the human production', () => {
    const groups = marsBotCorpAnnotations(MarsBotCorpId.C35_LAKEFRONT_RESORTS);
    expect(groups.map((g) => g.labelKey)).deep.eq(['Corporation setup', 'Corporation effect']);
    const text = groups.flatMap((g) => g.rows.map((r) => r.text)).join(' ');
    expect(text, 'the cube the setup places').contains('white cube');
    expect(text, 'what an ocean does to it').contains('building track');
    expect(text, 'and the standing rate').contains('3 M€');
    // The human Lakefront Resorts starts with 54 M€ and raises its own M€
    // PRODUCTION on every ocean — neither is here (only the shared 3 M€
    // shoreline rate, which the bot card prints for itself).
    expect(text).not.contains('54');
    expect(text).not.match(/production/i);
  });

  it('Ecotec prints its bio-tag greenhouse, never the human choice of plant or microbe', () => {
    const groups = marsBotCorpAnnotations(MarsBotCorpId.C40_ECOTEC);
    expect(groups.map((g) => g.labelKey))
      .deep.eq(['Draft priority', 'Corporation setup', 'Corporation effect', 'Before action phase']);
    const text = groups.flatMap((g) => g.rows.map((r) => r.text)).join(' ');
    expect(text, 'the three feeding tags').contains('animal');
    expect(text, 'the store on the card').contains('plants on this card');
    expect(text, 'and what five of them buy').contains('plant track');
    // The human EcoTec starts with 42 M€, raises plant production and lets
    // its OWNER choose a plant or a microbe on any card — none of that here.
    expect(text).not.contains('42');
    expect(text).not.match(/production|any card/i);
    // The plant capsule counts the store, and the mat marker is declared.
    const face = mountFace(MarsBotCorpId.C40_ECOTEC, 3);
    expect(face.find('.pcard__res-count').text()).eq('3');
    expect(face.find('.pcard__res-icon').attributes('style') ?? '').contains('plant');
  });

  it('Utopia Invest prints its recurring card and both of its halves, never the human production trade', () => {
    const groups = marsBotCorpAnnotations(MarsBotCorpId.C39_UTOPIA_INVEST);
    expect(groups.map((g) => g.labelKey)).deep.eq(['Before action phase']);
    const text = groups.flatMap((g) => g.rows.map((r) => r.text)).join(' ');
    expect(text, 'the card it owns').contains('Investors');
    expect(text, 'the even-generation half').contains('Even generation');
    expect(text, 'and the odd-generation half').contains('Odd generation');
    // The human Utopia Invest starts with 40 M€, gains steel + titanium
    // production and trades a production step for 4 resources — none of that.
    expect(text).not.contains('40');
    expect(text).not.match(/production/i);
  });

  it('TerraLabs prints its TR price and its recurring card, never the human card discount', () => {
    const groups = marsBotCorpAnnotations(MarsBotCorpId.C38_TERRALABS);
    expect(groups.map((g) => g.labelKey)).deep.eq(['Corporation setup', 'Before action phase']);
    const text = groups.flatMap((g) => g.rows.map((r) => r.text)).join(' ');
    expect(text, 'the printed price').contains('8');
    expect(text, 'what it buys').contains('action deck');
    expect(text, 'and the late doubling').contains('9');
    // The human TerraLabs Research starts with 14 M€, loses ONE TR and buys
    // cards to HAND for 1 M€ — the bot has no hand and none of that is here.
    expect(text).not.contains('14');
    expect(text).not.match(/to hand|buying cards/i);
  });

  it('Pristar prints the four cancelled parameters, never the human preservation VP', () => {
    const groups = marsBotCorpAnnotations(MarsBotCorpId.C36_PRISTAR);
    expect(groups.map((g) => g.labelKey)).deep.eq(['Corporation effect', 'Before action phase']);
    const text = groups.flatMap((g) => g.rows.map((r) => r.text)).join(' ');
    expect(text, 'the four printed actions').contains('temperature');
    expect(text, 'what it pays instead').contains('6 M€');
    expect(text, 'and what does NOT happen').contains('global parameter');
    expect(text, 'the box that re-arms it').contains('white cube');
    // The human Pristar starts with 53 M€, LOSES 2 TR and scores 1 VP per
    // preservation resource — none of that is here.
    expect(text).not.contains('53');
    expect(text).not.match(/VP|preservation/i);
    // The mechanics zone draws the four parameters STRUCK THROUGH — the
    // human card's own idiom for «this does not happen».
    const face = mountFace(MarsBotCorpId.C36_PRISTAR);
    expect(face.findAll('.pcard-mi--cancelled'), 'temperature, oxygen, ocean, Venus').has.length(4);
  });

  it('Tycho Magnetics prints its one waiting card, never the human energy engine', () => {
    const groups = marsBotCorpAnnotations(MarsBotCorpId.C46_TYCHO_MAGNETICS);
    expect(groups.map((g) => g.labelKey)).deep.eq(['Draft priority', 'Corporation setup']);
    const text = groups.flatMap((g) => g.rows.map((r) => r.text)).join(' ');
    expect(text).contains('Interface Hyperlink');
    expect(text, 'the disposition is the whole point').contains('BOTTOM');
    expect(text, 'and the draw is the power track').contains('power track');
    // The human Tycho Magnetics starts with 48 M€ and its action buys cards
    // with heat — none of that is here.
    expect(text).not.contains('48');
    expect(text).not.match(/heat|spend energy/i);
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
