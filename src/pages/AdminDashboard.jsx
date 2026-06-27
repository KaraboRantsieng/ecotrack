import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Package, 
  Users, 
  TrendingUp, 
  CheckCircle,
  Clock,
  BarChart3,
  Leaf,
  AlertOctagon
} from "lucide-react";
import { motion } from "framer-motion";
import AdminFraudAlerts from "@/components/fraud/AdminFraudAlerts";
import AdminVerificationQueue from "@/components/fraud/AdminVerificationQueue";

export default function AdminDashboard() {
  const { data: allItems = [] } = useQuery({
    queryKey: ['allItems'],
    queryFn: () => base44.entities.EWasteItem.list('-created_date'),
  });

  const { data: allCollectors = [] } = useQuery({
    queryKey: ['allCollectors'],
    queryFn: () => base44.entities.User.list(),
  });

  const totalCO2Saved = allItems.reduce((sum, item) => sum + (item.co2_saved_kg || 0), 0);
  const totalHazardous = allItems.reduce((sum, item) => sum + (item.hazardous_waste_kg || 0), 0);
  const totalWeight = allItems.reduce((sum, item) => sum + (item.weight_kg || 0), 0);
  const verifiedItems = allItems.filter(item => item.verified).length;
  const pendingItems = allItems.filter(item => !item.verified).length;

  // Calculate environmental impact - tracking informal sector waste
  const totalWasteTrackedTonnes = (totalWeight / 1000).toFixed(2);
  const SA_ANNUAL_EWASTE = 360000; // tonnes
  // Only 7-12% is formally tracked, our app tracks the 88-93% informal untracked waste
  const INFORMAL_UNTRACKED_MIN = 0.88; // 88% untracked
  const INFORMAL_UNTRACKED_MAX = 0.93; // 93% untracked
  const targetMin = SA_ANNUAL_EWASTE * INFORMAL_UNTRACKED_MIN; // 316,800 tonnes
  const targetMax = SA_ANNUAL_EWASTE * INFORMAL_UNTRACKED_MAX; // 334,800 tonnes
  const percentageOfTarget = ((parseFloat(totalWasteTrackedTonnes) / targetMax) * 100).toFixed(3);

  const todayItems = allItems.filter(item => {
    const today = new Date().toDateString();
    return new Date(item.created_date).toDateString() === today;
  }).length;

  const activeCollectors = allCollectors.filter(c => c.total_collections > 0).length;

  // Recovery value per kg by category (estimated market value in ZAR)
  const RECOVERY_VALUE = {
    mobile_phones: 15.00,
    computers_laptops: 25.00,
    televisions: 8.00,
    batteries: 12.00,
    chargers: 3.00,
    cables: 5.00,
    keyboards: 4.00,
    screens: 10.00,
    printers: 6.00,
    routers: 7.00,
    hard_drives: 20.00,
    speakers: 5.00,
    circuit_boards: 30.00,
    power_supplies: 8.00,
    laptop_ram: 50.00,
    other: 5.00
  };

  // Hazard level by category
  const HAZARD_LEVEL = {
    mobile_phones: 'Medium',
    computers_laptops: 'High',
    televisions: 'High',
    batteries: 'High',
    chargers: 'Low',
    cables: 'Low',
    keyboards: 'Low',
    screens: 'Medium',
    printers: 'Medium',
    routers: 'Low',
    hard_drives: 'Low',
    speakers: 'Low',
    circuit_boards: 'High',
    power_supplies: 'Medium',
    laptop_ram: 'Low',
    other: 'Medium'
  };

  const categoryStats = allItems.reduce((acc, item) => {
    const cat = item.category;
    if (!acc[cat]) {
      acc[cat] = { 
        count: 0, 
        weight: 0,
        recoveryValue: 0,
        hazardLevel: HAZARD_LEVEL[cat] || 'Medium'
      };
    }
    acc[cat].count += item.quantity;
    acc[cat].weight += item.weight_kg || 0;
    acc[cat].recoveryValue += (item.weight_kg || 0) * (RECOVERY_VALUE[cat] || 5);
    return acc;
  }, {});

  const topCategories = Object.entries(categoryStats)
    .sort(([,a], [,b]) => b.count - a.count)
    .slice(0, 5);

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
          <p className="text-gray-600">Monitor e-waste collection activities</p>
        </div>

        {/* Verification Queue — items held pending admin review */}
        <AdminVerificationQueue />

        {/* Fraud Alerts Panel */}
        <AdminFraudAlerts />

        {/* Environmental Impact Banner */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }} 
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl p-8 text-white shadow-xl"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
              <Leaf className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-1">Informal Sector Impact Tracking</h2>
              <p className="text-green-100">Making the invisible visible - tracking unaccounted informal e-waste collection</p>
            </div>
          </div>
          <div className="grid md:grid-cols-4 gap-6">
            <div>
              <p className="text-green-100 text-sm mb-1">Informal Waste Tracked</p>
              <p className="text-4xl font-bold">{totalWasteTrackedTonnes}</p>
              <p className="text-green-100 text-sm">tonnes now counted</p>
            </div>
            <div>
              <p className="text-green-100 text-sm mb-1">Informal Sector Target (88-93%)</p>
              <p className="text-2xl font-bold">{targetMin.toLocaleString()}-{targetMax.toLocaleString()}</p>
              <p className="text-green-100 text-sm">tonnes of 360,000t total SA waste</p>
            </div>
            <div>
              <p className="text-green-100 text-sm mb-1">Coverage of Informal Sector</p>
              <p className="text-4xl font-bold">{percentageOfTarget}%</p>
              <p className="text-green-100 text-sm">of 334,800t untracked waste</p>
            </div>
            <div>
              <p className="text-green-100 text-sm mb-1">Items Tracked</p>
              <p className="text-4xl font-bold">{allItems.length.toLocaleString()}</p>
              <p className="text-green-100 text-sm">informal collections counted</p>
            </div>
          </div>
        </motion.div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="border-none shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50">
              <CardContent className="p-6">
                <Package className="w-8 h-8 text-blue-600 mb-2" />
                <p className="text-3xl font-bold text-gray-900">{allItems.length}</p>
                <p className="text-sm text-gray-600">Total Items</p>
                <p className="text-xs text-blue-600 mt-1">+{todayItems} today</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="border-none shadow-lg bg-gradient-to-br from-emerald-50 to-teal-50">
              <CardContent className="p-6">
                <Users className="w-8 h-8 text-emerald-600 mb-2" />
                <p className="text-3xl font-bold text-gray-900">{activeCollectors}</p>
                <p className="text-sm text-gray-600">Active Collectors</p>
                <p className="text-xs text-emerald-600 mt-1">of {allCollectors.length} total</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="border-none shadow-lg bg-gradient-to-br from-purple-50 to-pink-50">
              <CardContent className="p-6">
                <TrendingUp className="w-8 h-8 text-purple-600 mb-2" />
                <p className="text-3xl font-bold text-gray-900">{totalWeight.toFixed(1)}</p>
                <p className="text-sm text-gray-600">Total Weight (kg)</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className="border-none shadow-lg bg-gradient-to-br from-green-50 to-emerald-50">
              <CardContent className="p-6">
                <Leaf className="w-8 h-8 text-green-600 mb-2" />
                <p className="text-3xl font-bold text-gray-900">{totalCO2Saved.toFixed(1)}</p>
                <p className="text-sm text-gray-600">kg CO₂ Saved</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <Card className="border-none shadow-lg bg-gradient-to-br from-red-50 to-orange-50">
              <CardContent className="p-6">
                <AlertOctagon className="w-8 h-8 text-red-600 mb-2" />
                <p className="text-3xl font-bold text-gray-900">{totalHazardous.toFixed(1)}</p>
                <p className="text-sm text-gray-600">kg Hazardous Prevented</p>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Verification Status & Top Categories */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Verification Status */}
          <Card className="border-none shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                Verification Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                  <div>
                    <p className="font-semibold text-gray-900">Verified Items</p>
                    <p className="text-sm text-gray-500">Ready for processing</p>
                  </div>
                </div>
                <p className="text-3xl font-bold text-green-600">{verifiedItems}</p>
              </div>

              <div className="flex items-center justify-between p-4 bg-amber-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Clock className="w-8 h-8 text-amber-600" />
                  <div>
                    <p className="font-semibold text-gray-900">Pending Verification</p>
                    <p className="text-sm text-gray-500">Requires review</p>
                  </div>
                </div>
                <p className="text-3xl font-bold text-amber-600">{pendingItems}</p>
              </div>

              <div className="pt-4 border-t">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">Verification Rate</span>
                  <span className="font-semibold">
                    {allItems.length > 0 ? ((verifiedItems / allItems.length) * 100).toFixed(1) : 0}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all duration-500"
                    style={{ 
                      width: `${allItems.length > 0 ? (verifiedItems / allItems.length) * 100 : 0}%` 
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Top Categories */}
          <Card className="border-none shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-emerald-600" />
                Material Breakdown & Recovery Value
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topCategories.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">No data yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {topCategories.map(([category, stats], idx) => {
                    const hazardColor = stats.hazardLevel === 'High' ? 'bg-red-100 text-red-700 border-red-300' :
                                       stats.hazardLevel === 'Medium' ? 'bg-amber-100 text-amber-700 border-amber-300' :
                                       'bg-green-100 text-green-700 border-green-300';
                    return (
                      <div key={category} className="border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <span className="text-sm font-semibold text-gray-900">
                              {category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </span>
                            <div className="flex gap-2 mt-1">
                              <span className={`text-xs px-2 py-0.5 rounded border ${hazardColor}`}>
                                {stats.hazardLevel} Hazard
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-emerald-600">R{stats.recoveryValue.toFixed(2)}</p>
                            <p className="text-xs text-gray-500">Est. recovery value</p>
                          </div>
                        </div>
                        <div className="flex justify-between items-center text-xs text-gray-500 mb-2">
                          <span>{stats.count} items</span>
                          <span>{stats.weight.toFixed(1)}kg</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all duration-500 ${
                              idx === 0 ? 'bg-emerald-500' :
                              idx === 1 ? 'bg-blue-500' :
                              idx === 2 ? 'bg-purple-500' :
                              idx === 3 ? 'bg-amber-500' : 'bg-pink-500'
                            }`}
                            style={{ 
                              width: `${(stats.count / allItems.length) * 100}%` 
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card className="border-none shadow-xl">
          <CardHeader>
            <CardTitle>Recent Collections</CardTitle>
          </CardHeader>
          <CardContent>
            {allItems.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No collections yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {allItems.slice(0, 10).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
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
                          Collected by {item.collector_email} • {new Date(item.created_date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">{item.quantity} items</p>
                        <p className="text-sm text-emerald-600">+{item.points_earned} pts</p>
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
      </div>
    </div>
  );
}