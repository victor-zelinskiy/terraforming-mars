// The standalone server CLI (Heroku / npm start / dev:server). All actual
// startup lives in the reusable library `GameServer.ts` (docs/EMBEDDED_SERVER.md)
// — this file owns only the process environment: dotenv, log stamping, the
// crash hook and the operator banner.
import '@/server/init';
require('console-stamp')(
  console,
  {format: ':date(yyyy-mm-dd HH:MM:ss Z)'},
);

import ansi from 'ansi-escape-sequences';
import raw_settings from '../genfiles/settings.json';
import {runId, serverId} from '@/server/utils/server-ids';
import {startGameServer} from '@/server/GameServer';

process.on('uncaughtException', (err: any) => {
  console.error('UNCAUGHT EXCEPTION', err);
});

async function start() {
  console.log(`Starting ${raw_settings.head}, built at ${raw_settings.builtAt}`);

  const port = process.env.PORT || 8080;
  const host = process.env.HOST;
  if (host) {
    console.log(`Starting server listening to ${host} on port ${port}`);
  } else {
    console.log(`Starting server on port ${port}`);
  }

  await startGameServer({port, host});

  if (!process.env.SERVER_ID) {
    console.log(`The secret serverId for this server is ${ansi.style.bold}${serverId}${ansi.style.reset}.`);
    console.log(`Administrative routes can be found at admin?serverId=${serverId}`);
  }
  console.log(`The public run ID is ${runId}`);
  console.log('Server is ready.');
}

try {
  start();
} catch (err) {
  console.error('Cannot start server:');
  console.error(err);
}
