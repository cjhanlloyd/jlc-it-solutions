/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import * as Icons from 'lucide-react';
import { ContentSettings, BrandingSettings, RoadmapStep, DEFAULT_ROADMAP_STEPS, DEFAULT_ABOUT_COMMITMENTS } from '../types.js';

interface AboutSectionProps {
  content: ContentSettings;
  branding: BrandingSettings;
  onExploreServices: () => void;
  roadmapSteps?: RoadmapStep[];
}

export default function AboutSection({ content, branding, onExploreServices, roadmapSteps }: AboutSectionProps) {

  const getRoadmapDescription = () => {
    const steps = roadmapSteps || DEFAULT_ROADMAP_STEPS;
    if (!steps || steps.length === 0) {
      return 'Our key technology development milestones for the upcoming quarters.';
    }

    const getFocusPhrase = (title: string) => {
      const t = title.toLowerCase();
      if (t.includes('security compliance') || t.includes('security certification') || t.includes('compliance auditing') || t.includes('soc2')) {
        return 'security certifications';
      }
      if (t.includes('client portal') || t.includes('interactive portal')) {
        return 'dynamic portal features';
      }
      if (t.includes('catalog expansion') || t.includes('service automation') || t.includes('iot integration')) {
        return 'service automation';
      }
      return t.trim().replace(/\.$/, '');
    };

    const focuses = steps.map(step => getFocusPhrase(step.title));
    const uniqueFocuses = Array.from(new Set(focuses));

    let focusList = '';
    if (uniqueFocuses.length === 1) {
      focusList = uniqueFocuses[0];
    } else if (uniqueFocuses.length === 2) {
      focusList = `${uniqueFocuses[0]} and ${uniqueFocuses[1]}`;
    } else if (uniqueFocuses.length > 2) {
      focusList = `${uniqueFocuses.slice(0, -1).join(', ')}, and ${uniqueFocuses[uniqueFocuses.length - 1]}`;
    }

    return `Our key technology development milestones for the upcoming quarters, focused on expanding our ${focusList}.`;
  };

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
      case 'emerald': return 'bg-emerald-600 hover:bg-emerald-700';
      case 'slate': return 'bg-slate-700 hover:bg-slate-800';
      case 'indigo': return 'bg-indigo-600 hover:bg-indigo-700';
      case 'violet': return 'bg-violet-600 hover:bg-violet-700';
      case 'deepblue':
      default:
        return 'bg-blue-600 hover:bg-blue-700';
    }
  };

  const getThemeBgClass = () => {
    switch (branding.themeColor) {
      case 'emerald': return 'bg-emerald-600';
      case 'slate': return 'bg-slate-700';
      case 'indigo': return 'bg-indigo-600';
      case 'violet': return 'bg-violet-600';
      case 'deepblue':
      default:
        return 'bg-blue-600';
    }
  };

  const getCardBgClass = () => {
    switch (branding.themeColor) {
      case 'emerald': return 'bg-emerald-50/50 border-emerald-100';
      case 'slate': return 'bg-slate-50 border-slate-200';
      case 'indigo': return 'bg-indigo-50/50 border-indigo-100';
      case 'violet': return 'bg-violet-50/50 border-violet-100';
      case 'deepblue':
      default:
        return 'bg-blue-50/50 border-blue-100';
    }
  };

  return (
    <div className="bg-slate-50 border-t border-slate-200/60 py-20 sm:py-28 relative overflow-hidden" id="about-us-section">
      <div className="absolute top-0 right-0 w-96 h-96 bg-blue-100/20 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">

        {/* Header Section */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-slate-100 border border-slate-200 rounded-full text-[10px] font-extrabold uppercase tracking-widest text-slate-500 font-mono mb-4">
            Company Profile
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 font-display">
            {content.aboutHeader || 'Your Strategic Technical Partner'}
          </h2>
          <div className="h-1 w-16 bg-blue-600 mx-auto mt-5 rounded-full"></div>
        </div>

        {/* Content Body */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start mb-16">
          {/* Text block */}
          <div className="lg:col-span-7 space-y-6">
            <h3 className="text-2xl font-bold tracking-tight text-slate-900 font-display">
              {content.aboutSubheader || 'Establishing a Strong, Trustworthy Foundation for Future Tech Growth'}
            </h3>

            <p className="text-sm sm:text-base text-slate-600 font-sans leading-relaxed">
              {content.aboutText}
            </p>

            <p className="text-sm sm:text-base text-slate-600 font-sans leading-relaxed">
              {content.aboutText2 || `We understand that choosing an IT support and custom development partner is an exercise in trust. That's why we focus on absolute transparency: we do not inflate our stats, utilize fake client testimonials, or oversell. Instead, we deliver world-class engineering, bulletproof security protocols, and meticulous documentation, ensuring your technology investments support long-term stability and organic growth.`}
            </p>

            <div className="pt-4">
              <button
                onClick={onExploreServices}
                className={`inline-flex items-center px-6 py-3 rounded-full text-xs font-bold uppercase tracking-wider font-display text-white shadow-lg shadow-blue-500/10 cursor-pointer transition-all hover:scale-102 ${getButtonBgClass()}`}
                id="about-cta"
              >
                Explore What We Offer
                <Icons.ArrowRight className="ml-2 h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Quick Stats sidebar - realistic & elegant */}
          <div className="lg:col-span-5 bg-white p-8 rounded-2xl border border-slate-200 shadow-xs space-y-8 relative">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50/50 rounded-bl-full pointer-events-none"></div>
            <h4 className="text-xs uppercase tracking-widest font-extrabold text-slate-400 font-mono">Our Core Commitments</h4>

            <div className="space-y-6 relative z-10">
              {(content.aboutCommitments || DEFAULT_ABOUT_COMMITMENTS).map((comm) => {
                const IconComponent = (Icons as any)[comm.iconName] || Icons.Shield;
                return (
                  <div key={comm.id} className="flex items-start space-x-4">
                    <div className="w-10 h-10 bg-slate-900 flex items-center justify-center transform rotate-45 shrink-0 shadow-sm border border-slate-800">
                      <IconComponent className="h-5 w-5 text-white transform -rotate-45" />
                    </div>
                    <div>
                      <h5 className="text-sm font-bold text-slate-900 font-display">{comm.title}</h5>
                      <p className="text-xs text-slate-500 font-sans mt-1 leading-relaxed">{comm.description}</p>
                    </div>
                  </div>
                );
              })}

              {content.aboutImageBase64 && (
                <div className="relative aspect-video rounded-xl overflow-hidden border border-slate-200 shadow-xs mt-6">
                  <img
                    src={content.aboutImageBase64}
                    alt="Corporate Workspace"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mission and Vision Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Mission */}
          <div className="bg-white p-8 sm:p-10 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden group">
            <div className={`absolute top-0 left-0 h-1 w-full bg-blue-600`}></div>
            <div className="flex items-center space-x-4 mb-6">
              <div className="w-10 h-10 bg-slate-100 flex items-center justify-center transform rotate-45 shrink-0 shadow-xs border border-slate-200">
                <Icons.Target className="h-5 w-5 text-slate-800 transform -rotate-45" />
              </div>
              <h4 className="text-lg font-bold text-slate-900 font-display">Our Mission</h4>
            </div>
            <p className="text-slate-600 font-sans leading-relaxed text-sm">
              {content.aboutMission}
            </p>
          </div>

          {/* Vision */}
          <div className="bg-white p-8 sm:p-10 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden group">
            <div className={`absolute top-0 left-0 h-1 w-full bg-blue-600`}></div>
            <div className="flex items-center space-x-4 mb-6">
              <div className="w-10 h-10 bg-slate-100 flex items-center justify-center transform rotate-45 shrink-0 shadow-xs border border-slate-200">
                <Icons.Compass className="h-5 w-5 text-slate-800 transform -rotate-45" />
              </div>
              <h4 className="text-lg font-bold text-slate-900 font-display">Our Vision</h4>
            </div>
            <p className="text-slate-600 font-sans leading-relaxed text-sm">
              {content.aboutVision}
            </p>
          </div>
        </div>

        {/* Growth Roadmap Section */}
        <div className="mt-20" id="roadmap-sub-section">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center space-x-2 px-3 py-1 bg-slate-100 border border-slate-200 rounded-full text-[10px] font-extrabold uppercase tracking-widest text-slate-500 font-mono mb-4">
              Our Future
            </div>
            <h2 className="text-3xl font-extrabold text-slate-900 font-display">
              Growth Roadmap
            </h2>
            <p className="mt-4 text-sm text-slate-500 font-sans leading-relaxed">
              {getRoadmapDescription()}
            </p>
            <div className={`h-1 w-16 mx-auto mt-5 rounded-full ${getThemeBgClass()}`}></div>
          </div>

          <div className="relative border-l-2 border-slate-200 ml-4 md:ml-32 space-y-12">
            {(roadmapSteps || DEFAULT_ROADMAP_STEPS).map((step, idx) => {
              const isCompleted = step.status === 'completed';
              const isInProgress = step.status === 'in-progress';

              return (
                <div key={step.id || idx} className="relative pl-8 md:pl-12 group">
                  {/* Timeline Point */}
                  <span className={`absolute -left-[11px] top-1.5 flex h-5 w-5 items-center justify-center rounded-full border-4 bg-white transition-transform duration-300 group-hover:scale-115 ${isCompleted ? 'border-emerald-500' :
                    isInProgress ? 'border-blue-500 animate-pulse' :
                      'border-slate-350'
                    }`}></span>

                  {/* Timeline Tag */}
                  <div className="md:absolute md:-left-32 md:top-1 text-xs font-mono font-extrabold text-slate-400 uppercase tracking-widest md:w-24 md:text-right">
                    {step.timeline}
                  </div>

                  {/* Timeline Card */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 hover:shadow-md transition-all duration-300">
                    <div className="flex items-center space-x-2.5 mb-2">
                      <h4 className="text-base font-bold text-slate-900 font-display">{step.title}</h4>
                      <span className={`text-[9px] uppercase font-extrabold font-mono tracking-wider px-2 py-0.5 rounded-full ${isCompleted ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' :
                        isInProgress ? 'bg-blue-50 text-blue-800 border border-blue-100' :
                          'bg-slate-50 text-slate-500 border border-slate-100'
                        }`}>
                        {step.status}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-500 font-sans leading-relaxed">{step.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
