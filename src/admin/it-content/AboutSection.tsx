/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Edit3, Image, Trash, Upload } from 'lucide-react';
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
        <form onSubmit={onSave} className="bg-white border border-slate-200 p-5 rounded-card shadow-card space-y-6">
          <div>
            <h3 className="font-display text-lg font-semibold text-slate-900">About Us Page Details</h3>
            <p className="text-xs text-slate-600 mt-0.5">Edit company overview headlines, profile values, and mission vision text.</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-800">Main About Header</label>
              <input aria-label="Main About Header"
                type="text"
                required
                value={contentForm.aboutHeader || ''}
                onChange={(e) => setContentForm({ ...contentForm, aboutHeader: e.target.value })}
                className="w-full rounded-control border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-2 focus:outline-brand-600"
                placeholder="Your Strategic Technical Partner"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-800">About Subheader Title</label>
              <input aria-label="About Subheader Title"
                type="text"
                required
                value={contentForm.aboutSubheader || ''}
                onChange={(e) => setContentForm({ ...contentForm, aboutSubheader: e.target.value })}
                className="w-full rounded-control border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-2 focus:outline-brand-600"
                placeholder="Establishing a Strong, Trustworthy Foundation for Future Tech Growth"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-800">Primary Introduction Paragraph</label>
              <textarea aria-label="Primary Introduction Paragraph"
                required
                value={contentForm.aboutText || ''}
                onChange={(e) => setContentForm({ ...contentForm, aboutText: e.target.value })}
                rows={4}
                className="w-full rounded-control border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-2 focus:outline-brand-600"
              ></textarea>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-800">Secondary Paragraph</label>
              <textarea aria-label="Secondary Paragraph"
                required
                value={contentForm.aboutText2 || ''}
                onChange={(e) => setContentForm({ ...contentForm, aboutText2: e.target.value })}
                rows={4}
                className="w-full rounded-control border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-2 focus:outline-brand-600"
              ></textarea>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-800">Mission Statement</label>
                <textarea aria-label="Mission Statement"
                  required
                  value={contentForm.aboutMission || ''}
                  onChange={(e) => setContentForm({ ...contentForm, aboutMission: e.target.value })}
                  rows={4}
                  className="w-full rounded-control border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-2 focus:outline-brand-600"
                ></textarea>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-800">Vision Statement</label>
                <textarea aria-label="Vision Statement"
                  required
                  value={contentForm.aboutVision || ''}
                  onChange={(e) => setContentForm({ ...contentForm, aboutVision: e.target.value })}
                  rows={4}
                  className="w-full rounded-control border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-2 focus:outline-brand-600"
                ></textarea>
              </div>
            </div>

            {/* About Us Photo Customizer */}
            <div className="space-y-2 pt-2 border-t border-slate-100 mt-4">
              <label className="block text-sm font-medium text-slate-800">About Us Section Photo</label>
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="w-40 h-24 bg-slate-100 border border-slate-200/80 rounded-card overflow-hidden flex items-center justify-center shrink-0">
                  {contentForm.aboutImageBase64 ? (
                    <img src={contentForm.aboutImageBase64} alt="About Section Preview" className="w-full h-full object-cover" />
                  ) : (
                    <Image className="h-8 w-8 text-slate-600" />
                  )}
                </div>
                <div className="flex-grow w-full space-y-2">
                  <div className="flex items-center space-x-2">
                    <label className="inline-flex items-center px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-700 text-sm font-semibold rounded-control cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
                      <Upload className="h-4.5 w-4.5 mr-2" />
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
                        className="px-4 py-2 border border-red-200 hover:bg-red-50 text-red-700 text-sm font-semibold rounded-control cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                      >
                        Remove Image
                      </button>
                    )}
                  </div>
                  <span className="text-xs text-slate-600 block">Upload an office workspace or team graphic. Automatically scaled and web-optimized.</span>
                </div>
              </div>
            </div>

            {/* About Commitments Editor */}
            <div className="space-y-4 border-t border-slate-100 pt-5 mt-5">
              <h3 className="font-display text-lg font-semibold text-slate-900">Company Profile Commitments</h3>
              <p className="text-xs text-slate-600">Modify the titles, descriptions, and icon styles representing the 3 core commitments shown in the About section.</p>
              
              <div className="grid grid-cols-1 gap-6">
                {(contentForm.aboutCommitments || DEFAULT_ABOUT_COMMITMENTS).map((comm: any, index: number) => (
                  <div key={comm.id} className="p-4 bg-slate-50/50 rounded-card border border-slate-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-800">Commitment #{index + 1}</span>
                      <span className="text-xs text-slate-600">ID: {comm.id}</span>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-600">Title</label>
                        <input aria-label="Title"
                          type="text"
                          required
                          value={comm.title}
                          onChange={(e) => {
                            const newComms = [...(contentForm.aboutCommitments || DEFAULT_ABOUT_COMMITMENTS)];
                            newComms[index] = { ...comm, title: e.target.value };
                            setContentForm({ ...contentForm, aboutCommitments: newComms });
                          }}
                          className="w-full rounded-control border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-2 focus:outline-brand-600"
                        />
                      </div>
                      
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-600">Icon Name</label>
                        <select aria-label="Icon Name"
                          value={comm.iconName}
                          onChange={(e) => {
                            const newComms = [...(contentForm.aboutCommitments || DEFAULT_ABOUT_COMMITMENTS)];
                            newComms[index] = { ...comm, iconName: e.target.value };
                            setContentForm({ ...contentForm, aboutCommitments: newComms });
                          }}
                          className="w-full cursor-pointer rounded-control border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-2 focus:outline-brand-600"
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
                      <label className="text-xs font-medium text-slate-600">Description</label>
                      <textarea aria-label="Description"
                        required
                        value={comm.description}
                        onChange={(e) => {
                          const newComms = [...(contentForm.aboutCommitments || DEFAULT_ABOUT_COMMITMENTS)];
                          newComms[index] = { ...comm, description: e.target.value };
                          setContentForm({ ...contentForm, aboutCommitments: newComms });
                        }}
                        rows={2}
                        className="w-full rounded-control border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-2 focus:outline-brand-600"
                      ></textarea>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button type="submit" disabled={isSaving} className="px-4 py-2.5 bg-brand-700 hover:bg-brand-800 text-white rounded-control text-sm font-semibold cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
              {isSaving ? 'Saving Changes...' : 'Save About Page Layout Overrides'}
            </button>
          </div>
        </form>

        {/* Dynamic Growth Roadmap Customizer */}
        <div className="bg-white border border-slate-200 p-5 rounded-card shadow-card space-y-6 mt-8">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="font-display text-lg font-semibold text-slate-900">Growth Roadmap Milestones</h3>
            <p className="text-xs text-slate-600 mt-1">Manage quarterly objectives, security certifications, and upcoming portal integrations.</p>
          </div>

          {/* Add/Edit Roadmap Milestone form */}
          <form id="editor-roadmap" onSubmit={handleAddOrEditRoadmap} className="bg-slate-50 p-4 rounded-card border border-slate-200/60 space-y-3">
            <h4 className="text-sm font-semibold text-slate-800">
              {editingRoadmapStepId ? 'Edit Roadmap Milestone' : 'Add New Milestone Card'}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600">Timeline Quarter</label>
                <input aria-label="Timeline Quarter"
                  type="text"
                  required
                  value={roadmapForm.timeline}
                  onChange={(e) => setRoadmapForm({ ...roadmapForm, timeline: e.target.value })}
                  placeholder="e.g. Q4 2026"
                  className="w-full rounded-control border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-2 focus:outline-brand-600"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600">Milestone Title</label>
                <input aria-label="Milestone Title"
                  type="text"
                  required
                  value={roadmapForm.title}
                  onChange={(e) => setRoadmapForm({ ...roadmapForm, title: e.target.value })}
                  placeholder="e.g. SOC2 Certification"
                  className="w-full rounded-control border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-2 focus:outline-brand-600"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600">Milestone Status</label>
                <select aria-label="Milestone Status"
                  value={roadmapForm.status}
                  onChange={(e) => setRoadmapForm({ ...roadmapForm, status: e.target.value as any })}
                  className="w-full cursor-pointer rounded-control border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-2 focus:outline-brand-600"
                >
                  <option value="planned">Planned (Upcoming)</option>
                  <option value="in-progress">In Progress (Active)</option>
                  <option value="completed">Completed (Delivered)</option>
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Milestone Description</label>
              <textarea aria-label="Milestone Description"
                required
                value={roadmapForm.description}
                onChange={(e) => setRoadmapForm({ ...roadmapForm, description: e.target.value })}
                placeholder="Briefly state key activities or specifications..."
                rows={2}
                className="w-full rounded-control border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-2 focus:outline-brand-600"
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
                  className="px-3.5 py-1.5 border border-slate-200 text-slate-700 text-sm font-semibold rounded-control cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                >
                  Cancel
                </button>
              )}
              <button type="submit" disabled={isSaving} className="px-3.5 py-1.5 bg-brand-700 hover:bg-brand-800 text-white text-sm font-semibold rounded-control cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
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
                    <span className="text-xs font-bold bg-slate-200 px-2 py-0.5 rounded text-slate-800">{step.timeline}</span>
                    <h4 className="text-sm font-semibold text-slate-900">{step.title}</h4>
                    <span className="text-xs font-medium text-slate-600">({step.status})</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">{step.description}</p>
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
                    className="p-1.5 border border-slate-100 text-slate-600 hover:text-brand-700 hover:bg-brand-50 rounded-control cursor-pointer"
                    title="Edit Milestone"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteRoadmap(step.id)}
                    className="p-1.5 border border-slate-100 text-slate-600 hover:text-red-500 hover:bg-red-50 rounded-control cursor-pointer"
                    title="Delete Milestone"
                  >
                    <Trash className="h-3.5 w-3.5" />
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
