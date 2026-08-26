import {expect} from 'chai';
import {DynamicOceanBarrier} from '../../../src/server/cards/delta/DynamicOceanBarrier';
import {DELTA_PROJECT_CARD_MANIFEST} from '../../../src/server/cards/delta/DeltaProjectCardManifest';
import {DeltaProjectExpansion, MAX_TRACK_POSITION} from '../../../src/server/delta/DeltaProjectExpansion';
import {GameCards} from '../../../src/server/GameCards';
import {DEFAULT_GAME_OPTIONS} from '../../../src/server/game/GameOptions';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {TileType} from '../../../src/common/TileType';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {SelectOption} from '../../../src/server/inputs/SelectOption';
import {SimpleDeferredAction} from '../../../src/server/deferredActions/DeferredAction';
import {Priority} from '../../../src/server/deferredActions/Priority';
import {SpaceBonus} from '../../../src/common/boards/SpaceBonus';
import {IGame} from '../../../src/server/IGame';
import {cast, toName} from '../../../src/common/utils/utils';
import {fakeCard, runAllActions} from '../../TestingUtils';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';

/** Every path tag up to `pos`, so the standard rule already admits the step. */
function grantPathTags(player: TestPlayer, pos: number): void {
  const tags = [Tag.BUILDING, Tag.POWER, Tag.EARTH, Tag.SPACE, Tag.SCIENCE,
    Tag.PLANT, Tag.MICROBE, Tag.JOVIAN, Tag.ANIMAL].slice(0, Math.min(pos, 9));
  player.playedCards.push(fakeCard({tags}));
}

/** The first free ocean space, placed by `player` through the real pipeline. */
function placeOcean(game: IGame, player: TestPlayer): void {
  const space = game.board.getAvailableSpacesForOcean(player)[0];
  game.addTile(player, space, {tileType: TileType.OCEAN});
}

