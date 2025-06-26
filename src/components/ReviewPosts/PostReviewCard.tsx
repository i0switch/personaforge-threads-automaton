
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Database } from "@/integrations/supabase/types";

type Post = Database['public']['Tables']['posts']['Row'];

interface PostReviewCardProps {
  post: Post;
  onApprove: (postId: string) => void;
}

export const PostReviewCard = ({ post, onApprove }: PostReviewCardProps) => {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">投稿レビュー</CardTitle>
          <Badge variant="outline" className="bg-blue-50">レビュー待ち</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-3 bg-gray-50 rounded">
          <p className="text-sm font-medium mb-2">投稿内容:</p>
          <p className="whitespace-pre-wrap">{post.content}</p>
        </div>
        
        {post.images && post.images.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">生成された画像:</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {post.images.map((imageUrl, imageIndex) => (
                <div key={imageIndex} className="relative">
                  <img
                    src={imageUrl}
                    alt={`生成画像 ${imageIndex + 1}`}
                    className="w-full max-w-md mx-auto rounded-lg border object-cover"
                    style={{ maxHeight: '300px' }}
                    onError={(e) => {
                      console.error('PostReviewCard: Failed to load image:', imageUrl);
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                </div>
              ))}
            </div>
            <Button 
              onClick={() => onApprove(post.id)}
              className="w-full"
            >
              この画像を承認する
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
