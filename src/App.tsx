import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut as firebaseSignOut, User } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove, collection, addDoc, deleteDoc, query, where, onSnapshot, orderBy, serverTimestamp, getDocFromServer } from 'firebase/firestore';
import { auth, db } from './lib/firebase.ts';
import { Article, Comment } from './types.ts';
import { Language, getTranslation, languages } from './lib/localization.ts';
import { expandArticleContent, toGreekUppercase } from './utils/articleExpander.ts';
import { motion } from 'motion/react';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Import sub-components
import AuthModal from './components/AuthModal.tsx';
import SearchModal from './components/SearchModal.tsx';
import AiSearchModal from './components/AiSearchModal.tsx';
import CrashCourseModal from './components/CrashCourseModal.tsx';
import PremiumServices from './components/PremiumServices.tsx';
import AdminPortal from './components/AdminPortal.tsx';
import StarterPromptGallery from './components/StarterPromptGallery.tsx';
import openmindLogo from './assets/images/openmind_logo_1783948033713.jpg';
import CarouselManual from './components/CarouselManual.tsx';
import PersonalizationModal from './components/PersonalizationModal.tsx';
import FirstTimeWelcomeModal from './components/FirstTimeWelcomeModal.tsx';
import MvpPlanner from './components/MvpPlanner.tsx';
import VibeComics from './components/VibeComics.tsx';
import VibeContests from './components/VibeContests.tsx';
import { YoutubeAndMixCarousel } from './components/YoutubeAndMixCarousel.tsx';
import CrtMilitaryCockpitHud from './components/CrtMilitaryCockpitHud.tsx';

import MarketNotificationsModal from './components/MarketNotificationsModal.tsx';
import { THEME_PALETTES, FONT_OPTIONS, getEffectivePalette } from './lib/themeAndFonts.ts';

// Icons
import { 
  Bell,
  Search, 
  RefreshCw, 
  Sun, 
  Moon, 
  Bookmark, 
  User as UserIcon, 
  Flame, 
  Cpu, 
  Calendar, 
  Eye, 
  Heart, 
  Clock, 
  Sparkles,
  Zap,
  CheckCircle,
  AlertCircle,
  FileText,
  Mail,
  Trash,
  Palette,
  Compass,
  Lock,
  Share2,
  MessageSquare,
  Send,
  Reply,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Square,
  Users,
  Link,
  X,
  Wifi,
  WifiOff,
  TrendingUp,
  Info,
  Globe,
  ShieldCheck,
  BookOpen,
  Sliders,
  Home,
  Settings2,
  Newspaper,
  Rocket,
  BookOpenCheck,
  Trophy,
  SlidersHorizontal,
  GraduationCap
} from 'lucide-react';

function getArticleHashtags(article: Article, lang: Language): string[] {
  const titleStr = (article.title[lang] || article.title.GR || article.title.EN || '').toLowerCase();
  
  const hashtagsMap: Record<string, Record<Language, string[]>> = {
    News: {
      GR: ['#Τεχνολογία', '#Ειδήσεις', '#Ενημέρωση'],
      EN: ['#TechNews', '#BreakingTech', '#Updates'],
      DE: ['#TechNews', '#BreakingNews', '#Aktuell'],
      IT: ['#NotizieTech', '#Attualità', '#MondoTech'],
      FR: ['#ActuTech', '#Actualités', '#Nouveautés'],
      ES: ['#NoticiasTech', '#Actualidad', '#Novedades']
    },
    Tutorials: {
      GR: ['#Οδηγός', '#Προγραμματισμός', '#Εκπαίδευση'],
      EN: ['#Coding', '#Tutorial', '#LearnToCode'],
      DE: ['#Programmieren', '#Tutorial', '#Lernen'],
      IT: ['#Programmazione', '#Tutorial', '#Imparare'],
      FR: ['#Codage', '#Tutoriel', '#Apprendre'],
      ES: ['#Programación', '#Tutorial', '#Aprender']
    },
    Agents: {
      GR: ['#Πράκτορες', '#ΤεχνητήΝοημοσύνη', '#Αυτοματοποίηση'],
      EN: ['#AIAgents', '#ArtificialIntelligence', '#Automation'],
      DE: ['#KIAgenten', '#KünstlicheIntelligenz', '#Automatisierung'],
      IT: ['#AgentiIA', '#IntelligenzaArtificiale', '#Automazione'],
      FR: ['#AgentsIA', '#IntelligenceArtificielle', '#Automatisation'],
      ES: ['#AgentesIA', '#InteligenciaArtificial', '#Automatización']
    },
    Trends: {
      GR: ['#Τάσεις', '#VibeCoding', '#Καινοτομία'],
      EN: ['#TechTrends', '#VibeCoding', '#Innovation'],
      DE: ['#TechTrends', '#VibeCoding', '#Innovation'],
      IT: ['#TendenzeTech', '#VibeCoding', '#Innovazione'],
      FR: ['#TendancesTech', '#VibeCoding', '#Innovation'],
      ES: ['#TendenciasTech', '#VibeCoding', '#Innovación']
    }
  };

  const baseList = hashtagsMap[article.category] || hashtagsMap.News;
  const list = baseList[lang] || baseList.EN;

  const result = [...list];

  if (lang === 'GR') {
    if (titleStr.includes('cursor') || titleStr.includes('replit')) {
      result[1] = '#CursorAI';
      result[2] = '#ReplitAgent';
    } else if (titleStr.includes('ai') || titleStr.includes('νοημοσύν')) {
      result[1] = '#ΤεχνητήΝοημοσύνη';
    } else if (titleStr.includes('γλώσσ')) {
      result[2] = '#ΓλώσσεςΠρογραμματισμού';
    } else if (titleStr.includes('κώδικ') || titleStr.includes('coding')) {
      result[1] = '#VibeCoding';
    }
  } else {
    if (titleStr.includes('cursor') || titleStr.includes('replit')) {
      result[1] = '#CursorAI';
      result[2] = '#ReplitAgent';
    } else if (titleStr.includes('agent')) {
      result[1] = '#AIAgents';
    } else if (titleStr.includes('future') || titleStr.includes('revolution')) {
      result[2] = '#FutureOfWork';
    } else if (titleStr.includes('coding') || titleStr.includes('code')) {
      result[1] = '#VibeCoding';
    }
  }

  return Array.from(new Set(result)).slice(0, 3);
}

function getMarketInfluence(article: Article, lang: Language): string {
  if (article.marketInfluence && article.marketInfluence[lang]) {
    return article.marketInfluence[lang];
  }
  
  const isGreek = lang === 'GR';
  const titleStr = (article.title[lang] || article.title.GR || article.title.EN || '').toLowerCase();

  // Custom specific outputs based on content keywords
  if (titleStr.includes('cursor') || titleStr.includes('replit')) {
    return isGreek
      ? `Αυτή η σύγκριση Cursor vs Replit Agent δείχνει στους vibe coders πώς να επιλέγουν το κατάλληλο εργαλείο για την εργασία τους. Η αγορά μετατοπίζεται από την παραδοσιακή κωδικοποίηση στην έξυπνη ενορχήστρωση, επιτρέποντας στους indie developers να κυκλοφορούν micro-SaaS 10 φορές πιο γρήγορα.`
      : `This comparison between Cursor and Replit Agent shows vibe coders how to choose the right tool for the job. The market is shifting from traditional coding to smart orchestration, enabling indie developers to ship micro-SaaS 10x faster.`;
  }

  if (titleStr.includes('vibe coding') || titleStr.includes('επανάσταση') || titleStr.includes('revolution')) {
    return isGreek
      ? `Η επανάσταση του vibe coding επιτρέπει σε μη τεχνικούς ιδρυτές να κατασκευάζουν πλήρη ψηφιακά προϊόντα με ελάχιστο κόστος. Οι παραδοσιακές software houses πρέπει να μειώσουν τις τιμές τους ή να υιοθετήσουν AI, αλλιώς κινδυνεύουν να μείνουν εκτός αγοράς.`
      : `The vibe coding revolution allows non-technical founders to construct complete digital products at minimal cost. Traditional software houses must reduce prices or adopt AI, or risk being phased out of the market.`;
  }

  if (titleStr.includes('agent') || titleStr.includes('πράκτορ') || titleStr.includes('orchestrator')) {
    return isGreek
      ? `Η επέλαση των αυτόνομων AI Agents σημαίνει ότι οι vibe coders μπορούν πλέον να διευθύνουν ολόκληρες ομάδες εικονικών βοηθών. Αυτό μειώνει το κόστος λειτουργίας startups κατά 80% και δημιουργεί μια νέα γενιά 'solopreneurs' με τεράστια ισχύ.`
      : `The rise of autonomous AI Agents means vibe coders can now manage entire teams of virtual assistants. This slashes startup operating costs by 80% and spawns a new generation of highly-leveraged solopreneurs.`;
  }

  if (titleStr.includes('prompt') || titleStr.includes('blueprints') || titleStr.includes('κιτ')) {
    return isGreek
      ? `Η κατοχή εξειδικευμένων prompts και blueprints δίνει στους vibe coders ένα τεράστιο πλεονέκτημα ταχύτητας στην αγορά. Όσοι επενδύουν σε έτοιμα κιτ (όπως το Prompt Kit) παρακάμπτουν τις εβδομάδες δοκιμών και παραδίδουν έργα σε ώρες αντί για μέρες.`
      : `Possessing specialized prompts and blueprints gives vibe coders a massive time-to-market advantage. Those investing in ready-to-use kits (like the Prompt Kit) bypass weeks of trial-and-error and deliver projects in hours instead of days.`;
  }

  // Dynamic fallback incorporating the actual article title
  const cleanTitle = article.title[lang] || article.title.GR || article.title.EN || '';
  if (article.category === 'News') {
    return isGreek 
      ? `Η είδηση για το "${cleanTitle}" επιταχύνει την υιοθέτηση εργαλείων AI από τους vibe coders, μειώνοντας το χρόνο παράδοσης έργων κατά 40% και μετατοπίζοντας την αγορά προς custom, on-demand λογισμικό.`
      : `This news about "${cleanTitle}" accelerates AI tool adoption among vibe coders, reducing delivery times by 40% and shifting the market toward custom, on-demand software solutions.`;
  } else if (article.category === 'Tutorials') {
    return isGreek
      ? `Ο οδηγός "${cleanTitle}" δίνει άμεσα πρακτικά εφόδια στους vibe coders για να χτίσουν παραγωγικά συστήματα μόνοι τους, παρακάμπτοντας παραδοσιακά κόστη ανάπτυξης και αυξάνοντας την ανταγωνιστικότητά τους.`
      : `The tutorial on "${cleanTitle}" provides practical skills for vibe coders to build production-grade systems independently, bypassing traditional development costs and boosting market competitiveness.`;
  } else if (article.category === 'Agents') {
    return isGreek
      ? `Η εξέλιξη των πρακτόρων στο "${cleanTitle}" αλλάζει το ρόλο του vibe coder από συγγραφέα κώδικα σε ενορχηστρωτή συστημάτων, ανοίγοντας νέες ευκαιρίες για micro-SaaS επιχειρήσεις με μηδενικό αρχικό κεφάλαιο.`
      : `The agency evolution in "${cleanTitle}" shifts the vibe coder's role from writing code to orchestrating systems, unlocking massive opportunities for micro-SaaS ventures with zero starting capital.`;
  } else {
    // Trends
    return isGreek
      ? `Η τάση γύρω από το "${cleanTitle}" επιβεβαιώνει ότι η αγορά κινείται ταχύτατα προς το "no-code/low-code με AI". Οι παραδοσιακές εταιρείες software αναγκάζονται να προσαρμοστούν, ενώ οι vibe coders αποκτούν προβάδισμα 10x στην ταχύτητα υλοποίησης.`
      : `The trend around "${cleanTitle}" confirms that the market is moving rapidly toward "AI-assisted low-code". Traditional software shops must adapt quickly, while vibe coders enjoy a 10x speed advantage in execution.`;
  }
}

const staggerContainerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08
    }
  }
};

const staggerItemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: { 
    opacity: 1, 
    y: 0, 
    transition: { 
      type: 'spring', 
      stiffness: 120, 
      damping: 15 
    } 
  }
};

function toShortPhraseHeadline(title: string): string {
  if (!title) return '';
  const clean = title.replace(/\s+/g, ' ').trim();
  // Split at first colon, dash, semicolon, or pipe
  const firstPhrase = clean.split(/[:\-\–\|—;?]/)[0].trim();
  const words = firstPhrase.split(' ');
  if (words.length > 8) {
    return words.slice(0, 8).join(' ') + '...';
  }
  return firstPhrase;
}

