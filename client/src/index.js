import React from 'react';
import { createRoot } from 'react-dom/client';
// import './index.css';  // Falls eine Stylesheet-Datei vorhanden ist
import App from './App'; // Die Haupt-App-Komponente

const container = document.getElementById('root');
const root = createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
