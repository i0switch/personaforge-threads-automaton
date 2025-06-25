
interface ConfigValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export const validateConfiguration = (): ConfigValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required environment variables
  const requiredEnvVars = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY'
  ];

  for (const envVar of requiredEnvVars) {
    if (!import.meta.env[envVar]) {
      errors.push(`Missing required environment variable: ${envVar}`);
    }
  }

  // Check optional but recommended variables
  const optionalEnvVars = [
    'VITE_GEMINI_API_KEY',
    'VITE_HF_TOKEN'
  ];

  for (const envVar of optionalEnvVars) {
    if (!import.meta.env[envVar]) {
      warnings.push(`Optional environment variable not set: ${envVar}`);
    }
  }

  // Validate URL format
  if (import.meta.env.VITE_SUPABASE_URL) {
    try {
      const url = new URL(import.meta.env.VITE_SUPABASE_URL);
      if (!url.hostname.includes('supabase')) {
        warnings.push('Supabase URL format may be incorrect');
      }
    } catch {
      errors.push('Invalid Supabase URL format');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

export const logConfigurationStatus = () => {
  const result = validateConfiguration();
  
  if (!result.isValid) {
    console.error('Configuration validation failed:', result.errors);
    throw new Error('Application configuration is invalid');
  }

  if (result.warnings.length > 0) {
    console.warn('Configuration warnings:', result.warnings);
  }

  console.log('Configuration validation passed');
};
