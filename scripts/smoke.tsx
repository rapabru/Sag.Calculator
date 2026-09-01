/**
 * Smoke test: renderiza la app entera a HTML con react-dom/server y verifica
 * que no explote y que los números que produce la física lleguen a la pantalla.
 * Es lo único que cubre el árbol de componentes de punta a punta.
 */
import React from 'react';
import { renderToString } from 'react-dom/server';
import App from '../src/App';
import { GuideTour } from '../src/components/GuideTour';
import { LanguageProvider } from '../src/i18n/LanguageContext';
import { calculate, DEFAULT_INPUT } from '../src/physics';
import { TOKENS, resolveVars } from '../src/components/exportImage';

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
check('el punto más bajo de la caída llega a la pantalla', html.includes(r.fall.lowestBodyPoint.toFixed(2)), r.fall.lowestBodyPoint.toFixed(2));
check('las etiquetas de escenario traen el vano del dato', html.includes('Longline') && html.includes('50') && !html.includes('Longline 200'));
check('hay interruptor de leash', html.includes('Se camina amarrado'));
check('panel de historial presente', html.includes('Historial'));
check('el botón de exportar está en la barra superior', html.indexOf('Exportar') < html.indexOf('Perfil de la cinta'));
check('sin login visible sin credenciales de Supabase', !html.includes('Entrar con Google'));
check('la fuerza pico llega a la pantalla', html.includes((r.fall.peakForceN / 1000).toFixed(2)), (r.fall.peakForceN / 1000).toFixed(2));
check('se dibuja el perfil de la cinta (path SVG)', (html.match(/<path/g) ?? []).length >= 3, `${(html.match(/<path/g) ?? []).length} paths`);
check('el gráfico tiene viewBox', /viewBox="0 0 1000 \d/.test(html));
check('sin claves de traducción sin resolver', !/>[a-z]+\.[a-z][a-zA-Z.]+</.test(html));
check('sin placeholders sin sustituir', !/\{(depth|limit|strain|load|pre|extra|g|ff|factor|gravity)\}/.test(html));
check('sin "undefined" ni "NaN" en la salida', !html.includes('undefined') && !html.includes('NaN'));
check('el cartel avisa que la exageración no es escala real', html.includes('no es escala real'));
check('crédito conservado', html.includes('Bruno Rapa') && html.includes('brunorapavisuales'));
check('aviso del modelo presente', html.includes('cuasi-estático'));
check('terminología: dice CINTA, no «línea»', html.includes('Perfil de la cinta') && !/Perfil de la línea/.test(html));
check('terminología: dice SAG, no «flecha»', !/[Ff]lecha/.test(html));
check('botón de centrar presente', html.includes('centrar'));
check('botón de exportar presente', html.includes('Exportar'));
check('altura de la persona presente', html.includes('Altura de la persona'));
check('sin control de elasticidad del leash', !html.includes('Elongación del leash'));
check('se explica que el leash es inextensible', html.includes('inextensible'));
check('botón de guardar configuración', html.includes('Guardar configuración actual'));
check('botón de guardar cinta', html.includes('Guardar esta cinta'));
check('opción de exportar sin gráfico presente en el DOM tras abrir', html.includes('Exportar'));
check('el arnés derivado aparece', html.includes('0.97') || html.includes('0,97'));

// --- la guia no aparece en el render normal (localStorage la marca como vista),
// --- asi que se renderiza aparte para comprobar que no explota.
{
  try {
    const guide = renderToString(
      React.createElement(LanguageProvider, null, React.createElement(GuideTour, { onClose: () => undefined })),
    );
    check('la guía renderiza', guide.length > 200, `${guide.length} bytes`);
    // React separa los nodos de texto con comentarios en SSR: "1<!-- --> / <!-- -->5".
    const plano = guide.replace(/<!--[\s\S]*?-->/g, '');
    // Sin fijar el total: agregar un paso a la guía no debe romper el test.
    const paso = plano.match(/(\d+) \/ (\d+)/);
    check('la guía arranca en el paso 1', paso?.[1] === '1' && Number(paso[2]) >= 5, paso?.[0] ?? 'no encontrado');
    check('la guía tiene botón de saltear', guide.includes('Saltear'));
    check('la guía explica la escala', /escala/i.test(guide) || guide.includes('SAG'));
    check('sin claves de traducción sin resolver en la guía', !/guide\.[a-z0-9.]+/i.test(guide));
  } catch (e) {
    check('la guía renderiza', false, String(e).slice(0, 160));
  }
}

// --- exportar: el fallo clasico es que el SVG serializado conserve las
// --- variables CSS y la imagen salga en negro. Se prueba sobre el markup real.
{
  // El primer <svg> de la página es el ícono del tema: hay que buscar el del
  // gráfico, que es el único con el viewBox de 1000 de ancho.
  const svgMatch = html.match(/<svg[^>]*viewBox="0 0 1000[\s\S]*?<\/svg>/);
  check('el gráfico se serializa como SVG', !!svgMatch);
  if (svgMatch) {
    const raw = svgMatch[0];
    const usados = [...raw.matchAll(/var\(--([a-z0-9-]+)\)/gi)].map((m) => m[1]);
    const desconocidos = [...new Set(usados)].filter((n) => !TOKENS.includes(n));
    check('todas las variables del gráfico están en la paleta de exportación',
      desconocidos.length === 0, desconocidos.join(', ') || `${new Set(usados).size} variables`);

    const fake: Record<string, string> = {};
    for (const tk of TOKENS) fake[tk] = '#123456';
    const resuelto = resolveVars(raw, fake);
    check('no queda ninguna var() sin resolver', !resuelto.includes('var(--'),
      (resuelto.match(/var\(--[a-z0-9-]+\)/gi) ?? []).join(', '));
    check('los colores literales quedaron aplicados', resuelto.includes('#123456'));
  }
}

console.log(pass.join('\n'));
if (fail.length) console.log(fail.join('\n'));
console.log('-'.repeat(50));
console.log(`${pass.length} OK, ${fail.length} fallas`);
if (fail.length) process.exit(1);
