import type { Package } from '../../shared/packages.ts';
// Active invitation designs (GET /api/invitations/designs), requested once per page load and shared by every caller.
export type Design = {
  slug: string; name: string; productType: string; layoutKey: string; priceCentavos: number; packages: Package[]; fromPriceCentavos: number;
  colorSchemes: { name: string; primary: string; accent: string; background: string; text: string }[];
  previewImages: string[]; samplePhotos?: string[]; sampleDetails: any; description: string; featured: boolean;
};

let memo: Promise<Design[]> | null = null;

export function fetchDesigns(): Promise<Design[]> {
  return (memo ??= fetch('/api/invitations/designs')
    .then(async (res) => {
      if (!res.ok) throw new Error('designs');
      const data = await res.json();
      if (!Array.isArray(data?.designs)) throw new Error('designs');
      return data.designs as Design[];
    })
    .catch((e) => { memo = null; throw e; })); // a failed request is retried by the next caller
}
