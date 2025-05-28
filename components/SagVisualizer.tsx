
import React from 'react';
import { Icon } from './Icon';
import { useTranslation } from '../hooks/useTranslation';

export enum VisualizerState {
  IDLE,
  VALID_SAG,
  NO_SAG,
  INFINITE_SAG,
  ERROR_TENSION_LOW,
  ERROR_INPUT,
}

interface SagVisualizerProps {
  sagValue?: number;
  lineLength?: number;
  anchorHeight?: number;
  state: VisualizerState;
}

const getTickLabelPrecision = (totalValue: number): number => {
  if (totalValue === 0) return 0;
  const absValue = Math.abs(totalValue);
  if (absValue < 1) return 2;
  if (absValue < 10) return 1;
  return 0;
};

const calculateTicks = (totalValue: number, minTicks: number, maxTicks: number): number[] => {
  if (totalValue <= 0) return [0];
  if (totalValue > 0 && totalValue < 0.01) return [0, totalValue];

  let numTicksAttempt = Math.floor(totalValue / (totalValue > 10 ? 5 : (totalValue > 2 ? 2 : 1))) +1;
  if (totalValue < 1 && totalValue > 0) numTicksAttempt = 2;

  let numTicks = Math.min(maxTicks, Math.max(minTicks, numTicksAttempt));
  if (numTicks < 2 && totalValue > 0) numTicks = 2;
  if (numTicks < 2) return [0];

  const ticks: number[] = [];
  const increment = totalValue / (numTicks - 1);
  for (let i = 0; i < numTicks; i++) {
    ticks.push(i * increment);
  }
  
  if (ticks.length > 0) {
    ticks[0] = 0;
    ticks[ticks.length -1] = totalValue;
  } else {
    return [0, totalValue];
  }
  
  return Array.from(new Set(ticks)).sort((a,b) => a-b);
};


