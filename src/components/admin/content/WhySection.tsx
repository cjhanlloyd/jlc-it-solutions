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

export default function WhySection({ db, setDb, adminToken, adminUser, isSaving, run, showFlashMsg, setApiError, onDataChange, contentForm, setContentForm, onSave }: ContentSectionProps) {
  const activeServices = db.services || [];

  return (
    <>
      <div className="space-y-8">
        {/* Why Choose Us Page Layout Overrides form */}
        <form onSubmit={onSave} className="bg-white border border-gray-200 p-6 rounded-2xl shadow-xs space-y-6">
          <div>
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest font-mono">Why Choose Us Page Details</h3>
            <p className="text-xs text-gray-400 font-sans mt-0.5">Edit points, promise highlights, and landing CTA details.</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Section Header Paragraph</label>
              <textarea
                required
                value={contentForm.whyChooseUsText || ''}
                onChange={(e) => setContentForm({ ...contentForm, whyChooseUsText: e.target.value })}
                rows={3}
                className="w-full border border-gray-200 p-2.5 rounded-lg text-xs"
              ></textarea>
            </div>

            {/* Promises/Trust block left side */}
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Left Column Promise Header</label>
                <input
                  type="text"
                  required
                  value={contentForm.whyChooseUsPromiseTitle || ''}
                  onChange={(e) => setContentForm({ ...contentForm, whyChooseUsPromiseTitle: e.target.value })}
                  className="w-full border border-gray-200 p-2.5 rounded-lg text-xs"
                  placeholder="Stable Future Engineering Commitments"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Left Column Promise Paragraph</label>
                <textarea
                  required
                  value={contentForm.whyChooseUsPromiseDesc || ''}
                  onChange={(e) => setContentForm({ ...contentForm, whyChooseUsPromiseDesc: e.target.value })}
                  rows={2}
                  className="w-full border border-gray-200 p-2.5 rounded-lg text-xs"
                ></textarea>
              </div>
            </div>

            {/* Promises list */}
            <div className="space-y-4 border-t border-gray-100 pt-5 mt-5">
              <h4 className="text-xs font-bold text-gray-900 uppercase tracking-widest font-mono">Left Column Trust Guarantees</h4>
              <p className="text-[10px] text-gray-500 font-sans">Modify the titles and descriptions of the 3 promises shown on the left of the Why Choose Us section.</p>
              
              <div className="grid grid-cols-1 gap-6">
                {(contentForm.whyChooseUsPromises || DEFAULT_WHY_PROMISES).map((prom: any, index: number) => (
                  <div key={prom.id} className="p-4 bg-slate-50/50 rounded-xl border border-slate-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-mono font-bold text-blue-600">Promise #{index + 1}</span>
                      <span className="text-[10px] font-mono text-gray-400">ID: {prom.id}</span>
                    </div>
                    
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase font-bold text-gray-400 font-mono">Title</label>
                      <input
                        type="text"
                        required
                        value={prom.title}
                        onChange={(e) => {
                          const newProms = [...(contentForm.whyChooseUsPromises || DEFAULT_WHY_PROMISES)];
                          newProms[index] = { ...prom, title: e.target.value };
                          setContentForm({ ...contentForm, whyChooseUsPromises: newProms });
                        }}
                        className="w-full border border-gray-200 p-2 rounded-lg text-xs bg-white text-gray-900"
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase font-bold text-gray-400 font-mono">Description</label>
                      <textarea
                        required
                        value={prom.description}
                        onChange={(e) => {
                          const newProms = [...(contentForm.whyChooseUsPromises || DEFAULT_WHY_PROMISES)];
                          newProms[index] = { ...prom, description: e.target.value };
                          setContentForm({ ...contentForm, whyChooseUsPromises: newProms });
                        }}
                        rows={2}
                        className="w-full border border-gray-200 p-2 rounded-lg text-xs bg-white text-gray-900"
                      ></textarea>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Dynamic feature cards accordion style */}
            <div className="space-y-4 border-t border-gray-100 pt-5 mt-5">
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-widest font-mono">Right Column Value Highlights</h3>
              <p className="text-[10px] text-gray-500 font-sans">Modify the titles, descriptions, and icon styles representing the 4 core guarantees shown on the homepage.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {(contentForm.whyChooseUsPoints || []).map((point: any, index: number) => (
                  <div key={point.id} className="p-4 bg-slate-50/50 rounded-xl border border-slate-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-mono font-bold text-blue-655">Card #{index + 1}</span>
                      <span className="text-[10px] font-mono text-gray-400">ID: {point.id}</span>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] uppercase font-bold text-gray-400 font-mono">Title</label>
                        <input
                          type="text"
                          required
                          value={point.title}
                          onChange={(e) => {
                            const newPoints = [...(contentForm.whyChooseUsPoints || [])];
                            newPoints[index] = { ...point, title: e.target.value };
                            setContentForm({ ...contentForm, whyChooseUsPoints: newPoints });
                          }}
                          className="w-full border border-gray-200 p-2 rounded-lg text-xs bg-white text-gray-900"
                        />
                      </div>
                      
                      <div className="space-y-1">
                        <label className="text-[9px] uppercase font-bold text-gray-400 font-mono">Icon Name</label>
                        <select
                          value={point.iconName}
                          onChange={(e) => {
                            const newPoints = [...(contentForm.whyChooseUsPoints || [])];
                            newPoints[index] = { ...point, iconName: e.target.value };
                            setContentForm({ ...contentForm, whyChooseUsPoints: newPoints });
                          }}
                          className="w-full border border-gray-200 p-2.5 rounded-lg text-xs bg-white text-gray-805 cursor-pointer"
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
                      <label className="text-[9px] uppercase font-bold text-gray-400 font-mono">Description</label>
                      <textarea
                        required
                        value={point.description}
                        onChange={(e) => {
                          const newPoints = [...(contentForm.whyChooseUsPoints || [])];
                          newPoints[index] = { ...point, description: e.target.value };
                          setContentForm({ ...contentForm, whyChooseUsPoints: newPoints });
                        }}
                        rows={3}
                        className="w-full border border-gray-200 p-2 rounded-lg text-xs bg-white text-gray-900"
                      ></textarea>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Closing CTA Box Customizer */}
            <div className="space-y-3 pt-4 border-t border-slate-105 mt-4">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">CTA Banner Title</label>
                <input
                  type="text"
                  required
                  value={contentForm.whyChooseUsCtaTitle || ''}
                  onChange={(e) => setContentForm({ ...contentForm, whyChooseUsCtaTitle: e.target.value })}
                  className="w-full border border-gray-200 p-2.5 rounded-lg text-xs"
                  placeholder="Need a tailor-made technological solution?"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">CTA Banner Description</label>
                <textarea
                  required
                  value={contentForm.whyChooseUsCtaDesc || ''}
                  onChange={(e) => setContentForm({ ...contentForm, whyChooseUsCtaDesc: e.target.value })}
                  rows={3}
                  className="w-full border border-gray-200 p-2.5 rounded-lg text-xs"
                ></textarea>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-gray-100">
            <button type="submit" disabled={isSaving} className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer">
              {isSaving ? 'Saving Changes...' : 'Save Why Choose Us Page Layout Overrides'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
