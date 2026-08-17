import {expect} from 'chai';
import {Color} from '@/common/Color';
import {Phase} from '@/common/Phase';
import {GameEvent} from '@/common/events/GameEvent';
import {EventImpact} from '@/common/events/EventImpact';
import {MarsBotTurn} from '@/common/automa/MarsBotTurn';
import {
  NOTIFICATION_PRIORITY,
  NotificationKind,
  NotificationModel,
  NotificationVariant,
} from '@/client/components/notifications/notificationTypes';
import {
  VARIANT_RELEVANCE,
  affectedPlayersOfBotTurn,
  affectedPlayersOfChain,
  impactTouchesOwner,
  quickToastAllowed,
  resetFeedPolicyDiagnosticsForTesting,
} from '@/client/components/notifications/notificationFeedPolicy';

const RED: Color = 'red';
const BLUE: Color = 'blue';
const YELLOW: Color = 'yellow';

function model(extra: Partial<NotificationModel> & {kind: NotificationKind; variant: NotificationVariant}): NotificationModel {
  return {
    id: 'x',
    priority: NOTIFICATION_PRIORITY[extra.kind],
    typeLabelKey: 'Event',
    pills: [],
    detailCount: 0,
    generation: 1,
    ttl: 5000,
    persistent: false,
    createdAt: 1,
    ...extra,
  };
}

function event(partial: Partial<GameEvent> & {id: number; type: GameEvent['type']; correlationId: number; impact: EventImpact}): GameEvent {
  return {
    generation: 1,
    phase: Phase.ACTION,
    visibility: 'journal',
    ...partial,
  } as GameEvent;
}

