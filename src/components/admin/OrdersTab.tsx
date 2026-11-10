import React from 'react';
import * as Icons from 'lucide-react';
import { adminApi } from './api.js';
import type { AdminTabProps } from './types.js';
import { money, type InvTabProps } from './InvitationsCommon.js';

const when = (s: string | null) => (s ? new Date(s).toLocaleString() : '-');

export default function OrdersTab({ overview, reload, adminToken, adminUser, isSaving, run }: AdminTabProps & InvTabProps) {
  const canWrite = adminUser.role !== 'Editor';

  const refund = async (id: number) => {
    if (!window.confirm('Mark refunded? Refund the money in the PayMongo dashboard first. This turns the invitation link off.')) return;
    await run(async () => {
      await adminApi('/api/admin/invitations/orders/refund', adminToken, { orderId: id }, 'Failed to mark refunded.');
      await reload();
    }, 'Order marked refunded.');
  };

  const resend = async (id: number) => {
    if (!window.confirm('Email new guest and manage links to the customer? Any earlier manage link stops working.')) return;
    await run(async () => {
      await adminApi('/api/admin/invitations/orders/resend', adminToken, { orderId: id }, 'Failed to resend links.');
    }, 'Links sent.');
  };

  return (
    <div className="space-y-6" id="panel-orders">
      <div className="border-b border-gray-100 pb-4 flex justify-between items-start gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 font-sans">Invitation Orders</h2>
          {overview && (
            <p className="text-xs text-gray-500 font-sans mt-1">
              {overview.totals.paidCount} paid, {money(overview.totals.paidCentavos)} total
            </p>
          )}
        </div>
        <button onClick={() => reload()} className="px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-50 cursor-pointer">
          <Icons.RefreshCw className="h-3.5 w-3.5 inline mr-1.5" />Refresh
        </button>
      </div>

      {!overview ? <p className="text-xs text-gray-400">Loading...</p> : overview.orders.length === 0 ? <p className="text-xs text-gray-400">No orders yet.</p> : (
        <div className="divide-y divide-gray-100">
          {overview.orders.map((o) => (
            <div key={o.id} className="py-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-gray-900">#{o.id} {o.design_name}</span>
                  <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-sm ${
                    o.status === 'paid' ? 'bg-emerald-50 text-emerald-700' : o.status === 'refunded' ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'
                  }`}>{o.status}</span>
                  <span className="text-sm font-semibold text-gray-700">{money(o.amount_centavos)}</span>
                </div>
                {canWrite && o.status === 'paid' && (
                  <div className="flex gap-2">
                    <button disabled={isSaving} onClick={() => resend(o.id)} className="px-2.5 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-50 cursor-pointer">Resend links</button>
                    <button disabled={isSaving} onClick={() => refund(o.id)} className="px-2.5 py-1.5 border border-red-100 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-50 cursor-pointer">Refund</button>
                  </div>
                )}
              </div>
              <div className="text-[11px] font-mono text-gray-500 space-y-0.5">
                <div>{o.title ? `${o.title} · ` : ''}{o.customer_email}{o.slug ? ` · /i/${o.slug}` : ' · invitation deleted'}</div>
                <div>Created {when(o.created_at)} · Paid {when(o.paid_at)}</div>
                {o.paymongo_checkout_id && <div>Checkout: {o.paymongo_checkout_id}</div>}
                {o.paymongo_payment_id && <div>Payment: {o.paymongo_payment_id}</div>}
                {o.payment_events.length > 0 && (
                  <div>Events: {o.payment_events.map((e: any) => `${e.type} (${when(e.received_at)})`).join(', ')}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
