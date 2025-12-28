
import React, { useState, useRef, useEffect } from 'react';
import { get, set, del } from 'idb-keyval';
import Header from './components/Header';
import PromptInput from './components/PromptInput';
import LoadingSpinner from './components/LoadingSpinner';
import Tooltip from './components/Tooltip';
import { LoadingState, Message, ImageState, Session } from './types';
import { editImageWithGemini, getDynamicSuggestions, ZixError } from './services/gemini';

const CURRENT_SESSION_KEY = 'zix_current_session';
const ALL_SESSIONS_KEY = 'zix_all_sessions';

const INITIAL_SUGGESTIONS = [
  "Cyberpunk Atmosphere",
  "Urban Noir Aesthetic",
  "Ethereal Glow",
  "Macro Nature Detail",
  "Vibrant Color Grade"
];

const App: React.FC = () => {
  const [loading, setLoading] = useState<LoadingState>(LoadingState.IDLE);
  const [view, setView] = useState<'studio' | 'history'>('studio');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showNamingModal, setShowNamingModal] = useState(false);
  const [pendingSessionName, setPendingSessionName] = useState('');
  const [allSessions, setAllSessions] = useState<Session[]>([]);
  const [statusText, setStatusText] = useState<{primary: string, secondary: string} | null>(null);
  const [activeSuggestions, setActiveSuggestions] = useState<string[]>(INITIAL_SUGGESTIONS);
  
  const [downloadFeedback, setDownloadFeedback] = useState(false);

  const [imageState, setImageState] = useState<ImageState>({
    originalUrl: null,
    currentUrl: null,
    history: [],
    currentIndex: -1
  });
  const [messages, setMessages] = useState<Message[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const current = await get(CURRENT_SESSION_KEY);
        if (current) {
          setImageState(current.imageState);
          setMessages(current.messages);
          if (current.imageState.currentUrl) {
            updateSuggestions(current.imageState.currentUrl);
          }
        }
        const history = await get(ALL_SESSIONS_KEY);
        if (history) setAllSessions(history);
      } catch (e) {
        console.error('zix: Load failed', e);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    const saveData = async () => {
      if (imageState.history.length > 0) {
        try {
          await set(CURRENT_SESSION_KEY, { imageState, messages });
        } catch (e) { console.error(e); }
      }
    };
    saveData();
  }, [imageState, messages]);

  const updateSuggestions = async (url: string) => {
    try {
      const suggestions = await getDynamicSuggestions(url);
      if (suggestions && suggestions.length > 0) {
        setActiveSuggestions(suggestions);
      } else {
        setActiveSuggestions(INITIAL_SUGGESTIONS);
      }
    } catch (e) {
      setActiveSuggestions(INITIAL_SUGGESTIONS);
    }
  };

  const archiveCurrentSession = async (name: string) => {
    if (imageState.history.length === 0 && messages.length === 0) return;
    
    const sessionName = name.trim() || `Visual Sequence ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;

    const newSession: Session = {
      id: Date.now().toString(),
      name: sessionName,
      timestamp: Date.now(),
      imageState: { ...imageState },
      messages: [...messages],
      previewUrl: imageState.currentUrl
    };

    try {
      const currentHistory = await get(ALL_SESSIONS_KEY) || [];
      const updatedHistory = [newSession, ...currentHistory].slice(0, 30);
      setAllSessions(updatedHistory);
      await set(ALL_SESSIONS_KEY, updatedHistory);
    } catch (e) {
      console.error("Failed to archive session:", e);
    }
  };

  const handleNewSessionRequest = () => {
    const hasActiveContent = imageState.currentUrl !== null || messages.length > 0;
    if (hasActiveContent) {
      setIsMenuOpen(false);
      setShowNamingModal(true);
      setPendingSessionName('');
    } else {
      resetStudio();
    }
  };

  const confirmNewSession = async () => {
    setShowNamingModal(false);
    try {
      await archiveCurrentSession(pendingSessionName);
      await del(CURRENT_SESSION_KEY);
      resetStudio();
      setStatusText({ primary: "Session Archived", secondary: `Sequence saved as "${pendingSessionName || 'Untitled'}"` });
      setTimeout(() => setStatusText(null), 3000);
    } catch (err) {
      console.error("Archive failure:", err);
    }
  };

  const resetStudio = () => {
    setLoading(LoadingState.IDLE);
    setImageState({
      originalUrl: null,
      currentUrl: null,
      history: [],
      currentIndex: -1
    });
    setMessages([]);
    setActiveSuggestions(INITIAL_SUGGESTIONS);
    setView('studio');
    setIsMenuOpen(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const loadSession = async (session: Session) => {
    if (imageState.history.length > 0) {
      await archiveCurrentSession("Quick Swap Backup");
    }
    setImageState(session.imageState);
    setMessages(session.messages);
    if (session.imageState.currentUrl) {
      updateSuggestions(session.imageState.currentUrl);
    }
    setView('studio');
    setIsMenuOpen(false);
  };

  const deleteSessionFromHistory = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = allSessions.filter(s => s.id !== id);
    setAllSessions(updated);
    await set(ALL_SESSIONS_KEY, updated);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setImageState({ originalUrl: result, currentUrl: result, history: [result], currentIndex: 0 });
      setStatusText({ primary: "Visual active", secondary: "System ready for instruction" });
      updateSuggestions(result);
      setTimeout(() => setStatusText(null), 3000);
    };
    reader.readAsDataURL(file);
  };

  const handleEdit = async (prompt: string) => {
    if (!imageState.currentUrl) return;
    
    setLoading(LoadingState.EDITING);
    setStatusText({ primary: "Processing", secondary: "Transforming visual layers..." });

    try {
      const { imageUrl, text } = await editImageWithGemini(imageState.currentUrl, prompt);
      
      setImageState(prev => {
        const newHistory = [...prev.history.slice(0, prev.currentIndex + 1), imageUrl];
        return { ...prev, currentUrl: imageUrl, history: newHistory, currentIndex: newHistory.length - 1 };
      });
      
      setMessages(prev => [...prev, { role: 'model', content: text || "Transformation complete.", imageUrl: imageUrl }]);
      setStatusText({ primary: "Success", secondary: "Visual refined" });
      updateSuggestions(imageUrl);
    } catch (error: any) {
      let primary = "Operation failed";
      let secondary = "An unexpected error occurred.";

      if (error instanceof ZixError) {
        primary = error.message;
        secondary = error.action || secondary;
        
        // Hide automatic popup for keys, move to status message
        if (error.code === 'AUTH') {
           primary = "Admin Action Required";
           secondary = "Double-click 'v4.7' in menu to set credentials.";
        }
      }
      setStatusText({ primary, secondary });
    } finally { 
      setLoading(LoadingState.IDLE); 
      setTimeout(() => setStatusText(null), 8000);
    }
  };

  const undo = () => {
    if (imageState.currentIndex > 0) {
      const newUrl = imageState.history[imageState.currentIndex - 1];
      setImageState(prev => ({
        ...prev,
        currentIndex: prev.currentIndex - 1,
        currentUrl: newUrl
      }));
      updateSuggestions(newUrl);
    }
  };

  const redo = () => {
    if (imageState.currentIndex < imageState.history.length - 1) {
      const newUrl = imageState.history[imageState.currentIndex + 1];
      setImageState(prev => ({
        ...prev,
        currentIndex: prev.currentIndex + 1,
        currentUrl: newUrl
      }));
      updateSuggestions(newUrl);
    }
  };

  const downloadImage = () => {
    if (!imageState.currentUrl || imageState.history.length <= 1) return;
    setDownloadFeedback(true);
    setTimeout(() => setDownloadFeedback(false), 2000);
    const link = document.createElement('a');
    link.href = imageState.currentUrl;
    link.download = `zix-studio-export-${Date.now()}.png`;
    link.click();
  };

  const canUndo = imageState.currentIndex > 0;
  const canRedo = imageState.currentIndex < imageState.history.length - 1;
  const canDownload = imageState.history.length > 1;

  return (
    <div className="h-[100dvh] flex flex-col bg-black text-white selection:bg-yellow-500/30 overflow-hidden">
      <Header 
        isMenuOpen={isMenuOpen} 
        onToggleMenu={() => setIsMenuOpen(!isMenuOpen)} 
        isIdle={loading === LoadingState.IDLE}
      />

      {/* SESSION NAMING MODAL */}
      {showNamingModal && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-neutral-950 border border-neutral-800 rounded-[2.5rem] p-8 md:p-10 shadow-2xl scale-in-95 animate-in">
            <h3 className="text-2xl font-black tracking-tight mb-2">Save Sequence?</h3>
            <p className="text-xs text-neutral-500 uppercase tracking-widest font-bold mb-8">Identify this workspace session</p>
            
            <input 
              autoFocus
              type="text"
              placeholder="e.g. Cinematic Portrait"
              value={pendingSessionName}
              onChange={(e) => setPendingSessionName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && confirmNewSession()}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-2xl px-6 py-4 text-white placeholder-neutral-700 focus:outline-none focus:border-yellow-500/50 transition-all mb-8"
            />

            <div className="flex gap-4">
              <button 
                onClick={() => setShowNamingModal(false)}
                className="flex-1 py-4 rounded-2xl bg-neutral-900 text-[10px] font-black uppercase tracking-widest text-neutral-500 hover:text-white transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={confirmNewSession}
                className="flex-1 py-4 rounded-2xl bg-yellow-500 text-black text-[10px] font-black uppercase tracking-widest hover:bg-yellow-400 transition-all"
              >
                Archive
              </button>
            </div>
          </div>
        </div>
      )}

      {isMenuOpen && (
        <div 
          onClick={() => setIsMenuOpen(false)}
          className="fixed inset-0 z-[110] bg-black/95 backdrop-blur-3xl flex flex-col pt-20 md:pt-24 px-4 md:px-12 animate-in fade-in slide-in-from-right duration-300"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="max-w-2xl mx-auto w-full flex flex-col gap-4 md:gap-8 overflow-y-auto pb-12 scrollbar-hide"
          >
            <h2 className="text-[9px] md:text-[10px] font-black text-neutral-600 uppercase tracking-[0.5em] mb-2">Systems Menu</h2>
            
            <button 
              onClick={handleNewSessionRequest} 
              className="group flex items-center justify-between p-5 md:p-6 rounded-3xl border border-neutral-800 hover:border-yellow-500/40 hover:bg-neutral-900/40 transition-all text-left w-full"
            >
              <div className="flex flex-col gap-1">
                <span className="text-lg md:text-2xl font-bold group-hover:text-yellow-500 transition-colors">New Session</span>
                <span className="text-[10px] md:text-xs text-neutral-500">Reset and archive current work</span>
              </div>
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl border border-neutral-800 flex items-center justify-center group-hover:bg-yellow-500 group-hover:text-black transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
              </div>
            </button>

            <button onClick={() => { setView('history'); setIsMenuOpen(false); }} className="group flex items-center justify-between p-5 md:p-6 rounded-3xl border border-neutral-800 hover:border-yellow-500/40 hover:bg-neutral-900/40 transition-all text-left w-full">
              <div className="flex flex-col gap-1">
                <span className="text-lg md:text-2xl font-bold group-hover:text-yellow-500 transition-colors">Visual Archives</span>
                <span className="text-[10px] md:text-xs text-neutral-500">Access stored sequences</span>
              </div>
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl border border-neutral-800 flex items-center justify-center group-hover:bg-yellow-500 group-hover:text-black transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><path d="M12 7v5l4 2"/></svg>
              </div>
            </button>

            <div className="mt-4 pt-8 border-t border-neutral-900 flex flex-col md:flex-row gap-4 justify-between items-center text-neutral-700">
               <button 
                 onDoubleClick={async () => { 
                   // @ts-ignore
                   await window.aistudio.openSelectKey(); 
                   setIsMenuOpen(false); 
                 }} 
                 className="text-[9px] uppercase tracking-[0.3em] font-black hover:text-neutral-400 transition-colors cursor-default"
                 title="Admin access: Double-click to manage keys"
               >
                 zix studio v4.7
               </button>
               <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-[9px] uppercase tracking-widest hover:text-yellow-500 transition-colors font-bold">Billing Docs</a>
            </div>
          </div>
        </div>
      )}

      {view === 'history' ? (
        <main className="flex-1 pt-20 md:pt-24 px-4 md:px-12 pb-12 animate-in fade-in slide-in-from-bottom duration-500 overflow-y-auto scrollbar-hide">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-end justify-between mb-8 md:mb-12 border-b border-neutral-900 pb-6 md:pb-8">
              <div className="flex flex-col gap-1">
                <h1 className="text-3xl md:text-5xl font-black tracking-tighter">Archives<span className="text-yellow-500">.</span></h1>
                <p className="text-[9px] md:text-[10px] text-neutral-500 uppercase tracking-[0.4em] font-black">Persistence Layer</p>
              </div>
              <button onClick={() => setView('studio')} className="px-4 py-2.5 md:px-6 md:py-3 rounded-2xl bg-neutral-900 border border-neutral-800 text-[9px] md:text-[10px] font-black uppercase tracking-widest hover:border-yellow-500 transition-all">
                Return to Studio
              </button>
            </div>
            
            {allSessions.length === 0 ? (
              <div className="h-[40vh] flex flex-col items-center justify-center text-neutral-800 border-2 border-dashed border-neutral-900 rounded-[2rem] md:rounded-[3rem] px-6 text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.3em]">Archives currently empty</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-8">
                {allSessions.map(session => (
                  <div key={session.id} onClick={() => loadSession(session)} className="group relative bg-neutral-950 border border-neutral-900 rounded-2xl md:rounded-[2rem] overflow-hidden cursor-pointer hover:border-yellow-500/40 transition-all hover:translate-y-[-4px]">
                    <div className="aspect-square bg-neutral-900 relative">
                      {session.previewUrl ? <img src={session.previewUrl} alt="Preview" className="w-full h-full object-cover opacity-50 group-hover:opacity-100 transition-opacity duration-500" /> : <div className="w-full h-full flex items-center justify-center text-[10px] font-black uppercase text-neutral-800">No Image</div>}
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60"></div>
                      <button onClick={(e) => deleteSessionFromHistory(e, session.id)} className="absolute top-2 right-2 md:top-4 md:right-4 w-8 h-8 md:w-10 md:h-10 rounded-full bg-black/60 backdrop-blur-md border border-neutral-800 text-neutral-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center hover:border-red-500/30">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                      </button>
                    </div>
                    <div className="p-4 md:p-6 bg-neutral-900/40 backdrop-blur-md border-t border-neutral-800">
                      <p className="text-xs md:text-sm font-black text-white line-clamp-1 mb-1">{session.name}</p>
                      <div className="flex justify-between items-center">
                        <p className="text-[8px] md:text-[9px] text-neutral-500 uppercase tracking-widest font-bold">v{session.imageState.history.length} Sequence</p>
                        <p className="text-[8px] md:text-[9px] font-bold text-neutral-700 uppercase">{new Date(session.timestamp).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      ) : (
        <>
          <main className="flex-1 relative flex flex-col items-center pt-16 md:pt-24 pb-[160px] md:pb-[180px] overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-yellow-900/5 via-transparent to-transparent pointer-events-none"></div>
            
            <div className="flex-1 w-full max-w-5xl px-3 md:px-4 flex flex-col items-center justify-center min-h-0">
              {!imageState.currentUrl ? (
                <div onClick={() => fileInputRef.current?.click()} className="w-full max-w-md aspect-square border-2 border-dashed border-neutral-800 rounded-[2rem] md:rounded-[3rem] flex flex-col items-center justify-center gap-6 md:gap-8 cursor-pointer hover:border-yellow-500/50 hover:bg-neutral-900/20 transition-all group p-8 md:p-12">
                  <div className="w-16 h-16 md:w-20 md:h-20 bg-neutral-900 rounded-2xl md:rounded-3xl flex items-center justify-center text-neutral-600 group-hover:text-yellow-500 border border-neutral-800 group-hover:border-yellow-500/50 transition-all group-hover:scale-105 duration-500">
                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7"/><path d="M16 5h6"/><path d="M19 2v6"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                  </div>
                  <div className="text-center">
                    <p className="text-xl md:text-2xl font-black tracking-tight text-neutral-200">Initialize Visual</p>
                    <p className="text-[9px] text-neutral-600 mt-2 uppercase tracking-[0.4em] font-black">Neural Studio Active</p>
                  </div>
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*" />
                </div>
              ) : (
                <div className="relative w-full h-full flex flex-col items-center justify-center min-h-0">
                  <div className="relative flex-1 w-full flex items-center justify-center rounded-[1.5rem] md:rounded-[2.5rem] overflow-hidden shadow-2xl border border-neutral-800 bg-neutral-950 min-h-0">
                    <img 
                      src={imageState.currentUrl} 
                      alt="Main Visual" 
                      className={`max-w-full max-h-full object-contain select-none transition-all duration-700 ${loading === LoadingState.EDITING ? 'opacity-30 blur-2xl scale-95' : 'opacity-100 blur-0 scale-100'}`} 
                    />
                    {loading === LoadingState.EDITING && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <LoadingSpinner />
                      </div>
                    )}
                    
                    <div className="absolute bottom-4 right-4 md:bottom-6 md:right-6 px-2.5 py-1.5 bg-black/50 backdrop-blur-xl border border-neutral-800 rounded-lg text-[8px] md:text-[9px] font-black text-neutral-400">
                      V{imageState.currentIndex + 1} • HISTORY {imageState.history.length}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-1.5 md:gap-2 p-1 md:p-1.5 bg-neutral-900/40 backdrop-blur-2xl border border-neutral-800 rounded-2xl shrink-0">
                    <Tooltip content="Undo">
                      <button 
                        onClick={undo} 
                        disabled={!canUndo || loading !== LoadingState.IDLE} 
                        className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-xl text-neutral-400 hover:text-yellow-500 hover:bg-neutral-800 disabled:opacity-10 transition-all"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
                      </button>
                    </Tooltip>
                    
                    <Tooltip content="Redo">
                      <button 
                        onClick={redo} 
                        disabled={!canRedo || loading !== LoadingState.IDLE} 
                        className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-xl text-neutral-400 hover:text-yellow-500 hover:bg-neutral-800 disabled:opacity-10 transition-all"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/></svg>
                      </button>
                    </Tooltip>

                    <div className="w-[1px] h-6 bg-neutral-800 mx-0.5 md:mx-1"></div>

                    <Tooltip content="Export" isActive={downloadFeedback} activeContent="Exporting...">
                      <button 
                        onClick={downloadImage} 
                        disabled={!canDownload || loading !== LoadingState.IDLE}
                        className={`w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-xl transition-all ${!canDownload ? 'text-neutral-800' : 'text-neutral-400 hover:text-yellow-500 hover:bg-neutral-800'}`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/></svg>
                      </button>
                    </Tooltip>
                  </div>
                </div>
              )}
            </div>
          </main>

          <div className="fixed bottom-0 left-0 right-0 z-[90] pb-2 md:pb-6 px-3 md:px-8 pointer-events-none">
            <div className="max-w-3xl mx-auto flex flex-col gap-3 pointer-events-auto">
              
              {statusText && (
                <div className="self-center px-5 py-2.5 bg-neutral-900/95 backdrop-blur-3xl border border-neutral-800 rounded-2xl shadow-2xl animate-in slide-in-from-bottom-2 fade-in duration-300 text-center max-w-[280px] md:max-w-sm">
                  <p className="text-[9px] md:text-[10px] font-black text-yellow-500 uppercase tracking-[0.2em] mb-0.5">{statusText.primary}</p>
                  <p className="text-[8px] md:text-[9px] font-bold text-neutral-500 uppercase tracking-widest">{statusText.secondary}</p>
                </div>
              )}
              
              <div className="flex overflow-x-auto md:flex-wrap justify-start md:justify-center gap-2 px-1 py-1 scrollbar-hide">
                 {activeSuggestions.map(suggest => (
                   <button 
                     key={suggest} 
                     onClick={() => handleEdit(suggest)} 
                     disabled={!imageState.currentUrl || loading !== LoadingState.IDLE} 
                     className="flex-none whitespace-nowrap text-[8px] md:text-[9px] font-black uppercase tracking-[0.15em] px-3.5 py-2 md:px-4 md:py-2 rounded-full border border-neutral-900 bg-neutral-950/60 text-neutral-500 hover:border-yellow-500/40 hover:text-yellow-500 hover:bg-neutral-900 transition-all disabled:opacity-0"
                   >
                     {suggest}
                   </button>
                 ))}
              </div>

              <div className="bg-neutral-950/90 backdrop-blur-3xl border border-neutral-800 rounded-[1.8rem] md:rounded-[2.2rem] p-0.5 shadow-2xl ring-1 ring-white/5 mb-2 md:mb-0">
                <PromptInput 
                  onSend={handleEdit} 
                  disabled={loading !== LoadingState.IDLE || !imageState.currentUrl} 
                  placeholder={imageState.currentUrl ? "Instruct Neural Studio..." : "Initialize visual above..."} 
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default App;
