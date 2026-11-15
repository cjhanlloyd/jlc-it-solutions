// Managed site content (GET /api/site), requested once per page load and shared by every caller.
export type SiteContent = {
  home: { eyebrow?: string; headline?: string; subheadline?: string } | null;
  faqs: { q: string; a: string }[];
  testimonials: { name: string; occasion: string; quote: string; photoUrl: string | null }[];
  banner: { message: string; link: string | null } | null;
};

let memo: Promise<SiteContent> | null = null;

export function fetchSite(): Promise<SiteContent> {
  return (memo ??= fetch('/api/site')
    .then(async (res) => {
      if (!res.ok) throw new Error('site');
      const d = await res.json();
      return {
        home: d?.home ?? null,
        faqs: Array.isArray(d?.faqs) ? d.faqs : [],
        testimonials: Array.isArray(d?.testimonials) ? d.testimonials : [],
        banner: d?.banner ?? null,
      } as SiteContent;
    })
    .catch((e) => { memo = null; throw e; })); // a failed request is retried by the next caller
}
