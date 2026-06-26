import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { MapPin, Trophy, TrendingUp, Users, Search } from "lucide-react";
import { motion } from "framer-motion";

export default function AreaLeaderboard() {
  const [searchQuery, setSearchQuery] = useState('');

  const { data: allCollectors = [], isLoading } = useQuery({
    queryKey: ['allCollectors'],
    queryFn: () => base44.entities.User.list(),
  });

  // Group collectors by area
  const areaGroups = allCollectors.reduce((groups, collector) => {
    const area = collector.area || 'Unassigned';
    if (!groups[area]) {
      groups[area] = {
        collectors: [],
        totalWeight: 0,
        totalCollections: 0
      };
    }
    groups[area].collectors.push(collector);
    groups[area].totalWeight += collector.total_weight_kg || 0;
    groups[area].totalCollections += collector.total_collections || 0;
    return groups;
  }, {});

  // Sort areas by total weight
  const sortedAreas = Object.entries(areaGroups)
    .sort(([, a], [, b]) => b.totalWeight - a.totalWeight)
    .filter(([area]) => area.toLowerCase().includes(searchQuery.toLowerCase()));

  // Get top 3 areas
  const topThreeAreas = sortedAreas.slice(0, 3);

  const getRankBadge = (index) => {
    if (index === 0) return { icon: '🥇', color: 'bg-amber-100 text-amber-700', label: '1st Place' };
    if (index === 1) return { icon: '🥈', color: 'bg-slate-100 text-slate-700', label: '2nd Place' };
    if (index === 2) return { icon: '🥉', color: 'bg-orange-100 text-orange-700', label: '3rd Place' };
    return { icon: '🏅', color: 'bg-gray-100 text-gray-700', label: `${index + 1}th` };
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Area Leaderboard</h1>
            <p className="text-gray-600">See which areas are leading in e-waste collection</p>
          </div>
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search areas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Top 3 Areas Podium */}
        {topThreeAreas.length > 0 && (
          <Card className="border-none shadow-xl bg-gradient-to-br from-amber-50 to-yellow-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-6 h-6 text-amber-600" />
                Top 3 Areas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-6">
                {topThreeAreas.map(([areaName, areaData], index) => {
                  const badge = getRankBadge(index);
                  return (
                    <motion.div
                      key={areaName}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className={`p-6 rounded-xl ${
                        index === 0 ? 'bg-gradient-to-br from-amber-100 to-yellow-100 border-2 border-amber-300' :
                        index === 1 ? 'bg-gradient-to-br from-slate-100 to-gray-100 border-2 border-slate-300' :
                        'bg-gradient-to-br from-orange-100 to-amber-100 border-2 border-orange-300'
                      }`}
                    >
                      <div className="text-center mb-4">
                        <span className="text-5xl">{badge.icon}</span>
                        <Badge className={`${badge.color} mt-2`}>{badge.label}</Badge>
                      </div>
                      <div className="text-center">
                        <h3 className="text-2xl font-bold text-gray-900 mb-2">{areaName}</h3>
                        <div className="flex justify-center gap-6 text-sm">
                          <div>
                            <p className="text-3xl font-bold text-emerald-600">{areaData.totalWeight.toFixed(0)}</p>
                            <p className="text-gray-600">kg collected</p>
                          </div>
                          <div>
                            <p className="text-2xl font-bold text-blue-600">{areaData.collectors.length}</p>
                            <p className="text-gray-600">collectors</p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* All Areas */}
        <div className="space-y-6">
          {sortedAreas.map(([areaName, areaData], areaIndex) => {
            const badge = getRankBadge(areaIndex);
            // Sort collectors within area by weight
            const sortedCollectors = [...areaData.collectors].sort(
              (a, b) => (b.total_weight_kg || 0) - (a.total_weight_kg || 0)
            );

            return (
              <motion.div
                key={areaName}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: areaIndex * 0.05 }}
              >
                <Card className="border-none shadow-xl">
                  <CardHeader className="bg-gradient-to-r from-emerald-50 to-teal-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-emerald-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                          #{areaIndex + 1}
                        </div>
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <MapPin className="w-5 h-5 text-emerald-600" />
                            {areaName}
                          </CardTitle>
                          <p className="text-sm text-gray-500 mt-1">
                            {areaData.collectors.length} collector{areaData.collectors.length !== 1 ? 's' : ''} • {areaData.totalCollections} items
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-3xl font-bold text-emerald-600">{areaData.totalWeight.toFixed(1)}</p>
                        <p className="text-sm text-gray-600">kg total</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="space-y-3">
                      {sortedCollectors.map((collector, collectorIndex) => (
                        <div
                          key={collector.id}
                          className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <div className="relative">
                              {collector.profile_picture ? (
                                <img
                                  src={collector.profile_picture}
                                  alt={collector.full_name}
                                  className="w-14 h-14 rounded-full object-cover border-2 border-emerald-200"
                                />
                              ) : (
                                <div className="w-14 h-14 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center border-2 border-emerald-200">
                                  <span className="text-white font-bold text-lg">
                                    {collector.full_name?.[0]?.toUpperCase() || 'U'}
                                  </span>
                                </div>
                              )}
                              {collectorIndex < 3 && (
                                <div className="absolute -top-1 -right-1 w-6 h-6 bg-amber-400 rounded-full flex items-center justify-center text-xs font-bold border-2 border-white">
                                  {collectorIndex + 1}
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">{collector.full_name || 'Unknown'}</p>
                              <p className="text-sm text-gray-500">{collector.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-right">
                              <p className="text-2xl font-bold text-emerald-600">
                                {(collector.total_weight_kg || 0).toFixed(1)}
                              </p>
                              <p className="text-xs text-gray-500">kg collected</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xl font-bold text-blue-600">
                                {collector.total_collections || 0}
                              </p>
                              <p className="text-xs text-gray-500">items</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {sortedAreas.length === 0 && (
          <Card className="border-none shadow-xl">
            <CardContent className="p-12 text-center">
              <MapPin className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No areas found</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}