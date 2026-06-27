import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, Eye, AlertTriangle, Clock, Image } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

const STATUS_LABEL = {
  pending_no_serial: { label: "No Serial", color: "bg-orange-100 text-orange-800" },
  pending_visual_duplicate: { label: "Visual Duplicate", color: "bg-red-100 text-red-800" },
};

export default function AdminVerificationQueue() {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState(null);
  const [adminNote, setAdminNote] = useState({});

  const { data: allItems = [], isLoading } = useQuery({
    queryKey: ["pendingItems"],
    queryFn: () => base44.entities.EWasteItem.list("-created_date"),
    select: (items) => items.filter(i => i.verification_status?.startsWith("pending")),
    refetchInterval: 30000,
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, note }) =>
      base44.entities.EWasteItem.update(id, {
        verification_status: "approved",
        verified: true,
        payout_blocked: false,
        admin_note: note || null,
        admin_reviewed_at: new Date().toISOString(),
      }),
    onSuccess: () => queryClient.invalidateQueries(["pendingItems", "allItems"]),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, note }) =>
      base44.entities.EWasteItem.update(id, {
        verification_status: "rejected",
        verified: false,
        rejected: true,
        payout_blocked: true,
        admin_note: note || null,
        admin_reviewed_at: new Date().toISOString(),
      }),
    onSuccess: () => queryClient.invalidateQueries(["pendingItems", "allItems"]),
  });

  if (isLoading) return null;
  if (allItems.length === 0) return null;

  return (
    <Card className="border-orange-200 shadow-lg">
      <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-200">
        <CardTitle className="flex items-center gap-2 text-orange-800">
          <Clock className="w-5 h-5" />
          Verification Queue
          <Badge className="bg-orange-600 text-white ml-2">{allItems.length}</Badge>
        </CardTitle>
        <p className="text-sm text-orange-700">
          Items held for review — approve to release payout, reject to deny.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-orange-100">
          {allItems.map((item) => {
            const statusInfo = STATUS_LABEL[item.verification_status] || { label: "Pending", color: "bg-gray-100 text-gray-700" };
            const isExpanded = expandedId === item.id;
            const note = adminNote[item.id] || "";

            return (
              <div key={item.id} className="p-4">
                <div className="flex items-start gap-3">
                  {/* Thumbnail */}
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                    {item.photo_urls?.[0] ? (
                      <img
                        src={item.photo_urls[0]}
                        alt="Item"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Image className="w-6 h-6 text-gray-400" />
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-gray-900 text-sm">{item.item_code}</span>
                      <Badge className={`text-xs ${statusInfo.color}`}>{statusInfo.label}</Badge>
                      {item.visual_duplicate_flag && (
                        <Badge className="text-xs bg-red-100 text-red-700">
                          Similar to {item.visual_duplicate_item}
                        </Badge>
                      )}
                      {item.image_hash_duplicate && (
                        <Badge className="text-xs bg-purple-100 text-purple-700">Duplicate photo</Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-600">
                      {item.category?.replace(/_/g, " ")} • {item.weight_kg}kg •{" "}
                      <span className="font-medium">R{(item.weight_kg * 1.5).toFixed(2)} held</span>
                    </p>
                    <p className="text-xs text-gray-500 truncate">{item.collector_email}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(item.created_date).toLocaleString("en-ZA")}
                    </p>

                    {/* Expand toggle */}
                    <button
                      className="text-xs text-blue-600 hover:underline mt-1"
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    >
                      {isExpanded ? "▲ Less" : "▼ More details"}
                    </button>
                  </div>

                  {/* Quick actions */}
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white h-8 px-3"
                      onClick={() => approveMutation.mutate({ id: item.id, note })}
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                    >
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-300 text-red-600 hover:bg-red-50 h-8 px-3"
                      onClick={() => rejectMutation.mutate({ id: item.id, note })}
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                    >
                      <XCircle className="w-3 h-3 mr-1" />
                      Reject
                    </Button>
                  </div>
                </div>

                {/* Expanded view */}
                {isExpanded && (
                  <div className="mt-3 space-y-3 pl-19">
                    {/* Photos grid */}
                    {item.photo_urls?.length > 0 && (
                      <div className="grid grid-cols-3 gap-2">
                        {item.photo_urls.map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noreferrer">
                            <img
                              src={url}
                              alt={`Photo ${i + 1}`}
                              className="w-full h-24 object-cover rounded-lg border border-gray-200 hover:opacity-80 transition-opacity"
                            />
                          </a>
                        ))}
                      </div>
                    )}

                    {/* Serial number photo */}
                    {item.serial_number_photo_url && (
                      <div>
                        <p className="text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                          <Eye className="w-3 h-3" /> Serial / PSN photo
                        </p>
                        <a href={item.serial_number_photo_url} target="_blank" rel="noreferrer">
                          <img
                            src={item.serial_number_photo_url}
                            alt="Serial number"
                            className="h-24 rounded-lg border border-gray-200 hover:opacity-80 transition-opacity"
                          />
                        </a>
                      </div>
                    )}

                    {/* Visual fingerprint */}
                    {item.visual_fingerprint && (
                      <Alert className="bg-blue-50 border-blue-200">
                        <AlertDescription className="text-xs text-blue-800">
                          <span className="font-semibold">AI Visual Description:</span>{" "}
                          {item.visual_fingerprint}
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Fraud flags */}
                    {item.fraud_flags?.length > 0 && (
                      <Alert variant="destructive" className="py-2">
                        <AlertTriangle className="w-3 h-3" />
                        <AlertDescription className="text-xs">
                          {item.fraud_flags.map((f, i) => <div key={i}>• {f}</div>)}
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Location */}
                    {item.location && (
                      <p className="text-xs text-gray-500">📍 {item.location}</p>
                    )}

                    {/* Admin note */}
                    <div>
                      <p className="text-xs font-medium text-gray-600 mb-1">Admin note (optional)</p>
                      <Textarea
                        value={note}
                        onChange={e => setAdminNote(prev => ({ ...prev, [item.id]: e.target.value }))}
                        placeholder="Reason for approval / rejection..."
                        rows={2}
                        className="text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
