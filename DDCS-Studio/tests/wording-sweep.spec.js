import { test, expect } from '@playwright/test';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

/**
 * WORDING SWEEP (t660, E2). No user-facing "post processor" / "this post" wording may remain in the app's UI strings:
 * the app talks to the user in CONTROLLER vocabulary ("generate for another controller", "this controller can't run X").
 * Code identifiers / APIs (dialect/post internals) and code COMMENTS are explicitly out of scope — this guard flags a
 * phrase only when it sits INSIDE a quoted string (a rendered UI string), on a non-comment line.
 */

const here = fileURLToPath(new URL('.', import.meta.url));   // …/DDCS-Studio/tests/
const uiRoot = join(here, '..', 'web', 'ui');
const wizRoot = join(here, '..', 'web', 'wizards');

function jsFiles(dir, acc = []) {
    for (const e of readdirSync(dir)) {
        const p = join(dir, e);
        const st = statSync(p);
        if (st.isDirectory()) jsFiles(p, acc);
        else if (p.endsWith('.js')) acc.push(p);
    }
    return acc;
}

test('no user-facing "post processor" / "this post" strings remain in web/ui + web/wizards (controller vocabulary sweep)', () => {
    // the forbidden user-facing phrases …
    const PHRASE = [/post[- ]process(or)?/i, /this post\b/i];
    // … but only when they appear INSIDE a quoted string (an opening quote precedes the phrase, no closing quote between)
    const QUOTED = [/['"`][^'"`]*post[- ]process(or)?/i, /['"`][^'"`]*this post\b/i];
    const isComment = (ln) => /^\s*(\/\/|\*|\/\*|<!--)/.test(ln);   // whole-line comments / JSDoc are out of scope

    const offenders = [];
    for (const file of [...jsFiles(uiRoot), ...jsFiles(wizRoot)]) {
        readFileSync(file, 'utf8').split('\n').forEach((ln, i) => {
            if (!isComment(ln) && PHRASE.some((re) => re.test(ln)) && QUOTED.some((re) => re.test(ln))) {
                offenders.push(`${file.replace(here, '')}:${i + 1}  ${ln.trim()}`);
            }
        });
    }
    expect(offenders, 'user-facing post-processor/"this post" strings must read as controller vocabulary:\n' + offenders.join('\n')).toEqual([]);
});
