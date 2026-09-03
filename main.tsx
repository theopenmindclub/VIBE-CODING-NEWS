import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Handle benign ResizeObserver loop limit exceeded / undelivered notifications error
const hideResizeObserverError = (e: ErrorEvent) => {
  if (
    e.message &&
    (e.message.includes('ResizeObserver loop completed with undelivered notifications') ||
     e.message.includes('ResizeObserver loop limit exceeded'))
  ) {
    e.stopImmediatePropagation();
    e.preventDefault();
  }
};

window.addEventListener('error', hideResizeObserverError, true);
window.addEventListener('unhandledrejection', (e) => {
  if (e.reason && typeof e.reason.message === 'string' && e.reason.message.includes('ResizeObserver')) {
    e.preventDefault();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

