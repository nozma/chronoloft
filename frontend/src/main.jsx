import { I18nProvider } from './i18n/I18nContext';
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { SettingsProvider } from './contexts/SettingsContext';

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <SettingsProvider>
            <I18nProvider>
                <App />
            </I18nProvider>
        </SettingsProvider>
    </StrictMode>,
)
