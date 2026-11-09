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

export default function ContactSection({ db, setDb, adminToken, adminUser, isSaving, run, showFlashMsg, setApiError, onDataChange, contentForm, setContentForm, onSave }: ContentSectionProps) {
  const activeServices = db.services || [];

  return (
    <>
      <div className="space-y-8">
        {/* Contact Us Page Layout Overrides form */}
        <form onSubmit={onSave} className="bg-white border border-gray-200 p-6 rounded-2xl shadow-xs space-y-6">
          <div>
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest font-mono">Contact Us Page Details</h3>
            <p className="text-xs text-gray-400 font-sans mt-0.5">Edit details, addresses, working hours, and coordinates of the office.</p>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-100 space-y-3">
              <span className="text-[10px] uppercase font-mono font-bold text-blue-650">Contact Us Section Headings</span>
              <div className="space-y-2">
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold text-gray-400 font-mono">Heading</label>
                  <input
                    type="text"
                    required
                    value={contentForm.contactHeader || ''}
                    onChange={(e) => setContentForm({ ...contentForm, contactHeader: e.target.value })}
                    className="w-full border border-gray-200 p-2 rounded-lg text-xs bg-white text-gray-900"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold text-gray-400 font-mono">Subtitle Description</label>
                  <textarea
                    required
                    value={contentForm.contactSubtitle || ''}
                    onChange={(e) => setContentForm({ ...contentForm, contactSubtitle: e.target.value })}
                    rows={2}
                    className="w-full border border-gray-200 p-2 rounded-lg text-xs bg-white text-gray-900"
                  ></textarea>
                </div>
              </div>
            </div>

            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-widest font-mono pt-2">Corporate Contact Details &amp; Social Channels</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Office Postal Address</label>
                <input
                  type="text"
                  required
                  value={contentForm.contactAddress || ''}
                  onChange={(e) => setContentForm({ ...contentForm, contactAddress: e.target.value })}
                  className="w-full border border-gray-200 p-2.5 rounded-lg text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Customer Hotline Phone</label>
                <input
                  type="text"
                  required
                  value={contentForm.contactPhone || ''}
                  onChange={(e) => setContentForm({ ...contentForm, contactPhone: e.target.value })}
                  className="w-full border border-gray-200 p-2.5 rounded-lg text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Inquiry Inbox Email</label>
                <input
                  type="email"
                  required
                  value={contentForm.contactEmail || ''}
                  onChange={(e) => setContentForm({ ...contentForm, contactEmail: e.target.value })}
                  className="w-full border border-gray-200 p-2.5 rounded-lg text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Business Working Hours</label>
                <input
                  type="text"
                  required
                  value={contentForm.contactWorkingHours || ''}
                  onChange={(e) => setContentForm({ ...contentForm, contactWorkingHours: e.target.value })}
                  className="w-full border border-gray-200 p-2.5 rounded-lg text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Facebook Page URL</label>
                <input
                  type="url"
                  value={contentForm.facebookUrl || ''}
                  onChange={(e) => setContentForm({ ...contentForm, facebookUrl: e.target.value })}
                  placeholder="https://facebook.com/..."
                  className="w-full border border-gray-200 p-2.5 rounded-lg text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">WhatsApp API Link</label>
                <input
                  type="url"
                  value={contentForm.whatsappUrl || ''}
                  onChange={(e) => setContentForm({ ...contentForm, whatsappUrl: e.target.value })}
                  placeholder="https://wa.me/..."
                  className="w-full border border-gray-200 p-2.5 rounded-lg text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Viber Chat Protocol Link</label>
                <input
                  type="url"
                  value={contentForm.viberUrl || ''}
                  onChange={(e) => setContentForm({ ...contentForm, viberUrl: e.target.value })}
                  placeholder="viber://chat?number=..."
                  className="w-full border border-gray-200 p-2.5 rounded-lg text-xs"
                />
              </div>
            </div>

            {/* Maps embed URL */}
            <div className="space-y-1.5 pt-5 border-t border-gray-100">
              <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Google Maps Embed URL</label>
              <input
                type="url"
                required
                value={contentForm.contactMapEmbedUrl || ''}
                onChange={(e) => setContentForm({ ...contentForm, contactMapEmbedUrl: e.target.value })}
                placeholder="https://www.google.com/maps/embed?..."
                className="w-full border border-gray-200 p-2.5 rounded-lg text-xs"
              />
              <span className="text-[10px] text-gray-400 block">Provide an iframe URL from Google Maps share options to render actual geographical locator markers.</span>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-gray-100">
            <button type="submit" disabled={isSaving} className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer">
              {isSaving ? 'Saving Changes...' : 'Save Contact Page Layout Overrides'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
