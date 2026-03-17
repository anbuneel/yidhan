import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { LogoTestPage } from './pages/LogoTestPage';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LogoTestPage theme="dark" />
  </StrictMode>
);
