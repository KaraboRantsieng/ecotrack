import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldAlert, CheckCheck, Eye, X } from "lucide-react";

export default function AdminFraudAlerts() {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);

  const { data: alerts = [] } = useQuery({
    queryKey: ["fraudAlerts"],
    queryFn: () => base44.entities.FraudAlert.list("-created_date", 50),
    refetchInterval: 30000, // poll every 30s for new alerts
  });

  const unread = alerts.filter(a => !a.read);

  const markReadMutation = useMutation({
    mutationFn: (id) => base44.entities.FraudAlert.update(id, { read: true }),
    onSuccess: () => queryClient.invalidateQueries(["fraudAlerts"]),
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await Promise.all(unread.map(a => base44.entities.FraudAlert.update(a.id, { read: true })));
    },
    onSuccess: () => queryClient.invalidateQueries(["fraudAlerts"]),
  });

  const alertTypeLabel = (type) =>
    type === "duplicate_serial_ai_photo" ? "Item Photo" : "PSN Badge";

  if (alerts.length === 0) return null;

  return (
    <div className="mb-6">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-red-600" />
          <span className="font-semibold text-red-700">Fraud Alerts</span>
          {unread.length > 0 && (
            <Badge className="bg-red-600 text-white text-xs animate-pulse">
              {unread.length} new
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unread.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7"
              onClick={(e) => { e.stopPropagation(); markAllReadMutation.mutate(); }}
            >
              <CheckCheck className="w-3 h-3 mr-1" />
              Mark all read
            </Button>
          )}
          <span className="text-xs text-gray-400">{expanded ? "▲" : "▼"}</span>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 space-y-2">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`relative rounded-xl border p-4 transition-all ${
                alert.read
                  ? "bg-gray-50 border-gray-200 opacity-60"
                  : "bg-red-50 border-red-300 shadow-sm"
              }`}
            >
              {!alert.read && (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500" />
              )}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Badge className="bg-red-100 text-red-700 text-xs">
                      🚨 Duplicate {alert.identifier_type || "Serial"}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      via {alertTypeLabel(alert.alert_type)}
                    </Badge>
                  </div>
                  <p className="text-sm font-mono font-bold text-gray-900 truncate">
                    {alert.serial_number}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    Collector: <span className="font-medium">{alert.collector_name || alert.collector_email}</span>
                  </p>
                  {alert.existing_item_code && (
                    <p className="text-xs text-gray-500">
                      Already logged as: <span className="font-mono">{alert.existing_item_code}</span>
                    </p>
                  )}
                  {alert.location && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">📍 {alert.location}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(alert.created_date).toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" })}
                  </p>
                </div>
                <div className="flex flex-col gap-1 items-end flex-shrink-0">
                  {alert.photo_url && (
                    <a href={alert.photo_url} target="_blank" rel="noopener noreferrer">
                      <img src={alert.photo_url} alt="Evidence" className="w-14 h-14 object-cover rounded-lg border" />
                    </a>
                  )}
                  {!alert.read && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0"
                      onClick={() => markReadMutation.mutate(alert.id)}
                      title="Dismiss"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}