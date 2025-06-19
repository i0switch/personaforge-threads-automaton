import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";

interface AdvancedSettingsProps {
  guidanceScale: number[];
  ipAdapterScale: number[];
  numSteps: number[];
  width: number[];
  height: number[];
  upscale: boolean;
  upscaleFactor: number[];
  onGuidanceScaleChange: (value: number[]) => void;
  onIpAdapterScaleChange: (value: number[]) => void;
  onNumStepsChange: (value: number[]) => void;
  onWidthChange: (value: number[]) => void;
  onHeightChange: (value: number[]) => void;
  onUpscaleChange: (checked: boolean) => void;
  onUpscaleFactorChange: (value: number[]) => void;
}

export const AdvancedSettings = ({
  guidanceScale,
  ipAdapterScale,
  numSteps,
  width,
  height,
  upscale,
  upscaleFactor,
  onGuidanceScaleChange,
  onIpAdapterScaleChange,
  onNumStepsChange,
  onWidthChange,
  onHeightChange,
  onUpscaleChange,
  onUpscaleFactorChange,
}: AdvancedSettingsProps) => {
  return (
    <>
      {/* Advanced Settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="space-y-2">
          <Label>CFG (Guidance Scale): {guidanceScale[0]}</Label>
          <Slider
            value={guidanceScale}
            onValueChange={onGuidanceScaleChange}
            min={1}
            max={15}
            step={0.5}
            className="w-full"
          />
        </div>

        <div className="space-y-2">
          <Label>IP Adapter Scale: {ipAdapterScale[0]}</Label>
          <Slider
            value={ipAdapterScale}
            onValueChange={onIpAdapterScaleChange}
            min={0}
            max={1.5}
            step={0.05}
            className="w-full"
          />
        </div>

        <div className="space-y-2">
          <Label>生成ステップ数 (Steps): {numSteps[0]}</Label>
          <Slider
            value={numSteps}
            onValueChange={onNumStepsChange}
            min={10}
            max={50}
            step={1}
            className="w-full"
          />
        </div>

        <div className="space-y-2">
          <Label>幅 (Width): {width[0]}px</Label>
          <Slider
            value={width}
            onValueChange={onWidthChange}
            min={512}
            max={1024}
            step={64}
            className="w-full"
          />
        </div>

        <div className="space-y-2">
          <Label>高さ (Height): {height[0]}px</Label>
          <Slider
            value={height}
            onValueChange={onHeightChange}
            min={512}
            max={1024}
            step={64}
            className="w-full"
          />
        </div>
      </div>

      {/* Upscale Settings */}
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="upscale"
            checked={upscale}
            onCheckedChange={(checked) => onUpscaleChange(checked === true)}
          />
          <Label htmlFor="upscale">アップスケール</Label>
        </div>
        
        {upscale && (
          <div className="space-y-2">
            <Label>アップスケール倍率: {upscaleFactor[0]}x</Label>
            <Slider
              value={upscaleFactor}
              onValueChange={onUpscaleFactorChange}
              min={1}
              max={8}
              step={1}
              className="w-full"
            />
          </div>
        )}
      </div>
    </>
  );
};