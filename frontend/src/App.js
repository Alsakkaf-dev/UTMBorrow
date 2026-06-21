import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";

import { ToastProvider } from "./components/Toast";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { PageLoader } from "./components/ui";
import Layout from "./components/Layout";

import Login from "./pages/identity/Login";
import Register from "./pages/identity/Register";
import ForgotPassword from "./pages/identity/ForgotPassword";
import ResetPassword from "./pages/identity/ResetPassword";
import Profile from "./pages/identity/Profile";
import PublicProfile from "./pages/identity/PublicProfile";
import SettingsHub from "./pages/identity/SettingsHub";
import SettingsSecurity from "./pages/identity/SettingsSecurity";
import NotificationPreferences from "./pages/identity/NotificationPreferences";
import Reputation from "./pages/identity/Reputation";
import HelpSupport from "./pages/identity/HelpSupport";
import MyReports from "./pages/identity/MyReports";
import Governance from "./pages/identity/Governance";

import Home from "./pages/resource/Home";
import PopularAll from "./pages/resource/PopularAll";
import NearbyAll from "./pages/resource/NearbyAll";
import Dashboard from "./pages/identity/Dashboard";
import Notifications from "./pages/transaction/Notifications";
import TransactionHistory from "./pages/transaction/TransactionHistory";
import TransactionDetail from "./pages/transaction/TransactionDetail";
import Scanner from "./pages/transaction/Scanner";
import Chat from "./pages/transaction/Chat";

import Lend from "./pages/resource/Lend";
import ItemForm from "./pages/resource/ItemForm";
import ItemDetail from "./pages/resource/ItemDetail";

import Moderation from "./pages/transaction/Moderation";
import ReportDetail from "./pages/transaction/ReportDetail";

import AdminLayout from "./pages/admin/AdminLayout";
import AdminOverview from "./pages/admin/AdminOverview";
import AdminInbox from "./pages/admin/AdminInbox";
import AdminTransactions from "./pages/admin/AdminTransactions";
import AdminTransactionDetail from "./pages/admin/AdminTransactionDetail";
import AdminOverdue from "./pages/admin/AdminOverdue";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminUserDetail from "./pages/admin/AdminUserDetail";
import AdminReports from "./pages/admin/AdminReports";
import AdminScan from "./pages/admin/AdminScan";
import AdminAudit from "./pages/admin/AdminAudit";
import AdminAnalytics from "./pages/admin/AdminAnalytics";
import AdminProfile from "./pages/admin/AdminProfile";

function Protected({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}

// Admins live only in the Admin Portal; students land in the app.
function landingPath(user) {
  return user?.is_admin ? "/admin" : "/home";
}

function PublicOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (user) return <Navigate to={landingPath(user)} replace />;
  return children;
}

function AdminOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

// Keep admins out of the student app — their only surface is the Admin Portal.
function StudentOnly({ children }) {
  const { user } = useAuth();
  if (user?.is_admin) return <Navigate to="/admin" replace />;
  return children;
}

function Landing() {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  return <Navigate to={landingPath(user)} replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />

      <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
      <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
      <Route path="/forgot" element={<PublicOnly><ForgotPassword /></PublicOnly>} />
      <Route path="/reset" element={<PublicOnly><ResetPassword /></PublicOnly>} />

      {/* Read-only public pages — viewable by students AND admins, so a
          moderator reviewing a report can open the real listing or member
          profile (admins are otherwise kept inside the portal). */}
      <Route element={<Protected><Layout /></Protected>}>
        <Route path="/items/:id" element={<ItemDetail />} />
        <Route path="/profile/:userId" element={<PublicProfile />} />
      </Route>

      {/* Student app — wrapped in Layout (header + bottom nav via Outlet). Admins are redirected to the portal. */}
      <Route element={<Protected><StudentOnly><Layout /></StudentOnly></Protected>}>
        <Route path="/home" element={<Home />} />
        <Route path="/home/popular" element={<PopularAll />} />
        <Route path="/home/nearby" element={<NearbyAll />} />
        <Route path="/catalog" element={<Navigate to="/home" replace />} />
        <Route path="/lend" element={<Lend />} />
        <Route path="/items/new" element={<ItemForm />} />
        <Route path="/items/:id/edit" element={<ItemForm />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/history" element={<TransactionHistory />} />
        <Route path="/transactions/:id" element={<TransactionDetail />} />
        <Route path="/chat/:txId" element={<Chat />} />
        <Route path="/scan/:txId" element={<Scanner />} />

        <Route path="/profile" element={<Profile />} />
        <Route path="/settings" element={<SettingsHub />} />
        <Route path="/settings/security" element={<SettingsSecurity />} />
        <Route path="/settings/notifications" element={<NotificationPreferences />} />
        <Route path="/settings/reputation" element={<Reputation />} />
        <Route path="/settings/help" element={<HelpSupport />} />
        <Route path="/settings/reports" element={<MyReports />} />
        <Route path="/settings/governance" element={<Governance />} />

        <Route path="/moderation" element={<Moderation />} />
        <Route path="/moderation/:reportId" element={<ReportDetail />} />
      </Route>

      <Route path="/admin" element={<AdminOnly><AdminLayout /></AdminOnly>}>
        <Route index element={<AdminOverview />} />
        <Route path="inbox" element={<AdminInbox />} />
        <Route path="transactions" element={<AdminTransactions />} />
        <Route path="transactions/:id" element={<AdminTransactionDetail />} />
        <Route path="overdue" element={<AdminOverdue />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="users/:userId" element={<AdminUserDetail />} />
        <Route path="analytics" element={<AdminAnalytics />} />
        <Route path="reports" element={<AdminReports />} />
        <Route path="reports/:reportId" element={<ReportDetail />} />
        <Route path="scan" element={<AdminScan />} />
        <Route path="audit" element={<AdminAudit />} />
        <Route path="profile" element={<AdminProfile />} />
      </Route>

      <Route path="*" element={<Landing />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}
