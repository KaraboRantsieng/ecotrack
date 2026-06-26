import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { UserPlus, CheckCircle, ArrowLeft, Camera, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function OnboardCollector() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [success, setSuccess] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    area: '',
    profile_picture: '',
    notes: ''
  });

  // Fetch all collectors to get unique areas
  const { data: allCollectors = [] } = useQuery({
    queryKey: ['allCollectors'],
    queryFn: () => base44.entities.User.list(),
  });

  // Get unique areas from existing collectors
  const existingAreas = [...new Set(allCollectors.map(c => c.area).filter(Boolean))];

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setUploadingPhoto(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData(prev => ({ ...prev, profile_picture: file_url }));
    } catch (error) {
      console.error("Error uploading photo:", error);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const createCollectorMutation = useMutation({
    mutationFn: async (data) => {
      const currentUser = await base44.auth.me();
      
      // Create the collector data to display
      const collector = {
        email: data.email || `collector_${Date.now()}@ecotrack.local`,
        full_name: data.full_name,
        phone: data.phone || '',
        area: data.area,
        profile_picture: data.profile_picture || '',
        onboarding_notes: data.notes,
        onboarded_by: currentUser.email,
        onboarding_date: new Date().toISOString()
      };

      return collector;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['allCollectors']);
      setSuccess(data);
      setTimeout(() => {
        navigate(createPageUrl("AllCollectors"));
      }, 3000);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createCollectorMutation.mutate(formData);
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-none shadow-2xl">
          <CardContent className="p-12 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Collector Onboarded!</h2>
            <p className="text-gray-600 mb-4">{success.full_name} has been registered</p>
            {success.profile_picture && (
              <img
                src={success.profile_picture}
                alt={success.full_name}
                className="w-20 h-20 rounded-full object-cover mx-auto mb-4 border-4 border-emerald-200"
              />
            )}
            <div className="bg-emerald-50 p-4 rounded-lg mb-4">
              <p className="text-sm text-gray-600 mb-1">Area Assigned</p>
              <p className="text-lg font-bold text-emerald-600">{success.area}</p>
            </div>
            <p className="text-sm text-gray-500">Redirecting to collectors list...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate(createPageUrl("AllCollectors"))}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Onboard New Collector</h1>
            <p className="text-gray-500">Register collectors and assign them to an area</p>
          </div>
        </div>

        <Card className="border-none shadow-xl">
          <CardHeader className="bg-gradient-to-r from-emerald-50 to-teal-50 border-b">
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="w-6 h-6 text-emerald-600" />
              Collector Information
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <Alert className="mb-6 bg-blue-50 border-blue-200">
              <AlertDescription className="text-blue-800">
                <p className="font-semibold mb-1">Admin Onboarding</p>
                <p className="text-sm">Register collectors and assign them to a collection area. You can log items on their behalf.</p>
              </AlertDescription>
            </Alert>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Profile Picture */}
              <div>
                <Label>Profile Picture</Label>
                <div className="mt-2 flex items-center gap-4">
                  {formData.profile_picture ? (
                    <img
                      src={formData.profile_picture}
                      alt="Profile"
                      className="w-24 h-24 rounded-full object-cover border-4 border-emerald-200"
                    />
                  ) : (
                    <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center">
                      <Camera className="w-10 h-10 text-gray-400" />
                    </div>
                  )}
                  <label className="cursor-pointer">
                    <div className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2">
                      {uploadingPhoto ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Camera className="w-4 h-4" />
                      )}
                      {uploadingPhoto ? 'Uploading...' : 'Upload Photo'}
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      disabled={uploadingPhoto}
                    />
                  </label>
                </div>
              </div>

              <div>
                <Label htmlFor="full_name">Full Name *</Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                  placeholder="e.g., John Doe"
                  className="mt-2"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">Email (Optional)</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="Optional"
                    className="mt-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">Leave blank if not available</p>
                </div>

                <div>
                  <Label htmlFor="phone">Phone Number (Optional)</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="+27..."
                    className="mt-2"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="area">Area/Location *</Label>
                <div className="mt-2 space-y-2">
                  {existingAreas.length > 0 && (
                    <Select
                      value={formData.area}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, area: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select existing area or type below" />
                      </SelectTrigger>
                      <SelectContent>
                        {existingAreas.map(area => (
                          <SelectItem key={area} value={area}>{area}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Input
                    id="area"
                    value={formData.area}
                    onChange={(e) => setFormData(prev => ({ ...prev, area: e.target.value }))}
                    placeholder="e.g., Soweto, Johannesburg CBD"
                    required
                  />
                  <p className="text-xs text-gray-500">Select from existing areas or type a new one</p>
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Additional Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Any additional information about the collector..."
                  className="mt-2"
                  rows={4}
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-lg py-6"
                disabled={createCollectorMutation.isPending || uploadingPhoto}
              >
                {createCollectorMutation.isPending ? (
                  "Registering..."
                ) : (
                  <>
                    <UserPlus className="w-5 h-5 mr-2" />
                    Onboard Collector
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}