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

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>自動返信テスト</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={testAutoReply} 
          disabled={testing}
          className="w-full"
        >
          {testing ? 'テスト中...' : 'リプライID: 18013552598773293 をテスト'}
        </Button>
        
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