import {expect} from 'chai';
import {Color} from '../../src/common/Color';
import {CardName} from '../../src/common/cards/CardName';
import {TileType} from '../../src/common/TileType';
import {SpaceBonus} from '../../src/common/boards/SpaceBonus';
import {GameEvent} from '../../src/common/events/GameEvent';
import {EventSource, sourceKey} from '../../src/common/events/EventSource';
import {IGame} from '../../src/server/IGame';
import {SelectSpace} from '../../src/server/inputs/SelectSpace';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {DomedCrater} from '../../src/server/cards/base/DomedCrater';
import {ConvertPlants} from '../../src/server/cards/base/standardActions/ConvertPlants';
import {MarketingExperts} from '../../src/server/cards/ares/MarketingExperts';
import {RestrictedAreaAres} from '../../src/server/cards/ares/RestrictedAreaAres';
import {MonsInsurance} from '../../src/server/cards/promo/MonsInsurance';
import {DetectiveTVSeries} from '../../src/server/cards/underworld/DetectiveTVSeries';
import {Scapegoat} from '../../src/server/cards/underworld/Scapegoat';
import {SponsoredAcademies} from '../../src/server/cards/venusNext/SponsoredAcademies';
import {TharsisRepublic} from '../../src/server/cards/corporation/TharsisRepublic';
import {Pets} from '../../src/server/cards/base/Pets';
import {EmptyBoard} from '../testing/EmptyBoard';
import {TestPlayer} from '../TestPlayer';
import {cast} from '../../src/common/utils/utils';
import {runAllActions} from '../TestingUtils';
import {testGame} from '../TestGame';
import {testAutomaGame} from '../automa/AutomaTestGame';
import {viewerImpactOfChain} from '../../src/client/components/notifications/notificationSemantics';
import {causeLinesOf} from '../../src/client/components/notifications/notificationCauseView';

/**
 * THE SOURCE OF A FOREIGN GAIN BELONGS TO ITS RECIPIENT (TR59 «ИСТОЧНИК — ТО, ЧТО ЗАПЛАТИЛО ВАМ»).
 *
 * The owner's report (2026-10-16): a player gets «+1 M€» because somebody built beside their Ares tile, and the
 * notification names the BUILDER's card — the card they played, the standard project, the bot's bonus card — as
 * the source. Root cause: a payout to a non-actor that runs with no scope of its own inherits the action's source
 * (`EventRecorder.emit`: `input.source ?? ctx?.source`). The fix gives each such payout its own source; this guard is
 * the class rule, executed over the corpus of cross-player payout CLASSES:
 *
 *   for every GAIN recorded for a player who is not the chain's actor, the effective source (the event's own, else
 *   its effect marker's — exactly what the client's «почему» reads) is NOT the actor's root source — unless the
 *   actor's card itself decided that payout (a table payout: «each other player draws a card») and is ALLOW-listed
 *   below with the reason. A card / corporation source with an owner names either the recipient or an allow-listed
 *   effect that pays another seat by its own rule (the insurer's).
 *
 * A failure names the class, the card and the event — the next door someone forgets to scope fails HERE.
 */

/** Actor cards whose effect DECIDES a payout to other players — the actor's card is the honest source. */
const ROOT_PAYOUT_ALLOW: ReadonlyMap<CardName, string> = new Map([
  [CardName.SPONSORED_ACADEMIES, 'printed: «each other player draws 1 card» — the play itself pays the table'],
]);

/** Effects that pay ANOTHER seat by their own rule — the source's owner is not the recipient, honestly. */
const FOREIGN_OWNER_ALLOW: ReadonlyMap<CardName, string> = new Map([
  [CardName.MONS_INSURANCE, 'the insurer\'s corporation pays the claimant (the source is the insurance, its owner the insurer)'],
]);

function isGain(e: GameEvent): boolean {
  const i = e.impact;
  const positive = (r: Partial<Record<string, number | undefined>> | undefined) =>
    r !== undefined && Object.values(r).some((v) => v !== undefined && v > 0);
  return positive(i.stock) || positive(i.production) || (i.tr ?? 0) > 0 || (i.cardsDrawn ?? 0) > 0 ||
    (i.cardResources ?? []).some((cr) => cr.amount > 0);
}

