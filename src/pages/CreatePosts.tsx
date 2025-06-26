
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PostGenerationForm } from "@/components/PostGeneration/PostGenerationForm";
import { PostPreview } from "@/components/PostGeneration/PostPreview";
import { useAuth } from "@/contexts/AuthContext";

const CreatePosts = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [generatedPosts, setGeneratedPosts] = useState<any[]>([]);
  const [selectedPersona, setSelectedPersona] = useState<string>("");
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [selectedTimes, setSelectedTimes] = useState<string[]>([]);

  const handlePostsGenerated = (posts: any[], personaId: string, dates: string[], times: string[]) => {
    setGeneratedPosts(posts);
    setSelectedPersona(personaId);
    setSelectedDates(dates);
    setSelectedTimes(times);
  };

  const handlePostsSaved = () => {
    // ダッシュボードに戻る
    navigate("/");
  };

  if (!user) {
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
            <h1 className="text-3xl font-bold">投稿作成</h1>
            <p className="text-muted-foreground">
              AIが自動で投稿を生成し、予約投稿できます
            </p>
          </div>
        </div>

        {generatedPosts.length === 0 ? (
          <PostGenerationForm onPostsGenerated={handlePostsGenerated} />
        ) : (
          <PostPreview 
            posts={generatedPosts} 
            personaId={selectedPersona}
            selectedDates={selectedDates}
            selectedTimes={selectedTimes}
            onPostsSaved={handlePostsSaved}
          />
        )}
      </div>
    </div>
  );
};

export default CreatePosts;
