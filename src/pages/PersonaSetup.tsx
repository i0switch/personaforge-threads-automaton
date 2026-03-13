
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PersonaForm } from "@/components/PersonaSetup/PersonaForm";
import { PersonaList } from "@/components/PersonaSetup/PersonaList";
import { PersonaWebhookSettings } from "@/components/ReplyMonitoring/PersonaWebhookSettings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePersonaLimit } from "@/hooks/usePersonaLimit";
import { PersonaLimitDialog } from "@/components/PersonaLimit/PersonaLimitDialog";
import type { Persona, PersonaFormData } from "@/types/persona";

const PersonaSetup = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { limitInfo, loading: limitLoading, refetch: refetchLimit } = usePersonaLimit();
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editingPersona, setEditingPersona] = useState<Persona | null>(null);
  const [showLimitDialog, setShowLimitDialog] = useState(false);
  const [tabValue, setTabValue] = useState<'personas' | 'webhooks'>('personas');

  useEffect(() => {
    if (user) {
      loadPersonas();
    }
  }, [user]);

  // limitInfoが更新されたときにログ出力（デバッグ用）
  useEffect(() => {
    console.log('Limit info in PersonaSetup updated:', limitInfo);
  }, [limitInfo]);

  const loadPersonas = async () => {
    try {
      const { data, error } = await supabase
        .from("personas")
        .select("*")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false });

      if (error) {
        // 認証関連のエラーの場合は静かに失敗させる
        if (error.message.includes('invalid claim') || error.message.includes('bad_jwt')) {
          console.log('Authentication error in PersonaSetup loadPersonas, setting empty personas');
          setPersonas([]);
          return;
        }
        throw error;
      }
      setPersonas(data || []);
      
      // ペルソナ読み込み後にリミット情報を強制的に再取得
      setTimeout(() => {
        refetchLimit();
      }, 100);
    } catch (error) {
      console.error("Error loading personas:", error);
      toast({
        title: "エラー",
        description: "ペルソナの読み込みに失敗しました。",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (formData: PersonaFormData) => {
    if (!user) {
      toast({
        title: "認証エラー",
        description: "ログインしていません。",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log('🔄 ペルソナ保存処理開始...');

      // 新規作成時のペルソナ上限チェック（最新の情報で再確認）
      if (!editingPersona) {
        await refetchLimit();
        
        // 再度現在のペルソナ数を直接確認
        const { data: currentPersonas, error: countError } = await supabase
          .from("personas")
          .select("id")
          .eq("user_id", user.id);

        if (countError) {
          console.error("Error checking current persona count:", countError);
          toast({
            title: "エラー",
            description: "ペルソナ数の確認に失敗しました。",
            variant: "destructive",
          });
          return;
        }

        const currentCount = currentPersonas?.length || 0;
        const limit = limitInfo?.personaLimit || 1;

        console.log(`Before creation: ${currentCount}/${limit} personas`);

        if (currentCount >= limit) {
          console.log('Persona limit reached, showing dialog');
          setShowLimitDialog(true);
          return;
        }
      }

      const expertiseArray = formData.expertise.split(',').map((item: string) => item.trim()).filter(Boolean);
      
      let personaData: any = {
        name: formData.name,
        age: formData.age || null,
        personality: formData.personality || null,
        expertise: expertiseArray,
        tone_of_voice: formData.tone_of_voice || null,
        avatar_url: formData.avatar_url?.trim() || null,
        threads_app_id: formData.threads_app_id?.trim() || null,
        threads_access_token: formData.threads_access_token?.trim() || null,
        threads_username: formData.threads_username?.trim() || null,
        webhook_verify_token: formData.webhook_verify_token?.trim() || null,
        auto_reply_enabled: formData.auto_reply_enabled || false,
        ai_auto_reply_enabled: formData.ai_auto_reply_enabled || false,
        auto_reply_delay_minutes: formData.auto_reply_delay_minutes || 0,
        user_id: user.id
      };

      // Threads Access Tokenが設定されている場合、threads_user_idを自動取得
      const accessToken = formData.threads_access_token?.trim();
      if (accessToken && accessToken !== editingPersona?.threads_access_token) {
        try {
          console.log('🔄 Threads APIからユーザーID自動取得中...');
          const res = await fetch(
            `https://graph.threads.net/v1.0/me?fields=id,username&access_token=${encodeURIComponent(accessToken)}`
          );
          if (res.ok) {
            const threadsProfile = await res.json();
            console.log('✅ Threads プロフィール取得成功:', threadsProfile);
            personaData.threads_user_id = threadsProfile.id;
            if (threadsProfile.username && !formData.threads_username?.trim()) {
              personaData.threads_username = threadsProfile.username;
            }
            toast({
              title: "Threads連携成功",
              description: `Threads User ID (${threadsProfile.id}) を自動取得しました。`,
            });
          } else {
            const errBody = await res.text();
            console.warn('⚠️ Threads API取得失敗:', res.status, errBody);
            toast({
              title: "警告",
              description: "Threads User IDの自動取得に失敗しました。トークンが正しいか確認してください。",
              variant: "destructive",
            });
          }
        } catch (fetchErr) {
          console.warn('⚠️ Threads API呼び出しエラー:', fetchErr);
        }
      }

      // threads_app_secretが入力されている場合のみ暗号化して保存
      if (formData.threads_app_secret?.trim() && formData.threads_app_secret.trim() !== "" && formData.threads_app_secret !== "***設定済み***") {
        console.log("Encrypting threads_app_secret for persona:", editingPersona?.id || 'new');

        // ペルソナIDベースの大文字キー名を生成
        const secretKeyName = `THREADS_APP_SECRET_${(editingPersona?.id || `NEW_${Date.now()}`).replace(/-/g, '_').toUpperCase()}`;
        
        const response = await supabase.functions.invoke('save-secret', {
          body: {
            keyName: secretKeyName,
            keyValue: formData.threads_app_secret
          }
        });

        if (response.error) {
          console.error("Encryption error:", response.error);
          throw new Error(response.error.message || 'APIキーの暗号化に失敗しました');
        }

        console.log("Encryption successful:", response.data);
        // save-secretはDBに保存するので、キー名を参照として保持
        personaData.threads_app_secret = secretKeyName;
      } else if (editingPersona && editingPersona.threads_app_secret) {
        personaData.threads_app_secret = editingPersona.threads_app_secret;
      }

      let personaId: string;
      
      if (editingPersona && editingPersona.id) {
        const { error } = await supabase
          .from("personas")
          .update(personaData)
          .eq("id", editingPersona.id);

        if (error) throw error;
        
        personaId = editingPersona.id;
        
        toast({
          title: "成功",
          description: "ペルソナが更新されました。",
        });
      } else {
        const { data: insertedData, error } = await supabase
          .from("personas")
          .insert([personaData])
          .select('id')
          .single();

        if (error) {
          console.error('Persona insert error:', error);
          throw error;
        }
        
        personaId = insertedData.id;
        
        toast({
          title: "成功",
          description: "ペルソナが作成されました。",
        });
      }

      // AI自動返信または定型文返信がONの場合、リプライ監視設定を自動作成
      if (formData.ai_auto_reply_enabled || formData.auto_reply_enabled) {
        // 既存のreply_check_settingsがあるかチェック
        const { data: existingSettings } = await supabase
          .from("reply_check_settings")
          .select("id")
          .eq("persona_id", personaId)
          .single();

        // 設定が存在しない場合のみ作成
        if (!existingSettings) {
          const { error: replySettingsError } = await supabase
            .from("reply_check_settings")
            .insert({
              user_id: user.id,
              persona_id: personaId,
              check_interval_minutes: 5,
              is_active: true
            });

          if (replySettingsError) {
            console.error("Error creating reply check settings:", replySettingsError);
            // リプライ設定の作成失敗は警告のみで処理を続行
            toast({
              title: "警告",
              description: "リプライ監視設定の自動作成に失敗しました。手動で設定してください。",
              variant: "destructive",
            });
          }
        }
      }

      handleCancel();
      await loadPersonas();
      await refetchLimit();
    } catch (error) {
      console.error("Error saving persona:", error);
      
      toast({
        title: "エラー",
        description: error instanceof Error ? error.message : "ペルソナの保存に失敗しました。",
        variant: "destructive",
      });
    }
  };

  const handleEdit = async (persona: Persona) => {
    console.log("Editing persona:", persona.id, "Has secret:", !!persona.threads_app_secret);
    setEditingPersona(persona);
    setIsEditing(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("このペルソナを削除してもよろしいですか？\n\n※関連する投稿、自動返信設定、スケジュール設定なども全て削除されます。")) return;

    try {
      console.log('🗑️ ペルソナ削除開始:', id);
      
      // 関連テーブルのデータを先に削除（外部キー制約がないため手動で削除）
      const relatedTables = [
        'self_reply_jobs',
        'self_reply_settings',
        'template_post_boxes',
        'auto_post_configs',
        'random_post_configs',
        'reply_check_settings',
        'scheduling_settings',
        'webhook_settings',
        'auto_replies',
        'thread_replies',
        'api_credentials',
        'posting_metrics',
        'activity_logs',
        'analytics',
        'post_queue',
        'posts'
      ];
      
      // post_queueは特別処理（persona_idではなくpost_id経由）
      const { data: postsToDelete } = await supabase
        .from('posts')
        .select('id')
        .eq('persona_id', id);
      
      if (postsToDelete && postsToDelete.length > 0) {
        const postIds = postsToDelete.map(p => p.id);
        console.log('📋 削除する投稿ID:', postIds.length, '件');
        
        const { error: queueError } = await supabase
          .from('post_queue')
          .delete()
          .in('post_id', postIds);
        
        if (queueError) {
          console.warn('post_queue削除警告:', queueError.message);
        }
      }
      
      // 各関連テーブルからデータを削除
      for (const tableName of relatedTables) {
        if (tableName === 'post_queue') continue; // 既に処理済み
        
        try {
          const { error: deleteError } = await supabase
            .from(tableName as any)
            .delete()
            .eq('persona_id', id);
          
          if (deleteError) {
            console.warn(`${tableName}削除警告:`, deleteError.message);
          } else {
            console.log(`✅ ${tableName}削除完了`);
          }
        } catch (tableError) {
          console.warn(`${tableName}削除スキップ:`, tableError);
        }
      }
      
      // 最後にペルソナ本体を削除
      const { error } = await supabase
        .from("personas")
        .delete()
        .eq("id", id);

      if (error) throw error;

      console.log('✅ ペルソナ削除完了:', id);
      
      toast({
        title: "成功",
        description: "ペルソナと関連データが削除されました。",
      });
      await loadPersonas();
      await refetchLimit();
    } catch (error) {
      console.error("Error deleting persona:", error);
      toast({
        title: "エラー",
        description: "ペルソナの削除に失敗しました。関連データが削除できない可能性があります。",
        variant: "destructive",
      });
    }
  };

  const toggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("personas")
        .update({ is_active: !currentStatus })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "成功",
        description: `ペルソナが${!currentStatus ? "有効" : "無効"}になりました。`,
      });
      loadPersonas();
    } catch (error) {
      console.error("Error toggling persona status:", error);
      toast({
        title: "エラー",
        description: "ペルソナの状態変更に失敗しました。",
        variant: "destructive",
      });
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditingPersona(null);
  };

  const handleCreateNew = async () => {
    // 新規作成前に最新の情報を取得
    await refetchLimit();
    
    // 最新の情報を待つため少し遅延
    setTimeout(async () => {
      // 現在のペルソナ数を直接確認
      const { data: currentPersonas, error: countError } = await supabase
        .from("personas")
        .select("id")
        .eq("user_id", user?.id);

      if (countError) {
        console.error("Error checking current persona count:", countError);
        toast({
          title: "エラー",
          description: "ペルソナ数の確認に失敗しました。",
          variant: "destructive",
        });
        return;
      }

      const currentCount = currentPersonas?.length || 0;
      const limit = limitInfo?.personaLimit || 1;

      console.log(`Create new check: ${currentCount}/${limit} personas`);

      if (currentCount >= limit) {
        console.log('Persona limit reached, showing dialog');
        setShowLimitDialog(true);
        return;
      }
       
      setEditingPersona({
        id: null as any,
        user_id: user?.id || '',
        name: '',
        age: null,
        personality: null,
        expertise: [],
        tone_of_voice: null,
        avatar_url: null,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        threads_app_id: null,
        threads_app_secret: null,
        threads_access_token: null,
        threads_username: null,
        threads_user_id: null,
        app_identifier: null,
        webhook_verify_token: null,
        auto_reply_enabled: false,
        ai_auto_reply_enabled: false,
        auto_reply_delay_minutes: 0,
        is_rate_limited: false,
        rate_limit_detected_at: null,
        rate_limit_reason: null,
        rate_limit_until: null,
        token_expires_at: null,
        token_refreshed_at: null
      });
      setIsEditing(true);
    }, 200);
  };

  if (loading || limitLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto p-6">
          <div className="flex justify-center p-8">読み込み中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 max-w-6xl">
        {/* Header Section */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="outline" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            戻る
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">ペルソナ設定</h1>
            <p className="text-muted-foreground mt-1">
              AIペルソナの管理とThreads API設定
            </p>
            {limitInfo && (
              <div className="mt-2">
                <p className="text-sm text-muted-foreground">
                  ペルソナ: {limitInfo.currentCount} / {limitInfo.personaLimit}
                  {!limitInfo.canCreate && (
                    <span className="text-destructive ml-2">(上限に達しています)</span>
                  )}
                </p>
                {import.meta.env.DEV && (
                  <p className="text-xs text-gray-400 mt-1">
                    Debug: canCreate={limitInfo.canCreate ? 'true' : 'false'}
                  </p>
                )}
              </div>
            )}
          </div>
          {!isEditing && (
            <Button 
              onClick={handleCreateNew} 
              size="lg"
              disabled={limitInfo && !limitInfo.canCreate}
            >
              新しいペルソナを作成
            </Button>
          )}
        </div>

        {/* Edit Form Section */}
        {isEditing && (
          <PersonaForm
            editingPersona={editingPersona}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
          />
        )}

        {/* Main Content with Tabs */}
        {!isEditing && (
          <Tabs value={tabValue} onValueChange={(v) => setTabValue(v as 'personas' | 'webhooks')} className="space-y-4">
            <TabsList>
              <TabsTrigger value="personas">ペルソナ一覧</TabsTrigger>
              <TabsTrigger value="webhooks">Webhook設定</TabsTrigger>
            </TabsList>
            
            <TabsContent value="personas" className="space-y-4">
              <h2 className="text-2xl font-semibold">登録済みペルソナ</h2>
              <PersonaList
                personas={personas}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onToggleActive={toggleActive}
                onCreateNew={handleCreateNew}
              />
            </TabsContent>
            
            <TabsContent value="webhooks" className="space-y-4">
              <h2 className="text-2xl font-semibold">Webhook設定</h2>
              <p className="text-muted-foreground">
                各ペルソナ専用のWebhook URLとVerify Tokenを確認できます。Meta for DevelopersでWebhook設定を行う際に使用してください。
              </p>
              {tabValue === 'webhooks' && <PersonaWebhookSettings />}
            </TabsContent>
          </Tabs>
        )}

        <PersonaLimitDialog
          open={showLimitDialog}
          onOpenChange={setShowLimitDialog}
          currentCount={limitInfo?.currentCount || 0}
          limit={limitInfo?.personaLimit || 1}
        />
      </div>
    </div>
  );
};

export default PersonaSetup;
