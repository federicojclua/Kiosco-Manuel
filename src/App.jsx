import React, { useState, useEffect } from 'react';
import { auth, googleProvider, db, firebaseReady } from './firebase';
import { signInWithPopup, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Home, ShoppingCart, Package, BookOpen, Truck, LogOut, Plus, Minus, Search, Printer, X, CheckCircle2, AlertCircle, TrendingUp } from 'lucide-react';

const HorseLogo = ({ className = "w-8 h-8" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M8 22h8m-4-20c2.5 0 4 2 4 4 0 1.5-1 3-1 3s1 1 2 2c1 1.5 1 3 0 4.5l-2 3.5h-6l-2-3.5c-1-1.5-1-3 0-4.5 1-1 2-2 2-2s-1-1.5-1-3c0-2 1.5-4 4-4z" />
    <circle cx="13" cy="8" r="1" fill="currentColor"/>
  </svg>
);

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [activeTab, setActiveTab] = useState('caja');

  // Estados de la Base de Datos
  const [inventory, setInventory] = useState([]);
  const [sales, setSales] = useState([]);
  const [fiados, setFiados] = useState([]);
  
  // Estados de la UI
  const [cart, setCart] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCheckout, setShowCheckout] = useState(false);
  const [selectedFiadoId, setSelectedFiadoId] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  // Auth Listener
  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Firestore Listeners (Solo se activan si hay usuario logueado)
  useEffect(() => {
    if (!user || !db) return;

    const unsubInv = onSnapshot(collection(db, 'inventory'), (snap) => {
      setInventory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    
    const unsubSales = onSnapshot(collection(db, 'sales'), (snap) => {
      setSales(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubFiados = onSnapshot(collection(db, 'fiados'), (snap) => {
      setFiados(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubInv(); unsubSales(); unsubFiados(); };
  }, [user]);

  const handleGoogleLogin = async () => {
    try { await signInWithPopup(auth, googleProvider); } 
    catch (error) { alert("Error con Google: " + error.message); }
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    try { await signInWithEmailAndPassword(auth, email, password); } 
    catch (error) { alert("Error: " + error.message); }
  };

  // --- LOGICA DE NEGOCIO ---
  const cartTotal = cart.reduce((sum, item) => sum + item.subtotal, 0);

  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => item.product.id === product.id 
          ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.product.price }
          : item
        );
      }
      return [...prev, { product, quantity: 1, subtotal: product.price }];
    });
  };

  const processSale = async (method) => {
    if (cart.length === 0) return;
    if (method === 'fiado' && !selectedFiadoId) return alert('Selecciona un cliente');

    try {
      // 1. Guardar la Venta
      await addDoc(collection(db, 'sales'), {
        items: cart,
        total: cartTotal,
        method: method,
        date: new Date().toISOString(),
        timestamp: serverTimestamp()
      });

      // 2. Descontar Stock en Firestore
      for (const item of cart) {
        if (!item.product.isService) {
          const prodRef = doc(db, 'inventory', item.product.id);
          const newStock = Math.max(0, item.product.stock - item.quantity);
          await updateDoc(prodRef, { stock: newStock });
        }
      }

      // 3. Sumar Deuda si es Fiado
      if (method === 'fiado') {
        const cliente = fiados.find(f => f.id === selectedFiadoId);
        if (cliente) {
          await updateDoc(doc(db, 'fiados', cliente.id), { 
            totalDebt: cliente.totalDebt + cartTotal 
          });
        }
      }

      setCart([]);
      setShowCheckout(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);

    } catch (error) {
      alert('Error procesando venta: ' + error.message);
    }
  };

  const createProduct = async () => {
    const name = prompt("Nombre del producto:");
    if (!name) return;
    const cost = Number(prompt("Costo (Precio de compra):") || 0);
    const price = Number(prompt("Precio de Venta:") || 0);
    const stock = Number(prompt("Stock actual:") || 0);
    
    await addDoc(collection(db, 'inventory'), {
      name, cost, price, stock, minStock: 5, category: 'General', isService: false
    });
  };

  // --- VISTAS ---
  const POSView = () => (
    <div className="h-full flex flex-col pb-20">
      <div className="p-3 bg-white shadow-sm z-10 relative">
        <Search className="absolute left-6 top-5 text-gray-400 w-5 h-5" />
        <input 
          type="text" placeholder="Buscar producto..." 
          className="w-full bg-gray-100 rounded-full py-2 pl-10 pr-4 outline-none focus:ring-2 focus:ring-emerald-500"
          value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>
      
      <div className="flex-1 overflow-y-auto p-3 grid grid-cols-3 gap-2 content-start bg-gray-50">
        {inventory.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())).map(product => (
          <button key={product.id} onClick={() => addToCart(product)} className="bg-white p-2 rounded-xl shadow-sm flex flex-col items-center justify-center text-center active:scale-95 border border-gray-100">
            <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2">
              {product.isService ? <Printer className="w-5 h-5"/> : <Package className="w-5 h-5"/>}
            </div>
            <span className="text-xs font-semibold text-gray-800 leading-tight line-clamp-2">{product.name}</span>
            <span className="text-sm font-bold text-emerald-600 mt-1">${product.price}</span>
          </button>
        ))}
        {inventory.length === 0 && <div className="col-span-3 text-center text-gray-400 mt-10">No hay productos. Ve a Stock para agregarlos.</div>}
      </div>

      {cart.length > 0 && (
        <div className="absolute bottom-16 left-0 w-full p-3 z-20">
          <div className="bg-gray-900 rounded-2xl shadow-2xl p-4 text-white">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-400 text-sm">{cart.length} items</span>
              <span className="text-2xl font-bold text-emerald-400">${cartTotal}</span>
            </div>
            <button onClick={() => setShowCheckout(true)} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl">Cobrar</button>
          </div>
        </div>
      )}

      {showCheckout && (
        <div className="absolute inset-0 bg-black/60 z-50 flex items-end justify-center p-4">
          <div className="bg-white w-full rounded-3xl p-6 pb-10">
            <div className="flex justify-between mb-6">
              <h2 className="text-xl font-bold">Finalizar</h2>
              <button onClick={() => setShowCheckout(false)}><X/></button>
            </div>
            <div className="text-center mb-8">
              <p className="text-gray-500">Total a pagar</p>
              <p className="text-5xl font-extrabold text-emerald-600">${cartTotal}</p>
            </div>
            <button onClick={() => processSale('efectivo')} className="w-full bg-gray-900 text-white font-bold py-4 rounded-xl mb-4 text-lg">Efectivo</button>
            <select className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 mb-2 outline-none" value={selectedFiadoId} onChange={(e) => setSelectedFiadoId(e.target.value)}>
              <option value="">Seleccionar para Fiado...</option>
              {fiados.map(f => <option key={f.id} value={f.id}>{f.name} - Deuda: ${f.totalDebt}</option>)}
            </select>
            <button onClick={() => processSale('fiado')} className="w-full bg-orange-100 text-orange-700 font-bold py-4 rounded-xl text-lg">Anotar Fiado</button>
          </div>
        </div>
      )}
    </div>
  );

  const InventoryView = () => (
    <div className="p-4 pb-24 h-full overflow-y-auto">
      <div className="flex justify-between mb-4">
        <h2 className="font-bold text-gray-800 text-lg">Gestión de Stock</h2>
        <button onClick={createProduct} className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-lg text-sm font-bold flex items-center"><Plus className="w-4 h-4 mr-1"/> Nuevo</button>
      </div>
      <div className="space-y-3">
        {inventory.map(item => (
          <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col">
            <div className="flex justify-between">
              <span className="font-bold text-gray-800">{item.name}</span>
              <span className="font-bold text-emerald-600">${item.price}</span>
            </div>
            <div className="flex justify-between items-center mt-2 text-sm text-gray-500">
              <span>Costo: ${item.cost || 0}</span>
              <span className="bg-gray-100 px-2 py-1 rounded">Markup: {item.cost ? Math.round(((item.price - item.cost) / item.cost) * 100) : 100}%</span>
            </div>
            {!item.isService && (
              <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-50">
                <span className="text-sm font-medium">Stock: <span className={item.stock <= item.minStock ? 'text-red-500' : ''}>{item.stock}</span></span>
                <div className="flex gap-2">
                  <button onClick={() => updateDoc(doc(db, 'inventory', item.id), { stock: Math.max(0, item.stock - 1)})} className="bg-gray-100 p-1.5 rounded"><Minus className="w-4 h-4"/></button>
                  <button onClick={() => updateDoc(doc(db, 'inventory', item.id), { stock: item.stock + 1})} className="bg-emerald-50 text-emerald-600 p-1.5 rounded"><Plus className="w-4 h-4"/></button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const DashboardView = () => {
    const today = new Date().toDateString();
    const todaySales = sales.filter(s => new Date(s.date).toDateString() === today);
    const totalEfectivo = todaySales.filter(s => s.method === 'efectivo').reduce((acc, s) => acc + s.total, 0);
    const criticalStock = inventory.filter(p => !p.isService && p.stock <= p.minStock);

    return (
      <div className="p-4 space-y-6 pb-24 overflow-y-auto h-full">
        <div className="bg-emerald-600 text-white rounded-2xl p-5 shadow-lg">
          <p className="text-emerald-100 text-sm font-medium">Caja Hoy (Efectivo)</p>
          <h2 className="text-4xl font-bold mt-1">${totalEfectivo}</h2>
          <p className="mt-4 text-emerald-50 text-sm border-t border-emerald-500 pt-3">Ventas realizadas hoy: {todaySales.length}</p>
        </div>
        
        <div>
          <h3 className="font-bold text-gray-700 flex items-center mb-3"><AlertCircle className="w-5 h-5 mr-2 text-orange-500" /> Stock Crítico</h3>
          {criticalStock.map(item => (
            <div key={item.id} className="bg-white p-3 rounded-xl shadow-sm border border-orange-100 mb-2 flex justify-between">
              <span className="font-medium text-gray-800">{item.name}</span>
              <span className="text-xs font-bold bg-orange-100 text-orange-600 py-1 px-2 rounded-full">Quedan: {item.stock}</span>
            </div>
          ))}
          {criticalStock.length === 0 && <p className="text-gray-500 text-sm">Stock en orden.</p>}
        </div>
      </div>
    );
  };

  const FiadosView = () => (
    <div className="p-4 pb-24 h-full overflow-y-auto">
      <div className="flex justify-between mb-4">
        <h2 className="font-bold text-gray-800 text-lg">Cuentas Corrientes</h2>
        <button onClick={async () => {
          const name = prompt("Nombre del cliente/profesor:");
          if (name) await addDoc(collection(db, 'fiados'), { name, totalDebt: 0 });
        }} className="bg-gray-900 text-white px-3 py-1 rounded-lg text-sm font-bold flex items-center"><Plus className="w-4 h-4 mr-1"/> Nuevo</button>
      </div>
      <div className="space-y-3">
        {fiados.map(cliente => (
          <div key={cliente.id} className="bg-white p-4 rounded-xl shadow-sm border border-orange-100 flex flex-col">
            <div className="flex justify-between mb-3">
              <span className="font-bold text-gray-800">{cliente.name}</span>
              <span className="font-bold text-orange-600">${cliente.totalDebt}</span>
            </div>
            <button onClick={async () => {
              const pago = Number(prompt(`¿Cuánto abona ${cliente.name}? (Deuda: $${cliente.totalDebt})`));
              if (pago) await updateDoc(doc(db, 'fiados', cliente.id), { totalDebt: Math.max(0, cliente.totalDebt - pago) });
            }} className="w-full bg-green-50 text-green-700 py-2 rounded-lg font-semibold text-sm">Registrar Pago</button>
          </div>
        ))}
      </div>
    </div>
  );

  // --- RENDERS DE CARGA Y LOGIN ---
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-200">Cargando...</div>;

  // Si Firebase no esta configurado (faltan variables de entorno), mostramos
  // un mensaje claro en vez de una pagina en blanco.
  if (!firebaseReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-200 p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md">
          <div className="flex flex-col items-center mb-6">
            <div className="bg-red-500 p-4 rounded-full mb-4"><AlertCircle className="w-10 h-10 text-white" /></div>
            <h1 className="text-xl font-bold text-gray-800">Falta configurar Firebase</h1>
            <p className="text-gray-500 text-sm mt-2 text-center">Este build se genero sin las variables de entorno de Firebase.</p>
          </div>
          <p className="text-gray-600 text-sm font-semibold mb-2">En Netlify - Site settings - Environment variables agrega:</p>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 font-mono text-xs text-gray-600 space-y-1">
            <div>VITE_FIREBASE_API_KEY</div>
            <div>VITE_FIREBASE_AUTH_DOMAIN</div>
            <div>VITE_FIREBASE_PROJECT_ID</div>
            <div>VITE_FIREBASE_STORAGE_BUCKET</div>
            <div>VITE_FIREBASE_MESSAGING_SENDER_ID</div>
            <div>VITE_FIREBASE_APP_ID</div>
          </div>
          <p className="text-gray-500 text-sm mt-4 text-center">Despues volve a desplegar el sitio para que tome los valores.</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-200 p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md">
          <div className="flex flex-col items-center mb-8">
            <div className="bg-emerald-500 p-4 rounded-full mb-4"><HorseLogo className="w-12 h-12 text-white" /></div>
            <h1 className="text-2xl font-black text-gray-800">Kiosco Manuel</h1>
          </div>
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <input type="email" placeholder="Correo" className="w-full bg-gray-50 border p-3 rounded-xl" value={email} onChange={e => setEmail(e.target.value)} required />
            <input type="password" placeholder="Clave" className="w-full bg-gray-50 border p-3 rounded-xl" value={password} onChange={e => setPassword(e.target.value)} required />
            <button type="submit" className="w-full bg-gray-900 text-white font-bold py-3 rounded-xl">Ingresar</button>
          </form>
          <button onClick={handleGoogleLogin} className="w-full mt-4 border border-gray-300 bg-white text-gray-700 font-bold py-3 rounded-xl flex items-center justify-center">
            <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5 mr-3" alt="Google" /> Google
          </button>
        </div>
      </div>
    );
  }

  // --- RENDER PRINCIPAL APP ---
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-200">
      <div className="w-full max-w-md bg-gray-50 h-[100dvh] shadow-2xl relative flex flex-col sm:rounded-[2.5rem] sm:border-[8px] border-gray-900 overflow-hidden">
        
        <div className="bg-gray-900 text-white pt-6 pb-4 px-4 flex justify-between items-center shadow-md z-10">
          <div className="flex items-center">
            <div className="bg-emerald-500 p-2 rounded-xl mr-3"><HorseLogo className="w-6 h-6 text-white" /></div>
            <div>
              <h1 className="font-black text-lg tracking-wide">KIOSCO MANUEL</h1>
              <p className="text-xs text-emerald-400 font-medium">{user.email}</p>
            </div>
          </div>
          <button onClick={() => signOut(auth)} className="p-2 bg-gray-800 rounded-full"><LogOut className="w-5 h-5 text-gray-300" /></button>
        </div>

        <div className="flex-1 overflow-hidden relative">
          {activeTab === 'resumen' && <DashboardView />}
          {activeTab === 'caja' && <POSView />}
          {activeTab === 'inventario' && <InventoryView />}
          {activeTab === 'fiados' && <FiadosView />}
          {showSuccess && <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-green-500 text-white px-4 py-2 rounded-full shadow-lg flex items-center text-sm font-bold z-50 animate-bounce"><CheckCircle2 className="w-4 h-4 mr-2" /> Registrado!</div>}
        </div>

        <div className="bg-white border-t border-gray-200 flex justify-around p-2 pb-6 sm:pb-4 absolute bottom-0 w-full z-30">
          {[
            { id: 'resumen', icon: TrendingUp, label: 'Resumen' },
            { id: 'caja', icon: ShoppingCart, label: 'Caja' },
            { id: 'inventario', icon: Package, label: 'Stock' },
            { id: 'fiados', icon: BookOpen, label: 'Fiados' }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex flex-col items-center justify-center w-16 h-14 rounded-xl transition-colors ${isActive ? 'text-emerald-600 bg-emerald-50' : 'text-gray-400'}`}>
                <Icon className={`w-6 h-6 mb-1 ${isActive ? 'stroke-[2.5px]' : ''}`} />
                <span className="text-[10px] font-medium">{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  );
}