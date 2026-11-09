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
} from '../../types.js';
import { adminApi } from './api.js';
import { optimizeImage } from './images.js';
import type { AdminTabProps } from './types.js';

export default function EmailTab({ db, setDb, adminToken, adminUser, isSaving, run, showFlashMsg, setApiError, onDataChange }: AdminTabProps) {
  const activeInquiries = db.inquiries || [];
  const activeServices = db.services || [];
  const activeSentEmails = db.sentEmails || [];
  const activeAdminsList = db.admins || [];

  const [emailTemplateForm, setEmailTemplateForm] = React.useState<Partial<EmailTemplate>>(() => db.emailTemplate);
  const [smtpForm, setSmtpForm] = React.useState<Partial<SmtpSettings>>(() => db.smtpSettings ?? {});

  // Acknowledgment template customizer
  const handleSaveEmailTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    await run(async () => {
      const data = await adminApi('/api/admin/email-template', adminToken, emailTemplateForm, 'Failed to update template.');

      setDb(prev => prev ? { ...prev, emailTemplate: data.emailTemplate } : prev);
      showFlashMsg('Automated acknowledgment email template saved!');
    });
  };

  const handleSaveSmtpSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await run(async () => {
      const data = await adminApi('/api/admin/settings/smtp', adminToken, smtpForm, 'Failed to save SMTP settings.');
      setDb(prev => prev ? { ...prev, smtpSettings: data.smtpSettings } : prev);
      showFlashMsg('SMTP Mail Configuration saved successfully!');
    });
  };

  return (
    <>
    <div className="space-y-8" id="panel-email">
      {/* SMTP Settings card */}
      <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-xs space-y-6">
        <div className="border-b border-gray-100 pb-4">
          <h2 className="text-xl font-bold text-gray-900 font-sans">SMTP Mail Server Settings</h2>
          <p className="text-xs text-gray-500 font-sans mt-1">Configure actual SMTP credentials to trigger live notification emails and automated auto-acknowledgments to clients.</p>
        </div>
        
        <form onSubmit={handleSaveSmtpSettings} className="space-y-4">
          <div className="flex items-center space-x-3 pb-2">
            <input
              type="checkbox"
              id="smtp-enabled"
              checked={smtpForm.enabled || false}
              onChange={(e) => setSmtpForm({ ...smtpForm, enabled: e.target.checked })}
              className="h-4.5 w-4.5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer animate-none"
            />
            <label htmlFor="smtp-enabled" className="text-xs font-bold text-gray-900 cursor-pointer font-sans select-none">
              Enable Live SMTP Email Deliveries
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">SMTP Server Host</label>
              <input
                type="text"
                required
                disabled={!smtpForm.enabled}
                value={smtpForm.host || ''}
                onChange={(e) => setSmtpForm({ ...smtpForm, host: e.target.value })}
                placeholder="e.g. smtp.gmail.com"
                className="w-full border border-gray-200 p-2.5 rounded-lg text-xs disabled:bg-slate-50 disabled:text-slate-400"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">SMTP Server Port</label>
              <input
                type="number"
                required
                disabled={!smtpForm.enabled}
                value={smtpForm.port || 587}
                onChange={(e) => setSmtpForm({ ...smtpForm, port: parseInt(e.target.value, 10) })}
                placeholder="e.g. 587"
                className="w-full border border-gray-200 p-2.5 rounded-lg text-xs disabled:bg-slate-50 disabled:text-slate-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Username</label>
              <input
                type="text"
                required={smtpForm.enabled}
                disabled={!smtpForm.enabled}
                value={smtpForm.username || ''}
                onChange={(e) => setSmtpForm({ ...smtpForm, username: e.target.value })}
                placeholder="Username/Email"
                className="w-full border border-gray-200 p-2.5 rounded-lg text-xs disabled:bg-slate-50 disabled:text-slate-400"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Password</label>
              <input
                type="password"
                required={smtpForm.enabled}
                disabled={!smtpForm.enabled}
                value={smtpForm.password || ''}
                onChange={(e) => setSmtpForm({ ...smtpForm, password: e.target.value })}
                placeholder="Password"
                className="w-full border border-gray-200 p-2.5 rounded-lg text-xs disabled:bg-slate-50 disabled:text-slate-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Sender Name</label>
              <input
                type="text"
                required
                disabled={!smtpForm.enabled}
                value={smtpForm.senderName || ''}
                onChange={(e) => setSmtpForm({ ...smtpForm, senderName: e.target.value })}
                placeholder="JLC Solutions Support"
                className="w-full border border-gray-200 p-2.5 rounded-lg text-xs disabled:bg-slate-50 disabled:text-slate-400"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Sender Email</label>
              <input
                type="email"
                required
                disabled={!smtpForm.enabled}
                value={smtpForm.senderEmail || ''}
                onChange={(e) => setSmtpForm({ ...smtpForm, senderEmail: e.target.value })}
                placeholder="contact@jlcsolutions.com"
                className="w-full border border-gray-200 p-2.5 rounded-lg text-xs disabled:bg-slate-50 disabled:text-slate-400"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Email Signature</label>
            <textarea
              disabled={!smtpForm.enabled}
              value={smtpForm.signature || ''}
              onChange={(e) => setSmtpForm({ ...smtpForm, signature: e.target.value })}
              rows={3}
              placeholder="Best regards,..."
              className="w-full border border-gray-200 p-2.5 rounded-lg text-xs disabled:bg-slate-50 disabled:text-slate-400"
            ></textarea>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
            >
              {isSaving ? 'Saving...' : 'Save SMTP Settings'}
            </button>
          </div>
        </form>
      </div>

      {/* Template card */}
      <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-xs space-y-6">
        <div className="border-b border-gray-100 pb-4">
          <h2 className="text-xl font-bold text-gray-900 font-sans">Automated Email Template</h2>
          <p className="text-xs text-gray-500 font-sans mt-1">Customize the subject lines and paragraph layout template for immediate user feedback emails upon inquiry submission.</p>
        </div>

        {/* Form Customizer */}
        <form onSubmit={handleSaveEmailTemplate} className="space-y-6">
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Email Subject Line</label>
            <input
              type="text"
              required
              value={emailTemplateForm.subject || ''}
              onChange={(e) => setEmailTemplateForm({ ...emailTemplateForm, subject: e.target.value })}
              className="w-full border border-gray-200 p-2.5 rounded-lg text-xs font-bold"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Email Body Text Markup</label>
            <textarea
              required
              value={emailTemplateForm.body || ''}
              onChange={(e) => setEmailTemplateForm({ ...emailTemplateForm, body: e.target.value })}
              rows={10}
              className="w-full border border-gray-200 p-3 rounded-lg text-xs font-mono leading-relaxed bg-gray-50 text-gray-700"
            ></textarea>
          </div>

          {/* Help on dynamic fields */}
          <div className="bg-yellow-50 border border-yellow-100 p-4 rounded-xl text-xs text-yellow-800 space-y-1.5">
            <h4 className="font-bold font-sans">Dynamic replacement parameters:</h4>
            <p>Incorporate the following parameter keywords to automatically populate the customized email on submission:</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[10px] font-bold text-yellow-900 pt-1">
              <span>{"{{name}}"} - Full Name</span>
              <span>{"{{service}}"} - Service required</span>
              <span>{"{{projectDescription}}"} - Description</span>
              <span>{"{{preferredContact}}"} - Method</span>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-gray-100">
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              {isSaving ? 'Saving Changes...' : 'Save Acknowledgment Template'}
            </button>
          </div>
        </form>
      </div>
    </div>
    </>
  );
}
