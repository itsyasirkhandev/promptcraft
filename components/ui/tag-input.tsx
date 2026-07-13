'use client';

import React, { useRef, useState, useMemo, useEffect } from 'react';
import { X, Check } from '@phosphor-icons/react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface TagInputProps {
  value: string[];
  onChange: (value: string[]) => void;
  error?: string;
}

const PREDEFINED_TAGS = [
  'Coding',
  'Writing',
  'Marketing',
  'Analysis',
  'Creative',
  'Technical',
  'General',
  'SEO',
  'Template',
  'WIP'
];

export function TagInput({ value = [], onChange, error }: TagInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter suggestions based on query and exclude already selected ones
  const filteredSuggestions = useMemo(() => {
    const query = inputValue.trim().toLowerCase();
    
    // Get all predefined tags not yet selected
    const unselected = PREDEFINED_TAGS.filter(
      (tag) => !value.some((v) => v.toLowerCase() === tag.toLowerCase())
    );

    if (!query) return unselected;

    // Filter based on input
    const matches = unselected.filter((tag) =>
      tag.toLowerCase().includes(query)
    );

    // If query itself isn't a duplicate and isn't in matches, suggest creating it
    const isExactMatch = value.some((v) => v.toLowerCase() === query) || 
                         matches.some((m) => m.toLowerCase() === query);
    
    if (!isExactMatch && query.length <= 30 && value.length < 20) {
      return [...matches, `Create "${inputValue.trim()}"` as string];
    }

    return matches;
  }, [inputValue, value]);

  // Clamp activeIndex to within suggestions bounds
  const safeActiveIndex = Math.min(activeIndex, Math.max(0, filteredSuggestions.length - 1));

  const addTag = (tag: string) => {
    const cleanTag = tag.startsWith('Create "')
      ? tag.slice(8, -1).trim()
      : tag.trim();

    if (!cleanTag) return;
    if (cleanTag.length > 30) return;
    if (value.length >= 20) return;

    // Check case-insensitive duplicate
    const isDuplicate = value.some(
      (v) => v.toLowerCase() === cleanTag.toLowerCase()
    );
    if (isDuplicate) return;

    onChange([...value, cleanTag]);
    setInputValue('');
    setIsDropdownOpen(false);
    inputRef.current?.focus();
  };

  const removeTag = (tagToRemove: string) => {
    onChange(value.filter((tag) => tag !== tagToRemove));
  };

  const togglePredefinedTag = (tag: string) => {
    const exists = value.some((v) => v.toLowerCase() === tag.toLowerCase());
    if (exists) {
      onChange(value.filter((v) => v.toLowerCase() !== tag.toLowerCase()));
    } else {
      if (value.length >= 20) return;
      onChange([...value, tag]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (isDropdownOpen && filteredSuggestions.length > 0) {
        addTag(filteredSuggestions[safeActiveIndex]);
      } else {
        addTag(inputValue);
      }
    } else if (e.key === 'Backspace' && !inputValue) {
      e.preventDefault();
      if (value.length > 0) {
        removeTag(value[value.length - 1]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIsDropdownOpen(true);
      setActiveIndex((prev) => 
        prev < filteredSuggestions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIsDropdownOpen(true);
      setActiveIndex((prev) => 
        prev > 0 ? prev - 1 : filteredSuggestions.length - 1
      );
    } else if (e.key === 'Escape') {
      setIsDropdownOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="space-y-3 w-full">
      {/* Selected Tags Display */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2 p-2 rounded-md bg-muted/40 dark:bg-muted/20 border border-border">
          {value.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1 pr-1 pl-2.5 h-6">
              <span className="text-secondary-foreground font-medium">{tag}</span>
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="ml-1 rounded-full p-0.5 text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-colors"
                aria-label={`Remove tag ${tag}`}
              >
                <X size={10} weight="bold" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Tag Input Field & Suggestion Dropdown */}
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setIsDropdownOpen(true);
            setActiveIndex(0);
          }}
          onFocus={() => setIsDropdownOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Type a tag and press Enter or comma..."
          className={cn("pr-10", error && "border-destructive focus-visible:ring-destructive/20")}
        />

        {/* Suggestion Dropdown */}
        {isDropdownOpen && filteredSuggestions.length > 0 && (
          <div className="absolute z-50 w-full mt-1.5 overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 max-h-60 overflow-y-auto border border-border backdrop-blur-md">
            <ul className="p-1">
              {filteredSuggestions.map((suggestion, index) => {
                const isSelected = safeActiveIndex === index;
                const isCreateOption = suggestion.startsWith('Create "');
                return (
                  <li
                    key={suggestion}
                    onClick={() => addTag(suggestion)}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={cn(
                      "relative flex w-full cursor-pointer items-center justify-between rounded-md py-1.5 px-2.5 text-sm outline-none select-none transition-colors",
                      isSelected ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground hover:bg-accent/40"
                    )}
                  >
                    <span>{suggestion}</span>
                    {isCreateOption && (
                      <span className="text-xs opacity-75 font-normal">Press Enter</span>
                    )}
                    {!isCreateOption && value.includes(suggestion) && (
                      <Check size={14} className="text-primary" />
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {/* Predefined Tags Toggle Row */}
      <div className="space-y-1.5">
        <span className="text-xs font-semibold text-muted-foreground">Common Tags:</span>
        <div className="flex flex-wrap gap-1.5">
          {PREDEFINED_TAGS.map((tag) => {
            const isSelected = value.some((v) => v.toLowerCase() === tag.toLowerCase());
            return (
              <button
                key={tag}
                type="button"
                onClick={() => togglePredefinedTag(tag)}
                className={cn(
                  "inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-all duration-200 cursor-pointer border border-border",
                  isSelected
                    ? "bg-primary/10 border-primary/40 text-primary dark:bg-primary/20 dark:text-primary-foreground font-semibold"
                    : "bg-background hover:bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                {isSelected && <Check size={10} className="mr-1 inline-block" />}
                {tag}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
