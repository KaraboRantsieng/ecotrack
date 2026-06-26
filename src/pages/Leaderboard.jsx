import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Medal, Award, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";

export default function Leaderboard() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const currentUser = await base44.auth.me();
    setUser(currentUser);
  };

  const { data: collectors = [], isLoading } = useQuery({
    queryKey: ['allCollectors'],
    queryFn: () => base44.entities.User.list(),
  });

  const sortedCollectors = [...collectors]
    .filter(c => c.total_points > 0)
    .sort((a, b) => (b.total_points || 0) - (a.total_points || 0));

  const topThree = sortedCollectors.slice(0, 3);
  const others = sortedCollectors.slice(3);

  const getRankIcon = (rank) => {
    if (rank === 1) return <Trophy className="w-8 h-8 text-amber-500" />;
    if (rank === 2) return <Medal className="w-8 h-8 text-gray-400" />;
    if (rank === 3) return <Medal className="w-8 h-8 text-orange-600" />;
    return <Award className="w-6 h-6 text-gray-400" />;
  };

  const getRankBg = (rank) => {
    if (rank === 1) return "from-amber-50 to-yellow-50 border-amber-200";
    if (rank === 2) return "from-gray-50 to-slate-50 border-gray-200";
    if (rank === 3) return "from-orange-50 to-red-50 border-orange-200";
    return "from-white to-gray-50 border-gray-200";
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
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Leaderboard</h1>
          <p className="text-gray-600">Top collectors making a difference</p>
        </div>

        {/* Top 3 Podium */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[1, 0, 2].map((idx) => {
            const collector = topThree[idx];
            const rank = idx === 1 ? 1 : idx === 0 ? 2 : 3;
            if (!collector) return null;

            return (
              <motion.div
                key={collector.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className={`${idx === 1 ? 'order-1' : idx === 0 ? 'order-2' : 'order-3'}`}
              >
                <Card className={`border-2 bg-gradient-to-br ${getRankBg(rank)} ${
                  collector.email === user?.email ? 'ring-4 ring-emerald-400' : ''
                }`}>
                  <CardContent className="p-6 text-center">
                    <div className="flex justify-center mb-4">
                      {getRankIcon(rank)}
                    </div>
                    <div className={`w-20 h-20 mx-auto mb-4 bg-gradient-to-br ${
                      rank === 1 ? 'from-amber-400 to-yellow-500' :
                      rank === 2 ? 'from-gray-300 to-slate-400' :
                      'from-orange-400 to-red-500'
                    } rounded-full flex items-center justify-center`}>
                      <span className="text-2xl font-bold text-white">
                        {collector.full_name?.[0]?.toUpperCase() || 'U'}
                      </span>
                    </div>
                    <h3 className="font-bold text-lg mb-1 truncate">
                      {collector.full_name || 'Collector'}
                    </h3>
                    <p className="text-3xl font-bold text-emerald-600 mb-1">
                      {collector.total_points || 0}
                    </p>
                    <p className="text-sm text-gray-600">points</p>
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <p className="text-sm text-gray-600">
                        {collector.total_collections || 0} items collected
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Rest of the leaderboard */}
        {others.length > 0 && (
          <Card className="border-none shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
                All Rankings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {others.map((collector, idx) => {
                  const rank = idx + 4;
                  const isCurrentUser = collector.email === user?.email;

                  return (
                    <motion.div
                      key={collector.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className={`flex items-center justify-between p-4 rounded-xl transition-all ${
                        isCurrentUser 
                          ? 'bg-emerald-100 border-2 border-emerald-400' 
                          : 'bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                          <span className="font-bold text-gray-600">#{rank}</span>
                        </div>
                        <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center">
                          <span className="text-lg font-bold text-white">
                            {collector.full_name?.[0]?.toUpperCase() || 'U'}
                          </span>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">
                            {collector.full_name || 'Collector'}
                            {isCurrentUser && (
                              <span className="ml-2 text-xs bg-emerald-600 text-white px-2 py-1 rounded-full">
                                You
                              </span>
                            )}
                          </p>
                          <p className="text-sm text-gray-500">
                            {collector.total_collections || 0} items
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-emerald-600">
                          {collector.total_points || 0}
                        </p>
                        <p className="text-xs text-gray-500">points</p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {sortedCollectors.length === 0 && (
          <Card className="border-none shadow-xl">
            <CardContent className="p-12 text-center">
              <Trophy className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No collectors yet. Be the first!</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}