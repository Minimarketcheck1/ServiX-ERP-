import React, { useState, useEffect, useCallback, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend } from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
// Added CashRegister to the imported types
import { AppData, View, ERPSection, Product, Supplier, Sale, SaleItem, Cierre, CashRegister } from './types';
import { INITIAL_APP_DATA, USER_PASSWORDS, PAYMENT_METHODS, BILL_OPTIONS } from './constants';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend);

// --- Components ---

const Modal: React.FC<{ 
  isOpen: boolean; 
  onClose: () => void; 
  title: string; 
  children: React.ReactNode;
  width?: string;
}> = ({ isOpen, onClose, title, children, width = 'max-w-md' }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[1000] p-4">
      <div className={`bg-slate-900 border border-slate-700 rounded-2xl w-full ${width} shadow-2xl overflow-hidden`}>
        <div className="flex justify-between items-center p-6 border-b border-slate-700">
          <h3 className="text-xl font-bold">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl">&times;</button>
        </div>
        <div className="p-6 max-h-[80vh] overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ icon: string; title: string; value: string }> = ({ icon, title, value }) => (
  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex items-center gap-4 transition hover:-translate-y-1 shadow-lg">
    <div className="w-14 h-14 bg-blue-600/20 text-blue-500 flex items-center justify-center rounded-xl text-2xl">
      <i className={`fas ${icon}`}></i>
    </div>
    <div>
      <h3 className="text-xs text-slate-400 uppercase tracking-wider mb-1">{title}</h3>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  </div>
);

const Alert: React.FC<{ message: string; type: 'success' | 'error' | 'warning' | 'info'; onRemove: () => void }> = ({ message, type, onRemove }) => {
  useEffect(() => {
    const timer = setTimeout(onRemove, 5000);
    return () => clearTimeout(timer);
  }, [onRemove]);

  const colors = {
    success: 'bg-green-500/10 text-green-500 border-green-500/30',
    error: 'bg-red-500/10 text-red-500 border-red-500/30',
    warning: 'bg-orange-500/10 text-orange-500 border-orange-500/30',
    info: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
  };

  const icons = {
    success: 'fa-check-circle',
    error: 'fa-exclamation-circle',
    warning: 'fa-exclamation-triangle',
    info: 'fa-info-circle',
  };

  return (
    <div className={`p-4 rounded-xl border flex items-center gap-3 mb-4 animate-slide-down ${colors[type]}`}>
      <i className={`fas ${icons[type]}`}></i>
      <span>{message}</span>
    </div>
  );
};

// --- App Component ---

