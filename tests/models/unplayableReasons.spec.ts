import {expect} from 'chai';
import {testGame} from '../TestGame';
import {setTemperature, addOcean} from '../TestingUtils';
import {Resource} from '../../src/common/Resource';
import {Tag} from '../../src/common/cards/Tag';
import {CardName} from '../../src/common/cards/CardName';
import {MAX_TEMPERATURE} from '../../src/common/constants';
import {unplayableReasons} from '../../src/server/models/unplayableReasons';
import {GeneRepair} from '../../src/server/cards/base/GeneRepair';
import {ArchaeBacteria} from '../../src/server/cards/base/ArchaeBacteria';
import {LakeMarineris} from '../../src/server/cards/base/LakeMarineris';
import {AdaptationTechnology} from '../../src/server/cards/base/AdaptationTechnology';
import {SpecialDesign} from '../../src/server/cards/base/SpecialDesign';
import {EcologyExperts} from '../../src/server/cards/prelude/EcologyExperts';
import {Inventrix} from '../../src/server/cards/corporation/Inventrix';
import {MorningStarInc} from '../../src/server/cards/venusNext/MorningStarInc';
import {ThinkTank} from '../../src/server/cards/pathfinders/ThinkTank';
import {Livestock} from '../../src/server/cards/base/Livestock';
import {StarVegas} from '../../src/server/cards/underworld/StarVegas';
import {CloudSeeding} from '../../src/server/cards/base/CloudSeeding';
import {RoboticWorkforce} from '../../src/server/cards/base/RoboticWorkforce';
import {AerosportTournament} from '../../src/server/cards/venusNext/AerosportTournament';
import {StratosphericBirds} from '../../src/server/cards/venusNext/StratosphericBirds';
import {Moss} from '../../src/server/cards/base/Moss';
import {Insulation} from '../../src/server/cards/base/Insulation';
import {EcologicalZone} from '../../src/server/cards/base/EcologicalZone';
import {IndustrialCenter} from '../../src/server/cards/base/IndustrialCenter';
import {MiningRights} from '../../src/server/cards/base/MiningRights';
import {SpaceBonus} from '../../src/common/boards/SpaceBonus';
import {TileType} from '../../src/common/TileType';

