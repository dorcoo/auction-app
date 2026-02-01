import React, { useState, useEffect, useMemo } from 'react';
import { 
  Gavel, Home, Calculator, ClipboardList, Calendar, AlertTriangle, 
  CheckCircle2, Plus, Trash2, Save, ArrowLeft, Search, ExternalLink, 
  MapPin, Sparkles, Bot, LogIn, LogOut, Lock, User, FileSearch, Download, TrendingUp,
  Scale, Briefcase, Building2, Clock, Map, RefreshCw, X, ChevronRight
} from 'lucide-react';
import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInWithCustomToken, 
  signInAnonymously, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from "firebase/auth";
import { 
  getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, setDoc,
  onSnapshot, query, serverTimestamp, orderBy 
} from "firebase/firestore";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🔴 [필수] 본인의 구글 이메일을 따옴표 안에 적어주세요! (로그인용)
// 예시: const ALLOWED_EMAIL = "honggildong@gmail.com";
const ALLOWED_EMAIL = ""; 

// 🟡 [선택] AI 기능을 쓰려면 Gemini API 키를 넣어주세요. (없으면 비워두세요)
const apiKey = "AIzaSyB2Ni95d2qjT8VjA0d4-Hll4y-SswvwFf4"; 
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// --- Firebase 설정 ---
const firebaseConfig = {
  apiKey: "AIzaSyAeK7aHZQpk4zlPUSEc_poME8NtZX-i_N0",
  authDomain: "land-10a44.firebaseapp.com",
  projectId: "land-10a44",
  storageBucket: "land-10a44.firebasestorage.app",
  messagingSenderId: "980448725394",
  appId: "1:980448725394:web:c60fbaee729a08e325594b",
  measurementId: "G-DZBM1T6X3X"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'auction-manager-v1';

// --- Gemini API 호출 함수 ---
const callGemini = async (prompt, systemInstruction = "") => {
  if (!apiKey) return "API 키가 설정되지 않았습니다. 코드 상단에 키를 입력해주세요.";
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          contents: [{ parts: [{ text: prompt }] }],
          systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined
        }),
      }
    );
    if (!response.ok) throw new Error(`API call failed: ${response.statusText}`);
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "분석 결과를 가져올 수 없습니다.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "AI 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
  }
};

// --- 도움 함수들 ---
const formatCurrency = (value) => {
  if (!value) return '0';
  const num = typeof value === 'string' ? parseInt(value.replace(/[^0-9-]/g, ''), 10) : value;
  return isNaN(num) ? value : new Intl.NumberFormat('ko-KR').format(num);
};

const getDday = (targetDate) => {
  if (!targetDate) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(targetDate); target.setHours(0, 0, 0, 0);
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
};

const getDdayString = (targetDate) => {
  const d = getDday(targetDate);
  if (d === null) return { text: '-', color: 'text-slate-400', bg: 'bg-slate-100' };
  if (d === 0) return { text: 'D-Day', color: 'text-red-600', bg: 'bg-red-100 animate-pulse' };
  if (d < 0) return { text: '마감', color: 'text-slate-500', bg: 'bg-slate-200' };
  if (d <= 3) return { text: `D-${d}`, color: 'text-red-500', bg: 'bg-red-50' };
  return { text: `D-${d}`, color: 'text-indigo-600', bg: 'bg-indigo-50' };
};

const calculateIncomeTax = (taxBase) => {
  if (taxBase <= 14000000) return taxBase * 0.06;
  if (taxBase <= 50000000) return taxBase * 0.15 - 1260000;
  if (taxBase <= 88000000) return taxBase * 0.24 - 5760000;
  if (taxBase <= 150000000) return taxBase * 0.35 - 15440000;
  if (taxBase <= 300000000) return taxBase * 0.38 - 19940000;
  if (taxBase <= 500000000) return taxBase * 0.40 - 25940000;
  if (taxBase <= 1000000000) return taxBase * 0.42 - 35940000;
  return taxBase * 0.45 - 65940000;
};

// --- 메인 컴포넌트 ---
export default function AuctionManager() {
  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [view, setView] = useState('dashboard');
  const [selectedItem, setSelectedItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setLoading(false);
      if (currentUser) {
        if (ALLOWED_EMAIL && !currentUser.isAnonymous && currentUser.email !== ALLOWED_EMAIL) {
          setAuthError("허용되지 않은 사용자입니다.");
          signOut(auth);
          setUser(null);
          return;
        }
        setUser(currentUser);
        setAuthError(null);
      } else {
        setUser(null);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'artifacts', appId, 'users', user.uid, 'auction_items'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      fetchedItems.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setItems(fetchedItems);
    }, (error) => console.error("Firestore Error:", error));
    return () => unsubscribe();
  }, [user]);

  const handleGoogleLogin = async () => {
    try { await signInWithPopup(auth, new GoogleAuthProvider()); } 
    catch (error) { 
      if (error.code === 'auth/unauthorized-domain') setAuthError("미리보기 환경에서는 구글 로그인이 제한됩니다. Vercel 배포 후 사용하거나 게스트 모드를 이용하세요.");
      else setAuthError(`로그인 실패: ${error.message}`); 
    }
  };
  const handleGuestLogin = async () => {
    try { await signInAnonymously(auth); } 
    catch (error) { setAuthError("게스트 로그인 실패: Firebase 콘솔에서 '익명' 로그인을 켜주세요."); }
  };
  const handleLogout = () => signOut(auth);

  const handleAddItem = async (newItem) => {
    if (!user) return;
    try {
      const initialChecklist = {
        // 1. 점유 현황
        occupancyStatus: '', isDoorLocked: false, mailboxStatus: '', meterStatus: '',
        // 2. 물리적 하자
        leak: false, cracks: false, mold: false, sunlight: '',
        // 3. 입지/편의
        parking: '', elevator: false, transport: '',
        // 4. 시세 조사
        marketPrice: '', transactionPrice: '', forcedSalePrice: '', managementFee: '',
      };

      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'auction_items'), {
        ...newItem, 
        createdAt: serverTimestamp(), 
        status: '관심',
        checklists: initialChecklist,
        rights: { 
          malsoDate: '', tenantMoveInDate: '', tenantFixDate: '', tenantDeposit: '', 
          auctionType: '임의경매', // 기본값
          claimAmount: '', // 청구금액
          dividendDeadline: '' // 배당요구종기일
        },
        financials: { 
          expectedBidPrice: '', acquisitionTaxRate: 1.1, legalCost: '', repairCost: '', movingCost: '', 
          loanAmount: '', loanRate: 4.5, 
          sellPrice: '', monthlyRent: '', deposit: '',
          sellerType: 'individual', isSmallSize: true, holdingPeriod: 1 
        },
        aiFieldAnalysis: '', aiStrategy: ''
      });
      setView('list');
      alert("성공적으로 등록되었습니다!");
    } catch (error) { alert("저장 실패: " + error.message); }
  };

  const handleUpdateItem = async (id, data) => {
    await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'auction_items', id), data);
    if (selectedItem?.id === id) setSelectedItem({ ...selectedItem, ...data });
  };

  const handleDeleteItem = async (id) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'auction_items', id));
    if (selectedItem?.id === id) { setView('list'); setSelectedItem(null); }
  };

  const handleImportParsedItem = (parsedItem) => {
    const isDuplicate = items.some(i => 
      i.caseNumber === parsedItem.caseNo && 
      String(i.itemNumber || '1') === String(parsedItem.itemNo || '1')
    );

    if (isDuplicate) {
        alert("이미 '내 물건 관리'에 등록된 사건입니다.");
        return;
    }

    const newItem = {
      caseNumber: parsedItem.caseNo,
      itemNumber: parsedItem.itemNo || '1',
      court: parsedItem.deptInfo || '', 
      auctionStatus: parsedItem.status || '', 
      type: parsedItem.usage || '기타',
      address: parsedItem.address,
      appraisalPrice: parsedItem.appraisalPrice.replace(/[^0-9]/g, ''),
      minPrice: parsedItem.minPrice.split(' ')[0].replace(/[^0-9]/g, ''),
      biddingDate: '',
      fieldNote: `[가져온 데이터]\n${parsedItem.details}\n${parsedItem.remark}`,
      aiFieldAnalysis: parsedItem.aiChecklist ? `[AI 체크리스트]\n${parsedItem.aiChecklist}` : ''
    };
    handleAddItem(newItem);
  };

  if (!user && !loading) return <LoginScreen authError={authError} onGoogleLogin={handleGoogleLogin} onGuestLogin={handleGuestLogin} />;
  if (loading) return <div className="h-screen flex items-center justify-center"><div className="animate-spin w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full"/></div>;

  return (
    <div className="flex h-screen bg-slate-100 text-slate-800 font-sans overflow-hidden">
      <Sidebar view={view} setView={setView} user={user} onLogout={handleLogout} />
      <main className="flex-1 overflow-y-auto">
        {view === 'dashboard' && <Dashboard items={items} onViewChange={setView} onItemSelect={(item)=>{setSelectedItem(item); setView('detail');}} />}
        {view === 'list' && <ItemList items={items} onItemSelect={(item)=>{setSelectedItem(item); setView('detail');}} onAddClick={()=>setView('add')} />}
        {view === 'add' && <AddItemForm onCancel={()=>setView('list')} onSave={handleAddItem} />}
        {view === 'detail' && selectedItem && <ItemDetail item={selectedItem} onBack={()=>setView('list')} onUpdate={handleUpdateItem} onDelete={handleDeleteItem} />}
        {view === 'analysis' && <QuickAnalysisView onImport={handleImportParsedItem} user={user} items={items} />}
      </main>
    </div>
  );
}

