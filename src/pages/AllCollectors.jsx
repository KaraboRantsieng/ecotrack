import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  Award,
  Package,
  TrendingUp,
  Search,
  Mail,
  Phone,
  MapPin
} from "lucide-react";

export default function AllCollectors() {
  const [searchQuery, setSearchQuery] = useState('');

  const { data: allCollectors = [], isLoading } = useQuery({
    queryKey: ['allCollectors'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: allItems = [] } = useQuery({
    queryKey: ['allItems'],
    queryFn: () => base44.entities.EWasteItem.list(),
  });

  const filteredCollectors = allCollectors.filter(collector =>
    (collector.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (collector.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (collector.location || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedCollectors = [...filteredCollectors].sort(
    (a, b) => (b.total_points || 0) - (a.total_points || 0)
  );

  const activeCollectors = allCollectors.filter(c => (c.total_collections || 0) > 0);
  const totalPoints = allCollectors.reduce((sum, c) => sum + (c.total_points || 0), 0);
  const totalWeight = allCollectors.reduce((sum, c) => sum + (c.total_weight_kg || 0), 0);

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Collectors</h1>
            <p className="text-gray-600">Manage collector accounts and performance</p>
          </div>
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search collectors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid md:grid-cols-4 gap-4">
          <Card className="border-none shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50">
            <CardContent className="p-6">
              <Users className="w-8 h-8 text-blue-600 mb-2" />
              <p className="text-3xl font-bold text-gray-900">{allCollectors.length}</p>
              <p className="text-sm text-gray-600">Total Collectors</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg bg-gradient-to-br from-emerald-50 to-teal-50">
            <CardContent className="p-6">
              <TrendingUp className="w-8 h-8 text-emerald-600 mb-2" />
              <p className="text-3xl font-bold text-gray-900">{activeCollectors.length}</p>
              <p className="text-sm text-gray-600">Active Collectors</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg bg-gradient-to-br from-amber-50 to-orange-50">
            <CardContent className="p-6">
              <Award className="w-8 h-8 text-amber-600 mb-2" />
              <p className="text-3xl font-bold text-gray-900">{totalPoints}</p>
              <p className="text-sm text-gray-600">Total Points</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg bg-gradient-to-br from-purple-50 to-pink-50">
            <CardContent className="p-6">
              <Package className="w-8 h-8 text-purple-600 mb-2" />
              <p className="text-3xl font-bold text-gray-900">{totalWeight.toFixed(1)}</p>
              <p className="text-sm text-gray-600">Total Weight (kg)</p>
            </CardContent>
          </Card>
        </div>

        {/* Collectors List */}
        <Card className="border-none shadow-xl">
          <CardHeader>
            <CardTitle>All Collectors</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
              </div>
            ) : sortedCollectors.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No collectors found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sortedCollectors.map((collector, idx) => {
                  const rank = idx + 1;
                  const collectorItems = allItems.filter(
                    item => item.collector_email === collector.email
                  );
                  const verifiedCount = collectorItems.filter(item => item.verified).length;

                  return (
                    <div
                      key={collector.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-lg font-bold text-white">
                            {collector.full_name?.[0]?.toUpperCase() || 'U'}
                          </span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-semibold text-gray-900">
                              {collector.full_name || 'Unnamed Collector'}
                            </p>
                            {rank <= 3 && (
                              <Badge className={
                                rank === 1 ? 'bg-amber-100 text-amber-700' :
                                rank === 2 ? 'bg-gray-100 text-gray-700' :
                                'bg-orange-100 text-orange-700'
                              }>
                                #{rank}
                              </Badge>
                            )}
                            {collector.role === 'admin' && (
                              <Badge className="bg-purple-100 text-purple-700">Admin</Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-3 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {collector.email}
                            </span>
                            {collector.phone_number && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {collector.phone_number}
                              </span>
                            )}
                            {collector.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {collector.location}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-center">
                          <p className="text-2xl font-bold text-emerald-600">
                            {collector.total_points || 0}
                          </p>
                          <p className="text-xs text-gray-500">points</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-blue-600">
                            {collector.total_collections || 0}
                          </p>
                          <p className="text-xs text-gray-500">items</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-purple-600">
                            {collector.total_weight_kg || 0}
                          </p>
                          <p className="text-xs text-gray-500">kg</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-semibold text-green-600">
                            {verifiedCount}/{collector.total_collections || 0}
                          </p>
                          <p className="text-xs text-gray-500">verified</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}