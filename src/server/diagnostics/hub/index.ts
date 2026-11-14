/*
 * The hub's bundle entry (`webpack.diagnostics.config.js` → `build/electron/diagnostics-hub.js`) — what the Electron
 * main process `require`s. One function: everything else of the hub is reached through the object it returns.
 */
export {createDiagnosticsHub} from './hub';
