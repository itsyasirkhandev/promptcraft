'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';

interface PromptNotFoundProps {
  message?: string;
}

export function PromptNotFound({
  message = 'The prompt you are trying to access does not exist.',
}: PromptNotFoundProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-6">
      <h2 className="text-xl font-semibold mb-2">Prompt Not Found</h2>
      <p className="text-muted-foreground mb-4">{message}</p>
      <Button asChild>
        <Link href="/dashboard/prompts">
          <ArrowLeft className="mr-2 size-4" />
          Back to Dashboard
        </Link>
      </Button>
    </div>
  );
}