function effectiveSource(e: GameEvent, byId: ReadonlyMap<number, GameEvent>): EventSource | undefined {
  if (e.source !== undefined) {
    return e.source;
  }
  let cursor: GameEvent | undefined = e.parentId === undefined ? undefined : byId.get(e.parentId);
  for (let depth = 0; cursor !== undefined && depth < 8; depth++) {
    if (cursor.type === 'effect-triggered') {
      return cursor.source;
    }
    cursor = cursor.parentId === undefined ? undefined : byId.get(cursor.parentId);
  }
  return undefined;
}

type Violation = {cls: string, event: number, recipient: Color | undefined, source: string, why: string};

/** The class rule over ONE chain: every foreign gain's source is the recipient's, never borrowed from the actor. */
function violationsOf(cls: string, game: IGame, rootId: number): Array<Violation> {
  const chain = game.events.events.filter((e) => e.correlationId === rootId);
  const byId = new Map(chain.map((e) => [e.id, e]));
  const root = byId.get(rootId);
  const actor = root?.player;
  const out: Array<Violation> = [];
  for (const e of chain) {
    if (e.player === undefined || e.player === actor || !isGain(e)) {
      continue;
    }
    const source = effectiveSource(e, byId);
    const key = sourceKey(source);
    const rootSource = root?.source;
    if (source !== undefined && rootSource !== undefined && key === sourceKey(rootSource)) {
      const card = 'card' in rootSource ? rootSource.card : undefined;
      if (card === undefined || !ROOT_PAYOUT_ALLOW.has(card)) {
        out.push({cls, event: e.id, recipient: e.player, source: key, why: 'the gain BORROWED the actor\'s root source'});
      }
      continue;
    }
    if (source === undefined && (root?.category === 'automa-turn' || rootSource === undefined)) {
      out.push({cls, event: e.id, recipient: e.player, source: 'none', why: 'a foreign gain with NO source at all'});
      continue;
    }
    if (source !== undefined && (source.kind === 'card' || source.kind === 'corporation') && source.owner !== undefined &&
        source.owner !== e.player && !FOREIGN_OWNER_ALLOW.has(source.card)) {
      out.push({cls, event: e.id, recipient: e.player, source: key, why: `a card source owned by ${source.owner}, paid to ${e.player}`});
    }
  }
  return out;
}

function expectClean(violations: ReadonlyArray<Violation>): void {
  expect(violations, `foreign gains with a borrowed / foreign source:\n${violations.map((v) =>
    `  · [${v.cls}] event ${v.event} → ${v.recipient}: ${v.source} — ${v.why}`).join('\n')}`).deep.eq([]);
}

function rootOf(game: IGame, pred: (e: GameEvent) => boolean): number {
  const root = game.events.events.find((e) => (e.type === 'action' || e.type === 'copied-action') && pred(e));
  expect(root, 'the door rooted an action').is.not.undefined;
  return root!.correlationId;
}

function seatAresTile(game: IGame, owner: TestPlayer, opts: {card?: CardName} = {}) {
  const space = game.board.getAvailableSpacesOnLand(owner)[0];
  space.adjacency = {bonus: [SpaceBonus.DRAW_CARD]};
  game.addTile(owner, space, {tileType: TileType.RESTRICTED_AREA, ...(opts.card !== undefined ? {card: opts.card} : {})});
  owner.megaCredits = 0;
  return space;
}

