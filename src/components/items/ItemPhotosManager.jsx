import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Camera, X, Loader2, Plus, Image as ImageIcon } from "lucide-react";

export default function ItemPhotosManager({ item, canEdit = true }) {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const queryClient = useQueryClient();

  const photos = item.photo_urls || [];

  const addPhotosMutation = useMutation({
    mutationFn: async (newPhotoUrls) => {
      const updatedPhotos = [...(item.photo_urls || []), ...newPhotoUrls];
      return await base44.entities.EWasteItem.update(item.id, {
        photo_urls: updatedPhotos
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['myCollections']);
      queryClient.invalidateQueries(['allItems']);
    }
  });

  const removePhotoMutation = useMutation({
    mutationFn: async (photoIndex) => {
      const updatedPhotos = item.photo_urls.filter((_, idx) => idx !== photoIndex);
      return await base44.entities.EWasteItem.update(item.id, {
        photo_urls: updatedPhotos
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['myCollections']);
      queryClient.invalidateQueries(['allItems']);
    }
  });

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const oversized = files.filter(f => f.size > 5 * 1024 * 1024);
    if (oversized.length > 0) {
      alert("Some files are too large. Max 5MB each.");
      return;
    }

    setUploading(true);
    try {
      const uploadPromises = files.map(file => 
        base44.integrations.Core.UploadFile({ file })
      );
      const results = await Promise.all(uploadPromises);
      const fileUrls = results.map(r => r.file_url);
      
      await addPhotosMutation.mutateAsync(fileUrls);
    } catch (error) {
      console.error("Error uploading photos:", error);
      alert("Failed to upload photos. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleRemovePhoto = async (index) => {
    if (confirm("Remove this photo?")) {
      await removePhotoMutation.mutateAsync(index);
      if (selectedIndex >= photos.length - 1) {
        setSelectedIndex(Math.max(0, photos.length - 2));
      }
    }
  };

  if (photos.length === 0 && !canEdit) {
    return (
      <div className="flex items-center justify-center h-48 bg-gray-100 rounded-lg">
        <div className="text-center text-gray-500">
          <ImageIcon className="w-12 h-12 mx-auto mb-2 text-gray-400" />
          <p className="text-sm">No photos</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {photos.slice(0, 2).map((photo, idx) => (
          <div key={idx} className="relative group cursor-pointer" onClick={() => {
            setSelectedIndex(idx);
            setOpen(true);
          }}>
            <img
              src={photo}
              alt={`Item photo ${idx + 1}`}
              className="w-full h-24 object-cover rounded-lg hover:opacity-90 transition-opacity"
            />
          </div>
        ))}
        
        {photos.length > 2 ? (
          <div className="relative group cursor-pointer" onClick={() => {
            setSelectedIndex(2);
            setOpen(true);
          }}>
            <img
              src={photos[2]}
              alt="More photos"
              className="w-full h-24 object-cover rounded-lg"
            />
            <div className="absolute inset-0 bg-black/60 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">+{photos.length - 2}</span>
            </div>
          </div>
        ) : canEdit && (
          <label className="flex flex-col items-center justify-center h-24 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
            {uploading ? (
              <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
            ) : (
              <>
                <Plus className="w-6 h-6 text-gray-400 mb-1" />
                <span className="text-xs text-gray-500">Add photo</span>
              </>
            )}
            <input
              type="file"
              className="hidden"
              accept="image/*"
              onChange={handlePhotoUpload}
              disabled={uploading}
              multiple
            />
          </label>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Item Photos ({photos.length})</DialogTitle>
          </DialogHeader>
          
          {photos.length > 0 && (
            <div className="space-y-4">
              <div className="relative">
                <img
                  src={photos[selectedIndex]}
                  alt={`Item photo ${selectedIndex + 1}`}
                  className="w-full h-96 object-contain bg-gray-100 rounded-lg"
                />
                {canEdit && (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={() => handleRemovePhoto(selectedIndex)}
                    disabled={removePhotoMutation.isPending}
                  >
                    <X className="w-4 h-4 mr-1" />
                    Remove
                  </Button>
                )}
              </div>

              <div className="flex gap-2 overflow-x-auto pb-2">
                {photos.map((photo, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedIndex(idx)}
                    className={`flex-shrink-0 w-20 h-20 rounded border-2 transition-all ${
                      selectedIndex === idx ? 'border-emerald-600' : 'border-gray-200'
                    }`}
                  >
                    <img
                      src={photo}
                      alt={`Thumbnail ${idx + 1}`}
                      className="w-full h-full object-cover rounded"
                    />
                  </button>
                ))}
                
                {canEdit && (
                  <label className="flex-shrink-0 w-20 h-20 rounded border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:bg-gray-50">
                    {uploading ? (
                      <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                    ) : (
                      <Plus className="w-6 h-6 text-gray-400" />
                    )}
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      disabled={uploading}
                      multiple
                    />
                  </label>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}