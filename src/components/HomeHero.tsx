/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import * as Icons from 'lucide-react';
import { BrandingSettings, ContentSettings } from '../types.js';

interface HomeHeroProps {
  branding: BrandingSettings;
  content: ContentSettings;
  onExploreServices: () => void;
  onGetQuote: () => void;
}

export default function HomeHero({ branding, content, onExploreServices, onGetQuote }: HomeHeroProps) {
  
  // Dynamic Theme Colors
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

  const getButtonBgClass = () => {
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

  const getButtonBorderClass = () => {
    switch (branding.themeColor) {
      case 'emerald': return 'border-emerald-200 text-emerald-700 hover:bg-emerald-50';
      case 'slate': return 'border-slate-200 text-slate-800 hover:bg-slate-50';
      case 'indigo': return 'border-indigo-200 text-indigo-700 hover:bg-indigo-50';
      case 'violet': return 'border-violet-200 text-violet-700 hover:bg-violet-50';
      case 'deepblue':
      default:
        return 'border-blue-200 text-blue-700 hover:bg-blue-50';
    }
  };

  const getBadgeClass = () => {
    switch (branding.themeColor) {
      case 'emerald': return 'bg-emerald-50 text-emerald-800 border-emerald-100';
      case 'slate': return 'bg-slate-100 text-slate-800 border-slate-200';
      case 'indigo': return 'bg-indigo-50 text-indigo-800 border-indigo-100';
      case 'violet': return 'bg-violet-50 text-violet-800 border-violet-100';
      case 'deepblue':
      default:
        return 'bg-blue-50 text-blue-800 border-blue-100';
    }
  };

  const getGlowingOrbClass = () => {
    switch (branding.themeColor) {
      case 'emerald': return 'bg-emerald-400/10';
      case 'slate': return 'bg-slate-400/10';
      case 'indigo': return 'bg-indigo-400/10';
      case 'violet': return 'bg-violet-400/10';
      case 'deepblue':
      default:
        return 'bg-blue-400/10';
    }
  };

  return (
    <div className="relative overflow-hidden bg-slate-50 py-24 sm:py-32" id="home-hero-section">
      {/* Background Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-25"></div>
      
      {/* Glowing Orb Overlay */}
      <div className={`absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-3xl opacity-50 pointer-events-none transition-colors duration-500 ${getGlowingOrbClass()}`}></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="lg:grid lg:grid-cols-12 lg:gap-16 items-center">
          {/* Left Text Col */}
          <div className="space-y-8 lg:col-span-7">
            <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full border border-slate-200 text-xs font-bold uppercase tracking-widest font-mono shadow-xs bg-white" id="hero-badge">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className={getThemeTextClass()}>{content.heroBadge || 'Ready for Inquiries'}</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-[54px] font-black tracking-tight text-slate-950 leading-[1.1] font-display" id="hero-title">
              {content.heroTitle}
            </h1>

            <p className="text-sm sm:text-base text-slate-500 font-sans leading-relaxed max-w-2xl" id="hero-subtitle">
              {content.heroSubtitle}
            </p>

            <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
              <button
                onClick={onGetQuote}
                className={`inline-flex items-center justify-center px-8 py-4 rounded-full text-xs font-bold uppercase tracking-wider font-display text-white shadow-xl shadow-blue-500/20 transition-all hover:scale-102 hover:shadow-2xl cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-offset-2 ${getButtonBgClass()}`}
                id="hero-cta-get-quote"
              >
                Inquire & Get Quote
                <Icons.ArrowRight className="ml-2.5 h-4 w-4" />
              </button>
              <button
                onClick={onExploreServices}
                className="inline-flex items-center justify-center px-8 py-4 rounded-full text-xs font-bold uppercase tracking-wider font-display border border-slate-200 bg-white text-slate-800 shadow-sm transition-all hover:bg-slate-50 cursor-pointer"
                id="hero-cta-explore"
              >
                Explore Services
              </button>
            </div>

            {/* Quick trust assurances */}
            <div className="pt-8 border-t border-slate-200/80 grid grid-cols-3 gap-6">
              <div className="flex items-center space-x-2.5">
                <div className="p-1 rounded-sm bg-slate-100 border border-slate-200">
                  <Icons.ShieldCheck className="h-4 w-4 text-slate-700" />
                </div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 font-mono">Secure Process</span>
              </div>
              <div className="flex items-center space-x-2.5">
                <div className="p-1 rounded-sm bg-slate-100 border border-slate-200">
                  <Icons.Sparkles className="h-4 w-4 text-slate-700" />
                </div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 font-mono">Honest Consulting</span>
              </div>
              <div className="flex items-center space-x-2.5">
                <div className="p-1 rounded-sm bg-slate-100 border border-slate-200">
                  <Icons.Clock className="h-4 w-4 text-slate-700" />
                </div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 font-mono">Fast Response</span>
              </div>
            </div>
          </div>

          {/* Right Banner Image Col */}
          <div className="mt-16 lg:mt-0 lg:col-span-5 relative">
            <div className="relative mx-auto max-w-md lg:max-w-none">
              
              {/* Glowing Background Glow behind the mockup */}
              <div className={`absolute -inset-4 rounded-3xl blur-2xl opacity-40 transition-colors duration-500 ${getGlowingOrbClass()}`}></div>
              
              {/* Main Card Container */}
              <div className="relative bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-800 space-y-6">
                
                {/* Mockup Header bar */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div className="flex items-center space-x-2">
                    <span className="h-3 w-3 rounded-full bg-red-500"></span>
                    <span className="h-3 w-3 rounded-full bg-yellow-500"></span>
                    <span className="h-3 w-3 rounded-full bg-green-500"></span>
                    <span className="text-[10px] text-slate-500 font-mono pl-2">infrastructure_monitor.log</span>
                  </div>
                  <span className="inline-flex items-center text-[9px] uppercase font-mono font-bold text-emerald-500 bg-emerald-950/60 border border-emerald-900/60 px-2 py-0.5 rounded">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse"></span> SYSTEM OK
                  </span>
                </div>

                {/* Simulated Telemetry Cards */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800/80 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">SECURE WAN</span>
                      <Icons.Cpu className="h-4 w-4 text-blue-500" />
                    </div>
                    <span className="text-base font-bold text-white block tracking-tight font-display">99.9% Uptime</span>
                    <span className="text-[9px] text-slate-500 font-mono block">SLA Protection Active</span>
                  </div>
                  <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800/80 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">CYBER GUARD</span>
                      <Icons.ShieldCheck className="h-4 w-4 text-emerald-500" />
                    </div>
                    <span className="text-base font-bold text-white block tracking-tight font-display">Active Shield</span>
                    <span className="text-[9px] text-slate-500 font-mono block">SOC2 Compliant Policy</span>
                  </div>
                </div>

                {/* Banner Image / Vector Mockup */}
                <div className="relative aspect-video bg-slate-950 rounded-2xl overflow-hidden border border-slate-800">
                  {content.bannerImageUrl ? (
                    <img
                      src={content.bannerImageUrl}
                      alt="Professional IT Consulting & Strategy"
                      className="w-full h-full object-cover opacity-80"
                      referrerPolicy="no-referrer"
                      id="hero-banner-img"
                    />
                  ) : (
                    <div className="w-full h-full bg-slate-950 flex flex-col items-center justify-center space-y-2">
                      <Icons.Workflow className="h-8 w-8 text-slate-700 animate-pulse" />
                      <span className="text-[10px] text-slate-500 font-mono">Simulating Infrastructure Data Links...</span>
                    </div>
                  )}
                  {/* Glass overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent"></div>
                  <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold text-slate-400 font-mono uppercase">Operational Handover</span>
                      <span className="text-xs font-bold text-white block font-display">Completed Server Infrastructure</span>
                    </div>
                    <Icons.Activity className="h-5 w-5 text-blue-500 animate-pulse" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
