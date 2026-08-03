import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Screen, Header, Button, KindLabel, MetaRow } from "../components/UI";
import BottomNav from "../components/BottomNav";
import { IconEdit, IconCamera } from "../components/Icons";
import api from "../api/client";
import { mapArticle } from "../api/mappers";
import { useAuth } from "../context/AuthContext";

const EMPTY_PROFILE = {
  name: "",
  handle: "",
  bio: "",
  avatar: "",
  stats: { followers: 0 },
};

const normalizeUser = (raw, fallback) => {
  if (!raw) return fallback;
  if (raw.name !== undefined && raw.bio !== undefined) return raw;
  return {
    ...raw,
    name: `${raw.first_name || ""} ${raw.last_name || ""}`.trim() || raw.username || fallback.name,
    handle: raw.username || fallback.handle || "",
    bio: raw.profile?.bio ?? fallback.bio,
    avatar: raw.profile?.profile_pic ?? fallback.avatar,
  };
};

export default function Profile() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [settings, setSettings] = useState(() => ({
    darkMode: localStorage.getItem("theme") !== "light",
    notifications: false,
  }));
  const [avatarPreview, setAvatarPreview] = useState("");

  const storedUser = useMemo(() => {
    try {
      const raw = localStorage.getItem("user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  const userId = storedUser?.id || storedUser?.user_id;

  useEffect(() => {
    if (!userId) {
      setUserData(EMPTY_PROFILE);
      setLoading(false);
      return;
    }

    let cancelled = false;
    api
      .get(`/users/${userId}`)
      .then((res) => {
        if (!cancelled) {
          setUserData(normalizeUser(res.data, EMPTY_PROFILE));
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Failed to fetch user:", err);
          setUserData(storedUser || EMPTY_PROFILE);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [userId, storedUser]);

  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setPosts([]);
      setPostsLoading(false);
      return;
    }

    api
      .get(`/users/${userId}/articles`)
      .then((res) => {
        if (!cancelled) {
          const items = Array.isArray(res.data) ? res.data.map(mapArticle) : [];
          setPosts(items);
          setPostsLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Failed to fetch user articles:", err);
          setPosts([]);
          setPostsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const displayUser = userData || EMPTY_PROFILE;
  const postsCount = posts.length;
  const upvotesCount = posts.reduce((sum, a) => sum + (a.upvotes || 0), 0);
  const followersCount = displayUser.stats?.followers ?? 0;

  const updateSetting = (key) => {
    setSettings((s) => {
      const next = { ...s, [key]: !s[key] };
      if (key === "darkMode") {
        if (next.darkMode) {
          document.documentElement.classList.add("dark");
          localStorage.setItem("theme", "dark");
        } else {
          document.documentElement.classList.remove("dark");
          localStorage.setItem("theme", "light");
        }
      }
      return next;
    });
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setAvatarPreview(url);
      setUserData((u) => ({ ...u, avatar: url }));
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  if (loading) {
    return (
      <Screen sidebar nav>
        <Header
          title="Profile"
          right={
            <Link
              to="/create-article"
              className="text-night-pitch dark:text-floodlight block"
              aria-label="Post"
            >
              <IconEdit className="w-6 h-6" />
            </Link>
          }
        />
        <main className="pb-6">
          <div className="px-4 pt-6">
            <div className="py-12 text-center font-mono text-sm text-terracing/60 dark:text-floodlight/50 border border-black/10 dark:border-white/10 rounded-card">
              Loading profile...
            </div>
          </div>
        </main>
      </Screen>
    );
  }

  return (
    <Screen sidebar nav>
      <Header
        title="Profile"
        right={
          <Link
             to="/create-article"
            className="text-night-pitch dark:text-floodlight block"
            aria-label="Post"
          >
            <IconEdit className="w-6 h-6" />
          </Link>
        }
      />

      <main className="pb-6">
        <div className="px-4 pt-6 flex items-start gap-4">
          <div className="relative w-16 h-16 rounded-full overflow-hidden bg-terracing/30 border border-black/10 dark:border-white/10 flex-shrink-0">
            <img
              src={avatarPreview || displayUser.avatar || "/images/avatar.png"}
              alt=""
              className="w-full h-full object-cover"
            />
            <label
              htmlFor="avatar-upload"
              className="absolute inset-0 flex items-center justify-center bg-night-pitch/60 dark:bg-night-pitch/70 cursor-pointer opacity-0 hover:opacity-100 transition-opacity"
            >
              <IconCamera className="w-5 h-5 text-floodlight" />
            </label>
            <input
              id="avatar-upload"
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-display font-bold uppercase text-2xl leading-none text-night-pitch dark:text-floodlight truncate">
              {displayUser.name}
            </h2>
            <p className="font-mono text-xs text-terracing/60 dark:text-floodlight/50 mt-1 truncate">
              {displayUser.handle || displayUser.username}
            </p>
          </div>
        </div>

        <p className="px-4 mt-3 text-sm leading-relaxed text-night-pitch dark:text-floodlight/80 text-pretty">
          {displayUser.bio}
        </p>

        <div className="mx-4 mt-4 grid grid-cols-3 border border-black/10 dark:border-white/10">
          {[
            ["Posts", postsCount],
            ["Upvotes", upvotesCount],
            ["Followers", followersCount],
          ].map(([label, value], i) => (
            <div
              key={label}
              className={`py-3 text-center ${
                i < 2 ? "border-r border-black/10 dark:border-white/10" : ""
              }`}
            >
              <div className="font-mono font-bold text-xl text-night-pitch dark:text-floodlight tabular-nums">
                {value}
              </div>
              <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-terracing/60 dark:text-floodlight/50 mt-0.5">
                {label}
              </div>
            </div>
          ))}
        </div>

        <div className="px-4 mt-4 flex gap-3">
          <Button variant="outline">Follow</Button>
          <Button variant="outline">Message</Button>
        </div>

        <div className="mx-4 mt-6 border border-black/10 dark:border-white/10 rounded-card p-4">
          <h3 className="font-display font-bold uppercase text-sm tracking-wide text-night-pitch dark:text-floodlight mb-3">
            Settings
          </h3>
          <div className="flex flex-col gap-3">
            {[
              ["Dark Mode", "darkMode"],
              ["Notifications", "notifications"],
            ].map(([label, key]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="font-mono text-xs uppercase tracking-[0.08em] text-night-pitch dark:text-floodlight">
                  {label}
                </span>
                <button
                  type="button"
                  onClick={() => updateSetting(key)}
                  className={`w-10 h-5 rounded-full border border-black/10 dark:border-white/10 transition-colors duration-200 ${
                    settings[key]
                      ? "bg-terracing border-terracing"
                      : "bg-transparent"
                  }`}
                >
                  <span
                    className={`block w-3.5 h-3.5 rounded-full bg-floodlight dark:bg-night-pitch transition-transform duration-200 ${
                      settings[key] ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={handleLogout}
              className="mt-2 w-full py-2.5 rounded-card border border-red-500/30 text-red-500 font-display font-semibold uppercase tracking-wide text-sm hover:bg-red-500/5 transition-colors duration-100"
            >
              Log Out
            </button>
          </div>
        </div>

        <h3 className="px-4 mt-8 mb-2 font-display font-bold uppercase text-lg tracking-wide text-night-pitch dark:text-floodlight">
          Posts
        </h3>
        {postsLoading ? (
          <div className="py-12 text-center font-mono text-sm text-terracing/60 dark:text-floodlight/50 border border-black/10 dark:border-white/10">
            Loading posts...
          </div>
        ) : (
          <ul className="border-t border-black/10 dark:border-white/10">
            {posts.map((a) => (
              <li key={a.id}>
                <Link
                  to={`/articles/${a.id}`}
                  className="block px-4 py-4 border-b border-black/10 dark:border-white/10"
                >
                  <KindLabel>{a.kind}</KindLabel>
                  <p className="mt-2 font-display font-semibold uppercase leading-tight text-night-pitch dark:text-floodlight">
                    {a.title}
                  </p>
                  <div className="mt-2">
                    <MetaRow upvotes={a.upvotes} comments={a.comments} />
                  </div>
                </Link>
              </li>
            ))}
            {!postsLoading && posts.length === 0 && (
              <li className="px-4 py-8 text-center font-mono text-sm text-terracing/60 dark:text-floodlight/50">
                No posts yet.
              </li>
            )}
          </ul>
        )}
      </main>

      <BottomNav active="profile" />
    </Screen>
  );
}