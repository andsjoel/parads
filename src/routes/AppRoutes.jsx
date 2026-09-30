import { Navigate, Route, Routes } from "react-router-dom";

import Login from "../pages/LoginNew";
import FirstAccess from "../pages/FirstAccessNew";
import Feed from "../pages/Feed";
import MatchList from "../pages/MatchList";
import Profile from "../pages/Profile";
import Admin from "../pages/Admin";
import AdminPreRegisters from "../pages/AdminPreRegisters";

import AppLayout from "../layouts/AppLayout";
import ProtectedRoute from "../components/ProtectedRoute";
import Shop from "../pages/Shop";

import AdminVolleyList from "../pages/AdminVolleyList";

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<FirstAccess />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/feed" replace />} />

        <Route path="feed" element={<Feed />} />
        <Route path="matches" element={<MatchList />} />
        <Route path="profile" element={<Profile />} />
        <Route path="shop" element={<Shop />} />

        <Route path="admin" element={<Admin />} />
        <Route path="admin/pre-registers" element={<AdminPreRegisters />} />
        <Route path="pre-registers" element={<AdminPreRegisters />} />

        <Route path="admin/volley-list" element={<AdminVolleyList />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
