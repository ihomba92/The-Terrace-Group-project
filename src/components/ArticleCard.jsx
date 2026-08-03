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

  // Use cover_image if available, fallback to image or placeholder
  const articleImage = cover_image || image || "/placeholder.svg";

  const cardContent = (
    <>
      <div className="w-full h-40 overflow-hidden bg-terracing/20 dark:bg-terracing/40 flex-shrink-0">
        {!imgError && (
         <img
            src={articleImage}
            alt={title}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
          />
        )}
      </div>
      <div className="px-4 py-4 flex flex-col flex-grow bg-white/80 dark:bg-terracing/40">
        <KindLabel>{kind}</KindLabel>
        <h2 className="mt-3 font-display font-bold uppercase leading-none text-2xl text-night-pitch dark:text-floodlight text-balance line-clamp-2">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-night-pitch dark:text-floodlight/80 text-pretty flex-grow line-clamp-2">
          {excerpt}
        </p>
        <div className="mt-4">
          <MetaRow upvotes={upvotes} comments={comments} />
        </div>
      </div>
    </>
  );

  return isExternal ? (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="block w-full h-full flex flex-col border-b border-black/10 dark:border-white/10">
      {cardContent}
    </a>
  ) : (
    <Link
      to={`/articles/${id}`}
      className="block w-full h-full flex flex-col border-b border-black/10 dark:border-white/10">
      {cardContent}
    </Link>
  );
}