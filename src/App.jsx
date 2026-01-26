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
// 👇 [수정할 곳 1] 본인의 지메일 주소를 따옴표 안에 적어주세요!
// 예시: const ALLOWED_EMAIL = "honggildong@gmail.com";
const ALLOWED_EMAIL = "cjg6577@gmail.com"; 

// 👇 [수정할 곳 2] AI 기능을 쓰려면 Gemini API 키를 넣어주세요 (선택사항)
const apiKey = "AIzaSyB2Ni95d2qjT8VjA0d4-Hll4y-SswvwFf4"; 
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// --- Firebase 설정 (이미 채워드렸습니다) ---
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
  if (!apiKey) return "API 키가 설정되지 않았습니다. 코드에 키를 입력해주세요.";
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
    // 로컬 환경에서는 자동 로그인 시도하지 않음
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setLoading(false);
      
      if (currentUser) {
        // 이메일 보안 체크
        if (ALLOWED_EMAIL && !currentUser.isAnonymous && currentUser.email !== ALLOWED_EMAIL) {
          setAuthError("허용되지 않은 사용자입니다. 설정된 이메일로 로그인해주세요.");
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

    const q = query(
      collection(db, 'artifacts', appId, 'users', user.uid, 'auction_items')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
      setAuthError("로그인에 실패했습니다.");
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
    if (!confirm("삭제하시겠습니까?")) return;
    await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'auction_items', id));
    if (selectedItem?.id === id) { setView('list'); setSelectedItem(null); }
  };

  // --- 로그인 화면 ---
  if (!user && !loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-100 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-lg max-w-sm w-full text-center">
          <div className="bg-indigo-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-indigo-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">접근 제한 구역</h1>
          <p className="text-slate-500 mb-6 text-sm">
            이 앱은 개인 전용입니다.<br/>허용된 구글 계정으로 로그인해주세요.
          </p>
          
          {authError && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 mr-2" />
              {authError}
            </div>
          )}

          <button 
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium py-3 rounded-xl transition-all shadow-sm"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Google 계정으로 로그인
          </button>
        </div>
      </div>
    );
  }

  if (loading) return <div className="h-screen flex items-center justify-center"><div className="animate-spin w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full"/></div>;

  return (
    <div className="flex h-screen bg-slate-100 text-slate-800 font-sans overflow-hidden">
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
          <button onClick={handleLogout} className="w-full flex items-center justify-center lg:justify-start p-2 text-slate-500 hover:bg-slate-50 rounded-lg text-sm">
            <LogOut className="w-5 h-5 lg:mr-2" />
            <span className="hidden lg:inline">로그아웃</span>
          </button>
        </div>
      </aside>

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
    <button onClick={onClick} className={`w-full flex items-center justify-center lg:justify-start p-3 rounded-xl transition-colors ${active ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-50'}`}>
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
        <StatCard title="관심" count={stats.interested} color="bg-blue-500" />
        <StatCard title="분석" count={stats.analyzing} color="bg-yellow-500" />
        <StatCard title="임장" count={stats.field} color="bg-green-500" />
        <StatCard title="입찰" count={stats.bidding} color="bg-red-500" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-2xl border border-slate-100 p-6">
          <h2 className="font-bold flex items-center mb-4"><Calendar className="w-5 h-5 mr-2 text-indigo-600"/> 다가오는 입찰</h2>
          <div className="space-y-3">{upcoming.map(item => (
            <div key={item.id} onClick={() => {onItemSelect(item); setView('detail');}} className="flex justify-between p-3 border rounded-lg cursor-pointer hover:bg-slate-50">
              <div><div className="font-bold text-sm">{item.caseNumber}</div><div className="text-xs text-slate-500">{item.address}</div></div>
              <div className="text-indigo-600 font-bold text-sm">D-{getDday(item.biddingDate)}</div>
            </div>
          ))}</div>
        </div>
        <div className="bg-indigo-600 rounded-2xl p-6 text-white shadow-lg">
          <h2 className="font-bold mb-4 flex items-center"><CheckCircle2 className="w-5 h-5 mr-2"/>오늘의 체크포인트</h2>
          <ul className="text-sm space-y-2 text-indigo-100 mb-6">
            <li>• 말소기준권리 날짜 재확인</li><li>• 관리비 체납액 인수 여부 확인</li>
          </ul>
          <button onClick={() => onViewChange('add')} className="w-full py-2 bg-white text-indigo-600 font-bold rounded-lg">새 물건 등록</button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, count, color }) {
  return <div className="bg-white p-4 rounded-2xl border flex justify-between items-center"><div><div className="text-xs text-slate-500">{title}</div><div className="text-xl font-bold">{count}</div></div><div className={`w-1 h-8 ${color} rounded`}></div></div>;
}

