import React from 'react';
import ReactDOM from 'react-dom';
// import './index.css';  // Falls eine Stylesheet-Datei vorhanden ist
import App from './App'; // Die Haupt-App-Komponente

// Diese Zeile rendert die App-Komponente in das "root"-Element der index.html
ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
);
