'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Box, Search, Filter,
  Layers, HardDrive, Calendar, Tag, Loader2, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { ImageDetailsModal } from '@/components/modals/image-details-modal';

interface ImageInfo {
  id: string;
  repository: string;
  tag: string;
  size: string;
  created: string;
  digest?: string;
}

export function ImagesPage() {
  const { toast } = useToast();
  const [images, setImages] = useState<ImageInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sizeFilter, setSizeFilter] = useState<string>('all');
  
  // Modals
  const [selectedImage, setSelectedImage] = useState<ImageInfo | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  useEffect(() => {
    fetchImages();
  }, []);

  const fetchImages = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch('/api/images', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch images');
      }

      const data = await response.json();
      setImages(data || []);
    } catch (error) {
      console.error('Error fetching images:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch Docker images',
        variant: 'destructive',
      });
      setImages([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchImages();
    setIsRefreshing(false);
    toast({
      title: 'Refreshed',
      description: 'Image list updated successfully',
    });
  };

  const handleViewDetails = (image: ImageInfo) => {
    setSelectedImage(image);
    setIsDetailsOpen(true);
  };

  const filteredImages = images.filter((image) => {
    const matchesSearch = 
      image.repository.toLowerCase().includes(searchQuery.toLowerCase()) ||
      image.tag.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;

    if (sizeFilter === 'all') return true;
    
    const sizeInMB = parseSizeToMB(image.size);
    if (sizeFilter === 'small') return sizeInMB < 100;
    if (sizeFilter === 'medium') return sizeInMB >= 100 && sizeInMB < 500;
    if (sizeFilter === 'large') return sizeInMB >= 500;
    
    return true;
  });

  const parseSizeToMB = (size: string): number => {
    const match = size.match(/(\d+\.?\d*)\s*(MB|GB)/i);
    if (!match) return 0;
    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();
    return unit === 'GB' ? value * 1024 : value;
  };

  const formatDate = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays} days ago`;
      if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
      if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
      return `${Math.floor(diffDays / 365)} years ago`;
    } catch {
      return dateStr;
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Box className="w-6 h-6 text-primary" />
              Docker Images
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Manage and run containers from your Docker images
            </p>
          </div>
          <Button
            onClick={handleRefresh}
            disabled={isRefreshing}
            variant="outline"
            size="sm"
          >
            {isRefreshing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Refresh
          </Button>
        </div>

        {/* Filters */}
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search images by name or tag..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={sizeFilter} onValueChange={setSizeFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Filter by size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sizes</SelectItem>
                  <SelectItem value="small">Small (&lt; 100MB)</SelectItem>
                  <SelectItem value="medium">Medium (100-500MB)</SelectItem>
                  <SelectItem value="large">Large (&gt; 500MB)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Images Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredImages.length === 0 ? (
          <Card className="bg-card/50 border-border/50">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Box className="w-12 h-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                {searchQuery || sizeFilter !== 'all' 
                  ? 'No images match your filters' 
                  : 'No Docker images found'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence mode="popLayout">
              {filteredImages.map((image, index) => (
                <motion.div
                  key={image.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="bg-card/50 border-border/50 hover:border-primary/50 transition-all group">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base font-semibold truncate">
                            {image.repository}
                          </CardTitle>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              <Tag className="w-3 h-3 mr-1" />
                              {image.tag}
                            </Badge>
                          </div>
                        </div>
                        <Layers className="w-5 h-5 text-primary shrink-0" />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <HardDrive className="w-3 h-3" />
                          <span>{image.size}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>{formatDate(image.created)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewDetails(image)}
                            >
                              <Layers className="w-3.5 h-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>View Details</TooltipContent>
                        </Tooltip>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Image Details Modal */}
      {selectedImage && (
        <ImageDetailsModal
          open={isDetailsOpen}
          onOpenChange={setIsDetailsOpen}
          image={selectedImage}
        />
      )}
    </TooltipProvider>
  );
}
