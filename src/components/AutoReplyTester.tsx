import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";

export const AutoReplyTester = () => {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<any>(null);

  const testAutoReply = async () => {
    setTesting(true);
    setResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('test-auto-reply', {
        body: { replyId: '18013552598773293' }
      });
      
      if (error) {
        console.error('テスト関数エラー:', error);
        setResult({ error: error.message });
      } else {
        console.log('テスト関数結果:', data);
        setResult(data);
      }
    } catch (error) {
      console.error('テスト実行エラー:', error);
      setResult({ error: error.message });
    } finally {
      setTesting(false);
    }
  };

  const updateAutoReplySettings = async () => {
    setTesting(true);
    
    try {
      const { error } = await supabase
        .from('personas')
        .update({ auto_reply_enabled: true })
        .eq('id', '436dc662-253b-4bf7-bfac-d52c475fe238');

      if (error) {
        console.error('設定更新エラー:', error);
        setResult({ error: '設定更新に失敗しました: ' + error.message });
      } else {
        setResult({ success: true, message: 'ギャル曽根の自動返信設定を有効にしました' });
      }
    } catch (error) {
      console.error('設定更新エラー:', error);
      setResult({ error: '設定更新に失敗しました: ' + error.message });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>自動返信テスト</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button 
            onClick={testAutoReply} 
            disabled={testing}
            className="flex-1"
          >
            {testing ? 'テスト中...' : 'リプライID: 18013552598773293 をテスト'}
          </Button>
          
          <Button 
            onClick={updateAutoReplySettings} 
            disabled={testing}
            variant="outline"
          >
            自動返信設定を有効化
          </Button>
        </div>
        
        {result && (
          <div className="p-4 bg-gray-100 rounded-lg">
            <pre className="text-sm overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
};