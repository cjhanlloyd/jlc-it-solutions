/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import * as Icons from 'lucide-react';
import { 
  WebsiteData, 
  Inquiry, 
  Service, 
  BrandingSettings, 
  ContentSettings, 
  EmailTemplate, 
  AdminAccount,
  SentEmail,
  InquiryStatus,
  AdminRole,
  SmtpSettings,
  DEFAULT_ABOUT_COMMITMENTS,
  DEFAULT_WHY_PROMISES,
  PricingCard,
  DEFAULT_PRICING_CARDS
} from '../../../types.js';
import { adminApi } from '../api.js';
import { optimizeImage } from '../images.js';
import type { ContentSectionProps } from './ContentTab.js';

export default function PricingSection({ db, setDb, adminToken, adminUser, isSaving, run, showFlashMsg, setApiError, onDataChange, contentForm, setContentForm, onSave }: ContentSectionProps) {
  const activeServices = db.services || [];

  return (
    <>
      <div className="space-y-8 animate-fade-in">
        <form onSubmit={onSave} className="bg-white border border-gray-200 p-6 rounded-2xl shadow-xs space-y-6">
          <div>
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest font-mono">Pricing Header</h3>
            <p className="text-xs text-gray-400 font-sans mt-0.5">Customize the pricing page title and subtitle.</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Pricing Header Headline</label>
              <input
                type="text"
                required
                value={contentForm.pricingHeader || ''}
                onChange={(e) => setContentForm({ ...contentForm, pricingHeader: e.target.value })}
                className="w-full border border-gray-200 p-2.5 rounded-lg text-xs"
                placeholder="Technology Solutions Designed To Grow Your Business"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Pricing Header Subtitle</label>
              <textarea
                required
                value={contentForm.pricingSubtitle || ''}
                onChange={(e) => setContentForm({ ...contentForm, pricingSubtitle: e.target.value })}
                className="w-full border border-gray-200 p-2.5 rounded-lg text-xs"
                placeholder="From IT support to digital transformation, JLC provides reliable technology solutions that help businesses operate smarter."
                rows={2}
              />
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest font-mono">Enterprise & Hospitality Highlights</h3>
            <p className="text-xs text-gray-400 font-sans mt-0.5">Customize the enterprise technology spotlight section.</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Spotlight Section Title</label>
              <input
                type="text"
                required
                value={contentForm.pricingEnterpriseTitle || ''}
                onChange={(e) => setContentForm({ ...contentForm, pricingEnterpriseTitle: e.target.value })}
                className="w-full border border-gray-200 p-2.5 rounded-lg text-xs"
                placeholder="Enterprise & Hospitality Technology"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Spotlight Section Description</label>
              <textarea
                required
                value={contentForm.pricingEnterpriseDesc || ''}
                onChange={(e) => setContentForm({ ...contentForm, pricingEnterpriseDesc: e.target.value })}
                className="w-full border border-gray-200 p-2.5 rounded-lg text-xs"
                placeholder="Specialized technology solutions for organizations that require reliability, scalability, and professional IT management."
                rows={2}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Spotlight Bullet Highlights (Comma-separated)</label>
              <input
                type="text"
                required
                value={contentForm.pricingEnterpriseHighlights || ''}
                onChange={(e) => setContentForm({ ...contentForm, pricingEnterpriseHighlights: e.target.value })}
                className="w-full border border-gray-200 p-2.5 rounded-lg text-xs"
                placeholder="Hotel & Resort Technology, Enterprise WiFi Deployment, IoT Smart Room Solutions, PMS / System Integration, Infrastructure Design, Digital Transformation"
              />
              <span className="text-[10px] text-gray-400 block mt-0.5">Separate highlights with commas (e.g. Highlight 1, Highlight 2)</span>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest font-mono">Need a Custom Solution CTA Block</h3>
            <p className="text-xs text-gray-400 font-sans mt-0.5">Customize the bottom CTA banner detail on the pricing section.</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">CTA Banner Title</label>
              <input
                type="text"
                required
                value={contentForm.pricingCtaTitle || ''}
                onChange={(e) => setContentForm({ ...contentForm, pricingCtaTitle: e.target.value })}
                className="w-full border border-gray-200 p-2.5 rounded-lg text-xs"
                placeholder="Need a custom solution?"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">CTA Banner Description</label>
              <textarea
                required
                value={contentForm.pricingCtaDesc || ''}
                onChange={(e) => setContentForm({ ...contentForm, pricingCtaDesc: e.target.value })}
                className="w-full border border-gray-200 p-2.5 rounded-lg text-xs"
                placeholder="Every business has unique technology requirements. Contact JLC Solutions and let's build the right solution for you."
                rows={2}
              />
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest font-mono">Service pricing Cards</h3>
            <p className="text-xs text-gray-400 font-sans mt-0.5">Manage and configure the content and price of the 4 call-to-action cards (Free Consultation, Onsite Support, Managed Services, and Business Tech Solutions).</p>
          </div>

          <div className="space-y-6">
            {(contentForm.pricingCards || DEFAULT_PRICING_CARDS).map((card: PricingCard, index: number) => (
              <div key={card.id || index} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-700 font-mono">Card {index + 1}: {card.title}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Card Title</label>
                    <input
                      type="text"
                      required
                      value={card.title || ''}
                      onChange={(e) => {
                        const newCards = [...(contentForm.pricingCards || DEFAULT_PRICING_CARDS)];
                        newCards[index] = { ...newCards[index], title: e.target.value };
                        setContentForm({ ...contentForm, pricingCards: newCards });
                      }}
                      className="w-full border border-gray-200 p-2.5 rounded-lg text-xs bg-white text-gray-900 font-sans"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Pricing Label / Amount</label>
                    <input
                      type="text"
                      required
                      value={card.price || ''}
                      onChange={(e) => {
                        const newCards = [...(contentForm.pricingCards || DEFAULT_PRICING_CARDS)];
                        newCards[index] = { ...newCards[index], price: e.target.value };
                        setContentForm({ ...contentForm, pricingCards: newCards });
                      }}
                      className="w-full border border-gray-200 p-2.5 rounded-lg text-xs bg-white text-gray-900 font-sans"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Period / Sub-price</label>
                    <input
                      type="text"
                      required
                      value={card.period || ''}
                      onChange={(e) => {
                        const newCards = [...(contentForm.pricingCards || DEFAULT_PRICING_CARDS)];
                        newCards[index] = { ...newCards[index], period: e.target.value };
                        setContentForm({ ...contentForm, pricingCards: newCards });
                      }}
                      className="w-full border border-gray-200 p-2.5 rounded-lg text-xs bg-white text-gray-900 font-sans"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Button Text</label>
                    <input
                      type="text"
                      required
                      value={card.buttonText || ''}
                      onChange={(e) => {
                        const newCards = [...(contentForm.pricingCards || DEFAULT_PRICING_CARDS)];
                        newCards[index] = { ...newCards[index], buttonText: e.target.value };
                        setContentForm({ ...contentForm, pricingCards: newCards });
                      }}
                      className="w-full border border-gray-200 p-2.5 rounded-lg text-xs bg-white text-gray-900 font-sans"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Description</label>
                  <textarea
                    required
                    value={card.description || ''}
                    onChange={(e) => {
                      const newCards = [...(contentForm.pricingCards || DEFAULT_PRICING_CARDS)];
                      newCards[index] = { ...newCards[index], description: e.target.value };
                      setContentForm({ ...contentForm, pricingCards: newCards });
                    }}
                    className="w-full border border-gray-200 p-2.5 rounded-lg text-xs bg-white text-gray-900 font-sans"
                    rows={2}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Features / Bullets (Comma-separated)</label>
                  <input
                    type="text"
                    required
                    value={card.features ? card.features.join(', ') : ''}
                    onChange={(e) => {
                      const newCards = [...(contentForm.pricingCards || DEFAULT_PRICING_CARDS)];
                      newCards[index] = { 
                        ...newCards[index], 
                        features: e.target.value.split(',').map(s => s.trim()).filter(Boolean) 
                      };
                      setContentForm({ ...contentForm, pricingCards: newCards });
                    }}
                    className="w-full border border-gray-200 p-2.5 rounded-lg text-xs bg-white text-gray-900 font-sans"
                  />
                  <span className="text-[10px] text-gray-400 block">Separate bullets with commas (e.g. Bullet 1, Bullet 2)</span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-4 border-t border-gray-100">
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
            >
              {isSaving ? 'Saving Changes...' : 'Save Pricing Page Layout Overrides'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