export default function App() {
  // Theme and Language
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('vibe_theme') === 'dark';
  });
  const [lang, setLang] = useState<Language>(() => {
    return (localStorage.getItem('vibe_lang') as Language) || 'GR';
  });

  // Live counting clock state for timezone animation
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Views: 'home' | 'article' | 'bookmarks' | 'admin' | 'carousel-manual' | 'mvp-planner' | 'vibe-comics' | 'vibe-contests'
  const [activeView, setActiveView] = useState<'home' | 'article' | 'bookmarks' | 'admin' | 'carousel-manual' | 'mvp-planner' | 'vibe-comics' | 'vibe-contests'>('home');
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [isArticleExpanded, setIsArticleExpanded] = useState<boolean>(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['All']);
  const [showCommunityModal, setShowCommunityModal] = useState(false);
  const [showNewsletterSuccessModal, setShowNewsletterSuccessModal] = useState(false);

  useEffect(() => {
    setIsArticleExpanded(false);
  }, [selectedArticleId]);

  // Firebase auth & user bookmarks
  const [user, setUser] = useState<User | null>(null);
  const [bookmarks, setBookmarks] = useState<string[]>([]);

  // Reading List & priority metadata: { [articleId]: { priority: 'high' | 'medium' | 'low' | 'none', tags: string[] } }
  const [bookmarksMeta, setBookmarksMeta] = useState<Record<string, { priority: 'high' | 'medium' | 'low' | 'none'; tags: string[] }>>(() => {
    try {
      const stored = localStorage.getItem('vibe_bookmarks_meta_guest');
      return stored ? JSON.parse(stored) : {};
    } catch (e) {
      return {};
    }
  });

  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>('all');

  const handleUpdateBookmarkPriority = (articleId: string, priority: 'high' | 'medium' | 'low' | 'none') => {
    const meta = { ...bookmarksMeta };
    if (!meta[articleId]) {
      meta[articleId] = { priority: 'none', tags: [] };
    }
    meta[articleId].priority = priority;
    setBookmarksMeta(meta);
    localStorage.setItem('vibe_bookmarks_meta_' + (user?.uid || 'guest'), JSON.stringify(meta));
  };

  const handleUpdateBookmarkTag = (articleId: string, tag: string) => {
    const meta = { ...bookmarksMeta };
    if (!meta[articleId]) {
      meta[articleId] = { priority: 'none', tags: [] };
    }
    if (!meta[articleId].tags) {
      meta[articleId].tags = [];
    }
    if (!meta[articleId].tags.includes(tag)) {
      meta[articleId].tags.push(tag);
    }
    setBookmarksMeta(meta);
    localStorage.setItem('vibe_bookmarks_meta_' + (user?.uid || 'guest'), JSON.stringify(meta));
  };

  const handleRemoveBookmarkTag = (articleId: string, tag: string) => {
    const meta = { ...bookmarksMeta };
    if (meta[articleId] && meta[articleId].tags) {
      meta[articleId].tags = meta[articleId].tags.filter(t => t !== tag);
      setBookmarksMeta(meta);
      localStorage.setItem('vibe_bookmarks_meta_' + (user?.uid || 'guest'), JSON.stringify(meta));
    }
  };

  // Articles & states
  const [articles, setArticles] = useState<Article[]>([]);
  const [featuredArticle, setFeaturedArticle] = useState<Article | null>(null);
  const [articlesLoading, setArticlesLoading] = useState(false);
  const [refreshSpinning, setRefreshSpinning] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(() => typeof navigator !== 'undefined' ? !navigator.onLine : false);
  const [loadedFromCache, setLoadedFromCache] = useState(false);
  const [cacheTimestamp, setCacheTimestamp] = useState<number | null>(() => {
    if (typeof localStorage !== 'undefined') {
      const t = localStorage.getItem('vibe_cached_articles_timestamp');
      return t ? parseInt(t, 10) : null;
    }
    return null;
  });

  // Scroll & Comments & Sharing State
  const [scrollProgress, setScrollProgress] = useState(0);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [copiedArticleId, setCopiedArticleId] = useState<string | null>(null);

  // Nested comments reply states
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replySubmitting, setReplySubmitting] = useState(false);

  // Daily Reading Streak states
  const [streakCount, setStreakCount] = useState<number>(0);
  const [lastReadDate, setLastReadDate] = useState<string>('');

  // Mobile text sizing state
  const [textSize] = useState<'md' | 'lg' | 'xl'>('xl');

  // Speech synthesis states
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSpeechPaused, setIsSpeechPaused] = useState(false);
  const [speechRate, setSpeechRate] = useState<number>(1);
  const [speechPitch, setSpeechPitch] = useState<number>(1);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>('');
  const utteranceRef = React.useRef<SpeechSynthesisUtterance | null>(null);

  // Update voices list when language or system voices change
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    const updateVoices = () => {
      const allVoices = window.speechSynthesis.getVoices();
      const prefix = lang === 'GR' ? 'el' : lang === 'DE' ? 'de' : lang === 'IT' ? 'it' : lang === 'FR' ? 'fr' : lang === 'ES' ? 'es' : 'en';
      const filtered = allVoices.filter(v => v.lang.toLowerCase().startsWith(prefix));
      setAvailableVoices(filtered);
      
      // Auto-select first matching voice if current selected isn't in this list
      if (filtered.length > 0) {
        const hasCurrent = filtered.some(v => v.voiceURI === selectedVoiceURI);
        if (!hasCurrent) {
          setSelectedVoiceURI(filtered[0].voiceURI);
        }
      } else {
        setSelectedVoiceURI('');
      }
    };

    updateVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
    
    // Add event listener as a fallback
    window.speechSynthesis.addEventListener('voiceschanged', updateVoices);
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.removeEventListener('voiceschanged', updateVoices);
      }
    };
  }, [lang, selectedVoiceURI]);

  // Cancel speech when selected article, view, or language changes
  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setIsSpeechPaused(false);
  }, [activeView, selectedArticleId, lang]);

  const startListening = (rate: number, voiceURI: string, pitch: number) => {
    if (!selectedArticle) return;
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();

    // Combine title, summary, and content for reading
    const titleText = selectedArticle.title[lang] || selectedArticle.title.GR || selectedArticle.title.EN || '';
    const summaryText = selectedArticle.summary ? (selectedArticle.summary[lang] || selectedArticle.summary.GR || selectedArticle.summary.EN || '') : '';
    const contentText = selectedArticle.content[lang] || selectedArticle.content.GR || selectedArticle.content.EN || '';

    const fullTextToRead = `${titleText}. ${summaryText ? summaryText + '. ' : ''}${contentText}`;

    const utterance = new SpeechSynthesisUtterance(fullTextToRead);
    utterance.lang = lang === 'GR' ? 'el-GR' : lang === 'DE' ? 'de-DE' : lang === 'IT' ? 'it-IT' : lang === 'FR' ? 'fr-FR' : lang === 'ES' ? 'es-ES' : 'en-US';
    utterance.rate = rate;
    utterance.pitch = pitch;

    // Pick selected voice
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find(v => v.voiceURI === voiceURI);
    if (voice) {
      utterance.voice = voice;
    } else {
      const prefix = lang === 'GR' ? 'el' : lang === 'DE' ? 'de' : lang === 'IT' ? 'it' : lang === 'FR' ? 'fr' : lang === 'ES' ? 'es' : 'en';
      const fallbackVoice = voices.find(v => v.lang.toLowerCase().startsWith(prefix));
      if (fallbackVoice) {
        utterance.voice = fallbackVoice;
      }
    }

    utterance.onend = () => {
      setIsSpeaking(false);
      setIsSpeechPaused(false);
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
      setIsSpeechPaused(false);
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
    setIsSpeechPaused(false);
  };

  const handleToggleListen = () => {
    if (!selectedArticle) return;
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      console.warn("Speech synthesis is not supported in this browser.");
      return;
    }

    if (isSpeaking) {
      if (isSpeechPaused) {
        window.speechSynthesis.resume();
        setIsSpeechPaused(false);
      } else {
        window.speechSynthesis.pause();
        setIsSpeechPaused(true);
      }
    } else {
      startListening(speechRate, selectedVoiceURI, speechPitch);
    }
  };

  const handleStopListen = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setIsSpeechPaused(false);
  };

  const handleSpeedChange = (rate: number) => {
    setSpeechRate(rate);
    if (isSpeaking) {
      setTimeout(() => {
        startListening(rate, selectedVoiceURI, speechPitch);
      }, 50);
    }
  };

  const handleVoiceChange = (voiceURI: string) => {
    setSelectedVoiceURI(voiceURI);
    if (isSpeaking) {
      setTimeout(() => {
        startListening(speechRate, voiceURI, speechPitch);
      }, 50);
    }
  };

  const handlePitchChange = (pitch: number) => {
    setSpeechPitch(pitch);
    if (isSpeaking) {
      setTimeout(() => {
        startListening(speechRate, selectedVoiceURI, pitch);
      }, 50);
    }
  };

  // Modals & Dropdowns
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showAiSearchModal, setShowAiSearchModal] = useState(false);
  const [showCrashCourseModal, setShowCrashCourseModal] = useState(false);
  const [showPromptGallery, setShowPromptGallery] = useState(false);
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const [showPaletteDropdown, setShowPaletteDropdown] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showTopicsModal, setShowTopicsModal] = useState(false);
  const [showPersonalizationModal, setShowPersonalizationModal] = useState(false);
  const [showMarketNotifsModal, setShowMarketNotifsModal] = useState(false);
  const [showDisclaimerModal, setShowDisclaimerModal] = useState(false);
  const [isMinimalistLayout, setIsMinimalistLayout] = useState(() => {
    return localStorage.getItem('vibe_minimalist_layout') === 'true';
  });
  const [fontSizeZoom, setFontSizeZoom] = useState<boolean>(false);

  // Vibe Code News Flow state
  const [vibeFlowSeed, setVibeFlowSeed] = useState('');
  const [vibeFlowStep, setVibeFlowStep] = useState<'idle' | 'running' | 'completed'>('idle');
  const [vibeFlowLogs, setVibeFlowLogs] = useState<string[]>([]);
  const [vibeGeneratedHeadline, setVibeGeneratedHeadline] = useState<{title: string, sub: string, sticker: string, soundEffect: string} | null>(null);

  // Ask AI about this article modal states
  const [showArticleAiModal, setShowArticleAiModal] = useState(false);
  const [articleAiInput, setArticleAiInput] = useState('');
  const [articleAiLoading, setArticleAiLoading] = useState(false);
  const [articleAiError, setArticleAiError] = useState('');
  const [articleAiMessages, setArticleAiMessages] = useState<{ id: string; role: 'user' | 'model'; text: string; timestamp: string }[]>([]);

  // First-time Welcome Theme Onboarding Modal State
  const [showWelcomeModal, setShowWelcomeModal] = useState<boolean>(() => {
    return localStorage.getItem('vibe_welcome_theme_configured') !== 'true';
  });

  // Dynamic Typography Font State
  const [activeFont, setActiveFont] = useState<string>(() => {
    return localStorage.getItem('vibe_font') || 'regular';
  });

  // Dynamic Theme Palette State
  const [activePalette, setActivePalette] = useState(() => {
    return localStorage.getItem('vibe_palette') || 'greek_summer';
  });

  const activeFontObj = FONT_OPTIONS.find(f => f.id === activeFont) || FONT_OPTIONS[0];

  const currentPalette = getEffectivePalette(activePalette, isDarkMode);

  const palettesList = THEME_PALETTES.map(p => ({
    id: p.id,
    name: p.name[lang === 'GR' ? 'GR' : 'EN'],
    bg: p.bg,
    text: p.text,
    link: p.link,
    category: p.category,
    cta: p.cta,
    border: p.border,
    cardBg: p.cardBg,
    badgeBg: p.badgeBg,
  }));

  // Newsletter Input
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterLoading, setNewsletterLoading] = useState(false);
  const [newsletterSuccess, setNewsletterSuccess] = useState(false);
  const [newsletterError, setNewsletterError] = useState('');

  // Likes in memory for instant feedback
  const [likedArticles, setLikedArticles] = useState<string[]>([]);

  // Voting & Build Stage States
  const [votedArticles, setVotedArticles] = useState<{[key: string]: 'up' | 'down'}>({});
  const [showVoteModal, setShowVoteModal] = useState(false);
  const [votingArticleId, setVotingArticleId] = useState<string | null>(null);
  const [pendingVoteType, setPendingVoteType] = useState<'up' | 'down' | null>(null);
  const [voteExplanationText, setVoteExplanationText] = useState('');
  const [voteSubmitting, setVoteSubmitting] = useState(false);

  // Fetch articles from backend with offline fallback caching
  const fetchArticles = async () => {
    setArticlesLoading(true);
    setRefreshSpinning(true);
    try {
      const response = await fetch('/api/articles');
      if (response.ok) {
        const data = await response.json();
        setArticles(data);
        setLoadedFromCache(false);
        setIsOfflineMode(false);
        if (data.length > 0) {
          // Put the most viewed article as the featured headliner!
          const sorted = [...data].sort((a, b) => b.views - a.views);
          setFeaturedArticle(sorted[0]);
        }
        
        // Cache in local storage
        try {
          localStorage.setItem('vibe_cached_articles', JSON.stringify(data));
          localStorage.setItem('vibe_cached_articles_timestamp', Date.now().toString());
          setCacheTimestamp(Date.now());
        } catch (storageErr) {
          console.warn('Storage quota or security restriction prevented caching articles:', storageErr);
        }
      } else {
        throw new Error('Server returned non-ok response');
      }
    } catch (error) {
      console.warn('Failed to fetch articles, attempting to load from offline cache:', error);
      setIsOfflineMode(true);
      
      // Attempt cache loading
      try {
        const cachedStr = localStorage.getItem('vibe_cached_articles');
        const timestampStr = localStorage.getItem('vibe_cached_articles_timestamp');
        if (cachedStr) {
          const cachedData = JSON.parse(cachedStr);
          setArticles(cachedData);
          setLoadedFromCache(true);
          if (timestampStr) {
            setCacheTimestamp(parseInt(timestampStr, 10));
          }
          if (cachedData.length > 0) {
            const sorted = [...cachedData].sort((a, b) => b.views - a.views);
            setFeaturedArticle(sorted[0]);
          }
        }
      } catch (cacheErr) {
        console.error('Failed to read from local offline cache:', cacheErr);
      }
    } finally {
      setArticlesLoading(false);
      setTimeout(() => setRefreshSpinning(false), 800);
    }
  };

  useEffect(() => {
    fetchArticles();
  }, []);

  // Monitor connection status
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setIsOfflineMode(false);
      fetchArticles(); // Re-fetch when online status restored
    };
    const handleOffline = () => {
      setIsOfflineMode(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Listen to Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Load user bookmarks metadata
        const metaKey = 'vibe_bookmarks_meta_' + currentUser.uid;
        try {
          const stored = localStorage.getItem(metaKey);
          if (stored) {
            setBookmarksMeta(JSON.parse(stored));
          } else {
            setBookmarksMeta({});
          }
        } catch (e) {
          setBookmarksMeta({});
        }

        // Load user bookmarks from Firestore
        const localKey = 'local_bookmarks_' + currentUser.uid;
        try {
          const docRef = doc(db, 'users_bookmarks', currentUser.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const list = docSnap.data().articleIds || [];
            setBookmarks(list);
            try {
              localStorage.setItem(localKey, JSON.stringify(list));
            } catch (e) {
              // ignore storage limits
            }
          } else {
            // Create initial empty document
            await setDoc(docRef, { articleIds: [] });
            setBookmarks([]);
            try {
              localStorage.setItem(localKey, JSON.stringify([]));
            } catch (e) {}
          }
        } catch (error) {
          // If offline, check if we have them cached in localStorage
          const cached = localStorage.getItem(localKey);
          if (cached) {
            try {
              setBookmarks(JSON.parse(cached));
            } catch (e) {
              setBookmarks([]);
            }
          } else {
            setBookmarks([]);
          }

          if (error instanceof Error && (error.message.includes('offline') || error.message.includes('unavailable') || error.message.includes('reach Cloud Firestore backend'))) {
            console.warn('Operating in offline mode. Loaded bookmarks from cache.');
          } else {
            console.warn('Could not fetch bookmarks from server, using local fallback:', error);
          }
        }
      } else {
        setBookmarks([]);
        try {
          const stored = localStorage.getItem('vibe_bookmarks_meta_guest');
          setBookmarksMeta(stored ? JSON.parse(stored) : {});
        } catch (e) {
          setBookmarksMeta({});
        }
      }
    });
    return unsubscribe;
  }, []);

  // Sync theme changes to standard body / classList
  useEffect(() => {
    const root = window.document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
      localStorage.setItem('vibe_theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('vibe_theme', 'light');
    }
  }, [isDarkMode]);

  const handleLanguageChange = (code: Language) => {
    setLang(code);
    localStorage.setItem('vibe_lang', code);
  };

  const getLocalDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getYesterdayDateString = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getReadingTimeDetails = (content: string) => {
    const words = content.trim().split(/\s+/).filter(Boolean).length;
    const time = Math.max(1, Math.ceil(words / 200));
    let colorClass = "";
    if (time < 3) {
      colorClass = "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30";
    } else if (time <= 7) {
      colorClass = "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30";
    } else {
      colorClass = "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30";
    }
    return { time, colorClass };
  };

  // Connection tester
  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && (error.message.includes('offline') || error.message.includes('unavailable') || error.message.includes('reach Cloud Firestore backend'))) {
          console.warn("Firestore client is offline or server is unreachable. Operating in offline/cached mode.");
        } else {
          console.warn("Please check your Firebase configuration or network status.");
        }
      }
    };
    testConnection();
  }, []);

  // Real-time Reading Streak subscription
  useEffect(() => {
    if (!user) {
      setStreakCount(0);
      setLastReadDate('');
      return;
    }

    const docRef = doc(db, 'users_profiles', user.uid);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setStreakCount(data.streakCount || 0);
        setLastReadDate(data.lastReadDate || '');
      } else {
        setStreakCount(0);
        setLastReadDate('');
      }
    }, (error) => {
      console.warn("Error loading user profile:", error);
    });

    return unsubscribe;
  }, [user]);

  // Trigger reading streak check when reading an article
  useEffect(() => {
    if (!user || activeView !== 'article' || !selectedArticleId) return;

    const updateStreak = async () => {
      try {
        const today = getLocalDateString();
        const yesterday = getYesterdayDateString();
        const docRef = doc(db, 'users_profiles', user.uid);
        
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          const lastDate = data.lastReadDate || '';
          const currentStreak = data.streakCount || 0;

          if (lastDate === today) {
            // Already read today, do nothing to preserve streak count
            return;
          }

          let newStreak = 1;
          if (lastDate === yesterday) {
            newStreak = currentStreak + 1;
          }

          await setDoc(docRef, {
            userId: user.uid,
            streakCount: newStreak,
            lastReadDate: today,
            updatedAt: serverTimestamp()
          }, { merge: true });
        } else {
          // New user profile
          await setDoc(docRef, {
            userId: user.uid,
            streakCount: 1,
            lastReadDate: today,
            updatedAt: serverTimestamp()
          });
        }
      } catch (error) {
        console.error("Error updating daily reading streak:", error);
      }
    };

    updateStreak();
  }, [user, activeView, selectedArticleId]);

  // Deep link checks on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const articleId = params.get('article');
    if (articleId) {
      setSelectedArticleId(articleId);
      setActiveView('article');
    }
  }, []);

  // Scroll Progress Tracker
  useEffect(() => {
    if (activeView !== 'article') {
      setScrollProgress(0);
      return;
    }

    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (totalHeight > 0) {
        const progress = (window.scrollY / totalHeight) * 100;
        setScrollProgress(progress);
      } else {
        setScrollProgress(0);
      }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial check

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [activeView, selectedArticleId]);

  // Real-time Comments Subscription (Client-side sorted to bypass index requirements)
  useEffect(() => {
    if (activeView !== 'article' || !selectedArticleId) {
      setComments([]);
      return;
    }

    const commentsQuery = query(
      collection(db, 'comments'),
      where('articleId', '==', selectedArticleId)
    );

    const unsubscribe = onSnapshot(commentsQuery, (snapshot) => {
      const loadedComments: Comment[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        loadedComments.push({
          id: docSnap.id,
          articleId: data.articleId || '',
          userId: data.userId || '',
          userEmail: data.userEmail || '',
          userName: data.userName || '',
          text: data.text || '',
          createdAt: data.createdAt,
          parentId: data.parentId || undefined
        });
      });

      // Client-side ascending sort by createdAt timestamp seconds
      loadedComments.sort((a, b) => {
        const secA = a.createdAt?.seconds || 0;
        const secB = b.createdAt?.seconds || 0;
        return secA - secB;
      });

      setComments(loadedComments);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'comments');
    });

    return unsubscribe;
  }, [activeView, selectedArticleId]);

  // Post Comment Handler
  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedArticleId || !newCommentText.trim()) return;

    // Verify user has not commented yet (one comment per user restriction)
    const hasCommented = comments.some((c) => c.userId === user.uid && !c.parentId);
    if (hasCommented) {
      alert(lang === 'GR' ? 'Έχετε ήδη σχολιάσει σε αυτό το άρθρο!' : 'You have already commented on this article!');
      return;
    }

    setCommentSubmitting(true);
    try {
      const emailPrefix = user.email ? user.email.split('@')[0] : 'User';
      await addDoc(collection(db, 'comments'), {
        articleId: selectedArticleId,
        userId: user.uid,
        userEmail: user.email || '',
        userName: user.displayName || emailPrefix,
        text: newCommentText.trim(),
        createdAt: serverTimestamp()
      });
      setNewCommentText('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'comments');
    } finally {
      setCommentSubmitting(false);
    }
  };

  // Delete Comment Handler
  const handleDeleteComment = async (commentId: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'comments', commentId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `comments/${commentId}`);
    }
  };

  // Post Comment Reply Handler
  const handlePostReply = async (parentCommentId: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedArticleId || !replyText.trim()) return;

    setReplySubmitting(true);
    try {
      const emailPrefix = user.email ? user.email.split('@')[0] : 'User';
      await addDoc(collection(db, 'comments'), {
        articleId: selectedArticleId,
        userId: user.uid,
        userEmail: user.email || '',
        userName: user.displayName || emailPrefix,
        text: replyText.trim(),
        createdAt: serverTimestamp(),
        parentId: parentCommentId
      });
      setReplyText('');
      setReplyingToId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'comments');
    } finally {
      setReplySubmitting(false);
    }
  };

  // Clipboard Copy Fallback for iframe safety
  const copyToClipboardFallback = (text: string): boolean => {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.top = "0";
      textArea.style.left = "0";
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    } catch (err) {
      console.error("Fallback copy failed:", err);
      return false;
    }
  };

  // Share Article Handler
  const handleShareArticle = async (articleId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const shareUrl = `${window.location.origin}${window.location.pathname}?article=${articleId}`;
    let success = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        success = true;
      }
    } catch (err) {
      console.warn("Navigator clipboard failed, trying fallback:", err);
    }

    if (!success) {
      success = copyToClipboardFallback(shareUrl);
    }

    if (success) {
      setCopiedArticleId(articleId);
      setTimeout(() => {
        setCopiedArticleId(null);
      }, 2000);
    } else {
      console.error("Failed to copy link using both methods.");
    }
  };

  // Open the Ask AI Article Modal and initialize with dynamic greeting
  const handleOpenArticleAiModal = () => {
    if (!selectedArticle) return;
    const title = selectedArticle.title[lang] || selectedArticle.title.GR || selectedArticle.title.EN || '';
    setArticleAiMessages([
      {
        id: 'welcome',
        role: 'model',
        text: lang === 'GR'
          ? `Γεια! Είμαι ο AI Βοηθός του Open Mind Club. Μπορώ να σε βοηθήσω να αναλύσεις το άρθρο **«${title}»**. Ρώτησέ με ό,τι θέλεις σχετικά με το περιεχόμενο, τις τάσεις ή την τεχνική ανάλυσή του!`
          : `Hi! I am the Open Mind Club AI Assistant. I can help you analyze the article **"${title}"**. Ask me anything about its content, trends, or technical analysis!`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
    setArticleAiInput('');
    setArticleAiError('');
    setArticleAiLoading(false);
    setShowArticleAiModal(true);
  };

  // Handle queries to the specific article AI assistant
  const handleSendArticleAiMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!articleAiInput.trim() || articleAiLoading || !selectedArticle) return;

    const userText = articleAiInput.trim();
    setArticleAiInput('');
    setArticleAiError('');
    setArticleAiLoading(true);

    const newUserMessage = {
      id: Math.random().toString(),
      role: 'user' as const,
      text: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const updatedMessages = [...articleAiMessages, newUserMessage];
    setArticleAiMessages(updatedMessages);

    try {
      const artTitle = selectedArticle.title[lang] || selectedArticle.title.GR || selectedArticle.title.EN || '';
      const artContent = selectedArticle.content[lang] || selectedArticle.content.GR || selectedArticle.content.EN || '';
      const artSummary = selectedArticle.summary ? (selectedArticle.summary[lang] || selectedArticle.summary.GR || selectedArticle.summary.EN || '') : '';
      const artTakeaways = selectedArticle.takeaways && selectedArticle.takeaways[lang] ? selectedArticle.takeaways[lang].join('\n') : '';

      const systemInstruction = `You are a brilliant, professional AI Tech Consultant assistant for the 'Vibe Coding News' portal by the Open Mind Club.
Your task is to answer user queries SPECIFICALLY about the article they are currently viewing.
Do not lose context of the article. Be objective, accurate, highly helpful, and structure your responses cleanly.

Here is the context of the article they are currently reading:
- **Title**: ${artTitle}
- **Author**: ${selectedArticle.author}
- **Category**: ${selectedArticle.category}
- **Summary**: ${artSummary}
- **Key Takeaways**:
${artTakeaways}
- **Full Article Content**:
${artContent}

Answer the user's question clearly, drawing on the article's contents and context where relevant. Respond in the same language as the user's query (Greek or English).`;

      // Map messages for @google/genai
      const messagesPayload = updatedMessages.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.text }]
      }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messagesPayload,
          systemInstruction,
          model: 'gemini-3.5-flash'
        })
      });

      if (!res.ok) {
        throw new Error('AI Assistant failed to respond.');
      }

      const data = await res.json();

      setArticleAiMessages(prev => [
        ...prev,
        {
          id: Math.random().toString(),
          role: 'model',
          text: data.reply || (lang === 'GR' ? 'Συγγνώμη, δεν μπόρεσα να επεξεργαστώ την απάντηση.' : 'Sorry, I could not process a response.'),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } catch (err: any) {
      console.error(err);
      setArticleAiError(lang === 'GR' ? 'Σφάλμα σύνδεσης με τον AI Βοηθό. Παρακαλώ προσπαθήστε ξανά.' : 'Connection error with the AI Assistant. Please try again.');
    } finally {
      setArticleAiLoading(false);
    }
  };

  // Toggle Bookmark logic
  const handleToggleBookmark = async (articleId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    if (!user) {
      setShowAuthModal(true);
      return;
    }

    const docRef = doc(db, 'users_bookmarks', user.uid);
    const isBookmarked = bookmarks.includes(articleId);
    const localKey = 'local_bookmarks_' + user.uid;

    try {
      if (isBookmarked) {
        const updated = bookmarks.filter((id) => id !== articleId);
        setBookmarks(updated);
        try {
          localStorage.setItem(localKey, JSON.stringify(updated));
        } catch (e) {}
        await updateDoc(docRef, {
          articleIds: arrayRemove(articleId),
        });
      } else {
        const updated = [...bookmarks, articleId];
        setBookmarks(updated);
        try {
          localStorage.setItem(localKey, JSON.stringify(updated));
        } catch (e) {}
        await updateDoc(docRef, {
          articleIds: arrayUnion(articleId),
        });
      }
    } catch (error) {
      if (error instanceof Error && (error.message.includes('offline') || error.message.includes('unavailable') || error.message.includes('reach Cloud Firestore backend'))) {
        console.warn('Database is offline. Saved bookmark state locally in browser.');
      } else {
        console.warn('Error updating bookmark in database, saved locally:', error);
      }
    }
  };

  // Like Article logic
  const handleLikeArticle = async (articleId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (likedArticles.includes(articleId)) return;

    try {
      const res = await fetch(`/api/articles/${articleId}/like`, { method: 'POST' });
      if (res.ok) {
        setLikedArticles([...likedArticles, articleId]);
        // Update local views list
        setArticles(articles.map(art => {
          if (art.id === articleId) {
            return { ...art, likes: art.likes + 1 };
          }
          return art;
        }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Vote Article Handler
  const handleVoteArticle = (articleId: string, voteType: 'up' | 'down') => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    setVotingArticleId(articleId);
    setPendingVoteType(voteType);
    setVoteExplanationText('');
    setShowVoteModal(true);
  };

  // Submit Vote and Comment Explanation
  const handleSubmitVoteExplanation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !votingArticleId || !pendingVoteType || !voteExplanationText.trim()) return;

    setVoteSubmitting(true);
    try {
      const articleRef = doc(db, 'articles', votingArticleId);
      const articleToVote = articles.find(a => a.id === votingArticleId);
      if (!articleToVote) throw new Error('Article not found');

      // 1. Calculate new vote counts
      const updatedUpvotes = pendingVoteType === 'up' 
        ? (articleToVote.upvotes || 0) + 1 
        : (articleToVote.upvotes || 0);
      const updatedDownvotes = pendingVoteType === 'down' 
        ? (articleToVote.downvotes || 0) + 1 
        : (articleToVote.downvotes || 0);

      // 2. Update Firestore Article
      await updateDoc(articleRef, {
        upvotes: updatedUpvotes,
        downvotes: updatedDownvotes
      });

      // 3. Post explanations as a Comment
      const voteTag = pendingVoteType === 'up' ? '▲ Upvote' : '▼ Downvote';
      const emailPrefix = user.email ? user.email.split('@')[0] : 'User';
      const commentText = `[${voteTag}] ${voteExplanationText.trim()}`;

      await addDoc(collection(db, 'comments'), {
        articleId: votingArticleId,
        userId: user.uid,
        userEmail: user.email || '',
        userName: user.displayName || emailPrefix,
        text: commentText,
        createdAt: serverTimestamp()
      });

      // 4. Update local state
      setVotedArticles(prev => ({ ...prev, [votingArticleId]: pendingVoteType }));
      setArticles(prevArticles => prevArticles.map(art => {
        if (art.id === votingArticleId) {
          return { ...art, upvotes: updatedUpvotes, downvotes: updatedDownvotes };
        }
        return art;
      }));

      // Close modal
      setShowVoteModal(false);
      setVotingArticleId(null);
      setPendingVoteType(null);
      setVoteExplanationText('');
    } catch (err) {
      console.error('Error submitting vote explanation:', err);
    } finally {
      setVoteSubmitting(false);
    }
  };

  // Update Project Build Stage
  const handleUpdateBuildStage = async (articleId: string, stage: 'Concept' | 'MVP' | 'Production') => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    const message = lang === 'GR' 
      ? `Θέλετε σίγουρα να αλλάξετε το στάδιο υλοποίησης του project σε "${stage}";` 
      : `Are you sure you want to mark the project stage as "${stage}"?`;
    
    if (!window.confirm(message)) return;

    try {
      const articleRef = doc(db, 'articles', articleId);
      await updateDoc(articleRef, {
        buildStage: stage
      });

      // Update local state
      setArticles(prevArticles => prevArticles.map(art => {
        if (art.id === articleId) {
          return { ...art, buildStage: stage };
        }
        return art;
      }));
    } catch (err) {
      console.error('Error updating build stage:', err);
    }
  };

  // Subscribe Newsletter
  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail.trim() || !newsletterEmail.includes('@')) return;

    setNewsletterLoading(true);
    setNewsletterError('');
    setNewsletterSuccess(false);

    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newsletterEmail }),
      });

      if (!res.ok) throw new Error('Subscription failed.');
      
      setNewsletterSuccess(true);
      setShowNewsletterSuccessModal(true);
      setNewsletterEmail('');
    } catch (err: any) {
      setNewsletterError(lang === 'GR' ? 'Σφάλμα εγγραφής. Παρακαλώ ξαναδοκιμάστε.' : 'Failed to subscribe. Please try again.');
    } finally {
      setNewsletterLoading(false);
    }
  };

  const handleSignOut = async () => {
    await firebaseSignOut(auth);
    setActiveView('home');
  };

  const handleRunVibeFlow = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vibeFlowSeed.trim()) return;

    setVibeFlowStep('running');
    setVibeFlowLogs([
      lang === 'GR' ? '🔄 Σύνδεση με το Vibe Coded δίκτυο της Base44...' : '🔄 Connecting to Base44 Vibe Coded network...',
    ]);

    const steps = [
      {
        delay: 800,
        log: lang === 'GR' ? '📡 Λήψη παραμέτρων αισιοδοξίας και ηθικού σθένους...' : '📡 Retrieving optimism parameters and moral grit...'
      },
      {
        delay: 1600,
        log: lang === 'GR' ? '⚙️ Μορφοποίηση δεδομένων σε στυλ Pop Art / Comic Book...' : '⚙️ Formatting data in Pop Art / Comic Book style...'
      },
      {
        delay: 2400,
        log: lang === 'GR' ? '✨ Παραγωγή θετικών δονήσεων και micro-news flow...' : '✨ Generating positive vibrations and micro-news flow...'
      }
    ];

    steps.forEach((step) => {
      setTimeout(() => {
        setVibeFlowLogs(prev => [...prev, step.log]);
      }, step.delay);
    });

    setTimeout(() => {
      const keyword = vibeFlowSeed.toLowerCase();
      let title = '';
      let sub = '';
      let sticker = '🚀';
      let soundEffect = 'BOOM!';

      if (keyword.includes('energy') || keyword.includes('ενέργεια') || keyword.includes('solar') || keyword.includes('ήλιος')) {
        title = lang === 'GR' ? 'ΗΛΙΑΚΗ ΕΠΑΝΑΣΤΑΣΗ ΣΤΗΝ ΠΑΤΡΑ!' : 'SOLAR POWER TRIUMPH!';
        sub = lang === 'GR' ? 'Μια νεοφυής επιχείρηση εγκατέστησε 100% καθαρή ενέργεια σε όλα τα σχολεία!' : 'Clean green energy now powers 100% of local public high-schools!';
        sticker = '☀️';
        soundEffect = 'ZAP!';
      } else if (keyword.includes('code') || keyword.includes('κώδικας') || keyword.includes('build') || keyword.includes('app')) {
        title = lang === 'GR' ? 'Ο ΚΩΔΙΚΑΣ ΤΗΣ ΑΙΣΙΟΔΟΞΙΑΣ ΤΡΕΧΕΙ LIVE!' : 'VIBE CODE IS COMPILING LIVE!';
        sub = lang === 'GR' ? 'Κάθε γραμμή κώδικα φέρνει μια νέα σπίθα δημιουργίας, χωρίς σφάλματα!' : 'Every line of code sparks fresh, beautiful, error-free creation!';
        sticker = '💻';
        soundEffect = 'VIBE!';
      } else {
        title = lang === 'GR' ? `ΕΥΡΗΚΑ! ΤΟ «${vibeFlowSeed.toUpperCase()}» ΕΙΝΑΙ LIVE!` : `EUREKA! "${vibeFlowSeed.toUpperCase()}" IS LIVE!`;
        sub = lang === 'GR' ? 'Μια απίστευτη ανακάλυψη που φωτίζει το μέλλον και δίνει ελπίδα!' : 'An incredible positive discovery illuminating the future of global web development!';
        sticker = '🌟';
        soundEffect = 'SPARK!';
      }

      setVibeGeneratedHeadline({ title, sub, sticker, soundEffect });
      setVibeFlowStep('completed');
    }, 3200);
  };

  // Toggle Category Handler (Multi-Select)
  const handleToggleCategory = (cat: string) => {
    if (cat === 'All') {
      setSelectedCategories(['All']);
    } else {
      let updated = [...selectedCategories];
      if (updated.includes('All')) {
        updated = updated.filter(c => c !== 'All');
      }
      if (updated.includes(cat)) {
        updated = updated.filter(c => c !== cat);
        if (updated.length === 0) {
          updated = ['All'];
        }
      } else {
        updated.push(cat);
      }
      setSelectedCategories(updated);
    }
  };

  // Filtering articles based on Category (Multi-Select)
  const filteredArticles = articles.filter((art) => {
    if (selectedCategories.includes('All')) return true;
    return selectedCategories.includes(art.category);
  });

  const selectedArticle = articles.find((art) => art.id === selectedArticleId);

  // Calculate words and estimated reading time for selectedArticle
  const rawSelectedArticleContent = selectedArticle
    ? selectedArticle.content[lang] || selectedArticle.content.GR || selectedArticle.content.EN || ''
    : '';

  const selectedArticleContent = selectedArticle
    ? expandArticleContent(
        selectedArticle.title[lang] || selectedArticle.title.GR || selectedArticle.title.EN || '',
        selectedArticle.category,
        rawSelectedArticleContent,
        lang
      )
    : '';
  const selectedArticleWords = selectedArticleContent
    ? selectedArticleContent.trim().split(/\s+/).filter(Boolean).length
    : 0;
  const selectedArticleReadingTime = Math.max(1, Math.ceil(selectedArticleWords / 200));

  return (
    <div 
      className="min-h-screen flex flex-col bg-[#FAFAF7] dark:bg-[#121210] text-[#222222] dark:text-white dynamic-bg dynamic-text transition-colors duration-300 font-sans"
      style={{ fontFamily: activeFontObj.cssFamily }}
    >
      <style>{`
        :root {
          --dyn-bg: ${currentPalette.bg};
          --dyn-text: ${currentPalette.text};
          --dyn-link: ${currentPalette.link};
          --dyn-category: ${currentPalette.category};
          --dyn-cta: ${currentPalette.cta};
          --dyn-border: ${currentPalette.border};
          --dyn-card-bg: ${currentPalette.cardBg};
          --dyn-badge-bg: ${currentPalette.badgeBg};
        }
        
        body, #root, .min-h-screen {
          font-family: ${activeFontObj.cssFamily} !important;
        }
        .dynamic-bg { background-color: var(--dyn-bg) !important; }
        .dynamic-text { color: var(--dyn-text) !important; }
        .dynamic-link { color: var(--dyn-link) !important; }
        .dynamic-link-hover:hover { color: var(--dyn-link) !important; }
        .dynamic-category { color: var(--dyn-category) !important; }
        .dynamic-category-bg { background-color: var(--dyn-badge-bg) !important; }
        .dynamic-cta { color: var(--dyn-cta) !important; }
        .dynamic-cta-bg { background-color: var(--dyn-cta) !important; }
        .dynamic-border { border-color: var(--dyn-border) !important; }
        .dynamic-card-bg { background-color: var(--dyn-card-bg) !important; }

        /* Dynamic overrides to match the selected color palette */
        html {
          font-size: ${fontSizeZoom ? '28px' : '16px'} !important;
        }

        html, body, #root, .min-h-screen, .bg-\\[\\#FAFAF7\\], .bg-\\[\\#121210\\] {
          background-color: var(--dyn-bg) !important;
          color: var(--dyn-text) !important;
        }

        .bg-white, .bg-white\\/80, .dynamic-card-bg, .bg-gray-50, .dark .dark\\:bg-\\[\\#1a1a17\\], .dark .dark\\:bg-\\[\\#1A1A17\\], .dark .dark\\:bg-\\[\\#252521\\], .dark .dark\\:bg-\\[\\#1E293B\\], .dark .dark\\:bg-\\[\\#1A2E20\\], .dark .dark\\:bg-\\[\\#263238\\] {
          background-color: var(--dyn-card-bg) !important;
        }

        .text-gray-900, .text-\\[\\#222222\\], .dark .dark\\:text-white, .dark .dark\\:text-gray-100, .dark .dark\\:text-gray-250 {
          color: var(--dyn-text) !important;
        }

        .border-gray-200, .border-gray-150, .border-gray-100, .dark .dark\\:border-gray-800, .dark .dark\\:border-gray-700, .dark .dark\\:border-gray-750, .dark .dark\\:border-gray-900 {
          border-color: var(--dyn-border) !important;
        }

        /* Helper styles for links, hover and category states */
        .hover\\:text-blue-600:hover, .group-hover\\:text-blue-600:group-hover {
          color: var(--dyn-link) !important;
        }
        .text-blue-600, .text-blue-500 {
          color: var(--dyn-link) !important;
        }
        .dark .dark\\:text-blue-400, .dark .dark\\:text-blue-500 {
          color: var(--dyn-link) !important;
        }
        .bg-blue-600 {
          background-color: var(--dyn-link) !important;
        }
        .dark .dark\\:bg-blue-600 {
          background-color: var(--dyn-link) !important;
        }
        .bg-blue-50 {
          background-color: var(--dyn-badge-bg) !important;
        }
        .text-\\[\\#7C3AED\\] {
          color: var(--dyn-category) !important;
        }
        .bg-purple-50 {
          background-color: var(--dyn-badge-bg) !important;
        }
        .dark .dark\\:bg-purple-950\\/20 {
          background-color: var(--dyn-badge-bg) !important;
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 12s linear infinite;
        }
      `}</style>

      {/* Scroll-linked progress bar */}
      {activeView === 'article' && (
        <div className="fixed top-0 left-0 w-full h-1 bg-gray-200 dark:bg-gray-800 z-50 pointer-events-none">
          <div 
            className="h-full bg-blue-600 dark:bg-blue-400 transition-all duration-75"
            style={{ width: `${scrollProgress}%`, backgroundColor: currentPalette.link }}
          />
        </div>
      )}

      {/* Floating share copied toast */}
      {copiedArticleId && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2 border border-gray-800 dark:border-gray-150 transform transition-all duration-300 ease-out">
          <CheckCircle className="w-4.5 h-4.5 text-emerald-500" />
          <span className="text-xs font-bold">{getTranslation('copied', lang)}</span>
        </div>
      )}

      {/* 1. Header Area */}
      <header 
        className="border-b backdrop-blur-md sticky top-0 z-40 transition-colors duration-300"
        style={{ 
          backgroundColor: `${currentPalette.cardBg}E6`, 
          borderColor: currentPalette.border 
        }}
      >
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 flex flex-col sm:flex-row gap-4 items-center justify-between">
          
          {/* Logo Title */}
          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                setActiveView('home');
                setSelectedArticleId(null);
              }}
              className="text-left group"
            >
              <h1 
                className="text-3xl md:text-4xl font-serif font-black tracking-tight transition-colors duration-300 group-hover:text-[var(--dyn-link)]"
                style={{ color: currentPalette.text }}
              >
                {getTranslation('appName', lang)}
              </h1>
              <span className="text-[9px] font-sans font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400 block -mt-0.5">
                TECHNOLOGY MEETS INTELLIGENCE
              </span>
            </button>
            {(activeView !== 'home' || selectedArticleId !== null) && (
              <button
                onClick={() => {
                  setActiveView('home');
                  setSelectedArticleId(null);
                }}
                className="ml-3 sm:ml-4 px-3.5 py-2 border-2 border-cyan-600 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-700 dark:text-cyan-400 font-black text-xs transition-all flex items-center gap-1.5 animate-fade-in hover:scale-105 active:scale-95 cursor-pointer shadow-[2px_2px_0px_rgba(14,116,144,1)] shrink-0"
              >
                <Home className="w-4 h-4 shrink-0 animate-pulse" />
                <span>{lang === 'GR' ? 'ΑΡΧΙΚΗ' : 'HOME'}</span>
              </button>
            )}
          </div>

          {/* Action Hub */}
          <div className="flex flex-wrap items-center gap-2.5">
            
            {/* About Button (Icon only) */}
            <button
              onClick={() => setShowAboutModal(true)}
              className="p-2 border rounded-xl transition-all cursor-pointer hover:opacity-80 shrink-0 flex items-center justify-center shadow-xs"
              style={{
                backgroundColor: currentPalette.bg,
                borderColor: currentPalette.border,
                color: currentPalette.link
              }}
              title={getTranslation('about', lang)}
            >
              <Info className="w-4 h-4 shrink-0" />
            </button>

            {/* Search Button (Icon only) */}
            <button
              onClick={() => setShowSearchModal(true)}
              className="p-2 border rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-all font-medium cursor-pointer flex items-center justify-center shadow-xs"
              style={{
                backgroundColor: currentPalette.bg,
                borderColor: currentPalette.border
              }}
              title={getTranslation('searchPlaceholder', lang)}
            >
              <Search className="w-4 h-4 text-gray-400 shrink-0" />
            </button>

            {/* Language Dropdown (Icon/Flag only) */}
            <div className="relative">
              <button 
                onClick={() => {
                  setShowLangDropdown(!showLangDropdown);
                  setShowPaletteDropdown(false);
                }}
                className="flex items-center justify-center p-2 border rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0"
                style={{
                  backgroundColor: currentPalette.bg,
                  borderColor: currentPalette.border,
                  color: currentPalette.text
                }}
                title={lang === 'GR' ? 'Επιλογή Γλώσσας' : 'Select Language'}
              >
                <span className="text-sm leading-none">{languages.find((l) => l.code === lang)?.flag}</span>
              </button>
              {showLangDropdown && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowLangDropdown(false)} />
                  <div 
                    className="absolute right-0 top-full mt-1.5 w-32 border rounded-xl shadow-xl overflow-hidden z-50"
                    style={{
                      backgroundColor: currentPalette.cardBg,
                      borderColor: currentPalette.border,
                      color: currentPalette.text
                    }}
                  >
                    {languages.map((l) => (
                      <button
                        key={l.code}
                        onClick={() => {
                          handleLanguageChange(l.code);
                          setShowLangDropdown(false);
                        }}
                        className="w-full text-left px-4 py-2 text-xs font-semibold hover:bg-gray-50/50 dark:hover:bg-gray-850/50 transition-colors flex items-center justify-between cursor-pointer"
                        style={{ color: currentPalette.text }}
                      >
                        <span>{l.name}</span>
                        <span>{l.flag}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Trending Notifications Button */}
            <button
              onClick={() => setShowMarketNotifsModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 border border-amber-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer hover:scale-105 active:scale-95 shrink-0 bg-amber-500/10 hover:bg-amber-500/20 text-amber-900 dark:text-amber-200 shadow-xs"
              title={lang === 'GR' ? 'Trending Alerts' : 'Trending Alerts'}
            >
              <Bell className="w-4 h-4 shrink-0 text-amber-500 animate-bounce" />
              <span>{lang === 'GR' ? 'Trending Alerts' : 'Trending Alerts'}</span>
            </button>

            {/* Personalization Button (Icon only with prominent bold icon) */}
            <button
              onClick={() => setShowPersonalizationModal(true)}
              className="p-2 border rounded-xl text-xs font-bold transition-all cursor-pointer hover:scale-105 shrink-0 flex items-center justify-center shadow-xs"
              style={{
                backgroundColor: currentPalette.bg,
                borderColor: currentPalette.border,
                color: currentPalette.link
              }}
              title={lang === 'GR' ? 'Εξατομίκευση εμφάνισης και τρόπου παρουσίασης' : 'Personalize appearance and layout'}
            >
              <SlidersHorizontal className="w-4 h-4 shrink-0 stroke-[2.5]" style={{ color: currentPalette.link }} />
            </button>

            {/* User Profile / Auth Button (Icon only with full fill icon) */}
            {user ? (
              <div className="flex items-center gap-2">
                <div className="hidden md:block text-right">
                  <div className="text-[10px] font-bold text-gray-400 tracking-wider">
                    {lang === 'GR' ? toGreekUppercase(getTranslation('welcome', lang)) : getTranslation('welcome', lang).toUpperCase()}
                  </div>
                  <div className="text-xs font-black max-w-[100px] truncate" style={{ color: currentPalette.text }}>{user.email?.split('@')[0]}</div>
                </div>
                <button
                  onClick={handleSignOut}
                  className="px-3 py-2 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
                  style={{ backgroundColor: currentPalette.cta }}
                >
                  {getTranslation('signOut', lang)}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="p-2 text-white rounded-xl transition-all shadow-md flex items-center justify-center cursor-pointer shrink-0 hover:scale-105 active:scale-95"
                style={{ backgroundColor: currentPalette.link }}
                title={getTranslation('signIn', lang)}
              >
                <UserIcon className="w-4 h-4 fill-current shrink-0 stroke-none" />
              </button>
            )}

            {/* Quick Dark/Light Theme Toggle (Positioned LAST as requested!) */}
            <button
              onClick={() => {
                const nextDark = !isDarkMode;
                setIsDarkMode(nextDark);
                localStorage.setItem('vibe_theme', nextDark ? 'dark' : 'light');
              }}
              className="p-2 border rounded-xl transition-all cursor-pointer hover:scale-105 active:scale-95 shrink-0 flex items-center justify-center shadow-xs"
              style={{
                backgroundColor: currentPalette.bg,
                borderColor: currentPalette.border,
              }}
              title={isDarkMode ? (lang === 'GR' ? 'Αλλαγή σε Φωτεινό Θέμα (Light Mode)' : 'Switch to Light Mode') : (lang === 'GR' ? 'Αλλαγή σε Σκούρο Θέμα (Dark Mode)' : 'Switch to Dark Mode')}
            >
              {isDarkMode ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-indigo-600" />
              )}
            </button>

          </div>

        </div>
      </header>

      {/* CLASSIC MASTHEAD DATE, LIVE TIME & WEATHER BAR */}
      <div className="border-b-2 border-t border-gray-900/10 dark:border-white/10 bg-[#fbf9f5]/80 dark:bg-[#141412]/80 backdrop-blur-md text-[#121212] dark:text-gray-200 py-1.5 px-4 text-[11px] font-serif transition-colors">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2 border-y border-double border-gray-400/40 dark:border-gray-700/50 py-1 px-2">
          <div className="flex items-center gap-2 font-semibold">
            <span>{new Date().toLocaleDateString(lang === 'GR' ? 'el-GR' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
            <span>•</span>
            <span className="italic text-gray-600 dark:text-gray-400">{lang === 'GR' ? '«Όλες οι ειδήσεις που αξίζει να προγραμματιστούν»' : '“All the Vibe That’s Fit to Code”'}</span>
          </div>
          <div className="flex items-center gap-3 font-mono text-[10px] text-gray-600 dark:text-gray-400">
            {/* Live counting time animation badge */}
            <div className="flex items-center gap-1.5 bg-emerald-500/10 dark:bg-emerald-400/10 border border-emerald-500/30 px-2.5 py-0.5 rounded-full text-emerald-700 dark:text-emerald-300 font-bold shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
              <span>
                {lang === 'GR' 
                  ? `ATHENS (EEST): ${currentTime.toLocaleTimeString('el-GR', { timeZone: 'Europe/Athens', hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                  : `LIVE TIME: ${currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                }
              </span>
            </div>
            <span>|</span>
            <span>ATHENS 28°C ☀️</span>
            <span>|</span>
            <button 
              onClick={() => setShowTopicsModal(true)}
              className="text-amber-600 dark:text-amber-400 font-bold bg-amber-500/10 hover:bg-amber-500/20 px-2.5 py-0.5 rounded-full border border-amber-500/30 flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
              title={lang === 'GR' ? 'Προβολή Σκελετού Άρθρων & Θεμάτων' : 'View Articles Skeleton & Topics'}
            >
              <Newspaper className="w-3 h-3 text-amber-500" />
              <span>{articles.length} {lang === 'GR' ? 'Άρθρα' : 'Articles'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Offline Status / Cached Content Banner */}
      {(isOfflineMode || loadedFromCache) && (
        <div className="bg-red-500/10 border-b border-red-500/20 py-3 text-center text-xs text-red-600 dark:text-red-400 font-bold flex items-center justify-center gap-2 relative z-30 transition-all">
          <WifiOff className="w-4 h-4 shrink-0 animate-pulse text-red-500" />
          <span>
            {lang === 'GR' 
              ? 'Είστε εκτός σύνδεσης. Εμφανίζονται αποθηκευμένα άρθρα' 
              : 'You are currently offline. Showing cached news articles'}
            {cacheTimestamp && (
              <span className="opacity-80 font-mono text-[11px] ml-1.5 font-normal">
                ({lang === 'GR' ? 'Τελευταία αποθήκευση:' : 'Last cached:'} {new Date(cacheTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
              </span>
            )}
          </span>
          <button
            onClick={fetchArticles}
            className="ml-2.5 px-2.5 py-0.5 bg-red-600 hover:bg-red-500 text-white text-[10px] font-black uppercase rounded-lg transition-all cursor-pointer select-none"
          >
            {lang === 'GR' ? 'ΕΠΑΝΑΔΟΚΙΜΗ' : 'RETRY'}
          </button>
        </div>
      )}

      {/* 2. Breaking News Ticker Marquee */}
      <div className="bg-amber-500/10 dark:bg-amber-400/10 border-y border-amber-500/25 dark:border-amber-400/20 backdrop-blur-md py-2 overflow-hidden shadow-xs relative z-30 transition-colors">
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-4">
          
          <div className="px-3 py-1.5 rounded-full shrink-0 flex items-center gap-2 bg-gray-950 dark:bg-[#0c0c0e] border border-gray-800 dark:border-gray-700 text-white font-mono uppercase tracking-widest text-[10px] font-black select-none shadow-sm">
            <span className="w-2 h-2 rounded-full bg-red-500 shrink-0 animate-pulse" />
            <span>
              {lang === 'GR' ? 'ΝΕΑ' : 'NEWS'}
            </span>
          </div>

          <div className="flex-1 overflow-hidden">
            <div className="animate-marquee inline-flex gap-10 items-center text-xs">
              {articles.slice(0, 5).map((art) => {
                const rawTitle = art.title[lang] || art.title.GR || art.title.EN || '';
                const shortPhrase = toShortPhraseHeadline(rawTitle);
                const catTag = art.category ? `#${art.category.toUpperCase().replace(/\s+/g, '_')}` : '#VIBE';
                return (
                  <div key={art.id} className="flex items-center gap-10 shrink-0">
                    <button
                      onClick={() => {
                        setSelectedArticleId(art.id);
                        setActiveView('article');
                      }}
                      className="px-3.5 py-1.5 rounded-full bg-white/80 dark:bg-amber-400/10 hover:bg-amber-500/20 border border-amber-500/30 text-left transition-all cursor-pointer flex items-center gap-2.5 shadow-2xs group"
                    >
                      <span className="px-2 py-0.5 rounded-full bg-red-600 text-white font-mono font-black text-[9px] uppercase tracking-wider shrink-0 flex items-center gap-1">
                        <span>⚡</span>
                        <span>{catTag}</span>
                      </span>
                      <span className="text-xs font-mono font-bold text-gray-900 dark:text-amber-100 group-hover:text-amber-600 dark:group-hover:text-amber-300 transition-colors whitespace-nowrap">
                        {shortPhrase}
                      </span>
                    </button>
                    <span className="text-amber-500/40 font-mono text-xs select-none">///</span>
                  </div>
                );
              })}
              {/* Loop Duplicate for smooth continuous slide */}
              {articles.slice(0, 5).map((art) => {
                const rawTitle = art.title[lang] || art.title.GR || art.title.EN || '';
                const shortPhrase = toShortPhraseHeadline(rawTitle);
                const catTag = art.category ? `#${art.category.toUpperCase().replace(/\s+/g, '_')}` : '#VIBE';
                return (
                  <div key={`${art.id}-dup`} className="flex items-center gap-10 shrink-0">
                    <button
                      onClick={() => {
                        setSelectedArticleId(art.id);
                        setActiveView('article');
                      }}
                      className="px-3.5 py-1.5 rounded-full bg-white/80 dark:bg-amber-400/10 hover:bg-amber-500/20 border border-amber-500/30 text-left transition-all cursor-pointer flex items-center gap-2.5 shadow-2xs group"
                    >
                      <span className="px-2 py-0.5 rounded-full bg-red-600 text-white font-mono font-black text-[9px] uppercase tracking-wider shrink-0 flex items-center gap-1">
                        <span>⚡</span>
                        <span>{catTag}</span>
                      </span>
                      <span className="text-xs font-mono font-bold text-gray-900 dark:text-amber-100 group-hover:text-amber-600 dark:group-hover:text-amber-300 transition-colors whitespace-nowrap">
                        {shortPhrase}
                      </span>
                    </button>
                    <span className="text-amber-500/40 font-mono text-xs select-none">///</span>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>

      {/* 2.5 High-Tech Console Dashboard Control Bar */}
      <div className="max-w-7xl w-full mx-auto px-4 md:px-6 pt-6">
        <div className="bg-white/80 dark:bg-[#090b10] border-2 border-gray-200 dark:border-cyan-500/30 p-2 md:p-3 rounded-2xl md:rounded-full shadow-lg dark:shadow-[0_0_25px_rgba(6,182,212,0.18)] backdrop-blur-xl relative overflow-hidden">
          {/* Subtle cyber grid scanline overlay */}
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#00f0ff_1px,transparent_1px)] [background-size:12px_12px] pointer-events-none" />

          <div className="flex flex-wrap items-center justify-between gap-2 relative z-10">
            {/* ΡΟΗ ΕΙΔΗΣΕΩΝ */}
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setActiveView('home');
                setSelectedArticleId(null);
              }}
              className={`flex-1 min-w-[130px] py-3 px-5 rounded-full text-xs font-mono font-black tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer border-2 ${
                (activeView === 'home' || activeView === 'article')
                  ? 'bg-cyan-500/20 dark:bg-cyan-500/25 text-cyan-900 dark:text-cyan-200 border-cyan-500 dark:border-cyan-400 shadow-md dark:shadow-[0_0_20px_rgba(6,182,212,0.5)]'
                  : 'bg-gray-100 dark:bg-[#12151c] text-gray-700 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border-gray-200 dark:border-gray-800 hover:border-cyan-400/60'
              }`}
            >
              <span className={`w-2.5 h-2.5 rounded-full ${
                (activeView === 'home' || activeView === 'article') ? 'bg-cyan-500 dark:bg-cyan-400 animate-ping shadow-[0_0_8px_#00f0ff]' : 'bg-cyan-500/40'
              }`} />
              <Newspaper className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              <span>{lang === 'GR' ? 'ΡΟΗ ΕΙΔΗΣΕΩΝ' : 'NEWS FEED'}</span>
            </motion.button>

            {/* ΣΧΕΔΙΑΣΤΗΣ MVP */}
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setActiveView('mvp-planner');
                setSelectedArticleId(null);
              }}
              className={`flex-1 min-w-[130px] py-3 px-5 rounded-full text-xs font-mono font-black tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer border-2 ${
                activeView === 'mvp-planner'
                  ? 'bg-amber-500/20 dark:bg-amber-500/25 text-amber-900 dark:text-amber-200 border-amber-500 dark:border-amber-400 shadow-md dark:shadow-[0_0_20px_rgba(245,158,11,0.5)]'
                  : 'bg-gray-100 dark:bg-[#12151c] text-gray-700 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border-gray-200 dark:border-gray-800 hover:border-amber-400/60'
              }`}
            >
              <span className={`w-2.5 h-2.5 rounded-full ${activeView === 'mvp-planner' ? 'bg-amber-500 dark:bg-amber-400 animate-ping shadow-[0_0_8px_#f59e0b]' : 'bg-amber-500/40'}`} />
              <Rocket className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>{lang === 'GR' ? 'ΣΧΕΔΙΑΣΤΗΣ MVP' : 'MVP PLANNER'}</span>
            </motion.button>

            {/* VIBE COMICS */}
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setActiveView('vibe-comics');
                setSelectedArticleId(null);
              }}
              className={`flex-1 min-w-[130px] py-3 px-5 rounded-full text-xs font-mono font-black tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer border-2 ${
                activeView === 'vibe-comics'
                  ? 'bg-purple-500/20 dark:bg-purple-500/25 text-purple-900 dark:text-purple-200 border-purple-500 dark:border-purple-400 shadow-md dark:shadow-[0_0_20px_rgba(168,85,247,0.5)]'
                  : 'bg-gray-100 dark:bg-[#12151c] text-gray-700 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border-gray-200 dark:border-gray-800 hover:border-purple-400/60'
              }`}
            >
              <span className={`w-2.5 h-2.5 rounded-full ${activeView === 'vibe-comics' ? 'bg-purple-500 dark:bg-purple-400 animate-ping shadow-[0_0_8px_#a855f7]' : 'bg-purple-500/40'}`} />
              <BookOpenCheck className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span>{lang === 'GR' ? 'VIBE COMICS' : 'VIBE COMICS'}</span>
            </motion.button>

            {/* ΔΙΑΓΩΝΙΣΜΟΙ */}
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setActiveView('vibe-contests');
                setSelectedArticleId(null);
              }}
              className={`flex-1 min-w-[130px] py-3 px-5 rounded-full text-xs font-mono font-black tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer border-2 ${
                activeView === 'vibe-contests'
                  ? 'bg-red-500/20 dark:bg-red-500/25 text-red-900 dark:text-red-200 border-red-500 dark:border-red-400 shadow-md dark:shadow-[0_0_20px_rgba(239,68,68,0.5)]'
                  : 'bg-gray-100 dark:bg-[#12151c] text-gray-700 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border-gray-200 dark:border-gray-800 hover:border-red-400/60'
              }`}
            >
              <span className={`w-2.5 h-2.5 rounded-full ${activeView === 'vibe-contests' ? 'bg-red-500 dark:bg-red-400 animate-ping shadow-[0_0_8px_#ef4444]' : 'bg-red-500/40'}`} />
              <Trophy className="w-4 h-4 text-red-600 dark:text-red-400" />
              <span>{lang === 'GR' ? 'ΔΙΑΓΩΝΙΣΜΟΙ' : 'CONTESTS'}</span>
            </motion.button>

            {/* AI SEARCH */}
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowAiSearchModal(true)}
              className="flex-1 min-w-[130px] py-3 px-5 bg-gray-100 dark:bg-[#12151c] hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-200 border-2 border-gray-200 dark:border-gray-800 hover:border-emerald-500 rounded-full text-xs font-mono font-black tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs hover:shadow-[0_0_20px_rgba(16,185,129,0.3)]"
            >
              <Cpu className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>{lang === 'GR' ? 'ΑΝΑΖΗΤΗΣΗ AI' : 'AI SEARCH'}</span>
            </motion.button>

            {/* CRASH COURSE */}
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowCrashCourseModal(true)}
              className="flex-1 min-w-[130px] py-3 px-5 bg-gray-100 dark:bg-[#12151c] hover:bg-blue-500/20 text-blue-700 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-200 border-2 border-gray-200 dark:border-gray-800 hover:border-blue-500 rounded-full text-xs font-mono font-black tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs hover:shadow-[0_0_20px_rgba(59,130,246,0.3)]"
            >
              <GraduationCap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>{lang === 'GR' ? 'CRASH COURSE' : 'CRASH COURSE'}</span>
            </motion.button>
          </div>
        </div>
      </div>

      {/* 2.8 Military Cockpit CRT HUD Widget when palette is active */}
      {activePalette === 'crt_military_cockpit' && (
        <CrtMilitaryCockpitHud lang={lang} />
      )}

      {/* 3. Main Workspace Grid */}
      {activeView === 'vibe-comics' ? (
        <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6">
          <VibeComics lang={lang} isDarkMode={isDarkMode} />
        </main>
      ) : activeView === 'vibe-contests' ? (
        <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6">
          <VibeContests lang={lang} isDarkMode={isDarkMode} />
        </main>
      ) : (
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 md:px-6 py-6 md:py-8 grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* Left Columns (Articles, Details, Pages) */}
        <section className="lg:col-span-2 space-y-6">
          
          {/* A. If we are reading a full article */}
          {activeView === 'article' && selectedArticle && (
            <div className="p-5 md:p-8 bg-white dark:bg-[#1a1a17] border border-gray-200 dark:border-gray-800 rounded-3xl shadow-xs space-y-6 transition-colors duration-300">
              
              {/* Category, Date & Back button */}
              <div className="flex flex-wrap gap-3 justify-between items-center pb-4 border-b border-gray-150 dark:border-gray-800">
                <button
                  onClick={() => setActiveView('home')}
                  className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                >
                  {lang === 'GR' ? '← Επιστροφή στην Αρχική' : '← Back to news feed'}
                </button>

                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 bg-purple-50 dark:bg-purple-950/20 px-2.5 py-1 rounded-md">
                    {getTranslation(`category${(selectedArticle.category || '').replace(/\s+/g, '')}`, lang)}
                  </span>
                </div>
              </div>

              {/* Title & Author */}
              <div className="space-y-3">
                <h2 className="text-3xl md:text-4xl font-serif font-black text-gray-900 dark:text-white leading-tight">
                  {selectedArticle.title[lang] || selectedArticle.title.GR || selectedArticle.title.EN || ''}
                </h2>
                
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400 font-medium">
                  <div className="flex items-center gap-1">
                    <span>{getTranslation('author', lang)}:</span>
                    <span className="font-bold text-gray-800 dark:text-gray-200">{selectedArticle.author}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(selectedArticle.publishedAt).toLocaleDateString(lang === 'GR' ? 'el-GR' : 'en-US')}
                    </span>
                    <span className="flex items-center gap-1">
                      <Eye className="w-3.5 h-3.5" />
                      {selectedArticle.views}
                    </span>
                    <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-bold" title={`${selectedArticleWords} ${lang === 'GR' ? 'λέξεις' : 'words'}`}>
                      <Clock className="w-3.5 h-3.5" />
                      <span>{selectedArticleReadingTime} {getTranslation('minShort', lang)}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Image banner */}
              {selectedArticle.imageUrl && (
                <div className="aspect-video w-full rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-800 relative shadow-sm">
                  <img 
                    src={selectedArticle.imageUrl} 
                    alt={selectedArticle.title[lang]} 
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* Community Project Special Interactivity Block */}
              {selectedArticle.category === 'Community Projects' && (
                <div className="p-6 bg-gray-50 dark:bg-[#1f1f1b] border border-gray-150 dark:border-gray-800 rounded-3xl space-y-6">
                  {/* Progress Bar Container */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center flex-wrap gap-2">
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-wider text-amber-500">
                          {lang === 'GR' ? 'ΣΤΑΔΙΟ ΥΛΟΠΟΙΗΣΗΣ PROJECT' : 'PROJECT BUILD STAGE'}
                        </h4>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">
                          {lang === 'GR' ? 'Κάντε κλικ σε ένα στάδιο για να ενημερώσετε την πρόοδο του project.' : 'Click any stage button to dynamically update the development pipeline.'}
                        </p>
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2.5 py-1 rounded-full border border-amber-500/10">
                        {selectedArticle.buildStage || 'Concept'}
                      </span>
                    </div>

                    {/* Progress Bar Line */}
                    <div className="relative w-full h-3 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 rounded-full ${
                          selectedArticle.buildStage === 'Production' 
                            ? 'w-full bg-gradient-to-r from-emerald-500 to-teal-500' 
                            : selectedArticle.buildStage === 'MVP'
                            ? 'w-2/3 bg-gradient-to-r from-amber-500 to-orange-500'
                            : 'w-1/3 bg-gradient-to-r from-blue-500 to-indigo-500'
                        }`}
                      />
                    </div>

                    {/* Stage Buttons */}
                    <div className="grid grid-cols-3 gap-2.5">
                      {(['Concept', 'MVP', 'Production'] as const).map((stage) => {
                        const isActive = (selectedArticle.buildStage || 'Concept') === stage;
                        const colors = {
                          Concept: 'hover:border-blue-500 dark:hover:border-blue-500 text-blue-600 border-blue-500 bg-blue-500/5',
                          MVP: 'hover:border-amber-500 dark:hover:border-amber-500 text-amber-600 border-amber-500 bg-amber-500/5',
                          Production: 'hover:border-emerald-500 dark:hover:border-emerald-500 text-emerald-600 border-emerald-500 bg-emerald-500/5'
                        };

                        return (
                          <button
                            key={stage}
                            onClick={() => handleUpdateBuildStage(selectedArticle.id, stage)}
                            className={`py-2 px-3 rounded-xl text-center text-xs font-black border transition-all cursor-pointer ${
                              isActive 
                                ? colors[stage] + ' shadow-sm'
                                : 'bg-white dark:bg-[#1a1a17] border-gray-200 dark:border-gray-800 text-gray-500 hover:text-gray-900 dark:hover:text-white'
                            }`}
                          >
                            <span>{stage}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-gray-150 dark:border-gray-800" />

                  {/* Voting Station */}
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider text-purple-500">
                        {lang === 'GR' ? 'ΨΗΦΟΦΟΡΙΑ & ΑΞΙΟΛΟΓΗΣΗ' : 'UPVOTE & DOWNVOTE HUB'}
                      </h4>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        {lang === 'GR' ? 'Ψηφίστε και μοιραστείτε μια υποχρεωτική εξήγηση για να δημοσιευτεί το σχόλιό σας.' : 'Submit an upvote or downvote along with a mandatory reason to publish your voice.'}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleVoteArticle(selectedArticle.id, 'up')}
                        className={`flex-1 py-2.5 px-4 rounded-xl border font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs ${
                          votedArticles[selectedArticle.id] === 'up'
                            ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-500 text-emerald-600'
                            : 'bg-white hover:bg-gray-50 dark:bg-[#1a1a17] dark:hover:bg-[#20201c] border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        <span className="text-emerald-500 text-sm">▲</span>
                        <span>{lang === 'GR' ? 'Υπερψήφιση' : 'Upvote'}</span>
                        <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-gray-100 dark:bg-gray-800 rounded-md font-bold text-gray-600 dark:text-gray-400">
                          {selectedArticle.upvotes || 0}
                        </span>
                      </button>

                      <button
                        onClick={() => handleVoteArticle(selectedArticle.id, 'down')}
                        className={`flex-1 py-2.5 px-4 rounded-xl border font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs ${
                          votedArticles[selectedArticle.id] === 'down'
                            ? 'bg-red-50 dark:bg-red-950/20 border-red-500 text-red-600'
                            : 'bg-white hover:bg-gray-50 dark:bg-[#1a1a17] dark:hover:bg-[#20201c] border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        <span className="text-red-500 text-sm">▼</span>
                        <span>{lang === 'GR' ? 'Καταψήφιση' : 'Downvote'}</span>
                        <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-gray-100 dark:bg-gray-800 rounded-md font-bold text-gray-600 dark:text-gray-400">
                          {selectedArticle.downvotes || 0}
                        </span>
                      </button>
                    </div>

                    {votedArticles[selectedArticle.id] && (
                      <div className="p-3 bg-blue-500/5 border border-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl text-[11px] font-black text-center">
                        {votedArticles[selectedArticle.id] === 'up'
                          ? (lang === 'GR' ? '▲ Έχετε ήδη υπερψηφίσει αυτό το project!' : '▲ You have successfully upvoted this community project!')
                          : (lang === 'GR' ? '▼ Έχετε ήδη καταψηφίσει αυτό το project!' : '▼ You have successfully downvoted this community project!')}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Article Content Body - Clean Paragraph Rendering to Prevent Overlapping */}
              <div className={`prose dark:prose-invert max-w-none text-gray-800 dark:text-gray-200 space-y-4 font-normal ${
                textSize === 'md' ? 'text-base leading-relaxed' :
                textSize === 'lg' ? 'text-lg md:text-xl leading-relaxed' :
                'text-xl md:text-2xl leading-relaxed'
              }`}>
                {(isArticleExpanded ? selectedArticleContent : rawSelectedArticleContent)
                  .split(/\n\s*\n/)
                  .filter(Boolean)
                  .map((paragraph, pIdx) => (
                    <p key={pIdx} className="mb-4 leading-relaxed font-serif text-gray-900 dark:text-gray-100 text-justify tracking-normal">
                      {paragraph.trim()}
                    </p>
                  ))}
              </div>

              {/* Expand Button */}
              {!isArticleExpanded && (
                <div className="flex justify-center py-4 border-t border-gray-100 dark:border-gray-800 pt-6">
                  <button
                    onClick={() => setIsArticleExpanded(true)}
                    className="group relative flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-2xl shadow-xs transition-all duration-300 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-yellow-300 animate-pulse" />
                    <span>{lang === 'GR' ? 'Ανάλυση για Vibe Coders' : 'Analysis for Vibe Coders'}</span>
                  </button>
                </div>
              )}

              {/* Footer action tools */}
              <div className="flex justify-between items-center pt-5 border-t border-gray-150 dark:border-gray-800 flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleLikeArticle(selectedArticle.id)}
                    disabled={likedArticles.includes(selectedArticle.id)}
                    className={`py-2 px-4 text-xs font-bold rounded-xl border flex items-center gap-1.5 transition-all ${
                      likedArticles.includes(selectedArticle.id)
                        ? 'bg-red-50 dark:bg-red-950/20 border-red-500 text-red-600'
                        : 'bg-gray-50 hover:bg-gray-100 dark:bg-[#20201c] dark:hover:bg-[#2a2a24] border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${likedArticles.includes(selectedArticle.id) ? 'fill-red-500 text-red-500' : ''}`} />
                    <span>{selectedArticle.likes} {getTranslation('likes', lang)}</span>
                  </button>

                  <button
                    onClick={(e) => handleToggleBookmark(selectedArticle.id, e)}
                    className={`py-2 px-4 text-xs font-bold rounded-xl border flex items-center gap-1.5 transition-all ${
                      bookmarks.includes(selectedArticle.id)
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-gray-50 hover:bg-gray-100 dark:bg-[#20201c] dark:hover:bg-[#2a2a24] border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    <Bookmark className="w-4 h-4" />
                    <span>{bookmarks.includes(selectedArticle.id) ? (lang === 'GR' ? 'Αποθηκεύτηκε!' : 'Bookmarked!') : getTranslation('readLater', lang)}</span>
                  </button>

                  <button
                    onClick={(e) => handleShareArticle(selectedArticle.id, e)}
                    className="py-2 px-4 text-xs font-bold rounded-xl border flex items-center gap-1.5 transition-all bg-gray-50 hover:bg-gray-100 dark:bg-[#20201c] dark:hover:bg-[#2a2a24] border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>{getTranslation('share', lang)}</span>
                  </button>
                </div>

                {selectedArticle.sourceUrl && (
                  <div className="text-xs text-gray-400">
                    {lang === 'GR' ? 'Αναφορά πηγής' : 'Attribution'}:{' '}
                    <a href={selectedArticle.sourceUrl} target="_blank" rel="noreferrer" className="underline hover:text-blue-500 font-bold">
                      {selectedArticle.isAiGenerated ? 'Original Web Search' : 'Primary Source'}
                    </a>
                  </div>
                )}
              </div>

              {/* Recommended for You Section */}
              {(() => {
                const currentReadingTime = selectedArticleReadingTime;
                const recommendations = articles
                  .filter((a) => a.id !== selectedArticle.id)
                  .map((a) => {
                    const rawOtherContent = a.content[lang] || a.content.GR || a.content.EN || '';
                    const otherExpanded = expandArticleContent(
                      a.title[lang] || a.title.GR || a.title.EN || '',
                      a.category,
                      rawOtherContent,
                      lang
                    );
                    const otherReadingTime = Math.max(1, Math.ceil(otherExpanded.trim().split(/\s+/).filter(Boolean).length / 200));
                    const timeDiff = Math.abs(currentReadingTime - otherReadingTime);
                    const categoryMatch = a.category === selectedArticle.category;
                    return { article: a, categoryMatch, timeDiff, otherReadingTime };
                  })
                  .sort((a, b) => {
                    // 1. Matching category first
                    if (a.categoryMatch && !b.categoryMatch) return -1;
                    if (!a.categoryMatch && b.categoryMatch) return 1;
                    // 2. Similar reading time profiles (smaller diff first)
                    if (a.timeDiff !== b.timeDiff) {
                      return a.timeDiff - b.timeDiff;
                    }
                    // 3. Newer first
                    return new Date(b.article.publishedAt).getTime() - new Date(a.article.publishedAt).getTime();
                  })
                  .slice(0, 3)
                  .map((item) => ({
                    ...item.article,
                    readingTime: item.otherReadingTime
                  }));

                if (recommendations.length === 0) return null;

                return (
                  <div className="pt-8 mt-8 border-t border-blue-500/20 dark:border-blue-400/10 -mx-6 md:-mx-8 px-6 md:px-8 py-8 bg-gradient-to-br from-blue-50/60 to-indigo-50/20 dark:from-[#141412] dark:to-[#1d1d1a] rounded-b-3xl space-y-5">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-pulse" style={{ color: currentPalette.link }} />
                      <h3 className="text-xl font-serif font-black text-gray-900 dark:text-white">
                        {getTranslation('recommendedForYou', lang)}
                      </h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      {recommendations.map((rec) => {
                        const titleStr = rec.title[lang] || rec.title.GR || rec.title.EN || '';
                        const summaryStr = (rec.summary ? (rec.summary[lang] || rec.summary.GR || rec.summary.EN || '') : '').replace(/•/g, '');
                        const categoryTranslation = getTranslation(`category${(rec.category || '').replace(/\s+/g, '')}`, lang);

                        return (
                          <div
                            key={rec.id}
                            onClick={() => {
                              setSelectedArticleId(rec.id);
                              // Scroll to top of the article details container smoothly
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="text-left flex flex-col h-full bg-white dark:bg-[#1b1b19] border border-gray-200/80 dark:border-gray-800/80 rounded-2xl overflow-hidden hover:shadow-lg hover:border-blue-500/50 dark:hover:border-blue-400/50 transition-all duration-300 group cursor-pointer"
                          >
                            {rec.imageUrl && (
                              <div className="aspect-video w-full overflow-hidden bg-gray-100 dark:bg-gray-800 relative">
                                <img
                                  src={rec.imageUrl}
                                  alt={titleStr}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                                <div className="absolute top-2.5 left-2.5 px-2 py-0.5 text-white text-[9px] font-black rounded-md tracking-wider" style={{ backgroundColor: currentPalette.link }}>
                                  {lang === 'GR' ? toGreekUppercase(categoryTranslation) : categoryTranslation.toUpperCase()}
                                </div>
                              </div>
                            )}
                            <div className="p-4 flex flex-col flex-grow justify-between space-y-2.5">
                              <div className="space-y-1.5">
                                <h4 className="text-xs font-serif font-black text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2 leading-snug">
                                  {titleStr}
                                </h4>
                                <p className="text-[10px] text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
                                  {summaryStr || rec.content[lang] || rec.content.GR || rec.content.EN || ''}
                                </p>
                              </div>
                              <div className="flex items-center justify-between text-[9px] text-gray-400 dark:text-gray-500 pt-2 border-t border-gray-150/60 dark:border-gray-800/40 font-bold">
                                <span className="truncate max-w-[80px]">{rec.author}</span>
                                <span className="flex items-center gap-1 font-bold text-blue-600 dark:text-blue-400 shrink-0" style={{ color: currentPalette.link }}>
                                  <Clock className="w-3 h-3" />
                                  <span>{rec.readingTime} {getTranslation('minShort', lang)}</span>
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Real-time Comments Section */}
              <div className="pt-6 border-t border-gray-150 dark:border-gray-800 space-y-4">
                <div className="flex items-center gap-2 pb-2">
                  <MessageSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <h3 className="text-lg font-serif font-black text-gray-900 dark:text-white">
                    {getTranslation('comments', lang)} ({comments.length})
                  </h3>
                </div>

                {/* Community Invite Banner */}
                <div className="p-4 bg-gradient-to-r from-blue-600/10 to-purple-600/10 border border-blue-500/20 dark:border-purple-500/20 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-3 shadow-xs">
                  <div className="space-y-1 text-center sm:text-left">
                    <h4 className="text-sm font-black text-gray-900 dark:text-white flex items-center justify-center sm:justify-start gap-1.5">
                      <Users className="w-4.5 h-4.5 text-blue-600 dark:text-blue-400" />
                      <span>{lang === 'GR' ? 'Γίνετε μέλος της Κοινότητας Vibe Coding!' : 'Join the Vibe Coding Community!'}</span>
                    </h4>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                      {lang === 'GR'
                        ? 'Συνδεθείτε με άλλους δημιουργούς και μοιραστείτε ιδέες, Prompt blueprints και MVPs.'
                        : 'Connect with other creators and share ideas, prompt blueprints, and MVPs.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCommunityModal(true)}
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer select-none shrink-0"
                  >
                    {lang === 'GR' ? 'Εκκίνηση Κοινότητας 🚀' : 'Explore Community 🚀'}
                  </button>
                </div>

                {/* Comment input form / single comment check */}
                {(() => {
                  const hasUserCommented = user ? comments.some((c) => c.userId === user.uid && !c.parentId) : false;
                  if (!user) {
                    return (
                      <div className="p-4 bg-gray-50 dark:bg-[#20201c] border border-gray-150 dark:border-gray-800 rounded-xl text-center">
                        <p className="text-xs text-gray-500 font-medium mb-2">{getTranslation('signInToComment', lang)}</p>
                        <button
                          type="button"
                          onClick={() => setShowAuthModal(true)}
                          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-all"
                        >
                          {getTranslation('signIn', lang)}
                        </button>
                      </div>
                    );
                  }

                  if (hasUserCommented) {
                    return (
                      <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl text-center">
                        <p className="text-xs text-amber-700 dark:text-amber-400 font-bold flex items-center justify-center gap-1.5">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>
                            {lang === 'GR'
                              ? 'Έχετε ήδη υποβάλει σχόλιο για αυτό το άρθρο. Επιτρέπεται μόνο ένα σχόλιο ανά χρήστη.'
                              : 'You have already posted a comment on this article. Only one comment is allowed per user.'}
                          </span>
                        </p>
                      </div>
                    );
                  }

                  return (
                    <form onSubmit={handlePostComment} className="space-y-3">
                      <div className="relative">
                        <textarea
                          value={newCommentText}
                          onChange={(e) => setNewCommentText(e.target.value)}
                          placeholder={getTranslation('addComment', lang)}
                          rows={3}
                          required
                          className="w-full px-4 py-3 bg-gray-50 dark:bg-[#20201c] text-sm text-gray-900 dark:text-white border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none transition-all"
                        />
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={commentSubmitting || !newCommentText.trim()}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          {commentSubmitting ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Send className="w-3.5 h-3.5" />
                          )}
                          <span>{getTranslation('postComment', lang)}</span>
                        </button>
                      </div>
                    </form>
                  );
                })()}

                {/* Comments List */}
                <div className="space-y-4 pt-2">
                  {comments.length === 0 ? (
                    <p className="text-xs text-gray-400 italic py-4 text-center">
                      {getTranslation('noComments', lang)}
                    </p>
                  ) : (
                    (() => {
                      const topLevelComments = comments.filter((c) => !c.parentId);
                      return topLevelComments.map((comment) => {
                        const commentReplies = comments.filter((c) => c.parentId === comment.id);
                        return (
                          <div key={comment.id} className="space-y-2">
                            {/* Parent Comment */}
                            <div className="p-4 bg-gray-50/50 dark:bg-[#1e1e1a]/30 border border-gray-150/60 dark:border-gray-800/60 rounded-xl space-y-1.5 transition-all hover:bg-gray-50 dark:hover:bg-[#1e1e1a]/50">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-bold text-[10px] flex items-center justify-center uppercase">
                                    {comment.userName.slice(0, 2)}
                                  </div>
                                  <div>
                                    <span className="text-xs font-black text-gray-800 dark:text-gray-200">{comment.userName}</span>
                                    <span className="text-[9px] text-gray-400 ml-2">
                                      {comment.createdAt ? new Date(comment.createdAt.seconds * 1000).toLocaleString() : 'Just now'}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  {user && (
                                    <button
                                      onClick={() => {
                                        if (replyingToId === comment.id) {
                                          setReplyingToId(null);
                                        } else {
                                          setReplyingToId(comment.id);
                                          setReplyText('');
                                        }
                                      }}
                                      className="p-1 hover:bg-blue-50 dark:hover:bg-blue-950/30 text-gray-400 hover:text-blue-500 rounded-lg transition-all cursor-pointer"
                                      title={lang === 'GR' ? 'Απάντηση' : 'Reply'}
                                    >
                                      <Reply className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  {user && user.uid === comment.userId && (
                                    <button
                                      onClick={() => handleDeleteComment(comment.id)}
                                      className="p-1 hover:bg-red-50 dark:hover:bg-red-950/30 text-gray-400 hover:text-red-500 rounded-lg transition-all cursor-pointer"
                                      title={getTranslation('delete', lang)}
                                    >
                                      <Trash className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                              <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap pl-8">
                                {comment.text}
                              </p>
                            </div>

                            {/* Nested Replies */}
                            {commentReplies.length > 0 && (
                              <div className="pl-6 md:pl-8 border-l-2 border-gray-200 dark:border-gray-800 ml-3 md:ml-4 space-y-2 mt-1">
                                {commentReplies.map((reply) => (
                                  <div 
                                    key={reply.id} 
                                    className="p-3 bg-gray-50/30 dark:bg-[#1e1e1a]/15 border border-gray-100 dark:border-gray-800/40 rounded-xl space-y-1"
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <div className="w-5.5 h-5.5 rounded-full bg-purple-100 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 font-bold text-[9px] flex items-center justify-center uppercase">
                                          {reply.userName.slice(0, 2)}
                                        </div>
                                        <div>
                                          <span className="text-[11px] font-black text-gray-700 dark:text-gray-300">{reply.userName}</span>
                                          <span className="text-[9px] text-gray-400 ml-2">
                                            {reply.createdAt ? new Date(reply.createdAt.seconds * 1000).toLocaleString() : 'Just now'}
                                          </span>
                                        </div>
                                      </div>
                                      {user && user.uid === reply.userId && (
                                        <button
                                          onClick={() => handleDeleteComment(reply.id)}
                                          className="p-1 hover:bg-red-50 dark:hover:bg-red-950/30 text-gray-400 hover:text-red-500 rounded-lg transition-all cursor-pointer"
                                          title={getTranslation('delete', lang)}
                                        >
                                          <Trash className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-wrap pl-7">
                                      {reply.text}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Inline Reply Form */}
                            {replyingToId === comment.id && user && (
                              <form onSubmit={(e) => handlePostReply(comment.id, e)} className="pl-6 md:pl-8 ml-3 md:ml-4 space-y-2 mt-2">
                                <textarea
                                  value={replyText}
                                  onChange={(e) => setReplyText(e.target.value)}
                                  placeholder={lang === 'GR' ? 'Γράψτε μια απάντηση...' : 'Write a reply...'}
                                  rows={2}
                                  required
                                  className="w-full px-3 py-2 bg-gray-50 dark:bg-[#20201c] text-xs text-gray-900 dark:text-white border border-gray-200 dark:border-gray-800 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none transition-all"
                                />
                                <div className="flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setReplyingToId(null)}
                                    className="px-3 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-750 text-gray-650 dark:text-gray-300 text-[10px] font-bold rounded-lg transition-all cursor-pointer"
                                  >
                                    {lang === 'GR' ? 'Ακύρωση' : 'Cancel'}
                                  </button>
                                  <button
                                    type="submit"
                                    disabled={replySubmitting || !replyText.trim()}
                                    className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                  >
                                    {replySubmitting ? (
                                      <RefreshCw className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <Send className="w-3 h-3" />
                                    )}
                                    <span>{lang === 'GR' ? 'Απάντηση' : 'Reply'}</span>
                                  </button>
                                </div>
                              </form>
                            )}
                          </div>
                        );
                      });
                    })()
                  )}
                </div>
              </div>

              {/* Floating Ask AI Button */}
              {!showArticleAiModal && (
                <button
                  type="button"
                  onClick={handleOpenArticleAiModal}
                  className="fixed bottom-8 right-8 z-40 bg-amber-500 hover:bg-amber-600 dark:bg-amber-500 dark:hover:bg-amber-600 text-white font-serif font-black tracking-wide text-xs px-5 py-3.5 rounded-full shadow-2xl flex items-center gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer animate-pulse-slow"
                  style={{ boxShadow: '0 10px 25px -5px rgba(245, 158, 11, 0.4)' }}
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{lang === 'GR' ? 'ΑΙ CHAT' : 'AI CHAT'}</span>
                </button>
              )}

            </div>
          )}

          {/* C. If we are inside the admin portal */}
          {activeView === 'admin' && (
            <AdminPortal lang={lang} onClose={() => setActiveView('home')} />
          )}

          {/* C2. If we are inside the MVP planner */}
          {activeView === 'mvp-planner' && (
            <MvpPlanner lang={lang} currentPalette={currentPalette} />
          )}

          {/* D. Main homepage grid list of articles */}
          {activeView === 'home' && (
            <div className="space-y-6">
              
              {/* Category Filter Dropdown */}
              <div className="flex flex-col sm:flex-row gap-3 pb-4 border-b border-gray-200 dark:border-gray-800 items-start sm:items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="text-[10px] font-black uppercase text-gray-400 dark:text-gray-500 tracking-wider">
                    {lang === 'GR' ? 'ΦΙΛΤΡΟ ΚΑΤΗΓΟΡΙΑΣ:' : 'FILTER CATEGORY:'}
                  </span>
                  <div className="relative">
                    <select
                      value={selectedCategories[0]}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedCategories([val]);
                      }}
                      className="appearance-none bg-gray-50 hover:bg-gray-100 dark:bg-[#1a1a17] dark:hover:bg-[#20201c] text-gray-800 dark:text-gray-200 text-xs font-bold px-4 py-2 pr-8 rounded-xl border border-gray-200 dark:border-gray-800 focus:outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer transition-all"
                    >
                      {['All', 'News', 'Popular', 'YouTube Tech', 'Tutorials', 'Agents', 'Trends', 'Community Projects'].map((cat) => (
                        <option key={cat} value={cat}>
                          {cat === 'Popular' 
                            ? (lang === 'GR' ? '🔥 ΔΗΜΟΦΙΛΗ' : '🔥 POPULAR')
                            : cat === 'YouTube Tech'
                            ? (lang === 'GR' ? '🎥 YOUTUBE TECH' : '🎥 YOUTUBE TECH')
                            : getTranslation(`category${(cat === 'All' ? 'All' : cat).replace(/\s+/g, '')}`, lang)}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-gray-500">
                      <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                        <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                      </svg>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setShowPromptGallery(true)}
                  className="px-4 py-2 rounded-full text-sm font-black border border-amber-500 bg-amber-500/10 hover:bg-amber-500 hover:text-white text-amber-700 dark:text-amber-300 transition-all flex items-center gap-1 shrink-0 cursor-pointer shadow-xs"
                >
                  <Sparkles className="w-3.5 h-3.5 fill-amber-500 text-amber-500 animate-pulse" />
                  <span>Starter Prompt Kit ⚡</span>
                </button>
              </div>

              {/* ROTATING YOUTUBE TECH & MIX CAROUSEL CATEGORY */}
              {selectedCategories.includes('All') && (
                <YoutubeAndMixCarousel
                  lang={lang}
                  articles={articles}
                  onSelectArticle={(id) => {
                    setSelectedArticleId(id);
                    setActiveView('article');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                />
              )}

              {/* Loader */}
              {articlesLoading && articles.length === 0 && (
                <div className="p-16 text-center space-y-3">
                  <span className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></span>
                  <p className="text-xs font-semibold text-gray-500">
                    {lang === 'GR' ? 'Μεταφόρτωση άρθρων από το Firestore...' : 'Loading latest articles from Firestore...'}
                  </p>
                </div>
              )}

              {/* No articles fallbacks */}
              {!articlesLoading && filteredArticles.length === 0 && (
                <div className="p-12 text-center text-gray-500 bg-white dark:bg-[#1a1a17] border border-gray-200 dark:border-gray-800 rounded-2xl">
                  {lang === 'GR' ? 'Δεν βρέθηκαν άρθρα σε αυτή την κατηγορία.' : 'No articles found in this category.'}
                </div>
              )}

              {/* Featured article headliner with glassmorphism shape & breeze scroll entrance */}
              {!isMinimalistLayout && selectedCategories.includes('All') && featuredArticle && !articlesLoading && (
                <motion.div 
                  initial={{ opacity: 0, y: 30, filter: 'blur(8px)', scale: 0.98 }}
                  whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)', scale: 1 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  onClick={() => {
                    setSelectedArticleId(featuredArticle.id);
                    setActiveView('article');
                  }}
                  className="backdrop-blur-xl bg-white/80 dark:bg-[#181815]/80 border-2 border-white/80 dark:border-white/10 rounded-3xl overflow-hidden cursor-pointer group shadow-[0_10px_35px_rgba(0,0,0,0.05)] dark:shadow-[0_10px_35px_rgba(0,0,0,0.3)] hover:shadow-2xl hover:border-amber-500/50 hover:-translate-y-1 transition-all duration-300 backdrop-saturate-150 mb-6 relative"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2">
                    <div className="aspect-video md:aspect-auto md:h-full overflow-hidden bg-gray-100 dark:bg-gray-800 border-r border-gray-100 dark:border-gray-800/80 relative">
                      <img 
                        src={featuredArticle.imageUrl} 
                        alt={featuredArticle.title[lang]} 
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-[1.02] transition-all duration-500"
                      />
                      {/* Floating Source Badge on Image */}
                      <div className="absolute top-3 left-3 px-2.5 py-1 rounded-xl backdrop-blur-md bg-black/60 text-white border border-white/20 text-[9px] font-black tracking-widest uppercase flex items-center gap-1.5 shadow-md z-10">
                        {featuredArticle.isAiGenerated ? (
                          <>
                            <Cpu className="w-3 h-3 text-amber-400 animate-pulse" />
                            <span>AI AGENT</span>
                          </>
                        ) : (
                          <>
                            <Globe className="w-3 h-3 text-emerald-400" />
                            <span>WEB SOURCE</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="p-6 flex flex-col justify-between space-y-4">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-black uppercase text-[#7C3AED] bg-purple-500/10 dark:bg-purple-950/40 border border-purple-500/20 px-2.5 py-1 rounded-full backdrop-blur-md">
                            {getTranslation(`category${featuredArticle.category}`, lang)}
                          </span>
                          <span className="text-[11px] font-black uppercase text-amber-600 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full backdrop-blur-md flex items-center gap-0.5">
                            <Sparkles className="w-2.5 h-2.5" />
                            <span>TRENDING</span>
                          </span>
                          {featuredArticle.isAiGenerated ? (
                            <span className="text-[10px] font-black uppercase text-amber-600 bg-amber-50 dark:bg-amber-950/20 px-2.5 py-1 rounded-full flex items-center gap-1.5 border border-amber-200/50 dark:border-amber-900/30">
                              <Cpu className="w-3 h-3 text-amber-500" />
                              <span>{lang === 'GR' ? 'ΠΗΓΗ: ΑΙ AGENT' : 'SOURCE: AI AGENT'}</span>
                            </span>
                          ) : (
                            <span className="text-[10px] font-black uppercase text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 px-2.5 py-1 rounded-full flex items-center gap-1.5 border border-emerald-200/50 dark:border-emerald-900/30">
                              <Globe className="w-3 h-3 text-emerald-500" />
                              <span>{lang === 'GR' ? 'ΠΡΩΤΟΓΕΝΗΣ ΠΗΓΗ' : 'PRIMARY SOURCE'}</span>
                            </span>
                          )}
                        </div>
                        <h3 className="font-serif font-black text-2xl md:text-3xl text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-tight">
                          {featuredArticle.title[lang] || featuredArticle.title.GR || featuredArticle.title.EN || ''}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-4 leading-relaxed font-medium">
                          {(featuredArticle.summary[lang] || featuredArticle.summary.GR || featuredArticle.summary.EN || '').replace(/•/g, '')}
                        </p>
                        {/* Hashtags */}
                        <div className="flex flex-wrap gap-2 pt-1">
                          {getArticleHashtags(featuredArticle, lang).map((tag, idx) => (
                            <span key={idx} className="text-xs font-bold text-blue-600 dark:text-blue-400 px-2.5 py-0.5 bg-blue-500/10 rounded-full border border-blue-500/20 backdrop-blur-xs">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex justify-between items-center pt-4 border-t border-gray-100 dark:border-gray-800 text-[10px] text-gray-400">
                        <span className="font-bold text-gray-700 dark:text-gray-300">{featuredArticle.author}</span>
                        <div className="flex items-center gap-3">
                          {(() => {
                            const featuredContent = featuredArticle.content[lang] || featuredArticle.content.GR || featuredArticle.content.EN || '';
                            const { time, colorClass } = getReadingTimeDetails(featuredContent);
                            return (
                              <span className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${colorClass}`}>
                                <Clock className="w-3.5 h-3.5" />
                                <span>{time} {getTranslation('minShort', lang)}</span>
                              </span>
                            );
                          })()}
                          <span>{new Date(featuredArticle.publishedAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Grid block of list articles with Glassmorphism Shapes */}
              <motion.div 
                className={isMinimalistLayout ? "grid grid-cols-1 md:grid-cols-2 gap-4" : "grid grid-cols-1 md:grid-cols-2 gap-6"}
              >
                {filteredArticles
                  .filter((art) => isMinimalistLayout || !selectedCategories.includes('All') || art.id !== featuredArticle?.id)
                  .map((art, index) => {
                    const localTitle = art.title[lang] || art.title.GR || art.title.EN || '';
                    const localSummary = art.summary[lang] || art.summary.GR || art.summary.EN || '';
                    
                    if (isMinimalistLayout) {
                      return (
                        <motion.div
                          key={art.id}
                          initial={{ opacity: 0, y: 24, filter: 'blur(6px)', scale: 0.98 }}
                          whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)', scale: 1 }}
                          viewport={{ once: true, margin: '-30px' }}
                          transition={{ duration: 0.5, delay: (index % 4) * 0.08, ease: [0.22, 1, 0.36, 1] }}
                          onClick={() => {
                            setSelectedArticleId(art.id);
                            setActiveView('article');
                          }}
                          className="backdrop-blur-xl bg-white/75 dark:bg-[#181816]/75 border border-white/70 dark:border-white/10 rounded-3xl p-5 cursor-pointer group shadow-[0_6px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_6px_20px_rgba(0,0,0,0.2)] hover:shadow-xl hover:border-amber-500/50 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between space-y-3 backdrop-saturate-150"
                        >
                          <div className="space-y-2">
                            {/* Top Row: Category & Badges & Actions */}
                            <div className="flex items-center justify-between">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[9px] font-black uppercase text-[#7C3AED] bg-purple-50 dark:bg-purple-950/20 px-2 py-0.5 rounded">
                                  {getTranslation(`category${(art.category || '').replace(/\s+/g, '')}`, lang)}
                                </span>
                                {art.isAiGenerated ? (
                                  <span className="text-[9px] font-black uppercase text-amber-600 bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 rounded flex items-center gap-1">
                                    <Cpu className="w-2.5 h-2.5 text-amber-500" />
                                    <span>{lang === 'GR' ? 'AI AGENT' : 'AI'}</span>
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-black uppercase text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded flex items-center gap-1">
                                    <Globe className="w-2.5 h-2.5 text-emerald-500" />
                                    <span>{lang === 'GR' ? 'WEB' : 'WEB'}</span>
                                  </span>
                                )}
                              </div>
                              {/* Share / Bookmark */}
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={(e) => handleShareArticle(art.id, e)}
                                  className="p-1.5 rounded-lg border bg-gray-50/50 dark:bg-gray-800/30 border-gray-150 dark:border-gray-700/50 hover:border-amber-500 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all cursor-pointer"
                                  title={lang === 'GR' ? 'Αντιγραφή συνδέσμου' : 'Copy Link'}
                                >
                                  <Link className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={(e) => handleToggleBookmark(art.id, e)}
                                  className={`p-1.5 rounded-lg border transition-all ${
                                    bookmarks.includes(art.id)
                                      ? 'bg-blue-600 border-blue-600 text-white'
                                      : 'bg-gray-50/50 dark:bg-gray-800/30 border-gray-150 dark:border-gray-700/50 hover:border-amber-500 text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                  }`}
                                >
                                  <Bookmark className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                            {/* Title */}
                            <h3 className="font-serif font-black text-md text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-snug">
                              {toShortPhraseHeadline(localTitle)}
                            </h3>
                            {/* Explanatory Line (Single sentence/line-clamp-2) */}
                            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 leading-relaxed">
                              {localSummary.replace(/•/g, '')}
                            </p>
                          </div>
                          {/* Footer details */}
                          <div className="pt-2 border-t border-gray-100 dark:border-gray-800/80 text-[10px] text-gray-400 flex justify-between items-center">
                            <span className="font-medium">{art.author}</span>
                            <div className="flex items-center gap-2">
                              {(() => {
                                const artContent = art.content[lang] || art.content.GR || art.content.EN || '';
                                const { time } = getReadingTimeDetails(artContent);
                                return (
                                  <span className="flex items-center gap-0.5">
                                    <Clock className="w-3 h-3 text-gray-400" />
                                    <span>{time} {getTranslation('minShort', lang)}</span>
                                  </span>
                                );
                              })()}
                              <span>•</span>
                              <span>{new Date(art.publishedAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </motion.div>
                      );
                    }

                    return (
                      <motion.div
                        key={art.id}
                        initial={{ opacity: 0, y: 30, filter: 'blur(6px)', scale: 0.98 }}
                        whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)', scale: 1 }}
                        viewport={{ once: true, margin: '-30px' }}
                        transition={{ duration: 0.5, delay: (index % 4) * 0.08, ease: [0.22, 1, 0.36, 1] }}
                        onClick={() => {
                          setSelectedArticleId(art.id);
                          setActiveView('article');
                        }}
                        className="backdrop-blur-xl bg-white/75 dark:bg-[#181816]/75 border border-white/70 dark:border-white/10 rounded-3xl overflow-hidden cursor-pointer group shadow-[0_8px_25px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_25px_rgba(0,0,0,0.25)] hover:shadow-2xl hover:border-amber-500/50 hover:-translate-y-1.5 transition-all duration-300 backdrop-saturate-150 flex flex-col justify-between"
                      >
                        <div>
                          {/* Image */}
                          <div className="aspect-video w-full overflow-hidden bg-gray-100 dark:bg-gray-800 relative border-b border-gray-100 dark:border-gray-800/80">
                            <img 
                              src={art.imageUrl} 
                              alt={localTitle} 
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover group-hover:scale-[1.01] transition-transform duration-300"
                            />
                            {/* Floating Source Badge on Image */}
                            <div className="absolute top-3 left-3 px-2 py-1 rounded-lg backdrop-blur-md bg-black/60 text-white border border-white/20 text-[9px] font-black tracking-widest uppercase flex items-center gap-1.5 shadow-md z-10">
                              {art.isAiGenerated ? (
                                <>
                                  <Cpu className="w-3 h-3 text-amber-400 animate-pulse" />
                                  <span>AI AGENT</span>
                                </>
                              ) : (
                                <>
                                  <Globe className="w-3 h-3 text-emerald-400" />
                                  <span>WEB SOURCE</span>
                                </>
                              )}
                            </div>
                            {/* Copy Link trigger */}
                            <button
                              onClick={(e) => handleShareArticle(art.id, e)}
                              className="absolute top-3 right-12 p-2 rounded-xl backdrop-blur-md shadow-xs border bg-white/80 border-gray-200 hover:border-amber-500 text-gray-500 hover:text-gray-900 transition-all cursor-pointer"
                              title={lang === 'GR' ? 'Αντιγραφή συνδέσμου' : 'Copy Link'}
                            >
                              <Link className="w-3.5 h-3.5" />
                            </button>
                            {/* Bookmark trigger */}
                            <button
                              onClick={(e) => handleToggleBookmark(art.id, e)}
                              className={`absolute top-3 right-3 p-2 rounded-xl backdrop-blur-md shadow-xs border transition-all ${
                                bookmarks.includes(art.id)
                                  ? 'bg-blue-600 border-blue-600 text-white'
                                  : 'bg-white/80 border-gray-200 hover:border-amber-500 text-gray-500 hover:text-gray-900'
                              }`}
                            >
                              <Bookmark className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          {/* Info Block */}
                          <div className="p-5 space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[11px] font-black uppercase text-[#7C3AED] bg-purple-50 dark:bg-purple-950/20 px-2.5 py-1 rounded">
                                {getTranslation(`category${(art.category || '').replace(/\s+/g, '')}`, lang)}
                              </span>
                              {art.isAiGenerated ? (
                                <span className="text-[10px] font-black uppercase text-amber-600 bg-amber-50 dark:bg-amber-950/20 px-2.5 py-1 rounded flex items-center gap-1.5 border border-amber-200/50 dark:border-amber-900/30">
                                  <Cpu className="w-3 h-3 text-amber-500" />
                                  <span>{lang === 'GR' ? 'ΠΗΓΗ: ΑΙ AGENT' : 'SOURCE: AI AGENT'}</span>
                                </span>
                              ) : (
                                <span className="text-[10px] font-black uppercase text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 px-2.5 py-1 rounded flex items-center gap-1.5 border border-emerald-200/50 dark:border-emerald-900/30">
                                  <Globe className="w-3 h-3 text-emerald-500" />
                                  <span>{lang === 'GR' ? 'ΠΡΩΤΟΓΕΝΗΣ ΠΗΓΗ' : 'PRIMARY SOURCE'}</span>
                                </span>
                              )}
                            </div>
                            <h3 className="font-serif font-bold text-lg text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-tight line-clamp-2">
                              {toShortPhraseHeadline(localTitle)}
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-3 leading-relaxed">
                              {localSummary.replace(/•/g, '')}
                            </p>
                            {/* Hashtags */}
                            <div className="flex flex-wrap gap-2 pt-1">
                              {getArticleHashtags(art, lang).map((tag, idx) => (
                                <span key={idx} className="text-xs font-bold text-blue-600 dark:text-blue-400 px-2 py-0.5 bg-blue-50/50 dark:bg-blue-950/20 rounded-md">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                        {/* Footer details */}
                        <div className="px-5 pb-5 pt-3 border-t border-gray-100 dark:border-gray-800 text-[10px] text-gray-400 flex justify-between items-center">
                          <span>{art.author}</span>
                          <div className="flex items-center gap-3">
                            {(() => {
                              const artContent = art.content[lang] || art.content.GR || art.content.EN || '';
                              const { time, colorClass } = getReadingTimeDetails(artContent);
                              return (
                                <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${colorClass}`}>
                                  <Clock className="w-3.5 h-3.5" />
                                  <span>{time} {getTranslation('minShort', lang)}</span>
                                </span>
                              );
                            })()}
                            <span>{new Date(art.publishedAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
              </motion.div>

              {/* Popular Articles List (ΔΗΜΟΦΙΛΗ) */}
              {(() => {
                const popularArticles = [...articles]
                  .sort((a, b) => b.views - a.views)
                  .slice(0, 5);

                if (popularArticles.length === 0) return null;

                return (
                  <div className="mt-10 p-6 bg-amber-500/5 dark:bg-purple-950/10 border border-amber-500/20 dark:border-purple-800/30 rounded-3xl space-y-4">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-amber-500 dark:text-purple-400" />
                      <h3 className="text-xl font-serif font-black text-gray-900 dark:text-white">
                        {lang === 'GR' ? 'ΔΗΜΟΦΙΛΗ' : 'POPULAR ARTICLES'}
                      </h3>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-3">
                      {popularArticles.map((art, index) => {
                        const localTitle = art.title[lang] || art.title.GR || art.title.EN || '';
                        const categoryTranslation = getTranslation(`category${(art.category || '').replace(/\s+/g, '')}`, lang);
                        const categoryText = lang === 'GR' ? toGreekUppercase(categoryTranslation) : categoryTranslation.toUpperCase();
                        
                        return (
                          <div
                            key={art.id}
                            onClick={() => {
                              setSelectedArticleId(art.id);
                              setActiveView('article');
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="flex items-center justify-between gap-4 p-4 bg-white dark:bg-[#1f1f1a] border border-amber-500/10 dark:border-purple-800/20 hover:border-amber-500 dark:hover:border-purple-400 rounded-2xl cursor-pointer transition-all hover:shadow-sm group"
                          >
                            <div className="flex items-center gap-3.5 min-w-0 flex-1">
                              <span className="text-xl font-black text-[#7C3AED] dark:text-purple-400 w-6 text-center shrink-0">
                                #{index + 1}
                              </span>
                              <div className="min-w-0 flex-1">
                                <h4 className="text-sm font-serif font-black text-gray-900 dark:text-white group-hover:text-[var(--dyn-link)] transition-colors line-clamp-1">
                                  {localTitle}
                                </h4>
                                <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold mt-1">
                                  {art.author} • {categoryText}
                                </p>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-1 px-2.5 py-1 bg-amber-500/10 dark:bg-purple-500/15 text-amber-700 dark:text-purple-300 rounded-lg text-xs font-bold shrink-0">
                              <Eye className="w-3.5 h-3.5" />
                              <span>{art.views}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

            </div>
          )}

        </section>

        {/* Right Sidebar Columns (Widgets, Newsletters) */}
        <aside className="space-y-6">
          
          {/* A. Premium Services block (Enclosed in OS Window Frame) */}
          <div className="bg-[#0b0e14] border-2 border-amber-500/40 rounded-3xl overflow-hidden shadow-[0_10px_35px_rgba(0,0,0,0.3)] backdrop-blur-xl">
            {/* macOS / Cyber Window Header Bar */}
            <div className="bg-[#06080c] border-b border-amber-500/30 px-4 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 mr-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block shadow-sm" />
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 inline-block shadow-sm" />
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block shadow-sm" />
                </div>
                <span className="font-mono text-[11px] font-black text-amber-400 tracking-wider">
                  {lang === 'GR' ? 'ΕΠΕΝΔΥΣΕ OS v3.2 [WINDOW]' : 'INVEST OS v3.2 [WINDOW]'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 font-mono text-[9px] text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span>[SECURE]</span>
              </div>
            </div>
            
            <div className="p-3 bg-[#0f121a]">
              <div id="premium-services-section">
                <PremiumServices lang={lang} />
              </div>
            </div>
          </div>

          {/* Starter Prompt Kit Callout Widget */}
          <div className="p-5 bg-gradient-to-br from-amber-500/10 via-purple-500/5 to-transparent border border-amber-500/20 rounded-2xl shadow-xs transition-all duration-300 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none group-hover:scale-110 transition-transform">
              <Sparkles className="w-20 h-20 text-[#7C3AED]" />
            </div>
            
            <div className="space-y-3 relative z-10">
              <span className="bg-amber-500 text-white text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full inline-block">
                {lang === 'GR' ? 'PRO ΕΡΓΑΛΕΙΑ' : 'PRO TOOL'}
              </span>
              <h3 className="font-serif font-black text-lg text-gray-900 dark:text-white leading-tight">
                {lang === 'GR' ? 'Starter Prompt Kit' : 'Starter Prompt Kit'}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                {lang === 'GR' 
                  ? 'Αντιγράψτε επαγγελματικά Prompt Schemas για να δημιουργήσετε MVPs, SaaS & Landing Pages σε δευτερόλεπτα.' 
                  : 'Copy-paste professional Prompt blueprints for building high-quality MVPs, SaaS platforms & Landing Pages.'}
              </p>
              
              <button
                onClick={() => setShowPromptGallery(true)}
                className="w-full py-2.5 bg-gray-900 hover:bg-amber-600 text-white dark:bg-white dark:text-gray-900 dark:hover:bg-amber-500 dark:hover:text-white transition-colors font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
              >
                <Compass className="w-4 h-4" />
                <span>{lang === 'GR' ? 'Εξερεύνηση Kit' : 'Explore Kit'}</span>
              </button>
            </div>
          </div>

          {/* B. Newsletter Subscriptions box */}
          <div className="p-6 bg-white dark:bg-[#1a1a17] border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xs transition-colors duration-300">
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-xl">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-serif font-black tracking-tight text-gray-900 dark:text-white leading-tight">
                  {getTranslation('newsletterSubscribe', lang)}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {getTranslation('newsletterDesc', lang)}
                </p>
              </div>
            </div>

            {/* Newsletter Messages */}
            {newsletterSuccess && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 text-xs rounded-xl border border-emerald-100 dark:border-emerald-950/50 flex gap-2 mb-4">
                <CheckCircle className="w-4.5 h-4.5 shrink-0" />
                <span>{lang === 'GR' ? 'Εγγραφήκατε επιτυχώς!' : 'Successfully subscribed to digest!'}</span>
              </div>
            )}

            {newsletterError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 text-xs rounded-xl border border-red-100 dark:border-red-950/50 flex gap-2 mb-4">
                <AlertCircle className="w-4.5 h-4.5 shrink-0" />
                <span>{newsletterError}</span>
              </div>
            )}

            <form onSubmit={handleNewsletterSubmit} className="space-y-2.5">
              <input
                type="email"
                required
                value={newsletterEmail}
                onChange={(e) => setNewsletterEmail(e.target.value)}
                placeholder="you@domain.com"
                className="w-full px-3 py-2.5 text-xs bg-gray-50 dark:bg-[#22221e] border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              />
              <button
                type="submit"
                disabled={newsletterLoading}
                className="w-full py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-[#7C3AED] dark:hover:bg-[#7C3AED] dark:hover:text-white transition-colors font-bold text-xs rounded-lg shadow-xs flex justify-center items-center"
              >
                {newsletterLoading ? (
                  <span className="w-4 h-4 border-2 border-white dark:border-gray-900 border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  lang === 'GR' ? 'Εγγραφή' : 'Subscribe'
                )}
              </button>
            </form>
          </div>

        </aside>

      </main>
      )}

      {/* 4. Footer Area */}
      <footer className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-[#161614] py-8 mt-12 text-center text-xs text-gray-500 dark:text-gray-400 transition-colors">
        <div className="max-w-7xl mx-auto px-4 space-y-4">
          <div className="flex flex-wrap justify-center items-center gap-4 text-[11px] font-bold uppercase text-gray-400 tracking-wider">
            <button onClick={() => { setActiveView('home'); setSelectedArticleId(null); }} className="hover:text-blue-500 transition-colors">
              {lang === 'GR' ? 'Αρχική' : 'Home'}
            </button>
            <span>•</span>
            <button 
              onClick={() => { 
                setShowPersonalizationModal(true); 
              }} 
              className="hover:text-blue-500 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span>{getTranslation('bookmarkedArticles', lang)}</span>
              {bookmarks.length > 0 && (
                <span className="px-1.5 py-0.2 bg-red-500 text-white rounded-full text-[9px] font-black">
                  {bookmarks.length}
                </span>
              )}
            </button>
            <span>•</span>
            <button onClick={() => setShowPromptGallery(true)} className="hover:text-amber-500 text-amber-600 dark:text-amber-400 font-bold transition-colors cursor-pointer">
              Starter Prompt Kit ⚡
            </button>
            <span>•</span>
            <button 
              onClick={() => {
                setActiveView('admin');
                setSelectedArticleId(null);
              }}
              className="hover:text-amber-500 transition-colors flex items-center gap-1 font-bold text-[#7C3AED]"
            >
              <span>{getTranslation('adminLink', lang)}</span>
            </button>
            <span>•</span>
            <button
              onClick={() => setShowDisclaimerModal(true)}
              className="hover:text-blue-500 transition-colors font-bold text-gray-600 dark:text-gray-300 cursor-pointer"
            >
              <span>{getTranslation('disclaimerTitle', lang)}</span>
            </button>
          </div>

          <p className="font-serif font-black tracking-tight text-gray-800 dark:text-gray-200 text-sm">
            THE VIBE CODING NEWS PORTAL
          </p>
          <p className="text-[10px]">
            &copy; 2026 The Vibe Coding News Portal. Developed using real-time generative agents and Google Gemini Search Grounding. All rights reserved.
          </p>
        </div>
      </footer>

      {/* Auth Modal Container */}
      <AuthModal 
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        lang={lang}
      />

      {/* Advanced Search Modal Container */}
      <SearchModal 
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        lang={lang}
        articles={articles}
        onSelectArticle={(id) => {
          setSelectedArticleId(id);
          setActiveView('article');
        }}
      />

      {/* AI Agent Custom Web Search Modal */}
      <AiSearchModal
        isOpen={showAiSearchModal}
        onClose={() => setShowAiSearchModal(false)}
        lang={lang}
      />

      {/* Vibe Coding Crash Course Modal */}
      <CrashCourseModal
        isOpen={showCrashCourseModal}
        onClose={() => setShowCrashCourseModal(false)}
        lang={lang}
      />

      {/* Starter Prompt Kit Modal */}
      <StarterPromptGallery
        isOpen={showPromptGallery}
        onClose={() => setShowPromptGallery(false)}
        lang={lang}
      />

      {/* Voting Explanation Dialog Modal */}
      {showVoteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-[#1a1a17] border border-gray-200 dark:border-gray-800 rounded-3xl p-6 shadow-2xl relative space-y-4 animate-fade-in">
            <button
              onClick={() => {
                setShowVoteModal(false);
                setVotingArticleId(null);
                setPendingVoteType(null);
              }}
              className="absolute top-4 right-4 p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-400 cursor-pointer"
            >
              <X className="w-4.5 h-4.5" />
            </button>

            <div className="space-y-1">
              <h3 className="text-lg font-serif font-black text-gray-900 dark:text-white flex items-center gap-2">
                <span>{pendingVoteType === 'up' ? (lang === 'GR' ? '▲ Υπερψήφιση Project' : '▲ Upvote Project') : (lang === 'GR' ? '▼ Καταψήφιση Project' : '▼ Downvote Project')}</span>
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed font-medium">
                {lang === 'GR' 
                  ? 'Για να καταμετρηθεί η ψήφος σας, παρακαλώ δώστε μια μικρή εξήγηση/σχόλιο γιατί ψηφίζετε.' 
                  : 'To confirm your vote, please provide a brief comment explaining your evaluation.'}
              </p>
            </div>

            <form onSubmit={handleSubmitVoteExplanation} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1.5">
                  {lang === 'GR' ? 'Η ΕΞΗΓΗΣΗ ΣΑΣ' : 'YOUR EXPLANATION'}
                </label>
                <textarea
                  required
                  rows={4}
                  minLength={5}
                  value={voteExplanationText}
                  onChange={(e) => setVoteExplanationText(e.target.value)}
                  placeholder={lang === 'GR' ? 'Γράψτε εδώ την άποψή σας για το project...' : 'Provide constructive feedback, bugs, or praises...'}
                  className="w-full px-3.5 py-2.5 text-xs bg-gray-50 dark:bg-[#20201c] text-gray-955 dark:text-white border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowVoteModal(false);
                    setVotingArticleId(null);
                    setPendingVoteType(null);
                  }}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-black transition-colors cursor-pointer text-center"
                >
                  {lang === 'GR' ? 'Ακύρωση' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={voteSubmitting || voteExplanationText.trim().length < 5}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  {voteSubmitting ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle className="w-3.5 h-3.5" />
                  )}
                  <span>{lang === 'GR' ? 'Υποβολή' : 'Submit Vote'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ask AI about this Article Modal */}
      {showArticleAiModal && selectedArticle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in" id="article-ai-modal-overlay">
          <div className="bg-white dark:bg-[#1a1a17] border border-gray-200 dark:border-gray-800 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden transform transition-all duration-300 flex flex-col h-[520px]" id="article-ai-modal-card">
            {/* Header */}
            <div className="p-5 border-b border-gray-150 dark:border-gray-800 bg-gradient-to-r from-amber-600/10 via-blue-600/10 to-transparent flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2 overflow-hidden">
                <Sparkles className="w-5 h-5 text-amber-500 shrink-0" />
                <div className="overflow-hidden">
                  <h3 className="font-serif font-black text-sm text-gray-900 dark:text-white truncate">
                    {lang === 'GR' ? 'ΑΙ CHAT' : 'AI CHAT'}
                  </h3>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate font-semibold">
                    {selectedArticle.title[lang] || selectedArticle.title.GR || selectedArticle.title.EN || ''}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowArticleAiModal(false)}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-lg transition-all cursor-pointer shrink-0"
                id="close-article-ai-btn"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            {/* Chat Messages Body */}
            <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-gray-50/50 dark:bg-[#22221e]/20 scrollbar-thin">
              {articleAiMessages.map((msg) => (
                <div 
                  key={msg.id} 
                  className={`flex gap-2.5 max-w-[85%] ${
                    msg.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'
                  }`}
                >
                  {/* Avatar */}
                  <div className={`p-1.5 rounded-lg h-8 w-8 flex items-center justify-center shrink-0 ${
                    msg.role === 'user' 
                      ? 'bg-blue-600/10 text-blue-600 dark:text-blue-400' 
                      : 'bg-amber-600/10 text-amber-600 dark:text-amber-400'
                  }`}>
                    {msg.role === 'user' ? <UserIcon className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                  </div>

                  {/* Bubble */}
                  <div className="space-y-1 pt-0.5">
                    <div className={`p-3 rounded-2xl text-xs leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white rounded-tr-none'
                        : 'bg-white dark:bg-[#1f1f1c] border border-gray-150 dark:border-gray-800 text-gray-800 dark:text-gray-200 rounded-tl-none shadow-2xs'
                    }`}>
                      <p className="whitespace-pre-line">{msg.text}</p>
                    </div>
                    <span className={`block text-[9px] text-gray-400 px-1 font-medium tracking-tight ${
                      msg.role === 'user' ? 'text-right' : 'text-left'
                    }`}>
                      {msg.timestamp}
                    </span>
                  </div>
                </div>
              ))}
              {articleAiLoading && (
                <div className="flex gap-2.5 max-w-[85%] mr-auto items-center">
                  <div className="p-1.5 rounded-lg h-8 w-8 flex items-center justify-center shrink-0 bg-amber-600/10 text-amber-600">
                    <Sparkles className="w-4 h-4 animate-spin text-amber-500" />
                  </div>
                  <div className="p-3 bg-white dark:bg-[#1f1f1c] border border-gray-150 dark:border-gray-800 rounded-2xl rounded-tl-none flex items-center gap-1.5 shadow-2xs">
                    <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                </div>
              )}
            </div>

            {/* Error Area */}
            {articleAiError && (
              <div className="px-5 py-3 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 text-xs border-t border-red-100 dark:border-red-950/50 flex gap-2">
                <AlertCircle className="w-4.5 h-4.5 shrink-0" />
                <span>{articleAiError}</span>
              </div>
            )}

            {/* Quick Prompts / Suggestions Selector */}
            <div className="px-5 py-2.5 bg-gray-50 dark:bg-[#1c1c19] border-t border-gray-100 dark:border-gray-800 flex gap-1.5 overflow-x-auto whitespace-nowrap scrollbar-none shrink-0">
              {(lang === 'GR' 
                ? ['Κάνε μου μια σύνοψη', 'Ποια είναι τα σημαντικά σημεία;', 'Πώς με βοηθάει αυτό;']
                : ['Summarize this article', 'What are the key takeaways?', 'How does this help me?']
              ).map((promptText, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setArticleAiInput(promptText);
                  }}
                  className="px-3 py-1 bg-white hover:bg-gray-100 dark:bg-[#252521] dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 text-[10px] font-bold rounded-full border border-gray-150 dark:border-gray-800/80 transition-all cursor-pointer"
                >
                  {promptText}
                </button>
              ))}
            </div>

            {/* Input Form Footer */}
            <form onSubmit={handleSendArticleAiMessage} className="p-4 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-[#1a1a17] flex gap-2 shrink-0">
              <input
                type="text"
                required
                value={articleAiInput}
                onChange={(e) => setArticleAiInput(e.target.value)}
                placeholder={lang === 'GR' ? 'Συνομιλία με AI σχετικά με το άρθρο...' : 'Chat with AI about the article...'}
                className="flex-1 px-3.5 py-2.5 text-xs bg-gray-50 dark:bg-[#22221e] border border-gray-200 dark:border-gray-800 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-transparent"
              />
              <button
                type="submit"
                disabled={articleAiLoading || !articleAiInput.trim()}
                className="p-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl transition-all shrink-0 disabled:opacity-50 cursor-pointer flex items-center justify-center"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* About Modal */}
      {showAboutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs" id="about-modal-overlay">
          <div className="bg-white dark:bg-[#1a1a17] border border-gray-200 dark:border-gray-800 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden transform transition-all duration-300" id="about-modal-card">
            {/* Header */}
            <div className="p-6 border-b border-gray-150 dark:border-gray-800 bg-gradient-to-r from-teal-600/10 via-blue-600/10 to-transparent flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Info className="w-5 h-5" style={{ color: currentPalette.link }} />
                <h3 className="font-serif font-black text-lg text-gray-900 dark:text-white">
                  {getTranslation('aboutTitle', lang)}
                </h3>
              </div>
              <button
                onClick={() => setShowAboutModal(false)}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-lg transition-all cursor-pointer"
                id="close-about-modal-btn"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-5 overflow-y-auto max-h-[70vh]">
              <div className="flex flex-col items-center text-center space-y-4 pb-4 border-b border-gray-150 dark:border-gray-800">
                <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-slate-100 dark:border-slate-800 shadow-lg relative group">
                  <img 
                    src={openmindLogo} 
                    alt="The Open Mind Club Logo" 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                    referrerPolicy="no-referrer" 
                  />
                </div>
                <div className="bg-blue-600/15 dark:bg-blue-400/15 text-blue-600 dark:text-blue-400 px-3.5 py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase shadow-xs border border-blue-500/10">
                  +++ ΕΒΔΟΜΑΔΙΑΙΟ INSIGHT MAILCAST +++
                </div>
              </div>

              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed font-medium whitespace-pre-line">
                {getTranslation('aboutText', lang)}
              </p>

              {/* Link to openmind.club */}
              <div className="pt-2">
                <a
                  href="https://theopenmind.club"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl text-xs font-black tracking-wider uppercase text-white shadow-md hover:opacity-90 transition-all cursor-pointer"
                  style={{ backgroundColor: currentPalette.link }}
                  id="about-openmind-link"
                >
                  <Link className="w-4 h-4" />
                  <span>theopenmind.club</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Topics Outline Modal */}
      {showTopicsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md" id="topics-outline-modal-overlay">
          <div 
            className="bg-white dark:bg-[#1a1a17] border border-gray-200 dark:border-gray-800 rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden transform transition-all duration-300 flex flex-col max-h-[85vh]"
            id="topics-outline-modal-card"
          >
            {/* Header */}
            <div className="p-6 border-b border-gray-150 dark:border-gray-800 bg-gradient-to-r from-purple-600/10 via-pink-600/10 to-transparent flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2.5">
                <Sliders className="w-5.5 h-5.5 text-purple-600" style={{ color: currentPalette.link }} />
                <div>
                  <h3 className="font-serif font-black text-lg text-gray-900 dark:text-white">
                    {lang === 'GR' ? 'Σκελετός Θεμάτων & Άρθρων' : 'Articles & Topics Skeleton'}
                  </h3>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                    {lang === 'GR' 
                      ? 'Η δομή και η θεματολογία όλων των άρθρων' 
                      : 'The full structural taxonomy of our corpus'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowTopicsModal(false)}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-lg transition-all cursor-pointer"
                id="close-topics-modal-btn"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            {/* Content list */}
            <div className="p-6 overflow-y-auto space-y-6 scrollbar-thin bg-gray-50/50 dark:bg-[#22221e]/20 flex-1">
              <div className="space-y-4">
                {articles.map((art) => {
                  const titleStr = art.title[lang] || art.title.GR || art.title.EN || '';
                  const summaryPoints = art.summary && (art.summary[lang] || art.summary.GR || art.summary.EN || '')
                    ? (art.summary[lang] || art.summary.GR || art.summary.EN || '').split('\n')
                    : [];

                  return (
                    <div 
                      key={art.id}
                      onClick={() => {
                        setSelectedArticleId(art.id);
                        setActiveView('article');
                        setShowTopicsModal(false);
                      }}
                      className="p-5 bg-white dark:bg-[#1f1f1c] border border-gray-200 hover:border-purple-500/50 dark:border-gray-800 dark:hover:border-purple-500/50 rounded-2xl shadow-xs hover:shadow-md transition-all duration-300 cursor-pointer group text-left"
                    >
                      {/* Meta Info */}
                      <div className="flex items-center gap-2 mb-2 text-[10px] font-black uppercase tracking-wider">
                        <span 
                          className="px-2 py-0.5 rounded-md"
                          style={{ 
                            backgroundColor: `${currentPalette.category}15`, 
                            color: currentPalette.category 
                          }}
                        >
                          {art.category}
                        </span>
                        <span className="text-gray-400 dark:text-gray-500">•</span>
                        <span className="text-gray-500 dark:text-gray-400">{art.author}</span>
                      </div>

                      {/* Title */}
                      <h4 className="font-serif font-black text-sm md:text-base text-gray-900 dark:text-white leading-snug group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                        {titleStr}
                      </h4>

                      {/* Visual Topics Skeleton */}
                      <div className="mt-3.5 pt-3 border-t border-gray-100 dark:border-gray-800 space-y-2">
                        <span className="text-[10px] font-extrabold uppercase tracking-widest text-purple-600/80 dark:text-purple-400/80 block">
                          {lang === 'GR' ? 'Δομικός Σκελετός Άρθρου (1500+ λέξεις)' : 'Article Structural Skeleton (1500+ words)'}
                        </span>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 mt-2 bg-gray-50/50 dark:bg-[#181816]/50 p-3.5 rounded-xl border border-gray-100 dark:border-gray-800/80">
                          {/* Section 1: Intro */}
                          <div className="flex items-start gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                            <div>
                              <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300 block">
                                01. {lang === 'GR' ? 'Εισαγωγή & Ιστορική Αναδρομή' : 'Introduction & Literature Review'}
                              </span>
                              <span className="text-[9px] text-gray-400 dark:text-gray-500 block">
                                {lang === 'GR' ? 'Ορισμοί, κίνητρα και σύγχρονη βιβλιογραφία' : 'Definitions, motivation, and contemporary bibliography'}
                              </span>
                            </div>
                          </div>

                          {/* Section 2: Core Analysis */}
                          <div className="flex items-start gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-1.5 shrink-0" />
                            <div>
                              <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300 block">
                                02. {lang === 'GR' ? 'Κύρια Μεθοδολογία & Ανάλυση' : 'Core Methodology & Discussion'}
                              </span>
                              <span className="text-[9px] text-gray-400 dark:text-gray-500 block">
                                {lang === 'GR' ? 'Βαθιά θεωρητική ανάλυση και συγκριτικά σενάρια' : 'Deep theoretical exploration and comparative analysis'}
                              </span>
                            </div>
                          </div>

                          {/* Section 3: Technical Appendix */}
                          <div className="flex items-start gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                            <div>
                              <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300 block">
                                03. {lang === 'GR' ? 'Παράρτημα & Τεχνικό Blueprint' : 'Technical Appendix & Blueprint'}
                              </span>
                              <span className="text-[9px] text-gray-400 dark:text-gray-500 block">
                                {lang === 'GR' ? 'Συγκεκριμένες υλοποιήσεις, πίνακες και κώδικας' : 'Detailed blueprints, tabular stats, and code specs'}
                              </span>
                            </div>
                          </div>

                          {/* Section 4: FAQs & Conclusions */}
                          <div className="flex items-start gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                            <div>
                              <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300 block">
                                04. {lang === 'GR' ? 'Συχνές Ερωτήσεις (FAQ) & Συμπεράσματα' : 'FAQs & Final Concluding Remarks'}
                              </span>
                              <span className="text-[9px] text-gray-400 dark:text-gray-500 block">
                                {lang === 'GR' ? 'Απαντήσεις σε κρίσιμα ερωτήματα και μελλοντικό όραμα' : 'Answering key questions and projecting the future'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Summary points */}
                        {summaryPoints.length > 0 && (
                          <div className="mt-3 space-y-1">
                            <span className="text-[9px] font-extrabold uppercase tracking-wider text-gray-400 block">
                              {lang === 'GR' ? 'Κύρια Σημεία Θεματολογίας:' : 'Key Structural Highlights:'}
                            </span>
                            {summaryPoints.map((pt, index) => {
                              if (!pt.trim()) return null;
                              return (
                                <p key={index} className="text-[11px] text-gray-500 dark:text-gray-400 leading-normal pl-2 border-l border-gray-200 dark:border-gray-800">
                                  {pt}
                                </p>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Read CTA */}
                      <div className="mt-4 flex justify-end">
                        <span 
                          className="text-[11px] font-black uppercase tracking-wider inline-flex items-center gap-1 group-hover:underline"
                          style={{ color: currentPalette.link }}
                        >
                          {lang === 'GR' ? 'ΑΝΑΓΝΩΣΗ ΑΡΘΡΟΥ' : 'READ ARTICLE'}
                          <span className="text-xs transition-transform group-hover:translate-x-1 inline-block">→</span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-150 dark:border-gray-800 bg-gray-50 dark:bg-[#1a1a17] flex justify-end shrink-0">
              <button
                onClick={() => setShowTopicsModal(false)}
                className="px-5 py-2.5 bg-gray-950 text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 transition-colors font-bold text-xs rounded-xl cursor-pointer"
              >
                {lang === 'GR' ? 'Κλείσιμο' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Community Benefits Modal */}
      {showCommunityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#1a1a17] border border-gray-200 dark:border-gray-800 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden transform transition-all duration-300">
            {/* Header */}
            <div className="p-6 border-b border-gray-150 dark:border-gray-800 bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-transparent flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="font-serif font-black text-lg text-gray-900 dark:text-white">
                  {lang === 'GR' ? 'Κοινότητα Vibe Coding' : 'Vibe Coding Community'}
                </h3>
              </div>
              <button
                onClick={() => setShowCommunityModal(false)}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-lg transition-all cursor-pointer"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                {lang === 'GR'
                  ? 'Καλώς ήρθατε στον απόλυτο προορισμό για Vibe Coders. Γίνετε μέλος μιας δυναμικής ομάδας από δημιουργούς, developers και AI enthusiasts.'
                  : 'Welcome to the ultimate destination for Vibe Coders. Join a dynamic team of creators, developers, and AI enthusiasts.'}
              </p>

              {/* Benefits list */}
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="p-2 bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 rounded-xl shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider">
                      {lang === 'GR' ? 'Αποκλειστικά Prompt Blueprints' : 'Exclusive Prompt Blueprints'}
                    </h4>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed mt-0.5">
                      {lang === 'GR'
                        ? 'Αποκτήστε πρόσβαση σε εξειδικευμένα Prompt blueprints για την παραγωγή MVPs, SaaS και Landing Pages σε δευτερόλεπτα.'
                        : 'Get access to specialized prompt blueprints for generating MVPs, SaaS platforms, and Landing Pages in seconds.'}
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="p-2 bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400 rounded-xl shrink-0">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider">
                      {lang === 'GR' ? 'Κανάλια Συνεργασίας & Chat' : 'Collaboration Channels & Chat'}
                    </h4>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed mt-0.5">
                      {lang === 'GR'
                        ? 'Συζητήστε με άλλα μέλη, ανταλλάξτε ιδέες για νέα SaaS προϊόντα και βρείτε συνεργάτες για τα project σας.'
                        : 'Chat with other members, exchange ideas for new SaaS products, and find co-founders or collaborators.'}
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="p-2 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-xl shrink-0">
                    <Flame className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider">
                      {lang === 'GR' ? 'Εβδομαδιαία Hackathons' : 'Weekly Hackathons'}
                    </h4>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed mt-0.5">
                      {lang === 'GR'
                        ? 'Λάβετε μέρος σε εβδομαδιαίους διαγωνισμούς γρήγορης ανάπτυξης εφαρμογών (Vibe Builds) και κερδίστε έπαθλα.'
                        : 'Take part in weekly rapid build challenges (Vibe Builds) and earn rewards and community recognition.'}
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="p-2 bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 rounded-xl shrink-0">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider">
                      {lang === 'GR' ? 'Live Mentorship Sessions' : 'Live Mentorship Sessions'}
                    </h4>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed mt-0.5">
                      {lang === 'GR'
                        ? 'Συμμετάσχετε σε ζωντανές συναντήσεις καθοδήγησης από έμπειρους Vibe Coders και AI Engineers της αγοράς.'
                        : 'Join live Q&A and tutoring sessions led by seasoned Vibe Coders and industry-leading AI Engineers.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 bg-gray-50 dark:bg-gray-900/40 border-t border-gray-150 dark:border-gray-800 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowCommunityModal(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                {lang === 'GR' ? 'Κλείσιμο' : 'Close'}
              </button>
              <button
                type="button"
                onClick={() => {
                  alert(lang === 'GR' ? 'Σύντομα διαθέσιμο! Η πλατφόρμα κοινότητας ετοιμάζεται.' : 'Coming soon! The community portal is being finalized.');
                  setShowCommunityModal(false);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
              >
                {lang === 'GR' ? 'Εγγραφή στη Λίστα Αναμονής' : 'Join Waitlist'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Newsletter Success and Premium Choices Modal */}
      {showNewsletterSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#1a1a17] border border-gray-200 dark:border-gray-800 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden transform transition-all duration-300">
            {/* Header with success motif */}
            <div className="p-6 border-b border-gray-150 dark:border-gray-800 bg-gradient-to-r from-emerald-600/10 via-amber-500/10 to-transparent flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <CheckCircle className="w-5.5 h-5.5 text-emerald-600 dark:text-emerald-400 animate-bounce" />
                <h3 className="font-serif font-black text-lg text-gray-900 dark:text-white uppercase tracking-tight">
                  {lang === 'GR' ? 'Η ΕΓΓΡΑΦΗ ΕΓΙΝΕ ΜΕ ΕΠΙΤΥΧΙΑ!' : 'SUBSCRIPTION SUCCESSFUL!'}
                </h3>
              </div>
              <button
                onClick={() => setShowNewsletterSuccessModal(false)}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-lg transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content body */}
            <div className="p-6 space-y-5">
              <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-100/50 dark:border-emerald-950/30 rounded-2xl space-y-1">
                <p className="text-sm font-bold text-emerald-800 dark:text-emerald-400">
                  {lang === 'GR' ? '✓ Η εγγραφή σας ολοκληρώθηκε επιτυχώς!' : '✓ Registration completed successfully!'}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed font-semibold">
                  {lang === 'GR' 
                    ? 'Παρακαλώ ελέγξτε το Inbox σας (ή τον φάκελο ανεπιθύμητων/spam αν χρειαστεί) για να κάνετε επιβεβαίωση της εγγραφής σας.'
                    : 'Please check your Inbox (or spam folder if necessary) to confirm your registration.'}
                </p>
              </div>

              {/* Premium choices container */}
              <div className="space-y-3.5">
                <h4 className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-amber-500" />
                  <span>{lang === 'GR' ? 'ΔΕΙΤΕ ΤΙΣ PREMIUM ΕΠΙΛΟΓΕΣ ΣΑΣ' : 'DISCOVER YOUR PREMIUM PRIVILEGES'}</span>
                </h4>

                <div className="space-y-3">
                  {/* Benefit 1 */}
                  <div className="p-3.5 bg-gray-50 dark:bg-[#22221e]/50 border border-gray-150 dark:border-gray-800 rounded-2xl flex items-start gap-3">
                    <div className="p-2 bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 rounded-xl">
                      <Cpu className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <h5 className="text-xs font-black text-gray-900 dark:text-white">
                        {lang === 'GR' ? 'AI Agent Custom Web Search' : 'AI Agent Custom Web Search'}
                      </h5>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                        {lang === 'GR' 
                          ? 'Ρωτήστε τον AI πράκτορα να ψάξει τον ιστό σε πραγματικό χρόνο για οποιοδήποτε θέμα προγραμματισμού.'
                          : 'Ask the AI agent to search the live web in real-time for any coding topic.'}
                      </p>
                    </div>
                  </div>

                  {/* Benefit 2 */}
                  <div className="p-3.5 bg-gray-50 dark:bg-[#22221e]/50 border border-gray-150 dark:border-gray-800 rounded-2xl flex items-start gap-3">
                    <div className="p-2 bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 rounded-xl">
                      <Compass className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <h5 className="text-xs font-black text-gray-900 dark:text-white">
                        {lang === 'GR' ? 'Vibe Coding Crash Course' : 'Vibe Coding Crash Course'}
                      </h5>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                        {lang === 'GR' 
                          ? 'Μάθετε πώς να δημιουργείτε εφαρμογές καθοδηγώντας AI agents σε 4 απλά διαδραστικά μαθήματα.'
                          : 'Learn how to build apps by directing AI agents in 4 simple interactive lessons.'}
                      </p>
                    </div>
                  </div>

                  {/* Benefit 3 */}
                  <div className="p-3.5 bg-gray-50 dark:bg-[#22221e]/50 border border-gray-150 dark:border-gray-800 rounded-2xl flex items-start gap-3">
                    <div className="p-2 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded-xl">
                      <FileText className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <h5 className="text-xs font-black text-gray-900 dark:text-white">
                        {lang === 'GR' ? 'Ebooks & PDFs Λήψεις' : 'Ebooks & PDF Downloads'}
                      </h5>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                        {lang === 'GR' 
                          ? 'Κατεβάστε οδηγούς, cheat sheets και υλικό σε PDF.'
                          : 'Download cheatsheets, study guides, and curated PDF docs.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer with scrolling and dismiss actions */}
            <div className="p-6 bg-gray-50 dark:bg-gray-900/40 border-t border-gray-150 dark:border-gray-800 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowNewsletterSuccessModal(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                {lang === 'GR' ? 'Κλείσιμο' : 'Close'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNewsletterSuccessModal(false);
                  setTimeout(() => {
                    document.getElementById('premium-services-section')?.scrollIntoView({ behavior: 'smooth' });
                  }, 100);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1"
              >
                <span>{lang === 'GR' ? 'Δοκιμή Premium Υπηρεσιών' : 'Try Premium Services'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* First-Time Welcome Theme & Font Onboarding Modal */}
      <FirstTimeWelcomeModal
        isOpen={showWelcomeModal}
        onClose={() => setShowWelcomeModal(false)}
        lang={lang}
        activePalette={activePalette}
        setActivePalette={(pId) => {
          setActivePalette(pId);
          localStorage.setItem('vibe_palette', pId);
        }}
        activeFont={activeFont}
        setActiveFont={(fId) => {
          setActiveFont(fId);
          localStorage.setItem('vibe_font', fId);
        }}
        setIsDarkMode={setIsDarkMode}
      />

      {/* Appearance Personalization Modal */}
      <PersonalizationModal
        isOpen={showPersonalizationModal}
        onClose={() => setShowPersonalizationModal(false)}
        lang={lang}
        onLanguageChange={handleLanguageChange}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
        activePalette={activePalette}
        setActivePalette={setActivePalette}
        activeFont={activeFont}
        setActiveFont={(fId) => {
          setActiveFont(fId);
          localStorage.setItem('vibe_font', fId);
        }}
        palettesList={palettesList}
        currentPalette={currentPalette}
        isMinimalistLayout={isMinimalistLayout}
        setIsMinimalistLayout={setIsMinimalistLayout}
        bookmarks={bookmarks}
        bookmarksMeta={bookmarksMeta}
        articles={articles}
        onToggleBookmark={handleToggleBookmark}
        onUpdateBookmarkPriority={handleUpdateBookmarkPriority}
        onUpdateBookmarkTag={handleUpdateBookmarkTag}
        onRemoveBookmarkTag={handleRemoveBookmarkTag}
        onSelectArticle={(id) => {
          setSelectedArticleId(id);
          setActiveView('article');
        }}
      />

      {/* Market Notifications Modal */}
      <MarketNotificationsModal
        isOpen={showMarketNotifsModal}
        onClose={() => setShowMarketNotifsModal(false)}
        lang={lang}
        isDarkMode={isDarkMode}
      />

      {/* Disclaimer Modal */}
      {showDisclaimerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-white dark:bg-[#1a1a17] border border-gray-200 dark:border-gray-800 rounded-3xl p-6 md:p-8 shadow-2xl relative space-y-6 animate-fade-in max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowDisclaimerModal(false)}
              className="absolute top-5 right-5 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-400 hover:text-gray-900 dark:hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-gray-150 dark:border-gray-800 pb-4">
              <div className="p-3 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-2xl">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  {lang === 'GR' ? 'ΕΓΚΥΡΟΤΗΤΑ & ΠΟΙΟΤΗΤΑ' : 'VALIDITY & QUALITY'}
                </span>
                <h3 className="text-xl md:text-2xl font-serif font-black text-gray-900 dark:text-white">
                  {getTranslation('disclaimerTitle', lang)}
                </h3>
              </div>
            </div>

            <div className="space-y-4 text-xs md:text-sm text-gray-700 dark:text-gray-300 leading-relaxed font-normal">
              <p className="p-4 bg-amber-500/5 border border-amber-500/15 rounded-2xl text-amber-900 dark:text-amber-200 font-medium">
                {getTranslation('disclaimerText', lang)}
              </p>
            </div>

            <div className="pt-4 border-t border-gray-150 dark:border-gray-800 flex justify-end">
              <button
                onClick={() => setShowDisclaimerModal(false)}
                className="px-6 py-2.5 bg-gray-900 hover:bg-amber-600 dark:bg-white dark:text-gray-900 dark:hover:bg-amber-500 dark:hover:text-white text-white font-bold text-xs rounded-xl transition-all shadow-md cursor-pointer"
              >
                {lang === 'GR' ? 'Κατανόηση & Κλείσιμο' : 'I Understand'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
