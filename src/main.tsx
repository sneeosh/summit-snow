import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { startAnalytics } from './analytics/client'
import { useStore } from './state/store'

startAnalytics(() => { const s = useStore.getState(); return s.screen === 'playing' ? s.game : null })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
