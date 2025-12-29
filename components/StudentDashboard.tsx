
import React, { useState, useEffect } from 'react';
import { User, Subject, StudentTab, SystemSettings, CreditPackage, WeeklyTest, Chapter } from '../types';
import { updateUserStatus, db, saveUserToLive, getChapterData } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { getSubjectsList } from '../constants';
import { RedeemSection } from './RedeemSection';
import { Store } from './Store';
import { Zap, Crown, Calendar, Clock, History, Layout, Gift, Sparkles, Megaphone, Lock, BookOpen, AlertCircle, Edit, Settings, Play, Pause, RotateCcw, MessageCircle, Gamepad2, Timer, CreditCard, Send, CheckCircle, Mail, X, Ban, Smartphone, Trophy, ShoppingBag, ArrowRight, Video, Youtube, Home, User as UserIcon, Book } from 'lucide-react';
import { SubjectSelection } from './SubjectSelection';
import { ChapterSelection } from './ChapterSelection'; // Imported for Video Flow
import { VideoPlaylistView } from './VideoPlaylistView'; // Imported for Video Flow
import { PdfView } from './PdfView'; // Imported for PDF Flow
import { McqView } from './McqView'; // Imported for MCQ Flow
import { HistoryPage } from './HistoryPage';
import { UniversalChat } from './UniversalChat';
import { Leaderboard } from './Leaderboard';
import { SpinWheel } from './SpinWheel';
import { RoutinePage } from './RoutinePage'; // V22 Routine
import { fetchChapters } from '../services/gemini'; // Needed for Video Flow
import { FileText, CheckSquare } from 'lucide-react'; // Icons
import { LoadingOverlay } from './LoadingOverlay';
import { CreditConfirmationModal } from './CreditConfirmationModal';
import { UserGuide } from './UserGuide';

interface Props {
  user: User;
  dailyStudySeconds: number; // Received from Global App
  onSubjectSelect: (subject: Subject) => void;
  onRedeemSuccess: (user: User) => void;
  settings?: SystemSettings; // New prop
  onStartWeeklyTest?: (test: WeeklyTest) => void;
  activeTab: StudentTab;
  onTabChange: (tab: StudentTab) => void;
  setFullScreen: (full: boolean) => void; // Passed from App
  onNavigate?: (view: 'ADMIN_DASHBOARD') => void; // Added for Admin Switch
}

const DEFAULT_PACKAGES: CreditPackage[] = [
    { id: 'pkg-1', name: 'Starter Pack', price: 100, credits: 150 },
    { id: 'pkg-2', name: 'Value Pack', price: 200, credits: 350 },
    { id: 'pkg-3', name: 'Pro Pack', price: 500, credits: 1500 },
    { id: 'pkg-4', name: 'Ultra Pack', price: 1000, credits: 3000 },
    { id: 'pkg-5', name: 'Mega Pack', price: 2000, credits: 7000 },
    { id: 'pkg-6', name: 'Giga Pack', price: 3000, credits: 12000 },
    { id: 'pkg-7', name: 'Ultimate Pack', price: 5000, credits: 20000 }
];

