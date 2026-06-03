'use client';

import { useForm } from 'react-hook-form';
import { effectTsResolver } from '@hookform/resolvers/effect-ts';
import { LoginFormSchema, type LoginFormData } from '@/lib/schemas/auth';
import { useAppStore } from '@/store';

export function LoginForm() {
  // 1. Connect React Hook Form to Effect-TS Schema via the resolver
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: effectTsResolver(LoginFormSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  // 2. Access the global Zustand state action
  const login = useAppStore((state) => state.login);

  // 3. Handle valid form submission
  const onSubmit = async (data: LoginFormData) => {
    // This function only executes if the Effect Schema validation passes
    
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    // Pass the valid data to the persistent global Zustand store
    login({
      id: crypto.randomUUID(), // Mock ID
      name: 'Template User',
      email: data.email,
    });
    
    alert('Logged in successfully and updated global state!');
  };

  return (
    <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-md border border-slate-100">
      <h2 className="text-2xl font-bold mb-6 text-slate-800">Sign In</h2>
      
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Email Field */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="you@example.com"
            {...register('email')}
          />
          {errors.email && (
            <p className="mt-1 text-sm text-red-500">{errors.email.message}</p>
          )}
        </div>

        {/* Password Field */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="••••••••"
            {...register('password')}
          />
          {errors.password && (
            <p className="mt-1 text-sm text-red-500">{errors.password.message}</p>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
        >
          {isSubmitting ? 'Signing in...' : 'Log In'}
        </button>
      </form>
    </div>
  );
}
