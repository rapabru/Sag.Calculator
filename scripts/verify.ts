import { calculate, solveStatic, DEFAULT_INPUT, DISCIPLINE_PRESETS, WAIST_RATIO, G } from '../src/physics/index';
import type { RigInput } from '../src/physics/types';

const f = (n: number, d = 2) => n.toFixed(d);
const pass: string[] = [];
const fail: string[] = [];
const check = (name: string, ok: boolean, detail: string) =>
  (ok ? pass : fail).push(`${ok ? 'OK  ' : 'FALLA'} ${name} :: ${detail}`);

// El backup sigue al vano (20 % más) igual que en la app, salvo que el caso lo fije.
const rig = (o: Partial<RigInput> = {}): RigInput => {
  const merged = { ...DEFAULT_INPUT, ...o };
  if (o.span !== undefined && o.backupLength === undefined) merged.backupLength = o.span * 1.2;
  return merged;
};

console.log('=== 1. Contraste con la formula vieja (70 m, 3 kN, 80 kg) ===');
{
  const W = 80 * G, T = 3000, L = 70;
  const old = (W * L) / (2 * Math.sqrt(4 * T * T - W * W));
  const r = calculate(rig({ pretensionN: 3000 }));
  console.log(`  formula vieja (T fija 3 kN) : ${f(old, 3)} m`);
  console.log(`  solver nuevo (T sube)       : ${f(r.static.loaded.sagMax, 3)} m`);
  console.log(`  tension final               : ${f(r.static.loaded.H / 1000, 2)} kN (pretension 3.00)`);
  console.log(`  angulo en el anclaje        : ${f((r.static.loaded.thetaAnchor * 180) / Math.PI, 2)} deg`);
  console.log(`  elongacion                  : ${f(r.static.loaded.strain * 100, 2)} %`);
  check('sag nuevo < sag viejo', r.static.loaded.sagMax < old, `${f(r.static.loaded.sagMax, 3)} < ${f(old, 3)}`);
  check('mismo orden de magnitud', r.static.loaded.sagMax > old * 0.5, `${f(r.static.loaded.sagMax, 3)} vs ${f(old, 3)}`);
  check('tension sube al pisar', r.static.loaded.H > 3000, `${f(r.static.loaded.H, 0)} N > 3000 N`);
}

console.log('\n=== 2. Invariancia del angulo con el largo (tension fija) ===');
{
  // Sin peso propio para aislar el efecto de la carga puntual.
  const base = { mainWeightGm: 0, backupWeightGm: 0, webbingElongationPct: 0.05 };
  const a = solveStatic(rig({ ...base, span: 20, pretensionN: 3000 }));
  const b = solveStatic(rig({ ...base, span: 200, pretensionN: 3000 }));
  const thA = (a.loaded.thetaAnchor * 180) / Math.PI;
  const thB = (b.loaded.thetaAnchor * 180) / Math.PI;
  console.log(`   20 m : sag ${f(a.loaded.sagMax, 3)} m, theta ${f(thA, 3)} deg, sag/largo ${f(a.sagRatioPct, 2)} %`);
  console.log(`  200 m : sag ${f(b.loaded.sagMax, 3)} m, theta ${f(thB, 3)} deg, sag/largo ${f(b.sagRatioPct, 2)} %`);
  check('mismo angulo', Math.abs(thA - thB) < 0.01, `${f(thA, 3)} vs ${f(thB, 3)} deg`);
  check('sag proporcional al largo (10x)', Math.abs(b.loaded.sagMax / a.loaded.sagMax - 10) < 0.05,
    `ratio ${f(b.loaded.sagMax / a.loaded.sagMax, 3)}`);
}

console.log('\n=== 3. El efecto que se pidio: corta+floja vs larga+tensa ===');
{
  const trick = solveStatic(rig({ span: 20, pretensionN: 1500, anchorHeight: 1 }));
  const long = solveStatic(rig({ span: 200, pretensionN: 12000, anchorHeight: 3 }));
  console.log(`  trickline 20 m @ 1.5 kN : sag ${f(trick.loaded.sagMax, 2)} m, sag/largo ${f(trick.sagRatioPct, 1)} %, theta ${f((trick.loaded.thetaAnchor * 180) / Math.PI, 1)} deg`);
  console.log(`  longline 200 m @ 12 kN  : sag ${f(long.loaded.sagMax, 2)} m, sag/largo ${f(long.sagRatioPct, 1)} %, theta ${f((long.loaded.thetaAnchor * 180) / Math.PI, 1)} deg`);
  check('la corta se ve en V', trick.sagRatioPct > 5, `${f(trick.sagRatioPct, 1)} % > 5 %`);
  check('la larga se ve casi recta', long.sagRatioPct < 3, `${f(long.sagRatioPct, 1)} % < 3 %`);
  check('la larga es mas plana que la corta', long.sagRatioPct < trick.sagRatioPct / 3, `${f(long.sagRatioPct, 1)} vs ${f(trick.sagRatioPct, 1)}`);
}

