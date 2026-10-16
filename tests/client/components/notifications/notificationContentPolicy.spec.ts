import {expect} from 'chai';
import {Color} from '@/common/Color';
import {LogMessage} from '@/common/logs/LogMessage';
import {LogMessageType} from '@/common/logs/LogMessageType';
import {NotificationModel, NotificationSummaryLine} from '@/client/components/notifications/notificationTypes';
import {presentedContent, ACTOR_CHIPS_BRIEF, BOT_LINES_BRIEF} from '@/client/components/notifications/notificationContentPolicy';
import {NotificationContentMode} from '@/client/components/notifications/notificationContentMode';

/**
 * THE NOTIFICATION CONTENT POLICY (TR59 «ОДИН ВЗГЛЯД») — what a presented toast carries. The contract this spec pins
 * row by row: what NO mode may cut, what each mode cuts, and that the policy reads typed fields only.
 */

const VIEWER: Color = 'blue';
const ACTOR: Color = 'red';
const THIRD: Color = 'green';

function line(message: string, kind: NotificationSummaryLine['kind'] = 'log', target?: Color): NotificationSummaryLine {
  return {message: new LogMessage(LogMessageType.DEFAULT, message, []), kind, ...(target !== undefined ? {target} : {})};
}

function model(over: Partial<NotificationModel> = {}): NotificationModel {
  return {
    id: 'g1', kind: 'normal', variant: 'play-card', priority: 5, sign: 'neutral', importance: 'ambient',
    typeLabelKey: 'Card played', actor: ACTOR, pills: [], detailCount: 0, generation: 1, ttl: 6800,
    persistent: false, createdAt: 1, ...over,
  };
}

const BAND = {
  sign: 'positive' as const,
  gains: [{icon: 'megacredits', text: '+1'}],
  losses: [],
  causes: [{origin: {kind: 'card' as const, card: 'Restricted Area:ares' as never, owner: VIEWER}, own: true, gains: [{icon: 'megacredits', text: '+1'}], losses: []}],
};

const MODES: ReadonlyArray<NotificationContentMode> = ['brief', 'mine'];

