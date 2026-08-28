import React, { useState, useEffect, useRef } from 'react';
import { auth, googleProvider, db } from './firebase';
import { signInWithPopup, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { Home, ShoppingCart, Package, BookOpen, LogOut, Plus, Minus, Search, Printer, X, CheckCircle2, AlertCircle, TrendingUp, Upload, ChevronDown, ChevronUp, HelpCircle, Bell, Trophy, Info } from 'lucide-react';

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

  // Estados de BD
  const [inventory, setInventory] = useState([]);
  const [sales, setSales] = useState([]);
  const [fiados, setFiados] = useState([]);
  
  // Estados UI y Experiencia
  const [cart, setCart] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCheckout, setShowCheckout] = useState(false);
  const [selectedFiadoId, setSelectedFiadoId] = useState('');
  
  // Pop-ups y Notificaciones
  const [toastMsg, setToastMsg] = useState(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [hasSeenPopup, setHasSeenPopup] = useState(false);
  const [showPopup, setShowPopup] = useState(false);

  const fileInputRef = useRef(null);

  // Helper para Tostadas (Explicaciones de acciones)
  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        if (currentUser.email !== 'manux6forever@gmail.com') {
          signOut(auth);
          alert('Acceso denegado. Solo el administrador puede usar esta aplicacion.');
          setUser(null);
        } else {
          setUser(currentUser);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubInv = onSnapshot(collection(db, 'inventory'), (snap) => setInventory(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubSales = onSnapshot(collection(db, 'sales'), (snap) => setSales(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubFiados = onSnapshot(collection(db, 'fiados'), (snap) => setFiados(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { unsubInv(); unsubSales(); unsubFiados(); };
  }, [user]);

  // Logica para descubrir si hay alertas al iniciar (Stock bajo de top vendidos o Fiados pendientes)
  useEffect(() => {
    if (user && !loading && !hasSeenPopup && (inventory.length > 0 || fiados.length > 0)) {
      setShowPopup(true);
      setHasSeenPopup(true);
    }
  }, [user, loading, inventory.length, fiados.length, hasSeenPopup]);

  const handleGoogleLogin = async () => {
    try { await signInWithPopup(auth, googleProvider); } 
    catch (error) { alert("Error con Google: " + error.message); }
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    try { await signInWithEmailAndPassword(auth, email, password); } 
    catch (error) { alert("Error de ingreso. Verifica tu correo y clave."); }
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
    if (cart.length === 0) {
      return showToast('El carrito esta vacio. Toca algun producto para empezar a cobrar.');
    }
    if (method === 'fiado' && !selectedFiadoId) {
      return showToast('Te olvidaste de elegir a quien fiarle. Selecciona un cliente de la lista.');
    }

    try {
      await addDoc(collection(db, 'sales'), {
        items: cart, total: cartTotal, method: method,
        date: new Date().toISOString(), timestamp: serverTimestamp()
      });

      for (const item of cart) {
        if (!item.product.isService) {
          const prodRef = doc(db, 'inventory', item.product.id);
          await updateDoc(prodRef, { stock: Math.max(0, item.product.stock - item.quantity) });
        }
      }

      if (method === 'fiado') {
        const cliente = fiados.find(f => f.id === selectedFiadoId);
        if (cliente) {
          await updateDoc(doc(db, 'fiados', cliente.id), { 
            totalDebt: cliente.totalDebt + cartTotal,
            history: arrayUnion({
              date: new Date().toISOString(),
              description: `Compra (${cart.length} articulos)`, amount: cartTotal, type: 'cargo'
            })
          });
        }
      }

      setCart([]);
      setShowCheckout(false);
      showToast('Venta registrada con exito!');
    } catch (error) {
      showToast('Hubo un error de conexion al procesar la venta.');
    }
  };

  const handleCSVUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const rows = text.split(/\r?\n/).slice(1);
        let count = 0;
        for (let row of rows) {
          if (!row.trim()) continue;
          const [name, cost, price, stock] = row.split(',');
          if (name && price) {
            await addDoc(collection(db, 'inventory'), {
              name: name.trim(), cost: Number(cost) || 0, price: Number(price) || 0,
              stock: Number(stock) || 0, minStock: 5, category: 'General', isService: false
            });
            count++;
          }
        }
        showToast(`Se importaron ${count} productos correctamente.`);
      } catch (error) {
        showToast('El archivo no tiene el formato correcto. Revisa que sea un CSV valido.');
      }
      e.target.value = ''; 
    };
    reader.readAsText(file);
  };  // --- VISTAS ---
  const POSView = () => (
    <div className="h-full flex flex-col pb-20">
      <div className="p-3 bg-white shadow-sm z-10 relative">
        <Search className="absolute left-6 top-5 text-gray-400 w-5 h-5" />
        <input type="text" placeholder="Buscar producto..." 
          className="w-full bg-gray-100 rounded-full py-2 pl-10 pr-4 outline-none focus:ring-2 focus:ring-emerald-500"
          value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
      </div>
      
      <div className="flex-1 overflow-y-auto p-3 grid grid-cols-3 gap-2 content-start bg-gray-50">
        {inventory.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())).map(product => (
          <button key={product.id} onClick={() => addToCart(product)} className="bg-white p-2 rounded-xl shadow-sm flex flex-col items-center justify-center text-center active:scale-95 border border-gray-100 relative">
            {product.stock <= product.minStock && !product.isService && <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>}
            <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2">
              {product.isService ? <Printer className="w-5 h-5"/> : <Package className="w-5 h-5"/>}
            </div>
            <span className="text-xs font-semibold text-gray-800 leading-tight line-clamp-2">{product.name}</span>
            <span className="text-sm font-bold text-emerald-600 mt-1">${product.price}</span>
          </button>
        ))}
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
              <h2 className="text-xl font-bold">Finalizar Venta</h2>
              <button onClick={() => setShowCheckout(false)} className="bg-gray-100 p-2 rounded-full"><X className="w-5 h-5"/></button>
            </div>
            <div className="text-center mb-8">
              <p className="text-gray-500">Total a pagar</p>
              <p className="text-5xl font-extrabold text-emerald-600">${cartTotal}</p>
            </div>
            <button onClick={() => processSale('efectivo')} className="w-full bg-gray-900 text-white font-bold py-4 rounded-xl mb-4 text-lg">Paga en Efectivo</button>
            <div className="relative pt-2 pb-4">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div>
              <div className="relative flex justify-center"><span className="px-2 bg-white text-sm text-gray-500">O anotar en libreta</span></div>
            </div>
            <select className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 mb-2 outline-none" value={selectedFiadoId} onChange={(e) => setSelectedFiadoId(e.target.value)}>
              <option value="">Seleccionar persona...</option>
              {fiados.map(f => <option key={f.id} value={f.id}>{f.name} (Debe: ${f.totalDebt})</option>)}
            </select>
            <button onClick={() => processSale('fiado')} className="w-full bg-orange-100 text-orange-700 font-bold py-4 rounded-xl text-lg">Fiar Venta</button>
          </div>
        </div>
      )}
    </div>
  );

  const InventoryView = () => (
    <div className="p-4 pb-24 h-full overflow-y-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-bold text-gray-800 text-lg">Tu Mercaderia</h2>
        <div className="flex gap-2">
          <input type="file" accept=".csv" ref={fileInputRef} onChange={handleCSVUpload} className="hidden" />
          <button onClick={() => fileInputRef.current?.click()} className="bg-blue-100 text-blue-700 px-3 py-1 rounded-lg text-sm font-bold flex items-center"><Upload className="w-4 h-4 mr-1"/> CSV</button>
          <button onClick={async () => {
            const name = prompt("Nombre del producto:");
            if (!name) return;
            const cost = Number(prompt("Costo de compra:") || 0);
            const price = Number(prompt("Precio al publico:") || 0);
            const stock = Number(prompt("Cantidad en stock:") || 0);
            await addDoc(collection(db, 'inventory'), { name, cost, price, stock, minStock: 5, category: 'General', isService: false });
          }} className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-lg text-sm font-bold flex items-center"><Plus className="w-4 h-4 mr-1"/> Nuevo</button>
        </div>
      </div>
      
      <div className="space-y-3">
        {inventory.map(item => (
          <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col">
            <div className="flex justify-between">
              <span className="font-bold text-gray-800">{item.name}</span>
              <span className="font-bold text-emerald-600">${item.price}</span>
            </div>
            {!item.isService && (
              <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-50">
                <span className="text-sm font-medium">Stock: <span className={item.stock <= item.minStock ? 'text-red-500 font-bold' : ''}>{item.stock}</span></span>
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
  );  const FiadosView = () => {
    const [expandedId, setExpandedId] = useState(null);

    return (
      <div className="p-4 pb-24 h-full overflow-y-auto">
        <div className="flex justify-between mb-4">
          <h2 className="font-bold text-gray-800 text-lg">Libreta de Fiados</h2>
          <button onClick={async () => {
            const name = prompt("Nombre del alumno o profesor:");
            if (name) await addDoc(collection(db, 'fiados'), { name, totalDebt: 0, history: [] });
          }} className="bg-gray-900 text-white px-3 py-1 rounded-lg text-sm font-bold flex items-center"><Plus className="w-4 h-4 mr-1"/> Nuevo</button>
        </div>
        
        <div className="space-y-3">
          {fiados.map(cliente => (
            <div key={cliente.id} className="bg-white rounded-xl shadow-sm border border-orange-100 overflow-hidden">
              <div className="p-4 flex flex-col">
                <div className="flex justify-between mb-3 items-center">
                  <span className="font-bold text-gray-800">{cliente.name}</span>
                  <span className="font-bold text-orange-600 text-lg">${cliente.totalDebt}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={async () => {
                    const val = prompt(`¿Cuanto entrega ${cliente.name}? (Debe: $${cliente.totalDebt})`);
                    if (!val) return;
                    const pago = Number(val);
                    if (isNaN(pago) || pago <= 0) return showToast("Por favor ingresa un monto valido (solo numeros).");
                    
                    await updateDoc(doc(db, 'fiados', cliente.id), { 
                      totalDebt: Math.max(0, cliente.totalDebt - pago),
                      history: arrayUnion({ date: new Date().toISOString(), description: 'Abono de deuda', amount: pago, type: 'pago' })
                    });
                    showToast(`Se descontaron $${pago} de la cuenta de ${cliente.name}.`);
                  }} className="flex-1 bg-green-50 text-green-700 py-2 rounded-lg font-semibold text-sm">Registrar Pago</button>
                  
                  <button onClick={() => setExpandedId(expandedId === cliente.id ? null : cliente.id)} className="bg-gray-100 p-2 rounded-lg text-gray-600">
                    {expandedId === cliente.id ? <ChevronUp className="w-5 h-5"/> : <ChevronDown className="w-5 h-5"/>}
                  </button>
                </div>
              </div>
              
              {expandedId === cliente.id && (
                <div className="bg-gray-50 p-4 border-t border-gray-100 text-sm">
                  <p className="font-bold text-gray-500 mb-2 text-xs uppercase tracking-wider">Historial</p>
                  {cliente.history && cliente.history.length > 0 ? (
                    <div className="space-y-2">
                      {[...cliente.history].reverse().map((mov, i) => (
                        <div key={i} className="flex justify-between border-b border-gray-200 pb-1">
                          <div>
                            <p className="text-gray-800 font-medium">{mov.description}</p>
                            <p className="text-xs text-gray-400">{new Date(mov.date).toLocaleDateString()}</p>
                          </div>
                          <span className={`font-bold ${mov.type === 'pago' ? 'text-green-600' : 'text-orange-500'}`}>
                            {mov.type === 'pago' ? '-' : '+'}${mov.amount}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-gray-400 italic">No hay historial todavia.</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const DashboardView = () => {
    const [statPeriod, setStatPeriod] = useState('semana'); // 'semana' o 'mes'

    const today = new Date().toDateString();
    const todaySales = sales.filter(s => new Date(s.date).toDateString() === today);
    const totalEfectivo = todaySales.filter(s => s.method === 'efectivo').reduce((acc, s) => acc + s.total, 0);

    // Calculo Top 15 Vendidos
    const getTopProducts = (days) => {
      const limitDate = new Date(new Date().getTime() - days * 24 * 60 * 60 * 1000);
      const periodSales = sales.filter(s => new Date(s.date) >= limitDate);
      const counts = {};
      periodSales.forEach(sale => {
        sale.items.forEach(item => {
          if (!counts[item.product.id]) counts[item.product.id] = { name: item.product.name, qty: 0 };
          counts[item.product.id].qty += item.quantity;
        });
      });
      return Object.values(counts).sort((a,b) => b.qty - a.qty).slice(0, 15);
    };

    const topProducts = getTopProducts(statPeriod === 'semana' ? 7 : 30);

    return (
      <div className="p-4 space-y-6 pb-24 overflow-y-auto h-full">
        <div className="bg-emerald-600 text-white rounded-2xl p-5 shadow-lg">
          <p className="text-emerald-100 text-sm font-medium">Recaudacion Hoy (Caja)</p>
          <h2 className="text-4xl font-bold mt-1">${totalEfectivo}</h2>
          <p className="mt-4 text-emerald-50 text-sm border-t border-emerald-500 pt-3">Tickets cobrados hoy: {todaySales.length}</p>
        </div>
        
        {/* Estadisticas de mas vendidos */}
        <div className="bg-white rounded-2xl shadow-sm p-4 border border-gray-100">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-gray-800 flex items-center"><Trophy className="w-5 h-5 mr-2 text-yellow-500" /> Top 15 Vendidos</h3>
            <select className="bg-gray-100 text-sm rounded-lg p-1 outline-none font-medium text-gray-700" value={statPeriod} onChange={(e) => setStatPeriod(e.target.value)}>
              <option value="semana">Semana</option>
              <option value="mes">Mes</option>
            </select>
          </div>
          
          <div className="space-y-2">
            {topProducts.length > 0 ? topProducts.map((p, i) => (
              <div key={i} className="flex justify-between items-center border-b border-gray-50 pb-2">
                <span className="text-sm text-gray-700"><span className="text-gray-400 font-bold mr-2">{i+1}.</span>{p.name}</span>
                <span className="text-sm font-bold bg-emerald-50 text-emerald-600 px-2 rounded">{p.qty} unid.</span>
              </div>
            )) : <p className="text-xs text-gray-400">Aun no hay suficientes ventas registradas para armar el ranking.</p>}
          </div>
        </div>
      </div>
    );
  };  // Pop-up de Alertas Inteligentes (Render)
  const renderAlertsPopup = () => {
    if (!showPopup) return null;

    // Calcular que mostrar en el pop-up
    const top7Days = (() => {
      const limit = new Date(new Date().getTime() - 7 * 24 * 60 * 60 * 1000);
      const periodSales = sales.filter(s => new Date(s.date) >= limit);
      const counts = {};
      periodSales.forEach(sale => sale.items.forEach(item => { counts[item.product.id] = (counts[item.product.id] || 0) + item.quantity; }));
      return Object.entries(counts).sort((a,b) => b[1] - a[1]).slice(0, 15).map(e => e[0]);
    })();

    const criticalTopProducts = inventory.filter(p => !p.isService && p.stock <= p.minStock && top7Days.includes(p.id));
    const pendingDebts = fiados.filter(f => f.totalDebt > 0);

    if (criticalTopProducts.length === 0 && pendingDebts.length === 0) return null;

    return (
      <div className="absolute inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
        <div className="bg-white w-full rounded-3xl p-6 relative max-h-[80vh] overflow-y-auto">
          <button onClick={() => setShowPopup(false)} className="absolute top-4 right-4 bg-gray-100 p-2 rounded-full"><X className="w-5 h-5"/></button>
          <div className="flex items-center mb-6"><Bell className="w-6 h-6 text-orange-500 mr-2"/><h2 className="text-xl font-bold">Resumen de Alertas</h2></div>
          
          {criticalTopProducts.length > 0 && (
            <div className="mb-6">
              <h3 className="font-bold text-gray-700 text-sm mb-2 uppercase flex items-center"><AlertCircle className="w-4 h-4 mr-1 text-red-500"/> Falta mercaderia clave!</h3>
              <p className="text-xs text-gray-500 mb-3">Estos productos estan en tu Top 15 y te queda poco stock:</p>
              {criticalTopProducts.map(p => (
                <div key={p.id} className="bg-red-50 p-2 rounded-lg flex justify-between text-sm mb-2 border border-red-100">
                  <span className="font-medium text-gray-800">{p.name}</span>
                  <span className="text-red-600 font-bold">Quedan: {p.stock}</span>
                </div>
              ))}
            </div>
          )}

          {pendingDebts.length > 0 && (
            <div>
              <h3 className="font-bold text-gray-700 text-sm mb-2 uppercase flex items-center"><BookOpen className="w-4 h-4 mr-1 text-blue-500"/> Dinero en la calle</h3>
              <p className="text-xs text-gray-500 mb-3">Personas que aun te deben dinero:</p>
              {pendingDebts.map(f => (
                <div key={f.id} className="bg-blue-50 p-2 rounded-lg flex justify-between text-sm mb-2 border border-blue-100">
                  <span className="font-medium text-gray-800">{f.name}</span>
                  <span className="text-blue-700 font-bold">${f.totalDebt}</span>
                </div>
              ))}
            </div>
          )}
          <button onClick={() => setShowPopup(false)} className="w-full mt-4 bg-gray-900 text-white font-bold py-3 rounded-xl">Entendido</button>
        </div>
      </div>
    );
  };

  // Render Tutorial (Ayuda)
  const renderTutorial = () => {
    if (!showTutorial) return null;
    return (
      <div className="absolute inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
        <div className="bg-white w-full rounded-3xl p-6 relative">
          <button onClick={() => setShowTutorial(false)} className="absolute top-4 right-4 bg-gray-100 p-2 rounded-full"><X className="w-5 h-5"/></button>
          <div className="flex items-center mb-6"><Info className="w-6 h-6 text-blue-500 mr-2"/><h2 className="text-xl font-bold">Como usar la App?</h2></div>
          
          <div className="space-y-4 text-sm text-gray-700">
            <div className="flex"><span className="bg-emerald-100 text-emerald-700 font-bold w-6 h-6 flex items-center justify-center rounded-full mr-3 shrink-0">1</span><p><strong>Stock:</strong> Agrega tus productos de a uno o subiendo un archivo Excel (.csv). Si no cargas stock, la Caja estara vacia.</p></div>
            <div className="flex"><span className="bg-emerald-100 text-emerald-700 font-bold w-6 h-6 flex items-center justify-center rounded-full mr-3 shrink-0">2</span><p><strong>Caja:</strong> Toca los productos para venderlos (se armara un carrito). Luego dale a "Cobrar" y elegi si pagan en Efectivo o se anota en libreta.</p></div>
            <div className="flex"><span className="bg-emerald-100 text-emerald-700 font-bold w-6 h-6 flex items-center justify-center rounded-full mr-3 shrink-0">3</span><p><strong>Fiados:</strong> Crea clientes o profesores nuevos. Cuando te paguen, toca "Registrar Pago" para que se descuente la deuda y quede el registro.</p></div>
            <div className="flex"><span className="bg-emerald-100 text-emerald-700 font-bold w-6 h-6 flex items-center justify-center rounded-full mr-3 shrink-0">4</span><p><strong>Resumen:</strong> Mira la plata que entra en el dia, el Top 15 de lo mas vendido y recibe alertas automaticas.</p></div>
          </div>
        </div>
      </div>
    );
  };

  // Pantallas de Carga y Login
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-200 font-bold text-gray-500">Iniciando Kiosco...</div>;

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-200 p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md relative">
          {toastMsg && <div className="absolute -top-16 left-0 right-0 mx-4 bg-gray-800 text-white p-3 rounded-lg text-sm text-center shadow-lg">{toastMsg}</div>}
          <div className="flex flex-col items-center mb-8">
            <div className="bg-emerald-500 p-4 rounded-full mb-4"><HorseLogo className="w-12 h-12 text-white" /></div>
            <h1 className="text-2xl font-black text-gray-800">Kiosco Manuel</h1>
            <p className="text-gray-500 text-sm text-center mt-2">Acceso exclusivo para el administrador</p>
          </div>
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <input type="email" placeholder="Correo" className="w-full bg-gray-50 border p-3 rounded-xl outline-none" value={email} onChange={e => setEmail(e.target.value)} required />
            <input type="password" placeholder="Clave" className="w-full bg-gray-50 border p-3 rounded-xl outline-none" value={password} onChange={e => setPassword(e.target.value)} required />
            <button type="submit" className="w-full bg-gray-900 text-white font-bold py-3 rounded-xl">Ingresar</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-200">
      <div className="w-full max-w-md bg-gray-50 h-[100dvh] shadow-2xl relative flex flex-col sm:rounded-[2.5rem] sm:border-[8px] border-gray-900 overflow-hidden">
        
        {/* Tostada Flotante para errores o confirmaciones */}
        {toastMsg && (
          <div className="absolute top-20 left-4 right-4 bg-gray-900 text-white p-3 rounded-xl text-sm font-medium shadow-xl z-[70] animate-in fade-in slide-in-from-top-5">
            {toastMsg}
          </div>
        )}

        {renderAlertsPopup()}
        {renderTutorial()}

        <div className="bg-gray-900 text-white pt-6 pb-4 px-4 flex justify-between items-center shadow-md z-10">
          <div className="flex items-center">
            <div className="bg-emerald-500 p-2 rounded-xl mr-3"><HorseLogo className="w-6 h-6 text-white" /></div>
            <div>
              <h1 className="font-black text-lg tracking-wide">KIOSCO MANUEL</h1>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowTutorial(true)} className="p-2 bg-gray-800 rounded-full active:bg-blue-500 transition-colors"><HelpCircle className="w-5 h-5 text-gray-300" /></button>
            <button onClick={() => signOut(auth)} className="p-2 bg-gray-800 rounded-full active:bg-red-500 transition-colors"><LogOut className="w-5 h-5 text-gray-300" /></button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden relative">
          {activeTab === 'resumen' && <DashboardView />}
          {activeTab === 'caja' && <POSView />}
          {activeTab === 'inventario' && <InventoryView />}
          {activeTab === 'fiados' && <FiadosView />}
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