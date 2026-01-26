import React, { useState, useEffect, useMemo } from 'react';
import { 
  Gavel, Home, Calculator, ClipboardList, Calendar, AlertTriangle, 
  CheckCircle2, Plus, Trash2, Save, ArrowLeft, Search, ExternalLink, 
  MapPin, Sparkles, Bot, LogIn, LogOut, Lock
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
  getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, 
  onSnapshot, query, serverTimestamp 
} from "firebase/firestore";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🔴 [필수] 본인의 구글 이메일을 따옴표 안에 적어주세요! (로그인용)
// 예시: const ALLOWED_EMAIL = "honggildong@gmail.com";
const ALLOWED_EMAIL = ""; 

// 🟡 [선택] AI 기능을 쓰려면 Gemini API 키를 넣어주세요. (없으면 비워두세요)
const apiKey = "AIzaSyB2Ni95d2qjT8VjA0d4-Hll4y-SswvwFf4"; 
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// --- Firebase 설정 (사장님 전용 키 적용완료) ---
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

// 로컬/웹 배포용 고정 ID
const appId = 'auction-manager-v1';

// --- Gemini API 호출 함수 ---
const callGemini = async (prompt) => {
  if (!apiKey) return "API 키가 설정되지 않았습니다. 코드 상단에 키를 입력해주세요.";
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
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
const formatCurrency = (value) => value ? new Intl.NumberFormat('ko-KR').format(value) : '0';
const getDday = (targetDate) => {
  if (!targetDate) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(targetDate); target.setHours(0, 0, 0, 0);
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
};

// --- 메인 컴포넌트 ---
export default function AuctionManager() {
  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [view, setView] = useState('dashboard');
  const [selectedItem, setSelectedItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // 인증 및 데이터 불러오기
  useEffect(() => {
    // [수정됨] 충돌을 일으키는 미리보기용 자동 로그인 코드를 제거했습니다.
    // 이제 사장님의 Firebase 설정만 사용하여 로그인을 처리합니다.

    // 인증 상태 감지
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setLoading(false);
      
      if (currentUser) {
        // 보안 체크: 설정된 이메일과 다르면 로그아웃
        if (ALLOWED_EMAIL && currentUser.email !== ALLOWED_EMAIL) {
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

    // Firestore에서 내 데이터만 가져오기
    const q = query(
      collection(db, 'artifacts', appId, 'users', user.uid, 'auction_items')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // 최신순 정렬
      fetchedItems.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setItems(fetchedItems);
    }, (error) => console.error("Firestore Error:", error));

    return () => unsubscribe();
  }, [user]);

  // 액션 함수들
  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login Failed", error);
      setAuthError("로그인에 실패했습니다. 팝업 차단을 확인해주세요.");
    }
  };

  const handleLogout = () => signOut(auth);

  const handleAddItem = async (newItem) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'auction_items'), {
        ...newItem,
        createdAt: serverTimestamp(),
        status: '관심',
        checklists: { leak: false, sunlight: false, parking: false, managementFee: false },
        rights: { malsoDate: '', tenantMoveInDate: '', tenantFixDate: '', tenantDeposit: '', isDangerous: false },
        financials: { expectedBidPrice: '', acquisitionTaxRate: 1.1, repairCost: '', movingCost: '', sellPrice: '', monthlyRent: '', deposit: '' },
        aiFieldAnalysis: '', aiStrategy: ''
      });
      setView('list');
    } catch (error) {
      alert("저장 실패: " + error.message);
    }
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

  // --- 로그인 화면 ---
  if (!user && !loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-100 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-lg max-w-sm w-full text-center">
          <div className="bg-indigo-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Gavel className="w-8 h-8 text-indigo-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">경매 관리자</h1>
          <p className="text-slate-500 mb-6 text-sm">
            데이터를 안전하게 저장하기 위해<br/>구글 계정으로 로그인해주세요.
          </p>
          
          {authError && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 mr-2" />
              {authError}
            </div>
          )}

          <button 
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium py-3 rounded-xl transition-all shadow-sm group hover:border-indigo-200"
          >
             <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            <span className="group-hover:text-indigo-600 transition-colors">Google 계정으로 시작하기</span>
          </button>
        </div>
      </div>
    );
  }

  if (loading) return <div className="h-screen flex items-center justify-center"><div className="animate-spin w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full"/></div>;

  return (
    <div className="flex h-screen bg-slate-100 text-slate-800 font-sans overflow-hidden">
      {/* 사이드바 */}
      <aside className="w-20 lg:w-64 bg-white border-r border-slate-200 flex flex-col justify-between shrink-0 transition-all">
        <div>
          <div className="h-16 flex items-center justify-center lg:justify-start lg:px-6 border-b border-slate-100">
            <Gavel className="w-8 h-8 text-indigo-600" />
            <span className="hidden lg:block ml-3 font-bold text-xl">Auction Mgr</span>
          </div>
          <nav className="mt-6 px-2 space-y-2">
            <SidebarItem icon={Home} label="대시보드" active={view === 'dashboard'} onClick={() => setView('dashboard')} />
            <SidebarItem icon={ClipboardList} label="물건 관리" active={view === 'list' || view === 'add' || view === 'detail'} onClick={() => setView('list')} />
          </nav>
        </div>
        <div className="p-4">
          <div className="hidden lg:block mb-4 px-2">
             <p className="text-xs text-slate-400">접속 계정:</p>
             <p className="text-xs font-bold text-slate-700 truncate">{user?.email}</p>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center justify-center lg:justify-start p-2 text-slate-500 hover:bg-slate-50 rounded-lg text-sm hover:text-red-500 transition-colors">
            <LogOut className="w-5 h-5 lg:mr-2" />
            <span className="hidden lg:inline">로그아웃</span>
          </button>
        </div>
      </aside>

      {/* 메인 콘텐츠 영역 */}
      <main className="flex-1 overflow-y-auto">
        {view === 'dashboard' && <Dashboard items={items} onViewChange={setView} onItemSelect={setSelectedItem} />}
        {view === 'list' && <ItemList items={items} onItemSelect={(item) => { setSelectedItem(item); setView('detail'); }} onAddClick={() => setView('add')} />}
        {view === 'add' && <AddItemForm onCancel={() => setView('list')} onSave={handleAddItem} />}
        {view === 'detail' && selectedItem && (
          <ItemDetail 
            item={selectedItem} 
            onBack={() => setView('list')} 
            onUpdate={handleUpdateItem} 
            onDelete={handleDeleteItem} 
          />
        )}
      </main>
    </div>
  );
}

