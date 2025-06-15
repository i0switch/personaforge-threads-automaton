export interface GenerateImageRequest {
  prompt: string;
  negative_prompt?: string;
  ip_adapter_scale?: number;
  guidance_scale?: number;
  num_inference_steps?: number;
  width?: number;
  height?: number;
  api_url: string;
  persona_id: string;
}

export interface ApiPayload {
  face_image_b64: string;
  prompt: string;
  negative_prompt: string;
  ip_adapter_scale: number;
  guidance_scale: number;
  num_inference_steps: number;
  width: number;
  height: number;
}

export interface ApiResponse {
  image_b64?: string;
  error?: string;
}

export interface GenerateImageResponse {
  success: boolean;
  image: string;
  prompt: string;
  api_url: string;
}