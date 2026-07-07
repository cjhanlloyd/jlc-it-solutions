/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import * as Icons from 'lucide-react';
import { FaqItem, BrandingSettings, ContentSettings } from '../types.js';

interface FaqAccordionProps {
  faqs: FaqItem[];
  branding: BrandingSettings;
  content: ContentSettings;
}

export default function FaqAccordion({ faqs, branding, content }: FaqAccordionProps) {
  const [openId, setOpenId] = React.useState<string | null>(null);

  const toggleFaq = (id: string) => {
    setOpenId(openId === id ? null : id);
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

  const getThemeBgClass = () => {
    switch (branding.themeColor) {
      case 'emerald': return 'bg-emerald-600';
      case 'slate': return 'bg-slate-800';
      case 'indigo': return 'bg-indigo-600';
      case 'violet': return 'bg-violet-600';
      case 'deepblue':
      default:
        return 'bg-blue-600';
    }
  };

  return (
    <div className="bg-slate-50 border-t border-slate-200/60 py-20 sm:py-28 relative overflow-hidden" id="faq-section">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-slate-100 border border-slate-200 rounded-full text-[10px] font-extrabold uppercase tracking-widest text-slate-500 font-mono mb-4">
            Answers
          </div>
          <h2 className="text-3xl font-extrabold text-slate-900 font-display">
            {content.faqHeader || 'Frequently Asked Questions'}
          </h2>
          <p className="mt-4 text-sm text-slate-500 font-sans max-w-xl mx-auto leading-relaxed">
            {content.faqSubtitle || 'Got questions about our services, methodologies, or capabilities? Here are quick, direct answers from our lead engineer.'}
          </p>
          <div className={`h-1 w-16 mx-auto mt-5 rounded-full ${getThemeBgClass()}`}></div>
        </div>

        {/* Accordions Stack */}
        <div className="space-y-4" id="faqs-accordion-stack">
          {faqs.map((faq) => {
            const isOpen = openId === faq.id;
            
            return (
              <div 
                key={faq.id}
                className="bg-white border border-slate-200 rounded-2xl overflow-hidden transition-all duration-300 shadow-xs hover:border-slate-300"
                id={`faq-item-${faq.id}`}
              >
                {/* Header Question */}
                <button
                  onClick={() => toggleFaq(faq.id)}
                  className="w-full px-6 py-5 flex items-center justify-between text-left cursor-pointer focus:outline-hidden"
                  id={`faq-btn-${faq.id}`}
                >
                  <span className="text-sm font-bold text-slate-900 font-display pr-4">
                    {faq.question}
                  </span>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${
                    isOpen ? 'bg-slate-900 text-white rotate-180' : 'bg-slate-50 text-slate-500'
                  }`}>
                    <Icons.ChevronDown className="h-4 w-4" />
                  </div>
                </button>

                {/* Answer Content */}
                <div 
                  className={`transition-all duration-300 ease-in-out overflow-hidden ${
                    isOpen ? 'max-h-96 opacity-100 border-t border-slate-100' : 'max-h-0 opacity-0'
                  }`}
                >
                  <div className="px-6 py-5 text-xs sm:text-sm text-slate-500 font-sans leading-relaxed">
                    {faq.answer}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
