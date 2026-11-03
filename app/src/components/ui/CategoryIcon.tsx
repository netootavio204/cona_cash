import React from 'react';
import {
  Fuel,
  Utensils,
  Settings,
  Wrench,
  Droplets,
  Receipt,
  Car,
  ShoppingBag,
  Smartphone,
  Heart,
  Home,
  Tag,
} from 'lucide-react';
import type { CategoryIconName } from '../../types/database';

export const CATEGORY_ICONS_LIST: { id: CategoryIconName; label: string }[] = [
  { id: 'fuel', label: 'Combustível' },
  { id: 'utensils', label: 'Alimentação' },
  { id: 'cog', label: 'Peças' },
  { id: 'wrench', label: 'Manutenção' },
  { id: 'droplets', label: 'Lavagem' },
  { id: 'receipt', label: 'Recibo / Avulso' },
  { id: 'car', label: 'Carro' },
  { id: 'shopping-bag', label: 'Compras' },
  { id: 'smartphone', label: 'Celular / App' },
  { id: 'heart', label: 'Saúde' },
  { id: 'home', label: 'Casa' },
  { id: 'tag', label: 'Geral' },
];

export const CategoryIcon: React.FC<{
  name: CategoryIconName | string;
  className?: string;
}> = ({ name, className = 'w-4 h-4' }) => {
  switch (name) {
    case 'fuel':
      return <Fuel className={className} />;
    case 'utensils':
      return <Utensils className={className} />;
    case 'cog':
      return <Settings className={className} />;
    case 'wrench':
      return <Wrench className={className} />;
    case 'droplets':
      return <Droplets className={className} />;
    case 'receipt':
      return <Receipt className={className} />;
    case 'car':
      return <Car className={className} />;
    case 'shopping-bag':
      return <ShoppingBag className={className} />;
    case 'smartphone':
      return <Smartphone className={className} />;
    case 'heart':
      return <Heart className={className} />;
    case 'home':
      return <Home className={className} />;
    default:
      return <Tag className={className} />;
  }
};

