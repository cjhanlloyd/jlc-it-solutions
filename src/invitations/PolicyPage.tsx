// /terms, /refund-policy and /privacy. The text describes how the site actually works (QR payments checked by hand,
// Standard 60-day and Premium 6-month retention, the cleanup job), so update it whenever those rules change.
import React from 'react';

export type PolicyKind = 'terms' | 'refund-policy' | 'privacy';

const UPDATED = 'November 18, 2026';

function pages(company: string, email: string): Record<PolicyKind, { title: string; lead: string; body: React.ReactNode }> {
  const mail = <a href={`mailto:${email}`}>{email}</a>;
  return {
    terms: {
      title: 'Terms of Service',
      lead: 'The terms for buying and using a digital invitation from us.',
      body: <>
        <p>These terms cover the digital invitations sold by {company} ("we", "us") on this website. By placing an order you agree to them, together with our <a href="/refund-policy">Refund Policy</a> and <a href="/privacy">Privacy Notice</a>.</p>
        <h2>What you get</h2>
        <p>One online invitation in the design and package you choose, published at its own link that you can share with your guests. It includes your details and photos, a countdown, map links and an RSVP form. You also get a private manage link to edit your invitation and see your guests' RSVPs. Premium designs add an opening animation, background music from our library and room for more photos.</p>
        <h2>Price and payment</h2>
        <p>Prices are shown in Philippine pesos on each design page and are one-time payments. Payment is by QR code: after you place your order, scan the QR code on your order page with your preferred payment app (GCash, Maya or any bank app that supports QR Ph) and upload a screenshot of your receipt. Our team checks each payment by hand, and your order moves ahead only after we confirm it. Unpaid orders are cancelled automatically after the payment deadline shown on your order page.</p>
        <h2>How long it stays online</h2>
        <p>Standard invitations stay online until 60 days after the event date, and Premium invitations until 6 months after it. After that, the link shows a short "this celebration has passed" page, and the details, photos and RSVPs are deleted.</p>
        <h2>Editing</h2>
        <p>After payment you can change the date, time, venues, schedule, photos, messages and other details through your manage link. The names on the invitation (the couple's, or the celebrant's) and the design cannot be changed after payment. Keep your manage link private: anyone who has it can edit your invitation. If you lose it, request fresh links from the manage page.</p>
        <h2>Your content</h2>
        <p>You are responsible for the names, text and photos you add, and you confirm you have the right to use them, including permission from the people shown. Do not upload anything unlawful, offensive, or that infringes someone else's rights. We may take down an invitation that breaks these rules.</p>
        <h2>Availability</h2>
        <p>We work to keep invitations online and working, but we cannot promise uninterrupted service. If your invitation is unavailable because of a problem on our side, contact us and we will fix it or, if we cannot, refund you as described in our Refund Policy.</p>
        <h2>Liability</h2>
        <p>To the extent allowed by Philippine law, our total liability for any claim about an invitation is limited to the amount you paid for it. Nothing in these terms limits your rights under the Consumer Act of the Philippines.</p>
        <h2>Changes and contact</h2>
        <p>We may update these terms; the version shown here applies to new orders. Questions: {mail}.</p>
      </>,
    },
    'refund-policy': {
      title: 'Refund Policy',
      lead: 'When you can get your money back, and how to ask.',
      body: <>
        <p>We want you to be happy with your invitation. Because it is a digital service that we start preparing as soon as your payment is confirmed, refunds work as described below. This policy does not limit your rights under the Consumer Act of the Philippines (Republic Act No. 7394).</p>

        <h2>Before your payment is confirmed</h2>
        <p>You can cancel at any time before we confirm your payment. If you have not paid, there is nothing to refund; unpaid orders are also cancelled automatically after the payment deadline. If you sent a payment but cancel before we confirm it, we refund it in full.</p>

        <h2>Template designs (Standard and Premium)</h2>
        <ul>
          <li><strong>Within 7 days of payment, before you share it:</strong> you can ask for a full refund for any reason, as long as you have not yet shared the invitation with guests (for example, no RSVPs have been received).</li>
          <li><strong>After you share it, or after 7 days:</strong> change-of-mind refunds are not available, because the invitation has been delivered and used. If something is not working, tell us and we will fix it.</li>
        </ul>

        <h2>Custom designs</h2>
        <ul>
          <li><strong>Before design work starts:</strong> full refund.</li>
          <li><strong>After design work has started:</strong> we may keep a fair part of the payment for the work already done. We will tell you the exact amount before you decide. Once you approve the final design, the order is complete and change-of-mind refunds are not available.</li>
        </ul>

        <h2>When the problem is on our side</h2>
        <p>You are entitled to a full refund, at any time, if:</p>
        <ul>
          <li>we could not publish your invitation, or it does not work as described and we cannot fix it within a reasonable time after you tell us;</li>
          <li>you were charged more than once for the same order, or paid more than the order amount (we refund the extra).</li>
        </ul>

        <h2>How to ask for a refund</h2>
        <p>Email {mail} from the address you used when ordering. Include your order reference (it starts with JLC- and is in your order email) and tell us briefly what happened. We reply within 3 business days.</p>

        <h2>How you receive it</h2>
        <p>Approved refunds are sent back to the account you paid from (for example your GCash or Maya wallet, or your bank account), normally within 7 business days of approval. We will email you when it has been sent. A refunded invitation is taken offline, and its details, photos and RSVPs are deleted as described in our <a href="/privacy">Privacy Notice</a>.</p>

        <h2>Still not resolved?</h2>
        <p>If you are not satisfied with how we handled your request, please reply to our email so we can take another look. You may also contact the Department of Trade and Industry (DTI).</p>
      </>,
    },
    privacy: {
      title: 'Privacy Notice',
      lead: 'What personal information we collect, why, and how we protect it.',
      body: <>
        <p>{company} ("we", "us") respects your privacy. This notice explains how we collect, use, share and protect personal information on this website, in line with the Data Privacy Act of 2012 (Republic Act No. 10173), its Implementing Rules and Regulations, and the issuances of the National Privacy Commission (NPC). We are the personal information controller for the information described here.</p>

        <h2>What we collect</h2>
        <ul>
          <li><strong>When you order an invitation:</strong> your name, email address and (if you give it) mobile number; the names, dates, venues, messages and photos you add to the invitation; your design choices; order records (amount, date, status); and the payment receipt screenshot and reference number you upload to confirm payment. We do not receive or store your PIN, password or banking login.</li>
          <li><strong>When guests RSVP:</strong> the guest's name, whether they are attending, party size (and number of children, for birthdays), and an optional message.</li>
          <li><strong>When you add guest links:</strong> the guest names and seat numbers you enter. They are visible only to you and our staff, and are deleted with the invitation.</li>
          <li><strong>When you sign in to your account:</strong> your email address; a one-time sign-in code, which we keep only as a protected code and which is valid for 10 minutes; and a sign-in session that lasts 30 days (deleted when you sign out or it expires). Signing in with an email address also creates a customer record for that email. We log sign-in requests to prevent abuse.</li>
          <li><strong>When you leave a review:</strong> your star rating, the review text and the display name you choose (which can be a first name or a nickname). Only customers with a delivered invitation can review, and you can have one review. It is shown publicly, with your display name and the date, only after we approve it. You can edit or delete your review at any time from your account; editing sends it for approval again.</li>
          <li><strong>When you send an inquiry about our IT services:</strong> your name, email address, mobile number and company (if you give them), and your message.</li>
          <li><strong>Technical information:</strong> basic server logs and an anti-spam check (Cloudflare Turnstile) on our forms. Your browser also keeps small items on your own device: your invitation draft while you design it, a private order link after you order, and your sign-in session when you sign in. We do not use advertising or tracking cookies.</li>
        </ul>
        <p>Invitations can include information about other people, such as the celebrant, family members or children. By adding it, you confirm that you have their permission (or, for children, the permission of a parent or guardian).</p>

        <h2>Why we use it</h2>
        <p>We use personal information only to:</p>
        <ul>
          <li>create, publish and run your invitation, and show RSVPs to you;</li>
          <li>check your payment and process refunds;</li>
          <li>send you order updates, links and replies to your questions;</li>
          <li>show approved reviews on our website;</li>
          <li>answer inquiries about our IT services;</li>
          <li>prevent spam, fraud and abuse, and keep the website secure;</li>
          <li>keep the accounting and tax records the law requires.</li>
        </ul>
        <p>We process this information because it is needed to provide the service you ordered or asked about, to meet our legal obligations, and for our legitimate interest in keeping the service safe. We do not send marketing emails, and we never sell personal information.</p>

        <h2>Who can see it</h2>
        <ul>
          <li><strong>Your guests:</strong> the invitation page (names, date, venues, schedule, photos, messages) is visible to anyone who has its link, so share it only with people you trust.</li>
          <li><strong>A guest with a personal link:</strong> the page shows that guest's name and their current reply to anyone who holds the link.</li>
          <li><strong>You:</strong> guest RSVPs and guest lists are shown only to the customer who bought the invitation, through their private manage link or their account.</li>
          <li><strong>Our team:</strong> authorised staff can see order, payment and RSVP information when they need it to do their work.</li>
          <li><strong>Service providers:</strong> Cloudflare hosts the website and stores our data, and our email provider delivers our emails. They handle information only on our instructions. Their servers may be outside the Philippines; we use providers with strong security safeguards.</li>
          <li><strong>Everyone:</strong> an approved review, with its display name, rating, text and date, is public. Your email address is never shown with it.</li>
          <li><strong>When required by law:</strong> we may disclose information if a court, the NPC or another authority lawfully requires it.</li>
        </ul>

        <h2>How long we keep it</h2>
        <ul>
          <li><strong>Invitation details, photos and guest RSVPs:</strong> deleted 60 days after the event date for Standard invitations and 6 months after it for Premium invitations, including refunded invitations. Only the names (and, for birthdays, the age) shown on the "this celebration has passed" page are kept.</li>
          <li><strong>Guest lists (names and seats):</strong> deleted with the invitation's details, as above.</li>
          <li><strong>Sign-in codes:</strong> stop working after 10 minutes and are deleted soon after. <strong>Sign-in sessions:</strong> end after 30 days, or straight away when you sign out, and are then deleted.</li>
          <li><strong>Payment receipts of cancelled orders:</strong> deleted 60 days after cancellation.</li>
          <li><strong>Order and payment records:</strong> kept for as long as accounting and tax laws require.</li>
          <li><strong>Reviews:</strong> kept until you delete them from your account, or we remove them.</li>
          <li><strong>IT service inquiries:</strong> kept while we handle your request and for our records afterwards. You can ask us to delete them at any time.</li>
        </ul>

        <h2>How we protect it</h2>
        <p>The website uses encrypted connections (HTTPS). Uploaded photos and receipts are stored privately and shown only after an access check. Manage and order links use long random codes that we store only in protected form. Staff access is limited by role. If a personal data breach happens that could harm you, we will notify you and the NPC as the law requires.</p>

        <h2>Your rights</h2>
        <p>Under the Data Privacy Act you have the right to:</p>
        <ul>
          <li>be informed about how your information is used;</li>
          <li>access the personal information we hold about you;</li>
          <li>have inaccurate information corrected;</li>
          <li>object to processing, and ask us to delete or block your information;</li>
          <li>get a copy of your information in a commonly used format;</li>
          <li>be compensated for damages caused by unlawful processing;</li>
          <li>file a complaint with the National Privacy Commission (privacy.gov.ph).</li>
        </ul>
        <p>Customers can correct most invitation details themselves through the manage link. Guests who want their RSVP changed or removed can contact the customer or us. Some information, such as payment records, may need to be kept for legal reasons even after a deletion request; we will tell you if so.</p>

        <h2>Contact us</h2>
        <p>For privacy questions or to use your rights, email our data protection contact at {mail}. We will reply as soon as we can, and within 15 days at the latest.</p>

        <h2>Changes to this notice</h2>
        <p>We may update this notice when our services or the law change. The date at the top shows the latest version.</p>
      </>,
    },
  };
}

