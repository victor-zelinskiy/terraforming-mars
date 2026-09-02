import {expect} from 'chai';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {CardResource} from '@/common/CardResource';
import {Phase} from '@/common/Phase';
import {TileType} from '@/common/TileType';
import {GameEvent} from '@/common/events/GameEvent';
import {EventImpact} from '@/common/events/EventImpact';
import {MarsBotTurn} from '@/common/automa/MarsBotTurn';
import {
  importanceForRoot,
  signOf,
  viewerImpactOfBotTurn,
  viewerImpactOfChain,
} from '@/client/components/notifications/notificationSemantics';

const RED: Color = 'red';
const BLUE: Color = 'blue';
const CARD = 'Predators' as CardName;

function event(partial: Partial<GameEvent> & {id: number; type: GameEvent['type']; correlationId: number; impact: EventImpact}): GameEvent {
  return {
    generation: 1,
    phase: Phase.ACTION,
    visibility: 'journal',
    ...partial,
  } as GameEvent;
}

describe('notificationSemantics (viewer-relative sign + importance)', () => {
  describe('viewerImpactOfChain', () => {
    it('is NEUTRAL when the viewer is the actor (own actions never grow a band)', () => {
      const chain = [event({id: 1, type: 'resource-changed', player: RED, correlationId: 1, impact: {stock: {megacredits: -8}}})];
      expect(viewerImpactOfChain(chain, RED, RED).sign).to.eq('neutral');
    });

    it('splits the viewer own deltas into gains and losses, sign per recipient', () => {
      const chain = [
        event({id: 1, type: 'action', player: RED, correlationId: 1, impact: {}}),
        event({id: 2, type: 'resource-changed', player: BLUE, correlationId: 1, source: {kind: 'card', card: CARD, owner: RED}, impact: {stock: {plants: -2}}}),
        event({id: 3, type: 'cards-drawn', player: BLUE, correlationId: 1, impact: {cardsDrawn: 1}}),
        // The actor's own delta is context, never the viewer's.
        event({id: 4, type: 'resource-changed', player: RED, correlationId: 1, impact: {stock: {energy: 3}}}),
      ];
      const impact = viewerImpactOfChain(chain, BLUE, RED);
      expect(impact.sign).to.eq('mixed');
      expect(impact.losses).to.deep.eq([{icon: 'plants', text: '−2'}]);
      expect(impact.gains).to.deep.eq([{icon: 'cards', text: '+1'}]);
      expect(impact.attacker).to.eq(RED);
      expect(impact.sourceCard).to.eq(CARD);
      expect(impact.scope).to.eq('stock');
    });

    it('merges WITHIN a direction, never across — a masked loss must not net to silence', () => {
      // The viewer loses 2 plants to an attack AND gains 2 plants elsewhere in
      // the same action: the two are both real and both stated (the task's
      // mixed-result rule — a net would hide the attack entirely).
      const chain = [
        event({id: 1, type: 'resource-changed', player: BLUE, correlationId: 1, source: {kind: 'card', card: CARD, owner: RED}, impact: {stock: {plants: -2}}}),
        event({id: 2, type: 'resource-changed', player: BLUE, correlationId: 1, impact: {stock: {plants: 2}}}),
        event({id: 3, type: 'resource-changed', player: BLUE, correlationId: 1, impact: {stock: {heat: 1}}}),
        event({id: 4, type: 'resource-changed', player: BLUE, correlationId: 1, impact: {stock: {heat: 1}}}),
      ];
      const impact = viewerImpactOfChain(chain, BLUE, RED);
      expect(impact.sign).to.eq('mixed');
      expect(impact.gains).to.deep.eq([{icon: 'plants', text: '+2'}, {icon: 'heat', text: '+2'}]);
      expect(impact.losses).to.deep.eq([{icon: 'plants', text: '−2'}]);
    });

    it('production losses set the production scope; discounts are never a loss', () => {
      const chain = [
        event({id: 1, type: 'production-changed', player: BLUE, correlationId: 1, target: {player: RED}, impact: {production: {energy: -1}}}),
        event({id: 2, type: 'discount-applied', player: BLUE, correlationId: 1, impact: {megacreditsSaved: 3}}),
      ];
      const impact = viewerImpactOfChain(chain, BLUE, RED);
      expect(impact.sign).to.eq('negative');
      expect(impact.scope).to.eq('production');
      expect(impact.transfer).to.eq(true);
      expect(impact.losses).to.deep.eq([{icon: 'energy', text: '−1', production: true}]);
    });

    it('surfaces a forced discard and a VP move (the deltas the journal rows omit)', () => {
      const chain = [
        event({id: 1, type: 'cards-drawn', player: BLUE, correlationId: 1, source: {kind: 'card', card: CARD, owner: RED}, impact: {cardsDiscarded: 2}}),
        event({id: 2, type: 'vp-granted', player: BLUE, correlationId: 1, source: {kind: 'card', card: CARD, owner: RED}, impact: {vp: -1}}),
      ];
      const impact = viewerImpactOfChain(chain, BLUE, RED);
      expect(impact.sign).to.eq('negative');
      expect(impact.losses).to.deep.eq([
        {icon: 'cards', text: '−2'},
        {icon: 'vp', text: '−1'},
      ]);
      expect(impact.scope).to.eq('vp');
    });

    it('a BACKWARD Hydronetwork move is a track-scoped loss whose text is the position reading', () => {
      // Corporate Espionage: the canonical `delta-position-changed` fact — the
      // attacker rides `target.player`/`source.owner`, the chip is «from → to»
      // (never a summable amount), and it must LEAD the losses without being
      // netted against stock chips.
      const chain = [
        event({id: 1, type: 'delta-position-changed', player: BLUE, correlationId: 1, target: {player: RED}, source: {kind: 'card', card: CARD, owner: RED}, impact: {deltaPosition: {from: 1, to: 0, steps: -1}}}),
        event({id: 2, type: 'resource-changed', player: BLUE, correlationId: 1, impact: {stock: {titanium: 1}}}),
      ];
      const impact = viewerImpactOfChain(chain, BLUE, RED);
      expect(impact.sign).to.eq('mixed');
      expect(impact.losses).to.deep.eq([{icon: '', text: '1 → 0'}]);
      expect(impact.gains).to.deep.eq([{icon: 'titanium', text: '+1'}]);
      expect(impact.scope).to.eq('track');
      expect(impact.attacker).to.eq(RED);
      expect(impact.sourceCard).to.eq(CARD);
    });

    it('a Modular Floodgates BLOCKADE placed against the viewer is a track-scoped worded loss naming the deployer', () => {
      // The canonical `delta-blockade-changed` fact: no number moved — the
      // loss is the standing ban itself, carried by the worded chip unit
      // (`hydro-blockade`), scope 'track', the deployer as the attacker.
      const chain = [
        event({id: 1, type: 'delta-blockade-changed', player: BLUE, correlationId: 1, target: {player: RED}, source: {kind: 'card', card: CARD, owner: RED}, impact: {deltaBlockade: {phase: 'placed', untilGeneration: 4}}}),
      ];
      const impact = viewerImpactOfChain(chain, BLUE, RED);
      expect(impact.sign).to.eq('negative');
      expect(impact.losses).to.deep.eq([{icon: 'hydro-blockade', text: ''}]);
      expect(impact.scope).to.eq('track');
      expect(impact.attacker).to.eq(RED);
      expect(impact.sourceCard).to.eq(CARD);
    });

    it('a blockade EXPIRATION is a quiet journal fact — never a band', () => {
      const chain = [
        event({id: 1, type: 'delta-blockade-changed', player: BLUE, correlationId: 1, source: {kind: 'card', card: CARD, owner: RED}, impact: {deltaBlockade: {phase: 'expired', untilGeneration: 4}}}),
      ];
      const impact = viewerImpactOfChain(chain, BLUE, RED);
      expect(impact.sign).to.eq('neutral');
      expect(impact.losses).to.deep.eq([]);
    });

    it('a FORWARD delta move of the viewer inside a foreign chain grows no loss row', () => {
      const chain = [
        event({id: 1, type: 'delta-position-changed', player: BLUE, correlationId: 1, impact: {deltaPosition: {from: 1, to: 2, steps: 1}}}),
      ];
      expect(viewerImpactOfChain(chain, BLUE, RED).sign).to.eq('neutral');
    });
  });

  describe('viewerImpactOfBotTurn', () => {
    function turn(steps: MarsBotTurn['steps']): MarsBotTurn {
      return {id: 1, generation: 2, steps};
    }

    it('reads the viewer own impact steps; the bot own steps are context', () => {
      const t = turn([
        {kind: 'impact', impact: {target: RED, targetIsBot: true, changes: [{resource: 'megacredits' as never, scope: 'stock', before: 0, after: 5}]}},
        {kind: 'impact', impact: {target: BLUE, targetIsBot: false, changes: [
          {resource: 'plants' as never, scope: 'stock', before: 5, after: 3},
          {resource: 'heat' as never, scope: 'production', before: 1, after: 2},
        ]}},
      ]);
      const impact = viewerImpactOfBotTurn(t, BLUE, RED);
      expect(impact.sign).to.eq('mixed');
      expect(impact.losses).to.deep.eq([{icon: 'plants', text: '−2'}]);
      expect(impact.gains).to.deep.eq([{icon: 'heat', text: '+1', production: true}]);
      expect(impact.attacker).to.eq(RED);
    });

    it('a blocked / empty attack leaves the impact honestly neutral', () => {
      const t = turn([
        {kind: 'attack', attack: {target: BLUE, resource: 'plants' as never, demanded: 2, removed: 0, outcome: 'protected'}},
      ]);
      expect(viewerImpactOfBotTurn(t, BLUE, RED).sign).to.eq('neutral');
    });

    // ── THE P0 REGRESSION (the bonus-card attack) ────────────────────────────
    // The server's end-of-turn snapshot SUPPRESSES a change an attack step
    // already narrated (AutomaTurnLog `coveredByAttack`), so for a bonus-card
    // attack the attack step is the ONLY carrier of the loss. Reading impacts
    // alone built the card NEUTRAL on frame one and the red hero arrived via
    // the (now removed) visible-card refresh — the late-upgrade defect.
    it('an ATTACK step alone (impact suppressed by coveredByAttack) makes the sign negative AT BUILD', () => {
      const t = turn([
        {kind: 'reveal', card: {kind: 'bonus', id: 'B01' as never}},
        {kind: 'attack', attack: {target: BLUE, resource: 'plants' as never, demanded: 5, removed: 5, before: 508, after: 503, outcome: 'hit'}},
      ]);
      const impact = viewerImpactOfBotTurn(t, BLUE, RED);
      expect(impact.sign).to.eq('negative');
      expect(impact.losses).to.deep.eq([{icon: 'plants', text: '−5'}]);
      expect(impact.attacker).to.eq(RED);
      expect(impact.scope).to.eq('stock');
    });

    it('attack + surviving impact NET never double-count one loss (the back-out)', () => {
      // Attack −5 (10→5), then an unrelated +2 → the whole-turn snapshot is
      // 10→7, which does NOT match the attack exactly, so it is NOT covered.
      // The honest reading: −5 to the attack, +2 gained elsewhere (mixed) —
      // never −5 −3 (double-counting) and never a silent net −3.
      const t = turn([
        {kind: 'attack', attack: {target: BLUE, resource: 'plants' as never, demanded: 5, removed: 5, before: 10, after: 5, outcome: 'hit'}},
        {kind: 'impact', impact: {target: BLUE, targetIsBot: false, changes: [
          {resource: 'plants' as never, scope: 'stock', before: 10, after: 7},
        ]}},
      ]);
      const impact = viewerImpactOfBotTurn(t, BLUE, RED);
      expect(impact.sign).to.eq('mixed');
      expect(impact.losses).to.deep.eq([{icon: 'plants', text: '−5'}]);
      expect(impact.gains).to.deep.eq([{icon: 'plants', text: '+2'}]);
    });

    it('two attacks whose combined span the snapshot keeps read once, not twice', () => {
      // Two −5 attacks (10→5, 5→0): the whole-turn diff (10→0) matches
      // neither exactly, so the snapshot change SURVIVES — the back-out must
      // still yield exactly −10.
      const t = turn([
        {kind: 'attack', attack: {target: BLUE, resource: 'plants' as never, demanded: 5, removed: 5, before: 10, after: 5, outcome: 'hit'}},
        {kind: 'attack', attack: {target: BLUE, resource: 'plants' as never, demanded: 5, removed: 5, before: 5, after: 0, outcome: 'hit'}},
        {kind: 'impact', impact: {target: BLUE, targetIsBot: false, changes: [
          {resource: 'plants' as never, scope: 'stock', before: 10, after: 0},
        ]}},
      ]);
      const impact = viewerImpactOfBotTurn(t, BLUE, RED);
      expect(impact.sign).to.eq('negative');
      expect(impact.losses).to.deep.eq([{icon: 'plants', text: '−10'}]);
    });

    it('the composite cube demand (resolves later via the target pick) is not a loss at turn time', () => {
      const t = turn([
        {kind: 'attack', attack: {target: BLUE, resource: 'cube', demanded: 1, removed: 0, outcome: 'target-chooses'}},
      ]);
      expect(viewerImpactOfBotTurn(t, BLUE, RED).sign).to.eq('neutral');
    });

    it('a cube the bot took OUTRIGHT is a loss, and its chip names the cube that left', () => {
      // A single candidate is no choice, so the bot removes it during its own
      // turn — the card must lead RED on its first frame (the atomic contract),
      // and the chip carries the real sprite, not the demand's animal+microbe.
      const t = turn([
        {kind: 'attack', attack: {
          target: BLUE, resource: 'cube', cardResource: CardResource.ANIMAL,
          demanded: 1, removed: 1, before: 2, after: 1, outcome: 'hit',
        }},
      ]);
      const impact = viewerImpactOfBotTurn(t, BLUE, RED);
      expect(impact.sign).to.eq('negative');
      expect(impact.losses).to.deep.eq([{icon: CardResource.ANIMAL, text: '−1'}]);
      expect(impact.attacker).to.eq(RED);
    });
  });

  describe('cause groups (the «почему» layer)', () => {
    it('a placement bonus names ITSELF — never the actor, never an anonymous gain', () => {
      const chain = [
        event({id: 1, type: 'action', player: RED, correlationId: 1, source: {kind: 'card', card: CARD, owner: RED}, impact: {}}),
        event({id: 2, type: 'resource-changed', player: BLUE, correlationId: 1, source: {kind: 'spaceBonus'}, impact: {stock: {steel: 2}}}),
      ];
      const impact = viewerImpactOfChain(chain, BLUE, RED);
      expect(impact.causes).has.length(1);
      expect(impact.causes[0].origin).deep.eq({kind: 'spaceBonus'});
      expect(impact.causes[0].gains).deep.eq([{icon: 'steel', text: '+2'}]);
    });

    it('a passive payout carries source + own + trigger + the placed tile — the full causal chain, typed', () => {
      const chain = [
        event({id: 1, type: 'action', player: RED, correlationId: 1, source: {kind: 'card', card: CardName.DOMED_CRATER, owner: RED}, impact: {}}),
        event({id: 2, type: 'tile-placed', player: RED, correlationId: 1, tile: TileType.CITY, impact: {tilesPlaced: 1}}),
        event({id: 3, type: 'effect-triggered', player: BLUE, correlationId: 1, parentId: 1, trigger: 'tile-placed', source: {kind: 'corporation', card: CardName.THARSIS_REPUBLIC, owner: BLUE}, impact: {}}),
        event({id: 4, type: 'production-changed', player: BLUE, correlationId: 1, parentId: 3, source: {kind: 'corporation', card: CardName.THARSIS_REPUBLIC, owner: BLUE}, impact: {production: {megacredits: 1}}}),
      ];
      const impact = viewerImpactOfChain(chain, BLUE, RED);
      expect(impact.causes).has.length(1);
      const cause = impact.causes[0];
      expect(cause.origin).deep.include({kind: 'corporation', card: CardName.THARSIS_REPUBLIC});
      expect(cause.own, 'the corp is the VIEWER\'s own').eq(true);
      expect(cause.trigger).eq('tile-placed');
      expect(cause.triggerTile, 'the one placed tile names the trigger').eq(TileType.CITY);
    });

    it('a source-less delta falls back to the chain ROOT (the acting card) — never to nothing', () => {
      const chain = [
        event({id: 1, type: 'action', player: RED, correlationId: 1, source: {kind: 'card', card: CARD, owner: RED}, impact: {}}),
        event({id: 2, type: 'cards-drawn', player: BLUE, correlationId: 1, impact: {cardsDrawn: 1}}),
      ];
      const impact = viewerImpactOfChain(chain, BLUE, RED);
      expect(impact.causes[0].origin).deep.include({kind: 'card', card: CARD});
      expect(impact.causes[0].own).is.undefined;
    });

    it('a system-sourced chain answers with the root action CATEGORY (solar phase), never «system»', () => {
      const chain = [
        event({id: 1, type: 'action', player: RED, correlationId: 1, category: 'solar-phase', source: {kind: 'system'}, impact: {}}),
        event({id: 2, type: 'resource-changed', player: BLUE, correlationId: 1, source: {kind: 'system'}, impact: {stock: {megacredits: 1}}}),
      ];
      const impact = viewerImpactOfChain(chain, BLUE, RED);
      expect(impact.causes[0].origin).deep.eq({kind: 'action', category: 'solar-phase'});
    });

    it('SEVERAL sources keep their own chips, and a loss-carrying cause leads', () => {
      const chain = [
        event({id: 1, type: 'action', player: RED, correlationId: 1, source: {kind: 'card', card: CARD, owner: RED}, impact: {}}),
        event({id: 2, type: 'resource-changed', player: BLUE, correlationId: 1, source: {kind: 'spaceBonus'}, impact: {stock: {plants: 1}}}),
        event({id: 3, type: 'resource-changed', player: BLUE, correlationId: 1, source: {kind: 'card', card: CARD, owner: RED}, impact: {stock: {plants: -3}}}),
      ];
      const impact = viewerImpactOfChain(chain, BLUE, RED);
      expect(impact.sign).eq('mixed');
      expect(impact.causes).has.length(2);
      expect(impact.causes[0].losses, 'the attack cause leads').deep.eq([{icon: 'plants', text: '−3'}]);
      expect(impact.causes[0].origin).deep.include({card: CARD});
      expect(impact.causes[1].origin).deep.eq({kind: 'spaceBonus'});
      expect(impact.causes[1].gains).deep.eq([{icon: 'plants', text: '+1'}]);
    });

    it('a cause keeps BOTH directions, like the band (merge within a direction, never across)', () => {
      const chain = [
        event({id: 1, type: 'resource-changed', player: BLUE, correlationId: 1, source: {kind: 'spaceBonus'}, impact: {stock: {heat: 2}}}),
        event({id: 2, type: 'resource-changed', player: BLUE, correlationId: 1, source: {kind: 'spaceBonus'}, impact: {stock: {heat: -2}}}),
        event({id: 3, type: 'resource-changed', player: BLUE, correlationId: 1, source: {kind: 'oceanBonus'}, impact: {stock: {megacredits: 2}}}),
      ];
      const impact = viewerImpactOfChain(chain, BLUE, RED);
      expect(impact.causes).has.length(2);
      const space = impact.causes.find((c) => c.origin.kind === 'spaceBonus');
      expect(space?.gains).deep.eq([{icon: 'heat', text: '+2'}]);
      expect(space?.losses, 'the loss is stated, never netted away').deep.eq([{icon: 'heat', text: '−2'}]);
    });

    it('bot turn: the script\'s server-attributed causes ride into the meta', () => {
      const t: MarsBotTurn = {id: 1, generation: 2, steps: [
        {kind: 'impact', impact: {
          target: BLUE, targetIsBot: false,
          changes: [{resource: 'megacredits' as never, scope: 'production', before: 0, after: 1}],
          causes: [{
            source: {kind: 'corporation', card: CardName.THARSIS_REPUBLIC, owner: BLUE},
            trigger: 'tile-placed',
            changes: [{resource: 'megacredits' as never, scope: 'production', amount: 1}],
          }],
        }},
      ]};
      const impact = viewerImpactOfBotTurn(t, BLUE, RED);
      expect(impact.causes).has.length(1);
      expect(impact.causes[0].origin).deep.include({card: CardName.THARSIS_REPUBLIC});
      expect(impact.causes[0].own).eq(true);
      expect(impact.causes[0].trigger).eq('tile-placed');
    });

    it('bot turn: the RESIDUAL the attribution did not cover keys on the revealed card (the cube attack)', () => {
      const t: MarsBotTurn = {id: 1, generation: 2, steps: [
        {kind: 'reveal', card: {kind: 'bonus', id: 'B02' as never}},
        {kind: 'attack', attack: {
          target: BLUE, resource: 'cube', cardResource: CardResource.ANIMAL,
          demanded: 1, removed: 1, before: 2, after: 1, outcome: 'hit',
        }},
      ]};
      const impact = viewerImpactOfBotTurn(t, BLUE, RED);
      expect(impact.causes).has.length(1);
      expect(impact.causes[0].origin).deep.eq({kind: 'bonusCard', bonusCard: 'B02'});
      expect(impact.causes[0].losses).deep.eq([{icon: CardResource.ANIMAL, text: '−1'}]);
    });

    it('bot turn: attribution + residual never double-claim — the groups add up to the band', () => {
      const t: MarsBotTurn = {id: 1, generation: 2, steps: [
        {kind: 'reveal', card: {kind: 'project', name: CARD}},
        {kind: 'impact', impact: {
          target: BLUE, targetIsBot: false,
          changes: [{resource: 'megacredits' as never, scope: 'stock', before: 0, after: 5}],
          causes: [{
            source: {kind: 'colony', name: 'Luna' as never, benefit: 'colonyBonus'},
            changes: [{resource: 'megacredits' as never, scope: 'stock', amount: 2}],
          }],
        }},
      ]};
      const impact = viewerImpactOfBotTurn(t, BLUE, RED);
      expect(impact.gains).deep.eq([{icon: 'megacredits', text: '+5'}]);
      expect(impact.causes).has.length(2);
      expect(impact.causes[0].gains).deep.eq([{icon: 'megacredits', text: '+2'}]);
      expect(impact.causes[1].origin).deep.eq({kind: 'card', card: CARD});
      expect(impact.causes[1].gains, 'the residual is the exact remainder').deep.eq([{icon: 'megacredits', text: '+3'}]);
    });

    it('a neutral impact carries NO causes; a non-neutral one always carries at least one', () => {
      expect(viewerImpactOfChain([], BLUE, RED).causes).deep.eq([]);
      const chain = [
        event({id: 1, type: 'resource-changed', player: BLUE, correlationId: 1, impact: {stock: {heat: 1}}}),
      ];
      // No source anywhere — even then the fallback names the ACTION.
      const impact = viewerImpactOfChain(chain, BLUE, RED);
      expect(impact.sign).eq('positive');
      expect(impact.causes.length).greaterThan(0);
    });
  });

  describe('the two axes stay independent', () => {
    it('signOf', () => {
      const chip = {icon: 'heat', text: '+1'};
      expect(signOf([chip], [])).to.eq('positive');
      expect(signOf([], [chip])).to.eq('negative');
      expect(signOf([chip], [chip])).to.eq('mixed');
      expect(signOf([], [])).to.eq('neutral');
    });

    it('importanceForRoot — a loss is critical, a gain merely notable, the rest ambient', () => {
      const base = {viewerLoss: false, viewerGain: false, prestige: false, threat: false, vpPressure: false};
      expect(importanceForRoot({...base, viewerLoss: true})).to.eq('critical');
      expect(importanceForRoot({...base, vpPressure: true})).to.eq('critical');
      expect(importanceForRoot({...base, viewerGain: true})).to.eq('notable');
      expect(importanceForRoot({...base, prestige: true})).to.eq('notable');
      expect(importanceForRoot({...base, threat: true})).to.eq('notable');
      expect(importanceForRoot(base)).to.eq('ambient');
    });
  });
});
