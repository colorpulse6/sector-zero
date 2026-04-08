import Link from "next/link";
import Image from "next/image";
import type { PostFrontmatter } from "@/lib/posts";

interface NewsItemProps {
  post: PostFrontmatter;
}

export default function NewsItem({ post }: NewsItemProps) {
  return (
    <Link href={`/news/${post.slug}`} className="block news-accent group">
      <div className="flex gap-4 items-start">
        <div className="w-20 h-20 relative flex-shrink-0 border border-border-hud overflow-hidden">
          <Image
            src={post.heroImage}
            alt={post.title}
            fill
            className="object-cover"
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <span className="font-mono text-[0.6rem] tracking-wider text-purple-accent/80 border border-purple-accent/30 px-1.5 py-0.5">
              {post.tag}
            </span>
            <span className="font-mono text-[0.6rem] text-text-muted">
              {post.date}
            </span>
          </div>
          <h3 className="font-mono text-sm text-cyan-accent group-hover:text-white transition-colors truncate">
            {post.title}
          </h3>
          <p className="text-xs text-text-muted mt-1 line-clamp-2">
            {post.summary}
          </p>
        </div>
      </div>
    </Link>
  );
}
