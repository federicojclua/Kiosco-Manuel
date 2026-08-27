import React, { useState, useEffect } from 'react';
import { auth, googleProvider } from './firebase';
import { signInWithPopup, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { Home, ShoppingCart, Package, BookOpen, Truck, LogOut } from 'lucide-react';

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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    try { await signInWithPopup(auth, googleProvider); } 
    catch (error) { alert("Error al iniciar con Google. Verifica que el dominio de Netlify este agregado en Firebase Auth."); }
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    try { await signInWithEmailAndPassword(auth, email, password); } 
    catch (error) { alert("Error: " + error.message); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-200 text-gray-500 font-bold">Cargando Kiosco...</div>;

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-200 p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md">
          <div className="flex flex-col items-center mb-8">
            <div className="bg-emerald-500 p-4 rounded-full mb-4"><HorseLogo className="w-12 h-12 text-white" /></div>
            <h1 className="text-2xl font-black text-gray-800">Kiosco Manuel</h1>
            <p className="text-gray-500 text-sm mt-1">Gestión de Stock y Ventas</p>
          </div>
          
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <input type="email" placeholder="Correo electrónico" className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" value={email} onChange={e => setEmail(e.target.value)} required />
            <input type="password" placeholder="Contraseña" className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" value={password} onChange={e => setPassword(e.target.value)} required />
            <button type="submit" className="w-full bg-gray-900 text-white font-bold py-3 rounded-xl hover:bg-gray-800 transition-colors">Ingresar</button>
          </form>
          
          <div className="my-6 flex items-center"><div className="flex-1 border-t border-gray-200"></div><span className="px-3 text-gray-400 text-sm font-medium">O</span><div className="flex-1 border-t border-gray-200"></div></div>
          
          <button onClick={handleGoogleLogin} className="w-full border border-gray-300 bg-white text-gray-700 font-bold py-3 rounded-xl flex items-center justify-center hover:bg-gray-50 transition-colors">
            <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5 mr-3" alt="Google" />
            Continuar con Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-200">
      <div className="w-full max-w-md bg-gray-50 h-[100dvh] shadow-2xl relative flex flex-col sm:rounded-[2.5rem] sm:border-[8px] border-gray-900 overflow-hidden">
        
        {/* Header */}
        <div className="bg-gray-900 text-white pt-6 pb-4 px-4 flex justify-between items-center shadow-md z-10">
          <div className="flex items-center">
            <div className="bg-emerald-500 p-2 rounded-xl mr-3"><HorseLogo className="w-6 h-6 text-white" /></div>
            <div>
              <h1 className="font-black text-lg tracking-wide">KIOSCO MANUEL</h1>
              <p className="text-xs text-emerald-400 font-medium">{user.email}</p>
            </div>
          </div>
          <button onClick={() => signOut(auth)} className="p-2 bg-gray-800 rounded-full hover:bg-red-500 transition-colors">
            <LogOut className="w-5 h-5 text-gray-300" />
          </button>
        </div>

        {/* Dynamic Content Area */}
        <div className="flex-1 overflow-y-auto p-4 pb-24 flex flex-col items-center justify-center text-center">
           <Package className="w-16 h-16 text-emerald-500 mb-4 opacity-50" />
           <h2 className="text-xl font-bold text-gray-800 mb-2">Sección: {activeTab.toUpperCase()}</h2>
           <p className="text-gray-500 text-sm max-w-[250px]">
             Tu App está lista en React + Vite. Aquí se renderizarán los módulos usando tu base de datos de Firestore.
           </p>
        </div>

        {/* Bottom Navigation */}
        <div className="bg-white border-t border-gray-200 flex justify-around p-2 pb-6 sm:pb-4 absolute bottom-0 w-full z-30">
          {[
            { id: 'resumen', icon: Home, label: 'Resumen' },
            { id: 'caja', icon: ShoppingCart, label: 'Caja' },
            { id: 'inventario', icon: Package, label: 'Stock' },
            { id: 'fiados', icon: BookOpen, label: 'Fiados' },
            { id: 'proveedores', icon: Truck, label: 'Proveed.' }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex flex-col items-center justify-center w-16 h-14 rounded-xl transition-colors ${isActive ? 'text-emerald-600 bg-emerald-50' : 'text-gray-400 hover:text-gray-600'}`}>
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
