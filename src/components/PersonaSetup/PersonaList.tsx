
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PersonaCard } from "./PersonaCard";

interface Persona {
  id: string;
  name: string;
  age: string;
  personality: string;
  expertise: string[];
  tone_of_voice: string;
  avatar_url?: string;
  is_active: boolean;
  threads_app_id?: string;
  threads_app_secret?: string;
  webhook_verify_token?: string;
  reply_mode?: string;
}

interface PersonaListProps {
  personas: Persona[];
  onEdit: (persona: Persona) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, currentStatus: boolean) => void;
  onCreateNew: () => void;
}

export const PersonaList = ({ personas, onEdit, onDelete, onToggleActive, onCreateNew }: PersonaListProps) => {
  if (personas.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <p className="text-muted-foreground mb-4">まだペルソナが登録されていません</p>
          <Button onClick={onCreateNew}>
            最初のペルソナを作成
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {personas.map((persona) => (
        <PersonaCard
          key={persona.id}
          persona={persona}
          onEdit={onEdit}
          onDelete={onDelete}
          onToggleActive={onToggleActive}
        />
      ))}
    </div>
  );
};
