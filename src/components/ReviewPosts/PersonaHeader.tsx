
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Database } from "@/integrations/supabase/types";

type Persona = Database['public']['Tables']['personas']['Row'];

interface PersonaHeaderProps {
  persona: Persona;
  totalPosts: number;
  postsNeedingImageGeneration: number;
  postsNeedingReview: number;
}

export const PersonaHeader = ({ 
  persona, 
  totalPosts, 
  postsNeedingImageGeneration, 
  postsNeedingReview 
}: PersonaHeaderProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={persona.avatar_url || ""} />
            <AvatarFallback>{persona.name[0]}</AvatarFallback>
          </Avatar>
          {persona.name}
        </CardTitle>
        <CardDescription>
          生成された投稿: {totalPosts}件
          {postsNeedingImageGeneration > 0 && (
            <span className="block text-orange-600 mt-1">
              画像生成が必要な投稿: {postsNeedingImageGeneration}件
            </span>
          )}
          {postsNeedingReview > 0 && (
            <span className="block text-blue-600 mt-1">
              画像レビューが必要な投稿: {postsNeedingReview}件
            </span>
          )}
        </CardDescription>
      </CardHeader>
    </Card>
  );
};
