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
        <form onSubmit={onSave} className="bg-white border border-gray-200 p-6 rounded-2xl shadow-xs space-y-6">
          <div>
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest font-mono">Services Page Header</h3>
            <p className="text-xs text-gray-400 font-sans mt-0.5">Customize the main headlines rendered on the Services page.</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Services Heading</label>
              <input
                type="text"
                required
                value={contentForm.servicesHeader || ''}
                onChange={(e) => setContentForm({ ...contentForm, servicesHeader: e.target.value })}
                className="w-full border border-gray-200 p-2.5 rounded-lg text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Services Subtitle Description</label>
              <textarea
                required
                value={contentForm.servicesSubtitle || ''}
                onChange={(e) => setContentForm({ ...contentForm, servicesSubtitle: e.target.value })}
                rows={2}
                className="w-full border border-gray-200 p-2.5 rounded-lg text-xs"
              ></textarea>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-gray-100">
            <button type="submit" disabled={isSaving} className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer">
              {isSaving ? 'Saving Changes...' : 'Save Services Page Layout Overrides'}
            </button>
          </div>
        </form>

        {/* Dynamic Services Catalog manager */}
        <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-xs space-y-6 mt-8">
          <div>
            <h3 className="text-lg font-bold text-gray-900 font-sans">Manage Corporate Services Catalog</h3>
            <p className="text-xs text-gray-500 font-sans mt-1">Add, update, or remove service category details instantly.</p>
          </div>

          {/* Add / Edit Form */}
          <form id="editor-service" onSubmit={handleAddOrEditService} className="bg-gray-50 p-5 rounded-2xl border border-gray-200/60 space-y-4">
            <h4 className="text-xs font-bold text-gray-900 font-sans">
              {editingServiceId ? 'Edit Selected Service' : 'Add New Technology Service'}
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Title */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Service Title</label>
                <input
                  type="text"
                  required
                  value={serviceForm.title}
                  onChange={(e) => setServiceForm({ ...serviceForm, title: e.target.value })}
                  placeholder="e.g. Cybersecurity Solutions"
                  className="w-full border border-gray-200 p-2 rounded-lg text-xs text-gray-900 bg-white"
                />
              </div>

              {/* Icon Name selection */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Lucide Icon ID</label>
                <select
                  value={serviceForm.iconName}
                  onChange={(e) => setServiceForm({ ...serviceForm, iconName: e.target.value })}
                  className="w-full border border-gray-200 p-2 rounded-lg text-xs text-gray-900 bg-white cursor-pointer"
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
              <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Service Description</label>
              <textarea
                required
                value={serviceForm.description}
                onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
                placeholder="Provide a comprehensive operational description of the service and the problems it solves..."
                rows={3}
                className="w-full border border-gray-200 p-2 rounded-lg text-xs text-gray-900 bg-white"
              ></textarea>
            </div>

            {/* Specific Capabilities */}
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-gray-500 font-mono block">Key Capabilities / Sub-features</label>
              {serviceForm.features?.map((feat, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={feat}
                    onChange={(e) => {
                      const updated = [...(serviceForm.features || [])];
                      updated[index] = e.target.value;
                      setServiceForm({ ...serviceForm, features: updated });
                    }}
                    placeholder={`Sub-feature #${index + 1}`}
                    className="w-full border border-gray-200 p-2 rounded-lg text-xs text-gray-900 bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const updated = (serviceForm.features || []).filter((_, idx) => idx !== index);
                      setServiceForm({ ...serviceForm, features: updated });
                    }}
                    className="p-2 border border-gray-200 text-gray-450 hover:text-red-500 rounded-lg hover:bg-white cursor-pointer"
                  >
                    <Icons.Trash className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setServiceForm({ ...serviceForm, features: [...(serviceForm.features || []), ''] })}
                className="inline-flex items-center text-[10px] uppercase font-bold text-blue-650 font-mono hover:underline cursor-pointer"
              >
                <Icons.Plus className="h-3.5 w-3.5 mr-1" /> Add capability bullet
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
                  className="px-4 py-2 border border-gray-200 text-gray-550 rounded-lg text-xs font-semibold cursor-pointer hover:bg-gray-100"
                >
                  Cancel Edit
                </button>
              )}
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                {isSaving ? 'Saving...' : editingServiceId ? 'Update Service Details' : 'Publish Technology Service'}
              </button>
            </div>
          </form>

          {/* Active Services List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-xs uppercase font-extrabold text-gray-400 font-mono tracking-widest">Active Service Portfolio ({activeServices.length})</h3>
              <span className="text-[10px] text-gray-400 bg-gray-50 border border-gray-150 px-2 py-0.5 rounded font-mono">Vertical Order Priority</span>
            </div>
            
            <div className="space-y-3">
              {activeServices.map((srv, index) => {
                const SrvIcon = (Icons as any)[srv.iconName] || Icons.Cpu;
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
                    className={`border p-4 rounded-xl flex items-center justify-between bg-white shadow-xs transition-all duration-205 ${
                      isDragged 
                        ? 'opacity-40 border-blue-500 scale-[0.98] border-dashed bg-slate-50' 
                        : 'border-gray-200/80 hover:border-gray-300'
                    }`}
                  >
                    
                    {/* Left Side: Grip Handle & Service Metadata */}
                    <div className="flex items-center space-x-4 flex-1 min-w-0 pr-4">
                      {/* Grip Handle */}
                      <div className="text-gray-300 shrink-0 cursor-grab active:cursor-grabbing hover:text-blue-500 transition-colors p-1" title="Use drag and drop or arrows to reorder">
                        <Icons.GripVertical className="h-4.5 w-4.5" />
                      </div>
                      
                      {/* Service Icon */}
                      <div className="p-2 rounded-lg bg-gray-50 border border-gray-100 text-blue-600 shrink-0">
                        <SrvIcon className="h-5 w-5" />
                      </div>
                      
                      {/* Title & Description */}
                      <div className="space-y-0.5 min-w-0 pr-4">
                        <div className="flex items-center space-x-2">
                          <h4 className="text-sm font-bold text-gray-900 font-sans truncate">{srv.title}</h4>
                          <span className="text-[9px] font-mono text-gray-405 bg-gray-50 border border-gray-100 px-1.5 py-0.2 rounded-md uppercase">
                            {srv.features?.length || 0} specs
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 font-sans truncate max-w-lg md:max-w-2xl">{srv.description}</p>
                      </div>
                    </div>

                    {/* Right Side: Reordering & Action Controls */}
                    <div className="flex items-center space-x-1.5 shrink-0">
                      {/* Move Up */}
                      <button
                        type="button"
                        disabled={isFirst || isSaving}
                        onClick={() => handleMoveService(srv.id, 'up')}
                        className="p-1.5 border border-gray-200/80 text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-all cursor-pointer"
                        title="Move Up"
                      >
                        <Icons.ArrowUp className="h-4 w-4" />
                      </button>
                      
                      {/* Move Down */}
                      <button
                        type="button"
                        disabled={isLast || isSaving}
                        onClick={() => handleMoveService(srv.id, 'down')}
                        className="p-1.5 border border-gray-200/80 text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-all cursor-pointer"
                        title="Move Down"
                      >
                        <Icons.ArrowDown className="h-4 w-4" />
                      </button>

                      <div className="h-4 w-px bg-gray-200 mx-1"></div>

                      {/* Edit */}
                      <button
                        type="button"
                        onClick={() => {
                          setEditingServiceId(srv.id);
                          setServiceForm(srv);
                          document.getElementById('editor-service')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }}
                        className="p-1.5 border border-gray-200/80 text-gray-500 hover:text-blue-600 hover:bg-blue-50/50 rounded-lg transition-all cursor-pointer"
                        title="Edit"
                      >
                        <Icons.Edit3 className="h-4 w-4" />
                      </button>
                      
                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => handleDeleteService(srv.id)}
                        className="p-1.5 border border-gray-200/80 text-gray-500 hover:text-red-500 hover:bg-red-50/50 rounded-lg transition-all cursor-pointer"
                        title="Delete"
                      >
                        <Icons.Trash className="h-4 w-4" />
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
