import {expect} from 'chai';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {VictoryPointsBreakdown} from '@/common/game/VictoryPointsBreakdown';
import {
  beginPanelRewardHold, clearPanelRewardHold, heldVictoryPoints, noteCardResourceLanding, releasePanelRewardHold,
} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {VP_RAIL_KEY, isVpTransfer, vpTransferSpec} from '@/client/console/resourceTransfer/resourceTransferModel';
import {
  claimVpShares, flyVpShares, holdsVpShares, isBoardVpShare, noteVpHeldElsewhere, releaseVpShares,
  resetVpShareLedgerForTests, seedVpShares, vpShareState,
} from '@/client/console/scoreCell/vpShareLedger';
import {vpReasonViews} from '@/client/console/scoreCell/vpReasonText';
import {privateScoreState} from '@/client/components/overview/privateScoreState';
import {reduceMotionOverrideState} from '@/client/utils/reducedMotion';

/*
 * THE SCORE CELL'S SHARE LEDGER (TR55 — docs/claude/console/score-cell.md): the VP token is one kind of the shared
 * transfer language, held in the panel's ONE victory-point hold; the ledger attributes the server's two breakdowns,
 * nets what other writers hold, holds a share a host claimed and NAMES every other one. Pinned here: the token's
 * spec and hold, the seed (claimed / unclaimed / netted / masked / reduced), every release road, the board matcher
 * and the cause's words.
 */

function breakdown(parts: Partial<VictoryPointsBreakdown> = {}): VictoryPointsBreakdown {
  const base: VictoryPointsBreakdown = {
    terraformRating: 20,
    terraformRatingBreakdown: {base: 20, temperature: 0, oxygen: 0, oceans: 0, venus: 0, cards: 0},
    milestones: 0, awards: 0, greenery: 0, city: 0, escapeVelocity: 0, moonHabitats: 0, moonMines: 0, moonRoads: 0,
    planetaryTracks: 0, deltaProject: 0, victoryPoints: 0, total: 0,
    detailsCards: [], detailsMilestones: [], detailsAwards: [], detailsPlanetaryTracks: [], detailsCities: [], negativeVP: 0,
    ...parts,
  };
  const total = base.terraformRating + base.milestones + base.awards + base.greenery + base.city + base.victoryPoints;
  return {...base, total};
}

function view(vp: VictoryPointsBreakdown, id = 'p-viewer'): PlayerViewModel {
  return {id, game: {phase: 'action'}, thisPlayer: {color: 'blue', terraformRating: vp.terraformRating, victoryPointsBreakdown: vp}} as unknown as PlayerViewModel;
}

const card = (cardName: string, victoryPoint: number) => ({cardName, victoryPoint, kind: 'fixed' as const});
const BEFORE = breakdown();
/** The viewer played a «2 VP» card. */
const AFTER_CARD = breakdown({victoryPoints: 2, detailsCards: [card('Nuclear Warhead Utilization', 2)]});
const isCard = (name: string) => (share: {source: {kind: string, card?: string}}) => share.source.kind === 'card' && share.source.card === name;