// --- 하위 컴포넌트들 ---
function SidebarItem({ icon: Icon, label, active, onClick }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center justify-center lg:justify-start p-3 rounded-xl transition-colors ${active ? 'bg-indigo-50 text-indigo-600 font-bold' : 'text-slate-500 hover:bg-slate-50'}`}>
      <Icon className="w-6 h-6" /> <span className="hidden lg:block ml-3 font-medium">{label}</span>
    </button>
  );
}

function Dashboard({ items, onViewChange, onItemSelect }) {
  const stats = useMemo(() => ({
    total: items.length,
    interested: items.filter(i => i.status === '관심').length,
    analyzing: items.filter(i => i.status === '권리분석').length,
    field: items.filter(i => i.status === '임장중').length,
    bidding: items.filter(i => i.status === '입찰준비').length,
  }), [items]);
  const upcoming = items.filter(i => i.biddingDate && getDday(i.biddingDate) >= 0).sort((a, b) => new Date(a.biddingDate) - new Date(b.biddingDate)).slice(0, 5);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="mb-8"><h1 className="text-2xl font-bold">대시보드</h1></header>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard title="관심 물건" count={stats.interested} color="bg-blue-500" />
        <StatCard title="권리 분석 중" count={stats.analyzing} color="bg-yellow-500" />
        <StatCard title="임장 진행 중" count={stats.field} color="bg-green-500" />
        <StatCard title="입찰 준비" count={stats.bidding} color="bg-red-500" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <div className="flex justify-between items-center mb-4">
             <h2 className="font-bold flex items-center text-lg"><Calendar className="w-5 h-5 mr-2 text-indigo-600"/> 다가오는 입찰</h2>
             <button onClick={() => onViewChange('list')} className="text-xs text-indigo-600 font-bold hover:underline">전체보기</button>
          </div>
          <div className="space-y-3">
            {upcoming.length === 0 ? <p className="text-slate-400 text-center py-4 text-sm">예정된 입찰이 없습니다.</p> : upcoming.map(item => (
            <div key={item.id} onClick={() => {onItemSelect(item); setView('detail');}} className="flex justify-between items-center p-3 border rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
              <div><div className="font-bold text-sm text-slate-800">{item.caseNumber}</div><div className="text-xs text-slate-500">{item.address}</div></div>
              <div className={`text-xs font-bold px-2 py-1 rounded ${getDday(item.biddingDate) <= 3 ? 'bg-red-100 text-red-600' : 'bg-indigo-100 text-indigo-600'}`}>D-{getDday(item.biddingDate)}</div>
            </div>
          ))}</div>
        </div>
        <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-6 text-white shadow-lg flex flex-col justify-between">
          <div>
            <h2 className="font-bold mb-4 flex items-center text-lg"><CheckCircle2 className="w-5 h-5 mr-2"/>오늘의 체크포인트</h2>
            <ul className="text-sm space-y-3 text-indigo-100 mb-6">
              <li className="flex items-start"><span className="mr-2">•</span>말소기준권리 날짜 재확인 (가장 빠른 근저당/압류)</li>
              <li className="flex items-start"><span className="mr-2">•</span>관리사무소 방문하여 체납 관리비 확인</li>
            </ul>
          </div>
          <button onClick={() => onViewChange('add')} className="w-full py-3 bg-white text-indigo-600 font-bold rounded-xl hover:bg-indigo-50 transition-colors shadow-md">새 물건 등록하기</button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, count, color }) {
  return <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center hover:shadow-md transition-shadow"><div><div className="text-xs text-slate-500 font-medium mb-1">{title}</div><div className="text-2xl font-bold text-slate-800">{count}</div></div><div className={`w-1.5 h-10 ${color} rounded-full opacity-80`}></div></div>;
}

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
          <select value={filter} onChange={e => setFilter(e.target.value)} className="border rounded-lg px-4 py-2 text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"><option>전체</option><option>관심</option><option>권리분석</option><option>임장중</option><option>입찰준비</option><option>완료</option></select>
          <button onClick={onAddClick} className="bg-indigo-600 text-white px-5 py-2 rounded-lg flex items-center font-bold text-sm hover:bg-indigo-700 transition-colors shadow-sm"><Plus className="w-4 h-4 mr-2"/>물건 등록</button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map(item => (
          <div key={item.id} onClick={() => onItemSelect(item)} className="bg-white p-6 rounded-2xl border border-slate-100 hover:shadow-lg hover:border-indigo-200 cursor-pointer transition-all">
            <div className="flex justify-between mb-3"><span className={`text-xs px-2 py-1 rounded font-bold ${getStatusColor(item.status)}`}>{item.status}</span><span className="text-xs text-slate-400 font-medium">{item.type}</span></div>
            <h3 className="font-bold text-lg mb-1 text-slate-900">{item.caseNumber}</h3>
            <p className="text-sm text-slate-500 truncate mb-5">{item.address || '주소 미입력'}</p>
            <div className="flex justify-between text-sm border-t border-slate-50 pt-4">
              <div className="flex flex-col"><span className="text-xs text-slate-400">감정가</span><span className="font-bold text-slate-800">{formatCurrency(item.appraisalPrice)}</span></div>
              <div className="flex flex-col items-end"><span className="text-xs text-slate-400">입찰일</span><span className={`font-bold ${getDday(item.biddingDate) <= 3 ? 'text-red-500' : 'text-slate-800'}`}>{item.biddingDate || '-'}</span></div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="col-span-full py-20 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">등록된 물건이 없습니다.</div>}
      </div>
    </div>
  );
}

function AddItemForm({ onCancel, onSave }) {
  const [form, setForm] = useState({ caseNumber: '', type: '아파트', address: '', appraisalPrice: '', minPrice: '', biddingDate: '' });
  return (
    <div className="p-8 max-w-2xl mx-auto">
      <button onClick={onCancel} className="mb-4 flex items-center text-slate-500 hover:text-slate-800"><ArrowLeft className="w-4 h-4 mr-1"/>목록으로 돌아가기</button>
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="text-2xl font-bold mb-8 text-slate-900">새 물건 등록</h2>
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <InputGroup label="사건번호" placeholder="2024타경1234" value={form.caseNumber} onChange={v => setForm({...form, caseNumber: v})} />
            <InputGroup label="물건 종류" type="select" options={['아파트','빌라/다세대','오피스텔','상가','토지']} value={form.type} onChange={v => setForm({...form, type: v})} />
          </div>
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
  
  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="bg-white px-8 py-5 border-b border-slate-200 flex justify-between items-center shadow-sm z-10">
        <div className="flex items-center gap-4"><button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full"><ArrowLeft className="w-5 h-5 text-slate-600"/></button><div><div className="flex items-center gap-2"><h1 className="font-bold text-xl text-slate-900">{local.caseNumber}</h1><span className={`text-xs px-2 py-0.5 rounded font-bold ${getStatusColor(local.status)}`}>{local.status}</span></div><p className="text-sm text-slate-500 mt-0.5">{local.address}</p></div></div>
        <div className="flex gap-2"><select value={local.status} onChange={e => {handleChange('status', e.target.value); onUpdate(item.id, {...local, status: e.target.value})}} className="border rounded-lg px-3 py-1.5 text-sm bg-slate-50"><option>관심</option><option>권리분석</option><option>임장중</option><option>입찰준비</option><option>낙찰</option><option>패찰</option><option>완료</option></select><button onClick={() => onDelete(item.id)} className="text-red-500 p-2 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-5 h-5"/></button></div>
      </div>
      <div className="bg-white px-8 border-b border-slate-200 flex gap-8">
        {[
          {id:'info', icon:Home, label:'기본 정보'}, {id:'rights', icon:AlertTriangle, label:'권리 분석'},
          {id:'field', icon:MapPin, label:'임장 리포트'}, {id:'calc', icon:Calculator, label:'수익률 계산'}
        ].map(t => <button key={t.id} onClick={() => setTab(t.id)} className={`py-4 flex items-center border-b-2 text-sm transition-colors ${tab === t.id ? 'border-indigo-600 text-indigo-600 font-bold' : 'border-transparent text-slate-500 hover:text-slate-800'}`}><t.icon className="w-4 h-4 mr-2"/>{t.label}</button>)}
      </div>
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-4xl mx-auto bg-white p-8 rounded-2xl border border-slate-200 shadow-sm min-h-[500px]">
          {tab === 'info' && <InfoTab item={local} onChange={handleChange} onSave={() => onUpdate(item.id, local)} />}
          {tab === 'rights' && <RightsTab item={local} onChange={handleChange} onSave={() => onUpdate(item.id, local)} />}
          {tab === 'field' && <FieldTab item={local} onChange={handleChange} onSave={() => onUpdate(item.id, local)} />}
          {tab === 'calc' && <CalcTab item={local} onChange={handleChange} onSave={() => onUpdate(item.id, local)} />}
        </div>
      </div>
    </div>
  );
}

function InfoTab({ item, onChange, onSave }) {
  return <div className="space-y-8">
    <div className="grid grid-cols-2 gap-8"><InputGroup label="사건번호" value={item.caseNumber} onChange={v => onChange('caseNumber', v)}/><InputGroup label="물건 종류" value={item.type} onChange={v => onChange('type', v)} type="select" options={['아파트','빌라/다세대','오피스텔','상가','토지']}/></div>
    <InputGroup label="소재지 (주소)" value={item.address} onChange={v => onChange('address', v)}/>
    <div className="grid grid-cols-2 gap-8"><InputGroup label="감정가" type="number" value={item.appraisalPrice} onChange={v => onChange('appraisalPrice', v)}/><InputGroup label="최저가" type="number" value={item.minPrice} onChange={v => onChange('minPrice', v)}/></div>
    <InputGroup label="입찰 기일" type="date" value={item.biddingDate} onChange={v => onChange('biddingDate', v)}/>
    <div className="flex justify-between items-center pt-6 border-t">
      <div className="flex gap-2">
        <a href={`https://map.naver.com/v5/search/${encodeURIComponent(item.address)}`} target="_blank" rel="noreferrer" className="flex items-center px-4 py-2 bg-[#03C75A] text-white rounded-lg hover:opacity-90 text-sm font-bold"><MapPin className="w-4 h-4 mr-2"/>네이버 지도</a>
        <a href="https://www.courtauction.go.kr/" target="_blank" rel="noreferrer" className="flex items-center px-4 py-2 bg-slate-800 text-white rounded-lg hover:opacity-90 text-sm font-bold"><ExternalLink className="w-4 h-4 mr-2"/>대법원 경매</a>
      </div>
      <SaveButton onClick={onSave}/>
    </div>
  </div>;
}

