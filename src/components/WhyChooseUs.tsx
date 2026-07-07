/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import * as Icons from 'lucide-react';
import { ContentSettings, BrandingSettings, DEFAULT_WHY_PROMISES } from '../types.js';

interface WhyChooseUsProps {
  content: ContentSettings;
  branding: BrandingSettings;
  onInquireClick: () => void;
}

export default function WhyChooseUs({ content, branding, onInquireClick }: WhyChooseUsProps) {
  
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

  const getThemeBgClass = () => {
    switch (branding.themeColor) {
      case 'emerald': return 'bg-emerald-50 text-emerald-700';
      case 'slate': return 'bg-slate-100 text-slate-800';
      case 'indigo': return 'bg-indigo-50 text-indigo-700';
      case 'violet': return 'bg-violet-50 text-violet-700';
      case 'deepblue':
      default:
        return 'bg-blue-50 text-blue-700';
    }
  };

  const getButtonBgClass = () => {
    switch (branding.themeColor) {
      case 'emerald': return 'bg-emerald-600 hover:bg-emerald-700';
      case 'slate': return 'bg-slate-700 hover:bg-slate-800';
      case 'indigo': return 'bg-indigo-600 hover:bg-indigo-700';
      case 'violet': return 'bg-violet-600 hover:bg-violet-700';
      case 'deepblue':
      default:
        return 'bg-blue-600 hover:bg-blue-700';
    }
  };

  return (
    <div className="bg-white border-t border-slate-200/60 py-20 sm:py-28 relative overflow-hidden font-sans" id="why-choose-us-section">
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-100/10 rounded-full blur-3xl pointer-events-none"></div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-slate-50 border border-slate-200 rounded-full text-[10px] font-extrabold uppercase tracking-widest text-slate-500 font-mono">
            Core Values
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-950 font-display">
            Why Choose JLC IT Solutions
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-sans leading-relaxed max-w-2xl mx-auto">
            {content.whyChooseUsText}
          </p>
        </div>

        {/* Split Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          
          {/* Left Column: Credentials / Trust assurances */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-slate-950 rounded-3xl p-8 border border-slate-900 text-white relative overflow-hidden shadow-xl">
              <div className="absolute -top-10 -right-10 w-36 h-36 bg-blue-655/10 rounded-full blur-2xl pointer-events-none"></div>
              
              <div className="relative z-10 space-y-6">
                <span className="text-[9px] uppercase font-mono font-bold tracking-wider text-slate-500 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-md">Our Promise</span>
                <h3 className="text-xl font-bold tracking-tight font-display text-white">{content.whyChooseUsPromiseTitle || 'Stable Future Engineering Commitments'}</h3>
                <p className="text-xs text-slate-400 font-sans leading-relaxed">
                  {content.whyChooseUsPromiseDesc || 'We formulate technology options centered strictly around integrity, performance specifications, and standard protocol compliance.'}
                </p>

                <div className="space-y-4 pt-4 border-t border-slate-900">
                  {(content.whyChooseUsPromises || DEFAULT_WHY_PROMISES).map((prom) => (
                    <div key={prom.id} className="flex items-start space-x-3">
                      <Icons.CheckCircle className={`h-5 w-5 shrink-0 ${getThemeTextClass()}`} />
                      <div>
                        <span className="text-xs font-bold block text-slate-200">{prom.title}</span>
                        <span className="text-[11px] text-slate-400 block leading-normal mt-0.5">{prom.description}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Dynamic feature cards accordion style */}
          <div className="lg:col-span-7 space-y-4">
            {content.whyChooseUsPoints.map((point) => {
              const IconComponent = (Icons as any)[point.iconName] || Icons.Check;
              return (
                <div 
                  key={point.id} 
                  className="flex items-start space-x-4 p-5 rounded-2xl border border-slate-200/80 bg-slate-50/50 hover:bg-white hover:border-slate-300 hover:shadow-xs transition-all duration-300 group"
                  id={`why-point-${point.id}`}
                >
                  <div className="w-10 h-10 bg-slate-950 flex items-center justify-center transform rotate-45 shrink-0 shadow-xs border border-slate-800 group-hover:rotate-90 transition-transform duration-500">
                    <IconComponent className="h-4.5 w-4.5 text-white transform -rotate-45" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-slate-950 font-display transition-colors group-hover:text-blue-600">{point.title}</h3>
                    <p className="text-xs text-slate-500 font-sans leading-relaxed">{point.description}</p>
                  </div>
                </div>
              );
            })}
          </div>

        </div>

        {/* Closing trust message with CTA */}
        <div className="mt-24 bg-slate-950 rounded-3xl p-8 sm:p-12 border border-slate-900 text-center max-w-4xl mx-auto relative overflow-hidden shadow-2xl">
          <div className="absolute -top-12 -right-12 w-40 h-40 bg-blue-600/10 rounded-full blur-2xl pointer-events-none"></div>
          <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-slate-900/50 rounded-full pointer-events-none"></div>
          
          <div className="relative z-10">
            <h4 className="text-xl sm:text-2xl font-bold text-white font-display mb-3">{content.whyChooseUsCtaTitle || 'Need a tailor-made technological solution?'}</h4>
            <p className="text-xs sm:text-sm text-slate-450 font-sans max-w-2xl mx-auto mb-8 leading-relaxed">
              {content.whyChooseUsCtaDesc || 'We are dedicated to building long-term, stable technical systems. No matter how simple or complex your project, we will provide a realistic estimate and deliver standard-compliant, pristine execution.'}
            </p>
            <button
              onClick={onInquireClick}
              className={`inline-flex items-center px-8 py-3.5 rounded-full text-xs font-bold uppercase tracking-wider font-display text-white shadow-lg cursor-pointer transition-all hover:scale-102 ${getButtonBgClass()}`}
              id="why-cta-quote"
            >
              Start Your Inquiry
              <Icons.ArrowRight className="ml-2.5 h-4 w-4" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
