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
// Client-side image optimization helper using canvas to compress/resize for web performance
function optimizeImage(file: File, maxWidth: number = 1200, maxHeight: number = 800, quality: number = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.type === 'image/svg+xml') {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = () => reject(new Error('Failed to read SVG file'));
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Failed to load image element'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}


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
  const [editingServiceId, setEditingServiceId] = React.useState<string | null>(null);
  const [serviceForm, setServiceForm] = React.useState<Partial<Service>>({
    title: '',
    description: '',
    iconName: 'Code',
    features: ['']
  });

  // Local state for Branding
  const [brandingForm, setBrandingForm] = React.useState<Partial<BrandingSettings>>({});
  const [logoFileBase64, setLogoFileBase64] = React.useState<string>('');

  // Local state for Page Content
  const [contentForm, setContentForm] = React.useState<Partial<ContentSettings>>({});
  const [activeContentSection, setActiveContentSection] = React.useState<'home' | 'about' | 'services' | 'pricing' | 'why' | 'contact'>('home');
  const [draggedServiceIndex, setDraggedServiceIndex] = React.useState<number | null>(null);

  // Local state for Email Templates
  const [emailTemplateForm, setEmailTemplateForm] = React.useState<Partial<EmailTemplate>>({});
  const [smtpForm, setSmtpForm] = React.useState<Partial<SmtpSettings>>({});

  // Local state for Admin accounts
  const [accountForm, setAccountForm] = React.useState<any>({
    email: '',
    fullName: '',
    role: 'Editor'
  });
  const [editingOperatorEmail, setEditingOperatorEmail] = React.useState<string | null>(null);

  // Local state for FAQs, Roadmap, and Collaboration Process CRUD
  const [faqForm, setFaqForm] = React.useState({ question: '', answer: '' });
  const [roadmapForm, setRoadmapForm] = React.useState({ timeline: '', title: '', description: '', status: 'planned' as any });
  const [processForm, setProcessForm] = React.useState({ title: '', description: '', iconName: 'Cpu', stepNumber: '' });
  const [galleryForm, setGalleryForm] = React.useState({ title: '', description: '', category: 'Software Engineering', imageBase64: '' });
  const [editingFaqId, setEditingFaqId] = React.useState<string | null>(null);
  const [editingProcessStepId, setEditingProcessStepId] = React.useState<string | null>(null);
  const [editingRoadmapStepId, setEditingRoadmapStepId] = React.useState<string | null>(null);
  const [editingGalleryItemId, setEditingGalleryItemId] = React.useState<string | null>(null);

  // Local state for Gemini Tagline Prompt
  const [taglineAIPrompt, setTaglineAIPrompt] = React.useState('');
  const [generatedAITaglines, setGeneratedAITaglines] = React.useState('');
  const [isGeneratingTagline, setIsGeneratingTagline] = React.useState(false);

  // Local state for Inquiry Active View & AI Reply Assistant
  const [selectedInquiryId, setSelectedInquiryId] = React.useState<string | null>(null);
  const [inquiryStatusSelect, setInquiryStatusSelect] = React.useState<InquiryStatus>('New');
  const [inquiryNotesText, setInquiryNotesText] = React.useState('');
  const [aiInstructionsText, setAiInstructionsText] = React.useState('');
  const [isDraftingReply, setIsDraftingReply] = React.useState(false);
  const [aiDraftedReplyText, setAiDraftedReplyText] = React.useState('');
  const [replySubject, setReplySubject] = React.useState('');

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
      
      setBrandingForm(data.db.branding);
      setLogoFileBase64(data.db.branding.logoImageBase64 || '');
      setContentForm(data.db.content);
      setEmailTemplateForm(data.db.emailTemplate);
      if (data.db.smtpSettings) setSmtpForm(data.db.smtpSettings);
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

  // Inquiry Status & Notes save
  const handleUpdateInquiryStatus = async (id: string) => {
    setIsSaving(true);
    setApiError('');
    try {
      const response = await fetch('/api/admin/inquiries/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          id,
          status: inquiryStatusSelect,
          adminNotes: inquiryNotesText
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update inquiry.');
      
      setDb(prev => prev ? { ...prev, inquiries: data.inquiries } : prev);
      showFlashMsg('Inquiry updated successfully!');
    } catch (err: any) {
      setApiError(err.message || 'Error updating inquiry.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteInquiry = async (id: string) => {
    if (!window.confirm('Are you absolutely sure you want to delete this client inquiry permanently? This action cannot be undone.')) return;
    setIsSaving(true);
    setApiError('');
    try {
      const response = await fetch('/api/admin/inquiries/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ id })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to delete client inquiry.');
      setDb(prev => prev ? { ...prev, inquiries: data.inquiries } : prev);
      setSelectedInquiryId(null);
      showFlashMsg('Inquiry permanently deleted.');
    } catch (err: any) {
      setApiError(err.message || 'Error deleting inquiry.');
    } finally {
      setIsSaving(false);
    }
  };

  // Gemini-powered Inquiry Reply Drafter
  const handleGenerateReplyDraft = async (inq: Inquiry) => {
    setIsDraftingReply(true);
    setApiError('');
    setAiDraftedReplyText('');
    try {
      const response = await fetch('/api/admin/generate-reply-draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          inquiryId: inq.id,
          instructions: aiInstructionsText
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to generate draft.');
      
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
    setIsSaving(true);
    setApiError('');
    try {
      const response = await fetch('/api/admin/inquiries/reply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          inquiryId: inq.id,
          to: inq.email,
          subject: replySubject,
          body: aiDraftedReplyText
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to dispatch manual reply.');
      
      setDb(prev => prev ? { ...prev, sentEmails: data.sentEmails, inquiries: data.inquiries } : prev);
      setAiDraftedReplyText('');
      setAiInstructionsText('');
      showFlashMsg(`Reply simulation sent successfully to ${inq.email}!`);
      
      // Auto update status local state since server moved it to 'In Progress'
      setInquiryStatusSelect('In Progress');
    } catch (err: any) {
      setApiError(err.message || 'Error sending reply.');
    } finally {
      setIsSaving(false);
    }
  };

  // Services management CRUD
  const handleAddOrEditService = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setApiError('');
    try {
      const action = editingServiceId ? 'edit' : 'add';
      const servicePayload = {
        ...serviceForm,
        id: editingServiceId || undefined,
        // Ensure features is clean array
        features: serviceForm.features?.filter(f => f.trim() !== '') || []
      };

      const response = await fetch('/api/admin/services', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          action,
          service: servicePayload
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save service.');

      setDb(prev => prev ? { ...prev, services: data.services } : prev);
      onDataChange?.();
      
      // Clear Service Form
      setEditingServiceId(null);
      setServiceForm({ title: '', description: '', iconName: 'Code', features: [''] });
      showFlashMsg(`Service ${action === 'add' ? 'created' : 'updated'} successfully!`);
    } catch (err: any) {
      setApiError(err.message || 'Error saving service.');
    } finally {
      setIsSaving(false);
    }
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
    setIsSaving(true);
    setApiError('');
    try {
      const order = servicesCopy.map(s => s.id);
      const response = await fetch('/api/admin/services', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          action: 'reorder',
          order
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to reorder services.');
      setDb(prev => prev ? { ...prev, services: data.services } : prev);
      onDataChange?.();
      showFlashMsg('Services reordered successfully!');
    } catch (err: any) {
      setApiError(err.message || 'Error reordering services.');
    } finally {
      setIsSaving(false);
    }
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

    setIsSaving(true);
    setApiError('');
    try {
      const order = servicesCopy.map(s => s.id);
      const response = await fetch('/api/admin/services', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          action: 'reorder',
          order
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to reorder services.');
      setDb(prev => prev ? { ...prev, services: data.services } : prev);
      onDataChange?.();
      showFlashMsg('Services reordered successfully!');
    } catch (err: any) {
      setApiError(err.message || 'Error reordering services.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSmtpSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setApiError('');
    try {
      const response = await fetch('/api/admin/settings/smtp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify(smtpForm)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save SMTP settings.');
      setDb(prev => prev ? { ...prev, smtpSettings: data.smtpSettings } : prev);
      showFlashMsg('SMTP Mail Configuration saved successfully!');
    } catch (err: any) {
      setApiError(err.message || 'Error saving SMTP settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetPassword = async (email: string, newPass: string) => {
    setIsSaving(true);
    setApiError('');
    try {
      const response = await fetch('/api/admin/accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          action: 'reset_password',
          admin: { email, password: newPass }
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to reset password.');
      showFlashMsg(`Password reset successfully for ${email}!`);
    } catch (err: any) {
      setApiError(err.message || 'Error resetting password.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddOrEditFaq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!faqForm.question || !faqForm.answer) return;
    setIsSaving(true);
    setApiError('');
    const action = editingFaqId ? 'update' : 'add';
    try {
      const response = await fetch('/api/admin/faqs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          action,
          faq: {
            id: editingFaqId || undefined,
            question: faqForm.question,
            answer: faqForm.answer
          }
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Failed to ${action} FAQ.`);
      setDb(prev => prev ? { ...prev, faqs: data.faqs } : prev);
      onDataChange?.();
      setFaqForm({ question: '', answer: '' });
      setEditingFaqId(null);
      showFlashMsg(editingFaqId ? 'FAQ updated successfully!' : 'FAQ card created successfully!');
    } catch (err: any) {
      setApiError(err.message || 'Error processing FAQ.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteFaq = async (faqId: string) => {
    if (!window.confirm('Are you sure you want to delete this FAQ?')) return;
    setIsSaving(true);
    setApiError('');
    try {
      const response = await fetch('/api/admin/faqs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          action: 'delete',
          faq: { id: faqId }
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to delete FAQ.');
      setDb(prev => prev ? { ...prev, faqs: data.faqs } : prev);
      onDataChange?.();
      if (editingFaqId === faqId) {
        setFaqForm({ question: '', answer: '' });
        setEditingFaqId(null);
      }
      showFlashMsg('FAQ removed.');
    } catch (err: any) {
      setApiError(err.message || 'Error deleting FAQ.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddOrEditRoadmap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roadmapForm.timeline || !roadmapForm.title || !roadmapForm.description) return;
    setIsSaving(true);
    setApiError('');
    const action = editingRoadmapStepId ? 'update' : 'add';
    try {
      const response = await fetch('/api/admin/roadmap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          action,
          step: {
            id: editingRoadmapStepId || undefined,
            timeline: roadmapForm.timeline,
            title: roadmapForm.title,
            description: roadmapForm.description,
            status: roadmapForm.status
          }
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Failed to ${action} roadmap milestone.`);
      setDb(prev => prev ? { ...prev, roadmapSteps: data.roadmapSteps } : prev);
      onDataChange?.();
      setRoadmapForm({ timeline: '', title: '', description: '', status: 'planned' });
      setEditingRoadmapStepId(null);
      showFlashMsg(editingRoadmapStepId ? 'Roadmap Milestone updated successfully!' : 'Roadmap Milestone added successfully!');
    } catch (err: any) {
      setApiError(err.message || 'Error processing milestone.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRoadmap = async (stepId: string) => {
    if (!window.confirm('Are you sure you want to delete this milestone?')) return;
    setIsSaving(true);
    setApiError('');
    try {
      const response = await fetch('/api/admin/roadmap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          action: 'delete',
          step: { id: stepId }
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to delete milestone.');
      setDb(prev => prev ? { ...prev, roadmapSteps: data.roadmapSteps } : prev);
      onDataChange?.();
      if (editingRoadmapStepId === stepId) {
        setRoadmapForm({ timeline: '', title: '', description: '', status: 'planned' });
        setEditingRoadmapStepId(null);
      }
      showFlashMsg('Roadmap milestone removed.');
    } catch (err: any) {
      setApiError(err.message || 'Error deleting milestone.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddOrEditProcessStep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!processForm.title || !processForm.description) return;
    setIsSaving(true);
    setApiError('');
    const action = editingProcessStepId ? 'update' : 'add';
    try {
      const response = await fetch('/api/admin/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          action,
          step: {
            id: editingProcessStepId || undefined,
            stepNumber: processForm.stepNumber || undefined,
            title: processForm.title,
            description: processForm.description,
            iconName: processForm.iconName
          }
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Failed to ${action} collaboration step.`);
      setDb(prev => prev ? { ...prev, processSteps: data.processSteps } : prev);
      onDataChange?.();
      setProcessForm({ title: '', description: '', iconName: 'Cpu', stepNumber: '' });
      setEditingProcessStepId(null);
      showFlashMsg(editingProcessStepId ? 'Collaboration step updated successfully!' : 'Collaboration step added successfully!');
    } catch (err: any) {
      setApiError(err.message || 'Error processing process step.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProcessStep = async (stepId: string) => {
    if (!window.confirm('Are you sure you want to delete this process step?')) return;
    setIsSaving(true);
    setApiError('');
    try {
      const response = await fetch('/api/admin/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          action: 'delete',
          step: { id: stepId }
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to delete process step.');
      setDb(prev => prev ? { ...prev, processSteps: data.processSteps } : prev);
      onDataChange?.();
      if (editingProcessStepId === stepId) {
        setProcessForm({ title: '', description: '', iconName: 'Cpu', stepNumber: '' });
        setEditingProcessStepId(null);
      }
      showFlashMsg('Collaboration process step removed.');
    } catch (err: any) {
      setApiError(err.message || 'Error deleting process step.');
    } finally {
      setIsSaving(false);
    }
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

  const handleAddOrEditGalleryItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!galleryForm.title || !galleryForm.description || !galleryForm.imageBase64) {
      alert("Please enter a title, description, and upload a showcase photo!");
      return;
    }
    setIsSaving(true);
    setApiError('');
    const action = editingGalleryItemId ? 'update' : 'add';
    try {
      const response = await fetch('/api/admin/gallery', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          action,
          project: {
            id: editingGalleryItemId || undefined,
            title: galleryForm.title,
            description: galleryForm.description,
            category: galleryForm.category,
            imageBase64: galleryForm.imageBase64
          }
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Failed to ${action} gallery item.`);
      setDb(prev => prev ? { ...prev, projectGallery: data.projectGallery } : prev);
      onDataChange?.();
      setGalleryForm({ title: '', description: '', category: 'Software Engineering', imageBase64: '' });
      setEditingGalleryItemId(null);
      showFlashMsg(editingGalleryItemId ? 'Showcase project updated successfully!' : 'Showcase project added to homepage gallery successfully!');
    } catch (err: any) {
      setApiError(err.message || 'Error processing gallery item.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteGalleryItem = async (itemId: string) => {
    if (!window.confirm('Are you sure you want to delete this showcase project from the homepage?')) return;
    setIsSaving(true);
    setApiError('');
    try {
      const response = await fetch('/api/admin/gallery', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          action: 'delete',
          project: { id: itemId }
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to delete gallery item.');
      setDb(prev => prev ? { ...prev, projectGallery: data.projectGallery } : prev);
      onDataChange?.();
      if (editingGalleryItemId === itemId) {
        setGalleryForm({ title: '', description: '', category: 'Software Engineering', imageBase64: '' });
        setEditingGalleryItemId(null);
      }
      showFlashMsg('Showcase project removed from gallery.');
    } catch (err: any) {
      setApiError(err.message || 'Error deleting gallery item.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    if (!window.confirm('Are you absolutely sure you want to delete this service?')) return;
    setIsSaving(true);
    setApiError('');
    try {
      const response = await fetch('/api/admin/services', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          action: 'delete',
          service: { id: serviceId }
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to delete service.');

      setDb(prev => prev ? { ...prev, services: data.services } : prev);
      onDataChange?.();
      showFlashMsg('Service deleted successfully.');
    } catch (err: any) {
      setApiError(err.message || 'Error removing service.');
    } finally {
      setIsSaving(false);
    }
  };

  // Branding Settings update
  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setApiError('');
    try {
      const response = await fetch('/api/admin/settings/branding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          ...brandingForm,
          logoImageBase64: logoFileBase64 || undefined
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update branding.');

      setDb(prev => prev ? { ...prev, branding: data.branding } : prev);
      onDataChange?.();
      showFlashMsg('Corporate branding settings saved successfully!');
    } catch (err: any) {
      setApiError(err.message || 'Error saving branding.');
    } finally {
      setIsSaving(false);
    }
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
      const response = await fetch('/api/admin/generate-tagline', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ prompt: taglineAIPrompt })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Tagline generation failed.');
      
      setGeneratedAITaglines(data.generatedText);
    } catch (err: any) {
      setApiError(err.message || 'Gemini error.');
    } finally {
      setIsGeneratingTagline(false);
    }
  };

  // Content Customizer save
  const handleSaveContent = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setApiError('');
    try {
      const response = await fetch('/api/admin/settings/content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify(contentForm)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update pages content.');

      setDb(prev => prev ? { ...prev, content: data.content } : prev);
      onDataChange?.();
      showFlashMsg('Website text content customization completed successfully!');
    } catch (err: any) {
      setApiError(err.message || 'Error saving content.');
    } finally {
      setIsSaving(false);
    }
  };

  // Acknowledgment template customizer
  const handleSaveEmailTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setApiError('');
    try {
      const response = await fetch('/api/admin/email-template', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify(emailTemplateForm)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update template.');

      setDb(prev => prev ? { ...prev, emailTemplate: data.emailTemplate } : prev);
      showFlashMsg('Automated acknowledgment email template saved!');
    } catch (err: any) {
      setApiError(err.message || 'Error saving template.');
    } finally {
      setIsSaving(false);
    }
  };

  // Admin Account creation & modification
  const handleAddAdminAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setApiError('');
    try {
      const isEditing = !!editingOperatorEmail;
      const payload = {
        action: isEditing ? 'edit' : 'invite',
        admin: {
          email: isEditing ? editingOperatorEmail : accountForm.email,
          fullName: accountForm.fullName,
          role: accountForm.role
        }
      };

      const response = await fetch('/api/admin/accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Failed to ${isEditing ? 'modify details' : 'send invitation'}.`);

      setDb(prev => prev ? { ...prev, admins: data.admins } : prev);
      setAccountForm({ email: '', fullName: '', role: 'Editor' });
      setEditingOperatorEmail(null);
      showFlashMsg(isEditing ? 'Administrator details modified successfully!' : 'Invitation sent successfully! Link logged to System Activity logs.');
      fetchAdminData();
    } catch (err: any) {
      setApiError(err.message || 'Error managing admin account.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAdminAccount = async (email: string) => {
    if (!window.confirm(`Are you sure you want to remove administrator: ${email}?`)) return;
    setIsSaving(true);
    setApiError('');
    try {
      const response = await fetch('/api/admin/accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          action: 'delete',
          admin: { email }
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to remove account.');

      setDb(prev => prev ? { ...prev, admins: data.admins } : prev);
      showFlashMsg('Administrator account removed.');
    } catch (err: any) {
      setApiError(err.message || 'Error deleting account.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleAdminStatus = async (email: string) => {
    setIsSaving(true);
    setApiError('');
    try {
      const response = await fetch('/api/admin/accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          action: 'toggle_status',
          admin: { email }
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to toggle account status.');

      setDb(prev => prev ? { ...prev, admins: data.admins } : prev);
      showFlashMsg('Administrator status updated successfully.');
    } catch (err: any) {
      setApiError(err.message || 'Error updating status.');
    } finally {
      setIsSaving(false);
    }
  };

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
          {activeSubTab === 'inquiries' && (
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
          )}


          {/* TAB 2: SERVICES MANAGEMENT CRUD */}


          {/* TAB 3: BRANDING & SLOGANS */}
          {activeSubTab === 'branding' && (
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
          )}


          {/* TAB 4: PAGE CONTENT CUSTOMIZER */}
          {activeSubTab === 'content' && (
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
              {activeContentSection === 'home' && (
                <div className="space-y-8">
                  {/* Home Page Layout Overrides form */}
                  <form onSubmit={handleSaveContent} className="bg-white border border-gray-200 p-6 rounded-2xl shadow-xs space-y-6">
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
              )}

              {/* 2. ABOUT US PAGE SUB-TAB */}
              {activeContentSection === 'about' && (
                <div className="space-y-8">
                  {/* About Us Page Layout Overrides form */}
                  <form onSubmit={handleSaveContent} className="bg-white border border-gray-200 p-6 rounded-2xl shadow-xs space-y-6">
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
              )}

              {/* 3. SERVICES PAGE SUB-TAB */}
              {activeContentSection === 'services' && (
                <div className="space-y-8">
                  {/* Services Page layout form */}
                  <form onSubmit={handleSaveContent} className="bg-white border border-gray-200 p-6 rounded-2xl shadow-xs space-y-6">
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
              )}

              {/* 4. WHY CHOOSE US PAGE SUB-TAB */}
              {activeContentSection === 'why' && (
                <div className="space-y-8">
                  {/* Why Choose Us Page Layout Overrides form */}
                  <form onSubmit={handleSaveContent} className="bg-white border border-gray-200 p-6 rounded-2xl shadow-xs space-y-6">
                    <div>
                      <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest font-mono">Why Choose Us Page Details</h3>
                      <p className="text-xs text-gray-400 font-sans mt-0.5">Edit points, promise highlights, and landing CTA details.</p>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Section Header Paragraph</label>
                        <textarea
                          required
                          value={contentForm.whyChooseUsText || ''}
                          onChange={(e) => setContentForm({ ...contentForm, whyChooseUsText: e.target.value })}
                          rows={3}
                          className="w-full border border-gray-200 p-2.5 rounded-lg text-xs"
                        ></textarea>
                      </div>

                      {/* Promises/Trust block left side */}
                      <div className="space-y-3 pt-3 border-t border-slate-100">
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Left Column Promise Header</label>
                          <input
                            type="text"
                            required
                            value={contentForm.whyChooseUsPromiseTitle || ''}
                            onChange={(e) => setContentForm({ ...contentForm, whyChooseUsPromiseTitle: e.target.value })}
                            className="w-full border border-gray-200 p-2.5 rounded-lg text-xs"
                            placeholder="Stable Future Engineering Commitments"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Left Column Promise Paragraph</label>
                          <textarea
                            required
                            value={contentForm.whyChooseUsPromiseDesc || ''}
                            onChange={(e) => setContentForm({ ...contentForm, whyChooseUsPromiseDesc: e.target.value })}
                            rows={2}
                            className="w-full border border-gray-200 p-2.5 rounded-lg text-xs"
                          ></textarea>
                        </div>
                      </div>

                      {/* Promises list */}
                      <div className="space-y-4 border-t border-gray-100 pt-5 mt-5">
                        <h4 className="text-xs font-bold text-gray-900 uppercase tracking-widest font-mono">Left Column Trust Guarantees</h4>
                        <p className="text-[10px] text-gray-500 font-sans">Modify the titles and descriptions of the 3 promises shown on the left of the Why Choose Us section.</p>
                        
                        <div className="grid grid-cols-1 gap-6">
                          {(contentForm.whyChooseUsPromises || DEFAULT_WHY_PROMISES).map((prom: any, index: number) => (
                            <div key={prom.id} className="p-4 bg-slate-50/50 rounded-xl border border-slate-100 space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] uppercase font-mono font-bold text-blue-600">Promise #{index + 1}</span>
                                <span className="text-[10px] font-mono text-gray-400">ID: {prom.id}</span>
                              </div>
                              
                              <div className="space-y-1">
                                <label className="text-[9px] uppercase font-bold text-gray-400 font-mono">Title</label>
                                <input
                                  type="text"
                                  required
                                  value={prom.title}
                                  onChange={(e) => {
                                    const newProms = [...(contentForm.whyChooseUsPromises || DEFAULT_WHY_PROMISES)];
                                    newProms[index] = { ...prom, title: e.target.value };
                                    setContentForm({ ...contentForm, whyChooseUsPromises: newProms });
                                  }}
                                  className="w-full border border-gray-200 p-2 rounded-lg text-xs bg-white text-gray-900"
                                />
                              </div>
                              
                              <div className="space-y-1">
                                <label className="text-[9px] uppercase font-bold text-gray-400 font-mono">Description</label>
                                <textarea
                                  required
                                  value={prom.description}
                                  onChange={(e) => {
                                    const newProms = [...(contentForm.whyChooseUsPromises || DEFAULT_WHY_PROMISES)];
                                    newProms[index] = { ...prom, description: e.target.value };
                                    setContentForm({ ...contentForm, whyChooseUsPromises: newProms });
                                  }}
                                  rows={2}
                                  className="w-full border border-gray-200 p-2 rounded-lg text-xs bg-white text-gray-900"
                                ></textarea>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Dynamic feature cards accordion style */}
                      <div className="space-y-4 border-t border-gray-100 pt-5 mt-5">
                        <h3 className="text-xs font-bold text-gray-900 uppercase tracking-widest font-mono">Right Column Value Highlights</h3>
                        <p className="text-[10px] text-gray-500 font-sans">Modify the titles, descriptions, and icon styles representing the 4 core guarantees shown on the homepage.</p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {(contentForm.whyChooseUsPoints || []).map((point: any, index: number) => (
                            <div key={point.id} className="p-4 bg-slate-50/50 rounded-xl border border-slate-100 space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] uppercase font-mono font-bold text-blue-655">Card #{index + 1}</span>
                                <span className="text-[10px] font-mono text-gray-400">ID: {point.id}</span>
                              </div>
                              
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <label className="text-[9px] uppercase font-bold text-gray-400 font-mono">Title</label>
                                  <input
                                    type="text"
                                    required
                                    value={point.title}
                                    onChange={(e) => {
                                      const newPoints = [...(contentForm.whyChooseUsPoints || [])];
                                      newPoints[index] = { ...point, title: e.target.value };
                                      setContentForm({ ...contentForm, whyChooseUsPoints: newPoints });
                                    }}
                                    className="w-full border border-gray-200 p-2 rounded-lg text-xs bg-white text-gray-900"
                                  />
                                </div>
                                
                                <div className="space-y-1">
                                  <label className="text-[9px] uppercase font-bold text-gray-400 font-mono">Icon Name</label>
                                  <select
                                    value={point.iconName}
                                    onChange={(e) => {
                                      const newPoints = [...(contentForm.whyChooseUsPoints || [])];
                                      newPoints[index] = { ...point, iconName: e.target.value };
                                      setContentForm({ ...contentForm, whyChooseUsPoints: newPoints });
                                    }}
                                    className="w-full border border-gray-200 p-2.5 rounded-lg text-xs bg-white text-gray-805 cursor-pointer"
                                  >
                                    <option value="Heart">Heart (Love)</option>
                                    <option value="CheckCircle">CheckCircle (Checkmark)</option>
                                    <option value="MessageSquare">MessageSquare (Bubble)</option>
                                    <option value="Lock">Lock (Security)</option>
                                    <option value="Cpu">Cpu (Tech)</option>
                                    <option value="ShieldCheck">ShieldCheck (Shield)</option>
                                    <option value="Zap">Zap (Lightning)</option>
                                    <option value="Award">Award (Badge)</option>
                                  </select>
                                </div>
                              </div>
                              
                              <div className="space-y-1">
                                <label className="text-[9px] uppercase font-bold text-gray-400 font-mono">Description</label>
                                <textarea
                                  required
                                  value={point.description}
                                  onChange={(e) => {
                                    const newPoints = [...(contentForm.whyChooseUsPoints || [])];
                                    newPoints[index] = { ...point, description: e.target.value };
                                    setContentForm({ ...contentForm, whyChooseUsPoints: newPoints });
                                  }}
                                  rows={3}
                                  className="w-full border border-gray-200 p-2 rounded-lg text-xs bg-white text-gray-900"
                                ></textarea>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Closing CTA Box Customizer */}
                      <div className="space-y-3 pt-4 border-t border-slate-105 mt-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">CTA Banner Title</label>
                          <input
                            type="text"
                            required
                            value={contentForm.whyChooseUsCtaTitle || ''}
                            onChange={(e) => setContentForm({ ...contentForm, whyChooseUsCtaTitle: e.target.value })}
                            className="w-full border border-gray-200 p-2.5 rounded-lg text-xs"
                            placeholder="Need a tailor-made technological solution?"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">CTA Banner Description</label>
                          <textarea
                            required
                            value={contentForm.whyChooseUsCtaDesc || ''}
                            onChange={(e) => setContentForm({ ...contentForm, whyChooseUsCtaDesc: e.target.value })}
                            rows={3}
                            className="w-full border border-gray-200 p-2.5 rounded-lg text-xs"
                          ></textarea>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end pt-4 border-t border-gray-100">
                      <button type="submit" disabled={isSaving} className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer">
                        {isSaving ? 'Saving Changes...' : 'Save Why Choose Us Page Layout Overrides'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* 5. CONTACT US PAGE SUB-TAB */}
              {activeContentSection === 'contact' && (
                <div className="space-y-8">
                  {/* Contact Us Page Layout Overrides form */}
                  <form onSubmit={handleSaveContent} className="bg-white border border-gray-200 p-6 rounded-2xl shadow-xs space-y-6">
                    <div>
                      <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest font-mono">Contact Us Page Details</h3>
                      <p className="text-xs text-gray-400 font-sans mt-0.5">Edit details, addresses, working hours, and coordinates of the office.</p>
                    </div>

                    <div className="space-y-4">
                      <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-100 space-y-3">
                        <span className="text-[10px] uppercase font-mono font-bold text-blue-650">Contact Us Section Headings</span>
                        <div className="space-y-2">
                          <div className="space-y-1">
                            <label className="text-[9px] uppercase font-bold text-gray-400 font-mono">Heading</label>
                            <input
                              type="text"
                              required
                              value={contentForm.contactHeader || ''}
                              onChange={(e) => setContentForm({ ...contentForm, contactHeader: e.target.value })}
                              className="w-full border border-gray-200 p-2 rounded-lg text-xs bg-white text-gray-900"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] uppercase font-bold text-gray-400 font-mono">Subtitle Description</label>
                            <textarea
                              required
                              value={contentForm.contactSubtitle || ''}
                              onChange={(e) => setContentForm({ ...contentForm, contactSubtitle: e.target.value })}
                              rows={2}
                              className="w-full border border-gray-200 p-2 rounded-lg text-xs bg-white text-gray-900"
                            ></textarea>
                          </div>
                        </div>
                      </div>

                      <h3 className="text-xs font-bold text-gray-900 uppercase tracking-widest font-mono pt-2">Corporate Contact Details &amp; Social Channels</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Office Postal Address</label>
                          <input
                            type="text"
                            required
                            value={contentForm.contactAddress || ''}
                            onChange={(e) => setContentForm({ ...contentForm, contactAddress: e.target.value })}
                            className="w-full border border-gray-200 p-2.5 rounded-lg text-xs"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Customer Hotline Phone</label>
                          <input
                            type="text"
                            required
                            value={contentForm.contactPhone || ''}
                            onChange={(e) => setContentForm({ ...contentForm, contactPhone: e.target.value })}
                            className="w-full border border-gray-200 p-2.5 rounded-lg text-xs"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Inquiry Inbox Email</label>
                          <input
                            type="email"
                            required
                            value={contentForm.contactEmail || ''}
                            onChange={(e) => setContentForm({ ...contentForm, contactEmail: e.target.value })}
                            className="w-full border border-gray-200 p-2.5 rounded-lg text-xs"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Business Working Hours</label>
                          <input
                            type="text"
                            required
                            value={contentForm.contactWorkingHours || ''}
                            onChange={(e) => setContentForm({ ...contentForm, contactWorkingHours: e.target.value })}
                            className="w-full border border-gray-200 p-2.5 rounded-lg text-xs"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Facebook Page URL</label>
                          <input
                            type="url"
                            value={contentForm.facebookUrl || ''}
                            onChange={(e) => setContentForm({ ...contentForm, facebookUrl: e.target.value })}
                            placeholder="https://facebook.com/..."
                            className="w-full border border-gray-200 p-2.5 rounded-lg text-xs"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">WhatsApp API Link</label>
                          <input
                            type="url"
                            value={contentForm.whatsappUrl || ''}
                            onChange={(e) => setContentForm({ ...contentForm, whatsappUrl: e.target.value })}
                            placeholder="https://wa.me/..."
                            className="w-full border border-gray-200 p-2.5 rounded-lg text-xs"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Viber Chat Protocol Link</label>
                          <input
                            type="url"
                            value={contentForm.viberUrl || ''}
                            onChange={(e) => setContentForm({ ...contentForm, viberUrl: e.target.value })}
                            placeholder="viber://chat?number=..."
                            className="w-full border border-gray-200 p-2.5 rounded-lg text-xs"
                          />
                        </div>
                      </div>

                      {/* Maps embed URL */}
                      <div className="space-y-1.5 pt-5 border-t border-gray-100">
                        <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Google Maps Embed URL</label>
                        <input
                          type="url"
                          required
                          value={contentForm.contactMapEmbedUrl || ''}
                          onChange={(e) => setContentForm({ ...contentForm, contactMapEmbedUrl: e.target.value })}
                          placeholder="https://www.google.com/maps/embed?..."
                          className="w-full border border-gray-200 p-2.5 rounded-lg text-xs"
                        />
                        <span className="text-[10px] text-gray-400 block">Provide an iframe URL from Google Maps share options to render actual geographical locator markers.</span>
                      </div>
                    </div>

                    <div className="flex justify-end pt-4 border-t border-gray-100">
                      <button type="submit" disabled={isSaving} className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer">
                        {isSaving ? 'Saving Changes...' : 'Save Contact Page Layout Overrides'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* 6. PRICING PAGE SUB-TAB */}
              {activeContentSection === 'pricing' && (
                <div className="space-y-8 animate-fade-in">
                  <form onSubmit={handleSaveContent} className="bg-white border border-gray-200 p-6 rounded-2xl shadow-xs space-y-6">
                    <div>
                      <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest font-mono">Pricing Header</h3>
                      <p className="text-xs text-gray-400 font-sans mt-0.5">Customize the pricing page title and subtitle.</p>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Pricing Header Headline</label>
                        <input
                          type="text"
                          required
                          value={contentForm.pricingHeader || ''}
                          onChange={(e) => setContentForm({ ...contentForm, pricingHeader: e.target.value })}
                          className="w-full border border-gray-200 p-2.5 rounded-lg text-xs"
                          placeholder="Technology Solutions Designed To Grow Your Business"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Pricing Header Subtitle</label>
                        <textarea
                          required
                          value={contentForm.pricingSubtitle || ''}
                          onChange={(e) => setContentForm({ ...contentForm, pricingSubtitle: e.target.value })}
                          className="w-full border border-gray-200 p-2.5 rounded-lg text-xs"
                          placeholder="From IT support to digital transformation, JLC provides reliable technology solutions that help businesses operate smarter."
                          rows={2}
                        />
                      </div>
                    </div>

                    <div className="pt-4 border-t border-gray-100">
                      <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest font-mono">Enterprise & Hospitality Highlights</h3>
                      <p className="text-xs text-gray-400 font-sans mt-0.5">Customize the enterprise technology spotlight section.</p>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Spotlight Section Title</label>
                        <input
                          type="text"
                          required
                          value={contentForm.pricingEnterpriseTitle || ''}
                          onChange={(e) => setContentForm({ ...contentForm, pricingEnterpriseTitle: e.target.value })}
                          className="w-full border border-gray-200 p-2.5 rounded-lg text-xs"
                          placeholder="Enterprise & Hospitality Technology"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Spotlight Section Description</label>
                        <textarea
                          required
                          value={contentForm.pricingEnterpriseDesc || ''}
                          onChange={(e) => setContentForm({ ...contentForm, pricingEnterpriseDesc: e.target.value })}
                          className="w-full border border-gray-200 p-2.5 rounded-lg text-xs"
                          placeholder="Specialized technology solutions for organizations that require reliability, scalability, and professional IT management."
                          rows={2}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Spotlight Bullet Highlights (Comma-separated)</label>
                        <input
                          type="text"
                          required
                          value={contentForm.pricingEnterpriseHighlights || ''}
                          onChange={(e) => setContentForm({ ...contentForm, pricingEnterpriseHighlights: e.target.value })}
                          className="w-full border border-gray-200 p-2.5 rounded-lg text-xs"
                          placeholder="Hotel & Resort Technology, Enterprise WiFi Deployment, IoT Smart Room Solutions, PMS / System Integration, Infrastructure Design, Digital Transformation"
                        />
                        <span className="text-[10px] text-gray-400 block mt-0.5">Separate highlights with commas (e.g. Highlight 1, Highlight 2)</span>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-gray-100">
                      <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest font-mono">Need a Custom Solution CTA Block</h3>
                      <p className="text-xs text-gray-400 font-sans mt-0.5">Customize the bottom CTA banner detail on the pricing section.</p>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">CTA Banner Title</label>
                        <input
                          type="text"
                          required
                          value={contentForm.pricingCtaTitle || ''}
                          onChange={(e) => setContentForm({ ...contentForm, pricingCtaTitle: e.target.value })}
                          className="w-full border border-gray-200 p-2.5 rounded-lg text-xs"
                          placeholder="Need a custom solution?"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">CTA Banner Description</label>
                        <textarea
                          required
                          value={contentForm.pricingCtaDesc || ''}
                          onChange={(e) => setContentForm({ ...contentForm, pricingCtaDesc: e.target.value })}
                          className="w-full border border-gray-200 p-2.5 rounded-lg text-xs"
                          placeholder="Every business has unique technology requirements. Contact JLC Solutions and let's build the right solution for you."
                          rows={2}
                        />
                      </div>
                    </div>

                    <div className="pt-4 border-t border-gray-100">
                      <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest font-mono">Service pricing Cards</h3>
                      <p className="text-xs text-gray-400 font-sans mt-0.5">Manage and configure the content and price of the 4 call-to-action cards (Free Consultation, Onsite Support, Managed Services, and Business Tech Solutions).</p>
                    </div>

                    <div className="space-y-6">
                      {(contentForm.pricingCards || DEFAULT_PRICING_CARDS).map((card: PricingCard, index: number) => (
                        <div key={card.id || index} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
                          <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                            <span className="text-xs font-bold uppercase tracking-wider text-blue-700 font-mono">Card {index + 1}: {card.title}</span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Card Title</label>
                              <input
                                type="text"
                                required
                                value={card.title || ''}
                                onChange={(e) => {
                                  const newCards = [...(contentForm.pricingCards || DEFAULT_PRICING_CARDS)];
                                  newCards[index] = { ...newCards[index], title: e.target.value };
                                  setContentForm({ ...contentForm, pricingCards: newCards });
                                }}
                                className="w-full border border-gray-200 p-2.5 rounded-lg text-xs bg-white text-gray-900 font-sans"
                              />
                            </div>

                            <div className="space-y-1.5">
                              <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Pricing Label / Amount</label>
                              <input
                                type="text"
                                required
                                value={card.price || ''}
                                onChange={(e) => {
                                  const newCards = [...(contentForm.pricingCards || DEFAULT_PRICING_CARDS)];
                                  newCards[index] = { ...newCards[index], price: e.target.value };
                                  setContentForm({ ...contentForm, pricingCards: newCards });
                                }}
                                className="w-full border border-gray-200 p-2.5 rounded-lg text-xs bg-white text-gray-900 font-sans"
                              />
                            </div>

                            <div className="space-y-1.5">
                              <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Period / Sub-price</label>
                              <input
                                type="text"
                                required
                                value={card.period || ''}
                                onChange={(e) => {
                                  const newCards = [...(contentForm.pricingCards || DEFAULT_PRICING_CARDS)];
                                  newCards[index] = { ...newCards[index], period: e.target.value };
                                  setContentForm({ ...contentForm, pricingCards: newCards });
                                }}
                                className="w-full border border-gray-200 p-2.5 rounded-lg text-xs bg-white text-gray-900 font-sans"
                              />
                            </div>

                            <div className="space-y-1.5">
                              <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Button Text</label>
                              <input
                                type="text"
                                required
                                value={card.buttonText || ''}
                                onChange={(e) => {
                                  const newCards = [...(contentForm.pricingCards || DEFAULT_PRICING_CARDS)];
                                  newCards[index] = { ...newCards[index], buttonText: e.target.value };
                                  setContentForm({ ...contentForm, pricingCards: newCards });
                                }}
                                className="w-full border border-gray-200 p-2.5 rounded-lg text-xs bg-white text-gray-900 font-sans"
                              />
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Description</label>
                            <textarea
                              required
                              value={card.description || ''}
                              onChange={(e) => {
                                const newCards = [...(contentForm.pricingCards || DEFAULT_PRICING_CARDS)];
                                newCards[index] = { ...newCards[index], description: e.target.value };
                                setContentForm({ ...contentForm, pricingCards: newCards });
                              }}
                              className="w-full border border-gray-200 p-2.5 rounded-lg text-xs bg-white text-gray-900 font-sans"
                              rows={2}
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Features / Bullets (Comma-separated)</label>
                            <input
                              type="text"
                              required
                              value={card.features ? card.features.join(', ') : ''}
                              onChange={(e) => {
                                const newCards = [...(contentForm.pricingCards || DEFAULT_PRICING_CARDS)];
                                newCards[index] = { 
                                  ...newCards[index], 
                                  features: e.target.value.split(',').map(s => s.trim()).filter(Boolean) 
                                };
                                setContentForm({ ...contentForm, pricingCards: newCards });
                              }}
                              className="w-full border border-gray-200 p-2.5 rounded-lg text-xs bg-white text-gray-900 font-sans"
                            />
                            <span className="text-[10px] text-gray-400 block">Separate bullets with commas (e.g. Bullet 1, Bullet 2)</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-end pt-4 border-t border-gray-100">
                      <button
                        type="submit"
                        disabled={isSaving}
                        className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
                      >
                        {isSaving ? 'Saving Changes...' : 'Save Pricing Page Layout Overrides'}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}


          {/* TAB 5: EMAIL TEMPLATES & SMTP */}
          {activeSubTab === 'email' && (
            <div className="space-y-8" id="panel-email">
              {/* SMTP Settings card */}
              <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-xs space-y-6">
                <div className="border-b border-gray-100 pb-4">
                  <h2 className="text-xl font-bold text-gray-900 font-sans">SMTP Mail Server Settings</h2>
                  <p className="text-xs text-gray-500 font-sans mt-1">Configure actual SMTP credentials to trigger live notification emails and automated auto-acknowledgments to clients.</p>
                </div>
                
                <form onSubmit={handleSaveSmtpSettings} className="space-y-4">
                  <div className="flex items-center space-x-3 pb-2">
                    <input
                      type="checkbox"
                      id="smtp-enabled"
                      checked={smtpForm.enabled || false}
                      onChange={(e) => setSmtpForm({ ...smtpForm, enabled: e.target.checked })}
                      className="h-4.5 w-4.5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer animate-none"
                    />
                    <label htmlFor="smtp-enabled" className="text-xs font-bold text-gray-900 cursor-pointer font-sans select-none">
                      Enable Live SMTP Email Deliveries
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">SMTP Server Host</label>
                      <input
                        type="text"
                        required
                        disabled={!smtpForm.enabled}
                        value={smtpForm.host || ''}
                        onChange={(e) => setSmtpForm({ ...smtpForm, host: e.target.value })}
                        placeholder="e.g. smtp.gmail.com"
                        className="w-full border border-gray-200 p-2.5 rounded-lg text-xs disabled:bg-slate-50 disabled:text-slate-400"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">SMTP Server Port</label>
                      <input
                        type="number"
                        required
                        disabled={!smtpForm.enabled}
                        value={smtpForm.port || 587}
                        onChange={(e) => setSmtpForm({ ...smtpForm, port: parseInt(e.target.value, 10) })}
                        placeholder="e.g. 587"
                        className="w-full border border-gray-200 p-2.5 rounded-lg text-xs disabled:bg-slate-50 disabled:text-slate-400"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Username</label>
                      <input
                        type="text"
                        required={smtpForm.enabled}
                        disabled={!smtpForm.enabled}
                        value={smtpForm.username || ''}
                        onChange={(e) => setSmtpForm({ ...smtpForm, username: e.target.value })}
                        placeholder="Username/Email"
                        className="w-full border border-gray-200 p-2.5 rounded-lg text-xs disabled:bg-slate-50 disabled:text-slate-400"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Password</label>
                      <input
                        type="password"
                        required={smtpForm.enabled}
                        disabled={!smtpForm.enabled}
                        value={smtpForm.password || ''}
                        onChange={(e) => setSmtpForm({ ...smtpForm, password: e.target.value })}
                        placeholder="Password"
                        className="w-full border border-gray-200 p-2.5 rounded-lg text-xs disabled:bg-slate-50 disabled:text-slate-400"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Sender Name</label>
                      <input
                        type="text"
                        required
                        disabled={!smtpForm.enabled}
                        value={smtpForm.senderName || ''}
                        onChange={(e) => setSmtpForm({ ...smtpForm, senderName: e.target.value })}
                        placeholder="JLC Solutions Support"
                        className="w-full border border-gray-200 p-2.5 rounded-lg text-xs disabled:bg-slate-50 disabled:text-slate-400"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Sender Email</label>
                      <input
                        type="email"
                        required
                        disabled={!smtpForm.enabled}
                        value={smtpForm.senderEmail || ''}
                        onChange={(e) => setSmtpForm({ ...smtpForm, senderEmail: e.target.value })}
                        placeholder="contact@jlcsolutions.com"
                        className="w-full border border-gray-200 p-2.5 rounded-lg text-xs disabled:bg-slate-50 disabled:text-slate-400"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Email Signature</label>
                    <textarea
                      disabled={!smtpForm.enabled}
                      value={smtpForm.signature || ''}
                      onChange={(e) => setSmtpForm({ ...smtpForm, signature: e.target.value })}
                      rows={3}
                      placeholder="Best regards,..."
                      className="w-full border border-gray-200 p-2.5 rounded-lg text-xs disabled:bg-slate-50 disabled:text-slate-400"
                    ></textarea>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      {isSaving ? 'Saving...' : 'Save SMTP Settings'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Template card */}
              <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-xs space-y-6">
                <div className="border-b border-gray-100 pb-4">
                  <h2 className="text-xl font-bold text-gray-900 font-sans">Automated Email Template</h2>
                  <p className="text-xs text-gray-500 font-sans mt-1">Customize the subject lines and paragraph layout template for immediate user feedback emails upon inquiry submission.</p>
                </div>

                {/* Form Customizer */}
                <form onSubmit={handleSaveEmailTemplate} className="space-y-6">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Email Subject Line</label>
                    <input
                      type="text"
                      required
                      value={emailTemplateForm.subject || ''}
                      onChange={(e) => setEmailTemplateForm({ ...emailTemplateForm, subject: e.target.value })}
                      className="w-full border border-gray-200 p-2.5 rounded-lg text-xs font-bold"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Email Body Text Markup</label>
                    <textarea
                      required
                      value={emailTemplateForm.body || ''}
                      onChange={(e) => setEmailTemplateForm({ ...emailTemplateForm, body: e.target.value })}
                      rows={10}
                      className="w-full border border-gray-200 p-3 rounded-lg text-xs font-mono leading-relaxed bg-gray-50 text-gray-700"
                    ></textarea>
                  </div>

                  {/* Help on dynamic fields */}
                  <div className="bg-yellow-50 border border-yellow-100 p-4 rounded-xl text-xs text-yellow-800 space-y-1.5">
                    <h4 className="font-bold font-sans">Dynamic replacement parameters:</h4>
                    <p>Incorporate the following parameter keywords to automatically populate the customized email on submission:</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[10px] font-bold text-yellow-900 pt-1">
                      <span>{"{{name}}"} - Full Name</span>
                      <span>{"{{service}}"} - Service required</span>
                      <span>{"{{projectDescription}}"} - Description</span>
                      <span>{"{{preferredContact}}"} - Method</span>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4 border-t border-gray-100">
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                    >
                      {isSaving ? 'Saving Changes...' : 'Save Acknowledgment Template'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}


          {/* TAB 6: ADMIN ACCOUNTS */}
          {activeSubTab === 'accounts' && (
            <div className="space-y-6" id="panel-accounts">
              <div className="border-b border-gray-100 pb-4 mb-4">
                <h2 className="text-xl font-bold text-gray-900 font-sans">Administrator Accounts Settings</h2>
                <p className="text-xs text-gray-500 font-sans mt-1">Invite, review, or revoke login accounts for corporate managers and editors. (Super Admins only)</p>
              </div>

              {adminUser.role !== 'Super Admin' ? (
                <div className="p-5 border border-yellow-100 bg-yellow-50 text-yellow-800 text-xs rounded-xl flex items-start space-x-3">
                  <Icons.Lock className="h-5 w-5 shrink-0" />
                  <span>Access Denied: Creating or revoking system administrator credentials is strictly limited to role: <strong>Super Admin</strong>. Your current role: {adminUser.role}.</span>
                </div>
              ) : (
                <>
                  {/* Account Invitation / Edit Form */}
                  <div id="accounts-form-anchor"></div>
                  <form onSubmit={handleAddAdminAccount} className="bg-gray-50 p-5 rounded-2xl border border-gray-200/60 space-y-4">
                    <h3 className="text-sm font-bold text-gray-900 font-sans">
                      {editingOperatorEmail ? `Modify Operator: ${editingOperatorEmail}` : 'Invite New Administrator'}
                    </h3>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {/* Email */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">
                          Email Address {editingOperatorEmail && <span className="text-slate-400 font-normal lowercase">(read-only)</span>}
                        </label>
                        <input
                          type="email"
                          required
                          disabled={!!editingOperatorEmail}
                          value={editingOperatorEmail || accountForm.email}
                          onChange={(e) => setAccountForm({ ...accountForm, email: e.target.value.toLowerCase().trim() })}
                          placeholder="e.g. manager@jlcsolutions.com"
                          className="w-full border border-gray-200 p-2 rounded-lg text-xs bg-white text-gray-900 disabled:bg-slate-100 disabled:text-slate-500"
                        />
                      </div>

                      {/* Full Name */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Full Name</label>
                        <input
                          type="text"
                          required
                          value={accountForm.fullName}
                          onChange={(e) => setAccountForm({ ...accountForm, fullName: e.target.value })}
                          placeholder="John Lloyd Cahilig"
                          className="w-full border border-gray-200 p-2 rounded-lg text-xs bg-white text-gray-900"
                        />
                      </div>

                      {/* Role selection */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold text-gray-500 font-mono">Assigned Role</label>
                        <select
                          value={accountForm.role}
                          onChange={(e) => setAccountForm({ ...accountForm, role: e.target.value as AdminRole })}
                          className="w-full border border-gray-200 p-2 rounded-lg text-xs bg-white text-gray-900 cursor-pointer"
                        >
                          <option value="Super Admin">Super Admin</option>
                          <option value="Administrator">Administrator</option>
                          <option value="Editor">Editor</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex justify-end items-center gap-3 pt-2">
                      {editingOperatorEmail && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingOperatorEmail(null);
                            setAccountForm({ email: '', fullName: '', role: 'Editor' });
                          }}
                          className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-100 cursor-pointer"
                        >
                          Cancel Edit
                        </button>
                      )}
                      <button
                        type="submit"
                        disabled={isSaving}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
                      >
                        {editingOperatorEmail ? 'Save Operator Profile' : (isSaving ? 'Sending Invite...' : 'Send Invitation Link')}
                      </button>
                    </div>
                  </form>

                  {/* Administrators List */}
                  <div className="space-y-4">
                    <h3 className="text-xs uppercase font-bold text-gray-400 font-mono">Authorized Operators</h3>
                    <div className="divide-y divide-gray-100">
                      {activeAdminsList.map((admin) => {
                        const isSelf = admin.email.toLowerCase().trim() === adminUser.email.toLowerCase().trim();
                        const isPrimarySuperAdmin = admin.email === 'admin@jlcitsolutions.com';
                        return (
                          <div key={admin.email} className="py-3.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div className="flex items-center space-x-3">
                              <div className={`p-2 rounded-lg ${isPrimarySuperAdmin ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-600'}`}>
                                {admin.role === 'Super Admin' ? (
                                  <Icons.ShieldAlert className="h-4.5 w-4.5" />
                                ) : (
                                  <Icons.UserCheck className="h-4.5 w-4.5" />
                                )}
                              </div>
                              <div>
                                <span className="text-sm font-bold text-gray-900 block leading-none">
                                  {admin.fullName} {isSelf && <span className="text-[10px] text-blue-600 font-normal">(You)</span>}
                                </span>
                                <span className="text-[10px] font-mono text-gray-400 block mt-1">{admin.email}</span>
                              </div>
                            </div>
                            
                            <div className="flex flex-wrap items-center gap-2">
                              {/* Status Badge */}
                              <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-sm ${
                                admin.status === 'Active' ? 'bg-emerald-50 text-emerald-700' :
                                admin.status === 'Disabled' ? 'bg-red-50 text-red-700' :
                                'bg-yellow-50 text-yellow-700'
                              }`}>
                                {admin.status}
                              </span>

                              {/* Verified Badge */}
                              <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-sm ${
                                admin.verified ? 'bg-blue-50 text-blue-700' : 'bg-gray-150 text-gray-600'
                              }`}>
                                {admin.verified ? 'Verified' : 'Pending Verification'}
                              </span>

                              {/* Role Badge */}
                              <span className="text-[10px] font-mono font-bold uppercase text-slate-600 bg-slate-100 px-2 py-0.5 rounded-sm font-sans">
                                {admin.role}
                              </span>

                              {/* Operations controls */}
                              <div className="flex items-center space-x-2 pl-2">
                                {/* Edit details button */}
                                <button
                                  onClick={() => {
                                    setEditingOperatorEmail(admin.email);
                                    setAccountForm({
                                      email: admin.email,
                                      fullName: admin.fullName,
                                      role: admin.role
                                    });
                                    document.getElementById('accounts-form-anchor')?.scrollIntoView({ behavior: 'smooth' });
                                  }}
                                  className="p-1.5 border border-gray-100 text-gray-500 hover:text-blue-650 hover:bg-blue-50/50 rounded-lg cursor-pointer"
                                  title="Edit Operator profile"
                                >
                                  <Icons.Edit className="h-3.5 w-3.5" />
                                </button>

                                {/* Toggle status button */}
                                {!isPrimarySuperAdmin && !isSelf && (
                                  <button
                                    onClick={() => handleToggleAdminStatus(admin.email)}
                                    className={`px-2.5 py-1.5 border rounded-lg text-xs font-semibold cursor-pointer ${
                                      admin.status === 'Active'
                                        ? 'border-red-100 text-red-650 hover:bg-red-50'
                                        : 'border-emerald-100 text-emerald-650 hover:bg-emerald-50'
                                    }`}
                                    title={admin.status === 'Active' ? 'Disable Account' : 'Enable Account'}
                                  >
                                    {admin.status === 'Active' ? 'Disable' : 'Enable'}
                                  </button>
                                )}

                                {/* Reset Password button */}
                                {admin.verified && (
                                  <button
                                    onClick={() => {
                                      const newPass = window.prompt(`Enter new password for ${admin.fullName} (${admin.email}):`);
                                      if (newPass) {
                                        if (newPass.length < 6) {
                                          alert('Password must be at least 6 characters long.');
                                          return;
                                        }
                                        handleResetPassword(admin.email, newPass);
                                      }
                                    }}
                                    className="p-1.5 border border-gray-100 text-gray-550 hover:text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer"
                                    title="Reset Password"
                                  >
                                    <Icons.Key className="h-3.5 w-3.5" />
                                  </button>
                                )}

                                {/* Delete button */}
                                {!isPrimarySuperAdmin && !isSelf && (
                                  <button
                                    onClick={() => handleDeleteAdminAccount(admin.email)}
                                    className="p-1.5 border border-gray-100 text-gray-400 hover:text-red-550 hover:bg-red-50 rounded-lg cursor-pointer"
                                    title="Revoke access credentials"
                                  >
                                    <Icons.Trash className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}


          {/* TAB 7: ANALYTICS & ACTIVITY LOGS */}
          {activeSubTab === 'logs' && (
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
          )}

        </div>

      </div>

    </div>
  );
}