console.log('\n=== 4. Caida con leash (80 kg, leash 1.5 m, 70 m @ 3.5 kN) ===');
{
  const r = calculate(rig());
  const fl = r.fall;
  console.log(`  sag de pie                  : ${f(r.static.loaded.sagMax, 2)} m`);
  console.log(`  caida libre                 : ${f(fl.freeFallDistance, 2)} m (fall factor ${f(fl.fallFactor, 2)})`);
  console.log(`  sag dinamico de la cinta    : ${f(fl.dynamicSag, 2)} m  (+${f(fl.extraSag, 2)} m)`);
  console.log(`  PUNTO MAS BAJO de la persona: ${f(fl.personLowestDepth, 2)} m bajo los anclajes`);
  console.log(`  caida total recorrida       : ${f(fl.totalDrop, 2)} m`);
  console.log(`  libre al suelo en caida     : ${f(fl.fallGroundClearance, 2)} m (anclajes a 13 m)`);
  console.log(`  fuerza pico en la persona   : ${f(fl.peakForceN / 1000, 2)} kN = ${f(fl.peakForceBodyWeights, 1)} x peso corporal`);
  console.log(`  tension pico en el anclaje  : ${f(fl.peakAnchorTensionN / 1000, 2)} kN`);
  console.log(`  elongacion dinamica         : ${f(fl.dynamicStrain * 100, 2)} %`);
  check('fuerza pico en rango real 2-8 kN', fl.peakForceN > 2000 && fl.peakForceN < 8000, `${f(fl.peakForceN / 1000, 2)} kN`);
  check('cae mas abajo que el sag estatico', fl.lowestBodyPoint > r.static.loaded.sagMax, `${f(fl.lowestBodyPoint, 2)} > ${f(r.static.loaded.sagMax, 2)}`);
  check('la cinta se hunde mas en la caida', fl.extraSag > 0, `+${f(fl.extraSag, 2)} m`);
  check('trayectoria monotona', fl.trajectory.every((v, i, arr) => i === 0 || v >= arr[i - 1] - 1e-6), 'ok');
  check('trayectoria termina en el punto mas bajo', Math.abs(fl.trajectory[fl.trajectory.length - 1] - fl.personLowestDepth) < 1e-6, 'ok');
}

console.log('\n=== 5. Sin "SAG infinito": pretension muy baja ===');
{
  const r = calculate(rig({ pretensionN: 200 }));
  console.log(`  T0 = 0.2 kN, 80 kg -> sag ${f(r.static.loaded.sagMax, 2)} m, tension final ${f(r.static.loaded.H / 1000, 2)} kN, elongacion ${f(r.static.loaded.strain * 100, 2)} %`);
  check('da un numero finito', Number.isFinite(r.static.loaded.sagMax) && r.static.loaded.sagMax > 0, `${f(r.static.loaded.sagMax, 2)} m`);
  check('la tension sube muy por encima de W/2', r.static.loaded.H > (80 * G) / 2, `${f(r.static.loaded.H, 0)} N`);
  check('elongacion coherente con la tension final', Math.abs(r.static.loaded.strain - r.static.loaded.H / r.static.webbingEA) < 2e-3,
    `strain ${f(r.static.loaded.strain * 100, 3)} % vs H/EA ${f((r.static.loaded.H / r.static.webbingEA) * 100, 3)} %`);
}

console.log('\n=== 6. Impacto contra el suelo (anclajes bajos) ===');
{
  const r = calculate(rig({ anchorHeight: 6 }));
  console.log(`  anclajes 6 m -> pies llegan a ${f(r.fall.lowestBodyPoint, 2)} m, libre ${f(r.fall.bodyGroundClearance, 2)} m`);
  check('detecta el impacto', r.fall.hitsGround && r.warnings.includes('fallGroundImpact'), r.warnings.join(','));
}