// --- 로그인 화면 ---
function LoginScreen({ authError, onGoogleLogin, onGuestLogin }) {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-100 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-lg max-w-sm w-full text-center">
        <div className="bg-indigo-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
          <Gavel className="w-8 h-8 text-indigo-600" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">경매 관리자</h1>
        <p className="text-slate-500 mb-6 text-sm">데이터 저장을 위해 로그인이 필요합니다.</p>
        {authError && <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg flex text-left"><AlertTriangle className="w-4 h-4 mr-2 mt-0.5 shrink-0"/>{authError}</div>}
        <div className="space-y-3">
          <button onClick={onGoogleLogin} className="w-full flex items-center justify-center gap-3 bg-white border border-slate-300 hover:bg-slate-50 py-3 rounded-xl transition-all shadow-sm font-medium text-slate-700">
            <span className="text-indigo-600 font-bold">G</span> Google 계정으로 시작
          </button>
          <button onClick={onGuestLogin} className="w-full flex items-center justify-center gap-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium py-3 rounded-xl transition-all shadow-sm">
            <User className="w-5 h-5 text-slate-500" /> 게스트 모드
          </button>
        </div>
      </div>
    </div>
  );
}

// --- 사이드바 ---
function Sidebar({ view, setView, user, onLogout }) {
  return (
    <aside className="w-20 lg:w-64 bg-white border-r border-slate-200 flex flex-col justify-between shrink-0 transition-all">
      <div>
        <div className="h-16 flex items-center justify-center lg:justify-start lg:px-6 border-b border-slate-100">
          <Gavel className="w-8 h-8 text-indigo-600" />
          <span className="hidden lg:block ml-3 font-bold text-xl">Auction Mgr</span>
        </div>
        <nav className="mt-6 px-2 space-y-2">
          <SidebarItem icon={Home} label="대시보드" active={view === 'dashboard'} onClick={() => setView('dashboard')} />
          <SidebarItem icon={ClipboardList} label="내 물건 관리" active={view === 'list' || view === 'add' || view === 'detail'} onClick={() => setView('list')} />
          <SidebarItem icon={FileSearch} label="AI 간편 분석" active={view === 'analysis'} onClick={() => setView('analysis')} />
        </nav>
      </div>
      <div className="p-4">
        <div className="hidden lg:block mb-4 px-2"><p className="text-xs text-slate-400">접속 계정:</p><p className="text-xs font-bold text-slate-700 truncate">{user?.isAnonymous ? '게스트' : user?.email}</p></div>
        <button onClick={onLogout} className="w-full flex items-center justify-center lg:justify-start p-2 text-slate-500 hover:bg-slate-50 rounded-lg text-sm hover:text-red-500 transition-colors"><LogOut className="w-5 h-5 lg:mr-2" /><span className="hidden lg:inline">로그아웃</span></button>
      </div>
    </aside>
  );
}

function SidebarItem({ icon: Icon, label, active, onClick }) {
  return <button onClick={onClick} className={`w-full flex items-center justify-center lg:justify-start p-3 rounded-xl transition-colors ${active ? 'bg-indigo-50 text-indigo-600 font-bold' : 'text-slate-500 hover:bg-slate-50'}`}><Icon className="w-6 h-6" /> <span className="hidden lg:block ml-3 font-medium">{label}</span></button>;
}

