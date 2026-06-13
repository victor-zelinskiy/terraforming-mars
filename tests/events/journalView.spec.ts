import {expect} from 'chai';
import {LogMessage} from '@/common/logs/LogMessage';
import {LogMessageType} from '@/common/logs/LogMessageType';
import {JournalEntryRole, JournalActionCategory} from '@/common/events/GameEvent';
import {buildJournalView, JournalGroupNode, JournalMessageNode} from '@/client/components/journal/journalView';

function log(text: string, opts?: {correlationId?: number; role?: JournalEntryRole; category?: JournalActionCategory}): LogMessage {
  const m = new LogMessage(LogMessageType.DEFAULT, text, []);
  if (opts?.correlationId !== undefined) {
    m.correlationId = opts.correlationId;
  }
  if (opts?.role !== undefined) {
    m.role = opts.role;
  }
  if (opts?.category !== undefined) {
    m.category = opts.category;
  }
  return m;
}

describe('buildJournalView', () => {
  it('leaves ungrouped messages flat, in order', () => {
    const view = buildJournalView([log('a'), log('b'), log('c')]);
    expect(view.map((n) => n.kind)).to.deep.eq(['message', 'message', 'message']);
    expect(view.map((n) => (n as JournalMessageNode).message.message)).to.deep.eq(['a', 'b', 'c']);
  });

  it('groups an action with its children by correlationId', () => {
    const view = buildJournalView([
      log('played card', {correlationId: 5, role: 'root-action'}),
      log('gained 1 plant', {correlationId: 5, role: 'detail'}),
      log('Pets: +1 animal', {correlationId: 5, role: 'effect-result'}),
    ]);
    expect(view.length).to.eq(1);
    const group = view[0] as JournalGroupNode;
    expect(group.kind).to.eq('group');
    expect(group.header.message).to.eq('played card');
    expect(group.children.map((c) => c.message)).to.deep.eq(['gained 1 plant', 'Pets: +1 animal']);
  });

  it('surfaces the root-action category on the group (for the premium badge)', () => {
    const view = buildJournalView([
      log('played card', {correlationId: 7, role: 'root-action', category: 'card-play'}),
      log('effect', {correlationId: 7, role: 'effect-result'}),
    ]);
    expect((view[0] as JournalGroupNode).category).to.eq('card-play');
  });

  it('collapses a single-message correlation group to a flat message', () => {
    const view = buildJournalView([log('solo action', {correlationId: 9, role: 'root-action'})]);
    expect(view.length).to.eq(1);
    expect(view[0].kind).to.eq('message');
  });

  it('chooses the root-action as header even if it is not the first row', () => {
    const view = buildJournalView([
      log('child first', {correlationId: 3, role: 'effect-result'}),
      log('the action', {correlationId: 3, role: 'root-action'}),
    ]);
    const group = view[0] as JournalGroupNode;
    expect(group.kind).to.eq('group');
    expect(group.header.message).to.eq('the action');
    expect(group.children.map((c) => c.message)).to.deep.eq(['child first']);
  });

  it('preserves first-appearance order across groups and standalones', () => {
    const view = buildJournalView([
      log('A root', {correlationId: 1, role: 'root-action'}),
      log('A child', {correlationId: 1, role: 'detail'}),
      log('system line'),
      log('B root', {correlationId: 2, role: 'root-action'}),
      log('B child', {correlationId: 2, role: 'effect-result'}),
    ]);
    expect(view.map((n) => n.kind)).to.deep.eq(['group', 'message', 'group']);
    expect((view[0] as JournalGroupNode).correlationId).to.eq(1);
    expect((view[2] as JournalGroupNode).correlationId).to.eq(2);
  });
});
