/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import * as Icons from 'lucide-react';
import { BrandingSettings } from '../types.js';

interface PricingSectionProps {
  branding: BrandingSettings;
  onInquire: (serviceName: string) => void;
  onContactClick: () => void;
}

export default function PricingSection({ branding, onInquire, onContactClick }: PricingSectionProps) {
  
  // Theme Color Class Helpers
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
      case 'emerald': return 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500';
      case 'slate': return 'bg-slate-700 hover:bg-slate-800 focus:ring-slate-500';
      case 'indigo': return 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500';
      case 'violet': return 'bg-violet-600 hover:bg-violet-700 focus:ring-violet-500';
      case 'deepblue':
      default:
        return 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500';
    }
  };

  const getThemeBorderClass = () => {
    switch (branding.themeColor) {
      case 'emerald': return 'border-emerald-500/30';
      case 'slate': return 'border-slate-500/30';
      case 'indigo': return 'border-indigo-500/30';
      case 'violet': return 'border-violet-500/30';
      case 'deepblue':
      default:
        return 'border-blue-500/30';
    }
  };

  const getThemeGlowClass = () => {
    switch (branding.themeColor) {
      case 'emerald': return 'shadow-emerald-500/10 hover:shadow-emerald-500/20';
      case 'slate': return 'shadow-slate-500/10 hover:shadow-slate-500/20';
      case 'indigo': return 'shadow-indigo-500/10 hover:shadow-indigo-500/20';
      case 'violet': return 'shadow-violet-500/10 hover:shadow-violet-500/20';
      case 'deepblue':
      default:
        return 'shadow-blue-500/10 hover:shadow-blue-500/20';
    }
  };

  const getButtonOutlineClass = () => {
    switch (branding.themeColor) {
      case 'emerald': return 'border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300';
      case 'slate': return 'border-slate-200 text-slate-800 hover:bg-slate-50 hover:border-slate-300';
      case 'indigo': return 'border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300';
      case 'violet': return 'border-violet-200 text-violet-700 hover:bg-violet-50 hover:border-violet-300';
      case 'deepblue':
      default:
        return 'border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300';
    }
  };

  const getBadgeClass = () => {
    switch (branding.themeColor) {
      case 'emerald': return 'bg-emerald-600 text-white border-emerald-700/25 shadow-sm';
      case 'slate': return 'bg-slate-800 text-white border-slate-950/25 shadow-sm';
      case 'indigo': return 'bg-indigo-600 text-white border-indigo-700/25 shadow-sm';
      case 'violet': return 'bg-violet-600 text-white border-violet-700/25 shadow-sm';
      case 'deepblue':
      default:
        return 'bg-blue-600 text-white border-blue-700/25 shadow-sm';
    }
  };

  return (
    <div className="bg-slate-50 border-t border-slate-200/60 py-20 sm:py-28 relative overflow-hidden font-sans" id="pricing-page">
      
      {/* Dynamic Animated Tech Background Elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0">
        {/* Large slow-rotating concentric radar circle */}
        <svg className="absolute -top-10 -right-10 w-[400px] h-[400px] opacity-10 text-blue-500" viewBox="0 0 100 100" fill="none">
          <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="0.3" strokeDasharray="3 6">
            <animateTransform attributeName="transform" type="rotate" from="0 50 50" to="360 50 50" dur="90s" repeatCount="indefinite" />
          </circle>
          <circle cx="50" cy="50" r="35" stroke="currentColor" strokeWidth="0.2" strokeDasharray="6 3">
            <animateTransform attributeName="transform" type="rotate" from="360 50 50" to="0 50 50" dur="60s" repeatCount="indefinite" />
          </circle>
          <path d="M50 5 L50 95 M5 50 L95 50" stroke="currentColor" strokeWidth="0.1" strokeDasharray="1 3" />
        </svg>

        {/* Floating circuit node network */}
        <svg className="absolute bottom-20 left-10 w-80 h-80 opacity-15 text-blue-600" viewBox="0 0 100 100" fill="none">
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
        <svg className="absolute top-1/3 left-12 w-48 h-48 opacity-10 text-emerald-500" viewBox="0 0 100 100" fill="none">
          <polygon points="50,15 90,38 90,82 50,95 10,82 10,38" stroke="currentColor" strokeWidth="0.3">
            <animateTransform attributeName="transform" type="rotate" from="0 50 55" to="360 50 55" dur="75s" repeatCount="indefinite" />
          </polygon>
        </svg>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className={`inline-flex items-center space-x-2 px-4 py-1.5 rounded-full border border-slate-200 text-[10px] font-extrabold uppercase tracking-widest font-mono shadow-xs bg-white ${getThemeTextClass()}`}>
            Pricing Plans
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-[42px] font-black tracking-tight text-slate-950 leading-tight font-display">
            Technology Solutions Designed To Grow Your Business
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-sans leading-relaxed max-w-2xl mx-auto">
            From IT support to digital transformation, JLC provides reliable technology solutions that help businesses operate smarter.
          </p>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-24">
          
          {/* Card 1: Free IT Consultation (Visual Highlight for Lead Gen) */}
          <div className="bg-slate-900 border-2 border-amber-500/30 rounded-3xl p-8 shadow-xl shadow-amber-500/5 transition-all duration-300 hover:translate-y-[-8px] hover:shadow-2xl hover:shadow-amber-500/10 flex flex-col justify-between group relative overflow-hidden text-white">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-xl pointer-events-none"></div>
            <div>
              <div className="flex justify-between items-center mb-6">
                <div className="p-3 rounded-2xl bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20">
                  <Icons.MessageSquareCode className="h-6 w-6" />
                </div>
                <span className="bg-amber-500/10 text-amber-300 text-[9px] font-extrabold uppercase font-mono tracking-widest px-2.5 py-1 rounded-md border border-amber-500/20">
                  Free Session
                </span>
              </div>
              <h3 className="text-lg font-bold text-white font-display">Free IT Consultation</h3>
              <p className="text-xs text-slate-400 font-sans leading-relaxed mt-2">
                Start with a conversation. We'll help identify the right technology solution for your business.
              </p>
              
              <div className="my-6">
                <span className="text-3xl font-black text-white font-display">₱0</span>
                <span className="text-xs text-slate-400 font-sans ml-1">/ Session</span>
              </div>
              
              <ul className="space-y-3.5 border-t border-slate-800 pt-6 mb-8">
                {[
                  'Business IT assessment',
                  'Technology recommendations',
                  'Infrastructure discussion',
                  'Project planning',
                  'Solution roadmap'
                ].map((feature, idx) => (
                  <li key={idx} className="flex items-start text-xs text-slate-300 font-sans leading-tight">
                    <Icons.CheckCircle2 className="h-4 w-4 text-amber-500 shrink-0 mr-2 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <button
              onClick={() => onInquire('Free IT Consultation')}
              className="w-full inline-flex items-center justify-center px-6 py-3.5 rounded-full text-xs font-bold uppercase tracking-wider font-display text-slate-950 bg-amber-500 hover:bg-amber-400 focus:ring-2 focus:ring-amber-500 cursor-pointer shadow-lg shadow-amber-500/20 transition-all hover:scale-102"
            >
              Book Free Consultation
              <Icons.ArrowRight className="ml-2 h-4 w-4" />
            </button>
          </div>

          {/* Card 2: Onsite IT Support */}
          <div className="bg-white/80 backdrop-blur-md border border-slate-200/60 rounded-3xl p-8 shadow-xs transition-all duration-300 hover:translate-y-[-8px] hover:shadow-xl flex flex-col justify-between group">
            <div>
              <div className="flex justify-between items-center mb-6">
                <div className="p-3 rounded-2xl bg-slate-100 border border-slate-200 text-slate-700">
                  <Icons.Wrench className="h-6 w-6" />
                </div>
              </div>
              <h3 className="text-lg font-bold text-slate-950 font-display">Onsite IT Support</h3>
              <p className="text-xs text-slate-500 font-sans leading-relaxed mt-2">
                Professional hands-on support when your business needs it.
              </p>
              
              <div className="my-6">
                <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block">Starting at</span>
                <span className="text-2xl font-black text-slate-950 font-display">₱2,500</span>
                <span className="text-xs text-slate-500 font-sans ml-1">/ Visit</span>
                <span className="text-[10px] text-slate-500 block font-sans font-medium mt-1">₱1,000/hour after initial visit</span>
              </div>
              
              <ul className="space-y-3.5 border-t border-slate-100 pt-6 mb-8">
                {[
                  'Hardware troubleshooting',
                  'Network troubleshooting',
                  'Software installation',
                  'Workstation setup',
                  'Printer and peripheral support',
                  'System optimization'
                ].map((feature, idx) => (
                  <li key={idx} className="flex items-start text-xs text-slate-600 font-sans leading-tight">
                    <Icons.Check className="h-4 w-4 text-emerald-500 shrink-0 mr-2 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <button
              onClick={() => onInquire('Onsite IT Support')}
              className={`w-full inline-flex items-center justify-center px-6 py-3.5 rounded-full text-xs font-bold uppercase tracking-wider font-display border cursor-pointer transition-all ${getButtonOutlineClass()}`}
            >
              Request Onsite Support
            </button>
          </div>

          {/* Card 3: Managed IT Services (Recommended Card) */}
          <div className={`bg-white/95 backdrop-blur-md border-2 rounded-3xl p-8 flex flex-col justify-between group relative overflow-hidden transition-all duration-300 hover:translate-y-[-8px] hover:shadow-2xl ${getThemeBorderClass()} ${getThemeGlowClass()}`}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-slate-100 rounded-full blur-xl pointer-events-none"></div>
            <div>
              <div className="flex justify-between items-center mb-6">
                <div className="p-3 rounded-2xl bg-slate-900 text-white">
                  <Icons.Activity className="h-6 w-6" />
                </div>
                <span className={`text-[9px] font-extrabold uppercase font-mono tracking-widest px-2.5 py-1 rounded-md border ${getBadgeClass()}`}>
                  Recommended
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-950 font-display">Managed IT Services</h3>
              <p className="text-xs text-slate-500 font-sans leading-relaxed mt-2">
                Complete IT support designed to keep your business secure and productive.
              </p>
              
              <div className="my-6">
                <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block">Starting at</span>
                <span className="text-2xl font-black text-slate-950 font-display">₱10,000</span>
                <span className="text-xs text-slate-500 font-sans ml-1">/ Month</span>
              </div>
              
              <ul className="space-y-3.5 border-t border-slate-100 pt-6 mb-8">
                {[
                  'Remote IT support',
                  'System monitoring',
                  'Preventive maintenance',
                  'User support',
                  'Backup monitoring',
                  'Monthly IT health report'
                ].map((feature, idx) => (
                  <li key={idx} className="flex items-start text-xs text-slate-600 font-sans leading-tight">
                    <Icons.Check className={`h-4 w-4 shrink-0 mr-2 mt-0.5 ${getThemeTextClass()}`} />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <button
              onClick={() => onInquire('Managed IT Services')}
              className={`w-full inline-flex items-center justify-center px-6 py-3.5 rounded-full text-xs font-bold uppercase tracking-wider font-display text-white shadow-md cursor-pointer transition-all hover:scale-102 ${getThemeBgClass()}`}
            >
              Start Managed Support
            </button>
          </div>

          {/* Card 4: Business Technology Solutions */}
          <div className="bg-white/80 backdrop-blur-md border border-slate-200/60 rounded-3xl p-8 shadow-xs transition-all duration-300 hover:translate-y-[-8px] hover:shadow-xl flex flex-col justify-between group">
            <div>
              <div className="flex justify-between items-center mb-6">
                <div className="p-3 rounded-2xl bg-slate-100 border border-slate-200 text-slate-700">
                  <Icons.Cpu className="h-6 w-6" />
                </div>
              </div>
              <h3 className="text-lg font-bold text-slate-950 font-display">Business Tech Solutions</h3>
              <p className="text-xs text-slate-500 font-sans leading-relaxed mt-2">
                Scalable technology solutions designed around your business.
              </p>
              
              <div className="my-6">
                <span className="text-2xl font-black text-slate-950 font-display">Custom Quote</span>
                <span className="text-xs text-slate-500 font-sans block mt-1">Based on project scope</span>
              </div>
              
              <ul className="space-y-3.5 border-t border-slate-100 pt-6 mb-8">
                {[
                  'Network Infrastructure',
                  'Cloud Solutions',
                  'Cybersecurity',
                  'Website Development',
                  'Business Automation',
                  'System Integration',
                  'Smart Technology Solutions'
                ].map((feature, idx) => (
                  <li key={idx} className="flex items-start text-xs text-slate-600 font-sans leading-tight">
                    <Icons.Check className="h-4 w-4 text-emerald-500 shrink-0 mr-2 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <button
              onClick={() => onInquire('Business Technology Solutions')}
              className={`w-full inline-flex items-center justify-center px-6 py-3.5 rounded-full text-xs font-bold uppercase tracking-wider font-display border cursor-pointer transition-all ${getButtonOutlineClass()}`}
            >
              Discuss Your Project
            </button>
          </div>

        </div>

        {/* Separate Premium Section below pricing: Enterprise & Hospitality Technology */}
        <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl p-8 md:p-12 shadow-2xl relative overflow-hidden mb-20 animate-fade-in">
          {/* Subtle animated neon circuit background lines in dark container */}
          <div className="absolute inset-0 pointer-events-none opacity-20 select-none">
            <svg className="w-full h-full text-blue-500" viewBox="0 0 100 100" preserveAspectRatio="none">
              <path d="M10 10 H90 V90 H10 Z M20 20 H80 V80 H20 Z" stroke="currentColor" strokeWidth="0.25" fill="none" strokeDasharray="3 3" />
              <circle cx="50" cy="50" r="10" stroke="currentColor" strokeWidth="0.3" fill="none">
                <animateTransform attributeName="transform" type="rotate" from="0 50 50" to="-360 50 50" dur="20s" repeatCount="indefinite" />
              </circle>
            </svg>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
            {/* Left Texts */}
            <div className="lg:col-span-7 space-y-4">
              <div className="inline-flex items-center space-x-2 px-3 py-1 bg-blue-950 border border-blue-900 rounded-full text-[9px] font-extrabold uppercase tracking-widest text-blue-400 font-mono">
                Enterprise Suite
              </div>
              <h3 className="text-2xl sm:text-3xl font-black tracking-tight font-display">
                Enterprise & Hospitality Technology
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed font-sans max-w-2xl">
                Specialized technology solutions for organizations that require reliability, scalability, and professional IT management. We help resorts, hotels, and corporate environments modernize operations securely.
              </p>
            </div>

            {/* Right Highlights Grid */}
            <div className="lg:col-span-5 grid grid-cols-2 gap-4">
              {[
                'Hotel & Resort Technology',
                'Enterprise WiFi Deployment',
                'IoT Smart Room Solutions',
                'PMS / System Integration',
                'Infrastructure Design',
                'Digital Transformation'
              ].map((highlight, idx) => (
                <div key={idx} className="flex items-center space-x-2.5 p-3.5 bg-slate-950/60 rounded-xl border border-slate-800/80">
                  <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></div>
                  <span className="text-[11px] font-bold tracking-wide text-slate-200 font-sans">{highlight}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CTA section at the bottom */}
        <div className="bg-white border border-slate-200/60 rounded-3xl p-8 md:p-12 text-center space-y-6 max-w-4xl mx-auto shadow-xs relative overflow-hidden">
          <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-slate-100 rounded-full blur-3xl pointer-events-none"></div>
          <h3 className="text-xl sm:text-2xl font-black text-slate-950 font-display">Need a custom solution?</h3>
          <p className="text-xs sm:text-sm text-slate-500 leading-relaxed font-sans max-w-2xl mx-auto">
            Every business has unique technology requirements. Contact JLC Solutions and let's build the right solution for you.
          </p>
          <div className="pt-2">
            <button
              onClick={onContactClick}
              className={`inline-flex items-center px-8 py-3.5 rounded-full text-xs font-bold uppercase tracking-wider font-display text-white shadow-lg cursor-pointer transition-all hover:scale-102 ${getThemeBgClass()}`}
            >
              Contact JLC Solutions
              <Icons.ArrowRight className="ml-2 h-4 w-4" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
