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

export default function BrandingTab({ db, setDb, adminToken, adminUser, isSaving, run, showFlashMsg, setApiError, onDataChange }: AdminTabProps) {
  const activeInquiries = db.inquiries || [];
  const activeServices = db.services || [];
  const activeSentEmails = db.sentEmails || [];
  const activeAdminsList = db.admins || [];

  const [brandingForm, setBrandingForm] = React.useState<Partial<BrandingSettings>>(() => db.branding);
  const [logoFileBase64, setLogoFileBase64] = React.useState<string>(() => db.branding.logoImageBase64 || '');
  const [taglineAIPrompt, setTaglineAIPrompt] = React.useState('');
  const [generatedAITaglines, setGeneratedAITaglines] = React.useState('');
  const [isGeneratingTagline, setIsGeneratingTagline] = React.useState(false);

  // Branding Settings update
  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    await run(async () => {
      const data = await adminApi('/api/admin/settings/branding', adminToken, {
          ...brandingForm,
          logoImageBase64: logoFileBase64 || undefined
        }, 'Failed to update branding.');

      setDb(prev => prev ? { ...prev, branding: data.branding } : prev);
      onDataChange?.();
      showFlashMsg('Corporate branding settings saved successfully!');
    });
  };

  // Base64 Logo uploader
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate image format
    if (!file.type.startsWith('image/')) {
      alert('Selected file must be a valid image.');
      return;
    }

    try {
      const base64 = await optimizeImage(file, 300, 300, 0.85);
      setLogoFileBase64(base64);
      setBrandingForm(prev => ({
        ...prev,
        logoType: 'image',
        logoImageBase64: base64
      }));
    } catch (err: any) {
      alert('Error optimizing logo graphic: ' + err.message);
    }
  };

  // Gemini Branding Tagline Assistant
  const handleAITaglineGenerate = async () => {
    if (!taglineAIPrompt) return;
    setIsGeneratingTagline(true);
    setApiError('');
    setGeneratedAITaglines('');
    try {
      const data = await adminApi('/api/admin/generate-tagline', adminToken, { prompt: taglineAIPrompt }, 'Tagline generation failed.');

      setGeneratedAITaglines(data.generatedText);
    } catch (err: any) {
      setApiError(err.message || 'Gemini error.');
    } finally {
      setIsGeneratingTagline(false);
    }
  };

  return (
    <>
    <div className="space-y-6" id="panel-branding">
      <div className="border-b border-gray-100 pb-4 mb-4">
        <h2 className="text-xl font-bold text-gray-900 font-sans">Corporate Branding Settings</h2>
        <p className="text-xs text-gray-500 font-sans mt-1">Configure company name details, layout presets, color themes, and upload direct logo graphics.</p>
      </div>

      {/* Gemini Slogan Assistant */}
      <div className="bg-blue-50 border border-blue-100 p-5 rounded-2xl space-y-3">
        <div className="flex items-center space-x-2 text-blue-800">
          <Icons.Sparkles className="h-5 w-5 animate-pulse" />
          <h3 className="text-sm font-bold font-sans">Gemini AI Slogan & Tagline Assistant</h3>
        </div>
        <p className="text-xs text-gray-600 font-sans">
          Stuck on your tagline? Enter a prompt describing your target audience or key strengths (e.g., "fast response, zero jargon, local support") and let Gemini suggest 3 professional modern taglines.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={taglineAIPrompt}
            onChange={(e) => setTaglineAIPrompt(e.target.value)}
            placeholder="e.g. reliable local network support with absolute transparency..."
            className="flex-grow text-xs border border-blue-200 bg-white rounded-lg p-2.5"
          />
          <button
            type="button"
            onClick={handleAITaglineGenerate}
            disabled={isGeneratingTagline}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2.5 rounded-lg inline-flex items-center shrink-0"
          >
            {isGeneratingTagline ? 'Thinking...' : 'Generate taglines'}
          </button>
        </div>
        {generatedAITaglines && (
          <div className="bg-white border border-blue-100 p-4 rounded-xl text-xs space-y-2 mt-2 shadow-xs">
            <span className="text-[10px] font-mono font-bold text-blue-500 uppercase block">Gemini Slogan Options:</span>
            <pre className="font-sans whitespace-pre-wrap leading-relaxed text-gray-700">{generatedAITaglines}</pre>
          </div>
        )}
      </div>

      {/* Corporate Identity Form */}
      <form onSubmit={handleSaveBranding} className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Company Name */}
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Company Legal Name</label>
            <input
              type="text"
              required
              value={brandingForm.companyName}
              onChange={(e) => setBrandingForm({ ...brandingForm, companyName: e.target.value })}
              className="w-full border border-gray-200 p-2.5 rounded-lg text-xs"
            />
          </div>

          {/* Company Tagline */}
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Company Slogan / Tagline</label>
            <input
              type="text"
              required
              value={brandingForm.tagline}
              onChange={(e) => setBrandingForm({ ...brandingForm, tagline: e.target.value })}
              className="w-full border border-gray-200 p-2.5 rounded-lg text-xs"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Color Theme Selector */}
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Accent Color Palette</label>
            <select
              value={brandingForm.themeColor}
              onChange={(e) => setBrandingForm({ ...brandingForm, themeColor: e.target.value as any })}
              className="w-full border border-gray-200 p-2.5 rounded-lg text-xs bg-white"
            >
              <option value="deepblue">Deep Blue (Innovation & Trust)</option>
              <option value="emerald">Emerald Green (Agility & Growth)</option>
              <option value="slate">Slate Charcoal (Premium Corporate)</option>
              <option value="indigo">Indigo Tech (Modern Startup)</option>
              <option value="violet">Vibrant Violet (Creative Engineering)</option>
            </select>
          </div>

          {/* Logo Type */}
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Active Logo Style</label>
            <select
              value={brandingForm.logoType}
              onChange={(e) => setBrandingForm({ ...brandingForm, logoType: e.target.value as any })}
              className="w-full border border-gray-200 p-2.5 rounded-lg text-xs bg-white"
            >
              <option value="icon">Pre-designed Icon Accent</option>
              <option value="text">Pure Text Branding</option>
              <option value="image">Custom Uploaded Logo Graphic</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start border-t border-gray-50 pt-5">
          {/* Icon Selector (if icon selected) */}
          {brandingForm.logoType === 'icon' && (
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Logo Icon Accent</label>
              <select
                value={brandingForm.logoIcon}
                onChange={(e) => setBrandingForm({ ...brandingForm, logoIcon: e.target.value })}
                className="w-full border border-gray-200 p-2.5 rounded-lg text-xs bg-white"
              >
                <option value="Activity">Activity Pulses</option>
                <option value="Cpu">CPU Tech</option>
                <option value="Terminal">Terminal prompt</option>
                <option value="Database">Database stack</option>
                <option value="HardDrive">Hard Drive</option>
                <option value="Network">Connected nodes</option>
                <option value="Code">Brackets Code</option>
                <option value="ShieldCheck">Shield verified</option>
              </select>
            </div>
          )}

          {/* Text Selector (if text selected) */}
          {brandingForm.logoType === 'text' && (
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Abbreviated Logo Text</label>
              <input
                type="text"
                value={brandingForm.logoText}
                onChange={(e) => setBrandingForm({ ...brandingForm, logoText: e.target.value })}
                className="w-full border border-gray-200 p-2.5 rounded-lg text-xs"
              />
            </div>
          )}
        </div>

        {/* Permanent dynamic logo & favicon uploader */}
        <div className="border-t border-gray-100 pt-5 space-y-4">
          <h3 className="text-xs font-bold text-gray-900 uppercase tracking-widest font-mono">Favicon & Corporate Logo Graphic</h3>
          <p className="text-[10px] text-gray-500 font-sans">Upload your company logo image (SVG, PNG, or JPG format). It will dynamically set the website's browser tab favicon and shortcuts instantly.</p>
          
          <div className="flex flex-wrap items-center gap-4">
            <label className="cursor-pointer bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-lg text-xs font-semibold inline-flex items-center space-x-2 transition-all cursor-pointer">
              <Icons.Upload className="h-4 w-4" />
              <span>Choose Logo Graphic...</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
            </label>

            {logoFileBase64 && (
              <>
                <div className="flex items-center space-x-3 bg-slate-50 p-2 rounded-xl border border-slate-100">
                  <div className="border p-1.5 rounded-lg bg-white shadow-xs">
                    <img src={logoFileBase64} alt="Dynamic Favicon Preview" className="h-8 w-8 object-contain" referrerPolicy="no-referrer" />
                  </div>
                  <div className="text-[10px] font-sans">
                    <span className="text-slate-400 block font-mono">Favicon Status</span>
                    <span className="font-bold text-emerald-600 uppercase">Dynamic Sync Active</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setLogoFileBase64('');
                    setBrandingForm(prev => ({
                      ...prev,
                      logoType: 'icon',
                      logoImageBase64: undefined
                    }));
                  }}
                  className="px-4 py-2.5 border border-red-200 hover:bg-red-50 text-red-650 text-xs font-semibold rounded-lg cursor-pointer"
                >
                  Remove Logo Image
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-gray-100">
          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold"
          >
            {isSaving ? 'Saving Changes...' : 'Save Corporate Branding'}
          </button>
        </div>
      </form>
    </div>
    </>
  );
}
