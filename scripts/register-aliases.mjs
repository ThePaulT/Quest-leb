/** Installs the `@/*` resolver hook. Used via `node --import`. */
import { register } from 'node:module';

register('./alias-hooks.mjs', import.meta.url);
