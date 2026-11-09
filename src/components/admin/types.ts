import type React from 'react';
import type { WebsiteData, AdminRole } from '../../types.js';

// What every admin tab receives from the AdminPanel shell
export interface AdminTabProps {
  db: WebsiteData;
  setDb: React.Dispatch<React.SetStateAction<WebsiteData | null>>;
  adminToken: string;
  adminUser: { email: string; role: AdminRole; fullName: string };
  isSaving: boolean;
  /** Runs a save: sets the saving flag, shows successMsg on success or the error in the banner. */
  run: (task: () => Promise<void>, successMsg?: string) => Promise<void>;
  onDataChange?: () => void;
}
