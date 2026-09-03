import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { 
  getArticles, 
  getArticle, 
  saveArticle, 
  incrementArticleViews, 
  incrementArticleLikes,
  getScrapedDrafts,
  saveScrapedDraft,
  updateScrapedDraftStatus,
  getSentimentSummary,
  saveSentimentSummary,
  getSubscribers,
  addSubscriber,
  getAgentLogs,
  addAgentLog,
  seedInitialData
} from './server/db.ts';
import { 
  searchVibeCodingNews, 
  translateArticle, 
  translateText, 
  generateSummaryAndTakeaways,
  chatWithGemini,
  generateMvpPlan,
  chatWithMvpAdvisor
} from './server/gemini.ts';
import { Article, ScrapedDraft } from './src/types.ts';

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize seeding on start
seedInitialData().then(() => {
  console.log('Seeding process checked.');
}).catch((err) => {
  console.error('Error during seeding:', err);
});

// Periodic simulated "hourly" cron job trigger
// Runs in the background but can also be manually triggered
const SCRAPE_INTERVAL = 1000 * 60 * 60; // 1 hour
setInterval(async () => {
  console.log('Running scheduled hourly AI Agent Scraper...');
  try {
    const result = await searchVibeCodingNews();
    
    // Save drafted articles
    for (const d of result.drafts) {
      await saveScrapedDraft({
        ...d,
        status: 'draft',
        scrapedAt: new Date().toISOString()
      });
    }

    // Save sentiment
    await saveSentimentSummary(result.sentiment);

    // Add logs
    for (const log of result.logs) {
      await addAgentLog(log);
    }
    
    await addAgentLog({
      timestamp: new Date().toISOString(),
      type: 'success',
      message: 'Hourly background scraper cron completed successfully.'
    });
  } catch (err: any) {
    console.error('Scheduled scraper error:', err);
    await addAgentLog({
      timestamp: new Date().toISOString(),
      type: 'error',
      message: 'Hourly background scraper cron failed.',
      details: err.message || String(err)
    });
  }
}, SCRAPE_INTERVAL);


// --- API ROUTES ---