export const SagVisualizer: React.FC<SagVisualizerProps> = ({ sagValue, lineLength, anchorHeight, state }) => {
  const { t } = useTranslation();
  const svgWidth = 720; 
  const svgHeight = 280; 
  
  const BASE_TOP_PADDING = 20; 
  const BOTTOM_PADDING = 70; 
  const LEFT_PADDING = 80; 
  const RIGHT_PADDING = 15;    
  const POST_WIDTH = 8;
  const MIN_DRAWABLE_POST_HEIGHT_PX = 10; 

  const PIXELS_PER_METER_ANCHOR_HEIGHT_DEFAULT = 40; 

  const groundLineY = svgHeight - BOTTOM_PADDING;
  const lineStartX = LEFT_PADDING + POST_WIDTH;
  const lineEndX = svgWidth - RIGHT_PADDING - POST_WIDTH;
  const visualLineWidth = lineEndX - lineStartX;
  const midX = (lineStartX + lineEndX) / 2;

  let pathData = `M ${lineStartX} ${groundLineY} L ${lineEndX} ${groundLineY}`; 
  let visualSagDepthPixels = 0;
  let sagLowestPointY = groundLineY;
  let clearanceMeters = 0;
  let anchorPointY = groundLineY; 
  let actualVisualPostHeight = 0; 

  if (anchorHeight !== undefined && anchorHeight > 0) {
    const maxAvailableVerticalSpaceForPost = groundLineY - BASE_TOP_PADDING;

    let lengthEffectScale = 1.0;
    const referenceLengthStartEffect = 10; 
    const referenceLengthMaxEffect = 60;  
    const minVisualScaleDueToLength = 0.5; 

    if (lineLength && lineLength > referenceLengthStartEffect) {
      const ratio = Math.min(Math.max(0, (lineLength - referenceLengthStartEffect)) / (referenceLengthMaxEffect - referenceLengthStartEffect), 1.0);
      lengthEffectScale = 1.0 - ratio * (1.0 - minVisualScaleDueToLength);
    }
    
    const currentPixelsPerMeterAnchorHeight = PIXELS_PER_METER_ANCHOR_HEIGHT_DEFAULT * lengthEffectScale;
    let targetVisualPostHeight = anchorHeight * currentPixelsPerMeterAnchorHeight;
    
    actualVisualPostHeight = Math.min(targetVisualPostHeight, maxAvailableVerticalSpaceForPost);
    actualVisualPostHeight = Math.max(actualVisualPostHeight, MIN_DRAWABLE_POST_HEIGHT_PX);

    anchorPointY = groundLineY - actualVisualPostHeight;
  } else {
    anchorPointY = groundLineY;
    actualVisualPostHeight = 0;
  }


  if ((state === VisualizerState.VALID_SAG || state === VisualizerState.NO_SAG) && sagValue !== undefined) {
    if (anchorHeight !== undefined && anchorHeight > 0 && actualVisualPostHeight > 0) {
      const pixelsPerMeterForSag = actualVisualPostHeight / anchorHeight; 
      visualSagDepthPixels = sagValue * pixelsPerMeterForSag;
      sagLowestPointY = anchorPointY + visualSagDepthPixels;

      if (sagValue > 0.0001 && visualSagDepthPixels > 0.1 && lineLength !== undefined && lineLength > 0) {
        pathData = `M ${lineStartX} ${anchorPointY} L ${midX} ${sagLowestPointY} L ${lineEndX} ${anchorPointY}`;
      } else {
         pathData = `M ${lineStartX} ${anchorPointY} L ${lineEndX} ${anchorPointY}`;
      }
      clearanceMeters = anchorHeight - sagValue;
    } else { 
       pathData = `M ${lineStartX} ${groundLineY} L ${lineEndX} ${groundLineY}`; 
       sagLowestPointY = groundLineY;
       visualSagDepthPixels = 0;
       if (anchorHeight !== undefined) clearanceMeters = anchorHeight; 
    }
  } else if (state === VisualizerState.INFINITE_SAG) {
     const yForInfiniteSag = (actualVisualPostHeight > 0) ? anchorPointY : groundLineY - 10; 
     pathData = `M ${lineStartX} ${yForInfiniteSag} L ${midX} ${groundLineY -5} M ${lineEndX} ${yForInfiniteSag} L ${midX} ${groundLineY -5}`;
  } else if (state === VisualizerState.ERROR_TENSION_LOW) {
    const yForTensionLow = (actualVisualPostHeight > 0) ? anchorPointY : groundLineY -10;
    const breakPointX1 = lineStartX + visualLineWidth * 0.4;
    const breakPointX2 = lineStartX + visualLineWidth * 0.6;
    pathData = `M ${lineStartX} ${yForTensionLow} L ${breakPointX1} ${yForTensionLow + 10} M ${breakPointX2} ${yForTensionLow - 10} L ${lineEndX} ${yForTensionLow}`;
  }


  const heightTicks = anchorHeight && anchorHeight > 0 ? calculateTicks(anchorHeight, 3, 5) : [];
  const lengthTicks = lineLength && lineLength > 0 ? calculateTicks(lineLength, 3, 5) : [];
  const heightLabelPrecision = anchorHeight ? getTickLabelPrecision(anchorHeight) : 0;
  const lengthLabelPrecision = lineLength ? getTickLabelPrecision(lineLength) : 0;


  const renderContent = () => {
    switch (state) {
      case VisualizerState.IDLE:
        return <p className="text-lg text-slate-500 dark:text-slate-400">{t('visualizer.idleMessage')}</p>;
      case VisualizerState.ERROR_INPUT:
        return <div className="flex flex-col items-center text-red-500 dark:text-red-400">
                 <Icon type="error" className="w-12 h-12 mb-2"/>
                 <p className="text-lg text-center">{t('visualizer.errorInputMessage')}</p>
               </div>;
      case VisualizerState.VALID_SAG:
      case VisualizerState.NO_SAG:
      case VisualizerState.INFINITE_SAG:
      case VisualizerState.ERROR_TENSION_LOW:
        const showAnnotations = (state === VisualizerState.VALID_SAG || state === VisualizerState.NO_SAG) && anchorHeight !== undefined && anchorHeight > 0 && sagValue !== undefined && actualVisualPostHeight > 0;
        const ariaSagValue = sagValue !== undefined ? sagValue.toFixed(3) : 'N/A';

        return (
          <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto max-w-md aspect-[720/280]" aria-label={t('visualizer.ariaLabel')}>
            {/* Ground Line */}
            <line x1="0" y1={groundLineY} x2={svgWidth} y2={groundLineY} strokeDasharray="5,5" className="stroke-slate-400 dark:stroke-slate-500" strokeWidth="1"/>
            <text x={LEFT_PADDING / 2 - 25} y={groundLineY + 15} className="fill-slate-500 dark:fill-slate-400 text-xs" dominantBaseline="middle">{t('visualizer.groundLabel')}</text>

            {/* Posts */}
            {anchorHeight !== undefined && anchorHeight > 0 && actualVisualPostHeight > 0 && (
              <>
                <rect x={LEFT_PADDING} y={anchorPointY} width={POST_WIDTH} height={actualVisualPostHeight} className="fill-slate-500 dark:fill-slate-400" aria-hidden="true" />
                <rect x={svgWidth - RIGHT_PADDING - POST_WIDTH} y={anchorPointY} width={POST_WIDTH} height={actualVisualPostHeight} className="fill-slate-500 dark:fill-slate-400" aria-hidden="true" />
              </>
            )}
            
            {/* Slackline */}
            <path d={pathData} className="stroke-sky-600 dark:stroke-sky-400" strokeWidth="2.5" fill="none" strokeLinecap="round" aria-label={`Slackline with SAG of ${ariaSagValue} meters`} />

            {/* Annotations */}
            {showAnnotations && (
              <>
                {/* Hₐ - Anchor Height Label */}
                <line x1={LEFT_PADDING - 12} y1={groundLineY} x2={LEFT_PADDING - 12} y2={anchorPointY} className="stroke-slate-500 dark:stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" aria-hidden="true"/>
                <text x={LEFT_PADDING - 22} y={(groundLineY + anchorPointY) / 2} className="fill-slate-700 dark:fill-slate-300 text-xl" dominantBaseline="middle" textAnchor="end">{t('visualizer.anchorHeightAnnotation')}</text>

                {sagValue > 0.0001 && visualSagDepthPixels > 0.5 && ( 
                  <>
                    <line x1={midX} y1={anchorPointY} x2={midX} y2={sagLowestPointY} className="stroke-red-500 dark:stroke-red-400" strokeWidth="1" strokeDasharray="2,2" aria-hidden="true"/>
                    <text x={midX + 9} y={anchorPointY + visualSagDepthPixels / 2} className="fill-red-700 dark:fill-red-300 text-xl" dominantBaseline="middle">{t('visualizer.sagAnnotation')}</text>
                  </>
                )}

                {clearanceMeters > 0.0001 && sagLowestPointY < groundLineY - 0.5 && ( 
                  <>
                    <line x1={midX + visualLineWidth * 0.25} y1={groundLineY} x2={midX + visualLineWidth * 0.25} y2={sagLowestPointY} className="stroke-green-600 dark:stroke-green-400" strokeWidth="1" strokeDasharray="2,2" aria-hidden="true"/>
                    <text x={midX + visualLineWidth * 0.25 + 9} y={(groundLineY + sagLowestPointY) / 2} className="fill-green-700 dark:fill-green-300 text-xl" dominantBaseline="middle">{t('visualizer.clearanceAnnotation')}</text>
                  </>
                )}
              </>
            )}

            {/* Height Scale */}
            {anchorHeight !== undefined && anchorHeight > 0 && actualVisualPostHeight > 0 && heightTicks.length > 0 && (
                <g className="scale height-scale" aria-label={t('visualizer.heightScaleAriaLabel', { anchorHeight: anchorHeight.toFixed(heightLabelPrecision) })}>
                    {heightTicks.map((tickVal, index) => {
                        const yPos = groundLineY - ( (tickVal / anchorHeight) * actualVisualPostHeight );
                        return (
                            <g key={`h-tick-${index}`} role="presentation">
                                <line x1={LEFT_PADDING - 7} y1={yPos} x2={LEFT_PADDING} y2={yPos} className="stroke-slate-400 dark:stroke-slate-500" strokeWidth="1"/>
                                <text x={LEFT_PADDING - 20} y={yPos} textAnchor="end" dominantBaseline="middle" className="fill-slate-600 dark:fill-slate-300 text-xl">
                                    {tickVal.toFixed(heightLabelPrecision)}m
                                </text>
                            </g>
                        );
                    })}
                </g>
            )}

            {/* Length Scale */}
            {lineLength !== undefined && lineLength > 0 && lengthTicks.length > 0 && (
                <g className="scale length-scale" aria-label={t('visualizer.lengthScaleAriaLabel', { lineLength: lineLength.toFixed(lengthLabelPrecision) })}>
                    {lengthTicks.map((tickVal, index) => {
                        const xPos = lineStartX + ( (tickVal / lineLength) * visualLineWidth );
                        return (
                            <g key={`l-tick-${index}`} role="presentation">
                                <line x1={xPos} y1={groundLineY} x2={xPos} y2={groundLineY + 7} className="stroke-slate-400 dark:stroke-slate-500" strokeWidth="1"/>
                                <text x={xPos} y={groundLineY + 30} textAnchor="middle" className="fill-slate-600 dark:fill-slate-300 text-xl">
                                    {tickVal.toFixed(lengthLabelPrecision)}m
                                </text>
                            </g>
                        );
                    })}
                     <text x={(lineStartX + lineEndX)/2} y={groundLineY + 55} textAnchor="middle" className="fill-slate-700 dark:fill-slate-300 text-xl font-semibold">
                        {t('visualizer.lengthAxisLabel')}
                    </text>
                </g>
            )}
            
            {state === VisualizerState.INFINITE_SAG && (
                <text x={svgWidth/2} y={svgHeight - 10} textAnchor="middle" className="fill-yellow-600 dark:fill-yellow-400 text-xl font-semibold">{t('visualizer.infiniteSagStatus')}</text> 
            )}
            {state === VisualizerState.ERROR_TENSION_LOW && (
                <text x={svgWidth/2} y={svgHeight - 10} textAnchor="middle" className="fill-red-600 dark:fill-red-400 text-xl font-semibold">{t('visualizer.tensionLowStatus')}</text>
            )}
          </svg>
        );
      default:
        return null;
    }
  };
  
  return (
    <div className="w-full h-[310px] flex items-center justify-center bg-slate-100 dark:bg-slate-700/50 rounded-md p-2 border border-slate-200 dark:border-slate-600" role="figure" aria-labelledby="visualizer-title">
      <span id="visualizer-title" className="sr-only">{t('visualizer.figureLabel')}</span>
      {renderContent()}
    </div>
  );
};
