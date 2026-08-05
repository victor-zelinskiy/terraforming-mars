import {IDatabase} from './IDatabase';

export class Database {
  private static instance: IDatabase;

  private constructor() {}

  // The backends are required LAZILY, inside the branch that selects them: a
  // static `import {PostgreSQL}` executes `require('pg')` at module load, and
  // the packaged desktop app (embedded host-as-server mode) ships neither `pg`
  // nor `better-sqlite3` — importing this module must stay safe there. Only the
  // selected backend's module ever loads (LocalFilesystem in the desktop app).
  public static getInstance() {
    if (!Database.instance) {
      if (process.env.POSTGRES_HOST !== undefined) {
        console.log('Connecting to Postgres database.');
        const {PostgreSQL} = require('./PostgreSQL') as typeof import('./PostgreSQL');
        Database.instance = new PostgreSQL();
      } else if (process.env.LOCAL_FS_DB !== undefined) {
        console.log('Connecting to local filesystem database.');
        const {LocalFilesystem} = require('./LocalFilesystem') as typeof import('./LocalFilesystem');
        Database.instance = new LocalFilesystem();
      } else {
        console.log('Connecting to SQLite database.');
        const {SQLite} = require('./SQLite') as typeof import('./SQLite');
        Database.instance = new SQLite();
      }
    }
    return Database.instance;
  }
}
