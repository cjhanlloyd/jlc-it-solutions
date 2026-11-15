/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ArrowRight, Check, CheckCircle } from 'lucide-react';
import { StoredIcon } from './StoredIcon';
import { ContentSettings, BrandingSettings, DEFAULT_WHY_PROMISES } from '../types.js';

interface WhyChooseUsProps {
  content: ContentSettings;
  branding: BrandingSettings;
  onInquireClick: () => void;
}

export default function WhyChooseUs({ content, branding, onInquireClick }: WhyChooseUsProps) {
  
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

  const getThemeBgClass = () => {
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

  const getButtonBgClass = () => {
    switch (branding.themeColor) {
      case 'emerald': return 'bg-brand-700 hover:bg-brand-800';
      case 'slate': return 'bg-brand-800 hover:bg-brand-800';
      case 'indigo': return 'bg-brand-700 hover:bg-brand-800';
      case 'violet': return 'bg-brand-700 hover:bg-brand-800';
      case 'deepblue':
      default:
        return 'bg-brand-700 hover:bg-brand-800';
    }
  };

  return (
    <div className="bg-white border-t border-gold-light py-20 sm:py-28 relative overflow-hidden font-sans" id="why-choose-us-section">
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-brand-50 rounded-full blur-3xl pointer-events-none"></div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-sand border border-gold-light rounded-full text-[10px] font-extrabold uppercase tracking-widest text-ink/80 font-mono">
            Core Values
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl font-extrabold tracking-tight text-ink font-display">
            Why Choose JLC Solutions
          </h2>
          <p className="text-xs sm:text-sm text-ink/80 font-sans leading-relaxed max-w-2xl mx-auto">
            {content.whyChooseUsText}
          </p>
        </div>

        {/* Split Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          
          {/* Left Column: Credentials / Trust assurances */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-brand-900 rounded-card p-8 border border-brand-700 text-white relative overflow-hidden shadow-xl">
              <div className="absolute -top-10 -right-10 w-36 h-36 bg-gold/10 rounded-full blur-2xl pointer-events-none"></div>
              
              <div className="relative z-10 space-y-6">
                <span className="text-[9px] uppercase font-mono font-bold tracking-wider text-white/85 bg-brand-900 border border-brand-800 px-2.5 py-1 rounded-md">Our Promise</span>
                <h3 className="text-xl font-bold tracking-tight font-display text-white">{content.whyChooseUsPromiseTitle || 'Stable Future Engineering Commitments'}</h3>
                <p className="text-xs text-white/75 font-sans leading-relaxed">
                  {content.whyChooseUsPromiseDesc || 'We formulate technology options centered strictly around integrity, performance specifications, and standard protocol compliance.'}
                </p>

                <div className="space-y-4 pt-4 border-t border-brand-700">
                  {(content.whyChooseUsPromises || DEFAULT_WHY_PROMISES).map((prom) => (
                    <div key={prom.id} className="flex items-start space-x-3">
                      <CheckCircle className={`h-5 w-5 shrink-0 text-gold-light`} />
                      <div>
                        <span className="text-xs font-bold block text-white/80">{prom.title}</span>
                        <span className="text-[11px] text-white/75 block leading-normal mt-0.5">{prom.description}</span>
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
              return (
                <div 
                  key={point.id} 
                  className="flex items-start space-x-4 p-5 rounded-card border border-gold-light bg-sand hover:bg-white hover:border-gold hover:shadow-xs transition-all duration-300 group"
                  id={`why-point-${point.id}`}
                >
                  <div className="w-10 h-10 bg-brand-900 flex items-center justify-center transform rotate-45 shrink-0 shadow-xs border border-brand-800 group-hover:rotate-90 transition-transform duration-500">
                    <StoredIcon name={point.iconName} fallback={Check} className="h-4.5 w-4.5 text-white transform -rotate-45" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-ink font-display transition-colors group-hover:text-brand-700">{point.title}</h3>
                    <p className="text-xs text-ink/80 font-sans leading-relaxed">{point.description}</p>
                  </div>
                </div>
              );
            })}
          </div>

        </div>

        {/* Closing trust message with CTA */}
        <div className="mt-24 bg-brand-900 rounded-card p-8 sm:p-12 border border-brand-700 text-center max-w-4xl mx-auto relative overflow-hidden shadow-2xl">
          <div className="absolute -top-12 -right-12 w-40 h-40 bg-brand-700/10 rounded-full blur-2xl pointer-events-none"></div>
          <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-brand-900/50 rounded-full pointer-events-none"></div>
          
          <div className="relative z-10">
            <h4 className="text-xl sm:text-2xl font-bold text-white font-display mb-3">{content.whyChooseUsCtaTitle || 'Need a tailor-made technological solution?'}</h4>
            <p className="text-xs sm:text-sm text-white/85 font-sans max-w-2xl mx-auto mb-8 leading-relaxed">
              {content.whyChooseUsCtaDesc || 'We are dedicated to building long-term, stable technical systems. No matter how simple or complex your project, we will provide a realistic estimate and deliver standard-compliant, pristine execution.'}
            </p>
            <button
              onClick={onInquireClick}
              className={`inline-flex items-center px-8 py-3.5 rounded-full text-xs font-bold uppercase tracking-wider font-display text-white shadow-lg cursor-pointer transition-all hover:scale-102 ${getButtonBgClass()}`}
              id="why-cta-quote"
            >
              Start Your Inquiry
              <ArrowRight className="ml-2.5 h-4 w-4" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
