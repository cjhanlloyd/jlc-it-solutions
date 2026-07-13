/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import * as Icons from 'lucide-react';
import { ContentSettings, BrandingSettings } from '../types.js';

interface ContactSectionProps {
  content: ContentSettings;
  branding: BrandingSettings;
  onInquireClick: () => void;
}

export default function ContactSection({ content, branding, onInquireClick }: ContactSectionProps) {
  
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
      case 'emerald': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'slate': return 'bg-slate-100 text-slate-800 border-slate-200';
      case 'indigo': return 'bg-indigo-50 text-indigo-700 border-indigo-100';
      case 'violet': return 'bg-violet-50 text-violet-700 border-violet-100';
      case 'deepblue':
      default:
        return 'bg-blue-50 text-blue-700 border-blue-100';
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
    <div className="bg-slate-50 border-t border-slate-200/60 py-20 sm:py-28 relative overflow-hidden" id="contact-us-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Page Title */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-slate-100 border border-slate-200 rounded-full text-[10px] font-extrabold uppercase tracking-widest text-slate-500 font-mono mb-4">
            Get In Touch
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 font-display">
            {content.contactHeader || 'Connect With JLC Solutions'}
          </h2>
          <p className="mt-4 text-sm sm:text-base text-slate-500 font-sans leading-relaxed">
            {content.contactSubtitle || 'Have questions about our technology capabilities, security controls, or pricing models? Let us know. We respond to all inquiries within 1 business day.'}
          </p>
          <div className="h-1 w-16 bg-blue-600 mx-auto mt-5 rounded-full"></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          
          {/* Left Details Block */}
          <div className="lg:col-span-5 space-y-8">
            <h3 className="text-xl font-bold text-slate-900 font-display mb-6">Contact Channels</h3>
            
            <div className="space-y-6">
              {/* Telephone */}
              <a 
                href={`tel:${content.contactPhone}`}
                className="flex items-start space-x-4 p-5 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs transition-all group text-left cursor-pointer"
                id="contact-call-link"
              >
                <div className="w-12 h-12 bg-slate-900 flex items-center justify-center transform rotate-45 shrink-0 shadow-xs border border-slate-800 transition-transform duration-300 group-hover:rotate-90">
                  <Icons.Phone className="h-5 w-5 text-white transform -rotate-45" />
                </div>
                <div>
                  <h4 className="text-[10px] font-extrabold text-slate-400 font-mono uppercase tracking-widest">Phone Call</h4>
                  <p className="text-base font-bold text-slate-900 font-display mt-1 group-hover:underline">
                    {content.contactPhone}
                  </p>
                  <span className="text-xs text-slate-400 block mt-1 font-sans">Click to dial directly from your device</span>
                </div>
              </a>

              {/* Email */}
              <a 
                href={`mailto:${content.contactEmail}`}
                className="flex items-start space-x-4 p-5 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs transition-all group text-left cursor-pointer"
                id="contact-email-link"
              >
                <div className="w-12 h-12 bg-slate-900 flex items-center justify-center transform rotate-45 shrink-0 shadow-xs border border-slate-800 transition-transform duration-300 group-hover:rotate-90">
                  <Icons.Mail className="h-5 w-5 text-white transform -rotate-45" />
                </div>
                <div>
                  <h4 className="text-[10px] font-extrabold text-slate-400 font-mono uppercase tracking-widest">Email Address</h4>
                  <p className="text-base font-bold text-slate-900 font-display mt-1 group-hover:underline">
                    {content.contactEmail}
                  </p>
                  <span className="text-xs text-slate-400 block mt-1 font-sans">Submit RFC requests or general inquiries</span>
                </div>
              </a>

              {/* Office Address */}
              <div className="flex items-start space-x-4 p-5 rounded-2xl border border-slate-200 bg-white">
                <div className="w-12 h-12 bg-slate-900 flex items-center justify-center transform rotate-45 shrink-0 shadow-xs border border-slate-800">
                  <Icons.MapPin className="h-5 w-5 text-white transform -rotate-45" />
                </div>
                <div>
                  <h4 className="text-[10px] font-extrabold text-slate-400 font-mono uppercase tracking-widest">Corporate Office</h4>
                  <p className="text-sm font-semibold text-slate-900 font-sans mt-1 leading-relaxed">
                    {content.contactAddress}
                  </p>
                </div>
              </div>

              {/* Business Hours */}
              <div className="flex items-start space-x-4 p-5 rounded-2xl border border-slate-200 bg-white">
                <div className="w-12 h-12 bg-slate-900 flex items-center justify-center transform rotate-45 shrink-0 shadow-xs border border-slate-800">
                  <Icons.Clock className="h-5 w-5 text-white transform -rotate-45" />
                </div>
                <div>
                  <h4 className="text-[10px] font-extrabold text-slate-400 font-mono uppercase tracking-widest">Consultation Hours</h4>
                  <p className="text-sm font-semibold text-slate-900 font-sans mt-1">
                    {content.contactWorkingHours}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Map Block */}
          <div className="lg:col-span-7 space-y-6">
            <h3 className="text-xl font-bold text-slate-900 font-display">Geographical Presence</h3>
            <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm h-96 relative">
              {content.contactMapEmbedUrl ? (
                <iframe
                  title="JLC Solutions Head Office Location Map"
                  src={content.contactMapEmbedUrl}
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen={false}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  id="contact-large-map"
                ></iframe>
              ) : (
                <div className="h-full bg-slate-100 flex items-center justify-center">
                  <Icons.MapPin className="h-10 w-10 text-slate-300 animate-pulse" />
                </div>
              )}
            </div>

            <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-xs flex items-start space-x-4">
              <Icons.HelpCircle className={`h-6 w-6 shrink-0 mt-0.5 ${getThemeTextClass()}`} />
              <div>
                <h4 className="text-sm font-bold text-slate-900 font-display">Ready to submit your formal IT requirements?</h4>
                <p className="text-xs text-slate-500 font-sans leading-relaxed mt-1">
                  We highly recommend using our specialized inquiry form. This structure prompts you for required project metrics (service type, preferred contact time, description) to ensure your response is formulated rapidly and accurately.
                </p>
                <button
                  onClick={onInquireClick}
                  className={`mt-4 inline-flex items-center px-6 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-wider font-display text-white shadow-md shadow-blue-500/10 cursor-pointer transition-all hover:scale-102 ${getButtonBgClass()}`}
                  id="contact-cta-form"
                >
                  Open Inquiry Form
                  <Icons.ArrowRight className="ml-2 h-3 w-3" />
                </button>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
