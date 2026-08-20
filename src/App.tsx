import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { OrgProvider } from "@/contexts/OrgContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import LoginPage from "@/pages/Login";

import DashboardPage from "@/pages/Dashboard";
import SensorsPage from "@/pages/Sensors";
import SensorDetailPage from "@/pages/SensorDetail";
import FieldMapPage from "@/pages/FieldMap";
import DataEntryPage from "@/pages/DataEntry";
import AnalyticsPage from "@/pages/Analytics";
import AlertsPage from "@/pages/Alerts";
import ReportsPage from "@/pages/Reports";
import AdminPage from "@/pages/Admin";
import CropsPage from "@/pages/Crops";
import ZonesPage from "@/pages/Zones";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function ProtectedAppRoute({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <AppLayout>{children}</AppLayout>
    </ProtectedRoute>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <OrgProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/login" element={<LoginPage />} />
              
              <Route path="/dashboard" element={<ProtectedAppRoute><DashboardPage /></ProtectedAppRoute>} />
              <Route path="/sensors" element={<ProtectedAppRoute><SensorsPage /></ProtectedAppRoute>} />
              <Route path="/sensors/:id" element={<ProtectedAppRoute><SensorDetailPage /></ProtectedAppRoute>} />
              <Route path="/field-map" element={<ProtectedAppRoute><FieldMapPage /></ProtectedAppRoute>} />
              <Route path="/data-entry" element={<ProtectedAppRoute><DataEntryPage /></ProtectedAppRoute>} />
              <Route path="/analytics" element={<ProtectedAppRoute><AnalyticsPage /></ProtectedAppRoute>} />
              <Route path="/alerts" element={<ProtectedAppRoute><AlertsPage /></ProtectedAppRoute>} />
              <Route path="/reports" element={<ProtectedAppRoute><ReportsPage /></ProtectedAppRoute>} />
              <Route path="/crops" element={<ProtectedAppRoute><CropsPage /></ProtectedAppRoute>} />
              <Route path="/zones" element={<ProtectedAppRoute><ZonesPage /></ProtectedAppRoute>} />
              <Route path="/admin" element={<ProtectedAppRoute><AdminPage /></ProtectedAppRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </OrgProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
