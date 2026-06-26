import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  QrCode, 
  Plus,
  Download,
  Trash2,
  Eye,
  EyeOff
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function QRCodeGenerator() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [selectedQR, setSelectedQR] = useState(null);
  const [formData, setFormData] = useState({
    type: 'item_preset',
    category: '',
    estimated_weight_kg: '',
    location: '',
    description: ''
  });

  const { data: qrCodes = [], isLoading } = useQuery({
    queryKey: ['qrCodes'],
    queryFn: () => base44.entities.QRCode.list('-created_date'),
  });

  const createQRMutation = useMutation({
    mutationFn: async (data) => {
      const code = `EW-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      return await base44.entities.QRCode.create({
        ...data,
        code,
        scan_count: 0,
        is_active: true
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['qrCodes']);
      setShowForm(false);
      resetForm();
    }
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, is_active }) => base44.entities.QRCode.update(id, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries(['qrCodes']);
    }
  });

  const deleteQRMutation = useMutation({
    mutationFn: (id) => base44.entities.QRCode.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['qrCodes']);
      setSelectedQR(null);
    }
  });

  const resetForm = () => {
    setFormData({
      type: 'item_preset',
      category: '',
      estimated_weight_kg: '',
      location: '',
      description: ''
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    createQRMutation.mutate(formData);
  };

  const downloadQRCode = (qr) => {
    // Generate QR code as SVG/image and download
    const qrData = {
      code: qr.code,
      type: qr.type,
      category: qr.category,
      estimated_weight_kg: qr.estimated_weight_kg,
      location: qr.location,
      description: qr.description
    };

    // Create a simple text file with the QR code data
    // In production, you'd use a QR code library to generate actual QR images
    const content = `EcoTrack QR Code
    
Code: ${qr.code}
Type: ${qr.type}
${qr.category ? `Category: ${qr.category}` : ''}
${qr.location ? `Location: ${qr.location}` : ''}
${qr.description ? `Description: ${qr.description}` : ''}

Scan this code with the EcoTrack app to log e-waste items.
    
JSON Data:
${JSON.stringify(qrData, null, 2)}`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `QRCode-${qr.code}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const activeQRCodes = qrCodes.filter(qr => qr.is_active).length;
  const totalScans = qrCodes.reduce((sum, qr) => sum + (qr.scan_count || 0), 0);

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">QR Code Generator</h1>
            <p className="text-gray-600">Create QR codes for e-waste items and collection points</p>
          </div>
          <Button
            onClick={() => setShowForm(true)}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Generate QR Code
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card className="border-none shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50">
            <CardContent className="p-6">
              <QrCode className="w-8 h-8 text-blue-600 mb-2" />
              <p className="text-3xl font-bold text-gray-900">{qrCodes.length}</p>
              <p className="text-sm text-gray-600">Total QR Codes</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg bg-gradient-to-br from-emerald-50 to-teal-50">
            <CardContent className="p-6">
              <Eye className="w-8 h-8 text-emerald-600 mb-2" />
              <p className="text-3xl font-bold text-gray-900">{activeQRCodes}</p>
              <p className="text-sm text-gray-600">Active Codes</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg bg-gradient-to-br from-purple-50 to-pink-50">
            <CardContent className="p-6">
              <QrCode className="w-8 h-8 text-purple-600 mb-2" />
              <p className="text-3xl font-bold text-gray-900">{totalScans}</p>
              <p className="text-sm text-gray-600">Total Scans</p>
            </CardContent>
          </Card>
        </div>

        {/* QR Codes List */}
        <Card className="border-none shadow-xl">
          <CardHeader>
            <CardTitle>Generated QR Codes</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
              </div>
            ) : qrCodes.length === 0 ? (
              <div className="text-center py-12">
                <QrCode className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 mb-2">No QR codes generated yet</p>
                <Button onClick={() => setShowForm(true)} variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Create First QR Code
                </Button>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {qrCodes.map((qr) => (
                  <Card
                    key={qr.id}
                    className={`cursor-pointer transition-all hover:shadow-lg ${
                      qr.is_active ? 'border-emerald-200' : 'border-gray-200 opacity-60'
                    }`}
                    onClick={() => setSelectedQR(qr)}
                  >
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                          <QrCode className="w-8 h-8 text-white" />
                        </div>
                        <Badge className={qr.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>
                          {qr.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      
                      <h3 className="font-bold text-lg mb-2 truncate">{qr.code}</h3>
                      
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Type:</span>
                          <span className="font-medium capitalize">{qr.type.replace(/_/g, ' ')}</span>
                        </div>
                        {qr.category && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Category:</span>
                            <span className="font-medium capitalize">{qr.category.replace(/_/g, ' ')}</span>
                          </div>
                        )}
                        {qr.location && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Location:</span>
                            <span className="font-medium truncate ml-2">{qr.location}</span>
                          </div>
                        )}
                        <div className="flex justify-between pt-2 border-t">
                          <span className="text-gray-500">Scans:</span>
                          <span className="font-bold text-emerald-600">{qr.scan_count || 0}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create QR Code Dialog */}
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Generate New QR Code</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Label htmlFor="type">QR Code Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({...formData, type: value})}
                >
                  <SelectTrigger id="type" className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="item_preset">Item Preset</SelectItem>
                    <SelectItem value="collection_point">Collection Point</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">
                  {formData.type === 'item_preset' 
                    ? 'Pre-set item details for quick logging'
                    : 'Location-based collection point'
                  }
                </p>
              </div>

              {formData.type === 'item_preset' && (
                <div>
                  <Label htmlFor="category">Item Category</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({...formData, category: value})}
                  >
                    <SelectTrigger id="category" className="mt-2">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mobile_phones">Mobile Phones</SelectItem>
                      <SelectItem value="computers_laptops">Computers/Laptops</SelectItem>
                      <SelectItem value="televisions">Televisions</SelectItem>
                      <SelectItem value="refrigerators">Refrigerators</SelectItem>
                      <SelectItem value="air_conditioners">Air Conditioners</SelectItem>
                      <SelectItem value="washing_machines">Washing Machines</SelectItem>
                      <SelectItem value="batteries">Batteries</SelectItem>
                      <SelectItem value="cables_chargers">Cables/Chargers</SelectItem>
                      <SelectItem value="small_appliances">Small Appliances</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label htmlFor="weight">Estimated Weight (kg)</Label>
                <Input
                  id="weight"
                  type="number"
                  step="0.1"
                  value={formData.estimated_weight_kg}
                  onChange={(e) => setFormData({...formData, estimated_weight_kg: e.target.value})}
                  placeholder="Optional"
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => setFormData({...formData, location: e.target.value})}
                  placeholder="Collection point or area"
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="description">Description/Instructions</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="Additional information for collectors..."
                  className="mt-2"
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700"
                  disabled={createQRMutation.isPending}
                >
                  {createQRMutation.isPending ? 'Generating...' : 'Generate QR Code'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* QR Code Details Dialog */}
        <Dialog open={!!selectedQR} onOpenChange={() => setSelectedQR(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>QR Code Details</DialogTitle>
            </DialogHeader>
            {selectedQR && (
              <div className="space-y-6">
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-8 rounded-xl text-center">
                  <div className="w-48 h-48 mx-auto bg-white rounded-xl flex items-center justify-center mb-4 shadow-lg">
                    <QrCode className="w-32 h-32 text-emerald-600" />
                  </div>
                  <p className="text-2xl font-bold text-gray-900 mb-2">{selectedQR.code}</p>
                  <Badge className={selectedQR.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>
                    {selectedQR.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Type</p>
                    <p className="font-semibold capitalize">{selectedQR.type.replace(/_/g, ' ')}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Scans</p>
                    <p className="font-semibold">{selectedQR.scan_count || 0}</p>
                  </div>
                  {selectedQR.category && (
                    <div>
                      <p className="text-sm text-gray-500">Category</p>
                      <p className="font-semibold capitalize">{selectedQR.category.replace(/_/g, ' ')}</p>
                    </div>
                  )}
                  {selectedQR.estimated_weight_kg && (
                    <div>
                      <p className="text-sm text-gray-500">Est. Weight</p>
                      <p className="font-semibold">{selectedQR.estimated_weight_kg} kg</p>
                    </div>
                  )}
                  {selectedQR.location && (
                    <div className="col-span-2">
                      <p className="text-sm text-gray-500">Location</p>
                      <p className="font-semibold">{selectedQR.location}</p>
                    </div>
                  )}
                  {selectedQR.description && (
                    <div className="col-span-2">
                      <p className="text-sm text-gray-500">Description</p>
                      <p className="text-gray-900 bg-gray-50 p-3 rounded-lg">{selectedQR.description}</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-4 border-t">
                  <Button
                    onClick={() => downloadQRCode(selectedQR)}
                    variant="outline"
                    className="flex-1"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                  <Button
                    onClick={() => toggleActiveMutation.mutate({ 
                      id: selectedQR.id, 
                      is_active: !selectedQR.is_active 
                    })}
                    variant="outline"
                    className="flex-1"
                  >
                    {selectedQR.is_active ? (
                      <>
                        <EyeOff className="w-4 h-4 mr-2" />
                        Deactivate
                      </>
                    ) : (
                      <>
                        <Eye className="w-4 h-4 mr-2" />
                        Activate
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() => deleteQRMutation.mutate(selectedQR.id)}
                    variant="destructive"
                    disabled={deleteQRMutation.isPending}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
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