// --- AI 간편 분석 뷰 ---
function QuickAnalysisView({ onImport, user, items }) {
  const [htmlInput, setHtmlInput] = useState("");
  const [parsedItems, setParsedItems] = useState([]);
  const [aiModal, setAiModal] = useState({ show: false, title: "", content: "" });
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'artifacts', appId, 'users', user.uid, 'analyzed_items'),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setParsedItems(fetchedItems);
    });
    return () => unsubscribe();
  }, [user]);

  const processInput = async () => {
    if (!htmlInput.trim()) return alert("HTML 소스를 입력해주세요.");
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlInput, 'text/html');
      const rows = doc.querySelectorAll('tr');
      const newItems = [];
      let currentItem = null;

      rows.forEach((row) => {
        const caseTd = row.querySelector('[data-col_id="printCsNo"]');
        const addressTd = row.querySelector('[data-col_id="printSt"]');
        if (caseTd && caseTd.textContent.trim() !== "") {
          const caseNo = caseTd.textContent.trim().replace(/\s+/g, ' ');
          const itemNo = row.querySelector('[data-col_id="maemulSer"]')?.textContent.trim() || "1";
          
          currentItem = {
            id: `${caseNo.replace(/[^0-9a-zA-Z]/g, '')}_${itemNo}`,
            caseNo: caseNo,
            itemNo: itemNo,
            address: addressTd?.querySelector('a')?.textContent.trim() || addressTd?.textContent.trim().split('[')[0] || "",
            details: addressTd?.querySelector('text')?.textContent.trim() || addressTd?.textContent.trim().match(/\[(.*?)\]/)?.[0] || "",
            remark: row.querySelector('[data-col_id="mulBigo"]')?.textContent.trim() || "-",
            appraisalPrice: row.querySelector('[data-col_id="gamevalAmt"]')?.textContent.trim() || "0",
            deptInfo: row.querySelector('[data-col_id="jpDeptNm"]')?.textContent.trim() || "",
            usage: "", minPrice: "", status: "", priorityScore: 100, aiChecklist: null,
            createdAt: serverTimestamp()
          };
          newItems.push(currentItem);
        } else if (currentItem) {
          const usage = row.querySelector('[data-col_id="dspslUsgNm"]')?.textContent.trim();
          const minPrice = row.querySelector('[data-col_id="notifyMinmaePrice1"]')?.textContent.trim();
          const status = row.querySelector('[data-col_id="yuchalCnt"]')?.textContent.trim();
          if (usage) currentItem.usage = usage;
          if (minPrice) {
            currentItem.minPrice = minPrice.replace(/\s+/g, ' ');
            const pctMatch = minPrice.match(/\((\d+)%\)/);
            if (pctMatch) currentItem.priorityScore = parseInt(pctMatch[1]);
          }
          if (status) currentItem.status = status;
        }
      });

      if (newItems.length === 0) return alert("경매 데이터를 찾지 못했습니다.");
      
      if (user) {
        await Promise.all(newItems.map(item => 
          setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'analyzed_items', item.id), item)
        ));
      }

      setHtmlInput("");
      alert(`${newItems.length}건이 분석되어 리스트에 저장되었습니다.`);

    } catch (err) { alert("분석 중 오류 발생: " + err.message); }
  };

  const deleteAnalyzedItem = async (id) => {
    if (!confirm("이 분석 내역을 삭제하시겠습니까?")) return;
    if (user) {
        await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'analyzed_items', id));
    }
  }

  const analyzeItemAI = async (item) => {
    setIsAnalyzing(true);
    const prompt = `사건번호: ${item.caseNo}\n주소: ${item.address}\n용도: ${item.usage}\n감정가: ${item.appraisalPrice}\n최저가: ${item.minPrice}\n상태: ${item.status}\n비고: ${item.remark}\n\n위 물건을 부동산 전문가 입장에서 투자 포인트, 주요 리스크, 입찰 전략을 3줄로 핵심만 분석해줘.`;
    const res = await callGemini(prompt);
    setAiModal({ show: true, title: `${item.caseNo} AI 분석`, content: res });
    setIsAnalyzing(false);
  };

  const generateChecklistAI = async (item) => {
    setIsAnalyzing(true);
    const prompt = `물건: ${item.address} (용도: ${item.usage}, 상세: ${item.details})\n\n이 경매 물건의 입찰을 고민하는 사람을 위한 '맞춤형 체크리스트' 5가지를 작성해줘.`;
    const res = await callGemini(prompt);
    
    if (user) {
        await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'analyzed_items', item.id), {
            aiChecklist: res
        });
    }
    setIsAnalyzing(false);
  };

  const analyzeAllAI = async () => {
    if (parsedItems.length === 0) return;
    setIsAnalyzing(true);
    const listSummary = parsedItems.slice(0, 5).map(i => `- ${i.address} (${i.usage}, ${i.minPrice})`).join('\n');
    const prompt = `현재 리스트:\n${listSummary}\n\n위 물건들 중 가장 수익성이 기대되는 Top 2를 선정하고 이유를 간단히 적어줘.`;
    const res = await callGemini(prompt);
    setAiModal({ show: true, title: "전체 리스트 종합 분석", content: res });
    setIsAnalyzing(false);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-2">
            <span className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white p-2 rounded-xl"><Sparkles className="w-6 h-6"/></span>
            Auction AI Pro
          </h1>
          <p className="text-slate-500 text-sm mt-1">HTML 소스를 붙여넣으면 자동 분석 후 <b>영구 저장</b>됩니다.</p>
        </div>
      </div>
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 mb-8">
        <textarea 
          value={htmlInput} onChange={e => setHtmlInput(e.target.value)}
          placeholder="여기에 <table> 태그가 포함된 HTML 소스를 붙여넣으세요." 
          className="w-full h-32 p-4 rounded-xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-mono mb-4 resize-none"
        />
        <button onClick={processInput} className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-90 text-white py-3 rounded-xl font-bold text-lg shadow-lg transition-all flex items-center justify-center gap-2">
          <Search className="w-5 h-5"/> 데이터 분석 및 리스트 저장
        </button>
      </div>
      {parsedItems.length > 0 && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex justify-between items-center mb-6 bg-slate-900 text-white p-4 rounded-xl shadow-lg">
            <div className="font-bold flex items-center gap-2"><div className="bg-indigo-500 p-1.5 rounded-lg"><ClipboardList className="w-4 h-4"/></div> 분석 보관함 ({parsedItems.length}건)</div>
            <button onClick={analyzeAllAI} disabled={isAnalyzing} className="bg-white text-slate-900 px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-100 transition-colors flex items-center gap-2">{isAnalyzing ? '분석 중...' : '✨ AI 전체 종합 분석'}</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {parsedItems.map(item => {
              const isRegistered = items.some(i => i.caseNumber === item.caseNo && String(i.itemNumber || '1') === String(item.itemNo || '1'));
              return (
              <div key={item.id} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-xl hover:-translate-y-1 transition-all flex flex-col relative group">
                <button onClick={() => deleteAnalyzedItem(item.id)} className="absolute top-4 right-4 p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors opacity-0 group-hover:opacity-100"><X className="w-5 h-5"/></button>
                <div className="flex justify-between items-start mb-4 pr-8">
                  <div><span className="text-xs font-black text-slate-400 block mb-1">{item.caseNo}</span><span className="text-sm font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">물건 {item.itemNo}</span></div>
                  {item.priorityScore <= 50 && <span className="bg-red-100 text-red-600 text-[10px] font-bold px-2 py-1 rounded animate-pulse">🔥 BEST DEAL</span>}
                </div>
                <h3 className="font-bold text-slate-900 mb-2 leading-tight min-h-[3rem]">{item.address}</h3>
                <div className="space-y-2 mb-6">
                  <div className="flex justify-between text-xs"><span className="text-slate-400">감정가</span><span className="font-bold">{item.appraisalPrice}</span></div>
                  <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl"><span className="text-slate-500 text-xs font-bold">최저가 ({item.priorityScore}%)</span><span className="text-indigo-600 font-black text-lg">{item.minPrice.split(' ')[0]}</span></div>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <button onClick={()=>analyzeItemAI(item)} disabled={isAnalyzing} className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-xs font-bold py-3 rounded-xl hover:opacity-90 transition-all flex justify-center items-center gap-1">{isAnalyzing?'...':'✨ AI 투자 분석'}</button>
                  <a href={`https://map.naver.com/v5/search/${encodeURIComponent(item.address)}`} target="_blank" rel="noreferrer" className="bg-slate-800 text-white text-xs font-bold py-3 rounded-xl hover:bg-slate-700 transition-all flex justify-center items-center gap-1">지도 보기</a>
                </div>
                {item.aiChecklist && (
                  <div className="mb-4 bg-indigo-50 p-3 rounded-xl border border-indigo-100">
                    <p className="text-[10px] font-black text-indigo-500 uppercase mb-2 text-center">AI 추천 체크리스트</p>
                    <div className="text-xs text-slate-600 space-y-1">{item.aiChecklist.split('\n').slice(0,3).map((l,i)=><p key={i} className="truncate">• {l.replace(/^\d+[\.\)]\s*/, '')}</p>)}</div>
                  </div>
                )}
                {!item.aiChecklist && <button onClick={()=>generateChecklistAI(item)} disabled={isAnalyzing} className="w-full border-2 border-dashed border-slate-200 text-slate-400 text-xs font-bold py-2 rounded-xl mb-4 hover:border-indigo-300 hover:text-indigo-500 transition-all">AI 체크리스트 생성</button>}
                
                {isRegistered ? (
                     <button disabled className="w-full mt-auto bg-slate-100 border border-slate-200 text-slate-400 font-bold py-3 rounded-xl flex justify-center items-center gap-2 cursor-not-allowed">
                        <CheckCircle2 className="w-4 h-4"/> 이미 등록됨
                     </button>
                ) : (
                    <button onClick={() => onImport(item)} className="w-full mt-auto bg-white border border-slate-200 text-slate-700 font-bold py-3 rounded-xl hover:bg-slate-50 transition-all flex justify-center items-center gap-2">
                        <Plus className="w-4 h-4"/> 내 물건으로 등록
                    </button>
                )}
              </div>
            )})}
          </div>
        </div>
      )}
      {aiModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 text-white flex justify-between items-center">
              <h3 className="font-bold flex items-center gap-2"><Bot className="w-6 h-6"/> {aiModal.title}</h3>
              <button onClick={() => setAiModal({ ...aiModal, show: false })} className="hover:bg-white/20 p-1 rounded-full"><ArrowLeft className="w-6 h-6 rotate-180"/></button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto text-slate-700 leading-relaxed text-sm whitespace-pre-line">{aiModal.content}</div>
            <div className="p-4 border-t bg-slate-50"><button onClick={() => setAiModal({ ...aiModal, show: false })} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800">닫기</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- 기본 컴포넌트들 ---
function Dashboard({ items, onViewChange, onItemSelect }) {
  const stats = useMemo(() => ({ total: items.length, interested: items.filter(i => i.status === '관심').length, analyzing: items.filter(i => i.status === '권리분석').length, field: items.filter(i => i.status === '임장중').length, bidding: items.filter(i => i.status === '입찰준비').length }), [items]);
  const upcoming = items.filter(i => i.biddingDate && getDday(i.biddingDate) >= 0).sort((a, b) => new Date(a.biddingDate) - new Date(b.biddingDate)).slice(0, 5);
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="mb-8"><h1 className="text-2xl font-bold">대시보드</h1></header>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"><StatCard title="관심" count={stats.interested} color="bg-blue-500"/><StatCard title="분석" count={stats.analyzing} color="bg-yellow-500"/><StatCard title="임장" count={stats.field} color="bg-green-500"/><StatCard title="입찰" count={stats.bidding} color="bg-red-500"/></div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-2xl border p-6"><h2 className="font-bold mb-4 flex items-center"><Calendar className="mr-2 text-indigo-600"/> 다가오는 입찰</h2><div className="space-y-3">{upcoming.map(i=>{
          const dday = getDdayString(i.biddingDate);
          return <div key={i.id} onClick={()=>{onItemSelect(i)}} className="flex justify-between p-3 border rounded-lg cursor-pointer hover:bg-slate-50"><div><div className="font-bold text-sm">{i.caseNumber}</div><div className="text-xs text-slate-500">{i.address}</div></div><div className={`font-bold text-sm px-2 py-1 rounded ${dday.bg} ${dday.color}`}>{dday.text}</div></div>
        })}</div></div>
        <div className="bg-indigo-600 rounded-2xl p-6 text-white"><h2 className="font-bold mb-4">체크포인트</h2><ul className="text-sm space-y-2 mb-6"><li>• 말소기준권리 확인</li><li>• 체납관리비 확인</li></ul><button onClick={()=>onViewChange('add')} className="w-full py-2 bg-white text-indigo-600 font-bold rounded-lg">새 물건 등록</button></div>
      </div>
    </div>
  );
}
function StatCard({ title, count, color }) { return <div className="bg-white p-4 rounded-2xl border flex justify-between items-center"><div><div className="text-xs text-slate-500">{title}</div><div className="text-xl font-bold">{count}</div></div><div className={`w-1 h-8 ${color} rounded`}></div></div>; }
function ItemList({ items, onItemSelect, onAddClick }) {
  const [filter, setFilter] = useState('전체');
  const filtered = items.filter(i => filter === '전체' || i.status === filter);
  return ( 
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">물건 관리</h1>
          <p className="text-slate-500 text-sm mt-1">등록된 총 {items.length}개의 물건</p>
        </div>
        <div className="flex gap-2">
          <select value={filter} onChange={e=>setFilter(e.target.value)} className="border rounded-lg px-4 py-2 text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"><option>전체</option><option>관심</option><option>권리분석</option><option>임장중</option><option>입찰준비</option><option>완료</option></select>
          <button onClick={onAddClick} className="bg-indigo-600 text-white px-5 py-2 rounded-lg flex items-center font-bold text-sm hover:bg-indigo-700 transition-colors shadow-sm"><Plus className="w-4 h-4 mr-2"/>물건 등록</button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map(i=>{
          const dday = getDdayString(i.biddingDate);
          const financials = i.financials || {};
          return (
            <div key={i.id} onClick={()=>onItemSelect(i)} className="bg-white p-6 rounded-2xl border border-slate-100 hover:shadow-lg hover:border-indigo-200 cursor-pointer transition-all flex flex-col gap-3 relative group">
              <div className="flex justify-between items-start">
                <div className="flex flex-col">
                   <div className="flex items-center gap-1 mb-1">
                     <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">{i.court || '관할법원'}</span>
                     <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded">물건 {i.itemNumber || '1'}</span>
                   </div>
                   <h3 className="font-bold text-lg text-slate-900 leading-tight">{i.caseNumber}</h3>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-lg font-bold whitespace-nowrap ${getStatusColor(i.status)}`}>{i.status}</span>
              </div>
              
              <div className="flex gap-2 text-xs">
                 <span className="px-2 py-1 rounded bg-slate-100 text-slate-600 font-medium">{i.type}</span>
                 {i.auctionStatus && <span className="px-2 py-1 rounded bg-red-50 text-red-600 font-bold">{i.auctionStatus}</span>}
              </div>
            
              <p className="text-sm text-slate-600 truncate">{i.address}</p>
              
              <div className="grid grid-cols-2 gap-2 mt-auto pt-3 border-t border-slate-50">
                  <div>
                    <p className="text-[10px] text-slate-400">감정가</p>
                    <p className="text-sm font-medium text-slate-600 decoration-slate-300 decoration-1 line-through">{formatCurrency(i.appraisalPrice)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400">최저가 (현재)</p>
                    <p className="text-lg font-black text-indigo-600">{formatCurrency(i.minPrice)}</p>
                  </div>
                  {/* 내가 예상 낙찰가를 적었다면 표시 */}
                  {financials.expectedBidPrice && (
                    <div className="col-span-2 bg-green-50 px-3 py-2 rounded-lg flex justify-between items-center mt-1">
                         <span className="text-[10px] font-bold text-green-700">🎯 내 입찰 예정가</span>
                         <span className="text-sm font-black text-green-800">{formatCurrency(financials.expectedBidPrice)}원</span>
                    </div>
                  )}
                  <div className="col-span-2 flex justify-end mt-2">
                       <span className={`text-xs font-bold px-2 py-0.5 rounded ${dday.bg} ${dday.color}`}>{dday.text}</span>
                  </div>
              </div>
              
              <button 
                onClick={(e) => {
                    e.stopPropagation();
                    window.open(`https://map.naver.com/v5/search/${encodeURIComponent(i.address)}`, '_blank');
                }}
                className="absolute top-4 right-4 bg-white p-2 rounded-full shadow-md text-slate-400 hover:text-green-600 hover:bg-green-50 transition-colors opacity-0 group-hover:opacity-100"
                title="네이버 지도 보기"
              >
                <MapPin className="w-5 h-5"/>
              </button>
            </div>
          );
        })}
      </div>
    </div> 
  );
}
function AddItemForm({ onCancel, onSave }) {
  const [form, setForm] = useState({ caseNumber: '', itemNumber: '1', court: '', auctionStatus: '', type: '아파트', address: '', appraisalPrice: '', minPrice: '', biddingDate: '' });
  return (
    <div className="p-8 max-w-2xl mx-auto">
      <button onClick={onCancel} className="mb-4 flex items-center text-slate-500 hover:text-slate-800"><ArrowLeft className="w-4 h-4 mr-1"/>목록으로 돌아가기</button>
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="text-2xl font-bold mb-8 text-slate-900">새 물건 등록</h2>
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <InputGroup label="사건번호" placeholder="2024타경1234" value={form.caseNumber} onChange={v => setForm({...form, caseNumber: v})} />
            <InputGroup label="물건번호" value={form.itemNumber} onChange={v => setForm({...form, itemNumber: v})} />
          </div>
          <div className="grid grid-cols-2 gap-6">
            <InputGroup label="관할법원" placeholder="서울중앙지법" value={form.court} onChange={v => setForm({...form, court: v})} />
            <InputGroup label="현재상태" placeholder="유찰1회" value={form.auctionStatus} onChange={v => setForm({...form, auctionStatus: v})} />
          </div>
          <InputGroup label="물건 종류" type="select" options={['아파트','빌라/다세대','오피스텔','상가','토지']} value={form.type} onChange={v => setForm({...form, type: v})} />
          <InputGroup label="소재지 (주소)" placeholder="서울시..." value={form.address} onChange={v => setForm({...form, address: v})} />
          <div className="grid grid-cols-2 gap-6">
            <InputGroup label="감정가 (원)" type="number" value={form.appraisalPrice} onChange={v => setForm({...form, appraisalPrice: v})} />
            <InputGroup label="최저가 (원)" type="number" value={form.minPrice} onChange={v => setForm({...form, minPrice: v})} />
          </div>
          <InputGroup label="입찰 기일" type="date" value={form.biddingDate} onChange={v => setForm({...form, biddingDate: v})} />
          <div className="flex justify-end gap-3 pt-6 border-t mt-2">
            <button onClick={onCancel} className="px-5 py-2 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">취소</button>
            <button onClick={() => onSave(form)} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 shadow-md transition-colors">등록하기</button>
          </div>
        </div>
      </div>
    </div>
  );
}
function ItemDetail({ item, onBack, onUpdate, onDelete }) {
  const [tab, setTab] = useState('info');
  const [local, setLocal] = useState(item);
  useEffect(() => setLocal(item), [item]);
  const handleChange = (f, v, s) => setLocal(p => s ? ({...p, [s]: {...p[s], [f]: v}}) : ({...p, [f]: v}));
  
  return (<div className="h-full flex flex-col bg-slate-50"><div className="bg-white px-8 py-4 border-b flex justify-between items-center"><div className="flex items-center gap-4"><button onClick={onBack}><ArrowLeft/></button><div><h1 className="font-bold text-xl">{local.caseNumber} <span className="text-sm font-normal text-slate-500">[{local.itemNumber || '1'}]</span></h1><p className="text-sm text-slate-500">{local.address}</p></div></div><div className="flex gap-2"><select value={local.status} onChange={e=>{handleChange('status',e.target.value);onUpdate(item.id,{...local,status:e.target.value})}} className="border rounded px-2"><option>관심</option><option>권리분석</option><option>임장중</option><option>입찰준비</option><option>낙찰</option><option>패찰</option></select><button onClick={()=>onDelete(item.id)} className="text-red-500 p-2"><Trash2/></button></div></div><div className="bg-white px-8 border-b flex gap-6">{[{id:'info',icon:Home,label:'정보'},{id:'rights',icon:AlertTriangle,label:'권리'},{id:'field',icon:MapPin,label:'임장'},{id:'calc',icon:Calculator,label:'수익'}].map(t=><button key={t.id} onClick={()=>setTab(t.id)} className={`py-3 flex items-center border-b-2 ${tab===t.id?'border-indigo-600 text-indigo-600 font-bold':'border-transparent text-slate-500'}`}><t.icon className="w-4 h-4 mr-2"/>{t.label}</button>)}</div><div className="flex-1 overflow-y-auto p-8"><div className="max-w-4xl mx-auto bg-white p-8 rounded-2xl border">{tab==='info'&&<InfoTab item={local} onChange={handleChange} onSave={()=>onUpdate(item.id,local)}/>}{tab==='rights'&&<RightsTab item={local} onChange={handleChange} onSave={()=>onUpdate(item.id,local)}/>}{tab==='field'&&<FieldTab item={local} onChange={handleChange} onSave={()=>onUpdate(item.id,local)}/>}{tab==='calc'&&<CalcTab item={local} onChange={handleChange} onSave={()=>onUpdate(item.id,local)}/>}</div></div></div>);
}
function InfoTab({ item, onChange, onSave }) { return <div className="space-y-6"><div className="grid grid-cols-2 gap-4"><InputGroup label="사건번호" value={item.caseNumber} onChange={v=>onChange('caseNumber',v)}/><InputGroup label="물건번호" value={item.itemNumber || '1'} onChange={v=>onChange('itemNumber',v)}/></div><div className="grid grid-cols-2 gap-4"><InputGroup label="관할법원" value={item.court} onChange={v=>onChange('court',v)}/><InputGroup label="현재상태" value={item.auctionStatus} onChange={v=>onChange('auctionStatus',v)}/></div><InputGroup label="종류" value={item.type} onChange={v=>onChange('type',v)} type="select" options={['아파트','빌라','오피스텔','상가','토지']}/><InputGroup label="주소" value={item.address} onChange={v=>onChange('address',v)}/><div className="grid grid-cols-2 gap-4"><InputGroup label="감정가" type="number" value={item.appraisalPrice} onChange={v=>onChange('appraisalPrice',v)}/><InputGroup label="최저가" type="number" value={item.minPrice} onChange={v=>onChange('minPrice',v)}/></div><InputGroup label="입찰일" type="date" value={item.biddingDate} onChange={v=>onChange('biddingDate',v)}/><div className="flex justify-between items-center pt-6 border-t"><div className="flex gap-2"><a href={`https://map.naver.com/v5/search/${encodeURIComponent(item.address)}`} target="_blank" rel="noreferrer" className="flex items-center px-4 py-2 bg-[#03C75A] text-white rounded-lg hover:opacity-90 text-sm font-bold"><MapPin className="w-4 h-4 mr-2"/>네이버 지도</a><a href="https://www.courtauction.go.kr/" target="_blank" rel="noreferrer" className="flex items-center px-4 py-2 bg-slate-800 text-white rounded-lg hover:opacity-90 text-sm font-bold"><Gavel className="w-4 h-4 mr-2"/>대법원 경매</a></div><SaveButton onClick={onSave}/></div></div>; }