export default function PolicyPage({ kind, company, email }: { kind: PolicyKind; company: string; email: string }) {
  const page = pages(company, email)[kind];
  return (
    <div className="bg-ivory px-4 py-14 font-sans text-ink select-text sm:py-20">
      <article className="mx-auto max-w-3xl">
        <header className="border-b border-gold-light pb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-700">Policies</p>
          <h1 className="mt-3 font-serif text-4xl font-semibold leading-tight text-ink sm:text-5xl">{page.title}</h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-ink/80">{page.lead}</p>
          <p className="mt-3 text-xs text-ink/70">Last updated {UPDATED}</p>
        </header>
        <div className="mt-8 rounded-card border border-gold-light bg-white p-6 shadow-card sm:p-10">
          <div className="space-y-4 text-[15px] leading-relaxed text-ink/90 [&_a]:font-semibold [&_a]:text-brand-700 [&_a]:underline [&_a]:underline-offset-4 [&_h2]:pt-4 [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-ink [&_li]:pl-1 [&_strong]:text-ink [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6 [&_ul]:marker:text-gold">
            {page.body}
          </div>
        </div>
        <nav aria-label="Other policies" className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
          {([['terms', 'Terms of Service'], ['refund-policy', 'Refund Policy'], ['privacy', 'Privacy Notice']] as const)
            .filter(([k]) => k !== kind)
            .map(([k, label]) => <a key={k} href={`/${k}`} className="font-semibold text-brand-700 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700">{label}</a>)}
        </nav>
      </article>
    </div>
  );
}
