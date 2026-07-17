import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

const GRADIENTS = [
  'from-emerald-500 via-teal-500 to-cyan-500',
  'from-blue-500 via-indigo-500 to-purple-500',
  'from-rose-500 via-pink-500 to-purple-500',
  'from-amber-500 via-orange-500 to-rose-500',
  'from-fuchsia-500 via-purple-500 to-indigo-500',
  'from-cyan-500 via-blue-500 to-indigo-500',
  'from-lime-500 via-emerald-500 to-teal-500',
  'from-violet-500 via-purple-500 to-fuchsia-500'
];

interface DynamicGradientBorderProps {
  className?: string;
}

export const DynamicGradientBorder = ({ className }: DynamicGradientBorderProps) => {
  const [gradient, setGradient] = useState<string>('');

  useEffect(() => {
    // Assign a random gradient on mount so each card gets a different color
    const randomGradient = GRADIENTS[Math.floor(Math.random() * GRADIENTS.length)];
    setGradient(randomGradient);
  }, []);

  if (!gradient) return null; // Avoid hydration mismatch or flash of unstyled content

  return (
    <div
      className={cn(
        "absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r opacity-50",
        gradient,
        className
      )}
    />
  );
};
