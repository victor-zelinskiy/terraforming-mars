import {expect} from 'chai';
import {embedZoneMounted, resetEmbedZones, vEmbedZone} from '@/client/console/embedZoneRegistry';
import {
  releaseWorkspaceOutcome, resetWorkspaceOutcome, retractWorkspaceOutcomeSlot, setWorkspaceOutcomeSlot,
  workspaceOutcomeState, workspaceOutcomeZone,
} from '@/client/console/consoleWorkspaceOutcome';

/*
 * A SELECTOR IS NOT A NODE (the «Корпоративные архивы» blocker of 2026-10-18).
 *
 * The start workspace parked on B, its zone died with it, the selector stayed
 * published — and on A the shell's teleport (patched before the scene rendered
 * the zone) resolved nothing and left the pick in the shell's own flow, under
 * the scene. The gates asked «is the selector non-empty?». They now ask
 * `workspaceOutcomeZone()`: the published selector only while a node matching
 * it is MOUNTED (`v-embed-zone`), so a missing zone holds the surface nowhere
 * and the zone's arrival is the change that lets the teleport resolve it.
 */
describe('embedZoneRegistry — the outcome zones that actually exist', () => {
  let host: HTMLElement;
  // The hooks read only the element; Vue's binding / vnode arguments are not part of the contract.
  const mount = (el: HTMLElement) => (vEmbedZone.mounted as (el: HTMLElement) => void)(el);
  const unmount = (el: HTMLElement) => (vEmbedZone.unmounted as (el: HTMLElement) => void)(el);
  const zone = (attrs: {cls?: string, slot?: string}): HTMLElement => {
    const el = document.createElement('div');
    if (attrs.cls !== undefined) {
      el.className = attrs.cls;
    }
    if (attrs.slot !== undefined) {
      el.setAttribute('data-embed-slot', attrs.slot);
    }
    host.appendChild(el);
    return el;
  };

  beforeEach(() => {
    resetEmbedZones();
    resetWorkspaceOutcome();
    host = document.createElement('div');
    host.className = 'con-stdp';
    document.body.appendChild(host);
  });
  afterEach(() => {
    host.remove();
    resetEmbedZones();
    releaseWorkspaceOutcome('spec', {force: true});
  });

  it('a zone counts only between its directive mount and unmount', () => {
    const el = zone({cls: 'con-start__embed', slot: 'start'});
    expect(embedZoneMounted('.con-start__embed'), 'in the DOM, not declared').to.eq(false);
    mount(el);
    expect(embedZoneMounted('.con-start__embed')).to.eq(true);
    expect(embedZoneMounted('[data-embed-slot="start"]'), 'any selector the node matches').to.eq(true);
    expect(embedZoneMounted('[data-embed-slot="hand-outcome"]')).to.eq(false);
    unmount(el);
    expect(embedZoneMounted('.con-start__embed')).to.eq(false);
  });

  it('matches descendant selectors and ignores a detached node', () => {
    const el = zone({slot: 'stdp-step'});
    mount(el);
    expect(embedZoneMounted('.con-stdp [data-embed-slot="stdp-step"]')).to.eq(true);
    el.remove();
    expect(embedZoneMounted('[data-embed-slot="stdp-step"]'), 'a node out of the document is no target').to.eq(false);
    expect(embedZoneMounted('')).to.eq(false);
  });

  it('workspaceOutcomeZone: the published selector only while its zone is mounted — «claimed but not ready» otherwise', () => {
    setWorkspaceOutcomeSlot('[data-embed-slot="hand-outcome"]');
    expect(workspaceOutcomeZone(), 'published, nothing there yet').to.eq('');
    const el = zone({slot: 'hand-outcome'});
    mount(el);
    expect(workspaceOutcomeZone()).to.eq('[data-embed-slot="hand-outcome"]');
    // «свернуть»: the host unmounts and the claim survives — the selector stays,
    // the gate closes.
    unmount(el);
    el.remove();
    expect(workspaceOutcomeState.embedSlot).to.eq('[data-embed-slot="hand-outcome"]');
    expect(workspaceOutcomeZone()).to.eq('');
  });

  it('an undeclared zone that IS in the document degrades to the old behaviour (never a held-forever surface)', () => {
    zone({slot: 'hydro'});
    setWorkspaceOutcomeSlot('[data-embed-slot="hydro"]');
    expect(workspaceOutcomeZone()).to.eq('[data-embed-slot="hydro"]');
  });

  it('retractWorkspaceOutcomeSlot clears only the caller\'s OWN selector', () => {
    setWorkspaceOutcomeSlot('.con-start__embed');
    retractWorkspaceOutcomeSlot('[data-embed-slot="workspace-reveal"]');
    expect(workspaceOutcomeState.embedSlot, 'a composer mounting must not wipe the start\'s zone').to.eq('.con-start__embed');
    retractWorkspaceOutcomeSlot('.con-start__embed');
    expect(workspaceOutcomeState.embedSlot).to.eq('');
  });
});
