/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import * as Icons from 'lucide-react';
import { ProcessStep, BrandingSettings, ContentSettings } from '../types.js';

interface ProcessTimelineProps {
  processSteps: ProcessStep[];
  branding: BrandingSettings;
  content: ContentSettings;
}

export default function ProcessTimeline({ processSteps, branding, content }: ProcessTimelineProps) {
  const [activeStepIndex, setActiveStepIndex] = React.useState<number>(0);

  const getThemeTextClass = () => {
    switch (branding.themeColor) {
      case 'emerald': return 'text-emerald-600';
      case 'slate': return 'text-slate-800';
      case 'indigo': return 'text-indigo-600';
      case 'violet': return 'text-violet-600';
      case 'deepblue':
      default:
        return 'text-blue-600';
    }
  };

  const getThemeBorderClass = () => {
    switch (branding.themeColor) {
      case 'emerald': return 'border-emerald-600';
      case 'slate': return 'border-slate-800';
      case 'indigo': return 'border-indigo-600';
      case 'violet': return 'border-violet-600';
      case 'deepblue':
      default:
        return 'border-blue-600';
    }
  };

  const getThemeBgClass = () => {
    switch (branding.themeColor) {
      case 'emerald': return 'bg-emerald-600';
      case 'slate': return 'bg-slate-800';
      case 'indigo': return 'bg-indigo-600';
      case 'violet': return 'bg-violet-600';
      case 'deepblue':
      default:
        return 'bg-blue-600';
    }
  };

  const getThemeLightBgClass = () => {
    switch (branding.themeColor) {
      case 'emerald': return 'bg-emerald-50 text-emerald-800';
      case 'slate': return 'bg-slate-100 text-slate-800';
      case 'indigo': return 'bg-indigo-50 text-indigo-800';
      case 'violet': return 'bg-violet-50 text-violet-800';
      case 'deepblue':
      default:
        return 'bg-blue-50 text-blue-800';
    }
  };

  const activeStep = processSteps[activeStepIndex] || processSteps[0];

  return (
    <div className="bg-white border-t border-slate-200/60 py-20 sm:py-28 relative overflow-hidden" id="process-timeline-section">
      <div className="absolute top-0 left-0 w-80 h-80 bg-slate-50 rounded-full blur-3xl pointer-events-none opacity-40"></div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-slate-100 border border-slate-200 rounded-full text-[10px] font-extrabold uppercase tracking-widest text-slate-500 font-mono mb-4">
            Our Method
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 font-display">
            {content.processHeader || 'How We Work Together'}
          </h2>
          <p className="mt-4 text-sm sm:text-base text-slate-500 font-sans leading-relaxed">
            {content.processSubtitle || 'A structured, secure, and client-centric consulting approach ensuring that your system architectures are engineered for high scalability and zero disruption.'}
          </p>
          <div className={`h-1 w-16 mx-auto mt-5 rounded-full ${getThemeBgClass()}`}></div>
        </div>

        {/* Interactive Steps Picker */}
        <div className="relative mb-16">
          {/* Connecting Line */}
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-200 -translate-y-1/2 hidden md:block z-0"></div>
          
          <div className="grid grid-cols-2 md:flex md:justify-between gap-6 relative z-10">
            {processSteps.map((step, idx) => {
              const StepIcon = (Icons as any)[step.iconName] || Icons.HelpCircle;
              const isActive = activeStepIndex === idx;
              
              return (
                <button
                  key={step.id}
                  onClick={() => setActiveStepIndex(idx)}
                  className={`flex flex-col items-center text-center p-4 md:p-0 bg-slate-50 md:bg-transparent rounded-2xl md:rounded-none border md:border-0 cursor-pointer focus:outline-hidden transition-all duration-300 ${
                    isActive 
                      ? 'border-blue-200 md:scale-105' 
                      : 'border-slate-100 hover:border-slate-200'
                  }`}
                  id={`process-step-btn-${idx}`}
                >
                  {/* Step Bubble */}
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center border-2 transition-all duration-300 shadow-sm ${
                    isActive 
                      ? `${getThemeBgClass()} border-transparent text-white scale-110 shadow-lg` 
                      : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'
                  }`}>
                    <StepIcon className="h-6 w-6" />
                  </div>

                  {/* Step Info */}
                  <span className="text-[10px] font-mono font-extrabold text-slate-400 uppercase tracking-widest mt-4">
                    Step {step.stepNumber}
                  </span>
                  <span className={`text-xs font-bold font-display mt-1 transition-colors ${
                    isActive ? getThemeTextClass() : 'text-slate-700'
                  }`}>
                    {step.title}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Detailed Step Cards (Glassmorphic) */}
        {activeStep && (
          <div 
            className="bg-slate-50/50 backdrop-blur-md rounded-3xl border border-slate-200 p-8 sm:p-12 shadow-md relative overflow-hidden transition-all duration-500 flex flex-col md:flex-row md:items-center gap-8 md:gap-12"
            id="active-process-detail-card"
          >
            {/* Left Accent Glow */}
            <div className={`absolute top-0 left-0 w-2 h-full ${getThemeBgClass()}`}></div>
            
            {/* Step Graphic */}
            <div className={`w-20 h-20 rounded-3xl flex items-center justify-center shrink-0 border border-slate-100 shadow-md ${getThemeLightBgClass()}`}>
              {React.createElement((Icons as any)[activeStep.iconName] || Icons.HelpCircle, { className: 'h-10 w-10' })}
            </div>

            {/* Step Description */}
            <div className="space-y-4">
              <span className="text-[10px] font-mono font-extrabold text-slate-400 uppercase tracking-widest">
                Stage {activeStep.stepNumber} in Action
              </span>
              <h3 className="text-2xl font-black text-slate-900 font-display">
                {activeStep.title}
              </h3>
              <p className="text-sm sm:text-base text-slate-600 font-sans leading-relaxed max-w-4xl">
                {activeStep.description}
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
