import {expect} from 'chai';
import {
  consoleFilterOptions,
  hasInspectTarget,
  JournalInspectKind,
  journalInspectTargets,
  journalNodeMode,
  stepJournalGeneration,
} from '@/client/components/console/consoleJournalModel';
import {CardName} from '@/common/cards/CardName';
import {LogMessage} from '@/common/logs/LogMessage';
import {LogMessageType} from '@/common/logs/LogMessageType';
import {LogMessageData} from '@/common/logs/LogMessageData';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import type {Color} from '@/common/Color';

/**
 * P28: the console-native journal view-model — card extraction from a
 * focused entry (X = fullscreen), generation stepping (LT/RT), the console
 * filter option list (the R3 popover) and the per-entry detail override
 * (A = expand/collapse vs the global mode). All pure — no DOM, no manifest
 * (the zoomability predicate is injected).
 */
describe('consoleJournalModel (P28)', () => {
  function msg(data: Array<LogMessageData>): LogMessage {
    return {
      timestamp: 0,
      type: LogMessageType.DEFAULT,
      message: 'x',
      data,
    } as unknown as LogMessage;
  }
  const card = (value: CardName): LogMessageData => ({type: LogMessageDataType.CARD, value} as LogMessageData);
  const cards = (value: Array<CardName>): LogMessageData => ({type: LogMessageDataType.CARDS, value} as unknown as LogMessageData);
  const player = (value: Color): LogMessageData => ({type: LogMessageDataType.PLAYER, value} as LogMessageData);
  const space = (value: string): LogMessageData => ({type: LogMessageDataType.SPACE, value} as unknown as LogMessageData);
  const milestone = (value: string): LogMessageData => ({type: LogMessageDataType.MILESTONE, value} as unknown as LogMessageData);
  const award = (value: string): LogMessageData => ({type: LogMessageDataType.AWARD, value} as unknown as LogMessageData);

  /** The manifest classifier stand-in for the inspect tests. */
  const classify = (name: CardName): JournalInspectKind => {
    if (name === CardName.DELTA_PROJECT) {
      return 'hydro';
    }
    if (name === CardName.ASTEROID_STANDARD_PROJECT || name === CardName.CONVERT_PLANTS) {
      return 'standardProject';
    }
    return 'card';
  };

  describe('journalInspectTargets (X = Осмотреть / L3 = Показать)', () => {
    it('collects CARD and CARDS tokens across the entry, deduped, in order', () => {
      const messages = [
        msg([player('red'), card(CardName.BIRDS)]),
        msg([cards([CardName.ANTS, CardName.BIRDS, CardName.DECOMPOSERS])]),
      ];
      const out = journalInspectTargets(messages, classify);
      expect(out.cards).to.deep.eq([CardName.BIRDS, CardName.ANTS, CardName.DECOMPOSERS]);
      expect(out.standard).to.deep.eq([]);
      expect(out.hydro).to.eq(false);
      expect(hasInspectTarget(out)).to.eq(true);
    });

    it('classifies standard projects/actions and the Hydronetwork separately', () => {
      const messages = [msg([
        card(CardName.ASTEROID_STANDARD_PROJECT),
        card(CardName.CONVERT_PLANTS),
        card(CardName.DELTA_PROJECT),
        card(CardName.PETS),
      ])];
      const out = journalInspectTargets(messages, classify);
      expect(out.cards).to.deep.eq([CardName.PETS]);
      expect(out.standard).to.deep.eq([CardName.ASTEROID_STANDARD_PROJECT, CardName.CONVERT_PLANTS]);
      expect(out.hydro).to.eq(true);
    });

    it('collects MILESTONE and AWARD tokens (deduped) — a claim/fund entry is inspectable', () => {
      const messages = [
        msg([player('red'), milestone('Terraformer')]),
        msg([player('blue'), award('Landlord')]),
        msg([milestone('Terraformer')]), // duplicate collapses
      ];
      const out = journalInspectTargets(messages, classify);
      expect(out.milestones).to.deep.eq(['Terraformer']);
      expect(out.awards).to.deep.eq(['Landlord']);
      expect(out.cards).to.deep.eq([]);
      expect(hasInspectTarget(out)).to.eq(true);
    });

    it('collects SPACE tokens (deduped) — a map-only entry is inspectable', () => {
      const messages = [
        msg([player('red'), space('34')]),
        msg([space('34'), space('07')]),
      ];
      const out = journalInspectTargets(messages, classify);
      expect(out.spaces).to.deep.eq(['34', '07']);
      expect(out.cards).to.deep.eq([]);
      expect(hasInspectTarget(out)).to.eq(true);
    });

    it('returns nothing inspectable for a plain entry (X disabled)', () => {
      const out = journalInspectTargets([msg([player('red')])], classify);
      expect(hasInspectTarget(out)).to.eq(false);
    });
  });

  describe('stepJournalGeneration (LT/RT)', () => {
    it('steps within bounds and clamps at both edges — never wraps', () => {
      expect(stepJournalGeneration(3, 1, 5)).to.eq(4);
      expect(stepJournalGeneration(3, -1, 5)).to.eq(2);
      expect(stepJournalGeneration(1, -1, 5)).to.eq(1);
      expect(stepJournalGeneration(5, 1, 5)).to.eq(5);
    });

    it('is safe on a degenerate generation count', () => {
      expect(stepJournalGeneration(1, 1, 1)).to.eq(1);
      expect(stepJournalGeneration(1, -1, 0)).to.eq(1);
    });
  });

  describe('consoleFilterOptions (Y popover)', () => {
    const players = [
      {name: 'Alice', color: 'red' as Color},
      {name: 'Bob', color: 'blue' as Color},
    ];

    it('builds ALL · each player · OPPONENTS, mirroring the desktop selector', () => {
      const out = consoleFilterOptions(players);
      expect(out.map((o) => o.key)).to.deep.eq(['all', 'p:red', 'p:blue', 'opponents']);
      expect(out[0].filter).to.deep.eq({kind: 'all'});
      expect(out[1].filter).to.deep.eq({kind: 'player', color: 'red'});
      expect(out[1].color).to.eq('red');
      expect(out[1].label).to.eq('Alice');
      expect(out[3].filter).to.deep.eq({kind: 'opponents'});
    });

    it('is empty (filter unavailable) in a solo game', () => {
      expect(consoleFilterOptions([players[0]])).to.deep.eq([]);
    });
  });

  describe('journalNodeMode (A = expand/collapse)', () => {
    it('follows the global mode without an override', () => {
      expect(journalNodeMode('detailed', false)).to.eq('detailed');
      expect(journalNodeMode('summary', false)).to.eq('summary');
    });

    it('flips AGAINST the global mode when overridden', () => {
      expect(journalNodeMode('summary', true)).to.eq('detailed');
      expect(journalNodeMode('detailed', true)).to.eq('summary');
    });
  });
});
