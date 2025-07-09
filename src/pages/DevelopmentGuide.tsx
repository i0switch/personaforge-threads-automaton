import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { 
  Code, 
  Database, 
  Shield, 
  Zap, 
  Users, 
  Calendar, 
  MessageSquare, 
  Settings,
  Rocket,
  CheckCircle,
  ArrowRight,
  Lightbulb,
  Target,
  Layers,
  BookOpen,
  PlayCircle,
  Download,
  ExternalLink,
  GitBranch,
  Palette,
  Server,
  Key,
  Monitor,
  Smartphone,
  Globe,
  Brain
} from "lucide-react";

// Import generated images
import aiWorkflowImage from "@/assets/ai-development-workflow.png";
import stepByStepImage from "@/assets/step-by-step-coding.png";
import architectureImage from "@/assets/app-architecture.png";

export default function DevelopmentGuide() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20 p-4">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* ヘッダー */}
        <div className="text-center space-y-6 py-12">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-primary via-primary/80 to-accent bg-clip-text text-transparent">
            ソーシャルメディア管理アプリ開発ガイド
          </h1>
          <p className="text-xl text-muted-foreground max-w-4xl mx-auto leading-relaxed">
            Lovable AIを活用した現代的なWebアプリケーション開発の完全な工程とベストプラクティス。
            プログラミング初心者でも同等の開発ができるよう、詳細なステップバイステップガイドを提供します。
          </p>
          <div className="flex justify-center gap-2 flex-wrap mb-6">
            <Badge variant="secondary" className="text-sm px-3 py-1">React</Badge>
            <Badge variant="secondary" className="text-sm px-3 py-1">TypeScript</Badge>
            <Badge variant="secondary" className="text-sm px-3 py-1">Supabase</Badge>
            <Badge variant="secondary" className="text-sm px-3 py-1">Tailwind CSS</Badge>
            <Badge variant="secondary" className="text-sm px-3 py-1">Lovable AI</Badge>
            <Badge variant="outline" className="text-sm px-3 py-1">初心者向け</Badge>
          </div>
          
          {/* Hero Image */}
          <div className="max-w-4xl mx-auto">
            <img 
              src={aiWorkflowImage} 
              alt="AI-Driven Development Workflow" 
              className="w-full rounded-lg shadow-2xl border"
            />
            <p className="text-sm text-muted-foreground mt-3">
              AIを活用した効率的な開発ワークフロー
            </p>
          </div>
        </div>

        {/* プロジェクト概要 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              プロジェクト概要
            </CardTitle>
            <CardDescription>
              複数ペルソナ対応のソーシャルメディア管理プラットフォーム
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-3">主要機能</h4>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    マルチペルソナ管理システム
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    投稿スケジューリング機能
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    AI自動返信システム
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    リアルタイム監視・分析
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    セキュリティ管理機能
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-3">技術スタック</h4>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Code className="h-4 w-4" />
                    <span className="text-sm">フロントエンド: React + TypeScript + Vite</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    <span className="text-sm">バックエンド: Supabase (PostgreSQL + Edge Functions)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4" />
                    <span className="text-sm">UI: Tailwind CSS + Shadcn/ui</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    <span className="text-sm">認証: Supabase Auth + RLS</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 初心者向け入門セクション */}
        <Card className="border-2 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              プログラミング初心者のための準備
            </CardTitle>
            <CardDescription>
              コーディング経験がなくても、このガイドに従って同等のアプリケーションを開発できます
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="prerequisites" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="prerequisites">事前準備</TabsTrigger>
                <TabsTrigger value="tools">必要ツール</TabsTrigger>
                <TabsTrigger value="concepts">基本概念</TabsTrigger>
                <TabsTrigger value="first-steps">最初の一歩</TabsTrigger>
              </TabsList>
              
              <TabsContent value="prerequisites" className="space-y-4">
                <h4 className="font-semibold">開発前に準備すべきこと</h4>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <span>Lovableアカウントの作成</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <span>Supabaseアカウントの作成</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <span>GitHubアカウントの作成（推奨）</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <span>インターネット接続環境</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <span>モダンなWebブラウザ</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <span>学習への意欲と時間</span>
                    </div>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="tools" className="space-y-4">
                <h4 className="font-semibold">開発に使用するツール</h4>
                <div className="space-y-4">
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <Brain className="h-5 w-5 text-primary" />
                      <h5 className="font-semibold">Lovable AI</h5>
                    </div>
                    <p className="text-sm text-muted-foreground">AIによるコード生成・編集プラットフォーム。自然言語でアプリケーションを開発できます。</p>
                  </div>
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <Database className="h-5 w-5 text-primary" />
                      <h5 className="font-semibold">Supabase</h5>
                    </div>
                    <p className="text-sm text-muted-foreground">バックエンド・データベース・認証を提供するBaaS（Backend as a Service）プラットフォーム。</p>
                  </div>
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <Code className="h-5 w-5 text-primary" />
                      <h5 className="font-semibold">React + TypeScript</h5>
                    </div>
                    <p className="text-sm text-muted-foreground">モダンなフロントエンド開発フレームワーク。型安全性とコンポーネントベースの開発が可能。</p>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="concepts" className="space-y-4">
                <h4 className="font-semibold">理解しておくべき基本概念</h4>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="border-l-4 border-primary pl-3">
                      <h5 className="font-medium">コンポーネント</h5>
                      <p className="text-sm text-muted-foreground">再利用可能なUI部品</p>
                    </div>
                    <div className="border-l-4 border-secondary pl-3">
                      <h5 className="font-medium">データベース</h5>
                      <p className="text-sm text-muted-foreground">情報を保存・管理する仕組み</p>
                    </div>
                    <div className="border-l-4 border-accent pl-3">
                      <h5 className="font-medium">API</h5>
                      <p className="text-sm text-muted-foreground">アプリ間でデータをやり取りする窓口</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="border-l-4 border-primary pl-3">
                      <h5 className="font-medium">認証</h5>
                      <p className="text-sm text-muted-foreground">ユーザーの身元確認とアクセス制御</p>
                    </div>
                    <div className="border-l-4 border-secondary pl-3">
                      <h5 className="font-medium">状態管理</h5>
                      <p className="text-sm text-muted-foreground">アプリ内のデータの変化を管理</p>
                    </div>
                    <div className="border-l-4 border-accent pl-3">
                      <h5 className="font-medium">デプロイ</h5>
                      <p className="text-sm text-muted-foreground">完成したアプリを公開する作業</p>
                    </div>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="first-steps" className="space-y-4">
                <h4 className="font-semibold">最初のステップ</h4>
                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-4 border rounded-lg">
                    <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">1</div>
                    <div>
                      <h5 className="font-medium">Lovableでプロジェクト作成</h5>
                      <p className="text-sm text-muted-foreground">「新規プロジェクト」→「React」テンプレートを選択</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-4 border rounded-lg">
                    <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">2</div>
                    <div>
                      <h5 className="font-medium">基本的なUIコンポーネントを作成</h5>
                      <p className="text-sm text-muted-foreground">「ログインページを作成して」と自然言語で指示</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-4 border rounded-lg">
                    <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">3</div>
                    <div>
                      <h5 className="font-medium">段階的に機能を追加</h5>
                      <p className="text-sm text-muted-foreground">一度に一つの機能に集中し、動作確認してから次へ</p>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* 開発方法論 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              Lovable AI開発方法論
            </CardTitle>
            <CardDescription>
              効率的なAI駆動開発のアプローチとベストプラクティス
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="grid md:grid-cols-3 gap-6">
                <div className="space-y-3">
                  <h4 className="font-semibold text-primary">1. 段階的開発</h4>
                  <p className="text-sm text-muted-foreground">
                    大きな機能を小さなタスクに分割し、一つずつ実装。これによりエラーを最小化し、確実な進歩を確保。
                  </p>
                </div>
                <div className="space-y-3">
                  <h4 className="font-semibold text-primary">2. 対話的設計</h4>
                  <p className="text-sm text-muted-foreground">
                    AIとの継続的な対話を通じて要件を洗練化。リアルタイムフィードバックで最適なソリューションを構築。
                  </p>
                </div>
                <div className="space-y-3">
                  <h4 className="font-semibold text-primary">3. コード品質重視</h4>
                  <p className="text-sm text-muted-foreground">
                    TypeScript、ESLint、適切なアーキテクチャパターンを活用し、保守可能で拡張性の高いコードを生成。
                  </p>
                </div>
              </div>
              
              <div className="bg-muted/30 rounded-lg p-6">
                <h4 className="font-semibold mb-4 flex items-center gap-2">
                  <PlayCircle className="h-5 w-5" />
                  実践的なAI対話例
                </h4>
                <div className="space-y-4">
                  <div className="bg-background p-4 rounded border-l-4 border-green-500">
                    <p className="text-sm"><strong>良い例:</strong> 「ユーザー登録フォームを作成して。メールアドレス、パスワード、確認用パスワードのフィールドが必要です。バリデーション機能も含めてください。」</p>
                  </div>
                  <div className="bg-background p-4 rounded border-l-4 border-red-500">
                    <p className="text-sm"><strong>避けるべき例:</strong> 「アプリを作って」「全部やって」</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* アーキテクチャ図 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              アプリケーションアーキテクチャ
            </CardTitle>
            <CardDescription>
              システム全体の構成と技術スタックの関係
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center mb-6">
              <img 
                src={architectureImage} 
                alt="Application Architecture Diagram" 
                className="w-full max-w-3xl mx-auto rounded-lg shadow-lg border"
              />
              <p className="text-sm text-muted-foreground mt-3">
                React + Supabaseによる現代的なWebアプリケーションアーキテクチャ
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 開発工程 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5" />
              詳細な開発工程 - 完全ガイド
            </CardTitle>
            <CardDescription>
              プロジェクト開始から完成までのステップバイステップ解説（初心者向け詳細版）
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* ステップバイステップ画像 */}
            <div className="text-center mb-6">
              <img 
                src={stepByStepImage} 
                alt="Step by Step Coding Guide" 
                className="w-full max-w-4xl mx-auto rounded-lg shadow-lg border"
              />
              <p className="text-sm text-muted-foreground mt-3">
                初心者でも理解できるステップバイステップ開発プロセス
              </p>
            </div>

            <Tabs defaultValue="phase1" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="phase1">基盤構築</TabsTrigger>
                <TabsTrigger value="phase2">認証システム</TabsTrigger>
                <TabsTrigger value="phase3">コア機能</TabsTrigger>
                <TabsTrigger value="phase4">高度な機能</TabsTrigger>
              </TabsList>

              <TabsContent value="phase1" className="space-y-6">
                <div className="border-l-4 border-primary pl-6">
                  <h4 className="font-semibold text-lg mb-4 text-primary">フェーズ1: プロジェクト基盤構築</h4>
                  
                  <div className="space-y-6">
                    <div className="bg-background border rounded-lg p-4">
                      <h5 className="font-semibold mb-3 flex items-center gap-2">
                        <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs">1</div>
                        Supabaseプロジェクト設定
                      </h5>
                      <div className="space-y-3 text-sm">
                        <div className="bg-muted/50 p-3 rounded">
                          <p><strong>初心者向け手順:</strong></p>
                          <ol className="list-decimal list-inside space-y-1 mt-2">
                            <li>supabase.comにアクセスしてアカウント作成</li>
                            <li>「New project」ボタンをクリック</li>
                            <li>プロジェクト名を入力（例: social-media-manager）</li>
                            <li>リージョンを選択（Asia Northeast (Tokyo)推奨）</li>
                            <li>強力なデータベースパスワードを設定</li>
                          </ol>
                        </div>
                        <div className="bg-blue-50 p-3 rounded border-l-4 border-blue-500">
                          <p><strong>Lovable AIでの指示例:</strong></p>
                          <code className="text-sm bg-blue-100 px-2 py-1 rounded">
                            "Supabaseクライアントの設定ファイルを作成して。環境変数を使って接続設定をしてください。"
                          </code>
                        </div>
                      </div>
                    </div>

                    <div className="bg-background border rounded-lg p-4">
                      <h5 className="font-semibold mb-3 flex items-center gap-2">
                        <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs">2</div>
                        React + TypeScriptプロジェクト作成
                      </h5>
                      <div className="space-y-3 text-sm">
                        <div className="bg-muted/50 p-3 rounded">
                          <p><strong>Lovableでの作業:</strong></p>
                          <ol className="list-decimal list-inside space-y-1 mt-2">
                            <li>Lovableで新規プロジェクト作成</li>
                            <li>「React TypeScript」テンプレートを選択</li>
                            <li>必要な依存関係を追加指示</li>
                          </ol>
                        </div>
                        <div className="bg-green-50 p-3 rounded border-l-4 border-green-500">
                          <p><strong>必要な指示:</strong></p>
                          <code className="text-sm bg-green-100 px-2 py-1 rounded">
                            "@supabase/supabase-js、react-router-dom、@hookform/resolversを追加して"
                          </code>
                        </div>
                      </div>
                    </div>

                    <div className="bg-background border rounded-lg p-4">
                      <h5 className="font-semibold mb-3 flex items-center gap-2">
                        <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs">3</div>
                        ルーティングとレイアウト設計
                      </h5>
                      <div className="space-y-3 text-sm">
                        <div className="bg-muted/50 p-3 rounded">
                          <p><strong>基本的なページ構成:</strong></p>
                          <ul className="list-disc list-inside space-y-1 mt-2">
                            <li>ホームページ（ダッシュボード）</li>
                            <li>ログイン・サインアップページ</li>
                            <li>ペルソナ管理ページ</li>
                            <li>投稿作成・管理ページ</li>
                            <li>設定ページ</li>
                          </ul>
                        </div>
                        <div className="bg-purple-50 p-3 rounded border-l-4 border-purple-500">
                          <p><strong>段階的指示例:</strong></p>
                          <code className="text-sm bg-purple-100 px-2 py-1 rounded">
                            "まずはヘッダーナビゲーションとサイドバーを含むレイアウトコンポーネントを作成して"
                          </code>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="phase2" className="space-y-6">
                <div className="border-l-4 border-secondary pl-6">
                  <h4 className="font-semibold text-lg mb-4 text-secondary">フェーズ2: 認証システム実装</h4>
                  
                  <div className="space-y-6">
                    <div className="bg-background border rounded-lg p-4">
                      <h5 className="font-semibold mb-3 flex items-center gap-2">
                        <div className="bg-secondary text-secondary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs">1</div>
                        Supabase Auth統合
                      </h5>
                      <div className="space-y-3 text-sm">
                        <div className="bg-muted/50 p-3 rounded">
                          <p><strong>認証の仕組み理解:</strong></p>
                          <ul className="list-disc list-inside space-y-1 mt-2">
                            <li>ユーザーがメールアドレスとパスワードで登録</li>
                            <li>Supabaseが自動でセッション管理</li>
                            <li>ログイン状態をReactで監視</li>
                          </ul>
                        </div>
                        <div className="bg-yellow-50 p-3 rounded border-l-4 border-yellow-500">
                          <p><strong>初心者向け指示:</strong></p>
                          <code className="text-sm bg-yellow-100 px-2 py-1 rounded">
                            "ログインフォームを作成して。メールとパスワード入力欄、送信ボタンが必要です。"
                          </code>
                        </div>
                      </div>
                    </div>

                    <div className="bg-background border rounded-lg p-4">
                      <h5 className="font-semibold mb-3 flex items-center gap-2">
                        <div className="bg-secondary text-secondary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs">2</div>
                        認証コンテキスト作成
                      </h5>
                      <div className="space-y-3 text-sm">
                        <div className="bg-muted/50 p-3 rounded">
                          <p><strong>なぜ必要？:</strong></p>
                          <p>アプリ全体でログイン状態を共有するため。どのページでも「誰がログインしているか」を知ることができます。</p>
                        </div>
                        <div className="bg-indigo-50 p-3 rounded border-l-4 border-indigo-500">
                          <p><strong>具体的指示:</strong></p>
                          <code className="text-sm bg-indigo-100 px-2 py-1 rounded">
                            "AuthContextを作成して、ログイン状態とユーザー情報を管理してください。"
                          </code>
                        </div>
                      </div>
                    </div>

                    <div className="bg-background border rounded-lg p-4">
                      <h5 className="font-semibold mb-3 flex items-center gap-2">
                        <div className="bg-secondary text-secondary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs">3</div>
                        プロテクトルート実装
                      </h5>
                      <div className="space-y-3 text-sm">
                        <div className="bg-muted/50 p-3 rounded">
                          <p><strong>セキュリティの基本:</strong></p>
                          <p>ログインしていないユーザーが重要なページにアクセスできないよう制限する仕組みです。</p>
                        </div>
                        <div className="bg-red-50 p-3 rounded border-l-4 border-red-500">
                          <p><strong>段階的実装:</strong></p>
                          <code className="text-sm bg-red-100 px-2 py-1 rounded">
                            "ProtectedRouteコンポーネントを作成して、ログインが必要なページを保護してください。"
                          </code>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="phase3" className="space-y-6">
                <div className="border-l-4 border-accent pl-6">
                  <h4 className="font-semibold text-lg mb-4 text-accent">フェーズ3: コア機能開発</h4>
                  
                  <div className="space-y-6">
                    <div className="bg-background border rounded-lg p-4">
                      <h5 className="font-semibold mb-3 flex items-center gap-2">
                        <div className="bg-accent text-accent-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs">1</div>
                        データベース設計
                      </h5>
                      <div className="space-y-3 text-sm">
                        <div className="bg-muted/50 p-3 rounded">
                          <p><strong>必要なテーブル:</strong></p>
                          <ul className="list-disc list-inside space-y-1 mt-2">
                            <li><code>personas</code> - ペルソナ情報</li>
                            <li><code>posts</code> - 投稿内容</li>
                            <li><code>post_queue</code> - スケジュール管理</li>
                            <li><code>profiles</code> - ユーザープロフィール</li>
                          </ul>
                        </div>
                        <div className="bg-teal-50 p-3 rounded border-l-4 border-teal-500">
                          <p><strong>初心者向けアプローチ:</strong></p>
                          <code className="text-sm bg-teal-100 px-2 py-1 rounded">
                            "まずpersonasテーブルを作成して。name、personality、avatar_urlの列が必要です。"
                          </code>
                        </div>
                      </div>
                    </div>

                    <div className="bg-background border rounded-lg p-4">
                      <h5 className="font-semibold mb-3 flex items-center gap-2">
                        <div className="bg-accent text-accent-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs">2</div>
                        ペルソナ管理機能
                      </h5>
                      <div className="space-y-3 text-sm">
                        <div className="bg-muted/50 p-3 rounded">
                          <p><strong>機能の説明:</strong></p>
                          <p>複数のソーシャルメディアキャラクター（ペルソナ）を作成・管理する機能。それぞれ異なる性格や投稿スタイルを設定できます。</p>
                        </div>
                        <div className="bg-orange-50 p-3 rounded border-l-4 border-orange-500">
                          <p><strong>段階的実装指示:</strong></p>
                          <ol className="list-decimal list-inside space-y-1 mt-2">
                            <li>"ペルソナ一覧を表示するコンポーネントを作成"</li>
                            <li>"新規ペルソナ作成フォームを追加"</li>
                            <li>"ペルソナ編集・削除機能を実装"</li>
                          </ol>
                        </div>
                      </div>
                    </div>

                    <div className="bg-background border rounded-lg p-4">
                      <h5 className="font-semibold mb-3 flex items-center gap-2">
                        <div className="bg-accent text-accent-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs">3</div>
                        投稿作成システム
                      </h5>
                      <div className="space-y-3 text-sm">
                        <div className="bg-muted/50 p-3 rounded">
                          <p><strong>必要な機能:</strong></p>
                          <ul className="list-disc list-inside space-y-1 mt-2">
                            <li>テキスト入力（文字数制限付き）</li>
                            <li>画像アップロード・生成</li>
                            <li>ハッシュタグ管理</li>
                            <li>プレビュー機能</li>
                          </ul>
                        </div>
                        <div className="bg-pink-50 p-3 rounded border-l-4 border-pink-500">
                          <p><strong>実装順序:</strong></p>
                          <ol className="list-decimal list-inside space-y-1 mt-2">
                            <li>"投稿作成フォームの基本レイアウト"</li>
                            <li>"テキストエリアと文字数カウンター"</li>
                            <li>"画像アップロード機能"</li>
                            <li>"プレビュー表示"</li>
                          </ol>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="phase4" className="space-y-6">
                <div className="border-l-4 border-destructive pl-6">
                  <h4 className="font-semibold text-lg mb-4 text-destructive">フェーズ4: 高度な機能実装</h4>
                  
                  <div className="space-y-6">
                    <div className="bg-background border rounded-lg p-4">
                      <h5 className="font-semibold mb-3 flex items-center gap-2">
                        <div className="bg-destructive text-destructive-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs">1</div>
                        スケジューリング機能
                      </h5>
                      <div className="space-y-3 text-sm">
                        <div className="bg-muted/50 p-3 rounded">
                          <p><strong>機能の仕組み:</strong></p>
                          <p>作成した投稿を指定した日時に自動投稿する機能。Supabaseのcron jobsとEdge Functionsを活用します。</p>
                        </div>
                        <div className="bg-violet-50 p-3 rounded border-l-4 border-violet-500">
                          <p><strong>初心者向け指示:</strong></p>
                          <code className="text-sm bg-violet-100 px-2 py-1 rounded">
                            "投稿に日時を設定できるカレンダーコンポーネントを追加してください。"
                          </code>
                        </div>
                      </div>
                    </div>

                    <div className="bg-background border rounded-lg p-4">
                      <h5 className="font-semibold mb-3 flex items-center gap-2">
                        <div className="bg-destructive text-destructive-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs">2</div>
                        AI自動返信システム
                      </h5>
                      <div className="space-y-3 text-sm">
                        <div className="bg-muted/50 p-3 rounded">
                          <p><strong>高度な機能の説明:</strong></p>
                          <p>投稿への返信やコメントを検知し、ペルソナの性格に合わせてAIが自動で返信する機能です。</p>
                        </div>
                        <div className="bg-cyan-50 p-3 rounded border-l-4 border-cyan-500">
                          <p><strong>段階的アプローチ:</strong></p>
                          <ol className="list-decimal list-inside space-y-1 mt-2">
                            <li>"WebhookエンドポイントをSupabase Edge Functionsで作成"</li>
                            <li>"OpenAI APIとの連携設定"</li>
                            <li>"返信生成とフィルタリング機能"</li>
                          </ol>
                        </div>
                      </div>
                    </div>

                    <div className="bg-background border rounded-lg p-4">
                      <h5 className="font-semibold mb-3 flex items-center gap-2">
                        <div className="bg-destructive text-destructive-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs">3</div>
                        監視・分析ダッシュボード
                      </h5>
                      <div className="space-y-3 text-sm">
                        <div className="bg-muted/50 p-3 rounded">
                          <p><strong>データ可視化:</strong></p>
                          <p>投稿のパフォーマンス、エンゲージメント率、返信の統計をグラフで表示します。</p>
                        </div>
                        <div className="bg-emerald-50 p-3 rounded border-l-4 border-emerald-500">
                          <p><strong>実装のコツ:</strong></p>
                          <code className="text-sm bg-emerald-100 px-2 py-1 rounded">
                            "rechartsライブラリを使って、投稿数とエンゲージメントのグラフを作成してください。"
                          </code>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* 技術的ハイライト */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              技術的ハイライトと工夫
            </CardTitle>
            <CardDescription>
              特に重要な技術的実装とその効果
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="font-semibold">データベース設計</h4>
                <ul className="space-y-2 text-sm">
                  <li>• 効率的なRLSポリシーによるマルチテナント設計</li>
                  <li>• 正規化されたスキーマと適切なインデックス</li>
                  <li>• リアルタイム更新とCron jobsの活用</li>
                  <li>• 暗号化されたAPIキー管理</li>
                </ul>
              </div>
              <div className="space-y-4">
                <h4 className="font-semibold">フロントエンド設計</h4>
                <ul className="space-y-2 text-sm">
                  <li>• コンポーネントベースの設計パターン</li>
                  <li>• カスタムフックによる状態管理</li>
                  <li>• TypeScriptによる型安全性</li>
                  <li>• レスポンシブデザインとアクセシビリティ</li>
                </ul>
              </div>
              <div className="space-y-4">
                <h4 className="font-semibold">Edge Functions活用</h4>
                <ul className="space-y-2 text-sm">
                  <li>• Webhook処理とセキュリティ検証</li>
                  <li>• OpenAI API統合とレート制限対応</li>
                  <li>• 画像生成とコンテンツ処理</li>
                  <li>• 自動スケジューリングシステム</li>
                </ul>
              </div>
              <div className="space-y-4">
                <h4 className="font-semibold">セキュリティ対策</h4>
                <ul className="space-y-2 text-sm">
                  <li>• 包括的な入力検証とサニタイゼーション</li>
                  <li>• セキュリティイベントのリアルタイム監視</li>
                  <li>• 暗号化された設定値管理</li>
                  <li>• ブルートフォース攻撃の防止</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lovable AI活用のコツ */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Lovable AI開発のベストプラクティス
            </CardTitle>
            <CardDescription>
              効果的なAI協働開発のためのヒント - 初心者から上級者まで
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="beginners" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="beginners">初心者向け</TabsTrigger>
                <TabsTrigger value="advanced">上級者向け</TabsTrigger>
                <TabsTrigger value="troubleshooting">問題解決</TabsTrigger>
              </TabsList>
              
              <TabsContent value="beginners" className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold mb-3 text-green-600">✅ 初心者におすすめの指示方法</h4>
                    <div className="space-y-3">
                      <div className="bg-green-50 p-3 rounded border">
                        <p className="text-sm font-medium">シンプルで具体的に</p>
                        <code className="text-xs text-green-700">
                          "ログインページを作成してください。メールアドレス入力欄とパスワード入力欄、ログインボタンが必要です。"
                        </code>
                      </div>
                      <div className="bg-green-50 p-3 rounded border">
                        <p className="text-sm font-medium">一つずつ確実に</p>
                        <code className="text-xs text-green-700">
                          "まずヘッダーコンポーネントだけ作成してください。ロゴとナビゲーションメニューを含めて。"
                        </code>
                      </div>
                      <div className="bg-green-50 p-3 rounded border">
                        <p className="text-sm font-medium">期待する見た目を説明</p>
                        <code className="text-xs text-green-700">
                          "カードのようなデザインで、投稿内容が読みやすく表示されるようにしてください。"
                        </code>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-3 text-red-600">❌ 初心者が避けるべき指示</h4>
                    <div className="space-y-3">
                      <div className="bg-red-50 p-3 rounded border">
                        <p className="text-sm font-medium">曖昧すぎる指示</p>
                        <code className="text-xs text-red-700">
                          "いい感じのアプリを作って"
                        </code>
                      </div>
                      <div className="bg-red-50 p-3 rounded border">
                        <p className="text-sm font-medium">複数機能を一度に</p>
                        <code className="text-xs text-red-700">
                          "ログイン、投稿作成、スケジューリング、分析を全部実装して"
                        </code>
                      </div>
                      <div className="bg-red-50 p-3 rounded border">
                        <p className="text-sm font-medium">技術用語の過度な使用</p>
                        <code className="text-xs text-red-700">
                          "レスポンシブなSPAでPWA対応のフルスタックアプリを..."
                        </code>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 p-4 rounded border-l-4 border-blue-500">
                  <h5 className="font-semibold mb-2">💡 初心者のための開発のコツ</h5>
                  <ul className="space-y-1 text-sm">
                    <li>• 機能を使ってみて、思った通りに動かなかったら具体的に説明する</li>
                    <li>• エラーが出たら、エラーメッセージをそのままコピーして伝える</li>
                    <li>• "もう少し大きく"、"色を変えて"など、見た目の修正も遠慮なく頼む</li>
                    <li>• 分からない専門用語が出てきたら、説明を求める</li>
                  </ul>
                </div>
              </TabsContent>
              
              <TabsContent value="advanced" className="space-y-6">
                <div className="space-y-4">
                  <h4 className="font-semibold text-purple-600">🚀 上級者向けテクニック</h4>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-purple-50 p-4 rounded border">
                      <h5 className="font-semibold mb-2">アーキテクチャ重視の指示</h5>
                      <code className="text-xs text-purple-700 block">
                        "カスタムフックを作成して、persona関連の状態管理をまとめてください。usePersonaManagementとして、CRUD操作を含めて。"
                      </code>
                    </div>
                    
                    <div className="bg-purple-50 p-4 rounded border">
                      <h5 className="font-semibold mb-2">パフォーマンス最適化</h5>
                      <code className="text-xs text-purple-700 block">
                        "React.memoとuseMemoを適切に使用して、投稿リストコンポーネントの再レンダリングを最適化してください。"
                      </code>
                    </div>
                    
                    <div className="bg-purple-50 p-4 rounded border">
                      <h5 className="font-semibold mb-2">型安全性の向上</h5>
                      <code className="text-xs text-purple-700 block">
                        "Supabaseの型定義を活用して、厳密な型チェックを実装してください。"
                      </code>
                    </div>
                    
                    <div className="bg-purple-50 p-4 rounded border">
                      <h5 className="font-semibold mb-2">セキュリティ強化</h5>
                      <code className="text-xs text-purple-700 block">
                        "入力値のサニタイゼーションとCSRF対策を含む、包括的なセキュリティ機能を実装してください。"
                      </code>
                    </div>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="troubleshooting" className="space-y-6">
                <h4 className="font-semibold text-orange-600">🔧 よくある問題と解決方法</h4>
                
                <div className="space-y-4">
                  <div className="border rounded-lg p-4">
                    <h5 className="font-semibold mb-2 text-red-600">エラー: コンパイルが通らない</h5>
                    <div className="bg-red-50 p-3 rounded mb-3">
                      <p className="text-sm"><strong>症状:</strong> TypeScriptエラー、importエラーなど</p>
                    </div>
                    <div className="bg-green-50 p-3 rounded">
                      <p className="text-sm"><strong>解決方法:</strong></p>
                      <ul className="list-disc list-inside text-sm space-y-1 mt-2">
                        <li>エラーメッセージをそのまま伝える</li>
                        <li>"このエラーを修正してください"と明確に依頼</li>
                        <li>どのファイルで発生しているかを指定</li>
                      </ul>
                    </div>
                  </div>
                  
                  <div className="border rounded-lg p-4">
                    <h5 className="font-semibold mb-2 text-yellow-600">問題: 期待と違う動作</h5>
                    <div className="bg-yellow-50 p-3 rounded mb-3">
                      <p className="text-sm"><strong>症状:</strong> ボタンが効かない、データが表示されないなど</p>
                    </div>
                    <div className="bg-green-50 p-3 rounded">
                      <p className="text-sm"><strong>解決方法:</strong></p>
                      <ul className="list-disc list-inside text-sm space-y-1 mt-2">
                        <li>"○○をクリックしたとき、△△になるはずが××になります"</li>
                        <li>期待する動作を具体的に説明</li>
                        <li>ブラウザのコンソールエラーも確認して共有</li>
                      </ul>
                    </div>
                  </div>
                  
                  <div className="border rounded-lg p-4">
                    <h5 className="font-semibold mb-2 text-blue-600">問題: 見た目の調整</h5>
                    <div className="bg-blue-50 p-3 rounded mb-3">
                      <p className="text-sm"><strong>症状:</strong> レイアウトが崩れる、色が気に入らないなど</p>
                    </div>
                    <div className="bg-green-50 p-3 rounded">
                      <p className="text-sm"><strong>解決方法:</strong></p>
                      <ul className="list-disc list-inside text-sm space-y-1 mt-2">
                        <li>"もう少し大きく/小さく"、"色を明るく/暗く"など感覚的な表現OK</li>
                        <li>参考にしたいデザインがあれば画像で共有</li>
                        <li>"スマホでも見やすく"など、用途を伝える</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* 実践的なリソースとツール */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              実践的なリソースとツール
            </CardTitle>
            <CardDescription>
              開発に役立つリンク、チュートリアル、リファレンス
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="space-y-4">
                <h4 className="font-semibold flex items-center gap-2">
                  <ExternalLink className="h-4 w-4" />
                  公式ドキュメント
                </h4>
                <div className="space-y-3">
                  <Button variant="outline" className="w-full justify-start" asChild>
                    <a href="https://docs.lovable.dev/" target="_blank" rel="noopener noreferrer">
                      <Globe className="h-4 w-4 mr-2" />
                      Lovable公式ドキュメント
                    </a>
                  </Button>
                  <Button variant="outline" className="w-full justify-start" asChild>
                    <a href="https://supabase.com/docs" target="_blank" rel="noopener noreferrer">
                      <Database className="h-4 w-4 mr-2" />
                      Supabaseドキュメント
                    </a>
                  </Button>
                  <Button variant="outline" className="w-full justify-start" asChild>
                    <a href="https://react.dev/" target="_blank" rel="noopener noreferrer">
                      <Code className="h-4 w-4 mr-2" />
                      React公式サイト
                    </a>
                  </Button>
                </div>
              </div>
              
              <div className="space-y-4">
                <h4 className="font-semibold flex items-center gap-2">
                  <Palette className="h-4 w-4" />
                  UIライブラリ
                </h4>
                <div className="space-y-3">
                  <Button variant="outline" className="w-full justify-start" asChild>
                    <a href="https://ui.shadcn.com/" target="_blank" rel="noopener noreferrer">
                      <Monitor className="h-4 w-4 mr-2" />
                      Shadcn/ui
                    </a>
                  </Button>
                  <Button variant="outline" className="w-full justify-start" asChild>
                    <a href="https://tailwindcss.com/" target="_blank" rel="noopener noreferrer">
                      <Palette className="h-4 w-4 mr-2" />
                      Tailwind CSS
                    </a>
                  </Button>
                  <Button variant="outline" className="w-full justify-start" asChild>
                    <a href="https://lucide.dev/" target="_blank" rel="noopener noreferrer">
                      <Smartphone className="h-4 w-4 mr-2" />
                      Lucide Icons
                    </a>
                  </Button>
                </div>
              </div>
              
              <div className="space-y-4">
                <h4 className="font-semibold flex items-center gap-2">
                  <GitBranch className="h-4 w-4" />
                  開発ツール
                </h4>
                <div className="space-y-3">
                  <Button variant="outline" className="w-full justify-start" asChild>
                    <a href="https://vitejs.dev/" target="_blank" rel="noopener noreferrer">
                      <Zap className="h-4 w-4 mr-2" />
                      Vite
                    </a>
                  </Button>
                  <Button variant="outline" className="w-full justify-start" asChild>
                    <a href="https://www.typescriptlang.org/" target="_blank" rel="noopener noreferrer">
                      <Code className="h-4 w-4 mr-2" />
                      TypeScript
                    </a>
                  </Button>
                  <Button variant="outline" className="w-full justify-start" asChild>
                    <a href="https://react-hook-form.com/" target="_blank" rel="noopener noreferrer">
                      <Settings className="h-4 w-4 mr-2" />
                      React Hook Form
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 学習成果と今後 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              学習成果と今後の展望
            </CardTitle>
            <CardDescription>
              このプロジェクトから得られる知識と応用可能性
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  技術的成果
                </h4>
                <ul className="space-y-1 text-sm">
                  <li>• 現代的なReactアーキテクチャの習得</li>
                  <li>• Supabaseエコシステムの活用</li>
                  <li>• TypeScriptによる型安全な開発</li>
                  <li>• セキュリティベストプラクティス</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-3">プロセス改善</h4>
                <ul className="space-y-1 text-sm">
                  <li>• AI駆動開発の効率化</li>
                  <li>• 段階的実装アプローチ</li>
                  <li>• 継続的な品質向上</li>
                  <li>• リアルタイムフィードバック活用</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-3">今後の拡張</h4>
                <ul className="space-y-1 text-sm">
                  <li>• より多くのプラットフォーム対応</li>
                  <li>• 高度な分析機能</li>
                  <li>• パフォーマンス最適化</li>
                  <li>• 国際化対応</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* まとめ */}
        <Card className="bg-gradient-to-r from-primary/10 to-secondary/10">
          <CardHeader>
            <CardTitle className="text-center">
              開発完了 - 次のプロジェクトへ
            </CardTitle>
            <CardDescription className="text-center max-w-2xl mx-auto">
              このガイドがLovable AIを活用した効率的なWebアプリケーション開発の参考になれば幸いです。
              継続的な学習と改善を通じて、さらに素晴らしいアプリケーションを作り上げていきましょう。
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <div className="flex justify-center items-center gap-2 text-muted-foreground">
              <MessageSquare className="h-4 w-4" />
              <span className="text-sm">Lovable AI × 開発者 = 無限の可能性</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}