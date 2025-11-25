import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { setupMockAPI } from '@/mocks/setup';

// Enable mock API in development or when VITE_USE_MOCK_API is set
if (import.meta.env.VITE_USE_MOCK_API === 'true') {
  console.log('[Popup] Setting up Mock API...');
  setupMockAPI();
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <App />,
);
