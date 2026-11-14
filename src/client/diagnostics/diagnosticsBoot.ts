/*
 * THE FIRST MODULE OF THE PAGE. `main.ts` imports it before anything else, and ES modules are evaluated in import
 * order — so the interceptor stands before the application's own graph runs a line: an exception thrown while a module
 * loads, a warn printed by the boot, the main menu's first failure are all records (they used to be printed into
 * nothing: the field recorder was installed only when the console was entered).
 *
 * A module with a side effect ON PURPOSE, and nothing else in it.
 */
import {installDiagnosticsCapture} from '@/client/diagnostics/diagnosticsCapture';

installDiagnosticsCapture();
