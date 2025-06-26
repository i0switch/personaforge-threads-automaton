
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Database } from "@/integrations/supabase/types";

type Persona = Database['public']['Tables']['personas']['Row'];

interface PersonaInfoCardProps {
  persona: Persona;
  postCount: number;
}

export const PersonaInfoCard = ({ persona, postCount }: PersonaInfoCardProps) => {
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
          生成された投稿: {postCount}件
        </CardDescription>
      </CardHeader>
    </Card>
  );
};
