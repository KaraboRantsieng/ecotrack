import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Phone, Clock, CheckCircle } from "lucide-react";
import { motion } from "framer-motion";

export default function RecyclingCenters() {
  const { data: centers = [], isLoading } = useQuery({
    queryKey: ['recyclingCenters'],
    queryFn: () => base44.entities.RecyclingCenter.filter({ is_active: true }),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Recycling Centers</h1>
          <p className="text-gray-600">Find nearby drop-off locations for your e-waste</p>
        </div>

        {centers.length === 0 ? (
          <Card className="border-none shadow-xl">
            <CardContent className="p-12 text-center">
              <MapPin className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-2">No recycling centers added yet</p>
              <p className="text-sm text-gray-400">Check back soon for locations near you</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {centers.map((center, idx) => (
              <motion.div
                key={center.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
              >
                <Card className="border-none shadow-xl hover:shadow-2xl transition-shadow">
                  <CardHeader className="bg-gradient-to-r from-emerald-50 to-teal-50">
                    <CardTitle className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 bg-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
                          <MapPin className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="font-bold text-lg text-gray-900">{center.name}</h3>
                          {center.is_active && (
                            <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full mt-1">
                              <CheckCircle className="w-3 h-3" />
                              Active
                            </span>
                          )}
                        </div>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-start gap-3">
                      <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-500">Address</p>
                        <p className="text-gray-900">{center.address}</p>
                      </div>
                    </div>

                    {center.phone && (
                      <div className="flex items-start gap-3">
                        <Phone className="w-5 h-5 text-gray-400 mt-0.5" />
                        <div>
                          <p className="text-sm text-gray-500">Phone</p>
                          <a href={`tel:${center.phone}`} className="text-emerald-600 hover:underline">
                            {center.phone}
                          </a>
                        </div>
                      </div>
                    )}

                    {center.operating_hours && (
                      <div className="flex items-start gap-3">
                        <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
                        <div>
                          <p className="text-sm text-gray-500">Hours</p>
                          <p className="text-gray-900">{center.operating_hours}</p>
                        </div>
                      </div>
                    )}

                    {center.accepted_items && center.accepted_items.length > 0 && (
                      <div>
                        <p className="text-sm text-gray-500 mb-2">Accepted Items</p>
                        <div className="flex flex-wrap gap-2">
                          {center.accepted_items.map((item, i) => (
                            <span
                              key={i}
                              className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full"
                            >
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {center.latitude && center.longitude && (
                      <a
                        href={`https://www.google.com/maps?q=${center.latitude},${center.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full mt-4 text-center bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg transition-colors"
                      >
                        Get Directions
                      </a>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}