describe('vpShareLedger — the score cell obeys the law of causality', () => {
  afterEach(() => {
    resetVpShareLedgerForTests();
    clearPanelRewardHold();
    privateScoreState.enabled = false;
    reduceMotionOverrideState.enabled = false;
  });

  describe('the VP token — one kind of the shared transfer language', () => {
    it('rides the stock channel under the rail\'s VP key; a loss walks the same token backwards', () => {
      expect(vpTransferSpec(2)).deep.eq({channel: 'stock', resource: VP_RAIL_KEY, amount: 2});
      expect(vpTransferSpec(-3)).deep.eq({channel: 'stock', resource: VP_RAIL_KEY, amount: 3, direction: 'loss'});
      expect(isVpTransfer(vpTransferSpec(1))).is.true;
      expect(isVpTransfer({channel: 'stock', resource: 'megacredits'})).is.false;
    });

    it('is held in the ONE victory-point hold, signed — never a second map', () => {
      beginPanelRewardHold([vpTransferSpec(2)]);
      expect(heldVictoryPoints()).eq(2);
      beginPanelRewardHold([vpTransferSpec(-3)]);
      expect(heldVictoryPoints(), 'brought minus taken away').eq(-1);
      releasePanelRewardHold(vpTransferSpec(2));
      releasePanelRewardHold(vpTransferSpec(-3));
      expect(heldVictoryPoints()).eq(0);
    });
  });

  describe('the seed — attribute, net, hold what a host claimed, name the rest', () => {
    it('no claim: nothing is held, the share is NAMED beside the cell', () => {
      seedVpShares(view(BEFORE), view(AFTER_CARD));
      expect(heldVictoryPoints()).eq(0);
      expect(vpShareState.reason?.lines).deep.eq([{source: {kind: 'card', card: 'Nuclear Warhead Utilization'}, points: 2}]);
      expect(vpShareState.last?.ticked).deep.eq(['card:Nuclear Warhead Utilization +2']);
    });

    it('a claimed share is HELD for its host\'s token — the cell reads «total − held»', () => {
      claimVpShares('host', isCard('Nuclear Warhead Utilization'), 10);
      seedVpShares(view(BEFORE), view(AFTER_CARD));
      expect(heldVictoryPoints()).eq(2);
      expect(holdsVpShares('host')).is.true;
      expect(vpShareState.reason, 'a share with a body is never named').is.undefined;
    });

    it('the TR is the rating cell\'s own business — never a share of the ledger', () => {
      claimVpShares('host', () => true, 10);
      seedVpShares(view(BEFORE), view(breakdown({terraformRating: 22})));
      expect(heldVictoryPoints()).eq(0);
      expect(vpShareState.reason).is.undefined;
    });

    it('what another writer holds in this response is NETTED out — a card resource\'s points are never held twice', () => {
      claimVpShares('host', () => true, 10);
      noteVpHeldElsewhere({kind: 'card', card: 'Nuclear Warhead Utilization'}, 2);
      seedVpShares(view(BEFORE), view(AFTER_CARD));
      expect(heldVictoryPoints()).eq(0);
      expect(vpShareState.last?.netted).deep.eq(['card:Nuclear Warhead Utilization +2']);
      expect(vpShareState.last?.mismatches).deep.eq([]);
    });

    it('a writer that holds more than the score moved is a NAMED mismatch (К-V3 — the client\'s count checked)', () => {
      noteVpHeldElsewhere({kind: 'card', card: 'Nuclear Warhead Utilization'}, 3);
      noteVpHeldElsewhere({kind: 'card', card: 'Birds'}, 1);
      seedVpShares(view(BEFORE), view(AFTER_CARD));
      expect(vpShareState.last?.mismatches).to.have.length(2);
    });

    it('the higher RANK wins a share two claims match; equal ranks — the later claim', () => {
      claimVpShares('tile', () => true, 1);
      claimVpShares('hero', isCard('Nuclear Warhead Utilization'), 10);
      seedVpShares(view(BEFORE), view(AFTER_CARD));
      expect(vpShareState.held.map((h) => h.owner)).deep.eq(['hero']);
    });

    it('the PRIVATE SCORE seeds nothing — no hold, no token, no named cause', () => {
      privateScoreState.enabled = true;
      claimVpShares('host', () => true, 10);
      seedVpShares(view(BEFORE), view(AFTER_CARD));
      expect(heldVictoryPoints()).eq(0);
      expect(vpShareState.reason).is.undefined;
    });

    it('reduced motion holds nothing: every share is named', () => {
      reduceMotionOverrideState.enabled = true;
      claimVpShares('host', () => true, 10);
      seedVpShares(view(BEFORE), view(AFTER_CARD));
      expect(heldVictoryPoints()).eq(0);
      expect(vpShareState.reason?.lines).to.have.length(1);
    });

    it('two views of different seats seed nothing', () => {
      claimVpShares('host', () => true, 10);
      seedVpShares(view(BEFORE, 'p-a'), view(AFTER_CARD, 'p-b'));
      expect(heldVictoryPoints()).eq(0);
      expect(vpShareState.reason).is.undefined;
    });
  });

  describe('every release road', () => {
    it('survives a scene\'s belt-and-braces clear — the ledger keeps what it holds', () => {
      claimVpShares('host', () => true, 10);
      seedVpShares(view(BEFORE), view(AFTER_CARD));
      clearPanelRewardHold();
      expect(heldVictoryPoints(), 'the tile scene\'s clear never ticks a card\'s printed points early').eq(2);
    });

    it('a host\'s ending releases what it did not fly — NAMED, unless its own token brought the points', () => {
      claimVpShares('host', () => true, 10);
      seedVpShares(view(BEFORE), view(AFTER_CARD));
      releaseVpShares('host', {named: false});
      expect(heldVictoryPoints()).eq(0);
      expect(vpShareState.reason).is.undefined;
      claimVpShares('host', () => true, 10);
      seedVpShares(view(BEFORE), view(AFTER_CARD));
      releaseVpShares('host', {why: 'test'});
      expect(vpShareState.reason?.lines).to.have.length(1);
    });

    it('«on landing»: the touchdown of a card resource onto its card releases that card\'s share', () => {
      claimVpShares('chain', isCard('Security Fleet'), 5, {releaseOnLanding: true});
      seedVpShares(view(BEFORE), view(breakdown({victoryPoints: 1, detailsCards: [card('Security Fleet', 1)]})));
      expect(heldVictoryPoints()).eq(1);
      noteCardResourceLanding({channel: 'card-resource', resource: 'fighter', amount: 1, targetCard: 'Birds' as never});
      expect(heldVictoryPoints(), 'another card\'s landing releases nothing').eq(1);
      noteCardResourceLanding({channel: 'card-resource', resource: 'fighter', amount: 1, targetCard: 'Security Fleet' as never});
      expect(heldVictoryPoints()).eq(0);
    });

    it('a flight with no measurable score cell degrades honestly: the hold is released, nothing hangs', async () => {
      claimVpShares('host', () => true, 10);
      seedVpShares(view(BEFORE), view(AFTER_CARD));
      const outcome = await flyVpShares('host', () => ({x: 10, y: 10}));
      expect(['landed', 'degraded']).to.include(outcome);
      expect(heldVictoryPoints()).eq(0);
      expect(vpShareState.held).deep.eq([]);
    });

    it('a share with NO origin is released at once and named', async () => {
      claimVpShares('host', () => true, 10);
      seedVpShares(view(BEFORE), view(AFTER_CARD));
      expect(await flyVpShares('host', () => undefined)).eq('degraded');
      expect(heldVictoryPoints()).eq(0);
      expect(vpShareState.reason?.lines).to.have.length(1);
    });

    it('a host that asked is told — after the seed\'s block — that shares were held for it', async () => {
      let told = 0;
      claimVpShares('remote', () => true, 1, {onSeeded: () => told++});
      seedVpShares(view(BEFORE), view(AFTER_CARD));
      expect(told, 'never inside the apply block').eq(0);
      await Promise.resolve();
      expect(told).eq(1);
    });
  });

  describe('the board\'s shares — what a tile scene may show', () => {
    const after = breakdown({detailsCards: [
      {cardName: 'Capital', victoryPoint: 3, kind: 'conditional', mechanics: {shape: 'per', unit: 'oceans', adjacent: true}},
      {cardName: 'Reds News Outlet', victoryPoint: 2, kind: 'conditional', mechanics: {shape: 'per', unit: 'tags'}},
      {cardName: 'Vermin', victoryPoint: -2, kind: 'penalty'},
    ]});
    it('a city, the greenery tiles and a card that READS THE BOARD — never a card counting its tags', () => {
      expect(isBoardVpShare({source: {kind: 'city', space: '22'}, points: 1}, after)).is.true;
      expect(isBoardVpShare({source: {kind: 'greenery'}, points: 1}, after)).is.true;
      expect(isBoardVpShare({source: {kind: 'card', card: 'Capital'}, points: 1}, after)).is.true;
      expect(isBoardVpShare({source: {kind: 'card', card: 'Vermin'}, points: -1}, after)).is.true;
      expect(isBoardVpShare({source: {kind: 'card', card: 'Reds News Outlet'}, points: 1}, after)).is.false;
      expect(isBoardVpShare({source: {kind: 'milestone', name: 'Mayor'}, points: 5}, after)).is.false;
    });
  });

  describe('the named cause — the cell\'s words', () => {
    it('signs every line with the true minus, flags a loss and says «and N more» past two', () => {
      const views = vpReasonViews([
        {source: {kind: 'card', card: 'Capital'}, points: 1},
        {source: {kind: 'award', name: 'Landlord', place: {before: '1st', after: '2nd'}}, points: -3},
        {source: {kind: 'milestone', name: 'Mayor'}, points: 5},
      ]);
      expect(views.lines.map((l) => [l.points, l.loss])).deep.eq([['+1', false], ['−3', true]]);
      expect(views.more).eq(1);
      expect(views.lines[1].label, 'the places by number, no raw template').to.not.match(/\$\{\d\}/);
      expect(views.lines[1].label).to.contain('1').and.contain('2');
    });
  });
});
