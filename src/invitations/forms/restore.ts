// Pure: the saved customiser state counts only for the design it was saved for.
export const savedFor = <S extends { slug?: string }>(saved: S | null | undefined, slug: string): S | null =>
  saved && typeof saved === 'object' && saved.slug === slug ? saved : null;
// Always normalised through the form's toDraft so missing fields are filled.
export const restoreDraft = (saved: { slug?: string; draft?: unknown } | null | undefined, slug: string, form: { toDraft(d?: any): any }) =>
  form.toDraft(savedFor(saved, slug)?.draft);
