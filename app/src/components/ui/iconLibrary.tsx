import React from 'react';
import {
  // Dinheiro e bancos
  Wallet,
  Landmark,
  Banknote,
  CreditCard,
  Smartphone,
  QrCode,
  PiggyBank,
  Coins,
  Receipt,
  // Transporte
  Car,
  Fuel,
  Wrench,
  Droplets,
  CircleParking,
  Route,
  Gauge,
  // Comida e compras
  Utensils,
  Coffee,
  ShoppingCart,
  Store,
  ShoppingBag,
  Package,
  // Casa e contas
  Home,
  Lightbulb,
  Wifi,
  Phone,
  // Trabalho e 3D
  Printer,
  Boxes,
  Hammer,
  Briefcase,
  Truck,
  Settings,
  // Outros
  Gift,
  Star,
  Heart,
  Gamepad2,
  Tv,
  Music,
  Plane,
  BookOpen,
  Tag,
  CircleHelp,
} from 'lucide-react';

export interface IconDefinition {
  id: string;
  label: string;
  group: 'dinheiro' | 'transporte' | 'comida' | 'casa' | 'trabalho' | 'outros';
  keywords: string[];
  icon: React.ComponentType<{ className?: string }>;
}

export const ICON_GROUPS: { id: IconDefinition['group']; label: string }[] = [
  { id: 'dinheiro', label: 'Dinheiro e bancos' },
  { id: 'transporte', label: 'Transporte e veículos' },
  { id: 'comida', label: 'Comida e compras' },
  { id: 'casa', label: 'Casa e contas' },
  { id: 'trabalho', label: 'Trabalho e 3D' },
  { id: 'outros', label: 'Outros' },
];

