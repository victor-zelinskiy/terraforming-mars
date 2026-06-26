import {Phase} from '../../common/Phase';
import {GlobalParameter} from '../../common/GlobalParameter';
import {IPlayer} from '../IPlayer';
import {ICard} from '../cards/ICard';
import {Board} from '../boards/Board';
import {MoonExpansion} from '../moon/MoonExpansion';
import {PathfindersExpansion} from '../pathfinders/PathfindersExpansion';
import {DeltaProjectExpansion} from '../delta/DeltaProjectExpansion';
import {Turmoil} from '../turmoil/Turmoil';
import {VictoryPointsBreakdownBuilder} from './VictoryPointsBreakdownBuilder';
import {FundedAward} from '../awards/FundedAward';
import {AwardScorer} from '../awards/AwardScorer';
import {CardName} from '../../common/cards/CardName';
import {CardVictoryPointsKind, TerraformRatingBreakdown, TRSourceEntry} from '../../common/game/VictoryPointsBreakdown';

// The clean standard starting terraform rating. NEVER a fallback bucket for
// unclassified TR — any residual goes to a `legacyUnknown` source entry instead.
const STARTING_TERRAFORM_RATING = 20;

/**
 * Source-aware terraform-rating breakdown.
 *
 * `baseRating`/`handicap` are EXPLICIT (the clean starting rating + any starting
 * adjustment), NOT the old `terraformRating − Σparts` residual that silently
 * swallowed Venus-bonus / mis-attributed TR. Parameter TR comes from
 * `globalParameterSteps`; direct card/effect TR (`terraformRatingFromCards`) is
 * itemised per source in `cardEntries`. Any leftover (e.g. an older save whose
 * Venus 8% bonus predates per-source tracking) is surfaced as a `legacyUnknown`
 * entry inside Cards & effects — so the base stays clean and the parts still sum
 * to the displayed rating exactly.
 */
export function computeTerraformRatingBreakdown(player: IPlayer): TerraformRatingBreakdown {
  const gp = player.globalParameterSteps;
  const temperature = gp[GlobalParameter.TEMPERATURE];
  const oxygen = gp[GlobalParameter.OXYGEN];
  const oceans = gp[GlobalParameter.OCEANS];
  const venus = gp[GlobalParameter.VENUS];

  // Merge the per-source list into stable entries (one row per engine piece).
  const byKey = new Map<string, TRSourceEntry & {sourceCardId?: string}>();
  for (const s of player.terraformRatingSources) {
    const key = `${s.sourceType}:${s.sourceName}:${s.sourceCardId ?? ''}`;
    const existing = byKey.get(key);
    if (existing === undefined) {
      byKey.set(key, {...s});
    } else {
      existing.amount += s.amount;
      if (s.generation !== undefined && (existing.generation === undefined || s.generation < existing.generation)) {
        existing.generation = s.generation;
      }
    }
  }
  // Ares hazard-clearing TR is split OUT of `cards` into its own segment.
  let hazards = 0;
  const cardEntries: Array<TRSourceEntry> = [];
  for (const e of byKey.values()) {
    if (e.amount === 0) {
      continue;
    }
    if (e.sourceType === 'ares-hazard') {
      hazards += e.amount;
    } else {
      cardEntries.push(e);
    }
  }

  let cards = player.terraformRatingFromCards - hazards;
  const baseRating = STARTING_TERRAFORM_RATING;
  // The "TR Boost" handicap chosen at game creation is added to the rating at
  // setup via setTerraformRating (Game.ts), bypassing every bucket — surface it
  // EXPLICITLY as the Handicap ("Фора") sub-part, not the unattributed residual.
  const handicap = player.handicap;

  // Reconcile: anything not explained by base/handicap/params/cards/hazards is a
  // legacy unattributed source (old saves). Fold it INTO cards (NOT base) as a row.
  const residual = player.terraformRating - baseRating - handicap - temperature - oxygen - oceans - venus - cards - hazards;
  if (residual !== 0) {
    cards += residual;
    cardEntries.push({sourceType: 'legacyUnknown', sourceName: 'Other / untracked sources', amount: residual});
  }
  cardEntries.sort((a, b) => b.amount - a.amount);

  return {
    base: baseRating + handicap,
    baseRating,
    handicap,
    temperature,
    oxygen,
    oceans,
    venus,
    cards,
    cardEntries,
    hazards,
  };
}

// Classify how a played card earns its victory points, for the "from cards"
// breakdown families. A net-negative result is always a penalty regardless of
// the declaration.
function classifyCardVictoryPoints(card: ICard, vp: number): CardVictoryPointsKind {
  if (vp < 0) {
    return 'penalty';
  }
  const decl = card.victoryPoints;
  if (typeof decl === 'number') {
    return 'fixed';
  }
  if (decl === 'special') {
    // Bespoke getVictoryPoints. A card that stores its own resource and scores
    // off it (SearchForLife, Fish, Predators, Penguins, …) is a resource
    // accumulator; anything else special depends on board / tableau state.
    return card.resourceType !== undefined ? 'resource' : 'conditional';
  }
  if (typeof decl === 'object') {
    // CountableVictoryPoints: `resourcesHere` → resource accumulator; a tag /
    // city / ocean / colony / moon / nextToThis count → conditional.
    return decl.resourcesHere !== undefined ? 'resource' : 'conditional';
  }
  return 'fixed';
}

