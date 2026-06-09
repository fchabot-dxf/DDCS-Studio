import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

(async () => {
  try {
    const atcPath = new URL('../src/wizards/atcLengthWizard.js', import.meta.url).href;
    const mod = await import(atcPath);
    const AtcLengthWizard = mod.AtcLengthWizard;
    if (!AtcLengthWizard) {
      console.error('AtcLengthWizard not found in module');
      process.exit(2);
    }
    const wiz = new AtcLengthWizard();
    const gcode = wiz.generate({
      blockHeight: 50.0,
      safeZ: 10.0,
      maxDist: 200,
      retract: 3,
      qStop: 1,
      f_fast: 300,
      f_slow: 50,
      port: 4,
      level: 0
    });
    console.log('--- GENERATED G-CODE START ---');
    console.log(gcode);
    console.log('--- GENERATED G-CODE END ---');
  } catch (err) {
    console.error('Test failed', err);
    process.exit(1);
  }
})();
