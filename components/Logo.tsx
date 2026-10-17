import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
}

export default function Logo({ className = 'w-8 h-8', size = 32 }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        {/* Dégradé Signature Keo Family : Ambre, Mandarine & Orange Solaire */}
        <linearGradient id="keoFamGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fde047" />
          <stop offset="35%" stopColor="#fb923c" />
          <stop offset="70%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#ea580c" />
        </linearGradient>

        <linearGradient id="keoFamBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1e2638" />
          <stop offset="60%" stopColor="#0f1523" />
          <stop offset="100%" stopColor="#070a10" />
        </linearGradient>

        <filter id="keoFamGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#f97316" floodOpacity="0.35" />
        </filter>
      </defs>

      {/* Tuile Squircle Sombre Premium */}
      <rect width="100" height="100" rx="26" fill="url(#keoFamBg)" stroke="#334155" strokeWidth="1.5" />

      {/* Lueur d'ambiance centrale */}
      <circle cx="54" cy="52" r="28" fill="#f97316" opacity="0.15" />

      {/* Emblème Keo Family : Le K sous le toit du foyer */}
      <g filter="url(#keoFamGlow)">
        {/* Toit protecteur du foyer */}
        <path
          d="M 23 48 L 51 26 C 52.5 24.8 54.5 24.8 56 26 L 81 46"
          stroke="url(#keoFamGrad)"
          strokeWidth="6.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Cheminée stylisée */}
        <path
          d="M 64 34 V 27 H 70 V 39"
          stroke="url(#keoFamGrad)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Colonne K (Stabilité) */}
        <rect x="36" y="44" width="7" height="34" rx="3.5" fill="url(#keoFamGrad)" />

        {/* Branche supérieure du K */}
        <path
          d="M 43 59 L 66 42"
          stroke="url(#keoFamGrad)"
          strokeWidth="6"
          strokeLinecap="round"
        />

        {/* Branche inférieure du K */}
        <path
          d="M 47 57 L 70 78"
          stroke="url(#keoFamGrad)"
          strokeWidth="6"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
