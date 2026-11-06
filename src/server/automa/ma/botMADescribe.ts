import {Message} from '../../../common/logs/Message';
import {IGame} from '../../IGame';
import {IMilestone, milestoneThreshold} from '../../milestones/IMilestone';
import {LogMessageData} from '../../../common/logs/LogMessageData';
import {LogMessageDataType} from '../../../common/logs/LogMessageDataType';
import {Tag} from '../../../common/cards/Tag';
import {Resource} from '../../../common/Resource';
import {MarsBotTrackRole} from '../../../common/automa/AutomaTypes';
import {BotCounterId, BotCriterion, BotHelper, HelperTrack, TrackRef, TrackSet} from './BotMARule';
import {botAwardHelper, botAwardRule, botMilestoneRule} from './botMAInterpreter';
import {PilePredicateId, PileAmountId} from './pilePredicates';
import {PlacementRegionId} from './placementRegions';

/**
 * THE PLAYER-FACING TEXT of a bot rule — generated from the registry row, never written by hand per name (the old
 * `MarsBotMADescriptions.ts` table is gone). A description is an ordinary `Message`: an English template (the i18n
 * key — `src/locales/ru/marsbot_ma.json`) whose LABEL params travel as translatable STRING tokens and whose NUMBERS
 * travel RAW, so the client renders it through its one `translateMessage` road with no bot code of its own.
 *
 * Every template and every label below is a key; the guard `tests/automa/ma/botMADescribe.spec.ts` renders every
 * registry row against the RU dictionary and fails on a missing key or a raw `${n}`.
 */

const ROLE_LABEL: Record<MarsBotTrackRole, string> = {
  building: 'the Building track',
  space: 'the Space track',
  event: 'the Event track',
  science: 'the Science track',
  power: 'the Power track',
  earth: 'the Earth track',
  bio: 'the Bio track',
  venus: 'the Venus track',
};

/** «The track the X tag rides» — the tags a criterion can follow (the floating ones move from mat to mat). */
const TAG_LABEL: Partial<Record<Tag, string>> = {
  [Tag.BUILDING]: 'the Building-tag track',
  [Tag.SPACE]: 'the Space-tag track',
  [Tag.EVENT]: 'the Event track',
  [Tag.SCIENCE]: 'the Science-tag track',
  [Tag.POWER]: 'the Power-tag track',
  [Tag.EARTH]: 'the Earth-tag track',
  [Tag.JOVIAN]: 'the Jovian-tag track',
  [Tag.CITY]: 'the City-tag track',
  [Tag.PLANT]: 'the Plant-tag track',
  [Tag.ANIMAL]: 'the Animal-tag track',
  [Tag.MICROBE]: 'the Microbe-tag track',
  [Tag.VENUS]: 'the Venus track',
};

/** «The track with the X production badge» (RB-C pp.4–5: steel → building, titanium → space, …). */
const PRODUCTION_LABEL: Record<Resource, string> = {
  [Resource.MEGACREDITS]: 'the M€-badge track',
  [Resource.STEEL]: 'the steel-badge track',
  [Resource.TITANIUM]: 'the titanium-badge track',
  [Resource.PLANTS]: 'the plant-badge track',
  [Resource.ENERGY]: 'the energy-badge track',
  [Resource.HEAT]: 'the heat-badge track',
};

const PILE_PLURAL: Record<PilePredicateId, string> = {
  green: 'green cards',
  blue: 'blue cards',
  greenOrBlue: 'green and blue cards',
  event: 'event cards',
  cost20plus: 'cards costing 20 M€ or more (events count)',
  cost10minus: 'cards costing 10 M€ or less (events count)',
  hasRequirement: 'cards with requirements',
  altersProduction: 'cards altering its production',
  warmonger: 'cards hurting other players',
  cityOffMars: 'cards placing a city off Mars',
  philanthropic: 'cards with non-negative VP',
  noTags: 'cards without tags',
  partyRequirement: 'cards with a party requirement (events count)',
};

