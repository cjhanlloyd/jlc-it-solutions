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

export default function HomeSection({ db, setDb, adminToken, adminUser, isSaving, run, showFlashMsg, setApiError, onDataChange, contentForm, setContentForm, onSave }: ContentSectionProps) {
  const activeServices = db.services || [];

  const [faqForm, setFaqForm] = React.useState({ question: '', answer: '' });
  const [processForm, setProcessForm] = React.useState({ title: '', description: '', iconName: 'Cpu', stepNumber: '' });
  const [galleryForm, setGalleryForm] = React.useState({ title: '', description: '', category: 'Software Engineering', imageBase64: '' });
  const [editingFaqId, setEditingFaqId] = React.useState<string | null>(null);
  const [editingProcessStepId, setEditingProcessStepId] = React.useState<string | null>(null);
  const [editingGalleryItemId, setEditingGalleryItemId] = React.useState<string | null>(null);

  const handleAddOrEditFaq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!faqForm.question || !faqForm.answer) return;
    const action = editingFaqId ? 'update' : 'add';
    await run(async () => {
      const data = await adminApi('/api/admin/faqs', adminToken, {
          action,
          faq: {
            id: editingFaqId || undefined,
            question: faqForm.question,
            answer: faqForm.answer
          }
        }, `Failed to ${action} FAQ.`);
      setDb(prev => prev ? { ...prev, faqs: data.faqs } : prev);
      onDataChange?.();
      setFaqForm({ question: '', answer: '' });
      setEditingFaqId(null);
      showFlashMsg(editingFaqId ? 'FAQ updated successfully!' : 'FAQ card created successfully!');
    });
  };

  const handleDeleteFaq = async (faqId: string) => {
    if (!window.confirm('Are you sure you want to delete this FAQ?')) return;
    await run(async () => {
      const data = await adminApi('/api/admin/faqs', adminToken, {
          action: 'delete',
          faq: { id: faqId }
        }, 'Failed to delete FAQ.');
      setDb(prev => prev ? { ...prev, faqs: data.faqs } : prev);
      onDataChange?.();
      if (editingFaqId === faqId) {
        setFaqForm({ question: '', answer: '' });
        setEditingFaqId(null);
      }
      showFlashMsg('FAQ removed.');
    });
  };

  const handleAddOrEditProcessStep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!processForm.title || !processForm.description) return;
    const action = editingProcessStepId ? 'update' : 'add';
    await run(async () => {
      const data = await adminApi('/api/admin/process', adminToken, {
          action,
          step: {
            id: editingProcessStepId || undefined,
            stepNumber: processForm.stepNumber || undefined,
            title: processForm.title,
            description: processForm.description,
            iconName: processForm.iconName
          }
        }, `Failed to ${action} collaboration step.`);
      setDb(prev => prev ? { ...prev, processSteps: data.processSteps } : prev);
      onDataChange?.();
      setProcessForm({ title: '', description: '', iconName: 'Cpu', stepNumber: '' });
      setEditingProcessStepId(null);
      showFlashMsg(editingProcessStepId ? 'Collaboration step updated successfully!' : 'Collaboration step added successfully!');
    });
  };

  const handleDeleteProcessStep = async (stepId: string) => {
    if (!window.confirm('Are you sure you want to delete this process step?')) return;
    await run(async () => {
      const data = await adminApi('/api/admin/process', adminToken, {
          action: 'delete',
          step: { id: stepId }
        }, 'Failed to delete process step.');
      setDb(prev => prev ? { ...prev, processSteps: data.processSteps } : prev);
      onDataChange?.();
      if (editingProcessStepId === stepId) {
        setProcessForm({ title: '', description: '', iconName: 'Cpu', stepNumber: '' });
        setEditingProcessStepId(null);
      }
      showFlashMsg('Collaboration process step removed.');
    });
  };

  const handleGalleryImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Selected file must be a valid image.');
      return;
    }
    try {
      const base64 = await optimizeImage(file, 800, 600, 0.75);
      setGalleryForm(prev => ({ ...prev, imageBase64: base64 }));
    } catch (err: any) {
      alert('Error optimizing showcase photo: ' + err.message);
    }
  };

  const handleHeroBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Selected file must be a valid image.');
      return;
    }
    try {
      const base64 = await optimizeImage(file, 1600, 1000, 0.75);
      setContentForm(prev => ({ ...prev, bannerImageUrl: base64 }));
    } catch (err: any) {
      alert('Error optimizing banner photo: ' + err.message);
    }
  };

  const handleRemoveHeroBanner = () => {
    setContentForm(prev => ({ ...prev, bannerImageUrl: '' }));
  };

  const handleAddOrEditGalleryItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!galleryForm.title || !galleryForm.description || !galleryForm.imageBase64) {
      alert("Please enter a title, description, and upload a showcase photo!");
      return;
    }
    const action = editingGalleryItemId ? 'update' : 'add';
    await run(async () => {
      const data = await adminApi('/api/admin/gallery', adminToken, {
          action,
          project: {
            id: editingGalleryItemId || undefined,
            title: galleryForm.title,
            description: galleryForm.description,
            category: galleryForm.category,
            imageBase64: galleryForm.imageBase64
          }
        }, `Failed to ${action} gallery item.`);
      setDb(prev => prev ? { ...prev, projectGallery: data.projectGallery } : prev);
      onDataChange?.();
      setGalleryForm({ title: '', description: '', category: 'Software Engineering', imageBase64: '' });
      setEditingGalleryItemId(null);
      showFlashMsg(editingGalleryItemId ? 'Showcase project updated successfully!' : 'Showcase project added to homepage gallery successfully!');
    });
  };

  const handleDeleteGalleryItem = async (itemId: string) => {
    if (!window.confirm('Are you sure you want to delete this showcase project from the homepage?')) return;
    await run(async () => {
      const data = await adminApi('/api/admin/gallery', adminToken, {
          action: 'delete',
          project: { id: itemId }
        }, 'Failed to delete gallery item.');
      setDb(prev => prev ? { ...prev, projectGallery: data.projectGallery } : prev);
      onDataChange?.();
      if (editingGalleryItemId === itemId) {
        setGalleryForm({ title: '', description: '', category: 'Software Engineering', imageBase64: '' });
        setEditingGalleryItemId(null);
      }
      showFlashMsg('Showcase project removed from gallery.');
    });
  };

  return (
    <>
      <div className="space-y-8">
        {/* Home Page Layout Overrides form */}
        <form onSubmit={onSave} className="bg-white border border-gray-200 p-6 rounded-2xl shadow-xs space-y-6">
          <div>
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest font-mono">Homepage Hero Header</h3>
            <p className="text-xs text-gray-400 font-sans mt-0.5">Customize the landing page banner details.</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Hero Badge Text</label>
              <input
                type="text"
                required
                value={contentForm.heroBadge || ''}
                onChange={(e) => setContentForm({ ...contentForm, heroBadge: e.target.value })}
                className="w-full border border-gray-200 p-2.5 rounded-lg text-xs"
                placeholder="Ready for Inquiries"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Main Hero Title</label>
              <input
                type="text"
                required
                value={contentForm.heroTitle || ''}
                onChange={(e) => setContentForm({ ...contentForm, heroTitle: e.target.value })}
                className="w-full border border-gray-200 p-2.5 rounded-lg text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Hero Subtitle</label>
              <textarea
                required
                value={contentForm.heroSubtitle || ''}
                onChange={(e) => setContentForm({ ...contentForm, heroSubtitle: e.target.value })}
                rows={3}
                className="w-full border border-gray-200 p-2.5 rounded-lg text-xs"
              ></textarea>
            </div>

            {/* Hero Banner Image Customizer */}
            <div className="space-y-2 pt-2 border-t border-gray-100 mt-4">
              <label className="text-[10px] uppercase font-bold text-gray-500 font-mono block">Hero Banner Photo</label>
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="w-40 h-24 bg-slate-100 border border-slate-200/80 rounded-xl overflow-hidden flex items-center justify-center shrink-0">
                  {contentForm.bannerImageUrl ? (
                    <img src={contentForm.bannerImageUrl} alt="Banner Preview" className="w-full h-full object-cover" />
                  ) : (
                    <Icons.Image className="h-8 w-8 text-slate-350" />
                  )}
                </div>
                <div className="flex-grow w-full space-y-2">
                  <div className="flex items-center space-x-2">
                    <label className="inline-flex items-center px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl cursor-pointer shadow-xs">
                      <Icons.Upload className="h-4.5 w-4.5 mr-2" />
                      Choose Banner Photo
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleHeroBannerUpload}
                        className="hidden"
                      />
                    </label>
                    {contentForm.bannerImageUrl && (
                      <button
                        type="button"
                        onClick={handleRemoveHeroBanner}
                        className="px-4 py-2 border border-red-200 hover:bg-red-50 text-red-655 text-xs font-bold rounded-xl cursor-pointer shadow-xs"
                      >
                        Remove Image
                      </button>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-450 block">Upload a high-resolution background banner. Optimized dynamically for web performance.</span>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-6 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest font-mono">Homepage Section Headings</h3>
              <p className="text-xs text-gray-400 font-sans mt-0.5">Customize headers and description texts for home page sections.</p>
            </div>

            {/* Portfolio Showcase section */}
            <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-100 space-y-3">
              <span className="text-[10px] uppercase font-mono font-bold text-blue-650">Portfolio Showcase Section</span>
              <div className="space-y-2">
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold text-gray-400 font-mono">Heading</label>
                  <input
                    type="text"
                    required
                    value={contentForm.portfolioHeader || ''}
                    onChange={(e) => setContentForm({ ...contentForm, portfolioHeader: e.target.value })}
                    className="w-full border border-gray-200 p-2 rounded-lg text-xs bg-white text-gray-900"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold text-gray-400 font-mono">Subtitle Description</label>
                  <textarea
                    required
                    value={contentForm.portfolioSubtitle || ''}
                    onChange={(e) => setContentForm({ ...contentForm, portfolioSubtitle: e.target.value })}
                    rows={2}
                    className="w-full border border-gray-200 p-2 rounded-lg text-xs bg-white text-gray-900"
                  ></textarea>
                </div>
              </div>
            </div>

            {/* Process Timeline section */}
            <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-100 space-y-3">
              <span className="text-[10px] uppercase font-mono font-bold text-blue-650">Operational Lifecycle Section</span>
              <div className="space-y-2">
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold text-gray-400 font-mono">Heading</label>
                  <input
                    type="text"
                    required
                    value={contentForm.processHeader || ''}
                    onChange={(e) => setContentForm({ ...contentForm, processHeader: e.target.value })}
                    className="w-full border border-gray-200 p-2 rounded-lg text-xs bg-white text-gray-900"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold text-gray-400 font-mono">Subtitle Description</label>
                  <textarea
                    required
                    value={contentForm.processSubtitle || ''}
                    onChange={(e) => setContentForm({ ...contentForm, processSubtitle: e.target.value })}
                    rows={2}
                    className="w-full border border-gray-200 p-2 rounded-lg text-xs bg-white text-gray-900"
                  ></textarea>
                </div>
              </div>
            </div>

            {/* FAQ Section */}
            <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-100 space-y-3">
              <span className="text-[10px] uppercase font-mono font-bold text-blue-650">FAQ Accordion Section</span>
              <div className="space-y-2">
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold text-gray-400 font-mono">Heading</label>
                  <input
                    type="text"
                    required
                    value={contentForm.faqHeader || ''}
                    onChange={(e) => setContentForm({ ...contentForm, faqHeader: e.target.value })}
                    className="w-full border border-gray-200 p-2 rounded-lg text-xs bg-white text-gray-900"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold text-gray-400 font-mono">Subtitle Description</label>
                  <textarea
                    required
                    value={contentForm.faqSubtitle || ''}
                    onChange={(e) => setContentForm({ ...contentForm, faqSubtitle: e.target.value })}
                    rows={2}
                    className="w-full border border-gray-200 p-2 rounded-lg text-xs bg-white text-gray-900"
                  ></textarea>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-gray-100">
            <button type="submit" disabled={isSaving} className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer">
              {isSaving ? 'Saving Changes...' : 'Save Home Page Layout Overrides'}
            </button>
          </div>
        </form>

        {/* Dynamic Project Gallery Customizer */}
        <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-xs space-y-6 mt-8">
          <div className="border-b border-gray-100 pb-4">
            <h3 className="text-lg font-bold text-gray-900 font-sans">Homepage Project Showcase Gallery</h3>
            <p className="text-xs text-gray-500 font-sans mt-1">Upload and showcase photos of completed projects, hardware installations, and other featured work on the website homepage.</p>
          </div>

          {/* Add/Edit Project Gallery form */}
          <form id="editor-gallery" onSubmit={handleAddOrEditGalleryItem} className="bg-slate-50 p-5 rounded-2xl border border-slate-200/60 space-y-4">
            <h4 className="text-xs font-bold text-slate-800">
              {editingGalleryItemId ? 'Edit Project Showcase Item' : 'Add New Project Showcase Item'}
            </h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[9px] uppercase font-bold text-gray-400 font-mono">Project Title</label>
                <input
                  type="text"
                  required
                  value={galleryForm.title}
                  onChange={(e) => setGalleryForm({ ...galleryForm, title: e.target.value })}
                  placeholder="e.g. Structured Rack Installation"
                  className="w-full border border-gray-200 p-2.5 rounded-lg text-xs bg-white text-gray-900"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] uppercase font-bold text-gray-400 font-mono">Category Tag</label>
                <select
                  value={galleryForm.category}
                  onChange={(e) => setGalleryForm({ ...galleryForm, category: e.target.value })}
                  className="w-full border border-gray-200 p-2.5 rounded-lg text-xs bg-white text-gray-800 cursor-pointer"
                >
                  <option value="Software Engineering">Software Engineering</option>
                  <option value="Network Installation">Network Installation</option>
                  <option value="Cloud Infrastructure">Cloud Infrastructure</option>
                  <option value="General Showcase">General Showcase</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] uppercase font-bold text-gray-400 font-mono">Project Description</label>
              <textarea
                required
                value={galleryForm.description}
                onChange={(e) => setGalleryForm({ ...galleryForm, description: e.target.value })}
                placeholder="Describe the scope, technical specifications, and outcome of the work..."
                rows={3}
                className="w-full border border-gray-200 p-2.5 rounded-lg text-xs bg-white text-gray-900"
              ></textarea>
            </div>

            <div className="space-y-2">
              <label className="text-[9px] uppercase font-bold text-gray-400 font-mono block">Showcase Photo</label>
              <div className="flex flex-col sm:flex-row items-center gap-4">
                {/* Image Preview */}
                <div className="w-32 h-20 bg-slate-100 border border-slate-200/80 rounded-xl overflow-hidden flex items-center justify-center shrink-0">
                  {galleryForm.imageBase64 ? (
                    <img src={galleryForm.imageBase64} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <Icons.Image className="h-6 w-6 text-slate-350" />
                  )}
                </div>
                
                {/* Input file button */}
                <div className="flex-1 w-full">
                  <label className="inline-flex items-center px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl cursor-pointer shadow-xs">
                    <Icons.Upload className="h-4.5 w-4.5 mr-2" />
                    Choose Image File
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleGalleryImageUpload}
                      className="hidden"
                    />
                  </label>
                  <span className="text-[10px] text-gray-400 block mt-1">Accepts PNG, JPG, or SVG. Automatically converted to persistent Base64 representation.</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200/40">
              {editingGalleryItemId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingGalleryItemId(null);
                    setGalleryForm({ title: '', description: '', category: 'Software Engineering', imageBase64: '' });
                  }}
                  className="px-4 py-2.5 border border-slate-200 text-slate-650 rounded-xl text-xs font-bold hover:bg-slate-100 cursor-pointer"
                >
                  Cancel Edit
                </button>
              )}
              <button type="submit" disabled={isSaving} className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs">
                {editingGalleryItemId ? 'Update Showcase Item' : 'Add Showcase Item'}
              </button>
            </div>
          </form>

          {/* Showcase List */}
          <div className="space-y-3 pt-4 max-h-[500px] overflow-y-auto divide-y divide-slate-100">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono">Current Homepage Showcase Items</h4>
            {(db?.projectGallery || []).length > 0 ? (
              (db?.projectGallery || []).map((item) => (
                <div key={item.id} className="pt-4 border-t border-slate-100 first:border-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start space-x-4">
                    <img src={item.imageBase64} alt="" className="w-20 h-14 object-cover rounded-lg bg-slate-100 border border-slate-200/60 shrink-0" />
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-[9px] font-mono font-bold bg-slate-200 px-2 py-0.5 rounded text-slate-800 uppercase">{item.category}</span>
                        <h4 className="text-xs font-bold text-slate-950 font-display">{item.title}</h4>
                      </div>
                      <p className="text-[11px] text-slate-500 font-sans mt-1 leading-relaxed line-clamp-2">{item.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingGalleryItemId(item.id);
                        setGalleryForm({
                          title: item.title,
                          description: item.description || '',
                          category: item.category || 'Software Engineering',
                          imageBase64: item.imageBase64 || ''
                        });
                        document.getElementById('editor-gallery')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }}
                      className="p-2 border border-gray-150 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl cursor-pointer"
                      title="Edit Showcase Item"
                    >
                      <Icons.Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteGalleryItem(item.id)}
                      className="p-2 border border-gray-150 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-xl cursor-pointer"
                      title="Delete Showcase Item"
                    >
                      <Icons.Trash className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 italic py-4">No completed projects have been added to the homepage showcase yet.</p>
            )}
          </div>
        </div>

        {/* Dynamic Collaboration Process Customizer */}
        <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-xs space-y-6 mt-8">
          <div className="border-b border-gray-100 pb-4">
            <h3 className="text-lg font-bold text-gray-900 font-sans">Collaboration Process Steps</h3>
            <p className="text-xs text-gray-500 font-sans mt-1">Manage the collaboration timeline steps shown in the onboarding process of the homepage.</p>
          </div>

          {/* Add/Edit Collaboration Step form */}
          <form id="editor-process" onSubmit={handleAddOrEditProcessStep} className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 space-y-3">
            <h4 className="text-xs font-bold text-slate-800">
              {editingProcessStepId ? 'Edit Process Step' : 'Add New Process Step'}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="text-[9px] uppercase font-bold text-gray-400 font-mono">Step Number (Optional)</label>
                <input
                  type="text"
                  value={processForm.stepNumber}
                  onChange={(e) => setProcessForm({ ...processForm, stepNumber: e.target.value })}
                  placeholder="e.g. 06"
                  className="w-full border border-gray-200 p-2 rounded-lg text-xs bg-white text-gray-900"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] uppercase font-bold text-gray-400 font-mono">Step Title</label>
                <input
                  type="text"
                  required
                  value={processForm.title}
                  onChange={(e) => setProcessForm({ ...processForm, title: e.target.value })}
                  placeholder="e.g. Quality Assurance"
                  className="w-full border border-gray-200 p-2 rounded-lg text-xs bg-white text-gray-900"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] uppercase font-bold text-gray-400 font-mono">Icon Name</label>
                <select
                  value={processForm.iconName}
                  onChange={(e) => setProcessForm({ ...processForm, iconName: e.target.value })}
                  className="w-full border border-gray-200 p-2.5 rounded-lg text-xs bg-white text-gray-805 cursor-pointer"
                >
                  <option value="MessageSquare">MessageSquare (Chat)</option>
                  <option value="Layers">Layers (Infrastructure)</option>
                  <option value="CheckCircle">CheckCircle (Verified)</option>
                  <option value="Cpu">Cpu (Technology)</option>
                  <option value="ShieldCheck">ShieldCheck (Security)</option>
                  <option value="Rocket">Rocket (Launch)</option>
                  <option value="Settings">Settings/Gear</option>
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] uppercase font-bold text-gray-400 font-mono">Step Description</label>
              <textarea
                required
                value={processForm.description}
                onChange={(e) => setProcessForm({ ...processForm, description: e.target.value })}
                placeholder="Briefly state key activities or outputs of this phase..."
                rows={2}
                className="w-full border border-gray-200 p-2 rounded-lg text-xs bg-white text-gray-900"
              ></textarea>
            </div>
            <div className="flex justify-end space-x-2">
              {editingProcessStepId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingProcessStepId(null);
                    setProcessForm({ title: '', description: '', iconName: 'Cpu', stepNumber: '' });
                  }}
                  className="px-3.5 py-1.5 border border-gray-200 text-slate-655 text-xs font-bold rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
              )}
              <button type="submit" disabled={isSaving} className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg cursor-pointer">
                {editingProcessStepId ? 'Update Process Step' : 'Add Process Step'}
              </button>
            </div>
          </form>

          {/* Process Steps list */}
          <div className="space-y-3 pt-2 max-h-96 overflow-y-auto divide-y divide-slate-100">
            {(db?.processSteps || []).map((step) => (
              <div key={step.id} className="pt-3 border-t border-slate-100 first:border-0 flex items-center justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[9px] font-mono font-bold bg-slate-200 px-2 py-0.5 rounded text-slate-800">Step {step.stepNumber}</span>
                    <h4 className="text-xs font-bold text-slate-955 font-display">{step.title}</h4>
                    <span className="text-[9px] uppercase font-mono font-bold text-slate-400">({step.iconName})</span>
                  </div>
                  <p className="text-xs text-slate-500 font-sans mt-1 leading-relaxed">{step.description}</p>
                </div>
                <div className="flex items-center space-x-2 shrink-0 ml-4">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingProcessStepId(step.id);
                      setProcessForm({
                        title: step.title,
                        description: step.description || '',
                        iconName: step.iconName || 'Cpu',
                        stepNumber: step.stepNumber?.toString() || ''
                      });
                      document.getElementById('editor-process')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                    className="p-1.5 border border-gray-100 text-gray-450 hover:text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer"
                    title="Edit Step"
                  >
                    <Icons.Edit3 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteProcessStep(step.id)}
                    className="p-1.5 border border-gray-100 text-gray-450 hover:text-red-500 hover:bg-red-50 rounded-lg cursor-pointer"
                    title="Delete Step"
                  >
                    <Icons.Trash className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Dynamic FAQ Customizer */}
        <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-xs space-y-6 mt-8">
          <div className="border-b border-gray-100 pb-4">
            <h3 className="text-lg font-bold text-gray-900 font-sans">Frequently Asked Questions (FAQ)</h3>
            <p className="text-xs text-gray-500 font-sans mt-1">Add, review, and delete custom FAQ cards shown on the website homepage.</p>
          </div>

          {/* Add/Edit FAQ form */}
          <form id="editor-faq" onSubmit={handleAddOrEditFaq} className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 space-y-3">
            <h4 className="text-xs font-bold text-slate-800">
              {editingFaqId ? 'Edit FAQ Card' : 'Add New FAQ Card'}
            </h4>
            <div className="space-y-1.5">
              <label className="text-[9px] uppercase font-bold text-gray-400 font-mono">Question</label>
              <input
                type="text"
                required
                value={faqForm.question}
                onChange={(e) => setFaqForm({ ...faqForm, question: e.target.value })}
                placeholder="e.g. Do you support remote offices?"
                className="w-full border border-gray-200 p-2 rounded-lg text-xs bg-white text-gray-900"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] uppercase font-bold text-gray-400 font-mono">Answer</label>
              <textarea
                required
                value={faqForm.answer}
                onChange={(e) => setFaqForm({ ...faqForm, answer: e.target.value })}
                placeholder="Provide a realistic and direct technical answer..."
                rows={3}
                className="w-full border border-gray-200 p-2 rounded-lg text-xs bg-white text-gray-900"
              ></textarea>
            </div>
            <div className="flex justify-end space-x-2">
              {editingFaqId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingFaqId(null);
                    setFaqForm({ question: '', answer: '' });
                  }}
                  className="px-3.5 py-1.5 border border-gray-200 text-slate-655 text-xs font-bold rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
              )}
              <button type="submit" disabled={isSaving} className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg cursor-pointer">
                {editingFaqId ? 'Update FAQ Card' : 'Add FAQ Card'}
              </button>
            </div>
          </form>

          {/* FAQ Cards list */}
          <div className="space-y-3 pt-2 max-h-96 overflow-y-auto divide-y divide-slate-100">
            {(db?.faqs || []).map((faq) => (
              <div key={faq.id} className="pt-3 border-t border-slate-100 first:border-0 flex items-start justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-950 font-display">{faq.question}</h4>
                  <p className="text-xs text-slate-500 font-sans mt-1 leading-relaxed">{faq.answer}</p>
                </div>
                <div className="flex items-center space-x-2 shrink-0 ml-4">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingFaqId(faq.id);
                      setFaqForm({ question: faq.question, answer: faq.answer });
                      document.getElementById('editor-faq')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                    className="p-1.5 border border-gray-100 text-gray-450 hover:text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer"
                    title="Edit FAQ"
                  >
                    <Icons.Edit3 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteFaq(faq.id)}
                    className="p-1.5 border border-gray-100 text-gray-450 hover:text-red-500 hover:bg-red-50 rounded-lg cursor-pointer"
                    title="Delete FAQ"
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
