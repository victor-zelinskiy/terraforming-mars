import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import type {DeltaBonusPromptMeta} from '@/common/models/DeltaBonusPromptModel';
import type {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {
  hydroBonusAdvancePlan, hydroBonusCopy, hydroBonusDoorAction, hydroBonusOffer, hydroZoneState,
} from '@/client/console/hydroFlow/hydroBonusOffer';
import {HYDRO_STAGES} from '@/client/components/hydronetwork/hydroStages';
import {
  collapseWorkspaceStack, enterWorkspace, resetWorkspaceStack,
  setWorkspaceFrameServes, workspaceSurfacesFor,
} from '@/client/console/consoleWorkspaceStack';

function meta(overrides: Partial<DeltaBonusPromptMeta> = {}): DeltaBonusPromptMeta {
  return {
    source: CardName.DYNAMIC_OCEAN_BARRIER,
    steps: 1,
    fromPosition: 2,
    toPosition: 3,
    energyCost: 0,
    waivesTag: false,
    advanceIndex: 0,
    skipIndex: 1,
    ...overrides,
  };
}

describe('hydroBonusOffer (the card-granted bonus move)', () => {
  describe('detection is STRUCTURAL', () => {
    it('reads the server marker, never a title', () => {
      const wf = {type: 'or', title: 'anything at all', deltaBonusPrompt: meta()} as unknown as PlayerInputModel;
      expect(hydroBonusOffer(wf)?.source).to.eq(CardName.DYNAMIC_OCEAN_BARRIER);
    });

    it('an unmarked prompt is not an offer, whatever it says', () => {
      const wf = {type: 'or', title: 'Advance 1 step on the Delta Project track'} as unknown as PlayerInputModel;
      expect(hydroBonusOffer(wf)).is.undefined;
      expect(hydroBonusOffer(undefined)).is.undefined;
    });
  });

  describe('the working zone is mutually exclusive', () => {
    it('an idle workspace shows nothing of the offer family', () => {
      expect(hydroZoneState({offerLive: false, committing: false, resolving: false})).to.eq('idle');
    });

    it('a live, admitted offer owns the zone', () => {
      expect(hydroZoneState({offerLive: true, committing: false, resolving: false})).to.eq('bonus-offer');
    });

    // What is already RUNNING outranks what is merely offered — a second
    // ocean's offer can never paint over the move in flight.
    it('a commit in flight outranks a fresh offer', () => {
      expect(hydroZoneState({offerLive: true, committing: true, resolving: false})).to.eq('committing');
    });

    it('a resolving reward outranks both', () => {
      expect(hydroZoneState({offerLive: true, committing: true, resolving: true})).to.eq('resolving');
    });
  });

  describe('the door', () => {
    it('opens the workspace when no hydro frame exists', () => {
      expect(hydroBonusDoorAction({offerLive: true, frameKnown: false})).to.eq('open');
    });

    // Re-entering would tear the standing workspace down and rebuild it — the
    // flicker the completion barrier exists to remove.
    it('QUEUES into a workspace that is already standing', () => {
      expect(hydroBonusDoorAction({offerLive: true, frameKnown: true})).to.eq('queue');
    });

    it('does nothing without an offer', () => {
      expect(hydroBonusDoorAction({offerLive: false, frameKnown: false})).to.eq('none');
      expect(hydroBonusDoorAction({offerLive: false, frameKnown: true})).to.eq('none');
    });
  });

  describe('the copy states all four things', () => {
    it('the free offer names the source, the reason and the surviving advance', () => {
      const copy = hydroBonusCopy(meta());
      expect(copy.bodyParams).to.deep.eq([CardName.DYNAMIC_OCEAN_BARRIER]);
      expect(copy.bodyKey).to.contain('${0}');
      expect(copy.bodyKey).to.match(/free/i);
      expect(copy.bodyKey).to.match(/ocean/i);
      expect(copy.bodyKey).to.match(/stays available/i);
      expect(copy.confirmKey).to.not.match(/energy/i);
    });

    it('the waiver offer states the shortfall and the price IN THE BODY', () => {
      const copy = hydroBonusCopy(meta({waivesTag: true, energyCost: 1}));
      expect(copy.bodyKey).to.match(/1 required tag/i);
      expect(copy.bodyKey).to.match(/1 energy/i);
      expect(copy.bodyKey).to.match(/stays available/i);
    });

    /**
     * THE VERB IS THE VERB, AND ONLY THE VERB.
     *
     * The A-label is echoed into the ONE bottom command bar, where
     * «ПОТРАТИТЬ 1 ЭНЕРГИЮ И ПРОДВИНУТЬСЯ» crowded out «X Осмотреть» and
     * «B Свернуть» and then truncated itself. The price is stated by the
     * workspace's own «Будет потрачено» delta row instead — and a bonus
     * advance must not read differently from an ordinary one.
     */
    it('REGRESSION: the CTA is ONE short verb, identical for both shapes', () => {
      const free = hydroBonusCopy(meta());
      const paid = hydroBonusCopy(meta({waivesTag: true, energyCost: 1}));
      expect(paid.confirmKey).to.eq(free.confirmKey);
      expect(free.confirmKey).to.eq('Advance');
      // No price, no adverb — nothing that grows with the offer's shape.
      for (const copy of [free, paid]) {
        expect(copy.confirmKey).to.not.match(/energy|free/i);
        expect(copy.confirmKey.split(' ')).to.have.length(1);
      }
    });

    // The zone hands its stage name UP to the workspace crumb (a step surface
    // never titles itself inside someone else's frame).
    it('carries a stage name for the crumb, identical for both shapes', () => {
      expect(hydroBonusCopy(meta()).stageKey).to.eq(hydroBonusCopy(meta({waivesTag: true})).stageKey);
      expect(hydroBonusCopy(meta()).stageKey).to.have.length.greaterThan(0);
    });

    // Never leak the technical action card the standard advance rides.
    it('never mentions the hidden Delta Project action card', () => {
      for (const m of [meta(), meta({waivesTag: true})]) {
        const copy = hydroBonusCopy(m);
        for (const text of [copy.titleKey, copy.bodyKey, copy.confirmKey, copy.skipKey]) {
          expect(text).to.not.contain(CardName.DELTA_PROJECT);
        }
      }
    });
  });
});

/**
 * THE LEAK DETECTOR MUST SEE AN EARNED `serves`.
 *
 * Several workspaces declare `serves: []` in the registry and take a kind at
 * RUNTIME for the span of one prompt — precisely so an idling screen cannot
 * mask an unrelated stranded prompt. `workspaceSurfacesFor` read only the
 * registry default, so for exactly those spans it reported «no serving
 * surface» and the amber guard rose over a Hydronetwork that was rendering the
 * offer perfectly underneath it («STRANDED PROMPT: waitingFor "or"»).
 */
/**
 * ══ WHAT A COMMITTED BONUS MOVE STILL OWES ═════════════════════════
 *
 * The standard advance pre-collects its landing stage's follow-up before the
 * batch leaves. A bonus move cannot — the server framed the offer as a
 * two-option question — so everything past «take it» arrives afterwards, and
 * has to EMBED in the workspace that caused it rather than rise as a band over
 * it.
 */
describe('hydroBonusAdvancePlan', () => {
  it('a plain reward owes nothing at all', () => {
    for (const pos of [1, 2, 3, 4, 6, 8, 10, 11]) {
      const plan = hydroBonusAdvancePlan(HYDRO_STAGES[pos]);
      expect(plan.serves, `position ${pos}`).to.have.length(0);
      expect(plan.claimsDraw, `position ${pos}`).is.false;
    }
  });

  it('«Гидромоделирование» (5) claims its batch so the pick is a STAGE of this flow', () => {
    const plan = hydroBonusAdvancePlan(HYDRO_STAGES[5]);
    expect(plan.serves).to.deep.eq(['deckSelect']);
    expect(plan.claimsDraw).is.true;
    expect(plan.drawCount, 'look at 4, keep 2').to.eq(4);
  });

  it('the repeat stage (7) serves every input the copied action can raise', () => {
    const plan = hydroBonusAdvancePlan(HYDRO_STAGES[7]);
    expect(plan.serves).to.include.members(
      ['deckSelect', 'cardSelect', 'payment', 'choice', 'amount', 'resource', 'player']);
    expect(plan.claimsDraw).is.false;
  });

  it('the animal target (9) serves the card pick the SERVER will ask for', () => {
    expect(hydroBonusAdvancePlan(HYDRO_STAGES[9]).serves).to.deep.eq(['cardSelect']);
  });

  /** Keyed on the stage's own `followUp`, so the plan cannot drift from the
   *  table the rail and the reward view already read. */
  it('is derived from the stage table, not from position literals', () => {
    for (const stage of HYDRO_STAGES) {
      const owes = hydroBonusAdvancePlan(stage).serves.length > 0;
      expect(owes, `position ${stage.position}`).to.eq(stage.followUp !== undefined);
    }
    expect(hydroBonusAdvancePlan(undefined).serves).to.have.length(0);
  });
});

describe('a frame that EARNED a serves is a serving surface', () => {
  afterEach(() => {
    resetWorkspaceStack();
  });

  it('the registry default alone does not serve a runtime-earned kind', () => {
    expect(workspaceSurfacesFor('choice')).to.not.contain('.con-hydro');
  });

  it('…but a live frame that earned it does', () => {
    enterWorkspace('hydro');
    setWorkspaceFrameServes('hydro', ['choice']);
    expect(workspaceSurfacesFor('choice')).to.contain('.con-hydro');
  });

  it('…and so does a PARKED one — its surface comes back with it', () => {
    enterWorkspace('hydro');
    setWorkspaceFrameServes('hydro', ['choice']);
    collapseWorkspaceStack();
    expect(workspaceSurfacesFor('choice')).to.contain('.con-hydro');
  });
});