describe('DynamicOceanBarrier', () => {
  let card: DynamicOceanBarrier;
  let game: IGame;
  let player: TestPlayer;
  let opponent: TestPlayer;

  beforeEach(() => {
    card = new DynamicOceanBarrier();
    [game, player, opponent] = testGame(2, {deltaProjectExpansion: true});
    player.playedCards.push(card);
  });

  describe('metadata', () => {
    it('matches the printed card', () => {
      expect(card.name).to.eq(CardName.DYNAMIC_OCEAN_BARRIER);
      expect(card.type).to.eq(CardType.ACTIVE);
      expect(card.cost).to.eq(8);
      expect(card.tags).to.deep.eq([Tag.BUILDING]);
      expect(card.metadata.cardNumber).to.eq('DP03');
      expect(card.requirements).to.deep.eq([]);
      expect(card.getVictoryPoints(player)).to.eq(0);
    });

    it('is registered in the Delta Project set and gated by the expansion', () => {
      expect(DELTA_PROJECT_CARD_MANIFEST.projectCards[CardName.DYNAMIC_OCEAN_BARRIER]).is.not.undefined;
      const on = new GameCards({...DEFAULT_GAME_OPTIONS, deltaProjectExpansion: true}).getProjectCards().map(toName);
      const off = new GameCards({...DEFAULT_GAME_OPTIONS, deltaProjectExpansion: false}).getProjectCards().map(toName);
      expect(on.filter((n) => n === CardName.DYNAMIC_OCEAN_BARRIER)).to.have.length(1);
      expect(off).to.not.contain(CardName.DYNAMIC_OCEAN_BARRIER);
    });
  });

  describe('the trigger', () => {
    it('offers exactly one bonus step when the owner places an ocean', () => {
      grantPathTags(player, 1);
      placeOcean(game, player);
      runAllActions(game);
      const options = cast(player.popWaitingFor(), OrOptions);
      expect(options.options).to.have.length(2);
      expect(player.popWaitingFor()).is.undefined;
    });

    it('two oceans queue two SEPARATE offers, resolved one after the other', () => {
      // Landing on 3 (+2 M€ production) and 4 (+1 titanium production) — two
      // rewards that raise no prompt of their own, so what comes back between
      // them is unambiguously the SECOND offer.
      grantPathTags(player, 4);
      player.deltaProjectData!.position = 2;
      placeOcean(game, player);
      placeOcean(game, player);
      runAllActions(game);

      cast(player.popWaitingFor(), OrOptions).options[0].cb(undefined);
      runAllActions(game);
      expect(player.deltaProjectData!.position).to.eq(3);

      cast(player.popWaitingFor(), OrOptions).options[0].cb(undefined);
      runAllActions(game);
      expect(player.deltaProjectData!.position).to.eq(4);
    });

    /**
     * ══ THE OFFER IS THE PLACEMENT'S LAST CONSEQUENCE ════════════════════
     *
     * The move this card grants is CAUSED by the placement, so everything the
     * placement itself owes — the hex's bonuses, the card draw and its reveal,
     * an Ares follow-up, anything another card queued off the same tile — must
     * be finished before the player is asked anything here. That is the whole
     * job of `BACK_OF_THE_LINE`, and it is what the console's own door then
     * waits on to keep the Hydronetwork from opening over a drawn-cards reveal.
     */
    it('resolves AFTER every other consequence of the same placement', () => {
      grantPathTags(player, 1);
      placeOcean(game, player);
      // An ordinary consequence of the same placement, queued at the DEFAULT
      // priority the executor uses — and queued AFTER the offer, so ordering
      // by insertion would get this wrong.
      const marker = new SelectOption('Some other consequence');
      game.defer(new SimpleDeferredAction(player, () => marker, Priority.DEFAULT));
      runAllActions(game);

      // The other consequence is asked FIRST…
      expect(player.popWaitingFor()).to.eq(marker);
      marker.cb(undefined);
      runAllActions(game);
      // …and only then the bonus offer.
      expect(cast(player.popWaitingFor(), OrOptions).options).to.have.length(2);
    });

    it('draws the hex\'s own card bonus BEFORE it offers the move', () => {
      grantPathTags(player, 1);
      const space = game.board.getAvailableSpacesForOcean(player)
        .find((s) => s.bonus.includes(SpaceBonus.DRAW_CARD));
      expect(space, 'the board offers an ocean hex printing a card draw').is.not.undefined;
      const before = player.cardsInHand.length;
      game.addTile(player, space!, {tileType: TileType.OCEAN});
      // The draw is SYNCHRONOUS inside the placement — already in hand by the
      // time the deferred queue is even drained.
      expect(player.cardsInHand.length).to.be.greaterThan(before);
      runAllActions(game);
      expect(cast(player.popWaitingFor(), OrOptions).options).to.have.length(2);
    });

    it('ignores an ocean placed by someone else', () => {
      grantPathTags(player, 1);
      placeOcean(game, opponent);
      runAllActions(game);
      expect(player.popWaitingFor()).is.undefined;
    });

    it('ignores a World Government / neutral placement', () => {
      grantPathTags(player, 1);
      game.phase = Phase.SOLAR;
      placeOcean(game, player);
      runAllActions(game);
      expect(player.popWaitingFor()).is.undefined;
    });

    it('ignores a raised ocean parameter with no tile', () => {
      grantPathTags(player, 1);
      // The parameter moves with no tile on the board — `addTile` never runs,
      // so the trigger is never reached.
      const before = game.board.getOceanSpaces().length;
      player.increaseTerraformRating();
      runAllActions(game);
      expect(game.board.getOceanSpaces()).to.have.length(before);
      expect(player.popWaitingFor()).is.undefined;
    });

    it('ignores a non-ocean tile', () => {
      grantPathTags(player, 1);
      const space = game.board.getAvailableSpacesOnLand(player)[0];
      game.addTile(player, space, {tileType: TileType.GREENERY});
      runAllActions(game);
      expect(player.popWaitingFor()).is.undefined;
    });

    it('raises no prompt at the end of the track', () => {
      player.deltaProjectData!.position = MAX_TRACK_POSITION;
      placeOcean(game, player);
      runAllActions(game);
      expect(player.popWaitingFor()).is.undefined;
    });
  });

  describe('eligibility', () => {
    /** Places an ocean and returns the offer, or undefined when none is made. */
    function offer(): OrOptions | undefined {
      placeOcean(game, player);
      runAllActions(game);
      const wf = player.popWaitingFor();
      return wf === undefined ? undefined : cast(wf, OrOptions);
    }

    it('offers the FREE step with no energy at all, when the tags are met', () => {
      grantPathTags(player, 1);
      player.energy = 0;
      expect(offer()!.options[0].title).to.match(/free/i);
    });

    it('offers only the PAID waiver when exactly one tag is missing', () => {
      // The card's OWN building tag covers position 1, so the first uncovered
      // requirement is position 2 (power).
      player.deltaProjectData!.position = 1;
      player.energy = 1;
      expect(DeltaProjectExpansion.missingTagCount(player, 2)).to.eq(1);
      expect(offer()!.options[0].title).to.match(/1 energy/i);
    });

    it('raises no prompt when one tag short and no energy', () => {
      player.deltaProjectData!.position = 1;
      player.energy = 0;
      expect(DeltaProjectExpansion.missingTagCount(player, 2)).to.eq(1);
      expect(offer()).is.undefined;
    });

    it('raises no prompt when two tags short, however much energy', () => {
      player.deltaProjectData!.position = 2;
      player.energy = 9;
      expect(DeltaProjectExpansion.missingTagCount(player, 3)).to.eq(2);
      expect(offer()).is.undefined;
    });

    it('counts wild tags through the standard rule', () => {
      player.deltaProjectData!.position = 1;
      player.playedCards.push(fakeCard({tags: [Tag.WILD]}));
      player.energy = 0;
      expect(DeltaProjectExpansion.missingTagCount(player, 2)).to.eq(0);
      expect(offer()!.options[0].title).to.match(/free/i);
    });

    it('never sells a waiver for a step that is already free', () => {
      grantPathTags(player, 1);
      player.energy = 5;
      const titles = offer()!.options.map((o) => String(o.title));
      expect(titles.some((t) => /energy/i.test(t))).is.false;
    });
  });

  describe('energy and atomicity', () => {
    it('the free step spends no energy', () => {
      grantPathTags(player, 1);
      player.energy = 4;
      placeOcean(game, player);
      runAllActions(game);
      cast(player.popWaitingFor(), OrOptions).options[0].cb(undefined);
      runAllActions(game);
      expect(player.energy).to.eq(4);
      expect(player.deltaProjectData!.position).to.eq(1);
    });

    it('the waiver spends exactly 1 energy', () => {
      player.deltaProjectData!.position = 1;
      player.energy = 3;
      placeOcean(game, player);
      runAllActions(game);
      cast(player.popWaitingFor(), OrOptions).options[0].cb(undefined);
      runAllActions(game);
      expect(player.energy).to.eq(2);
      expect(player.deltaProjectData!.position).to.eq(2);
    });

    it('skipping spends nothing and moves nothing', () => {
      grantPathTags(player, 1);
      player.energy = 2;
      placeOcean(game, player);
      runAllActions(game);
      cast(player.popWaitingFor(), OrOptions).options[1].cb(undefined);
      runAllActions(game);
      expect(player.energy).to.eq(2);
      expect(player.deltaProjectData!.position).to.eq(0);
    });

    it('the waiver covers THIS move only', () => {
      player.deltaProjectData!.position = 1;
      player.energy = 5;
      placeOcean(game, player);
      runAllActions(game);
      cast(player.popWaitingFor(), OrOptions).options[0].cb(undefined);
      runAllActions(game);
      expect(player.deltaProjectData!.position).to.eq(2);
      // Still short for the NEXT position — the waiver granted no tag.
      expect(DeltaProjectExpansion.missingTagCount(player, 3)).to.eq(2);
    });
  });

  describe('the once-per-generation standard action', () => {
    it('the bonus neither spends nor is blocked by it, in EITHER order', () => {
      grantPathTags(player, 5);
      player.deltaProjectData!.position = 2;
      player.energy = 5;

      // 1) bonus first — the standard action stays unspent.
      placeOcean(game, player);
      runAllActions(game);
      cast(player.popWaitingFor(), OrOptions).options[0].cb(undefined);
      runAllActions(game);
      expect(player.deltaProjectData!.position).to.eq(3);
      expect(player.deltaProjectData!.usedThisGeneration).is.not.true;

      // 2) the standard action runs, marking the generation used…
      DeltaProjectExpansion.advance(player, 1);
      player.deltaProjectData!.usedThisGeneration = true;
      runAllActions(game);
      expect(player.deltaProjectData!.position).to.eq(4);

      // …and a further ocean still offers its bonus.
      placeOcean(game, player);
      runAllActions(game);
      cast(player.popWaitingFor(), OrOptions).options[0].cb(undefined);
      runAllActions(game);
      expect(player.deltaProjectData!.position).to.eq(5);
      expect(player.deltaProjectData!.usedThisGeneration).is.true;
    });
  });

  describe('reward parity with the standard move', () => {
    it('lands the same position, reward and stop record as the standard advance', () => {
      // Standard advance for a control player on the same track position.
      grantPathTags(opponent, 3);
      opponent.energy = 3;
      const beforeStd = opponent.production.megacredits;
      DeltaProjectExpansion.advance(opponent, 3);
      runAllActions(game);

      grantPathTags(player, 3);
      player.deltaProjectData!.position = 2;
      player.energy = 0;
      const beforeBonus = player.production.megacredits;
      placeOcean(game, player);
      runAllActions(game);
      cast(player.popWaitingFor(), OrOptions).options[0].cb(undefined);
      runAllActions(game);

      // Position 3 = +2 M€ production, for both routes.
      expect(player.deltaProjectData!.position).to.eq(3);
      expect(opponent.deltaProjectData!.position).to.eq(3);
      expect(player.production.megacredits - beforeBonus).to.eq(2);
      expect(opponent.production.megacredits - beforeStd).to.eq(2);
      expect(player.deltaProjectData!.stops!.at(-1)!.position).to.eq(3);
    });

    it('routes a CHOICE reward through the standard deferred OrOptions', () => {
      grantPathTags(player, 1);
      placeOcean(game, player);
      runAllActions(game);
      cast(player.popWaitingFor(), OrOptions).options[0].cb(undefined);
      runAllActions(game);
      // Position 1 defers the standard steel/plants choice.
      const reward = cast(player.popWaitingFor(), OrOptions);
      expect(reward.options.map((o) => String(o.title))).to.have.members(['Gain 2 steel', 'Gain 2 plants']);
      const beforeSteel = player.steel;
      reward.options[0].cb(undefined);
      runAllActions(game);
      expect(player.steel - beforeSteel).to.eq(2);
    });
  });
});
