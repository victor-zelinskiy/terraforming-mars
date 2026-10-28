import {MarsBotCorpId} from './AutomaTypes';
import {MarsBotDividendInfo, dividendBox, dividendGoal} from './MarsBotDividend';

/**
 * THE «ДИВИДЕНДЫ» BOX OF EVERY MARSBOT CORPORATION — the printed text and the
 * printed numbers of the end-game dividend a corporation pays while it is a
 * HOLDING of the bot's campaign portfolio (docs/claude/prompts/
 * marsbot-portfolio-dividends.md §5; rates calibrated on the owner's real
 * games, docs/claude/marsbot-dividends-calibration.md).
 *
 * A Record over every `MarsBotCorpId`, so adding corporation N+1 cannot compile
 * without its dividend. The CLAUSE that computes the number lives co-located in
 * `src/server/automa/corps/MarsBot<Name>.ts` and reads `rates` from here — the
 * printed number and the paid number are one value.
 *
 * Every clause counts what the BOT did or owns; only the four corporations
 * whose printed card is already written for both seats (C08 Saturn Systems,
 * C22 Philares, C24 Splice, C33 Poseidon) count something the humans do for
 * themselves. None counts a global parameter «by anyone».
 */
const MORE_OR_EQUAL = '+${0} VP if MarsBot reaches ${1} or more';

