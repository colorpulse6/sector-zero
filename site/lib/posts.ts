import fs from "fs";
import path from "path";
import matter from "gray-matter";

const postsDirectory = path.join(process.cwd(), "content", "posts");

export interface PostFrontmatter {
  title: string;
  slug: string;
  date: string;
  tag: string;
  summary: string;
  heroImage: string;
}

export interface PostMeta extends PostFrontmatter {
  content: string;
}

export function getAllPosts(): PostMeta[] {
  const filenames = fs.readdirSync(postsDirectory).filter((f) => f.endsWith(".mdx"));

  const posts = filenames.map((filename) => {
    const filePath = path.join(postsDirectory, filename);
    const fileContents = fs.readFileSync(filePath, "utf-8");
    const { data, content } = matter(fileContents);

    const frontmatter = data as Record<string, unknown>;

    return {
      title: frontmatter.title as string,
      slug: frontmatter.slug as string,
      date: frontmatter.date instanceof Date
        ? frontmatter.date.toISOString().split("T")[0]
        : String(frontmatter.date),
      tag: frontmatter.tag as string,
      summary: frontmatter.summary as string,
      heroImage: frontmatter.heroImage as string,
      content,
    };
  });

  return posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function getPostBySlug(slug: string): PostMeta | undefined {
  const posts = getAllPosts();
  return posts.find((post) => post.slug === slug);
}

export function getAllSlugs(): string[] {
  return getAllPosts().map((post) => post.slug);
}
