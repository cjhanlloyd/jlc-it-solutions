/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
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
} from '../../types.js';
import { adminApi } from '../../components/admin/api.js';
import { optimizeImage } from '../../components/admin/images.js';
import type { ContentSectionProps } from './ContentTab.js';

export default function PricingSection({ db, setDb, adminToken, adminUser, isSaving, run, showFlashMsg, setApiError, onDataChange, contentForm, setContentForm, onSave }: ContentSectionProps) {
  const activeServices = db.services || [];

  return (
    <>
      <div className="space-y-8 animate-fade-in">
        <form onSubmit={onSave} className="bg-white border border-slate-200 p-5 rounded-card shadow-card space-y-6">
          <div>
            <h3 className="font-display text-lg font-semibold text-slate-900">Pricing Header</h3>
            <p className="text-xs text-slate-600 mt-0.5">Customize the pricing page title and subtitle.</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-800">Pricing Header Headline</label>
              <input aria-label="Pricing Header Headline"
                type="text"
                required
                value={contentForm.pricingHeader || ''}
                onChange={(e) => setContentForm({ ...contentForm, pricingHeader: e.target.value })}
                className="w-full rounded-control border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-2 focus:outline-brand-600"
                placeholder="Technology Solutions Designed To Grow Your Business"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-800">Pricing Header Subtitle</label>
              <textarea aria-label="Pricing Header Subtitle"
                required
                value={contentForm.pricingSubtitle || ''}
                onChange={(e) => setContentForm({ ...contentForm, pricingSubtitle: e.target.value })}
                className="w-full rounded-control border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-2 focus:outline-brand-600"
                placeholder="From IT support to digital transformation, JLC provides reliable technology solutions that help businesses operate smarter."
                rows={2}
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <h3 className="font-display text-lg font-semibold text-slate-900">Enterprise & Hospitality Highlights</h3>
            <p className="text-xs text-slate-600 mt-0.5">Customize the enterprise technology spotlight section.</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-800">Spotlight Section Title</label>
              <input aria-label="Spotlight Section Title"
                type="text"
                required
                value={contentForm.pricingEnterpriseTitle || ''}
                onChange={(e) => setContentForm({ ...contentForm, pricingEnterpriseTitle: e.target.value })}
                className="w-full rounded-control border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-2 focus:outline-brand-600"
                placeholder="Enterprise & Hospitality Technology"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-800">Spotlight Section Description</label>
              <textarea aria-label="Spotlight Section Description"
                required
                value={contentForm.pricingEnterpriseDesc || ''}
                onChange={(e) => setContentForm({ ...contentForm, pricingEnterpriseDesc: e.target.value })}
                className="w-full rounded-control border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-2 focus:outline-brand-600"
                placeholder="Specialized technology solutions for organizations that require reliability, scalability, and professional IT management."
                rows={2}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-800">Spotlight Bullet Highlights (Comma-separated)</label>
              <input aria-label="Spotlight Bullet Highlights (Comma-separated)"
                type="text"
                required
                value={contentForm.pricingEnterpriseHighlights || ''}
                onChange={(e) => setContentForm({ ...contentForm, pricingEnterpriseHighlights: e.target.value })}
                className="w-full rounded-control border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-2 focus:outline-brand-600"
                placeholder="Hotel & Resort Technology, Enterprise WiFi Deployment, IoT Smart Room Solutions, PMS / System Integration, Infrastructure Design, Digital Transformation"
              />
              <span className="text-xs text-slate-600 block mt-0.5">Separate highlights with commas (e.g. Highlight 1, Highlight 2)</span>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <h3 className="font-display text-lg font-semibold text-slate-900">Need a Custom Solution CTA Block</h3>
            <p className="text-xs text-slate-600 mt-0.5">Customize the bottom CTA banner detail on the pricing section.</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-800">CTA Banner Title</label>
              <input aria-label="CTA Banner Title"
                type="text"
                required
                value={contentForm.pricingCtaTitle || ''}
                onChange={(e) => setContentForm({ ...contentForm, pricingCtaTitle: e.target.value })}
                className="w-full rounded-control border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-2 focus:outline-brand-600"
                placeholder="Need a custom solution?"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-800">CTA Banner Description</label>
              <textarea aria-label="CTA Banner Description"
                required
                value={contentForm.pricingCtaDesc || ''}
                onChange={(e) => setContentForm({ ...contentForm, pricingCtaDesc: e.target.value })}
                className="w-full rounded-control border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-2 focus:outline-brand-600"
                placeholder="Every business has unique technology requirements. Contact JLC Solutions and let's build the right solution for you."
                rows={2}
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <h3 className="font-display text-lg font-semibold text-slate-900">Service pricing Cards</h3>
            <p className="text-xs text-slate-600 mt-0.5">Manage and configure the content and price of the 4 call-to-action cards (Free Consultation, Onsite Support, Managed Services, and Business Tech Solutions).</p>
          </div>

          <div className="space-y-6">
            {(contentForm.pricingCards || DEFAULT_PRICING_CARDS).map((card: PricingCard, index: number) => (
              <div key={card.id || index} className="p-4 bg-slate-50 border border-slate-200 rounded-card space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                  <span className="text-brand-700 font-display text-lg font-semibold text-slate-900">Card {index + 1}: {card.title}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-800">Card Title</label>
                    <input aria-label="Card Title"
                      type="text"
                      required
                      value={card.title || ''}
                      onChange={(e) => {
                        const newCards = [...(contentForm.pricingCards || DEFAULT_PRICING_CARDS)];
                        newCards[index] = { ...newCards[index], title: e.target.value };
                        setContentForm({ ...contentForm, pricingCards: newCards });
                      }}
                      className="w-full rounded-control border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-2 focus:outline-brand-600"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-800">Pricing Label / Amount</label>
                    <input aria-label="Pricing Label / Amount"
                      type="text"
                      required
                      value={card.price || ''}
                      onChange={(e) => {
                        const newCards = [...(contentForm.pricingCards || DEFAULT_PRICING_CARDS)];
                        newCards[index] = { ...newCards[index], price: e.target.value };
                        setContentForm({ ...contentForm, pricingCards: newCards });
                      }}
                      className="w-full rounded-control border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-2 focus:outline-brand-600"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-800">Period / Sub-price</label>
                    <input aria-label="Period / Sub-price"
                      type="text"
                      required
                      value={card.period || ''}
                      onChange={(e) => {
                        const newCards = [...(contentForm.pricingCards || DEFAULT_PRICING_CARDS)];
                        newCards[index] = { ...newCards[index], period: e.target.value };
                        setContentForm({ ...contentForm, pricingCards: newCards });
                      }}
                      className="w-full rounded-control border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-2 focus:outline-brand-600"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-800">Button Text</label>
                    <input aria-label="Button Text"
                      type="text"
                      required
                      value={card.buttonText || ''}
                      onChange={(e) => {
                        const newCards = [...(contentForm.pricingCards || DEFAULT_PRICING_CARDS)];
                        newCards[index] = { ...newCards[index], buttonText: e.target.value };
                        setContentForm({ ...contentForm, pricingCards: newCards });
                      }}
                      className="w-full rounded-control border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-2 focus:outline-brand-600"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-800">Description</label>
                  <textarea aria-label="Description"
                    required
                    value={card.description || ''}
                    onChange={(e) => {
                      const newCards = [...(contentForm.pricingCards || DEFAULT_PRICING_CARDS)];
                      newCards[index] = { ...newCards[index], description: e.target.value };
                      setContentForm({ ...contentForm, pricingCards: newCards });
                    }}
                    className="w-full rounded-control border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-2 focus:outline-brand-600"
                    rows={2}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-800">Features / Bullets (Comma-separated)</label>
                  <input aria-label="Features / Bullets (Comma-separated)"
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
                    className="w-full rounded-control border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-2 focus:outline-brand-600"
                  />
                  <span className="text-xs text-slate-600 block">Separate bullets with commas (e.g. Bullet 1, Bullet 2)</span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2.5 bg-brand-700 hover:bg-brand-800 text-white rounded-control text-sm font-semibold cursor-pointer disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              {isSaving ? 'Saving Changes...' : 'Save Pricing Page Layout Overrides'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
