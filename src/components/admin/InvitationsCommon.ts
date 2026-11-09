// Shared by the three invitation tabs: peso formatting and the overview payload type.
export const money = (centavos: number) => `₱${(centavos / 100).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;

export type InvOverview = {
  designs: any[];
  orders: any[];
  invitations: any[];
  totals: { paidCount: number; paidCentavos: number };
};

export type InvTabProps = { overview: InvOverview | null; reload: () => Promise<void> };
