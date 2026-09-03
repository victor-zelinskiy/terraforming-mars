import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import PremiumCard from '@/client/components/premiumCard/PremiumCard.vue';
import PremiumCardArt from '@/client/components/premiumCard/PremiumCardArt.vue';
import {byType, getCards} from '@/client/cards/ClientCardManifest';
import {CardType} from '@/common/cards/CardType';
import {premiumCardArt} from '@/client/cards/cardArt';
import {isPremiumFaceType} from '@/client/components/premiumCard/premiumCardTheme';

function model(name: CardName, overrides: Partial<CardModel> = {}): CardModel {
  return {name, ...overrides} as CardModel;
}

describe('PremiumCard', () => {
  it('renders the crimson event face with cost, tags and mechanics', () => {
    const wrapper = mount(PremiumCard, {props: {card: model(CardName.COMET)}});
    expect(wrapper.classes()).to.include('pcard--theme-crimson');
    expect(wrapper.find('.pcard__cost-value').text()).to.eq('21');
    expect(wrapper.find('.pcard__cost-delta').exists()).to.eq(false);
    expect(wrapper.findAll('.pcard-tag').length).to.be.greaterThan(0); // event tag appended
    expect(wrapper.findAll('.pcard-mech-group').length).to.be.greaterThan(0);
    expect(wrapper.find('.pcard__title span').text()).to.not.eq('');
  });

  it('shows the discount mini-chip when calculatedCost differs', () => {
    const wrapper = mount(PremiumCard, {props: {card: model(CardName.COMET, {calculatedCost: 17})}});
    const delta = wrapper.find('.pcard__cost-delta');
    expect(delta.exists()).to.eq(true);
    expect(delta.text()).to.eq('−4');
    // printed cost stays on the badge
    expect(wrapper.find('.pcard__cost-value').text()).to.eq('21');
  });

  it('prelude face: no cost badge, prelude theme', () => {
    const wrapper = mount(PremiumCard, {props: {card: model(CardName.DONATION)}});
    expect(wrapper.classes()).to.include('pcard--theme-prelude');
    expect(wrapper.find('.pcard__cost-badge').exists()).to.eq(false);
  });

  it('carries live resources and unavailable state', () => {
    const wrapper = mount(PremiumCard, {props: {card: model(CardName.PREDATORS, {resources: 3, isDisabled: true})}});
    expect(wrapper.find('.pcard__res-count').text()).to.eq('3');
    expect(wrapper.classes()).to.include('pcard--unavailable');
    expect(wrapper.classes()).to.include('pcard--theme-azure');
  });

  /*
   * A corporation resolves ONLY to real per-card art (premiumCardViewModel
   * `resolveArt`): with an illustration it renders like any other card, without
   * one the identity zone carries the brand wordmark. Both corporations are
   * DERIVED from the art manifest rather than named — the manifest is generated
   * by `make:cards`, so a hardcoded name silently changes what the test asserts
   * the day that card gets art (which is exactly how this spec broke).
   */
  const corporations = getCards(byType(CardType.CORPORATION));
  const corpWithoutArt = corporations.find((c) => premiumCardArt(c.name).fallback)?.name;
  const corpWithArt = corporations.find((c) => !premiumCardArt(c.name).fallback)?.name;

  it('corporation face: no cost badge, and the identity zone hosts the wordmark when there is no art', () => {
    expect(corpWithoutArt, 'a corporation with no illustration of its own').to.not.eq(undefined);
    const wrapper = mount(PremiumCard, {props: {card: model(corpWithoutArt!)}});
    expect(wrapper.classes()).to.include('pcard--theme-corporation');
    expect(wrapper.find('.pcard__cost-badge').exists()).to.eq(false);
    expect(wrapper.findComponent(PremiumCardArt).exists()).to.eq(false);
    // the identity zone hosts the EXISTING wordmark system inside the stage
    expect(wrapper.find('.pcard-corp .pcard-corp-stage .card-corporation-logo').exists()).to.eq(true);
  });

  it('corporation face: a corporation WITH its own illustration shows it like any card', () => {
    expect(corpWithArt, 'a corporation with real art').to.not.eq(undefined);
    const wrapper = mount(PremiumCard, {props: {card: model(corpWithArt!)}});
    expect(wrapper.classes()).to.include('pcard--theme-corporation');
    expect(wrapper.find('.pcard__cost-badge').exists()).to.eq(false);
    expect(wrapper.findComponent(PremiumCardArt).exists()).to.eq(true);
  });

  it('corporation face: the flattened corp box renders as ordinary mech groups', () => {
    // Helion: a starting row + an effect — two groups, whichever face it wears.
    const wrapper = mount(PremiumCard, {props: {card: model(CardName.HELION)}});
    expect(wrapper.findAll('.pcard-mech-group').length).to.be.greaterThan(1);
  });

  /* ── CEO face (desktop-removal wave 4) ─────────────────────────────── */
  it('CEO face: ceo theme, no cost badge, the procedural identity band (no art ships for the type)', () => {
    const wrapper = mount(PremiumCard, {props: {card: model(CardName.ASIMOV)}});
    expect(wrapper.classes()).to.include('pcard--theme-ceo');
    expect(wrapper.find('.pcard__cost-badge').exists()).to.eq(false);
    expect(wrapper.findComponent(PremiumCardArt).exists()).to.eq(false);
    expect(wrapper.find('.pcard-corp').exists()).to.eq(false);
    expect(wrapper.find('.pcard-ceo-ident').exists()).to.eq(true);
  });

  it('CEO face: the prose zone prints the rule with its length tier — never clipped away', () => {
    const wrapper = mount(PremiumCard, {props: {card: model(CardName.ASIMOV)}});
    const prose = wrapper.find('.pcard__prose');
    expect(prose.exists()).to.eq(true);
    expect(prose.text()).to.contain('Once per game');
    expect(prose.classes().some((c) => /^pcard__prose--t[1-4]$/.test(c)), 'a length tier class').to.eq(true);
  });

  it('CEO face: the once-per-game marker renders premium-native («1×» + arrow), and NO play rail ever draws', () => {
    const wrapper = mount(PremiumCard, {props: {card: model(CardName.ASIMOV)}});
    expect(wrapper.find('.pcard-opg').exists()).to.eq(true);
    expect(wrapper.find('.pcard-opg__badge').text()).to.eq('1×');
    // no «при розыгрыше» rail on a CEO — its trailing rows are the OPG block…
    expect(wrapper.find('.pcard-play-rail').exists()).to.eq(false);
    // …while a project card with on-play mechanics keeps the rail.
    const comet = mount(PremiumCard, {props: {card: model(CardName.COMET)}});
    expect(comet.find('.pcard-play-rail').exists()).to.eq(true);
  });

  it('CEO face: the spent OPG (isDisabled) reads through the shared unavailable treatment', () => {
    const wrapper = mount(PremiumCard, {props: {card: model(CardName.ASIMOV, {isDisabled: true})}});
    expect(wrapper.classes()).to.include('pcard--unavailable');
  });

  it('CEO face: Duncan (the one VP CEO) prints the «?» badge over a prose zone that yields to it', () => {
    const wrapper = mount(PremiumCard, {props: {card: model(CardName.DUNCAN)}});
    expect(wrapper.find('.pcard__vp').text()).to.eq('?');
    expect(wrapper.classes()).to.include('pcard--vp-compact');
    expect(wrapper.find('.pcard__prose').exists()).to.eq(true);
  });

  it('CEO peek face: corpus + header only — no identity band, no prose', () => {
    const wrapper = mount(PremiumCard, {props: {name: CardName.ASIMOV, inert: true, peek: true}});
    expect(wrapper.classes()).to.include('pcard--theme-ceo');
    expect(wrapper.find('.pcard-ceo-ident').exists()).to.eq(false);
    expect(wrapper.find('.pcard__prose').exists()).to.eq(false);
  });

  it('CEO corpus mount sweep: every L-card renders the premium face without a fallback chip', () => {
    // The VM sweep (premiumCardViewModel.spec) proves every CEO BUILDS; this
    // one proves every CEO RENDERS — a template-level exception or an
    // unmapped icon degrading to the dashed chip fails here by name.
    const ceos = getCards(byType(CardType.CEO));
    expect(ceos.length).to.be.greaterThan(35);
    const offenders: Array<string> = [];
    for (const ceo of ceos) {
      const wrapper = mount(PremiumCard, {props: {name: ceo.name, inert: true}});
      if (!wrapper.classes().includes('pcard--theme-ceo') || wrapper.find('.pcard-mi__chip').exists()) {
        offenders.push(ceo.name);
      }
      wrapper.unmount();
    }
    expect(offenders, `CEOs that failed to render premium cleanly:\n${offenders.join('\n')}`).to.deep.eq([]);
  });

  it('static name-only mode renders the pristine printed face', () => {
    const wrapper = mount(PremiumCard, {props: {name: CardName.COMET, inert: true}});
    expect(wrapper.classes()).to.include('pcard--theme-crimson');
    expect(wrapper.find('.pcard__res').exists()).to.eq(false);
    expect(wrapper.classes()).to.not.include('pcard--interactive');
  });

  it('a resource-capable card renders its capsule EVEN WITHOUT a live model (the zone is card anatomy — no host-dependent layout jump)', () => {
    // Same card, two hosts: name-only (a deck viewer, the hand album's static
    // face) and a live model. The capsule — and with it the `--pcard-res-safe`
    // reserve the mechanics rows centre against — must exist in BOTH, or the
    // card's graphics re-centre depending on where it is drawn.
    const printed = mount(PremiumCard, {props: {name: CardName.PREDATORS, inert: true}});
    expect(printed.find('.pcard__res').exists()).to.eq(true);
    expect(printed.find('.pcard__res-count').text()).to.eq('0');
    expect(printed.classes()).to.include('pcard--has-res');
    const live = mount(PremiumCard, {props: {card: model(CardName.PREDATORS, {resources: 2})}});
    expect(live.find('.pcard__res-count').text()).to.eq('2');
    expect(live.classes()).to.include('pcard--has-res');
    printed.unmount();
    live.unmount();
  });

  it('VP-only card renders without a mechanics panel', () => {
    const wrapper = mount(PremiumCard, {props: {card: model(CardName.DUST_SEALS)}});
    expect(wrapper.find('.pcard__mech').exists()).to.eq(false);
    expect(wrapper.find('.pcard__vp').exists()).to.eq(true);
  });

  it('header layering: full-width nameplate + overlay-driven text safe-areas', () => {
    // Comet: cost badge + 2 tags (space + event) → cluster width 64 → safe-r 82.
    const wrapper = mount(PremiumCard, {props: {card: model(CardName.COMET)}});
    expect(wrapper.find('.pcard-nameplate').exists()).to.eq(true);
    const style = wrapper.attributes('style') ?? '';
    expect(style).to.contain('--pcard-title-safe-l: 50px');
    expect(style).to.contain('--pcard-title-safe-r: 82px');
    // discount widens ONLY the left safe-area
    const discounted = mount(PremiumCard, {props: {card: model(CardName.COMET, {calculatedCost: 17})}});
    expect(discounted.attributes('style') ?? '').to.contain('--pcard-title-safe-l: 84px');
    expect(discounted.classes()).to.include('pcard--cost-mod');
  });

  it('default DSL amounts (-1 = unspecified) never leak a «−1» digit', () => {
    // Herbivores: «greenery : animal» effect + «−1 plant production» — every
    // icon uses the builder default amount (-1). The digit shows ONLY on an
    // explicit showDigit (legacy semantics); negativity rides MINUS symbols.
    const wrapper = mount(PremiumCard, {props: {card: model(CardName.HERBIVORES)}});
    expect(wrapper.text()).to.not.contain('−1');
    expect(wrapper.text()).to.not.contain('-1');
  });

  it('peek face: corpus + header + requirements rail only — no art <img>, no lower section', () => {
    // Predators has requirements — the rail's top pixels live inside the
    // peek band, so the peek face must keep it.
    const wrapper = mount(PremiumCard, {props: {name: CardName.PREDATORS, inert: true, peek: true}});
    expect(wrapper.find('.pcard-nameplate').exists()).to.eq(true);
    expect(wrapper.find('.pcard__cost-badge').exists()).to.eq(true);
    expect(wrapper.find('.pcard__reqs').exists()).to.eq(true);
    expect(wrapper.find('.pcard__art').exists()).to.eq(false);
    expect(wrapper.find('.pcard__lower').exists()).to.eq(false);
    // The box + theme classes stay those of the full face (pixel-true band).
    expect(wrapper.classes()).to.include('pcard--theme-azure');
  });

  it('peek face: a requirement-less card keeps the divider; a corporation skips its identity zone', () => {
    const comet = mount(PremiumCard, {props: {name: CardName.COMET, inert: true, peek: true}});
    expect(comet.find('.pcard__divider').exists()).to.eq(true);
    expect(comet.find('.pcard__art').exists()).to.eq(false);
    const corp = mount(PremiumCard, {props: {name: CardName.HELION, inert: true, peek: true}});
    expect(corp.find('.pcard-corp').exists()).to.eq(false);
    expect(corp.find('.pcard__lower').exists()).to.eq(false);
    expect(corp.classes()).to.include('pcard--theme-corporation');
  });

  /**
   * THE WORD «ИЛИ», PRINTED TWICE. Rotator Impacts opens its second action box
   * with the DSL connector `or()`, and the panel ALSO draws the «ИЛИ» divider
   * between two action groups — so the face said «ИЛИ» on the divider and again
   * inside the box directly below it. The connector belongs to the divider; the
   * mechanics plate must never render a bare OR glyph of its own.
   */
  it('an `or`-action face prints the choice word ONCE (Rotator Impacts)', () => {
    for (const name of [CardName.ROTATOR_IMPACTS, CardName.WEATHER_BALLOONS, CardName.ICY_IMPACTORS, CardName.EXTRACTOR_BALLOONS]) {
      const wrapper = mount(PremiumCard, {props: {name, inert: true}});
      expect(wrapper.findAll('.pcard-mech-or').length, `${name}: exactly one ИЛИ divider`).to.eq(1);
      expect(wrapper.findAll('.pcard-sym--or').length, `${name}: a SECOND «или» is drawn inside the box`).to.eq(0);
      wrapper.unmount();
    }
  });

  it('an inert/static face plants no teleport anchors in body; a live face does', () => {
    const before = document.body.childNodes.length;
    const inert = mount(PremiumCard, {props: {name: CardName.COMET, inert: true}});
    expect(document.body.childNodes.length).to.eq(before);
    inert.unmount();
    const live = mount(PremiumCard, {props: {card: model(CardName.COMET)}});
    expect(document.body.childNodes.length).to.be.greaterThan(before);
    live.unmount();
    expect(document.body.childNodes.length).to.eq(before);
  });

  /**
   * The DSL's `megacredits(1, {text: '2x'})` item option lands on `innerText`
   * (`text` is set only by `.plate()`/`.text()`, which never build an M€ item).
   * Reading only `text` printed the placeholder amount — Energy Market's «2x M€
   * per energy» face read a flat «1», i.e. the wrong price on the card itself.
   */
  it('a variable M€ face shows its override text, not the placeholder amount', () => {
    const market = mount(PremiumCard, {props: {name: CardName.ENERGY_MARKET, inert: true}});
    const insides = market.findAll('.pcard-mi__inside').map((n) => n.text());
    expect(insides).to.include('2x');
    expect(insides).to.not.include('1');
    // the OTHER branch of the same card keeps its real fixed amount
    expect(insides).to.include('8');
    // '?' (unknown amount) and '0' (a floor, not "one M€") are the other shapes
    expect(mount(PremiumCard, {props: {name: CardName.PLAYWRIGHTS, inert: true}})
      .findAll('.pcard-mi__inside').map((n) => n.text())).to.include('?');
    expect(mount(PremiumCard, {props: {name: CardName.NIRGAL_ENTERPRISES, inert: true}})
      .findAll('.pcard-mi__inside').map((n) => n.text())).to.include('0');
  });

  it('lower anchors: VP variant class reserves the panel column', () => {
    const formula = mount(PremiumCard, {props: {card: model(CardName.SEARCH_FOR_LIFE)}});
    expect(formula.classes()).to.include('pcard--vp-formula');
    const compact = mount(PremiumCard, {props: {card: model(CardName.DUST_SEALS)}});
    expect(compact.classes()).to.include('pcard--vp-compact');
    const wide = mount(PremiumCard, {props: {card: model(CardName.WATER_IMPORT_FROM_EUROPA)}});
    expect(wide.classes()).to.include('pcard--vp-wide');
    // no VP → no reserve class at all
    const none = mount(PremiumCard, {props: {card: model(CardName.COMET)}});
    expect(none.classes().some((c) => c.startsWith('pcard--vp-'))).to.eq(false);
  });

  /*
   * VP BADGE GRAMMAR — the badge must SAY the relation, never leave the
   * player to infer it from adjacency. One case per shape the corpus prints.
   */
  describe('VP badge formula', () => {
    const badge = (name: CardName) => mount(PremiumCard, {props: {card: model(name)}}).find('.pcard__vp');

    it('«N per each» prints the operator between the amount and its subject', () => {
      const vp = badge(CardName.WATER_IMPORT_FROM_EUROPA);
      expect(vp.findAll('.pcard__vp-value').map((n) => n.text())).to.deep.eq(['1']);
      expect(vp.find('.pcard__vp-slash').text()).to.eq('/');
      expect(vp.findAll('.pcard-ic').length).to.eq(1);
      // «1 / [jovian]» — no stray denominator between the slash and the icon.
      expect(vp.text().replace(/\s+/g, '')).to.eq('1/');
    });

    it('«N per every K» keeps the denominator', () => {
      const vp = badge(CardName.ANTS);
      expect(vp.findAll('.pcard__vp-value').map((n) => n.text())).to.deep.eq(['1', '2']);
      expect(vp.find('.pcard__vp-slash').exists()).to.eq(true);
    });

    it('a per-one builder target copy is not read as a denominator', () => {
      // Luna Mining Hub prints `points === target === 2` for «2 VP PER mine».
      const vp = badge(CardName.LUNA_MINING_HUB);
      expect(vp.findAll('.pcard__vp-value').map((n) => n.text())).to.deep.eq(['2']);
    });

    it('a fixed amount stays a bare numeral — no operator, no icon', () => {
      const vp = badge(CardName.DUST_SEALS);
      expect(vp.find('.pcard__vp-op').exists()).to.eq(false);
      expect(vp.find('.pcard-ic').exists()).to.eq(false);
      expect(vp.text()).to.eq('1');
    });

    it('a one-or-more threshold reads «[icon] : N», never as a rate', () => {
      const vp = badge(CardName.SEARCH_FOR_LIFE);
      expect(vp.find('.pcard__vp-slash').exists()).to.eq(false);
      expect(vp.find('.pcard__vp-colon').text()).to.eq(':');
      expect(vp.find('.pcard__vp-value').text()).to.eq('3');
      // the icon leads — it is the CONDITION, not the thing being counted
      expect(vp.find('.pcard__vp-dyn > *').classes()).to.include('pcard-ic');
    });

    it('a bespoke count prints «?», not a gold zero', () => {
      expect(badge(CardName.AGRICOLA_INC).text()).to.eq('?');
      expect(badge(CardName.RED_CITY).text()).to.eq('?');
    });

    it('a subject-less penalty stays a bare numeral', () => {
      const vp = badge(CardName.LAW_SUIT);
      expect(vp.find('.pcard__vp-op').exists()).to.eq(false);
      expect(vp.text()).to.eq('−1');
    });

    it('vermin keeps its engraved «−1 / [city]»', () => {
      const vp = badge(CardName.VERMIN);
      expect(vp.find('.pcard__vp-slash').text()).to.eq('/');
      expect(vp.find('.pcard-ic').exists()).to.eq(true);
    });

    /*
     * NO DANGLING OPERATOR — a «/» with nothing on its right is worse than no
     * operator at all. Moon / underworld VP subjects have no premium icon
     * mapping yet, and those badges must degrade to the bare amount.
     */
    it('never prints an operator without something on both sides', () => {
      const dynamicVpCards = getCards((c) =>
        isPremiumFaceType(c.type) && typeof c.metadata.victoryPoints === 'object');
      expect(dynamicVpCards.length).to.be.greaterThan(80); // the guard must actually sweep
      const offenders: Array<string> = [];
      for (const card of dynamicVpCards) {
        const vp = mount(PremiumCard, {props: {name: card.name, inert: true}}).find('.pcard__vp');
        if (!vp.exists() || !vp.find('.pcard__vp-op').exists()) {
          continue;
        }
        const hasSubject = vp.find('.pcard-ic').exists() || vp.findAll('.pcard__vp-value').length > 1;
        if (!hasSubject) {
          offenders.push(card.name);
        }
      }
      expect(offenders, offenders.join(', ')).to.deep.eq([]);
    });
  });
});