// 1. Fetch articles
app.get('/api/articles', async (req, res) => {
  try {
    const articles = await getArticles();
    res.json(articles);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Fetch single article (and increment views)
app.get('/api/articles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const article = await getArticle(id);
    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }
    // Fire-and-forget view increment
    incrementArticleViews(id).catch(err => console.error(err));
    res.json(article);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Like article
app.post('/api/articles/:id/like', async (req, res) => {
  try {
    const { id } = req.params;
    await incrementArticleLikes(id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 3b. Send MVP Plan Email Simulation and Log to Agent Logs
app.post('/api/mvp-plan/send-email', async (req, res) => {
  try {
    const { email, plan, instructions } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    // Log dispatch to Agent Logs collection
    await addAgentLog({
      timestamp: new Date().toISOString(),
      type: 'success',
      message: `MVP Plan emailed successfully to ${email}.`,
      details: `Project concept: "${instructions?.slice(0, 80) || ''}..."`
    });
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Fetch scraped drafts (admin)
app.get('/api/scraped-drafts', async (req, res) => {
  try {
    const drafts = await getScrapedDrafts();
    res.json(drafts);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Publish draft (admin)
app.post('/api/scraped-drafts/:id/publish', async (req, res) => {
  try {
    const { id } = req.params;
    const drafts = await getScrapedDrafts();
    const draft = drafts.find(d => d.id === id);
    if (!draft) {
      return res.status(404).json({ error: 'Draft not found' });
    }

    // Prepare translations for GR (Greek is default), EN, DE, IT, FR, ES
    const targetLanguages = ['GR', 'EN', 'DE', 'IT', 'FR', 'ES'];
    
    await addAgentLog({
      timestamp: new Date().toISOString(),
      type: 'info',
      message: `Publishing draft "${draft.title}". Translating content to multiple languages via Gemini...`
    });

    const translated = await translateArticle(
      { GR: draft.title },
      { GR: draft.content },
      { GR: draft.summary },
      { GR: draft.takeaways },
      targetLanguages
    );

    const articleData: Omit<Article, 'id'> = {
      title: translated.title,
      content: translated.content,
      summary: translated.summary,
      takeaways: translated.takeaways,
      category: draft.category || 'News',
      author: 'AI Web Scraper Agent',
      publishedAt: new Date().toISOString(),
      imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80',
      views: 0,
      likes: 0,
      sourceUrl: draft.sourceUrl,
      isAiGenerated: true
    };

    const newArticle = await saveArticle(articleData);
    await updateScrapedDraftStatus(id, 'published');

    await addAgentLog({
      timestamp: new Date().toISOString(),
      type: 'success',
      message: `Successfully published draft "${draft.title}" as article ID ${newArticle.id}.`
    });

    res.json(newArticle);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Ignore draft (admin)
app.post('/api/scraped-drafts/:id/ignore', async (req, res) => {
  try {
    const { id } = req.params;
    await updateScrapedDraftStatus(id, 'ignored');
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 7. Get sentiment settings
app.get('/api/sentiment', async (req, res) => {
  try {
    const sentiment = await getSentimentSummary();
    res.json(sentiment || {
      overall: 'neutral',
      score: 50,
      sampleComments: [],
      topicStats: []
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 8. Get agent logs
app.get('/api/agent/logs', async (req, res) => {
  try {
    const logs = await getAgentLogs();
    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 9. Trigger scraper agent manually
app.post('/api/agent/trigger', async (req, res) => {
  try {
    await addAgentLog({
      timestamp: new Date().toISOString(),
      type: 'info',
      message: 'Manual crawl requested by Administrator.'
    });

    const result = await searchVibeCodingNews();

    // Save drafted articles
    const savedDrafts: ScrapedDraft[] = [];
    for (const d of result.drafts) {
      const draft = await saveScrapedDraft({
        ...d,
        status: 'draft',
        scrapedAt: new Date().toISOString()
      });
      savedDrafts.push(draft);
    }

    // Save sentiment
    await saveSentimentSummary(result.sentiment);

    // Save logs
    for (const log of result.logs) {
      await addAgentLog(log);
    }

    await addAgentLog({
      timestamp: new Date().toISOString(),
      type: 'success',
      message: 'Manual crawler run completed successfully.'
    });

    res.json({
      success: true,
      draftsCount: savedDrafts.length,
      sentiment: result.sentiment
    });
  } catch (error: any) {
    console.error('Trigger scraper failed:', error);
    await addAgentLog({
      timestamp: new Date().toISOString(),
      type: 'error',
      message: 'Manual crawler run failed.',
      details: error.message || String(error)
    });
    res.status(500).json({ error: error.message });
  }
});

// 10. Subscribe email to newsletter
app.post('/api/newsletter/subscribe', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email is required.' });
    }
    const subscriber = await addSubscriber(email);
    res.json(subscriber);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 11. Send Newsletter Digest manually / cron
app.post('/api/newsletter/send-digest', async (req, res) => {
  try {
    const subs = await getSubscribers();
    const activeSubs = subs.filter(s => s.isActive);
    const articles = await getArticles();
    const recentArticles = articles.slice(0, 3);

    if (activeSubs.length === 0) {
      return res.json({ success: true, message: 'No active subscribers found.' });
    }

    const logMsg = `Compiled newsletter digest featuring ${recentArticles.length} recent articles and dispatched to ${activeSubs.length} active subscribers.`;
    await addAgentLog({
      timestamp: new Date().toISOString(),
      type: 'success',
      message: 'Newsletter automation cron trigger: Send Digest',
      details: logMsg
    });

    res.json({
      success: true,
      subscribersCount: activeSubs.length,
      articlesCount: recentArticles.length,
      message: logMsg
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 12. Dynamic Translation helper for fallback
app.post('/api/translate', async (req, res) => {
  try {
    const { text, targetLang } = req.body;
    if (!text || !targetLang) {
      return res.status(400).json({ error: 'Text and targetLang are required.' });
    }
    const translated = await translateText(text, targetLang);
    res.json({ translated });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 13. Gemini multi-turn chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, systemInstruction, model } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required.' });
    }
    const reply = await chatWithGemini(messages, systemInstruction, model || 'gemini-3.5-flash');
    res.json({ reply });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 14. MVP Plan Generation
app.post('/api/mvp-plan/generate', async (req, res) => {
  try {
    const { instructions, lang } = req.body;
    if (!instructions) {
      return res.status(400).json({ error: 'Instructions are required.' });
    }
    const plan = await generateMvpPlan(instructions, lang || 'GR');
    res.json(plan);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 15. MVP Plan Chat Advisor
app.post('/api/mvp-plan/chat', async (req, res) => {
  try {
    const { messages, planContext, lang } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required.' });
    }
    const reply = await chatWithMvpAdvisor(messages, planContext || '', lang || 'GR');
    res.json({ reply });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});



// --- INTEGRATE VITE FOR SPA ROUTING ---

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Vibe Coding News server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
