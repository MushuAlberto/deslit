import React from 'react';
import MainApp from './components/App.tsx';
import { ToastProvider } from './components/Toast.tsx';

export default function App() {
  return (
    <ToastProvider>
      <MainApp />
    </ToastProvider>
  );
}
