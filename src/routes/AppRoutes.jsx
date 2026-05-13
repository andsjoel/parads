import { Navigate, Route, Routes } from "react-router-dom";

import Login from "../pages/Login";
import Register from "../pages/Register";
import Feed from "../pages/Feed";
import MatchList from "../pages/MatchList";
import Profile from "../pages/Profile";
import Admin from "../pages/Admin";
import AdminPreRegisters from "../pages/AdminPreRegisters";

import AppLayout from "../layouts/AppLayout";
import ProtectedRoute from "../components/ProtectedRoute";

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

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

        <Route path="admin" element={<Admin />} />
        <Route path="admin/pre-registers" element={<AdminPreRegisters />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}