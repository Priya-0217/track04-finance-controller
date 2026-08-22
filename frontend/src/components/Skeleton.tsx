import React from 'react';

export interface SkeletonProps {
  className?: string;
  width?: string;
  height?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '', width, height }) => {
  const style: React.CSSProperties = {};
  if (width) style.width = width;
  if (height) style.height = height;

  return (
    <span
      className={`skeleton inline-block ${!width && !height ? 'w-full h-4' : ''} ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
};
