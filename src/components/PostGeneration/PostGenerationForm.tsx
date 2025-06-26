
import { useState } from "react";
import { PersonaSelector } from "./PersonaSelector";
import { TopicInput } from "./TopicInput";
import { DateTimeSelector } from "./DateTimeSelector";
import { CustomPromptInput } from "./CustomPromptInput";
import { GenerateButton } from "./GenerateButton";
import { usePostGeneration } from "@/hooks/usePostGeneration";

interface PostGenerationFormProps {
  onPostsGenerated: (posts: any[], personaId: string, dates: string[], times: string[]) => void;
}

export const PostGenerationForm = ({ onPostsGenerated }: PostGenerationFormProps) => {
  const [selectedPersona, setSelectedPersona] = useState<string>("");
  const [topics, setTopics] = useState<string[]>([]);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [selectedTimes, setSelectedTimes] = useState<string[]>([]);
  const [customPrompt, setCustomPrompt] = useState<string>("");

  const { generatePosts, loading } = usePostGeneration();

  const handleGenerate = async () => {
    if (!selectedPersona || topics.length === 0 || selectedDates.length === 0 || selectedTimes.length === 0) {
      return;
    }

    try {
      const posts = await generatePosts({
        personaId: selectedPersona,
        topics,
        selectedDates,
        selectedTimes,
        customPrompt
      });

      if (posts && posts.length > 0) {
        onPostsGenerated(posts, selectedPersona, selectedDates, selectedTimes);
      }
    } catch (error) {
      console.error('Error generating posts:', error);
    }
  };

  const canGenerate = selectedPersona && topics.length > 0 && selectedDates.length > 0 && selectedTimes.length > 0;

  return (
    <div className="space-y-8">
      <PersonaSelector 
        selectedPersona={selectedPersona}
        onPersonaChange={setSelectedPersona}
      />
      
      <TopicInput 
        topics={topics}
        onTopicsChange={setTopics}
      />
      
      <DateTimeSelector
        selectedDates={selectedDates}
        selectedTimes={selectedTimes}
        onDatesChange={setSelectedDates}
        onTimesChange={setSelectedTimes}
      />
      
      <CustomPromptInput
        customPrompt={customPrompt}
        onCustomPromptChange={setCustomPrompt}
      />
      
      <GenerateButton
        onGenerate={handleGenerate}
        canGenerate={canGenerate}
        loading={loading}
        selectedDates={selectedDates}
        selectedTimes={selectedTimes}
      />
    </div>
  );
};
