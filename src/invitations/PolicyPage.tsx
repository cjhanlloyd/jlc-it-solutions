// /terms, /refund-policy, /privacy for the digital invitation product.
// DRAFT — must be reviewed and approved by JLC before launch. This is starting text written by the builder, not legal advice.
import React from 'react';

export type PolicyKind = 'terms' | 'refund-policy' | 'privacy';

const UPDATED = 'November 10, 2026';

function pages(company: string, email: string): Record<PolicyKind, { title: string; body: React.ReactNode }> {
  const mail = <a href={`mailto:${email}`} className="underline font-semibold">{email}</a>;
  return {
    terms: {
      title: 'Terms of Service',
      body: <>
        <p>These terms cover the digital invitations sold by {company} ("we", "us") at this website. By buying an invitation you agree to them.</p>
        <h2>What you get</h2>
        <p>One online invitation in the design you choose, published at its own link that you can share with your guests. It includes your details and photos, a countdown, maps links, and an RSVP form. You also get a private manage link to edit your invitation and see your guests' RSVPs.</p>
        <h2>Price and payment</h2>
        <p>The price is shown in Philippine pesos on the design page and is a one-time payment. Payments are processed by PayMongo; payment is by QR Ph (GCash, Maya or your bank app), and we never see or store your bank or e-wallet details. Your invitation goes live once PayMongo confirms the payment.</p>
        <h2>How long it stays online</h2>
        <p>Your invitation stays online until 60 days after the event date. After that, the link shows a short "this celebration has passed" page, and the details, photos and RSVPs are deleted.</p>
        <h2>Editing</h2>
        <p>After payment you can change the date, time, venues, schedule, photos, messages and other details through your manage link. The names on the invitation (the couple's, or the celebrant's) and the design cannot be changed after payment. Keep your manage link private: anyone who has it can edit your invitation. If you lose it, request fresh links from the manage page.</p>
        <h2>Your content</h2>
        <p>You are responsible for the names, text and photos you add, and you confirm you have the right to use them. Do not upload anything unlawful, offensive, or that infringes someone else's rights. We may take down an invitation that breaks these rules.</p>
        <h2>Availability</h2>
        <p>We work to keep invitations online and working, but we cannot promise uninterrupted service. If your invitation is unavailable because of a problem on our side, contact us and we will help.</p>
        <h2>Liability</h2>
        <p>To the extent allowed by Philippine law, our total liability for any claim about an invitation is limited to the amount you paid for it.</p>
        <h2>Changes and contact</h2>
        <p>We may update these terms; the version shown here applies to new purchases. Questions: {mail}.</p>
      </>,
    },
    'refund-policy': {
      title: 'Refund Policy',
      body: <>
        <p>We want you to be happy with your invitation. Because it is a digital product that goes live right after payment, refunds work as follows.</p>
        <h2>When you can ask for a refund</h2>
        <p>You may request a refund within 7 days of payment, as long as you have not yet shared the invitation with your guests (for example, no RSVPs have been received). We may also refund if your invitation could not be published or did not work because of a problem on our side.</p>
        <h2>How refunds are decided</h2>
        <p>Each request is reviewed case by case. Requests after the invitation has been shared, or after 7 days, are usually not refundable, but tell us what happened and we will try to help, for example by fixing the problem.</p>
        <h2>How to ask</h2>
        <p>Email {mail} from the address you used at checkout, with your order number (it is in your receipt email) and the reason.</p>
        <h2>What happens next</h2>
        <p>If approved, the refund goes back to the original payment method through PayMongo. Timing depends on your bank or e-wallet, usually 5 to 15 business days. A refunded invitation is taken offline.</p>
      </>,
    },
    privacy: {
      title: 'Privacy Notice',
      body: <>
        <p>This notice explains how {company} handles personal information for the digital invitation service, in line with the Data Privacy Act of 2012 (Republic Act No. 10173).</p>
        <h2>What we collect</h2>
        <ul>
          <li><strong>From the customer:</strong> your email address, the names, dates, venues, messages and photos you put on the invitation, and order records (amount, date, payment status). Card and e-wallet details are handled by PayMongo, not by us.</li>
          <li><strong>From guests who RSVP:</strong> name, whether they are attending, party size (and number of kids, for birthdays), and an optional message.</li>
          <li><strong>Technical data:</strong> an anti-spam check by Cloudflare Turnstile on forms, and standard server logs.</li>
        </ul>
        <h2>Why we use it</h2>
        <p>To publish and run your invitation, process payment, send your receipt and links, show RSVPs to the customer, prevent spam and abuse, and keep financial records required by law.</p>
        <h2>Who sees it</h2>
        <p>The invitation page (names, date, venues, schedule, photos, messages) is visible to anyone who has its link. Guest RSVPs are shown only to the customer who bought the invitation, through their private manage link, and to {company} administrators. We do not sell personal information. We use service providers to run the service: Cloudflare (hosting and storage), PayMongo (payments) and our email provider.</p>
        <h2>How long we keep it</h2>
        <p>Invitation details, photos and guest RSVPs are deleted 60 days after the event date, including for refunded invitations. Only the names (and, for birthdays, the age) shown on the "this celebration has passed" page are kept. Order and payment records are kept as long as required for accounting and tax purposes.</p>
        <h2>Your rights</h2>
        <p>Under the Data Privacy Act you may ask to access, correct, or delete your personal information, object to its processing, and file a complaint with the National Privacy Commission. Customers can correct most details themselves through the manage link. Guests who want their RSVP changed or removed can contact the customer or us.</p>
        <h2>Contact</h2>
        <p>For privacy questions or requests, email {mail}.</p>
      </>,
    },
  };
}

export default function PolicyPage({ kind, company, email }: { kind: PolicyKind; company: string; email: string }) {
  const page = pages(company, email)[kind];
  return (
    <div className="bg-white py-14 sm:py-20 px-4 select-text">
      <article className="max-w-3xl mx-auto text-slate-700 leading-relaxed text-[15px] space-y-4 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-slate-900 [&_h2]:font-display [&_h2]:pt-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-2">
        <p className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          Draft — must be reviewed and approved by JLC before launch. This text is not legal advice.
        </p>
        <h1 className="text-3xl font-extrabold text-slate-900 font-display">{page.title}</h1>
        <p className="text-xs text-slate-500">Digital invitations · Last updated {UPDATED}</p>
        {page.body}
      </article>
    </div>
  );
}
