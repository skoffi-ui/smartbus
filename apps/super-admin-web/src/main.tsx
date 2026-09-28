import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { applyTheme, getInitialTheme } from './theme'
import { FournisseurI18n } from './i18n'
import { ToastProvider } from './components/ToastProvider'
import { ConfirmProvider } from './components/ConfirmProvider'

applyTheme(getInitialTheme())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FournisseurI18n>
      <ToastProvider>
        <ConfirmProvider>
          <App />
        </ConfirmProvider>
      </ToastProvider>
    </FournisseurI18n>
  </StrictMode>,
)
