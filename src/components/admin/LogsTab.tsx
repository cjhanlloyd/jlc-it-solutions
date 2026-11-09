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

export default function LogsTab({ db, setDb, adminToken, adminUser, isSaving, run, showFlashMsg, setApiError, onDataChange, systemLogs }: AdminTabProps & { systemLogs: { timestamp: string; type: string; message: string }[] }) {
  const activeInquiries = db.inquiries || [];
  const activeServices = db.services || [];
  const activeSentEmails = db.sentEmails || [];
  const activeAdminsList = db.admins || [];



  // Service Required Trend calculation for Analytics
  const getServiceTrendData = () => {
    if (!db || !db.inquiries) return [];
    const counts: Record<string, number> = {};
    db.inquiries.forEach(inq => {
      counts[inq.serviceRequired] = (counts[inq.serviceRequired] || 0) + 1;
    });
    return Object.keys(counts).map(key => ({ service: key, count: counts[key] }));
  };

  const getStatusBreakdown = () => {
    if (!db || !db.inquiries) return { new: 0, progress: 0, completed: 0, closed: 0 };
    let newInqs = 0, progress = 0, completed = 0, closed = 0;
    db.inquiries.forEach(inq => {
      if (inq.status === 'New') newInqs++;
      else if (inq.status === 'In Progress') progress++;
      else if (inq.status === 'Completed') completed++;
      else if (inq.status === 'Closed') closed++;
    });
    return { new: newInqs, progress, completed, closed };
  };

  return (
    <>
    <div className="space-y-8" id="panel-logs">
      <div className="border-b border-gray-100 pb-4 mb-4">
        <h2 className="text-xl font-bold text-gray-900 font-sans">Analytics & System Activity</h2>
        <p className="text-xs text-gray-500 font-sans mt-1">Monitor inquiry stats, review automated acknowledgment outputs, and audit real-time console server events.</p>
      </div>

      {/* Simple Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="border border-gray-100 p-4 rounded-xl bg-gray-50/50">
          <span className="text-[10px] uppercase font-bold text-gray-400 font-mono">Total Inquiries</span>
          <span className="text-2xl font-black text-gray-900 block mt-1 font-sans">{activeInquiries.length}</span>
        </div>
        <div className="border border-gray-100 p-4 rounded-xl bg-gray-50/50">
          <span className="text-[10px] uppercase font-bold text-gray-400 font-mono">Pending Inquiries</span>
          <span className="text-2xl font-black text-red-600 block mt-1 font-sans">{getStatusBreakdown().new}</span>
        </div>
        <div className="border border-gray-100 p-4 rounded-xl bg-gray-50/50">
          <span className="text-[10px] uppercase font-bold text-gray-400 font-mono">Simulated Emails</span>
          <span className="text-2xl font-black text-emerald-600 block mt-1 font-sans">{activeSentEmails.length}</span>
        </div>
        <div className="border border-gray-100 p-4 rounded-xl bg-gray-50/50">
          <span className="text-[10px] uppercase font-bold text-gray-400 font-mono">Dynamic Services</span>
          <span className="text-2xl font-black text-blue-600 block mt-1 font-sans">{activeServices.length}</span>
        </div>
      </div>

      {/* Inquiry Status Chart breakdown (SVG-based, precise, robust) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* SVG Status Breakdown */}
        <div className="border border-gray-100 p-5 rounded-2xl bg-white space-y-4">
          <h4 className="text-xs uppercase font-mono font-bold text-gray-400 tracking-wider">Inquiry Status Breakdown</h4>
          
          <div className="space-y-3 pt-2">
            {/* New */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-semibold text-gray-700">
                <span>New (Unprocessed)</span>
                <span>{getStatusBreakdown().new}</span>
              </div>
              <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-red-500 rounded-full transition-all duration-500" 
                  style={{ width: `${activeInquiries.length > 0 ? (getStatusBreakdown().new / activeInquiries.length) * 100 : 0}%` }}
                ></div>
              </div>
            </div>

            {/* In Progress */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-semibold text-gray-700">
                <span>In Progress (Responding)</span>
                <span>{getStatusBreakdown().progress}</span>
              </div>
              <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-yellow-500 rounded-full transition-all duration-500" 
                  style={{ width: `${activeInquiries.length > 0 ? (getStatusBreakdown().progress / activeInquiries.length) * 100 : 0}%` }}
                ></div>
              </div>
            </div>

            {/* Completed */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-semibold text-gray-700">
                <span>Completed (Resolved)</span>
                <span>{getStatusBreakdown().completed}</span>
              </div>
              <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500" 
                  style={{ width: `${activeInquiries.length > 0 ? (getStatusBreakdown().completed / activeInquiries.length) * 100 : 0}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* SVG Service Popularity */}
        <div className="border border-gray-100 p-5 rounded-2xl bg-white space-y-4">
          <h4 className="text-xs uppercase font-mono font-bold text-gray-400 tracking-wider">Service Inquiry Distribution</h4>
          
          {getServiceTrendData().length === 0 ? (
            <div className="text-center py-6 text-xs text-gray-400 font-sans">No data trends to analyze yet.</div>
          ) : (
            <div className="space-y-3 pt-2">
              {getServiceTrendData().slice(0, 3).map((item, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold text-gray-700">
                    <span className="truncate">{item.service}</span>
                    <span>{item.count}</span>
                  </div>
                  <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-600 rounded-full" 
                      style={{ width: `${(item.count / activeInquiries.length) * 100}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Audit Server logs (audit terminal simulation) */}
      <div className="space-y-3">
        <h4 className="text-xs uppercase font-mono font-bold text-gray-400 tracking-wider">Server Operational Audit Logs</h4>
        <div className="bg-gray-900 rounded-xl p-4 font-mono text-[11px] text-gray-300 space-y-2 h-48 overflow-y-auto border border-gray-800 leading-relaxed shadow-inner">
          {systemLogs.map((log, idx) => (
            <div key={idx} className="flex space-x-3">
              <span className="text-gray-500 shrink-0">{new Date(log.timestamp).toLocaleTimeString()}</span>
              <span className={`shrink-0 uppercase font-bold text-[9px] px-1.5 py-0.5 rounded-sm ${
                log.type === 'security' ? 'bg-red-950 text-red-300 border border-red-900/40' :
                log.type === 'system_error' ? 'bg-amber-950 text-amber-300 border border-amber-900/40' :
                log.type === 'inquiry' ? 'bg-blue-950 text-blue-300' :
                'bg-gray-800 text-gray-400'
              }`}>{log.type}</span>
              <span className="text-gray-200">{log.message}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
    </>
  );
}
