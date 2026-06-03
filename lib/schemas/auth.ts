import { Schema } from 'effect';

// We define the Schema using Effect's Struct. 
// This schema can be imported on the server (API Routes / Server Actions) 
// to decode requests, and on the client for React Hook Form validation.
export const LoginFormSchema = Schema.Struct({
  email: Schema.String.pipe(
    Schema.nonEmptyString({ message: () => 'Email is required' }),
    // Basic email regex pattern for frontend validation
    Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, { message: () => 'Invalid email address' })
  ),
  password: Schema.String.pipe(
    Schema.nonEmptyString({ message: () => 'Password is required' }),
    Schema.minLength(8, { message: () => 'Password must be at least 8 characters' })
  )
});

// Extract the TypeScript type from the Schema
export type LoginFormData = typeof LoginFormSchema.Type;
