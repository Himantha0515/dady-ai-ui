import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { BrandAtmosphere } from "./components/BrandAtmosphere";
import { PageLoader } from "./components/PageLoader";
import { AdminRoute, ProtectedRoute } from "./components/auth/RouteGuards";
import { AppLayout } from "./layouts/AppLayout";
import { Landing } from "./pages/Landing";
import { Home } from "./pages/Home";
import { ImageStudio } from "./pages/ImageStudio";
import { VideoStudio } from "./pages/VideoStudio";
import { Models } from "./pages/Models";
import { Pricing } from "./pages/Pricing";
import { Credits } from "./pages/Credits";
import { Projects } from "./pages/Projects";
import { Wishlist } from "./pages/Wishlist";
import { Auth } from "./pages/Auth";
import { Help } from "./pages/Help";
import { Templates } from "./pages/Templates";
import {
  BillingFailed,
  BillingProcessing,
  BillingSuccess,
} from "./pages/billing/BillingPages";
import { Forbidden, Onboarding } from "./pages/onboarding/Onboarding";
import { AdminHome } from "./pages/admin/AdminHome";
import { AdminFalPricing } from "./pages/admin/AdminFalPricing";

export default function App() {
  return (
    <BrowserRouter>
      <BrandAtmosphere />
      <div className="app-layer">
        <PageLoader />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/login" element={<Navigate to="/auth" replace />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/checkout" element={<Navigate to="/pricing" replace />} />
          <Route path="/dashboard" element={<Navigate to="/app" replace />} />
          <Route path="/403" element={<Forbidden />} />

          <Route
            path="/onboarding"
            element={
              <ProtectedRoute>
                <Onboarding />
              </ProtectedRoute>
            }
          />

          <Route
            path="/billing/processing"
            element={
              <ProtectedRoute>
                <BillingProcessing />
              </ProtectedRoute>
            }
          />
          <Route
            path="/billing/success"
            element={
              <ProtectedRoute>
                <BillingSuccess />
              </ProtectedRoute>
            }
          />
          <Route
            path="/billing/failed"
            element={
              <ProtectedRoute>
                <BillingFailed />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminHome />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/models"
            element={
              <AdminRoute>
                <AdminFalPricing />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/*"
            element={
              <AdminRoute>
                <AdminHome />
              </AdminRoute>
            }
          />

          <Route
            path="/app"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Home />} />
            <Route path="create" element={<Navigate to="/app/create/image" replace />} />
            <Route path="templates" element={<Templates />} />
            <Route path="projects" element={<Projects />} />
            <Route path="wishlist" element={<Wishlist />} />
            <Route path="models" element={<Models />} />
            <Route path="credits" element={<Credits />} />
            <Route path="help" element={<Help />} />
          </Route>

          <Route
            path="/app/create/image"
            element={
              <ProtectedRoute>
                <ImageStudio />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/video"
            element={
              <ProtectedRoute>
                <VideoStudio />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
