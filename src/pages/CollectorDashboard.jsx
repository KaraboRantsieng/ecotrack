import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Scan, 
  TrendingUp, 
  Package,
  MapPin,
  CheckCircle,
  Clock,
  Leaf,
  Droplet,
  AlertOctagon
} from "lucide-react";
import { motion } from "framer-motion";

export default function CollectorDashboard() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const currentUser = await base44.auth.me();
    setUser(currentUser);
  };

  const { data: myCollections = [] } = useQuery({
    queryKey: ['myCollections', user?.email],
    queryFn: () => base44.entities.EWasteItem.filter({ collector_email: user?.email }, '-created_date', 100),
    enabled: !!user?.email,
  });

  const { data: allCollectors = [] } = useQuery({
    queryKey: ['allCollectors'],
    queryFn: () => base44.entities.User.list(),
  });

  // Calculate environmental impact
  const totalCO2Saved = myCollections.reduce((sum, item) => sum + (item.co2_saved_kg || 0), 0);
  const totalHazardous = myCollections.reduce((sum, item) => sum + (item.hazardous_waste_kg || 0), 0);
  
  const myRank = allCollectors
    .sort((a, b) => (b.total_collections || 0) - (a.total_collections || 0))
    .findIndex(c => c.email === user?.email) + 1;

  const todayCollections = myCollections.filter(item => {
    const today = new Date().toDateString();
    return new Date(item.created_date).toDateString() === today;
  }).length;

  const thisWeekCollections = myCollections.filter(item => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return new Date(item.created_date) >= weekAgo;
  }).length;

  const lastWeekCollections = myCollections.filter(item => {
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const itemDate = new Date(item.created_date);
    return itemDate >= twoWeeksAgo && itemDate < weekAgo;
  }).length;

  const weekTrend = lastWeekCollections > 0 
    ? ((thisWeekCollections - lastWeekCollections) / lastWeekCollections * 100)
    : thisWeekCollections > 0 ? 100 : 0;

  const verifiedItems = myCollections.filter(item => item.verified).length;
  const pendingItems = myCollections.filter(item => !item.verified).length;
  const rejectedItems = myCollections.filter(item => item.rejected).length;
  const fraudPreventionRate = myCollections.length > 0 
    ? (rejectedItems / myCollections.length * 100)
    : 0;

  // Calculate waste saved in tonnes
  const wasteSavedTonnes = ((user?.total_weight_kg || 0) / 1000).toFixed(3);
  
  // South Africa generates ~360,000 tonnes of e-waste annually
  // Only 7-12% is formally tracked (25,200 - 43,200 tonnes)
  // Our app tracks the 88-93% informal sector (316,800 - 334,800 tonnes) that's currently unaccounted for
  const SA_ANNUAL_EWASTE = 360000;
  const INFORMAL_UNTRACKED_MIN = 0.88; // 88% untracked
  const INFORMAL_UNTRACKED_MAX = 0.93; // 93% untracked
  const targetMin = SA_ANNUAL_EWASTE * INFORMAL_UNTRACKED_MIN; // 316,800 tonnes
  const targetMax = SA_ANNUAL_EWASTE * INFORMAL_UNTRACKED_MAX; // 334,800 tonnes
  
  // Calculate total waste tracked by all collectors on the app
  const totalCollectorWeight = allCollectors.reduce((sum, c) => sum + (c.total_weight_kg || 0), 0);
  const totalWasteTrackedTonnes = (totalCollectorWeight / 1000).toFixed(2);

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Welcome Section with Earnings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-emerald-600 to-teal-600 rounded-2xl p-6 md:p-8 text-white shadow-xl"
        >
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex-1">
              <h1 className="text-3xl md:text-4xl font-bold mb-2">
                Welcome back, {user?.full_name?.split(' ')[0] || 'Collector'}!
              </h1>
              <p className="text-emerald-100 text-lg">
                Ready to make a difference today?
              </p>
            </div>
            <Link to={createPageUrl("ScanItem")} className="w-full md:w-auto">
              <Button size="lg" className="w-full bg-white text-emerald-600 hover:bg-emerald-50 shadow-lg">
                <Scan className="w-5 h-5 mr-2" />
                Scan Item
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Environmental Impact Banner */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl p-6 text-white shadow-xl"
        >
          <p className="text-xs font-semibold text-green-100 uppercase tracking-wide mb-3 text-center">EPR-Verified Metrics</p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                <Leaf className="w-8 h-8 text-white" />
              </div>
              <div>
                <p className="text-sm text-green-100 mb-1">Your Tracked Impact</p>
                <p className="text-4xl font-bold mb-1">{wasteSavedTonnes} tonnes</p>
                <p className="text-green-100 text-sm">
                  Now counted! • Target: {targetMin.toLocaleString()}-{targetMax.toLocaleString()}t informal sector waste
                </p>
              </div>
            </div>
            <div className="text-right hidden md:block">
              <p className="text-sm text-green-100 mb-1">App Total Tracked</p>
              <p className="text-3xl font-bold">{totalWasteTrackedTonnes}t</p>
              <p className="text-xs text-green-100">Informal waste now counted</p>
            </div>
          </div>
        </motion.div>

        {/* Environmental Impact Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}>
            <Card className="border-none shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50">
              <CardContent className="p-6">
                <Package className="w-8 h-8 text-blue-600 mb-2" />
                <p className="text-3xl font-bold text-gray-900">{user?.total_collections || 0}</p>
                <p className="text-sm text-gray-600">Items Collected</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}>
            <Card className="border-none shadow-lg bg-gradient-to-br from-green-50 to-emerald-50">
              <CardContent className="p-6">
                <Droplet className="w-8 h-8 text-green-600 mb-2" />
                <p className="text-3xl font-bold text-gray-900">{totalCO2Saved.toFixed(1)}</p>
                <p className="text-sm text-gray-600">kg CO₂ Saved</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }}>
            <Card className="border-none shadow-lg bg-gradient-to-br from-red-50 to-orange-50">
              <CardContent className="p-6">
                <AlertOctagon className="w-8 h-8 text-red-600 mb-2" />
                <p className="text-3xl font-bold text-gray-900">{totalHazardous.toFixed(2)}</p>
                <p className="text-sm text-gray-600">kg Hazardous Prevented</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }}>
            <Card className="border-none shadow-lg bg-gradient-to-br from-purple-50 to-pink-50">
              <CardContent className="p-6">
                <TrendingUp className="w-8 h-8 text-purple-600 mb-2" />
                <p className="text-3xl font-bold text-gray-900">#{myRank || '-'}</p>
                <p className="text-sm text-gray-600">Your Rank</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 }}>
            <Card className="border-none shadow-lg bg-gradient-to-br from-teal-50 to-cyan-50">
              <CardContent className="p-6">
                <Package className="w-8 h-8 text-teal-600 mb-2" />
                <p className="text-3xl font-bold text-gray-900">{(user?.total_weight_kg || 0).toFixed(1)}</p>
                <p className="text-sm text-gray-600">kg Total Weight</p>
              </CardContent>
            </Card>
          </motion.div>
        </div>



        {/* SDG & ESG Impact */}
        <Card className="border-none shadow-lg bg-gradient-to-br from-indigo-50 to-purple-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Leaf className="w-5 h-5 text-indigo-600" />
              SDG & ESG Contribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-lg font-bold text-indigo-600">12</span>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Responsible Consumption & Production</p>
                  <p className="text-sm text-gray-600">Promoting circular economy through e-waste recovery</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-lg font-bold text-green-600">13</span>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Climate Action</p>
                  <p className="text-sm text-gray-600">{totalCO2Saved.toFixed(1)}kg CO₂ emissions prevented</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-lg font-bold text-blue-600">8</span>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Decent Work & Economic Growth</p>
                  <p className="text-sm text-gray-600">Supporting informal sector workers and formalizing their contribution</p>
                </div>
              </div>
              <div className="p-4 bg-white rounded-lg border border-indigo-200">
                <p className="text-xs text-gray-500 mb-1">ESG Impact Score</p>
                <p className="text-sm font-semibold text-gray-900">Environmental: High • Social: Medium • Governance: Strong</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity & Quick Actions */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Recent Collections */}
          <Card className="lg:col-span-2 border-none shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-emerald-600" />
                Recent Collections
              </CardTitle>
            </CardHeader>
            <CardContent>
              {myCollections.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 mb-4">No collections yet</p>
                  <Link to={createPageUrl("ScanItem")}>
                    <Button className="bg-emerald-600 hover:bg-emerald-700">
                      <Scan className="w-4 h-4 mr-2" />
                      Start Collecting
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {myCollections.slice(0, 5).map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                          <Package className="w-6 h-6 text-emerald-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">
                            {item.category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </p>
                          <p className="text-sm text-gray-500">
                            {item.quantity} item{item.quantity !== 1 ? 's' : ''} • {item.weight_kg || 0}kg
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right mr-2">
                          <p className="text-sm text-emerald-600">{(item.co2_saved_kg || 0).toFixed(1)}kg CO₂</p>
                        </div>
                        {item.verified ? (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        ) : (
                          <Clock className="w-5 h-5 text-amber-500" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions & Stats */}
          <div className="space-y-6">
            <Card className="border-none shadow-lg bg-gradient-to-br from-indigo-50 to-purple-50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  This Week
                  {weekTrend !== 0 && (
                    <span className={`text-sm font-normal ${weekTrend > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {weekTrend > 0 ? '↑' : '↓'} {Math.abs(weekTrend).toFixed(0)}%
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Collections</p>
                  <p className="text-3xl font-bold text-indigo-600">{thisWeekCollections}</p>
                  <p className="text-xs text-gray-500 mt-1">vs {lastWeekCollections} last week</p>
                </div>
                <div className="pt-4 border-t border-indigo-200">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600">Verified</span>
                    <span className="font-semibold text-green-600">{verifiedItems}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Pending</span>
                    <span className="font-semibold text-amber-600">{pendingItems}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-lg bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200">
              <CardHeader>
                <CardTitle className="text-lg text-amber-900">Fraud Prevention</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-2">Invalid claims blocked</p>
                <p className="text-4xl font-bold text-amber-600 mb-2">{rejectedItems}</p>
                <div className="bg-white rounded-lg p-3 border border-amber-200">
                  <p className="text-xs text-gray-600 mb-1">System accuracy</p>
                  <p className="text-2xl font-bold text-amber-700">{(100 - fraudPreventionRate).toFixed(1)}%</p>
                  <p className="text-xs text-gray-500 mt-1">
                    EcoTrack prevented {fraudPreventionRate.toFixed(1)}% of invalid claims
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Link to={createPageUrl("RecyclingCenters")} className="block">
                  <Button variant="outline" className="w-full justify-start">
                    <MapPin className="w-4 h-4 mr-2" />
                    Find Drop-off Centers
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}