import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import Image from "next/image";
import Link from "next/link";
import { getPostBySlug, getAllSlugs } from "@/lib/posts";
import { mdxComponents } from "@/components/mdx-components";
import { withBasePath } from "@/lib/basePath";

export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

interface PostPageProps {
  params: Promise<{ slug: string }>;
}

export default async function PostPage({ params }: PostPageProps) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  return (
    <article className="article-page page-grid">
      <Link href="/news/" className="text-link">
        ← All transmissions
      </Link>
      <header className="article-heading">
        <div className="post-meta">
          <span>{post.tag}</span>
          <time dateTime={post.date}>{post.date}</time>
        </div>
        <h1>{post.title}</h1>
        <p className="page-lead">{post.summary}</p>
      </header>
      {post.heroImage && (
        <figure className="article-hero">
          <Image
            src={withBasePath(post.heroImage)}
            alt={`Gameplay capture for ${post.title}`}
            width={470}
            height={805}
            priority
            sizes="(max-width: 600px) 90vw, 360px"
          />
          <figcaption>Sector Zero · In-game capture</figcaption>
        </figure>
      )}
      <div className="article-body">
        <MDXRemote source={post.content} components={mdxComponents} />
      </div>
      <Link href="/news/" className="text-link article-back">
        ← More transmissions
      </Link>
    </article>
  );
}