const PILE_SINGULAR: Record<PilePredicateId, string> = {
  green: 'a green card',
  blue: 'a blue card',
  greenOrBlue: 'a green or blue card',
  event: 'an event card',
  cost20plus: 'a card costing 20 M€ or more',
  cost10minus: 'a card costing 10 M€ or less',
  hasRequirement: 'a card with a requirement',
  altersProduction: 'a card altering production',
  warmonger: 'a card hurting other players',
  cityOffMars: 'a card placing a city off Mars',
  philanthropic: 'a card with non-negative VP',
  noTags: 'a card without tags',
  partyRequirement: 'a card with a party requirement',
};

const PILE_AMOUNT: Record<PileAmountId, string> = {
  marsTags: 'Mars tags',
};

const REGION_LABEL: Record<PlacementRegionId, string> = {
  southern: 'in the Southern Region',
  oceanAdjacent: 'next to an ocean',
  edge: 'on the board edge',
  suburbianEdge: 'on the edge of the map',
  specialTileAdjacent: 'next to a special tile',
  notOceanAdjacent: 'away from every ocean',
  ownCityAdjacent: 'next to its own city',
  allNeighboursEmpty: 'with every neighbour empty',
};

function label(text: string): LogMessageData {
  return {type: LogMessageDataType.STRING, value: text};
}

function num(n: number): LogMessageData {
  return {type: LogMessageDataType.RAW_STRING, value: String(n)};
}

function msg(message: string, ...data: Array<LogMessageData>): Message {
  return {message, data};
}

export function trackLabel(ref: TrackRef): string {
  if ('role' in ref) {
    return ROLE_LABEL[ref.role];
  }
  if ('tag' in ref) {
    return TAG_LABEL[ref.tag] ?? 'the track of that tag';
  }
  return PRODUCTION_LABEL[ref.production];
}

function namedRefs(of: TrackSet): ReadonlyArray<TrackRef> | undefined {
  return typeof of === 'string' ? undefined : of;
}

/** The milestone criterion line: «MarsBot: the Power track at space 6». */
function milestoneText(criterion: BotCriterion, target: number | undefined): Message {
  const t = target ?? 0;
  switch (criterion.kind) {
  case 'track':
    return msg('MarsBot: ${0} at space ${1}', label(trackLabel(criterion.track)), num(t));
  case 'tracks': {
    const refs = namedRefs(criterion.of);
    if (criterion.op === 'countAtLeast') {
      return msg('MarsBot: ${0} tracks at space ${1} or higher', num(t), num(criterion.at ?? 0));
    }
    if (criterion.op === 'sumTop') {
      return msg('MarsBot: its ${0} best tracks except Venus combined at ${1}', num(criterion.top ?? 0), num(t));
    }
    if (refs === undefined) {
      if (criterion.op === 'max') {
        return msg('MarsBot: any one track at space ${0}', num(t));
      }
      if (criterion.op === 'min') {
        if (criterion.of === 'martian') {
          return msg('MarsBot: every track except Venus at space ${0}', num(t));
        }
        return criterion.drop === 'venus' ?
          msg('MarsBot: every track at space ${0} (with Venus, one may lag)', num(t)) :
          msg('MarsBot: every track at space ${0}', num(t));
      }
      return msg('MarsBot: all its tracks combined at ${0}', num(t));
    }
    const labels = refs.map((r) => label(trackLabel(r)));
    if (criterion.op === 'sum' && refs.length === 2) {
      return msg('MarsBot: ${0} and ${1} combined at ${2}', labels[0], labels[1], num(t));
    }
    if (criterion.op === 'max' && refs.length === 2) {
      return msg('MarsBot: ${0} or ${1} at space ${2}', labels[0], labels[1], num(t));
    }
    if (criterion.op === 'min' && refs.length === 3) {
      return msg('MarsBot: ${0}, ${1} and ${2} each at space ${3}', labels[0], labels[1], labels[2], num(t));
    }
    throw new Error(`No milestone text for a ${criterion.op} over ${refs.length} tracks`);
  }
  case 'megacredits':
    return msg('MarsBot: ${0} M€', num(t * (criterion.per ?? 1)));
  case 'pile':
    if ('count' in criterion) {
      return msg('MarsBot: ${0} ${1} in its played pile', num(t), label(PILE_PLURAL[criterion.count]));
    }
    if ('sum' in criterion) {
      return msg('MarsBot: ${0} ${1} in its played pile', num(t), label(PILE_AMOUNT[criterion.sum]));
    }
    return msg('MarsBot: ${0} sets of green, blue and event cards in its played pile', num(t));
  case 'player':
    return msg('MarsBot: counted as for a player');
  case 'rating':
    return msg('MarsBot: a TR of ${0}', num(t));
  case 'counter':
    return counterText(criterion.counter, t);
  case 'allOf': {
    // Landshaper's three parts (RB-C p.13) — the one composite the registry holds; a new shape fails the guard here.
    const [city, greenery, track] = criterion.of;
    if (criterion.of.length === 3 && city.criterion.kind === 'counter' && city.criterion.counter === 'cities' &&
        greenery.criterion.kind === 'counter' && greenery.criterion.counter === 'greeneries' && track.criterion.kind === 'track') {
      return msg('MarsBot: a city, a greenery and ${0} at space ${1}', label(trackLabel(track.criterion.track)), num(track.target));
    }
    throw new Error(`No milestone text for this composite: ${JSON.stringify(criterion)}`);
  }
  case 'zero':
    return msg(criterion.reasonKey);
  }
}