export function calculateVictoryPoints(player: IPlayer) {
  const builder = new VictoryPointsBreakdownBuilder();

  // Victory points from cards
  let playerOwnsVermin = false; // For Vermin
  let negativeVP = 0; // For Underworld.
  for (const playedCard of player.tableau) {
    if (playedCard.victoryPoints !== undefined) {
      const vp = playedCard.getVictoryPoints(player);
      builder.setVictoryPoints('victoryPoints', vp, playedCard.name, undefined, classifyCardVictoryPoints(playedCard, vp));
      if (vp < 0) {
        negativeVP += vp;
      }
    }
    playerOwnsVermin ||= playedCard.name === CardName.VERMIN;
  }

  // Apply the Vermin penalty to other players. Vermin owner is penalized by the card itself.
  if (player.game.verminInEffect && playerOwnsVermin === false) {
    const cities = player.game.board.getCities(player).length;
    builder.setVictoryPoints('victoryPoints', cities * -1, CardName.VERMIN, undefined, 'penalty');
    negativeVP -= cities;
  }

  // Victory points from TR
  builder.setVictoryPoints('terraformRating', player.terraformRating);
  builder.setTerraformRatingBreakdown(computeTerraformRatingBreakdown(player));

  // Victory points from awards
  giveAwards(player, builder);

  // Victory points from milestones
  for (const milestone of player.game.claimedMilestones) {
    if (milestone.player !== undefined && milestone.player.id === player.id) {
      builder.setVictoryPoints('milestones', 5, 'Claimed ${0} milestone', [milestone.milestone.name]);
    }
  }

  // Victory points from board
  player.game.board.spaces.forEach((space) => {
    // Victory points for greenery tiles
    if (Board.isGreenerySpace(space) && Board.spaceOwnedBy(space, player)) {
      builder.setVictoryPoints('greenery', 1);
    }

    // Victory points for greenery tiles adjacent to cities
    if (Board.isCitySpace(space) && Board.spaceOwnedBy(space, player)) {
      const adjacent = player.game.board.getAdjacentSpaces(space);
      for (const adj of adjacent) {
        if (Board.isGreenerySpace(adj)) {
          builder.setVictoryPoints('city', 1);
        }
      }
    }
  });

  // Turmoil Victory Points
  const includeTurmoilVP = player.game.gameIsOver() || player.game.phase === Phase.END;

  Turmoil.ifTurmoil(player.game, (turmoil) => {
    if (includeTurmoilVP) {
      builder.setVictoryPoints('victoryPoints', turmoil.getVictoryPoints(player), 'Turmoil Points', undefined, 'conditional');
    }
  });

  const coloniesVP = player.colonies.getVictoryPoints();
  if (coloniesVP > 0) {
    builder.setVictoryPoints('victoryPoints', coloniesVP, 'Colony VP', undefined, 'conditional');
  }
  MoonExpansion.calculateVictoryPoints(player, builder);
  PathfindersExpansion.calculateVictoryPoints(player, builder);
  DeltaProjectExpansion.calculateVictoryPoints(player, builder);

  // Underworld Score Bribing
  if (player.game.gameOptions.underworldExpansion === true) {
    const bribe = Math.min(Math.abs(negativeVP), player.underworldData.corruption);
    builder.setVictoryPoints('victoryPoints', bribe, 'Underworld Corruption Bribe', undefined, 'conditional');
  }

  // Escape velocity VP penalty
  if (player.game.gameOptions.escapeVelocity !== undefined) {
    const options = player.game.gameOptions.escapeVelocity;

    const elapsedTimeMinutes = player.timer.getElapsedTimeInMinutes();
    const bonusActionMinutes = player.actionsTakenThisGame * (options.bonusSectionsPerAction / 60);
    const overageMin = elapsedTimeMinutes - bonusActionMinutes - options.thresholdMinutes;

    if (overageMin > 0) {
      const vpPenalty = options.penaltyVPPerPeriod * Math.floor(overageMin / options.penaltyPeriodMinutes);
      builder.setVictoryPoints('escapeVelocity', -vpPenalty);
    }
  }

  return builder.build();
}

function maybeSetVP(thisPlayer: IPlayer, awardWinner: IPlayer, fundedAward: FundedAward, vps: number, place: '1st' | '2nd', builder: VictoryPointsBreakdownBuilder) {
  if (thisPlayer.id === awardWinner.id) {
    builder.setVictoryPoints(
      'awards',
      vps,
      '${0} place for ${1} award (funded by ${2})',
      [place, fundedAward.award.name, fundedAward.player.name],
    );
  }
}

function giveAwards(player: IPlayer, builder: VictoryPointsBreakdownBuilder) {
  // Awards are disabled for 1 player games
  if (player.game.isSoloMode()) {
    return;
  }

  player.game.fundedAwards.forEach((fundedAward) => {
    const award = fundedAward.award;
    const scorer = new AwardScorer(player.game, award);
    const players: Array<IPlayer> = player.game.players.slice();
    players.sort((p1, p2) => scorer.get(p2) - scorer.get(p1));

    // There is one rank 1 player
    if (scorer.get(players[0]) > scorer.get(players[1])) {
      maybeSetVP(player, players[0], fundedAward, 5, '1st', builder);
      players.shift();

      if (players.length > 1) {
        // There is one rank 2 player
        if (scorer.get(players[0]) > scorer.get(players[1])) {
          maybeSetVP(player, players[0], fundedAward, 2, '2nd', builder);
        } else {
          // There are at least two rank 2 players
          const score = scorer.get(players[0]);
          while (players.length > 0 && scorer.get(players[0]) === score) {
            maybeSetVP(player, players[0], fundedAward, 2, '2nd', builder);
            players.shift();
          }
        }
      }
    } else {
      // There are at least two rank 1 players
      const score = scorer.get(players[0]);
      while (players.length > 0 && scorer.get(players[0]) === score) {
        maybeSetVP(player, players[0], fundedAward, 5, '1st', builder);
        players.shift();
      }
    }
  });
}
