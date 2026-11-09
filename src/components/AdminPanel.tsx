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
} from '../types.js';
import { optimizeImage } from './admin/images.js';
import ContentTab from './admin/content/ContentTab.js';
import AccountsTab from './admin/AccountsTab.js';
import EmailTab from './admin/EmailTab.js';
import BrandingTab from './admin/BrandingTab.js';
import LogsTab from './admin/LogsTab.js';
import InquiriesTab from './admin/InquiriesTab.js';


interface AdminPanelProps {
  adminToken: string;
  adminUser: { email: string; role: AdminRole; fullName: string };
  onLogout: () => void;
  branding: BrandingSettings;
  onDataChange?: () => void;
}

export default function AdminPanel({ adminToken, adminUser, onLogout, branding, onDataChange }: AdminPanelProps) {
  const [activeSubTab, setActiveSubTab] = React.useState<'inquiries' | 'services' | 'branding' | 'content' | 'email' | 'accounts' | 'logs'>('inquiries');
  const [db, setDb] = React.useState<WebsiteData | null>(null);
  const [systemLogs, setSystemLogs] = React.useState<{ timestamp: string; type: string; message: string }[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [apiError, setApiError] = React.useState('');
  const [successMsg, setSuccessMsg] = React.useState('');

  // Local state for Services CRUD

  // Local state for Branding

  // Local state for Page Content

  // Local state for Email Templates

  // Local state for Admin accounts

  // Local state for FAQs, Roadmap, and Collaboration Process CRUD

  // Local state for Gemini Tagline Prompt

  // Local state for Inquiry Active View & AI Reply Assistant

  // Fetch admin data on load
  const fetchAdminData = async () => {
    setIsLoading(true);
    setApiError('');
    try {
      const response = await fetch('/api/admin/data', {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch administrator data.');
      }
      setDb(data.db);
      setSystemLogs(data.systemLogs);
      // Tabs initialise their own forms from db when they mount
    } catch (err: any) {
      setApiError(err.message || 'Server error loading data.');
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    fetchAdminData();
  }, [adminToken]);

  // Flash messages helper
  const showFlashMsg = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  // Shared save wrapper for tabs: saving flag, error banner, success toast
  const run = async (task: () => Promise<void>, successMsg?: string) => {
    setIsSaving(true);
    setApiError('');
    try {
      await task();
      if (successMsg) showFlashMsg(successMsg);
    } catch (err: any) {
      setApiError(err.message);
    } finally {
      setIsSaving(false);
    }
  };




































  // Main Loader
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-white space-y-4" id="admin-main-loader">
        <Icons.Loader className="h-10 w-10 text-blue-600 animate-spin" />
        <span className="text-sm font-semibold text-gray-500 font-mono uppercase tracking-widest">Loading Admin Control Panel...</span>
      </div>
    );
  }

  const activeInquiries = db?.inquiries || [];
  const activeServices = db?.services || [];
  const activeSentEmails = db?.sentEmails || [];
  const activeAdminsList = db?.admins || [];

  // Every tab stays mounted (hidden when inactive) so unsaved edits survive switching tabs
  const tabProps = db ? { db, setDb, adminToken, adminUser, isSaving, run, showFlashMsg, setApiError, onDataChange } : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10" id="admin-dashboard-root">
      
      {/* Admin Panel Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-100 pb-6 mb-8 gap-4">
        <div>
          <span className="text-xs uppercase font-mono font-bold text-gray-400 tracking-widest">Corporate Dashboard</span>
          <h1 className="text-3xl font-black text-gray-900 font-sans tracking-tight">Admin Operations Center</h1>
          <div className="flex items-center space-x-2 mt-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 font-sans">
              {adminUser.role}
            </span>
            <span className="text-xs text-gray-400 font-sans">Logged in as <strong>{adminUser.fullName}</strong></span>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="inline-flex items-center px-4 py-2 border border-gray-200 text-sm font-semibold text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
          id="admin-logout-btn"
        >
          <Icons.LogOut className="h-4 w-4 mr-2" />
          Logout Administrative Session
        </button>
      </div>

      {/* Notifications */}
      {apiError && (
        <div className="p-4 mb-6 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-start space-x-3 shadow-xs" id="admin-error-banner">
          <Icons.AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <span>{apiError}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-4 mb-6 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm flex items-start space-x-3 shadow-xs" id="admin-success-banner">
          <Icons.CheckCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Main Grid Layout: Left Nav Sidebar, Right Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Navigation Sidebar */}
        <div className="lg:col-span-3 bg-white p-5 rounded-2xl border border-gray-100 shadow-xs space-y-1">
          <h3 className="text-[10px] uppercase font-mono font-bold tracking-widest text-gray-400 px-3 mb-3">Management Options</h3>
          
          <button
            onClick={() => { setActiveSubTab('inquiries'); setApiError(''); }}
            className={`w-full text-left flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeSubTab === 'inquiries' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <span className="flex items-center">
              <Icons.Inbox className="h-4 w-4 mr-3 shrink-0" />
              Client Inquiries
            </span>
            {activeInquiries.filter(i => i.status === 'New').length > 0 && (
              <span className="bg-red-500 text-white font-mono text-[10px] font-bold px-2 py-0.5 rounded-full">
                {activeInquiries.filter(i => i.status === 'New').length} new
              </span>
            )}
          </button>


          <button
            onClick={() => { setActiveSubTab('branding'); setApiError(''); }}
            className={`w-full text-left flex items-center px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeSubTab === 'branding' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <Icons.Sparkles className="h-4 w-4 mr-3 shrink-0" />
            Branding & Logo
          </button>

          <button
            onClick={() => { setActiveSubTab('content'); setApiError(''); }}
            className={`w-full text-left flex items-center px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeSubTab === 'content' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <Icons.FileText className="h-4 w-4 mr-3 shrink-0" />
            Page Content
          </button>

          <button
            onClick={() => { setActiveSubTab('email'); setApiError(''); }}
            className={`w-full text-left flex items-center px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeSubTab === 'email' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <Icons.Mail className="h-4 w-4 mr-3 shrink-0" />
            Email Templates
          </button>

          <button
            onClick={() => { setActiveSubTab('accounts'); setApiError(''); }}
            className={`w-full text-left flex items-center px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeSubTab === 'accounts' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <Icons.Users className="h-4 w-4 mr-3 shrink-0" />
            Admin Accounts
          </button>

          <button
            onClick={() => { setActiveSubTab('logs'); setApiError(''); }}
            className={`w-full text-left flex items-center px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeSubTab === 'logs' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <Icons.Activity className="h-4 w-4 mr-3 shrink-0" />
            System & Logs
          </button>
        </div>

        {/* Right Tab Content View */}
        <div className="lg:col-span-9 bg-white rounded-2xl border border-gray-100 p-6 sm:p-8 shadow-xs">
          
          {/* TAB 1: CLIENT INQUIRIES & AI ASSISTANT */}
          {tabProps && (
            <div hidden={activeSubTab !== 'inquiries'}>
              <InquiriesTab {...tabProps} />
            </div>
          )}


          {/* TAB 2: SERVICES MANAGEMENT CRUD */}


          {/* TAB 3: BRANDING & SLOGANS */}
          {tabProps && (
            <div hidden={activeSubTab !== 'branding'}>
              <BrandingTab {...tabProps} />
            </div>
          )}


          {/* TAB 4: PAGE CONTENT CUSTOMIZER */}
          {tabProps && (
            <div hidden={activeSubTab !== 'content'}>
              <ContentTab {...tabProps} />
            </div>
          )}


          {/* TAB 5: EMAIL TEMPLATES & SMTP */}
          {tabProps && (
            <div hidden={activeSubTab !== 'email'}>
              <EmailTab {...tabProps} />
            </div>
          )}


          {/* TAB 6: ADMIN ACCOUNTS */}
          {tabProps && (
            <div hidden={activeSubTab !== 'accounts'}>
              <AccountsTab {...tabProps} reload={fetchAdminData} />
            </div>
          )}


          {/* TAB 7: ANALYTICS & ACTIVITY LOGS */}
          {tabProps && (
            <div hidden={activeSubTab !== 'logs'}>
              <LogsTab {...tabProps} systemLogs={systemLogs} />
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
