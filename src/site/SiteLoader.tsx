// The app's loading screen while site data loads. Same markup and classes as the one in index.html (styles live there),
// so a refresh shows one continuous screen instead of a flash between two.
import { Activity } from 'lucide-react';
import { StoredIcon } from '../components/StoredIcon';

export default function SiteLoader({ name, icon }: { name: string; icon?: string }) {
  return (
    <div className="jlc-loader" role="status" aria-live="polite">
      <div className="jlc-loader-mark" aria-hidden="true">
        <svg className="jlc-loader-ring" viewBox="0 0 92 92" fill="none">
          <circle cx="46" cy="46" r="44" stroke="#e7dcc7" strokeWidth="1.5" />
          <circle cx="46" cy="46" r="44" stroke="#a8843f" strokeWidth="2" strokeLinecap="round" strokeDasharray="70 207" />
        </svg>
        <span className="jlc-loader-core"><StoredIcon name={icon} fallback={Activity} /></span>
      </div>
      <p className="jlc-loader-name">{name}</p>
      <p className="jlc-loader-tag">Preparing your page</p>
      <span className="jlc-loader-bar" aria-hidden="true" />
    </div>
  );
}
