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

export default function AccountsTab({ db, setDb, adminToken, adminUser, isSaving, run, showFlashMsg, setApiError, onDataChange, reload }: AdminTabProps & { reload: () => Promise<void> }) {
  const activeInquiries = db.inquiries || [];
  const activeServices = db.services || [];
  const activeSentEmails = db.sentEmails || [];
  const activeAdminsList = db.admins || [];

  const [accountForm, setAccountForm] = React.useState<any>({
    email: '',
    fullName: '',
    role: 'Editor'
  });
  const [editingOperatorEmail, setEditingOperatorEmail] = React.useState<string | null>(null);

  // Admin Account creation & modification
  const handleAddAdminAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    await run(async () => {
      const isEditing = !!editingOperatorEmail;
      const payload = {
        action: isEditing ? 'edit' : 'invite',
        admin: {
          email: isEditing ? editingOperatorEmail : accountForm.email,
          fullName: accountForm.fullName,
          role: accountForm.role
        }
      };

      const data = await adminApi('/api/admin/accounts', adminToken, payload, `Failed to ${isEditing ? 'modify details' : 'send invitation'}.`);

      setDb(prev => prev ? { ...prev, admins: data.admins } : prev);
      setAccountForm({ email: '', fullName: '', role: 'Editor' });
      setEditingOperatorEmail(null);
      showFlashMsg(isEditing ? 'Administrator details modified successfully!' : 'Invitation sent successfully! Link logged to System Activity logs.');
      reload();
    });
  };

  const handleDeleteAdminAccount = async (email: string) => {
    if (!window.confirm(`Are you sure you want to remove administrator: ${email}?`)) return;
    await run(async () => {
      const data = await adminApi('/api/admin/accounts', adminToken, {
          action: 'delete',
          admin: { email }
        }, 'Failed to remove account.');

      setDb(prev => prev ? { ...prev, admins: data.admins } : prev);
      showFlashMsg('Administrator account removed.');
    });
  };

  const handleToggleAdminStatus = async (email: string) => {
    await run(async () => {
      const data = await adminApi('/api/admin/accounts', adminToken, {
          action: 'toggle_status',
          admin: { email }
        }, 'Failed to toggle account status.');

      setDb(prev => prev ? { ...prev, admins: data.admins } : prev);
      showFlashMsg('Administrator status updated successfully.');
    });
  };

  const handleResetPassword = async (email: string, newPass: string) => {
    await run(async () => {
      const data = await adminApi('/api/admin/accounts', adminToken, {
          action: 'reset_password',
          admin: { email, password: newPass }
        }, 'Failed to reset password.');
      showFlashMsg(`Password reset successfully for ${email}!`);
    });
  };

  return (
    <>
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
    </>
  );
}
