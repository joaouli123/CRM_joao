import React, { useState } from "react";
import { User } from "lucide-react";

interface ContactAvatarProps {
  profilePicture?: string | null;
  contactName?: string;
  phoneNumber?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function ContactAvatar({ 
  profilePicture, 
  contactName, 
  phoneNumber, 
  size = "md",
  className = "" 
}: ContactAvatarProps) {
  const [imageError, setImageError] = useState(false);

  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-12 w-12", 
    lg: "h-16 w-16"
  };

  const iconSizes = {
    sm: 16,
    md: 24,
    lg: 32
  };

  const handleImageError = () => {
    console.log(`❌ Erro ao carregar foto de ${contactName || phoneNumber}: ${profilePicture}`);
    setImageError(true);
  };

  const shouldShowImage = profilePicture && !imageError;

  return (
    <div className={`${sizeClasses[size]} flex items-center justify-center rounded-full bg-muted overflow-hidden ${className}`}>
      {shouldShowImage ? (
        <img
          src={profilePicture}
          alt={`${contactName || phoneNumber}'s avatar`}
          className="h-full w-full object-cover"
          onError={handleImageError}
          onLoad={() => {
            console.log(`✅ Foto carregada com sucesso: ${contactName || phoneNumber}`);
          }}
        />
      ) : (
        <User 
          size={iconSizes[size]} 
          className="text-gray-500" 
        />
      )}
    </div>
  );
}