export const ICON_LIBRARY: IconDefinition[] = [
  // Dinheiro e bancos
  { id: 'wallet', label: 'Carteira / Bolso', group: 'dinheiro', keywords: ['bolso', 'carteira', 'saldo', 'dinheiro'], icon: Wallet },
  { id: 'landmark', label: 'Banco / Agência', group: 'dinheiro', keywords: ['banco', 'nubank', 'itau', 'bradesco', 'inter', 'santander', 'caixa'], icon: Landmark },
  { id: 'banknote', label: 'Cédula / Espécie', group: 'dinheiro', keywords: ['dinheiro', 'especie', 'papel', 'troco', 'cedula'], icon: Banknote },
  { id: 'credit-card', label: 'Cartão / Maquininha', group: 'dinheiro', keywords: ['cartao', 'maquininha', 'credito', 'debito', 'stone', 'cielo', 'pagseguro', 'sumup'], icon: CreditCard },
  { id: 'smartphone', label: 'Celular / App', group: 'dinheiro', keywords: ['celular', 'app', 'online', 'aplicativo', 'mercado pago', 'picpay'], icon: Smartphone },
  { id: 'qr-code', label: 'QR Code / Pix', group: 'dinheiro', keywords: ['pix', 'qr', 'transferencia instantanea'], icon: QrCode },
  { id: 'piggy-bank', label: 'Cofrinho / Reserva', group: 'dinheiro', keywords: ['cofrinho', 'reserva', 'poupanca', 'guardar'], icon: PiggyBank },
  { id: 'coins', label: 'Moedas / Rendimento', group: 'dinheiro', keywords: ['moedas', 'rendimento', 'juros', 'renda'], icon: Coins },
  { id: 'receipt', label: 'Recibo / Taxa', group: 'dinheiro', keywords: ['recibo', 'taxa', 'comprovante', 'tarifa', 'imposto'], icon: Receipt },

  // Transporte
  { id: 'car', label: 'Carro / Corrida', group: 'transporte', keywords: ['carro', 'corrida', '99', 'uber', 'veiculo', 'motorista', 'passageiro'], icon: Car },
  { id: 'fuel', label: 'Combustível / Posto', group: 'transporte', keywords: ['combustivel', 'gasolina', 'etanol', 'alcool', 'gnv', 'diesel', 'posto'], icon: Fuel },
  { id: 'wrench', label: 'Manutenção / Mecânica', group: 'transporte', keywords: ['manutencao', 'oficina', 'mecanico', 'conserto', 'reparo', 'troca de oleo', 'ferramenta'], icon: Wrench },
  { id: 'droplets', label: 'Lavagem / Lava-jato', group: 'transporte', keywords: ['lavagem', 'lava-jato', 'limpeza', 'estetica', 'agua', 'ducha'], icon: Droplets },
  { id: 'parking', label: 'Estacionamento', group: 'transporte', keywords: ['estacionamento', 'vaga', 'estacionar', 'garagem'], icon: CircleParking },
  { id: 'route', label: 'Rota / Viagem', group: 'transporte', keywords: ['rota', 'viagem', 'pedagio', 'km', 'estrada'], icon: Route },
  { id: 'gauge', label: 'Painel / Velocidade', group: 'transporte', keywords: ['painel', 'velocimetro', 'km rodado'], icon: Gauge },

  // Comida e compras
  { id: 'utensils', label: 'Alimentação / Refeição', group: 'comida', keywords: ['almoco', 'jantar', 'comida', 'restaurante', 'refeicao', 'marmita', 'lanche'], icon: Utensils },
  { id: 'coffee', label: 'Café / Bebida', group: 'comida', keywords: ['cafe', 'cafeteria', 'agua', 'refrigerante', 'bebida', 'bar', 'padaria'], icon: Coffee },
  { id: 'shopping-cart', label: 'Supermercado / Mercado', group: 'comida', keywords: ['mercado', 'supermercado', 'compras', 'atacadista', 'feira'], icon: ShoppingCart },
  { id: 'store', label: 'Loja / Estabelecimento', group: 'comida', keywords: ['loja', 'comercio', 'estabelecimento', 'balcao', 'venda presencial'], icon: Store },
  { id: 'shopping-bag', label: 'Sacola / Vendas', group: 'comida', keywords: ['sacola', 'venda', 'loja virtual', 'mercado livre', 'shopee'], icon: ShoppingBag },
  { id: 'package', label: 'Pacote / Entrega', group: 'comida', keywords: ['pacote', 'embalagem', 'correios', 'envio', 'entrega', 'caixa'], icon: Package },

  // Casa e contas
  { id: 'home', label: 'Casa / Aluguel', group: 'casa', keywords: ['casa', 'moradia', 'aluguel', 'condominio', 'imovel'], icon: Home },
  { id: 'lightbulb', label: 'Luz / Energia', group: 'casa', keywords: ['luz', 'energia', 'eletricidade', 'conta de luz', 'enel', 'cemig', 'copel'], icon: Lightbulb },
  { id: 'wifi', label: 'Internet / Wi-Fi', group: 'casa', keywords: ['internet', 'wifi', 'fibra', 'provedor', 'banda larga'], icon: Wifi },
  { id: 'phone', label: 'Telefone / Celular', group: 'casa', keywords: ['telefone', 'recarga', 'plano', 'tim', 'claro', 'vivo'], icon: Phone },

  // Trabalho e 3D
  { id: 'printer', label: 'Impressora / 3D', group: 'trabalho', keywords: ['impressora', 'impressao 3d', 'bambu lab', 'ender', 'creality', 'resina'], icon: Printer },
  { id: 'boxes', label: 'Filamento / Insumos', group: 'trabalho', keywords: ['filamento', 'pla', 'petg', 'abs', 'insumo', 'bobina', 'rolo', 'materia prima'], icon: Boxes },
  { id: 'hammer', label: 'Ferramentas / Trabalho', group: 'trabalho', keywords: ['martelo', 'ferramenta', 'obra', 'servico'], icon: Hammer },
  { id: 'briefcase', label: 'Maleta / Profissional', group: 'trabalho', keywords: ['maleta', 'servico', 'honorario', 'freelancer', 'trabalho'], icon: Briefcase },
  { id: 'truck', label: 'Frete / Envio', group: 'trabalho', keywords: ['frete', 'transporte', 'sedex', 'jadlog', 'entrega'], icon: Truck },
  { id: 'cog', label: 'Peças / Mecânica / Config', group: 'trabalho', keywords: ['peça', 'pecas', 'engrenagem', 'bico', 'nozzle', 'cooler', 'configuracao'], icon: Settings },

  // Outros
  { id: 'gift', label: 'Presente / Doação', group: 'outros', keywords: ['presente', 'doacao', 'brinde', 'aniversario'], icon: Gift },
  { id: 'star', label: 'Favorito / Destaque', group: 'outros', keywords: ['favorito', 'destaque', 'estrela', 'bonus', 'premio'], icon: Star },
  { id: 'heart', label: 'Saúde / Bem-estar', group: 'outros', keywords: ['saude', 'remedio', 'farmacia', 'medico', 'consulta', 'academia'], icon: Heart },
  { id: 'gamepad', label: 'Lazer / Jogos', group: 'outros', keywords: ['lazer', 'jogo', 'game', 'videogame', 'cinema', 'diversao'], icon: Gamepad2 },
  { id: 'tv', label: 'Streaming / Assinatura', group: 'outros', keywords: ['streaming', 'tv', 'netflix', 'spotify', 'youtube', 'assinatura'], icon: Tv },
  { id: 'music', label: 'Música / Áudio', group: 'outros', keywords: ['musica', 'show', 'audio', 'fone'], icon: Music },
  { id: 'plane', label: 'Viagem / Férias', group: 'outros', keywords: ['viagem', 'aviao', 'ferias', 'hotel', 'passagem'], icon: Plane },
  { id: 'book-open', label: 'Educação / Livro', group: 'outros', keywords: ['curso', 'livro', 'estudo', 'escola', 'treinamento'], icon: BookOpen },
  { id: 'tag', label: 'Geral / Outros', group: 'outros', keywords: ['geral', 'outros', 'diversos', 'avulso', 'padrao'], icon: Tag },
];

