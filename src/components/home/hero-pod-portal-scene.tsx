export function HeroPodPortalScene() {
  return (
    <div className="hero-portal-scene" aria-hidden>
      <svg
        className="hero-portal-scene__svg"
        viewBox="0 0 720 560"
        role="img"
      >
        <defs>
          <radialGradient id="portalGlow" cx="50%" cy="45%" r="55%">
            <stop offset="0%" stopColor="rgba(0, 183, 255, 0.28)" />
            <stop offset="52%" stopColor="rgba(0, 183, 255, 0.08)" />
            <stop offset="100%" stopColor="rgba(0, 183, 255, 0)" />
          </radialGradient>
          <linearGradient id="tableSurface" x1="15%" x2="85%" y1="50%" y2="50%">
            <stop offset="0%" stopColor="rgba(146, 166, 191, 0.18)" />
            <stop offset="50%" stopColor="rgba(0, 183, 255, 0.64)" />
            <stop offset="100%" stopColor="rgba(146, 166, 191, 0.18)" />
          </linearGradient>
        </defs>

        <ellipse
          data-portal-haze
          cx="360"
          cy="250"
          rx="285"
          ry="205"
          fill="url(#portalGlow)"
        />

        <g data-pod-wall opacity="0.7">
          <path d="M120 92 L230 210" />
          <path d="M600 92 L490 210" />
          <path d="M92 430 L230 300" />
          <path d="M628 430 L490 300" />
          <path d="M160 112 H560" />
          <path d="M132 452 H588" />
        </g>

        <ellipse
          data-portal-ring
          cx="360"
          cy="250"
          rx="230"
          ry="158"
        />
        <ellipse
          data-portal-ring
          cx="360"
          cy="250"
          rx="186"
          ry="126"
          opacity="0.55"
        />

        <g data-table-surface>
          <path d="M150 365 L298 292 H422 L570 365 Z" fill="none" />
          <path d="M298 292 L260 408" />
          <path d="M422 292 L460 408" />
          <path d="M150 365 H570" />
          <path d="M260 408 H460" />
          <path d="M360 294 V407" />
        </g>

        <g data-table-net>
          <path d="M286 320 H434" />
          <path d="M286 320 L286 296" />
          <path d="M434 320 L434 296" />
          <path d="M300 312 H420" opacity="0.45" />
        </g>

        <path
          data-ball-path
          d="M160 250 C250 145 365 142 455 210 C505 248 530 300 560 350"
          fill="none"
        />
        <circle data-ball cx="160" cy="250" r="7" />
      </svg>
    </div>
  );
}
