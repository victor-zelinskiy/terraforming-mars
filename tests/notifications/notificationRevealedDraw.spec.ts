import {expect} from 'chai';
import {Color} from '@/common/Color';
import {Phase} from '@/common/Phase';
import {GameEvent} from '@/common/events/GameEvent';
import {EventImpact} from '@/common/events/EventImpact';
import {ColonyName} from '@/common/colonies/ColonyName';
import {viewerImpactOfChain} from '@/client/components/notifications/notificationSemantics';
import {recomputeRootImpact} from '@/client/components/notifications/notificationModel';

/**
 * THE REVEAL TELLS THE DRAW — the band does not tell it twice (P53 · ledger FL, PL-186). A rival trades with Pluto;
 * the viewer's colony bonus draws a card shown in the drawn-cards reveal and (an empty hand) throws it away at once.
 * The reveal is the cards' one presentation: the band read «ВЫ ПОЛУЧИЛИ КАРТЫ +2» beside a reveal saying «Сброшена».
 */
const VIEWER: Color = 'blue';
const RIVAL: Color = 'red';

function event(partial: Partial<GameEvent> & {id: number, type: GameEvent['type'], impact: EventImpact}): GameEvent {
  return {generation: 1, phase: Phase.ACTION, visibility: 'journal', correlationId: 7, ...partial} as GameEvent;
}

const root = event({id: 1, type: 'action', player: RIVAL, impact: {}, source: {kind: 'colony', name: ColonyName.PLUTO}});
const rivalDraw = event({id: 2, type: 'cards-drawn', player: RIVAL, impact: {cardsDrawn: 2}, tags: ['revealed']});

describe('notificationSemantics — a draw the reveal tells (FL)', () => {
  it('a revealed draw and a revealed auto-discard put NOTHING in the viewer’s band', () => {
    const chain = [
      root, rivalDraw,
      event({id: 3, type: 'cards-drawn', player: VIEWER, impact: {cardsDrawn: 1}, tags: ['revealed'], source: {kind: 'colony', name: ColonyName.PLUTO}}),
      event({id: 4, type: 'cards-discarded', player: VIEWER, impact: {cardsDiscarded: 1}, tags: ['auto-discard', 'revealed']}),
    ];
    const band = viewerImpactOfChain(chain, VIEWER, RIVAL);
    expect(band.gains, 'no «+N cards» beside the reveal').deep.eq([]);
    expect(band.losses, 'no «−N cards» either — the reveal names the card «Сброшена»').deep.eq([]);
    expect(band.sign).eq('neutral');
  });

  it('a discard the viewer was ASKED for (not shown in a reveal) is a loss the band names', () => {
    const chain = [
      root, rivalDraw,
      event({id: 3, type: 'cards-drawn', player: VIEWER, impact: {cardsDrawn: 1}, tags: ['revealed'], source: {kind: 'colony', name: ColonyName.PLUTO}}),
      event({id: 4, type: 'cards-discarded', player: VIEWER, impact: {cardsDiscarded: 1}, source: {kind: 'colony', name: ColonyName.PLUTO}}),
    ];
    const band = viewerImpactOfChain(chain, VIEWER, RIVAL);
    expect(band.gains).deep.eq([]);
    expect(band.losses.map((c) => [c.icon, c.text])).deep.eq([['cards', '−1']]);
  });

  it('a draw NOT shown in a reveal (no tag) still reads «+N cards»', () => {
    const chain = [
      root,
      event({id: 3, type: 'cards-drawn', player: VIEWER, impact: {cardsDrawn: 2}, source: {kind: 'colony', name: ColonyName.PLUTO}}),
    ];
    const band = viewerImpactOfChain(chain, VIEWER, RIVAL);
    expect(band.gains.map((c) => [c.icon, c.text])).deep.eq([['cards', '+2']]);
  });

  it('the card’s context lines never retell the viewer’s revealed draw in the third person («● PLAYER1 +2 −2»)', () => {
    const chain = [
      root, rivalDraw,
      event({id: 3, type: 'cards-drawn', player: VIEWER, impact: {cardsDrawn: 2}, tags: ['revealed'], source: {kind: 'colony', name: ColonyName.PLUTO}}),
      event({id: 4, type: 'cards-discarded', player: VIEWER, impact: {cardsDiscarded: 2}, tags: ['auto-discard', 'revealed']}),
    ];
    const impact = recomputeRootImpact(chain, 7, RIVAL, VIEWER);
    expect(impact.pillGroups.some((g) => g.scope === 'others' && g.owner === VIEWER), 'no line about the viewer').eq(false);
    expect(impact.pillGroups.find((g) => g.scope === 'actor')?.chips.map((c) => c.text)).to.include('+2');
  });
});
