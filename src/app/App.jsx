import AppRoutes from "../routes/AppRoutes";
import { AuthProvider } from "../contexts/AuthContext";
import DesktopBlocked from "../components/DesktopBlocked";
import { isMobileDevice } from "../utils/mobileDevice";
import { MAINTENANCE_ENABLED } from "../config/appStatus";
import MaintenanceScreen from "../components/MaintenanceScreen";

export default function App() {
  if (MAINTENANCE_ENABLED) return <MaintenanceScreen />;
  if (!isMobileDevice(window.navigator)) return <DesktopBlocked />;

  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
