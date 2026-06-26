import AdminDashboard from './pages/AdminDashboard';
import AllCollections from './pages/AllCollections';
import AllCollectors from './pages/AllCollectors';
import AreaLeaderboard from './pages/AreaLeaderboard';
import CollectorDashboard from './pages/CollectorDashboard';
import CollectorProfile from './pages/CollectorProfile';
import Home from './pages/Home';
import Leaderboard from './pages/Leaderboard';
import OnboardCollector from './pages/OnboardCollector';
import QRCodeGenerator from './pages/QRCodeGenerator';
import RecyclingCenters from './pages/RecyclingCenters';
import Reports from './pages/Report';
import ScanItem from './pages/ScanItem';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AdminDashboard": AdminDashboard,
    "AllCollections": AllCollections,
    "AllCollectors": AllCollectors,
    "AreaLeaderboard": AreaLeaderboard,
    "CollectorDashboard": CollectorDashboard,
    "CollectorProfile": CollectorProfile,
    "Home": Home,
    "Leaderboard": Leaderboard,
    "OnboardCollector": OnboardCollector,
    "QRCodeGenerator": QRCodeGenerator,
    "RecyclingCenters": RecyclingCenters,
    "Reports": Reports,
    "ScanItem": ScanItem,
}

export const pagesConfig = {
    mainPage: "CollectorDashboard",
    Pages: PAGES,
    Layout: __Layout,
};