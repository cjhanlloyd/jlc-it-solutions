// Admin portal entry (/admin, built from admin.html).
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import '../index.css';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
