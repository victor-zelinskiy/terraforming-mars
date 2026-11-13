import {expect} from 'chai';
import {readFileSync} from 'fs';
import {resolve} from 'path';

/**
 * «РАЗЫГРАНО»'S CATEGORY HANDS OVER BY «SHOW, THEN REMOVE» (CI 2026-11-09, `console-played-landing-probe` 2 / 8 —
 * animations.md law 9): the landed proxies may start to dissolve only after the real cards have been let out from
 * under the hold AND a frame has painted them. Started in one turn, the GSAP dissolve (180 ms) outran the cards' first
 * painted frame on a starved 4K renderer and the category landed on an empty grid. Read off the view's source.
 */
describe('ConsolePlayedCategoryView · the open handoff shows the cards before the proxies leave', () => {
  const src = readFileSync(resolve(__dirname, '../../src/client/components/console/played/ConsolePlayedCategoryView.vue'), 'utf8');
  // The view is `<script setup>`: its members are the script's own functions and its state is read by name.
  const start = src.indexOf('function onOpenSettled(settledAs');
  const end = src.indexOf('function requestClose(): void', start);
  const body = src.slice(start, end);

  it('finds the open handoff', () => {
    expect(start).to.be.greaterThan(0);
    expect(end).to.be.greaterThan(start);
    expect(body).to.contain('dissolveCategoryProxies(');
  });

  it('releases the hold BEFORE the dissolve, with painted frames between them', () => {
    const release = body.indexOf('state.holdCards = false');
    const dissolve = body.indexOf('dissolveCategoryProxies(');
    expect(release, 'the hold is let go in the handoff').to.be.greaterThan(-1);
    expect(release, 'the cards are let out BEFORE the proxies start to leave').to.be.lessThan(dissolve);
    const between = body.slice(release, dissolve);
    expect((between.match(/\bframe\(\)/g) ?? []).length, 'two painted frames stand between them').to.be.greaterThanOrEqual(2);
  });

  it('a deferred dissolve only touches the flights it was handed', () => {
    expect(body).to.match(/const handed = state\.flights;/);
    expect(body).to.match(/state\.flights !== handed/);
  });
});
