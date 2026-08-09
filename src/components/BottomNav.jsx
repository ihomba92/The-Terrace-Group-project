import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  IconHome,
  IconFeed,
  IconGrid,
  IconUser,
  IconComment,
  IconBookmark,
  IconEdit,
  IconShield,
} from "./Icons";

const baseItems = [
  { key: "home", label: "Home", to: "/", Icon: IconHome },
  { key: "feed", label: "Feed", to: "/feed", Icon: IconFeed },
  { key: "categories", label: "Browse", to: "/categories", Icon: IconGrid },
  { key: "comments", label: "My Comments", to: "/my-comments", Icon: IconComment },
  { key: "bookmarks", label: "Bookmarks", to: "/bookmarks", Icon: IconBookmark },
  { key: "profile", label: "Profile", to: "/user-profile", Icon: IconUser },
];

const ROLE_NAV_ITEM = {
  admin: { key: "admin", label: "Admin", to: "/admin-dashboard", Icon: IconShield },
  author: { key: "my-articles", label: "My Articles", to: "/my-articles", Icon: IconEdit },
};

function buildItems(role) {
  const extra = ROLE_NAV_ITEM[role];
  if (!extra) return baseItems;

  const profileIndex = baseItems.findIndex((i) => i.key === "profile");
  return [
    ...baseItems.slice(0, profileIndex),
    extra,
    ...baseItems.slice(profileIndex),
  ];
}

export default function BottomNav({ active }) {
  const { user, logout } = useAuth();
  const userRole = user?.profile?.role || user?.role;

  const items = buildItems(userRole);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <>
      {/* Mobile bottom navigation */}
      <nav className="lg:hidden fixed inset-x-0 bottom-0 z-10 bg-floodlight/95 dark:bg-night-pitch/95 border-t border-black/10 dark:border-white/10">
        <div className="flex items-stretch justify-around">
          {items.map(({ key, label, to, Icon }) => {
            const isActive = key === active;
            return (
              <Link
                key={key}
                to={to}
                className={
                  "relative flex-1 flex flex-col items-center gap-1 py-2.5 transition-colors duration-100 " +
                  (isActive
                    ? "text-night-pitch dark:text-floodlight"
                    : "text-terracing/60 dark:text-floodlight/50 hover:text-night-pitch dark:hover:text-floodlight")
                }>
                {isActive && (
                  <span className="absolute top-1.5 w-1 h-1 rounded-full bg-amber-live" aria-hidden="true" />
                )}
                <Icon className="w-6 h-6" />
                <span className="font-mono text-[10px] uppercase tracking-[0.08em]">
                  {label}
                </span>
              </Link>
            );
          })}
        </div>

        {/* Show Mobile Log out button ONLY if user is logged in */}
        {user && (
          <button
            onClick={handleLogout}
            className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[9px] uppercase tracking-[0.08em] text-red-500/70 hover:text-red-500 px-2 py-1">
            Log out
          </button>
        )}
      </nav>

      {/* Desktop sidebar navigation */}
      <nav className="hidden lg:flex fixed left-0 top-0 bottom-0 w-64 bg-floodlight dark:bg-night-pitch border-r border-black/10 dark:border-white/10 flex-col py-6 px-4">
        <div className="mb-8">
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-night-pitch dark:text-floodlight">
            The Terrace
          </span>
        </div>
        <div className="flex-1 space-y-2">
          {items.map(({ key, label, to, Icon }) => {
            const isActive = key === active;
            return (
              <Link
                key={key}
                to={to}
                className={
                  "relative flex items-center gap-3 pl-4 pr-4 py-3 rounded-card border-l-2 transition-colors duration-100 " +
                  (isActive
                    ? "bg-night-pitch text-floodlight dark:bg-floodlight dark:text-night-pitch border-l-amber-live"
                    : "border-l-transparent text-terracing/60 dark:text-floodlight/50 hover:text-night-pitch dark:hover:text-floodlight")
                }>
                <Icon className="w-5 h-5" />
                <span className="font-display font-semibold uppercase tracking-wide text-sm">
                  {label}
                </span>
              </Link>
            );
          })}
        </div>

        {/* Show Desktop Log out button ONLY if user is logged in */}
        {user && (
          <button
            onClick={handleLogout}
            className="mt-auto flex items-center gap-3 px-4 py-3 rounded-card text-red-500/70 hover:text-red-500 hover:bg-red-500/5 transition-colors duration-100">
            <span className="font-display font-semibold uppercase tracking-wide text-sm">
              Log Out
            </span>
          </button>
        )}
      </nav>
    </>
  );
}