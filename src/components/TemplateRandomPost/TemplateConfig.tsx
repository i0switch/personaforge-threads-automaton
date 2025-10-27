import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Save } from "lucide-react";
import { MultiTimeSelector } from "@/components/AutoPost/MultiTimeSelector";

interface Persona {
  id: string;
  name: string;
}

interface Template {
  text: string;
  image_url?: string;
}

interface TemplateConfig {
  id: string;
  persona_id: string;
  is_active: boolean;
  random_times: string[];
  templates: Template[];
  timezone: string;
  next_run_at: string | null;
}

export function TemplateConfigComponent() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [configs, setConfigs] = useState<Map<string, TemplateConfig>>(new Map());
  const [processingPersonas, setProcessingPersonas] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    try {
      setLoading(true);

      // ペルソナを取得
      const { data: personasData, error: personasError } = await supabase
        .from('personas')
        .select('id, name')
        .eq('user_id', user!.id)
        .eq('is_active', true)
        .order('name');

      if (personasError) throw personasError;
      setPersonas(personasData || []);

      // 設定を取得
      const { data: configsData, error: configsError } = await supabase
        .from('template_random_post_configs')
        .select('*')
        .eq('user_id', user!.id);

      if (configsError) throw configsError;

      const configMap = new Map<string, TemplateConfig>();
      (configsData || []).forEach((config) => {
        // Parse templates from jsonb to Template[]
        const parsedTemplates = Array.isArray(config.templates) 
          ? (config.templates as any[]).map(t => ({
              text: typeof t === 'string' ? t : t.text || '',
              image_url: typeof t === 'string' ? undefined : t.image_url
            }))
          : [];
        
        configMap.set(config.persona_id, {
          ...config,
          templates: parsedTemplates
        });
      });
      setConfigs(configMap);
    } catch (error: any) {
      console.error('Error loading data:', error);
      toast({
        title: "エラー",
        description: "データの読み込みに失敗しました",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getConfigForPersona = (personaId: string): TemplateConfig | null => {
    return configs.get(personaId) || null;
  };

  const calculateNextRun = (times: string[], timezone: string = 'Asia/Tokyo'): string => {
    if (!times || times.length === 0) return new Date().toISOString();
    
    // 現在のUTC時刻
    const nowUTC = new Date();
    
    // タイムゾーンでの現在時刻（HH:MM:SS形式）
    const currentTime = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(nowUTC);
    
    // タイムゾーンでの現在の日付（YYYY-MM-DD形式）
    const currentDateStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(nowUTC);
    
    // 今日の残り時間をチェック（タイムゾーン基準）
    const sortedTimes = times.sort();
    const nextSlot = sortedTimes.find(t => t > currentTime);
    
    if (nextSlot) {
      // 今日の次のスロット - JST日時をISO 8601形式でUTCに変換
      const jstDateTime = new Date(`${currentDateStr}T${nextSlot}+09:00`);
      return jstDateTime.toISOString();
    } else {
      // 明日の最初のスロット
      const tomorrow = new Date(nowUTC.getTime() + 24 * 60 * 60 * 1000);
      const tomorrowDateStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(tomorrow);
      
      // JST日時をISO 8601形式でUTCに変換
      const tomorrowJstDateTime = new Date(`${tomorrowDateStr}T${sortedTimes[0]}+09:00`);
      return tomorrowJstDateTime.toISOString();
    }
  };

  const togglePersonaConfig = async (persona: Persona) => {
    try {
      setProcessingPersonas(prev => new Set(prev).add(persona.id));
      
      const existingConfig = getConfigForPersona(persona.id);
      
      if (existingConfig) {
        // Toggle existing config
        const newIsActive = !existingConfig.is_active;
        
        const { error } = await supabase
          .from('template_random_post_configs')
          .update({ 
            is_active: newIsActive,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingConfig.id);
        
        if (error) throw error;
        
        const updatedConfig = { ...existingConfig, is_active: newIsActive };
        setConfigs(prev => new Map(prev).set(persona.id, updatedConfig));
        
        toast({
          title: newIsActive ? "有効化しました" : "無効化しました",
          description: `${persona.name}のテンプレートランダムポストを${newIsActive ? '有効' : '無効'}にしました`,
        });
      } else {
        // Create new config with defaults
        const defaultTimes = ['10:00:00', '14:00:00', '18:00:00'];
        const nextRunAt = calculateNextRun(defaultTimes, 'Asia/Tokyo');
        
        const { data, error } = await supabase
          .from('template_random_post_configs')
          .insert({
            user_id: user!.id,
            persona_id: persona.id,
            is_active: true,
            random_times: defaultTimes,
            templates: [] as any,
            timezone: 'Asia/Tokyo',
            next_run_at: nextRunAt,
            posted_times_today: [] as any,
          })
          .select()
          .single();
        
        if (error) throw error;
        
        setConfigs(prev => new Map(prev).set(persona.id, {
          ...data,
          templates: []
        }));
        
        toast({
          title: "設定を作成しました",
          description: `${persona.name}のテンプレートランダムポスト設定を作成しました`,
        });
      }
      
      await loadData();
    } catch (error: any) {
      console.error('Error toggling config:', error);
      toast({
        title: "エラー",
        description: error.message || "設定の切り替えに失敗しました",
        variant: "destructive",
      });
    } finally {
      setProcessingPersonas(prev => {
        const newSet = new Set(prev);
        newSet.delete(persona.id);
        return newSet;
      });
    }
  };

  const updateRandomTimes = async (personaId: string, newTimes: string[]) => {
    try {
      const config = getConfigForPersona(personaId);
      if (!config) return;
      
      const nextRunAt = calculateNextRun(newTimes, config.timezone);
      
      const { error } = await supabase
        .from('template_random_post_configs')
        .update({
          random_times: newTimes,
          next_run_at: nextRunAt,
          updated_at: new Date().toISOString()
        })
        .eq('id', config.id);
      
      if (error) throw error;
      
      await loadData();
      
      toast({
        title: "更新しました",
        description: "投稿時間を更新しました",
      });
    } catch (error: any) {
      console.error('Error updating times:', error);
      toast({
        title: "エラー",
        description: "時間の更新に失敗しました",
        variant: "destructive",
      });
    }
  };

  const [editingTemplates, setEditingTemplates] = useState<Map<string, Template[]>>(new Map());

  const addTemplate = (personaId: string) => {
    const current = editingTemplates.get(personaId) || [];
    setEditingTemplates(prev => new Map(prev).set(personaId, [...current, { text: '', image_url: undefined }]));
  };

  const updateTemplate = (personaId: string, index: number, field: 'text' | 'image_url', value: string) => {
    const current = editingTemplates.get(personaId) || [];
    const updated = [...current];
    updated[index] = { ...updated[index], [field]: value };
    setEditingTemplates(prev => new Map(prev).set(personaId, updated));
  };

  const removeTemplate = (personaId: string, index: number) => {
    const current = editingTemplates.get(personaId) || [];
    const updated = current.filter((_, i) => i !== index);
    setEditingTemplates(prev => new Map(prev).set(personaId, updated));
  };

  const handleImageUpload = async (personaId: string, index: number, file: File) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${personaId}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError, data } = await supabase.storage
        .from('post-images')
        .upload(fileName, file);
      
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage
        .from('post-images')
        .getPublicUrl(fileName);
      
      updateTemplate(personaId, index, 'image_url', publicUrl);
      
      // Auto-save templates after image upload
      const config = getConfigForPersona(personaId);
      if (config) {
        const current = editingTemplates.get(personaId) || [];
        const updated = [...current];
        updated[index] = { ...updated[index], image_url: publicUrl };
        
        const templates = updated.filter(t => t.text.trim());
        
        if (templates.length > 0) {
          const { error: saveError } = await supabase
            .from('template_random_post_configs')
            .update({
              templates: templates as any,
              updated_at: new Date().toISOString()
            })
            .eq('id', config.id);
          
          if (saveError) throw saveError;
          await loadData();
        }
      }
      
      toast({
        title: "画像をアップロードしました",
        description: "テンプレートに画像が追加され、自動保存されました",
      });
    } catch (error: any) {
      console.error('Image upload error:', error);
      toast({
        title: "エラー",
        description: "画像のアップロードに失敗しました",
        variant: "destructive",
      });
    }
  };

  const removeImage = (personaId: string, index: number) => {
    updateTemplate(personaId, index, 'image_url', '');
  };

  const saveTemplates = async (personaId: string) => {
    try {
      const config = getConfigForPersona(personaId);
      if (!config) return;
      
      const templates = (editingTemplates.get(personaId) || []).filter(t => t.text.trim());
      
      if (templates.length === 0) {
        toast({
          title: "エラー",
          description: "少なくとも1つのテンプレートを入力してください",
          variant: "destructive",
        });
        return;
      }
      
      const { error } = await supabase
        .from('template_random_post_configs')
        .update({
          templates: templates as any,
          updated_at: new Date().toISOString()
        })
        .eq('id', config.id);
      
      if (error) throw error;
      
      await loadData();
      setEditingTemplates(prev => {
        const newMap = new Map(prev);
        newMap.delete(personaId);
        return newMap;
      });
      
      toast({
        title: "保存しました",
        description: `${templates.length}個のテンプレートを保存しました`,
      });
    } catch (error: any) {
      console.error('Error saving templates:', error);
      toast({
        title: "エラー",
        description: "テンプレートの保存に失敗しました",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    // Initialize editing templates from loaded configs
    const newMap = new Map<string, Template[]>();
    configs.forEach((config, personaId) => {
      if (!editingTemplates.has(personaId)) {
        newMap.set(personaId, config.templates || []);
      }
    });
    if (newMap.size > 0) {
      setEditingTemplates(prev => new Map([...prev, ...newMap]));
    }
  }, [configs]);

  if (loading) {
    return (
      <div className="flex justify-center items-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    );
  }

  if (personas.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>ペルソナが見つかりません</CardTitle>
          <CardDescription>
            テンプレートランダムポストを使用するには、まずペルソナを作成してください。
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {personas.map((persona) => {
        const config = getConfigForPersona(persona.id);
        const isProcessing = processingPersonas.has(persona.id);
        const templates = editingTemplates.get(persona.id) || config?.templates || [];
        
        return (
          <Card key={persona.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-xl">{persona.name}</CardTitle>
                  {config?.is_active && (
                    <Badge variant="default">有効</Badge>
                  )}
                </div>
                <Switch
                  checked={config?.is_active || false}
                  onCheckedChange={() => togglePersonaConfig(persona)}
                  disabled={isProcessing}
                />
              </div>
            </CardHeader>
            
            {config?.is_active && (
              <CardContent className="space-y-6">
                {/* 投稿時間設定 */}
                <div className="space-y-2">
                  <MultiTimeSelector
                    times={config.random_times || []}
                    onChange={(times) => updateRandomTimes(persona.id, times)}
                  />
                </div>
                
                {/* テンプレート設定 */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">テンプレート文章</h3>
                    <Button
                      onClick={() => addTemplate(persona.id)}
                      size="sm"
                      variant="outline"
                      className="gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      追加
                    </Button>
                  </div>
                  
                  {templates.length === 0 && (
                    <p className="text-sm text-gray-500">
                      テンプレートを追加してください
                    </p>
                  )}
                  
                  <div className="space-y-4">
                    {templates.map((template, index) => (
                      <div key={index} className="border rounded-lg p-4 space-y-3">
                        <div className="flex gap-2">
                          <Textarea
                            value={template.text}
                            onChange={(e) => updateTemplate(persona.id, index, 'text', e.target.value)}
                            placeholder="投稿内容を入力..."
                            className="flex-1"
                            rows={3}
                          />
                          <Button
                            onClick={() => removeTemplate(persona.id, index)}
                            size="sm"
                            variant="ghost"
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        <div className="space-y-2">
                          {template.image_url ? (
                            <div className="relative">
                              <img 
                                src={template.image_url} 
                                alt="Template preview" 
                                className="w-32 h-32 object-cover rounded-lg border"
                              />
                              <Button
                                onClick={() => removeImage(persona.id, index)}
                                size="sm"
                                variant="destructive"
                                className="absolute top-2 right-2"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <div>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleImageUpload(persona.id, index, file);
                                }}
                                className="text-sm"
                                id={`image-${persona.id}-${index}`}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {templates.length > 0 && (
                    <Button
                      onClick={() => saveTemplates(persona.id)}
                      className="w-full gap-2"
                    >
                      <Save className="h-4 w-4" />
                      テンプレートを保存
                    </Button>
                  )}
                </div>
                
                {/* 次回実行時刻 */}
                {config.next_run_at && (
                  <div className="text-sm text-gray-600">
                    次回実行 (JST): {new Date(config.next_run_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