describe('PremiumCardArt', () => {
  it('one-shot fallback chain: art → -1.webp → procedural body (no loop)', async () => {
    const wrapper = mount(PremiumCardArt, {
      props: {art: {url: 'assets/card-images/001.webp', fallback: false}},
    });
    await wrapper.find('img').trigger('error');
    expect(wrapper.find('img').attributes('src')).to.eq('assets/card-images/-1.webp');
    await wrapper.find('img').trigger('error');
    expect(wrapper.find('img').exists()).to.eq(false);
    expect(wrapper.classes()).to.include('pcard__art--void');
  });

  it('a fallback-art card that errors goes straight to the procedural body', async () => {
    const wrapper = mount(PremiumCardArt, {
      props: {art: {url: 'assets/card-images/-1.webp', fallback: true}},
    });
    await wrapper.find('img').trigger('error');
    expect(wrapper.find('img').exists()).to.eq(false);
  });
});

/* ── ART TIERS + the printed-face VM cache (the tableau perf contract) ──── */
describe('PremiumCard art tiers + printed-face VM cache', () => {
  it('artTier="thumb" points the art at the thumb build of the same picture', () => {
    const wrapper = mount(PremiumCard, {props: {name: CardName.COMET, inert: true, artTier: 'thumb'}});
    const img = wrapper.find('.pcard__art img');
    expect(img.exists()).to.eq(true);
    expect(img.attributes('src')).to.contain('assets/card-images/thumb/');
  });

  it('the default tier stays byte-identical to the historical URL (full)', () => {
    const wrapper = mount(PremiumCard, {props: {name: CardName.COMET, inert: true}});
    const img = wrapper.find('.pcard__art img');
    expect(img.attributes('src')).to.eq(premiumCardArt(CardName.COMET).url);
    expect(img.attributes('src')).to.not.contain('/thumb/');
  });

  it('a missing thumb heals to the FULL file before the shared fallback', async () => {
    const wrapper = mount(PremiumCardArt, {
      props: {art: {url: 'assets/card-images/042.webp', fallback: false}, tier: 'thumb'},
    });
    expect(wrapper.find('img').attributes('src')).to.contain('/thumb/042.webp');
    await wrapper.find('img').trigger('error');
    expect(wrapper.find('img').attributes('src')).to.eq('assets/card-images/042.webp');
    await wrapper.find('img').trigger('error');
    expect(wrapper.find('img').attributes('src')).to.eq('assets/card-images/-1.webp');
    await wrapper.find('img').trigger('error');
    expect(wrapper.find('img').exists()).to.eq(false); // procedural body
  });

  it('a peek face mounts NO art at any tier (the covered-pile contract)', () => {
    const wrapper = mount(PremiumCard, {props: {name: CardName.COMET, inert: true, peek: true, artTier: 'thumb'}});
    expect(wrapper.find('.pcard__art').exists()).to.eq(false);
    expect(wrapper.find('img').exists()).to.eq(false);
  });

  it('printed (name-only) faces SHARE one cached VM; live-model faces never do', () => {
    const a = mount(PremiumCard, {props: {name: CardName.COMET, inert: true}});
    const b = mount(PremiumCard, {props: {name: CardName.COMET, inert: true, artTier: 'thumb'}});
    const vmA = (a.vm as unknown as {vm: object}).vm;
    const vmB = (b.vm as unknown as {vm: object}).vm;
    expect(vmA).to.eq(vmB); // one build per card name per session
    const live = mount(PremiumCard, {props: {card: model(CardName.COMET)}});
    expect((live.vm as unknown as {vm: object}).vm).to.not.eq(vmA);
  });
});
