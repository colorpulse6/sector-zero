import Link from "next/link";
import Image from "next/image";
import type { PostFrontmatter } from "@/lib/posts";
import { withBasePath } from "@/lib/basePath";

export default function NewsItem({
  post,
  headingLevel = "h3",
}: {
  post: PostFrontmatter;
  headingLevel?: "h2" | "h3";
}) {
  const Heading = headingLevel;
  return (
    <Link href={`/news/${post.slug}/`} className="news-item">
      <div className="news-preview">
        <Image
          src={withBasePath(post.heroImage)}
          alt=""
          fill
          sizes="(max-width: 600px) 80px, 120px"
          className="gameplay-image"
        />
      </div>
      <div className="news-copy">
        <div className="post-meta">
          <span>{post.tag}</span>
          <time dateTime={post.date}>{post.date}</time>
        </div>
        <Heading>{post.title}</Heading>
        <p>{post.summary}</p>
      </div>
      <span className="news-arrow" aria-hidden="true">
        ↗
      </span>
    </Link>
  );
}
