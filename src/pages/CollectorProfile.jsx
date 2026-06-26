import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

import { User, Phone, MapPin, Package, TrendingUp, Save, CheckCircle, Clock, X, Camera, Loader2, Edit } from "lucide-react";
import { motion } from "framer-motion";
import ItemPhotosManager from "@/components/items/ItemPhotosManager";
import EditItemDialog from "@/components/items/EditItemDialog";

export default function CollectorProfile() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [editing, setEditing] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [formData, setFormData] = useState({
    phone: '',
    area: '',
    profile_picture: ''
  });

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const currentUser = await base44.auth.me();
    setUser(currentUser);
    setFormData({
      phone: currentUser.phone || '',
      area: currentUser.area || '',
      profile_picture: currentUser.profile_picture || ''
    });
  };

  const { data: myCollections = [] } = useQuery({
    queryKey: ['myCollections', user?.email],
    queryFn: () => base44.entities.EWasteItem.filter({ collector_email: user?.email }, '-created_date'),
    enabled: !!user?.email,
  });

  const updateProfileMutation = useMutation({
    mutationFn: (data) => base44.auth.updateMe(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['user']);
      loadUser();
      setEditing(false);
    }
  });

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

  const handleSubmit = (e) => {
    e.preventDefault();
    updateProfileMutation.mutate(formData);
  };

  const categoryBreakdown = myCollections.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + item.quantity;
    return acc;
  }, {});

  const mostCollected = Object.entries(categoryBreakdown)
    .sort(([,a], [,b]) => b - a)[0];

  const totalWeight = myCollections.reduce((sum, item) => sum + (item.weight_kg || 0), 0);
  const totalCO2 = myCollections.reduce((sum, item) => sum + (item.co2_saved_kg || 0), 0);

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">My Profile</h1>
          <p className="text-gray-600">Manage your account and track your collections</p>
        </div>

        {/* Profile Header with Photo */}
        <Card className="border-none shadow-xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-6">
              <div className="relative">
                {formData.profile_picture || user?.profile_picture ? (
                  <img
                    src={formData.profile_picture || user?.profile_picture}
                    alt={user?.full_name}
                    className="w-24 h-24 rounded-full object-cover border-4 border-emerald-200"
                  />
                ) : (
                  <div className="w-24 h-24 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center border-4 border-emerald-200">
                    <span className="text-white font-bold text-3xl">
                      {user?.full_name?.[0]?.toUpperCase() || 'U'}
                    </span>
                  </div>
                )}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{user?.full_name || 'Collector'}</h2>
                <p className="text-gray-500">{user?.email}</p>
                {user?.area && (
                  <Badge className="mt-2 bg-emerald-100 text-emerald-700">
                    <MapPin className="w-3 h-3 mr-1" />
                    {user.area}
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Overview */}
        <div className="grid md:grid-cols-4 gap-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="border-none shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50">
              <CardContent className="p-6 text-center">
                <Package className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <p className="text-3xl font-bold text-gray-900">{user?.total_collections || 0}</p>
                <p className="text-sm text-gray-600">Items Collected</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="border-none shadow-lg bg-gradient-to-br from-emerald-50 to-teal-50">
              <CardContent className="p-6 text-center">
                <TrendingUp className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                <p className="text-3xl font-bold text-gray-900">{totalWeight.toFixed(1)}</p>
                <p className="text-sm text-gray-600">Total Weight (kg)</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="border-none shadow-lg bg-gradient-to-br from-green-50 to-emerald-50">
              <CardContent className="p-6 text-center">
                <TrendingUp className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <p className="text-3xl font-bold text-gray-900">{totalCO2.toFixed(1)}</p>
                <p className="text-sm text-gray-600">kg CO₂ Saved</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className="border-none shadow-lg bg-gradient-to-br from-amber-50 to-orange-50">
              <CardContent className="p-6 text-center">
                <Package className="w-8 h-8 text-amber-600 mx-auto mb-2" />
                <p className="text-xl font-bold text-gray-900 truncate">
                  {mostCollected ? mostCollected[0].replace(/_/g, ' ') : 'N/A'}
                </p>
                <p className="text-sm text-gray-600">Most Collected</p>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Profile Information */}
        <Card className="border-none shadow-xl">
          <CardHeader className="bg-gradient-to-r from-emerald-50 to-teal-50">
            <div className="flex justify-between items-center">
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-emerald-600" />
                Profile Information
              </CardTitle>
              {!editing && (
                <Button onClick={() => setEditing(true)} variant="outline">
                  Edit Profile
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {editing ? (
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Profile Picture Upload */}
                <div>
                  <Label>Profile Picture</Label>
                  <div className="mt-2 flex items-center gap-4">
                    {formData.profile_picture ? (
                      <img
                        src={formData.profile_picture}
                        alt="Profile"
                        className="w-20 h-20 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center">
                        <Camera className="w-8 h-8 text-gray-400" />
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

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      value={user?.full_name || ''}
                      disabled
                      className="mt-2 bg-gray-50"
                    />
                    <p className="text-xs text-gray-500 mt-1">Contact admin to change name</p>
                  </div>

                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      value={user?.email || ''}
                      disabled
                      className="mt-2 bg-gray-50"
                    />
                  </div>

                  <div>
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      placeholder="+27..."
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label htmlFor="area">Area</Label>
                    <Input
                      id="area"
                      value={formData.area}
                      onChange={(e) => setFormData({...formData, area: e.target.value})}
                      placeholder="e.g., Soweto"
                      className="mt-2"
                    />
                  </div>
                </div>

                <div className="flex gap-3 justify-end">
                  <Button type="button" variant="outline" onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="bg-emerald-600 hover:bg-emerald-700"
                    disabled={updateProfileMutation.isPending}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {updateProfileMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="grid md:grid-cols-2 gap-6">
                <div className="flex items-start gap-3">
                  <User className="w-5 h-5 text-gray-400 mt-1" />
                  <div>
                    <p className="text-sm text-gray-500">Full Name</p>
                    <p className="font-medium text-gray-900">{user?.full_name || 'Not set'}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-gray-400 mt-1" />
                  <div>
                    <p className="text-sm text-gray-500">Phone Number</p>
                    <p className="font-medium text-gray-900">{user?.phone || 'Not set'}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-gray-400 mt-1" />
                  <div>
                    <p className="text-sm text-gray-500">Area</p>
                    <p className="font-medium text-gray-900">{user?.area || 'Not set'}</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Full Collection History */}
        <Card className="border-none shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Collection History</span>
              <Badge variant="outline">{myCollections.length} total items</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {myCollections.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No collections yet</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {myCollections.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-start gap-4 flex-1">
                      {item.photo_urls && item.photo_urls.length > 0 ? (
                        <div className="w-20 flex-shrink-0">
                          <ItemPhotosManager item={item} canEdit={true} />
                        </div>
                      ) : null}
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-1">
                          <p className="font-medium text-gray-900">
                            {item.item_name || item.category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </p>
                          <EditItemDialog 
                            item={item}
                            trigger={
                              <Button variant="ghost" size="sm" className="h-6 px-2">
                                <Edit className="w-3 h-3" />
                              </Button>
                            }
                          />
                        </div>
                        {item.item_specs && (
                          <p className="text-xs text-gray-500">{item.item_specs}</p>
                        )}
                        {item.location && (
                          <p className="text-xs text-gray-600 flex items-center gap-1 mt-1">
                            <MapPin className="w-3 h-3" />
                            {item.location}
                          </p>
                        )}
                        {item.items_in_bag && item.items_in_bag.length > 0 && (
                          <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200">
                            <p className="text-xs font-semibold text-blue-900 mb-1">Items in bag:</p>
                            <ul className="text-xs text-blue-800 space-y-0.5">
                              {item.items_in_bag.slice(0, 3).map((bagItem, idx) => (
                                <li key={idx}>• {bagItem}</li>
                              ))}
                              {item.items_in_bag.length > 3 && (
                                <li className="text-blue-600 font-medium">+ {item.items_in_bag.length - 3} more</li>
                              )}
                            </ul>
                          </div>
                        )}
                        <p className="text-sm text-gray-500 mt-1">
                          {new Date(item.created_date).toLocaleDateString()} • {item.quantity} item{item.quantity !== 1 ? 's' : ''} • {item.weight_kg || 0}kg
                        </p>
                      </div>
                      </div>
                      <div className="flex items-start gap-3">
                      <div className="text-right">
                        <p className="font-bold text-emerald-600">{(item.co2_saved_kg || 0).toFixed(1)}kg CO₂</p>
                        <p className="text-xs text-gray-500">
                          {item.verified ? (
                            <span className="text-green-600 flex items-center gap-1 justify-end">
                              <CheckCircle className="w-3 h-3" /> Verified
                            </span>
                          ) : item.rejected ? (
                            <span className="text-red-600 flex items-center gap-1 justify-end">
                              <X className="w-3 h-3" /> Rejected
                            </span>
                          ) : (
                            <span className="text-amber-600 flex items-center gap-1 justify-end">
                              <Clock className="w-3 h-3" /> Pending
                            </span>
                          )}
                        </p>
                      </div>
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