function RightsTab({ item, onChange, onSave }) {
  const r = item.rights || {};
  const isSafe = r.malsoDate && r.tenantMoveInDate && new Date(r.tenantMoveInDate) > new Date(r.malsoDate);
  const showResult = r.malsoDate && r.tenantMoveInDate;
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center pb-2 border-b"><h2 className="font-bold text-lg">권리 분석</h2><span className="text-xs text-slate-500">* 날짜를 입력하면 자동으로 분석됩니다.</span></div>
      {showResult && (
        <div className={`p-5 rounded-xl border flex items-center ${!isSafe ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
          {!isSafe ? <AlertTriangle className="w-6 h-6 mr-3"/> : <CheckCircle2 className="w-6 h-6 mr-3"/>}
          <div><div className="font-bold text-lg">{!isSafe ? '대항력 있음 (인수 위험)' : '대항력 없음 (안전)'}</div><div className="text-sm opacity-80">{!isSafe ? '임차인의 전입일이 말소기준권리보다 빠릅니다.' : '임차인의 전입일이 말소기준권리보다 늦습니다.'}</div></div>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-slate-50 p-6 rounded-2xl"><h3 className="font-bold mb-4 text-slate-700">말소기준권리</h3><InputGroup type="date" label="권리 설정일 (최선순위)" value={r.malsoDate} onChange={v => onChange('malsoDate', v, 'rights')}/></div>
        <div className="bg-slate-50 p-6 rounded-2xl"><h3 className="font-bold mb-4 text-slate-700">임차인 정보</h3><div className="space-y-4"><InputGroup label="전입일자" type="date" value={r.tenantMoveInDate} onChange={v => onChange('tenantMoveInDate', v, 'rights')}/><InputGroup label="확정일자" type="date" value={r.tenantFixDate} onChange={v => onChange('tenantFixDate', v, 'rights')}/><InputGroup label="보증금 (원)" type="number" value={r.tenantDeposit} onChange={v => onChange('tenantDeposit', v, 'rights')}/></div></div>
      </div>
      <div className="flex justify-end pt-4 border-t"><SaveButton onClick={onSave}/></div>
    </div>
  );
}

function FieldTab({ item, onChange, onSave }) {
  const c = item.checklists || {};
  const [loading, setLoading] = useState(false);
  const handleAi = async () => {
    setLoading(true);
    const res = await callGemini(`부동산 임장 분석: ${item.type}, 상태: ${JSON.stringify(c)}, 메모: ${item.fieldNote}. 위험요소와 수리필요사항 요약해줘.`);
    onChange('aiFieldAnalysis', res); setLoading(false);
  };
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div><h3 className="font-bold mb-4 text-slate-700">체크리스트</h3><div className="space-y-3">{[['leak','누수 흔적 (천장/베란다)'],['sunlight','일조량 및 방향'],['parking','주차 공간 확보'],['managementFee','체납 관리비 확인']].map(([k,l]) => <div key={k} onClick={() => onChange(k, !c[k], 'checklists')} className={`p-4 border rounded-xl flex items-center cursor-pointer transition-all ${c[k] ? 'bg-indigo-50 border-indigo-200' : 'hover:bg-slate-50'}`}><div className={`w-5 h-5 border rounded flex items-center justify-center mr-3 ${c[k]?'bg-indigo-600 border-indigo-600':''}`}>{c[k]&&<CheckCircle2 className="w-3.5 h-3.5 text-white"/>}</div><span className={c[k]?'text-indigo-900 font-medium':'text-slate-600'}>{l}</span></div>)}</div></div>
        <div><h3 className="font-bold mb-4 text-slate-700">현장 메모</h3><textarea className="w-full h-64 border border-slate-200 rounded-xl p-4 focus:ring-2 focus:ring-indigo-500 outline-none resize-none" placeholder="인근 부동산 시세, 급매가, 현장 분위기 등을 자유롭게 기록하세요." value={item.fieldNote||''} onChange={e => onChange('fieldNote', e.target.value)}/></div>
      </div>
      <div className="bg-gradient-to-br from-indigo-50 to-white p-6 rounded-2xl border border-indigo-100">
        <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-indigo-900 flex items-center"><Sparkles className="w-5 h-5 mr-2 text-indigo-600"/>AI 현장 분석 리포트</h3><button onClick={handleAi} disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold px-4 py-2 rounded-lg shadow-sm transition-colors disabled:bg-indigo-300">{loading?'분석 중...':'✨ AI 분석 생성'}</button></div>
        <textarea className="w-full h-32 text-sm bg-white/50 border border-indigo-200 rounded-xl p-4 leading-relaxed" value={item.aiFieldAnalysis||''} onChange={e => onChange('aiFieldAnalysis', e.target.value)} placeholder="AI가 체크리스트와 메모를 바탕으로 현장 상태를 분석해드립니다."/>
      </div>
      <div className="flex justify-end pt-4 border-t"><SaveButton onClick={onSave}/></div>
    </div>
  );
}

function CalcTab({ item, onChange, onSave }) {
  const f = item.financials || {};
  const [loading, setLoading] = useState(false);
  const total = (Number(f.expectedBidPrice)||0) * (1 + (Number(f.acquisitionTaxRate)||1.1)/100) + Number(f.repairCost||0) + Number(f.movingCost||0);
  const profit = (Number(f.sellPrice)||0) - total;
  const realInvest = total - (Number(f.deposit)||0);
  const yieldRate = realInvest > 0 ? ((Number(f.monthlyRent)||0) * 12 / realInvest) * 100 : 0;

  const handleAi = async () => {
    setLoading(true);
    const res = await callGemini(`경매 수익률 분석: 감정가 ${item.appraisalPrice}, 낙찰가 ${f.expectedBidPrice}, 총비용 ${total}, 매도가 ${f.sellPrice}, 월세수익률 ${yieldRate.toFixed(1)}%. 입찰가 적정성과 수익성 평가해줘.`);
    onChange('aiStrategy', res); setLoading(false);
  };
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="space-y-4"><h3 className="font-bold text-indigo-600 border-b border-indigo-100 pb-2">1. 비용 입력</h3><InputGroup label="예상 낙찰가" type="number" value={f.expectedBidPrice} onChange={v => onChange('expectedBidPrice', v, 'financials')}/><InputGroup label="취등록세율 (%)" type="number" value={f.acquisitionTaxRate} onChange={v => onChange('acquisitionTaxRate', v, 'financials')}/><InputGroup label="수리/명도비" type="number" value={f.repairCost} onChange={v => onChange('repairCost', v, 'financials')}/></div>
        <div className="space-y-4"><h3 className="font-bold text-indigo-600 border-b border-indigo-100 pb-2">2. 매도/임대</h3><InputGroup label="예상 매도가" type="number" value={f.sellPrice} onChange={v => onChange('sellPrice', v, 'financials')}/><div className="pt-2 border-t border-dashed"><InputGroup label="월세 보증금" type="number" value={f.deposit} onChange={v => onChange('deposit', v, 'financials')}/><div className="mt-4"><InputGroup label="월세" type="number" value={f.monthlyRent} onChange={v => onChange('monthlyRent', v, 'financials')}/></div></div></div>
        <div className="space-y-4"><h3 className="font-bold text-indigo-600 border-b border-indigo-100 pb-2">3. 최종 분석</h3>
          <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-lg space-y-6">
            <div><div className="text-xs text-slate-400 mb-1">총 투자금 (세금포함)</div><div className="text-2xl font-bold">{formatCurrency(total)} 원</div></div>
            <div className="border-t border-slate-700 pt-4"><div>단기 매도 차익</div><div className={`text-xl font-bold mt-1 ${profit>0?'text-green-400':'text-red-400'}`}>{profit>0?'+':''}{formatCurrency(profit)} 원</div></div>
            <div className="border-t border-slate-700 pt-4"><div>임대 수익률 (연)</div><div className="text-3xl font-bold text-yellow-400 mt-1">{yieldRate.toFixed(1)} %</div><div className="text-xs text-slate-500 mt-1">실투자금: {formatCurrency(realInvest)}원</div></div>
          </div>
        </div>
      </div>
      <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 mt-6">
        <div className="flex justify-between items-center mb-4"><h3 className="font-bold flex items-center text-slate-800"><Bot className="w-5 h-5 mr-2 text-indigo-600"/>AI 투자 전략 진단</h3><button onClick={handleAi} disabled={loading} className="bg-slate-800 hover:bg-slate-900 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors disabled:bg-slate-400">{loading?'진단 중...':'✨ 전략 제안받기'}</button></div>
        <textarea className="w-full h-24 text-sm bg-white border border-slate-300 rounded-xl p-4" value={item.aiStrategy||''} onChange={e => onChange('aiStrategy', e.target.value)} placeholder="낙찰가와 비용을 입력하고 버튼을 누르면, AI가 보수적인 입찰가를 제안해줍니다."/>
      </div>
      <div className="flex justify-end pt-4 border-t"><SaveButton onClick={onSave}/></div>
    </div>
  );
}

function InputGroup({ label, value, onChange, type='text', placeholder, options }) {
  return <div className="w-full">{label && <label className="block text-sm font-bold text-slate-600 mb-1.5">{label}</label>}{type==='select'?<select value={value||''} onChange={e=>onChange(e.target.value)} className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none bg-white">{options.map(o=><option key={o}>{o}</option>)}</select>:<input type={type} value={value||''} placeholder={placeholder} onChange={e=>onChange(e.target.value)} className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none placeholder:text-slate-300"/>}</div>;
}
function SaveButton({onClick}) { return <button onClick={onClick} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg flex items-center font-bold text-sm shadow-md transition-all"><Save className="w-4 h-4 mr-2"/>저장하기</button>; }
function getStatusColor(s) { return ({'관심':'bg-blue-100 text-blue-600','권리분석':'bg-yellow-100 text-yellow-700','임장중':'bg-green-100 text-green-700','입찰준비':'bg-red-100 text-red-600','낙찰':'bg-purple-100 text-purple-700','완료':'bg-slate-800 text-white'}[s]||'bg-slate-100 text-slate-600'); }
