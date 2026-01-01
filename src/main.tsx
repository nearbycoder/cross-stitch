import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const THEME_KEY = 'cross-stitch-theme'
const storedTheme = localStorage.getItem(THEME_KEY)
if (storedTheme === 'dark') {
  document.documentElement.classList.add('dark')
} else if (storedTheme === 'light') {
  document.documentElement.classList.remove('dark')
} else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
  document.documentElement.classList.add('dark')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
