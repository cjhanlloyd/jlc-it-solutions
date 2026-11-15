/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ChevronDown } from 'lucide-react';
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
      case 'emerald': return 'bg-brand-700';
      case 'slate': return 'bg-brand-800';
      case 'indigo': return 'bg-brand-700';
      case 'violet': return 'bg-brand-700';
      case 'deepblue':
      default:
        return 'bg-brand-700';
    }
  };

  return (
    <div className="bg-white border-t border-gold-light py-20 sm:py-28 relative overflow-hidden" id="faq-section">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-sand border border-gold-light rounded-full text-[10px] font-extrabold uppercase tracking-widest text-ink/80 font-mono mb-4">
            Answers
          </div>
          <h2 className="font-serif text-3xl font-extrabold text-ink font-display">
            {content.faqHeader || 'Frequently Asked Questions'}
          </h2>
          <p className="mt-4 text-sm text-ink/80 font-sans max-w-xl mx-auto leading-relaxed">
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
                className="bg-white border border-gold-light rounded-card overflow-hidden transition-all duration-300 shadow-xs hover:border-gold"
                id={`faq-item-${faq.id}`}
              >
                {/* Header Question */}
                <button
                  onClick={() => toggleFaq(faq.id)}
                  aria-expanded={isOpen}
                  aria-controls={`faq-panel-${faq.id}`}
                  className="w-full px-6 py-5 flex items-center justify-between text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-600"
                  id={`faq-btn-${faq.id}`}
                >
                  <span className="text-sm font-bold text-ink font-display pr-4">
                    {faq.question}
                  </span>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${
                    isOpen ? 'bg-brand-900 text-white rotate-180' : 'bg-sand text-ink/80'
                  }`}>
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </button>

                {/* Answer Content */}
                <div 
                  id={`faq-panel-${faq.id}`}
                  role="region"
                  aria-labelledby={`faq-btn-${faq.id}`}
                  className={`transition-all duration-300 ease-in-out overflow-hidden ${
                    isOpen ? 'max-h-96 opacity-100 border-t border-gold-light' : 'max-h-0 opacity-0'
                  }`}
                >
                  <div className="px-6 py-5 text-xs sm:text-sm text-ink/80 font-sans leading-relaxed">
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
