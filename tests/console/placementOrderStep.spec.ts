import {expect} from 'chai';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {CardName} from '@/common/cards/CardName';
import {TileType} from '@/common/TileType';
import {PlacementOrderPromptMeta, PlayerInputModel} from '@/common/models/PlayerInputModel';
import {startPlacementOrderOf, taskFor, taskServedByHost, promptOutranksStartScene} from '@/client/console/consoleTaskRouter';
import {
  firstAvailableRow, placementOrderAnswer, placementOrderStepOf, placementOrderStageParams, preludePreStepStage, stepVariantFocus,
  OCEANS_FULL_REASON, PLACED_NOTICE,
} from '@/client/console/preludeVariant/preludeVariantModel';
import {beginPreludePlayChain, endPreludePlayChain, preludeChainHoldsClaim, preludeChainOwesHand} from '@/client/console/deckPick/preludePlayChain';
import {COUNTED_DISCARD_TITLE, preludeRisk} from '@/client/console/startPreludeRisk';
import {getCard} from '@/client/cards/ClientCardManifest';
import {buildEffectDecision} from '@/client/console/effectDecision/effectDecisionModel';

/*
 * P58 · FS — THE «ОЧЕРЁДНОСТЬ» STEP (Project Eden: three placements in the player's order, a live `OrOptions` between
 * them). Pins the structural reading the hosts stand on: the server's `placementOrderPrompt` marker routes the prompt to
 * its own flavour, the START hosts it in the opening (the task host does not), the rows are the card's printed tiles in
 * the printed order with the placed ones sealed in place, and the answer is the option FOUND BY ITS TILE TYPE — never by
 * a title (the titles below are deliberately translated / shuffled). And the hand's chain owes its host the step; the
 * start's risk names a counted discard's shortfall with its count.
 */
