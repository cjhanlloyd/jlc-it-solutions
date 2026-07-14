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

  const getGlowingOrbBg = (index: number) => {
    const isPrimary = index === 0;
    switch (branding.themeColor) {
      case 'emerald': return isPrimary ? 'bg-emerald-400/20' : 'bg-teal-400/15';
      case 'slate': return isPrimary ? 'bg-slate-400/20' : 'bg-zinc-400/15';
      case 'indigo': return isPrimary ? 'bg-indigo-400/20' : 'bg-purple-400/15';
      case 'violet': return isPrimary ? 'bg-violet-400/20' : 'bg-fuchsia-400/15';
      case 'deepblue':
      default:
        return isPrimary ? 'bg-blue-400/20' : 'bg-cyan-400/15';
    }
  };

  return (
    <div className="relative overflow-hidden bg-slate-50 py-24 sm:py-32" id="home-hero-section">
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes floatOrb1 {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.95); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        @keyframes floatOrb2 {
          0% { transform: translate(0px, 0px) scale(1); }
          50% { transform: translate(-40px, 40px) scale(1.05); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        @keyframes pulseGrid {
          0%, 100% { opacity: 0.15; }
          50% { opacity: 0.28; }
        }
        .animate-orb1 { animation: floatOrb1 20s infinite ease-in-out; }
        .animate-orb2 { animation: floatOrb2 25s infinite ease-in-out; }
        .animate-tech-grid { animation: pulseGrid 8s infinite ease-in-out; }
        @keyframes flagDrift {
          0% { transform: translate(0px, 0px) rotate(-1deg); }
          50% { transform: translate(25px, -30px) rotate(1.5deg); }
          100% { transform: translate(0px, 0px) rotate(-1deg); }
        }
        .animate-flag-drift { animation: flagDrift 22s infinite ease-in-out; }
      `}} />

      {/* Dynamic Animated Tech Background Elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0">
        {/* Stylized Floating Philippines Flag Background Element */}
        <div className="absolute top-[18%] left-[4%] md:left-[7%] w-36 h-24 md:w-52 md:h-32 opacity-[0.045] select-none pointer-events-none animate-flag-drift will-change-transform transform-gpu" style={{ filter: 'blur(0.4px)' }}>
          <svg className="w-full h-full" viewBox="0 0 900 600" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <filter id="flagWavingFilter" x="-10%" y="-10%" width="120%" height="120%">
                <feTurbulence type="fractalNoise" baseFrequency="0.015 0.03" numOctaves="2" result="noise">
                  <animate attributeName="baseFrequency" values="0.015 0.03; 0.022 0.048; 0.015 0.03" dur="10s" repeatCount="indefinite" />
                </feTurbulence>
                <feDisplacementMap in="SourceGraphic" in2="noise" scale="22" xChannelSelector="R" yChannelSelector="G" />
              </filter>
              
              {/* Dynamic Wave Shading for 3D Folds */}
              <linearGradient id="waveShading" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.22" />
                <stop offset="20%" stopColor="#000000" stopOpacity="0.26" />
                <stop offset="40%" stopColor="#ffffff" stopOpacity="0.18" />
                <stop offset="60%" stopColor="#000000" stopOpacity="0.26" />
                <stop offset="80%" stopColor="#ffffff" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#000000" stopOpacity="0.26" />
                <animate attributeName="x1" values="0%; -50%; 0%" dur="6s" repeatCount="indefinite" />
                <animate attributeName="x2" values="100%; 50%; 100%" dur="6s" repeatCount="indefinite" />
              </linearGradient>
            </defs>
            <g filter="url(#flagWavingFilter)">
              <rect width="900" height="300" fill="#0038a8" />
              <rect y="300" width="900" height="300" fill="#ce1126" />
              <polygon points="0,0 0,600 519.6,300" fill="#ffffff" />
              <circle cx="173.2" cy="300" r="50" fill="#fcd116" />
              {/* Stars */}
              <path d="M40,50 L45,65 L60,65 L48,75 L52,90 L40,80 L28,90 L32,75 L20,65 L35,65 Z" fill="#fcd116" />
              <path d="M40,550 L45,565 L60,565 L48,575 L52,590 L40,580 L28,590 L32,575 L20,565 L35,565 Z" fill="#fcd116" />
              <path d="M460,300 L465,315 L480,315 L468,325 L472,340 L460,330 L448,340 L452,325 L440,315 L455,315 Z" fill="#fcd116" />
              
              {/* 3D Shading Overlay */}
              <rect width="900" height="600" fill="url(#waveShading)" style={{ mixBlendMode: 'overlay' }} />
            </g>
          </svg>
        </div>

        {/* Aurora Glow Orbs - Optimized sizes for mobile */}
        <div className={`absolute top-10 left-10 w-48 h-48 md:w-[350px] md:h-[350px] rounded-full blur-3xl transition-colors duration-500 animate-orb1 ${getGlowingOrbBg(0)}`}></div>
        <div className={`absolute bottom-10 right-10 w-64 h-64 md:w-[400px] md:h-[400px] rounded-full blur-3xl transition-colors duration-500 animate-orb2 ${getGlowingOrbBg(1)}`}></div>

        {/* Digital Grid pattern */}
        <svg className="absolute inset-0 w-full h-full text-slate-300/35 animate-tech-grid" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="dotGrid" width="30" height="30" patternUnits="userSpaceOnUse">
              <circle cx="15" cy="15" r="1" fill="currentColor" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dotGrid)" />
        </svg>

        {/* Animated Cyber Circuits - Hidden on mobile for peak performance */}
        <svg className="hidden sm:block absolute inset-0 w-full h-full opacity-30 text-blue-500" viewBox="0 0 1200 800" fill="none">
          <defs>
            <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.8" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0.1" />
            </linearGradient>
          </defs>
          
          <path d="M-50,200 L300,200 L400,300 L700,300 L800,200 L1300,200" stroke="url(#grad1)" strokeWidth="1.5" strokeDasharray="8 4" />
          <path d="M150,-50 L150,150 L250,250 L250,550 L350,650 L350,850" stroke="url(#grad1)" strokeWidth="1" />
          <path d="M950,850 L950,600 L800,450 L500,450 L400,550 L-50,550" stroke="url(#grad1)" strokeWidth="1.2" strokeDasharray="5 5" />
          
          <circle cx="0" cy="0" r="3" fill="#60a5fa" className="shadow-lg">
            <animateMotion path="M-50,200 L300,200 L400,300 L700,300 L800,200 L1300,200" dur="12s" repeatCount="indefinite" />
          </circle>
          <circle cx="0" cy="0" r="2.5" fill="#3b82f6">
            <animateMotion path="M150,-50 L150,150 L250,250 L250,550 L350,650 L350,850" dur="9s" repeatCount="indefinite" />
          </circle>
          <circle cx="0" cy="0" r="3" fill="#10b981">
            <animateMotion path="M950,850 L950,600 L800,450 L500,450 L400,550 L-50,550" dur="15s" repeatCount="indefinite" />
          </circle>
        </svg>

        {/* Dynamic Glowing Rings / Radial Sweep - Rescaled for mobile */}
        <svg className="absolute -top-20 -right-20 w-72 h-72 md:w-[600px] md:h-[600px] opacity-20 text-blue-600" viewBox="0 0 200 200" fill="none">
          <circle cx="100" cy="100" r="90" stroke="currentColor" strokeWidth="0.3" strokeDasharray="6 3">
            <animateTransform attributeName="transform" type="rotate" from="0 100 100" to="360 100 100" dur="90s" repeatCount="indefinite" />
          </circle>
          <circle cx="100" cy="100" r="75" stroke="currentColor" strokeWidth="0.2" strokeDasharray="15 5">
            <animateTransform attributeName="transform" type="rotate" from="360 100 100" to="0 100 100" dur="60s" repeatCount="indefinite" />
          </circle>
          <circle cx="100" cy="100" r="60" stroke="currentColor" strokeWidth="0.15" />
          <path d="M100 10 L100 190 M10 100 L190 100" stroke="currentColor" strokeWidth="0.1" strokeDasharray="2 4" />
        </svg>

        {/* Tech crosshairs */}
        <svg className="absolute bottom-1/4 left-12 w-28 h-28 opacity-15 text-slate-400" viewBox="0 0 40 40" fill="none">
          <circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="0.5" strokeDasharray="4 20" />
          <path d="M20 5 L20 15 M20 25 L20 35 M5 20 L15 20 M25 20 L35 20" stroke="currentColor" strokeWidth="0.3" />
        </svg>
      </div>

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
