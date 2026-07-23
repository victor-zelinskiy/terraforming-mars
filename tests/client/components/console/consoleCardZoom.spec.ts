import {expect} from 'chai';
import {closeConsoleCardZoom, consoleCardZoom, navigateConsoleCardZoom, openConsoleCardZoom, repointConsoleCardZoom, setConsoleZoomInspectTab} from '@/client/console/consoleCardZoom';
import {ActionInspectHistory} from '@/client/components/actions/actionInspectHistory';
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';

/**
 * P15: the console fullscreen viewer's module state — the select CONTEXT
 * is what lets A toggle a pick from fullscreen ONLY in selection contexts
 * (read-only openers pass none, so A can never fire a game action there),
 * and close() must clear it so a later read-only open can't inherit it.
 */

function card(name: CardName): CardModel {
  return {name} as CardModel;
}

describe('consoleCardZoom (P15)', () => {
  afterEach(() => closeConsoleCardZoom());

  it('open clamps the index and stores the list', () => {
    openConsoleCardZoom([card(CardName.ANTS), card(CardName.BIRDS)], 5);
    expect(consoleCardZoom.index).to.eq(1);
    expect(consoleCardZoom.card?.name).to.eq(CardName.BIRDS);
    expect(consoleCardZoom.select).to.eq(undefined); // read-only by default
  });

  it('open with an empty list is a no-op', () => {
    openConsoleCardZoom([], 0);
    expect(consoleCardZoom.card).to.eq(undefined);
  });

  it('a select context rides along and drives the toggle', () => {
    const picked: Array<CardName> = [];
    openConsoleCardZoom([card(CardName.ANTS)], 0, {
      isSelected: (name) => picked.includes(name),
      toggle: (name) => {
        const at = picked.indexOf(name);
        if (at === -1) {
          picked.push(name);
        } else {
          picked.splice(at, 1);
        }
      },
    });
    expect(consoleCardZoom.select).to.not.eq(undefined);
    consoleCardZoom.select?.toggle(CardName.ANTS);
    expect(consoleCardZoom.select?.isSelected(CardName.ANTS)).to.eq(true);
    consoleCardZoom.select?.toggle(CardName.ANTS);
    expect(consoleCardZoom.select?.isSelected(CardName.ANTS)).to.eq(false);
  });

  it('navigate re-points the mirror; close clears EVERYTHING incl. the context', () => {
    openConsoleCardZoom([card(CardName.ANTS), card(CardName.BIRDS)], 0, {
      isSelected: () => false,
      toggle: () => {},
    });
    navigateConsoleCardZoom(card(CardName.BIRDS), 1);
    expect(consoleCardZoom.index).to.eq(1);
    closeConsoleCardZoom();
    expect(consoleCardZoom.card).to.eq(undefined);
    expect(consoleCardZoom.cards.length).to.eq(0);
    expect(consoleCardZoom.select).to.eq(undefined);
  });

  it('the RECEIVE bridge (drawn-cards reveal) rides along and clears on close', () => {
    const taken: Array<number> = [];
    let tookAll = false;
    openConsoleCardZoom([card(CardName.ANTS), card(CardName.BIRDS)], 0, undefined, undefined, {
      receive: {
        takeLabel: 'Take card',
        takeAt: (idx) => taken.push(idx),
        takeAllLabel: 'Take all cards',
        takeAll: () => {
          tookAll = true;
        },
      },
    });
    const receive = consoleCardZoom.receive;
    expect(receive).to.not.eq(undefined);
    expect(receive?.takeLabel).to.eq('Take card');
    receive?.takeAt(1);
    expect(taken).to.deep.eq([1]);
    receive?.takeAll?.();
    expect(tookAll).to.eq(true);
    closeConsoleCardZoom();
    expect(consoleCardZoom.receive).to.eq(undefined);
  });

  it('the read-only SOURCE viewer carries a contextLabel and clears on close', () => {
    openConsoleCardZoom([card(CardName.ANTS)], 0, undefined, undefined, {
      contextLabel: 'Source of drawn cards',
    });
    expect(consoleCardZoom.contextLabel).to.eq('Source of drawn cards');
    expect(consoleCardZoom.receive).to.eq(undefined); // a source is read-only
    closeConsoleCardZoom();
    expect(consoleCardZoom.contextLabel).to.eq(undefined);
  });

  it('the SINGLE-CARD reveal carries status / swap / mandatory + departFromFullscreen + discards, all cleared on close', () => {
    let swapped = 0;
    let peeked = 0;
    openConsoleCardZoom([card(CardName.ANTS)], 0, undefined, undefined, {
      receive: {takeLabel: 'Take card', takeAt: () => {}, departFromFullscreen: true},
      swap: {label: 'Source', otherName: CardName.BIRDS, swap: () => swapped++},
      sourceInfo: {label: 'Source', name: 'Tile bonus'},
      discards: () => peeked++,
      receivedCount: 1,
      statusLabel: 'Received card',
      mandatory: true,
      origin: {kind: 'textual'},
    });
    expect(consoleCardZoom.mandatory).to.eq(true);
    expect(consoleCardZoom.statusLabel).to.eq('Received card');
    expect(consoleCardZoom.receive?.departFromFullscreen).to.eq(true);
    expect(consoleCardZoom.swap?.label).to.eq('Source');
    expect(consoleCardZoom.swap?.otherName).to.eq(CardName.BIRDS);
    expect(consoleCardZoom.receivedCount).to.eq(1);
    expect(consoleCardZoom.sourceInfo?.name).to.eq('Tile bonus');
    // R3 = peek the discard pile (single-card fullscreen parity with the modal).
    expect(consoleCardZoom.discards).to.not.eq(undefined);
    consoleCardZoom.discards?.();
    expect(peeked).to.eq(1);
    consoleCardZoom.swap?.swap();
    expect(swapped).to.eq(1);
    closeConsoleCardZoom();
    expect(consoleCardZoom.mandatory).to.eq(false);
    expect(consoleCardZoom.statusLabel).to.eq(undefined);
    expect(consoleCardZoom.swap).to.eq(undefined);
    expect(consoleCardZoom.receive).to.eq(undefined);
    expect(consoleCardZoom.receivedCount).to.eq(0);
    expect(consoleCardZoom.sourceInfo).to.eq(undefined);
    expect(consoleCardZoom.discards).to.eq(undefined);
  });

  it('repoint flips the role (received → source) WITHOUT re-opening — card defined throughout, receive cleared, count/source preserved', () => {
    openConsoleCardZoom([card(CardName.ANTS)], 0, undefined, undefined, {
      receive: {takeLabel: 'Take card', takeAt: () => {}, departFromFullscreen: true},
      swap: {label: 'Source', otherName: CardName.BIRDS, swap: () => {}},
      discards: () => {},
      receivedCount: 1,
      statusLabel: 'Received card',
      mandatory: true,
      origin: {kind: 'textual'},
    });
    // Flip to the read-only source view: card stays defined (no undefined→defined
    // open-choreography re-trigger); the receive bridge is dropped (no take).
    repointConsoleCardZoom(card(CardName.BIRDS), {
      swap: {label: 'Received card', otherName: CardName.ANTS, swap: () => {}},
      statusLabel: 'Draw source',
    });
    expect(consoleCardZoom.card?.name).to.eq(CardName.BIRDS);
    expect(consoleCardZoom.receive).to.eq(undefined); // source is read-only
    expect(consoleCardZoom.statusLabel).to.eq('Draw source');
    expect(consoleCardZoom.swap?.otherName).to.eq(CardName.ANTS);
    expect(consoleCardZoom.mandatory).to.eq(true); // preserved across the swap
    expect(consoleCardZoom.receivedCount).to.eq(1); // preserved across the swap
    expect(consoleCardZoom.discards).to.not.eq(undefined); // R3 still peeks while viewing the source
    closeConsoleCardZoom();
  });

  it('P17: the ACTION context (play-from-hand parity) rides along and clears on close', () => {
    const played: Array<CardName> = [];
    openConsoleCardZoom([card(CardName.ANTS), card(CardName.BIRDS)], 0, undefined, {
      labelFor: (name) => (name === CardName.ANTS ? 'Play now' : undefined),
      reasonsFor: (name) => (name === CardName.BIRDS ? ['Not enough M€'] : []),
      execute: (name) => played.push(name),
    });
    const action = consoleCardZoom.action;
    expect(action).to.not.eq(undefined);
    // Playable card → verb; unplayable → no verb, reasons instead.
    expect(action?.labelFor(CardName.ANTS)).to.eq('Play now');
    expect(action?.labelFor(CardName.BIRDS)).to.eq(undefined);
    expect(action?.reasonsFor(CardName.BIRDS)).to.deep.eq(['Not enough M€']);
    action?.execute(CardName.ANTS);
    expect(played).to.deep.eq([CardName.ANTS]);
    closeConsoleCardZoom();
    expect(consoleCardZoom.action).to.eq(undefined);
  });

  it('the INSPECT DOSSIER context opens on ПРАВИЛА, LB/RB switch, close resets', () => {
    const history: ActionInspectHistory = {
      card: {hasAny: true, activations: 2, stored: {icon: 'floaters', count: 2}},
      action: {empty: false, activations: 2, kind: 'terraform', headline: 'Terraforming', lines: [], confidence: 'exact', victims: []},
      option: {index: 1, total: 2},
    };
    openConsoleCardZoom([card(CardName.EXTRACTOR_BALLOONS)], 0, undefined, undefined, {inspect: {history}});
    // Default tab is ПРАВИЛА (X keeps its familiar "open the rules" meaning).
    expect(consoleCardZoom.inspect?.history.option?.index).to.eq(1);
    expect(consoleCardZoom.inspectTab).to.eq('rules');
    // LB/RB switch the tab (the shell routes prevSection/nextSection here).
    setConsoleZoomInspectTab('history');
    expect(consoleCardZoom.inspectTab).to.eq('history');
    setConsoleZoomInspectTab('rules');
    expect(consoleCardZoom.inspectTab).to.eq('rules');
    // Close resets both the context and the tab.
    closeConsoleCardZoom();
    expect(consoleCardZoom.inspect).to.eq(undefined);
    expect(consoleCardZoom.inspectTab).to.eq('rules');
    // Outside an inspect context the tab setter is a no-op (never leaks state).
    setConsoleZoomInspectTab('history');
    expect(consoleCardZoom.inspectTab).to.eq('rules');
  });
});
