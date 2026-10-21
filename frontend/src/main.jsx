import LanAccess from './components/LanAccess';
import { I18nProvider } from './i18n/I18nContext';
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { SettingsProvider } from './contexts/SettingsContext';

// 全APIの認証切れを検知し、操作画面を閉じる。
const originalFetch = window.fetch.bind(window);
window.fetch = async (...args) => {
    const url = String(args[0]);
    if (url.startsWith('/api/')) {
        args[1] = { ...args[1], headers: { ...args[1]?.headers, 'X-Chronoloft': '1' } };
    }
    const response = await originalFetch(...args);
    if (response.status === 401 && String(args[0]).startsWith('/api/') && !String(args[0]).startsWith('/api/auth/')) {
        window.dispatchEvent(new Event('chronoloft-auth-required'));
    }
    return response;
};

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <SettingsProvider>
            <I18nProvider>
                <LanAccess><App /></LanAccess>
            </I18nProvider>
        </SettingsProvider>
    </StrictMode>,
)
