import React, { useState, useEffect, useMemo } from 'react';
import { 
  Gavel, 
  Home, 
  Calculator, 
  ClipboardList, 
  Calendar, 
  AlertTriangle, 
  CheckCircle2, 
  Plus, 
  Trash2, 
  Save, 
  ArrowLeft, 
  Search,
  ExternalLink,
  MapPin,
  DollarSign,
  TrendingUp,
  FileText,
  Sparkles,
  Bot
} from 'lucide-react';
import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInWithCustomToken, 
  signInAnonymously, 
  onAuthStateChanged 
} from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  orderBy,
  serverTimestamp 
} from "firebase/firestore";

// --- Firebase Configuration & Initialization ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- Gemini API Helper ---
const apiKey = ""; // Runtime environment provides the key

const callGemini = async (prompt) => {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`API call failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "분석 결과를 가져올 수 없습니다.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "AI 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
  }
};

// --- Helper Functions ---
const formatCurrency = (value) => {
  if (!value) return '0';
  return new Intl.NumberFormat('ko-KR').format(value);
};

const formatDate = (dateString) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
};

const getDday = (targetDate) => {
  if (!targetDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);
  const diffTime = target - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

// --- Main Application Component ---
export default function AuctionManager() {
  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [view, setView] = useState('dashboard'); // dashboard, list, detail, add
  const [selectedItem, setSelectedItem] = useState(null);
  const [loading, setLoading] = useState(true);

  // Auth & Data Fetching
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth Error:", error);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'artifacts', appId, 'users', user.uid, 'auction_items')
      // Note: Ordering is done client-side to avoid index requirements for mixed fields
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedItems = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // Sort by createdAt desc in memory
      fetchedItems.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setItems(fetchedItems);
      setLoading(false);
    }, (error) => {
      console.error("Firestore Error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // CRUD Operations
  const handleAddItem = async (newItem) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'auction_items'), {
        ...newItem,
        createdAt: serverTimestamp(),
        status: '관심', // Default status
        checklists: {
          leak: false,
          sunlight: false,
          parking: false,
          managementFee: false,
        },
        rights: {
          malsoDate: '',
          tenantMoveInDate: '',
          tenantFixDate: '',
          tenantDeposit: '',
          isDangerous: false,
        },
        financials: {
          expectedBidPrice: '',
          acquisitionTaxRate: 1.1,
          repairCost: '',
          movingCost: '',
          sellPrice: '',
          monthlyRent: '',
          deposit: '',
        },
        aiFieldAnalysis: '', // Added for AI
        aiStrategy: '', // Added for AI
      });
      setView('list');
    } catch (error) {
      console.error("Add Error:", error);
      alert("저장에 실패했습니다.");
    }
  };

  const handleUpdateItem = async (id, updatedData) => {
    if (!user) return;
    try {
      const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'auction_items', id);
      await updateDoc(docRef, updatedData);
      // Update local state for immediate feedback if needed, but snapshot handles it
      if (selectedItem && selectedItem.id === id) {
        setSelectedItem({ ...selectedItem, ...updatedData });
      }
    } catch (error) {
      console.error("Update Error:", error);
    }
  };

  const handleDeleteItem = async (id) => {
    if (!user || !confirm("정말 삭제하시겠습니까?")) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'auction_items', id));
      if (selectedItem?.id === id) {
        setView('list');
        setSelectedItem(null);
      }
    } catch (error) {
      console.error("Delete Error:", error);
    }
  };

  // --- Views ---

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-100 text-slate-800 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-20 lg:w-64 bg-white border-r border-slate-200 flex flex-col justify-between shrink-0 transition-all duration-300">
        <div>
          <div className="h-16 flex items-center justify-center lg:justify-start lg:px-6 border-b border-slate-100">
            <Gavel className="w-8 h-8 text-indigo-600" />
            <span className="hidden lg:block ml-3 font-bold text-xl text-slate-800">Auction Mgr</span>
          </div>
          <nav className="mt-6 px-2 space-y-2">
            <SidebarItem icon={Home} label="대시보드" active={view === 'dashboard'} onClick={() => setView('dashboard')} />
            <SidebarItem icon={ClipboardList} label="물건 관리" active={view === 'list' || view === 'add' || view === 'detail'} onClick={() => setView('list')} />
          </nav>
        </div>
        <div className="p-4 hidden lg:block">
          <div className="bg-indigo-50 rounded-xl p-4">
            <p className="text-xs text-indigo-600 font-semibold mb-1">TIP</p>
            <p className="text-sm text-indigo-800">권리분석 시 전입일자가 말소기준보다 빠르면 대항력이 있습니다.</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
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

// --- Sub-components ---

function SidebarItem({ icon: Icon, label, active, onClick }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center justify-center lg:justify-start p-3 rounded-xl transition-colors ${
        active ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
      }`}
    >
      <Icon className="w-6 h-6" />
      <span className="hidden lg:block ml-3 font-medium">{label}</span>
    </button>
  );
}

