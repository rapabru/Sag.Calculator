// Verifica que los diez idiomas tengan exactamente el mismo juego de claves que
// es.json y los mismos placeholders {x}. Un placeholder mal traducido pasa
// desapercibido en la UI (queda el literal "{depth}" en pantalla).
import fs from 'node:fs';
import path from 'node:path';

const dir = path.join(import.meta.dirname, '../src/i18n/locales');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
const base = JSON.parse(fs.readFileSync(path.join(dir, 'es.json'), 'utf8'));
const ref = Object.keys(base);
const holders = (s) => [...String(s ?? '').matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

let bad = 0;
for (const file of files) {
  const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  const missing = ref.filter((k) => !(k in data));
  const extra = Object.keys(data).filter((k) => !ref.includes(k));
  const empty = ref.filter((k) => k in data && String(data[k]).trim() === '');
  const mismatched = ref.filter((k) => holders(base[k]) !== holders(data[k]));
  // En el deporte se dice SAG en todos los idiomas: las etiquetas de resultado
  // no deben usar la palabra local.
  const OLD_SAG = /flecha|flèche|durchhang|垂度|たわみ|провис|الترخّي|झोल/i;
  const sagWord = ref.filter((k) => (k.startsWith('res.') || k === 'app.subtitle') && OLD_SAG.test(String(data[k] ?? '')));
  const problems = [
    missing.length && `faltan ${missing.length}: ${missing.slice(0, 4).join(', ')}`,
    extra.length && `sobran ${extra.length}: ${extra.slice(0, 4).join(', ')}`,
    empty.length && `vacías ${empty.length}`,
    mismatched.length && `placeholders: ${mismatched.slice(0, 4).join(', ')}`,
    sagWord.length && `dice la palabra local en vez de SAG: ${sagWord.join(', ')}`,
  ].filter(Boolean);
  if (problems.length) bad++;
  console.log(`${problems.length ? 'FALLA' : 'OK   '} ${file.padEnd(12)} ${Object.keys(data).length} claves ${problems.join(' | ')}`);
}
console.log(bad ? `\n${bad} archivos con problemas` : '\n10 idiomas completos y consistentes');
process.exit(bad ? 1 : 0);
