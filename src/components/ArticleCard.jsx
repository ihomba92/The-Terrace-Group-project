import { useState } from "react";
import { Link } from "react-router-dom";
import { KindLabel, MetaRow } from "./UI";

export default function ArticleCard({ article }) {
  const [imgError, setImgError] = useState(false);
  const {
    id,
    title = "Untitled",
    excerpt = "",
    kind = "ARTICLE",
    upvotes = 0,
    comments = 0,
    isExternal,
    url,
    cover_image,
    image,
  } = article || {};

  const articleImage =
    cover_image ||
    image ||
    "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=600&q=80";

  const cardContent = (
    <>
      <div className="relative w-full h-40 overflow-hidden bg-terracing/20 dark:bg-terracing/40 flex-shrink-0">
        {!imgError ? (
          <img
            src={articleImage}
            alt={title}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.04]"
          />
        ) : (
          // On-brand fallback instead of a blank box — pitch-stripe pattern
          <div
            className="w-full h-full"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, transparent 0 10px, rgba(0,0,0,0.04) 10px 20px)",
            }}
            aria-hidden="true"
          />
        )}

        {/* Scoreboard-style corner badge for the kind label */}
        <div className="absolute top-0 left-0">
          <div className="bg-[#E8A33D] text-night-pitch font-mono text-[10px] font-bold uppercase tracking-[0.1em] px-2.5 py-1 rounded-br-lg shadow-sm">
            <KindLabel>{kind}</KindLabel>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 flex flex-col flex-grow bg-white/80 dark:bg-terracing/40">
        <h2 className="mt-1 font-display font-bold uppercase leading-none text-2xl text-night-pitch dark:text-floodlight text-balance line-clamp-2">
          {title}
        </h2>

        {/* Gold underline that grows in on hover — small signature detail */}
        <span className="mt-2 block h-[2px] w-8 bg-[#E8A33D] transition-all duration-300 ease-out group-hover:w-16" />

        <p className="mt-3 text-sm leading-relaxed text-night-pitch dark:text-floodlight/80 text-pretty flex-grow line-clamp-2">
          {excerpt}
        </p>
        <div className="mt-4">
          <MetaRow upvotes={upvotes} comments={comments} />
        </div>
      </div>
    </>
  );

  const wrapperClass =
    "group block w-full h-full flex flex-col border-2 border-transparent border-b-black/10 dark:border-b-white/10 rounded-xl overflow-hidden transition-all duration-200 ease-out hover:-translate-y-1 hover:border-[#E8A33D]/60 hover:shadow-[0_8px_0_rgba(11,31,23,0.08)]";

  return isExternal ? (
    <a href={url} target="_blank" rel="noreferrer" className={wrapperClass}>
      {cardContent}
    </a>
  ) : (
    <Link to={`/articles/${id}`} className={wrapperClass}>
      {cardContent}
    </Link>
  );
}