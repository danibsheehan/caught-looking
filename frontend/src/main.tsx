import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import './index.scss';
import App from './App';

// Applies the print-media Google Fonts stylesheet (see index.html) now that the app is
// booting, so it never blocks first paint.
document.getElementById('gfonts-stylesheet')?.setAttribute('media', 'all');

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('missing #root');
createRoot(rootEl).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
