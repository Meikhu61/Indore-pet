import React, { useState } from 'react';
import { Smartphone } from 'lucide-react';

interface DeviceImageProps {
  src: string;
  alt: string;
  className?: string;
}

export const DeviceImage: React.FC<DeviceImageProps> = ({ src, alt, className = '' }) => {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`w-full h-full bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800 flex flex-col items-center justify-center p-4 text-center ${className}`}
      >
        <Smartphone className="w-8 h-8 text-amber-400/70 mb-2" />
        <span className="text-xs font-medium text-zinc-400 line-clamp-2">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
};
