/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { HelpCircle } from 'lucide-react';
import { StoredIcon } from './StoredIcon';
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
      case 'emerald': return 'text-brand-700';
      case 'slate': return 'text-ink';
      case 'indigo': return 'text-brand-700';
      case 'violet': return 'text-brand-700';
      case 'deepblue':
      default:
        return 'text-brand-700';
    }
  };

  const getThemeBorderClass = () => {
    switch (branding.themeColor) {
      case 'emerald': return 'border-brand-700';
      case 'slate': return 'border-brand-800';
      case 'indigo': return 'border-brand-700';
      case 'violet': return 'border-brand-700';
      case 'deepblue':
      default:
        return 'border-brand-700';
    }
  };

  const getThemeBgClass = () => {
    switch (branding.themeColor) {
      case 'emerald': return 'bg-brand-700';
      case 'slate': return 'bg-brand-800';
      case 'indigo': return 'bg-brand-700';
      case 'violet': return 'bg-brand-700';
      case 'deepblue':
      default:
        return 'bg-brand-700';
    }
  };

  const getThemeLightBgClass = () => {
    switch (branding.themeColor) {
      case 'emerald': return 'bg-brand-50 text-brand-700';
      case 'slate': return 'bg-sand text-ink';
      case 'indigo': return 'bg-brand-50 text-brand-700';
      case 'violet': return 'bg-brand-50 text-brand-700';
      case 'deepblue':
      default:
        return 'bg-brand-50 text-brand-700';
    }
  };

  const activeStep = processSteps[activeStepIndex] || processSteps[0];

  return (
    <div className="bg-white border-t border-gold-light py-20 sm:py-28 relative overflow-hidden" id="process-timeline-section">
      <div className="absolute top-0 left-0 w-80 h-80 bg-sand rounded-full blur-3xl pointer-events-none opacity-40"></div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-sand border border-gold-light rounded-full text-[10px] font-extrabold uppercase tracking-widest text-ink/80 font-mono mb-4">
            Our Method
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl font-extrabold tracking-tight text-ink font-display">
            {content.processHeader || 'How We Work Together'}
          </h2>
          <p className="mt-4 text-sm sm:text-base text-ink/80 font-sans leading-relaxed">
            {content.processSubtitle || 'A structured, secure, and client-centric consulting approach ensuring that your system architectures are engineered for high scalability and zero disruption.'}
          </p>
          <div className={`h-1 w-16 mx-auto mt-5 rounded-full ${getThemeBgClass()}`}></div>
        </div>

        {/* Interactive Steps Picker */}
        <div className="relative mb-16">
          {/* Connecting Line */}
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gold-light -translate-y-1/2 hidden md:block z-0"></div>
          
          <div className="grid grid-cols-2 md:flex md:justify-between gap-6 relative z-10">
            {processSteps.map((step, idx) => {
              const isActive = activeStepIndex === idx;
              
              return (
                <button
                  key={step.id}
                  onClick={() => setActiveStepIndex(idx)}
                  aria-pressed={isActive}
                  className={`flex flex-col items-center text-center p-4 md:p-0 bg-sand md:bg-transparent rounded-card md:rounded-none border md:border-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 transition-all duration-300 ${
                    isActive 
                      ? 'border-gold-light md:scale-105' 
                      : 'border-gold-light hover:border-gold'
                  }`}
                  id={`process-step-btn-${idx}`}
                >
                  {/* Step Bubble */}
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center border-2 transition-all duration-300 shadow-sm ${
                    isActive 
                      ? `${getThemeBgClass()} border-transparent text-white scale-110 shadow-lg` 
                      : 'bg-white border-gold-light text-ink/80 hover:border-gold'
                  }`}>
                    <StoredIcon name={step.iconName} fallback={HelpCircle} className="h-6 w-6" />
                  </div>

                  {/* Step Info */}
                  <span className="text-[10px] font-mono font-extrabold text-ink/75 uppercase tracking-widest mt-4">
                    Step {step.stepNumber}
                  </span>
                  <span className={`text-xs font-bold font-display mt-1 transition-colors ${
                    isActive ? getThemeTextClass() : 'text-ink'
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
            className="bg-sand backdrop-blur-md rounded-card border border-gold-light p-8 sm:p-12 shadow-md relative overflow-hidden transition-all duration-500 flex flex-col md:flex-row md:items-center gap-8 md:gap-12"
            id="active-process-detail-card"
          >
            {/* Left Accent Glow */}
            <div className={`absolute top-0 left-0 w-2 h-full ${getThemeBgClass()}`}></div>
            
            {/* Step Graphic */}
            <div className={`w-20 h-20 rounded-card flex items-center justify-center shrink-0 border border-gold-light shadow-md ${getThemeLightBgClass()}`}>
              <StoredIcon name={activeStep.iconName} fallback={HelpCircle} className="h-10 w-10" />
            </div>

            {/* Step Description */}
            <div className="space-y-4">
              <span className="text-[10px] font-mono font-extrabold text-ink/75 uppercase tracking-widest">
                Stage {activeStep.stepNumber} in Action
              </span>
              <h3 className="text-2xl font-black text-ink font-display">
                {activeStep.title}
              </h3>
              <p className="text-sm sm:text-base text-ink/80 font-sans leading-relaxed max-w-4xl">
                {activeStep.description}
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
