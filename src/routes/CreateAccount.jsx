import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AuthShell } from "../components/AuthShell";
import { Field, Button } from "../components/UI";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";

const INITIAL_FORM = {
  firstName: "",
  lastName: "",
  username: "",
  email: "",
  password: "",
  bio: "",
  image: "",
};

export default function CreateAccount() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [searchParams] = useSearchParams();

  const [form, setForm] = useState(INITIAL_FORM);
  // Pre-fill from ?invite=CODE if an admin shared a link rather than a bare code
  const [inviteCode, setInviteCode] = useState(searchParams.get("invite") || "");
  const [showPassword, setShowPassword] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const update = (key, value) => setForm({ ...form, [key]: value });

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
      const url = URL.createObjectURL(file);
      update("image", url);
      setAvatarPreview(url);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const payload = {
        first_name: form.firstName,
        last_name: form.lastName,
        username: form.username,
        email: form.email,
        password: form.password,
      };

      const trimmedCode = inviteCode.trim();
      if (trimmedCode) {
        payload.invite_code = trimmedCode;
      }

      const res = await api.post("/auth/register", payload);

      localStorage.setItem("token", res.data.access_token || res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));
      login(res.data.user);
      navigate("/");
    } catch (err) {
      console.error("Registration failed:", err);
      const serverError = err.response?.data?.errors
        ? Object.values(err.response.data.errors).flat().join(" ")
        : err.response?.data?.message;

      setError(serverError || "Registration failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 font-sans text-sm font-medium text-slate-500 dark:text-slate-400 transition-colors duration-150"
          >
            ← Back to homepage
          </Link>
        </div>

        <AuthShell
          heading="Create Account"
          sub="Join the terrace. Set up your profile and start predicting."
          footer={
            <Link
              to="/login"
              className="text-night-pitch dark:text-floodlight underline underline-offset-2"
            >
              Already have an account? Sign in
            </Link>
          }
        >
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field
            label="First Name"
            placeholder="FirstName"
            value={form.firstName}
            onChange={(e) => update("firstName", e.target.value)}
            required
          />
          <Field
            label="Last Name"
            placeholder="LastName"
            value={form.lastName}
            onChange={(e) => update("lastName", e.target.value)}
            required
          />
        </div>

        <Field
          label="Username"
          placeholder="@example1"
          value={form.username}
          onChange={(e) => update("username", e.target.value)}
          required
        />

        <Field
          label="Email"
          type="email"
          placeholder=""
          value={form.email}
          onChange={(e) => update("email", e.target.value)}
          required
        />

        <label className="block">
          <span className="block font-mono text-[11px] uppercase tracking-[0.1em] text-terracing/70 dark:text-floodlight/50 mb-1.5">
            Password
          </span>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder=""
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
              required
              className="w-full bg-transparent border border-black/10 dark:border-white/10 rounded-card px-3 py-2.5 text-sm text-night-pitch dark:text-floodlight placeholder:text-terracing/40 dark:placeholder:text-floodlight/40 focus:outline-none focus:border-black/50 dark:focus:border-white/50"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[10px] uppercase tracking-[0.08em] text-terracing/60 dark:text-floodlight/50 hover:text-black dark:hover:text-white"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </label>

        <label className="block">
          <span className="block font-mono text-[11px] uppercase tracking-[0.1em] text-terracing/70 dark:text-floodlight/50 mb-1.5">
            Terrace Bio
          </span>
          <textarea
            placeholder="Tell us about your terrace style..."
            value={form.bio}
            onChange={(e) => update("bio", e.target.value)}
            rows={3}
            className="w-full bg-transparent border border-black/10 dark:border-white/10 rounded-card px-3 py-2.5 text-sm text-night-pitch dark:text-floodlight placeholder:text-terracing/40 dark:placeholder:text-floodlight/40 focus:outline-none focus:border-black/50 dark:focus:border-white/50 resize-none"
          />
        </label>

        <label className="block">
          <span className="block font-mono text-[11px] uppercase tracking-[0.1em] text-terracing/70 dark:text-floodlight/50 mb-1.5">
            Avatar
          </span>
          <div
            className="w-full h-32 rounded-card border-2 border-dashed border-black/10 dark:border-white/10 flex items-center justify-center overflow-hidden cursor-pointer hover:border-black/30 dark:hover:border-white/30 transition-colors"
            onClick={() => document.getElementById("avatar-input").click()}
          >
            {avatarPreview ? (
              <img
                src={avatarPreview}
                alt="Avatar preview"
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="font-mono text-xs text-terracing/60 dark:text-floodlight/50">
                Click to upload image
              </span>
            )}
          </div>
          <input
            id="avatar-input"
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            className="hidden"
          />
        </label>

        {/* Optional — only changes anything if a valid, unused invite exists */}
        <label className="block">
          <span className="block font-mono text-[11px] uppercase tracking-[0.1em] text-terracing/70 dark:text-floodlight/50 mb-1.5">
            Invite Code <span className="normal-case tracking-normal text-terracing/50 dark:text-floodlight/40">(optional — for admin/author accounts)</span>
          </span>
          <input
            type="text"
            placeholder="Leave blank for a regular account"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            className="w-full bg-transparent border border-black/10 dark:border-white/10 rounded-card px-3 py-2.5 text-sm text-night-pitch dark:text-floodlight placeholder:text-terracing/40 dark:placeholder:text-floodlight/40 focus:outline-none focus:border-black/50 dark:focus:border-white/50"
          />
        </label>

        {error && (
          <p className="text-sm font-mono text-center text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        <Button type="submit" disabled={submitting}>
          {submitting ? "Creating..." : "Create Account"}
        </Button>
      </form>
    </AuthShell>
      </div>
    </div>
  );
}