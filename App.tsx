
import React, { useState, useCallback } from 'react';
import { Input } from './components/Input';
import { Button } from './components/Button';
import { SagVisualizer, VisualizerState } from './components/SagVisualizer';
import { Icon } from './components/Icon';
import { LanguageSelector } from './components/LanguageSelector';
import { GRAVITY } from './constants';
import type { SagCalculationResult, StretchInfo } from './types';
import { useTranslation } from './hooks/useTranslation';

interface VisualizerInput {
  sag: number;
  lineLength: number;
  anchorHeight: number;
}

const App: React.FC = () => {
  const { t } = useTranslation();

  const [tensionKN, setTensionKN] = useState<string>("3");
  const [lineLengthM, setLineLengthM] = useState<string>("70");
  const [personMassKG, setPersonMassKG] = useState<string>("70.0");
  const [mainLineWeightInput, setMainLineWeightInput] = useState<string>("65"); // Now in g/m
  const [backupLineLengthM, setBackupLineLengthM] = useState<string>("0");
  const [backupLineWeightInput, setBackupLineWeightInput] = useState<string>("55"); // Now in g/m
  const [anchorHeightM, setAnchorHeightM] = useState<string>("13");
  const [tapeElasticityPercent, setTapeElasticityPercent] = useState<string>("4");

  const [sagResult, setSagResult] = useState<SagCalculationResult>(null);
  const [visualizerInput, setVisualizerInput] = useState<VisualizerInput | null>(null);
  const [visualizerState, setVisualizerState] = useState<VisualizerState>(VisualizerState.IDLE);
  const [stretchDetails, setStretchDetails] = useState<StretchInfo | null>(null);


  const calculateSagModified = useCallback((
    tensionKiloNewtons: number,
    lineLengthMeters: number,
    effectiveMassKg: number
  ): SagCalculationResult => {
    const W_newtons = effectiveMassKg * GRAVITY;
    const T_newtons = tensionKiloNewtons * 1000;
    const L_metros = lineLengthMeters;

    if (effectiveMassKg < 0) {
       return t('results.error.massNegative'); // Though effective mass includes line, this is generic
    }
     if (tensionKiloNewtons < 0) {
      return t('results.error.tensionNegative');
    }

    if (L_metros <= 0) {
      if (W_newtons === 0) return 0.0;
      return t('results.error.lengthNegative');
    }
    if (W_newtons === 0) {
        return 0.0;
    }

    const termUnderSqrt = 4 * T_newtons**2 - W_newtons**2;

    if (termUnderSqrt <= 0) {
      const wHalf = W_newtons / 2;
      if (Math.abs(T_newtons - wHalf) < 1e-9) {
        return t('results.error.infiniteSagTheoretical', { tension: T_newtons.toFixed(2), wHalf: wHalf.toFixed(2) });
      } else {
        return t('results.error.tensionTooLow', { tension: T_newtons.toFixed(2), wHalf: wHalf.toFixed(2) });
      }
    }

    const sagMeters = (W_newtons * L_metros) / (2 * Math.sqrt(termUnderSqrt));
    return sagMeters;
  }, [t]);

  const handleSubmit = () => {
    const tensionVal = parseFloat(tensionKN);
    const lengthVal = parseFloat(lineLengthM);
    const massVal = parseFloat(personMassKG);
    const mainLineWeightGramsPerMeter = parseFloat(mainLineWeightInput); // Input is g/m
    const backupLineLengthVal = parseFloat(backupLineLengthM);
    const backupLineWeightGramsPerMeter = parseFloat(backupLineWeightInput); // Input is g/m
    const anchorHeightVal = parseFloat(anchorHeightM);
    const elasticityVal = parseFloat(tapeElasticityPercent);

    const errorMessages: string[] = [];
    if (isNaN(tensionVal) || tensionVal < 0) {
        errorMessages.push(t('results.error.tensionNegative'));
    }
    if (isNaN(lengthVal) || lengthVal < 0) {
        errorMessages.push(t('results.error.lengthNegative'));
    }
     if (isNaN(massVal) || massVal < 0) {
        errorMessages.push(t('results.error.massNegative'));
    }
    if (isNaN(anchorHeightVal) || anchorHeightVal <= 0) {
        errorMessages.push(t('results.error.anchorHeightPositive'));
    }
    if (isNaN(mainLineWeightGramsPerMeter) || mainLineWeightGramsPerMeter < 0) {
        errorMessages.push(t('results.error.mainLineWeightNegative'));
    }
    if (isNaN(backupLineLengthVal) || backupLineLengthVal < 0) {
        errorMessages.push(t('results.error.backupLineLengthNegative'));
    }
    if (isNaN(backupLineWeightGramsPerMeter) || backupLineWeightGramsPerMeter < 0) {
        errorMessages.push(t('results.error.backupLineWeightNegative'));
    }
    if (isNaN(elasticityVal) || elasticityVal < 0) {
        errorMessages.push(t('results.error.elasticityNegative'));
    }

    if (errorMessages.length > 0) {
        setSagResult(`${t('results.error.genericInputErrorPrefix')} ${errorMessages.join(' ')}`);
        setVisualizerState(VisualizerState.ERROR_INPUT);
        setVisualizerInput(null);
        setStretchDetails(null);
        return;
    }

    // Convert g/m to kg/m for calculation
    const mainLineWeightKgM = mainLineWeightGramsPerMeter / 1000;
    const backupLineWeightKgM = backupLineWeightGramsPerMeter / 1000;

    const mainLineEffectiveMass = (lengthVal > 0 && mainLineWeightKgM > 0) ? (mainLineWeightKgM * lengthVal) / 2 : 0;
    const backupLineEffectiveMass = (backupLineLengthVal > 0 && backupLineWeightKgM > 0) ? (backupLineWeightKgM * backupLineLengthVal) / 2 : 0;
    
    const totalEffectiveMassKg = massVal + mainLineEffectiveMass + backupLineEffectiveMass;

    if (lengthVal === 0 && totalEffectiveMassKg > 0) {
        setSagResult(t('results.error.lengthZeroWithMass'));
        setVisualizerState(VisualizerState.ERROR_INPUT);
        setVisualizerInput(null);
        setStretchDetails(null);
        return;
    }

    const result = calculateSagModified(tensionVal, lengthVal, totalEffectiveMassKg);
    setSagResult(result);
    setStretchDetails(null);

    if (typeof result === 'number') {
      setVisualizerInput({ sag: result, lineLength: lengthVal, anchorHeight: anchorHeightVal });
      if (result === 0 && (lengthVal > 0 || (lengthVal === 0 && totalEffectiveMassKg === 0)) ) {
        setVisualizerState(VisualizerState.NO_SAG);
      }
      else {
        setVisualizerState(VisualizerState.VALID_SAG);
      }

      if (lengthVal > 0) {
        const L0 = lengthVal;
        const S = result;
        const arcLength = L0 > 0 ? (Math.sqrt(Math.pow(L0 / 2, 2) + Math.pow(S, 2))) * 2 : 0;
        const stretchAmountMeters = arcLength > L0 ? arcLength - L0 : 0;
        const currentStretchPercent = L0 > 0 ? (stretchAmountMeters / L0) * 100 : 0;
        
        setStretchDetails({
          amountMeters: stretchAmountMeters,
          percent: currentStretchPercent,
          totalLength: arcLength,
          limitPercent: elasticityVal,
        });

      } else {
         setStretchDetails({
          amountMeters: 0,
          percent: 0,
          totalLength: 0,
          limitPercent: elasticityVal,
        });
      }

    } else if (typeof result === 'string') {
      setVisualizerInput(null);
      setStretchDetails(null);
      if (result.includes(t('results.error.infiniteSagTheoretical', {tension:0, wHalf:0}).substring(0,20))) {
        setVisualizerState(VisualizerState.INFINITE_SAG);
      } else if (result.includes(t('results.error.tensionTooLow', {tension:0, wHalf:0}).substring(0,20))) {
        setVisualizerState(VisualizerState.ERROR_TENSION_LOW);
      } else {
        setVisualizerState(VisualizerState.ERROR_INPUT);
      }
    }
  };
  
  const getResultDisplay = () => {
    if (sagResult === null) {
      return <p className="text-lg text-slate-500 dark:text-slate-400">{t('results.prompt')}</p>;
    }
    if (typeof sagResult === 'number') {
      const clearance = visualizerInput ? visualizerInput.anchorHeight - sagResult : null;
      return (
        <div className="text-center space-y-3">
          <div>
            <p className="text-xl text-slate-700 dark:text-slate-300">{t('results.sagCalculatedLabel')}</p>
            <p className="text-5xl font-bold text-sky-600 dark:text-sky-400 my-1">
              {sagResult.toFixed(3)} {t('results.sagUnit')}
            </p>
          </div>
          {clearance !== null && visualizerInput && visualizerInput.anchorHeight > 0 && (
            <div>
              <p className="text-lg text-slate-700 dark:text-slate-300">{t('results.clearanceLabel')}</p>
              <p className="text-3xl font-bold text-slate-800 dark:text-slate-200">
                {clearance > 0 ? clearance.toFixed(3) + ` ${t('results.clearanceUnit')}` : (clearance < -0.0005 ? `${clearance.toFixed(3)} ${t('results.clearanceUnit')} ${t('results.clearanceBelowGround')}` : `0 ${t('results.clearanceUnit')} ${t('results.clearanceContact')}`)}
              </p>
            </div>
          )}
          {stretchDetails && (
            <div className="text-sm text-slate-600 dark:text-slate-400 space-y-1 mt-4 pt-3 border-t border-slate-200 dark:border-slate-600">
              <h3 className="font-semibold text-slate-700 dark:text-slate-300 mb-1">{t('results.elasticityDetails.title')}</h3>
              {parseFloat(lineLengthM) > 0 ? (
                <>
                  <p>
                    {t('results.elasticityDetails.currentStretch')} <span className="font-medium">{stretchDetails.percent.toFixed(1)}%</span> ({stretchDetails.amountMeters.toFixed(2)} m)
                  </p>
                  <p>
                    {t('results.elasticityDetails.totalLengthWithSag')} <span className="font-medium">{stretchDetails.totalLength.toFixed(2)} m</span>
                  </p>
                </>
              ) : (
                <p>{t('results.elasticityDetails.stretchNA')}</p>
              )}
              <p className={stretchDetails.percent > stretchDetails.limitPercent && parseFloat(lineLengthM) > 0 ? 'text-red-600 dark:text-red-400 font-semibold' : ''}>
                {t('results.elasticityDetails.configuredLimit')} <span className="font-medium">{stretchDetails.limitPercent.toFixed(1)}%</span>
                {stretchDetails.percent > stretchDetails.limitPercent && parseFloat(lineLengthM) > 0 && ` ${t('results.elasticityDetails.limitExceededWarning')}`}
              </p>
            </div>
          )}
        </div>
      );
    }
    const isError = sagResult.toLowerCase().startsWith('error') || sagResult.toLowerCase().startsWith(t('results.error.genericInputErrorPrefix').toLowerCase());
    return (
      <div className={`flex items-center p-3 rounded-md ${isError ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200' : 'bg-yellow-100 dark:bg-yellow-800 text-yellow-700 dark:text-yellow-200'}`}>
        {isError ? <Icon type="error" className="w-6 h-6 me-2 flex-shrink-0" /> : <Icon type="warning" className="w-6 h-6 me-2 flex-shrink-0" />}
        <p className="text-base">{sagResult.startsWith('Error: ') ? t('results.error.defaultMessage', { message: sagResult.substring(7)}) : sagResult}</p>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-slate-200 via-slate-100 to-sky-100 dark:from-slate-800 dark:via-slate-900 dark:to-sky-900">
      <div className="w-full max-w-4xl bg-white dark:bg-slate-800 shadow-2xl rounded-xl p-6 md:p-10">
        <header className="mb-8 flex flex-col items-center md:flex-row md:justify-between md:items-start">
          <div className="w-full md:w-auto text-center md:text-left">
            <h1 className="text-4xl font-bold text-sky-700 dark:text-sky-400">{t('app.title')}</h1>
            <p className="text-lg text-slate-600 dark:text-slate-400 mt-2">{t('app.subtitle')}</p>
          </div>
          <div className="mt-4 md:mt-0">
            <LanguageSelector />
          </div>
        </header>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="p-6 bg-slate-50 dark:bg-slate-700 rounded-lg shadow">
            <h2 className="text-3xl font-semibold text-slate-700 dark:text-slate-200 border-b-2 border-sky-500 pb-2 mb-6">{t('input.parametersTitle')}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
              <Input
                id="tension"
                label={t('input.tension.label')}
                unit={t('input.tension.unit')}
                value={tensionKN}
                onChange={(e) => setTensionKN(e.target.value)}
                placeholder={t('input.tension.placeholder')}
                type="number"
                step="0.1"
                min="0"
              />
              <Input
                id="length"
                label={t('input.length.label')}
                unit={t('input.length.unit')}
                value={lineLengthM}
                onChange={(e) => setLineLengthM(e.target.value)}
                placeholder={t('input.length.placeholder')}
                type="number"
                step="0.1"
                min="0"
              />
              <Input
                id="mass"
                label={t('input.mass.label')}
                unit={t('input.mass.unit')}
                value={personMassKG}
                onChange={(e) => setPersonMassKG(e.target.value)}
                placeholder={t('input.mass.placeholder')}
                type="number"
                step="0.1"
                min="0"
              />
              <Input
                id="anchorHeight"
                label={t('input.anchorHeight.label')}
                unit={t('input.anchorHeight.unit')}
                value={anchorHeightM}
                onChange={(e) => setAnchorHeightM(e.target.value)}
                placeholder={t('input.anchorHeight.placeholder')}
                type="number"
                step="0.1"
                min="0.01"
              />

              <div className="col-span-1 sm:col-span-2 my-3">
                <hr className="border-slate-300 dark:border-slate-600" />
              </div>
              
              <Input
                id="mainLineWeight"
                label={t('input.mainLineWeight.label')}
                unit={t('input.mainLineWeight.unit')}
                value={mainLineWeightInput}
                onChange={(e) => setMainLineWeightInput(e.target.value)}
                placeholder={t('input.mainLineWeight.placeholder')}
                type="number"
                step="1" // Updated step for g/m
                min="0"
              />
              <Input
                id="backupLineLength"
                label={t('input.backupLineLength.label')}
                unit={t('input.backupLineLength.unit')}
                value={backupLineLengthM}
                onChange={(e) => setBackupLineLengthM(e.target.value)}
                placeholder={t('input.backupLineLength.placeholder')}
                type="number"
                step="0.1"
                min="0"
              />
              <Input
                id="backupLineWeight"
                label={t('input.backupLineWeight.label')}
                unit={t('input.backupLineWeight.unit')}
                value={backupLineWeightInput}
                onChange={(e) => setBackupLineWeightInput(e.target.value)}
                placeholder={t('input.backupLineWeight.placeholder')}
                type="number"
                step="1" // Updated step for g/m
                min="0"
              />
              <Input
                id="tapeElasticity"
                label={t('input.elasticity.label')}
                unit={t('input.elasticity.unit')}
                value={tapeElasticityPercent}
                onChange={(e) => setTapeElasticityPercent(e.target.value)}
                placeholder={t('input.elasticity.placeholder')}
                type="number"
                step="0.5"
                min="0"
              />
            </div>
            <Button onClick={handleSubmit} className="w-full !mt-8">
              <Icon type="calculator" className="w-5 h-5 me-2"/>
              {t('button.calculate')}
            </Button>
          </div>

          <div className="space-y-6 p-6 bg-slate-50 dark:bg-slate-700 rounded-lg shadow flex flex-col items-center">
            <h2 className="text-3xl font-semibold text-slate-700 dark:text-slate-200 border-b-2 border-sky-500 pb-2 w-full text-center">{t('results.title')}</h2>
            <div className="w-full min-h-[150px] flex items-center justify-center">
              {getResultDisplay()}
            </div>
            <div className="w-full h-[450px] flex items-center justify-center bg-slate-100 dark:bg-slate-700/50 rounded-md p-2 border border-slate-200 dark:border-slate-600" role="figure" aria-labelledby="visualizer-title">
              <SagVisualizer
                sagValue={visualizerInput?.sag}
                lineLength={visualizerInput?.lineLength}
                anchorHeight={visualizerInput?.anchorHeight}
                state={visualizerState}
              />
            </div>
          </div>
        </div>
        <footer className="mt-10 text-center text-base text-slate-500 dark:text-slate-400">
          <p>{t('footer.copyright', { year: new Date().getFullYear() })}</p>
           <p className="mt-1">{t('footer.gravityConstant', { gravity: GRAVITY })}</p>
           <p className="mt-1">{t('footer.developedBy')} <a href="https://github.com/rapabru" target="_blank" rel="noopener noreferrer" className="text-sky-600 dark:text-sky-400 hover:underline">Bruno Rapa</a> (<a href="https://instagram.com/brunorapavisuales" target="_blank" rel="noopener noreferrer" className="text-sky-600 dark:text-sky-400 hover:underline">@brunorapavisuales</a>).</p>
        </footer>
      </div>
    </div>
  );
};

export default App;