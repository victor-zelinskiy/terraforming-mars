import {expect} from 'chai';
import {
  consoleFilterOptions,
  journalEntryCards,
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
 * filter option list (the Y popover) and the per-entry detail override
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

  describe('journalEntryCards (X = fullscreen)', () => {
    it('collects CARD and CARDS tokens across the entry, deduped, in order', () => {
      const messages = [
        msg([player('red'), card(CardName.BIRDS)]),
        msg([cards([CardName.ANTS, CardName.BIRDS, CardName.DECOMPOSERS])]),
      ];
      const out = journalEntryCards(messages, () => true);
      expect(out).to.deep.eq([CardName.BIRDS, CardName.ANTS, CardName.DECOMPOSERS]);
    });

    it('drops non-zoomable names (standard projects / system cards)', () => {
      const messages = [msg([card(CardName.ASTEROID_STANDARD_PROJECT), card(CardName.PETS)])];
      const out = journalEntryCards(messages, (name) => name === CardName.PETS);
      expect(out).to.deep.eq([CardName.PETS]);
    });

    it('returns empty for an entry without card tokens (X disabled)', () => {
      expect(journalEntryCards([msg([player('red')])], () => true)).to.deep.eq([]);
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
