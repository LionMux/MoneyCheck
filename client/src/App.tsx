import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import Transactions from "@/pages/Transactions";
import Budget from "@/pages/Budget";
import Goals from "@/pages/Goals";
import Learn from "@/pages/Learn";
import AccountsPage from "@/pages/Accounts";
import NotificationsPage from "@/pages/Notifications";
import SettingsPage from "@/pages/Settings";
import AuthPage from "@/pages/Auth";
import NotFound from "@/pages/not-found";
import WidgetAuthPage from "@/pages/WidgetAuth";
import AdminUsersPage from "@/pages/AdminUsers";

function SwitchingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function AppRouter() {
  const { user, loading, switching, isDemo } = useAuth();

  if (loading) return <SwitchingSpinner />;
  if (switching) return <SwitchingSpinner />;

  return (
    <Switch>
      {/* Публичный роут — без auth guard и без Layout */}
      <Route path="/widget-auth" component={WidgetAuthPage} />

      {/* Остальные роуты — требуют авторизации */}
      <Route>
        {() => {
          if (!isDemo && !user) return <AuthPage />;
          return (
            <Layout key={user?.id ?? "guest"}>
              <Switch>
                <Route path="/"              component={Dashboard} />
                <Route path="/transactions"  component={Transactions} />
                <Route path="/accounts"      component={AccountsPage} />
                <Route path="/budget"        component={Budget} />
                <Route path="/goals"         component={Goals} />
                <Route path="/learn"         component={Learn} />
                <Route path="/notifications" component={NotificationsPage} />
                <Route path="/settings"      component={SettingsPage} />
                <Route path="/admin/users"   component={AdminUsersPage} />
                <Route component={NotFound} />
              </Switch>
            </Layout>
          );
        }}
      </Route>
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router hook={useHashLocation}>
        <AuthProvider>
          <AppRouter />
          <Toaster />
        </AuthProvider>
      </Router>
    </QueryClientProvider>
  );
}
