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
  LogOut,
  Download,
  X,
  Share
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

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
const isIOSSafari = () => isIOS() && /safari/i.test(navigator.userAgent) && !/crios|fxios|opios|chrome/i.test(navigator.userAgent)
const isInStandaloneMode = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  window.navigator.standalone === true

// guide types: 'ios-safari' | 'ios-chrome' | 'android-manual'
export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // PWA install prompt
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [guideType, setGuideType] = useState(null); // null = closed
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (isInStandaloneMode()) { setInstalled(true); return; }

    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
      setShowInstallBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => {
      setInstalled(true);
      setShowInstallBanner(false);
      setInstallPrompt(null);
    });

    // iOS never fires the event — always show the button with manual guide
    if (isIOS() && !isInStandaloneMode()) setShowInstallBanner(true);

    // Android/desktop: also show the button even if prompt hasn't fired yet
    // (user may have previously dismissed it)
    if (!isIOS() && !isInStandaloneMode()) setShowInstallBanner(true);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    // iOS Chrome — must use Safari
    if (isIOS() && !isIOSSafari()) {
      setGuideType('ios-chrome');
      return;
    }
    // iOS Safari — manual share guide
    if (isIOS()) {
      setGuideType('ios-safari');
      return;
    }
    // Android/desktop with saved prompt — trigger it
    if (installPrompt) {
      installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === 'accepted') {
        setInstalled(true);
        setShowInstallBanner(false);
      }
      setInstallPrompt(null);
      return;
    }
    // Android/desktop — prompt already used or not available, show manual guide
    setGuideType('android-manual');
  };

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

              {/* PWA install button */}
              {!installed && showInstallBanner && (
                <button
                  onClick={handleInstall}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors text-sm font-medium text-white"
                >
                  <Download className="w-4 h-4" />
                  Install App
                </button>
              )}

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
              <div className="flex items-center gap-2 flex-1">
                <h1 className="text-lg font-bold text-gray-900">EcoTrack</h1>
              </div>
              {!installed && showInstallBanner && (
                <button
                  onClick={handleInstall}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Install
                </button>
              )}
            </div>
          </header>

          {/* Main content */}
          <div className="flex-1 overflow-auto">
            {children}
          </div>
        </main>
      </div>
      {/* Install guide modal */}
      {guideType && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center p-4" onClick={() => setGuideType(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 text-lg">Install EcoTrack</h3>
              <button onClick={() => setGuideType(null)} className="p-1 rounded-full hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* iOS Chrome — must switch to Safari */}
            {guideType === 'ios-chrome' && (
              <>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                  <p className="text-sm font-semibold text-amber-800 mb-1">Chrome on iPhone doesn't support install</p>
                  <p className="text-xs text-amber-700">You need to open this app in <strong>Safari</strong> to install it.</p>
                </div>
                <ol className="space-y-3 text-sm text-gray-700">
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">1</span>
                    <span>Copy the link: <strong className="text-emerald-700 break-all">{window.location.host}</strong></span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">2</span>
                    <span>Open <strong>Safari</strong> and paste the link</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">3</span>
                    <span>Tap <Share className="inline w-4 h-4 text-blue-500" /> <strong>Share → Add to Home Screen</strong></span>
                  </li>
                </ol>
              </>
            )}

            {/* iOS Safari — share guide */}
            {guideType === 'ios-safari' && (
              <ol className="space-y-4 text-sm text-gray-700">
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">1</span>
                  <span>Tap the <Share className="inline w-4 h-4 text-blue-500" /> <strong>Share</strong> button at the <strong>bottom</strong> of Safari (the box with an arrow pointing up)</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">2</span>
                  <span>Scroll down in the menu until you see <strong>"Add to Home Screen"</strong> and tap it</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">3</span>
                  <span>Tap <strong>"Add"</strong> in the top-right corner — the EcoTrack icon will appear on your home screen</span>
                </li>
              </ol>
            )}

            {/* Android/desktop — Chrome menu guide */}
            {guideType === 'android-manual' && (
              <ol className="space-y-4 text-sm text-gray-700">
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">1</span>
                  <span>Tap the <strong>⋮ menu</strong> (three dots) in the top-right of Chrome</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">2</span>
                  <span>Tap <strong>"Add to Home Screen"</strong> or <strong>"Install App"</strong></span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">3</span>
                  <span>Tap <strong>"Install"</strong> to confirm</span>
                </li>
              </ol>
            )}

            <button
              onClick={() => setGuideType(null)}
              className="w-full mt-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </SidebarProvider>
  );
}