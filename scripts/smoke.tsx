/**
 * Smoke test: renderiza la app entera a HTML con react-dom/server y verifica
 * que no explote y que los números que produce la física lleguen a la pantalla.
 * Es lo único que cubre el árbol de componentes de punta a punta.
 */
import React from 'react';
import { renderToString } from 'react-dom/server';
import App from '../src/App';
import { LanguageProvider } from '../src/i18n/LanguageContext';
import { calculate, DEFAULT_INPUT } from '../src/physics';

const g = globalThis as Record<string, unknown>;
g.navigator = { language: 'es' };
g.localStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};
g.window = {
  matchMedia: () => ({ matches: false }),
  setTimeout: () => 0,
  clearTimeout: () => undefined,
};
g.document = { documentElement: { dataset: {}, lang: '', dir: '' } };

const pass: string[] = [];
const fail: string[] = [];
const check = (name: string, ok: boolean, detail = '') =>
  (ok ? pass : fail).push(`${ok ? 'OK  ' : 'FALLA'} ${name}${detail ? ' :: ' + detail : ''}`);

const languages = ['es', 'en', 'fr', 'de', 'pt', 'hi', 'zh-CN', 'ja', 'ru', 'ar'];
let html = '';

for (const lang of languages) {
  (g.navigator as { language: string }).language = lang;
  try {
    html = renderToString(
      React.createElement(LanguageProvider, null, React.createElement(App)),
    );
    check(`render en ${lang}`, html.length > 5000, `${html.length} bytes`);
  } catch (e) {
    check(`render en ${lang}`, false, String(e).slice(0, 160));
  }
}

// El último render es en árabe; volvemos a español para las comprobaciones de texto.
(g.navigator as { language: string }).language = 'es';
html = renderToString(React.createElement(LanguageProvider, null, React.createElement(App)));

const r = calculate(DEFAULT_INPUT);
check('el SAG estático llega a la pantalla', html.includes(r.static.loaded.sagMax.toFixed(2)), r.static.loaded.sagMax.toFixed(2));
check('el punto más bajo de la caída llega a la pantalla', html.includes(r.fall.personLowestDepth.toFixed(2)), r.fall.personLowestDepth.toFixed(2));
check('la fuerza pico llega a la pantalla', html.includes((r.fall.peakForceN / 1000).toFixed(2)), (r.fall.peakForceN / 1000).toFixed(2));
check('se dibuja el perfil de la cinta (path SVG)', (html.match(/<path/g) ?? []).length >= 3, `${(html.match(/<path/g) ?? []).length} paths`);
check('el gráfico tiene viewBox', /viewBox="0 0 1000 \d/.test(html));
check('sin claves de traducción sin resolver', !/>[a-z]+\.[a-z][a-zA-Z.]+</.test(html));
check('sin placeholders sin sustituir', !/\{(depth|limit|strain|load|pre|extra|g|ff|factor|gravity)\}/.test(html));
check('sin "undefined" ni "NaN" en la salida', !html.includes('undefined') && !html.includes('NaN'));
check('badge de escala real presente', html.includes('escala real 1:1'));
check('crédito conservado', html.includes('Bruno Rapa') && html.includes('brunorapavisuales'));
check('aviso del modelo presente', html.includes('cuasi-estático'));

console.log(pass.join('\n'));
if (fail.length) console.log(fail.join('\n'));
console.log('-'.repeat(50));
console.log(`${pass.length} OK, ${fail.length} fallas`);
if (fail.length) process.exit(1);
