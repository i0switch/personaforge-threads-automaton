
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { 
  ArrowLeft, 
  BookOpen, 
  Users, 
  MessageSquare, 
  Calendar, 
  Bot, 
  BarChart3, 
  Settings,
  Play,
  CheckCircle,
  AlertCircle,
  Info,
  Lightbulb,
  Zap,
  Shield,
  Key,
  Image,
  Sparkles
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const UserManual = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("getting-started");

  const steps = {
    "getting-started": [
      {
        title: "1. アカウント登録・ログイン",
        description: "まずはアカウントを作成してログインしましょう",
        icon: Shield,
        color: "bg-blue-500",
        steps: [
          "右上の「ログイン」ボタンをクリック",
          "「新規登録」タブを選択",
          "メールアドレスとパスワードを入力",
          "「登録」ボタンをクリック",
          "メールに届いた確認リンクをクリック（重要！）"
        ],
        tips: [
          "パスワードは8文字以上で、英数字を含むものにしてください",
          "メール確認を忘れるとアカウントが有効になりません"
        ]
      },
      {
        title: "2. APIキーの設定",
        description: "AI機能を使うためにAPIキーを設定します",
        icon: Key,
        color: "bg-orange-500",
        steps: [
          "画面右上の「設定」をクリック",
          "「API設定」タブを選択",
          "「Gemini API Key」の「編集」ボタンをクリック",
          "Google AI StudioでGemini APIキーを取得",
          "取得したAPIキーを入力して「保存」"
        ],
        tips: [
          "Gemini APIキーは無料で取得できます",
          "APIキーは暗号化されて安全に保存されます"
        ]
      },
      {
        title: "3. アカウント承認待ち",
        description: "管理者による承認を待ちます",
        icon: CheckCircle,
        color: "bg-green-500",
        steps: [
          "登録完了後、自動的に承認申請が送信されます",
          "承認されるまで機能は制限されます",
          "承認後にメール通知が届きます",
          "承認後、すべての機能が利用可能になります"
        ],
        tips: [
          "承認は通常24時間以内に完了します",
          "承認状況は画面上部のバナーで確認できます"
        ]
      }
    ],
    "personas": [
      {
        title: "1. ペルソナとは",
        description: "AIの性格や専門分野を設定する機能です",
        icon: Users,
        color: "bg-purple-500",
        steps: [
          "ペルソナ = AIの「キャラクター設定」",
          "投稿スタイル、口調、専門分野を定義",
          "複数のペルソナを作成可能",
          "用途に応じて使い分けできます"
        ],
        tips: [
          "明確なペルソナほど質の高い投稿が生成されます",
          "ターゲット層を意識した設定が重要です"
        ]
      },
      {
        title: "2. ペルソナの作成",
        description: "新しいペルソナを作成しましょう",
        icon: Sparkles,
        color: "bg-indigo-500",
        steps: [
          "メニューから「ペルソナ設定」をクリック",
          "「新しいペルソナを作成」をクリック",
          "基本情報を入力（名前、職業、年齢など）",
          "性格・特徴を詳しく記述",
          "話し方・口調を設定",
          "「保存」をクリック"
        ],
        tips: [
          "具体的で詳細な設定ほど効果的です",
          "実在の人物をモデルにすると作りやすいです"
        ]
      },
      {
        title: "3. 自動返信モードの設定",
        description: "ペルソナごとに自動返信を設定できます",
        icon: Bot,
        color: "bg-teal-500",
        steps: [
          "ペルソナ編集画面を開く",
          "「自動返信モード」を選択",
          "「無効」「キーワード自動返信」「AI自動返信」から選択",
          "必要に応じて詳細設定を行う",
          "設定を保存"
        ],
        tips: [
          "AI自動返信は高度ですが、使用量に注意",
          "キーワード自動返信は確実で経済的です"
        ]
      }
    ],
    "posting": [
      {
        title: "1. 投稿作成の基本",
        description: "AIを使って投稿を作成する手順",
        icon: MessageSquare,
        color: "bg-green-500",
        steps: [
          "メニューから「投稿作成」をクリック",
          "使用するペルソナを選択",
          "投稿のテーマ・キーワードを入力",
          "投稿数を指定（1-10件）",
          "「投稿を生成」をクリック",
          "生成完了まで待機"
        ],
        tips: [
          "具体的なテーマほど良い投稿が生成されます",
          "時事ネタや専門知識を活用しましょう"
        ]
      },
      {
        title: "2. 投稿の編集・レビュー",
        description: "生成された投稿を確認・編集します",
        icon: CheckCircle,
        color: "bg-blue-500",
        steps: [
          "生成された投稿一覧を確認",
          "各投稿の内容をチェック",
          "必要に応じて手動で編集",
          "不要な投稿は削除",
          "満足したら「スケジュール投稿」をクリック"
        ],
        tips: [
          "投稿前に必ず内容を確認しましょう",
          "ブランドイメージに合わない投稿は削除"
        ]
      },
      {
        title: "3. スケジュール投稿",
        description: "投稿を予約してアカウントの権限を一時的に委任",
        icon: Calendar,
        color: "bg-orange-500",
        steps: [
          "「スケジュール投稿」をクリック",
          "Threadsアカウントへのログインを求められます",
          "一時的なアクセス権限を許可",
          "投稿スケジュールが自動で作成されます",
          "「スケジュール管理」で確認・変更可能"
        ],
        tips: [
          "アクセス権限は投稿後に自動で削除されます",
          "セキュリティを最優先に設計されています"
        ]
      }
    ],
    "automation": [
      {
        title: "1. 自動返信の設定",
        description: "コメントに自動で返信する機能",
        icon: Bot,
        color: "bg-purple-500",
        steps: [
          "メニューから「自動返信」をクリック",
          "「キーワード返信を追加」セクションを使用",
          "対象のペルソナを選択",
          "反応するキーワードを入力（カンマ区切り）",
          "返信テンプレートを作成",
          "「キーワード返信を保存」をクリック"
        ],
        tips: [
          "一般的な挨拶や感謝の言葉に設定すると効果的",
          "ブランドに合った丁寧な返信を心がけましょう"
        ]
      },
      {
        title: "2. AI自動返信のテスト",
        description: "AI返信機能をテストしてみましょう",
        icon: Zap,
        color: "bg-yellow-500",
        steps: [
          "「AI自動返信テスト」セクションを使用",
          "テスト用のペルソナを選択",
          "元の投稿内容を入力",
          "受信したリプライを入力",
          "「AI返信を生成」をクリック",
          "生成された返信を確認"
        ],
        tips: [
          "実際の投稿・返信を使ってテストしましょう",
          "返信の品質を確認してから本格運用"
        ]
      },
      {
        title: "3. 返信監視の設定",
        description: "自動返信を実際に動作させる設定",
        icon: BarChart3,
        color: "bg-red-500",
        steps: [
          "メニューから「返信監視」をクリック",
          "対象のペルソナを選択",
          "WebhookURLを設定",
          "監視する投稿を指定",
          "自動返信を有効化",
          "動作ログを定期的に確認"
        ],
        tips: [
          "初期設定は少数の投稿から始めましょう",
          "返信の品質を定期的にチェック"
        ]
      }
    ]
  };

  const renderStepCard = (step: any, index: number) => (
    <Card key={index} className="mb-6 border-l-4 border-l-blue-500">
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${step.color} text-white`}>
            <step.icon className="h-5 w-5" />
          </div>
          {step.title}
        </CardTitle>
        <CardDescription className="text-base">
          {step.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <h4 className="font-semibold text-gray-800 flex items-center gap-2">
            <Play className="h-4 w-4" />
            手順
          </h4>
          <ol className="list-decimal list-inside space-y-1 text-gray-700 ml-4">
            {step.steps.map((stepItem: string, stepIndex: number) => (
              <li key={stepIndex} className="leading-relaxed">{stepItem}</li>
            ))}
          </ol>
        </div>
        
        {step.tips && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="font-semibold text-yellow-800 flex items-center gap-2 mb-2">
              <Lightbulb className="h-4 w-4" />
              ポイント・注意点
            </h4>
            <ul className="list-disc list-inside space-y-1 text-yellow-700 text-sm">
              {step.tips.map((tip: string, tipIndex: number) => (
                <li key={tipIndex}>{tip}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* ヘッダー */}
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            戻る
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <BookOpen className="h-8 w-8 text-blue-600" />
              ユーザーマニュアル
            </h1>
            <p className="text-muted-foreground text-lg">
              Threads-Genius AIの使い方を分かりやすく解説します
            </p>
          </div>
        </div>

        {/* 概要カード */}
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-800">
              <Info className="h-5 w-5" />
              このマニュアルについて
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4 text-blue-700">
              <div>
                <h4 className="font-semibold mb-2">📚 対象者</h4>
                <ul className="text-sm space-y-1">
                  <li>• 初めてAI投稿ツールを使う方</li>
                  <li>• Threads運用を自動化したい方</li>
                  <li>• 効率的なSNS運用を目指す方</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">⏱️ 所要時間</h4>
                <ul className="text-sm space-y-1">
                  <li>• 初期設定: 約15分</li>
                  <li>• 基本操作習得: 約30分</li>
                  <li>• 応用機能: 追加で30分</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* タブ付きコンテンツ */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="getting-started" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              はじめに
            </TabsTrigger>
            <TabsTrigger value="personas" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              ペルソナ設定
            </TabsTrigger>
            <TabsTrigger value="posting" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              投稿作成
            </TabsTrigger>
            <TabsTrigger value="automation" className="flex items-center gap-2">
              <Bot className="h-4 w-4" />
              自動化機能
            </TabsTrigger>
          </TabsList>

          <TabsContent value="getting-started" className="space-y-6">
            <div className="text-center py-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">🚀 はじめに</h2>
              <p className="text-gray-600">
                アカウント作成から基本設定まで、初回利用時に必要な手順を説明します
              </p>
            </div>
            {steps["getting-started"].map((step, index) => renderStepCard(step, index))}
          </TabsContent>

          <TabsContent value="personas" className="space-y-6">
            <div className="text-center py-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">🎭 ペルソナ設定</h2>
              <p className="text-gray-600">
                AIの性格や専門分野を設定して、ブランドに合った投稿を生成しましょう
              </p>
            </div>
            {steps["personas"].map((step, index) => renderStepCard(step, index))}
          </TabsContent>

          <TabsContent value="posting" className="space-y-6">
            <div className="text-center py-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">📝 投稿作成</h2>
              <p className="text-gray-600">
                AIを活用した投稿作成からスケジュール投稿まで
              </p>
            </div>
            {steps["posting"].map((step, index) => renderStepCard(step, index))}
          </TabsContent>

          <TabsContent value="automation" className="space-y-6">
            <div className="text-center py-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">🤖 自動化機能</h2>
              <p className="text-gray-600">
                自動返信や監視機能を活用して、効率的なSNS運用を実現しましょう
              </p>
            </div>
            {steps["automation"].map((step, index) => renderStepCard(step, index))}
          </TabsContent>
        </Tabs>

        {/* FAQ セクション */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              よくある質問
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible>
              <AccordionItem value="api-key">
                <AccordionTrigger>Gemini APIキーの取得方法がわからない</AccordionTrigger>
                <AccordionContent className="space-y-2">
                  <p>1. <a href="https://ai.google.dev/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Google AI Studio</a>にアクセス</p>
                  <p>2. Googleアカウントでログイン</p>
                  <p>3. 「Get API Key」をクリック</p>
                  <p>4. 新しいAPIキーを作成</p>
                  <p>5. 生成されたAPIキーをコピーして設定画面に貼り付け</p>
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="approval">
                <AccordionTrigger>承認がなかなか来ない場合は？</AccordionTrigger>
                <AccordionContent>
                  <p>通常24時間以内に承認されますが、週末や祝日の場合は遅れる可能性があります。48時間以上経過しても承認されない場合は、サポートまでお問い合わせください。</p>
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="persona-tips">
                <AccordionTrigger>効果的なペルソナの作り方は？</AccordionTrigger>
                <AccordionContent className="space-y-2">
                  <p>• <strong>具体性</strong>: 年齢、職業、性格を詳しく設定</p>
                  <p>• <strong>一貫性</strong>: 投稿スタイルを統一</p>
                  <p>• <strong>ターゲット</strong>: フォロワーの興味に合わせた専門分野</p>
                  <p>• <strong>個性</strong>: 独自の視点や価値観を含める</p>
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="safety">
                <AccordionTrigger>セキュリティは大丈夫？</AccordionTrigger>
                <AccordionContent>
                  <p>はい、セキュリティを最優先に設計されています。APIキーは暗号化して保存され、Threadsアカウントへのアクセスは投稿時のみ一時的に許可されます。投稿完了後は自動的にアクセス権限が削除されます。</p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {/* サポート情報 */}
        <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-800">
              <MessageSquare className="h-5 w-5" />
              サポート・お問い合わせ
            </CardTitle>
          </CardHeader>
          <CardContent className="text-green-700">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold mb-2">🎯 その他のご質問</h4>
                <p className="text-sm">
                  このマニュアルで解決しない問題については、サポートまでお気軽にお問い合わせください。
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">📈 機能改善のご提案</h4>
                <p className="text-sm">
                  新機能のご要望や改善点があれば、ぜひお聞かせください。継続的にサービスを向上させていきます。
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UserManual;