function Dashboard({ items, onViewChange, onItemSelect }) {
  const stats = useMemo(() => {
    return {
      total: items.length,
      interested: items.filter(i => i.status === '관심').length,
      analyzing: items.filter(i => i.status === '권리분석').length,
      field: items.filter(i => i.status === '임장중').length,
      bidding: items.filter(i => i.status === '입찰준비').length,
    };
  }, [items]);

  const upcomingItems = useMemo(() => {
    return items
      .filter(i => i.biddingDate && getDday(i.biddingDate) >= 0)
      .sort((a, b) => new Date(a.biddingDate) - new Date(b.biddingDate))
      .slice(0, 5);
  }, [items]);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">대시보드</h1>
        <p className="text-slate-500">현재 관리 중인 경매 물건 현황입니다.</p>
      </header>

      {/* Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard title="관심 물건" count={stats.interested} color="bg-blue-500" />
        <StatCard title="권리 분석" count={stats.analyzing} color="bg-yellow-500" />
        <StatCard title="임장 중" count={stats.field} color="bg-green-500" />
        <StatCard title="입찰 준비" count={stats.bidding} color="bg-red-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Calendar / Upcoming */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold flex items-center">
              <Calendar className="w-5 h-5 mr-2 text-indigo-600" />
              다가오는 입찰 일정
            </h2>
            <button onClick={() => onViewChange('list')} className="text-sm text-indigo-600 font-medium hover:underline">전체보기</button>
          </div>
          <div className="space-y-4">
            {upcomingItems.length === 0 ? (
              <p className="text-slate-400 text-center py-4">예정된 입찰이 없습니다.</p>
            ) : (
              upcomingItems.map(item => {
                const dDay = getDday(item.biddingDate);
                return (
                  <div 
                    key={item.id} 
                    onClick={() => { onItemSelect(item); onViewChange('detail'); }}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 cursor-pointer border border-slate-100"
                  >
                    <div>
                      <span className="text-xs font-semibold text-slate-500 block mb-1">{item.caseNumber}</span>
                      <span className="text-sm font-medium text-slate-900">{item.address}</span>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-bold ${dDay <= 3 ? 'bg-red-100 text-red-600' : 'bg-indigo-100 text-indigo-600'}`}>
                      {dDay === 0 ? 'D-Day' : `D-${dDay}`}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Quick Actions / Tips */}
        <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl shadow-lg p-6 text-white">
          <h2 className="text-lg font-bold mb-4 flex items-center">
            <CheckCircle2 className="w-5 h-5 mr-2" />
            오늘의 체크 포인트
          </h2>
          <ul className="space-y-3 text-indigo-100 text-sm">
            <li className="flex items-start">
              <span className="mr-2">•</span>
              권리분석 시 '말소기준권리' 날짜를 등기부등본 을구/갑구에서 가장 빠른 날짜로 설정했나요?
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              임장 시 관리사무소에 들러 '미납 관리비'를 반드시 확인하세요. 공용부분만 인수됩니다.
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              수익률 계산 시 취득세는 주택 수에 따라 중과될 수 있음을 유의하세요.
            </li>
          </ul>
          <button 
            onClick={() => onViewChange('add')}
            className="mt-6 w-full py-2 bg-white text-indigo-600 font-bold rounded-lg hover:bg-indigo-50 transition-colors"
          >
            새 물건 등록하기
          </button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, count, color }) {
  return (
    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
      <div>
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{title}</p>
        <p className="text-2xl font-bold text-slate-900 mt-1">{count}</p>
      </div>
      <div className={`w-2 h-12 rounded-full ${color} opacity-80`}></div>
    </div>
  );
}

function ItemList({ items, onItemSelect, onAddClick }) {
  const [filter, setFilter] = useState('전체');

  const filteredItems = items.filter(item => filter === '전체' || item.status === filter);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">물건 관리</h1>
          <p className="text-slate-500">등록된 모든 경매 물건 목록입니다.</p>
        </div>
        <div className="flex gap-2">
           <select 
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="전체">전체 보기</option>
            <option value="관심">관심</option>
            <option value="권리분석">권리분석</option>
            <option value="임장중">임장중</option>
            <option value="입찰준비">입찰준비</option>
            <option value="완료">완료</option>
          </select>
          <button 
            onClick={onAddClick}
            className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            물건 등록
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredItems.map(item => (
          <div 
            key={item.id}
            onClick={() => onItemSelect(item)}
            className="group bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer"
          >
            <div className="flex justify-between items-start mb-3">
              <span className={`px-2 py-1 rounded text-xs font-bold ${getStatusColor(item.status)}`}>
                {item.status}
              </span>
              <span className="text-xs text-slate-400">{item.type}</span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">{item.caseNumber}</h3>
            <p className="text-sm text-slate-600 line-clamp-1 mb-4 h-5">{item.address || '주소 미입력'}</p>
            
            <div className="flex items-center justify-between text-sm text-slate-500 pt-4 border-t border-slate-50">
              <div className="flex flex-col">
                <span className="text-xs">감정가</span>
                <span className="font-semibold text-slate-900">{formatCurrency(item.appraisalPrice)}</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-xs">입찰일</span>
                <span className={`font-semibold ${getDday(item.biddingDate) <= 3 ? 'text-red-500' : 'text-slate-900'}`}>
                  {item.biddingDate || '미정'}
                </span>
              </div>
            </div>
          </div>
        ))}
        
        {filteredItems.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
            <Search className="w-12 h-12 mb-4 opacity-50" />
            <p>등록된 물건이 없습니다.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function AddItemForm({ onCancel, onSave }) {
  const [formData, setFormData] = useState({
    caseNumber: '',
    type: '아파트',
    address: '',
    appraisalPrice: '',
    minPrice: '',
    biddingDate: '',
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <button onClick={onCancel} className="mb-6 flex items-center text-slate-500 hover:text-slate-800">
        <ArrowLeft className="w-4 h-4 mr-1" /> 목록으로 돌아가기
      </button>
      
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">새 물건 등록</h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">사건번호</label>
              <input 
                required
                name="caseNumber"
                value={formData.caseNumber}
                onChange={handleChange}
                placeholder="2023타경12345"
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">물건 종류</label>
              <select 
                name="type"
                value={formData.type}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option>아파트</option>
                <option>빌라/다세대</option>
                <option>오피스텔</option>
                <option>상가</option>
                <option>토지</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">소재지 (주소)</label>
            <input 
              name="address"
              value={formData.address}
              onChange={handleChange}
              placeholder="서울시 강남구 테헤란로..."
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none" 
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">감정가 (원)</label>
              <input 
                type="number"
                name="appraisalPrice"
                value={formData.appraisalPrice}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">최저가 (원)</label>
              <input 
                type="number"
                name="minPrice"
                value={formData.minPrice}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none" 
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">입찰 기일</label>
            <input 
              type="date"
              name="biddingDate"
              value={formData.biddingDate}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none" 
            />
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button 
              type="button" 
              onClick={onCancel}
              className="px-6 py-2 text-slate-600 font-medium hover:bg-slate-50 rounded-lg"
            >
              취소
            </button>
            <button 
              type="submit" 
              className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow-md"
            >
              등록하기
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ItemDetail({ item, onBack, onUpdate, onDelete }) {
  const [activeTab, setActiveTab] = useState('info');
  const [localItem, setLocalItem] = useState(item);

  // Sync local state if prop updates
  useEffect(() => {
    setLocalItem(item);
  }, [item]);

  const handleLocalChange = (field, value, section = null) => {
    let newData;
    if (section) {
      newData = {
        ...localItem,
        [section]: {
          ...localItem[section],
          [field]: value
        }
      };
    } else {
      newData = { ...localItem, [field]: value };
    }
    setLocalItem(newData);
  };

  const saveChanges = () => {
    onUpdate(item.id, localItem);
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center shadow-sm shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">{localItem.caseNumber}</h1>
              <span className={`px-2 py-0.5 rounded text-xs font-bold ${getStatusColor(localItem.status)}`}>
                {localItem.status}
              </span>
            </div>
            <p className="text-sm text-slate-500">{localItem.address}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select 
            value={localItem.status}
            onChange={(e) => {
              handleLocalChange('status', e.target.value);
              onUpdate(item.id, { ...localItem, status: e.target.value });
            }}
            className="px-3 py-1.5 border border-slate-200 rounded-md text-sm bg-white"
          >
            <option>관심</option>
            <option>권리분석</option>
            <option>임장중</option>
            <option>입찰준비</option>
            <option>낙찰</option>
            <option>패찰</option>
            <option>완료</option>
          </select>
          <button onClick={() => onDelete(item.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-200 px-8 flex gap-8">
        <TabButton active={activeTab === 'info'} onClick={() => setActiveTab('info')} icon={FileText} label="기본 정보" />
        <TabButton active={activeTab === 'rights'} onClick={() => setActiveTab('rights')} icon={AlertTriangle} label="권리 분석" />
        <TabButton active={activeTab === 'field'} onClick={() => setActiveTab('field')} icon={MapPin} label="임장 리포트" />
        <TabButton active={activeTab === 'calc'} onClick={() => setActiveTab('calc')} icon={Calculator} label="수익률 계산" />
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-8 min-h-[500px]">
          {activeTab === 'info' && <InfoTab item={localItem} onChange={handleLocalChange} onSave={saveChanges} />}
          {activeTab === 'rights' && <RightsTab item={localItem} onChange={handleLocalChange} onSave={saveChanges} />}
          {activeTab === 'field' && <FieldTab item={localItem} onChange={handleLocalChange} onSave={saveChanges} />}
          {activeTab === 'calc' && <CalcTab item={localItem} onChange={handleLocalChange} onSave={saveChanges} />}
        </div>
      </div>
    </div>
  );
}

// --- Tabs Implementation ---

function InfoTab({ item, onChange, onSave }) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-slate-900 border-b pb-2 mb-4">기본 정보 수정</h2>
      <div className="grid grid-cols-2 gap-6">
        <InputGroup label="사건번호" value={item.caseNumber} onChange={(v) => onChange('caseNumber', v)} />
        <InputGroup label="물건종류" value={item.type} onChange={(v) => onChange('type', v)} type="select" options={['아파트', '빌라/다세대', '오피스텔', '상가', '토지']} />
        <InputGroup label="소재지" value={item.address} onChange={(v) => onChange('address', v)} fullWidth />
        <InputGroup label="감정가" value={item.appraisalPrice} onChange={(v) => onChange('appraisalPrice', v)} type="number" />
        <InputGroup label="최저가" value={item.minPrice} onChange={(v) => onChange('minPrice', v)} type="number" />
        <InputGroup label="입찰기일" value={item.biddingDate} onChange={(v) => onChange('biddingDate', v)} type="date" />
      </div>

      <div className="mt-8 pt-4 border-t flex justify-between items-center">
        <div className="flex gap-2">
          <a 
            href={`https://map.naver.com/v5/search/${encodeURIComponent(item.address)}`} 
            target="_blank" 
            rel="noreferrer"
            className="flex items-center px-4 py-2 bg-[#03C75A] text-white rounded-lg hover:opacity-90 transition-opacity text-sm font-bold"
          >
            <MapPin className="w-4 h-4 mr-2" /> 네이버 지도
          </a>
          <a 
            href="https://www.courtauction.go.kr/" 
            target="_blank" 
            rel="noreferrer"
            className="flex items-center px-4 py-2 bg-slate-800 text-white rounded-lg hover:opacity-90 transition-opacity text-sm font-bold"
          >
            <ExternalLink className="w-4 h-4 mr-2" /> 대법원 경매
          </a>
        </div>
        <SaveButton onClick={onSave} />
      </div>
    </div>
  );
}

function RightsTab({ item, onChange, onSave }) {
  const rights = item.rights || {};

  const analysisResult = useMemo(() => {
    if (!rights.malsoDate || !rights.tenantMoveInDate) return null;
    const malso = new Date(rights.malsoDate);
    const moveIn = new Date(rights.tenantMoveInDate);
    
    if (moveIn < malso) {
      return { status: 'danger', msg: '대항력 있음 (인수 주의)', color: 'text-red-600 bg-red-50 border-red-200' };
    } else {
      return { status: 'safe', msg: '대항력 없음 (안전)', color: 'text-green-600 bg-green-50 border-green-200' };
    }
  }, [rights.malsoDate, rights.tenantMoveInDate]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b pb-2 mb-4">
        <h2 className="text-lg font-bold text-slate-900">권리 분석</h2>
        <span className="text-xs text-slate-500">* 날짜 입력 시 자동 분석됩니다.</span>
      </div>

      {analysisResult && (
        <div className={`p-4 rounded-xl border ${analysisResult.color} flex items-center mb-6`}>
          {analysisResult.status === 'danger' ? <AlertTriangle className="w-6 h-6 mr-3" /> : <CheckCircle2 className="w-6 h-6 mr-3" />}
          <span className="font-bold text-lg">{analysisResult.msg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-50 p-4 rounded-xl">
          <h3 className="font-bold text-slate-700 mb-4">기준 권리</h3>
          <InputGroup label="말소기준권리일" value={rights.malsoDate} onChange={(v) => onChange('malsoDate', v, 'rights')} type="date" />
        </div>
        
        <div className="bg-slate-50 p-4 rounded-xl">
          <h3 className="font-bold text-slate-700 mb-4">임차인 정보</h3>
          <div className="space-y-3">
             <InputGroup label="전입일자" value={rights.tenantMoveInDate} onChange={(v) => onChange('tenantMoveInDate', v, 'rights')} type="date" />
             <InputGroup label="확정일자" value={rights.tenantFixDate} onChange={(v) => onChange('tenantFixDate', v, 'rights')} type="date" />
             <InputGroup label="보증금 (원)" value={rights.tenantDeposit} onChange={(v) => onChange('tenantDeposit', v, 'rights')} type="number" />
          </div>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="font-bold text-slate-700 mb-3">특수 권리 체크리스트</h3>
        <div className="space-y-2">
          {['유치권 신고 여부', '법정지상권 성립 여부', '대지권 미등기', '위반건축물 등재'].map((label, idx) => (
             <label key={idx} className="flex items-center p-3 border rounded-lg hover:bg-slate-50 cursor-pointer">
               <input type="checkbox" className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500" />
               <span className="ml-3 text-slate-700">{label}</span>
             </label>
          ))}
        </div>
      </div>

      <div className="mt-8 pt-4 border-t flex justify-end">
        <SaveButton onClick={onSave} />
      </div>
    </div>
  );
}

function FieldTab({ item, onChange, onSave }) {
  const check = item.checklists || {};
  const [isGenerating, setIsGenerating] = useState(false);

  const handleCheckChange = (key) => {
    onChange(key, !check[key], 'checklists');
  };

  const generateReport = async () => {
    setIsGenerating(true);
    const checklistText = Object.entries(check)
      .map(([k, v]) => `${k}: ${v ? '이슈 있음' : '양호/확인안됨'}`)
      .join(', ');
    
    const prompt = `
      당신은 부동산 경매 전문가입니다. 다음 임장 데이터를 바탕으로 간단 명료한 임장 보고서를 작성해주세요.
      
      물건 종류: ${item.type}
      체크리스트 상태: ${checklistText}
      사용자 메모: ${item.fieldNote || '없음'}
      
      형식:
      1. 현장 상태 요약
      2. 예상되는 리스크 (특히 누수, 체납관리비 등 체크된 항목 중심)
      3. 입찰 전 필수 재확인 사항
      
      어조: 전문적이고 객관적인 어조. 한국어로 작성.
    `;

    const result = await callGemini(prompt);
    onChange('aiFieldAnalysis', result);
    setIsGenerating(false);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-slate-900 border-b pb-2 mb-4">임장 리포트 (현장 조사)</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="font-bold text-slate-700 mb-3">필수 확인 항목</h3>
          <div className="space-y-3">
            <CheckItem label="누수 흔적 (천장/베란다)" checked={check.leak} onToggle={() => handleCheckChange('leak')} />
            <CheckItem label="일조량 및 방향 확인" checked={check.sunlight} onToggle={() => handleCheckChange('sunlight')} />
            <CheckItem label="주차 공간 확보 여부" checked={check.parking} onToggle={() => handleCheckChange('parking')} />
            <CheckItem label="체납 관리비 확인" checked={check.managementFee} onToggle={() => handleCheckChange('managementFee')} />
          </div>
        </div>
        
        <div>
          <h3 className="font-bold text-slate-700 mb-3">시세 조사 메모</h3>
          <textarea 
            className="w-full h-40 p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
            placeholder="인근 부동산 방문 결과, 급매가, 실거래가 정보 등을 기록하세요."
            value={item.fieldNote || ''}
            onChange={(e) => onChange('fieldNote', e.target.value)}
          ></textarea>
        </div>
      </div>

      {/* AI Analysis Section */}
      <div className="bg-indigo-50 rounded-xl p-5 border border-indigo-100">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-indigo-900 flex items-center">
            <Sparkles className="w-5 h-5 mr-2 text-indigo-600" />
            AI 현장 분석 리포트
          </h3>
          <button 
            onClick={generateReport}
            disabled={isGenerating}
            className={`px-4 py-1.5 rounded-lg text-sm font-bold text-white transition-all ${
              isGenerating ? 'bg-indigo-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 shadow-sm'
            }`}
          >
            {isGenerating ? '분석 중...' : '✨ 분석 생성하기'}
          </button>
        </div>
        <textarea 
          className="w-full h-32 p-3 bg-white border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none text-sm text-slate-700 leading-relaxed"
          placeholder="AI가 생성한 분석 내용이 여기에 표시됩니다."
          value={item.aiFieldAnalysis || ''}
          onChange={(e) => onChange('aiFieldAnalysis', e.target.value)}
        ></textarea>
      </div>
      
      <div className="mt-8 pt-4 border-t flex justify-end">
        <SaveButton onClick={onSave} />
      </div>
    </div>
  );
}

function CalcTab({ item, onChange, onSave }) {
  const fin = item.financials || {};
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Calculations
  const bidPrice = Number(fin.expectedBidPrice) || 0;
  const acqTax = bidPrice * ((Number(fin.acquisitionTaxRate) || 1.1) / 100);
  const costs = Number(fin.repairCost || 0) + Number(fin.movingCost || 0) + acqTax;
  const totalInvestment = bidPrice + costs;

  // Short-term profit
  const sellPrice = Number(fin.sellPrice) || 0;
  const profit = sellPrice - totalInvestment;
  
  // Rental Yield
  const monthly = Number(fin.monthlyRent) || 0;
  const deposit = Number(fin.deposit) || 0;
  const realInvest = totalInvestment - deposit;
  const yieldRate = realInvest > 0 ? ((monthly * 12) / realInvest) * 100 : 0;

  const generateStrategy = async () => {
    setIsGenerating(true);
    const prompt = `
      당신은 부동산 투자 전략가입니다. 다음 경매 물건의 수익성 데이터를 분석하고 입찰 전략을 제안해주세요.

      [물건 정보]
      종류: ${item.type}
      감정가: ${formatCurrency(item.appraisalPrice)}원
      최저가: ${formatCurrency(item.minPrice)}원
      
      [투자 계획]
      예상 낙찰가: ${formatCurrency(bidPrice)}원
      총 투자금(세금/수리비 포함): ${formatCurrency(totalInvestment)}원
      예상 매도가: ${formatCurrency(sellPrice)}원 (예상 차익: ${formatCurrency(profit)}원)
      임대 시 월세 수익률: ${yieldRate.toFixed(1)}%

      요청사항:
      1. 현재 예상 낙찰가가 적정한지 감정가 대비 비율(%)로 평가해주세요.
      2. 수익률(매도차익/월세)이 투자 가치가 충분한지 냉정하게 판단해주세요.
      3. 보수적인 입찰가 가이드라인을 제시해주세요.

      어조: 신중하고 분석적인 어조. 한국어로 작성.
    `;

    const result = await callGemini(prompt);
    onChange('aiStrategy', result);
    setIsGenerating(false);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-slate-900 border-b pb-2 mb-4">수익률 계산기</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Inputs */}
        <div className="col-span-1 space-y-4">
          <h3 className="font-bold text-indigo-600">1. 비용 입력</h3>
          <InputGroup label="예상 낙찰가" value={fin.expectedBidPrice} onChange={(v) => onChange('expectedBidPrice', v, 'financials')} type="number" />
          <InputGroup label="취등록세율 (%)" value={fin.acquisitionTaxRate} onChange={(v) => onChange('acquisitionTaxRate', v, 'financials')} type="number" step="0.1" />
          <InputGroup label="수리/인테리어비" value={fin.repairCost} onChange={(v) => onChange('repairCost', v, 'financials')} type="number" />
          <InputGroup label="명도비/기타" value={fin.movingCost} onChange={(v) => onChange('movingCost', v, 'financials')} type="number" />
        </div>

        {/* Profit Scenarios */}
        <div className="col-span-1 space-y-4">
          <h3 className="font-bold text-indigo-600">2. 매도/임대 시나리오</h3>
          <div className="bg-slate-50 p-4 rounded-xl space-y-3">
            <h4 className="text-sm font-bold text-slate-500">단기 매도 시</h4>
            <InputGroup label="예상 매도가" value={fin.sellPrice} onChange={(v) => onChange('sellPrice', v, 'financials')} type="number" />
          </div>
          <div className="bg-slate-50 p-4 rounded-xl space-y-3">
            <h4 className="text-sm font-bold text-slate-500">임대 세팅 시</h4>
            <InputGroup label="보증금" value={fin.deposit} onChange={(v) => onChange('deposit', v, 'financials')} type="number" />
            <InputGroup label="월세" value={fin.monthlyRent} onChange={(v) => onChange('monthlyRent', v, 'financials')} type="number" />
          </div>
        </div>

        {/* Results */}
        <div className="col-span-1">
           <h3 className="font-bold text-indigo-600 mb-4">3. 최종 분석</h3>
           <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-lg space-y-6">
             <div>
               <p className="text-slate-400 text-sm">총 투자금 (취득세/비용 포함)</p>
               <p className="text-2xl font-bold">{formatCurrency(totalInvestment)} 원</p>
             </div>
             <div className="border-t border-slate-700 pt-4">
               <p className="text-slate-400 text-sm mb-1">단기 매도 예상 차익</p>
               <p className={`text-xl font-bold ${profit > 0 ? 'text-green-400' : 'text-red-400'}`}>
                 {profit > 0 ? '+' : ''}{formatCurrency(profit)} 원
               </p>
             </div>
             <div className="border-t border-slate-700 pt-4">
               <p className="text-slate-400 text-sm mb-1">임대 수익률 (연)</p>
               <p className="text-3xl font-bold text-yellow-400">{yieldRate.toFixed(1)} %</p>
               <p className="text-xs text-slate-500 mt-1">실투자금: {formatCurrency(realInvest)} 원</p>
             </div>
           </div>
        </div>
      </div>

      {/* AI Strategy Section */}
      <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 mt-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-slate-800 flex items-center">
            <Bot className="w-5 h-5 mr-2 text-indigo-600" />
            AI 투자 전략 진단
          </h3>
          <button 
            onClick={generateStrategy}
            disabled={isGenerating}
            className={`px-4 py-1.5 rounded-lg text-sm font-bold text-white transition-all ${
              isGenerating ? 'bg-slate-400 cursor-not-allowed' : 'bg-slate-800 hover:bg-slate-900 shadow-sm'
            }`}
          >
            {isGenerating ? '전략 수립 중...' : '✨ 투자 전략 제안받기'}
          </button>
        </div>
        <textarea 
          className="w-full h-32 p-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-500 focus:outline-none resize-none text-sm text-slate-700 leading-relaxed"
          placeholder="예상 낙찰가와 비용을 입력하고 버튼을 누르면, AI가 입찰 전략을 제안합니다."
          value={item.aiStrategy || ''}
          onChange={(e) => onChange('aiStrategy', e.target.value)}
        ></textarea>
      </div>

      <div className="mt-8 pt-4 border-t flex justify-end">
        <SaveButton onClick={onSave} />
      </div>
    </div>
  );
}

// --- Common UI Components ---

function InputGroup({ label, value, onChange, type = "text", fullWidth = false, options = [], step }) {
  return (
    <div className={fullWidth ? 'col-span-2' : ''}>
      <label className="block text-sm font-medium text-slate-600 mb-1">{label}</label>
      {type === 'select' ? (
        <select 
          value={value || ''} 
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-indigo-500"
        >
          {options.map(opt => <option key={opt}>{opt}</option>)}
        </select>
      ) : (
        <input 
          type={type}
          step={step}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-indigo-500"
        />
      )}
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label }) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center pb-3 px-1 border-b-2 transition-colors ${
        active 
          ? 'border-indigo-600 text-indigo-600 font-bold' 
          : 'border-transparent text-slate-500 hover:text-slate-700'
      }`}
    >
      <Icon className="w-4 h-4 mr-2" />
      {label}
    </button>
  );
}

function CheckItem({ label, checked, onToggle }) {
  return (
    <div 
      onClick={onToggle}
      className={`flex items-center p-4 border rounded-xl cursor-pointer transition-all ${
        checked ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-200 hover:bg-slate-50'
      }`}
    >
      <div className={`w-5 h-5 rounded-full border flex items-center justify-center mr-3 ${
        checked ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'
      }`}>
        {checked && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
      </div>
      <span className={`${checked ? 'text-indigo-900 font-medium' : 'text-slate-600'}`}>{label}</span>
    </div>
  );
}

function SaveButton({ onClick }) {
  return (
    <button 
      onClick={onClick}
      className="flex items-center px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-md font-bold"
    >
      <Save className="w-4 h-4 mr-2" />
      변경사항 저장
    </button>
  );
}

function getStatusColor(status) {
  switch (status) {
    case '관심': return 'bg-blue-100 text-blue-600';
    case '권리분석': return 'bg-yellow-100 text-yellow-700';
    case '임장중': return 'bg-green-100 text-green-700';
    case '입찰준비': return 'bg-red-100 text-red-600';
    case '낙찰': return 'bg-purple-100 text-purple-700';
    case '패찰': return 'bg-slate-200 text-slate-600';
    case '완료': return 'bg-slate-800 text-white';
    default: return 'bg-slate-100 text-slate-600';
  }
}
