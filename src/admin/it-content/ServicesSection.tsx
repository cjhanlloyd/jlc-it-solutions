/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ArrowDown, ArrowUp, Cpu, Edit3, GripVertical, Plus, Trash } from 'lucide-react';
import { StoredIcon } from '../../components/StoredIcon';
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

export default function ServicesSection({ db, setDb, adminToken, adminUser, isSaving, run, showFlashMsg, setApiError, onDataChange, contentForm, setContentForm, onSave }: ContentSectionProps) {
  const activeServices = db.services || [];

  const [editingServiceId, setEditingServiceId] = React.useState<string | null>(null);
  const [serviceForm, setServiceForm] = React.useState<Partial<Service>>({
    title: '',
    description: '',
    iconName: 'Code',
    features: ['']
  });
  const [draggedServiceIndex, setDraggedServiceIndex] = React.useState<number | null>(null);

  // Services management CRUD
  const handleAddOrEditService = async (e: React.FormEvent) => {
    e.preventDefault();
    await run(async () => {
      const action = editingServiceId ? 'edit' : 'add';
      const servicePayload = {
        ...serviceForm,
        id: editingServiceId || undefined,
        // Ensure features is clean array
        features: serviceForm.features?.filter(f => f.trim() !== '') || []
      };

      const data = await adminApi('/api/admin/services', adminToken, {
          action,
          service: servicePayload
        }, 'Failed to save service.');

      setDb(prev => prev ? { ...prev, services: data.services } : prev);
      onDataChange?.();
      
      // Clear Service Form
      setEditingServiceId(null);
      setServiceForm({ title: '', description: '', iconName: 'Code', features: [''] });
      showFlashMsg(`Service ${action === 'add' ? 'created' : 'updated'} successfully!`);
    });
  };

  const handleServiceDragStart = (e: React.DragEvent, index: number) => {
    if (isSaving) {
      e.preventDefault();
      return;
    }
    setDraggedServiceIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleServiceDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleServiceDrop = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedServiceIndex === null || draggedServiceIndex === targetIndex || !db || !db.services) {
      return;
    }

    const servicesCopy = [...db.services];
    const [draggedItem] = servicesCopy.splice(draggedServiceIndex, 1);
    servicesCopy.splice(targetIndex, 0, draggedItem);

    setDraggedServiceIndex(null);
    await run(async () => {
      const order = servicesCopy.map(s => s.id);
      const data = await adminApi('/api/admin/services', adminToken, {
          action: 'reorder',
          order
        }, 'Failed to reorder services.');
      setDb(prev => prev ? { ...prev, services: data.services } : prev);
      onDataChange?.();
      showFlashMsg('Services reordered successfully!');
    });
  };

  const handleMoveService = async (serviceId: string, direction: 'up' | 'down') => {
    if (!db || !db.services) return;
    const servicesCopy = [...db.services];
    const index = servicesCopy.findIndex(s => s.id === serviceId);
    if (index === -1) return;

    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === servicesCopy.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const temp = servicesCopy[index];
    servicesCopy[index] = servicesCopy[targetIndex];
    servicesCopy[targetIndex] = temp;

    await run(async () => {
      const order = servicesCopy.map(s => s.id);
      const data = await adminApi('/api/admin/services', adminToken, {
          action: 'reorder',
          order
        }, 'Failed to reorder services.');
      setDb(prev => prev ? { ...prev, services: data.services } : prev);
      onDataChange?.();
      showFlashMsg('Services reordered successfully!');
    });
  };

  const handleDeleteService = async (serviceId: string) => {
    if (!window.confirm('Are you absolutely sure you want to delete this service?')) return;
    await run(async () => {
      const data = await adminApi('/api/admin/services', adminToken, {
          action: 'delete',
          service: { id: serviceId }
        }, 'Failed to delete service.');

      setDb(prev => prev ? { ...prev, services: data.services } : prev);
      onDataChange?.();
      showFlashMsg('Service deleted successfully.');
    });
  };

  return (
    <>
      <div className="space-y-8">
        {/* Services Page layout form */}
        <form onSubmit={onSave} className="bg-white border border-slate-200 p-5 rounded-card shadow-card space-y-6">
          <div>
            <h3 className="font-display text-lg font-semibold text-slate-900">Services Page Header</h3>
            <p className="text-xs text-slate-600 mt-0.5">Customize the main headlines rendered on the Services page.</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-800">Services Heading</label>
              <input aria-label="Services Heading"
                type="text"
                required
                value={contentForm.servicesHeader || ''}
                onChange={(e) => setContentForm({ ...contentForm, servicesHeader: e.target.value })}
                className="w-full rounded-control border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-2 focus:outline-brand-600"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-800">Services Subtitle Description</label>
              <textarea aria-label="Services Subtitle Description"
                required
                value={contentForm.servicesSubtitle || ''}
                onChange={(e) => setContentForm({ ...contentForm, servicesSubtitle: e.target.value })}
                rows={2}
                className="w-full rounded-control border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-2 focus:outline-brand-600"
              ></textarea>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button type="submit" disabled={isSaving} className="px-4 py-2.5 bg-brand-700 hover:bg-brand-800 text-white rounded-control text-sm font-semibold cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
              {isSaving ? 'Saving Changes...' : 'Save Services Page Layout Overrides'}
            </button>
          </div>
        </form>

        {/* Dynamic Services Catalog manager */}
        <div className="bg-white border border-slate-200 p-5 rounded-card shadow-card space-y-6 mt-8">
          <div>
            <h3 className="font-display text-lg font-semibold text-slate-900">Manage Corporate Services Catalog</h3>
            <p className="text-xs text-slate-600 mt-1">Add, update, or remove service category details instantly.</p>
          </div>

          {/* Add / Edit Form */}
          <form id="editor-service" onSubmit={handleAddOrEditService} className="bg-slate-50 p-5 rounded-card border border-slate-200/60 space-y-4">
            <h4 className="text-xs font-bold text-slate-900">
              {editingServiceId ? 'Edit Selected Service' : 'Add New Technology Service'}
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Title */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-800">Service Title</label>
                <input aria-label="Service Title"
                  type="text"
                  required
                  value={serviceForm.title}
                  onChange={(e) => setServiceForm({ ...serviceForm, title: e.target.value })}
                  placeholder="e.g. Cybersecurity Solutions"
                  className="w-full rounded-control border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-2 focus:outline-brand-600"
                />
              </div>

              {/* Icon Name selection */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-800">Lucide Icon ID</label>
                <select aria-label="Lucide Icon ID"
                  value={serviceForm.iconName}
                  onChange={(e) => setServiceForm({ ...serviceForm, iconName: e.target.value })}
                  className="w-full cursor-pointer rounded-control border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-2 focus:outline-brand-600"
                >
                  <option value="Code">Code</option>
                  <option value="Cloud">Cloud</option>
                  <option value="Briefcase">Briefcase</option>
                  <option value="ShieldCheck">ShieldCheck</option>
                  <option value="Cpu">Cpu</option>
                  <option value="Network">Network</option>
                  <option value="HardDrive">HardDrive</option>
                  <option value="Activity">Activity</option>
                  <option value="Terminal">Terminal</option>
                  <option value="Database">Database</option>
                </select>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-800">Service Description</label>
              <textarea aria-label="Service Description"
                required
                value={serviceForm.description}
                onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
                placeholder="Provide a comprehensive operational description of the service and the problems it solves..."
                rows={3}
                className="w-full rounded-control border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-2 focus:outline-brand-600"
              ></textarea>
            </div>

            {/* Specific Capabilities */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-800">Key Capabilities / Sub-features</label>
              {serviceForm.features?.map((feat, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <input
                    type="text"
                    aria-label={`Feature ${index + 1}`}
                    value={feat}
                    onChange={(e) => {
                      const updated = [...(serviceForm.features || [])];
                      updated[index] = e.target.value;
                      setServiceForm({ ...serviceForm, features: updated });
                    }}
                    placeholder={`Sub-feature #${index + 1}`}
                    className="w-full rounded-control border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-2 focus:outline-brand-600"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const updated = (serviceForm.features || []).filter((_, idx) => idx !== index);
                      setServiceForm({ ...serviceForm, features: updated });
                    }}
                    className="p-2 border border-slate-200 text-slate-600 hover:text-red-500 rounded-control hover:bg-white cursor-pointer"
                  >
                    <Trash className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setServiceForm({ ...serviceForm, features: [...(serviceForm.features || []), ''] })}
                className="inline-flex items-center hover:underline cursor-pointer text-sm font-medium text-slate-800"
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Add capability bullet
              </button>
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
              {editingServiceId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingServiceId(null);
                    setServiceForm({ title: '', description: '', iconName: 'Code', features: [''] });
                  }}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-control text-sm font-semibold cursor-pointer hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                >
                  Cancel Edit
                </button>
              )}
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 bg-brand-700 hover:bg-brand-800 text-white rounded-control text-sm font-semibold cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
              >
                {isSaving ? 'Saving...' : editingServiceId ? 'Update Service Details' : 'Publish Technology Service'}
              </button>
            </div>
          </form>

          {/* Active Services List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold font-display text-lg font-semibold text-slate-900">Active Service Portfolio ({activeServices.length})</h3>
              <span className="text-xs text-slate-600 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded">Vertical Order Priority</span>
            </div>
            
            <div className="space-y-3">
              {activeServices.map((srv, index) => {
                const isFirst = index === 0;
                const isLast = index === activeServices.length - 1;
                const isDragged = draggedServiceIndex === index;
                
                return (
                  <div
                    key={srv.id}
                    draggable={!isSaving}
                    onDragStart={(e) => handleServiceDragStart(e, index)}
                    onDragOver={handleServiceDragOver}
                    onDragEnd={() => setDraggedServiceIndex(null)}
                    onDrop={(e) => handleServiceDrop(e, index)}
                    className={`border p-4 rounded-card flex items-center justify-between bg-white shadow-card transition-all duration-200 ${
                      isDragged 
                        ? 'opacity-40 border-brand-600 scale-[0.98] border-dashed bg-slate-50' 
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    
                    {/* Left Side: Grip Handle & Service Metadata */}
                    <div className="flex items-center space-x-4 flex-1 min-w-0 pr-4">
                      {/* Grip Handle */}
                      <div className="text-slate-600 shrink-0 cursor-grab active:cursor-grabbing hover:text-brand-700 transition-colors p-1" title="Use drag and drop or arrows to reorder">
                        <GripVertical className="h-4.5 w-4.5" />
                      </div>
                      
                      {/* Service Icon */}
                      <div className="p-2 rounded-control bg-slate-50 border border-slate-100 text-brand-700 shrink-0">
                        <StoredIcon name={srv.iconName} fallback={Cpu} className="h-5 w-5" />
                      </div>
                      
                      {/* Title & Description */}
                      <div className="space-y-0.5 min-w-0 pr-4">
                        <div className="flex items-center space-x-2">
                          <h4 className="text-sm font-bold text-slate-900 truncate">{srv.title}</h4>
                          <span className="bg-slate-50 border border-slate-100 px-1.5 py-0.2 rounded-control text-xs font-medium text-slate-600">
                            {srv.features?.length || 0} specs
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 truncate max-w-lg md:max-w-2xl">{srv.description}</p>
                      </div>
                    </div>

                    {/* Right Side: Reordering & Action Controls */}
                    <div className="flex items-center space-x-1.5 shrink-0">
                      {/* Move Up */}
                      <button
                        type="button"
                        disabled={isFirst || isSaving}
                        onClick={() => handleMoveService(srv.id, 'up')}
                        className="p-1.5 border border-slate-200/80 text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-control disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-all cursor-pointer"
                        title="Move Up"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      
                      {/* Move Down */}
                      <button
                        type="button"
                        disabled={isLast || isSaving}
                        onClick={() => handleMoveService(srv.id, 'down')}
                        className="p-1.5 border border-slate-200/80 text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-control disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-all cursor-pointer"
                        title="Move Down"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>

                      <div className="h-4 w-px bg-slate-200 mx-1"></div>

                      {/* Edit */}
                      <button
                        type="button"
                        onClick={() => {
                          setEditingServiceId(srv.id);
                          setServiceForm(srv);
                          document.getElementById('editor-service')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }}
                        className="p-1.5 border border-slate-200/80 text-slate-600 hover:text-brand-700 hover:bg-brand-50/50 rounded-control transition-all cursor-pointer"
                        title="Edit"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      
                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => handleDeleteService(srv.id)}
                        className="p-1.5 border border-slate-200/80 text-slate-600 hover:text-red-500 hover:bg-red-50/50 rounded-control transition-all cursor-pointer"
                        title="Delete"
                      >
                        <Trash className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
