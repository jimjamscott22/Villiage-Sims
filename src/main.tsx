import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { loadUiAtlasManifest } from './ui/atlasManifest';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

void loadUiAtlasManifest().finally(() => {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
