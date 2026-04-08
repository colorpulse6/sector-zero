import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import Image from "next/image";
import Link from "next/link";
import { getPostBySlug, getAllSlugs } from "@/lib/posts";
import { mdxComponents } from "@/components/mdx-components";

export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

interface PostPageProps {
  params: Promise<{ slug: string }>;
}

export default async function PostPage({ params }: PostPageProps) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  return (
    <article className="py-12 px-6 max-w-3xl mx-auto">
      <Link
        href="/news"
        className="font-mono text-xs text-text-muted hover:text-cyan-accent transition-colors tracking-wider"
      >
        &larr; BACK TO TRANSMISSIONS
      </Link>

      <div className="mt-6 mb-4 flex items-center gap-3">
        <span className="font-mono text-[0.6rem] tracking-wider text-purple-accent/80 border border-purple-accent/30 px-1.5 py-0.5">
          {post.tag}
        </span>
        <span className="font-mono text-[0.6rem] text-text-muted">
          {post.date}
        </span>
      </div>

      <h1 className="font-mono text-2xl tracking-wider text-cyan-accent mb-6">
        {post.title}
      </h1>

      {post.heroImage && (
        <div className="relative w-full h-64 mb-8 border border-border-hud overflow-hidden">
          <Image
            src={post.heroImage}
            alt={post.title}
            fill
            className="object-contain bg-deep-lighter"
          />
        </div>
      )}

      <div className="prose prose-invert prose-sm max-w-none [&>p]:text-text-primary [&>p]:text-sm [&>p]:leading-relaxed [&>p]:mb-4">
        <MDXRemote source={post.content} components={mdxComponents} />
      </div>
    </article>
  );
}
