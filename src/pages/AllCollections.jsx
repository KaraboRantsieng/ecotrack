import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Package, 
  CheckCircle, 
  Clock,
  Search,
  Eye,
  X,
  DollarSign
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const PAYMENT_RATE_PER_KG = 1.50;

export default function AllCollections() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [editingWeight, setEditingWeight] = useState(false);
  const [newWeight, setNewWeight] = useState('');

  const { data: allItems = [], isLoading } = useQuery({
    queryKey: ['allItems'],
    queryFn: () => base44.entities.EWasteItem.list('-created_date'),
  });

  const verifyMutation = useMutation({
    mutationFn: (id) => base44.entities.EWasteItem.update(id, { verified: true }),
    onSuccess: () => {
      queryClient.invalidateQueries(['allItems']);
      setSelectedItem(null);
    }
  });

  const denyMutation = useMutation({
    mutationFn: (id) => base44.entities.EWasteItem.update(id, { rejected: true, verified: false }),
    onSuccess: () => {
      queryClient.invalidateQueries(['allItems']);
      setSelectedItem(null);
    }
  });

  const updateWeightMutation = useMutation({
    mutationFn: async ({ id, weight_kg, category }) => {
      // Recalculate environmental impact with new weight
      const ENVIRONMENTAL_IMPACT = {
        mobile_phones: { co2_per_kg: 3.5, hazardous_per_kg: 0.2 },
        computers_laptops: { co2_per_kg: 14, hazardous_per_kg: 1.0 },
        televisions: { co2_per_kg: 10, hazardous_per_kg: 0.5 },
        batteries: { co2_per_kg: 5, hazardous_per_kg: 1.0 },
        chargers: { co2_per_kg: 1, hazardous_per_kg: 0.05 },
        cables: { co2_per_kg: 1, hazardous_per_kg: 0.05 },
        keyboards: { co2_per_kg: 3.5, hazardous_per_kg: 0.2 },
        screens: { co2_per_kg: 8, hazardous_per_kg: 0.4 },
        printers: { co2_per_kg: 6, hazardous_per_kg: 0.3 },
        routers: { co2_per_kg: 3.5, hazardous_per_kg: 0.2 },
        hard_drives: { co2_per_kg: 3.5, hazardous_per_kg: 0.2 },
        speakers: { co2_per_kg: 3.5, hazardous_per_kg: 0.2 },
        circuit_boards: { co2_per_kg: 3.5, hazardous_per_kg: 0.2 },
        power_supplies: { co2_per_kg: 3.5, hazardous_per_kg: 0.2 },
        laptop_ram: { co2_per_kg: 3.5, hazardous_per_kg: 0.2 },
        other: { co2_per_kg: 3.5, hazardous_per_kg: 0.2 }
      };
      
      const impact = ENVIRONMENTAL_IMPACT[category] || ENVIRONMENTAL_IMPACT.other;
      
      return await base44.entities.EWasteItem.update(id, { 
        weight_kg,
        co2_saved_kg: weight_kg * impact.co2_per_kg,
        hazardous_waste_kg: weight_kg * impact.hazardous_per_kg
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['allItems']);
    }
  });

  const filteredItems = allItems.filter(item =>
    item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.collector_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.location || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pendingItems = filteredItems.filter(item => !item.verified);
  const verifiedItems = filteredItems.filter(item => item.verified);

  // Calculate total payouts
  const totalPayout = allItems.reduce((sum, item) => 
    sum + ((item.weight_kg || 0) * PAYMENT_RATE_PER_KG), 0
  );

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">All Collections</h1>
            <p className="text-gray-600">Manage and verify e-waste collections</p>
          </div>
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search collections..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid md:grid-cols-4 gap-4">
          <Card className="border-none shadow-lg">
            <CardContent className="p-6">
              <Package className="w-8 h-8 text-blue-600 mb-2" />
              <p className="text-3xl font-bold text-gray-900">{allItems.length}</p>
              <p className="text-sm text-gray-600">Total Collections</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg bg-amber-50">
            <CardContent className="p-6">
              <Clock className="w-8 h-8 text-amber-600 mb-2" />
              <p className="text-3xl font-bold text-gray-900">{pendingItems.length}</p>
              <p className="text-sm text-gray-600">Pending Verification</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg bg-green-50">
            <CardContent className="p-6">
              <CheckCircle className="w-8 h-8 text-green-600 mb-2" />
              <p className="text-3xl font-bold text-gray-900">{verifiedItems.length}</p>
              <p className="text-sm text-gray-600">Verified</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg bg-emerald-50">
            <CardContent className="p-6">
              <DollarSign className="w-8 h-8 text-emerald-600 mb-2" />
              <p className="text-3xl font-bold text-gray-900">ZAR {totalPayout.toFixed(2)}</p>
              <p className="text-sm text-gray-600">Total Payouts</p>
            </CardContent>
          </Card>
        </div>

        {/* Collections List */}
        <Card className="border-none shadow-xl">
          <CardHeader>
            <CardTitle>All Items</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No collections found</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      {item.photo_urls && item.photo_urls.length > 0 && (
                        <img
                          src={item.photo_urls[0]}
                          alt="Item"
                          className="w-16 h-16 object-cover rounded-lg"
                        />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-gray-900">
                            {item.category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </p>
                          {item.verified ? (
                            <Badge className="bg-green-100 text-green-700">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Verified
                            </Badge>
                          ) : item.rejected ? (
                            <Badge className="bg-red-100 text-red-700">
                              <X className="w-3 h-3 mr-1" />
                              Rejected
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-100 text-amber-700">
                              <Clock className="w-3 h-3 mr-1" />
                              Pending
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">
                          {item.collector_email} • {item.quantity} item{item.quantity !== 1 ? 's' : ''} • {item.weight_kg || 0}kg
                        </p>
                        <p className="text-xs text-gray-400">
                          {new Date(item.created_date).toLocaleString()} 
                          {item.location && ` • ${item.location}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right mr-3">
                        <p className="font-bold text-green-600">R{((item.weight_kg || 0) * PAYMENT_RATE_PER_KG).toFixed(2)}</p>
                        <p className="text-xs text-gray-500">Payout</p>
                      </div>
                      <div className="text-right mr-3">
                        <p className="font-bold text-emerald-600">{(item.co2_saved_kg || 0).toFixed(1)}kg</p>
                        <p className="text-xs text-gray-500">CO₂ saved</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedItem(item)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Item Details Dialog */}
        <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Collection Details</DialogTitle>
            </DialogHeader>
            {selectedItem && (
              <div className="space-y-4">
                {selectedItem.photo_urls && selectedItem.photo_urls.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {selectedItem.photo_urls.slice(0, 6).map((photo, idx) => (
                      <img
                        key={idx}
                        src={photo}
                        alt={`Item photo ${idx + 1}`}
                        className="w-full h-32 object-cover rounded-lg"
                      />
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Category</p>
                    <p className="font-semibold">
                      {selectedItem.category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Collector</p>
                    <p className="font-semibold">{selectedItem.collector_email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Quantity</p>
                    <p className="font-semibold">{selectedItem.quantity} items</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Weight</p>
                    {editingWeight ? (
                      <div className="flex gap-2 items-center">
                        <Input
                          type="number"
                          step="0.01"
                          value={newWeight}
                          onChange={(e) => setNewWeight(e.target.value)}
                          className="w-24"
                          autoFocus
                        />
                        <Button
                          size="sm"
                          onClick={() => {
                            updateWeightMutation.mutate({
                              id: selectedItem.id,
                              weight_kg: parseFloat(newWeight),
                              category: selectedItem.category
                            });
                            setEditingWeight(false);
                          }}
                          disabled={!newWeight || updateWeightMutation.isPending}
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingWeight(false);
                            setNewWeight('');
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-2 items-center">
                        <p className="font-semibold">{selectedItem.weight_kg || 0} kg</p>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingWeight(true);
                            setNewWeight(selectedItem.weight_kg?.toString() || '0');
                          }}
                        >
                          Edit
                        </Button>
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Condition</p>
                    <p className="font-semibold capitalize">{selectedItem.condition?.replace(/_/g, ' ')}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">CO₂ Saved</p>
                    <p className="font-semibold text-emerald-600">{(selectedItem.co2_saved_kg || 0).toFixed(1)}kg</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Payout Amount</p>
                    <p className="font-semibold text-green-600">R{((selectedItem.weight_kg || 0) * PAYMENT_RATE_PER_KG).toFixed(2)}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm text-gray-500 mb-1">Serial / PSN Verification</p>
                    {selectedItem.has_psn_photo ? (
                      <div className="flex items-start gap-3">
                        {selectedItem.serial_number_photo_url && (
                          <a href={selectedItem.serial_number_photo_url} target="_blank" rel="noopener noreferrer">
                            <img src={selectedItem.serial_number_photo_url} alt="PSN badge" className="w-20 h-16 object-cover rounded border" />
                          </a>
                        )}
                        <div>
                          {selectedItem.psn_verified ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-semibold">
                              ✓ Unique Serial Verified
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-800 rounded text-xs font-semibold">
                              ⚠ Serial not extracted — manual check needed
                            </span>
                          )}
                          {selectedItem.serial_number && (
                            <p className="font-mono text-sm font-bold mt-1">{selectedItem.serial_number}</p>
                          )}
                          {selectedItem.psn_identifier_type && (
                            <p className="text-xs text-gray-400">{selectedItem.psn_identifier_type}</p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-semibold">
                        ✗ No PSN/Serial photo provided
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Location</p>
                    <p className="font-semibold">{selectedItem.location || 'Not specified'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Date</p>
                    <p className="font-semibold">
                      {new Date(selectedItem.created_date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                {selectedItem.notes && (
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Notes</p>
                    <p className="text-gray-900 bg-gray-50 p-3 rounded-lg">{selectedItem.notes}</p>
                  </div>
                )}
                <div className="flex justify-end gap-3 pt-4 border-t">
                  {!selectedItem.verified && !selectedItem.rejected && (
                    <>
                      <Button
                        onClick={() => verifyMutation.mutate(selectedItem.id)}
                        disabled={verifyMutation.isPending || denyMutation.isPending}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        {verifyMutation.isPending ? 'Verifying...' : 'Verify Item'}
                      </Button>
                      <Button
                        onClick={() => denyMutation.mutate(selectedItem.id)}
                        disabled={verifyMutation.isPending || denyMutation.isPending}
                        variant="destructive"
                      >
                        <X className="w-4 h-4 mr-2" />
                        {denyMutation.isPending ? 'Denying...' : 'Deny Item'}
                      </Button>
                    </>
                  )}
                  <Button variant="outline" onClick={() => {
                    setSelectedItem(null);
                    setEditingWeight(false);
                    setNewWeight('');
                  }}>
                    Close
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}