import { Navigate, useLocation } from "react-router-dom";
import { currentUser } from "../lib/api";
import Shell from "./Shell.jsx";

export default function PrivateRoute({ children, roles }) {
  const user = currentUser();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // optional role check
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  // Wrap protected pages with the application Shell so sidebar/user card/logout are consistent
  return <Shell>{children}</Shell>;
}