describe('notificationFeedPolicy (the ONE quick-toast filter)', () => {
  describe('classification table', () => {
    it('classifies EVERY variant — the exhaustive worklist guard', () => {
      // A NEW NotificationVariant must be classified before it ships: the
      // Record enforces presence at compile time, and this spec pins the SET
      // so a rename/removal surfaces here instead of silently fail-opening.
      expect(Object.keys(VARIANT_RELEVANCE).sort()).to.deep.eq([
        'action-required', 'award', 'blue-action', 'bot-turn', 'colony',
        'destroy', 'event', 'generation', 'hydronetwork', 'milestone', 'pass',
        'passive-effect', 'planetary-event', 'play-card', 'production-reduction',
        'production-transfer', 'reveal-deck', 'reveal-hand', 'standard-project',
        'steal', 'terraforming-complete', 'threat', 'vp-loss', 'warning',
        'your-turn',
      ]);
    });
  });

  describe("mode 'all' — full backward compatibility", () => {
    it('allows everything, ambient or not, viewer known or not', () => {
      expect(quickToastAllowed(model({kind: 'normal', variant: 'play-card', actor: RED}), 'all', BLUE)).to.eq(true);
      expect(quickToastAllowed(model({kind: 'important', variant: 'bot-turn', actor: RED, affects: []}), 'all', BLUE)).to.eq(true);
      expect(quickToastAllowed(model({kind: 'important', variant: 'pass', actor: RED}), 'all', undefined)).to.eq(true);
    });
  });

  describe("mode 'personal' — exempt families always present", () => {
    it('hostile losses (kind negative) always present — the viewer is the victim', () => {
      for (const variant of ['destroy', 'steal', 'production-reduction', 'production-transfer'] as const) {
        expect(quickToastAllowed(model({kind: 'negative', variant, actor: RED}), 'personal', BLUE), variant).to.eq(true);
      }
    });

    it('warnings / errors always present', () => {
      expect(quickToastAllowed(model({kind: 'warning', variant: 'warning'}), 'personal', BLUE)).to.eq(true);
    });

    it('the turn prompts (mandatory signals) always present', () => {
      expect(quickToastAllowed(model({kind: 'your-turn', variant: 'your-turn'}), 'personal', BLUE)).to.eq(true);
      expect(quickToastAllowed(model({kind: 'action-required', variant: 'action-required'}), 'personal', BLUE)).to.eq(true);
    });

    it('the terraforming-complete announcement (the game-end condition) always presents', () => {
      expect(quickToastAllowed(model({kind: 'important', variant: 'terraforming-complete'}), 'personal', BLUE)).to.eq(true);
    });

    it('the Vermin VP-pressure activation always presents (every player loses VP)', () => {
      expect(quickToastAllowed(model({kind: 'negative', variant: 'vp-loss', actor: RED}), 'personal', BLUE)).to.eq(true);
    });
  });

  describe("mode 'personal' — involvement decides the rest", () => {
    it("filters another player's event that does not involve the viewer", () => {
      expect(quickToastAllowed(model({kind: 'normal', variant: 'play-card', actor: RED, affects: [RED]}), 'personal', BLUE)).to.eq(false);
      expect(quickToastAllowed(model({kind: 'important', variant: 'bot-turn', actor: RED, affects: []}), 'personal', BLUE)).to.eq(false);
      expect(quickToastAllowed(model({kind: 'important', variant: 'pass', actor: RED}), 'personal', BLUE)).to.eq(false);
      expect(quickToastAllowed(model({kind: 'important', variant: 'generation'}), 'personal', BLUE)).to.eq(false);
      expect(quickToastAllowed(model({kind: 'normal', variant: 'reveal-deck', actor: RED}), 'personal', BLUE)).to.eq(false);
    });

    it('presents when the structured affects list names the viewer', () => {
      expect(quickToastAllowed(model({kind: 'normal', variant: 'play-card', actor: RED, affects: [RED, BLUE]}), 'personal', BLUE)).to.eq(true);
      expect(quickToastAllowed(model({kind: 'important', variant: 'bot-turn', actor: RED, affects: [BLUE]}), 'personal', BLUE)).to.eq(true);
    });

    it('presents the viewer own actions (actor === viewer)', () => {
      expect(quickToastAllowed(model({kind: 'important', variant: 'threat', actor: BLUE}), 'personal', BLUE)).to.eq(true);
    });

    it('an event affecting ONLY another player stays hidden from a third player', () => {
      // Red attacks yellow: yellow is involved, blue is a bystander.
      const m = model({kind: 'normal', variant: 'play-card', actor: RED, affects: [RED, YELLOW]});
      expect(quickToastAllowed(m, 'personal', YELLOW)).to.eq(true);
      expect(quickToastAllowed(m, 'personal', BLUE)).to.eq(false);
    });

    it('the decision is the LOCAL viewer identity — a different viewer flips it, nothing else does', () => {
      // The policy takes the viewer EXPLICITLY: there is no active-player input
      // to confuse it with. The same model answers per-viewer.
      const m = model({kind: 'important', variant: 'bot-turn', actor: RED, affects: [BLUE]});
      expect(quickToastAllowed(m, 'personal', BLUE)).to.eq(true);
      expect(quickToastAllowed(m, 'personal', YELLOW)).to.eq(false);
    });
  });

  describe('fail-open safety', () => {
    it('an unknown viewer presents everything (no identity to compare)', () => {
      expect(quickToastAllowed(model({kind: 'normal', variant: 'play-card', actor: RED, affects: [RED]}), 'personal', undefined)).to.eq(true);
    });

    it('an unclassified variant presents fail-open and diagnoses itself once (dev)', () => {
      resetFeedPolicyDiagnosticsForTesting();
      const warned: Array<string> = [];
      const original = console.warn;
      console.warn = ((msg: string) => warned.push(String(msg))) as typeof console.warn;
      try {
        const rogue = model({kind: 'normal', variant: 'from-the-future' as NotificationVariant, actor: RED, affects: [RED]});
        expect(quickToastAllowed(rogue, 'personal', BLUE), 'fail-open: show, never silently lose').to.eq(true);
        expect(quickToastAllowed(rogue, 'personal', BLUE)).to.eq(true);
        expect(warned.filter((w) => w.includes('from-the-future')), 'warn once per variant').to.have.length(1);
      } finally {
        console.warn = original;
        resetFeedPolicyDiagnosticsForTesting();
      }
    });
  });

  describe('locale independence (structural inputs only)', () => {
    it('the decision ignores every text field — mutating them changes nothing', () => {
      const base = model({kind: 'normal', variant: 'play-card', actor: RED, affects: [RED]});
      const mutated = {
        ...base,
        typeLabelKey: 'Сыграна карта',
        header: {message: 'красный сыграл карту', data: []} as never,
        prompt: 'что-то по-русски',
      };
      expect(quickToastAllowed(base, 'personal', BLUE)).to.eq(quickToastAllowed(mutated, 'personal', BLUE));
      const baseShown = model({kind: 'normal', variant: 'play-card', actor: RED, affects: [BLUE]});
      const mutatedShown = {...baseShown, typeLabelKey: 'Сыграна карта'};
      expect(quickToastAllowed(baseShown, 'personal', BLUE)).to.eq(quickToastAllowed(mutatedShown, 'personal', BLUE));
    });
  });

  describe('impactTouchesOwner (what counts as a PERSONAL delta)', () => {
    it('stock / production / card resources / TR / cards / VP / payment count', () => {
      expect(impactTouchesOwner({stock: {plants: -2}})).to.eq(true);
      expect(impactTouchesOwner({production: {energy: 1}})).to.eq(true);
      expect(impactTouchesOwner({cardResources: [{cardResource: 'Microbes' as never, amount: 1}]})).to.eq(true);
      expect(impactTouchesOwner({tr: 1})).to.eq(true);
      expect(impactTouchesOwner({cardsDrawn: 2})).to.eq(true);
      expect(impactTouchesOwner({cardsDiscarded: 1})).to.eq(true);
      expect(impactTouchesOwner({vp: 1})).to.eq(true);
      expect(impactTouchesOwner({megacreditsPaid: 3})).to.eq(true);
    });

    it('board-level facts do NOT (strategic importance is not direct involvement)', () => {
      expect(impactTouchesOwner({})).to.eq(false);
      expect(impactTouchesOwner({globalParameter: {parameter: 'temperature' as never, steps: 1}})).to.eq(false);
      expect(impactTouchesOwner({tilesPlaced: 1})).to.eq(false);
      expect(impactTouchesOwner({stock: {plants: 0}})).to.eq(false);
    });
  });

  describe('affectedPlayersOfChain (root events)', () => {
    it('collects owners of personal deltas + explicit cross-player targets, deduped', () => {
      const chain = [
        event({id: 1, type: 'action', player: RED, correlationId: 7, impact: {}}),
        event({id: 2, type: 'resource-changed', player: RED, correlationId: 7, impact: {stock: {energy: 1}}}),
        // The victim's loss event names the beneficiary via target.player.
        event({id: 3, type: 'resource-changed', player: BLUE, correlationId: 7, target: {player: RED}, impact: {stock: {plants: -2}}}),
        // A board-level event involves nobody by itself.
        event({id: 4, type: 'global-parameter-changed', player: RED, correlationId: 7, impact: {globalParameter: {parameter: 'temperature' as never, steps: 1}}}),
      ];
      expect(affectedPlayersOfChain(chain)).to.deep.eq([RED, BLUE]);
    });

    it('a chain of only board-level facts involves no one', () => {
      const chain = [
        event({id: 1, type: 'action', player: RED, correlationId: 9, impact: {}}),
        event({id: 2, type: 'tile-placed', player: RED, correlationId: 9, impact: {tilesPlaced: 1}}),
      ];
      expect(affectedPlayersOfChain(chain)).to.deep.eq([]);
    });

    it('a gain the viewer received from an opponent card names the viewer', () => {
      const chain = [
        event({id: 1, type: 'action', player: RED, correlationId: 11, impact: {}}),
        event({id: 2, type: 'cards-drawn', player: BLUE, correlationId: 11, impact: {cardsDrawn: 1}}),
      ];
      expect(affectedPlayersOfChain(chain)).to.deep.eq([BLUE]);
    });
  });

  describe('affectedPlayersOfBotTurn (the typed turn script)', () => {
    function turn(steps: MarsBotTurn['steps']): MarsBotTurn {
      return {id: 1, generation: 2, steps};
    }

    it('an attack target is involved even when nothing was lost', () => {
      for (const outcome of ['hit', 'nothing-to-lose', 'protected', 'target-chooses'] as const) {
        const t = turn([{kind: 'attack', attack: {target: BLUE, resource: 'plants' as never, demanded: 2, removed: 0, outcome}}]);
        expect(affectedPlayersOfBotTurn(t), outcome).to.deep.eq([BLUE]);
      }
    });

    it('impact targets are involved; the bot own impacts are not', () => {
      const t = turn([
        {kind: 'impact', impact: {target: RED, targetIsBot: true, changes: [{resource: 'megacredits' as never, scope: 'stock', before: 0, after: 5}]}},
        {kind: 'impact', impact: {target: BLUE, targetIsBot: false, changes: [{resource: 'plants' as never, scope: 'stock', before: 5, after: 3}]}},
      ]);
      expect(affectedPlayersOfBotTurn(t)).to.deep.eq([BLUE]);
    });

    it('a self-contained bot turn (reveal / tags / advances) involves no one — «бот походил» is the noise', () => {
      const t = turn([
        {kind: 'reveal', card: {kind: 'project', name: 'Birds' as never}},
        {kind: 'advance', trackIndex: 0, from: 1, to: 2},
      ]);
      expect(affectedPlayersOfBotTurn(t)).to.deep.eq([]);
    });
  });
});
