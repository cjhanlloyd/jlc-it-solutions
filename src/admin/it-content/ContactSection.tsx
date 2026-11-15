import React from 'react';
import type { ContentSectionProps } from './ContentTab.js';

// Only the page headings; contact details and social links are edited on the portal Content page.
export default function ContactSection({ isSaving, contentForm, setContentForm, onSave }: ContentSectionProps) {
  return (
    <form onSubmit={onSave} className="bg-white border border-gray-200 p-6 rounded-2xl shadow-xs space-y-4">
      <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest font-mono">Contact Us Section Headings</h3>
      <div className="space-y-1">
        <label className="text-[9px] uppercase font-bold text-gray-400 font-mono">Heading
          <input type="text" required value={contentForm.contactHeader || ''} onChange={(e) => setContentForm({ ...contentForm, contactHeader: e.target.value })} className="mt-1 w-full border border-gray-200 p-2 rounded-lg text-xs bg-white text-gray-900" />
        </label>
      </div>
      <div className="space-y-1">
        <label className="text-[9px] uppercase font-bold text-gray-400 font-mono">Subtitle Description
          <textarea required rows={2} value={contentForm.contactSubtitle || ''} onChange={(e) => setContentForm({ ...contentForm, contactSubtitle: e.target.value })} className="mt-1 w-full border border-gray-200 p-2 rounded-lg text-xs bg-white text-gray-900"></textarea>
        </label>
      </div>
      <div className="flex justify-end pt-4 border-t border-gray-100">
        <button type="submit" disabled={isSaving} className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer">{isSaving ? 'Saving Changes...' : 'Save Contact Headings'}</button>
      </div>
    </form>
  );
}