describe('foreign gain source guard (TR59 — the source of a foreign gain belongs to its recipient)', () => {
  let game: IGame;
  let actor: TestPlayer;
  let owner: TestPlayer;

  function ares(): void {
    [game, actor, owner] = testGame(2, {aresExtension: true});
    game.board = EmptyBoard.newInstance();
  }

  it('ARES · card play — the owner\'s tile pays, the played card is the trigger', () => {
    ares();
    owner.playedCards.push(new RestrictedAreaAres());
    const tile = seatAresTile(game, owner, {card: CardName.RESTRICTED_AREA_ARES});
    actor.megaCredits = 50;
    actor.playCard(new DomedCrater());
    runAllActions(game);
    const placement = cast(actor.getWaitingFor(), SelectSpace);
    const adjacent = game.board.getAdjacentSpaces(tile).find((s) => placement.spaces.includes(s))!;
    actor.process({type: 'space', spaceId: adjacent.id});
    runAllActions(game);
    const rootId = rootOf(game, (e) => e.source !== undefined && 'card' in e.source && e.source.card === CardName.DOMED_CRATER);
    expect(owner.megaCredits).eq(1);
    expectClean(violationsOf('ares-card-play', game, rootId));
    const gain = game.events.events.find((e) => e.player === owner.color && e.impact.stock?.megacredits === 1);
    expect(gain?.source, 'the tile\'s card, the owner\'s').deep.eq({kind: 'card', card: CardName.RESTRICTED_AREA_ARES, owner: owner.color});
  });

  it('ARES · standard project (pay-on-commit) — the classic «ИСТОЧНИК Город» of the owner\'s report', () => {
    ares();
    const tile = seatAresTile(game, owner, {card: CardName.RESTRICTED_AREA_ARES});
    actor.plants = 8;
    const picker = cast(new ConvertPlants().action(actor), SelectSpace);
    picker.cb(game.board.getAdjacentSpaces(tile).find((s) => picker.spaces.includes(s))!);
    runAllActions(game);
    const rootId = rootOf(game, (e) => e.category === 'standard-project');
    expect(owner.megaCredits).eq(1);
    expectClean(violationsOf('ares-standard-project', game, rootId));
  });

  it('ARES · a tile with NO card behind it — the source is the owner\'s TILE (old saves, setups)', () => {
    ares();
    const tile = seatAresTile(game, owner);
    actor.plants = 8;
    const picker = cast(new ConvertPlants().action(actor), SelectSpace);
    picker.cb(game.board.getAdjacentSpaces(tile).find((s) => picker.spaces.includes(s))!);
    runAllActions(game);
    const rootId = rootOf(game, (e) => e.category === 'standard-project');
    expectClean(violationsOf('ares-cardless-tile', game, rootId));
    const gain = game.events.events.find((e) => e.player === owner.color && e.impact.stock?.megacredits === 1);
    const marker = game.events.events.find((e) => e.id === gain?.parentId);
    expect(marker?.source).deep.eq({kind: 'tile', tileType: TileType.RESTRICTED_AREA, owner: owner.color});
    const chain = game.events.events.filter((e) => e.correlationId === rootId);
    const [line] = causeLinesOf(viewerImpactOfChain(chain, owner.color, actor.color));
    expect(line).deep.include({labelKey: 'Your tile', triggerKey: 'for a greenery next to it'});
  });

  it('ARES · Marketing Experts — its extra M€ is ITS OWN cause, the tile keeps its +1', () => {
    ares();
    owner.playedCards.push(new MarketingExperts());
    const tile = seatAresTile(game, owner, {card: CardName.RESTRICTED_AREA_ARES});
    actor.plants = 8;
    const picker = cast(new ConvertPlants().action(actor), SelectSpace);
    picker.cb(game.board.getAdjacentSpaces(tile).find((s) => picker.spaces.includes(s))!);
    runAllActions(game);
    expect(owner.megaCredits).eq(2);
    const rootId = rootOf(game, (e) => e.category === 'standard-project');
    expectClean(violationsOf('ares-marketing-experts', game, rootId));
    const chain = game.events.events.filter((e) => e.correlationId === rootId);
    const impact = viewerImpactOfChain(chain, owner.color, actor.color);
    expect(impact.gains).deep.eq([{icon: 'megacredits', text: '+2'}]);
    expect(impact.causes.map((c) => 'card' in c.origin ? c.origin.card : undefined))
      .deep.eq([CardName.RESTRICTED_AREA_ARES, CardName.MARKETING_EXPERTS]);
    // The tile is «ВАШ ТАЙЛ»; Marketing Experts is a CARD reacting to the placement — «ВАША КАРТА · за …».
    expect(causeLinesOf(impact).map((l) => l.labelKey)).deep.eq(['Your tile', 'Your card']);
    expect(impact.causes[1].trigger).eq('tile-placed');
  });

  it('ARES · a BOT turn — the owner\'s tile pays inside the automa-turn scope (no source of its own before TR59)', () => {
    const [g, human, bot] = testAutomaGame({aresExtension: true});
    g.board = EmptyBoard.newInstance();
    const space = g.board.getAvailableSpacesOnLand(human)[0];
    space.adjacency = {bonus: [SpaceBonus.DRAW_CARD]};
    g.addTile(human, space, {tileType: TileType.RESTRICTED_AREA, card: CardName.RESTRICTED_AREA_ARES});
    human.megaCredits = 0;
    // The bot's turn scope — the exact one AutomaController opens (no source: the bot's turn is not a card).
    g.events.beginAction(bot, undefined, {category: 'automa-turn'});
    const neighbour = g.board.getAdjacentSpaces(space).find((s) => s.tile === undefined && s.spaceType === 'land')!;
    g.addTile(bot, neighbour, {tileType: TileType.CITY});
    g.events.endScope();
    runAllActions(g);
    expect(human.megaCredits).eq(1);
    const rootId = rootOf(g, (e) => e.category === 'automa-turn');
    expectClean(violationsOf('ares-bot-turn', g, rootId));
  });

  it('THARSIS / PETS — the owner\'s own card paid, the foreign city is the trigger (the reference class)', () => {
    [game, actor, owner] = testGame(2);
    owner.playedCards.push(new TharsisRepublic(), new Pets());
    actor.megaCredits = 50;
    actor.playCard(new DomedCrater());
    runAllActions(game);
    const placement = cast(actor.getWaitingFor(), SelectSpace);
    actor.process({type: 'space', spaceId: placement.spaces[0].id});
    runAllActions(game);
    const rootId = rootOf(game, (e) => e.source !== undefined && 'card' in e.source && e.source.card === CardName.DOMED_CRATER);
    expectClean(violationsOf('reactive-owner-payout', game, rootId));
  });

  it('MONS INSURANCE · the claimant\'s compensation is the INSURANCE\'s, never the attacker\'s card', () => {
    const [g, insurer, attacker, claimant] = testGame(3);
    const mons = new MonsInsurance();
    insurer.playedCards.push(mons);
    g.monsInsuranceOwner = insurer;
    insurer.megaCredits = 10;
    claimant.megaCredits = 0;
    g.events.beginAction(attacker, {kind: 'card', card: CardName.HIRED_RAIDERS, owner: attacker.color}, {category: 'card-play'});
    claimant.resolveInsurance();
    g.events.endScope();
    runAllActions(g);
    expect(claimant.megaCredits).eq(3);
    const rootId = rootOf(g, (e) => e.category === 'card-play');
    expectClean(violationsOf('insurance-claim', g, rootId));
    const chain = g.events.events.filter((e) => e.correlationId === rootId);
    const impact = viewerImpactOfChain(chain, claimant.color, attacker.color);
    expect(impact.causes[0].origin).deep.include({card: CardName.MONS_INSURANCE, owner: insurer.color});
    expect(impact.causes[0].trigger).eq('insurance-claim');
    expect(impact.causes[0].via, 'the attacker\'s card fired it').deep.eq({kind: 'card', card: CardName.HIRED_RAIDERS});
  });

  it('DETECTIVE TV SERIES · the payout names the owner\'s card, the crime card is only the trigger', () => {
    const [g, playerWithTv, crimePlayer] = testGame(2, {underworldExpansion: true});
    playerWithTv.playedCards.push(new DetectiveTVSeries());
    playerWithTv.megaCredits = 0;
    crimePlayer.playCard(new Scapegoat());
    runAllActions(g);
    expect(playerWithTv.megaCredits).eq(2);
    const rootId = rootOf(g, (e) => e.source !== undefined && 'card' in e.source && e.source.card === CardName.SCAPEGOAT);
    expectClean(violationsOf('detective-tv', g, rootId));
    const gain = g.events.events.find((e) => e.player === playerWithTv.color && e.impact.stock?.megacredits === 2);
    expect(gain?.source).deep.include({card: CardName.DETECTIVE_TV_SERIES, owner: playerWithTv.color});
  });

  it('TABLE PAYOUT · Sponsored Academies — the actor\'s card decided the others\' draw (allow-listed, with its reason)', () => {
    const [g, player, other] = testGame(2, {venusNextExtension: true});
    player.cardsInHand.push(new Pets()); // something to discard
    player.megaCredits = 50;
    player.playCard(new SponsoredAcademies());
    runAllActions(g);
    if (player.getWaitingFor() !== undefined) {
      cast(player.getWaitingFor(), SelectCard);
      player.process({type: 'card', cards: [CardName.PETS]});
      runAllActions(g);
    }
    // The opponent's draw is EXTERNAL (an intake): drawn at once, withheld behind the take prompt.
    expect(other.pendingCardIntakes.length, 'the other player drew').greaterThan(0);
    const rootId = rootOf(g, (e) => e.source !== undefined && 'card' in e.source && e.source.card === CardName.SPONSORED_ACADEMIES);
    expectClean(violationsOf('table-payout', g, rootId));
  });

  it('the ALLOW lists carry a reason for every row', () => {
    for (const [card, why] of [...ROOT_PAYOUT_ALLOW, ...FOREIGN_OWNER_ALLOW]) {
      expect(why, `${card} names its reason`).to.have.length.greaterThan(20);
    }
  });
});
