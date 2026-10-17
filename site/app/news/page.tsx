import { getAllPosts } from "@/lib/posts";
import NewsItem from "@/components/NewsItem";

export default function NewsPage() {
  const posts = getAllPosts();
  return (
    <div className="page-grid news-page">
      <header className="page-heading">
        <p className="eyebrow">From the Vanguard</p>
        <h1>Transmissions.</h1>
        <p className="page-lead">
          New modes, new discoveries, and dispatches from the development of
          Sector Zero.
        </p>
      </header>
      <section className="news-list" aria-label="News and updates">
        {posts.map((post) => (
          <NewsItem key={post.slug} post={post} headingLevel="h2" />
        ))}
      </section>
    </div>
  );
}