console.log('\n=== 7. Persona descentrada ===');
{
  const mid = solveStatic(rig({ personPos: 0.5 }));
  const off = solveStatic(rig({ personPos: 0.15 }));
  console.log(`  centro : sag ${f(mid.loaded.sagMax, 3)} m en x=${f(mid.loaded.sagMaxX, 1)} m`);
  console.log(`  a 15 % : sag ${f(off.loaded.sagMax, 3)} m en x=${f(off.loaded.sagMaxX, 1)} m`);
  check('el sag baja al descentrarse', off.loaded.sagMax < mid.loaded.sagMax, `${f(off.loaded.sagMax, 3)} < ${f(mid.loaded.sagMax, 3)}`);
  check('el punto mas bajo se corre', Math.abs(off.loaded.sagMaxX - 0.15 * 70) < 1.5, `x=${f(off.loaded.sagMaxX, 1)} m`);
}

console.log('\n=== 8. Peso propio de la cinta: aporte real ===');
{
  const conPersona = solveStatic(rig({ span: 100, pretensionN: 10000 }));
  const soloCinta = conPersona.empty.sagMax;
  console.log(`  100 m @ 10 kN : sag de la cinta vacia ${f(soloCinta, 3)} m, con persona ${f(conPersona.loaded.sagMax, 3)} m`);
  check('el peso propio es marginal frente a la persona', soloCinta < conPersona.loaded.sagMax * 0.1,
    `${f(soloCinta, 3)} m vs ${f(conPersona.loaded.sagMax, 3)} m`);
}

console.log('\n=== 9. Rendimiento (recalculo en vivo) ===');
{
  const t0 = performance.now();
  for (let i = 0; i < 100; i++) calculate(rig({ span: 20 + i, personMassKg: 60 + i / 3 }));
  const ms = (performance.now() - t0) / 100;
  console.log(`  calculo completo (estatico + caida): ${f(ms, 2)} ms`);
  check('rapido para recalcular en cada movimiento del slider', ms < 30, `${f(ms, 2)} ms < 30 ms`);
}

console.log('\n' + '='.repeat(60));
pass.forEach((p) => console.log(p));
fail.forEach((p) => console.log(p));
console.log('='.repeat(60));
console.log(`${pass.length} OK, ${fail.length} fallas (fisica)`);

// ---------------------------------------------------------------------------
// Geometria del grafico: la propiedad 1:1 y el encuadre
// ---------------------------------------------------------------------------
import { computeChartGeometry } from '../src/components/chartGeometry';

const pass2: string[] = [];
const fail2: string[] = [];
const check2 = (name: string, ok: boolean, detail: string) =>
  (ok ? pass2 : fail2).push(`${ok ? 'OK  ' : 'FALLA'} ${name} :: ${detail}`);

console.log('\n=== 10. Escala 1:1 del grafico ===');
{
  const cases = [
    { name: 'trickline', span: 20, staticDepth: 1.2, fallDepth: 4.5, groundDepth: 1 },
    { name: 'midline', span: 70, staticDepth: 3.38, fallDepth: 12.35, groundDepth: 13 },
    { name: 'highline', span: 100, staticDepth: 2.0, fallDepth: 8, groundDepth: 60 },
    { name: 'longline', span: 200, staticDepth: 3.49, fallDepth: 13, groundDepth: 3 },
  ];
  for (const c of cases) {
    const g = computeChartGeometry({ ...c, exaggeration: 1 });
    const dxPerMeter = g.px(11) - g.px(10);
    const dyPerMeter = g.py(11) - g.py(10);
    const ok = Math.abs(dxPerMeter - dyPerMeter) < 1e-9;
    console.log(`  ${c.name.padEnd(10)} escala ${dxPerMeter.toFixed(4)} px/m horizontal, ${dyPerMeter.toFixed(4)} px/m vertical, suelo ${g.showGround ? 'en cuadro' : 'fuera de cuadro'}`);
    check2(`1:1 en ${c.name}`, ok, `${dxPerMeter.toFixed(6)} vs ${dyPerMeter.toFixed(6)} px/m`);
  }
}

