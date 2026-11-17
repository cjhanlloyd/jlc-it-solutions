import React from 'react';
import type { ContentSectionProps } from './ContentTab.js';

// Only the page headings; contact details and social links are edited on the portal Content page.
export default function ContactSection({ isSaving, contentForm, setContentForm, onSave }: ContentSectionProps) {
  return (
    <form onSubmit={onSave} className="bg-white border border-slate-200 p-5 rounded-card shadow-card space-y-4">
      <h3 className="font-display text-lg font-semibold text-slate-900">Contact Us Section Headings</h3>
      <div className="space-y-1">
        <label className="text-xs font-medium text-slate-600">Heading
          <input type="text" required value={contentForm.contactHeader || ''} onChange={(e) => setContentForm({ ...contentForm, contactHeader: e.target.value })} className="mt-1 w-full rounded-control border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-2 focus:outline-brand-600" />
        </label>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-slate-600">Subtitle Description
          <textarea required rows={2} value={contentForm.contactSubtitle || ''} onChange={(e) => setContentForm({ ...contentForm, contactSubtitle: e.target.value })} className="mt-1 w-full rounded-control border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-2 focus:outline-brand-600"></textarea>
        </label>
      </div>
      <div className="flex justify-end pt-4 border-t border-slate-100">
        <button type="submit" disabled={isSaving} className="px-4 py-2.5 bg-brand-700 hover:bg-brand-800 text-white rounded-control text-sm font-semibold cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">{isSaving ? 'Saving Changes...' : 'Save Contact Headings'}</button>
      </div>
    </form>
  );
}
