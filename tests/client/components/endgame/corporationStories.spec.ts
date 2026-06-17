import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {getCard} from '@/client/cards/ClientCardManifest';
import {
  ARCHETYPE_LABEL,
  ARCHETYPE_ENGINE_TEXT,
  corporationProfile,
  registeredCorporationNames,
} from '@/client/components/endgame/corporationStories';

// Every corporation in the project's CURRENT scope (base, Corporate Era, promo, Venus,
// Colonies, Prelude 1). The coverage guard FAILS (listing the gap) if one is unregistered.
const IN_SCOPE: ReadonlyArray<CardName> = [
  // base
  CardName.BEGINNER_CORPORATION, CardName.CREDICOR, CardName.ECOLINE, CardName.HELION,
  CardName.INTERPLANETARY_CINEMATICS, CardName.INVENTRIX, CardName.MINING_GUILD, CardName.PHOBOLOG,
  CardName.THARSIS_REPUBLIC, CardName.THORGATE, CardName.UNITED_NATIONS_MARS_INITIATIVE,
  // corporate era
  CardName.SATURN_SYSTEMS, CardName.TERACTOR,
  // promo
  CardName.ARCADIAN_COMMUNITIES, CardName.ASTRODRILL, CardName.FACTORUM, CardName.PHARMACY_UNION,
  CardName.PHILARES, CardName.MONS_INSURANCE, CardName.RECYCLON, CardName.SPLICE,
  CardName.TYCHO_MAGNETICS, CardName.KUIPER_COOPERATIVE, CardName.POLDERTECH_DUTCH,
  // colonies
  CardName.ARIDOR, CardName.ARKLIGHT, CardName.POLYPHEMOS, CardName.POSEIDON, CardName.STORMCRAFT_INCORPORATED,
  // venus
  CardName.APHRODITE, CardName.CELESTIC, CardName.MANUTECH, CardName.MORNING_STAR_INC, CardName.VIRON,
  // prelude 1
  CardName.CHEUNG_SHING_MARS, CardName.POINT_LUNA, CardName.ROBINSON_INDUSTRIES, CardName.VALLEY_TRUST, CardName.VITOR,
];

describe('corporation registry (Iteration 13)', () => {
  it('covers every in-scope corporation', () => {
    const missing = IN_SCOPE.filter((c) => corporationProfile(c) === undefined);
    expect(missing, `missing from CORPORATION_REGISTRY: ${missing.join(', ')}`).to.have.length(0);
  });

  it('starting capital + type match the card manifest (no hand-authored drift)', () => {
    for (const name of registeredCorporationNames()) {
      const card = getCard(name);
      expect(card, `manifest has ${name}`).to.not.be.undefined;
      expect(card!.type, `${name} is a corporation`).to.eq(CardType.CORPORATION);
      expect(corporationProfile(name)!.startingMegacredits, `${name} starting M€`).to.eq(card!.startingMegaCredits);
    }
  });

  it('every registered archetype has a label + an engine headline', () => {
    for (const name of registeredCorporationNames()) {
      const a = corporationProfile(name)!.archetype;
      expect(ARCHETYPE_LABEL[a], `label for ${a}`).to.be.a('string').and.not.eq('');
      expect(ARCHETYPE_ENGINE_TEXT[a], `engine text for ${a}`).to.be.a('string').and.not.eq('');
    }
  });

  it('only action corporations carry hasAction', () => {
    // hasAction must agree with the manifest (the activatable-action flag).
    for (const name of registeredCorporationNames()) {
      const card = getCard(name);
      expect(corporationProfile(name)!.hasAction, `${name} hasAction`).to.eq(card!.hasAction === true);
    }
  });
});