console.log('\n=== 11. El dibujo refleja la proporcion real ===');
{
  const trick = solveStatic(rig({ span: 20, pretensionN: 1500, anchorHeight: 1 }));
  const long = solveStatic(rig({ span: 200, pretensionN: 12000, anchorHeight: 3 }));
  const gT = computeChartGeometry({ span: 20, staticDepth: trick.loaded.sagMax, fallDepth: 0, groundDepth: 1, exaggeration: 1 });
  const gL = computeChartGeometry({ span: 200, staticDepth: long.loaded.sagMax, fallDepth: 0, groundDepth: 3, exaggeration: 1 });
  // Pendiente aparente en pixeles del brazo de la V, de anclaje a punto mas bajo.
  const slopeT = (gT.py(trick.loaded.sagMax) - gT.py(0)) / (gT.px(10) - gT.px(0));
  const slopeL = (gL.py(long.loaded.sagMax) - gL.py(0)) / (gL.px(100) - gL.px(0));
  console.log(`  trickline: pendiente aparente en pantalla ${slopeT.toFixed(3)} (${(Math.atan(slopeT) * 180 / Math.PI).toFixed(1)} deg)`);
  console.log(`  longline : pendiente aparente en pantalla ${slopeL.toFixed(3)} (${(Math.atan(slopeL) * 180 / Math.PI).toFixed(1)} deg)`);
  check2('en pantalla la corta se ve en V y la larga casi recta', slopeT > slopeL * 2.5, `${slopeT.toFixed(3)} vs ${slopeL.toFixed(3)}`);
  check2('la pendiente dibujada coincide con la fisica', Math.abs(slopeT - 2 * trick.loaded.sagMax / 20) < 1e-9, 'exacta');
}

console.log('\n=== 12. La exageracion vertical solo toca el eje Y ===');
{
  const g1 = computeChartGeometry({ span: 70, staticDepth: 3.4, fallDepth: 12, groundDepth: 13, exaggeration: 1 });
  const g4 = computeChartGeometry({ span: 70, staticDepth: 3.4, fallDepth: 12, groundDepth: 13, exaggeration: 4 });
  const ratio1 = (g1.py(2) - g1.py(1)) / (g1.px(2) - g1.px(1));
  const ratio4 = (g4.py(2) - g4.py(1)) / (g4.px(2) - g4.px(1));
  console.log(`  x1 -> metro vertical / metro horizontal en pantalla = ${ratio1.toFixed(4)}`);
  console.log(`  x4 -> metro vertical / metro horizontal en pantalla = ${ratio4.toFixed(4)}`);
  check2('a x1 la escala es honesta', Math.abs(ratio1 - 1) < 1e-9, `${ratio1.toFixed(6)}`);
  check2('a x4 el eje vertical se estira exactamente 4 veces', Math.abs(ratio4 - 4) < 1e-9, `${ratio4.toFixed(6)}`);
}

