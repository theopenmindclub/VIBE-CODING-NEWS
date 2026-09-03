export interface Article {
  id: string;
  title: { [key: string]: string };
  content: { [key: string]: string };
  summary: { [key: string]: string }; // AI-generated bulleted summary
  takeaways: { [key: string]: string[] }; // 3-4 key takeaways
  category: 'News' | 'Tutorials' | 'Agents' | 'Trends' | 'Community Projects';
  author: string;
  publishedAt: string;
  imageUrl: string;
  views: number;
  likes: number;
  upvotes?: number;
  downvotes?: number;
  buildStage?: 'Concept' | 'MVP' | 'Production';
  sourceUrl?: string;
  isAiGenerated: boolean;
  marketInfluence?: { [key: string]: string };
}

export interface ScrapedDraft {
  id: string;
  title: string;
  content: string;
  sourceUrl: string;
  sourceName: string;
  summary: string;
  takeaways: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  sentimentScore: number; // -1 to 1
  category: 'News' | 'Tutorials' | 'Agents' | 'Trends' | 'Community Projects';
  scrapedAt: string;
  status: 'draft' | 'published' | 'ignored';
}

export interface PublicSentimentSummary {
  overall: 'positive' | 'neutral' | 'negative';
  score: number; // percentage or index
  sampleComments: {
    source: string;
    text: string;
    sentiment: 'positive' | 'neutral' | 'negative';
    author: string;
  }[];
  topicStats: {
    topic: string;
    mentionCount: number;
    sentiment: 'positive' | 'neutral' | 'negative';
  }[];
}

export interface Subscriber {
  id: string;
  email: string;
  subscribedAt: string;
  isActive: boolean;
}

export interface AgentLog {
  id: string;
  timestamp: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  details?: string;
}

export interface CrashCourseLesson {
  id: string;
  title: { [key: string]: string };
  description: { [key: string]: string };
  steps: {
    title: { [key: string]: string };
    content: { [key: string]: string };
  }[];
}

export interface Comment {
  id: string;
  articleId: string;
  userId: string;
  userEmail: string;
  userName: string;
  text: string;
  createdAt: any; // Firestore Timestamp
  parentId?: string;
}
