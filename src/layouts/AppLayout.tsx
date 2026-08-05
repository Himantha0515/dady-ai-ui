import { Outlet } from "react-router-dom";
import { PageTransition } from "../components/PageTransition";
import { TopNav } from "./TopNav";
import { AppSidebar } from "./AppSidebar";
import { MobileBottomNav } from "./MobileBottomNav";

export function AppLayout() {
  return (
    <>
      <TopNav />
      <div className="app-shell">
        <AppSidebar />
        <div style={{ flex: 1, minWidth: 0 }}>
          <PageTransition>
            <Outlet />
          </PageTransition>
        </div>
      </div>
      <MobileBottomNav />
    </>
  );
}