console.log('\n=== 13. Barrido de edge cases (todo el rango de los sliders) ===');
{
  let n = 0;
  let bad = 0;
  const problems: string[] = [];
  const spans = [3, 20, 70, 200, 500];
  const tensions = [200, 1500, 12000, 25000];
  const masses = [20, 80, 150];
  const elongs = [0.5, 4, 20];
  const leashes = [0.5, 2, 8];
  const heights = [1.4, 1.67, 2.05];
  const positions = [0.02, 0.5, 0.98];
  const anchors = [0.5, 13, 300];
  for (const span of spans)
    for (const pretensionN of tensions)
      for (const personMassKg of masses)
        for (const webbingElongationPct of elongs)
            for (const leashLength of leashes)
              for (const personPos of positions)
                for (const anchorHeight of anchors)
                  for (const personHeight of heights) {
                  n++;
                  const r = calculate(rig({ span, pretensionN, personMassKg, webbingElongationPct, leashLength, personPos, anchorHeight, personHeight }));
                  const nums: Array<[string, number]> = [
                    ['sag', r.static.loaded.sagMax],
                    ['H', r.static.loaded.H],
                    ['strain', r.static.loaded.strain],
                    ['theta', r.static.loaded.thetaAnchor],
                    ['peakForce', r.fall.peakForceN],
                    ['lowest', r.fall.personLowestDepth],
                    ['drop', r.fall.totalDrop],
                    ['dynSag', r.fall.dynamicSag],
                    ['pies', r.fall.lowestBodyPoint],
                  ];
                  for (const [label, v] of nums) {
                    if (!Number.isFinite(v)) { bad++; problems.push(`${label} no finito en span=${span} T=${pretensionN} m=${personMassKg} e=${webbingElongationPct}`); break; }
                  }
                  if (r.static.loaded.sagMax < 0 || r.fall.peakForceN < 0 || r.fall.totalDrop < 0) {
                    bad++; problems.push(`negativo en span=${span} T=${pretensionN} m=${personMassKg}`);
                  }
                  if (r.fall.lowestBodyPoint <= r.fall.personLowestDepth) {
                    bad++; problems.push(`los pies no quedan bajo el arnes en h=${personHeight}`);
                  }
                  if (r.fall.personLowestDepth < r.static.loaded.sagAtLoad - 1e-6) {
                    bad++; problems.push(`caida por encima del sag estatico en span=${span} T=${pretensionN} m=${personMassKg} pos=${personPos}`);
                  }
                  if (r.static.loaded.H < pretensionN - 1e-6) {
                    bad++; problems.push(`tension por debajo de la pretension en span=${span} T=${pretensionN}`);
                  }
                  if (r.fall.peakForceN < personMassKg * G - 1e-6) {
                    bad++; problems.push(`fuerza pico menor al peso estatico en span=${span} T=${pretensionN} m=${personMassKg}`);
                  }
                  if (r.fall.dynamicSag < r.static.loaded.sagAtLoad - 1e-6) {
                    bad++; problems.push(`sag dinamico menor al estatico en span=${span} T=${pretensionN} m=${personMassKg}`);
                  }
                  const g = computeChartGeometry({ span, staticDepth: r.static.loaded.sagMax, fallDepth: r.fall.lowestBodyPoint, groundDepth: anchorHeight, topExtent: personHeight, exaggeration: 1 });
                  if (!Number.isFinite(g.scale) || g.scale <= 0 || !Number.isFinite(g.vbH) || g.vbH <= 0) {
                    bad++; problems.push(`geometria invalida en span=${span} h=${anchorHeight}`);
                  }
                  if (Math.abs((g.py(6) - g.py(5)) - (g.px(6) - g.px(5))) > 1e-9) {
                    bad++; problems.push(`escala no 1:1 en span=${span} h=${anchorHeight}`);
                  }
                }
  console.log(`  ${n} combinaciones evaluadas, ${bad} problemas`);
  problems.slice(0, 8).forEach((p) => console.log(`    ! ${p}`));
  check2('sin resultados invalidos en todo el rango', bad === 0, `${bad} de ${n}`);
}


console.log('\n=== 14. Los cuatro escenarios dan resultados realistas ===');
{
  for (const p of DISCIPLINE_PRESETS) {
    const r = calculate(rig({ span: p.span, pretensionN: p.pretensionKN * 1000, anchorHeight: p.anchorHeight }));
    const ok =
      r.static.loaded.sagMax > 0 &&
      r.fall.peakForceBodyWeights > 1.5 && r.fall.peakForceBodyWeights < 12 &&
      r.static.sagRatioPct > 0.3 && r.static.sagRatioPct < 15;
    check2(`escenario ${p.id} plausible`, ok,
      `sag ${f(r.static.loaded.sagMax, 2)} m, ${f(r.static.sagRatioPct, 1)} %, Fpico ${f(r.fall.peakForceBodyWeights, 1)}x peso`);
  }
  // El chip del escenario por defecto tiene que aparecer marcado al abrir la app.
  const opening = DISCIPLINE_PRESETS.find(
    (p) => p.span === DEFAULT_INPUT.span && p.pretensionKN * 1000 === DEFAULT_INPUT.pretensionN && p.anchorHeight === DEFAULT_INPUT.anchorHeight);
  check2('el estado inicial coincide con un escenario', !!opening, opening?.id ?? 'ninguno');
}

console.log('\n=== 15. Regla del leash: por debajo de leash+2 m no alarma ===');
{
  const bajo = calculate(rig({ span: 20, pretensionN: 4000, anchorHeight: 1 }));
  const alto = calculate(rig({ span: 200, pretensionN: 14000, anchorHeight: 8 }));
  const holgado = calculate(rig({ span: 100, pretensionN: 10000, anchorHeight: 60 }));
  console.log(`  trickline (1 m)  -> ${bajo.warnings.join(', ') || '(limpio)'}`);
  console.log(`  longline  (8 m)  -> ${alto.warnings.join(', ') || '(limpio)'}`);
  console.log(`  highline  (60 m) -> ${holgado.warnings.join(', ') || '(limpio)'}`);
  check2('en trickline informa en vez de alarmar',
    bajo.warnings.includes('leashNotRelevant') && !bajo.warnings.includes('fallGroundImpact'), bajo.warnings.join(','));
  check2('en longline de 8 m si avisa del impacto',
    alto.warnings.includes('fallGroundImpact') && !alto.warnings.includes('leashNotRelevant'), alto.warnings.join(','));
  check2('en highline no hay ningun aviso', holgado.warnings.length === 0, holgado.warnings.join(',') || '(limpio)');
}

