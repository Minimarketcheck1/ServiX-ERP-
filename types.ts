
export interface Product {
  id: number;
  name: string;
  barcode: string;
  category: string;
  supplierId: number | null;
  quantity: number;
  lastPurchase: number;
  saleNet: number;
  saleIva: number;
  price: number;
  dateAdded: string;
}

export interface Supplier {
  id: number;
  name: string;
  contact: string;
  phone: string;
  email: string;
  dateAdded: string;
}

export interface SaleItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
  barcode: string;
}

export interface Sale {
  id: number;
  ticketNumber: number;
  date: string;
  items: SaleItem[];
  total: number;
  paymentMethod: string;
  cashier: string;
  paidAmount: number;
  change: number;
}

export interface CashRegisterHistoryEntry {
  type: 'apertura' | 'cierre' | 'venta';
  amount: number;
  date: string;
  description: string;
  ticketNumber?: number;
}

export interface Cierre {
  id: number;
  fecha: string;
  efectivoEstimado: number;
  tarjetasEstimado: number;
  transferenciaEstimado: number;
  efectivoCierre: number;
  tarjetasCierre: number;
  transferenciaCierre: number;
  diferencia: number;
  montoApertura: number;
  montoCierre: number;
  totalVentas: number;
  usuario: string;
}

export interface CashRegister {
  isOpen: boolean;
  openingAmount: number;
  sales: Sale[];
  balance: number;
  history: CashRegisterHistoryEntry[];
  cierres: Cierre[];
}

export interface AppData {
  inventory: Product[];
  suppliers: Supplier[];
  sales: Sale[];
  cashRegisters: Record<string, CashRegister>;
  categories: string[];
  ticketCounter: number;
}

export type View = 'login' | 'modules' | 'erp';
export type ERPSection = 'dashboard' | 'inventory' | 'sales' | 'cash-register' | 'suppliers' | 'reports';
