import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from './components/Layout';
import { Overview } from './screens/Overview';
import { Forecast } from './screens/Forecast';
import { Chat } from './screens/Chat';
import { ReconcileExplorer } from './screens/ReconcileExplorer';
import { BatchTrends } from './screens/BatchTrends';
import { CsvTools } from './screens/CsvTools';
import { Audit } from './screens/Audit';
import { Merchants } from './screens/Merchants';
import { Simulator } from './screens/Simulator';
import { Disputes } from './screens/Disputes';
import { Settings } from './screens/Settings';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Overview />} />
            <Route path="forecast" element={<Forecast />} />
            <Route path="chat" element={<Chat />} />
            <Route path="reconcile" element={<ReconcileExplorer />} />
            <Route path="trends" element={<BatchTrends />} />
            <Route path="csv-tools" element={<CsvTools />} />
            <Route path="audit" element={<Audit />} />
            <Route path="merchants" element={<Merchants />} />
            <Route path="simulator" element={<Simulator />} />
            <Route path="disputes" element={<Disputes />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
