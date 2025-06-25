
import React, { forwardRef } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { sanitizeInput } from '@/lib/validation';

interface SecureInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  autoSanitize?: boolean;
}

interface SecureTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
  autoSanitize?: boolean;
}

export const SecureInput = forwardRef<HTMLInputElement, SecureInputProps>(
  ({ onChange, error, autoSanitize = true, className, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (autoSanitize && onChange) {
        const sanitizedValue = sanitizeInput(e.target.value);
        const sanitizedEvent = {
          ...e,
          target: { ...e.target, value: sanitizedValue }
        };
        onChange(sanitizedEvent as React.ChangeEvent<HTMLInputElement>);
      } else if (onChange) {
        onChange(e);
      }
    };

    return (
      <div className="space-y-1">
        <Input
          ref={ref}
          onChange={handleChange}
          className={`${className} ${error ? 'border-red-500' : ''}`}
          {...props}
        />
        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}
      </div>
    );
  }
);

SecureInput.displayName = 'SecureInput';

export const SecureTextarea = forwardRef<HTMLTextAreaElement, SecureTextareaProps>(
  ({ onChange, error, autoSanitize = true, className, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (autoSanitize && onChange) {
        const sanitizedValue = sanitizeInput(e.target.value);
        const sanitizedEvent = {
          ...e,
          target: { ...e.target, value: sanitizedValue }
        };
        onChange(sanitizedEvent as React.ChangeEvent<HTMLTextAreaElement>);
      } else if (onChange) {
        onChange(e);
      }
    };

    return (
      <div className="space-y-1">
        <Textarea
          ref={ref}
          onChange={handleChange}
          className={`${className} ${error ? 'border-red-500' : ''}`}
          {...props}
        />
        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}
      </div>
    );
  }
);

SecureTextarea.displayName = 'SecureTextarea';
