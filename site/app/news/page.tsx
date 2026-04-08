import { getAllPosts } from "@/lib/posts";
import HudSection from "@/components/HudSection";
import NewsItem from "@/components/NewsItem";

export default function NewsPage() {
  const posts = getAllPosts();

  return (
    <HudSection label="TRANSMISSIONS">
      <h2 className="font-mono text-xl tracking-[0.2em] text-cyan-accent mb-8">
        NEWS & UPDATES
      </h2>
      <div className="space-y-6 max-w-3xl">
        {posts.map((post) => (
          <NewsItem key={post.slug} post={post} />
        ))}
      </div>
    </HudSection>
  );
}
