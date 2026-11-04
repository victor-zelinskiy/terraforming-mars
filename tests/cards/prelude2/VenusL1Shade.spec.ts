import {expect} from 'chai';
import {testGame} from '../../TestGame';
import {VenusL1Shade} from '../../../src/server/cards/prelude2/VenusL1Shade';
import {IGame} from '../../../src/server/IGame';
import {TestPlayer} from '../../TestPlayer';
import {Phase} from '../../../src/common/Phase';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {ReduxParty, resolutionInstanceId} from '../../../src/common/parliament/ParliamentTypes';
import {VenusContract} from '../../../src/server/cards/prelude2/VenusContract';
import {PreservationProgram} from '../../../src/server/cards/prelude2/PreservationProgram';
import {GrantVenusAltTrackBonusDeferred} from '../../../src/server/venusNext/GrantVenusAltTrackBonusDeferred';
import {UNMI_VETO_ID} from '../../../src/server/parliament/resolutions/reds/UnmiVeto';
import {DIVERTED_RESEARCH_ID} from '../../../src/server/parliament/resolutions/reds/DivertedResearch';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {quietResolutionOf, seatEnacted} from '../../parliament/parliamentArrange';
import {runAllActions, setVenusScaleLevel} from '../../TestingUtils';

describe('VenusL1Shade', () => {
  let card: VenusL1Shade;
  let player: TestPlayer;
  let game: IGame;

  beforeEach(() => {
    card = new VenusL1Shade();
    [game, player] = testGame(1, {venusNextExtension: true});
  });

  it('Should play', () => {
    card.play(player);
    expect(game.getVenusScaleLevel()).to.eq(6);
  });
});

/**
 * P66 on the Redux table — the card is fully declarative (`global: {venus: 3}`), so every door of a Venus step is the
 * engine's own (`Game.increaseVenusScaleLevel` → `increaseTerraformRating(steps, {global: true})`): the rating per step
 * made, the ruling Greens' +2 M€ per rating step, the ceiling, the alternative board's bonus, the Reds' laws.
 */
