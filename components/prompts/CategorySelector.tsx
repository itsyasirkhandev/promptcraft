'use client';

import * as React from 'react';
import {
  Code,
  PencilSimple,
  Megaphone,
  ChartBar,
  Palette,
  GraduationCap,
  Globe,
  Check,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { FieldError } from '@/components/ui/field';

interface CategorySelectorProps {
  value: string | undefined;
  onChange: (value: string) => void;
  error?: string;
}

interface Category {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const CATEGORIES: Category[] = [
  { id: 'coding', label: 'Coding & Tech', icon: Code },
  { id: 'writing', label: 'Writing & Content', icon: PencilSimple },
  { id: 'marketing', label: 'Marketing & Growth', icon: Megaphone },
  { id: 'analysis', label: 'Data & Analysis', icon: ChartBar },
  { id: 'design', label: 'Design & Art', icon: Palette },
  { id: 'education', label: 'Education & Learning', icon: GraduationCap },
  { id: 'other', label: 'General / Other', icon: Globe },
];

export function CategorySelector({ value, onChange, error }: CategorySelectorProps) {
  const buttonsRef = React.useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex = index;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      nextIndex = (index + 1) % CATEGORIES.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      nextIndex = (index - 1 + CATEGORIES.length) % CATEGORIES.length;
    } else if (e.key === 'Home') {
      nextIndex = 0;
    } else if (e.key === 'End') {
      nextIndex = CATEGORIES.length - 1;
    } else {
      return;
    }

    e.preventDefault();
    const nextCategory = CATEGORIES[nextIndex];
    onChange(nextCategory.id);
    
    // Focus the next button
    buttonsRef.current[nextIndex]?.focus();
  };

  return (
    <div className="space-y-2">
      <div 
        role="radiogroup" 
        aria-label="Prompt Category"
        className="grid grid-cols-2 sm:grid-cols-4 gap-2.5"
      >
        {CATEGORIES.map((category, index) => {
          const isSelected = value === category.id;
          const Icon = category.icon;

          // Keyboard navigation: if no value is set, the first category (coding) is tab-focusable
          const tabIndex = value ? (isSelected ? 0 : -1) : (index === 0 ? 0 : -1);

          return (
            <button
              key={category.id}
              ref={(el) => {
                buttonsRef.current[index] = el;
              }}
              type="button"
              role="radio"
              aria-checked={isSelected}
              tabIndex={tabIndex}
              onClick={() => onChange(category.id)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={cn(
                "group relative flex flex-col items-center justify-center p-4 rounded-xl border text-center transition-all cursor-pointer select-none min-h-[90px] outline-none",
                // Inactive state
                "border-border bg-background text-muted-foreground hover:bg-slate-50 dark:hover:bg-slate-900/50 hover:text-foreground",
                // Active state
                isSelected && "border-primary bg-primary/5 text-primary font-semibold dark:bg-primary/10 dark:text-primary",
                // Error state adjustment
                error && !isSelected && "border-destructive/40 hover:border-destructive/60",
                // Focus states
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary"
              )}
            >
              {/* Checkmark in the corner for premium active state */}
              {isSelected && (
                <span className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                  <Check className="size-2.5 stroke-[3.5]" />
                </span>
              )}

              {/* Category Icon */}
              <Icon 
                className={cn(
                  "size-6 transition-transform group-hover:scale-110 duration-200",
                  isSelected ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                )} 
              />

              {/* Label */}
              <span className="mt-2 text-xs sm:text-sm font-medium tracking-wide">
                {category.label}
              </span>
            </button>
          );
        })}
      </div>

      {error && <FieldError>{error}</FieldError>}
    </div>
  );
}
