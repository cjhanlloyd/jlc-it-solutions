import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {legacyAdminRedirect} from './site/routes.ts';
import './index.css';

const legacy = legacyAdminRedirect(location.href);
if (legacy) location.replace(legacy);
else {
  addEventListener('hashchange', () => { const l = legacyAdminRedirect(location.href); if (l) location.replace(l); });
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
