import React, { useState, useEffect, useRef } from 'react';
import { auth, db } from './firebase';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ShoppingCart, Package, BookOpen, LogOut, Plus, Minus, Search, Printer, X, CheckCircle2, AlertCircle, TrendingUp, ChevronDown, ChevronUp, HelpCircle, Bell, Trophy, Info, Store, Edit2, Trash2, Receipt, Camera, Loader2, RefreshCw, Image } from 'lucide-react';

const HorseLogo = ({ className = "w-8 h-8" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M8 22h8m-4-20c2.5 0 4 2 4 4 0 1.5-1 3-1 3s1 1 2 2c1 1.5 1 3 0 4.5l-2 3.5h-6l-2-3.5c-1-1.5-1-3 0-4.5 1-1 2-2 2-2s-1-1.5-1-3c0-2 1.5-4 4-4z" />
    <circle cx="13" cy="8" r="1" fill="currentColor"/>
  </svg>
);

// Gemini IA (vision artificial para leer tickets de mayoristas)
const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
const genAI = geminiApiKey ? new GoogleGenerativeAI(geminiApiKey) : null;

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [activeTab, setActiveTab] = useState('caja');

  // Estados de Base de Datos
  const [inventory, setInventory] = useState([]);
  const [sales, setSales] = useState([]);
  const [fiados, setFiados] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [arqueos, setArqueos] = useState([]);
  
  // Estados de UI
  const [cart, setCart] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCheckout, setShowCheckout] = useState(false);
  const [selectedFiadoId, setSelectedFiadoId] = useState('');
  
  // Notificaciones, tutorial y modales
  const [toastMsg, setToastMsg] = useState(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [hasSeenPopup, setHasSeenPopup] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [editProductModal, setEditProductModal] = useState(null);
  const [newPurchaseModal, setNewPurchaseModal] = useState(false);
  const [editPurchaseModal, setEditPurchaseModal] = useState(null);
  const [showArqueoModal, setShowArqueoModal] = useState(false);
  const [arqueoActual, setArqueoActual] = useState('');

  // Lector inteligente de tickets
  const [isScanning, setIsScanning] = useState(false);
  const [scannedTicket, setScannedTicket] = useState(null);
  const ticketInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Auth Listener con bloqueo de usuario
  useEffect(() => {
    if (!auth) { setLoading(false); return; }
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

  // Firestore Listeners
  useEffect(() => {
    if (!user || !db) return;
    const unsubInv = onSnapshot(collection(db, 'inventory'), (snap) => setInventory(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubSales = onSnapshot(collection(db, 'sales'), (snap) => setSales(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubFiados = onSnapshot(collection(db, 'fiados'), (snap) => setFiados(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubPurchases = onSnapshot(collection(db, 'purchases'), (snap) => setPurchases(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubArqueos = onSnapshot(collection(db, 'arqueos'), (snap) => setArqueos(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { unsubInv(); unsubSales(); unsubFiados(); unsubPurchases(); unsubArqueos(); };
  }, [user]);

  // Pop-up de alertas al iniciar
  useEffect(() => {
    if (user && !loading && !hasSeenPopup && (inventory.length > 0 || fiados.length > 0)) {
      setShowPopup(true);
      setHasSeenPopup(true);
    }
  }, [user, loading, inventory.length, fiados.length, hasSeenPopup]);

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    try { await signInWithEmailAndPassword(auth, email, password); } 
    catch (error) { alert('Error de ingreso. Verifica tu correo y clave.'); }
  };

  const saveArqueo = async () => {
    const actual = Number(arqueoActual);
    if (isNaN(actual) || actual < 0) return showToast('Ingresa un monto de caja valido.');
    const todayStr = new Date().toDateString();
    const expected = sales.filter(s => new Date(s.date).toDateString() === todayStr && s.method === 'efectivo').reduce((a, s) => a + s.total, 0);
    const diff = actual - expected;
    await addDoc(collection(db, 'arqueos'), { date: new Date().toISOString(), expected, actual, difference: diff });
    setArqueoActual('');
    setShowArqueoModal(false);
    showToast(`Arqueo guardado. Diferencia: $${diff}`);
  };

  const saveEditedPurchase = async () => {
    if (!editPurchaseModal || !editPurchaseModal.supplier || !editPurchaseModal.total) return showToast('Completa lugar y monto.');
    await updateDoc(doc(db, 'purchases', editPurchaseModal.id), { supplier: editPurchaseModal.supplier, total: Number(editPurchaseModal.total), details: editPurchaseModal.details });
    setEditPurchaseModal(null);
    showToast('Compra actualizada.');
  };

  // --- LOGICA DE CAJA ---
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

  const decreaseFromCart = (productId) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === productId);
      if (!existing) return prev;
      if (existing.quantity === 1) {
        return prev.filter(item => item.product.id !== productId);
      }
      return prev.map(item =>
        item.product.id === productId
          ? { ...item, quantity: item.quantity - 1, subtotal: (item.quantity - 1) * item.product.price }
          : item
      );
    });
  };

  const removeFromCart = (productId) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const processSale = async (method) => {
    if (cart.length === 0) return showToast('El carrito esta vacio. Toca algun producto.');
    if (method === 'fiado' && !selectedFiadoId) return showToast('Selecciona un cliente para fiarle.');

    try {
      await addDoc(collection(db, 'sales'), {
        items: cart, total: cartTotal, method: method, date: new Date().toISOString(), timestamp: serverTimestamp()
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
            history: arrayUnion({ date: new Date().toISOString(), description: `Compra (${cart.length} art.)`, amount: cartTotal, type: 'cargo' })
          });
        }
      }

      setCart([]);
      setShowCheckout(false);
      showToast('Venta registrada con exito!');
    } catch (error) { showToast('Hubo un error procesando la venta.'); }
  };  // --- LOGICA DE IA (ESCANER DE TICKET) ---
  const fileToGenerativePart = async (file) => {
    const base64EncodedDataPromise = new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.readAsDataURL(file);
    });
    return { inlineData: { data: await base64EncodedDataPromise, mimeType: file.type } };
  };

  const handleTicketUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!genAI) {
      e.target.value = '';
      return showToast('Falta la API key de Gemini. Agregala en .env como VITE_GEMINI_API_KEY.');
    }

    setIsScanning(true);
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      const imagePart = await fileToGenerativePart(file);
      const prompt = "Actua como un lector de tickets de mayoristas en Argentina. Analiza esta imagen y extrae los productos comprados. Devuelve UNICAMENTE un arreglo en formato JSON valido, sin texto adicional ni formato markdown. Cada objeto debe tener: 'name' (nombre del producto limpio, sin codigos raros), 'quantity' (cantidad comprada, en numero), 'cost' (precio de costo pagado en total por esa cantidad, en numero). Ignora impuestos, totales o datos del local.";

      const result = await model.generateContent([prompt, imagePart]);
      let responseText = result.response.text();
      responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();

      const parsedItems = JSON.parse(responseText);

      const ticketData = {
        supplier: "Mayorista (IA)",
        totalCost: parsedItems.reduce((sum, item) => sum + (Number(item.cost) || 0), 0),
        items: parsedItems.map(item => ({
          ...item,
          id: Date.now() + Math.random(),
          price: ''
        }))
      };

      setScannedTicket(ticketData);
    } catch (error) {
      console.error(error);
      showToast('La IA no pudo leer el ticket. Saca una foto mas clara.');
    } finally {
      setIsScanning(false);
      e.target.value = '';
    }
  };

  const confirmScannedTicket = async () => {
    const missingPrices = scannedTicket.items.some(item => !item.price || item.price <= 0);
    if (missingPrices) return showToast('Completa el Precio de Venta en todos los productos.');

    try {
      let detailString = [];

      for (const item of scannedTicket.items) {
        detailString.push(`${item.quantity} ${item.name}`);
        const existingProduct = inventory.find(p => p.name.toLowerCase() === item.name.toLowerCase());

        if (existingProduct) {
          await updateDoc(doc(db, 'inventory', existingProduct.id), {
            stock: existingProduct.stock + Number(item.quantity),
            cost: Number(item.cost) / Number(item.quantity),
            price: Number(item.price)
          });
        } else {
          await addDoc(collection(db, 'inventory'), {
            name: item.name,
            stock: Number(item.quantity),
            cost: Number(item.cost) / Number(item.quantity),
            price: Number(item.price),
            minStock: 5, category: 'General', isService: false
          });
        }
      }

      await addDoc(collection(db, 'purchases'), {
        supplier: scannedTicket.supplier,
        total: scannedTicket.totalCost,
        details: detailString.join(', '),
        date: new Date().toISOString()
      });

      setScannedTicket(null);
      showToast('Ticket procesado. Stock y gastos actualizados.');
    } catch (error) {
      showToast('Error al guardar los datos.');
    }
  };

  // --- VISTAS ---
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
            {product.stock <= (product.minStock || 5) && !product.isService && <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>}
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
          <div className="bg-gray-900 rounded-2xl shadow-2xl p-4 text-white flex flex-col max-h-[50vh]">
            <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-700">
              <span className="text-gray-300 text-sm font-bold">Resumen de Venta</span>
              <button onClick={() => setCart([])} className="text-xs text-red-400 font-bold active:text-red-300">Vaciar Todo</button>
            </div>

            <div className="overflow-y-auto mb-3 space-y-3 px-1">
              {cart.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center">
                  <div className="flex-1 pr-2">
                    <p className="text-sm font-medium leading-tight line-clamp-1">{item.product.name}</p>
                    <p className="text-xs text-emerald-400">${item.product.price} c/u</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center bg-gray-800 rounded-lg">
                      <button onClick={() => decreaseFromCart(item.product.id)} className="p-1.5 text-gray-300 active:text-white active:bg-gray-700 rounded-l-lg"><Minus className="w-3.5 h-3.5"/></button>
                      <span className="w-6 text-center text-sm font-bold">{item.quantity}</span>
                      <button onClick={() => addToCart(item.product)} className="p-1.5 text-gray-300 active:text-white active:bg-gray-700 rounded-r-lg"><Plus className="w-3.5 h-3.5"/></button>
                    </div>
                    <span className="font-bold w-12 text-right text-sm">${item.subtotal}</span>
                    <button onClick={() => removeFromCart(item.product.id)} className="text-red-400 p-1 active:bg-gray-800 rounded-md"><Trash2 className="w-4 h-4"/></button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-gray-700 mb-3">
              <span className="text-gray-400 text-sm">Total a cobrar</span>
              <span className="text-2xl font-bold text-emerald-400">${cartTotal}</span>
            </div>
            <button onClick={() => setShowCheckout(true)} className="w-full bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] transition-transform text-white font-bold py-3 rounded-xl">Continuar</button>
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
  );  const InventoryView = () => {
    const handleManualStockChange = async (id, newStockValue) => {
      const parsedStock = parseInt(newStockValue, 10);
      if (!isNaN(parsedStock) && parsedStock >= 0) await updateDoc(doc(db, 'inventory', id), { stock: parsedStock });
    };

    return (
      <div className="p-4 pb-24 h-full overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-bold text-gray-800 text-lg">Tu Mercaderia</h2>
          <button onClick={() => setEditProductModal({ isNew: true, name: '', cost: 0, price: 0, stock: 0 })} className="bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center"><Plus className="w-4 h-4 mr-1"/> Nuevo</button>
        </div>
        
        <div className="space-y-3">
          {inventory.map(item => (
            <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <span className="font-bold text-gray-800 block">{item.name}</span>
                  <span className="text-xs text-gray-500">Costo Ref: ${item.cost?.toFixed(2) || 0}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-emerald-600">${item.price}</span>
                  <button onClick={() => setEditProductModal({ ...item, isNew: false })} className="text-blue-500 bg-blue-50 p-1.5 rounded-md"><Edit2 className="w-4 h-4"/></button>
                  <button onClick={async () => { if(window.confirm(`Borrar ${item.name}?`)) await deleteDoc(doc(db, 'inventory', item.id)); }} className="text-red-500 bg-red-50 p-1.5 rounded-md"><Trash2 className="w-4 h-4"/></button>
                </div>
              </div>
              
              {!item.isService && (
                <div className="flex justify-between items-center mt-2 pt-3 border-t border-gray-50">
                  <span className="text-sm font-medium text-gray-600">Stock (U):</span>
                  <div className="flex gap-1 items-center">
                    <button onClick={() => updateDoc(doc(db, 'inventory', item.id), { stock: Math.max(0, item.stock - 1)})} className="bg-gray-100 p-2 rounded-lg active:bg-gray-200"><Minus className="w-4 h-4"/></button>
                    <input type="number" defaultValue={item.stock} onBlur={(e) => handleManualStockChange(item.id, e.target.value)} className={`w-16 text-center font-bold bg-gray-50 border border-gray-200 rounded-lg py-1.5 outline-none focus:border-emerald-500 focus:bg-white ${item.stock <= (item.minStock || 5) ? 'text-red-500' : 'text-gray-800'}`} />
                    <button onClick={() => updateDoc(doc(db, 'inventory', item.id), { stock: item.stock + 1})} className="bg-emerald-50 text-emerald-600 p-2 rounded-lg active:bg-emerald-100"><Plus className="w-4 h-4"/></button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {editProductModal && (
          <div className="absolute inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full rounded-3xl p-6 relative">
              <button onClick={() => setEditProductModal(null)} className="absolute top-4 right-4 bg-gray-100 p-2 rounded-full"><X className="w-5 h-5"/></button>
              <h2 className="text-xl font-bold mb-4">{editProductModal.isNew ? 'Nuevo Producto' : 'Editar Producto'}</h2>
              <div className="space-y-3">
                <div><label className="text-xs text-gray-500 font-bold uppercase">Nombre</label><input type="text" className="w-full bg-gray-50 border p-3 rounded-xl mt-1" value={editProductModal.name} onChange={e => setEditProductModal({...editProductModal, name: e.target.value})} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs text-gray-500 font-bold uppercase">Costo Unid. ($)</label><input type="number" className="w-full bg-gray-50 border p-3 rounded-xl mt-1" value={editProductModal.cost} onChange={e => setEditProductModal({...editProductModal, cost: Number(e.target.value)})} /></div>
                  <div><label className="text-xs text-gray-500 font-bold uppercase">Precio Venta ($)</label><input type="number" className="w-full bg-gray-50 border p-3 rounded-xl mt-1" value={editProductModal.price} onChange={e => setEditProductModal({...editProductModal, price: Number(e.target.value)})} /></div>
                </div>
                <div><label className="text-xs text-gray-500 font-bold uppercase">Stock Actual (Unidades)</label><input type="number" className="w-full bg-gray-50 border p-3 rounded-xl mt-1" value={editProductModal.stock} onChange={e => setEditProductModal({...editProductModal, stock: Number(e.target.value)})} /></div>
                
                <button onClick={async () => {
                  if (!editProductModal.name || editProductModal.price <= 0) return showToast('Completa nombre y precio.');
                  const pData = { name: editProductModal.name, cost: editProductModal.cost, price: editProductModal.price, stock: editProductModal.stock, minStock: 5, category: 'General', isService: false };
                  if (editProductModal.isNew) await addDoc(collection(db, 'inventory'), pData);
                  else await updateDoc(doc(db, 'inventory', editProductModal.id), pData);
                  setEditProductModal(null); showToast('Guardado.');
                }} className="w-full bg-gray-900 text-white font-bold py-3 rounded-xl mt-2">Guardar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const ComprasView = () => {
    return (
      <div className="p-4 pb-24 h-full overflow-y-auto">
        {scannedTicket && (
          <div className="absolute inset-0 bg-white z-50 flex flex-col h-full">
            <div className="bg-gray-900 text-white p-4 flex justify-between items-center shadow-md">
              <h2 className="font-bold">Revision de IA</h2>
              <button onClick={() => setScannedTicket(null)} className="p-2 bg-gray-800 rounded-full"><X className="w-5 h-5"/></button>
            </div>
            
            <div className="p-4 flex-1 overflow-y-auto">
              <div className="bg-blue-50 text-blue-800 p-3 rounded-xl text-sm mb-4 border border-blue-100 flex">
                <Info className="w-5 h-5 mr-2 shrink-0"/> Esto es lo que leyo el sistema. Corregi si hay algun error y agrega el <b>Precio de Venta</b>.
              </div>
              
              <div className="mb-4">
                <label className="text-xs font-bold text-gray-500 uppercase">Mayorista</label>
                <input type="text" className="w-full border-b-2 border-gray-200 py-2 font-bold text-gray-800 outline-none focus:border-blue-500" value={scannedTicket.supplier} onChange={e => setScannedTicket({...scannedTicket, supplier: e.target.value})} />
              </div>

              <div className="space-y-4">
                {scannedTicket.items.map((item, index) => (
                  <div key={item.id} className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm relative">
                    <button onClick={() => {
                      const newItems = scannedTicket.items.filter(i => i.id !== item.id);
                      setScannedTicket({...scannedTicket, items: newItems});
                    }} className="absolute -top-2 -right-2 bg-red-100 text-red-600 p-1.5 rounded-full shadow-sm"><Trash2 className="w-4 h-4"/></button>
                    
                    <input type="text" className="w-full font-bold text-gray-800 border-b border-gray-100 pb-1 mb-2 outline-none" value={item.name} onChange={e => {
                      const newItems = [...scannedTicket.items];
                      newItems[index].name = e.target.value;
                      setScannedTicket({...scannedTicket, items: newItems});
                    }} />
                    
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <span className="text-[10px] text-gray-500 font-bold uppercase">Cant (U)</span>
                        <input type="number" className="w-full bg-gray-50 rounded p-2 text-sm font-medium" value={item.quantity} onChange={e => {
                          const newItems = [...scannedTicket.items]; newItems[index].quantity = e.target.value; setScannedTicket({...scannedTicket, items: newItems});
                        }} />
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 font-bold uppercase">Costo T.</span>
                        <input type="number" className="w-full bg-gray-50 rounded p-2 text-sm font-medium" value={item.cost} onChange={e => {
                          const newItems = [...scannedTicket.items]; newItems[index].cost = e.target.value; setScannedTicket({...scannedTicket, items: newItems});
                        }} />
                      </div>
                      <div>
                        <span className="text-[10px] text-emerald-600 font-bold uppercase">Venta (U)</span>
                        <input type="number" placeholder="$" className="w-full bg-emerald-50 border border-emerald-200 rounded p-2 text-sm font-bold text-emerald-700 outline-none focus:ring-2 ring-emerald-500" value={item.price} onChange={e => {
                          const newItems = [...scannedTicket.items]; newItems[index].price = e.target.value; setScannedTicket({...scannedTicket, items: newItems});
                        }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="p-4 bg-gray-50 border-t border-gray-200 pb-8">
              <button onClick={confirmScannedTicket} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl flex items-center justify-center text-lg">
                <CheckCircle2 className="w-5 h-5 mr-2"/> Confirmar Ticket
              </button>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center mb-4">
          <h2 className="font-bold text-gray-800 text-lg">Compras Mayoristas</h2>
          <div className="flex gap-2">
            <input type="file" accept="image/*" capture="environment" ref={ticketInputRef} onChange={handleTicketUpload} className="hidden" />
            <input type="file" accept="image/*" ref={galleryInputRef} onChange={handleTicketUpload} className="hidden" />
            <button onClick={() => ticketInputRef.current?.click()} disabled={isScanning} className="bg-blue-600 text-white px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center shadow-md disabled:opacity-50">
              {isScanning ? <Loader2 className="w-4 h-4 mr-1 animate-spin"/> : <Camera className="w-4 h-4 mr-1"/>}
              {isScanning ? 'Leyendo...' : 'Camara'}
            </button>
            <button onClick={() => galleryInputRef.current?.click()} disabled={isScanning} className="bg-emerald-600 text-white px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center shadow-md disabled:opacity-50">
              <Image className="w-4 h-4 mr-1"/>
              Galeria
            </button>
            <button onClick={() => setNewPurchaseModal(true)} className="bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center"><Plus className="w-4 h-4"/></button>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-4 flex justify-between items-center">
          <div>
            <p className="text-xs text-blue-700 font-bold uppercase">Gastado este mes</p>
            <p className="text-2xl font-extrabold text-blue-800">${purchases.filter(p => new Date(p.date).getMonth() === new Date().getMonth() && new Date(p.date).getFullYear() === new Date().getFullYear()).reduce((a, p) => a + (Number(p.total) || 0), 0)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-blue-700 font-bold uppercase">Compras del mes</p>
            <p className="text-2xl font-extrabold text-blue-800">{purchases.filter(p => new Date(p.date).getMonth() === new Date().getMonth() && new Date(p.date).getFullYear() === new Date().getFullYear()).length}</p>
          </div>
        </div>

        <div className="space-y-3">
          {purchases.length === 0 ? (
            <div className="text-center text-gray-400 mt-10 text-sm px-4">Aca vas a ver los tickets de tus compras en el mayorista. Usa la camara para leerlos automaticamente.</div>
          ) : (
            purchases.slice().sort((a,b) => new Date(b.date) - new Date(a.date)).map(purchase => (
              <div key={purchase.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center"><Store className="w-4 h-4 text-gray-400 mr-2"/><span className="font-bold text-gray-800">{purchase.supplier}</span></div>
                  <span className="font-bold text-red-500">-${purchase.total}</span>
                </div>
                <p className="text-xs text-gray-500 mb-2">{new Date(purchase.date).toLocaleDateString()}</p>
                <div className="bg-gray-50 p-2 rounded border border-gray-100 text-sm text-gray-700 italic leading-snug line-clamp-2">"{purchase.details}"</div>
                <div className="flex justify-end mt-2 gap-3">
                  <button onClick={() => setEditPurchaseModal(purchase)} className="text-xs text-blue-500 flex items-center font-medium"><Edit2 className="w-3 h-3 mr-1"/> Editar</button>
                  <button onClick={async () => { if(window.confirm('Borrar ticket?')) await deleteDoc(doc(db, 'purchases', purchase.id)); }} className="text-xs text-red-500 flex items-center font-medium"><Trash2 className="w-3 h-3 mr-1"/> Eliminar</button>
                </div>
              </div>
            ))
          )}
        </div>

        {newPurchaseModal && (
          <div className="absolute inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full rounded-3xl p-6 relative">
              <button onClick={() => setNewPurchaseModal(false)} className="absolute top-4 right-4 bg-gray-100 p-2 rounded-full"><X className="w-5 h-5"/></button>
              <h2 className="text-xl font-bold mb-4">Gasto Manual</h2>
              <div className="space-y-4">
                <div><label className="text-xs text-gray-500 font-bold uppercase">Lugar</label><input type="text" className="w-full bg-gray-50 border p-3 rounded-xl mt-1" id="mSupplier" /></div>
                <div><label className="text-xs text-gray-500 font-bold uppercase">Monto ($)</label><input type="number" className="w-full bg-gray-50 border p-3 rounded-xl mt-1" id="mTotal" /></div>
                <div><label className="text-xs text-gray-500 font-bold uppercase">Detalle</label><textarea rows="3" className="w-full bg-gray-50 border p-3 rounded-xl mt-1 resize-none" id="mDetails"></textarea></div>
                
                <button onClick={async () => {
                  const s = document.getElementById('mSupplier').value; const t = document.getElementById('mTotal').value; const d = document.getElementById('mDetails').value;
                  if (!s || !t) return showToast('Completa lugar y monto.');
                  await addDoc(collection(db, 'purchases'), { supplier: s, total: Number(t), details: d, date: new Date().toISOString() });
                  setNewPurchaseModal(false); showToast('Guardado.');
                }} className="w-full bg-gray-900 text-white font-bold py-3 rounded-xl mt-2">Guardar</button>
              </div>
            </div>
          </div>
        )}

        {editPurchaseModal && (
          <div className="absolute inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full rounded-3xl p-6 relative">
              <button onClick={() => setEditPurchaseModal(null)} className="absolute top-4 right-4 bg-gray-100 p-2 rounded-full"><X className="w-5 h-5"/></button>
              <h2 className="text-xl font-bold mb-4">Editar Compra</h2>
              <div className="space-y-4">
                <div><label className="text-xs text-gray-500 font-bold uppercase">Lugar</label><input type="text" className="w-full bg-gray-50 border p-3 rounded-xl mt-1" value={editPurchaseModal.supplier} onChange={e => setEditPurchaseModal({...editPurchaseModal, supplier: e.target.value})} /></div>
                <div><label className="text-xs text-gray-500 font-bold uppercase">Monto ($)</label><input type="number" className="w-full bg-gray-50 border p-3 rounded-xl mt-1" value={editPurchaseModal.total} onChange={e => setEditPurchaseModal({...editPurchaseModal, total: e.target.value})} /></div>
                <div><label className="text-xs text-gray-500 font-bold uppercase">Detalle</label><textarea rows="3" className="w-full bg-gray-50 border p-3 rounded-xl mt-1 resize-none" value={editPurchaseModal.details} onChange={e => setEditPurchaseModal({...editPurchaseModal, details: e.target.value})}></textarea></div>
                <button onClick={saveEditedPurchase} className="w-full bg-gray-900 text-white font-bold py-3 rounded-xl mt-2">Guardar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };  const FiadosView = () => {
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
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-orange-600 text-lg">${cliente.totalDebt}</span>
                    <button onClick={async () => { if(window.confirm('Eliminar a ' + cliente.name + '?')) await deleteDoc(doc(db, 'fiados', cliente.id)); }} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4"/></button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={async () => {
                    const val = prompt(`Cuanto entrega ${cliente.name}? (Debe: $${cliente.totalDebt})`);
                    if (!val) return; const pago = Number(val);
                    if (isNaN(pago) || pago <= 0) return showToast('Monto invalido.');
                    await updateDoc(doc(db, 'fiados', cliente.id), { 
                      totalDebt: Math.max(0, cliente.totalDebt - pago),
                      history: arrayUnion({ date: new Date().toISOString(), description: 'Abono de deuda', amount: pago, type: 'pago' })
                    });
                    showToast(`Se descontaron $${pago} de ${cliente.name}.`);
                  }} className="flex-1 bg-green-50 text-green-700 py-2 rounded-lg font-semibold text-sm">Abonar</button>
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
  };  const DashboardView = () => {
    const [statPeriod, setStatPeriod] = useState('semana');

    const today = new Date().toDateString();
    const todaySales = sales.filter(s => new Date(s.date).toDateString() === today);
    const totalEfectivo = todaySales.filter(s => s.method === 'efectivo').reduce((acc, s) => acc + s.total, 0);

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

    const getWeeklyVelocity = () => {
      const limit = new Date(new Date().getTime() - 7 * 24 * 60 * 60 * 1000);
      const periodSales = sales.filter(s => new Date(s.date) >= limit);
      const counts = {};
      periodSales.forEach(sale => sale.items.forEach(item => { counts[item.product.id] = (counts[item.product.id] || 0) + item.quantity; }));
      return counts;
    };
    const weeklyVelocity = getWeeklyVelocity();
    const repoSuggestions = inventory.filter(p => !p.isService && (weeklyVelocity[p.id] || 0) > 0 && p.stock < (weeklyVelocity[p.id] * 2)).map(p => ({ ...p, vel: weeklyVelocity[p.id] || 0, sugerido: Math.max(1, (weeklyVelocity[p.id] || 0) * 2 - p.stock) }));
    const criticalStock = inventory.filter(p => !p.isService && p.stock <= (p.minStock || 5));

    return (
      <div className="p-4 space-y-6 pb-24 overflow-y-auto h-full">
        <div className="bg-emerald-600 text-white rounded-2xl p-5 shadow-lg">
          <p className="text-emerald-100 text-sm font-medium">Caja Fisica (Hoy)</p>
          <h2 className="text-4xl font-bold mt-1">${totalEfectivo}</h2>
          <p className="mt-4 text-emerald-50 text-sm border-t border-emerald-500 pt-3">Tickets cobrados hoy: {todaySales.length}</p>
          <button onClick={() => setShowArqueoModal(true)} className="mt-4 w-full bg-white/20 hover:bg-white/30 text-white font-bold py-2 rounded-xl text-sm">Arqueo de Caja</button>
        </div>
        
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
            )) : <p className="text-xs text-gray-400">Aun no hay suficientes ventas para armar el ranking.</p>}
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-4 border border-orange-100">
          <h3 className="font-bold text-gray-800 flex items-center mb-3"><AlertCircle className="w-5 h-5 mr-2 text-orange-500" /> Stock Critico</h3>
          {criticalStock.length > 0 ? criticalStock.map(p => (
            <div key={p.id} className="flex justify-between text-sm py-1.5 border-b border-gray-50">
              <span className="text-gray-700">{p.name}</span>
              <span className="font-bold text-red-500">Quedan {p.stock}</span>
            </div>
          )) : <p className="text-sm text-gray-400">Todo en orden.</p>}
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-4 border border-emerald-100">
          <h3 className="font-bold text-gray-800 flex items-center mb-2"><TrendingUp className="w-5 h-5 mr-2 text-emerald-500" /> Sugerencia de Compra</h3>
          <p className="text-xs text-gray-500 mb-3">Basado en lo que mas vendiste esta semana:</p>
          {repoSuggestions.length > 0 ? repoSuggestions.map(p => (
            <div key={p.id} className="flex justify-between text-sm py-2 border-b border-gray-50">
              <span className="text-gray-700">{p.name} <span className="text-gray-400 text-xs">(vendes {p.vel}/sem)</span></span>
              <span className="font-bold text-emerald-600">Comprar ~{p.sugerido} u.</span>
            </div>
          )) : <p className="text-sm text-gray-400">Sin sugerencias por ahora.</p>}
        </div>
      </div>
    );
  };  // Pop-up de Alertas Inteligentes
  const renderAlertsPopup = () => {
    if (!showPopup) return null;

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

  // Tutorial (Ayuda)
  const renderTutorial = () => {
    if (!showTutorial) return null;
    return (
      <div className="absolute inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
        <div className="bg-white w-full rounded-3xl p-6 relative">
          <button onClick={() => setShowTutorial(false)} className="absolute top-4 right-4 bg-gray-100 p-2 rounded-full"><X className="w-5 h-5"/></button>
          <div className="flex items-center mb-6"><Info className="w-6 h-6 text-blue-500 mr-2"/><h2 className="text-xl font-bold">Como usar la App?</h2></div>
          
          <div className="space-y-4 text-sm text-gray-700">
            <div className="flex"><span className="bg-emerald-100 text-emerald-700 font-bold w-6 h-6 flex items-center justify-center rounded-full mr-3 shrink-0">1</span><p><strong>Stock:</strong> Agrega productos con el boton "Nuevo" o escanea tickets de compra para cargarlos automaticamente.</p></div>
            <div className="flex"><span className="bg-emerald-100 text-emerald-700 font-bold w-6 h-6 flex items-center justify-center rounded-full mr-3 shrink-0">2</span><p><strong>Caja:</strong> Toca productos para venderlos. Dale "Cobrar" y elegi Efectivo o Fiado.</p></div>
            <div className="flex"><span className="bg-emerald-100 text-emerald-700 font-bold w-6 h-6 flex items-center justify-center rounded-full mr-3 shrink-0">3</span><p><strong>Compras:</strong> Saca foto a los tickets del mayorista y la IA lee los productos. Revisa y confirma.</p></div>
            <div className="flex"><span className="bg-emerald-100 text-emerald-700 font-bold w-6 h-6 flex items-center justify-center rounded-full mr-3 shrink-0">4</span><p><strong>Fiados:</strong> Crea clientes, fia ventas y registra pagos. Todo queda en el historial.</p></div>
            <div className="flex"><span className="bg-emerald-100 text-emerald-700 font-bold w-6 h-6 flex items-center justify-center rounded-full mr-3 shrink-0">5</span><p><strong>Resumen:</strong> Mira la plata del dia y el Top 15 de lo mas vendido.</p></div>
          </div>
        </div>
      </div>
    );
  };  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-200 font-bold text-gray-500">Iniciando Kiosco...</div>;

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-200 p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md relative">
          {toastMsg && <div className="absolute -top-16 left-0 right-0 mx-4 bg-gray-800 text-white p-3 rounded-lg text-sm text-center shadow-lg">{toastMsg}</div>}
          <button onClick={() => window.location.reload()} title="Actualizar" className="absolute top-3 right-3 bg-gray-100 p-2 rounded-full"><RefreshCw className="w-5 h-5 text-gray-500" /></button>
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
      <div className="w-full max-w-md bg-gray-50 h-[100dvh] shadow-2xl relative flex flex-col overflow-hidden">
        
        {toastMsg && <div className="absolute top-20 left-4 right-4 bg-gray-900 text-white p-3 rounded-xl text-sm font-medium shadow-xl z-[70]">{toastMsg}</div>}
        {renderAlertsPopup()}
        {renderTutorial()}

        {showArqueoModal && (() => {
          const todayStr = new Date().toDateString();
          const expected = sales.filter(s => new Date(s.date).toDateString() === todayStr && s.method === 'efectivo').reduce((a, s) => a + s.total, 0);
          const actual = Number(arqueoActual) || 0;
          const diff = actual - expected;
          return (
            <div className="absolute inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-white w-full rounded-3xl p-6 relative max-h-[85vh] overflow-y-auto">
                <button onClick={() => setShowArqueoModal(false)} className="absolute top-4 right-4 bg-gray-100 p-2 rounded-full"><X className="w-5 h-5"/></button>
                <h2 className="text-xl font-bold mb-4">Arqueo de Caja</h2>
                <div className="bg-gray-50 p-3 rounded-xl mb-3">
                  <p className="text-sm text-gray-500">Ventas en efectivo hoy (esperado)</p>
                  <p className="text-2xl font-bold text-gray-800">${expected}</p>
                </div>
                <div className="mb-4">
                  <label className="text-xs text-gray-500 font-bold uppercase">Efectivo contado en caja ($)</label>
                  <input type="number" inputMode="decimal" className="w-full bg-gray-50 border p-3 rounded-xl mt-1 text-lg font-bold" value={arqueoActual} onChange={e => setArqueoActual(e.target.value)} placeholder="0" />
                </div>
                <div className="bg-emerald-50 p-3 rounded-xl mb-4 flex justify-between">
                  <span className="text-sm font-medium text-gray-600">Diferencia</span>
                  <span className={`font-bold ${diff >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{diff >= 0 ? '+' : ''}${diff}</span>
                </div>
                <button onClick={saveArqueo} className="w-full bg-gray-900 text-white font-bold py-3 rounded-xl mb-4">Guardar Arqueo</button>
                {arqueos.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase mb-2">Ultimos arqueos</p>
                    <div className="space-y-2">
                      {[...arqueos].reverse().slice(0, 5).map(a => (
                        <div key={a.id} className="flex justify-between text-sm border-b border-gray-100 pb-1">
                          <span className="text-gray-500">{new Date(a.date).toLocaleDateString()} {new Date(a.date).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span>
                          <span className={`font-bold ${a.difference >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{a.difference >= 0 ? '+' : ''}${a.difference}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        <div className="bg-gray-900 text-white pt-6 pb-4 px-4 flex justify-between items-center shadow-md z-10">
          <div className="flex items-center"><div className="bg-emerald-500 p-2 rounded-xl mr-3"><HorseLogo className="w-6 h-6 text-white" /></div><h1 className="font-black text-lg tracking-wide">KIOSCO MANUEL</h1></div>
          <div className="flex gap-2">
            <button onClick={() => window.location.reload()} title="Actualizar" className="p-2 bg-gray-800 rounded-full active:bg-emerald-500 transition-colors"><RefreshCw className="w-5 h-5 text-gray-300" /></button>
            <button onClick={() => setShowTutorial(true)} className="p-2 bg-gray-800 rounded-full active:bg-blue-500 transition-colors"><HelpCircle className="w-5 h-5 text-gray-300" /></button>
            <button onClick={() => signOut(auth)} className="p-2 bg-gray-800 rounded-full active:bg-red-500 transition-colors"><LogOut className="w-5 h-5 text-gray-300" /></button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden relative">
          {activeTab === 'resumen' && <DashboardView />}
          {activeTab === 'caja' && <POSView />}
          {activeTab === 'inventario' && <InventoryView />}
          {activeTab === 'compras' && <ComprasView />}
          {activeTab === 'fiados' && <FiadosView />}
        </div>

        <div className="bg-white border-t border-gray-200 flex justify-around p-2 pb-6 sm:pb-4 absolute bottom-0 w-full z-30">
          {[
            { id: 'resumen', icon: TrendingUp, label: 'Resumen' },
            { id: 'caja', icon: ShoppingCart, label: 'Caja' },
            { id: 'inventario', icon: Package, label: 'Stock' },
            { id: 'compras', icon: Receipt, label: 'Compras' },
            { id: 'fiados', icon: BookOpen, label: 'Fiados' }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex flex-col items-center justify-center w-[18%] h-14 rounded-xl transition-colors ${isActive ? 'text-emerald-600 bg-emerald-50' : 'text-gray-400'}`}>
                <Icon className={`w-5 h-5 mb-1 ${isActive ? 'stroke-[2.5px]' : ''}`} />
                <span className="text-[9px] font-bold">{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  );
}