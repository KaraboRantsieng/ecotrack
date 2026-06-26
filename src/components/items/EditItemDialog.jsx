import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Edit, Plus, X, Save, MapPin, Package, Camera } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import ItemPhotosManager from "@/components/items/ItemPhotosManager";

export default function EditItemDialog({ item, trigger }) {
  const [open, setOpen] = useState(false);
  const [location, setLocation] = useState(item.location || '');
  const [itemsInBag, setItemsInBag] = useState(item.items_in_bag || []);
  const [newItemName, setNewItemName] = useState('');
  const queryClient = useQueryClient();

  const updateItemMutation = useMutation({
    mutationFn: async (data) => {
      return await base44.entities.EWasteItem.update(item.id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['myCollections']);
      queryClient.invalidateQueries(['allItems']);
      setOpen(false);
    }
  });

  const handleAddItem = () => {
    if (newItemName.trim()) {
      setItemsInBag([...itemsInBag, newItemName.trim()]);
      setNewItemName('');
    }
  };

  const handleRemoveItem = (index) => {
    setItemsInBag(itemsInBag.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    updateItemMutation.mutate({
      location,
      items_in_bag: itemsInBag
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm">
            <Edit className="w-4 h-4 mr-1" />
            Edit Details
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Item Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Photos */}
          <div>
            <Label className="flex items-center gap-2 mb-2">
              <Camera className="w-4 h-4" />
              Item Photos
            </Label>
            <ItemPhotosManager item={item} canEdit={true} />
          </div>

          {/* Location */}
          <div>
            <Label htmlFor="location" className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Collection Location
            </Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g., Johannesburg CBD"
              className="mt-2"
            />
          </div>

          {/* Items in Bag */}
          <div>
            <Label className="flex items-center gap-2 mb-2">
              <Package className="w-4 h-4" />
              Individual Items in Collection
            </Label>
            <p className="text-xs text-gray-500 mb-3">
              Add names of individual items when multiple items are bagged together
            </p>

            {/* List of items */}
            {itemsInBag.length > 0 && (
              <div className="space-y-2 mb-3">
                {itemsInBag.map((itemName, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded border"
                  >
                    <span className="text-sm">{idx + 1}. {itemName}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveItem(idx)}
                      className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <Badge variant="outline" className="mt-2">
                  {itemsInBag.length} item{itemsInBag.length !== 1 ? 's' : ''} listed
                </Badge>
              </div>
            )}

            {/* Add new item */}
            <div className="flex gap-2">
              <Input
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="e.g., iPhone 12, Samsung Charger"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddItem();
                  }
                }}
              />
              <Button
                type="button"
                onClick={handleAddItem}
                disabled={!newItemName.trim()}
                size="sm"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Save button */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={updateItemMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Save className="w-4 h-4 mr-2" />
              {updateItemMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}