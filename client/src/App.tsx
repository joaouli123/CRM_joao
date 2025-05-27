import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProtectedRoute } from "@/components/protected-route";
import { UserHeader } from "@/components/user-header";
import Dashboard from "@/pages/dashboard";
import ContactsPage from "@/pages/contacts-simple";
import ContactsTable from "@/pages/contacts-table";
import ContactsManagement from "@/pages/contacts-management";
import SignIn from "@/pages/sign-in";
import SignUp from "@/pages/sign-up";

function Router() {
  return (
    <Switch>
      <Route path="/sign-in" component={SignIn} />
      <Route path="/sign-up" component={SignUp} />
      <Route path="/">
        <ProtectedRoute>
          <UserHeader />
          <Dashboard />
        </ProtectedRoute>
      </Route>
      <Route path="/dashboard">
        <ProtectedRoute>
          <UserHeader />
          <Dashboard />
        </ProtectedRoute>
      </Route>

      <Route path="/contacts-table">
        <ProtectedRoute>
          <UserHeader />
          <ContactsTable activeConnectionId={36} />
        </ProtectedRoute>
      </Route>
      
      <Route path="/contacts-management">
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      </Route>


    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