function ItemList({ items, onItemSelect, onAddClick }) {
  const [filter, setFilter] = useState('전체');
  const filtered = items.filter(i => filter === '전체' || i.status === filter);
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between mb-6">
        <h1 className="text-2xl font-bold">물건 관리</h1>
        <div className="flex gap-2">
          <select value={filter} onChange={e => setFilter(e.target.value)} className="border rounded-lg px-3"><option>전체</option><option>관심</option><option>권리분석</option><option>임장중</option><option>입찰준비</option></select>
          <button onClick={onAddClick} className="bg-indigo-600 text-white px-4 rounded-lg flex items-center"><Plus className="w-4 h-4 mr-1"/>등록</button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {filtered.map(item => (
          <div key={item.id} onClick={() => onItemSelect(item)} className="bg-white p-5 rounded-2xl border hover:shadow-md cursor-pointer">
            <div className="flex justify-between mb-2"><span className={`text-xs px-2 py-1 rounded font-bold ${getStatusColor(item.status)}`}>{item.status}</span><span className="text-xs text-slate-400">{item.type}</span></div>
            <h3 className="font-bold mb-1">{item.caseNumber}</h3>
            <p className="text-sm text-slate-500 truncate mb-4">{item.address}</p>
            <div className="flex justify-between text-sm border-t pt-3"><span>감정가 {formatCurrency(item.appraisalPrice)}</span><span className={getDday(item.biddingDate) <= 3 ? 'text-red-500 font-bold' : ''}>{item.biddingDate}</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AddItemForm({ onCancel, onSave }) {
  const [form, setForm] = useState({ caseNumber: '', type: '아파트', address: '', appraisalPrice: '', minPrice: '', biddingDate: '' });
  return (
    <div className="p-8 max-w-2xl mx-auto">
      <button onClick={onCancel} className="mb-4 flex items-center text-slate-500"><ArrowLeft className="w-4 h-4 mr-1"/>취소</button>
      <div className="bg-white p-8 rounded-2xl border">
        <h2 className="text-2xl font-bold mb-6">새 물건 등록</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <InputGroup label="사건번호" value={form.caseNumber} onChange={v => setForm({...form, caseNumber: v})} />
            <InputGroup label="종류" type="select" options={['아파트','빌라','오피스텔','상가','토지']} value={form.type} onChange={v => setForm({...form, type: v})} />
          </div>
          <InputGroup label="주소" value={form.address} onChange={v => setForm({...form, address: v})} />
          <div className="grid grid-cols-2 gap-4">
            <InputGroup label="감정가" type="number" value={form.appraisalPrice} onChange={v => setForm({...form, appraisalPrice: v})} />
            <InputGroup label="최저가" type="number" value={form.minPrice} onChange={v => setForm({...form, minPrice: v})} />
          </div>
          <InputGroup label="입찰일" type="date" value={form.biddingDate} onChange={v => setForm({...form, biddingDate: v})} />
          <div className="flex justify-end gap-2 pt-4">
            <button onClick={onCancel} className="px-4 py-2 text-slate-600">취소</button>
            <button onClick={() => onSave(form)} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold">등록</button>
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
      <div className="bg-white px-8 py-4 border-b flex justify-between items-center">
        <div className="flex items-center gap-4"><button onClick={onBack}><ArrowLeft/></button><div><h1 className="font-bold text-xl">{local.caseNumber}</h1><p className="text-sm text-slate-500">{local.address}</p></div></div>
        <div className="flex gap-2"><select value={local.status} onChange={e => {handleChange('status', e.target.value); onUpdate(item.id, {...local, status: e.target.value})}} className="border rounded px-2 py-1"><option>관심</option><option>권리분석</option><option>임장중</option><option>입찰준비</option><option>낙찰</option><option>패찰</option></select><button onClick={() => onDelete(item.id)} className="text-red-500 p-2"><Trash2/></button></div>
      </div>
      <div className="bg-white px-8 border-b flex gap-6">
        {[
          {id:'info', icon:Home, label:'정보'}, {id:'rights', icon:AlertTriangle, label:'권리'},
          {id:'field', icon:MapPin, label:'임장'}, {id:'calc', icon:Calculator, label:'수익'}
        ].map(t => <button key={t.id} onClick={() => setTab(t.id)} className={`py-3 flex items-center border-b-2 ${tab === t.id ? 'border-indigo-600 text-indigo-600 font-bold' : 'border-transparent text-slate-500'}`}><t.icon className="w-4 h-4 mr-2"/>{t.label}</button>)}
      </div>
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-4xl mx-auto bg-white p-8 rounded-2xl border">
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
  return <div className="space-y-6"><div className="grid grid-cols-2 gap-4"><InputGroup label="사건번호" value={item.caseNumber} onChange={v => onChange('caseNumber', v)}/><InputGroup label="종류" value={item.type} onChange={v => onChange('type', v)} type="select" options={['아파트','빌라','오피스텔','상가','토지']}/></div><InputGroup label="주소" value={item.address} onChange={v => onChange('address', v)}/><div className="grid grid-cols-2 gap-4"><InputGroup label="감정가" type="number" value={item.appraisalPrice} onChange={v => onChange('appraisalPrice', v)}/><InputGroup label="최저가" type="number" value={item.minPrice} onChange={v => onChange('minPrice', v)}/></div><InputGroup label="입찰일" type="date" value={item.biddingDate} onChange={v => onChange('biddingDate', v)}/><div className="flex justify-end pt-4"><SaveButton onClick={onSave}/></div></div>;
}

function RightsTab({ item, onChange, onSave }) {
  const r = item.rights || {};
  const isSafe = r.malsoDate && r.tenantMoveInDate && new Date(r.tenantMoveInDate) > new Date(r.malsoDate);
  return (
    <div className="space-y-6">
      {r.malsoDate && r.tenantMoveInDate && (
        <div className={`p-4 rounded-xl border flex items-center ${!isSafe ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
          {!isSafe ? <AlertTriangle className="mr-2"/> : <CheckCircle2 className="mr-2"/>}
          <span className="font-bold">{!isSafe ? '대항력 있음 (위험)' : '대항력 없음 (안전)'}</span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-slate-50 p-4 rounded-xl"><h3 className="font-bold mb-2">말소기준</h3><InputGroup type="date" value={r.malsoDate} onChange={v => onChange('malsoDate', v, 'rights')}/></div>
        <div className="bg-slate-50 p-4 rounded-xl"><h3 className="font-bold mb-2">임차인</h3><InputGroup label="전입일" type="date" value={r.tenantMoveInDate} onChange={v => onChange('tenantMoveInDate', v, 'rights')}/><InputGroup label="보증금" type="number" value={r.tenantDeposit} onChange={v => onChange('tenantDeposit', v, 'rights')}/></div>
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
    const res = await callGemini(`부동산 임장 분석: ${item.type}, 상태: ${JSON.stringify(c)}, 메모: ${item.fieldNote}. 위험요소와 수리필요사항 요약해줘.`);
    onChange('aiFieldAnalysis', res); setLoading(false);
  };
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div><h3 className="font-bold mb-2">체크리스트</h3><div className="space-y-2">{[['leak','누수'],['sunlight','일조량'],['parking','주차'],['managementFee','체납관리비']].map(([k,l]) => <div key={k} onClick={() => onChange(k, !c[k], 'checklists')} className={`p-3 border rounded flex items-center cursor-pointer ${c[k] ? 'bg-indigo-50 border-indigo-200' : ''}`}><div className={`w-4 h-4 border rounded mr-2 ${c[k]?'bg-indigo-600':''}`}/>{l}</div>)}</div></div>
        <div><h3 className="font-bold mb-2">메모</h3><textarea className="w-full h-40 border rounded p-2" value={item.fieldNote||''} onChange={e => onChange('fieldNote', e.target.value)}/></div>
      </div>
      <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
        <div className="flex justify-between mb-2"><h3 className="font-bold text-indigo-900 flex items-center"><Sparkles className="w-4 h-4 mr-1"/>AI 분석</h3><button onClick={handleAi} disabled={loading} className="bg-indigo-600 text-white text-xs px-3 py-1 rounded">{loading?'...':'분석'}</button></div>
        <textarea className="w-full h-24 text-sm bg-white border rounded p-2" value={item.aiFieldAnalysis||''} onChange={e => onChange('aiFieldAnalysis', e.target.value)} placeholder="AI 분석 결과"/>
      </div>
      <div className="flex justify-end pt-4"><SaveButton onClick={onSave}/></div>
    </div>
  );
}

function CalcTab({ item, onChange, onSave }) {
  const f = item.financials || {};
  const [loading, setLoading] = useState(false);
  const total = (Number(f.expectedBidPrice)||0) * (1 + (Number(f.acquisitionTaxRate)||1.1)/100) + Number(f.repairCost||0) + Number(f.movingCost||0);
  const profit = (Number(f.sellPrice)||0) - total;
  const handleAi = async () => {
    setLoading(true);
    const res = await callGemini(`경매 수익률 분석: 감정가 ${item.appraisalPrice}, 낙찰가 ${f.expectedBidPrice}, 총비용 ${total}, 매도가 ${f.sellPrice}. 입찰가 적정성과 수익성 평가해줘.`);
    onChange('aiStrategy', res); setLoading(false);
  };
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-6">
        <div className="space-y-2"><h3 className="font-bold text-indigo-600">비용</h3><InputGroup label="낙찰가" type="number" value={f.expectedBidPrice} onChange={v => onChange('expectedBidPrice', v, 'financials')}/><InputGroup label="취득세(%)" type="number" value={f.acquisitionTaxRate} onChange={v => onChange('acquisitionTaxRate', v, 'financials')}/><InputGroup label="수리/명도" type="number" value={f.repairCost} onChange={v => onChange('repairCost', v, 'financials')}/></div>
        <div className="space-y-2"><h3 className="font-bold text-indigo-600">매도/임대</h3><InputGroup label="매도가" type="number" value={f.sellPrice} onChange={v => onChange('sellPrice', v, 'financials')}/><InputGroup label="월세" type="number" value={f.monthlyRent} onChange={v => onChange('monthlyRent', v, 'financials')}/><InputGroup label="보증금" type="number" value={f.deposit} onChange={v => onChange('deposit', v, 'financials')}/></div>
        <div><h3 className="font-bold text-indigo-600 mb-2">결과</h3><div className="bg-slate-900 text-white p-4 rounded-xl space-y-4"><div><div className="text-xs text-slate-400">총 투자금</div><div className="text-xl font-bold">{formatCurrency(total)}원</div></div><div className="border-t border-slate-700 pt-2"><div>예상 차익</div><div className={`text-lg font-bold ${profit>0?'text-green-400':'text-red-400'}`}>{formatCurrency(profit)}원</div></div></div></div>
      </div>
      <div className="bg-slate-100 p-4 rounded-xl border">
        <div className="flex justify-between mb-2"><h3 className="font-bold flex items-center"><Bot className="w-4 h-4 mr-1"/>AI 투자 전략</h3><button onClick={handleAi} disabled={loading} className="bg-slate-800 text-white text-xs px-3 py-1 rounded">{loading?'...':'전략 수립'}</button></div>
        <textarea className="w-full h-24 text-sm bg-white border rounded p-2" value={item.aiStrategy||''} onChange={e => onChange('aiStrategy', e.target.value)} placeholder="AI 전략 제안"/>
      </div>
      <div className="flex justify-end pt-4"><SaveButton onClick={onSave}/></div>
    </div>
  );
}

function InputGroup({ label, value, onChange, type='text', options }) {
  return <div className="w-full">{label && <label className="block text-xs text-slate-500 mb-1">{label}</label>}{type==='select'?<select value={value||''} onChange={e=>onChange(e.target.value)} className="w-full border rounded p-2">{options.map(o=><option key={o}>{o}</option>)}</select>:<input type={type} value={value||''} onChange={e=>onChange(e.target.value)} className="w-full border rounded p-2"/>}</div>;
}
function SaveButton({onClick}) { return <button onClick={onClick} className="bg-indigo-600 text-white px-4 py-2 rounded flex items-center font-bold text-sm"><Save className="w-4 h-4 mr-2"/>저장</button>; }
function getStatusColor(s) { return ({'관심':'bg-blue-100 text-blue-600','권리분석':'bg-yellow-100 text-yellow-700','임장중':'bg-green-100 text-green-700','입찰준비':'bg-red-100 text-red-600','낙찰':'bg-purple-100 text-purple-700'}[s]||'bg-slate-100'); }