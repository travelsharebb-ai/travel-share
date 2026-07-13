import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './i18n/index.js'
import { LanguageProvider } from './lib/i18n.js'
import './index.css'
// console token check
import './mapbox_token_check'
import { APP_NAME } from './lib/appConfig.js'

document.title = APP_NAME

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <LanguageProvider>
      <App />
      </LanguageProvider>
    </BrowserRouter>
  </React.StrictMode>
)
