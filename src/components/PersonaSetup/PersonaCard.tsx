
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2 } from "lucide-react";
import type { Persona } from "@/types/persona";
import { getPersonaReplyMode, getReplyModeLabel } from "@/types/persona";

interface PersonaCardProps {
  persona: Persona;
  onEdit: (persona: Persona) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, currentStatus: boolean) => void;
}

export const PersonaCard = ({ persona, onEdit, onDelete, onToggleActive }: PersonaCardProps) => {
  const replyMode = getPersonaReplyMode(persona);
  const replyModeInfo = getReplyModeLabel(replyMode);

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start gap-2">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {persona.avatar_url && (
              <img
                src={persona.avatar_url}
                alt={persona.name}
                className="w-12 h-12 rounded-full object-cover"
              />
            )}
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg truncate">{persona.name}</CardTitle>
              <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                {persona.age && `年齢: ${persona.age}`}
                <div className="flex gap-1 ml-auto">
                  <Badge variant={persona.is_active ? "default" : "secondary"}>
                    {persona.is_active ? "有効" : "無効"}
                  </Badge>
                  <Badge variant={replyModeInfo.variant}>
                    {replyModeInfo.label}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {persona.personality && (
          <div>
            <p className="text-sm font-medium mb-1">性格:</p>
            <p className="text-sm text-muted-foreground line-clamp-3">{persona.personality}</p>
          </div>
        )}
        
        {persona.tone_of_voice && (
          <div>
            <p className="text-sm font-medium mb-1">トーン:</p>
            <p className="text-sm text-muted-foreground">{persona.tone_of_voice}</p>
          </div>
        )}

        {persona.expertise && persona.expertise.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">専門分野:</p>
            <div className="flex flex-wrap gap-1">
              {persona.expertise.slice(0, 3).map((skill, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {skill}
                </Badge>
              ))}
              {persona.expertise.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{persona.expertise.length - 3}
                </Badge>
              )}
            </div>
          </div>
        )}

        {persona.threads_app_id && (
          <div>
            <p className="text-sm font-medium mb-1">Threads App ID:</p>
            <p className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded">
              {persona.threads_app_id}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onToggleActive(persona.id, persona.is_active)}
            className="flex-1"
          >
            {persona.is_active ? "無効化" : "有効化"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(persona)}
          >
            編集
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDelete(persona.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
