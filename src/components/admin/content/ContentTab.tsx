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
import type { AdminTabProps } from '../types.js';
import HomeSection from './HomeSection.js';
import AboutSection from './AboutSection.js';
import ServicesSection from './ServicesSection.js';
import WhySection from './WhySection.js';
import ContactSection from './ContactSection.js';
import PricingSection from './PricingSection.js';

// What every Content section receives: the tab props plus the one shared content form
export interface ContentSectionProps extends AdminTabProps {
  contentForm: Partial<ContentSettings>;
  setContentForm: React.Dispatch<React.SetStateAction<Partial<ContentSettings>>>;
  onSave: (e: React.FormEvent) => Promise<void>;
}

export default function ContentTab({ db, setDb, adminToken, adminUser, isSaving, run, showFlashMsg, setApiError, onDataChange }: AdminTabProps) {
  const activeInquiries = db.inquiries || [];
  const activeServices = db.services || [];
  const activeSentEmails = db.sentEmails || [];
  const activeAdminsList = db.admins || [];

  const [contentForm, setContentForm] = React.useState<Partial<ContentSettings>>(() => db.content);
  const [activeContentSection, setActiveContentSection] = React.useState<'home' | 'about' | 'services' | 'pricing' | 'why' | 'contact'>('home');

  // Content Customizer save
  const handleSaveContent = async (e: React.FormEvent) => {
    e.preventDefault();
    await run(async () => {
      const data = await adminApi('/api/admin/settings/content', adminToken, contentForm, 'Failed to update pages content.');

      setDb(prev => prev ? { ...prev, content: data.content } : prev);
      onDataChange?.();
      showFlashMsg('Website text content customization completed successfully!');
    });
  };




















  // Sections stay mounted (hidden when inactive) so their unsaved drafts survive switching sections
  const sectionProps: ContentSectionProps = { db, setDb, adminToken, adminUser, isSaving, run, showFlashMsg, setApiError, onDataChange, contentForm, setContentForm, onSave: handleSaveContent };

  return (
    <>
    <div className="space-y-6" id="panel-content">
      <div className="border-b border-gray-100 pb-4 mb-4">
        <h2 className="text-xl font-bold text-gray-900 font-sans">Customize Website Pages</h2>
        <p className="text-xs text-gray-500 font-sans mt-1">Directly edit the headlines, paragraphs, mission text, and contact addresses rendered on the home website.</p>
      </div>

      {/* Sub-Navigation for Content Categories */}
      <div className="flex border-b border-gray-200 mb-6 overflow-x-auto whitespace-nowrap scrollbar-hide">
        <button
          type="button"
          onClick={() => { setActiveContentSection('home'); setApiError(''); }}
          className={`py-2.5 px-4 font-sans text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeContentSection === 'home' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          Home Page
        </button>
        <button
          type="button"
          onClick={() => { setActiveContentSection('about'); setApiError(''); }}
          className={`py-2.5 px-4 font-sans text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeContentSection === 'about' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          About Us Page
        </button>
        <button
          type="button"
          onClick={() => { setActiveContentSection('services'); setApiError(''); }}
          className={`py-2.5 px-4 font-sans text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeContentSection === 'services' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          Services Page
        </button>
        <button
          type="button"
          onClick={() => { setActiveContentSection('pricing'); setApiError(''); }}
          className={`py-2.5 px-4 font-sans text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeContentSection === 'pricing' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          Pricing Page
        </button>
        <button
          type="button"
          onClick={() => { setActiveContentSection('why'); setApiError(''); }}
          className={`py-2.5 px-4 font-sans text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeContentSection === 'why' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          Why Choose Us Page
        </button>
        <button
          type="button"
          onClick={() => { setActiveContentSection('contact'); setApiError(''); }}
          className={`py-2.5 px-4 font-sans text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeContentSection === 'contact' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          Contact Us Page
        </button>
      </div>

      {/* 1. HOME PAGE SUB-TAB */}
      <div hidden={activeContentSection !== 'home'}>
        <HomeSection {...sectionProps} />
      </div>

      {/* 2. ABOUT US PAGE SUB-TAB */}
      <div hidden={activeContentSection !== 'about'}>
        <AboutSection {...sectionProps} />
      </div>

      {/* 3. SERVICES PAGE SUB-TAB */}
      <div hidden={activeContentSection !== 'services'}>
        <ServicesSection {...sectionProps} />
      </div>

      {/* 4. WHY CHOOSE US PAGE SUB-TAB */}
      <div hidden={activeContentSection !== 'why'}>
        <WhySection {...sectionProps} />
      </div>

      {/* 5. CONTACT US PAGE SUB-TAB */}
      <div hidden={activeContentSection !== 'contact'}>
        <ContactSection {...sectionProps} />
      </div>

      {/* 6. PRICING PAGE SUB-TAB */}
      <div hidden={activeContentSection !== 'pricing'}>
        <PricingSection {...sectionProps} />
      </div>
    </div>
    </>
  );
}
