import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { tokenize } from "../utils/text.js";

export interface PolicyDocument {
  id: string;
  title: string;
  content: string;
  tokens: string[];
}

export interface RetrievedPolicy {
  document: PolicyDocument;
  score: number;
  excerpt: string;
}

export class LocalVectorStore {
  private docs: PolicyDocument[] = [];

  async load(policyDir: string): Promise<void> {
    const files = (await readdir(policyDir)).filter((file) => file.endsWith(".md")).sort();
    this.docs = await Promise.all(
      files.map(async (file) => {
        const content = await readFile(path.join(policyDir, file), "utf8");
        const title = content.match(/^#\s+(.+)$/m)?.[1] ?? file;
        return { id: file.replace(/\.md$/, ""), title, content, tokens: tokenize(content) };
      })
    );
  }

  retrieve(query: string, limit = 4): RetrievedPolicy[] {
    const queryTokens = new Set(tokenize(query));
    return this.docs
      .map((document) => {
        const score = document.tokens.reduce((sum, token) => sum + (queryTokens.has(token) ? 1 : 0), 0);
        const firstRelevantLine = document.content
          .split("\n")
          .find((line) => tokenize(line).some((token) => queryTokens.has(token)));
        return {
          document,
          score,
          excerpt: (firstRelevantLine ?? document.content.slice(0, 220)).trim()
        };
      })
      .filter((result) => result.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}
