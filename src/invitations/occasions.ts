// Occasion (product type) labels and filter chips for the shop. No React imports: the node tests load this file.
const LABELS: Record<string, string> = {
  wedding_invitation: 'Wedding', birthday_invitation: 'Birthday', debut_invitation: 'Debut',
  baptism_invitation: 'Baptism', anniversary_invitation: 'Anniversary', corporate_invitation: 'Corporate',
};

export function occasionLabel(type: string): string {
  if (LABELS[type]) return LABELS[type];
  const words = type.replace(/_invitation$/, '').replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// Distinct types in first-seen order; none while every design is the same occasion.
export function occasionChips(types: string[]): string[] {
  const distinct = [...new Set(types)];
  return distinct.length < 2 ? [] : distinct;
}
