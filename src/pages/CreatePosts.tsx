import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { ArrowLeft, Calendar as CalendarIcon, Sparkles, Loader2, Image as ImageIcon, Wand2, Upload, X, Check, RotateCcw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format, isValid } from "date-fns";
import { ja } from "date-fns/locale";
import type { Database } from "@/integrations/supabase/types";

type Persona = Database['public']['Tables']['personas']['Row'];
type Post = Database['public']['Tables']['posts']['Row'];

interface GeneratedPost {
  content: string;
  imagePrompt?: string;
  negativePrompt?: string;
  generatedImage?: string;
}

const CreatePosts = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { toast } = useToast();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selectedPersona, setSelectedPersona] = useState<string>("");
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [selectedTimes, setSelectedTimes] = useState<string[]>([]);
  const [topics, setTopics] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPosts, setGeneratedPosts] = useState<Post[]>([]);
  const [faceImage, setFaceImage] = useState<File | null>(null);
  const [faceImagePreview, setFaceImagePreview] = useState<string>("");

  // Track image prompts separately since they're not in the database
  const [imagePrompts, setImagePrompts] = useState<Record<string, string>>({});

  // Track uploaded images for each post
  const [postImages, setPostImages] = useState<Record<string, File | null>>({});
  const [postImagePreviews, setPostImagePreviews] = useState<Record<string, string>>({});

  // Image generation settings
  const [subject, setSubject] = useState("portrait");
  const [additionalPrompt, setAdditionalPrompt] = useState("");
  const [additionalNegative, setAdditionalNegative] = useState("blurry, low quality, distorted");
  const [cfg, setCfg] = useState([6]);
  const [ipScale, setIpScale] = useState([0.65]);
  const [steps, setSteps] = useState([20]);
  const [width, setWidth] = useState([512]);
  const [height, setHeight] = useState([768]);
  const [upscale, setUpscale] = useState(true);
  const [upFactor, setUpFactor] = useState([2]);

  // Image generation state - track per post instead of globally
  const [generatingImages, setGeneratingImages] = useState<Record<string, boolean>>({});
  
  // Add state to track posts that have had images generated and need review
  const [postsNeedingReview, setPostsNeedingReview] = useState<Set<string>>(new Set());
  const [reviewedPosts, setReviewedPosts] = useState<Set<string>>(new Set());

  // 30分間隔の時間選択肢を生成
  const timeOptions = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      timeOptions.push(timeString);
    }
  }

  useEffect(() => {
    loadPersonas();
  }, [user]);

  const loadPersonas = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('personas')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPersonas(data || []);
      if (data && data.length > 0) {
        setSelectedPersona(data[0].id);
      }
    } catch (error) {
      console.error('Error loading personas:', error);
      toast({
        title: "エラー",
        description: "ペルソナの読み込みに失敗しました。",
        variant: "destructive",
      });
    }
  };

  // Load persona avatar as default face image when persona is selected
  useEffect(() => {
    if (selectedPersona && personas.length > 0) {
      console.log('🔄 Persona changed to:', selectedPersona);
      console.log('🧹 Clearing previous generated posts');
      
      // ペルソナ変更時に以前の生成投稿をクリア
      setGeneratedPosts([]);
      setImagePrompts({});
      setPostImages({});
      setPostImagePreviews({});
      setPostsNeedingReview(new Set());
      setReviewedPosts(new Set());
      setCurrentStep(1); // ステップ1に戻す
      
      const persona = personas.find(p => p.id === selectedPersona);
      console.log('👤 Persona data:', persona?.name, persona?.id);
      
      if (persona?.avatar_url) {
        setFaceImagePreview(persona.avatar_url);
        // Convert URL to File object for API usage
        fetch(persona.avatar_url)
          .then(res => res.blob())
          .then(blob => {
            const file = new File([blob], 'persona-avatar.jpg', { type: blob.type });
            setFaceImage(file);
          })
          .catch(err => console.log('Failed to load persona avatar:', err));
      }
    }
  }, [selectedPersona, personas]);

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    
    const isSelected = selectedDates.some(d => d.toDateString() === date.toDateString());
    if (isSelected) {
      setSelectedDates(selectedDates.filter(d => d.toDateString() !== date.toDateString()));
    } else {
      setSelectedDates([...selectedDates, date]);
    }
  };

  const handleTimeToggle = (time: string) => {
    if (selectedTimes.includes(time)) {
      setSelectedTimes(selectedTimes.filter(t => t !== time));
    } else {
      setSelectedTimes([...selectedTimes, time]);
    }
  };

  const generatePosts = async () => {
    if (!selectedPersona || !topics.trim() || selectedDates.length === 0 || selectedTimes.length === 0) {
      toast({
        title: "エラー",
        description: "すべての項目を入力してください。",
        variant: "destructive",
      });
      return;
    }

    // 1時間あたりの制限チェック
    try {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const { count, error: countError } = await supabase
        .from('posts')
        .select('id', { count: 'exact', head: true })
        .eq('persona_id', selectedPersona)
        .gte('created_at', oneHourAgo.toISOString());
      
      if (countError) {
        console.error('Error checking post count:', countError);
      } else if (count && count >= 10) {
        toast({
          title: "制限に達しました",
          description: "1時間あたりの手動投稿生成上限（10件）に達しています。しばらくお待ちください。",
          variant: "destructive",
        });
        return;
      }
    } catch (error) {
      console.error('Error during rate limit check:', error);
    }

    setIsGenerating(true);
    try {
      const currentPersona = personas.find(p => p.id === selectedPersona);
      console.log('📝 Starting post generation with:', {
        personaId: selectedPersona,
        personaName: currentPersona?.name,
        topics: topics.split('\n').filter(t => t.trim()),
        selectedDates: selectedDates.map(d => format(d, 'yyyy-MM-dd')),
        selectedTimes,
        customPrompt
      });

      const { data, error } = await supabase.functions.invoke('generate-posts', {
        body: {
          personaId: selectedPersona,
          topics: topics.split('\n').filter(t => t.trim()),
          selectedDates: selectedDates.map(d => format(d, 'yyyy-MM-dd')),
          selectedTimes,
          customPrompt
        }
      });

      console.log('Generate posts response:', data);

      if (error) {
        console.error('Supabase function error:', error);
        throw error;
      }

      if (data?.success && data?.posts && data.posts.length > 0) {
        console.log('✅ Posts generated successfully');
        console.log('📊 Generated posts persona IDs:', data.posts.map(p => ({
          postId: p.id,
          personaId: p.persona_id,
          content: p.content.substring(0, 30) + '...'
        })));
        
        // 生成された投稿をセット
        setGeneratedPosts(data.posts);
        
        // Generate image prompts for each post based on content
        const prompts: Record<string, string> = {};
        for (const post of data.posts) {
          if (post && post.id && post.content) {
            try {
              const imagePrompt = await generateImagePromptFromContent(post.content);
              prompts[post.id] = imagePrompt;
            } catch (error) {
              console.error('Failed to generate image prompt for post:', post.id, error);
              // Fallback to a default selfie prompt
              prompts[post.id] = "selfie photo, smiling woman, casual outfit, natural lighting, morning time, cozy atmosphere";
            }
          }
        }
        setImagePrompts(prompts);
        
        // ステップ2（生成・編集）に進む
        setCurrentStep(2);

        toast({
          title: "成功",
          description: `${data.posts.length}件の投稿を生成しました。`,
        });
      } else {
        throw new Error('投稿の生成に失敗しました');
      }
    } catch (error) {
      console.error('Error generating posts:', error);
      
      // Gemini APIキーエラーの特別処理
      if (error?.message?.includes('GEMINI_API_KEY_REQUIRED')) {
        toast({
          title: "Gemini APIキーが必要です",
          description: "Settings > API設定からGemini APIキーを設定してください。",
          variant: "destructive",
        });
      } else {
        toast({
          title: "エラー",
          description: "投稿の生成に失敗しました。詳細はコンソールを確認してください。",
          variant: "destructive",
        });
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const generateImagePromptFromContent = async (postContent: string): Promise<string> => {
    try {
      console.log('Generating image prompt for content:', postContent);
      
      const { data, error } = await supabase.functions.invoke('generate-image-prompt', {
        body: {
          postContent: postContent
        }
      });

      if (error) {
        console.error('Error generating image prompt:', error);
        
        // Gemini APIキーエラーの場合は特別なメッセージを表示
        if (error.message && error.message.includes('GEMINI_API_KEY_REQUIRED')) {
          toast({
            title: "Gemini APIキーが必要です",
            description: "Settings > API設定からGemini APIキーを設定してください",
            variant: "destructive",
          });
        }
        
        throw error;
      }

      if (data?.success && data?.imagePrompt) {
        console.log('Generated image prompt:', data.imagePrompt);
        return data.imagePrompt;
      } else {
        throw new Error('Failed to generate image prompt');
      }
    } catch (error) {
      console.error('Error in generateImagePromptFromContent:', error);
      throw error;
    }
  };

  const updatePost = (index: number, content: string) => {
    const updatedPosts = [...generatedPosts];
    updatedPosts[index] = { ...updatedPosts[index], content };
    setGeneratedPosts(updatedPosts);
  };

  const deletePost = (index: number) => {
    const post = generatedPosts[index];
    if (post?.id) {
      // Remove associated image data
      const newPostImages = { ...postImages };
      const newPostImagePreviews = { ...postImagePreviews };
      delete newPostImages[post.id];
      delete newPostImagePreviews[post.id];
      setPostImages(newPostImages);
      setPostImagePreviews(newPostImagePreviews);
      
      // Remove from review tracking
      setPostsNeedingReview(prev => {
        const newSet = new Set(prev);
        newSet.delete(post.id);
        return newSet;
      });
      setReviewedPosts(prev => {
        const newSet = new Set(prev);
        newSet.delete(post.id);
        return newSet;
      });
    }
    setGeneratedPosts(generatedPosts.filter((_, i) => i !== index));
  };

  const proceedToImageGeneration = () => {
    console.log('Proceeding to image generation step');
    console.log('Posts needing image generation:', postsForImageGeneration.length);
    console.log('Posts with uploaded images:', generatedPosts.filter(post => postImagePreviews[post.id]).length);
    console.log('Posts with generated images:', generatedPosts.filter(post => post.images && post.images.length > 0).length);
    setCurrentStep(3);
  };

  const scheduleAllPosts = async () => {
    if (generatedPosts.length === 0) return;

    try {
      console.log('=== Saving posts with images ===');
      
      // Update posts with uploaded or generated images
      const updatedPosts = await Promise.all(generatedPosts.map(async (post) => {
        let images: string[] = [];

        console.log(`Processing post ${post.id}:`);
        console.log('- Has uploaded image:', !!postImagePreviews[post.id]);
        console.log('- Has generated images:', post.images?.length || 0);

        // Check if there's an uploaded image (takes priority)
        if (postImagePreviews[post.id]) {
          images = [postImagePreviews[post.id]];
          console.log('- Using uploaded image');
        }
        // Check if there's a generated image
        else if (post.images && post.images.length > 0) {
          images = post.images;
          console.log('- Using generated images:', images.length);
        }

        // Update the post in the database with the images
        if (images.length > 0) {
          console.log('- Updating database with images');
          const { error } = await supabase
            .from('posts')
            .update({ images })
            .eq('id', post.id);
          
          if (error) {
            console.error('Error updating post images:', error);
          } else {
            console.log('- Database updated successfully');
          }
        }

        return {
          ...post,
          images
        };
      }));

      // 生成された投稿から persona_id を取得（状態よりも信頼性が高い）
      const personaIdFromPost = generatedPosts[0]?.persona_id;
      console.log('=== 📋 Navigating to review-posts ===');
      console.log('🎯 Persona ID from generated post:', personaIdFromPost);
      console.log('🔄 Selected persona state:', selectedPersona);
      console.log('📝 All post persona IDs:', updatedPosts.map(p => p.persona_id));
      
      const selectedPersonaData = personas.find(p => p.id === personaIdFromPost);
      
      console.log('✅ Updated posts count:', updatedPosts.length);
      console.log('👤 Persona data:', {
        name: selectedPersonaData?.name,
        id: selectedPersonaData?.id,
        found: !!selectedPersonaData
      });
      
      // Make sure we have valid data before navigation
      if (!selectedPersonaData) {
        throw new Error('Selected persona not found');
      }

      if (updatedPosts.length === 0) {
        throw new Error('No posts to save');
      }

      navigate("/review-posts", {
        state: {
          posts: updatedPosts,
          persona: selectedPersonaData
        }
      });
    } catch (error) {
      console.error('Error saving posts:', error);
      toast({
        title: "エラー",
        description: `投稿の保存に失敗しました: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const handleFaceImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFaceImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setFaceImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePostImageChange = (postId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPostImages(prev => ({ ...prev, [postId]: file }));
      const reader = new FileReader();
      reader.onloadend = () => {
        setPostImagePreviews(prev => ({ ...prev, [postId]: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const removePostImage = (postId: string) => {
    setPostImages(prev => {
      const newImages = { ...prev };
      delete newImages[postId];
      return newImages;
    });
    setPostImagePreviews(prev => {
      const newPreviews = { ...prev };
      delete newPreviews[postId];
      return newPreviews;
    });
  };

  const updateImagePrompt = (postId: string, newPrompt: string) => {
    setImagePrompts(prev => ({
      ...prev,
      [postId]: newPrompt
    }));
  };

  const generateImageForPost = async (postIndex: number) => {
    const post = generatedPosts[postIndex];
    
    console.log('=== Starting image generation ===');
    console.log('Post:', post);
    console.log('Post ID:', post.id);
    
    if (!faceImage && !faceImagePreview) {
      toast({
        title: "エラー",
        description: "リファレンス画像をアップロードしてください。",
        variant: "destructive",
      });
      return;
    }

    // Set generating state for this specific post
    setGeneratingImages(prev => ({ ...prev, [post.id]: true }));
    
    try {
      console.log('Starting image generation for post:', postIndex);
      
      // Convert image to base64 string for Edge Function
      let imageBase64: string;
      
      if (faceImage) {
        console.log('Converting File to base64:', faceImage.name, faceImage.type, faceImage.size);
        const reader = new FileReader();
        imageBase64 = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(faceImage);
        });
      } else if (faceImagePreview) {
        console.log('Using preview URL as base64');
        imageBase64 = faceImagePreview;
      } else {
        throw new Error('No image available');
      }

      // Get the generated prompt for this specific post
      const postPrompt = imagePrompts[post.id] || "selfie photo, smiling woman, casual outfit, natural lighting, morning time, cozy atmosphere";
      console.log('Using image prompt for this post:', postPrompt);

      const requestBody = {
        space_url: "i0switch/my-image-generator",
        face_image: imageBase64,
        subject: postPrompt, // Use the generated prompt instead of fixed subject
        add_prompt: additionalPrompt || "",
        add_neg: additionalNegative || "blurry, low quality, distorted",
        cfg: cfg[0],
        ip_scale: ipScale[0],
        steps: steps[0],
        w: width[0],
        h: height[0],
        upscale: upscale,
        up_factor: upFactor[0]
      };

      console.log('Sending request to generate-image-gradio with generated prompt');

      const { data, error } = await supabase.functions.invoke('generate-image-gradio', {
        body: requestBody
      });

      console.log('Image generation response:', data);

      if (error) {
        console.error('Image generation error:', error);
        throw error;
      }

      if (data?.success && data?.image) {
        // Extract the URL from the Gradio image object
        let imageUrl: string;
        
        if (typeof data.image === 'string') {
          // If it's already a string (URL or base64), use it directly
          imageUrl = data.image;
        } else if (data.image.url) {
          // If it's a Gradio file object with URL property
          imageUrl = data.image.url;
        } else if (data.image.path) {
          // If it only has path, construct the URL
          imageUrl = `https://i0switch-my-image-generator.hf.space/gradio_api/file=${data.image.path}`;
        } else {
          throw new Error('Unable to extract image URL from response');
        }

        console.log('Extracted image URL:', imageUrl);

        // Update the specific post with the generated image using the images array
        const updatedPosts = [...generatedPosts];
        updatedPosts[postIndex] = { 
          ...updatedPosts[postIndex], 
          images: [imageUrl] 
        };
        setGeneratedPosts(updatedPosts);

        // ALWAYS mark this post as needing review after generation
        console.log('Marking post as needing review:', post.id);
        setPostsNeedingReview(prev => {
          const newSet = new Set(prev);
          newSet.add(post.id);
          console.log('Updated posts needing review:', Array.from(newSet));
          return newSet;
        });

        // Remove from reviewed posts if it was previously reviewed
        setReviewedPosts(prev => {
          const newSet = new Set(prev);
          newSet.delete(post.id);
          console.log('Removed from reviewed posts:', Array.from(newSet));
          return newSet;
        });

        toast({
          title: "成功",
          description: "画像を生成しました。確認してください。",
        });
      } else {
        throw new Error('画像の生成に失敗しました');
      }
    } catch (error) {
      console.error('Error generating image:', error);
      toast({
        title: "エラー",
        description: "画像の生成に失敗しました。",
        variant: "destructive",
      });
    } finally {
      // Clear generating state for this specific post
      setGeneratingImages(prev => ({ ...prev, [post.id]: false }));
    }
  };

  // Handle image approval (keep the generated image)
  const approveGeneratedImage = (postId: string) => {
    console.log('=== Approving generated image ===');
    console.log('Post ID:', postId);
    
    setReviewedPosts(prev => {
      const newSet = new Set(prev);
      newSet.add(postId);
      console.log('After approval - Reviewed posts:', Array.from(newSet));
      return newSet;
    });
    
    setPostsNeedingReview(prev => {
      const newSet = new Set(prev);
      newSet.delete(postId);
      console.log('After approval - Posts needing review:', Array.from(newSet));
      return newSet;
    });
    
    toast({
      title: "承認済み",
      description: "生成された画像を使用します。",
    });
  };

  // Handle image regeneration
  const regenerateImage = (postIndex: number) => {
    const post = generatedPosts[postIndex];
    
    console.log('=== Regenerating image ===');
    console.log('Post ID:', post.id);
    
    // Remove from review tracking
    setPostsNeedingReview(prev => {
      const newSet = new Set(prev);
      newSet.delete(post.id);
      console.log('After regeneration - Posts needing review:', Array.from(newSet));
      return newSet;
    });
    setReviewedPosts(prev => {
      const newSet = new Set(prev);
      newSet.delete(post.id);
      console.log('After regeneration - Reviewed posts:', Array.from(newSet));
      return newSet;
    });
    
    // Regenerate the image
    generateImageForPost(postIndex);
  };

  const selectedPersonaData = personas.find(p => p.id === selectedPersona);

  // Filter posts that don't have uploaded images for step 3
  const postsForImageGeneration = generatedPosts.filter((post, index) => {
    const hasUploadedImage = postImagePreviews[post.id];
    const hasGeneratedImage = post.images && post.images.length > 0;
    console.log(`Post ${post.id}: hasUploaded=${!!hasUploadedImage}, hasGenerated=${!!hasGeneratedImage}`);
    return !hasUploadedImage && !hasGeneratedImage;
  });

  // Check if all generated images have been reviewed
  const allImagesReviewed = generatedPosts.every(post => {
    const hasUploadedImage = postImagePreviews[post.id];
    const hasGeneratedImage = post.images && post.images.length > 0;
    const isReviewed = reviewedPosts.has(post.id);
    const needsReview = postsNeedingReview.has(post.id);
    
    console.log(`Post ${post.id}: hasUploaded=${!!hasUploadedImage}, hasGenerated=${!!hasGeneratedImage}, isReviewed=${isReviewed}, needsReview=${needsReview}`);
    
    // If post has uploaded image, it's considered "reviewed"
    if (hasUploadedImage) return true;
    
    // If post has no generated image, it doesn't need review
    if (!hasGeneratedImage) return true;
    
    // If post has generated image and needs review, it must be explicitly approved
    if (hasGeneratedImage && needsReview) return false;
    
    // If post has generated image and was reviewed, it's approved
    return isReviewed;
  });

  console.log('=== Current State Debug ===');
  console.log('Posts needing review:', Array.from(postsNeedingReview));
  console.log('Reviewed posts:', Array.from(reviewedPosts));
  console.log('Posts for image generation:', postsForImageGeneration.length);
  console.log('All images reviewed:', allImagesReviewed);

  // Helper function to safely format date - Fixed timezone handling
  const formatScheduledDate = (scheduledFor: string | null): string => {
    if (!scheduledFor) return '投稿時刻未設定';
    
    try {
      const date = new Date(scheduledFor);
      if (!isValid(date)) {
        console.error('Invalid date:', scheduledFor);
        return '投稿時刻エラー';
      }
      
      // The date is already in the correct timezone (JST) from the backend
      // No need for additional timezone conversion
      return format(date, 'M月d日 HH:mm', { locale: ja });
    } catch (error) {
      console.error('Error formatting date:', error, scheduledFor);
      return '投稿時刻エラー';
    }
  };

  // Show loading state while authentication is being checked
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="text-muted-foreground">認証確認中...</p>
        </div>
      </div>
    );
  }

  // Redirect to auth if not authenticated
  if (!user) {
    navigate('/auth');
    return null;
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            戻る
          </Button>
          <div>
            <h1 className="text-3xl font-bold">新規投稿作成</h1>
            <p className="text-muted-foreground">AIでThreads投稿を一括生成</p>
          </div>
        </div>

        {/* ステップインジケーター */}
        <div className="flex items-center justify-center space-x-8 py-4">
          <div className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-medium ${currentStep === 1 ? 'bg-primary' : currentStep > 1 ? 'bg-green-500' : 'bg-gray-300'}`}>
              1
            </div>
            <span className="ml-2 font-medium">設定</span>
          </div>
          <div className={`flex-1 h-0.5 ${currentStep > 1 ? 'bg-green-500' : 'bg-gray-300'}`}></div>
          <div className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-medium ${currentStep === 2 ? 'bg-primary' : currentStep > 2 ? 'bg-green-500' : 'bg-gray-300'}`}>
              2
            </div>
            <span className="ml-2 font-medium">生成・編集</span>
          </div>
          <div className={`flex-1 h-0.5 ${currentStep > 2 ? 'bg-green-500' : 'bg-gray-300'}`}></div>
          <div className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-medium ${currentStep === 3 ? 'bg-primary' : 'bg-gray-300'}`}>
              3
            </div>
            <span className="ml-2 font-medium">画像生成</span>
          </div>
        </div>

        {/* ステップ1: 設定 */}
        {currentStep === 1 && (
          <div className="space-y-6">
            {/* ペルソナ選択 */}
            <Card>
              <CardHeader>
                <CardTitle>ペルソナ選択</CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={selectedPersona} onValueChange={setSelectedPersona}>
                  <SelectTrigger>
                    <SelectValue placeholder="ペルソナを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {personas.map((persona) => (
                      <SelectItem key={persona.id} value={persona.id}>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={persona.avatar_url || ""} />
                            <AvatarFallback>{persona.name[0]}</AvatarFallback>
                          </Avatar>
                          {persona.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedPersonaData && (
                  <div className="p-3 bg-muted rounded-lg mt-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={selectedPersonaData.avatar_url || ""} />
                        <AvatarFallback>{selectedPersonaData.name[0]}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{selectedPersonaData.name}</span>
                    </div>
                    {selectedPersonaData.personality && (
                      <p className="text-sm text-muted-foreground">{selectedPersonaData.personality}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5" />
                  投稿日選択
                </CardTitle>
                <CardDescription>
                  投稿したい日付を選択してください（複数選択可能）
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex justify-center">
                  <Calendar
                    mode="multiple"
                    selected={selectedDates}
                    onSelect={(dates) => setSelectedDates(dates || [])}
                    disabled={(date) => date < new Date()}
                    className="rounded-md border w-full"
                  />
                </div>
                {selectedDates.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm font-medium mb-2">選択された日付:</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedDates.map((date, index) => (
                        <span key={index} className="bg-primary/10 text-primary px-2 py-1 rounded text-sm">
                          {format(date, 'MM/dd', { locale: ja })}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>投稿時間選択</CardTitle>
                <CardDescription>
                  投稿したい時間を選択してください（30分間隔）
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto">
                  {timeOptions.map((time) => (
                    <div key={time} className="flex items-center space-x-2">
                      <Checkbox
                        id={time}
                        checked={selectedTimes.includes(time)}
                        onCheckedChange={() => handleTimeToggle(time)}
                      />
                      <label htmlFor={time} className="text-sm font-medium">
                        {time}
                      </label>
                    </div>
                  ))}
                </div>
                {selectedTimes.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm font-medium mb-2">選択された時間: {selectedTimes.length}件</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>投稿内容</CardTitle>
                <CardDescription>
                  投稿したいトピックを入力してください（1行1トピック）
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>投稿トピック</Label>
                  <Textarea
                    placeholder="例：&#10;今日の朝活について&#10;おすすめのカフェ紹介&#10;仕事の効率化ツール"
                    value={topics}
                    onChange={(e) => setTopics(e.target.value)}
                    rows={4}
                  />
                </div>
                <div>
                  <Label>カスタムプロンプト（オプション）</Label>
                  <Textarea
                    placeholder="特別な指示があれば入力してください"
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            <Button 
              onClick={generatePosts} 
              disabled={isGenerating || !topics.trim() || !selectedPersona || selectedDates.length === 0 || selectedTimes.length === 0}
              className="w-full"
              size="lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  投稿を生成
                </>
              )}
            </Button>
          </div>
        )}

        {/* ステップ2: 生成・編集 */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>生成された投稿</CardTitle>
                <CardDescription>投稿内容を確認・編集し、画像をアップロードできます</CardDescription>
              </CardHeader>
            </Card>

            <div className="space-y-4">
              {generatedPosts.map((post, index) => (
                <Card key={index}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">
                        投稿予定: {formatScheduledDate(post.scheduled_for)}
                      </CardTitle>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => deletePost(index)}
                      >
                        削除
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Textarea
                      value={post.content}
                      onChange={(e) => updatePost(index, e.target.value)}
                      rows={4}
                      placeholder="投稿内容を編集..."
                    />

                    <div className="space-y-2">
                      <Label>投稿画像（オプション）</Label>
                      {postImagePreviews[post.id] ? (
                        <div className="relative">
                          <img
                            src={postImagePreviews[post.id]}
                            alt="Uploaded"
                            className="w-full max-w-md mx-auto rounded-lg border"
                          />
                          <Button
                            size="sm"
                            variant="destructive"
                            className="absolute top-2 right-2"
                            onClick={() => removePostImage(post.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : post.images && post.images.length > 0 ? (
                        <div className="relative">
                          <img
                            src={post.images[0]}
                            alt="Generated"
                            className="w-full max-w-md mx-auto rounded-lg border"
                          />
                        </div>
                      ) : (
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                          <div className="text-center">
                            <Upload className="mx-auto h-12 w-12 text-gray-400" />
                            <div className="mt-2">
                              <Input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handlePostImageChange(post.id, e)}
                                className="hidden"
                                id={`image-upload-${post.id}`}
                              />
                              <Label
                                htmlFor={`image-upload-${post.id}`}
                                className="cursor-pointer inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90"
                              >
                                <Upload className="h-4 w-4 mr-2" />
                                画像をアップロード
                              </Label>
                            </div>
                            <p className="mt-1 text-sm text-gray-500">
                              JPG, PNG, GIF up to 10MB
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex gap-4">
              <Button 
                onClick={() => setCurrentStep(1)}
                variant="outline"
                className="flex-1"
                size="lg"
              >
                設定に戻る
              </Button>
              <Button 
                onClick={scheduleAllPosts}
                variant="outline"
                className="flex-1"
                size="lg"
                disabled={generatedPosts.length === 0}
              >
                投稿を保存
              </Button>
              {postsForImageGeneration.length > 0 && (
                <Button 
                  onClick={proceedToImageGeneration}
                  className="flex-1"
                  size="lg"
                  disabled={generatedPosts.length === 0}
                >
                  <ImageIcon className="h-4 w-4 mr-2" />
                  画像を生成
                </Button>
              )}
            </div>
          </div>
        )}

        {/* ステップ3: 画像生成 */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <Card className="bg-blue-50 border border-blue-200">
              <CardContent className="p-4">
                <div className="flex items-start gap-2">
                  <div className="text-blue-500 mt-0.5">ℹ️</div>
                  <div className="text-sm text-blue-700">
                    <strong>HuggingFace Spaces + Gemini APIを使用</strong><br />
                    投稿内容をGemini APIが解析し、画像生成プロンプトを自動生成します。リファレンス画像をアップロードすると、その人物の顔で画像が生成されます。
                  </div>
                </div>
              </CardContent>
            </Card>

            {postsForImageGeneration.length === 0 && postsNeedingReview.size === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <ImageIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <p className="text-lg font-medium text-gray-600 mb-2">画像生成が必要な投稿がありません</p>
                  <p className="text-sm text-gray-500 mb-4">すべての投稿に画像がアップロードされているか、生成済みです。</p>
                  <div className="flex gap-4 justify-center">
                    <Button onClick={() => setCurrentStep(2)} variant="outline">
                      編集に戻る
                    </Button>
                    <Button 
                      onClick={scheduleAllPosts}
                      disabled={!allImagesReviewed}
                    >
                      {!allImagesReviewed ? '画像確認が未完了' : '投稿を保存'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* リファレンス画像アップロード */}
                <Card>
                  <CardHeader>
                    <CardTitle>リファレンス画像</CardTitle>
                    <CardDescription>
                      画像生成に使用するリファレンス画像（デフォルト：ペルソナのアバター）
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={handleFaceImageChange}
                      />
                      {faceImagePreview && (
                        <div>
                          <img
                            src={faceImagePreview}
                            alt="Reference"
                            className="w-32 h-32 object-cover rounded-lg border"
                          />
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* 画像生成設定 */}
                <Card>
                  <CardHeader>
                    <CardTitle>画像生成設定</CardTitle>
                    <CardDescription>
                      画像生成のパラメータを調整できます
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>被写体説明</Label>
                        <Input
                          value={subject}
                          onChange={(e) => setSubject(e.target.value)}
                          placeholder="例: portrait, business person"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>追加プロンプト</Label>
                        <Input
                          value={additionalPrompt}
                          onChange={(e) => setAdditionalPrompt(e.target.value)}
                          placeholder="追加の説明を入力"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>追加ネガティブ</Label>
                      <Textarea
                        value={additionalNegative}
                        onChange={(e) => setAdditionalNegative(e.target.value)}
                        placeholder="避けたい要素を入力"
                        rows={2}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label>CFG: {cfg[0]}</Label>
                        <Slider
                          value={cfg}
                          onValueChange={setCfg}
                          min={1}
                          max={20}
                          step={0.5}
                          className="w-full"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>IP-Adapter scale: {ipScale[0]}</Label>
                        <Slider
                          value={ipScale}
                          onValueChange={setIpScale}
                          min={0}
                          max={1}
                          step={0.05}
                          className="w-full"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Steps: {steps[0]}</Label>
                        <Slider
                          value={steps}
                          onValueChange={setSteps}
                          min={1}
                          max={50}
                          step={1}
                          className="w-full"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>幅: {width[0]}px</Label>
                        <Slider
                          value={width}
                          onValueChange={setWidth}
                          min={256}
                          max={1024}
                          step={64}
                          className="w-full"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>高さ: {height[0]}px</Label>
                        <Slider
                          value={height}
                          onValueChange={setHeight}
                          min={256}
                          max={1024}
                          step={64}
                          className="w-full"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>倍率: {upFactor[0]}x</Label>
                        <Slider
                          value={upFactor}
                          onValueChange={setUpFactor}
                          min={1}
                          max={4}
                          step={1}
                          className="w-full"
                        />
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="upscale"
                        checked={upscale}
                        onCheckedChange={(checked) => setUpscale(checked === true)}
                      />
                      <Label htmlFor="upscale">アップスケールを有効にする</Label>
                    </div>
                  </CardContent>
                </Card>

                {/* 画像生成が必要な投稿 */}
                {postsForImageGeneration.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">画像生成が必要な投稿</h3>
                    {postsForImageGeneration.map((post, originalIndex) => {
                      const actualIndex = generatedPosts.findIndex(p => p.id === post.id);
                      
                      return (
                        <Card key={post.id}>
                          <CardHeader>
                            <CardTitle className="text-lg">
                              投稿予定: {formatScheduledDate(post.scheduled_for)}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div>
                              <p className="text-sm text-muted-foreground mb-2">投稿内容:</p>
                              <p className="text-sm bg-muted p-3 rounded">{post.content}</p>
                            </div>
                            
                            <div>
                              <p className="text-sm font-medium mb-2">画像プロンプト（編集可能）</p>
                              <Textarea
                                value={imagePrompts[post.id] || "selfie photo, smiling woman, casual outfit, natural lighting, morning time, cozy atmosphere"}
                                onChange={(e) => updateImagePrompt(post.id, e.target.value)}
                                rows={3}
                                className="text-sm"
                                placeholder="画像生成に使用するプロンプトを編集してください"
                              />
                            </div>

                            <Button 
                              onClick={() => generateImageForPost(actualIndex)}
                              disabled={generatingImages[post.id] || (!faceImage && !faceImagePreview)}
                              className="w-full" 
                              size="lg"
                            >
                              {generatingImages[post.id] ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  画像生成中...
                                </>
                              ) : (
                                <>
                                  <ImageIcon className="h-4 w-4 mr-2" />
                                  画像生成
                                </>
                              )}
                            </Button>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}

                {/* 確認が必要な生成済み画像 */}
                {Array.from(postsNeedingReview).length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">生成画像の確認</h3>
                    {Array.from(postsNeedingReview).map(postId => {
                      const post = generatedPosts.find(p => p.id === postId);
                      const actualIndex = generatedPosts.findIndex(p => p.id === postId);
                      
                      if (!post) return null;
                      
                      return (
                        <Card key={postId}>
                          <CardHeader>
                            <CardTitle className="text-lg">
                              投稿予定: {formatScheduledDate(post.scheduled_for)}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div>
                              <p className="text-sm text-muted-foreground mb-2">投稿内容:</p>
                              <p className="text-sm bg-muted p-3 rounded">{post.content}</p>
                            </div>
                            
                            {post.images && post.images.length > 0 && (
                              <div className="space-y-4">
                                <div className="border rounded-lg p-2">
                                  <img
                                    src={post.images[0]}
                                    alt="Generated"
                                    className="w-full max-w-md mx-auto rounded"
                                  />
                                </div>
                                
                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                  <p className="text-sm font-medium text-yellow-800 mb-3">
                                    生成された画像を確認してください
                                  </p>
                                  <div className="flex gap-2">
                                    <Button
                                      onClick={() => approveGeneratedImage(post.id)}
                                      size="sm"
                                      className="flex-1"
                                    >
                                      <Check className="h-4 w-4 mr-2" />
                                      この画像を使用
                                    </Button>
                                    <Button
                                      onClick={() => regenerateImage(actualIndex)}
                                      variant="outline"
                                      size="sm"
                                      className="flex-1"
                                      disabled={generatingImages[post.id]}
                                    >
                                      {generatingImages[post.id] ? (
                                        <>
                                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                          再生成中...
                                        </>
                                      ) : (
                                        <>
                                          <RotateCcw className="h-4 w-4 mr-2" />
                                          再生成
                                        </>
                                      )}
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}

                {/* 承認済み画像の表示 */}
                {Array.from(reviewedPosts).length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">承認済み画像</h3>
                    {Array.from(reviewedPosts).map(postId => {
                      const post = generatedPosts.find(p => p.id === postId);
                      const actualIndex = generatedPosts.findIndex(p => p.id === postId);
                      
                      if (!post || !post.images || post.images.length === 0) return null;
                      
                      return (
                        <Card key={postId}>
                          <CardHeader>
                            <CardTitle className="text-lg">
                              投稿予定: {formatScheduledDate(post.scheduled_for)}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div>
                              <p className="text-sm text-muted-foreground mb-2">投稿内容:</p>
                              <p className="text-sm bg-muted p-3 rounded">{post.content}</p>
                            </div>
                            
                            <div className="space-y-4">
                              <div className="border rounded-lg p-2">
                                <img
                                  src={post.images[0]}
                                  alt="Generated"
                                  className="w-full max-w-md mx-auto rounded"
                                />
                              </div>
                              
                              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                <div className="flex items-center text-sm text-green-800">
                                  <Check className="h-4 w-4 mr-2" />
                                  この画像の使用が承認されました
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            <div className="flex gap-4">
              <Button 
                onClick={() => setCurrentStep(2)}
                variant="outline"
                className="flex-1"
                size="lg"
              >
                編集に戻る
              </Button>
              <Button 
                onClick={scheduleAllPosts}
                className="flex-1"
                size="lg"
                disabled={generatedPosts.length === 0 || !allImagesReviewed}
              >
                {!allImagesReviewed ? (
                  <>
                    <ImageIcon className="h-4 w-4 mr-2" />
                    画像確認が未完了
                  </>
                ) : (
                  "投稿を保存"
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreatePosts;
