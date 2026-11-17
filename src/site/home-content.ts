// Home page copy and the featured-designs pick. No React imports: the node tests load this file directly.
import type { Design } from './designs-api.ts';

// Designs marked featured (sort order kept); none marked → the first `max`.
export function featuredDesigns<T extends Pick<Design, 'featured'>>(designs: T[], max = 6): T[] {
  const featured = designs.filter((d) => d.featured);
  return (featured.length ? featured : designs).slice(0, max);
}

export const HERO = {
  eyebrow: 'Digital invitations',
  title: 'Invitations as memorable as the day itself',
  lead: 'Choose a design, add your details and photos, pay by scanning our QR code with your preferred payment app, and share one beautiful link. Your guests RSVP right on the page.',
};

export const HOW_STEPS = [
  { title: 'Choose', body: 'Browse our designs and pick the one, and the colour scheme, that suits your celebration.' },
  { title: 'Personalise', body: 'Add your names, date, venue, schedule and photos, and watch your invitation update as you type.' },
  { title: 'Scan to pay', body: 'Scan our payment QR code with GCash, Maya or any bank app that supports QR Ph, then upload a screenshot of the receipt. Our team verifies it.' },
  { title: 'Share', body: 'Once verified, your invitation arrives as a private link. Send it to your guests; they RSVP on the page.' },
];

// What every invitation comes with (also listed on the design details page).
export const INCLUDES = [
  { label: 'RSVP with guest count', detail: 'Guests reply on the page and tell you how many are coming.' },
  { label: 'Map and directions', detail: 'One tap opens the venue in their maps app.' },
  { label: 'Countdown', detail: 'A live countdown to your event.' },
  { label: 'Photo gallery', detail: 'Share up to 6 of your favourite photos (12 with Premium).' },
  { label: 'Private manage link', detail: 'Edit your details and see RSVPs any time.' },
  { label: 'Online until 60 days after the event (6 months with Premium)', detail: 'Your guests can revisit it long after the day.' },
];

// Answers stick to how ordering works today; `link` points to the page the answer mentions.
export const FAQS: { q: string; a: string; link?: { href: string; label: string } }[] = [
  { q: 'How do I pay?', a: 'Scan to pay with your preferred payment app: GCash, Maya or any bank app that supports QR Ph. After you place your order you see our payment QR code. Pay, then upload a screenshot of your receipt; our team verifies it.' },
  { q: 'When do I get my invitation?', a: 'As soon as our team has verified your payment, your invitation is delivered as a private link you can share with your guests.' },
  { q: 'How do my guests RSVP?', a: 'Right on the invitation page. They say whether they are coming and how many are in their party, and you see every reply.' },
  { q: 'Can I change details after ordering?', a: 'Yes. Your private manage link lets you edit your invitation details, and your guests see the changes right away.' },
  { q: 'How long does my invitation stay online?', a: 'Standard invitations stay online until 60 days after your event; Premium invitations stay online for 6 months.' },
  { q: 'Can I get a refund?', a: 'Refunds follow our Refund Policy.', link: { href: '/refund-policy', label: 'Read the Refund Policy' } },
  { q: 'I have another question.', a: 'We are happy to help.', link: { href: '/contact', label: 'Contact us' } },
];
