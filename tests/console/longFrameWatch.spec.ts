import {expect} from 'chai';
import {LongFrameEntry, longFrameLine, longFrameSplit, longFrameVerdict} from '@/client/console/longFrameWatch';

/**
 * THE LONG-FRAME WATCH (architecture v2 · N1) — a slow frame that returned to JS says where it went: scripts (named),
 * a forced layout, the frame's own style + layout, or the renderer's native work.
 */
describe('longFrameWatch', () => {
  const nativeStall: LongFrameEntry = {
    startTime: 1000, duration: 2140, blockingDuration: 2090, renderStart: 1260, styleAndLayoutStart: 2670,
    scripts: [
      {duration: 180, invokerType: 'event-listener', invoker: 'DIV.onclick', sourceURL: 'app://tm/chunks/console-shell.js?v=3', sourceFunctionName: 'onTaskSubmit'},
      {duration: 70, invokerType: 'user-callback', invoker: 'TimerHandler:setTimeout'},
    ],
  };

  it('splits a frame into script · forced layout · style+layout · render', () => {
    expect(longFrameSplit(nativeStall)).to.deep.eq({script: 250, forced: 0, styleLayout: 470, render: 1420, native: 1890});
  });

  it('a frame the scripts had under a third of is NATIVE — the class no JS probe sees while it lasts', () => {
    expect(longFrameVerdict(nativeStall)).to.eq('NATIVE');
    expect(longFrameLine(nativeStall)).to.eq(
      '[long-frame] 2140ms — native 1890ms (render 1420 · style+layout 470) · script 250ms: ' +
      '180 event-listener «DIV.onclick» @ console-shell.js:onTaskSubmit, 70 user-callback «TimerHandler:setTimeout»' +
      ' · blocked 2090ms — NATIVE');
  });

  it('a frame a script had is SCRIPT, with its forced layout said', () => {
    const thrash: LongFrameEntry = {
      startTime: 0, duration: 900, styleAndLayoutStart: 880,
      scripts: [{duration: 860, forcedStyleAndLayoutDuration: 610, invokerType: 'user-callback', invoker: 'FrameRequestCallback', sourceFunctionName: 'fit'}],
    };
    expect(longFrameVerdict(thrash)).to.eq('SCRIPT');
    expect(longFrameLine(thrash)).to.contain('script 860ms (forced layout 610): 860 user-callback «FrameRequestCallback» @ fit');
    expect(longFrameLine(thrash)).to.match(/— SCRIPT$/);
  });

  it('a frame with no script at all is all native', () => {
    const bare: LongFrameEntry = {startTime: 0, duration: 11_000};
    expect(longFrameSplit(bare)).to.deep.eq({script: 0, forced: 0, styleLayout: 0, render: 11_000, native: 11_000});
    expect(longFrameLine(bare)).to.eq('[long-frame] 11000ms — native 11000ms (render 11000 · style+layout 0) · script 0ms — NATIVE');
  });

  it('names the two heaviest scripts and counts the rest; says a press that waited and the frames it swallowed', () => {
    const busy: LongFrameEntry = {
      startTime: 0, duration: 1000, firstUIEventTimestamp: 120,
      scripts: [{duration: 100}, {duration: 400, invokerType: 'resolve-promise'}, {duration: 50}, {duration: 300, invokerType: 'event-listener'}],
    };
    const line = longFrameLine(busy, 3);
    expect(line).to.contain(': 400 resolve-promise, 300 event-listener, +2');
    expect(line).to.contain(' · a press waited in it');
    expect(line).to.contain(' · +3 long frame(s) since the last line');
    expect(line).to.match(/— SCRIPT$/);
  });

  it('never reports more script than the frame, nor negative parts', () => {
    const odd: LongFrameEntry = {startTime: 100, duration: 600, styleAndLayoutStart: 50, scripts: [{duration: 900}]};
    const split = longFrameSplit(odd);
    expect(split.script).to.eq(600);
    expect(split.native).to.eq(0);
    expect(split.render).to.eq(0);
    expect(split.styleLayout).to.be.at.most(600);
  });
});
