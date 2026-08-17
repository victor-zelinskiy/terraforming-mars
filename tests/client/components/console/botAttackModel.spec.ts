import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {CardResource} from '@/common/CardResource';
import {PlayerInputModel, SelectCardModel} from '@/common/models/PlayerInputModel';
import {BotAttackPromptMeta} from '@/common/models/BotAttackPromptModel';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import ruConsole from '@/locales/ru/console.json';
import ruUi from '@/locales/ru/ui.json';
import ruAutoma from '@/locales/ru/automa.json';
// …and the two shared dictionaries this flow REUSES keys from rather than
// coining its own (invariant 9): the resource label and the VP abbreviation.
import ruIcons from '@/locales/ru/help_iconography.json';
import ruEnd from '@/locales/ru/game_end.json';
import {
  botAttackCommandKeys, botAttackPreviewFor, botAttackPressIntent, botAttackResourceFor,
  botAttackVpLoss, buildBotAttackView, BotAttackViewModel,
  COMMIT_VERB_KEY, EMPTY_NO_TARGETS, EYEBROW_ATTACK, HEADLINE_PLAYS_CARD,
  EXPLAIN_REMOVE_ONE, EXPLAIN_REMOVE_MANY, LABEL_CARD_VP, LABEL_RESOURCES, LABEL_SCORE,
  SECTION_TARGET, VERB_CHOOSE_TARGET, VERB_INSPECT_CARD, VERB_MINIMIZE,
  VERB_NAVIGATE,
} from '@/client/console/botAttack/botAttackModel';

/**
 * THE MARSBOT ATTACK's pure view-model. What is guarded here is exactly what a
 * component spec could not: that the surface's MEANING comes from the server's
 * structured marker (never from a title), that no target is ever selected by
 * accident, and that a preview never states a change that is not real.
 */

const CTX = {venus: false, colonies: false};

function meta(overrides: Partial<BotAttackPromptMeta> = {}): BotAttackPromptMeta {
  return {
    attacker: 'neutral',
    victim: 'blue',
    source: {kind: 'bonusCard', bonusCard: BonusCardId.B02_INVASIVE_SPECIES},
    effect: 'removeCardResource',
    cardResource: CardResource.ANIMAL,
    amount: 1,
    restrictionKey: 'Only your highest-scoring animal or microbe cards can be chosen.',
    targets: [{
      card: CardName.BIRDS,
      resource: CardResource.ANIMAL,
      resources: {before: 2, after: 1},
      victoryPoints: {before: 2, after: 1},
      score: {before: 38, after: 37},
    }],
    ...overrides,
  };
}

function prompt(overrides: Partial<SelectCardModel> = {}, m: BotAttackPromptMeta = meta()): PlayerInputModel {
  return {
    type: 'card',
    title: 'Remove 1 resource from one of your cards',
    buttonLabel: 'Remove resource',
    cards: [{name: CardName.BIRDS, resources: 2}],
    max: 1,
    min: 1,
    showOnlyInLearnerMode: false,
    selectBlueCardAction: false,
    showOwner: false,
    showSelectAll: false,
    botAttackPrompt: m,
    ...overrides,
  } as unknown as PlayerInputModel;
}

function view(overrides: Partial<SelectCardModel> = {}, m: BotAttackPromptMeta = meta()): BotAttackViewModel {
  const vm = buildBotAttackView(prompt(overrides, m), CTX);
  expect(vm, 'the fixture builds a view').to.not.be.undefined;
  return vm as BotAttackViewModel;
}

