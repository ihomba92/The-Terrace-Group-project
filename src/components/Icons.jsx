// Sharp, geometric strokes. No rounded end-caps (strokeLinecap="butt").
// 2px stroke at 24px, drops via className where needed.

const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "butt",
  strokeLinejoin: "miter",
  viewBox: "0 0 24 24",
};

export function IconHome({ className = "w-6 h-6" }) {
  return (
    <svg {...base} className={className}>
      <path d="M3 11 12 3l9 8" />
      <path d="M5 10v10h14V10" />
    </svg>
  );
}

export function IconFeed({ className = "w-6 h-6" }) {
  return (
    <svg {...base} className={className}>
      <path d="M4 5h16M4 12h16M4 19h10" />
    </svg>
  );
}

export function IconGrid({ className = "w-6 h-6" }) {
  return (
    <svg {...base} className={className}>
      <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />
    </svg>
  );
}

export function IconUser({ className = "w-6 h-6" }) {
  return (
    <svg {...base} className={className}>
      <path d="M4 21v-2a5 5 0 0 1 5-5h6a5 5 0 0 1 5 5v2" />
      <path d="M8 7a4 4 0 1 0 8 0 4 4 0 0 0-8 0Z" />
    </svg>
  );
}

export function IconUpvote({ className = "w-4 h-4" }) {
  return (
    <svg {...base} strokeWidth={2} className={className}>
      <path d="M12 5 5 13h4v6h6v-6h4z" />
    </svg>
  );
}

export function IconComment({ className = "w-4 h-4" }) {
  return (
    <svg {...base} strokeWidth={2} className={className}>
      <path d="M4 5h16v11H9l-5 4z" />
    </svg>
  );
}

// NEW — matches Figma's bottom-nav icon set (Home / Comment / Bookmark / Profile)
export function IconBookmark({ className = "w-6 h-6" }) {
  return (
    <svg {...base} className={className}>
      <path d="M6 4h12v16l-6-4-6 4z" />
    </svg>
  );
}

export function IconEdit({ className = "w-6 h-6" }) {
  return (
    <svg {...base} className={className}>
      <path d="M4 20h16M6 16 16 6l2 2L8 18H6z" />
    </svg>
  );
}

export function IconArrowLeft({ className = "w-6 h-6" }) {
  return (
    <svg {...base} className={className}>
      <path d="M20 12H4M10 6 4 12l6 6" />
    </svg>
  );
}

export function IconCheck({ className = "w-6 h-6" }) {
  return (
    <svg {...base} className={className}>
      <path d="M4 12 10 18 20 6" />
    </svg>
  );
}

export function IconCamera({ className = "w-5 h-5" }) {
  return (
    <svg {...base} className={className}>
      <path d="M4 7h3l2-3h6l2 3h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  );
}

export function IconSun({ className = "w-5 h-5" }) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

export function IconMoon({ className = "w-5 h-5" }) {
  return (
    <svg {...base} className={className}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

// NEW — for the Admin nav item. Geometric pentagon shield (straight edges,
// mitered point), consistent with the rest of this set — deliberately not
// the soft rounded-shoulder shield glyph most icon packs default to.
export function IconShield({ className = "w-6 h-6" }) {
  return (
    <svg {...base} className={className}>
      <path d="M12 3 19 6v6c0 5-3 8-7 9-4-1-7-4-7-9V6z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}