describe('notificationContentPolicy (TR59 — what a toast carries)', () => {
  describe('⛔ never filtered, in ANY mode', () => {
    for (const mode of MODES) {
      it(`${mode}: the viewer's band — gains AND losses — and its causes`, () => {
        const m = model({sign: 'mixed', viewerImpact: {...BAND, sign: 'mixed', losses: [{icon: 'plants', text: '−2'}]}});
        const out = presentedContent(m, mode, VIEWER);
        expect(out.viewerImpact).deep.eq(m.viewerImpact);
        expect(out.sign).eq('mixed');
      });

      it(`${mode}: the actor chip (the model's actor) and the identity fields`, () => {
        const out = presentedContent(model(), mode, VIEWER);
        expect(out.actor).eq(ACTOR);
        expect(out.id).eq('g1');
        expect(out.typeLabelKey).eq('Card played');
      });

      it(`${mode}: the viewer's OWN skipped effect («no silent loss»)`, () => {
        const m = model({skipped: [{label: 'Colony bonus', reason: 'no holder', owner: VIEWER}]});
        expect(presentedContent(m, mode, VIEWER).skipped).deep.eq(m.skipped);
      });

      it(`${mode}: an attack line aimed at the viewer (a zero outcome included)`, () => {
        const attack = line('${0} protected', 'attack', VIEWER);
        const m = model({variant: 'bot-turn', summaryLines: [line('placed a city'), attack, line('advanced a track')]});
        expect(presentedContent(m, mode, VIEWER).summaryLines).to.deep.include(attack);
      });

      it(`${mode}: warnings and the turn prompts pass UNTOUCHED (their content is the message)`, () => {
        for (const kind of ['warning', 'your-turn', 'action-required'] as const) {
          const m = model({kind, pillGroups: [{scope: 'planet', chips: [{icon: 'oxygen', text: '1→2', neutral: true}]}]});
          expect(presentedContent(m, mode, VIEWER)).eq(m);
        }
      });

      it(`${mode}: the reveal line, the passive source and a burst's count ride through`, () => {
        const m = model({reveal: {origin: 'deck', result: 'discarded', cards: []}, effectSource: {kind: 'card', card: 'Pets' as never}, groupCount: 4});
        const out = presentedContent(m, mode, VIEWER);
        expect(out.reveal).deep.eq(m.reveal);
        expect(out.effectSource).deep.eq(m.effectSource);
        expect(out.groupCount).eq(4);
      });
    }
  });

  describe('both modes cut what the HUD and the journal already say', () => {
    for (const mode of MODES) {
      it(`${mode}: the «Марс» cluster goes (the HUD shows every global parameter)`, () => {
        const m = model({pillGroups: [{scope: 'planet', chips: [{icon: 'oxygen', text: '1→2', neutral: true}]}],
          pills: [{icon: 'oxygen', text: '1→2', neutral: true}]});
        const out = presentedContent(m, mode, VIEWER);
        expect(out.pillGroups).is.undefined;
        expect(out.pills, 'the flat fallback never resurrects a cut cluster').deep.eq([]);
      });

      it(`${mode}: the requirement-eased line and the ACTOR's own skipped effect go to the journal`, () => {
        const m = model({eased: [{source: 'Cutting Edge Design' as never, kind: 'waive', oneShot: true}],
          skipped: [{label: 'Draw', reason: 'empty deck'}]});
        const out = presentedContent(m, mode, VIEWER);
        expect(out.eased).is.undefined;
        expect(out.skipped).is.undefined;
      });

      it(`${mode}: a bot card UNDER A BAND drops its bookkeeping lines (the band + its cause carry the story)`, () => {
        const m = model({variant: 'bot-turn', sign: 'positive', viewerImpact: BAND,
          summaryLines: [line('placed a city'), line('gains 1 M€ for the adjacency bonus'), line('bonus card destroyed')],
          summaryOverflow: 2});
        const out = presentedContent(m, mode, VIEWER);
        expect(out.summaryLines).is.undefined;
        expect(out.summaryOverflow).is.undefined;
      });
    }
  });

  describe('brief («Кратко», the default)', () => {
    it(`the actor keeps ONE quiet line of ≤ ${ACTOR_CHIPS_BRIEF} chips`, () => {
      const chips = [{icon: 'cards', text: '+1'}, {icon: 'megacredits', text: '+1', production: true}, {icon: 'megacredits', text: '−25'}];
      const m = model({pillGroups: [{scope: 'actor', chips}], pills: chips});
      const out = presentedContent(m, 'brief', VIEWER);
      expect(out.pillGroups).deep.eq([{scope: 'actor', chips: chips.slice(0, ACTOR_CHIPS_BRIEF)}]);
      expect(out.pills).deep.eq(chips.slice(0, ACTOR_CHIPS_BRIEF));
    });

    it('ONE third player keeps one line; a second third player is the journal\'s', () => {
      const m = model({pillGroups: [
        {scope: 'others', owner: THIRD, chips: [{icon: 'heat', text: '+1'}]},
        {scope: 'others', owner: 'yellow', chips: [{icon: 'heat', text: '+1'}]},
      ]});
      const out = presentedContent(m, 'brief', VIEWER);
      expect(out.pillGroups?.map((g) => g.owner)).deep.eq([THIRD]);
    });

    it('a third player\'s skipped effect keeps one line', () => {
      const m = model({skipped: [
        {label: 'A', reason: 'r', owner: THIRD},
        {label: 'B', reason: 'r', owner: 'yellow'},
      ]});
      expect(presentedContent(m, 'brief', VIEWER).skipped?.map((s) => s.owner)).deep.eq([THIRD]);
    });

    it(`a bot card with NO band keeps ≤ ${BOT_LINES_BRIEF} outcome lines and an honest «ещё N»`, () => {
      const m = model({variant: 'bot-turn', summaryLines: [line('a'), line('b'), line('c')], summaryOverflow: 1});
      const out = presentedContent(m, 'brief', VIEWER);
      expect(out.summaryLines?.map((l) => l.message.message)).deep.eq(['a', 'b']);
      expect(out.summaryOverflow, 'the cut line + the producer\'s own overflow').eq(2);
    });

    it('the viewer\'s attack lines lead the budget', () => {
      const m = model({variant: 'bot-turn', summaryLines: [line('a'), line('b'), line('hit', 'attack', VIEWER)]});
      expect(presentedContent(m, 'brief', VIEWER).summaryLines?.map((l) => l.message.message)).deep.eq(['hit', 'a']);
    });
  });

  describe('mine («Только моё»)', () => {
    it('no actor line, no third player', () => {
      const m = model({pillGroups: [
        {scope: 'actor', chips: [{icon: 'heat', text: '+1'}]},
        {scope: 'others', owner: THIRD, chips: [{icon: 'heat', text: '+1'}]},
      ], pills: [{icon: 'heat', text: '+1'}]});
      const out = presentedContent(m, 'mine', VIEWER);
      expect(out.pillGroups).is.undefined;
      expect(out.pills).deep.eq([]);
    });

    it('only the viewer\'s skipped effect stays', () => {
      const mine = {label: 'Colony bonus', reason: 'no holder', owner: VIEWER};
      const m = model({skipped: [{label: 'A', reason: 'r', owner: THIRD}, mine]});
      expect(presentedContent(m, 'mine', VIEWER).skipped).deep.eq([mine]);
    });

    it('a bot card keeps only the attack lines aimed at the viewer', () => {
      const attack = line('hit', 'attack', VIEWER);
      const m = model({variant: 'bot-turn', summaryLines: [line('a'), line('other hit', 'attack', THIRD), attack]});
      expect(presentedContent(m, 'mine', VIEWER).summaryLines).deep.eq([attack]);
    });
  });

  it('never mutates its input', () => {
    const m = model({pillGroups: [{scope: 'planet', chips: [{icon: 'oxygen', text: '1→2', neutral: true}]}], summaryLines: [line('a')]});
    const snapshot = JSON.stringify(m);
    presentedContent(m, 'mine', VIEWER);
    expect(JSON.stringify(m)).eq(snapshot);
  });
});