describe('VenusL1Shade — Turmoil Redux', () => {
  type Table = {game: IGame, player: TestPlayer, rival: TestPlayer, card: VenusL1Shade};

  function table(options: {altVenusBoard?: boolean, ruling?: ReduxParty, phase?: Phase} = {}): Table {
    const [game, player, rival] = testGame(2, {
      turmoilReduxExpansion: true, coloniesExtension: true, venusNextExtension: true,
      ...(options.altVenusBoard === true ? {altVenusBoard: true} : {}),
    });
    game.phase = options.phase ?? Phase.PRELUDES;
    seatEnacted(game.parliament!, quietResolutionOf(options.ruling ?? PartyName.UNITY as ReduxParty));
    player.megaCredits = 0;
    return {game, player, rival, card: new VenusL1Shade()};
  }

  it('the printed card: a Space prelude, Venus +3, nothing else', () => {
    const t = table();
    expect(t.card.tags).deep.eq(['space']);
    expect(t.card.behavior).deep.eq({global: {venus: 3}});
  });

  it('on the start (the PRELUDES phase): Venus 0 → 6 %, TR +3 — one rating step per Venus step', () => {
    const t = table();
    const tr = t.player.terraformRating;
    t.card.play(t.player);
    runAllActions(t.game);
    expect(t.game.getVenusScaleLevel()).eq(6);
    expect(t.player.terraformRating).eq(tr + 3);
    expect(t.player.megaCredits, 'a quiet ruling party pays nothing').eq(0);
  });

  it('the ruling Greens answer the three rating steps on the start: +6 M€', () => {
    const t = table({ruling: PartyName.GREENS as ReduxParty});
    const tr = t.player.terraformRating;
    t.card.play(t.player);
    runAllActions(t.game);
    expect(t.player.terraformRating).eq(tr + 3);
    expect(t.player.megaCredits).eq(6);
  });

  it('the play preview: the Venus chip «0 → 6» and its implied rating «+3», nothing struck', () => {
    const t = table();
    t.player.preludeCardsInHand.push(t.card);
    const effects = cardPlayPreview(t.player, t.card).branches[0].effects;
    const venus = effects.find((e) => e.icon === 'venus');
    expect(venus).to.include({direction: 'gain', current: 0, resulting: 6});
    const rating = effects.find((e) => e.icon === 'tr');
    expect(rating).to.include({direction: 'gain', amount: 3, implied: true});
    expect(rating?.vetoed).is.undefined;
  });

  it('at the ceiling: 26 % → 30 % — two steps made, TR +2', () => {
    const t = table({phase: Phase.ACTION});
    setVenusScaleLevel(t.game, 26);
    const tr = t.player.terraformRating;
    t.card.play(t.player);
    runAllActions(t.game);
    expect(t.game.getVenusScaleLevel()).eq(30);
    expect(t.player.terraformRating).eq(tr + 2);
  });

  it('the alternative board 14 → 20 %: the 16 % and 18 % steps each ask the track\'s bonus', () => {
    const t = table({altVenusBoard: true, phase: Phase.ACTION});
    setVenusScaleLevel(t.game, 14);
    t.card.play(t.player);
    expect(t.game.getVenusScaleLevel()).eq(20);
    const bonuses = t.game.deferredActions.queuedFor(t.player).filter((d) => d instanceof GrantVenusAltTrackBonusDeferred);
    expect(bonuses.length, 'the bonus is its own live step').greaterThan(0);
  });

  it('from the start the 16 % bonus is out of reach: 0 → 6 % asks no bonus', () => {
    const t = table({altVenusBoard: true});
    t.card.play(t.player);
    expect(t.game.deferredActions.queuedFor(t.player).some((d) => d instanceof GrantVenusAltTrackBonusDeferred)).is.false;
  });

  it('Diverted Research (RX35) replaces no VENUS step: the scale moves, the rating comes', () => {
    const t = table({phase: Phase.ACTION});
    seatEnacted(t.game.parliament!, resolutionInstanceId(DIVERTED_RESEARCH_ID, 0));
    const tr = t.player.terraformRating;
    t.card.play(t.player);
    runAllActions(t.game);
    expect(t.game.getVenusScaleLevel()).eq(6);
    expect(t.player.terraformRating).eq(tr + 3);
  });

  it('the UNMI veto (RX42): the scale moves +3, the rating is refused — and the preview strikes it', () => {
    const t = table({phase: Phase.ACTION});
    t.game.parliament!.enacted = resolutionInstanceId(UNMI_VETO_ID, 0);
    t.player.terraformRating = 30;
    t.rival.terraformRating = 20;
    t.player.preludeCardsInHand.push(t.card);
    const rating = cardPlayPreview(t.player, t.card).branches[0].effects.find((e) => e.icon === 'tr');
    expect(rating?.vetoed, 'the preview never promises a refused rating').is.not.undefined;
    t.card.play(t.player);
    runAllActions(t.game);
    expect(t.game.getVenusScaleLevel()).eq(6);
    expect(t.player.terraformRating).eq(30);
  });

  it('Preservation Program (P57) armed in the action phase eats the first rating step: Venus +3, TR +2', () => {
    const t = table({phase: Phase.ACTION});
    t.player.playedCards.push(new PreservationProgram());
    t.player.preservationProgram = true; // armed: no rating gained in this action phase yet
    const tr = t.player.terraformRating;
    t.card.play(t.player);
    runAllActions(t.game);
    expect(t.game.getVenusScaleLevel()).eq(6);
    expect(t.player.terraformRating).eq(tr + 2);
  });

  it('Venus Contract (P65) on the table answers the three steps: +9 M€ (with the Greens: +15)', () => {
    const t = table({ruling: PartyName.GREENS as ReduxParty});
    t.player.playedCards.push(new VenusContract());
    t.card.play(t.player);
    runAllActions(t.game);
    expect(t.player.megaCredits).eq(9 + 6);
  });
});
