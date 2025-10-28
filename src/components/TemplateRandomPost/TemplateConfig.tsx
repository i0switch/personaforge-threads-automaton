import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Trash2, Upload, Plus, Save, Box } from "lucide-react";
import { MultiTimeSelector } from "@/components/AutoPost/MultiTimeSelector";

interface Persona {
  id: string;
  name: string;
}

interface Template {
  text: string;
  image_url?: string;
}

interface TemplatePostBox {
  id: string;
  persona_id: string;
  box_name: string;
  is_active: boolean;
  random_times: string[];
  templates: Template[];
  timezone: string;
  next_run_at: string | null;
}

export function TemplateConfigComponent() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [boxes, setBoxes] = useState<Record<string, TemplatePostBox[]>>({});
  const [editingTemplates, setEditingTemplates] = useState<Record<string, Template[]>>({});
  const [editingBoxNames, setEditingBoxNames] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data: personasData, error: personasError } = await supabase
        .from("personas")
        .select("id, name")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: true });

      if (personasError) throw personasError;

      if (!personasData || personasData.length === 0) {
        setPersonas([]);
        setLoading(false);
        return;
      }

      setPersonas(personasData);

      const { data: boxesData, error: boxesError } = await supabase
        .from("template_post_boxes")
        .select("*")
        .eq("user_id", user.id)
        .in("persona_id", personasData.map(p => p.id))
        .order("created_at", { ascending: true });

      if (boxesError) throw boxesError;

      const boxesMap: Record<string, TemplatePostBox[]> = {};
      personasData.forEach(persona => {
        boxesMap[persona.id] = [];
      });
      
      boxesData?.forEach(box => {
        if (!boxesMap[box.persona_id]) {
          boxesMap[box.persona_id] = [];
        }
        boxesMap[box.persona_id].push({
          id: box.id,
          persona_id: box.persona_id,
          box_name: box.box_name,
          is_active: box.is_active,
          random_times: box.random_times || [],
          templates: (box.templates as unknown as Template[]) || [],
          timezone: box.timezone || "Asia/Tokyo",
          next_run_at: box.next_run_at
        });
      });

      setBoxes(boxesMap);
      
      const initialEditingTemplates: Record<string, Template[]> = {};
      boxesData?.forEach(box => {
        initialEditingTemplates[box.id] = (box.templates as unknown as Template[]) || [];
      });
      setEditingTemplates(initialEditingTemplates);
    } catch (error: any) {
      console.error("データ読み込みエラー:", error);
      toast.error("データの読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const getBoxesForPersona = (personaId: string): TemplatePostBox[] => {
    return boxes[personaId] || [];
  };

  const calculateNextRun = (times: string[], timezone: string = 'Asia/Tokyo'): string => {
    if (times.length === 0) return new Date().toISOString();
    
    const now = new Date();
    const jstNow = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    const currentTime = jstNow.getHours() * 60 + jstNow.getMinutes();
    
    const sortedTimes = times.map(t => {
      const [hours, minutes] = t.split(':').map(Number);
      return hours * 60 + minutes;
    }).sort((a, b) => a - b);
    
    const nextTime = sortedTimes.find(t => t > currentTime);
    const targetMinutes = nextTime !== undefined ? nextTime : sortedTimes[0];
    
    const targetDate = new Date(jstNow);
    if (nextTime === undefined) {
      targetDate.setDate(targetDate.getDate() + 1);
    }
    targetDate.setHours(Math.floor(targetMinutes / 60));
    targetDate.setMinutes(targetMinutes % 60);
    targetDate.setSeconds(0);
    targetDate.setMilliseconds(0);
    
    return targetDate.toISOString();
  };

  const addNewBox = async (personaId: string) => {
    if (!user) return;
    
    setProcessing(prev => ({ ...prev, [personaId]: true }));
    try {
      const newBoxName = `箱${(boxes[personaId]?.length || 0) + 1}`;
      
      const { data, error } = await supabase
        .from("template_post_boxes")
        .insert({
          user_id: user.id,
          persona_id: personaId,
          box_name: newBoxName,
          is_active: false,
          random_times: [],
          templates: [],
          timezone: "Asia/Tokyo"
        })
        .select()
        .single();

      if (error) throw error;

      const newBox: TemplatePostBox = {
        id: data.id,
        persona_id: data.persona_id,
        box_name: data.box_name,
        is_active: data.is_active,
        random_times: data.random_times || [],
        templates: (data.templates as unknown as Template[]) || [],
        timezone: data.timezone || "Asia/Tokyo",
        next_run_at: data.next_run_at
      };

      setBoxes(prev => ({
        ...prev,
        [personaId]: [...(prev[personaId] || []), newBox]
      }));

      toast.success(`新しい箱「${newBoxName}」を作成しました`);
    } catch (error: any) {
      console.error("箱作成エラー:", error);
      toast.error("箱の作成に失敗しました");
    } finally {
      setProcessing(prev => ({ ...prev, [personaId]: false }));
    }
  };

  const toggleBoxActive = async (box: TemplatePostBox) => {
    if (!user) return;
    
    setProcessing(prev => ({ ...prev, [box.id]: true }));
    try {
      const newActiveState = !box.is_active;

      const { error } = await supabase
        .from("template_post_boxes")
        .update({ 
          is_active: newActiveState,
          updated_at: new Date().toISOString()
        })
        .eq("id", box.id);

      if (error) throw error;

      setBoxes(prev => ({
        ...prev,
        [box.persona_id]: prev[box.persona_id].map(b =>
          b.id === box.id ? { ...b, is_active: newActiveState } : b
        )
      }));

      toast.success(newActiveState ? "箱を有効にしました" : "箱を無効にしました");
    } catch (error: any) {
      console.error("箱の切り替えエラー:", error);
      toast.error("箱の切り替えに失敗しました");
    } finally {
      setProcessing(prev => ({ ...prev, [box.id]: false }));
    }
  };

  const deleteBox = async (box: TemplatePostBox) => {
    if (!user) return;
    if (!confirm(`箱「${box.box_name}」を削除してもよろしいですか？`)) return;
    
    setProcessing(prev => ({ ...prev, [box.id]: true }));
    try {
      const { error } = await supabase
        .from("template_post_boxes")
        .delete()
        .eq("id", box.id);

      if (error) throw error;

      setBoxes(prev => ({
        ...prev,
        [box.persona_id]: prev[box.persona_id].filter(b => b.id !== box.id)
      }));

      toast.success("箱を削除しました");
    } catch (error: any) {
      console.error("箱削除エラー:", error);
      toast.error("箱の削除に失敗しました");
    } finally {
      setProcessing(prev => ({ ...prev, [box.id]: false }));
    }
  };

  const updateBoxName = async (boxId: string, newName: string) => {
    if (!user || !newName.trim()) return;
    
    try {
      const { error } = await supabase
        .from("template_post_boxes")
        .update({ 
          box_name: newName.trim(),
          updated_at: new Date().toISOString()
        })
        .eq("id", boxId);

      if (error) throw error;

      setBoxes(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(personaId => {
          updated[personaId] = updated[personaId].map(box =>
            box.id === boxId ? { ...box, box_name: newName.trim() } : box
          );
        });
        return updated;
      });

      setEditingBoxNames(prev => {
        const updated = { ...prev };
        delete updated[boxId];
        return updated;
      });

      toast.success("箱の名前を更新しました");
    } catch (error: any) {
      console.error("箱名更新エラー:", error);
      toast.error("箱の名前の更新に失敗しました");
    }
  };

  const updateRandomTimes = async (boxId: string, newTimes: string[]) => {
    if (!user) return;
    
    try {
      const nextRunAt = calculateNextRun(newTimes, "Asia/Tokyo");

      const { error } = await supabase
        .from("template_post_boxes")
        .update({ 
          random_times: newTimes,
          next_run_at: nextRunAt,
          updated_at: new Date().toISOString()
        })
        .eq("id", boxId);

      if (error) throw error;

      setBoxes(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(personaId => {
          updated[personaId] = updated[personaId].map(box =>
            box.id === boxId ? { ...box, random_times: newTimes, next_run_at: nextRunAt } : box
          );
        });
        return updated;
      });

      toast.success("投稿時間を更新しました");
    } catch (error: any) {
      console.error("時間更新エラー:", error);
      toast.error("時間の更新に失敗しました");
    }
  };

  const addTemplate = (boxId: string) => {
    setEditingTemplates(prev => ({
      ...prev,
      [boxId]: [...(prev[boxId] || []), { text: "", image_url: undefined }]
    }));
  };

  const updateTemplate = (boxId: string, index: number, field: keyof Template, value: string) => {
    setEditingTemplates(prev => {
      const templates = [...(prev[boxId] || [])];
      templates[index] = { ...templates[index], [field]: value };
      return { ...prev, [boxId]: templates };
    });
  };

  const removeTemplate = (boxId: string, index: number) => {
    setEditingTemplates(prev => {
      const templates = [...(prev[boxId] || [])];
      templates.splice(index, 1);
      return { ...prev, [boxId]: templates };
    });
  };

  const handleImageUpload = async (boxId: string, index: number, file: File) => {
    if (!user) return;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${boxId}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('post-images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('post-images')
        .getPublicUrl(fileName);

      updateTemplate(boxId, index, 'image_url', publicUrl);
      toast.success("画像をアップロードしました");
    } catch (error: any) {
      console.error("画像アップロードエラー:", error);
      toast.error("画像のアップロードに失敗しました");
    }
  };

  const saveTemplates = async (boxId: string) => {
    if (!user) return;
    
    setProcessing(prev => ({ ...prev, [boxId]: true }));
    try {
      const templates = editingTemplates[boxId] || [];
      
      if (templates.length === 0) {
        toast.error("テンプレートを最低1つ追加してください");
        return;
      }

      const validTemplates = templates.filter(t => t.text.trim() !== "");
      
      if (validTemplates.length === 0) {
        toast.error("有効なテンプレートを追加してください");
        return;
      }

      const { error } = await supabase
        .from("template_post_boxes")
        .update({ 
          templates: validTemplates as any,
          updated_at: new Date().toISOString()
        })
        .eq("id", boxId);

      if (error) throw error;

      setBoxes(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(personaId => {
          updated[personaId] = updated[personaId].map(box =>
            box.id === boxId ? { ...box, templates: validTemplates } : box
          );
        });
        return updated;
      });

      toast.success("テンプレートを保存しました");
    } catch (error: any) {
      console.error("テンプレート保存エラー:", error);
      toast.error("テンプレートの保存に失敗しました");
    } finally {
      setProcessing(prev => ({ ...prev, [boxId]: false }));
    }
  };

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="flex justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : personas.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground text-center">
              アクティブなペルソナが見つかりません。ペルソナを作成してください。
            </p>
          </CardContent>
        </Card>
      ) : (
        personas.map(persona => {
          const personaBoxes = getBoxesForPersona(persona.id);
          
          return (
            <Card key={persona.id} className="overflow-hidden">
              <CardHeader className="bg-muted/50">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{persona.name}</CardTitle>
                    <CardDescription className="mt-1">
                      テンプレート箱ごとに投稿時間を設定
                    </CardDescription>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => addNewBox(persona.id)}
                    disabled={processing[persona.id]}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    箱を追加
                  </Button>
                </div>
              </CardHeader>
              
              <CardContent className="p-6 space-y-4">
                {personaBoxes.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    箱を追加してテンプレート文章を設定してください
                  </p>
                ) : (
                  personaBoxes.map(box => {
                    const templates = editingTemplates[box.id] || [];
                    const isEditingName = editingBoxNames[box.id] !== undefined;
                    
                    return (
                      <Card key={box.id} className="border-2">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1">
                              <Box className="h-5 w-5 text-primary" />
                              {isEditingName ? (
                                <Input
                                  value={editingBoxNames[box.id]}
                                  onChange={(e) => setEditingBoxNames(prev => ({ ...prev, [box.id]: e.target.value }))}
                                  onBlur={() => updateBoxName(box.id, editingBoxNames[box.id])}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      updateBoxName(box.id, editingBoxNames[box.id]);
                                    }
                                  }}
                                  className="max-w-xs"
                                  autoFocus
                                />
                              ) : (
                                <h3 
                                  className="font-semibold cursor-pointer hover:text-primary"
                                  onClick={() => setEditingBoxNames(prev => ({ ...prev, [box.id]: box.box_name }))}
                                >
                                  {box.box_name}
                                </h3>
                              )}
                              {box.is_active && (
                                <span className="text-xs font-normal text-green-600 bg-green-50 px-2 py-1 rounded">
                                  有効
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={box.is_active}
                                onCheckedChange={() => toggleBoxActive(box)}
                                disabled={processing[box.id]}
                              />
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => deleteBox(box)}
                                disabled={processing[box.id]}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        
                        <CardContent className="space-y-4">
                          <div className="space-y-2">
                            <Label className="text-sm">投稿時間</Label>
                            <MultiTimeSelector
                              times={box.random_times || []}
                              onChange={(times) => updateRandomTimes(box.id, times)}
                              disabled={!box.is_active}
                            />
                            {box.next_run_at && (
                              <p className="text-xs text-muted-foreground">
                                次回: {new Date(box.next_run_at).toLocaleString('ja-JP', { 
                                  timeZone: 'Asia/Tokyo',
                                  month: '2-digit',
                                  day: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })} JST
                              </p>
                            )}
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-sm">テンプレート</Label>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => addTemplate(box.id)}
                                disabled={!box.is_active}
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                追加
                              </Button>
                            </div>

                            {templates.length === 0 ? (
                              <p className="text-xs text-muted-foreground text-center py-2">
                                テンプレートを追加
                              </p>
                            ) : (
                              <div className="space-y-2">
                                {templates.map((template, index) => (
                                  <div key={index} className="border rounded p-3 space-y-2">
                                    <div className="flex gap-2">
                                      <Textarea
                                        placeholder="投稿テキスト"
                                        value={template.text}
                                        onChange={(e) => updateTemplate(box.id, index, 'text', e.target.value)}
                                        rows={2}
                                        disabled={!box.is_active}
                                        className="flex-1"
                                      />
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() => removeTemplate(box.id, index)}
                                        disabled={!box.is_active}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                    
                                    {template.image_url && (
                                      <img 
                                        src={template.image_url} 
                                        alt="画像" 
                                        className="max-w-[200px] rounded border"
                                      />
                                    )}
                                    
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        const input = document.createElement('input');
                                        input.type = 'file';
                                        input.accept = 'image/*';
                                        input.onchange = (e: any) => {
                                          const file = e.target.files?.[0];
                                          if (file) handleImageUpload(box.id, index, file);
                                        };
                                        input.click();
                                      }}
                                      disabled={!box.is_active}
                                    >
                                      <Upload className="h-3 w-3 mr-1" />
                                      画像
                                    </Button>
                                  </div>
                                ))}
                                
                                <Button
                                  onClick={() => saveTemplates(box.id)}
                                  disabled={processing[box.id] || !box.is_active}
                                  size="sm"
                                  className="w-full"
                                >
                                  <Save className="h-3 w-3 mr-1" />
                                  保存
                                </Button>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
