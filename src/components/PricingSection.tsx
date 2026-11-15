/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Activity, ArrowRight, Check, Cpu, MessageSquareCode, Wrench } from 'lucide-react';
import { BrandingSettings, ContentSettings, DEFAULT_PRICING_CARDS, PricingCard } from '../types.js';

interface PricingSectionProps {
  branding: BrandingSettings;
  content: ContentSettings;
  onInquire: (serviceName: string) => void;
  onContactClick: () => void;
}

export default function PricingSection({ branding, content, onInquire, onContactClick }: PricingSectionProps) {
  
  // Theme Color Class Helpers
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
      case 'emerald': return 'bg-brand-700 hover:bg-brand-800 focus:ring-brand-700';
      case 'slate': return 'bg-brand-800 hover:bg-brand-800 focus:ring-brand-700';
      case 'indigo': return 'bg-brand-700 hover:bg-brand-800 focus:ring-brand-700';
      case 'violet': return 'bg-brand-700 hover:bg-brand-800 focus:ring-brand-700';
      case 'deepblue':
      default:
        return 'bg-brand-700 hover:bg-brand-800 focus:ring-brand-700';
    }
  };

  const getThemeBorderClass = () => {
    switch (branding.themeColor) {
      case 'emerald': return 'border-brand-700/30';
      case 'slate': return 'border-brand-700/30';
      case 'indigo': return 'border-brand-700/30';
      case 'violet': return 'border-brand-700/30';
      case 'deepblue':
      default:
        return 'border-brand-700/30';
    }
  };

  const pricingHeader = content?.pricingHeader || 'Technology Solutions Designed To Grow Your Business';
  const pricingSubtitle = content?.pricingSubtitle || 'From IT support to digital transformation, JLC provides reliable technology solutions that help businesses operate smarter.';
  const pricingEnterpriseTitle = content?.pricingEnterpriseTitle || 'Enterprise & Hospitality Technology';
  const pricingEnterpriseDesc = content?.pricingEnterpriseDesc || 'Specialized technology solutions for organizations that require reliability, scalability, and professional IT management. We help resorts, hotels, and corporate environments modernize operations securely.';
  const pricingEnterpriseHighlights = content?.pricingEnterpriseHighlights
    ? content.pricingEnterpriseHighlights.split(',').map(s => s.trim()).filter(Boolean)
    : [
        'Hotel & Resort Technology',
        'Enterprise WiFi Deployment',
        'IoT Smart Room Solutions',
        'PMS / System Integration',
        'Infrastructure Design',
        'Digital Transformation'
      ];
  const pricingCtaTitle = content?.pricingCtaTitle || 'Need a custom solution?';
  const pricingCtaDesc = content?.pricingCtaDesc || 'Every business has unique technology requirements. Contact JLC Solutions and let\'s build the right solution for you.';
  const pricingCardsList = content?.pricingCards || DEFAULT_PRICING_CARDS;

  const getThemeGlowClass = () => {
    switch (branding.themeColor) {
      case 'emerald': return 'shadow-brand-700/10 hover:shadow-brand-700/10';
      case 'slate': return 'shadow-brand-700/10 hover:shadow-brand-700/10';
      case 'indigo': return 'shadow-brand-700/10 hover:shadow-brand-700/10';
      case 'violet': return 'shadow-brand-700/10 hover:shadow-brand-700/10';
      case 'deepblue':
      default:
        return 'shadow-brand-700/10 hover:shadow-brand-700/10';
    }
  };

  const getButtonOutlineClass = () => {
    switch (branding.themeColor) {
      case 'emerald': return 'border-gold-light text-brand-700 hover:bg-sand hover:border-gold';
      case 'slate': return 'border-gold-light text-ink hover:bg-sand hover:border-gold';
      case 'indigo': return 'border-gold-light text-brand-700 hover:bg-sand hover:border-gold';
      case 'violet': return 'border-gold-light text-brand-700 hover:bg-sand hover:border-gold';
      case 'deepblue':
      default:
        return 'border-gold-light text-brand-700 hover:bg-sand hover:border-gold';
    }
  };

  const getBadgeClass = () => {
    switch (branding.themeColor) {
      case 'emerald': return 'bg-brand-700 text-white border-brand-700/25 shadow-sm';
      case 'slate': return 'bg-brand-800 text-white border-brand-900 shadow-sm';
      case 'indigo': return 'bg-brand-700 text-white border-brand-700/25 shadow-sm';
      case 'violet': return 'bg-brand-700 text-white border-brand-700/25 shadow-sm';
      case 'deepblue':
      default:
        return 'bg-brand-700 text-white border-brand-700/25 shadow-sm';
    }
  };

  return (
    <div className="bg-sand border-t border-gold-light py-20 sm:py-28 relative overflow-hidden font-sans" id="pricing-page">
      
      {/* Dynamic Animated Tech Background Elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0">
        {/* Large slow-rotating concentric radar circle */}
        <svg className="absolute -top-10 -right-10 w-[400px] h-[400px] opacity-10 text-brand-700" viewBox="0 0 100 100" fill="none">
          <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="0.3" strokeDasharray="3 6">
            <animateTransform attributeName="transform" type="rotate" from="0 50 50" to="360 50 50" dur="90s" repeatCount="indefinite" />
          </circle>
          <circle cx="50" cy="50" r="35" stroke="currentColor" strokeWidth="0.2" strokeDasharray="6 3">
            <animateTransform attributeName="transform" type="rotate" from="360 50 50" to="0 50 50" dur="60s" repeatCount="indefinite" />
          </circle>
          <path d="M50 5 L50 95 M5 50 L95 50" stroke="currentColor" strokeWidth="0.1" strokeDasharray="1 3" />
        </svg>

        {/* Floating circuit node network */}
        <svg className="absolute bottom-20 left-10 w-80 h-80 opacity-15 text-brand-700" viewBox="0 0 100 100" fill="none">
          <circle cx="20" cy="30" r="1" fill="currentColor" />
          <circle cx="50" cy="20" r="1" fill="currentColor" />
          <circle cx="80" cy="40" r="1.5" fill="currentColor" />
          <circle cx="40" cy="70" r="1" fill="currentColor" />
          <circle cx="70" cy="85" r="1.2" fill="currentColor" />
          <path d="M20 30 L50 20 M50 20 L80 40 M20 30 L40 70 M40 70 L70 85 M80 40 L70 85" stroke="currentColor" strokeWidth="0.15" />
          <circle cx="0" cy="0" r="0.6" fill="#60a5fa">
            <animateMotion path="M20 30 L50 20" dur="5s" repeatCount="indefinite" />
          </circle>
          <circle cx="0" cy="0" r="0.6" fill="#3b82f6">
            <animateMotion path="M40 70 L70 85" dur="6s" repeatCount="indefinite" />
          </circle>
        </svg>

        {/* Slow floating tech hexagons */}
        <svg className="absolute top-1/3 left-12 w-48 h-48 opacity-10 text-brand-700" viewBox="0 0 100 100" fill="none">
          <polygon points="50,15 90,38 90,82 50,95 10,82 10,38" stroke="currentColor" strokeWidth="0.3">
            <animateTransform attributeName="transform" type="rotate" from="0 50 55" to="360 50 55" dur="75s" repeatCount="indefinite" />
          </polygon>
        </svg>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className={`inline-flex items-center space-x-2 px-4 py-1.5 rounded-full border border-gold-light text-[10px] font-extrabold uppercase tracking-widest font-mono shadow-xs bg-white ${getThemeTextClass()}`}>
            Pricing Plans
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl lg:text-[42px] font-black tracking-tight text-ink leading-tight font-display">
            {pricingHeader}
          </h2>
          <p className="text-xs sm:text-sm text-ink/80 font-sans leading-relaxed max-w-2xl mx-auto">
            {pricingSubtitle}
          </p>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-24">
          {pricingCardsList.map((card, idx) => {
            const isFreeConsultation = card.id === 'pc1';
            const isRecommended = card.id === 'pc3';
            
            const renderCardIcon = () => {
              switch (card.id) {
                case 'pc1':
                  return <MessageSquareCode className="h-6 w-6" />;
                case 'pc2':
                  return <Wrench className="h-6 w-6" />;
                case 'pc3':
                  return <Activity className="h-6 w-6" />;
                case 'pc4':
                default:
                  return <Cpu className="h-6 w-6" />;
              }
            };

            if (isRecommended) {
              return (
                <div key={card.id} className={`bg-white/95 backdrop-blur-md border-2 rounded-card p-8 flex flex-col justify-between group relative overflow-hidden transition-all duration-300 hover:translate-y-[-8px] hover:shadow-2xl ${getThemeBorderClass()} ${getThemeGlowClass()}`}>
                  <div className="absolute top-0 right-0 w-32 h-32 bg-sand rounded-full blur-xl pointer-events-none z-0"></div>
                  <div className="relative z-10 flex flex-col justify-between h-full flex-grow">
                    <div>
                      <div className="flex justify-between items-center mb-6">
                        <div className="p-3 rounded-card bg-brand-900 text-white">
                          {renderCardIcon()}
                        </div>
                        <span className={`text-[9px] font-extrabold uppercase font-mono tracking-widest px-2.5 py-1 rounded-md border ${getBadgeClass()}`}>
                          Recommended
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-ink font-display">{card.title}</h3>
                      <p className="text-xs text-ink/80 font-sans leading-relaxed mt-2">
                        {card.description}
                      </p>
                      
                      <div className="my-6">
                        <span className="text-[10px] text-ink/75 font-mono uppercase tracking-wider block">Starting at</span>
                        <span className="text-2xl font-black text-ink font-display">{card.price}</span>
                        <span className="text-xs text-ink/80 font-sans ml-1">{card.period}</span>
                      </div>
                      
                      <ul className="space-y-3.5 border-t border-gold-light pt-6 mb-8">
                        {card.features.map((feature, fIdx) => (
                          <li key={fIdx} className="flex items-start text-xs text-ink/80 font-sans leading-tight">
                            <Check className={`h-4 w-4 shrink-0 mr-2 mt-0.5 ${getThemeTextClass()}`} />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    
                    <button
                      onClick={() => onInquire(card.title)}
                      className={`w-full inline-flex items-center justify-center px-6 py-3.5 rounded-full text-xs font-bold uppercase tracking-wider font-display text-white shadow-md cursor-pointer transition-all hover:scale-102 ${getThemeBgClass()}`}
                    >
                      {card.buttonText}
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div key={card.id} className="bg-white/80 backdrop-blur-md border border-gold-light rounded-card p-8 shadow-xs transition-all duration-300 hover:translate-y-[-8px] hover:shadow-xl flex flex-col justify-between group relative overflow-hidden">
                {isFreeConsultation && (
                  <div className="absolute top-0 right-0 w-32 h-32 bg-sand rounded-full blur-xl pointer-events-none z-0"></div>
                )}
                <div className="relative z-10 flex flex-col justify-between h-full flex-grow">
                  <div>
                    <div className="flex justify-between items-center mb-6">
                      <div className="p-3 rounded-card bg-sand border border-gold-light text-ink">
                        {renderCardIcon()}
                      </div>
                      {isFreeConsultation && (
                        <span className="bg-brand-900 text-white text-[9px] font-extrabold uppercase font-mono tracking-widest px-2.5 py-1 rounded-md">
                          Lead Offer
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-bold text-ink font-display">{card.title}</h3>
                    <p className="text-xs text-ink/80 font-sans leading-relaxed mt-2">
                      {card.description}
                    </p>
                    
                    <div className="my-6">
                      {card.price.toLowerCase().includes('quote') ? (
                        <>
                          <span className="text-2xl font-black text-ink font-display">{card.price}</span>
                          <span className="text-xs text-ink/80 font-sans block mt-1">{card.period}</span>
                        </>
                      ) : (
                        <>
                          {card.title.toLowerCase().includes('onsite') && (
                            <span className="text-[10px] text-ink/75 font-mono uppercase tracking-wider block">Starting at</span>
                          )}
                          <span className="text-3xl font-black text-ink font-display">{card.price}</span>
                          <span className="text-xs text-ink/80 font-sans ml-1">{card.period}</span>
                        </>
                      )}
                    </div>
                    
                    <ul className="space-y-3.5 border-t border-gold-light pt-6 mb-8">
                      {card.features.map((feature, fIdx) => (
                        <li key={fIdx} className="flex items-start text-xs text-ink/80 font-sans leading-tight">
                          <Check className="h-4 w-4 text-brand-700 shrink-0 mr-2 mt-0.5" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <button
                    onClick={() => onInquire(card.title)}
                    className={isFreeConsultation
                      ? `w-full inline-flex items-center justify-center px-6 py-3.5 rounded-full text-xs font-bold uppercase tracking-wider font-display text-white shadow-md cursor-pointer transition-all hover:scale-102 ${getThemeBgClass()}`
                      : `w-full inline-flex items-center justify-center px-6 py-3.5 rounded-full text-xs font-bold uppercase tracking-wider font-display border cursor-pointer transition-all ${getButtonOutlineClass()}`
                    }
                  >
                    {card.buttonText}
                    {isFreeConsultation && <ArrowRight className="ml-2 h-4 w-4" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Separate Premium Section below pricing: Enterprise & Hospitality Technology */}
        <div className="bg-brand-900 border border-brand-800 text-white rounded-card p-8 md:p-12 shadow-2xl relative overflow-hidden mb-20 animate-fade-in">
          {/* Subtle animated neon circuit background lines in dark container */}
          <div className="absolute inset-0 pointer-events-none opacity-20 select-none">
            <svg className="w-full h-full text-gold-light" viewBox="0 0 100 100" preserveAspectRatio="none">
              <path d="M10 10 H90 V90 H10 Z M20 20 H80 V80 H20 Z" stroke="currentColor" strokeWidth="0.25" fill="none" strokeDasharray="3 3" />
              <circle cx="50" cy="50" r="10" stroke="currentColor" strokeWidth="0.3" fill="none">
                <animateTransform attributeName="transform" type="rotate" from="0 50 50" to="-360 50 50" dur="20s" repeatCount="indefinite" />
              </circle>
            </svg>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
            {/* Left Texts */}
            <div className="lg:col-span-7 space-y-4">
              <div className="inline-flex items-center space-x-2 px-3 py-1 bg-brand-900 border border-gold rounded-full text-[9px] font-extrabold uppercase tracking-widest text-gold-light font-mono">
                Enterprise Suite
              </div>
              <h3 className="text-2xl sm:text-3xl font-black tracking-tight font-display">
                {pricingEnterpriseTitle}
              </h3>
              <p className="text-xs sm:text-sm text-white/75 leading-relaxed font-sans max-w-2xl">
                {pricingEnterpriseDesc}
              </p>
            </div>

            {/* Right Highlights Grid */}
            <div className="lg:col-span-5 grid grid-cols-2 gap-4">
              {pricingEnterpriseHighlights.map((highlight, idx) => (
                <div key={idx} className="flex items-center space-x-2.5 p-3.5 bg-brand-900/60 rounded-xl border border-brand-800/80">
                  <div className="h-2 w-2 rounded-full bg-brand-700 animate-pulse"></div>
                  <span className="text-[11px] font-bold tracking-wide text-white/80 font-sans">{highlight}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CTA section at the bottom */}
        <div className="bg-white border border-gold-light rounded-card p-8 md:p-12 text-center space-y-6 max-w-4xl mx-auto shadow-xs relative overflow-hidden">
          <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-sand rounded-full blur-3xl pointer-events-none"></div>
          <h3 className="text-xl sm:text-2xl font-black text-ink font-display">{pricingCtaTitle}</h3>
          <p className="text-xs sm:text-sm text-ink/80 leading-relaxed font-sans max-w-2xl mx-auto">
            {pricingCtaDesc}
          </p>
          <div className="pt-2">
            <button
              onClick={onContactClick}
              className={`inline-flex items-center px-8 py-3.5 rounded-full text-xs font-bold uppercase tracking-wider font-display text-white shadow-lg cursor-pointer transition-all hover:scale-102 ${getThemeBgClass()}`}
            >
              Contact JLC Solutions
              <ArrowRight className="ml-2 h-4 w-4" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
