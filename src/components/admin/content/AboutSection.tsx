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

export default function AboutSection({ db, setDb, adminToken, adminUser, isSaving, run, showFlashMsg, setApiError, onDataChange, contentForm, setContentForm, onSave }: ContentSectionProps) {
  const activeServices = db.services || [];

  const [roadmapForm, setRoadmapForm] = React.useState({ timeline: '', title: '', description: '', status: 'planned' as any });
  const [editingRoadmapStepId, setEditingRoadmapStepId] = React.useState<string | null>(null);

  const handleAddOrEditRoadmap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roadmapForm.timeline || !roadmapForm.title || !roadmapForm.description) return;
    const action = editingRoadmapStepId ? 'update' : 'add';
    await run(async () => {
      const data = await adminApi('/api/admin/roadmap', adminToken, {
          action,
          step: {
            id: editingRoadmapStepId || undefined,
            timeline: roadmapForm.timeline,
            title: roadmapForm.title,
            description: roadmapForm.description,
            status: roadmapForm.status
          }
        }, `Failed to ${action} roadmap milestone.`);
      setDb(prev => prev ? { ...prev, roadmapSteps: data.roadmapSteps } : prev);
      onDataChange?.();
      setRoadmapForm({ timeline: '', title: '', description: '', status: 'planned' });
      setEditingRoadmapStepId(null);
      showFlashMsg(editingRoadmapStepId ? 'Roadmap Milestone updated successfully!' : 'Roadmap Milestone added successfully!');
    });
  };

  const handleDeleteRoadmap = async (stepId: string) => {
    if (!window.confirm('Are you sure you want to delete this milestone?')) return;
    await run(async () => {
      const data = await adminApi('/api/admin/roadmap', adminToken, {
          action: 'delete',
          step: { id: stepId }
        }, 'Failed to delete milestone.');
      setDb(prev => prev ? { ...prev, roadmapSteps: data.roadmapSteps } : prev);
      onDataChange?.();
      if (editingRoadmapStepId === stepId) {
        setRoadmapForm({ timeline: '', title: '', description: '', status: 'planned' });
        setEditingRoadmapStepId(null);
      }
      showFlashMsg('Roadmap milestone removed.');
    });
  };

  const handleAboutImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Selected file must be a valid image.');
      return;
    }
    try {
      const base64 = await optimizeImage(file, 1200, 800, 0.75);
      setContentForm(prev => ({ ...prev, aboutImageBase64: base64 }));
    } catch (err: any) {
      alert('Error optimizing corporate about photo: ' + err.message);
    }
  };

  const handleRemoveAboutImage = () => {
    setContentForm(prev => ({ ...prev, aboutImageBase64: '' }));
  };

  return (
    <>
      <div className="space-y-8">
        {/* About Us Page Layout Overrides form */}
        <form onSubmit={onSave} className="bg-white border border-gray-200 p-6 rounded-2xl shadow-xs space-y-6">
          <div>
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest font-mono">About Us Page Details</h3>
            <p className="text-xs text-gray-400 font-sans mt-0.5">Edit company overview headlines, profile values, and mission vision text.</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Main About Header</label>
              <input
                type="text"
                required
                value={contentForm.aboutHeader || ''}
                onChange={(e) => setContentForm({ ...contentForm, aboutHeader: e.target.value })}
                className="w-full border border-gray-200 p-2.5 rounded-lg text-xs"
                placeholder="Your Strategic Technical Partner"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">About Subheader Title</label>
              <input
                type="text"
                required
                value={contentForm.aboutSubheader || ''}
                onChange={(e) => setContentForm({ ...contentForm, aboutSubheader: e.target.value })}
                className="w-full border border-gray-200 p-2.5 rounded-lg text-xs"
                placeholder="Establishing a Strong, Trustworthy Foundation for Future Tech Growth"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Primary Introduction Paragraph</label>
              <textarea
                required
                value={contentForm.aboutText || ''}
                onChange={(e) => setContentForm({ ...contentForm, aboutText: e.target.value })}
                rows={4}
                className="w-full border border-gray-200 p-2.5 rounded-lg text-xs"
              ></textarea>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Secondary Paragraph</label>
              <textarea
                required
                value={contentForm.aboutText2 || ''}
                onChange={(e) => setContentForm({ ...contentForm, aboutText2: e.target.value })}
                rows={4}
                className="w-full border border-gray-200 p-2.5 rounded-lg text-xs"
              ></textarea>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Mission Statement</label>
                <textarea
                  required
                  value={contentForm.aboutMission || ''}
                  onChange={(e) => setContentForm({ ...contentForm, aboutMission: e.target.value })}
                  rows={4}
                  className="w-full border border-gray-200 p-2.5 rounded-lg text-xs"
                ></textarea>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Vision Statement</label>
                <textarea
                  required
                  value={contentForm.aboutVision || ''}
                  onChange={(e) => setContentForm({ ...contentForm, aboutVision: e.target.value })}
                  rows={4}
                  className="w-full border border-gray-200 p-2.5 rounded-lg text-xs"
                ></textarea>
              </div>
            </div>

            {/* About Us Photo Customizer */}
            <div className="space-y-2 pt-2 border-t border-slate-100 mt-4">
              <label className="text-[10px] uppercase font-bold text-gray-500 font-mono block">About Us Section Photo</label>
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="w-40 h-24 bg-slate-100 border border-slate-200/80 rounded-xl overflow-hidden flex items-center justify-center shrink-0">
                  {contentForm.aboutImageBase64 ? (
                    <img src={contentForm.aboutImageBase64} alt="About Section Preview" className="w-full h-full object-cover" />
                  ) : (
                    <Icons.Image className="h-8 w-8 text-slate-350" />
                  )}
                </div>
                <div className="flex-grow w-full space-y-2">
                  <div className="flex items-center space-x-2">
                    <label className="inline-flex items-center px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl cursor-pointer shadow-xs">
                      <Icons.Upload className="h-4.5 w-4.5 mr-2" />
                      Choose About Photo
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleAboutImageUpload}
                        className="hidden"
                      />
                    </label>
                    {contentForm.aboutImageBase64 && (
                      <button
                        type="button"
                        onClick={handleRemoveAboutImage}
                        className="px-4 py-2 border border-red-200 hover:bg-red-50 text-red-655 text-xs font-bold rounded-xl cursor-pointer shadow-xs"
                      >
                        Remove Image
                      </button>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-455 block">Upload an office workspace or team graphic. Automatically scaled and web-optimized.</span>
                </div>
              </div>
            </div>

            {/* About Commitments Editor */}
            <div className="space-y-4 border-t border-gray-100 pt-5 mt-5">
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-widest font-mono">Company Profile Commitments</h3>
              <p className="text-[10px] text-gray-500 font-sans">Modify the titles, descriptions, and icon styles representing the 3 core commitments shown in the About section.</p>
              
              <div className="grid grid-cols-1 gap-6">
                {(contentForm.aboutCommitments || DEFAULT_ABOUT_COMMITMENTS).map((comm: any, index: number) => (
                  <div key={comm.id} className="p-4 bg-slate-50/50 rounded-xl border border-slate-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-mono font-bold text-blue-650">Commitment #{index + 1}</span>
                      <span className="text-[10px] font-mono text-gray-450">ID: {comm.id}</span>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] uppercase font-bold text-gray-400 font-mono">Title</label>
                        <input
                          type="text"
                          required
                          value={comm.title}
                          onChange={(e) => {
                            const newComms = [...(contentForm.aboutCommitments || DEFAULT_ABOUT_COMMITMENTS)];
                            newComms[index] = { ...comm, title: e.target.value };
                            setContentForm({ ...contentForm, aboutCommitments: newComms });
                          }}
                          className="w-full border border-gray-200 p-2 rounded-lg text-xs bg-white text-gray-900"
                        />
                      </div>
                      
                      <div className="space-y-1">
                        <label className="text-[9px] uppercase font-bold text-gray-400 font-mono">Icon Name</label>
                        <select
                          value={comm.iconName}
                          onChange={(e) => {
                            const newComms = [...(contentForm.aboutCommitments || DEFAULT_ABOUT_COMMITMENTS)];
                            newComms[index] = { ...comm, iconName: e.target.value };
                            setContentForm({ ...contentForm, aboutCommitments: newComms });
                          }}
                          className="w-full border border-gray-200 p-2.5 rounded-lg text-xs bg-white text-gray-805 cursor-pointer"
                        >
                          <option value="ShieldAlert">ShieldAlert (Shield Warning)</option>
                          <option value="Code2">Code2 (Code brackets)</option>
                          <option value="UserCheck">UserCheck (User tick)</option>
                          <option value="Heart">Heart (Love)</option>
                          <option value="Activity">Activity (Pulse)</option>
                          <option value="Cpu">Cpu (Tech)</option>
                          <option value="Lock">Lock (Security)</option>
                        </select>
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase font-bold text-gray-400 font-mono">Description</label>
                      <textarea
                        required
                        value={comm.description}
                        onChange={(e) => {
                          const newComms = [...(contentForm.aboutCommitments || DEFAULT_ABOUT_COMMITMENTS)];
                          newComms[index] = { ...comm, description: e.target.value };
                          setContentForm({ ...contentForm, aboutCommitments: newComms });
                        }}
                        rows={2}
                        className="w-full border border-gray-200 p-2 rounded-lg text-xs bg-white text-gray-900"
                      ></textarea>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-gray-100">
            <button type="submit" disabled={isSaving} className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer">
              {isSaving ? 'Saving Changes...' : 'Save About Page Layout Overrides'}
            </button>
          </div>
        </form>

        {/* Dynamic Growth Roadmap Customizer */}
        <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-xs space-y-6 mt-8">
          <div className="border-b border-gray-100 pb-4">
            <h3 className="text-lg font-bold text-gray-900 font-sans">Growth Roadmap Milestones</h3>
            <p className="text-xs text-gray-500 font-sans mt-1">Manage quarterly objectives, security certifications, and upcoming portal integrations.</p>
          </div>

          {/* Add/Edit Roadmap Milestone form */}
          <form id="editor-roadmap" onSubmit={handleAddOrEditRoadmap} className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 space-y-3">
            <h4 className="text-xs font-bold text-slate-800">
              {editingRoadmapStepId ? 'Edit Roadmap Milestone' : 'Add New Milestone Card'}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="text-[9px] uppercase font-bold text-gray-400 font-mono">Timeline Quarter</label>
                <input
                  type="text"
                  required
                  value={roadmapForm.timeline}
                  onChange={(e) => setRoadmapForm({ ...roadmapForm, timeline: e.target.value })}
                  placeholder="e.g. Q4 2026"
                  className="w-full border border-gray-200 p-2 rounded-lg text-xs bg-white text-gray-900"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] uppercase font-bold text-gray-400 font-mono">Milestone Title</label>
                <input
                  type="text"
                  required
                  value={roadmapForm.title}
                  onChange={(e) => setRoadmapForm({ ...roadmapForm, title: e.target.value })}
                  placeholder="e.g. SOC2 Certification"
                  className="w-full border border-gray-200 p-2 rounded-lg text-xs bg-white text-gray-900"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] uppercase font-bold text-gray-400 font-mono">Milestone Status</label>
                <select
                  value={roadmapForm.status}
                  onChange={(e) => setRoadmapForm({ ...roadmapForm, status: e.target.value as any })}
                  className="w-full border border-gray-200 p-2.5 rounded-lg text-xs bg-white text-gray-800 cursor-pointer"
                >
                  <option value="planned">Planned (Upcoming)</option>
                  <option value="in-progress">In Progress (Active)</option>
                  <option value="completed">Completed (Delivered)</option>
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] uppercase font-bold text-gray-400 font-mono">Milestone Description</label>
              <textarea
                required
                value={roadmapForm.description}
                onChange={(e) => setRoadmapForm({ ...roadmapForm, description: e.target.value })}
                placeholder="Briefly state key activities or specifications..."
                rows={2}
                className="w-full border border-gray-200 p-2 rounded-lg text-xs bg-white text-gray-900"
              ></textarea>
            </div>
            <div className="flex justify-end space-x-2">
              {editingRoadmapStepId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingRoadmapStepId(null);
                    setRoadmapForm({ timeline: '', title: '', description: '', status: 'planned' });
                  }}
                  className="px-3.5 py-1.5 border border-gray-200 text-slate-655 text-xs font-bold rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
              )}
              <button type="submit" disabled={isSaving} className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg cursor-pointer">
                {editingRoadmapStepId ? 'Update Milestone' : 'Add Milestone'}
              </button>
            </div>
          </form>

          {/* Milestones list */}
          <div className="space-y-3 pt-2 max-h-96 overflow-y-auto divide-y divide-slate-100">
            {(db?.roadmapSteps || []).map((step) => (
              <div key={step.id} className="pt-3 border-t border-slate-100 first:border-0 flex items-center justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[9px] font-mono font-bold bg-slate-200 px-2 py-0.5 rounded text-slate-800">{step.timeline}</span>
                    <h4 className="text-xs font-bold text-slate-955 font-display">{step.title}</h4>
                    <span className="text-[9px] uppercase font-mono font-bold text-blue-600">({step.status})</span>
                  </div>
                  <p className="text-xs text-slate-500 font-sans mt-1 leading-relaxed">{step.description}</p>
                </div>
                <div className="flex items-center space-x-2 shrink-0 ml-4">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingRoadmapStepId(step.id);
                      setRoadmapForm({
                        timeline: step.timeline,
                        title: step.title,
                        description: step.description || '',
                        status: step.status || 'planned'
                      });
                      document.getElementById('editor-roadmap')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                    className="p-1.5 border border-gray-105 text-gray-450 hover:text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer"
                    title="Edit Milestone"
                  >
                    <Icons.Edit3 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteRoadmap(step.id)}
                    className="p-1.5 border border-gray-105 text-gray-450 hover:text-red-500 hover:bg-red-50 rounded-lg cursor-pointer"
                    title="Delete Milestone"
                  >
                    <Icons.Trash className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
