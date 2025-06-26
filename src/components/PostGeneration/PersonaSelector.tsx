
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Persona {
  id: string;
  name: string;
  avatar_url: string | null;
}

interface PersonaSelectorProps {
  selectedPersona: string;
  onPersonaChange: (personaId: string) => void;
}

export const PersonaSelector = ({ selectedPersona, onPersonaChange }: PersonaSelectorProps) => {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    const fetchPersonas = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from('personas')
        .select('id, name, avatar_url')
        .eq('user_id', user.id);

      if (!error && data) {
        setPersonas(data);
      }
    };

    fetchPersonas();
  }, [user]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>ペルソナを選択</CardTitle>
      </CardHeader>
      <CardContent>
        <Select value={selectedPersona} onValueChange={onPersonaChange}>
          <SelectTrigger>
            <SelectValue placeholder="ペルソナを選択してください" />
          </SelectTrigger>
          <SelectContent>
            {personas.map((persona) => (
              <SelectItem key={persona.id} value={persona.id}>
                <div className="flex items-center gap-2">
                  <Avatar className="w-6 h-6">
                    <AvatarImage src={persona.avatar_url || undefined} />
                    <AvatarFallback>{persona.name[0]}</AvatarFallback>
                  </Avatar>
                  {persona.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
};
