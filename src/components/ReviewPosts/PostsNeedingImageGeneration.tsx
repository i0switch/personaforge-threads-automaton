
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Image as ImageIcon } from "lucide-react";
import { ImageGenerationSection } from "./ImageGenerationSection";
import type { Database } from "@/integrations/supabase/types";

type Post = Database['public']['Tables']['posts']['Row'];

interface PostsNeedingImageGenerationProps {
  postsNeedingImageGeneration: Post[];
  posts: Post[];
  onImagesGenerated: (postIndex: number, images: string[]) => void;
}

export const PostsNeedingImageGeneration = ({ 
  postsNeedingImageGeneration, 
  posts,
  onImagesGenerated 
}: PostsNeedingImageGenerationProps) => {
  const [showImageGeneration, setShowImageGeneration] = useState(false);

  if (postsNeedingImageGeneration.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-orange-600">画像生成が必要です</CardTitle>
        <CardDescription>
          {postsNeedingImageGeneration.length}件の投稿に画像を生成してください
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          variant="outline"
          onClick={() => setShowImageGeneration(!showImageGeneration)}
          className="w-full"
        >
          <ImageIcon className="h-4 w-4 mr-2" />
          {showImageGeneration ? '画像生成を閉じる' : '投稿用画像を生成'}
        </Button>
        
        {showImageGeneration && (
          <div className="mt-4">
            <ImageGenerationSection
              onImagesGenerated={(images) => {
                console.log('PostsNeedingImageGeneration: Images generated:', images.length);
                if (postsNeedingImageGeneration.length > 0) {
                  const postIndex = posts.findIndex(p => p.id === postsNeedingImageGeneration[0].id);
                  if (postIndex !== -1) {
                    onImagesGenerated(postIndex, images);
                  }
                }
              }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
};