function counterText(counter: BotCounterId, target: number): Message {
  switch (counter) {
  case 'floaters':
    return msg('MarsBot: ${0} floaters', num(target));
  case 'destroyedBonusCards':
    return msg('MarsBot: ${0} destroyed bonus cards', num(target));
  case 'smallActionDeck':
    return msg('MarsBot: at most 2 cards left in its action deck');
  case 'cities':
    return msg('MarsBot: ${0} cities', num(target));
  case 'greeneries':
    return msg('MarsBot: ${0} greeneries', num(target));
  case 'tokens:data':
    return msg('MarsBot: ${0} data tokens off its mat', num(target));
  case 'tokens:fighter':
    return msg('MarsBot: ${0} fighter tokens off its mat', num(target));
  }
}

/** The award score line: «MarsBot: the Power track space + 5». */
function awardText(criterion: BotCriterion): Message {
  switch (criterion.kind) {
  case 'track': {
    const l = label(trackLabel(criterion.track));
    if (criterion.div === 2) {
      return msg('MarsBot: half of ${0} space', l);
    }
    const plus = criterion.plus ?? 0;
    if (plus > 0) {
      return msg('MarsBot: ${0} space + ${1}', l, num(plus));
    }
    if (plus < 0) {
      return msg('MarsBot: ${0} space − ${1}', l, num(-plus));
    }
    return msg('MarsBot: ${0} space', l);
  }
  case 'tracks': {
    const refs = namedRefs(criterion.of);
    const doubled = (criterion.times ?? 1) === 2;
    if (criterion.op === 'countAtLeast') {
      return msg('MarsBot: the number of its tracks at space ${0} or higher', num(criterion.at ?? 0));
    }
    if (criterion.op === 'sumTop') {
      return msg('MarsBot: its ${0} best tracks combined', num(criterion.top ?? 0));
    }
    if (refs === undefined) {
      if (criterion.op === 'max') {
        return doubled ? msg('MarsBot: its highest track space, doubled') : msg('MarsBot: its highest track space');
      }
      if (criterion.op === 'min') {
        return doubled ?
          msg('MarsBot: its lowest track space (2nd lowest with Venus), doubled') :
          msg('MarsBot: its lowest track space');
      }
      return msg('MarsBot: all its tracks combined');
    }
    const labels = refs.map((r) => label(trackLabel(r)));
    if (criterion.op === 'sum' && refs.length === 2) {
      return msg('MarsBot: ${0} + ${1} spaces', labels[0], labels[1]);
    }
    if (criterion.op === 'max' && refs.length === 2) {
      return (criterion.plus ?? 0) > 0 ?
        msg('MarsBot: the higher of ${0} and ${1} + ${2}', labels[0], labels[1], num(criterion.plus ?? 0)) :
        msg('MarsBot: the higher of ${0} and ${1}', labels[0], labels[1]);
    }
    throw new Error(`No award text for a ${criterion.op} over ${refs.length} tracks`);
  }
  case 'megacredits':
    return msg('MarsBot: 1 per ${0} M€', num(criterion.per ?? 1));
  case 'pile': {
    const plus = criterion.plus ?? 0;
    const what = 'count' in criterion ? PILE_PLURAL[criterion.count] :
      'sum' in criterion ? PILE_AMOUNT[criterion.sum] : 'sets of green, blue and event cards';
    return plus > 0 ?
      msg('MarsBot: ${0} in its played pile + ${1}', label(what), num(plus)) :
      msg('MarsBot: ${0} in its played pile', label(what));
  }
  case 'player':
    return msg('MarsBot: counted as for a player');
  case 'rating':
    return msg('MarsBot: its TR − ${0}', num(-(criterion.plus ?? 0)));
  case 'counter':
  case 'allOf':
    throw new Error(`No award text for ${criterion.kind}`);
  case 'zero':
    return msg(criterion.reasonKey);
  }
}