describe('botAttackModel', () => {
  describe('routing', () => {
    it('is built ONLY from the server marker — never from a title', () => {
      const unmarked = prompt();
      delete (unmarked as {botAttackPrompt?: unknown}).botAttackPrompt;
      expect(buildBotAttackView(unmarked, CTX)).to.be.undefined;
      expect(buildBotAttackView(undefined, CTX)).to.be.undefined;
    });

    it('refuses a prompt shape it cannot serve', () => {
      const wrongType = {...prompt(), type: 'or'} as unknown as PlayerInputModel;
      expect(buildBotAttackView(wrongType, CTX)).to.be.undefined;
    });
  });

  describe('the header', () => {
    it('names the ATTACK, the bot\'s own card face and the seat that attacked', () => {
      const vm = view();
      expect(vm.eyebrowKey).eq(EYEBROW_ATTACK);
      expect(vm.attacker).eq('neutral');
      expect(vm.victim).eq('blue');
      // The SHARED source dock draws MarsBot's own face — never a fake project
      // card, and never a bare id.
      expect(vm.source.bonusCard).deep.eq({id: BonusCardId.B02_INVASIVE_SPECIES, ctx: CTX});
      expect(vm.source.card).to.be.undefined;
      expect(vm.source.inspectable).eq(true);
    });

    it('the headline names the CARD, never the ACTOR (the surface resolves that)', () => {
      const vm = view();
      expect(vm.headlineKey).eq(HEADLINE_PLAYS_CARD);
      // Parameter 0 is the actor's DISPLAY NAME, which only the surface can
      // resolve (`displayNameForColor` needs the live players list); the model
      // supplies parameter 1, the card's own i18n key. A literal «MarsBot» — or
      // a literal «Бот» — anywhere in here would be the bug this replaces.
      expect(vm.sourceNameKey).eq('Invasive Species');
      // NOTHING the surface RENDERS carries the bot's name: the headline key
      // has a slot for it, the kicker is one word, and the source's kind label
      // is a card TYPE. The name itself arrives only from the helper.
      expect(vm.headlineKey).contain('${0}');
      expect(vm.eyebrowKey).not.contain('MarsBot');
      expect(vm.source.kindKey).not.contain('MarsBot');
    });

    it('carries the BRIDGE facts: how many leave, and what', () => {
      expect(view().amountLabel).eq('1');
      expect(view().resourceIcon).eq('animal');
      // A MIXED candidate set has no single glyph to show — the row's own
      // per-card capsules carry it instead of one that would be a lie.
      expect(view({}, meta({cardResource: undefined})).resourceIcon).to.be.undefined;
    });

    it('the explanation counts, and the restriction is the SERVER\'s rule key', () => {
      expect(view().explanation).deep.eq({key: EXPLAIN_REMOVE_ONE, params: []});
      expect(view({}, meta({amount: 3})).explanation)
        .deep.eq({key: EXPLAIN_REMOVE_MANY, params: ['3']});
      expect(view().restrictionKey).eq('Only your highest-scoring animal or microbe cards can be chosen.');
    });
  });

  describe('the targets', () => {
    it('the SERVER\'s candidate set is the authority — a preview with no candidate is dropped', () => {
      const vm = view({}, meta({
        targets: [
          ...meta().targets,
          {card: CardName.FISH, resource: CardResource.ANIMAL, resources: {before: 5, after: 4}},
        ],
      }));
      // `cards` offers only Birds, so Fish (which the server would refuse)
      // never becomes a pressable target.
      expect(vm.targets.map((t) => t.card)).deep.eq([CardName.BIRDS]);
    });

    it('a candidate with NO preview still renders — it says less, never something invented', () => {
      const vm = view(
        {cards: [{name: CardName.BIRDS, resources: 2}, {name: CardName.FISH, resources: 5}] as never},
        meta());
      expect(vm.targets).lengthOf(1);
      expect(botAttackPreviewFor(vm, CardName.FISH)).deep.eq([]);
      expect(botAttackResourceFor(vm, CardName.FISH)).to.be.undefined;
    });
  });

  describe('the было → станет preview', () => {
    it('always states the resources, in the shared target-step vocabulary', () => {
      const [section] = botAttackPreviewFor(view(), CardName.BIRDS);
      expect(section.key).eq('attack');
      expect(section.title).eq(SECTION_TARGET);
      expect(section.entity).eq('target');
      expect(section.impacts[0]).deep.eq({
        label: LABEL_RESOURCES, icon: 'animal', from: 2, to: 1,
      });
    });

    it('states the CARD\'s points and the TOTAL as two DIFFERENT readings', () => {
      const [section] = botAttackPreviewFor(view(), CardName.BIRDS);
      const labels = section.impacts.map((i) => i.label);
      expect(labels).deep.eq([LABEL_RESOURCES, LABEL_CARD_VP, LABEL_SCORE]);
      expect(section.impacts[1]).deep.include({from: 2, to: 1, static: false});
      expect(section.impacts[2]).deep.include({from: 38, to: 37});
    });

    it('a VP reading that does not MOVE is kept and marked quiet (never silence)', () => {
      const vm = view({}, meta({
        targets: [{
          card: CardName.BIRDS,
          resource: CardResource.MICROBE,
          resources: {before: 3, after: 2},
          victoryPoints: {before: 0, after: 0},
        }],
      }));
      const [section] = botAttackPreviewFor(vm, CardName.BIRDS);
      expect(section.impacts.map((i) => i.label)).deep.eq([LABEL_RESOURCES, LABEL_CARD_VP]);
      expect(section.impacts[1].static).eq(true);
      expect(botAttackVpLoss(vm, CardName.BIRDS)).eq(0);
    });

    it('a card whose points the resource never touches shows NO VP row and NO ±0', () => {
      const vm = view({}, meta({
        targets: [{
          card: CardName.BIRDS,
          resource: CardResource.ANIMAL,
          resources: {before: 2, after: 1},
        }],
      }));
      const [section] = botAttackPreviewFor(vm, CardName.BIRDS);
      expect(section.impacts.map((i) => i.label)).deep.eq([LABEL_RESOURCES]);
      expect(botAttackVpLoss(vm, CardName.BIRDS)).eq(0);
    });

    it('the resource badge counts what is THERE, zero included', () => {
      expect(botAttackResourceFor(view(), CardName.BIRDS))
        .deep.eq({icon: 'animal', count: 2, showZero: true});
    });
  });

  describe('no accidental removal', () => {
    it('A on a candidate SELECTS it — it never removes anything', () => {
      const vm = view();
      const press = botAttackPressIntent({
        vm, zone: 'targets', focused: CardName.BIRDS, selected: undefined,
        action: 'primary', submitting: false,
      });
      expect(press).deep.eq({kind: 'select', card: CardName.BIRDS});
    });

    it('the COMMIT is a second press, on a row that refuses an empty selection', () => {
      const vm = view();
      expect(botAttackPressIntent({
        vm, zone: 'commit', focused: CardName.BIRDS, selected: undefined,
        action: 'primary', submitting: false,
      })).to.be.undefined;
      expect(botAttackPressIntent({
        vm, zone: 'commit', focused: CardName.BIRDS, selected: CardName.BIRDS,
        action: 'primary', submitting: false,
      })).deep.eq({kind: 'commit', card: CardName.BIRDS});
    });

    it('a second press while an answer is in flight submits nothing', () => {
      expect(botAttackPressIntent({
        vm: view(), zone: 'commit', focused: CardName.BIRDS, selected: CardName.BIRDS,
        action: 'primary', submitting: true,
      })).to.be.undefined;
    });

    it('B is NEVER an answer — a mandatory attack cannot be declined, only set aside', () => {
      expect(botAttackPressIntent({
        vm: view(), zone: 'commit', focused: CardName.BIRDS, selected: CardName.BIRDS,
        action: 'back', submitting: false,
      })).deep.eq({kind: 'defer'});
    });

    it('X inspects the focused candidate — and nothing else competes with it', () => {
      const vm = view();
      expect(botAttackPressIntent({
        vm, zone: 'targets', focused: CardName.BIRDS, selected: undefined,
        action: 'inspect', submitting: false,
      })).deep.eq({kind: 'inspectTarget', card: CardName.BIRDS});
      // The retired L3 source verb resolves to nothing at all.
      expect(botAttackPressIntent({
        vm, zone: 'targets', focused: CardName.BIRDS, selected: undefined,
        action: 'source', submitting: false,
      })).to.be.undefined;
    });
  });

  describe('the pad contract', () => {
    it('the A-verb tells «choose» apart from «remove»', () => {
      const vm = view();
      // NO `L3 Источник`: the bot's real card is drawn inline, so a second
      // inspect verb would open a viewer onto what the player already sees.
      expect(botAttackCommandKeys(vm, 'targets', undefined)).deep.eq([
        VERB_NAVIGATE, VERB_CHOOSE_TARGET, VERB_INSPECT_CARD, VERB_MINIMIZE,
      ]);
      // …and the BAR gets the project's GENERIC confirm verb, never a second
      // copy of the commit row's own words.
      expect(botAttackCommandKeys(vm, 'commit', CardName.BIRDS)[1]).eq(COMMIT_VERB_KEY);
    });
  });

  describe('the degenerate no-target prompt', () => {
    it('explains itself and offers only what the protocol allows', () => {
      const vm = view({cards: [] as never, min: 0}, meta({targets: []}));
      expect(vm.empty).eq(true);
      expect(vm.skippable).eq(true);
      expect(botAttackPressIntent({
        vm, zone: 'targets', focused: undefined, selected: undefined,
        action: 'primary', submitting: false,
      })).deep.eq({kind: 'skip'});
      expect(botAttackCommandKeys(vm, 'targets', undefined)).deep.eq(['Continue', VERB_MINIMIZE]);
    });

    it('an unanswerable empty prompt offers no false «Continue»', () => {
      const vm = view({cards: [] as never, min: 1}, meta({targets: []}));
      expect(vm.skippable).eq(false);
      expect(botAttackPressIntent({
        vm, zone: 'targets', focused: undefined, selected: undefined,
        action: 'primary', submitting: false,
      })).to.be.undefined;
      expect(botAttackCommandKeys(vm, 'targets', undefined)).deep.eq([VERB_MINIMIZE]);
    });
  });

  it('LOCALIZATION: every key this flow emits is translated in Russian', () => {
    const dict: Record<string, string> = {
      ...(ruConsole as unknown as Record<string, string>),
      ...(ruUi as unknown as Record<string, string>),
      ...(ruAutoma as unknown as Record<string, string>),
      ...(ruIcons as unknown as Record<string, string>),
      ...(ruEnd as unknown as Record<string, string>),
    };
    const keys = [
      EYEBROW_ATTACK, HEADLINE_PLAYS_CARD, EXPLAIN_REMOVE_ONE, EXPLAIN_REMOVE_MANY,
      COMMIT_VERB_KEY, VERB_CHOOSE_TARGET, VERB_INSPECT_CARD, VERB_MINIMIZE,
      VERB_NAVIGATE, SECTION_TARGET, LABEL_RESOURCES, LABEL_CARD_VP, LABEL_SCORE,
      EMPTY_NO_TARGETS, 'Bot card', 'Choose a card first', '${0} VP',
      // The ACTOR's own label — the ONE key the display-name helper resolves.
      'MarsBot',
      // …the announcement's sentence, and the two strings the SERVER ships.
      '${0} is taking a resource from one of your cards',
      'Remove 1 resource from one of your cards',
      'Only your highest-scoring animal or microbe cards can be chosen.',
    ];
    const missing = keys.filter((k) => dict[k] === undefined || dict[k] === '');
    expect(missing, `untranslated: ${missing.join(' | ')}`).deep.eq([]);
  });
});
