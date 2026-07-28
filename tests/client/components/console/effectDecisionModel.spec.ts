import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {
  DECLINE_BUY_CARD,
  DECLINE_DEFAULT,
  EYEBROW_ATTACK,
  HEADLINE_BUY_CARD,
  HEADLINE_CHOOSE,
  HEADLINE_PAY,
  HEADLINE_USE,
  LEAD_HAND_CARDS,
  ACTION_DISCARD_DRAW,
  buildEffectDecision,
  chipsFromDiscard,
  decisionCommandKeys,
  decisionFocusStep,
  decisionPressIntent,
  isDeclineOption,
} from '@/client/console/effectDecision/effectDecisionModel';

/*
 * THE ADAPTER IS THE SAFETY GATE. Everything it accepts is served by the new
 * decision screen; everything it refuses keeps its existing UI. So these tests
 * are as much about what it REFUSES as about what it builds — and about the one
 * rule that must never bend: nothing is decided by reading localized text.
 */
describe('effectDecisionModel', () => {
  const HAND = new Set<string>([CardName.ANTS, CardName.BUSHES]);

  const leaf = (title: string, metadata?: unknown) =>
    ({type: 'option', title, buttonLabel: 'Confirm', metadata} as unknown as PlayerInputModel);

  const handPick = (over: Record<string, unknown> = {}) => ({
    type: 'card',
    title: 'Select a card to discard',
    buttonLabel: 'Discard',
    cards: [{name: CardName.ANTS}, {name: CardName.BUSHES}],
    min: 1,
    max: 1,
    ...over,
  } as unknown as PlayerInputModel);

  const or = (options: Array<PlayerInputModel>, choiceContext?: unknown) => ({
    type: 'or',
    title: 'Select one option',
    buttonLabel: 'Confirm',
    options,
    choiceContext,
  } as unknown as PlayerInputModel);

  const cardContext = (mode = 'optional-effect', card = CardName.MARS_UNIVERSITY) =>
    ({source: {kind: 'card', card}, trigger: 'You played a science tag.', mode});

  // ── the gate ──────────────────────────────────────────────────────────────

  it('refuses everything that is not a MARKED top-level choice', () => {
    // No marker → the ordinary picker keeps it (this is the whole migration gate).
    expect(buildEffectDecision(or([leaf('a'), leaf('b')]), {handNames: HAND})).is.undefined;
    // Not an OrOptions at all.
    expect(buildEffectDecision(handPick(), {handNames: HAND})).is.undefined;
    expect(buildEffectDecision(undefined, {handNames: HAND})).is.undefined;
    // A single branch never surfaces (OrOptions.reduce resolves it server-side).
    expect(buildEffectDecision(or([leaf('a')], cardContext()), {handNames: HAND})).is.undefined;
  });

  it('refuses a branch it cannot serve honestly, rather than half-rendering it', () => {
    // A payment dial / a board pick / a player pick are real screens of their
    // own — the decision modal does not fake them.
    const payment = {type: 'payment', title: 'Pay', buttonLabel: 'Pay'} as unknown as PlayerInputModel;
    expect(buildEffectDecision(or([payment, leaf('no')], cardContext()), {handNames: HAND})).is.undefined;

    const space = {type: 'space', title: 'Place', buttonLabel: 'Confirm'} as unknown as PlayerInputModel;
    expect(buildEffectDecision(or([space, leaf('no')], cardContext()), {handNames: HAND})).is.undefined;

    // A card pick over cards that are NOT in hand is a target picker, not the
    // hand overlay.
    const foreign = handPick({cards: [{name: CardName.TARDIGRADES}]});
    expect(buildEffectDecision(or([foreign, leaf('no')], cardContext()), {handNames: HAND})).is.undefined;
  });

  // ── the decline ───────────────────────────────────────────────────────────

  it('finds the decline STRUCTURALLY — never by its title, never by its index', () => {
    const skip = leaf('Do nothing', {kind: 'skip'});
    expect(isDeclineOption(skip)).is.true;
    // A title that says the same thing without the marker is NOT a decline.
    expect(isDeclineOption(leaf('Do nothing'))).is.false;

    // Skip sitting FIRST (RemoveAnyPlants puts it mid-list on purpose).
    const vm = buildEffectDecision(
      or([skip, leaf('Gain 3 plants', {kind: 'resourceGain'})], cardContext()), {handNames: HAND});
    expect(vm?.actions.map((a) => a.role)).deep.eq(['primary', 'decline']);
    // …and it is moved LAST on screen whatever the server order was.
    expect(vm?.declineIndex).eq(1);
    expect(vm?.actions[1].optionIndex, 'the submitted index is the SERVER index').eq(0);
  });

  it('gives the decline the decision own words, not the server boilerplate', () => {
    const buy = leaf('Pay 2 M€ to draw a card', {
      effects: [{direction: 'cost', icon: 'megacredits', amount: 2}, {direction: 'gain', icon: 'cards', amount: 1}],
    });
    const vm = buildEffectDecision(or([buy, leaf('Do nothing', {kind: 'skip'})], cardContext()), {handNames: HAND});
    expect(vm?.headlineKey).eq(HEADLINE_BUY_CARD);
    expect(vm?.actions[1].title, 'never «Ничего не делать»').eq(DECLINE_BUY_CARD);
  });

  // ── the headline ──────────────────────────────────────────────────────────

  it('asks a REAL question, derived from the shape', () => {
    const decline = leaf('Do nothing', {kind: 'skip'});
    const build = (offer: PlayerInputModel) =>
      buildEffectDecision(or([offer, decline], cardContext()), {handNames: HAND})?.headlineKey;

    // pays + draws a card
    expect(build(leaf('Pay', {effects: [
      {direction: 'cost', icon: 'megacredits', amount: 2},
      {direction: 'gain', icon: 'cards', amount: 1},
    ]}))).eq(HEADLINE_BUY_CARD);
    // pays for something else
    expect(build(leaf('Pay', {effects: [
      {direction: 'cost', icon: 'megacredits', amount: 5},
      {direction: 'gain', icon: 'tr', amount: 1},
    ]}))).eq(HEADLINE_PAY);
    // a plain optional effect
    expect(build(leaf('Gain 3 TR', {effects: [{direction: 'gain', icon: 'tr', amount: 3}]}))).eq(HEADLINE_USE);

    // TWO real effects and no decline — not a yes/no question at all.
    const twoWay = buildEffectDecision(
      or([leaf('Add a science'), leaf('Remove a science')], cardContext('effect-choice')), {handNames: HAND});
    expect(twoWay?.headlineKey).eq(HEADLINE_CHOOSE);
    expect(twoWay?.declineIndex).is.undefined;
    expect(twoWay?.actions.map((a) => a.role)).deep.eq(['primary', 'secondary']);
  });

  // ── navigation + previews ─────────────────────────────────────────────────

  it('says where a press LEADS, and previews the exchange of a hand pick', () => {
    const pick = handPick({
      discardPrompt: {min: 1, max: 1, source: {kind: 'card', card: CardName.MARS_UNIVERSITY},
        exchange: {icon: 'cards', amount: 1, perCard: false}},
    });
    const vm = buildEffectDecision(
      or([pick, leaf('Do nothing', {kind: 'skip'})], cardContext()), {handNames: HAND});

    const offer = vm?.actions[0];
    expect(offer?.navigation).eq('handCards');
    expect(offer?.leadKey, 'the row must say it opens the hand').eq(LEAD_HAND_CARDS);
    // The row states the DECISION; the server's «выберите карту…» is an
    // instruction for the next screen, which the lead line already covers.
    expect(offer?.title).eq(ACTION_DISCARD_DRAW);
    expect(offer?.nested, 'the pick itself rides along for the overlay').is.not.undefined;
    // «−1 карта → +1 карта», synthesized from the discard marker (a hand pick
    // carries no OptionMetadata of its own).
    expect(offer?.chips).deep.eq([
      {direction: 'cost', icon: 'cards', amount: 1},
      {direction: 'gain', icon: 'cards', amount: 1},
    ]);
    expect(vm?.headlineKey).eq(HEADLINE_USE);

    // An immediate action says nothing about navigation.
    expect(vm?.actions[1].navigation).eq('immediate');
    expect(vm?.actions[1].leadKey).is.undefined;
  });

  it('scales a per-card exchange, and stays quiet when there is nothing back', () => {
    expect(chipsFromDiscard({min: 3, max: 3, exchange: {icon: 'megacredits', amount: 2, perCard: true}}))
      .deep.eq([
        {direction: 'cost', icon: 'cards', amount: 3},
        {direction: 'gain', icon: 'megacredits', amount: 6},
      ]);
    expect(chipsFromDiscard({min: 1, max: 1})).deep.eq([{direction: 'cost', icon: 'cards', amount: 1}]);
    expect(chipsFromDiscard(undefined)).deep.eq([]);
  });

  // ── the source ────────────────────────────────────────────────────────────

  it('carries the source, and only claims it is inspectable when it IS a card', () => {
    const decline = leaf('Do nothing', {kind: 'skip'});
    const card = buildEffectDecision(or([leaf('a'), decline], cardContext()), {handNames: HAND});
    expect(card?.source).deep.eq({kind: 'card', card: CardName.MARS_UNIVERSITY, inspectable: true});
    expect(card?.eyebrowKey).eq('Card effect');
    expect(card?.trigger).eq('You played a science tag.');

    // A colony / system source has nothing to open in the card viewer — no
    // fake card, and no L3 hint downstream.
    const colony = buildEffectDecision(
      or([leaf('a'), decline], {source: {kind: 'colony'}, mode: 'optional-effect'}), {handNames: HAND});
    expect(colony?.source).deep.eq({kind: 'colony', card: undefined, inspectable: false});
    expect(colony?.eyebrowKey).eq('Colony effect');

    // The MODE outranks the source for the context chip.
    const attack = buildEffectDecision(
      or([leaf('a'), decline], cardContext('attack')), {handNames: HAND});
    expect(attack?.eyebrowKey).eq(EYEBROW_ATTACK);
  });

  it('keeps unavailable targets informational — never as a pressable action', () => {
    const model = or([leaf('Steal 4 M€'), leaf('Do nothing', {kind: 'skip'})], cardContext('attack'));
    (model as unknown as {disabledOptions: Array<unknown>}).disabledOptions = [
      {title: 'Steal from Blue', reason: 'Resources are protected'},
    ];
    const vm = buildEffectDecision(model, {handNames: HAND});
    expect(vm?.actions).lengthOf(2);
    expect(vm?.unavailable).deep.eq([{title: 'Steal from Blue', reason: 'Resources are protected', playerColor: undefined}]);
  });

  it('defaults the decline copy when the offer costs nothing', () => {
    const vm = buildEffectDecision(
      or([leaf('Turn the card face down'), leaf('Do nothing', {kind: 'skip'})], cardContext()), {handNames: HAND});
    expect(vm?.actions[1].title).eq(DECLINE_DEFAULT);
  });

  // ── the pad semantics ─────────────────────────────────────────────────────

  describe('the pad', () => {
    const vmOf = (options: Array<PlayerInputModel>) =>
      buildEffectDecision(or(options, cardContext()), {handNames: HAND})!;

    const offerThenDecline = () => [
      leaf('Gain 3 TR', {effects: [{direction: 'gain', icon: 'tr', amount: 3}]}),
      leaf('Do nothing', {kind: 'skip'}),
    ];

    it('A answers with the SERVER index of the focused action', () => {
      const vm = vmOf(offerThenDecline());
      expect(decisionPressIntent(vm, 0, 'primary')).deep.eq({kind: 'submit', optionIndex: 0});
      expect(decisionPressIntent(vm, 1, 'primary')).deep.eq({kind: 'submit', optionIndex: 1});
    });

    it('B STEPS BACK — it is never a silent decline', () => {
      // The single most dangerous thing a decision screen could do is treat the
      // back button as "no". Declining happens on its own card, deliberately.
      const vm = vmOf(offerThenDecline());
      expect(decisionPressIntent(vm, 0, 'back')).deep.eq({kind: 'defer'});
      expect(decisionPressIntent(vm, 1, 'back'), 'even ON the decline card').deep.eq({kind: 'defer'});
    });

    it('a second A cannot answer twice', () => {
      const vm = vmOf(offerThenDecline());
      expect(decisionPressIntent(vm, 0, 'primary', true)).is.undefined;
    });

    it('a navigating action HANDS OFF instead of answering', () => {
      const pick = handPick({discardPrompt: {min: 1, max: 1}});
      const vm = vmOf([pick, leaf('Do nothing', {kind: 'skip'})]);
      const press = decisionPressIntent(vm, 0, 'primary');
      expect(press?.kind).eq('handPick');
      expect(press?.kind === 'handPick' ? press.action.optionIndex : -1).eq(0);
    });

    it('X inspects the source only when there IS an inspectable one', () => {
      const withCard = vmOf(offerThenDecline());
      expect(decisionPressIntent(withCard, 0, 'inspect'))
        .deep.eq({kind: 'inspectSource', card: CardName.MARS_UNIVERSITY});

      const colony = buildEffectDecision(
        or(offerThenDecline(), {source: {kind: 'colony'}, mode: 'optional-effect'}), {handNames: HAND})!;
      expect(decisionPressIntent(colony, 0, 'inspect'), 'no fake card for a colony').is.undefined;
    });

    it('focus wraps in both directions', () => {
      const vm = vmOf(offerThenDecline());
      expect(decisionFocusStep(vm, 1, 1)).eq(0);
      expect(decisionFocusStep(vm, 0, -1)).eq(1);
    });

    it('says SELECT for a hand-off and CONFIRM for a decision made here', () => {
      const pick = handPick({discardPrompt: {min: 1, max: 1}});
      const nav = vmOf([pick, leaf('Do nothing', {kind: 'skip'})]);
      expect(decisionCommandKeys(nav, 0)).deep.eq(['Navigate', 'Select', 'Inspect the source', 'Minimize']);
      expect(decisionCommandKeys(nav, 1)).deep.eq(['Navigate', 'Confirm', 'Inspect the source', 'Minimize']);

      const colony = buildEffectDecision(
        or(offerThenDecline(), {source: {kind: 'colony'}, mode: 'optional-effect'}), {handNames: HAND})!;
      expect(decisionCommandKeys(colony, 0), 'no source verb without a source')
        .deep.eq(['Navigate', 'Confirm', 'Minimize']);
    });
  });
});
