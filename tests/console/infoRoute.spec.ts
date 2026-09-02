import {expect} from 'chai';
import {
  BOT_SCREEN_ENTRIES,
  INFO_SUMMARY_COLUMNS,
  InfoParticipantKind,
  InfoRouteId,
  botScreenNavigate,
  infoFocusRing,
  infoRouteApplies,
  infoRouteBack,
  infoRouteDepth,
  infoRoutePresentation,
  infoRouteStage,
  infoRouteStagePath,
  infoZoneFocusable,
  infoZoneForRoute,
  infoZoneNavigate,
  infoZonePresent,
  infoZoneRoute,
  isVpRoute,
} from '@/client/console/infoRoute';

const ALL_ROUTES: ReadonlyArray<InfoRouteId> = [
  'summary', 'vp', 'vpCategory', 'vpCards', 'played', 'extras', 'actions', 'effects',
  'botScreen', 'botBoard', 'botBonus',
];
/** Routes whose stage name is DYNAMIC (the score explorer supplies the tail
 *  from its params — `scoreStagePath`). */
const DYNAMIC_STAGE_ROUTES: ReadonlySet<InfoRouteId> = new Set(['vpCategory', 'vpCards']);
const KINDS: ReadonlyArray<InfoParticipantKind> = ['human', 'bot'];