describe('placementOrderStep', () => {
  const option = (title: string, tileType: TileType) => ({type: 'option', title, buttonLabel: 'Confirm', metadata: {kind: 'placement', tileType}});
  const prompt = (meta: Partial<PlacementOrderPromptMeta>, options = [
    option('Разместите океан', TileType.OCEAN), option('Город!', TileType.CITY), option('—', TileType.GREENERY),
  ]): PlayerInputModel => ({
    type: 'or', title: 'Which tile do you place next?', buttonLabel: 'Confirm', options,
    choiceContext: {source: {kind: 'card', card: CardName.PROJECT_EDEN}, mode: 'effect-choice'},
    placementOrderPrompt: {source: CardName.PROJECT_EDEN, done: [], remaining: [TileType.OCEAN, TileType.CITY, TileType.GREENERY], index: 1, of: 3, ...meta},
  } as unknown as PlayerInputModel);
  const view = (waitingFor: PlayerInputModel | undefined, opts: {generation?: number, phase?: string} = {}) => ({
    id: 'p-viewer',
    waitingFor,
    cardsInHand: [],
    thisPlayer: {tableau: []},
    game: {phase: opts.phase ?? 'preludes', generation: opts.generation ?? 1, gameOptions: {}},
  } as unknown as PlayerViewModel);

  describe('the router', () => {
    it('the marker is its own flavour — before `contextual`, though it carries a choiceContext', () => {
      expect(taskFor(view(prompt({})))).deep.eq({kind: 'choice', flavor: 'placementOrder'});
    });

    it('in the opening the START hosts it: the task host does not serve it, and it does not outrank the scene', () => {
      const v = view(prompt({}));
      expect(startPlacementOrderOf(v)).eq(CardName.PROJECT_EDEN);
      expect(taskServedByHost(v)).is.undefined;
      expect(promptOutranksStartScene(v), 'the scene keeps the pad — it IS the surface').is.false;
    });

    it('mid-game (WG Project, P45) the task host serves it — the chain teleports it into its host\'s zone', () => {
      const v = view(prompt({}), {generation: 3, phase: 'action'});
      expect(startPlacementOrderOf(v)).is.undefined;
      expect(taskServedByHost(v)).deep.eq({kind: 'choice', flavor: 'placementOrder'});
    });

    it('never an EFFECT DECISION — its choiceContext only names the asker (the band of the hand once read it as one)', () => {
      expect(buildEffectDecision(prompt({}), {handNames: []} as unknown as Parameters<typeof buildEffectDecision>[1])).is.undefined;
    });

    it('an ordinary OR is untouched', () => {
      const plain = {type: 'or', title: 't', buttonLabel: 'b', options: [option('a', TileType.CITY), option('b', TileType.OCEAN)]} as unknown as PlayerInputModel;
      expect(taskFor(view(plain))).deep.eq({kind: 'choice', flavor: 'generic'});
      expect(startPlacementOrderOf(view(plain))).is.undefined;
    });
  });

  describe('the step', () => {
    const renderData = getCard(CardName.PROJECT_EDEN)?.metadata.renderData;

    it('the first step: three rows in the printed order, each the card\'s own printed hex, the cursor on the first', () => {
      const step = placementOrderStepOf(prompt({}), renderData)!;
      expect(step.kind).eq('placement-order');
      expect(step.card).eq(CardName.PROJECT_EDEN);
      expect(step.rows.map((r) => r.tileType)).deep.eq([TileType.OCEAN, TileType.CITY, TileType.GREENERY]);
      expect(step.rows.every((r) => r.available && r.print !== undefined && r.print.length === 1)).is.true;
      expect(firstAvailableRow(step)).eq(0);
      expect(preludePreStepStage(step)).eq('Order');
      expect(placementOrderStageParams(step)).deep.eq(['1', '3']);
    });

    it('a placed tile stays SEALED in its place; the walk steps over it; the answer is the option of the row\'s TILE', () => {
      // The greenery placed first; the server offers the ocean and the city — the options' order NOT the rows'.
      const wf = prompt({done: [TileType.GREENERY], remaining: [TileType.OCEAN, TileType.CITY], index: 2},
        [option('Город', TileType.CITY), option('Океан', TileType.OCEAN)]);
      const step = placementOrderStepOf(wf, renderData)!;
      expect(step.rows.map((r) => [r.tileType, r.available, r.sealed === true])).deep.eq([
        [TileType.OCEAN, true, false], [TileType.CITY, true, false], [TileType.GREENERY, false, true],
      ]);
      expect(step.rows[2].notice).eq(PLACED_NOTICE);
      expect(stepVariantFocus(step, 1, 1), 'the sealed greenery is walked over').eq(0);
      expect(placementOrderAnswer(step.rows[0])).deep.eq({type: 'or', index: 1, response: {type: 'option'}});
      expect(placementOrderAnswer(step.rows[1])).deep.eq({type: 'or', index: 0, response: {type: 'option'}});
      expect(placementOrderAnswer(step.rows[2]), 'a sealed row answers nothing').is.undefined;
      expect(placementOrderStageParams(step)).deep.eq(['2', '3']);
    });

    it('an ocean skipped at the maximum is SHOWN with its reason — never offered, never silent', () => {
      const wf = prompt({remaining: [TileType.CITY, TileType.GREENERY], skipped: [TileType.OCEAN], of: 2},
        [option('c', TileType.CITY), option('g', TileType.GREENERY)]);
      const step = placementOrderStepOf(wf, renderData)!;
      expect(step.rows[0].tileType).eq(TileType.OCEAN);
      expect(step.rows[0].available).is.false;
      expect(step.rows[0].reason).eq(OCEANS_FULL_REASON);
      expect(placementOrderAnswer(step.rows[0])).is.undefined;
      expect(firstAvailableRow(step)).eq(1);
      expect(placementOrderStageParams(step)).deep.eq(['1', '2']);
    });

    it('no marker, no step', () => {
      expect(placementOrderStepOf(undefined)).is.undefined;
      expect(placementOrderStepOf({type: 'or', title: '', buttonLabel: '', options: []} as unknown as PlayerInputModel)).is.undefined;
    });
  });

  it('the hand\'s chain owes its host the order step (the hand comes back for it)', () => {
    expect(preludeChainOwesHand(view(prompt({}), {generation: 3, phase: 'action'}))).is.true;
  });

  it('…and its claim is HELD through the order step and the placement it asks (released there, the hand concluded)', () => {
    const mid = (wf: PlayerInputModel | undefined) => view(wf, {generation: 3, phase: 'action'});
    const space = {type: 'space', title: 'Select space for city tile', buttonLabel: 'Confirm', spaces: ['03']} as unknown as PlayerInputModel;
    expect(preludeChainHoldsClaim(false, mid(prompt({}))), 'no chain, no hold').is.false;
    beginPreludePlayChain(CardName.PROJECT_EDEN);
    try {
      expect(preludeChainHoldsClaim(false, mid(prompt({}))), 'the order step').is.true;
      expect(preludeChainHoldsClaim(false, mid(space)), 'the placement before it is admitted').is.true;
      const plain = {type: 'or', title: 't', buttonLabel: 'b', options: [{type: 'option', title: 'a'}, {type: 'option', title: 'b'}]} as unknown as PlayerInputModel;
      expect(preludeChainHoldsClaim(false, mid(plain)), 'an unrelated question').is.false;
    } finally {
      endPreludePlayChain();
    }
  });

  describe('the counted discard — its shortfall named with the count', () => {
    it('no fix at the table: final, the count in the body', () => {
      const risk = preludeRisk({state: 'noEffect', need: 'cardInHand', amount: 2}, (n) => n)!;
      expect(risk.tone).eq('final');
      expect(risk.title).eq(COUNTED_DISCARD_TITLE);
      expect(risk.bodyParams).deep.eq(['2']);
    });

    it('one drawing prelude covers it: guaranteed, named; several only together: possible, the count', () => {
      const one = preludeRisk({state: 'deferred', certainty: 'guaranteed', enablers: [CardName.BIOLAB], need: 'cardInHand', amount: 2}, (n) => n)!;
      expect(one.tone).eq('guaranteed');
      expect(one.badge).eq('Cards first');
      expect(one.bodyParams).deep.eq([CardName.BIOLAB]);
      const many = preludeRisk({state: 'deferred', certainty: 'possible', enablers: [CardName.IO_RESEARCH_OUTPOST, CardName.UNMI_CONTRACTOR],
        need: 'cardInHand', amount: 2}, (n) => n)!;
      expect(many.tone).eq('possible');
      expect(many.bodyParams).deep.eq(['2']);
    });

    it('P55\'s uncounted need keeps its own words', () => {
      expect(preludeRisk({state: 'noEffect', need: 'cardInHand'}, (n) => n)!.title).eq('No card in hand to discard');
    });
  });
});