export const StudentDashboard: React.FC<Props> = ({ user, dailyStudySeconds, onSubjectSelect, onRedeemSuccess, settings, onStartWeeklyTest, activeTab, onTabChange, setFullScreen, onNavigate }) => {
  // const [activeTab, setActiveTab] = useState<StudentTab>('VIDEO'); // REMOVED LOCAL STATE
  const [testAttempts, setTestAttempts] = useState<Record<string, any>>(JSON.parse(localStorage.getItem(`nst_test_attempts_${user.id}`) || '{}'));
  const globalMessage = localStorage.getItem('nst_global_message');
  const [activeExternalApp, setActiveExternalApp] = useState<string | null>(null);
  const [pendingApp, setPendingApp] = useState<{app: any, cost: number} | null>(null);
  
  // GENERIC CONTENT FLOW STATE (Used for Video, PDF, MCQ)
  const [contentViewStep, setContentViewStep] = useState<'SUBJECTS' | 'CHAPTERS' | 'PLAYER'>('SUBJECTS');
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loadingChapters, setLoadingChapters] = useState(false);
  
  // LOADING STATE FOR 10S RULE
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [isDataReady, setIsDataReady] = useState(false);

  const [editMode, setEditMode] = useState(false);
  const [profileData, setProfileData] = useState({
      classLevel: user.classLevel || '10',
      board: user.board || 'CBSE',
      stream: user.stream || 'Science',
      newPassword: '',
      dailyGoalHours: 3 // Default
  });

  const [canClaimReward, setCanClaimReward] = useState(false);
  const [selectedPhoneId, setSelectedPhoneId] = useState<string>('');
  const [showUserGuide, setShowUserGuide] = useState(false);
  
  // Custom Daily Target Logic
  const [dailyTargetSeconds, setDailyTargetSeconds] = useState(3 * 3600);
  const REWARD_AMOUNT = settings?.dailyReward || 3;
  
  // Phone setup
  const adminPhones = settings?.adminPhones || [{id: 'default', number: '8227070298', name: 'Admin'}];
  const defaultPhoneId = adminPhones.find(p => p.isDefault)?.id || adminPhones[0]?.id || 'default';
  
  if (!selectedPhoneId && adminPhones.length > 0) {
    setSelectedPhoneId(defaultPhoneId);
  }

  // --- HERO SLIDER STATE ---
  const [currentSlide, setCurrentSlide] = useState(0);
  const slides = [
      { id: 1, title: "Ultra Subscription", subtitle: "Unlimited Access to Videos & PDFs", color: "from-purple-600 to-blue-600" },
      { id: 2, title: "Ace Your Exams", subtitle: "Practice with 1000+ MCQs", color: "from-orange-500 to-red-600" },
      { id: 3, title: "Live Support", subtitle: "Chat directly with experts", color: "from-emerald-500 to-teal-600" }
  ];

  useEffect(() => {
      const timer = setInterval(() => {
          setCurrentSlide((prev) => (prev + 1) % slides.length);
      }, 4000);
      return () => clearInterval(timer);
  }, []);

  // --- ADMIN SWITCH HANDLER ---
  const handleSwitchToAdmin = () => {
    if (onNavigate) {
       onNavigate('ADMIN_DASHBOARD');
    }
  };
  
  const getPhoneNumber = (phoneId?: string) => {
    const phone = adminPhones.find(p => p.id === (phoneId || selectedPhoneId));
    return phone ? phone.number : '8227070298';
  };

  useEffect(() => {
      // Load user's custom goal
      const storedGoal = localStorage.getItem(`nst_goal_${user.id}`);
      if (storedGoal) {
          const hours = parseInt(storedGoal);
          setDailyTargetSeconds(hours * 3600);
          setProfileData(prev => ({...prev, dailyGoalHours: hours}));
      }
  }, [user.id]);

  // ... (Existing Reward Logic - Keep as is) ...
  // --- CHECK YESTERDAY'S REWARD ON LOAD ---
  useEffect(() => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yDateStr = yesterday.toDateString();
      
      const yActivity = parseInt(localStorage.getItem(`activity_${user.id}_${yDateStr}`) || '0');
      const yClaimed = localStorage.getItem(`reward_claimed_${user.id}_${yDateStr}`);
      
      if (!yClaimed && (!user.subscriptionTier || user.subscriptionTier === 'FREE')) {
          let reward = null;
          if (yActivity >= 10800) reward = { tier: 'MONTHLY', level: 'ULTRA', hours: 4 }; // 3 Hrs -> Ultra
          else if (yActivity >= 3600) reward = { tier: 'WEEKLY', level: 'BASIC', hours: 4 }; // 1 Hr -> Basic

          if (reward) {
              const expiresAt = new Date(new Date().setHours(new Date().getHours() + 24)).toISOString();
              const newMsg = {
                  id: `reward-${Date.now()}`,
                  text: `🎁 Daily Reward! You studied enough yesterday. Claim your ${reward.hours} hours of ${reward.level} access now!`,
                  date: new Date().toISOString(),
                  read: false,
                  type: 'REWARD',
                  reward: { tier: reward.tier as any, level: reward.level as any, durationHours: reward.hours },
                  expiresAt: expiresAt,
                  isClaimed: false
              };
              
              const updatedUser = { 
                  ...user, 
                  inbox: [newMsg, ...(user.inbox || [])] 
              };
              
              handleUserUpdate(updatedUser);
              localStorage.setItem(`reward_claimed_${user.id}_${yDateStr}`, 'true');
          }
      }
  }, [user.id]);

  const claimRewardMessage = (msgId: string, reward: any) => {
      const duration = reward.durationHours || 4;
      const endDate = new Date(Date.now() + duration * 60 * 60 * 1000).toISOString();
      
      const updatedInbox = user.inbox?.map(m => m.id === msgId ? { ...m, isClaimed: true, read: true } : m);
      
      const updatedUser: User = { 
          ...user, 
          subscriptionTier: reward.tier, 
          subscriptionLevel: reward.level,
          subscriptionEndDate: endDate,
          isPremium: true,
          inbox: updatedInbox
      };
      
      handleUserUpdate(updatedUser);
      alert(`✅ Reward Claimed! Enjoy ${duration} hours of ${reward.level} access.`);
  };

  // --- TRACK TODAY'S ACTIVITY & FIRST DAY BONUSES ---
  useEffect(() => {
    if (!user.id) return;
    const unsub = onSnapshot(doc(db, "users", user.id), (doc) => {
        if (doc.exists()) {
            const cloudData = doc.data() as User;
            if (cloudData.credits !== user.credits || 
                cloudData.subscriptionTier !== user.subscriptionTier ||
                cloudData.isPremium !== user.isPremium ||
                cloudData.isGameBanned !== user.isGameBanned) {
                const updated = { ...user, ...cloudData };
                onRedeemSuccess(updated); 
            }
        }
    });
    return () => unsub();
  }, [user.id]); 

  useEffect(() => {
      const interval = setInterval(() => {
          updateUserStatus(user.id, dailyStudySeconds);
          const todayStr = new Date().toDateString();
          localStorage.setItem(`activity_${user.id}_${todayStr}`, dailyStudySeconds.toString());
          
          const accountAgeHours = (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60);
          const firstDayBonusClaimed = localStorage.getItem(`first_day_ultra_${user.id}`);
          
          if (accountAgeHours < 24 && dailyStudySeconds >= 3600 && !firstDayBonusClaimed) {
              const endDate = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 Hour
              const updatedUser = { 
                  ...user, 
                  subscriptionTier: 'MONTHLY', // Ultra
                  subscriptionEndDate: endDate,
                  isPremium: true
              };
              const storedUsers = JSON.parse(localStorage.getItem('nst_users') || '[]');
              const idx = storedUsers.findIndex((u:User) => u.id === user.id);
              if (idx !== -1) storedUsers[idx] = updatedUser;
              
              localStorage.setItem('nst_users', JSON.stringify(storedUsers));
              localStorage.setItem('nst_current_user', JSON.stringify(updatedUser));
              localStorage.setItem(`first_day_ultra_${user.id}`, 'true');
              
              onRedeemSuccess(updatedUser);
              alert("🎉 FIRST DAY BONUS: You unlocked 1 Hour Free ULTRA Subscription!");
          }
          
      }, 60000); 
      return () => clearInterval(interval);
  }, [dailyStudySeconds, user.id, user.createdAt]);

  // Inbox
  const [showInbox, setShowInbox] = useState(false);
  const unreadCount = user.inbox?.filter(m => !m.read).length || 0;

  useEffect(() => {
    const today = new Date().toDateString();
    const lastClaim = user.lastRewardClaimDate ? new Date(user.lastRewardClaimDate).toDateString() : '';
    setCanClaimReward(lastClaim !== today && dailyStudySeconds >= dailyTargetSeconds);
  }, [user.lastRewardClaimDate, dailyStudySeconds, dailyTargetSeconds]);

  const claimDailyReward = () => {
      if (!canClaimReward) return;
      const updatedUser = {
          ...user,
          credits: (user.credits || 0) + REWARD_AMOUNT,
          lastRewardClaimDate: new Date().toISOString()
      };
      handleUserUpdate(updatedUser);
      setCanClaimReward(false);
      alert(`🎉 Congratulations! You met your Daily Goal.\n\nReceived: ${REWARD_AMOUNT} Free Credits!`);
  };

  const handleExternalAppClick = (app: any) => {
      if (app.isLocked) { alert("This app is currently locked by Admin."); return; }
      if (app.creditCost > 0) {
          if (user.credits < app.creditCost) { alert(`Insufficient Credits! You need ${app.creditCost} credits.`); return; }
          if (user.isAutoDeductEnabled) processAppAccess(app, app.creditCost);
          else setPendingApp({ app, cost: app.creditCost });
          return;
      }
      setActiveExternalApp(app.url);
  };

  const processAppAccess = (app: any, cost: number, enableAuto: boolean = false) => {
      let updatedUser = { ...user, credits: user.credits - cost };
      if (enableAuto) updatedUser.isAutoDeductEnabled = true;
      handleUserUpdate(updatedUser);
      setActiveExternalApp(app.url);
      setPendingApp(null);
  };

  const handleBuyPackage = (pkg: CreditPackage) => {
      const phoneNum = getPhoneNumber();
      const message = `Hello Admin, I want to buy credits.\n\n🆔 User ID: ${user.id}\n📦 Package: ${pkg.name}\n💰 Amount: ₹${pkg.price}\n💎 Credits: ${pkg.credits}\n\nPlease check my payment.`;
      const url = `https://wa.me/91${phoneNum}?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank');
  };

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const saveProfile = () => {
      const updatedUser = { 
          ...user, 
          board: profileData.board,
          classLevel: profileData.classLevel,
          stream: profileData.stream,
          password: profileData.newPassword.trim() ? profileData.newPassword : user.password
      };
      localStorage.setItem(`nst_goal_${user.id}`, profileData.dailyGoalHours.toString());
      setDailyTargetSeconds(profileData.dailyGoalHours * 3600);
      handleUserUpdate(updatedUser);
      window.location.reload(); 
      setEditMode(false);
  };
  
  const handleUserUpdate = (updatedUser: User) => {
      const storedUsers = JSON.parse(localStorage.getItem('nst_users') || '[]');
      const userIdx = storedUsers.findIndex((u:User) => u.id === updatedUser.id);
      if (userIdx !== -1) {
          storedUsers[userIdx] = updatedUser;
          localStorage.setItem('nst_users', JSON.stringify(storedUsers));
          localStorage.setItem('nst_current_user', JSON.stringify(updatedUser));
          saveUserToLive(updatedUser); 
          onRedeemSuccess(updatedUser); 
      }
  };

  const markInboxRead = () => {
      if (!user.inbox) return;
      const updatedInbox = user.inbox.map(m => ({ ...m, read: true }));
      handleUserUpdate({ ...user, inbox: updatedInbox });
  };

  // --- GENERIC CONTENT FLOW HANDLERS ---
  const handleContentSubjectSelect = async (subject: Subject) => {
      setSelectedSubject(subject);
      setLoadingChapters(true);
      setContentViewStep('CHAPTERS');
      try {
          const ch = await fetchChapters(user.board || 'CBSE', user.classLevel || '10', user.stream || 'Science', subject, 'English');
          setChapters(ch);
      } catch(e) { console.error(e); }
      setLoadingChapters(false);
  };

  const handleContentChapterSelect = (chapter: Chapter) => {
      setSelectedChapter(chapter);
      setContentViewStep('PLAYER');
      setFullScreen(true); 
  };

  const onLoadingComplete = () => {
      setIsLoadingContent(false);
      setContentViewStep('PLAYER');
      setFullScreen(true);
  };

  // GENERIC CONTENT SECTION RENDERER
  const renderContentSection = (type: 'VIDEO' | 'PDF' | 'MCQ') => {
      const handlePlayerBack = () => {
          setContentViewStep('CHAPTERS');
          setFullScreen(false);
      };

      if (contentViewStep === 'PLAYER' && selectedChapter && selectedSubject) {
          if (type === 'VIDEO') {
            return <VideoPlaylistView chapter={selectedChapter} subject={selectedSubject} user={user} board={user.board || 'CBSE'} classLevel={user.classLevel || '10'} stream={user.stream || null} onBack={handlePlayerBack} onUpdateUser={handleUserUpdate} settings={settings} />;
          } else if (type === 'PDF') {
            return <PdfView chapter={selectedChapter} subject={selectedSubject} user={user} board={user.board || 'CBSE'} classLevel={user.classLevel || '10'} stream={user.stream || null} onBack={handlePlayerBack} onUpdateUser={handleUserUpdate} settings={settings} />;
          } else {
            return <McqView chapter={selectedChapter} subject={selectedSubject} user={user} board={user.board || 'CBSE'} classLevel={user.classLevel || '10'} stream={user.stream || null} onBack={handlePlayerBack} onUpdateUser={handleUserUpdate} settings={settings} />;
          }
      }

      if (contentViewStep === 'CHAPTERS' && selectedSubject) {
          return (
              <ChapterSelection 
                  chapters={chapters} 
                  subject={selectedSubject} 
                  classLevel={user.classLevel || '10'} 
                  loading={loadingChapters} 
                  user={user} 
                  onSelect={handleContentChapterSelect} 
                  onBack={() => { setContentViewStep('SUBJECTS'); onTabChange('COURSES'); }} 
              />
          );
      }

      // Subject List (Default View for Content Tabs)
      // NOTE: This part is technically not used if 'COURSES' tab handles the entry
      // But keeping it as fallback if we navigate directly.
      return null; 
  };

  const isGameEnabled = settings?.isGameEnabled ?? true;

  // --- RENDER BASED ON ACTIVE TAB ---
  const renderMainContent = () => {
      // 1. HOME TAB
      if (activeTab === 'HOME') { 
          return (
              <div className="space-y-6 pb-24">
                  {/* HERO SLIDER */}
                  <div className="relative h-40 rounded-2xl overflow-hidden shadow-lg mx-1">
                      {slides.map((slide, index) => (
                          <div 
                              key={slide.id}
                              className={`absolute inset-0 bg-gradient-to-r ${slide.color} flex items-center p-6 transition-opacity duration-1000 ${index === currentSlide ? 'opacity-100' : 'opacity-0'}`}
                          >
                              <div className="text-white">
                                  <div className="inline-block px-2 py-1 bg-white/20 rounded text-[10px] font-bold mb-2 backdrop-blur-sm">FEATURED</div>
                                  <h2 className="text-2xl font-black mb-1">{slide.title}</h2>
                                  <p className="text-sm opacity-90">{slide.subtitle}</p>
                              </div>
                          </div>
                      ))}
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1">
                          {slides.map((_, i) => (
                              <div key={i} className={`h-1.5 rounded-full transition-all ${i === currentSlide ? 'w-6 bg-white' : 'w-1.5 bg-white/50'}`}></div>
                          ))}
                      </div>
                  </div>

                  {/* STATS HEADER */}
                  <div className="bg-slate-900 rounded-2xl p-4 text-white shadow-xl relative overflow-hidden">
                      <div className="flex items-center justify-between relative z-10">
                          <div>
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-2">
                                  <Timer size={12} /> Study Timer
                              </div>
                              <div className="text-2xl font-mono font-bold tracking-wider text-green-400">
                                  {formatTime(dailyStudySeconds)}
                              </div>
                          </div>
                          <div className="text-right">
                              <p className="text-[10px] text-slate-400 font-bold uppercase">Credits</p>
                              <div className="flex items-center justify-end gap-1">
                                  <Crown size={16} className="text-yellow-400" />
                                  <span className="text-xl font-black text-blue-400">{user.credits}</span>
                              </div>
                          </div>
                      </div>
                  </div>

                  {/* CONTENT REQUEST (DEMAND) SECTION */}
                  <div className="bg-gradient-to-r from-pink-50 to-rose-50 p-4 rounded-2xl border border-pink-100 shadow-sm mt-4">
                      <h3 className="font-bold text-pink-900 mb-2 flex items-center gap-2">
                          <Megaphone size={18} className="text-pink-600" /> Request Content
                      </h3>
                      <p className="text-xs text-slate-600 mb-4">Don't see what you need? Request it here!</p>
                      
                      <button 
                          onClick={() => {
                              // PRE-FILL FROM CURRENT SELECTIONS IF AVAILABLE (Better UX)
                              const board = user.board || 'CBSE';
                              const cls = user.classLevel || '10';
                              
                              // Use dropdowns instead of raw prompts for better experience
                              // Since we are inside a button click handler, we can't render JSX easily without a Modal state.
                              // Implementing a simple prompt sequence for now, but with options listed.
                              
                              const subName = prompt(`Enter Subject Name:\n(e.g., Math, Physics, Chemistry, English)\n\nCurrent Class: ${cls}`, "Math");
                              if (!subName) return;
                              
                              const chName = prompt("Enter Chapter Name or Topic:");
                              if (!chName) return;
                              
                              const typeInput = prompt("What content do you need?\n1. PDF Notes\n2. MCQ Test\n3. Video Lecture\n\nEnter 1, 2, or 3:", "1");
                              if (!typeInput) return;
                              
                              let type = 'PDF';
                              if (typeInput === '2' || typeInput.toLowerCase().includes('mcq')) type = 'MCQ';
                              else if (typeInput === '3' || typeInput.toLowerCase().includes('video')) type = 'VIDEO';

                              const request = {
                                  id: `req-${Date.now()}`,
                                  userId: user.id,
                                  userName: user.name,
                                  details: `${cls} ${board} - ${subName} - ${chName} - ${type}`,
                                  timestamp: new Date().toISOString()
                              };

                              // Save to Local Storage (Simulated Cloud Push)
                              const existing = JSON.parse(localStorage.getItem('nst_demand_requests') || '[]');
                              existing.push(request);
                              localStorage.setItem('nst_demand_requests', JSON.stringify(existing));
                              
                              // Push to Firebase
                              // Note: In a real app we'd use 'saveDemand' function, but here we simulate via LocalStorage sync or direct DB push if needed.
                              // Since AdminDashboard reads from 'nst_demand_requests' or Firebase, this works for now.
                              
                              alert("✅ Request Sent! Admin will check it.");
                          }}
                          className="w-full bg-white text-pink-600 font-bold py-3 rounded-xl shadow-sm border border-pink-200 hover:bg-pink-100 transition-colors flex items-center justify-center gap-2 text-sm"
                      >
                          + Make a Request
                      </button>
                  </div>

                  {/* MORE SERVICES GRID (2x4) */}
                  <div>
                      <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2 px-1">
                          <Layout size={18} /> More Services
                      </h3>
                      <div className="grid grid-cols-4 gap-3">
                          <button onClick={() => onTabChange('HISTORY')} className="aspect-square bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center gap-1 hover:bg-slate-50 transition-all">
                              <History size={20} className="text-blue-500" />
                              <span className="text-[10px] font-bold text-slate-600">History</span>
                          </button>
                          {isGameEnabled && (
                              <button onClick={() => onTabChange('GAME')} className="aspect-square bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center gap-1 hover:bg-slate-50 transition-all">
                                  <Gamepad2 size={20} className="text-orange-500" />
                                  <span className="text-[10px] font-bold text-slate-600">Game</span>
                              </button>
                          )}
                          <button onClick={() => onTabChange('REDEEM')} className="aspect-square bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center gap-1 hover:bg-slate-50 transition-all">
                              <Gift size={20} className="text-purple-500" />
                              <span className="text-[10px] font-bold text-slate-600">Redeem</span>
                          </button>
                          <button onClick={() => onTabChange('CHAT')} className="aspect-square bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center gap-1 hover:bg-slate-50 transition-all">
                              <MessageCircle size={20} className="text-green-500" />
                              <span className="text-[10px] font-bold text-slate-600">Support</span>
                          </button>
                          
                          {/* EXTERNAL APPS */}
                          {settings?.externalApps?.slice(0,4).map((app) => (
                              <button 
                                  key={app.id} 
                                  onClick={() => handleExternalAppClick(app)}
                                  className="aspect-square bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center gap-1 hover:bg-slate-50 transition-all"
                              >
                                  {app.isLocked ? <Lock size={20} className="text-slate-400" /> : <Zap size={20} className="text-yellow-500" />}
                                  <span className="text-[10px] font-bold text-slate-600 truncate w-full text-center px-1">{app.name}</span>
                              </button>
                          ))}
                      </div>
                  </div>
              </div>
          );
      }

      // 2. COURSES TAB (Handles Video, Notes, MCQ Selection)
      if (activeTab === 'COURSES') {
          // If viewing a specific content type (from drilled down), show it
          // Note: Clicking a subject switches tab to VIDEO/PDF/MCQ, so COURSES just shows the Hub.
          return (
              <div className="space-y-6 pb-24">
                      <div className="flex items-center justify-between">
                          <h2 className="text-2xl font-black text-slate-800">My Study Hub</h2>
                          <button onClick={() => onTabChange('LEADERBOARD')} className="bg-yellow-100 text-yellow-700 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 hover:bg-yellow-200 transition">
                              <Trophy size={14} /> Rank List
                          </button>
                      </div>
                      
                      {/* Video Section */}
                      <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
                          <h3 className="font-bold text-red-800 flex items-center gap-2 mb-2"><Youtube /> Video Lectures</h3>
                          <div className="grid grid-cols-2 gap-2">
                              {getSubjectsList(user.classLevel || '10', user.stream || null).map(s => (
                                  <button key={s.id} onClick={() => { onTabChange('VIDEO'); handleContentSubjectSelect(s); }} className="bg-white p-2 rounded-xl text-xs font-bold text-slate-700 shadow-sm border border-red-100 text-left">
                                      {s.name}
                                  </button>
                              ))}
                          </div>
                      </div>

                      {/* Notes Section */}
                      <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                          <h3 className="font-bold text-blue-800 flex items-center gap-2 mb-2"><FileText /> Notes Library</h3>
                          <div className="grid grid-cols-2 gap-2">
                              {getSubjectsList(user.classLevel || '10', user.stream || null).map(s => (
                                  <button key={s.id} onClick={() => { onTabChange('PDF'); handleContentSubjectSelect(s); }} className="bg-white p-2 rounded-xl text-xs font-bold text-slate-700 shadow-sm border border-blue-100 text-left">
                                      {s.name}
                                  </button>
                              ))}
                          </div>
                      </div>

                      {/* MCQ Section */}
                      <div className="bg-purple-50 p-4 rounded-2xl border border-purple-100">
                          <h3 className="font-bold text-purple-800 flex items-center gap-2 mb-2"><CheckSquare /> MCQ Practice</h3>
                          <div className="grid grid-cols-2 gap-2">
                              {getSubjectsList(user.classLevel || '10', user.stream || null).map(s => (
                                  <button key={s.id} onClick={() => { onTabChange('MCQ'); handleContentSubjectSelect(s); }} className="bg-white p-2 rounded-xl text-xs font-bold text-slate-700 shadow-sm border border-purple-100 text-left">
                                      {s.name}
                                  </button>
                              ))}
                          </div>
                      </div>
                  </div>
              );
      }

      // 3. LEGACY TABS (Mapped to new structure or kept as sub-views)
      if (activeTab === 'ROUTINE') return <RoutinePage user={user} onUpdateUser={handleUserUpdate} />;
      if (activeTab === 'HISTORY') return <HistoryPage user={user} onUpdateUser={handleUserUpdate} settings={settings} />;
      if (activeTab === 'LEADERBOARD') return <Leaderboard />;
      if (activeTab === 'GAME') return isGameEnabled ? (user.isGameBanned ? <div className="text-center py-20 bg-red-50 rounded-2xl border border-red-100"><Ban size={48} className="mx-auto text-red-500 mb-4" /><h3 className="text-lg font-bold text-red-700">Access Denied</h3><p className="text-sm text-red-600">Admin has disabled the game for your account.</p></div> : <SpinWheel user={user} onUpdateUser={handleUserUpdate} settings={settings} />) : null;
      if (activeTab === 'REDEEM') return <div className="animate-in fade-in slide-in-from-bottom-2 duration-300"><RedeemSection user={user} onSuccess={onRedeemSuccess} /></div>;
      if (activeTab === 'CHAT') return <UniversalChat currentUser={user} onUserUpdate={handleUserUpdate} settings={settings} />;
      if (activeTab === 'STORE') return <Store user={user} settings={settings} onUserUpdate={handleUserUpdate} />;
      if (activeTab === 'PROFILE') return (
                <div className="animate-in fade-in zoom-in duration-300 pb-24">
                    <div className={`rounded-3xl p-8 text-center text-white mb-6 shadow-xl relative overflow-hidden ${
                        user.subscriptionLevel === 'ULTRA' && user.isPremium 
                        ? 'bg-gradient-to-br from-yellow-500 via-orange-500 to-red-600 shadow-orange-500/50' 
                        : user.subscriptionLevel === 'BASIC' && user.isPremium
                        ? 'bg-gradient-to-br from-blue-500 via-indigo-500 to-cyan-500 shadow-blue-500/50'
                        : 'bg-gradient-to-br from-slate-700 to-slate-900'
                    }`}>
                        {/* ANIMATED BACKGROUND FOR ULTRA */}
                        {user.subscriptionLevel === 'ULTRA' && user.isPremium && (
                            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30 animate-spin-slow"></div>
                        )}
                        
                        {/* ANIMATED BACKGROUND FOR BASIC */}
                        {user.subscriptionLevel === 'BASIC' && user.isPremium && (
                            <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent opacity-30 animate-pulse"></div>
                        )}

                        <div className={`w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-4 text-4xl font-black shadow-2xl relative z-10 ${
                            user.subscriptionLevel === 'ULTRA' && user.isPremium ? 'text-orange-600 ring-4 ring-yellow-300 animate-bounce-slow' : 
                            user.subscriptionLevel === 'BASIC' && user.isPremium ? 'text-blue-600 ring-4 ring-cyan-300' : 
                            'text-slate-800'
                        }`}>
                            {user.name.charAt(0)}
                            {user.subscriptionLevel === 'ULTRA' && user.isPremium && <div className="absolute -top-2 -right-2 text-2xl">👑</div>}
                        </div>
                        
                        <h2 className="text-3xl font-black relative z-10">{user.name}</h2>
                        <p className="text-white/80 text-sm font-mono relative z-10">ID: {user.id}</p>
                        
                        <div className="mt-4 relative z-10">
                            <span className={`px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest ${
                                user.subscriptionLevel === 'ULTRA' && user.isPremium ? 'bg-yellow-400 text-black' : 
                                user.subscriptionLevel === 'BASIC' && user.isPremium ? 'bg-cyan-400 text-black' : 'bg-slate-600 text-slate-300'
                            }`}>
                                {user.isPremium ? `${user.subscriptionLevel} Member` : 'Free User'}
                            </span>
                        </div>
                    </div>
                    
                    <div className="space-y-4">
                        <div className="bg-white rounded-xl p-4 border border-slate-200">
                            <p className="text-xs font-bold text-slate-500 uppercase mb-1">Class</p>
                            <p className="text-lg font-black text-slate-800">{user.classLevel} • {user.board} • {user.stream}</p>
                        </div>
                        
                        <div className="bg-white rounded-xl p-4 border border-slate-200">
                            <p className="text-xs font-bold text-slate-500 uppercase mb-1">Subscription</p>
                            <p className="text-lg font-black text-slate-800">{user.subscriptionTier || 'FREE'}</p>
                            {user.subscriptionEndDate && <p className="text-xs text-slate-500 mt-1">Expires: {new Date(user.subscriptionEndDate).toLocaleDateString()}</p>}
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                                <p className="text-xs font-bold text-blue-600 uppercase">Credits</p>
                                <p className="text-2xl font-black text-blue-600">{user.credits}</p>
                            </div>
                            <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
                                <p className="text-xs font-bold text-orange-600 uppercase">Streak</p>
                                <p className="text-2xl font-black text-orange-600">{user.streak} Days</p>
                            </div>
                        </div>
                        
                        <button onClick={() => setEditMode(true)} className="w-full bg-slate-800 text-white py-3 rounded-xl font-bold hover:bg-slate-900">✏️ Edit Profile</button>
                        <button onClick={() => {localStorage.removeItem(`nst_user_${user.id}`); window.location.reload();}} className="w-full bg-red-500 text-white py-3 rounded-xl font-bold hover:bg-red-600">🚪 Logout</button>
                    </div>
                </div>
      );

      // Handle Drill-Down Views (Video, PDF, MCQ)
      if (activeTab === 'VIDEO' || activeTab === 'PDF' || activeTab === 'MCQ') {
          return renderContentSection(activeTab);
      }

      return null;
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
        {/* ADMIN SWITCH BUTTON */}
        {user.role === 'ADMIN' && (
             <div className="fixed bottom-24 right-4 z-50">
                 <button 
                    onClick={handleSwitchToAdmin}
                    className="bg-slate-900 text-white p-4 rounded-full shadow-2xl border-2 border-slate-700 hover:scale-110 transition-transform flex items-center gap-2 animate-bounce-slow"
                 >
                     <Layout size={20} className="text-yellow-400" />
                     <span className="font-bold text-xs">Admin Panel</span>
                 </button>
             </div>
        )}

        {/* NOTIFICATION BAR (Only on Home) */}
        {activeTab === 'HOME' && settings?.noticeText && (
            <div className="bg-gradient-to-r from-slate-900 to-blue-900 text-white p-4 mb-6 rounded-b-2xl shadow-lg border-b border-slate-700 animate-in slide-in-from-top-4 relative mx-4 mt-2">
                <div className="flex items-start gap-3">
                    <Megaphone size={20} className="text-yellow-400 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Notice Board</p>
                        <p className="text-sm font-medium leading-relaxed">{settings.noticeText}</p>
                    </div>
                </div>
            </div>
        )}

        {/* MAIN CONTENT AREA */}
        <div className="p-4">
            {renderMainContent()}
            
            <div className="mt-8 mb-4 text-center">
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                    Developed by Nadim Anwar
                </p>
            </div>
        </div>

        {/* FIXED BOTTOM NAVIGATION */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-lg z-50 pb-safe">
            <div className="flex justify-around items-center h-16">
                <button onClick={() => { onTabChange('HOME'); setContentViewStep('SUBJECTS'); }} className={`flex flex-col items-center justify-center w-full h-full ${activeTab === 'HOME' || activeTab === 'VIDEO' ? 'text-blue-600' : 'text-slate-400'}`}>
                    <Home size={24} fill={activeTab === 'HOME' || activeTab === 'VIDEO' ? "currentColor" : "none"} />
                    <span className="text-[10px] font-bold mt-1">Home</span>
                </button>
                <button onClick={() => { onTabChange('COURSES'); setContentViewStep('SUBJECTS'); }} className={`flex flex-col items-center justify-center w-full h-full ${activeTab === 'COURSES' || activeTab === 'PDF' || activeTab === 'MCQ' ? 'text-blue-600' : 'text-slate-400'}`}>
                    <Book size={24} fill={activeTab === 'COURSES' || activeTab === 'PDF' || activeTab === 'MCQ' ? "currentColor" : "none"} />
                    <span className="text-[10px] font-bold mt-1">My Courses</span>
                </button>
                {settings?.isPaymentEnabled !== false && (
                    <button onClick={() => onTabChange('STORE')} className={`flex flex-col items-center justify-center w-full h-full ${activeTab === 'STORE' ? 'text-blue-600' : 'text-slate-400'}`}>
                        <ShoppingBag size={24} fill={activeTab === 'STORE' ? "currentColor" : "none"} />
                        <span className="text-[10px] font-bold mt-1">Store</span>
                    </button>
                )}
                <button onClick={() => onTabChange('PROFILE')} className={`flex flex-col items-center justify-center w-full h-full ${activeTab === 'PROFILE' ? 'text-blue-600' : 'text-slate-400'}`}>
                    <UserIcon size={24} fill={activeTab === 'PROFILE' ? "currentColor" : "none"} />
                    <span className="text-[10px] font-bold mt-1">Profile</span>
                </button>
            </div>
        </div>

        {/* MODALS */}
        {showUserGuide && <UserGuide onClose={() => setShowUserGuide(false)} />}
        {editMode && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
                <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
                    {/* ... (Edit Profile Content - duplicated code removed for brevity, should use component) ... */}
                    {/* Re-implementing simplified edit mode here as it was inside a helper function before */}
                    <h3 className="font-bold text-lg mb-4">Edit Profile & Settings</h3>
                    <div className="space-y-3 mb-6">
                        <div><label className="text-xs font-bold text-slate-500 uppercase">Daily Study Goal (Hours)</label><input type="number" value={profileData.dailyGoalHours} onChange={e => setProfileData({...profileData, dailyGoalHours: Number(e.target.value)})} className="w-full p-2 border rounded-lg" min={1} max={12}/></div>
                        <div className="h-px bg-slate-100 my-2"></div>
                        <div><label className="text-xs font-bold text-slate-500 uppercase">New Password</label><input type="text" placeholder="Set new password (optional)" value={profileData.newPassword} onChange={e => setProfileData({...profileData, newPassword: e.target.value})} className="w-full p-2 border rounded-lg bg-yellow-50 border-yellow-200"/><p className="text-[9px] text-slate-400 mt-1">Leave blank to keep current password.</p></div>
                        <div className="h-px bg-slate-100 my-2"></div>
                        <div><label className="text-xs font-bold text-slate-500 uppercase">Board</label><select value={profileData.board} onChange={e => setProfileData({...profileData, board: e.target.value as any})} className="w-full p-2 border rounded-lg"><option value="CBSE">CBSE</option><option value="BSEB">BSEB</option></select></div>
                        <div><label className="text-xs font-bold text-slate-500 uppercase">Class</label><select value={profileData.classLevel} onChange={e => setProfileData({...profileData, classLevel: e.target.value as any})} className="w-full p-2 border rounded-lg">{['6','7','8','9','10','11','12'].map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                        {['11','12'].includes(profileData.classLevel) && (<div><label className="text-xs font-bold text-slate-500 uppercase">Stream</label><select value={profileData.stream} onChange={e => setProfileData({...profileData, stream: e.target.value as any})} className="w-full p-2 border rounded-lg"><option value="Science">Science</option><option value="Commerce">Commerce</option><option value="Arts">Arts</option></select></div>)}
                    </div>
                    <div className="flex gap-2"><button onClick={() => setEditMode(false)} className="flex-1 py-2 text-slate-500 font-bold">Cancel</button><button onClick={saveProfile} className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-bold">Save Changes</button></div>
                </div>
            </div>
        )}
        
        {showInbox && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
                <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
                    <div className="bg-slate-50 p-4 border-b border-slate-100 flex justify-between items-center">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2"><Mail size={18} className="text-blue-600" /> Admin Messages</h3>
                        <button onClick={() => setShowInbox(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                    </div>
                    <div className="max-h-80 overflow-y-auto p-4 space-y-3">
                        {(!user.inbox || user.inbox.length === 0) && <p className="text-slate-400 text-sm text-center py-8">No messages.</p>}
                        {user.inbox?.map(msg => (
                            <div key={msg.id} className={`p-3 rounded-xl border text-sm ${msg.read ? 'bg-white border-slate-100' : 'bg-blue-50 border-blue-100'}`}>
                                <div className="flex justify-between items-start mb-2"><p className="font-bold text-slate-500">MESSAGE</p><p className="text-slate-400 text-[10px]">{new Date(msg.date).toLocaleDateString()}</p></div>
                                <p className="text-slate-700 leading-relaxed">{msg.text}</p>
                            </div>
                        ))}
                    </div>
                    {unreadCount > 0 && <button onClick={markInboxRead} className="w-full py-3 bg-blue-600 text-white font-bold text-sm hover:opacity-90">Mark All as Read</button>}
                </div>
            </div>
        )}

        {isLoadingContent && <LoadingOverlay dataReady={isDataReady} onComplete={onLoadingComplete} />}
        {activeExternalApp && <div className="fixed inset-0 z-50 bg-white flex flex-col"><div className="flex items-center justify-between p-4 border-b bg-slate-50"><button onClick={() => setActiveExternalApp(null)} className="p-2 bg-white rounded-full border shadow-sm"><X size={20} /></button><p className="font-bold text-slate-700">External App</p><div className="w-10"></div></div><iframe src={activeExternalApp} className="flex-1 w-full border-none" title="External App" allow="camera; microphone; geolocation; payment" /></div>}
        {pendingApp && <CreditConfirmationModal title={`Access ${pendingApp.app.name}`} cost={pendingApp.cost} userCredits={user.credits} isAutoEnabledInitial={!!user.isAutoDeductEnabled} onCancel={() => setPendingApp(null)} onConfirm={(auto) => processAppAccess(pendingApp.app, pendingApp.cost, auto)} />}
    </div>
  );
};
