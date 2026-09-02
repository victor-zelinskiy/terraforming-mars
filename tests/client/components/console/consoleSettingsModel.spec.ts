import {expect} from 'chai';
import {buildConsoleSettings} from '@/client/console/settings/consoleSettingsModel';
import {PROFILE_CHOICES, currentProfileOverride, setConsoleProfileOverride} from '@/client/console/consoleLayoutProfile';
import {buttonLayoutState, setButtonLayout} from '@/client/gamepad/buttonLayout';
import {privateScoreState, setPrivateScore} from '@/client/components/overview/privateScoreState';
import {readingScaleState, setConsoleReadingScale} from '@/client/console/consoleReadingScale';
import {DesktopAppModeInfo, DesktopLanState} from '@/client/components/desktop/desktopUpdateState';
import {placementFlowState, setPlacementTwoStep} from '@/client/console/tilePlacement/placementFlow';

/**
 * The settings MODEL — the grouping + the option rings the settings console
 * renders. What matters here is the contract the surface depends on: every
 * category is non-empty, every row is a RING that steps both ways and wraps,
 * and the context decides which settings exist at all.
 */
describe('consoleSettingsModel', () => {
  // Module state is bundle-shared across specs — restore the defaults.
  afterEach(() => {
    setButtonLayout('standard');
    setPrivateScore(false);
    setConsoleProfileOverride('auto');
    setConsoleReadingScale(100);
  });

  function ids(context: 'menu' | 'game'): Array<string> {
    return buildConsoleSettings({context}).map((c) => c.id);
  }

  function rowIds(context: 'menu' | 'game'): Array<string> {
    return buildConsoleSettings({context}).flatMap((c) => c.rows.map((r) => r.id));
  }

  it('the menu context has the tuned categories plus the minor diagnostics one', () => {
    expect(ids('menu')).to.deep.eq(['interface', 'controls', 'graphics', 'diagnostics']);
  });

  it('the game context swaps the network category for the per-game one', () => {
    expect(ids('game')).to.deep.eq(['interface', 'controls', 'graphics', 'game', 'diagnostics']);
  });

  it('the shell switch is GONE (desktop-removal wave 1); the private-score mask is in-game only', () => {
    // The console is the one shell — no context offers a way "back" to the
    // cut desktop branch.
    expect(rowIds('menu')).to.not.include('shell');
    expect(rowIds('game')).to.not.include('shell');
    expect(rowIds('menu')).to.not.include('privateScore');
    expect(rowIds('game')).to.include('privateScore');
  });

  it('every dialable row carries a label, a description and a ring of at least two options', () => {
    for (const context of ['menu', 'game'] as const) {
      for (const cat of buildConsoleSettings({context})) {
        for (const row of cat.rows) {
          expect(row.label, `${cat.id}/${row.id} label`).to.not.eq('');
          expect(row.desc, `${cat.id}/${row.id} desc`).to.not.eq('');
          expect(row.value, `${cat.id}/${row.id} value`).to.not.eq('');
          expect(row.count, `${cat.id}/${row.id} ring`).to.be.greaterThan(1);
          expect(row.index, `${cat.id}/${row.id} index`).to.be.within(0, row.count - 1);
        }
      }
    }
  });

  it('a row label never echoes its own category label (the crumb would read twice)', () => {
    for (const cat of buildConsoleSettings({context: 'game'})) {
      for (const row of cat.rows) {
        expect(row.label, `${cat.id}/${row.id}`).to.not.eq(cat.label);
      }
    }
  });

  it('the technical categories are the minor ones, and only they carry a readout', () => {
    const cats = buildConsoleSettings({context: 'menu'});
    expect(cats.filter((c) => c.minor).map((c) => c.id)).to.deep.eq(['diagnostics']);
    for (const cat of cats) {
      // A category is either dialable or a readout — never both.
      expect(cat.rows.length === 0, `${cat.id}`).to.eq(cat.readout.length > 0);
    }
    const diag = cats.find((c) => c.id === 'diagnostics');
    expect(diag?.readout.map((g) => g.label)).to.deep.eq(['Server link', 'Display']);
    for (const group of diag?.readout ?? []) {
      expect(group.rows.length, group.label).to.be.greaterThan(0);
    }
  });

  it('stepping forward applies the next option in the ring', () => {
    const row = () => buildConsoleSettings({context: 'game'}).flatMap((c) => c.rows).find((r) => r.id === 'buttons');
    expect(buttonLayoutState.layout).to.eq('standard');
    row()?.step(1);
    expect(buttonLayoutState.layout).to.eq('swap-ab');
    row()?.step(1); // wraps
    expect(buttonLayoutState.layout).to.eq('standard');
  });

  it('stepping BACKWARD from the first option wraps to the last (the ‹ arrow)', () => {
    const row = () => buildConsoleSettings({context: 'menu'}).flatMap((c) => c.rows).find((r) => r.id === 'display');
    expect(currentProfileOverride()).to.eq('auto'); // ring position 0
    row()?.step(-1);
    expect(currentProfileOverride()).to.eq(PROFILE_CHOICES[PROFILE_CHOICES.length - 1]);
    row()?.step(1);
    expect(currentProfileOverride()).to.eq('auto');
  });

  it('a toggle is a two-option ring — stepping either way flips it', () => {
    const row = () => buildConsoleSettings({context: 'game'}).flatMap((c) => c.rows).find((r) => r.id === 'privateScore');
    expect(row()?.count).to.eq(2);
    row()?.step(1);
    expect(privateScoreState.enabled).to.eq(true);
    row()?.step(-1);
    expect(privateScoreState.enabled).to.eq(false);
  });

  it('the reading-text scale is a 100/115/130 ring that drives --con-read-scale', () => {
    const row = () => buildConsoleSettings({context: 'menu'}).flatMap((c) => c.rows).find((r) => r.id === 'textScale');
    expect(row()?.count).to.eq(3);
    expect(readingScaleState.scale).to.eq(100);
    row()?.step(1);
    expect(readingScaleState.scale).to.eq(115);
    expect(row()?.value).to.eq('115%');
    row()?.step(1);
    expect(readingScaleState.scale).to.eq(130);
    row()?.step(1); // wraps back to the default
    expect(readingScaleState.scale).to.eq(100);
  });

  it('a launch-time network value that differs from this session carries a pending note', () => {
    const server: DesktopAppModeInfo = {requested: 'remote', effective: 'host', embeddedStatus: 'ready'};
    const lan: DesktopLanState = {visible: true, active: true, name: 'host', hosts: []};
    const rows = buildConsoleSettings({context: 'menu', server, lan}).flatMap((c) => c.rows);
    const network = buildConsoleSettings({context: 'menu', server, lan}).find((c) => c.id === 'network');
    expect(network?.minor).to.eq(true);
    const gameServer = rows.find((r) => r.id === 'gameServer');
    expect(gameServer?.noteTone).to.eq('pending');
    expect(gameServer?.note).to.not.eq('');
    // LAN visibility is offered only while hosting, and matches this session.
    expect(rows.find((r) => r.id === 'lanVisible')).to.eq(undefined);
  });

  it('a matching network choice has no note, and hosting offers LAN visibility', () => {
    const server: DesktopAppModeInfo = {requested: 'host', effective: 'host', embeddedStatus: 'ready'};
    const lan: DesktopLanState = {visible: false, active: false, name: 'host', hosts: []};
    const rows = buildConsoleSettings({context: 'menu', server, lan}).flatMap((c) => c.rows);
    expect(rows.find((r) => r.id === 'gameServer')?.note).to.eq('');
    expect(rows.find((r) => r.id === 'lanVisible')?.note).to.eq('');
  });

  it('the diagnostics client version comes from the desktop shell when it answers', () => {
    const cats = buildConsoleSettings({context: 'game', desktopVersion: '9.9.9-test'});
    const connection = cats.find((c) => c.id === 'diagnostics')?.readout.find((g) => g.label === 'Server link');
    expect(connection?.rows.find((r) => r.label === 'Client version')?.value).to.eq('9.9.9-test');
  });

  it('the tile-placement confirm lives in CONTROLS in both contexts and drives the flow pref', () => {
    for (const context of ['menu', 'game'] as const) {
      const controls = buildConsoleSettings({context}).find((c) => c.id === 'controls');
      expect(controls?.rows.map((r) => r.id), context).to.include('placeConfirm');
    }
    const row = buildConsoleSettings({context: 'game'})
      .flatMap((c) => c.rows).find((r) => r.id === 'placeConfirm');
    expect(placementFlowState.twoStep).to.eq(true); // the recommended default
    row?.step(1);
    expect(placementFlowState.twoStep).to.eq(false);
    setPlacementTwoStep(true);
  });
});
