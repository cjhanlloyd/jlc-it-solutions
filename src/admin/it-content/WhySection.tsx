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

export default function WhySection({ db, setDb, adminToken, adminUser, isSaving, run, showFlashMsg, setApiError, onDataChange, contentForm, setContentForm, onSave }: ContentSectionProps) {
  const activeServices = db.services || [];

  return (
    <>
      <div className="space-y-8">
        {/* Why Choose Us Page Layout Overrides form */}
        <form onSubmit={onSave} className="bg-white border border-slate-200 p-5 rounded-card shadow-card space-y-6">
          <div>
            <h3 className="font-display text-lg font-semibold text-slate-900">Why Choose Us Page Details</h3>
            <p className="text-xs text-slate-600 mt-0.5">Edit points, promise highlights, and landing CTA details.</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-800">Section Header Paragraph</label>
              <textarea aria-label="Section Header Paragraph"
                required
                value={contentForm.whyChooseUsText || ''}
                onChange={(e) => setContentForm({ ...contentForm, whyChooseUsText: e.target.value })}
                rows={3}
                className="w-full rounded-control border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-2 focus:outline-brand-600"
              ></textarea>
            </div>

            {/* Promises/Trust block left side */}
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-800">Left Column Promise Header</label>
                <input aria-label="Left Column Promise Header"
                  type="text"
                  required
                  value={contentForm.whyChooseUsPromiseTitle || ''}
                  onChange={(e) => setContentForm({ ...contentForm, whyChooseUsPromiseTitle: e.target.value })}
                  className="w-full rounded-control border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-2 focus:outline-brand-600"
                  placeholder="Stable Future Engineering Commitments"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-800">Left Column Promise Paragraph</label>
                <textarea aria-label="Left Column Promise Paragraph"
                  required
                  value={contentForm.whyChooseUsPromiseDesc || ''}
                  onChange={(e) => setContentForm({ ...contentForm, whyChooseUsPromiseDesc: e.target.value })}
                  rows={2}
                  className="w-full rounded-control border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-2 focus:outline-brand-600"
                ></textarea>
              </div>
            </div>

            {/* Promises list */}
            <div className="space-y-4 border-t border-slate-100 pt-5 mt-5">
              <h4 className="font-display text-lg font-semibold text-slate-900">Left Column Trust Guarantees</h4>
              <p className="text-xs text-slate-600">Modify the titles and descriptions of the 3 promises shown on the left of the Why Choose Us section.</p>
              
              <div className="grid grid-cols-1 gap-6">
                {(contentForm.whyChooseUsPromises || DEFAULT_WHY_PROMISES).map((prom: any, index: number) => (
                  <div key={prom.id} className="p-4 bg-slate-50/50 rounded-card border border-slate-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-800">Promise #{index + 1}</span>
                      <span className="text-xs text-slate-600">ID: {prom.id}</span>
                    </div>
                    
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-600">Title</label>
                      <input aria-label="Title"
                        type="text"
                        required
                        value={prom.title}
                        onChange={(e) => {
                          const newProms = [...(contentForm.whyChooseUsPromises || DEFAULT_WHY_PROMISES)];
                          newProms[index] = { ...prom, title: e.target.value };
                          setContentForm({ ...contentForm, whyChooseUsPromises: newProms });
                        }}
                        className="w-full rounded-control border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-2 focus:outline-brand-600"
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-600">Description</label>
                      <textarea aria-label="Description"
                        required
                        value={prom.description}
                        onChange={(e) => {
                          const newProms = [...(contentForm.whyChooseUsPromises || DEFAULT_WHY_PROMISES)];
                          newProms[index] = { ...prom, description: e.target.value };
                          setContentForm({ ...contentForm, whyChooseUsPromises: newProms });
                        }}
                        rows={2}
                        className="w-full rounded-control border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-2 focus:outline-brand-600"
                      ></textarea>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Dynamic feature cards accordion style */}
            <div className="space-y-4 border-t border-slate-100 pt-5 mt-5">
              <h3 className="font-display text-lg font-semibold text-slate-900">Right Column Value Highlights</h3>
              <p className="text-xs text-slate-600">Modify the titles, descriptions, and icon styles representing the 4 core guarantees shown on the homepage.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {(contentForm.whyChooseUsPoints || []).map((point: any, index: number) => (
                  <div key={point.id} className="p-4 bg-slate-50/50 rounded-card border border-slate-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-800">Card #{index + 1}</span>
                      <span className="text-xs text-slate-600">ID: {point.id}</span>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-600">Title</label>
                        <input aria-label="Title"
                          type="text"
                          required
                          value={point.title}
                          onChange={(e) => {
                            const newPoints = [...(contentForm.whyChooseUsPoints || [])];
                            newPoints[index] = { ...point, title: e.target.value };
                            setContentForm({ ...contentForm, whyChooseUsPoints: newPoints });
                          }}
                          className="w-full rounded-control border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-2 focus:outline-brand-600"
                        />
                      </div>
                      
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-600">Icon Name</label>
                        <select aria-label="Icon Name"
                          value={point.iconName}
                          onChange={(e) => {
                            const newPoints = [...(contentForm.whyChooseUsPoints || [])];
                            newPoints[index] = { ...point, iconName: e.target.value };
                            setContentForm({ ...contentForm, whyChooseUsPoints: newPoints });
                          }}
                          className="w-full cursor-pointer rounded-control border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-2 focus:outline-brand-600"
                        >
                          <option value="Heart">Heart (Love)</option>
                          <option value="CheckCircle">CheckCircle (Checkmark)</option>
                          <option value="MessageSquare">MessageSquare (Bubble)</option>
                          <option value="Lock">Lock (Security)</option>
                          <option value="Cpu">Cpu (Tech)</option>
                          <option value="ShieldCheck">ShieldCheck (Shield)</option>
                          <option value="Zap">Zap (Lightning)</option>
                          <option value="Award">Award (Badge)</option>
                        </select>
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-600">Description</label>
                      <textarea aria-label="Description"
                        required
                        value={point.description}
                        onChange={(e) => {
                          const newPoints = [...(contentForm.whyChooseUsPoints || [])];
                          newPoints[index] = { ...point, description: e.target.value };
                          setContentForm({ ...contentForm, whyChooseUsPoints: newPoints });
                        }}
                        rows={3}
                        className="w-full rounded-control border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-2 focus:outline-brand-600"
                      ></textarea>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Closing CTA Box Customizer */}
            <div className="space-y-3 pt-4 border-t border-slate-100 mt-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-800">CTA Banner Title</label>
                <input aria-label="CTA Banner Title"
                  type="text"
                  required
                  value={contentForm.whyChooseUsCtaTitle || ''}
                  onChange={(e) => setContentForm({ ...contentForm, whyChooseUsCtaTitle: e.target.value })}
                  className="w-full rounded-control border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-2 focus:outline-brand-600"
                  placeholder="Need a tailor-made technological solution?"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-800">CTA Banner Description</label>
                <textarea aria-label="CTA Banner Description"
                  required
                  value={contentForm.whyChooseUsCtaDesc || ''}
                  onChange={(e) => setContentForm({ ...contentForm, whyChooseUsCtaDesc: e.target.value })}
                  rows={3}
                  className="w-full rounded-control border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-2 focus:outline-brand-600"
                ></textarea>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button type="submit" disabled={isSaving} className="px-4 py-2.5 bg-brand-700 hover:bg-brand-800 text-white rounded-control text-sm font-semibold cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
              {isSaving ? 'Saving Changes...' : 'Save Why Choose Us Page Layout Overrides'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
