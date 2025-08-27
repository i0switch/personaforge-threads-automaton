import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { enhancedSecurity } from "@/utils/enhancedSecurity";

export const AutoReplyTester = () => {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { user } = useAuth();

  const testAutoReply = async () => {
    const identifier = user?.id ?? 'anonymous';
    const exceeded = await enhancedSecurity.checkRateLimit('test_auto_reply', identifier);
    if (exceeded) {
      setResult({ error: '1分あたりのリクエスト上限に達しました。少し待ってから再度お試しください。' });
      return;
    }

    setTesting(true);
    setResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('test-auto-reply', {
        body: { replyId: '18013552598773293' }
      });
      
      if (error) {
        console.error('テスト関数エラー:', error);
        setResult({ error: error.message });
        await enhancedSecurity.logApiRequest('test_auto_reply', identifier, false);
      } else {
        console.log('テスト関数結果:', data);
        setResult(data);
        await enhancedSecurity.logApiRequest('test_auto_reply', identifier, true);
      }
    } catch (error) {
      console.error('テスト実行エラー:', error);
      setResult({ error: (error as any).message });
      await enhancedSecurity.logApiRequest('test_auto_reply', identifier, false);
    } finally {
      setTesting(false);
    }
  };

  const testAIAutoReply = async () => {
    const identifier = user?.id ?? 'anonymous';
    const exceeded = await enhancedSecurity.checkRateLimit('test_ai_auto_reply', identifier);
    if (exceeded) {
      setResult({ error: '1分あたりのリクエスト上限に達しました。少し待ってから再度お試しください。' });
      return;
    }

    setTesting(true);
    setResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('test-ai-auto-reply', {
        body: { replyId: '18090692419632273' } // 最新の「溶ける」リプライ
      });
      
      if (error) {
        console.error('AI自動返信テストエラー:', error);
        setResult({ error: error.message });
        await enhancedSecurity.logApiRequest('test_ai_auto_reply', identifier, false);
      } else {
        console.log('AI自動返信テスト結果:', data);
        setResult(data);
        await enhancedSecurity.logApiRequest('test_ai_auto_reply', identifier, true);
      }
    } catch (error) {
      console.error('AI自動返信テスト実行エラー:', error);
      setResult({ error: (error as any).message });
      await enhancedSecurity.logApiRequest('test_ai_auto_reply', identifier, false);
    } finally {
      setTesting(false);
    }
  };

  // 未処理リプライをバッチ処理
  const processUnhandledReplies = async () => {
    const identifier = user?.id ?? 'anonymous';
    const exceeded = await enhancedSecurity.checkRateLimit('process_unhandled_replies', identifier);
    if (exceeded) {
      setResult({ error: '1分あたりのリクエスト上限に達しました。少し待ってから再度お試しください。' });
      return;
    }

    setTesting(true);
    setResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('process-unhandled-replies', {
        body: {}
      });
      
      if (error) {
        console.error('未処理リプライ処理エラー:', error);
        setResult({ error: error.message });
        await enhancedSecurity.logApiRequest('process_unhandled_replies', identifier, false);
      } else {
        console.log('未処理リプライ処理結果:', data);
        setResult(data);
        await enhancedSecurity.logApiRequest('process_unhandled_replies', identifier, true);
      }
    } catch (error) {
      console.error('未処理リプライ処理実行エラー:', error);
      setResult({ error: (error as any).message });
      await enhancedSecurity.logApiRequest('process_unhandled_replies', identifier, false);
    } finally {
      setTesting(false);
    }
  };

  // リプライチェック関数をテスト
  const testCheckReplies = async () => {
    const identifier = user?.id ?? 'anonymous';
    const exceeded = await enhancedSecurity.checkRateLimit('check_replies', identifier);
    if (exceeded) {
      setResult({ error: '1分あたりのリクエスト上限に達しました。少し待ってから再度お試しください。' });
      return;
    }

    setTesting(true);
    setResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('check-replies', {
        body: {}
      });
      
      if (error) {
        console.error('リプライチェックエラー:', error);
        setResult({ error: error.message });
        await enhancedSecurity.logApiRequest('check_replies', identifier, false);
      } else {
        console.log('リプライチェック結果:', data);
        setResult(data);
        await enhancedSecurity.logApiRequest('check_replies', identifier, true);
      }
    } catch (error) {
      console.error('リプライチェック実行エラー:', error);
      setResult({ error: (error as any).message });
      await enhancedSecurity.logApiRequest('check_replies', identifier, false);
    } finally {
      setTesting(false);
    }
  };

  // 統合テスト - 完全な自動返信フローをテスト
  const runFullSystemTest = async () => {
    const identifier = user?.id ?? 'anonymous';
    const exceeded = await enhancedSecurity.checkRateLimit('comprehensive_test', identifier);
    if (exceeded) {
      setResult({ error: '1分あたりのリクエスト上限に達しました。少し待ってから再度お試しください。' });
      return;
    }

    setTesting(true);
    setResult(null);
    
    try {
      console.log('🚀 包括システムテスト開始');
      
      const { data, error } = await supabase.functions.invoke('comprehensive-auto-reply-test', {
        body: {}
      });
      
      if (error) {
        console.error('包括テストエラー:', error);
        setResult({ error: error.message });
        await enhancedSecurity.logApiRequest('comprehensive_test', identifier, false);
      } else {
        console.log('包括テスト結果:', data);
        setResult(data);
        await enhancedSecurity.logApiRequest('comprehensive_test', identifier, true);
      }
      
    } catch (error) {
      console.error('包括テスト実行エラー:', error);
      setResult({ error: (error as any).message });
      await enhancedSecurity.logApiRequest('comprehensive_test', identifier, false);
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
        <div className="grid grid-cols-1 gap-2">
          <Button 
            onClick={runFullSystemTest} 
            disabled={testing}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {testing ? 'テスト中...' : '🚀 完全システムテスト実行'}
          </Button>
          
          <div className="grid grid-cols-2 gap-2">
            <Button 
              onClick={processUnhandledReplies} 
              disabled={testing}
              variant="secondary"
            >
              {testing ? '処理中...' : '未処理リプライ処理'}
            </Button>
            
            <Button 
              onClick={testCheckReplies} 
              disabled={testing}
              variant="secondary"
            >
              {testing ? 'チェック中...' : 'リプライ監視テスト'}
            </Button>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <Button 
              onClick={testAutoReply} 
              disabled={testing}
              variant="outline"
            >
              {testing ? 'テスト中...' : '定型文返信テスト'}
            </Button>
            
            <Button 
              onClick={testAIAutoReply} 
              disabled={testing}
              variant="outline"
            >
              {testing ? 'テスト中...' : 'AI返信テスト'}
            </Button>
          </div>
          
          <Button 
            onClick={updateAutoReplySettings} 
            disabled={testing}
            variant="outline"
            size="sm"
          >
            自動返信設定を有効化
          </Button>
        </div>
        
        {result && (
          <div className="p-4 bg-muted rounded-lg">
            {typeof result === 'object' && result.testResults ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-foreground">システム健康性レポート</h3>
                  <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                    result.healthPercentage >= 80 ? 'bg-green-100 text-green-800' :
                    result.healthPercentage >= 60 ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {result.healthPercentage}%
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-background p-3 rounded border text-center">
                    <div className="text-2xl font-bold text-primary">{result.summary?.personas || 0}</div>
                    <div className="text-sm text-muted-foreground">ペルソナ</div>
                  </div>
                  <div className="bg-background p-3 rounded border text-center">
                    <div className="text-2xl font-bold text-orange-600">{result.summary?.unprocessedReplies || 0}</div>
                    <div className="text-sm text-muted-foreground">未処理リプライ</div>
                  </div>
                </div>

                {result.recommendations && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-foreground">推奨事項:</h4>
                    {result.recommendations.map((rec: string, index: number) => (
                      <div key={index} className="p-2 bg-background rounded border-l-4 border-blue-400">
                        <p className="text-sm text-foreground">{rec}</p>
                      </div>
                    ))}
                  </div>
                )}
                
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                    詳細テスト結果を表示
                  </summary>
                  <div className="mt-3 space-y-2">
                    {result.testResults?.map((step: any, index: number) => (
                      <div key={index} className="flex items-start gap-3 p-3 bg-background rounded border">
                        <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-primary text-primary-foreground">
                          {step.step}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-foreground">{step.name}</div>
                          <div className="text-sm text-muted-foreground mt-1">{step.result}</div>
                        </div>
                        <div className="flex-shrink-0">
                          <span className="text-green-500">✅</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            ) : Array.isArray(result) ? (
              <div className="space-y-3">
                <h3 className="font-semibold text-foreground mb-2">テスト結果:</h3>
                {result.map((step, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 bg-background rounded border">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-primary text-primary-foreground">
                      {step.step}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-foreground">{step.name}</div>
                      <div className={`text-sm mt-1 ${
                        step.status === 'completed' ? 'text-green-600' :
                        step.status === 'error' ? 'text-red-600' :
                        'text-yellow-600'
                      }`}>
                        {step.status === 'running' ? '実行中...' :
                         step.status === 'error' ? `エラー: ${step.error}` :
                         step.result || '完了'}
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      {step.status === 'completed' && <span className="text-green-500">✅</span>}
                      {step.status === 'error' && <span className="text-red-500">❌</span>}
                      {step.status === 'running' && <span className="text-yellow-500">⏳</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <pre className="text-sm overflow-auto whitespace-pre-wrap text-foreground">
                {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
              </pre>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export { AutoReplyTester as default };