console.log('\n=== 16-17. Fuerza pico contra la medicion real (Chocoslack: 2.5-7.4 kN en leash de 2 m) ===');
{
  const r = calculate(rig({ leashLength: 2 }));
  const kN = r.fall.peakForceN / 1000;
  console.log(`  leash 2 m, 80 kg, 70 m @ 3.5 kN -> Fpico ${f(kN, 2)} kN (${f(r.fall.peakForceBodyWeights, 1)}x peso)`);
  check2('dentro del rango medido', kN >= 2.5 && kN <= 7.4, `${f(kN, 2)} kN`);

  // El leash rigido no puede dar MENOS fuerza que uno elastico: si diera menos,
  // el modelo estaria del lado optimista, que es el que no queremos.
  console.log('  (leash inextensible: toda la absorcion la hace la cinta)');
  const estiraCinta = r.fall.dynamicSag - r.static.loaded.sagAtLoad;
  console.log(`  la cinta se hunde ${f(estiraCinta, 2)} m de mas durante la caida`);
  check2('la cinta es la que absorbe', estiraCinta > 1, `${f(estiraCinta, 2)} m`);
}

console.log('\n=== 18. El cuerpo de la persona ===');
{
  const r = calculate(rig());
  console.log(`  estatura ${DEFAULT_INPUT.personHeight} m -> arnes ${f(r.fall.harnessHeight, 2)} m sobre la cinta, pies ${f(r.fall.feetBelowHarness, 2)} m bajo el arnes`);
  console.log(`  arnes llega a ${f(r.fall.personLowestDepth, 2)} m | PIES llegan a ${f(r.fall.lowestBodyPoint, 2)} m`);
  check2('el arnes sale de la estatura', Math.abs(r.fall.harnessHeight - WAIST_RATIO * DEFAULT_INPUT.personHeight) < 1e-9, `${f(r.fall.harnessHeight, 3)} m`);
  check2('los pies quedan por debajo del arnes', r.fall.lowestBodyPoint > r.fall.personLowestDepth, `${f(r.fall.lowestBodyPoint, 2)} > ${f(r.fall.personLowestDepth, 2)}`);
  check2('la altura libre a los pies es menor que al arnes', r.fall.bodyGroundClearance < r.fall.fallGroundClearance, `${f(r.fall.bodyGroundClearance, 2)} < ${f(r.fall.fallGroundClearance, 2)}`);
  const bajo = calculate(rig({ personHeight: 1.5 }));
  const alto = calculate(rig({ personHeight: 2.0 }));
  check2('mas alto llega mas abajo', alto.fall.lowestBodyPoint > bajo.fall.lowestBodyPoint,
    `${f(alto.fall.lowestBodyPoint, 2)} > ${f(bajo.fall.lowestBodyPoint, 2)}`);
}

console.log('\n=== 19. El encuadre llega a los pies y a la cabeza ===');
{
  const r = calculate(rig());
  const g = computeChartGeometry({
    span: DEFAULT_INPUT.span, staticDepth: r.static.loaded.sagMax,
    fallDepth: r.fall.lowestBodyPoint, groundDepth: DEFAULT_INPUT.anchorHeight,
    topExtent: DEFAULT_INPUT.personHeight, exaggeration: 1,
  });
  check2('los pies entran en el cuadro', g.bottom >= r.fall.lowestBodyPoint, `${f(g.bottom, 2)} >= ${f(r.fall.lowestBodyPoint, 2)}`);
  check2('la cabeza de la persona parada entra', g.py(-DEFAULT_INPUT.personHeight + r.static.loaded.sagAtLoad) >= 0,
    `y=${f(g.py(-DEFAULT_INPUT.personHeight + r.static.loaded.sagAtLoad), 1)} px`);
  check2('la escala sigue siendo 1:1', Math.abs((g.py(4) - g.py(3)) - (g.px(4) - g.px(3))) < 1e-9, 'exacta');
}

console.log('\n' + '='.repeat(60));
pass2.forEach((p) => console.log(p));
fail2.forEach((p) => console.log(p));
console.log('='.repeat(60));
console.log(`${pass.length + pass2.length} OK, ${fail.length + fail2.length} fallas`);
if (fail2.length) process.exit(1);
