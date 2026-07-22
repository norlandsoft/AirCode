import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@air/design/style.css';
import './styles/app.css';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
