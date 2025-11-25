import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'

// Import the appropriate app based on build mode
const isInternalMode = import.meta.env.MODE === 'internal';

// Lazy load the appropriate app component
const AppComponent = isInternalMode
  ? React.lazy(() => import('./InternalApp'))
  : React.lazy(() => import('./ExternalApp'));

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <React.Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    }>
      <AppComponent />
    </React.Suspense>
  </React.StrictMode>,
)
