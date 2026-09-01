import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_INPUT,
  DISCIPLINE_PRESETS,
  G,
  WAIST_RATIO,
  WEBBING_PRESETS,
  calculate,
  type RigInput,
} from './physics';
import {
  deleteRig,
  deleteWebbing,
  loadRigs,
  loadWebbings,
  saveRig,
  saveWebbing,
  type SavedRig,
  type SavedWebbing,
} from './presets/storage';
import { GuideTour, hasSeenGuide } from './components/GuideTour';
import { useTranslation } from './i18n/useTranslation';
import { ParamSlider } from './components/ParamSlider';
import { SagChart } from './components/SagChart';
import { FallResults, StaticResults } from './components/ResultsPanel';
import { PhysicsNotes } from './components/PhysicsNotes';
import { LanguageSelector } from './components/LanguageSelector';
import { ThemeToggle } from './components/ThemeToggle';
import { ExportPanel } from './components/ExportPanel';
import { IconAlert, IconInfo, IconPlay, IconHelp } from './components/Icons';

const ANIMATION_MS = 1700;
/** Por debajo de esto el resultado no cambió de verdad: no vale reanimar. */
const REPLAY_THRESHOLD_M = 0.01;

const App: React.FC = () => {
  const { t } = useTranslation();
  const [input, setInput] = useState<RigInput>(DEFAULT_INPUT);
  // Arranca en ×1,5: el sag suele ser tan chico frente al vano que a escala
  // exacta cuesta leerlo. El cartel avisa que NO es escala real hasta bajarlo a ×1.
  const [exaggeration, setExaggeration] = useState(1.5);
  const [showFall, setShowFall] = useState(true);
  const [animDepth, setAnimDepth] = useState<number | null>(null);
  /** El backup sigue al vano (20 % más) hasta que se lo edita a mano. */
  const [backupAuto, setBackupAuto] = useState(true);
  const [savedRigs, setSavedRigs] = useState<SavedRig[]>(() => loadRigs());
  const [savedWebbings, setSavedWebbings] = useState<SavedWebbing[]>(() => loadWebbings());
  const [guideOpen, setGuideOpen] = useState(() => !hasSeenGuide());

  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const lastPlayedRef = useRef<number | null>(null);
  const chartBoxRef = useRef<HTMLDivElement>(null);

  const set = useCallback(
    <K extends keyof RigInput>(key: K) =>
      (value: RigInput[K]) =>
        setInput((prev) => {
          const next = { ...prev, [key]: value };
          if (key === 'span' && backupAuto) next.backupLength = Number(((value as number) * 1.2).toFixed(1));
          return next;
        }),
    [backupAuto],
  );

  // Recálculo en vivo: el solver completo tarda menos de 1 ms, así que no hace
  // falta ningún botón «calcular» ni debounce.
  const result = useMemo(() => calculate(input), [input]);

  const stopAnimation = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    rafRef.current = null;
    timerRef.current = null;
    setAnimDepth(null);
  }, []);

  useEffect(() => stopAnimation, [stopAnimation]);

  const playFall = useCallback(() => {
    const traj = result.fall.trajectory;
    if (!traj.length) return;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    setShowFall(true);
    lastPlayedRef.current = result.fall.personLowestDepth;
    const start = performance.now();
    const step = (now: number) => {
      const p = Math.min((now - start) / ANIMATION_MS, 1);
      const idx = p * (traj.length - 1);
      const lo = Math.floor(idx);
      const hi = Math.min(lo + 1, traj.length - 1);
      setAnimDepth(traj[lo] + (idx - lo) * (traj[hi] - traj[lo]));
      if (p < 1) rafRef.current = requestAnimationFrame(step);
      else {
        rafRef.current = null;
        timerRef.current = window.setTimeout(() => setAnimDepth(null), 900);
      }
    };
    rafRef.current = requestAnimationFrame(step);
  }, [result.fall]);

  /**
   * Se llama al SOLTAR un control, no durante el arrastre. Y sólo reanima si el
   * resultado cambió de verdad, para que ajustar un decimal no dispare la
   * animación entera.
   */
  const playIfChanged = useCallback(() => {
    if (!showFall) return;
    const depth = result.fall.personLowestDepth;
    if (lastPlayedRef.current !== null && Math.abs(depth - lastPlayedRef.current) < REPLAY_THRESHOLD_M) return;
    playFall();
  }, [showFall, result.fall.personLowestDepth, playFall]);

  const applyPreset = useCallback(
    (p: (typeof DISCIPLINE_PRESETS)[number]) => {
      setInput((prev) => ({
        ...prev,
        span: p.span,
        pretensionN: p.pretensionKN * 1000,
        anchorHeight: p.anchorHeight,
        backupLength: backupAuto ? Number((p.span * 1.2).toFixed(1)) : prev.backupLength,
      }));
      lastPlayedRef.current = null;
    },
    [backupAuto],
  );

  // La animación de un preset tiene que correr con el resultado YA recalculado.
  const pendingPresetRef = useRef(false);
  useEffect(() => {
    if (pendingPresetRef.current) {
      pendingPresetRef.current = false;
      playIfChanged();
    }
  }, [playIfChanged]);

  const activePreset = DISCIPLINE_PRESETS.find(
    (p) =>
      p.span === input.span &&
      p.pretensionKN * 1000 === input.pretensionN &&
      p.anchorHeight === input.anchorHeight,
  );

  const harnessHeight = WAIST_RATIO * input.personHeight;

  const banners = useMemo(() => {
    const list: Array<{ tone: 'danger' | 'warn' | 'info'; text: string }> = [];
    const f = result.fall;
    const s = result.static;
    if (result.warnings.includes('fallGroundImpact'))
      list.push({
        tone: 'danger',
        text: t('banner.fallImpact', { depth: Math.abs(f.bodyGroundClearance).toFixed(2) }),
      });
    if (result.warnings.includes('leashNotRelevant'))
      list.push({ tone: 'info', text: t('banner.leashNotRelevant') });
    if (s.groundClearance <= 0) list.push({ tone: 'danger', text: t('banner.staticGround') });
    if (s.overElongated || f.overElongated)
      list.push({
        tone: 'warn',
        text: t('banner.overElongation', {
          strain: (Math.max(s.loaded.strain, f.dynamicStrain) * 100).toFixed(2),
          limit: input.elongationLimitPct,
        }),
      });
    if (result.warnings.includes('highAnchorLoad'))
      list.push({
        tone: 'warn',
        text: t('banner.highAnchorLoad', { load: (f.peakAnchorTensionN / 1000).toFixed(1) }),
      });
    if (result.warnings.includes('backupShorterThanMain'))
      list.push({ tone: 'warn', text: t('banner.backupShorter') });
    return list;
  }, [result, t, input.elongationLimitPct]);

  return (
    <div className="app">
      {guideOpen && <GuideTour onClose={() => setGuideOpen(false)} />}
      <header className="topbar">
        <div className="brand">
          <h1>
            SAG<span className="accent">·</span>CALC
          </h1>
          <p>{t('app.subtitle')}</p>
        </div>
        <div className="topbar-spacer" />
        <div className="topbar-tools">
          <LanguageSelector />
          <button
            className="icon-btn no-print"
            title={t('guide.reopen')}
            aria-label={t('guide.reopen')}
            onClick={() => setGuideOpen(true)}
          >
            <IconHelp />
          </button>
          <ThemeToggle title={t('theme.toggle')} />
        </div>
      </header>

      <div className="layout">
        {/* ---------------- parámetros ---------------- */}
        <div className="panel-params">
          <section className="panel" data-tour="presets">
            <div className="panel-head">
              <h2>{t('presets.label')}</h2>
            </div>
            <div className="panel-body tight">
              <div className="chips">
                {DISCIPLINE_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    className="chip"
                    aria-pressed={activePreset?.id === p.id}
                    onClick={() => {
                      applyPreset(p);
                      pendingPresetRef.current = true;
                    }}
                  >
                    {t(`presets.${p.id}`)}
                  </button>
                ))}
              </div>

              {savedRigs.length > 0 && (
                <div className="chips" style={{ marginTop: 8 }}>
                  {savedRigs.map((r) => (
                    <span key={r.id} className="chip-saved">
                      <button
                        className="chip"
                        onClick={() => {
                          setInput(r.input);
                          setBackupAuto(false);
                          lastPlayedRef.current = null;
                          pendingPresetRef.current = true;
                        }}
                      >
                        {r.name}
                      </button>
                      <button
                        className="chip-x no-print"
                        aria-label={t('presets.delete', { name: r.name })}
                        onClick={() => setSavedRigs(deleteRig(r.id))}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <button
                className="btn no-print"
                style={{ marginTop: 10, width: '100%' }}
                onClick={() => {
                  const name = window.prompt(t('presets.savePrompt'), t('presets.defaultName', { span: input.span }));
                  if (name) setSavedRigs(saveRig(name, input));
                }}
              >
                {t('presets.save')}
              </button>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>{t('group.line')}</h2>
            </div>
            <div className="panel-body">
              <ParamSlider
                label={t('field.span')} symbol="L" unit="m"
                value={input.span} min={3} max={500} step={1} decimals={1}
                onChange={set('span')} onCommit={playIfChanged}
              />
              <ParamSlider
                label={t('field.pretension')} symbol="T₀" unit="kN"
                value={input.pretensionN / 1000} min={0.2} max={25} step={0.1} decimals={2}
                onChange={(v) => set('pretensionN')(v * 1000)} onCommit={playIfChanged}
              />
              <ParamSlider
                label={t('field.mass')} symbol="m" unit="kg"
                value={input.personMassKg} min={20} max={150} step={1} decimals={1}
                onChange={set('personMassKg')} onCommit={playIfChanged}
              />
              <ParamSlider
                label={t('field.personHeight')} symbol="h" unit="m"
                value={input.personHeight} min={1.2} max={2.2} step={0.01} decimals={2}
                hint={t('field.personHeight.hint', { harness: harnessHeight.toFixed(2) })}
                onChange={set('personHeight')} onCommit={playIfChanged}
              />
              <ParamSlider
                label={t('field.anchorHeight')} symbol="Hₐ" unit="m"
                value={input.anchorHeight} min={0.5} max={300} step={0.5} decimals={2}
                onChange={set('anchorHeight')} onCommit={playIfChanged}
              />
              <ParamSlider
                label={t('field.personPos')} symbol="a/L" unit="%"
                value={input.personPos * 100} min={2} max={98} step={1} decimals={1}
                hint={Math.abs(input.personPos - 0.5) < 0.005 ? t('field.personPos.center') : undefined}
                action={
                  <button
                    type="button"
                    className="mini-btn no-print"
                    onClick={() => {
                      set('personPos')(0.5);
                      playIfChanged();
                    }}
                  >
                    {t('field.personPos.centerBtn')}
                  </button>
                }
                onChange={(v) => set('personPos')(v / 100)} onCommit={playIfChanged}
              />
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>{t('group.webbing')}</h2>
            </div>
            <div className="panel-body">
              <div className="field">
                <div className="field-top">
                  <span className="field-label">{t('field.webbingPreset')}</span>
                </div>
                <select
                  style={{ width: '100%' }}
                  value={
                    WEBBING_PRESETS.find(
                      (w) =>
                        w.gramsPerMeter === input.mainWeightGm &&
                        w.elongationPct === input.webbingElongationPct,
                    )?.id ??
                    (savedWebbings.find(
                      (w) =>
                        w.gramsPerMeter === input.mainWeightGm &&
                        w.elongationPct === input.webbingElongationPct,
                    )?.id.replace(/^/, 'saved:') ?? '')
                  }
                  onChange={(e) => {
                    const v = e.target.value;
                    const w = v.startsWith('saved:')
                      ? savedWebbings.find((x) => x.id === v.slice(6))
                      : WEBBING_PRESETS.find((p) => p.id === v);
                    if (w) {
                      setInput((prev) => ({
                        ...prev,
                        mainWeightGm: w.gramsPerMeter,
                        webbingElongationPct: w.elongationPct,
                      }));
                      playIfChanged();
                    }
                  }}
                >
                  <option value="">—</option>
                  {WEBBING_PRESETS.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.label} · {w.gramsPerMeter} g/m · {w.elongationPct} %
                    </option>
                  ))}
                  {savedWebbings.length > 0 && (
                    <optgroup label={t('presets.mine')}>
                      {savedWebbings.map((w) => (
                        <option key={w.id} value={`saved:${w.id}`}>
                          {w.name} · {w.gramsPerMeter} g/m · {w.elongationPct} %
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                <div className="chips" style={{ marginTop: 8 }}>
                  <button
                    className="chip no-print"
                    onClick={() => {
                      const name = window.prompt(
                        t('presets.saveWebbingPrompt'),
                        `${input.mainWeightGm} g/m · ${input.webbingElongationPct} %`,
                      );
                      if (name)
                        setSavedWebbings(saveWebbing(name, input.mainWeightGm, input.webbingElongationPct));
                    }}
                  >
                    {t('presets.saveWebbing')}
                  </button>
                  {savedWebbings.map((w) => (
                    <button
                      key={w.id}
                      className="chip-x no-print"
                      aria-label={t('presets.delete', { name: w.name })}
                      onClick={() => setSavedWebbings(deleteWebbing(w.id))}
                    >
                      {w.name} ×
                    </button>
                  ))}
                </div>
              </div>
              <ParamSlider
                label={t('field.mainWeight')} unit="g/m"
                value={input.mainWeightGm} min={0} max={200} step={1} decimals={1}
                onChange={set('mainWeightGm')} onCommit={playIfChanged}
              />
              <ParamSlider
                label={t('field.elongation')} unit="%"
                value={input.webbingElongationPct} min={0.5} max={20} step={0.1} decimals={2}
                hint={t('field.elongation.hint')}
                onChange={set('webbingElongationPct')} onCommit={playIfChanged}
              />
              <ParamSlider
                label={t('field.elongationLimit')} unit="%"
                value={input.elongationLimitPct} min={1} max={30} step={0.5} decimals={2}
                onChange={set('elongationLimitPct')} onCommit={playIfChanged}
              />
              <ParamSlider
                label={t('field.backupLength')} unit="m"
                value={input.backupLength} min={0} max={620} step={1} decimals={1}
                hint={
                  backupAuto
                    ? t('field.backupLength.auto')
                    : input.backupLength === 0
                      ? t('field.backup.none')
                      : undefined
                }
                action={
                  !backupAuto ? (
                    <button
                      type="button"
                      className="mini-btn no-print"
                      onClick={() => {
                        setBackupAuto(true);
                        set('backupLength')(Number((input.span * 1.2).toFixed(1)));
                      }}
                    >
                      {t('field.backupLength.relink')}
                    </button>
                  ) : undefined
                }
                onChange={(v) => {
                  setBackupAuto(false);
                  set('backupLength')(v);
                }}
                onCommit={playIfChanged}
              />
              <ParamSlider
                label={t('field.backupWeight')} unit="g/m"
                value={input.backupWeightGm} min={0} max={200} step={1} decimals={1}
                onChange={set('backupWeightGm')} onCommit={playIfChanged}
              />
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>{t('group.fall')}</h2>
            </div>
            <div className="panel-body">
              <ParamSlider
                label={t('field.leashLength')} unit="m"
                value={input.leashLength} min={0.5} max={8} step={0.1} decimals={2}
                hint={t('field.leashLength.hint')}
                onChange={set('leashLength')} onCommit={playIfChanged}
              />
              <p className="field-note">{t('field.leashRigid')}</p>
            </div>
          </section>
        </div>

        {/* ---------------- gráfico y resultados ---------------- */}
        <div>
          <section className="panel">
            <div className="panel-head">
              <h2>{t('chart.title')}</h2>
              <span className={`scale-badge${exaggeration === 1 ? ' true-scale' : ''}`}>
                {exaggeration === 1
                  ? t('chart.trueScale')
                  : t('chart.exaggerated', { factor: exaggeration.toFixed(1) })}
              </span>
            </div>
            <div className="panel-body tight">
              <div className="chart-wrap" ref={chartBoxRef} data-tour="chart">
                <SagChart
                  input={input}
                  result={result}
                  exaggeration={exaggeration}
                  showFall={showFall}
                  animDepth={animDepth}
                  onPersonPosChange={set('personPos')}
                  onPersonPosCommit={playIfChanged}
                />
                <div className="chart-toolbar">
                  <label className="toggle-row">
                    <input
                      type="checkbox"
                      checked={showFall}
                      onChange={(e) => {
                        setShowFall(e.target.checked);
                        if (!e.target.checked) stopAnimation();
                      }}
                    />
                    {t('chart.showFall')}
                  </label>
                  <button className="btn primary" onClick={playFall}>
                    <IconPlay />
                    {animDepth === null ? t('chart.animate') : t('chart.replay')}
                  </button>
                  <span data-tour="export">
                    <ExportPanel
                      getChart={() => chartBoxRef.current?.querySelector('svg') ?? null}
                      input={input}
                      result={result}
                      onModeChange={({ detailed, includeChart }) => {
                        document.body.classList.toggle('print-compact', !detailed);
                        document.body.classList.toggle('print-nochart', !includeChart);
                      }}
                    />
                  </span>
                  <div className="zoom">
                    <span style={{ whiteSpace: 'nowrap' }}>{t('chart.zoom')}</span>
                    <input
                      type="range"
                      aria-label={t('chart.zoom')}
                      min={1}
                      max={10}
                      step={0.5}
                      value={exaggeration}
                      style={{ ['--fill' as string]: `${((exaggeration - 1) / 9) * 100}%` }}
                      onChange={(e) => setExaggeration(parseFloat(e.target.value))}
                    />
                    <span className="mono" style={{ width: 30 }}>×{exaggeration.toFixed(1)}</span>
                  </div>
                </div>
              </div>
              <div className="legend" style={{ marginTop: 10 }}>
                <span><i style={{ borderColor: 'var(--text-faint)', borderTopStyle: 'dashed' }} />{t('chart.legend.empty')}</span>
                <span><i style={{ borderColor: 'var(--webbing)', borderTopWidth: 3 }} />{t('chart.legend.static')}</span>
                {showFall && <span><i style={{ borderColor: 'var(--danger)', borderTopStyle: 'dashed' }} />{t('chart.legend.fall')}</span>}
                <span style={{ marginLeft: 'auto', color: 'var(--text-faint)' }}>{t('chart.drag')}</span>
              </div>
            </div>
          </section>

          {banners.length > 0 && (
            <div style={{ marginTop: 14 }}>
              {banners.map((b, i) => (
                <div key={i} className={`banner ${b.tone}`}>
                  {b.tone === 'info' ? <IconInfo /> : <IconAlert />}
                  <span dangerouslySetInnerHTML={{ __html: b.text }} />
                </div>
              ))}
            </div>
          )}

          <section className="panel">
            <div className="panel-head">
              <h2>{t('results.static')}</h2>
            </div>
            <div className="panel-body tight">
              <StaticResults input={input} result={result} />
            </div>
          </section>

          <section className="panel" data-tour="fall">
            <div className="panel-head">
              <h2>{t('results.fall')}</h2>
            </div>
            <div className="panel-body tight">
              <FallResults input={input} result={result} />
              <div className="banner info" style={{ marginTop: 12, marginBottom: 0 }}>
                <IconInfo />
                <span>{t('banner.model')}</span>
              </div>
            </div>
          </section>

          <PhysicsNotes />
        </div>
      </div>

      <footer className="credits">
        <div className="mono">{t('footer.gravity', { gravity: G })}</div>
        <div>{t('footer.disclaimer')}</div>
        <div>
          {t('footer.by')}{' '}
          <a href="https://github.com/rapabru" target="_blank" rel="noopener noreferrer">Bruno Rapa</a>{' '}
          (<a href="https://instagram.com/brunorapavisuales" target="_blank" rel="noopener noreferrer">@brunorapavisuales</a>)
        </div>
      </footer>
    </div>
  );
};

export default App;
