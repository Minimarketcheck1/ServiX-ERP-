
import { AppData } from './types';

export const USER_PASSWORDS: Record<string, string> = {
  'Caja 1': 'caja1',
  'Caja 2': 'caja2',
  'Administrador': 'admin274'
};

export const INITIAL_APP_DATA: AppData = {
  inventory: [],
  suppliers: [],
  sales: [],
  cashRegisters: {
    'Caja 1': { isOpen: false, openingAmount: 0, sales: [], balance: 0, history: [], cierres: [] },
    'Caja 2': { isOpen: false, openingAmount: 0, sales: [], balance: 0, history: [], cierres: [] },
    'Administrador': { isOpen: false, openingAmount: 0, sales: [], balance: 0, history: [], cierres: [] }
  },
  categories: ['Alimentos', 'Bebidas', 'Limpieza', 'Aseo Personal'],
  ticketCounter: 1001
};

export const PAYMENT_METHODS = [
  { id: 'efectivo', label: 'Efectivo', icon: 'fa-money-bill-wave' },
  { id: 'tarjeta', label: 'Tarjeta', icon: 'fa-credit-card' },
  { id: 'transferencia', label: 'Transferencia', icon: 'fa-university' }
];

export const BILL_OPTIONS = [1000, 2000, 5000, 10000, 20000];
