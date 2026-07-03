import {expect} from 'chai';
import {
  buildInitialCardsResponse, consoleStartState, ensureStartWizard,
  initialCardsSignature, picksForStep, stepComplete, wizardSteps,
} from '@/client/console/consoleStartState';
import {SelectInitialCardsModel} from '@/common/models/PlayerInputModel';
import {CardName} from '@/common/cards/CardName';
import * as titles from '@/common/inputs/SelectInitialCards';

/**
 * CTS T5: the start-scene wizard logic. The step identification and the
 * aggregated `{type:'initialCards', responses}` submit must stay
 * BYTE-IDENTICAL to the desktop InitialDraftFlowOverlay (which itself
 * replicates the legacy SelectInitialCards.vue shape) — one response per
 * PRESENT option, in the SERVER's option order.
 */

function cardOption(title: string, names: ReadonlyArray<CardName>, min: number, max: number) {
  return {
    type: 'card' as const,
    title,
    min,
    max,
    cards: names.map((name) => ({name})),
  };
}

function input(withPrelude: boolean, withCeo = false): SelectInitialCardsModel {
  const options: Array<unknown> = [
    cardOption(titles.SELECT_CORPORATION_TITLE, [CardName.THARSIS_REPUBLIC, CardName.CREDICOR], 1, 1),
  ];
  if (withPrelude) {
    options.push(cardOption(titles.SELECT_PRELUDE_TITLE,
      [CardName.BUSINESS_EMPIRE, CardName.DONATION, CardName.GALILEAN_MINING, CardName.LOAN], 2, 2));
  }
  if (withCeo) {
    options.push(cardOption(titles.SELECT_CEO_TITLE, [CardName.ENDER], 1, 1));
  }
  options.push(cardOption(titles.SELECT_PROJECTS_TITLE,
    [CardName.BIRDS, CardName.ANTS, CardName.FISH], 0, 10));
  return {type: 'initialCards', title: 'Select initial cards', options} as unknown as SelectInitialCardsModel;
}

describe('consoleStartState (T5 wizard logic)', () => {
  it('wizardSteps: identified by the STABLE server title constants, in order', () => {
    const steps = wizardSteps(input(true, true));
    expect(steps.map((s) => s.id)).to.deep.eq(['corp', 'prelude', 'ceo', 'projects']);
    const noPrelude = wizardSteps(input(false));
    expect(noPrelude.map((s) => s.id)).to.deep.eq(['corp', 'projects']);
  });

  it('stepComplete honors the SERVER min/max per step', () => {
    const steps = wizardSteps(input(true));
    const picks = {corp: CardName.CREDICOR, preludes: [CardName.LOAN], ceo: undefined, projects: []};
    expect(stepComplete(steps[0], picks)).to.eq(true); // corp: exactly 1
    expect(stepComplete(steps[1], picks)).to.eq(false); // preludes: 1 of 2
    expect(stepComplete(steps[2], picks)).to.eq(true); // projects: 0 is legal (min 0)
    expect(picksForStep(picks, 'prelude')).to.deep.eq([CardName.LOAN]);
  });

  it('response: one {type:card} per PRESENT option, server order (byte parity)', () => {
    const picks = {
      corp: CardName.CREDICOR,
      preludes: [CardName.LOAN, CardName.DONATION],
      ceo: undefined,
      projects: [CardName.BIRDS],
    };
    expect(buildInitialCardsResponse(input(true), picks)).to.deep.eq({
      type: 'initialCards',
      responses: [
        {type: 'card', cards: [CardName.CREDICOR]},
        {type: 'card', cards: [CardName.LOAN, CardName.DONATION]},
        {type: 'card', cards: [CardName.BIRDS]},
      ],
    });
    // No prelude expansion → 2 responses; buying nothing is an EMPTY cards
    // array (never an omitted response) — the desktop overlay contract.
    expect(buildInitialCardsResponse(input(false), {...picks, preludes: [], projects: []})).to.deep.eq({
      type: 'initialCards',
      responses: [
        {type: 'card', cards: [CardName.CREDICOR]},
        {type: 'card', cards: []},
      ],
    });
  });

  it('module state resets ONLY when the deal identity changes', () => {
    const sig = initialCardsSignature(input(true));
    ensureStartWizard('p1', sig);
    consoleStartState.corp = CardName.CREDICOR;
    consoleStartState.stepIdx = 2;
    // Same owner + same deal → picks survive (defer / re-render safety).
    ensureStartWizard('p1', sig);
    expect(consoleStartState.corp).to.eq(CardName.CREDICOR);
    expect(consoleStartState.stepIdx).to.eq(2);
    // A different player (hot-seat) or a new deal → clean slate.
    ensureStartWizard('p2', sig);
    expect(consoleStartState.corp).to.eq(undefined);
    expect(consoleStartState.stepIdx).to.eq(0);
  });

  it('signature covers every dealt set (a re-deal is a new wizard)', () => {
    const a = initialCardsSignature(input(true));
    const b = initialCardsSignature(input(false));
    expect(a).to.not.eq(b);
    expect(a).to.contain(titles.SELECT_PRELUDE_TITLE);
  });
});
