import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { 
  LayoutDashboard, 
  Scan, 
  Trophy, 
  MapPin, 
  User as UserIcon,
  BarChart3,
  Users,
  Recycle,
  LogOut
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    } catch (error) {
      console.error("Error loading user:", error);
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = user?.role === "admin";

  const collectorNavItems = [
    {
      title: "Dashboard",
      url: createPageUrl("CollectorDashboard"),
      icon: LayoutDashboard,
    },
    {
      title: "Scan Item",
      url: createPageUrl("ScanItem"),
      icon: Scan,
    },
    {
      title: "Area Leaderboard",
      url: createPageUrl("AreaLeaderboard"),
      icon: Trophy,
    },
    {
      title: "Onboard Collector",
      url: createPageUrl("OnboardCollector"),
      icon: Users,
    },
    {
      title: "Recycling Centers",
      url: createPageUrl("RecyclingCenters"),
      icon: MapPin,
    },
    {
      title: "My Profile",
      url: createPageUrl("CollectorProfile"),
      icon: UserIcon,
    },
  ];

  const adminNavItems = [
    {
      title: "Admin Dashboard",
      url: createPageUrl("AdminDashboard"),
      icon: BarChart3,
    },
    {
      title: "All Collections",
      url: createPageUrl("AllCollections"),
      icon: Recycle,
    },
    {
      title: "Collectors",
      url: createPageUrl("AllCollectors"),
      icon: Users,
    },
    {
      title: "Onboard Collector",
      url: createPageUrl("OnboardCollector"),
      icon: UserIcon,
    },
    {
      title: "Monthly Reports",
      url: createPageUrl("Reports"),
      icon: BarChart3,
    },
    {
      title: "QR Codes",
      url: createPageUrl("QRCodeGenerator"),
      icon: Scan,
    },
  ];

  const navigationItems = isAdmin ? [...adminNavItems, ...collectorNavItems] : collectorNavItems;

  const handleLogout = () => {
    base44.auth.logout();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-to-br from-emerald-50 to-teal-50">
        <Sidebar className="border-r border-emerald-200 bg-white/80 backdrop-blur-sm">
          <SidebarHeader className="border-b border-emerald-100 p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
                <Recycle className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-gray-900 text-lg">EcoTrack</h2>
                <p className="text-xs text-emerald-600">E-Waste Tracking</p>
              </div>
            </div>
          </SidebarHeader>
          
          <SidebarContent className="p-3">
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 py-2">
                {isAdmin ? "Admin" : "Collector"}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navigationItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        asChild 
                        className={`hover:bg-emerald-50 hover:text-emerald-700 transition-all duration-200 rounded-xl mb-1 ${
                          location.pathname === item.url ? 'bg-emerald-100 text-emerald-700 shadow-sm' : ''
                        }`}
                      >
                        <Link to={item.url} className="flex items-center gap-3 px-3 py-2.5">
                          <item.icon className="w-5 h-5" />
                          <span className="font-medium">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {user && !isAdmin && (
              <SidebarGroup>
                <SidebarGroupLabel className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 py-2">
                  Quick Stats
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <div className="px-3 py-2 space-y-3">
                    <div className="flex gap-2 text-sm">
                      <div className="flex-1 bg-white p-2 rounded-lg border border-gray-200">
                        <p className="text-xs text-gray-500">Items</p>
                        <p className="font-bold text-gray-900">{user.total_collections || 0}</p>
                      </div>
                      <div className="flex-1 bg-white p-2 rounded-lg border border-gray-200">
                        <p className="text-xs text-gray-500">Weight</p>
                        <p className="font-bold text-gray-900">{(user.total_weight_kg || 0).toFixed(1)}kg</p>
                      </div>
                    </div>
                  </div>
                </SidebarGroupContent>
              </SidebarGroup>
            )}
          </SidebarContent>

          <SidebarFooter className="border-t border-emerald-100 p-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-sm">
                    {user?.full_name?.[0]?.toUpperCase() || 'U'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate">
                    {user?.full_name || 'User'}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-sm font-medium text-gray-700"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col">
          {/* Mobile header */}
          <header className="bg-white/80 backdrop-blur-sm border-b border-emerald-200 px-4 py-3 md:hidden sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="hover:bg-emerald-50 p-2 rounded-lg transition-colors duration-200">
                <Recycle className="w-6 h-6 text-emerald-600" />
              </SidebarTrigger>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-gray-900">EcoTrack</h1>
              </div>
            </div>
          </header>

          {/* Main content */}
          <div className="flex-1 overflow-auto">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}