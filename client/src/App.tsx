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

function AppRouter() {
  const { user, loading, isDemo } = useAuth();

  // Show loading spinner while checking session
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // In PG mode, require auth. In demo/mem mode, skip auth.
  if (!isDemo && !user) {
    return <AuthPage />;
  }

  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/transactions" component={Transactions} />
        <Route path="/accounts" component={AccountsPage} />
        <Route path="/budget" component={Budget} />
        <Route path="/goals" component={Goals} />
        <Route path="/learn" component={Learn} />
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
        Один единственный Router на всё приложение.
        AuthProvider и AppRouter живут внутри него —
        useHashLocation() в AuthContext корректно навигирует
        и navigate("/") при logout сразу сбрасывает URL.
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