function RightsTab({ item, onChange, onSave }) { 
  const r = item.rights || {}; 
  const isSafe = r.malsoDate && r.tenantMoveInDate && new Date(r.tenantMoveInDate) > new Date(r.malsoDate);
  const showSafeResult = r.malsoDate && r.tenantMoveInDate;

  // 강제경매 & 소액청구 -> 취하 가능성 높음
  const isCompulsory = r.auctionType === '강제경매';
  const claimAmount = Number(r.claimAmount) || 0;
  // 2천만원 미만을 소액으로 가정 (예시)
  const isHighWithdrawalChance = isCompulsory && claimAmount > 0 && claimAmount < 20000000;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b pb-2"><h2 className="font-bold text-lg text-slate-800">권리 분석</h2></div>
      
      {/* 팁 영역 */}
      {isHighWithdrawalChance && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-blue-800 flex items-start mb-4">
           <AlertTriangle className="w-5 h-5 mr-2 mt-0.5 shrink-0"/>
           <div>
             <span className="font-bold">💡 취하 가능성 높음</span>
             <p className="text-xs mt-1">강제경매 사건이며 청구금액이 소액({formatCurrency(claimAmount)}원)입니다.<br/>채무자가 빚을 갚고 경매를 취하할 가능성이 있으니 입찰 전 등기부등본을 꼭 재확인하세요.</p>
           </div>
        </div>
      )}

      {showSafeResult && (
        <div className={`p-5 rounded-xl border flex items-center ${!isSafe ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
            {!isSafe?<AlertTriangle className="mr-3"/>:<CheckCircle2 className="mr-3"/>}
            <div>
                <div className="font-bold">{!isSafe?'대항력 있음 (인수 위험)':'대항력 없음 (안전)'}</div>
                <p className="text-xs opacity-80 mt-1">임차인의 전입일이 말소기준권리보다 {!isSafe ? '빠릅니다.' : '늦습니다.'}</p>
            </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-50 p-6 rounded-2xl">
            <h3 className="font-bold mb-4 text-slate-700 flex items-center"><Gavel className="w-4 h-4 mr-2"/>경매 정보</h3>
            <div className="space-y-4">
                <InputGroup label="경매 구분" type="select" options={['임의경매', '강제경매']} value={r.auctionType} onChange={v=>onChange('auctionType',v,'rights')}/>
                <InputGroup label="청구 금액 (원)" type="number" value={r.claimAmount} onChange={v=>onChange('claimAmount',v,'rights')}/>
                <InputGroup label="배당요구 종기일" type="date" value={r.dividendDeadline} onChange={v=>onChange('dividendDeadline',v,'rights')}/>
            </div>
        </div>
        <div className="bg-slate-50 p-6 rounded-2xl">
            <h3 className="font-bold mb-4 text-slate-700 flex items-center"><User className="w-4 h-4 mr-2"/>임차인 및 말소기준</h3>
            <div className="space-y-4">
                <InputGroup label="말소기준권리 (최선순위)" type="date" value={r.malsoDate} onChange={v=>onChange('malsoDate',v,'rights')}/>
                <div className="pt-2 border-t border-slate-200">
                    <InputGroup label="임차인 전입일" type="date" value={r.tenantMoveInDate} onChange={v=>onChange('tenantMoveInDate',v,'rights')}/>
                    <InputGroup label="보증금 (원)" type="number" value={r.tenantDeposit} onChange={v=>onChange('tenantDeposit',v,'rights')}/>
                    <InputGroup label="확정일자" type="date" value={r.tenantFixDate} onChange={v=>onChange('tenantFixDate',v,'rights')}/>
                </div>
            </div>
        </div>
      </div>
      <div className="flex justify-end pt-4"><SaveButton onClick={onSave}/></div>
    </div>
  ); 
}

function FieldTab({ item, onChange, onSave }) { 
  const c = item.checklists || {}; 
  const [loading, setLoading] = useState(false); 
  const handleAi = async () => { 
    setLoading(true); 
    const res = await callGemini(`임장 분석: ${JSON.stringify(c)}, 메모: ${item.fieldNote}`); 
    onChange('aiFieldAnalysis', res); 
    setLoading(false); 
  }; 
  
  const handleCheck = (key, value) => {
    onChange(key, value, 'checklists');
  }

  return (
    <div className="space-y-8">
      {/* 1. 점유 현황 및 관리 상태 */}
      <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center"><User className="w-5 h-5 mr-2 text-indigo-600"/>1. 점유 및 관리 상태</h3>
        <div className="grid grid-cols-2 gap-6">
           <InputGroup label="점유자 파악" type="select" options={['미확인', '공실', '소유자 거주', '임차인 거주', '무단 점유']} value={c.occupancyStatus} onChange={v=>handleCheck('occupancyStatus', v)}/>
           <InputGroup label="계량기 상태" type="select" options={['미확인', '정상 작동', '멈춤 (공실 예상)']} value={c.meterStatus} onChange={v=>handleCheck('meterStatus', v)}/>
           <div className="col-span-2 grid grid-cols-2 gap-4">
             <label className="flex items-center space-x-2 p-3 bg-white rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50">
               <input type="checkbox" checked={c.isDoorLocked} onChange={e=>handleCheck('isDoorLocked', e.target.checked)} className="w-5 h-5 text-indigo-600 rounded"/>
               <span className="text-sm font-medium">현관문 잠김 (번호키/열쇠)</span>
             </label>
             <label className="flex items-center space-x-2 p-3 bg-white rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50">
               <input type="checkbox" checked={c.mailboxStatus === 'full'} onChange={e=>handleCheck('mailboxStatus', e.target.checked ? 'full' : 'empty')} className="w-5 h-5 text-indigo-600 rounded"/>
               <span className="text-sm font-medium">우편물 쌓임 (장기 부재 예상)</span>
             </label>
           </div>
        </div>
      </div>

      {/* 2. 물리적 하자 및 입지 */}
      <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center"><Home className="w-5 h-5 mr-2 text-indigo-600"/>2. 건물 상태 및 입지</h3>
        <div className="grid grid-cols-2 gap-4 mb-4">
           {[['leak', '누수 흔적 (천장/베란다)'], ['cracks', '벽체/바닥 균열'], ['mold', '결로 및 곰팡이'], ['elevator', '엘리베이터 유무']].map(([k, l]) => (
             <label key={k} className="flex items-center space-x-2 p-3 bg-white rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50">
               <input type="checkbox" checked={c[k]} onChange={e=>handleCheck(k, e.target.checked)} className="w-5 h-5 text-indigo-600 rounded"/>
               <span className="text-sm font-medium">{l}</span>
             </label>
           ))}
        </div>
        <div className="grid grid-cols-2 gap-4">
           <InputGroup label="일조량 (방향)" type="select" options={['미확인', '남향 (좋음)', '동향 (보통)', '서향 (오후)', '북향 (나쁨)']} value={c.sunlight} onChange={v=>handleCheck('sunlight', v)}/>
           <InputGroup label="주차 공간" type="select" options={['미확인', '여유', '보통', '협소 (이중주차)']} value={c.parking} onChange={v=>handleCheck('parking', v)}/>
        </div>
      </div>

      {/* 3. 시세 조사 */}
      <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center"><TrendingUp className="w-5 h-5 mr-2 text-indigo-600"/>3. 시세 조사 (부동산 방문)</h3>
        <div className="grid grid-cols-2 gap-4">
           <InputGroup label="매물 호가" placeholder="예: 3억 5천" value={c.marketPrice} onChange={v=>handleCheck('marketPrice', v)}/>
           <InputGroup label="급매가" placeholder="예: 3억 2천" value={c.forcedSalePrice} onChange={v=>handleCheck('forcedSalePrice', v)}/>
           <InputGroup label="실거래가 (최근)" placeholder="예: 3억 3천" value={c.transactionPrice} onChange={v=>handleCheck('transactionPrice', v)}/>
           <InputGroup label="미납 관리비" placeholder="예: 50만원" value={c.managementFee} onChange={v=>handleCheck('managementFee', v)}/>
        </div>
      </div>

      {/* 메모 및 AI 분석 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
            <h3 className="font-bold mb-4 text-slate-700">현장 메모</h3>
            <textarea className="w-full h-40 border border-slate-200 rounded-xl p-4 focus:ring-2 focus:ring-indigo-500 outline-none resize-none bg-white" placeholder="중개사님 코멘트, 현장 특이사항 등을 기록하세요." value={item.fieldNote||''} onChange={e => onChange('fieldNote', e.target.value)}/>
        </div>
        <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100 flex flex-col">
            <div className="flex justify-between mb-4">
                <h3 className="font-bold text-indigo-900 flex items-center"><Sparkles className="w-5 h-5 mr-2 text-indigo-600"/>AI 종합 분석</h3>
                <button onClick={handleAi} disabled={loading} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-xs hover:bg-indigo-700 transition-colors disabled:bg-indigo-400">{loading?'분석 중...':'✨ 분석 실행'}</button>
            </div>
            <textarea className="w-full flex-1 bg-white/50 border border-indigo-200 rounded-xl p-4 text-sm" value={item.aiFieldAnalysis||''} onChange={e => onChange('aiFieldAnalysis', e.target.value)} placeholder="위 체크리스트 내용을 바탕으로 AI가 임장 보고서를 작성해줍니다."/>
        </div>
      </div>
      
      <div className="flex justify-end pt-4 border-t"><SaveButton onClick={onSave}/></div>
    </div>
  ); 
}

function CalcTab({ item, onChange, onSave }) {
  const f = item.financials || {};
  const [loading, setLoading] = useState(false);

  // 1. 취득 비용 계산
  const bidPrice = Number(f.expectedBidPrice) || 0;
  const acqTaxRate = Number(f.acquisitionTaxRate) || 1.1;
  const acqTax = bidPrice * (acqTaxRate / 100);
  const legalCost = Number(f.legalCost) || 0;
  const repairCost = Number(f.repairCost) || 0;
  const movingCost = Number(f.movingCost) || 0;
  const totalCost = bidPrice + acqTax + legalCost + repairCost + movingCost;

  // 2. 대출/임대 (레버리지)
  const loanAmount = Number(f.loanAmount) || 0;
  const loanRate = Number(f.loanRate) || 4.5;
  const monthlyInterest = (loanAmount * (loanRate / 100)) / 12;
  const deposit = Number(f.deposit) || 0;
  const monthlyRent = Number(f.monthlyRent) || 0;
  const realInvestment = totalCost - loanAmount - deposit; // 실투자금

  // 3. 수익률 계산
  const monthlyNet = monthlyRent - monthlyInterest; // 월 순수익
  const yieldRate = realInvestment > 0 ? (monthlyNet * 12 / realInvestment) * 100 : 0;

  // 4. 매도 시나리오 (기본값)
  const sellPrice = Number(f.sellPrice) || 0;
  const capitalGainsTax = Number(f.capitalGainsTax) || 0; // This is usually auto-calculated, but kept here for legacy compatibility if needed
  
  // New Calculation Logic based on Seller Type (Individual vs Business)
  const sellerType = f.sellerType || 'individual'; // individual, business
  const holdingPeriod = Number(f.holdingPeriod) || 1; // 1: <1yr, 2: 1~2yr, 3: >2yr
  const is85Over = f.isSmallSize === false; // false means over 85m2

  // Simple Capital Gains for Individual (Short-term focus)
  // <1 yr: 70%, 1-2 yr: 60% (Adjusted for local tax: 77%, 66%)
  // Business: Progressive Tax (6-45%) + 10% Local Tax
  
  const profitBeforeTax = sellPrice - totalCost;
  
  let calculatedTax = 0;
  let vat = 0; // Value Added Tax (Business only, >85m2)

  // VAT Calculation (Simplified: 10% of building price, assume building is 50% of sell price for estimation?)
  // Actually, for simplicity in this tool, let's assume VAT is applicable on the profit portion or a fixed ratio if user selects business + >85m2.
  // Video says: Business > 85m2 -> 10% VAT on Building Price. 
  // Let's keep it simple: If Business & >85m2, warn user or estimate 10% of (SellPrice * 0.6) as rough building value.
  // Better: Just focus on Income Tax difference for now as per video emphasis on short-term gains.

  if (profitBeforeTax > 0) {
    if (sellerType === 'individual') {
      // Individual Tax Rates (Short term focus)
      let rate = 0;
      if (holdingPeriod === 1) rate = 0.77; // 70% + 10% local
      else if (holdingPeriod === 2) rate = 0.66; // 60% + 10% local
      else rate = 0.06; // Basic rate (simplified low tier) - User should check detail
      
      // Basic rate is complex, let's stick to short term emphasis or basic progressive
      if (holdingPeriod >= 3) {
         calculatedTax = calculateIncomeTax(profitBeforeTax) * 1.1; // Basic progressive + 10% local
      } else {
         calculatedTax = profitBeforeTax * rate;
      }
    } else {
      // Business Tax Rates (Progressive 6-45% + 10% local)
      // They can deduct more expenses (interest etc), but here we use profitBeforeTax as base
      // Real profit for business = profitBeforeTax - (Interest * months held) ... 
      // Let's assume held for 6 months for "Short term" flip
      const monthsHeld = 6;
      const totalInterest = monthlyInterest * monthsHeld;
      const businessProfit = profitBeforeTax - totalInterest; // Deduct interest expense
      
      calculatedTax = calculateIncomeTax(businessProfit) * 1.1; // Progressive + 10% local
    }
  }
  
  const netProfitFinal = profitBeforeTax - calculatedTax;

  const handleAi = async () => {
    setLoading(true);
    const prompt = `경매 수익률 정밀 분석 (유형: ${sellerType === 'individual' ? '개인' : '매매사업자'}):
    낙찰가: ${formatCurrency(bidPrice)}원
    총비용: ${formatCurrency(totalCost)}원
    대출: ${formatCurrency(loanAmount)}원 (금리 ${loanRate}%)
    실투자금: ${formatCurrency(realInvestment)}원
    예상매도가: ${formatCurrency(sellPrice)}원
    세전차익: ${formatCurrency(profitBeforeTax)}원
    예상세금: ${formatCurrency(calculatedTax)}원 (${sellerType === 'individual' ? (holdingPeriod === 1 ? '1년미만 77%' : '일반/중기') : '사업소득세'})
    순수익: ${formatCurrency(netProfitFinal)}원
    
    이 물건의 투자가치와 ${sellerType === 'business' ? '매매사업자로서의 장단점' : '개인 투자시 세금 리스크'}를 분석해줘.`;
    const res = await callGemini(prompt);
    onChange('aiStrategy', res);
    setLoading(false);
  };

  return (
    <div className="space-y-8">
      {/* Type Selection */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center"><Scale className="w-5 h-5 mr-2 text-indigo-600"/>투자 유형 설정 (세금 비교)</h3>
        <div className="grid grid-cols-2 gap-4">
            <button 
                onClick={() => onChange('sellerType', 'individual', 'financials')}
                className={`p-3 rounded-lg border-2 font-bold text-sm transition-all flex items-center justify-center ${f.sellerType !== 'business' ? 'border-indigo-600 text-indigo-600 bg-indigo-50' : 'border-slate-200 text-slate-400 hover:border-slate-300'}`}
            >
                <User className="w-4 h-4 mr-2"/> 개인 (양도세)
            </button>
            <button 
                onClick={() => onChange('sellerType', 'business', 'financials')}
                className={`p-3 rounded-lg border-2 font-bold text-sm transition-all flex items-center justify-center ${f.sellerType === 'business' ? 'border-indigo-600 text-indigo-600 bg-indigo-50' : 'border-slate-200 text-slate-400 hover:border-slate-300'}`}
            >
                <Briefcase className="w-4 h-4 mr-2"/> 매매사업자 (소득세)
            </button>
        </div>
        
        {f.sellerType === 'business' ? (
             <div className="mt-4 p-3 bg-blue-50 text-blue-800 text-xs rounded-lg">
                <p className="font-bold mb-1">💡 매매사업자 체크포인트</p>
                <ul className="list-disc pl-4 space-y-1">
                    <li>단기 매도 시 세율 유리 (6~45% 누진세 vs 개인 77%)</li>
                    <li>대출 이자, 수리비 등 필요경비 인정 범위 넓음</li>
                    <li className="text-red-600">주의: 건강보험료/국민연금 추가 발생 가능성</li>
                    <li>85㎡ 초과 시 부가세(VAT) 10% 발생</li>
                </ul>
             </div>
        ) : (
            <div className="mt-4 flex gap-4">
                <label className="flex items-center text-sm text-slate-600">
                    <span className="mr-2 font-bold">보유 기간:</span>
                    <select 
                        value={f.holdingPeriod || 1} 
                        onChange={(e) => onChange('holdingPeriod', Number(e.target.value), 'financials')}
                        className="border rounded px-2 py-1"
                    >
                        <option value={1}>1년 미만 (77%)</option>
                        <option value={2}>2년 미만 (66%)</option>
                        <option value={3}>2년 이상 (기본세율)</option>
                    </select>
                </label>
            </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* 취득 비용 섹션 */}
        <div className="space-y-4">
            <h3 className="font-bold text-indigo-600 border-b border-indigo-100 pb-2 flex items-center"><Gavel className="w-4 h-4 mr-2"/>1. 취득 비용</h3>
            <InputGroup label="예상 낙찰가" type="number" value={f.expectedBidPrice} onChange={v => onChange('expectedBidPrice', v, 'financials')}/>
            <div className="grid grid-cols-2 gap-4">
                <InputGroup label="취등록세율(%)" type="number" value={f.acquisitionTaxRate} onChange={v => onChange('acquisitionTaxRate', v, 'financials')}/>
                <InputGroup label="법무사비 등" type="number" value={f.legalCost} onChange={v => onChange('legalCost', v, 'financials')}/>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <InputGroup label="명도비(이사비)" type="number" value={f.movingCost} onChange={v => onChange('movingCost', v, 'financials')}/>
                <InputGroup label="수리비" type="number" value={f.repairCost} onChange={v => onChange('repairCost', v, 'financials')}/>
            </div>
            <div className="bg-indigo-50 p-3 rounded-xl flex justify-between text-sm font-bold text-indigo-900">
                <span>총 취득가 (세금포함)</span><span>{formatCurrency(totalCost)} 원</span>
            </div>
        </div>

        {/* 자금 계획 섹션 */}
        <div className="space-y-4">
            <h3 className="font-bold text-indigo-600 border-b border-indigo-100 pb-2 flex items-center"><Home className="w-4 h-4 mr-2"/>2. 자금 계획</h3>
            <div className="grid grid-cols-2 gap-4">
                <InputGroup label="대출금" type="number" value={f.loanAmount} onChange={v => onChange('loanAmount', v, 'financials')}/>
                <InputGroup label="금리(%)" type="number" value={f.loanRate} onChange={v => onChange('loanRate', v, 'financials')}/>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-dashed">
                <InputGroup label="임대 보증금" type="number" value={f.deposit} onChange={v => onChange('deposit', v, 'financials')}/>
                <InputGroup label="월세" type="number" value={f.monthlyRent} onChange={v => onChange('monthlyRent', v, 'financials')}/>
            </div>
             <div className="bg-slate-100 p-3 rounded-xl flex justify-between text-sm font-bold text-slate-700">
                <span>실 투자금 (Equity)</span><span>{formatCurrency(realInvestment)} 원</span>
            </div>
        </div>
      </div>

      {/* 매도 및 결과 섹션 */}
      <div className="space-y-4">
         <h3 className="font-bold text-indigo-600 border-b border-indigo-100 pb-2 flex items-center"><TrendingUp className="w-4 h-4 mr-2"/>3. 수익 분석 ({sellerType === 'business' ? '매매사업자' : '개인'})</h3>
         <div className="grid grid-cols-2 gap-4 mb-4">
            <InputGroup label="예상 매도가" type="number" value={f.sellPrice} onChange={v => onChange('sellPrice', v, 'financials')}/>
            <div className="p-1">
                <div className="text-xs text-slate-500 mb-1">예상 세금 (자동계산)</div>
                <div className="font-bold text-red-500 text-lg">{formatCurrency(Math.floor(calculatedTax))} 원</div>
                <div className="text-[10px] text-slate-400">
                    {sellerType === 'individual' 
                        ? (holdingPeriod === 1 ? '단기(1년미만) 77%' : holdingPeriod === 2 ? '단기(2년미만) 66%' : '기본세율') 
                        : '종합소득세율 (6~45%)'}
                </div>
            </div>
         </div>
         
         <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-lg grid grid-cols-2 gap-8">
            <div>
                <p className="text-slate-400 text-xs mb-1">임대 수익률 (연)</p>
                <div className="text-3xl font-bold text-yellow-400">{yieldRate.toFixed(2)}%</div>
                <p className="text-xs text-slate-500 mt-1">월 순수익: {formatCurrency(Math.floor(monthlyNet))}원</p>
            </div>
            <div className="border-l border-slate-700 pl-8">
                <p className="text-slate-400 text-xs mb-1">매도 시 순차익 (세후)</p>
                <div className={`text-3xl font-bold ${netProfitFinal > 0 ? 'text-green-400' : 'text-red-400'}`}>{netProfitFinal > 0 ? '+' : ''}{formatCurrency(Math.floor(netProfitFinal))}</div>
                <p className="text-xs text-slate-500 mt-1">세전 차익: {formatCurrency(profitBeforeTax)}원</p>
            </div>
         </div>
      </div>

      {/* AI 전략 */}
      <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
        <div className="flex justify-between items-center mb-4"><h3 className="font-bold flex items-center text-slate-800"><Bot className="w-5 h-5 mr-2 text-indigo-600"/>AI 투자 전략</h3><button onClick={handleAi} disabled={loading} className="bg-slate-800 hover:bg-slate-900 text-white text-sm font-bold px-4 py-2 rounded-lg disabled:bg-slate-400">{loading?'분석 중...':'✨ 전략 제안'}</button></div>
        <textarea className="w-full h-24 text-sm bg-white border border-slate-300 rounded-xl p-4 resize-none" value={item.aiStrategy||''} onChange={e => onChange('aiStrategy', e.target.value)} placeholder="위 데이터를 바탕으로 AI가 상세한 투자 전략을 제시합니다."/>
      </div>
      <div className="flex justify-end pt-4 border-t"><SaveButton onClick={onSave}/></div>
    </div>
  );
}

function InputGroup({ label, value, onChange, type='text', options }) { return <div className="w-full">{label&&<label className="block text-xs text-slate-500 mb-1">{label}</label>}{type==='select'?<select value={value||''} onChange={e=>onChange(e.target.value)} className="w-full border rounded p-2">{options.map(o=><option key={o}>{o}</option>)}</select>:<input type={type} value={value||''} onChange={e=>onChange(e.target.value)} className="w-full border rounded p-2"/>}</div>; }
function SaveButton({onClick}) { return <button onClick={onClick} className="bg-indigo-600 text-white px-4 py-2 rounded font-bold text-sm">저장</button>; }
function getStatusColor(s) { return ({'관심':'bg-blue-100 text-blue-600','권리분석':'bg-yellow-100 text-yellow-700','임장중':'bg-green-100 text-green-700','입찰준비':'bg-red-100 text-red-600','낙찰':'bg-purple-100 text-purple-700'}[s]||'bg-slate-100'); }
