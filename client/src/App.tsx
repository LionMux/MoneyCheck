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
import AuthPage from "@/pages/Auth";
import NotFound from "@/pages/not-found";

/**
 * Full-screen spinner shown during account switches.
 * While this is rendered, NO page components are mounted,
 * so they cannot fire API queries with stale identity.
 */
function SwitchingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function AppRouter() {
  const { user, loading, switching, isDemo } = useAuth();

  // Waiting for initial /api/auth/me response
  if (loading) return <SwitchingSpinner />;

  // Transitioning between accounts — hard block on any page rendering
  if (switching) return <SwitchingSpinner />;

  // Not authenticated and not in demo mode — show login/register
  if (!isDemo && !user) return <AuthPage />;

  /**
   * KEY ISOLATION:
   * key={user?.id ?? 'guest'} forces React to fully unmount and remount
   * the entire page tree whenever the logged-in user changes.
   * This is the nuclear option — guaranteed zero stale component state.
   */
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
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/*
        Single Router for the whole app.
        AuthProvider lives inside so useHashLocation() in AuthContext
        and in AppRouter share the same routing context.
      */}
      <Router hook={useHashLocation}>
        <AuthProvider>
          <AppRouter />
          <Toaster />
        </AuthProvider>
      </Router>
    </QueryClientProvider>
  );
}
