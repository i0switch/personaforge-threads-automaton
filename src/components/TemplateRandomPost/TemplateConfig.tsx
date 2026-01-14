import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { Trash2, Upload, Plus, Save, Box, Copy, ChevronDown, User } from "lucide-react";
import { MultiTimeSelector } from "@/components/AutoPost/MultiTimeSelector";
interface Persona {
  id: string;
  name: string;
}

interface Template {
  text: string;
  image_urls?: string[];
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
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>("all");
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState<string | null>(null);
  const [selectedSourcePersona, setSelectedSourcePersona] = useState<string>("");
  const [selectedSourceBox, setSelectedSourceBox] = useState<string>("");
  const [expandedBoxes, setExpandedBoxes] = useState<Record<string, boolean>>({});

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

  const duplicateBoxFromOtherPersona = async (targetPersonaId: string) => {
    if (!user || !selectedSourceBox) return;
    
    const sourceBox = Object.values(boxes).flat().find(b => b.id === selectedSourceBox);
    if (!sourceBox) {
      toast.error("複製元の箱が見つかりません");
      return;
    }
    
    setProcessing(prev => ({ ...prev, [targetPersonaId]: true }));
    try {
      const newBoxName = `${sourceBox.box_name}（複製）`;
      
      const { data, error } = await supabase
        .from("template_post_boxes")
        .insert({
          user_id: user.id,
          persona_id: targetPersonaId,
          box_name: newBoxName,
          is_active: false,
          random_times: sourceBox.random_times,
          templates: sourceBox.templates as any,
          timezone: sourceBox.timezone,
          next_run_at: calculateNextRun(sourceBox.random_times, sourceBox.timezone)
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
        [targetPersonaId]: [...(prev[targetPersonaId] || []), newBox]
      }));

      setEditingTemplates(prev => ({
        ...prev,
        [data.id]: (data.templates as unknown as Template[]) || []
      }));

      setDuplicateDialogOpen(null);
      setSelectedSourcePersona("");
      setSelectedSourceBox("");
      
      toast.success(`箱「${newBoxName}」を複製しました`);
    } catch (error: any) {
      console.error("箱複製エラー:", error);
      toast.error("箱の複製に失敗しました");
    } finally {
      setProcessing(prev => ({ ...prev, [targetPersonaId]: false }));
    }
  };

  const getSourceBoxesForPersona = (personaId: string): TemplatePostBox[] => {
    return boxes[personaId] || [];
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
      [boxId]: [...(prev[boxId] || []), { text: "", image_urls: [] }]
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

    const currentImages = editingTemplates[boxId]?.[index]?.image_urls || [];
    if (currentImages.length >= 2) {
      toast.error("画像は2つまでアップロードできます");
      return;
    }

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

      setEditingTemplates(prev => {
        const templates = [...(prev[boxId] || [])];
        templates[index] = {
          ...templates[index],
          image_urls: [...currentImages, publicUrl]
        };
        return { ...prev, [boxId]: templates };
      });

      toast.success("画像をアップロードしました");
    } catch (error: any) {
      console.error("画像アップロードエラー:", error);
      toast.error("画像のアップロードに失敗しました");
    }
  };

  const removeImage = (boxId: string, templateIndex: number, imageIndex: number) => {
    setEditingTemplates(prev => {
      const templates = [...(prev[boxId] || [])];
      const currentImages = templates[templateIndex].image_urls || [];
      templates[templateIndex] = {
        ...templates[templateIndex],
        image_urls: currentImages.filter((_, i) => i !== imageIndex)
      };
      return { ...prev, [boxId]: templates };
    });
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

  const filteredPersonas = selectedPersonaId === "all" 
    ? personas 
    : personas.filter(p => p.id === selectedPersonaId);

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
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">ペルソナフィルター</CardTitle>
              <CardDescription>表示するペルソナを選択</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={selectedPersonaId} onValueChange={setSelectedPersonaId}>
                <SelectTrigger className="w-full max-w-md">
                  <SelectValue placeholder="ペルソナを選択" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全てのペルソナ</SelectItem>
                  {personas.map(persona => (
                    <SelectItem key={persona.id} value={persona.id}>
                      {persona.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Accordion type="single" collapsible className="space-y-4">
            {filteredPersonas.map(persona => {
              const personaBoxes = getBoxesForPersona(persona.id);
              const activeBoxCount = personaBoxes.filter(b => b.is_active).length;
              const totalTemplateCount = personaBoxes.reduce((sum, b) => sum + b.templates.length, 0);
              
              return (
                <AccordionItem key={persona.id} value={persona.id} className="border rounded-lg overflow-hidden">
                  <AccordionTrigger className="px-4 py-3 bg-muted/50 hover:bg-muted/70 [&[data-state=open]>svg]:rotate-180">
                    <div className="flex items-center justify-between w-full mr-4">
                      <div className="flex items-center gap-3">
                        <User className="h-5 w-5 text-primary" />
                        <div className="text-left">
                          <div className="font-semibold">{persona.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {personaBoxes.length}箱 / {totalTemplateCount}テンプレート
                            {activeBoxCount > 0 && (
                              <span className="ml-2 text-green-600">（{activeBoxCount}箱 有効）</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        <Dialog 
                          open={duplicateDialogOpen === persona.id} 
                          onOpenChange={(open) => {
                            setDuplicateDialogOpen(open ? persona.id : null);
                            if (!open) {
                              setSelectedSourcePersona("");
                              setSelectedSourceBox("");
                            }
                          }}
                        >
                          <DialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={processing[persona.id]}
                            >
                              <Copy className="h-4 w-4 mr-1" />
                              他から複製
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>他ペルソナから箱を複製</DialogTitle>
                              <DialogDescription>
                                複製元のペルソナと箱を選択してください
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                              <div className="space-y-2">
                                <Label>複製元ペルソナ</Label>
                                <Select 
                                  value={selectedSourcePersona} 
                                  onValueChange={(value) => {
                                    setSelectedSourcePersona(value);
                                    setSelectedSourceBox("");
                                  }}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="ペルソナを選択" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {personas.filter(p => p.id !== persona.id && getSourceBoxesForPersona(p.id).length > 0).map(p => (
                                      <SelectItem key={p.id} value={p.id}>
                                        {p.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              
                              {selectedSourcePersona && (
                                <div className="space-y-2">
                                  <Label>複製元の箱</Label>
                                  <Select value={selectedSourceBox} onValueChange={setSelectedSourceBox}>
                                    <SelectTrigger>
                                      <SelectValue placeholder="箱を選択" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {getSourceBoxesForPersona(selectedSourcePersona).map(box => (
                                        <SelectItem key={box.id} value={box.id}>
                                          {box.box_name} ({box.templates.length}テンプレート)
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                              
                              <Button 
                                onClick={() => duplicateBoxFromOtherPersona(persona.id)}
                                disabled={!selectedSourceBox || processing[persona.id]}
                                className="w-full"
                              >
                                <Copy className="h-4 w-4 mr-2" />
                                この箱を複製
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                        
                        <Button
                          size="sm"
                          onClick={() => addNewBox(persona.id)}
                          disabled={processing[persona.id]}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          新規箱
                        </Button>
                      </div>
                    </div>
                  </AccordionTrigger>
                  
                  <AccordionContent className="p-4 space-y-3">
                    {personaBoxes.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        箱を追加してテンプレート文章を設定してください
                      </p>
                    ) : (
                      personaBoxes.map(box => {
                        const templates = editingTemplates[box.id] || [];
                        const isEditingName = editingBoxNames[box.id] !== undefined;
                        const isExpanded = expandedBoxes[box.id] ?? false;
                        
                        return (
                          <Collapsible
                            key={box.id}
                            open={isExpanded}
                            onOpenChange={(open) => setExpandedBoxes(prev => ({ ...prev, [box.id]: open }))}
                          >
                            <Card className="border-2">
                              <CollapsibleTrigger asChild>
                                <CardHeader className="pb-3 cursor-pointer hover:bg-muted/30 transition-colors">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3 flex-1">
                                      <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
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
                                          onClick={(e) => e.stopPropagation()}
                                          className="max-w-xs"
                                          autoFocus
                                        />
                                      ) : (
                                        <div className="flex flex-col">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setEditingBoxNames(prev => ({ ...prev, [box.id]: box.box_name }));
                                            }}
                                            className="text-left font-semibold hover:text-primary transition-colors"
                                          >
                                            {box.box_name}
                                          </button>
                                          <span className="text-xs text-muted-foreground">
                                            {box.templates.length}個のテンプレート
                                            {box.random_times.length > 0 && ` / ${box.random_times.length}時間設定`}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                      <Label className="text-sm">有効</Label>
                                      <Switch
                                        checked={box.is_active}
                                        onCheckedChange={() => toggleBoxActive(box)}
                                        disabled={processing[box.id]}
                                      />
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => deleteBox(box)}
                                        disabled={processing[box.id]}
                                      >
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                      </Button>
                                    </div>
                                  </div>
                                </CardHeader>
                              </CollapsibleTrigger>

                              <CollapsibleContent>
                                <CardContent className="space-y-4 pt-0">
                                  <div className="space-y-2">
                                    <Label>投稿時間</Label>
                                    <MultiTimeSelector
                                      times={box.random_times}
                                      onChange={(times) => updateRandomTimes(box.id, times)}
                                    />
                                    {box.next_run_at && (
                                      <p className="text-xs text-muted-foreground">
                                        次回実行予定: {new Date(box.next_run_at).toLocaleString('ja-JP', { 
                                          timeZone: box.timezone,
                                          year: 'numeric',
                                          month: '2-digit',
                                          day: '2-digit',
                                          hour: '2-digit',
                                          minute: '2-digit'
                                        })}
                                      </p>
                                    )}
                                  </div>

                                  <div className="space-y-3 border-t pt-4">
                                    <div className="flex items-center justify-between">
                                      <Label>テンプレート</Label>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => addTemplate(box.id)}
                                      >
                                        <Plus className="h-3 w-3 mr-1" />
                                        テンプレート追加
                                      </Button>
                                    </div>

                                    {templates.map((template, idx) => (
                                      <Card key={idx} className="p-4 space-y-3">
                                        <div className="flex items-start justify-between">
                                          <span className="text-sm font-medium">テンプレート {idx + 1}</span>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => removeTemplate(box.id, idx)}
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </Button>
                                        </div>

                                        <Textarea
                                          placeholder="投稿テキストを入力..."
                                          value={template.text}
                                          onChange={(e) => updateTemplate(box.id, idx, 'text', e.target.value)}
                                          rows={4}
                                          className="resize-none"
                                        />

                                        <div className="space-y-2">
                                          <Label className="text-sm">画像（最大2枚）</Label>
                                          <div className="flex flex-wrap gap-2">
                                            {template.image_urls?.map((url, imgIdx) => (
                                              <div key={imgIdx} className="relative group">
                                                <img
                                                  src={url}
                                                  alt={`Image ${imgIdx + 1}`}
                                                  className="w-20 h-20 object-cover rounded border"
                                                />
                                                <button
                                                  onClick={() => removeImage(box.id, idx, imgIdx)}
                                                  className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                  <Trash2 className="h-3 w-3" />
                                                </button>
                                              </div>
                                            ))}
                                            
                                            {(!template.image_urls || template.image_urls.length < 2) && (
                                              <label className="w-20 h-20 border-2 border-dashed rounded flex items-center justify-center cursor-pointer hover:border-primary transition-colors">
                                                <Upload className="h-6 w-6 text-muted-foreground" />
                                                <input
                                                  type="file"
                                                  accept="image/*"
                                                  onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) handleImageUpload(box.id, idx, file);
                                                  }}
                                                  className="hidden"
                                                />
                                              </label>
                                            )}
                                          </div>
                                        </div>
                                      </Card>
                                    ))}

                                    {templates.length > 0 && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => addTemplate(box.id)}
                                        className="w-full"
                                      >
                                        <Plus className="h-3 w-3 mr-1" />
                                        テンプレート追加
                                      </Button>
                                    )}

                                    <Button
                                      className="w-full"
                                      onClick={() => saveTemplates(box.id)}
                                      disabled={processing[box.id]}
                                    >
                                      <Save className="h-4 w-4 mr-2" />
                                      テンプレートを保存
                                    </Button>
                                  </div>
                                </CardContent>
                              </CollapsibleContent>
                            </Card>
                          </Collapsible>
                        );
                      })
                    )}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </>
      )}
    </div>
  );
}