/**
 * Normaliza texto para busca local sem acento e minúsculo
 */
export function normalizeSearch(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Sugere automaticamente um ícone da biblioteca com base no nome digitado
 * Ex.: "Maquininha Stone" -> "credit-card", "Pix recebido" -> "qr-code", "Gasolina aditivada" -> "fuel"
 */
export function suggestIconByName(name: string): string {
  const norm = normalizeSearch(name);
  if (!norm) return 'tag';

  // Regras de alta prioridade
  if (norm.includes('maquininha') || norm.includes('cartao') || norm.includes('credito') || norm.includes('debito')) return 'credit-card';
  if (norm.includes('pix') || norm.includes('qrcode')) return 'qr-code';
  if (norm.includes('bolso') || norm.includes('carteira') || norm.includes('dinheiro') || norm.includes('especie')) return 'banknote';
  if (norm.includes('gasolina') || norm.includes('combustivel') || norm.includes('etanol') || norm.includes('alcool') || norm.includes('diesel') || norm.includes('posto')) return 'fuel';
  if (norm.includes('filamento') || norm.includes('pla') || norm.includes('petg') || norm.includes('resina')) return 'boxes';
  if (norm.includes('impressora') || norm.includes('3d') || norm.includes('peca 3d')) return 'printer';
  if (norm.includes('99') || norm.includes('uber') || norm.includes('corrida') || norm.includes('motorista')) return 'car';
  if (norm.includes('lavagem') || norm.includes('lava jato') || norm.includes('ducha')) return 'droplets';
  if (norm.includes('cafe') || norm.includes('lanche') || norm.includes('padaria') || norm.includes('refrigerante')) return 'coffee';
  if (norm.includes('almoco') || norm.includes('refeicao') || norm.includes('restaurante') || norm.includes('jantar')) return 'utensils';
  if (norm.includes('mercado livre') || norm.includes('shopee') || norm.includes('venda')) return 'shopping-bag';
  if (norm.includes('manutencao') || norm.includes('oficina') || norm.includes('mecanico') || norm.includes('conserto')) return 'wrench';
  if (norm.includes('palheiro') || norm.includes('cigarro') || norm.includes('tabacaria')) return 'tag';
  if (norm.includes('mercado') || norm.includes('supermercado')) return 'shopping-cart';
  if (norm.includes('frete') || norm.includes('entrega') || norm.includes('correios') || norm.includes('envio')) return 'truck';
  if (norm.includes('taxa') || norm.includes('tarifa') || norm.includes('recibo') || norm.includes('imposto')) return 'receipt';
  if (norm.includes('nubank') || norm.includes('itau') || norm.includes('bradesco') || norm.includes('inter') || norm.includes('banco')) return 'landmark';

  // Varredura por palavras-chave cadastradas
  for (const def of ICON_LIBRARY) {
    if (def.keywords.some((kw) => norm.includes(kw))) {
      return def.id;
    }
  }

  return 'tag';
}

/**
 * Renderiza um ícone da biblioteca por ID ou nome legado, com fallback gracioso para não quebrar telas
 */
export const AppIcon: React.FC<{
  name: string | null | undefined;
  className?: string;
}> = ({ name, className = 'w-4 h-4' }) => {
  if (!name) return <Tag className={className} />;

  // Mapeamento de retrocompatibilidade de nomes antigos
  let resolvedId = name;
  if (name === 'settings') resolvedId = 'cog';
  if (name === 'car-front') resolvedId = 'car';

  const found = ICON_LIBRARY.find((item) => item.id === resolvedId);
  if (found) {
    const Component = found.icon;
    return <Component className={className} />;
  }

  return <CircleHelp className={className} />;
};
