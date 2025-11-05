import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import MainApp from './MainApp';
import reportWebVitals from './reportWebVitals';

// Suppress ResizeObserver warnings in development
if (process.env.NODE_ENV === 'development') {
  const resizeObserverErrDiv = document.getElementById('webpack-dev-server-client-overlay-div');
  const resizeObserverErr = document.getElementById('webpack-dev-server-client-overlay');
  if (resizeObserverErr) {
    resizeObserverErr.setAttribute('style', 'display: none');
  }
  if (resizeObserverErrDiv) {
    resizeObserverErrDiv.setAttribute('style', 'display: none');
  }
  
  // Catch ResizeObserver errors
  window.addEventListener('error', (event) => {
    if (event.message && event.message.includes('ResizeObserver loop completed with undelivered notifications')) {
      event.stopImmediatePropagation();
    }
  });
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <MainApp />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