function helperTrackText(track: HelperTrack): Message {
  if (!('pick' in track)) {
    return msg('advances ${0}', label(trackLabel(track)));
  }
  const [a, b] = track.of.map((r) => label(trackLabel(r)));
  return track.pick === 'least' ?
    msg('advances the lower of ${0} and ${1}', a, b) :
    msg('advances the higher of ${0} and ${1}', a, b);
}

/** The Corporate Competition helper line: «advances the Power track», «places a greenery on the board edge». */
export function describeHelper(helper: BotHelper): Message {
  switch (helper.kind) {
  case 'advance':
    return helperTrackText(helper.track);
  case 'advanceExtreme':
    return helper.which === 'least' ? msg('advances its lowest track') : msg('advances its highest track');
  case 'greenery':
    return helper.restrict === undefined ?
      msg('places a greenery') :
      msg('places a greenery ${0}', label(REGION_LABEL[helper.restrict]));
  case 'city':
    return helper.restrict === undefined ?
      msg('places a city') :
      msg('places a city ${0}', label(REGION_LABEL[helper.restrict]));
  case 'reveal':
    return helper.gainMegacredits === undefined ?
      msg('reveals cards until ${0} and resolves it', label(PILE_SINGULAR[helper.predicate])) :
      msg('reveals cards until ${0}, resolves it and gains ${1} M€', label(PILE_SINGULAR[helper.predicate]), num(helper.gainMegacredits));
  case 'raiseRating':
    return msg('raises its TR ${0} steps', num(helper.steps));
  case 'cubeAttack':
    return msg('you remove your best animal or microbe');
  case 'delegate':
    return msg('sends a delegate');
  case 'none':
    return msg(helper.reasonKey);
  }
}

/** The bot's criterion line for a milestone — `undefined` when the name has no registry row. */
export function describeMilestone(milestone: IMilestone, game: IGame): Message | undefined {
  const rule = botMilestoneRule(milestone.name);
  if (rule === undefined) {
    return undefined;
  }
  const target = rule.target === 'printed' ?
    milestoneThreshold(milestone, game) ?? rule.printedFallback :
    rule.target;
  if (rule.claimCost !== undefined && rule.criterion.kind === 'megacredits') {
    // Briber: the price of the claim is part of the rule the player must read.
    return msg('MarsBot: ${0} M€, then pays ${1} M€ to claim', num(target ?? 0), num(rule.claimCost.megacredits));
  }
  return milestoneText(rule.criterion, target);
}

/** The bot's score line for an award — `undefined` when the name has no registry row. */
export function describeAward(name: string): Message | undefined {
  const rule = botAwardRule(name);
  return rule === undefined ? undefined : awardText(rule.criterion);
}

/** The Corporate Competition helper line of an award (a registry-less name has none, said in words). */
export function describeAwardHelper(name: string): Message {
  return describeHelper(botAwardHelper(name));
}
