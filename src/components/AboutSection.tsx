/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ArrowRight, Compass, Shield, Target } from 'lucide-react';
import { StoredIcon } from './StoredIcon';
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
      case 'emerald': return 'text-brand-700';
      case 'slate': return 'text-ink';
      case 'indigo': return 'text-brand-700';
      case 'violet': return 'text-brand-700';
      case 'deepblue':
      default:
        return 'text-brand-700';
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

  const getCardBgClass = () => {
    switch (branding.themeColor) {
      case 'emerald': return 'bg-brand-50 border-gold-light';
      case 'slate': return 'bg-sand border-gold-light';
      case 'indigo': return 'bg-brand-50 border-gold-light';
      case 'violet': return 'bg-brand-50 border-gold-light';
      case 'deepblue':
      default:
        return 'bg-brand-50 border-gold-light';
    }
  };

  return (
    <div className="bg-sand border-t border-gold-light py-20 sm:py-28 relative overflow-hidden" id="about-us-section">
      <div className="absolute top-0 right-0 w-96 h-96 bg-brand-50 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">

        {/* Header Section */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-sand border border-gold-light rounded-full text-[10px] font-extrabold uppercase tracking-widest text-ink/80 font-mono mb-4">
            Company Profile
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl font-extrabold tracking-tight text-ink font-display">
            {content.aboutHeader || 'Your Strategic Technical Partner'}
          </h2>
          <div className="h-1 w-16 bg-brand-700 mx-auto mt-5 rounded-full"></div>
        </div>

        {/* Content Body */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start mb-16">
          {/* Text block */}
          <div className="lg:col-span-7 space-y-6">
            <h3 className="text-2xl font-bold tracking-tight text-ink font-display">
              {content.aboutSubheader || 'Establishing a Strong, Trustworthy Foundation for Future Tech Growth'}
            </h3>

            <p className="text-sm sm:text-base text-ink/80 font-sans leading-relaxed">
              {content.aboutText}
            </p>

            <p className="text-sm sm:text-base text-ink/80 font-sans leading-relaxed">
              {content.aboutText2 || `We understand that choosing an IT support and custom development partner is an exercise in trust. That's why we focus on absolute transparency: we do not inflate our stats, utilize fake client testimonials, or oversell. Instead, we deliver world-class engineering, bulletproof security protocols, and meticulous documentation, ensuring your technology investments support long-term stability and organic growth.`}
            </p>

            <div className="pt-4">
              <button
                onClick={onExploreServices}
                className={`inline-flex items-center px-6 py-3 rounded-full text-xs font-bold uppercase tracking-wider font-display text-white shadow-lg shadow-brand-700/10 cursor-pointer transition-all hover:scale-102 ${getButtonBgClass()}`}
                id="about-cta"
              >
                Explore What We Offer
                <ArrowRight className="ml-2 h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Quick Stats sidebar - realistic & elegant */}
          <div className="lg:col-span-5 bg-white p-8 rounded-card border border-gold-light shadow-xs space-y-8 relative">
            <div className="absolute top-0 right-0 w-24 h-24 bg-brand-50 rounded-bl-full pointer-events-none"></div>
            <h4 className="text-xs uppercase tracking-widest font-extrabold text-ink/75 font-mono">Our Core Commitments</h4>

            <div className="space-y-6 relative z-10">
              {(content.aboutCommitments || DEFAULT_ABOUT_COMMITMENTS).map((comm) => {
                return (
                  <div key={comm.id} className="flex items-start space-x-4">
                    <div className="w-10 h-10 bg-brand-900 flex items-center justify-center transform rotate-45 shrink-0 shadow-sm border border-brand-800">
                      <StoredIcon name={comm.iconName} fallback={Shield} className="h-5 w-5 text-white transform -rotate-45" />
                    </div>
                    <div>
                      <h5 className="text-sm font-bold text-ink font-display">{comm.title}</h5>
                      <p className="text-xs text-ink/80 font-sans mt-1 leading-relaxed">{comm.description}</p>
                    </div>
                  </div>
                );
              })}

              {content.aboutImageBase64 && (
                <div className="relative aspect-video rounded-xl overflow-hidden border border-gold-light shadow-xs mt-6">
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
          <div className="bg-white p-8 sm:p-10 rounded-card border border-gold-light shadow-xs relative overflow-hidden group">
            <div className={`absolute top-0 left-0 h-1 w-full bg-brand-700`}></div>
            <div className="flex items-center space-x-4 mb-6">
              <div className="w-10 h-10 bg-sand flex items-center justify-center transform rotate-45 shrink-0 shadow-xs border border-gold-light">
                <Target className="h-5 w-5 text-ink transform -rotate-45" />
              </div>
              <h4 className="text-lg font-bold text-ink font-display">Our Mission</h4>
            </div>
            <p className="text-ink/80 font-sans leading-relaxed text-sm">
              {content.aboutMission}
            </p>
          </div>

          {/* Vision */}
          <div className="bg-white p-8 sm:p-10 rounded-card border border-gold-light shadow-xs relative overflow-hidden group">
            <div className={`absolute top-0 left-0 h-1 w-full bg-brand-700`}></div>
            <div className="flex items-center space-x-4 mb-6">
              <div className="w-10 h-10 bg-sand flex items-center justify-center transform rotate-45 shrink-0 shadow-xs border border-gold-light">
                <Compass className="h-5 w-5 text-ink transform -rotate-45" />
              </div>
              <h4 className="text-lg font-bold text-ink font-display">Our Vision</h4>
            </div>
            <p className="text-ink/80 font-sans leading-relaxed text-sm">
              {content.aboutVision}
            </p>
          </div>
        </div>

        {/* Growth Roadmap Section */}
        <div className="mt-20" id="roadmap-sub-section">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center space-x-2 px-3 py-1 bg-sand border border-gold-light rounded-full text-[10px] font-extrabold uppercase tracking-widest text-ink/80 font-mono mb-4">
              Our Future
            </div>
            <h2 className="font-serif text-3xl font-extrabold text-ink font-display">
              Growth Roadmap
            </h2>
            <p className="mt-4 text-sm text-ink/80 font-sans leading-relaxed">
              {getRoadmapDescription()}
            </p>
            <div className={`h-1 w-16 mx-auto mt-5 rounded-full ${getThemeBgClass()}`}></div>
          </div>

          <div className="relative border-l-2 border-gold-light ml-4 md:ml-32 space-y-12">
            {(roadmapSteps || DEFAULT_ROADMAP_STEPS).map((step, idx) => {
              const isCompleted = step.status === 'completed';
              const isInProgress = step.status === 'in-progress';

              return (
                <div key={step.id || idx} className="relative pl-8 md:pl-12 group">
                  {/* Timeline Point */}
                  <span className={`absolute -left-[11px] top-1.5 flex h-5 w-5 items-center justify-center rounded-full border-4 bg-white transition-transform duration-300 group-hover:scale-115 ${isCompleted ? 'border-brand-700' :
                    isInProgress ? 'border-brand-700 animate-pulse' :
                      'border-gold-light'
                    }`}></span>

                  {/* Timeline Tag */}
                  <div className="md:absolute md:-left-32 md:top-1 text-xs font-mono font-extrabold text-ink/75 uppercase tracking-widest md:w-24 md:text-right">
                    {step.timeline}
                  </div>

                  {/* Timeline Card */}
                  <div className="bg-white p-6 rounded-card border border-gold-light shadow-xs hover:border-gold hover:shadow-md transition-all duration-300">
                    <div className="flex items-center space-x-2.5 mb-2">
                      <h4 className="text-base font-bold text-ink font-display">{step.title}</h4>
                      <span className={`text-[9px] uppercase font-extrabold font-mono tracking-wider px-2 py-0.5 rounded-full ${isCompleted ? 'bg-brand-50 text-brand-700 border border-gold-light' :
                        isInProgress ? 'bg-brand-50 text-brand-700 border border-gold-light' :
                          'bg-sand text-ink/80 border border-gold-light'
                        }`}>
                        {step.status}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-ink/80 font-sans leading-relaxed">{step.description}</p>
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
