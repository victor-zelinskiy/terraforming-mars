import * as fs from 'fs';
import * as path from 'path';
import {BrowserContext, Page, TestInfo} from '@playwright/test';
import {DiagJournal} from '../../src/common/diagnostics/journal';

/**
 * THE CAUSE HARVEST — every test files the CAUSE CLASSES its pages named (docs/claude/console/freeze-zero/PLAN.md §2.1;
 * `src/common/diagnostics/cause.ts`).
 *
 * A stall is filed under its cause class in the field (Sentry's fingerprint), and the class is a PURE function of the
 * net's line. So the harness files the very same key: each page of a test gets a journal of its own — the page's own
 * `DiagJournal`, fed the console's warnings and errors exactly as the page's interceptor feeds it — and what it made of
 * them (records, episodes with their outcomes, what spoke inside them) is written per test:
 *
 *   <outputDir>/cause-classes/<spec>--<title>-r<retry>.json     · annotation `cause-class` (the DEFECT classes)
 *
 * A red spec finds its field cases by that key (`npm run diag -- class <key>`), a field case finds the spec that
 * reproduces it (`npm run diag -- class` greps these files), and the monkey's report is the same records summed
 * (`scripts/monkey-report.mjs`). DATA, never red by itself: the guards that turn a net red are the harness's own.
 *
 * No `page.evaluate`: the lines are read off the console the harness already listens to, so a page that hangs or is
 * replaced loses nothing.
 */
export type CauseRecord = {
  /** The cause class — the grouping key. */
  cls: string;
  shape: string;
  tier: 'defect' | 'planned' | 'info';
  family: string;
  /** Which page of the test (0 = the first). */
  page: number;
  /** Repeats of the record, and console lines folded into it. */
  count: number;
  lines: number;
  /** Milliseconds from the harvest's arming to the record's first line. */
  atMs: number;
  title: string;
  dims: Record<string, string>;
  episode?: {
    /** `healed` · `unhealed` · `reload`; `test-ended` — the test was over before the episode was. */
    outcome: string;
    stoodS: number;
    cure: string;
    nets: Array<{cls: string, tier: string, n: number}>;
  };
};

export type CauseHarvest = {
  /** What the pages named so far (the open episodes as they stand). */
  records: () => Array<CauseRecord>;
  /** The test is over: an episode still open ends as `test-ended`. */
  close: () => Array<CauseRecord>;
};

export function armCauseHarvest(context: BrowserContext): CauseHarvest {
  const t0 = Date.now();
  const journals: Array<DiagJournal> = [];
  const watch = (page: Page): void => {
    const journal = new DiagJournal({runtime: 'page', session: `e2e${journals.length}`, build: 'e2e', max: 400});
    journals.push(journal);
    page.on('console', (message) => {
      const type = message.type();
      if (type !== 'warning' && type !== 'error') {
        return;
      }
      try {
        journal.ingest({at: Date.now(), level: type === 'error' ? 'error' : 'warn', text: message.text().slice(0, 6000)});
      } catch {
        // A reader never breaks the test it reads.
      }
    });
    // A page that reloads keeps its journal here (the page's own would adopt the mirror): its open episode ends in a reload.
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) {
        journal.closeOpenEpisodes('reload');
      }
    });
  };
  context.pages().forEach(watch);
  context.on('page', watch);
  const read = (ended: boolean): Array<CauseRecord> => {
    const out: Array<CauseRecord> = [];
    journals.forEach((journal, page) => {
      const open = new Set(ended ? journal.entries().filter((e) => e.episode?.state === 'open').map((e) => e.id) : []);
      if (ended) {
        journal.closeOpenEpisodes('quit');
      }
      for (const entry of journal.entries()) {
        if (entry.cause === undefined) {
          continue;
        }
        const episode = entry.episode;
        out.push({
          cls: entry.cause.cls, shape: entry.cause.shape, tier: entry.cause.tier, family: entry.family, page,
          count: entry.count, lines: Math.max(entry.count, episode?.lines ?? 1), atMs: entry.at - t0,
          title: entry.title.slice(0, 400), dims: {...entry.cause.dims},
          ...(episode !== undefined ? {
            episode: {
              outcome: open.has(entry.id) ? 'test-ended' : (episode.outcome ?? episode.state),
              stoodS: Math.round(episode.durationMs / 100) / 10,
              cure: episode.cure?.by ?? '',
              nets: (episode.nets ?? []).map((n) => ({...n})),
            },
          } : {}),
        });
      }
    });
    return out;
  };
  return {records: () => read(false), close: () => read(true)};
}

/** The DEFECT classes of a harvest, each with how many records named it — what an annotation and a report line print. */
export function defectClasses(records: ReadonlyArray<CauseRecord>): Array<{cls: string, n: number}> {
  const byClass = new Map<string, number>();
  for (const record of records) {
    if (record.tier === 'defect') {
      byClass.set(record.cls, (byClass.get(record.cls) ?? 0) + 1);
    }
  }
  return [...byClass].map(([cls, n]) => ({cls, n})).sort((a, b) => b.n - a.n || a.cls.localeCompare(b.cls));
}

/** One test's harvest as a file under `<outputDir>/cause-classes/` and an annotation — nothing when no class was named. */
export function fileCauseRecords(testInfo: TestInfo, records: ReadonlyArray<CauseRecord>, extra: Record<string, unknown> = {}): void {
  // (A spec that noted facts of its own files them even with no record: a monkey's walk that named nothing is still
  // a walk of N presses — the report's denominator.)
  if (records.length === 0 && Object.keys(extra).length === 0) {
    return;
  }
  const defects = defectClasses(records);
  if (defects.length > 0) {
    testInfo.annotations.push({type: 'cause-class', description: defects.map((d) => `${d.cls}${d.n > 1 ? ` ×${d.n}` : ''}`).join(' · ').slice(0, 900)});
  }
  const out = path.join(testInfo.project.outputDir, 'cause-classes');
  fs.mkdirSync(out, {recursive: true});
  const slug = `${path.basename(testInfo.file, '.spec.ts')}--${testInfo.title}`.replace(/[^\w.-]+/g, '-').slice(0, 150);
  fs.writeFileSync(path.join(out, `${slug}-r${testInfo.retry}.json`), JSON.stringify({
    file: path.basename(testInfo.file), title: testInfo.title, retry: testInfo.retry, status: testInfo.status, ...extra, records,
  }, null, 1));
}
