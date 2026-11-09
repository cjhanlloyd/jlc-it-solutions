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

export default function InquiriesTab({ db, setDb, adminToken, adminUser, isSaving, run, showFlashMsg, setApiError, onDataChange }: AdminTabProps) {
  const activeInquiries = db.inquiries || [];
  const activeServices = db.services || [];
  const activeSentEmails = db.sentEmails || [];
  const activeAdminsList = db.admins || [];

  const [selectedInquiryId, setSelectedInquiryId] = React.useState<string | null>(null);
  const [inquiryStatusSelect, setInquiryStatusSelect] = React.useState<InquiryStatus>('New');
  const [inquiryNotesText, setInquiryNotesText] = React.useState('');
  const [aiInstructionsText, setAiInstructionsText] = React.useState('');
  const [isDraftingReply, setIsDraftingReply] = React.useState(false);
  const [aiDraftedReplyText, setAiDraftedReplyText] = React.useState('');
  const [replySubject, setReplySubject] = React.useState('');

  // Inquiry Status & Notes save
  const handleUpdateInquiryStatus = async (id: string) => {
    await run(async () => {
      const data = await adminApi('/api/admin/inquiries/update', adminToken, {
          id,
          status: inquiryStatusSelect,
          adminNotes: inquiryNotesText
        }, 'Failed to update inquiry.');
      
      setDb(prev => prev ? { ...prev, inquiries: data.inquiries } : prev);
      showFlashMsg('Inquiry updated successfully!');
    });
  };

  const handleDeleteInquiry = async (id: string) => {
    if (!window.confirm('Are you absolutely sure you want to delete this client inquiry permanently? This action cannot be undone.')) return;
    await run(async () => {
      const data = await adminApi('/api/admin/inquiries/delete', adminToken, { id }, 'Failed to delete client inquiry.');
      setDb(prev => prev ? { ...prev, inquiries: data.inquiries } : prev);
      setSelectedInquiryId(null);
      showFlashMsg('Inquiry permanently deleted.');
    });
  };

  // Gemini-powered Inquiry Reply Drafter
  const handleGenerateReplyDraft = async (inq: Inquiry) => {
    setIsDraftingReply(true);
    setApiError('');
    setAiDraftedReplyText('');
    try {
      const data = await adminApi('/api/admin/generate-reply-draft', adminToken, {
        inquiryId: inq.id,
        instructions: aiInstructionsText
      }, 'Failed to generate draft.');

      setAiDraftedReplyText(data.draftText);
      setReplySubject(`Re: JLC Solutions inquiry - ${inq.serviceRequired}`);
    } catch (err: any) {
      setApiError(err.message || 'Gemini Generation failed.');
    } finally {
      setIsDraftingReply(false);
    }
  };

  // Simulated Manual Email Sender
  const handleSendManualReply = async (inq: Inquiry) => {
    await run(async () => {
      const data = await adminApi('/api/admin/inquiries/reply', adminToken, {
          inquiryId: inq.id,
          to: inq.email,
          subject: replySubject,
          body: aiDraftedReplyText
        }, 'Failed to dispatch manual reply.');
      
      setDb(prev => prev ? { ...prev, sentEmails: data.sentEmails, inquiries: data.inquiries } : prev);
      setAiDraftedReplyText('');
      setAiInstructionsText('');
      showFlashMsg(`Reply simulation sent successfully to ${inq.email}!`);
      
      // Auto update status local state since server moved it to 'In Progress'
      setInquiryStatusSelect('In Progress');
    });
  };

  return (
    <>
    <div className="space-y-6" id="panel-inquiries">
      <div className="border-b border-gray-100 pb-4 mb-4">
        <h2 className="text-xl font-bold text-gray-900 font-sans">Manage Client Inquiries</h2>
        <p className="text-xs text-gray-500 font-sans mt-1">Review operational metrics, update status workflows, and generate customized responses using Gemini AI.</p>
      </div>

      {/* Inquiry List */}
      {activeInquiries.length === 0 ? (
        <div className="text-center py-12 text-gray-400 font-sans">
          <Icons.Inbox className="h-10 w-10 mx-auto text-gray-300 mb-2" />
          No inquiries have been received yet.
        </div>
      ) : (
        <div className="space-y-4">
          {activeInquiries.map((inq) => {
            const isSelected = selectedInquiryId === inq.id;
            return (
              <div 
                key={inq.id}
                className={`border rounded-xl p-5 transition-all ${
                  isSelected ? 'border-blue-500 bg-blue-50/10 shadow-xs' : 'border-gray-100 hover:border-gray-200 bg-white'
                }`}
                id={`inquiry-row-${inq.id}`}
              >
                {/* Summary Header */}
                <div 
                  className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 cursor-pointer focus:outline-hidden"
                  onClick={() => {
                    if (isSelected) {
                      setSelectedInquiryId(null);
                    } else {
                      setSelectedInquiryId(inq.id);
                      setInquiryStatusSelect(inq.status);
                      setInquiryNotesText(inq.adminNotes || '');
                      setAiDraftedReplyText('');
                    }
                  }}
                >
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-bold text-gray-900 font-sans">{inq.fullName}</span>
                      {inq.companyName && (
                        <span className="text-xs text-gray-400 font-semibold font-sans">({inq.companyName})</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 font-sans mt-1 flex flex-wrap gap-x-4">
                      <span>Service: <strong className="text-gray-700">{inq.serviceRequired}</strong></span>
                      <span>Date: <strong className="text-gray-700">{new Date(inq.createdAt).toLocaleDateString()}</strong></span>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="flex items-center space-x-2 shrink-0">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold font-sans ${
                      inq.status === 'New' ? 'bg-red-50 text-red-700 border border-red-100' :
                      inq.status === 'In Progress' ? 'bg-yellow-50 text-yellow-700 border border-yellow-100' :
                      inq.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                      'bg-gray-100 text-gray-700 border border-gray-200'
                    }`}>
                      {inq.status}
                    </span>
                    <Icons.ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isSelected ? 'rotate-180' : ''}`} />
                  </div>
                </div>

                {/* Detailed Sub Drawer */}
                {isSelected && (
                  <div className="mt-5 border-t border-gray-100 pt-5 space-y-6" id={`inquiry-details-${inq.id}`}>
                    
                    {/* Contact Info and Description */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-gray-600 font-sans">
                      <div className="space-y-2 bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                        <h4 className="font-bold text-gray-900 uppercase tracking-wider font-mono">Contact & Budget Details</h4>
                        <p>Email: <strong className="text-gray-900 select-all">{inq.email}</strong></p>
                        <p>Phone: <strong className="text-gray-900 select-all">{inq.phone}</strong></p>
                        <p>Preferred Method: <strong className="text-gray-900">{inq.preferredContactMethod}</strong></p>
                        {inq.budget && <p>Estimated Budget: <strong className="text-gray-900 bg-gray-100 px-1.5 py-0.5 rounded-sm">{inq.budget}</strong></p>}
                        {inq.fileAttachment && (
                          <p>File Attachment: <a href={inq.fileAttachment.base64} download={inq.fileAttachment.name} className="text-blue-600 hover:underline font-bold inline-flex items-center space-x-1"><Icons.Paperclip className="h-3 w-3 inline mr-0.5" /><span>{inq.fileAttachment.name}</span></a></p>
                        )}
                      </div>
                      <div className="space-y-2 bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                        <h4 className="font-bold text-gray-900 uppercase tracking-wider font-mono">Project Overview</h4>
                        <p className="text-gray-700 whitespace-pre-wrap leading-relaxed italic">"{inq.projectDescription}"</p>
                      </div>
                    </div>

                    {/* Status Workflow & Internal Admin Notes */}
                    <div className="bg-gray-50 p-5 rounded-xl border border-gray-200/60 space-y-4">
                      <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider font-mono">Operational Controls</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <div className="space-y-1.5">
                          <label className="text-xs text-gray-500 font-sans font-semibold">Mark Status</label>
                          <select
                            value={inquiryStatusSelect}
                            onChange={(e) => setInquiryStatusSelect(e.target.value as InquiryStatus)}
                            className="w-full border border-gray-200 bg-white p-2 rounded-lg text-xs font-semibold"
                          >
                            <option value="New">New</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Completed">Completed</option>
                            <option value="Closed">Closed</option>
                          </select>
                        </div>
                        <div className="md:col-span-2 space-y-1.5">
                          <label className="text-xs text-gray-500 font-sans font-semibold">Internal Consulting Notes</label>
                          <input
                            type="text"
                            value={inquiryNotesText}
                            onChange={(e) => setInquiryNotesText(e.target.value)}
                            placeholder="Enter pricing details, follow-up dates, or developer assignments..."
                            className="w-full border border-gray-200 bg-white p-2 rounded-lg text-xs"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end items-center gap-3">
                        <button
                          type="button"
                          onClick={() => handleDeleteInquiry(inq.id)}
                          disabled={isSaving}
                          className="px-4 py-2 border border-red-200 text-red-600 hover:bg-red-55 hover:text-red-700 rounded-lg text-xs font-semibold cursor-pointer inline-flex items-center space-x-1.5"
                          title="Permanently delete client inquiry record"
                        >
                          <Icons.Trash className="h-3.5 w-3.5" />
                          <span>Delete Inquiry</span>
                        </button>
                        <button
                          onClick={() => handleUpdateInquiryStatus(inq.id)}
                          disabled={isSaving}
                          className="px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
                        >
                          {isSaving ? 'Saving Changes...' : 'Save Operations Update'}
                        </button>
                      </div>
                    </div>

                    {/* Gemini AI reply assistant module */}
                    <div className="border border-blue-100 rounded-xl overflow-hidden bg-blue-50/5 p-5 space-y-4">
                      <div className="flex items-center space-x-2 text-blue-800">
                        <Icons.Sparkles className="h-4 w-4 animate-pulse" />
                        <h4 className="text-xs font-bold uppercase tracking-wider font-mono">Gemini Intelligent Sales Assistant</h4>
                      </div>
                      
                      <p className="text-xs text-gray-600 font-sans">
                        Feed prompt goals to Gemini. The model will read this inquiry's description, formulate technical insights, align on your brand voice, and write a high-fidelity email response!
                      </p>

                      {/* Client and Project Details Card */}
                      <div className="bg-white rounded-xl p-4 border border-blue-100/60 shadow-xs space-y-3">
                        <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800 font-mono inline-flex items-center gap-1.5">
                            <Icons.Inbox className="h-3 w-3" />
                            Operational Context
                          </span>
                          <span className="text-[9px] text-gray-400 font-mono font-semibold bg-gray-50 border px-1.5 py-0.5 rounded-sm">ID: {inq.id || 'N/A'}</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-gray-400 font-mono block">Client Name</span>
                            <strong className="text-gray-900">{inq.fullName || 'N/A'}</strong>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-gray-400 font-mono block">Company / Business</span>
                            <strong className="text-gray-900">{inq.companyName || 'N/A'}</strong>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-gray-400 font-mono block">Service Requested</span>
                            <strong className="text-gray-900">{inq.serviceRequired || 'N/A'}</strong>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-gray-400 font-mono block">Email Address</span>
                            <strong className="text-gray-900 select-all">{inq.email || 'N/A'}</strong>
                          </div>
                        </div>
                        <div className="pt-2.5 border-t border-gray-100 space-y-1">
                          <span className="text-[10px] uppercase font-bold text-gray-400 font-mono block">Project Requirement Description</span>
                          <p className="text-xs text-gray-700 bg-blue-50/10 p-2.5 rounded-lg border border-blue-50/20 whitespace-pre-wrap italic leading-relaxed font-sans">
                            {inq.projectDescription ? `"${inq.projectDescription}"` : 'No project description was provided.'}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold text-gray-400 font-mono block">AI Response Goals</label>
                        <textarea
                          value={aiInstructionsText}
                          onChange={(e) => setAiInstructionsText(e.target.value)}
                          placeholder="e.g. Schedule a 15 min Zoom call, decline gently if we cannot handle within 2 weeks, explain that custom react apps require robust backends..."
                          rows={2}
                          className="w-full p-2.5 border border-blue-100 bg-white rounded-lg text-xs focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-gray-900"
                        />
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-gray-400 font-mono bg-white border px-2 py-1 rounded-md">Powered by Model: gemini-3.5-flash</span>
                        <button
                          onClick={() => handleGenerateReplyDraft(inq)}
                          disabled={isDraftingReply}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold inline-flex items-center"
                        >
                          {isDraftingReply ? (
                            <>
                              <Icons.Loader className="animate-spin -ml-1 mr-2 h-3 w-3 text-white" />
                              AI drafting response...
                            </>
                          ) : (
                            <>
                              Draft Reply using Gemini
                              <Icons.Sparkles className="ml-1.5 h-3.5 w-3.5" />
                            </>
                          )}
                        </button>
                      </div>

                      {/* Draft Display & Send simulated reply */}
                      {aiDraftedReplyText && (
                        <div className="border border-gray-200 rounded-xl overflow-hidden mt-4 shadow-xs bg-white space-y-4 p-5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase font-mono font-bold text-emerald-600">Generated Email Draft</span>
                            <Icons.Mail className="h-4 w-4 text-emerald-500" />
                          </div>
                          
                          <div className="space-y-3">
                            <div>
                              <label className="text-[10px] font-mono text-gray-400 block">Subject Line</label>
                              <input
                                type="text"
                                value={replySubject}
                                onChange={(e) => setReplySubject(e.target.value)}
                                className="w-full border-b border-gray-100 py-1 font-semibold text-gray-900 text-xs focus:outline-hidden"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-mono text-gray-400 block">Email Body</label>
                              <textarea
                                value={aiDraftedReplyText}
                                onChange={(e) => setAiDraftedReplyText(e.target.value)}
                                rows={10}
                                className="w-full p-3 border border-gray-100 rounded-lg text-xs leading-relaxed text-gray-700 focus:outline-hidden"
                              />
                            </div>
                          </div>

                          <div className="flex justify-end pt-2">
                            <button
                              onClick={() => handleSendManualReply(inq)}
                              disabled={isSaving}
                              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold inline-flex items-center"
                            >
                              {isSaving ? 'Sending...' : 'Send Simulated Response'}
                              <Icons.Send className="ml-2 h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
    </>
  );
}