export default function App() {
  const [view, setView] = useState<View>('login');
  const [currentSection, setCurrentSection] = useState<ERPSection>('dashboard');
  const [isLoading, setIsLoading] = useState(false);
  const [appData, setAppData] = useState<AppData>(() => {
    const saved = localStorage.getItem('servix_erp_data');
    return saved ? JSON.parse(saved) : INITIAL_APP_DATA;
  });
  const [currentUser, setCurrentUser] = useState('');
  const [selectedUserForLogin, setSelectedUserForLogin] = useState('');
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [alerts, setAlerts] = useState<{ id: number; message: string; type: any }[]>([]);
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');
  const [selectedBillAmount, setSelectedBillAmount] = useState(0);
  const [customAmount, setCustomAmount] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchBarcode, setSearchBarcode] = useState('');
  const [activeTicket, setActiveTicket] = useState<Sale | null>(null);

  // Persistence
  useEffect(() => {
    localStorage.setItem('servix_erp_data', JSON.stringify(appData));
  }, [appData]);

  const addAlert = useCallback((message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    const id = Date.now();
    setAlerts(prev => [...prev, { id, message, type }]);
  }, []);

  const removeAlert = useCallback((id: number) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  }, []);

  const formatCurrency = (num: number) => `$${num.toLocaleString('es-CL')}`;

  const currentRole = useMemo(() => currentUser === 'Administrador' ? 'admin' : 'caja', [currentUser]);

  const userRegister = useMemo(() => appData.cashRegisters[currentUser], [appData, currentUser]);
  const isCajaOpen = !!userRegister?.isOpen;

  // --- Auth logic ---

  const handleLogin = () => {
    if (password === USER_PASSWORDS[selectedUserForLogin]) {
      setCurrentUser(selectedUserForLogin);
      setPassword('');
      setPasswordError(false);
      setIsLoading(true);
      setTimeout(() => {
        setIsLoading(false);
        setView('modules');
      }, 1000);
    } else {
      setPasswordError(true);
      setPassword('');
    }
  };

  const handleLogout = () => {
    setCurrentUser('');
    setView('login');
    setSelectedUserForLogin('');
    setPassword('');
  };

  // --- Inventory Logic ---

  const [newProduct, setNewProduct] = useState<Partial<Product>>({
    name: '',
    barcode: '',
    category: '',
    supplierId: null,
    quantity: 1,
    lastPurchase: 0,
    saleNet: 0,
    saleIva: 0
  });

  const calculateProfit = useMemo(() => {
    const last = newProduct.lastPurchase || 0;
    const net = newProduct.saleNet || 0;
    const iva = newProduct.saleIva || 0;
    
    if (last === 0 && net === 0 && iva === 0) return null;

    const profit = net > 0 ? net - last : (iva / 1.19) - last;
    const rentability = last > 0 ? (profit / last) * 100 : 0;
    const utility = net > 0 ? (profit / net) * 100 : (iva > 0 ? (profit / (iva / 1.19)) * 100 : 0);

    return { profit, rentability, utility, iva: iva - (iva / 1.19) };
  }, [newProduct]);

  const handleAddProduct = () => {
    if (!newProduct.name) {
      addAlert('El nombre del producto es requerido', 'error');
      return;
    }
    const barcode = newProduct.barcode || `PROD-${Date.now()}`;
    if (appData.inventory.find(p => p.barcode === barcode)) {
      addAlert('El código de barras ya existe', 'error');
      return;
    }

    const prod: Product = {
      id: Date.now(),
      name: newProduct.name!,
      barcode,
      category: newProduct.category || 'Sin categoría',
      supplierId: newProduct.supplierId || null,
      quantity: newProduct.quantity || 0,
      lastPurchase: newProduct.lastPurchase || 0,
      saleNet: newProduct.saleNet || 0,
      saleIva: newProduct.saleIva || 0,
      price: newProduct.saleIva || 0,
      dateAdded: new Date().toISOString()
    };

    setAppData(prev => ({ ...prev, inventory: [...prev.inventory, prod] }));
    setNewProduct({ name: '', barcode: '', category: '', supplierId: null, quantity: 1, lastPurchase: 0, saleNet: 0, saleIva: 0 });
    addAlert('Producto agregado exitosamente', 'success');
  };

  const handleDeleteProduct = (id: number) => {
    if (!confirm('¿Estás seguro de eliminar este producto?')) return;
    setAppData(prev => ({ ...prev, inventory: prev.inventory.filter(p => p.id !== id) }));
    addAlert('Producto eliminado', 'info');
  };

  // --- Sales Logic ---

  const [saleBarcode, setSaleBarcode] = useState('');

  const handleAddToCart = (product: Product) => {
    if (!isCajaOpen) {
      addAlert('La caja está cerrada. Ábrela para vender.', 'error');
      return;
    }
    if (product.quantity <= 0) {
      addAlert('Sin stock disponible', 'error');
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        if (existing.quantity >= product.quantity) {
          addAlert('No hay más stock disponible', 'error');
          return prev;
        }
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { id: product.id, name: product.name, price: product.saleIva, quantity: 1, barcode: product.barcode }];
    });
    addAlert(`${product.name} agregado`, 'success');
  };

  const updateCartQuantity = (id: number, delta: number) => {
    setCart(prev => {
      const item = prev.find(i => i.id === id);
      if (!item) return prev;
      const newQty = item.quantity + delta;
      if (newQty < 1) return prev.filter(i => i.id !== id);
      const inventoryProd = appData.inventory.find(p => p.id === id);
      if (inventoryProd && newQty > inventoryProd.quantity) {
        addAlert('No hay más stock disponible', 'error');
        return prev;
      }
      return prev.map(i => i.id === id ? { ...i, quantity: newQty } : i);
    });
  };

  const cartTotal = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.quantity, 0), [cart]);

  const changeDue = useMemo(() => {
    const paid = selectedBillAmount || customAmount || 0;
    return paid > 0 ? paid - cartTotal : 0;
  }, [selectedBillAmount, customAmount, cartTotal]);

  const processPayment = () => {
    if (!isCajaOpen) return;
    if (cart.length === 0) return;
    if (selectedPaymentMethod === 'efectivo' && (selectedBillAmount || customAmount || 0) < cartTotal) {
      addAlert('Monto insuficiente', 'error');
      return;
    }

    const ticketNumber = appData.ticketCounter;
    const sale: Sale = {
      id: Date.now(),
      ticketNumber,
      date: new Date().toISOString(),
      items: [...cart],
      total: cartTotal,
      paymentMethod: selectedPaymentMethod,
      cashier: currentUser,
      paidAmount: selectedPaymentMethod === 'efectivo' ? (selectedBillAmount || customAmount || cartTotal) : cartTotal,
      change: changeDue
    };

    // Update state
    setAppData(prev => {
      const newInventory = [...prev.inventory];
      cart.forEach(item => {
        const idx = newInventory.findIndex(p => p.id === item.id);
        if (idx !== -1) newInventory[idx].quantity -= item.quantity;
      });

      const updatedReg = { ...prev.cashRegisters[currentUser] };
      updatedReg.sales = [...updatedReg.sales, sale];
      updatedReg.balance += sale.paymentMethod === 'efectivo' ? sale.total : 0;
      updatedReg.history = [...updatedReg.history, {
        type: 'venta',
        amount: sale.total,
        date: sale.date,
        description: `Venta #${sale.ticketNumber}`,
        ticketNumber: sale.ticketNumber
      }];

      return {
        ...prev,
        inventory: newInventory,
        sales: [...prev.sales, sale],
        cashRegisters: { ...prev.cashRegisters, [currentUser]: updatedReg },
        ticketCounter: prev.ticketCounter + 1
      };
    });

    setCart([]);
    setSelectedPaymentMethod('');
    setSelectedBillAmount(0);
    setCustomAmount(null);
    setActiveTicket(sale);
    addAlert(`Venta #${ticketNumber} completada`, 'success');
  };

  // --- Cash Register ---

  const [openingAmountInput, setOpeningAmountInput] = useState(0);
  const [isOpeningModalOpen, setIsOpeningModalOpen] = useState(false);

  const confirmOpening = () => {
    setAppData(prev => {
      const reg = { ...prev.cashRegisters[currentUser] };
      reg.isOpen = true;
      reg.openingAmount = openingAmountInput;
      reg.balance = openingAmountInput;
      reg.history = [...reg.history, {
        type: 'apertura',
        amount: openingAmountInput,
        date: new Date().toISOString(),
        description: 'Apertura de caja'
      }];
      return { ...prev, cashRegisters: { ...prev.cashRegisters, [currentUser]: reg } };
    });
    setIsOpeningModalOpen(false);
    addAlert(`Caja abierta con ${formatCurrency(openingAmountInput)}`, 'success');
  };

  // --- Dashboard Data ---

  const dashboardStats = useMemo(() => {
    const totalProd = appData.inventory.reduce((s, i) => s + i.quantity, 0);
    const invValue = appData.inventory.reduce((s, i) => s + i.lastPurchase * i.quantity, 0);
    const today = new Date().toDateString();
    const todaySales = appData.sales
      .filter(s => new Date(s.date).toDateString() === today)
      .reduce((s, sale) => s + sale.total, 0);
    // Explicitly casting Object.values results to CashRegister[] to fix the 'unknown' property access error
    const totalBalance = (Object.values(appData.cashRegisters) as CashRegister[]).reduce((s, c) => s + c.balance, 0);

    return { totalProd, invValue, todaySales, totalBalance };
  }, [appData]);

  // --- Views ---

  if (view === 'login') {
    return (
      <div className="flex items-center justify-center min-h-screen p-4 bg-slate-950">
        <div className="absolute top-8 left-8">
          <img src="https://i.ibb.co/Q7FQ80Hv/logo.png" alt="Logo" className="w-16 filter drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
        </div>

        <div className="bg-slate-900/50 border border-slate-800 p-10 rounded-3xl w-full max-w-sm shadow-2xl backdrop-blur-sm">
          <h1 className="text-4xl font-bold text-center mb-2 bg-gradient-to-br from-blue-400 to-blue-700 bg-clip-text text-transparent">ServiX ERP</h1>
          <p className="text-slate-400 text-center mb-8">Selecciona acceso</p>

          {!selectedUserForLogin ? (
            <div className="space-y-4">
              <button onClick={() => setSelectedUserForLogin('Caja 1')} className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-800 hover:scale-[1.02] transition rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20">
                <i className="fas fa-cash-register"></i> Caja 1
              </button>
              <button onClick={() => setSelectedUserForLogin('Caja 2')} className="w-full py-4 bg-gradient-to-r from-sky-500 to-sky-700 hover:scale-[1.02] transition rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-sky-900/20">
                <i className="fas fa-cash-register"></i> Caja 2
              </button>
              <button onClick={() => setSelectedUserForLogin('Administrador')} className="w-full py-4 bg-slate-800 hover:bg-slate-700 hover:scale-[1.02] transition rounded-2xl font-bold border border-slate-700 flex items-center justify-center gap-2 shadow-xl">
                <i className="fas fa-user-shield"></i> Administrador
              </button>
            </div>
          ) : (
            <div className="space-y-4 animate-fade-in">
              <input 
                type="password" 
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                autoFocus
                className="w-full p-4 bg-slate-800 border-2 border-slate-700 rounded-2xl outline-none focus:border-blue-500 transition text-center text-lg"
              />
              {passwordError && <p className="text-red-500 text-xs text-center"><i className="fas fa-exclamation-circle"></i> Contraseña incorrecta</p>}
              <div className="flex gap-2">
                <button onClick={() => { setSelectedUserForLogin(''); setPasswordError(false); }} className="flex-1 py-4 bg-slate-700 hover:bg-slate-600 rounded-2xl font-bold">Volver</button>
                <button onClick={handleLogin} className="flex-[2] py-4 bg-blue-600 hover:bg-blue-500 rounded-2xl font-bold">Ingresar</button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950">
        <div className="w-20 h-20 border-4 border-slate-800 border-t-blue-500 rounded-full animate-spin mb-6"></div>
        <p className="text-slate-400 text-xl font-medium animate-pulse">Cargando sistema...</p>
      </div>
    );
  }

  if (view === 'modules') {
    return (
      <div className="min-h-screen bg-slate-950">
        <div className="fixed top-6 left-6 z-50">
          <img src="https://i.ibb.co/Q7FQ80Hv/logo.png" alt="Logo" className="w-14 cursor-pointer" onClick={() => setView('login')} />
        </div>
        
        <div className="pt-24 px-8 max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-10">
            <h2 className="text-3xl font-bold">Menú Principal - {currentUser}</h2>
            <div className="flex gap-3">
              <button onClick={handleLogout} className="bg-red-500/10 text-red-500 border border-red-500/20 px-6 py-2 rounded-xl hover:bg-red-500 hover:text-white transition font-bold">Cerrar Sesión</button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {currentRole === 'admin' && (
              <div onClick={() => { setView('erp'); setCurrentSection('dashboard'); }} className="bg-slate-900 border border-slate-800 p-8 rounded-3xl cursor-pointer hover:-translate-y-2 hover:shadow-2xl transition flex flex-col items-center text-center group">
                <div className="w-20 h-20 bg-blue-500/10 text-blue-500 flex items-center justify-center rounded-2xl text-4xl mb-4 group-hover:bg-blue-600 group-hover:text-white transition">
                  <i className="fas fa-tachometer-alt"></i>
                </div>
                <h3 className="text-xl font-bold mb-2">Dashboard</h3>
                <span className="text-slate-500 text-sm">Vista general del sistema</span>
              </div>
            )}
            <div onClick={() => { setView('erp'); setCurrentSection('inventory'); }} className="bg-slate-900 border border-slate-800 p-8 rounded-3xl cursor-pointer hover:-translate-y-2 hover:shadow-2xl transition flex flex-col items-center text-center group">
              <div className="w-20 h-20 bg-emerald-500/10 text-emerald-500 flex items-center justify-center rounded-2xl text-4xl mb-4 group-hover:bg-emerald-600 group-hover:text-white transition">
                <i className="fas fa-warehouse"></i>
              </div>
              <h3 className="text-xl font-bold mb-2">Bodega</h3>
              <span className="text-slate-500 text-sm">Gestión de inventario</span>
            </div>
            <div onClick={() => { setView('erp'); setCurrentSection('sales'); }} className="bg-slate-900 border border-slate-800 p-8 rounded-3xl cursor-pointer hover:-translate-y-2 hover:shadow-2xl transition flex flex-col items-center text-center group">
              <div className="w-20 h-20 bg-amber-500/10 text-amber-500 flex items-center justify-center rounded-2xl text-4xl mb-4 group-hover:bg-amber-600 group-hover:text-white transition">
                <i className="fas fa-shopping-cart"></i>
              </div>
              <h3 className="text-xl font-bold mb-2">Ventas</h3>
              <span className="text-slate-500 text-sm">Punto de venta POS</span>
            </div>
            <div onClick={() => { setView('erp'); setCurrentSection('cash-register'); }} className="bg-slate-900 border border-slate-800 p-8 rounded-3xl cursor-pointer hover:-translate-y-2 hover:shadow-2xl transition flex flex-col items-center text-center group">
              <div className="w-20 h-20 bg-purple-500/10 text-purple-500 flex items-center justify-center rounded-2xl text-4xl mb-4 group-hover:bg-purple-600 group-hover:text-white transition">
                <i className="fas fa-cash-register"></i>
              </div>
              <h3 className="text-xl font-bold mb-2">Arqueo</h3>
              <span className="text-slate-500 text-sm">Control de caja y cierres</span>
            </div>
            {currentRole === 'admin' && (
              <>
                <div onClick={() => { setView('erp'); setCurrentSection('suppliers'); }} className="bg-slate-900 border border-slate-800 p-8 rounded-3xl cursor-pointer hover:-translate-y-2 hover:shadow-2xl transition flex flex-col items-center text-center group">
                  <div className="w-20 h-20 bg-rose-500/10 text-rose-500 flex items-center justify-center rounded-2xl text-4xl mb-4 group-hover:bg-rose-600 group-hover:text-white transition">
                    <i className="fas fa-truck"></i>
                  </div>
                  <h3 className="text-xl font-bold mb-2">Proveedores</h3>
                  <span className="text-slate-500 text-sm">Gestión de contactos</span>
                </div>
                <div onClick={() => { setView('erp'); setCurrentSection('reports'); }} className="bg-slate-900 border border-slate-800 p-8 rounded-3xl cursor-pointer hover:-translate-y-2 hover:shadow-2xl transition flex flex-col items-center text-center group">
                  <div className="w-20 h-20 bg-indigo-500/10 text-indigo-500 flex items-center justify-center rounded-2xl text-4xl mb-4 group-hover:bg-indigo-600 group-hover:text-white transition">
                    <i className="fas fa-chart-bar"></i>
                  </div>
                  <h3 className="text-xl font-bold mb-2">Reportes</h3>
                  <span className="text-slate-500 text-sm">Análisis detallado</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- ERP System View ---
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Fixed Logo */}
      <div className="fixed top-4 left-4 z-[1001]">
        <img src="https://i.ibb.co/Q7FQ80Hv/logo.png" alt="Logo" className="w-12 filter drop-shadow-[0_0_8px_rgba(59,130,246,0.6)] cursor-pointer" onClick={() => setView('modules')} />
      </div>

      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50 px-4 md:px-8 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="text-blue-500 text-4xl"><i className="fas fa-chart-line"></i></div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-blue-700 bg-clip-text text-transparent">ServiX ERP</h1>
              <p className="text-xs text-slate-500 uppercase tracking-tighter">Sistema Integral - {currentUser}</p>
            </div>
          </div>
          
          <nav className="flex flex-wrap justify-center gap-2">
            {currentRole === 'admin' && (
              <button onClick={() => setCurrentSection('dashboard')} className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition ${currentSection === 'dashboard' ? 'bg-blue-600' : 'bg-slate-800 hover:bg-slate-700 border border-slate-700'}`}>
                <i className="fas fa-tachometer-alt"></i> Dashboard
              </button>
            )}
            <button onClick={() => setCurrentSection('inventory')} className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition ${currentSection === 'inventory' ? 'bg-blue-600' : 'bg-slate-800 hover:bg-slate-700 border border-slate-700'}`}>
              <i className="fas fa-warehouse"></i> Bodega
            </button>
            <button onClick={() => setCurrentSection('sales')} className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition ${currentSection === 'sales' ? 'bg-blue-600' : 'bg-slate-800 hover:bg-slate-700 border border-slate-700'}`}>
              <i className="fas fa-shopping-cart"></i> Ventas
            </button>
            <button onClick={() => setCurrentSection('cash-register')} className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition ${currentSection === 'cash-register' ? 'bg-blue-600' : 'bg-slate-800 hover:bg-slate-700 border border-slate-700'}`}>
              <i className="fas fa-cash-register"></i> Arqueo
            </button>
            {currentRole === 'admin' && (
              <>
                <button onClick={() => setCurrentSection('suppliers')} className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition ${currentSection === 'suppliers' ? 'bg-blue-600' : 'bg-slate-800 hover:bg-slate-700 border border-slate-700'}`}>
                  <i className="fas fa-truck"></i> Proveedores
                </button>
                <button onClick={() => setCurrentSection('reports')} className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition ${currentSection === 'reports' ? 'bg-blue-600' : 'bg-slate-800 hover:bg-slate-700 border border-slate-700'}`}>
                  <i className="fas fa-chart-bar"></i> Reportes
                </button>
              </>
            )}
            <button onClick={() => setView('modules')} className="px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition bg-slate-800 hover:bg-slate-700 border border-slate-700">
              <i className="fas fa-home"></i> Inicio
            </button>
          </nav>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
        {/* Alerts Container */}
        <div className="fixed bottom-4 right-4 z-[1002] w-full max-w-xs space-y-2">
          {alerts.map(a => <Alert key={a.id} message={a.message} type={a.type} onRemove={() => removeAlert(a.id)} />)}
        </div>

        {/* --- Sections --- */}

        {currentSection === 'dashboard' && currentRole === 'admin' && (
          <div className="space-y-8 animate-fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard icon="fa-boxes" title="Productos en Bodega" value={dashboardStats.totalProd.toString()} />
              <StatCard icon="fa-money-bill-wave" title="Valor Inventario" value={formatCurrency(dashboardStats.invValue)} />
              <StatCard icon="fa-cash-register" title="Caja Total" value={formatCurrency(dashboardStats.totalBalance)} />
              <StatCard icon="fa-exchange-alt" title="Ventas Hoy" value={formatCurrency(dashboardStats.todaySales)} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2"><i className="fas fa-chart-line text-blue-500"></i> Ventas Mensuales</h3>
                <div className="h-80">
                  <Line 
                    data={{
                      labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
                      datasets: [{
                        label: 'Ventas (CLP)',
                        data: Array.from({length: 12}, (_, i) => {
                          const year = new Date().getFullYear();
                          return appData.sales.filter(s => {
                            const d = new Date(s.date);
                            return d.getMonth() === i && d.getFullYear() === year;
                          }).reduce((sum, s) => sum + s.total, 0);
                        }),
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59,130,246,0.1)',
                        tension: 0.4,
                        fill: true
                      }]
                    }}
                    options={{ responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } } } }}
                  />
                </div>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2"><i className="fas fa-chart-bar text-amber-500"></i> Ventas por Cajero</h3>
                <div className="h-80">
                  <Bar 
                    data={{
                      labels: Object.keys(appData.cashRegisters),
                      datasets: [{
                        label: 'Total Ventas',
                        data: Object.keys(appData.cashRegisters).map(user => {
                          return appData.sales.filter(s => s.cashier === user).reduce((sum, s) => sum + s.total, 0);
                        }),
                        backgroundColor: ['#3b82f6', '#0ea5e9', '#6366f1'],
                      }]
                    }}
                    options={{ responsive: true, maintainAspectRatio: false }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {currentSection === 'inventory' && (
          <div className="space-y-8 animate-fade-in">
            {currentRole === 'admin' && (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-xl overflow-hidden">
                <div className="bg-slate-800/50 px-6 py-4 border-b border-slate-700">
                  <h2 className="text-xl font-bold flex items-center gap-2"><i className="fas fa-warehouse text-blue-500"></i> Nuevo Producto</h2>
                </div>
                <div className="p-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-400">Nombre del Producto</label>
                      <input type="text" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl p-3 focus:border-blue-500 outline-none transition" placeholder="Ej: Arroz 1kg" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-400">Código de Barras</label>
                      <input type="text" value={newProduct.barcode} onChange={e => setNewProduct({...newProduct, barcode: e.target.value})} className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl p-3 focus:border-blue-500 outline-none transition" placeholder="Escanea o ingresa" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-400">Categoría</label>
                      <select value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value})} className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl p-3 focus:border-blue-500 outline-none transition">
                        <option value="">Selecciona</option>
                        {appData.categories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-400">Cantidad Inicial</label>
                      <input type="number" value={newProduct.quantity} onChange={e => setNewProduct({...newProduct, quantity: parseInt(e.target.value)})} className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl p-3 focus:border-blue-500 outline-none transition" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-400">P. Neto Última Compra (CLP)</label>
                      <input type="number" value={newProduct.lastPurchase} onChange={e => setNewProduct({...newProduct, lastPurchase: parseInt(e.target.value)})} className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl p-3 focus:border-blue-500 outline-none transition" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-400">P. Venta con IVA (CLP)</label>
                      <input 
                        type="number" 
                        value={newProduct.saleIva} 
                        onChange={e => {
                          const val = parseInt(e.target.value);
                          setNewProduct({...newProduct, saleIva: val, saleNet: Math.round(val / 1.19)});
                        }} 
                        className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl p-3 focus:border-blue-500 outline-none transition" 
                      />
                    </div>
                  </div>

                  {calculateProfit && (
                    <div className="bg-blue-600/5 border border-blue-500/20 rounded-2xl p-6 grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
                      <div className="text-center">
                        <div className="text-xs text-slate-400 mb-1">GANANCIA</div>
                        <div className={`text-2xl font-bold ${calculateProfit.profit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {formatCurrency(calculateProfit.profit)}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-slate-400 mb-1">RENTABILIDAD</div>
                        <div className="text-2xl font-bold text-blue-500">{calculateProfit.rentability.toFixed(1)}%</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-slate-400 mb-1">UTILIDAD</div>
                        <div className="text-2xl font-bold text-amber-500">{calculateProfit.utility.toFixed(1)}%</div>
                      </div>
                    </div>
                  )}

                  <button onClick={handleAddProduct} className="bg-blue-600 hover:bg-blue-500 px-8 py-3 rounded-xl font-bold transition flex items-center gap-2">
                    <i className="fas fa-plus"></i> Guardar Producto
                  </button>
                </div>
              </div>
            )}

            <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-xl overflow-hidden">
              <div className="bg-slate-800/50 px-6 py-4 border-b border-slate-700 flex justify-between items-center">
                <h2 className="text-xl font-bold flex items-center gap-2"><i className="fas fa-list-ul text-blue-500"></i> Inventario Actual</h2>
                <div className="relative">
                  <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"></i>
                  <input 
                    type="text" 
                    placeholder="Buscar producto..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="bg-slate-800 border-2 border-slate-700 rounded-xl pl-12 pr-4 py-2 text-sm focus:border-blue-500 outline-none transition w-64"
                  />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-800/30 text-slate-400 text-xs uppercase tracking-widest border-b border-slate-800">
                      <th className="px-6 py-4">Código</th>
                      <th className="px-6 py-4">Producto</th>
                      <th className="px-6 py-4">Categoría</th>
                      <th className="px-6 py-4">Cant.</th>
                      <th className="px-6 py-4">Precio (IVA)</th>
                      {currentRole === 'admin' && (
                        <>
                          <th className="px-6 py-4">Costo Neto</th>
                          <th className="px-6 py-4">Venta Neto</th>
                        </>
                      )}
                      <th className="px-6 py-4 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {appData.inventory
                      .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.barcode.includes(searchTerm))
                      .map(p => (
                        <tr key={p.id} className="hover:bg-slate-800/30 transition">
                          <td className="px-6 py-4 font-mono text-sm text-blue-400">{p.barcode}</td>
                          <td className="px-6 py-4 font-bold">{p.name}</td>
                          <td className="px-6 py-4 text-slate-400">{p.category}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded-md text-xs font-bold ${p.quantity < 5 ? 'bg-rose-500/10 text-rose-500' : 'bg-blue-500/10 text-blue-500'}`}>
                              {p.quantity}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-bold text-emerald-500">{formatCurrency(p.saleIva)}</td>
                          {currentRole === 'admin' && (
                            <>
                              <td className="px-6 py-4 text-slate-500">{formatCurrency(p.lastPurchase)}</td>
                              <td className="px-6 py-4 text-slate-500">{formatCurrency(p.saleNet)}</td>
                            </>
                          )}
                          <td className="px-6 py-4">
                            <div className="flex justify-center gap-2">
                              <button onClick={() => handleAddToCart(p)} className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg hover:bg-emerald-500 hover:text-white transition disabled:opacity-30 disabled:pointer-events-none" title="Vender">
                                <i className="fas fa-cart-plus"></i>
                              </button>
                              {currentRole === 'admin' && (
                                <button onClick={() => handleDeleteProduct(p.id)} className="p-2 bg-rose-500/10 text-rose-500 rounded-lg hover:bg-rose-500 hover:text-white transition">
                                  <i className="fas fa-trash"></i>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    {appData.inventory.length === 0 && (
                      <tr>
                        <td colSpan={currentRole === 'admin' ? 8 : 6} className="px-6 py-20 text-center text-slate-500">
                          <i className="fas fa-boxes text-5xl mb-4 block"></i>
                          No hay productos en inventario
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {currentSection === 'sales' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in">
            <div className="space-y-8">
              {!isCajaOpen && (
                <div className="bg-amber-600/10 border-2 border-amber-600/30 p-8 rounded-3xl text-center space-y-4 animate-pulse">
                  <i className="fas fa-lock text-5xl text-amber-500"></i>
                  <h3 className="text-2xl font-bold text-amber-500">Caja Cerrada</h3>
                  <p className="text-slate-400">No puedes realizar ventas hasta que abras tu turno de caja.</p>
                  <button onClick={() => setCurrentSection('cash-register')} className="bg-amber-600 hover:bg-amber-500 text-white px-8 py-3 rounded-xl font-bold transition">Abrir Caja Ahora</button>
                </div>
              )}

              <div className={`bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-xl space-y-6 ${!isCajaOpen && 'opacity-50 pointer-events-none'}`}>
                <h2 className="text-2xl font-bold flex items-center gap-2"><i className="fas fa-barcode text-blue-500"></i> Escáner</h2>
                <div className="relative">
                  <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"></i>
                  <input 
                    type="text" 
                    placeholder="Escanea el código de barras..." 
                    value={searchBarcode}
                    onChange={e => setSearchBarcode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const prod = appData.inventory.find(p => p.barcode === searchBarcode);
                        if (prod) {
                          handleAddToCart(prod);
                          setSearchBarcode('');
                        } else {
                          addAlert('Producto no encontrado', 'error');
                        }
                      }
                    }}
                    autoFocus
                    className="w-full bg-slate-800 border-2 border-slate-700 rounded-2xl p-4 pl-14 text-lg focus:border-blue-500 outline-none transition"
                  />
                </div>
                <div className="bg-blue-600/5 p-4 rounded-xl flex items-center gap-3 text-sm text-slate-400">
                  <i className="fas fa-info-circle text-blue-500"></i>
                  <span>Escanea o ingresa el código para agregar al carrito automáticamente.</span>
                </div>
              </div>

              <div className={`bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl ${!isCajaOpen && 'opacity-50 pointer-events-none'}`}>
                <div className="bg-slate-800/50 px-6 py-4 border-b border-slate-700 flex justify-between items-center">
                  <h2 className="text-xl font-bold">Carrito de Compras</h2>
                  <button onClick={() => setCart([])} className="text-rose-500 text-xs font-bold hover:underline">Vaciar Carrito</button>
                </div>
                <div className="p-6 max-h-[500px] overflow-y-auto space-y-4">
                  {cart.map(item => (
                    <div key={item.id} className="bg-slate-800/30 p-4 rounded-2xl flex justify-between items-center group">
                      <div className="flex-1">
                        <h4 className="font-bold">{item.name}</h4>
                        <p className="text-xs text-slate-500">Unitario: {formatCurrency(item.price)}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <button onClick={() => updateCartQuantity(item.id, -1)} className="w-8 h-8 flex items-center justify-center bg-slate-700 hover:bg-slate-600 rounded-lg"><i className="fas fa-minus text-xs"></i></button>
                          <span className="font-bold w-6 text-center">{item.quantity}</span>
                          <button onClick={() => updateCartQuantity(item.id, 1)} className="w-8 h-8 flex items-center justify-center bg-slate-700 hover:bg-slate-600 rounded-lg"><i className="fas fa-plus text-xs"></i></button>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-emerald-500">{formatCurrency(item.price * item.quantity)}</div>
                        <button onClick={() => setCart(cart.filter(i => i.id !== item.id))} className="text-rose-500 text-xs opacity-0 group-hover:opacity-100 transition"><i className="fas fa-trash"></i> Eliminar</button>
                      </div>
                    </div>
                  ))}
                  {cart.length === 0 && (
                    <div className="text-center py-20 text-slate-600">
                      <i className="fas fa-shopping-basket text-5xl mb-4 block"></i>
                      Carrito vacío
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className={`space-y-8 ${!isCajaOpen && 'opacity-50 pointer-events-none'}`}>
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-xl space-y-8">
                <div>
                  <h3 className="text-lg font-bold mb-4">Método de Pago</h3>
                  <div className="grid grid-cols-3 gap-4">
                    {PAYMENT_METHODS.map(pm => (
                      <button 
                        key={pm.id} 
                        onClick={() => {
                          setSelectedPaymentMethod(pm.id);
                          setSelectedBillAmount(0);
                          setCustomAmount(null);
                        }}
                        className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition ${selectedPaymentMethod === pm.id ? 'bg-blue-600/10 border-blue-500 text-blue-500' : 'bg-slate-800 border-slate-700 hover:border-slate-600'}`}
                      >
                        <i className={`fas ${pm.icon} text-2xl`}></i>
                        <span className="text-xs font-bold uppercase">{pm.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {selectedPaymentMethod === 'efectivo' && (
                  <div className="animate-slide-down space-y-6">
                    <h3 className="text-lg font-bold">¿Con cuánto paga el cliente?</h3>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                      {BILL_OPTIONS.map(bill => (
                        <button 
                          key={bill} 
                          onClick={() => { setSelectedBillAmount(bill); setCustomAmount(null); }}
                          className={`py-3 rounded-xl border-2 font-bold transition ${selectedBillAmount === bill ? 'bg-emerald-600/10 border-emerald-500 text-emerald-500' : 'bg-slate-800 border-slate-700'}`}
                        >
                          {formatCurrency(bill)}
                        </button>
                      ))}
                      <button 
                        onClick={() => {
                          const val = prompt('Monto personalizado:');
                          if (val) setCustomAmount(parseInt(val));
                        }}
                        className={`py-3 rounded-xl border-2 font-bold transition ${customAmount ? 'bg-emerald-600/10 border-emerald-500 text-emerald-500' : 'bg-slate-800 border-slate-700'}`}
                      >
                        Otro
                      </button>
                    </div>

                    {(selectedBillAmount || customAmount) ? (
                      <div className="bg-slate-800 rounded-2xl p-6 space-y-3">
                        <div className="flex justify-between text-slate-400">
                          <span>Total Venta:</span>
                          <span>{formatCurrency(cartTotal)}</span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>Pago Cliente:</span>
                          <span>{formatCurrency(selectedBillAmount || customAmount || 0)}</span>
                        </div>
                        <div className="flex justify-between text-2xl font-bold pt-3 border-t border-slate-700">
                          <span>Vuelto:</span>
                          <span className="text-emerald-500">{formatCurrency(changeDue)}</span>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}

                <div className="space-y-4 pt-8 border-t border-slate-800">
                  <div className="flex justify-between items-center text-4xl font-bold">
                    <span>TOTAL:</span>
                    <span className="text-blue-500">{formatCurrency(cartTotal)}</span>
                  </div>
                  <button 
                    disabled={cart.length === 0 || !selectedPaymentMethod}
                    onClick={processPayment}
                    className="w-full py-6 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 disabled:border-slate-700 border border-transparent rounded-2xl text-2xl font-bold transition shadow-2xl shadow-blue-900/40"
                  >
                    Procesar Venta
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentSection === 'cash-register' && (
          <div className="space-y-8 animate-fade-in">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-xl flex flex-col sm:flex-row justify-between items-center gap-6">
                  <div className="flex items-center gap-6">
                    <div className={`w-20 h-20 rounded-2xl flex items-center justify-center text-4xl ${isCajaOpen ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                      <i className={`fas ${isCajaOpen ? 'fa-lock-open' : 'fa-lock'}`}></i>
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">{isCajaOpen ? 'Caja Abierta' : 'Caja Cerrada'}</h2>
                      <p className="text-slate-500">Turno actual de: {currentUser}</p>
                    </div>
                  </div>
                  <div className="text-center sm:text-right">
                    <div className="text-sm text-slate-400 uppercase tracking-widest mb-1">Balance Actual</div>
                    <div className="text-4xl font-bold text-blue-500">{formatCurrency(userRegister?.balance || 0)}</div>
                  </div>
                  <div className="flex gap-2">
                    {!isCajaOpen ? (
                      <button onClick={() => setIsOpeningModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-500 px-8 py-3 rounded-xl font-bold transition shadow-lg shadow-emerald-900/20">Abrir Turno</button>
                    ) : (
                      <button onClick={() => {
                        if (confirm('¿Deseas cerrar el turno de caja?')) {
                          setAppData(prev => {
                            const reg = { ...prev.cashRegisters[currentUser] };
                            reg.isOpen = false;
                            reg.history = [...reg.history, {
                              type: 'cierre',
                              amount: reg.balance,
                              date: new Date().toISOString(),
                              description: 'Cierre de caja'
                            }];
                            return { ...prev, cashRegisters: { ...prev.cashRegisters, [currentUser]: reg } };
                          });
                          addAlert('Caja cerrada exitosamente', 'success');
                        }
                      }} className="bg-rose-600 hover:bg-rose-500 px-8 py-3 rounded-xl font-bold transition shadow-lg shadow-rose-900/20">Cerrar Turno</button>
                    )}
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-xl overflow-hidden">
                  <div className="bg-slate-800/50 px-6 py-4 border-b border-slate-700">
                    <h3 className="text-xl font-bold">Historial del Turno</h3>
                  </div>
                  <div className="divide-y divide-slate-800">
                    {userRegister?.history.slice().reverse().map((entry, idx) => (
                      <div key={idx} className="p-6 flex justify-between items-center hover:bg-slate-800/30 transition">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            entry.type === 'apertura' ? 'bg-emerald-500/10 text-emerald-500' :
                            entry.type === 'cierre' ? 'bg-rose-500/10 text-rose-500' : 'bg-blue-500/10 text-blue-500'
                          }`}>
                            <i className={`fas ${
                              entry.type === 'apertura' ? 'fa-lock-open' :
                              entry.type === 'cierre' ? 'fa-lock' : 'fa-shopping-cart'
                            }`}></i>
                          </div>
                          <div>
                            <p className="font-bold">{entry.description}</p>
                            <p className="text-xs text-slate-500">{new Date(entry.date).toLocaleString('es-CL')}</p>
                          </div>
                        </div>
                        <div className={`text-lg font-bold ${entry.type === 'cierre' ? 'text-rose-500' : 'text-slate-200'}`}>
                          {formatCurrency(entry.amount)}
                        </div>
                      </div>
                    ))}
                    {(!userRegister || userRegister.history.length === 0) && (
                      <div className="p-20 text-center text-slate-600">No hay actividad registrada</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-xl">
                <h3 className="text-xl font-bold mb-6">Instrucciones de Arqueo</h3>
                <div className="space-y-6 text-sm text-slate-400 leading-relaxed">
                  <div className="flex gap-4">
                    <div className="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center shrink-0 text-blue-500 font-bold">1</div>
                    <p>Al iniciar, ingresa el efectivo disponible para dar vueltos.</p>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center shrink-0 text-blue-500 font-bold">2</div>
                    <p>Todas las ventas en efectivo aumentan automáticamente el balance de caja.</p>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center shrink-0 text-blue-500 font-bold">3</div>
                    <p>Al finalizar el turno, el sistema registrará el monto final para auditoría.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentSection === 'reports' && currentRole === 'admin' && (
          <div className="space-y-8 animate-fade-in">
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard icon="fa-shopping-cart" title="Total Ventas Histórico" value={formatCurrency(appData.sales.reduce((s,v) => s+v.total, 0))} />
              <StatCard icon="fa-receipt" title="Transacciones" value={appData.sales.length.toString()} />
              <StatCard icon="fa-chart-pie" title="Ticket Promedio" value={formatCurrency(appData.sales.length > 0 ? Math.round(appData.sales.reduce((s,v) => s+v.total, 0) / appData.sales.length) : 0)} />
              <StatCard icon="fa-user-clock" title="Ventas del Mes" value={formatCurrency(appData.sales.filter(s => new Date(s.date).getMonth() === new Date().getMonth()).reduce((s,v) => s+v.total, 0))} />
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-xl">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-xl font-bold">Reporte de Métodos de Pago</h3>
                <div className="flex gap-2">
                   <button onClick={() => {
                     const ws = XLSX.utils.json_to_sheet(appData.sales);
                     const wb = XLSX.utils.book_new();
                     XLSX.utils.book_append_sheet(wb, ws, "Ventas");
                     XLSX.writeFile(wb, "Reporte_Ventas.xlsx");
                   }} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition">
                     <i className="fas fa-file-excel"></i> Exportar Excel
                   </button>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                <div className="lg:col-span-1 flex flex-col justify-center">
                  <Doughnut 
                    data={{
                      labels: ['Efectivo', 'Tarjeta', 'Transferencia'],
                      datasets: [{
                        data: ['efectivo', 'tarjeta', 'transferencia'].map(m => 
                          appData.sales.filter(s => s.paymentMethod === m).reduce((sum, s) => sum + s.total, 0)
                        ),
                        backgroundColor: ['#10b981', '#3b82f6', '#8b5cf6'],
                        borderWidth: 0
                      }]
                    }}
                    options={{ plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8' } } } }}
                  />
                </div>
                <div className="lg:col-span-2">
                   <div className="bg-slate-800/30 rounded-2xl overflow-hidden border border-slate-800">
                     <table className="w-full text-left text-sm">
                       <thead>
                         <tr className="bg-slate-800 text-slate-400 uppercase tracking-widest text-[10px] font-bold">
                           <th className="px-6 py-4">Cajero</th>
                           <th className="px-6 py-4 text-center">Operaciones</th>
                           <th className="px-6 py-4 text-right">Total Vendido</th>
                         </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-800">
                         {Object.keys(appData.cashRegisters).map(user => {
                           const userSales = appData.sales.filter(s => s.cashier === user);
                           const total = userSales.reduce((s,v) => s+v.total, 0);
                           return (
                             <tr key={user} className="hover:bg-slate-800/50 transition">
                               <td className="px-6 py-4 font-bold">{user}</td>
                               <td className="px-6 py-4 text-center">{userSales.length}</td>
                               <td className="px-6 py-4 text-right font-bold text-blue-400">{formatCurrency(total)}</td>
                             </tr>
                           )
                         })}
                       </tbody>
                     </table>
                   </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* --- Modals --- */}

      <Modal isOpen={isOpeningModalOpen} onClose={() => setIsOpeningModalOpen(false)} title="Abrir Caja">
        <div className="space-y-6">
          <p className="text-slate-400">Ingresa el monto inicial con el que comenzarás el turno de caja hoy.</p>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-400">Monto Inicial (CLP)</label>
            <input 
              type="number" 
              value={openingAmountInput} 
              onChange={e => setOpeningAmountInput(parseInt(e.target.value))} 
              className="w-full bg-slate-800 border-2 border-slate-700 rounded-xl p-4 text-2xl font-bold outline-none focus:border-blue-500" 
            />
          </div>
          <button onClick={confirmOpening} className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold transition">Confirmar Apertura</button>
        </div>
      </Modal>

      <Modal isOpen={!!activeTicket} onClose={() => setActiveTicket(null)} title="Venta Exitosa" width="max-w-sm">
        {activeTicket && (
          <div className="space-y-6 font-mono text-sm">
             <div className="text-center pb-4 border-b border-slate-700">
               <h2 className="text-xl font-bold text-blue-500 mb-1">SERViX ERP</h2>
               <p className="text-slate-500 text-[10px]">MINIMARKET SERVIEXPRESS</p>
               <p className="text-slate-500 text-[10px]">RUT: 76.124.035-8</p>
             </div>
             
             <div className="space-y-1 py-4 border-b border-slate-700">
               <div className="flex justify-between"><span>TICKET:</span><span>#{activeTicket.ticketNumber}</span></div>
               <div className="flex justify-between"><span>FECHA:</span><span>{new Date(activeTicket.date).toLocaleString()}</span></div>
               <div className="flex justify-between"><span>CAJERO:</span><span>{activeTicket.cashier}</span></div>
               <div className="flex justify-between"><span>METODO:</span><span>{activeTicket.paymentMethod.toUpperCase()}</span></div>
             </div>

             <div className="space-y-2 py-4">
               {activeTicket.items.map((it, idx) => (
                 <div key={idx} className="flex justify-between">
                   <div className="flex-1 pr-2">
                     <div className="truncate">{it.name}</div>
                     <div className="text-[10px] text-slate-500">{it.quantity} x {formatCurrency(it.price)}</div>
                   </div>
                   <div className="font-bold">{formatCurrency(it.price * it.quantity)}</div>
                 </div>
               ))}
             </div>

             <div className="pt-4 border-t-2 border-slate-700 space-y-2">
                <div className="flex justify-between text-lg font-bold"><span>TOTAL:</span><span>{formatCurrency(activeTicket.total)}</span></div>
                <div className="flex justify-between text-slate-400"><span>PAGÓ CON:</span><span>{formatCurrency(activeTicket.paidAmount)}</span></div>
                <div className="flex justify-between text-emerald-500 font-bold"><span>VUELTO:</span><span>{formatCurrency(activeTicket.change)}</span></div>
             </div>

             <div className="text-center pt-6 text-[10px] text-slate-500">
                <p>¡GRACIAS POR SU COMPRA!</p>
                <p>DOCUMENTO INTERNO SIN VALIDEZ TRIBUTARIA</p>
             </div>

             <button onClick={() => { window.print(); }} className="w-full py-3 bg-blue-600 rounded-xl font-bold mt-4"><i className="fas fa-print"></i> Imprimir Ticket</button>
          </div>
        )}
      </Modal>

      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        .animate-fade-in { animation: fade-in 0.5s ease-out; }
        @keyframes slide-down { from { transform: translateY(-10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .animate-slide-down { animation: slide-down 0.3s ease-out; }
        @media print {
          body * { visibility: hidden; }
          .modal-content, .modal-content * { visibility: visible; }
          .modal-content { position: absolute; left: 0; top: 0; }
        }
      `}</style>
    </div>
  );
}