describe('unplayableReasons', () => {
  it('returns no reasons for a playable card', () => {
    const [/* game */, player] = testGame(2);
    player.tagsForTest = {science: 3};
    player.megaCredits = 20;
    expect(unplayableReasons(player, new GeneRepair())).has.length(0);
  });

  it('reports an affordability gap in M€', () => {
    const [/* game */, player] = testGame(2);
    player.tagsForTest = {science: 3}; // requirement satisfied → cost is the only blocker
    player.megaCredits = 0;
    const reasons = unplayableReasons(player, new GeneRepair());
    const mc = reasons.find((r) => r.type === 'megacredits');
    expect(mc, 'expected a megacredits reason').is.not.undefined;
    expect(mc?.params?.[0]).eq('12'); // GeneRepair cost
  });

  it('reports an unmet tag requirement with the current count', () => {
    const [/* game */, player] = testGame(2);
    player.megaCredits = 100; // affordable → tag requirement is the only blocker
    const reasons = unplayableReasons(player, new GeneRepair());
    const tag = reasons.find((r) => r.type === 'tag');
    expect(tag, 'expected a tag reason').is.not.undefined;
    expect(tag?.current).eq(0);
    expect(tag?.params?.[0]).eq('3'); // requires 3 science tags
  });

  it('reports an unmet global parameter (max temperature)', () => {
    const [game, player] = testGame(2);
    player.megaCredits = 10;
    setTemperature(game, -16); // ArchaeBacteria requires -18C or colder
    const reasons = unplayableReasons(player, new ArchaeBacteria());
    expect(reasons.some((r) => r.type === 'globalParameter'), 'expected a globalParameter reason').is.true;
  });

  it('reports an unmet floaters requirement with a specific label (not generic)', () => {
    const [/* game */, player] = testGame(2);
    player.megaCredits = 50;
    const reasons = unplayableReasons(player, new AerosportTournament());
    const f = reasons.find((r) => r.message === 'Requires ${0} floater(s)');
    expect(f, 'expected a specific floaters reason').is.not.undefined;
    expect(f?.params?.[0]).eq('5');
    expect(f?.current).eq(0);
  });

  it('names the resource when no production can be reduced (target reason)', () => {
    const [/* game */, player] = testGame(2); // not solo → decreaseAnyProduction is checked
    player.megaCredits = 50;
    const reasons = unplayableReasons(player, new CloudSeeding());
    const t = reasons.find((r) => r.type === 'target');
    expect(t, 'expected a target reason').is.not.undefined;
    expect(t?.resource).eq(Resource.HEAT);
  });

  it('explains Robotic Workforce has no card with the building symbol to copy (bespoke hook)', () => {
    const [/* game */, player] = testGame(2);
    player.megaCredits = 50; // affordable → only the bespoke reason
    const reasons = unplayableReasons(player, new RoboticWorkforce());
    const t = reasons.find((r) => r.message === 'No played card with the building symbol to copy production from');
    expect(t, 'expected the copy-target reason').is.not.undefined;
    expect(t?.type).eq('target');
    expect(t?.tag).eq(Tag.BUILDING); // popover renders the building symbol
  });

  it('surfaces BOTH affordability and the bespoke block together', () => {
    const [/* game */, player] = testGame(2);
    player.megaCredits = 0; // cannot afford AND nothing to copy
    const reasons = unplayableReasons(player, new RoboticWorkforce());
    expect(reasons.some((r) => r.type === 'megacredits'), 'expected an affordability reason').is.true;
    expect(
      reasons.some((r) => r.message === 'No played card with the building symbol to copy production from'),
      'expected the copy-target reason alongside it').is.true;
  });

  it('explains Stratospheric Birds needs a floater to spend (bespoke hook)', () => {
    const [/* game */, player] = testGame(2);
    player.megaCredits = 50; // affordable; no card holds a floater
    const reasons = unplayableReasons(player, new StratosphericBirds());
    expect(reasons.some((r) => r.message === 'Not enough floaters'), 'expected the floater reason').is.true;
  });

  it('explains Moss needs plants to lose (not the generic fallback)', () => {
    const [/* game */, player] = testGame(2);
    addOcean(player);
    addOcean(player);
    addOcean(player); // oceans:3 requirement satisfied → plants are the only blocker
    player.plants = 0;
    player.megaCredits = 10;
    const reasons = unplayableReasons(player, new Moss());
    const r = reasons.find((x) => x.message === 'Not enough plants');
    expect(r, 'expected the not-enough-plants reason').is.not.undefined;
    expect(r?.resource).eq(Resource.PLANTS);
    expect(r?.current).eq(0);
    expect(reasons.some((x) => x.message === 'Card is unavailable due to unmet conditions'), 'no generic fallback').is.false;
  });

  it('explains Insulation needs heat production (bespoke hook)', () => {
    const [/* game */, player] = testGame(2);
    player.megaCredits = 10; // production.heat defaults to 0
    const reasons = unplayableReasons(player, new Insulation());
    expect(reasons.some((r) => r.message === 'No heat production'), 'expected the heat-production reason').is.true;
  });

  it('explains Ecological Zone has no space adjacent to a greenery (bespoke placement hook)', () => {
    const [/* game */, player] = testGame(2);
    player.megaCredits = 20;
    const reasons = unplayableReasons(player, new EcologicalZone());
    expect(reasons.some((r) => r.type === 'placement' && r.message === 'No space adjacent to a greenery'),
      'expected the greenery-placement reason').is.true;
  });

  it('explains Industrial Center has no space adjacent to a city (bespoke placement hook)', () => {
    const [/* game */, player] = testGame(2);
    player.megaCredits = 20; // no cities on the board → nowhere to place
    const reasons = unplayableReasons(player, new IndustrialCenter());
    expect(reasons.some((r) => r.type === 'placement' && r.message === 'No space adjacent to a city'),
      'expected the city-adjacency placement reason').is.true;
  });

  describe('requirement attainability', () => {
    it('an unmet MINIMUM stays open (no unattainable flag) and reports the raw scale value', () => {
      const [game, player] = testGame(2);
      player.megaCredits = 50;
      setTemperature(game, -22); // Lake Marineris requires 0°C
      const reasons = unplayableReasons(player, new LakeMarineris());
      const r = reasons.find((x) => x.type === 'globalParameter');
      expect(r, 'expected the temperature requirement reason').is.not.undefined;
      expect(r?.requirement).is.true;
      expect(r?.unattainable).is.undefined;
      expect(r?.current).eq(-22); // the HUD number, not the bonus-adjusted score
      expect(r?.params?.[0]).eq('0');
    });

    it('a passed MAXIMUM with no way back down is unattainable (no Turmoil in the game)', () => {
      const [game, player] = testGame(2);
      player.megaCredits = 50;
      setTemperature(game, -14); // ArchaeBacteria allows -18°C or colder
      const reasons = unplayableReasons(player, new ArchaeBacteria());
      const r = reasons.find((x) => x.type === 'globalParameter');
      expect(r, 'expected the temperature requirement reason').is.not.undefined;
      expect(r?.unattainable).is.true;
      expect(r?.current).eq(-14);
    });

    it('a value exactly on the bound satisfies the requirement (no reason at all)', () => {
      const [game, player] = testGame(2);
      player.megaCredits = 50;
      setTemperature(game, -18);
      expect(unplayableReasons(player, new ArchaeBacteria())).has.length(0);
    });

    it('Adaptation Technology stretches the max bound: one step over is NOT even reported', () => {
      const [game, player] = testGame(2);
      player.megaCredits = 50;
      player.playedCards.push(new AdaptationTechnology());
      setTemperature(game, -16); // raw -16 > -18, but the +2-step bonus makes -16-4 = -20 ≤ -18
      expect(unplayableReasons(player, new ArchaeBacteria())).has.length(0);
    });

    it('modifiers stack: Adaptation Technology + Inventrix together cover a 4-step gap', () => {
      const [game, player] = testGame(2);
      player.megaCredits = 50;
      player.playedCards.push(new AdaptationTechnology());
      player.playedCards.push(new Inventrix());
      setTemperature(game, -10); // -10 - (2+2 steps × 2°C) = -18 ≤ -18 → satisfied
      expect(unplayableReasons(player, new ArchaeBacteria())).has.length(0);
    });

    it('an insufficient modifier keeps the unattainable verdict and reports the effective bound', () => {
      const [game, player] = testGame(2);
      player.megaCredits = 50;
      player.playedCards.push(new AdaptationTechnology());
      setTemperature(game, -10); // -10 - 4 = -14 > -18 → still short even with the bonus
      const reasons = unplayableReasons(player, new ArchaeBacteria());
      const r = reasons.find((x) => x.type === 'globalParameter');
      expect(r?.unattainable).is.true;
      expect(r?.effectiveCount).eq(-14); // -18 stretched up by the +2-step bonus
      expect(r?.current).eq(-10);
    });

    it('a requirement the player can IGNORE (Ecology Experts armed) is not reported at all', () => {
      const [game, player] = testGame(2);
      player.megaCredits = 5; // cost still blocks → the card stays unplayable
      const experts = new EcologyExperts();
      player.playedCards.push(experts);
      player.lastCardPlayed = CardName.ECOLOGY_EXPERTS;
      setTemperature(game, -22);
      const reasons = unplayableReasons(player, new LakeMarineris());
      expect(reasons.some((r) => r.requirement === true), 'no requirement reason while ignorable').is.false;
      expect(reasons.some((r) => r.type === 'megacredits'), 'the money gap still reported').is.true;
    });

    it('an ARMED Special Design counts for the check and is not consumed by it', () => {
      const [game, player] = testGame(2);
      player.megaCredits = 50;
      player.playedCards.push(new SpecialDesign());
      player.lastCardPlayed = CardName.SPECIAL_DESIGN;
      setTemperature(game, -16); // -16 - 4 = -20 ≤ -18 → the armed bonus satisfies the max bound
      expect(unplayableReasons(player, new ArchaeBacteria())).has.length(0);
      // Read-only with respect to the armed state: still armed, same verdict twice.
      expect(player.lastCardPlayed).eq(CardName.SPECIAL_DESIGN);
      expect(unplayableReasons(player, new ArchaeBacteria())).has.length(0);
    });

    it('a modifier scoped to another parameter does not soften the verdict (Morning Star vs temperature)', () => {
      const [game, player] = testGame(2);
      player.megaCredits = 50;
      player.playedCards.push(new MorningStarInc()); // ±2 steps, VENUS only
      setTemperature(game, -14);
      const reasons = unplayableReasons(player, new ArchaeBacteria());
      const r = reasons.find((x) => x.type === 'globalParameter');
      expect(r?.unattainable).is.true;
      expect(r?.effectiveCount, 'venus-scoped bonus contributes nothing to temperature').is.undefined;
    });

    it('with Turmoil in the game the parameter can come back down → stays "not met yet"', () => {
      const [game, player] = testGame(2, {turmoilExtension: true});
      player.megaCredits = 50;
      setTemperature(game, -14);
      const reasons = unplayableReasons(player, new ArchaeBacteria());
      const r = reasons.find((x) => x.type === 'globalParameter');
      expect(r, 'expected the temperature requirement reason').is.not.undefined;
      expect(r?.unattainable).is.undefined;
    });

    it('a maxed-out scale is frozen even in a Turmoil game → unattainable again', () => {
      const [game, player] = testGame(2, {turmoilExtension: true});
      player.megaCredits = 50;
      setTemperature(game, MAX_TEMPERATURE); // Game.increaseTemperature ignores decreases at MAX
      const reasons = unplayableReasons(player, new ArchaeBacteria());
      const r = reasons.find((x) => x.type === 'globalParameter');
      expect(r?.unattainable).is.true;
    });

    it('an in-play Think Tank keeps the door open (its data stock can still grow)', () => {
      const [game, player] = testGame(2);
      player.megaCredits = 50;
      player.playedCards.push(new ThinkTank()); // 0 data right now — not enough to bridge
      setTemperature(game, -14);
      const reasons = unplayableReasons(player, new ArchaeBacteria());
      const r = reasons.find((x) => x.type === 'globalParameter');
      expect(r, 'the requirement is still unmet today').is.not.undefined;
      expect(r?.unattainable, 'but never final while Think Tank is on the table').is.undefined;
    });

    /**
     * The address links a reason to the RULES block that states the same
     * requirement, so the fullscreen can print it once. It must equal the id
     * `buildCardInformation.requirementBlock` produces — `req:<type>` plus a
     * tag / resource qualifier — and must be ABSENT whenever the printed rule
     * says more than the reason does.
     */
    it('carries the RULES-BLOCK address of the requirement it restates', () => {
      const [game, player] = testGame(2);
      player.megaCredits = 100;
      setTemperature(game, -22);
      const temp = unplayableReasons(player, new LakeMarineris()).find((r) => r.type === 'globalParameter');
      expect(temp?.requirementKey).eq('req:C'); // RequirementType.TEMPERATURE
      const tag = unplayableReasons(player, new GeneRepair()).find((r) => r.type === 'tag');
      expect(tag?.requirementKey).eq('req:tag:science'); // qualified by the tag
    });

    it('a SITUATIONAL reason carries no address — a blocked effect never hides its own rule', () => {
      const [/* game */, player] = testGame(2);
      player.megaCredits = 100;
      const reasons = unplayableReasons(player, new Livestock());
      const production = reasons.find((r) => r.message === 'Cannot reduce production');
      expect(production, 'the blocked on-play effect is reported').is.not.undefined;
      expect(production?.requirementKey, 'but it addresses no rules block').is.undefined;
      // …while the oxygen REQUIREMENT beside it does address one.
      expect(reasons.find((r) => r.type === 'globalParameter')?.requirementKey).eq('req:O2');
    });

    it('an ALL-players requirement keeps its rule (the reason omits «any player»)', () => {
      const [/* game */, player] = testGame(2, {underworldExpansion: true});
      player.megaCredits = 100;
      // Star Vegas: «Requires 3 city tiles (any player)» — the reason says only
      // «Requires 3 city tile(s)», so the printed rule must stay visible.
      const cities = unplayableReasons(player, new StarVegas()).find((r) => r.type === 'count');
      expect(cities, 'the city requirement is reported').is.not.undefined;
      expect(cities?.requirementKey, 'an «any player» requirement is not fully restated').is.undefined;
    });

    it('a tag shortfall is a requirement reason but never unattainable', () => {
      const [/* game */, player] = testGame(2);
      player.megaCredits = 100;
      const reasons = unplayableReasons(player, new GeneRepair());
      const tag = reasons.find((r) => r.type === 'tag');
      expect(tag?.requirement).is.true;
      expect(tag?.unattainable).is.undefined;
    });
  });

  it('explains Mining Rights has no steel/titanium-bonus space (bespoke placement hook)', () => {
    const [game, player] = testGame(2);
    player.megaCredits = 20;
    // Occupy every steel/titanium-bonus land cell so none remain available.
    for (const space of game.board.spaces) {
      if (space.tile === undefined && (space.bonus.includes(SpaceBonus.STEEL) || space.bonus.includes(SpaceBonus.TITANIUM))) {
        space.tile = {tileType: TileType.CITY};
      }
    }
    const reasons = unplayableReasons(player, new MiningRights());
    expect(reasons.some((r) => r.type === 'placement' && r.message === 'No space with a steel or titanium bonus'),
      'expected the bonus-space placement reason').is.true;
  });
});