describe('infoRoute — the Information workspace route model', () => {
  // ── the tree ──────────────────────────────────────────────────────────
  it('B is the tree: every route walks to the summary in ≤ 2 steps, the summary closes', () => {
    for (const route of ALL_ROUTES) {
      let at: InfoRouteId | undefined = route;
      let steps = 0;
      while (at !== undefined && steps < 5) {
        at = infoRouteBack(at);
        steps++;
      }
      expect(at, `${route} must terminate at the overlay close`).to.be.undefined;
      expect(steps, `${route} closes within its depth + 1 presses`).to.eq(infoRouteDepth(route) + 1);
    }
  });

  it('«Экран бота» hosts its two deep references — the documented nesting', () => {
    expect(infoRouteBack('botBoard'), 'B from the printed board returns to the hub').to.eq('botScreen');
    expect(infoRouteBack('botBonus'), 'B from the bonus piles returns to the hub').to.eq('botScreen');
    expect(infoRouteBack('botScreen'), 'B from the hub returns to the summary').to.eq('summary');
    expect(infoRouteDepth('botBoard')).to.eq(2);
    expect(infoRouteDepth('vp')).to.eq(1);
    expect(infoRouteDepth('summary')).to.eq(0);
  });

  it('the score explorer subtree: vp → vpCategory → vpCards, one B per level, shared capability', () => {
    expect(infoRouteBack('vpCards'), 'B from a group table returns to its category').to.eq('vpCategory');
    expect(infoRouteBack('vpCategory'), 'B from a category returns to the overview').to.eq('vp');
    expect(infoRouteDepth('vpCategory')).to.eq(2);
    expect(infoRouteDepth('vpCards')).to.eq(3);
    for (const kind of KINDS) {
      expect(infoRouteApplies('vpCategory', kind), 'every participant explains its score').to.be.true;
      expect(infoRouteApplies('vpCards', kind)).to.be.true;
    }
    expect(infoZoneForRoute('vpCategory'), 'B chain lands the ring on the VP zone').to.eq('vp');
    expect(infoZoneForRoute('vpCards')).to.eq('vp');
    expect(isVpRoute('vp') && isVpRoute('vpCategory') && isVpRoute('vpCards')).to.be.true;
    expect(isVpRoute('played')).to.be.false;
    // The dynamic tails do not pollute the static stage path — the explorer
    // supplies them (`scoreStagePath`).
    expect(infoRouteStagePath('vpCards')).to.deep.eq(['Victory Points']);
  });

  // ── capability ────────────────────────────────────────────────────────
  it('capability: the human-only pair and the bot family are exclusive; everything else is shared', () => {
    for (const route of ALL_ROUTES) {
      for (const kind of KINDS) {
        const applies = infoRouteApplies(route, kind);
        if (route === 'actions' || route === 'effects') {
          expect(applies, `${route} exists only for humans`).to.eq(kind === 'human');
        } else if (route === 'botScreen' || route === 'botBoard' || route === 'botBonus') {
          expect(applies, `${route} exists only for the bot`).to.eq(kind === 'bot');
        } else {
          expect(applies, `${route} is a shared route`).to.be.true;
        }
      }
    }
  });

  it('an inapplicable route PRESENTS the fallback — the route itself is never rewritten', () => {
    expect(infoRoutePresentation('actions', 'bot')).to.eq('fallback');
    expect(infoRoutePresentation('actions', 'human')).to.eq('content');
    expect(infoRoutePresentation('botScreen', 'human'), 'the reverse case holds too').to.eq('fallback');
    expect(infoRoutePresentation('vp', 'bot'), 'shared routes always serve').to.eq('content');
  });

  // ── the crumb ─────────────────────────────────────────────────────────
  it('the crumb tail: one word at depth 1, the hosted-step phrase at depth 2', () => {
    expect(infoRouteStagePath('summary')).to.deep.eq([]);
    expect(infoRouteStagePath('vp')).to.deep.eq(['Victory Points']);
    expect(infoRouteStagePath('botBoard'), 'stable context BEFORE the mutable tail').to.deep.eq(['MarsBot screen', 'MarsBot board']);
    for (const route of ALL_ROUTES) {
      if (route !== 'summary' && !DYNAMIC_STAGE_ROUTES.has(route)) {
        expect(infoRouteStage(route), `${route} names its stage`).to.not.eq('');
      }
    }
  });

  // ── the summary focus ring ────────────────────────────────────────────
  it('the ring: shared zones focus for everyone; the human-only pair only for humans', () => {
    for (const kind of KINDS) {
      expect(infoZoneFocusable('vp', kind), 'the score zone is the ring\'s anchor').to.be.true;
      expect(infoZoneFocusable('played', kind)).to.be.true;
      expect(infoZoneFocusable('extras', kind)).to.be.true;
    }
    expect(infoZoneFocusable('actions', 'human')).to.be.true;
    expect(infoZoneFocusable('actions', 'bot'), 'an absent zone cannot be focused').to.be.false;
    expect(infoZonePresent('actions', 'bot'), '…because it is not even present').to.be.false;
    expect(infoZonePresent('extras', 'bot'), 'the shared zones are present for the bot').to.be.true;
  });

  it('the ring order follows the canonical columns (shared zones first)', () => {
    expect(infoFocusRing('human')).to.deep.eq(['vp', 'played', 'extras', 'actions', 'effects']);
    expect(infoFocusRing('bot')).to.deep.eq(['vp', 'played', 'extras']);
    // The layout table itself keeps the shared-first contract.
    expect(INFO_SUMMARY_COLUMNS[0]).to.deep.eq(['vp']);
  });

  it('d-pad: columns move laterally, rows vertically, edges clamp (never wrap)', () => {
    expect(infoZoneNavigate('vp', 'right', 'human')).to.eq('played');
    expect(infoZoneNavigate('played', 'right', 'human')).to.eq('extras');
    expect(infoZoneNavigate('extras', 'down', 'human')).to.eq('actions');
    expect(infoZoneNavigate('actions', 'down', 'human')).to.eq('effects');
    expect(infoZoneNavigate('effects', 'down', 'human'), 'the bottom edge clamps').to.eq('effects');
    expect(infoZoneNavigate('vp', 'left', 'human'), 'the left edge clamps').to.eq('vp');
    expect(infoZoneNavigate('extras', 'down', 'bot'), 'the bot has no pair below extras').to.eq('extras');
  });

  it('a focus stranded by a seat switch lands on the first focusable zone', () => {
    // The cursor stood on «Действия» (human) and RB moved to the bot.
    expect(infoZoneNavigate('actions', 'down', 'bot')).to.eq('vp');
  });

  it('B from a detail lands the ring on the zone it was entered from', () => {
    expect(infoZoneForRoute('vp')).to.eq('vp');
    expect(infoZoneForRoute('extras')).to.eq('extras');
    expect(infoZoneForRoute('botScreen'), 'the bot hub has no summary zone of its own').to.be.undefined;
    expect(infoZoneRoute('vp')).to.eq('vp');
  });

  // ── the «Карты» zone is GONE — the hand dock represents the hand ──────
  it('no summary zone without a route exists — the hand lives in the dock (dockInspection)', () => {
    for (const column of INFO_SUMMARY_COLUMNS) {
      for (const zone of column) {
        expect(infoZoneRoute(zone), `${zone} must open a detail route — a pure-readout zone is a dead A`).to.not.be.undefined;
      }
    }
  });

  // ── the bot hub's own ring ────────────────────────────────────────────
  it('«Экран бота» walks its two entries and clamps at both ends', () => {
    expect(BOT_SCREEN_ENTRIES).to.deep.eq(['botBoard', 'botBonus']);
    expect(botScreenNavigate('botBoard', 'down')).to.eq('botBonus');
    expect(botScreenNavigate('botBonus', 'down')).to.eq('botBonus');
    expect(botScreenNavigate('botBonus', 'up')).to.eq('botBoard');
    expect(botScreenNavigate('botBoard', 'up')).to.eq('botBoard');
  });
});
