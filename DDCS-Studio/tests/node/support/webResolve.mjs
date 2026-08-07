/**
 * webResolve.mjs — an ESM resolve hook that makes Node speak the SERVER's specifier language.
 *
 * The app's modules are served from web/ at the site root, so specs (and a few modules) reach for them with a
 * root-absolute specifier: `import('/wizards/ops/surfaceraster.js')`. A browser resolves that against the origin;
 * Node resolves it against the filesystem root and fails. This hook rewrites exactly that one form — a specifier
 * starting with a single `/` — to a file: URL under web/. Nothing else is touched, so a real bare-package import
 * ('@playwright/test') still resolves the normal way.
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const WEB = pathToFileURL(path.resolve(here, '..', '..', '..', 'web') + path.sep).href;
// t1385's TEST-ONLY modules: mem-server.cjs mounts tests/support/served/ at `/_test/`, so a spec can import a frozen
// reference that never ships inside web/. Mirrored here, or a converted spec would reach for a module Node can't see.
const SERVED = pathToFileURL(path.resolve(here, '..', '..', 'support', 'served') + path.sep).href;

export function resolve(specifier, context, next) {
    if (specifier.startsWith('/_test/')) {
        return next(new URL('.' + specifier.slice('/_test'.length), SERVED).href, context);
    }
    if (specifier.startsWith('/') && !specifier.startsWith('//')) {
        return next(new URL('.' + specifier, WEB).href, context);
    }
    return next(specifier, context);
}