const DIVIDENDS: Readonly<Record<MarsBotCorpId, MarsBotDividendInfo>> = {
  [MarsBotCorpId.C01_CREDICOR]: dividendBox('Big Capital', {each: 1, per: 20}, (r) => [
    {text: '${0} VP per ${1} M€ of printed cost of the cards in MarsBot\'s played pile', params: [r.each, r.per]},
  ], dividendGoal(420, 480)),
  [MarsBotCorpId.C02_ECOLINE]: dividendBox('Green Belt', {each: 2, bonus: 2, at: 6}, (r) => [
    {text: '${0} VP per greenery tile MarsBot owns', params: [r.each]},
    {text: MORE_OR_EQUAL, params: [r.bonus, r.at], muted: true},
  ], dividendGoal(9, 10)),
  [MarsBotCorpId.C03_HELION]: dividendBox('Heat Reserve', {each: 3}, (r) => [
    {text: '${0} VP per temperature step MarsBot raised', params: [r.each]},
  ], dividendGoal(8, 10)),
  [MarsBotCorpId.C04_INTERPLANETARY_CINEMATICS]: dividendBox('Chronicle', {each: 2, from: 1}, (r) => [
    {text: '${0} VP per space of the event track MarsBot reached beyond #${1}', params: [r.each, r.from]},
  ], dividendGoal(15, 17)),
  [MarsBotCorpId.C05_INVENTRIX]: dividendBox('Rethinking', {each: 1, bonus: 4, at: 10}, (r) => [
    {text: '${0} VP per card with a requirement in MarsBot\'s played pile', params: [r.each]},
    {text: MORE_OR_EQUAL, params: [r.bonus, r.at], muted: true},
  ], dividendGoal(17, 19)),
  [MarsBotCorpId.C06_MINING_GUILD]: dividendBox('Ore Veins', {each: 6}, (r) => [
    {text: '${0} VP per MarsBot tile on a space with a steel or titanium bonus', params: [r.each]},
  ], dividendGoal(5, 7)),
  [MarsBotCorpId.C07_PHOBOLOG]: dividendBox('Transport Fleet', {each: 5, per: 2}, (r) => [
    {text: '${0} VP per ${1} cards with a space tag in MarsBot\'s played pile', params: [r.each, r.per]},
  ], dividendGoal(10, 14)),
  [MarsBotCorpId.C08_SATURN_SYSTEMS]: dividendBox('Saturn Orbits', {own: 3, theirs: 1}, (r) => [
    {text: '${0} VP per Jovian tag in MarsBot\'s played pile', params: [r.own]},
    {text: '${0} VP per card with a Jovian tag the other players played', params: [r.theirs]},
  ], dividendGoal(3, 4)),
  [MarsBotCorpId.C09_TERACTOR]: dividendBox('Earth Capital', {each: 4}, (r) => [
    {text: '${0} VP per Earth tag in MarsBot\'s played pile', params: [r.each]},
  ], dividendGoal(6, 8)),
  [MarsBotCorpId.C10_THARSIS_REPUBLIC]: dividendBox('Urbanization', {each: 3}, (r) => [
    {text: '${0} VP per city tile MarsBot owns', params: [r.each]},
  ], dividendGoal(7, 8)),
  [MarsBotCorpId.C11_THORGATE]: dividendBox('Power Grid', {track: 2, tag: 2}, (r) => [
    {text: '${0} VP per space of the power track MarsBot reached', params: [r.track]},
    {text: '${0} VP per power tag in MarsBot\'s played pile', params: [r.tag]},
  ], dividendGoal(12, 13)),
  [MarsBotCorpId.C12_UNMI]: dividendBox('Mandate', {each: 1, per: 2, above: 28}, (r) => [
    {text: '${0} VP per ${1} TR MarsBot has above ${2}', params: [r.each, r.per, r.above]},
  ], dividendGoal(40, 48)),
  [MarsBotCorpId.C13_CHEUNG_SHING_MARS]: dividendBox('Infrastructure', {each: 3, from: 3}, (r) => [
    {text: '${0} VP per space of the building track MarsBot reached beyond #${1}', params: [r.each, r.from]},
  ], dividendGoal(11, 13)),
  [MarsBotCorpId.C14_POINT_LUNA]: dividendBox('Lunar Balance', {each: 4}, (r) => [
    {text: '${0} VP per space of MarsBot\'s least advanced track', params: [r.each]},
    {text: 'The Venus track is not counted', muted: true},
  ], dividendGoal(6, 7)),
  [MarsBotCorpId.C15_ROBINSON_INDUSTRIES]: dividendBox('Diversification', {each: 3, at: 7, extra: 2, high: 10}, (r) => [
    {text: '${0} VP per MarsBot track that reached #${1}', params: [r.each, r.at]},
    {text: '+${0} VP per track that reached #${1}', params: [r.extra, r.high], muted: true},
  ], dividendGoal(4, 5, {term: 1})),
  [MarsBotCorpId.C16_VALLEY_TRUST]: dividendBox('Science Fund', {each: 4, bonus: 4, at: 4}, (r) => [
    {text: '${0} VP per card with a science tag in MarsBot\'s played pile', params: [r.each]},
    {text: MORE_OR_EQUAL, params: [r.bonus, r.at], muted: true},
  ], dividendGoal(7, 8)),
  [MarsBotCorpId.C17_VITOR]: dividendBox('Overachiever', {big: 3, small: 1, at: 2}, (r) => [
    {text: '${0} VP per card in MarsBot\'s played pile that prints ${1} VP or more', params: [r.big, r.at]},
    {text: '${0} VP per card that prints 1 VP', params: [r.small]},
  ], dividendGoal(4, 5)),
  [MarsBotCorpId.C18_ARCADIAN_COMMUNITIES]: dividendBox('Settlers', {each: 1}, (r) => [
    {text: '${0} VP per pair of adjacent MarsBot tiles', params: [r.each]},
  ], dividendGoal(22, 28)),
  [MarsBotCorpId.C19_ASTRO_DRILL]: dividendBox('Cascade', {each: 2}, (r) => [
    {text: '${0} VP per «advance» space MarsBot\'s tracks passed', params: [r.each]},
  ], dividendGoal(11, 12)),
  [MarsBotCorpId.C20_FACTORUM]: dividendBox('Warehouse', {each: 1, per: 4}, (r) => [
    {text: '${0} VP per ${1} M€ MarsBot holds at the end of the game', params: [r.each, r.per]},
    {text: 'On top of the usual M€ conversion', muted: true},
  ], dividendGoal(95, 125)),
  [MarsBotCorpId.C21_PHARMACY_UNION]: dividendBox('Quarantine', {microbe: 5, regressed: 3}, (r) => [
    {text: '${0} VP per microbe tag in MarsBot\'s played pile', params: [r.microbe]},
    {text: '${0} VP per track space the other players pushed MarsBot back from', params: [r.regressed]},
  ], dividendGoal(5, 6)),
  [MarsBotCorpId.C22_PHILARES]: dividendBox('Neighbourhood', {each: 1}, (r) => [
    {text: '${0} VP per border between a MarsBot tile and a tile of another player', params: [r.each]},
  ], dividendGoal(24, 28)),
  [MarsBotCorpId.C23_RECYCLON]: dividendBox('Recycling', {each: 5, per: 2}, (r) => [
    {text: '${0} VP per ${1} spaces of the lower of MarsBot\'s building and bio tracks', params: [r.each, r.per]},
  ], dividendGoal(10, 12)),
  [MarsBotCorpId.C24_SPLICE]: dividendBox('Gene Bank', {own: 4, theirs: 1}, (r) => [
    {text: '${0} VP per microbe tag in MarsBot\'s played pile', params: [r.own]},
    {text: '${0} VP per card with a microbe tag the other players played', params: [r.theirs]},
  ], dividendGoal(5, 6)),
  [MarsBotCorpId.C25_VIRON]: dividendBox('Blue Cards', {each: 2}, (r) => [
    {text: '${0} VP per blue card with an action in MarsBot\'s played pile', params: [r.each]},
  ], dividendGoal(12, 14)),
  [MarsBotCorpId.C26_CELESTIC]: dividendBox('Cloud Fleet', {tag: 2, step: 2}, (r) => [
    {text: '${0} VP per Venus or Jovian tag in MarsBot\'s played pile', params: [r.tag]},
    {text: '${0} VP per Venus step MarsBot raised', params: [r.step]},
  ], dividendGoal(7, 8)),
  [MarsBotCorpId.C27_MORNING_STAR]: dividendBox('Venus Lobby', {each: 4, bonus: 5, at: 6}, (r) => [
    {text: '${0} VP per space of the Venus track MarsBot reached', params: [r.each]},
    {text: '+${0} VP if it reached #${1}', params: [r.bonus, r.at], muted: true},
  ], dividendGoal(6, 8)),
  [MarsBotCorpId.C28_APHRODITE]: dividendBox('Venus Clouds', {step: 3, tag: 2}, (r) => [
    {text: '${0} VP per Venus step MarsBot raised', params: [r.step]},
    {text: '${0} VP per Venus tag in MarsBot\'s played pile', params: [r.tag]},
  ], dividendGoal(6, 8)),
  // The third mark stood at #15 — 0.2 of the bot's tracks reach it in a Redux game (25 games), a dead line; #13 (the owner, 2026-10-28).
  [MarsBotCorpId.C29_MANUTECH]: dividendBox('Production Cycles', {low: 2, lowAt: 5, mid: 2, midAt: 10, top: 3, topAt: 13}, (r) => [
    {text: '${0} VP per MarsBot track that reached #${1}', params: [r.low, r.lowAt]},
    {text: '+${0} VP per track that reached #${1}, +${2} more at #${3}', params: [r.mid, r.midAt, r.top, r.topAt], muted: true},
  ], dividendGoal(4, 5, {term: 1})),
  [MarsBotCorpId.C30_ARIDOR]: dividendBox('New Markets', {colony: 5, cargo: 1}, (r) => [
    {text: '${0} VP per colony MarsBot owns', params: [r.colony]},
    {text: '${0} VP per resource in MarsBot\'s shipping storage', params: [r.cargo]},
  ], dividendGoal(3, 4)),
  [MarsBotCorpId.C31_ARKLIGHT]: dividendBox('Preserve', {each: 3}, (r) => [
    {text: '${0} VP per plant or animal tag in MarsBot\'s played pile', params: [r.each]},
  ], dividendGoal(7, 10)),
  [MarsBotCorpId.C32_POLYPHEMOS]: dividendBox('Trade Empire', {each: 1, from: 15}, (r) => [
    {text: '${0} VP per card in MarsBot\'s played pile beyond the first ${1}', params: [r.each, r.from]},
  ], dividendGoal(26, 30)),
  [MarsBotCorpId.C33_POSEIDON]: dividendBox('Trade Routes', {any: 2, own: 4}, (r) => [
    {text: '${0} VP per colony in play', params: [r.any]},
    {text: '+${0} VP per colony MarsBot owns', params: [r.own]},
  ], dividendGoal(8, 9)),
  [MarsBotCorpId.C34_STORMCRAFT]: dividendBox('Storm Reserve', {jovian: 3, step: 2, floater: 1}, (r) => [
    {text: '${0} VP per Jovian tag in MarsBot\'s played pile', params: [r.jovian]},
    {text: '${0} VP per temperature step MarsBot raised', params: [r.step]},
    {text: '${0} VP per floater MarsBot holds', params: [r.floater]},
  ], dividendGoal(8, 10, {term: 1})),
  [MarsBotCorpId.C35_LAKEFRONT_RESORTS]: dividendBox('Shoreline', {tile: 2, ocean: 2}, (r) => [
    {text: '${0} VP per MarsBot tile next to an ocean', params: [r.tile]},
    {text: '${0} VP per ocean MarsBot placed', params: [r.ocean]},
  ], dividendGoal(9, 11)),
  [MarsBotCorpId.C36_PRISTAR]: dividendBox('Conservative', {each: 3, cap: 24}, (r) => [
    {text: '${0} VP per Failed Action MarsBot took', params: [r.each]},
    {text: 'At most ${0} VP', params: [r.cap], muted: true},
  ], dividendGoal(11, 14)),
  [MarsBotCorpId.C38_TERRALABS]: dividendBox('Cheap Research', {each: 1, max: 9}, (r) => [
    {text: '${0} VP per card costing ${1} M€ or less in MarsBot\'s played pile', params: [r.each, r.max]},
  ], dividendGoal(21, 23)),
  [MarsBotCorpId.C39_UTOPIA_INVEST]: dividendBox('Summits', {each: 2, from: 5}, (r) => [
    {text: '${0} VP per space of MarsBot\'s most advanced track beyond #${1}', params: [r.each, r.from]},
  ], dividendGoal(12, 13, {vp: 5, vp2: 10})),
  [MarsBotCorpId.C40_ECOTEC]: dividendBox('Biomass', {each: 2, bonus: 4, at: 5}, (r) => [
    {text: '${0} VP per MarsBot greenery next to a MarsBot city', params: [r.each]},
    {text: MORE_OR_EQUAL, params: [r.bonus, r.at], muted: true},
  ], dividendGoal(9, 10)),
  [MarsBotCorpId.C41_KUIPER_COOPERATIVE]: dividendBox('Kuiper Belt', {track: 1, ocean: 2}, (r) => [
    {text: '${0} VP per space of the space track MarsBot reached', params: [r.track]},
    {text: '${0} VP per ocean MarsBot placed', params: [r.ocean]},
  ], dividendGoal(12, 15)),
  [MarsBotCorpId.C42_NIRGAL_ENTERPRISES]: dividendBox('Contender', {first: 5, second: 2}, (r) => [
    {text: '${0} VP per award (funded or not) MarsBot leads', params: [r.first]},
    {text: '${0} VP per award where MarsBot is second', params: [r.second]},
  ], dividendGoal(4, 5)),
  [MarsBotCorpId.C43_PALLADIN_SHIPPING]: dividendBox('Cargo Lines', {each: 5, per: 2}, (r) => [
    {text: '${0} VP per ${1} spaces of the lower of MarsBot\'s space and event tracks', params: [r.each, r.per]},
  ], dividendGoal(12, 15)),
  [MarsBotCorpId.C44_SAGITTA_FRONTIER_SERVICES]: dividendBox('Frontier', {none: 3, one: 1, onePer: 2}, (r) => [
    {text: '${0} VP per card with no tags in MarsBot\'s played pile', params: [r.none]},
    {text: '${0} VP per ${1} cards with exactly one tag', params: [r.one, r.onePer]},
  ], dividendGoal(7, 9)),
  [MarsBotCorpId.C45_SPIRE]: dividendBox('The Spire', {two: 1, three: 2}, (r) => [
    {text: '${0} VP per card with 2 or more tags in MarsBot\'s played pile', params: [r.two]},
    {text: '+${0} VP per card with 3 or more tags', params: [r.three], muted: true},
  ], dividendGoal(16, 17)),
  [MarsBotCorpId.C46_TYCHO_MAGNETICS]: dividendBox('Interface', {each: 4}, (r) => [
    {text: '${0} VP per space of the lower of MarsBot\'s power and science tracks', params: [r.each]},
  ], dividendGoal(7, 9)),
};

export function marsBotDividendInfo(id: MarsBotCorpId): MarsBotDividendInfo {
  return DIVIDENDS[id];
}

/** EN i18n kicker of the box (beside the RB-B box names in `CORP_SECTION_LABEL`). */
export const DIVIDEND_SECTION_LABEL = 'Dividends';
