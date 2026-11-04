import React, { useState, useEffect, useCallback } from 'react';
import {
  Landmark,
  Banknote,
  CreditCard,
  Tags,
  Sliders,
  ShieldAlert,
  Plus,
  Pencil,
  Archive,
  RotateCcw,
  Trash2,
  Lock,
  Unlock,
  CheckCircle2,
  Ban,
  Volume2,
  VolumeX,
  Calendar,
  Users,
  Briefcase,
  Sparkles,
  X,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import {
  ensureMyDefaults,
  fetchAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
  fetchPaymentMethods,
  createPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
  fetchCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  addSuggested3DCategories,
  fetchIncomeSources,
  createIncomeSource,
  updateIncomeSource,
  deleteIncomeSource,
  updateMyPreferences,
  updateMyPassword,
  fetchAllProfilesAdmin,
  updateUserStatusAdmin,
  updateSignupOpenAdmin,
} from '../../api/supabase';
import {
  DEFAULT_QUICK_TAGS,
  PALETA_CORES,
  type Account,
  type AccountType,
  type Category,
  type CategoryIconName,
  type IncomeSource,
  type PaymentMethod,
  type Profile,
  type UserStatus,
} from '../../types/database';
import {
  formatCentsToBRL,
  formatFeePercent,
  parseFeePercent,
} from '../../utils/format';
import { Card } from '../../components/ui/Card';
import { Botao } from '../../components/ui/Botao';
import { Campo } from '../../components/ui/Campo';
import { CampoMoeda } from '../../components/ui/CampoMoeda';
import { Modal } from '../../components/ui/Modal';
import { ValorMoeda } from '../../components/ui/ValorMoeda';
import {
  CategoryIcon,
  CATEGORY_ICONS_LIST,
} from '../../components/ui/CategoryIcon';
import { APP_NAME, APP_VERSION } from '../../config/version';

export type SecaoConfig =
  | 'contas'
  | 'fontes'
  | 'formas'
  | 'categorias'
  | 'preferencias'
  | 'admin';

export interface ConfigPageProps {
  onShowToast: (texto: string, tipo?: 'sucesso' | 'erro' | 'info') => void;
  onAccountsChanged?: () => void;
  secaoForcada?: SecaoConfig | null;
  aoConsumirSecaoForcada?: () => void;
}

export const ConfigPage: React.FC<ConfigPageProps> = ({
  onShowToast,
  onAccountsChanged,
  secaoForcada,
  aoConsumirSecaoForcada,
}) => {
  const { perfil, usuario, configApp, recarregarPerfilEConfig } = useAuth();
  const isAdmin = perfil?.role === 'admin' && perfil?.status === 'approved';

  const [secao, setSecao] = useState<SecaoConfig>('contas');
  const [carregandoDados, setCarregandoDados] = useState(true);

  useEffect(() => {
    if (secaoForcada) {
      if (secaoForcada === 'admin' && !isAdmin) {
        setSecao('contas');
      } else {
        setSecao(secaoForcada);
      }
      aoConsumirSecaoForcada?.();
    }
  }, [secaoForcada, isAdmin, aoConsumirSecaoForcada]);

  const [contas, setContas] = useState<Account[]>([]);
  const [fontes, setFontes] = useState<IncomeSource[]>([]);
  const [formas, setFormas] = useState<PaymentMethod[]>([]);
  const [categorias, setCategorias] = useState<Category[]>([]);
  const [mostrarArquivados, setMostrarArquivados] = useState(false);

  // Proteção caso usuário comum tente acessar #admin ou /admin diretamente na URL
  useEffect(() => {
    const checkHashOrPath = () => {
      const hash = window.location.hash.toLowerCase();
      const path = window.location.pathname.toLowerCase();
      if ((hash.includes('admin') || path.includes('/admin')) && !isAdmin) {
        setSecao('contas');
        if (window.location.hash.includes('admin')) {
          window.history.replaceState(null, '', window.location.pathname);
        }
        onShowToast('Acesso restrito ao administrador.', 'erro');
      }
    };
    checkHashOrPath();
    window.addEventListener('hashchange', checkHashOrPath);
    return () => window.removeEventListener('hashchange', checkHashOrPath);
  }, [isAdmin, onShowToast]);

  const carregarTudo = useCallback(async () => {
    setCarregandoDados(true);
    try {
      await ensureMyDefaults();
      const [accs, srcs, pms, cats] = await Promise.all([
        fetchAccounts(),
        fetchIncomeSources(),
        fetchPaymentMethods(),
        fetchCategories(),
      ]);
      setContas(accs);
      setFontes(srcs);
      setFormas(pms);
      setCategorias(cats);
    } catch (err: any) {
      onShowToast(err?.message || 'Erro ao carregar configurações.', 'erro');
    } finally {
      setCarregandoDados(false);
    }
  }, [onShowToast]);

  useEffect(() => {
    carregarTudo();
  }, [carregarTudo]);

  // ============================================================================
  // MODAL DE CONTA
  // ============================================================================
  const [modalContaAberto, setModalContaAberto] = useState(false);
  const [contaEditando, setContaEditando] = useState<Account | null>(null);
  const [contaNome, setContaNome] = useState('');
  const [contaTipo, setContaTipo] = useState<AccountType>('bank');
  const [contaSaldoInicial, setContaSaldoInicial] = useState(0);
  const [contaCor, setContaCor] = useState('#FF7A1A');
  const [salvandoConta, setSalvandoConta] = useState(false);

  const abrirNovaConta = () => {
    setContaEditando(null);
    setContaNome('');
    setContaTipo('bank');
    setContaSaldoInicial(0);
    setContaCor('#FF7A1A');
    setModalContaAberto(true);
  };

  const abrirEditarConta = (c: Account) => {
    setContaEditando(c);
    setContaNome(c.name);
    setContaTipo(c.type);
    setContaSaldoInicial(c.initial_balance_cents);
    setContaCor(c.color || '#FF7A1A');
    setModalContaAberto(true);
  };

  const salvarConta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuario) return;
    if (!contaNome.trim()) {
      onShowToast('Digite o nome da conta.', 'erro');
      return;
    }

    setSalvandoConta(true);
    try {
      if (contaEditando) {
        await updateAccount(contaEditando.id, {
          name: contaNome,
          type: contaTipo,
          initial_balance_cents: contaSaldoInicial,
          color: contaCor,
        });
        onShowToast('Conta atualizada com sucesso!', 'sucesso');
      } else {
        await createAccount({
          user_id: usuario.id,
          name: contaNome,
          type: contaTipo,
          initial_balance_cents: contaSaldoInicial,
          color: contaCor,
        });
        onShowToast('Nova conta criada!', 'sucesso');
      }
      setModalContaAberto(false);
      await carregarTudo();
      onAccountsChanged?.();
    } catch (err: any) {
      onShowToast(err?.message || 'Erro ao salvar conta.', 'erro');
    } finally {
      setSalvandoConta(false);
    }
  };

  const alternarArquivoConta = async (c: Account) => {
    try {
      await updateAccount(c.id, { archived: !c.archived });
      onShowToast(
        c.archived ? `Conta "${c.name}" restaurada.` : `Conta "${c.name}" arquivada.`,
        'info'
      );
      await carregarTudo();
      onAccountsChanged?.();
    } catch (err: any) {
      onShowToast(err?.message || 'Erro ao arquivar conta.', 'erro');
    }
  };

  const excluirContaSemLancamentos = async (c: Account) => {
    try {
      await deleteAccount(c.id);
      onShowToast(`Conta "${c.name}" excluída.`, 'sucesso');
      await carregarTudo();
      onAccountsChanged?.();
    } catch (err: any) {
      onShowToast(
        'Não foi possível excluir esta conta (arquive-a caso já tenha vínculo).',
        'erro'
      );
    }
  };

  // ============================================================================
  // MODAL DE FORMA DE PAGAMENTO
  // ============================================================================
  const [modalFormaAberto, setModalFormaAberto] = useState(false);
  const [formaEditando, setFormaEditando] = useState<PaymentMethod | null>(null);
  const [formaNome, setFormaNome] = useState('');
  const [formaContaId, setFormaContaId] = useState<string>('');
  const [formaTaxaTexto, setFormaTaxaTexto] = useState('0');
  const [salvandoForma, setSalvandoForma] = useState(false);

  const contasAtivas = contas.filter((c) => !c.archived);

  const abrirNovaForma = () => {
    setFormaEditando(null);
    setFormaNome('');
    setFormaContaId(contasAtivas[0]?.id || '');
    setFormaTaxaTexto('0');
    setModalFormaAberto(true);
  };

  const abrirEditarForma = (pm: PaymentMethod) => {
    setFormaEditando(pm);
    setFormaNome(pm.name);
    setFormaContaId(pm.default_account_id || '');
    setFormaTaxaTexto(
      Number(pm.fee_percent || 0).toLocaleString('pt-BR', {
        minimumFractionDigits: Number(pm.fee_percent || 0) % 1 === 0 ? 0 : 2,
        maximumFractionDigits: 2,
      })
    );
    setModalFormaAberto(true);
  };

  const salvarForma = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuario) return;
    if (!formaNome.trim()) {
      onShowToast('Digite o nome da forma de pagamento.', 'erro');
      return;
    }

    const taxaConvertida = parseFeePercent(formaTaxaTexto);
    if (taxaConvertida === null) {
      onShowToast('Informe uma taxa válida entre 0% e 100% (ex.: 3,49).', 'erro');
      return;
    }

    setSalvandoForma(true);
    try {
      if (formaEditando) {
        await updatePaymentMethod(formaEditando.id, {
          name: formaNome,
          default_account_id: formaContaId || null,
          fee_percent: taxaConvertida,
        });
        onShowToast('Forma de pagamento atualizada!', 'sucesso');
      } else {
        await createPaymentMethod({
          user_id: usuario.id,
          name: formaNome,
          default_account_id: formaContaId || null,
          fee_percent: taxaConvertida,
        });
        onShowToast('Nova forma de pagamento criada!', 'sucesso');
      }
      setModalFormaAberto(false);
      await carregarTudo();
    } catch (err: any) {
      onShowToast(err?.message || 'Erro ao salvar forma de pagamento.', 'erro');
    } finally {
      setSalvandoForma(false);
    }
  };

  const alternarArquivoForma = async (pm: PaymentMethod) => {
    try {
      await updatePaymentMethod(pm.id, { archived: !pm.archived });
      onShowToast(
        pm.archived ? `"${pm.name}" restaurada.` : `"${pm.name}" arquivada.`,
        'info'
      );
      await carregarTudo();
    } catch (err: any) {
      onShowToast(err?.message || 'Erro ao alterar forma de pagamento.', 'erro');
    }
  };

  const excluirForma = async (pm: PaymentMethod) => {
    try {
      await deletePaymentMethod(pm.id);
      onShowToast(`"${pm.name}" excluída.`, 'sucesso');
      await carregarTudo();
    } catch {
      onShowToast('Não foi possível excluir. Tente arquivar.', 'erro');
    }
  };

  // ============================================================================
  // MODAL DE CATEGORIA DE SAÍDA
  // ============================================================================
  const [modalCatAberto, setModalCatAberto] = useState(false);
  const [catEditando, setCatEditando] = useState<Category | null>(null);
  const [catNome, setCatNome] = useState('');
  const [catIcone, setCatIcone] = useState<CategoryIconName>('fuel');
  const [catCor, setCatCor] = useState('#FF7A1A');
  const [salvandoCat, setSalvandoCat] = useState(false);

  const abrirNovaCategoria = () => {
    setCatEditando(null);
    setCatNome('');
    setCatIcone('tag');
    setCatCor('#FF7A1A');
    setModalCatAberto(true);
  };

  const abrirEditarCategoria = (cat: Category) => {
    setCatEditando(cat);
    setCatNome(cat.name);
    setCatIcone(cat.icon || 'tag');
    setCatCor(cat.color || '#FF7A1A');
    setModalCatAberto(true);
  };

  const salvarCategoria = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuario) return;
    if (!catNome.trim()) {
      onShowToast('Digite o nome da categoria.', 'erro');
      return;
    }

    setSalvandoCat(true);
    try {
      if (catEditando) {
        await updateCategory(catEditando.id, {
          name: catNome,
          icon: catIcone,
          color: catCor,
        });
        onShowToast('Categoria atualizada!', 'sucesso');
      } else {
        await createCategory({
          user_id: usuario.id,
          name: catNome,
          icon: catIcone,
          color: catCor,
        });
        onShowToast('Nova categoria criada!', 'sucesso');
      }
      setModalCatAberto(false);
      await carregarTudo();
    } catch (err: any) {
      onShowToast(err?.message || 'Erro ao salvar categoria.', 'erro');
    } finally {
      setSalvandoCat(false);
    }
  };

  const alternarArquivoCategoria = async (cat: Category) => {
    try {
      await updateCategory(cat.id, { archived: !cat.archived });
      onShowToast(
        cat.archived ? `"${cat.name}" restaurada.` : `"${cat.name}" arquivada.`,
        'info'
      );
      await carregarTudo();
    } catch (err: any) {
      onShowToast(err?.message || 'Erro ao alterar categoria.', 'erro');
    }
  };

  const excluirCategoria = async (cat: Category) => {
    try {
      await deleteCategory(cat.id);
      onShowToast(`"${cat.name}" excluída.`, 'sucesso');
      await carregarTudo();
      onAccountsChanged?.();
    } catch {
      onShowToast('Não foi possível excluir. Tente arquivar.', 'erro');
    }
  };

  const [adicionandoSugestoes3D, setAdicionandoSugestoes3D] = useState(false);

  const adicionarSugestoes3D = async () => {
    if (!usuario) return;
    setAdicionandoSugestoes3D(true);
    try {
      const qtd = await addSuggested3DCategories(usuario.id, categorias);
      if (qtd === 0) {
        onShowToast(
          'Todas as sugestões de categorias 3D já estão cadastradas!',
          'info'
        );
      } else {
        onShowToast(
          `${qtd} categoria(s) para peças 3D adicionada(s) com sucesso!`,
          'sucesso'
        );
        await carregarTudo();
        onAccountsChanged?.();
      }
    } catch (err: any) {
      onShowToast(err?.message || 'Erro ao adicionar sugestões 3D.', 'erro');
    } finally {
      setAdicionandoSugestoes3D(false);
    }
  };

  // ============================================================================
  // MODAL DE FONTE DE RENDA / APORTE (income_sources — Fase 3B)
  // ============================================================================
  const [modalFonteAberto, setModalFonteAberto] = useState(false);
  const [fonteEditando, setFonteEditando] = useState<IncomeSource | null>(null);
  const [fonteNome, setFonteNome] = useState('');
  const [fonteIcone, setFonteIcone] = useState<CategoryIconName>('shopping-bag');
  const [fonteCor, setFonteCor] = useState('#FF7A1A');
  const [fonteContaComoGanho, setFonteContaComoGanho] = useState(true);
  const [fonteFormaId, setFonteFormaId] = useState<string>('');
  const [fonteContaId, setFonteContaId] = useState<string>('');
  const [salvandoFonte, setSalvandoFonte] = useState(false);

  const formasAtivas = formas.filter((f) => !f.archived);

  const abrirNovaFonte = () => {
    setFonteEditando(null);
    setFonteNome('');
    setFonteIcone('shopping-bag');
    setFonteCor('#FF7A1A');
    setFonteContaComoGanho(true);
    const pmInicial = formasAtivas[0];
    setFonteFormaId(pmInicial?.id || '');
    setFonteContaId(
      pmInicial?.default_account_id || contasAtivas[0]?.id || ''
    );
    setModalFonteAberto(true);
  };

  const abrirEditarFonte = (src: IncomeSource) => {
    setFonteEditando(src);
    setFonteNome(src.name);
    setFonteIcone(src.icon || 'tag');
    setFonteCor(src.color || '#FF7A1A');
    setFonteContaComoGanho(src.counts_as_earning);
    setFonteFormaId(src.default_payment_method_id || '');
    setFonteContaId(src.default_account_id || '');
    setModalFonteAberto(true);
  };

  const salvarFonte = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuario) return;
    if (!fonteNome.trim()) {
      onShowToast('Digite o nome da fonte de renda.', 'erro');
      return;
    }

    setSalvandoFonte(true);
    try {
      if (fonteEditando) {
        await updateIncomeSource(fonteEditando.id, {
          name: fonteNome,
          icon: fonteIcone,
          color: fonteCor,
          counts_as_earning: fonteContaComoGanho,
          default_payment_method_id: fonteFormaId || null,
          default_account_id: fonteContaId || null,
        });
        onShowToast('Fonte de renda atualizada!', 'sucesso');
      } else {
        await createIncomeSource({
          user_id: usuario.id,
          name: fonteNome,
          icon: fonteIcone,
          color: fonteCor,
          counts_as_earning: fonteContaComoGanho,
          default_payment_method_id: fonteFormaId || null,
          default_account_id: fonteContaId || null,
        });
        onShowToast('Nova fonte de renda criada!', 'sucesso');
      }
      setModalFonteAberto(false);
      await carregarTudo();
      onAccountsChanged?.();
    } catch (err: any) {
      onShowToast(err?.message || 'Erro ao salvar fonte de renda.', 'erro');
    } finally {
      setSalvandoFonte(false);
    }
  };

  const alternarArquivoFonte = async (src: IncomeSource) => {
    try {
      await updateIncomeSource(src.id, { archived: !src.archived });
      onShowToast(
        src.archived
          ? `Fonte "${src.name}" restaurada.`
          : `Fonte "${src.name}" arquivada.`,
        'info'
      );
      await carregarTudo();
      onAccountsChanged?.();
    } catch (err: any) {
      onShowToast(err?.message || 'Erro ao arquivar fonte.', 'erro');
    }
  };

  const excluirFonteSemLancamentos = async (src: IncomeSource) => {
    try {
      await deleteIncomeSource(src.id);
      onShowToast(`Fonte "${src.name}" excluída.`, 'sucesso');
      await carregarTudo();
      onAccountsChanged?.();
    } catch {
      onShowToast(
        'Não é possível excluir uma fonte que já possui lançamentos vinculados (mantenha-a arquivada).',
        'erro'
      );
    }
  };

  // ============================================================================
  // PREFERÊNCIAS DO USUÁRIO + TAGS RÁPIDAS EDITÁVEIS
  // ============================================================================
  const [prefNome, setPrefNome] = useState(perfil?.name || '');
  const [prefSom, setPrefSom] = useState(perfil?.sound_enabled ?? true);
  const [prefDiaSemana, setPrefDiaSemana] = useState<0 | 1>(
    perfil?.week_starts_on ?? 1
  );
  const [prefTags, setPrefTags] = useState<string[]>(
    perfil?.quick_tags && perfil.quick_tags.length > 0
      ? perfil.quick_tags
      : DEFAULT_QUICK_TAGS
  );
  const [novaTagTexto, setNovaTagTexto] = useState('');
  const [salvandoPref, setSalvandoPref] = useState(false);

  const adicionarNovaTagRapida = () => {
    const limpa = novaTagTexto.trim().replace(/\s+/g, '');
    if (!limpa) return;
    const formatada = limpa.startsWith('#') ? limpa : `#${limpa}`;
    if (prefTags.some((t) => t.toLowerCase() === formatada.toLowerCase())) {
      setNovaTagTexto('');
      return;
    }
    setPrefTags((atuais) => [...atuais, formatada]);
    setNovaTagTexto('');
  };

  const removerTagRapida = (tag: string) => {
    setPrefTags((atuais) => atuais.filter((t) => t !== tag));
  };

  // Alteração de senha direto nas Preferências
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarNovaSenha, setConfirmarNovaSenha] = useState('');
  const [salvandoSenha, setSalvandoSenha] = useState(false);

  const salvarNovaSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaSenha) {
      onShowToast('Digite a nova senha.', 'erro');
      return;
    }
    if (novaSenha !== confirmarNovaSenha) {
      onShowToast('A confirmação da senha não confere.', 'erro');
      return;
    }
    setSalvandoSenha(true);
    try {
      await updateMyPassword(novaSenha);
      setNovaSenha('');
      setConfirmarNovaSenha('');
      onShowToast('Sua senha foi alterada com sucesso!', 'sucesso');
    } catch (err: any) {
      onShowToast(err?.message || 'Não foi possível alterar a senha.', 'erro');
    } finally {
      setSalvandoSenha(false);
    }
  };

  useEffect(() => {
    if (perfil) {
      setPrefNome(perfil.name);
      setPrefSom(perfil.sound_enabled);
      setPrefDiaSemana(perfil.week_starts_on);
      setPrefTags(
        perfil.quick_tags && perfil.quick_tags.length > 0
          ? perfil.quick_tags
          : DEFAULT_QUICK_TAGS
      );
    }
  }, [perfil]);

  const salvarPreferencias = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuario) return;
    setSalvandoPref(true);
    try {
      await updateMyPreferences(usuario.id, {
        name: prefNome.trim() || 'Usuário',
        sound_enabled: prefSom,
        week_starts_on: prefDiaSemana,
        quick_tags: prefTags.length > 0 ? prefTags : DEFAULT_QUICK_TAGS,
      });
      await recarregarPerfilEConfig();
      onShowToast('Preferências e tags salvas com sucesso!', 'sucesso');
    } catch (err: any) {
      onShowToast(err?.message || 'Erro ao salvar preferências.', 'erro');
    } finally {
      setSalvandoPref(false);
    }
  };

  // ============================================================================
  // PAINEL ADMIN (exclusivo Admin)
  // ============================================================================
  const [usuariosAdmin, setUsuariosAdmin] = useState<Profile[]>([]);
  const [carregandoAdmin, setCarregandoAdmin] = useState(false);
  const [modalConfirmarCadastro, setModalConfirmarCadastro] = useState(false);
  const [alterandoCadastro, setAlterandoCadastro] = useState(false);

  const carregarListaUsuarios = useCallback(async () => {
    if (!isAdmin) return;
    setCarregandoAdmin(true);
    try {
      const lista = await fetchAllProfilesAdmin();
      setUsuariosAdmin(lista);
    } catch (err: any) {
      onShowToast(err?.message || 'Erro ao listar usuários.', 'erro');
    } finally {
      setCarregandoAdmin(false);
    }
  }, [isAdmin, onShowToast]);

  useEffect(() => {
    if (secao === 'admin' && isAdmin) {
      carregarListaUsuarios();
    }
  }, [secao, isAdmin, carregarListaUsuarios]);

  const confirmarAlternarCadastro = async () => {
    if (!isAdmin) return;
    const novoValor = !configApp.signup_open;
    setAlterandoCadastro(true);
    try {
      await updateSignupOpenAdmin(novoValor);
      await recarregarPerfilEConfig();
      setModalConfirmarCadastro(false);
      onShowToast(
        novoValor
          ? 'Cadastro de novos usuários foi ABERTO.'
          : 'Cadastro de novos usuários foi FECHADO (tela oculta e bloqueado no banco).',
        'sucesso'
      );
    } catch (err: any) {
      onShowToast(err?.message || 'Erro ao atualizar configuração.', 'erro');
    } finally {
      setAlterandoCadastro(false);
    }
  };

  const alterarStatusUsuario = async (u: Profile, novoStatus: UserStatus) => {
    try {
      await updateUserStatusAdmin(u.id, novoStatus);
      await carregarListaUsuarios();
      const label =
        novoStatus === 'approved'
          ? 'Aprovado'
          : novoStatus === 'blocked'
            ? 'Bloqueado'
            : 'Pendente';
      onShowToast(`Usuário ${u.name || u.email} agora está: ${label}.`, 'sucesso');
    } catch (err: any) {
      onShowToast(err?.message || 'Erro ao atualizar usuário.', 'erro');
    }
  };

  // Listas filtradas conforme o toggle de arquivados
  const contasVisiveis = contas.filter((c) =>
    mostrarArquivados ? true : !c.archived
  );
  const fontesVisiveis = fontes.filter((src) =>
    mostrarArquivados ? true : !src.archived
  );
  const formasVisiveis = formas.filter((f) =>
    mostrarArquivados ? true : !f.archived
  );
  const categoriasVisiveis = categorias.filter((cat) =>
    mostrarArquivados ? true : !cat.archived
  );

  const obterNomeConta = (accountId: string | null) => {
    if (!accountId) return 'Sem conta padrão';
    const encontrada = contas.find((c) => c.id === accountId);
    return encontrada ? encontrada.name : 'Conta não encontrada';
  };

  const obterNomeForma = (paymentMethodId: string | null) => {
    if (!paymentMethodId) return 'Escolher na hora';
    const encontrada = formas.find((f) => f.id === paymentMethodId);
    return encontrada ? encontrada.name : 'Forma não encontrada';
  };

  // Simulação de taxa ao vivo no modal de Forma de Pagamento
  const taxaPreviewNum = parseFeePercent(formaTaxaTexto) ?? 0;
  const liquidoPreviewCents = Math.round(10000 * (1 - taxaPreviewNum / 100));

  return (
    <div className="flex flex-col gap-4 min-w-0">
      {/* Abas superiores da área de Configurações */}
      <div
        className={[
          'grid grid-cols-2 sm:grid-cols-3 gap-1.5 bg-[#141418] p-1.5 rounded-2xl border border-[#262630] min-w-0',
          isAdmin ? 'lg:grid-cols-6' : 'lg:grid-cols-5',
        ].join(' ')}
      >
        <button
          type="button"
          onClick={() => setSecao('contas')}
          className={[
            'min-h-[42px] px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all min-w-0 overflow-hidden',
            secao === 'contas'
              ? 'bg-[#FF7A1A] text-[#0B0B0D] shadow'
              : 'text-[#9A9AA6] hover:text-white',
          ].join(' ')}
        >
          <Landmark className="w-4 h-4 shrink-0" />
          <span className="truncate">Contas</span>
        </button>

        <button
          type="button"
          onClick={() => setSecao('fontes')}
          className={[
            'min-h-[42px] px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all min-w-0 overflow-hidden',
            secao === 'fontes'
              ? 'bg-[#FF7A1A] text-[#0B0B0D] shadow'
              : 'text-[#9A9AA6] hover:text-white',
          ].join(' ')}
        >
          <Briefcase className="w-4 h-4 shrink-0" />
          <span className="truncate">Fontes</span>
        </button>

        <button
          type="button"
          onClick={() => setSecao('formas')}
          className={[
            'min-h-[42px] px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all min-w-0 overflow-hidden',
            secao === 'formas'
              ? 'bg-[#FF7A1A] text-[#0B0B0D] shadow'
              : 'text-[#9A9AA6] hover:text-white',
          ].join(' ')}
        >
          <CreditCard className="w-4 h-4 shrink-0" />
          <span className="truncate">Formas/Taxas</span>
        </button>

        <button
          type="button"
          onClick={() => setSecao('categorias')}
          className={[
            'min-h-[42px] px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all min-w-0 overflow-hidden',
            secao === 'categorias'
              ? 'bg-[#FF7A1A] text-[#0B0B0D] shadow'
              : 'text-[#9A9AA6] hover:text-white',
          ].join(' ')}
        >
          <Tags className="w-4 h-4 shrink-0" />
          <span className="truncate">Categorias</span>
        </button>

        <button
          type="button"
          onClick={() => setSecao('preferencias')}
          className={[
            'min-h-[42px] px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all min-w-0 overflow-hidden',
            secao === 'preferencias'
              ? 'bg-[#FF7A1A] text-[#0B0B0D] shadow'
              : 'text-[#9A9AA6] hover:text-white',
          ].join(' ')}
        >
          <Sliders className="w-4 h-4 shrink-0" />
          <span className="truncate">Preferências</span>
        </button>

        {isAdmin && (
          <button
            type="button"
            onClick={() => setSecao('admin')}
            className={[
              'min-h-[42px] px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all min-w-0 overflow-hidden',
              secao === 'admin'
                ? 'bg-[#FF7A1A] text-[#0B0B0D] shadow'
                : 'text-[#FFC940] hover:bg-white/5',
            ].join(' ')}
          >
            <Users className="w-4 h-4 shrink-0" />
            <span className="truncate">Painel Admin</span>
          </button>
        )}
      </div>

      {/* Filtro de Arquivados para Contas / Fontes / Formas / Categorias */}
      {(secao === 'contas' ||
        secao === 'fontes' ||
        secao === 'formas' ||
        secao === 'categorias') && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 min-w-0">
          <label className="inline-flex items-center gap-2 text-xs text-[#9A9AA6] cursor-pointer select-none min-w-0">
            <input
              type="checkbox"
              checked={mostrarArquivados}
              onChange={(e) => setMostrarArquivados(e.target.checked)}
              className="rounded border-[#262630] bg-[#141418] text-[#FF7A1A] focus:ring-[#FF7A1A]"
            />
            <span className="truncate">Mostrar itens arquivados</span>
          </label>

          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            {secao === 'contas' && (
              <Botao
                variante="primario"
                tamanho="sm"
                icone={<Plus className="w-4 h-4" />}
                texto="Nova Conta"
                onClick={abrirNovaConta}
              />
            )}
            {secao === 'fontes' && (
              <Botao
                variante="primario"
                tamanho="sm"
                icone={<Plus className="w-4 h-4" />}
                texto="Nova Fonte"
                onClick={abrirNovaFonte}
              />
            )}
            {secao === 'formas' && (
              <Botao
                variante="primario"
                tamanho="sm"
                icone={<Plus className="w-4 h-4" />}
                texto="Nova Forma"
                onClick={abrirNovaForma}
              />
            )}
            {secao === 'categorias' && (
              <>
                <Botao
                  variante="secundario"
                  tamanho="sm"
                  carregando={adicionandoSugestoes3D}
                  icone={<Sparkles className="w-4 h-4 text-[#FFC940]" />}
                  texto="+ Sugestões 3D"
                  onClick={adicionarSugestoes3D}
                />
                <Botao
                  variante="primario"
                  tamanho="sm"
                  icone={<Plus className="w-4 h-4" />}
                  texto="Nova Categoria"
                  onClick={abrirNovaCategoria}
                />
              </>
            )}
          </div>
        </div>
      )}

      {/* ====================================================================
          SEÇÃO 1: CONTAS
      ==================================================================== */}
      {secao === 'contas' && (
        <div className="flex flex-col gap-2.5 lg:grid lg:grid-cols-2 lg:gap-3 min-w-0">
          {carregandoDados ? (
            <Card>
              <p className="text-xs text-[#9A9AA6]">Carregando suas contas...</p>
            </Card>
          ) : contasVisiveis.length === 0 ? (
            <Card>
              <p className="text-xs text-[#9A9AA6]">Nenhuma conta encontrada.</p>
            </Card>
          ) : (
            contasVisiveis.map((c) => (
              <Card
                key={c.id}
                padding="md"
                className={c.archived ? 'opacity-60' : ''}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      style={{
                        backgroundColor: `${c.color}20`,
                        borderColor: `${c.color}60`,
                        color: c.color,
                      }}
                      className="w-11 h-11 rounded-xl border flex items-center justify-center shrink-0"
                    >
                      {c.type === 'cash' ? (
                        <Banknote className="w-5 h-5" />
                      ) : (
                        <Landmark className="w-5 h-5" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <h3
                          className="text-sm sm:text-base font-bold text-white truncate"
                          title={c.name}
                        >
                          {c.name}
                        </h3>
                        {c.archived && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-[#9A9AA6] font-semibold shrink-0">
                            Arquivada
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#9A9AA6] truncate">
                        {c.type === 'cash' ? 'Dinheiro em espécie' : 'Conta bancária'} •
                        Saldo inicial:{' '}
                        <strong className="text-white tabular-nums">
                          {formatCentsToBRL(c.initial_balance_cents)}
                        </strong>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                    <Botao
                      variante="secundario"
                      tamanho="sm"
                      icone={<Pencil className="w-3.5 h-3.5" />}
                      texto="Editar"
                      onClick={() => abrirEditarConta(c)}
                    />
                    <Botao
                      variante="fantasma"
                      tamanho="sm"
                      icone={
                        c.archived ? (
                          <RotateCcw className="w-3.5 h-3.5 text-[#2EE59D]" />
                        ) : (
                          <Archive className="w-3.5 h-3.5 text-[#FFC940]" />
                        )
                      }
                      texto={c.archived ? 'Restaurar' : 'Arquivar'}
                      onClick={() => alternarArquivoConta(c)}
                    />
                    {c.archived && (
                      <Botao
                        variante="perigo"
                        tamanho="sm"
                        icone={<Trash2 className="w-3.5 h-3.5" />}
                        texto="Excluir"
                        onClick={() => excluirContaSemLancamentos(c)}
                      />
                    )}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* ====================================================================
          SEÇÃO 1B: FONTES DE RENDA E APORTES (Fase 3B)
      ==================================================================== */}
      {secao === 'fontes' && (
        <div className="flex flex-col gap-2.5 lg:grid lg:grid-cols-2 lg:gap-3 min-w-0">
          <p className="text-xs text-[#9A9AA6] px-1 lg:col-span-2">
            Gerencie suas fontes de renda (corridas, vendas 3D, etc.) e aportes. Quando uma fonte está marcada como{' '}
            <strong className="text-[#06B6D4]">Aporte</strong>, o dinheiro entra no saldo da conta mas não infla os totais de ganho.
          </p>

          {carregandoDados ? (
            <Card>
              <p className="text-xs text-[#9A9AA6]">
                Carregando fontes de renda...
              </p>
            </Card>
          ) : fontesVisiveis.length === 0 ? (
            <Card>
              <p className="text-xs text-[#9A9AA6]">
                Nenhuma fonte de renda encontrada.
              </p>
            </Card>
          ) : (
            fontesVisiveis.map((src) => (
              <Card
                key={src.id}
                padding="md"
                className={src.archived ? 'opacity-60' : ''}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      style={{
                        backgroundColor: `${src.color}20`,
                        borderColor: `${src.color}60`,
                        color: src.color,
                      }}
                      className="w-11 h-11 rounded-xl border flex items-center justify-center shrink-0"
                    >
                      <CategoryIcon name={src.icon} className="w-5 h-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 min-w-0 flex-wrap">
                        <h3
                          className="text-sm sm:text-base font-bold text-white truncate"
                          title={src.name}
                        >
                          {src.name}
                        </h3>
                        <span
                          className={[
                            'text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0',
                            src.counts_as_earning
                              ? 'bg-[#2EE59D]/15 text-[#2EE59D]'
                              : 'bg-[#06B6D4]/20 text-[#06B6D4] border border-[#06B6D4]/40',
                          ].join(' ')}
                        >
                          {src.counts_as_earning ? 'Conta como ganho' : 'Aporte'}
                        </span>
                        {src.archived && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-[#9A9AA6] font-semibold shrink-0">
                            Arquivada
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#9A9AA6] truncate mt-0.5">
                        Sugere:{' '}
                        <strong className="text-[#F5F5F7]">
                          {obterNomeForma(src.default_payment_method_id)}
                        </strong>{' '}
                        →{' '}
                        <strong className="text-[#F5F5F7]">
                          {obterNomeConta(src.default_account_id)}
                        </strong>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                    <Botao
                      variante="secundario"
                      tamanho="sm"
                      icone={<Pencil className="w-3.5 h-3.5" />}
                      texto="Editar"
                      onClick={() => abrirEditarFonte(src)}
                    />
                    <Botao
                      variante="fantasma"
                      tamanho="sm"
                      icone={
                        src.archived ? (
                          <RotateCcw className="w-3.5 h-3.5 text-[#2EE59D]" />
                        ) : (
                          <Archive className="w-3.5 h-3.5 text-[#FFC940]" />
                        )
                      }
                      texto={src.archived ? 'Restaurar' : 'Arquivar'}
                      onClick={() => alternarArquivoFonte(src)}
                    />
                    {src.archived && (
                      <Botao
                        variante="perigo"
                        tamanho="sm"
                        icone={<Trash2 className="w-3.5 h-3.5" />}
                        texto="Excluir"
                        onClick={() => excluirFonteSemLancamentos(src)}
                      />
                    )}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* ====================================================================
          SEÇÃO 2: FORMAS DE PAGAMENTO E TAXAS
      ==================================================================== */}
      {secao === 'formas' && (
        <div className="flex flex-col gap-2.5 lg:grid lg:grid-cols-2 lg:gap-3 min-w-0">
          {carregandoDados ? (
            <Card>
              <p className="text-xs text-[#9A9AA6]">
                Carregando formas de pagamento...
              </p>
            </Card>
          ) : (
            formasVisiveis.map((pm) => (
              <Card
                key={pm.id}
                padding="md"
                className={pm.archived ? 'opacity-60' : ''}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <h3
                        className="text-sm sm:text-base font-bold text-white truncate"
                        title={pm.name}
                      >
                        {pm.name}
                      </h3>
                      <span
                        className={[
                          'px-2 py-0.5 rounded-full text-[11px] font-bold tabular-nums shrink-0',
                          pm.fee_percent > 0
                            ? 'bg-[#FFC940]/15 text-[#FFC940] border border-[#FFC940]/30'
                            : 'bg-[#2EE59D]/15 text-[#2EE59D]',
                        ].join(' ')}
                      >
                        Taxa: {formatFeePercent(pm.fee_percent)}
                      </span>
                      {pm.archived && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-[#9A9AA6] font-semibold shrink-0">
                          Arquivada
                        </span>
                      )}
                    </div>
                    <p
                      className="text-xs text-[#9A9AA6] truncate mt-1"
                      title={obterNomeConta(pm.default_account_id)}
                    >
                      Cai por padrão em:{' '}
                      <strong className="text-[#F5F5F7]">
                        {obterNomeConta(pm.default_account_id)}
                      </strong>
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                    <Botao
                      variante="secundario"
                      tamanho="sm"
                      icone={<Pencil className="w-3.5 h-3.5" />}
                      texto="Editar"
                      onClick={() => abrirEditarForma(pm)}
                    />
                    <Botao
                      variante="fantasma"
                      tamanho="sm"
                      icone={
                        pm.archived ? (
                          <RotateCcw className="w-3.5 h-3.5 text-[#2EE59D]" />
                        ) : (
                          <Archive className="w-3.5 h-3.5 text-[#FFC940]" />
                        )
                      }
                      texto={pm.archived ? 'Restaurar' : 'Arquivar'}
                      onClick={() => alternarArquivoForma(pm)}
                    />
                    {pm.archived && (
                      <Botao
                        variante="perigo"
                        tamanho="sm"
                        icone={<Trash2 className="w-3.5 h-3.5" />}
                        texto="Excluir"
                        onClick={() => excluirForma(pm)}
                      />
                    )}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* ====================================================================
          SEÇÃO 3: CATEGORIAS DE SAÍDA
      ==================================================================== */}
      {secao === 'categorias' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 min-w-0">
          {carregandoDados ? (
            <Card>
              <p className="text-xs text-[#9A9AA6]">Carregando categorias...</p>
            </Card>
          ) : (
            categoriasVisiveis.map((cat) => (
              <Card
                key={cat.id}
                padding="sm"
                className={cat.archived ? 'opacity-60' : ''}
              >
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      style={{
                        backgroundColor: `${cat.color}20`,
                        borderColor: `${cat.color}60`,
                        color: cat.color,
                      }}
                      className="w-10 h-10 rounded-xl border flex items-center justify-center shrink-0"
                    >
                      <CategoryIcon name={cat.icon} className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3
                        className="text-sm font-bold text-white truncate"
                        title={cat.name}
                      >
                        {cat.name}
                      </h3>
                      {cat.archived && (
                        <span className="text-[10px] text-[#9A9AA6]">
                          Arquivada
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Botao
                      variante="secundario"
                      tamanho="sm"
                      icone={<Pencil className="w-3.5 h-3.5" />}
                      texto="Editar"
                      onClick={() => abrirEditarCategoria(cat)}
                    />
                    <Botao
                      variante="fantasma"
                      tamanho="sm"
                      icone={
                        cat.archived ? (
                          <RotateCcw className="w-3.5 h-3.5 text-[#2EE59D]" />
                        ) : (
                          <Archive className="w-3.5 h-3.5 text-[#FFC940]" />
                        )
                      }
                      texto={cat.archived ? 'Restaurar' : 'Arquivar'}
                      onClick={() => alternarArquivoCategoria(cat)}
                    />
                    {cat.archived && (
                      <Botao
                        variante="perigo"
                        tamanho="sm"
                        icone={<Trash2 className="w-3.5 h-3.5" />}
                        texto=""
                        aria-label={`Excluir ${cat.name}`}
                        onClick={() => excluirCategoria(cat)}
                      />
                    )}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* ====================================================================
          SEÇÃO 4: PREFERÊNCIAS DO USUÁRIO + ALTERAR SENHA
      ==================================================================== */}
      {secao === 'preferencias' && (
        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start min-w-0">
          <Card bordaAnimada padding="lg">
            <form
              onSubmit={salvarPreferencias}
              className="flex flex-col gap-4 min-w-0"
            >
              <h2 className="text-base font-bold text-white truncate">
                Preferências do App
              </h2>

              <Campo
                rotulo="Seu nome de exibição"
                value={prefNome}
                onChange={(e) => setPrefNome(e.target.value)}
                placeholder="Ex.: Octavio"
              />

              {/* Som ligado/desligado */}
              <div className="p-3.5 rounded-xl bg-[#0B0B0D] border border-[#262630] flex items-center justify-between gap-3 min-w-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-[#FF7A1A]/15 text-[#FF7A1A] flex items-center justify-center shrink-0">
                    {prefSom ? (
                      <Volume2 className="w-5 h-5" />
                    ) : (
                      <VolumeX className="w-5 h-5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">
                      Sons de conquista (Metas)
                    </p>
                    <p className="text-xs text-[#9A9AA6] truncate">
                      {prefSom
                        ? 'Ligado (toca som ao bater meta)'
                        : 'Desligado (silencioso)'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={prefSom}
                  onClick={() => setPrefSom((v) => !v)}
                  className={[
                    'w-14 h-8 rounded-full p-1 transition-colors shrink-0 flex items-center',
                    prefSom ? 'bg-[#2EE59D]' : 'bg-[#262630]',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'w-6 h-6 rounded-full bg-[#0B0B0D] shadow transition-transform',
                      prefSom ? 'translate-x-6' : 'translate-x-0',
                    ].join(' ')}
                  />
                </button>
              </div>

              {/* Primeiro dia da semana */}
              <div className="p-3.5 rounded-xl bg-[#0B0B0D] border border-[#262630] flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-[#FF7A1A]/15 text-[#FF7A1A] flex items-center justify-center shrink-0">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">
                      Primeiro dia da semana
                    </p>
                    <p className="text-xs text-[#9A9AA6] truncate">
                      Define o início dos relatórios e metas semanais
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1.5 bg-[#141418] p-1 rounded-xl border border-[#262630] shrink-0">
                  <button
                    type="button"
                    onClick={() => setPrefDiaSemana(1)}
                    className={[
                      'min-h-[38px] px-3 rounded-lg text-xs font-bold transition-colors',
                      prefDiaSemana === 1
                        ? 'bg-[#FF7A1A] text-[#0B0B0D]'
                        : 'text-[#9A9AA6] hover:text-white',
                    ].join(' ')}
                  >
                    Segunda
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrefDiaSemana(0)}
                    className={[
                      'min-h-[38px] px-3 rounded-lg text-xs font-bold transition-colors',
                      prefDiaSemana === 0
                        ? 'bg-[#FF7A1A] text-[#0B0B0D]'
                        : 'text-[#9A9AA6] hover:text-white',
                    ].join(' ')}
                  >
                    Domingo
                  </button>
                </div>
              </div>

              {/* Tags rápidas editáveis (Fase 3B item 8) */}
              <div className="p-3.5 rounded-xl bg-[#0B0B0D] border border-[#262630] space-y-3 min-w-0">
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">
                      Tags Rápidas (#)
                    </p>
                    <p className="text-xs text-[#9A9AA6] truncate">
                      Aparecem como botões rápidos nas observações dos lançamentos
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPrefTags(DEFAULT_QUICK_TAGS)}
                    className="text-[11px] font-semibold text-[#FF7A1A] hover:underline shrink-0"
                  >
                    Restaurar padrão
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5 min-w-0">
                  {prefTags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#141418] border border-[#262630] text-xs text-white"
                    >
                      <span className="truncate max-w-[140px]">{tag}</span>
                      <button
                        type="button"
                        onClick={() => removerTagRapida(tag)}
                        aria-label={`Remover tag ${tag}`}
                        className="text-[#9A9AA6] hover:text-[#FF3B30]"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                </div>

                <div className="flex gap-2 min-w-0">
                  <input
                    type="text"
                    value={novaTagTexto}
                    onChange={(e) => setNovaTagTexto(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        adicionarNovaTagRapida();
                      }
                    }}
                    placeholder="Nova tag (ex.: #Chaveiro3D)"
                    className="flex-1 min-w-0 min-h-[42px] px-3 bg-[#141418] border border-[#262630] rounded-xl text-xs sm:text-sm text-white placeholder-[#9A9AA6]/60 focus:outline-none focus:border-[#FF7A1A]"
                  />
                  <Botao
                    type="button"
                    variante="secundario"
                    tamanho="sm"
                    icone={<Plus className="w-4 h-4" />}
                    texto="Adicionar"
                    onClick={adicionarNovaTagRapida}
                  />
                </div>
              </div>

              {/* Informações do Sistema */}
              <div className="p-3 rounded-xl bg-[#0B0B0D]/60 border border-[#262630] text-xs text-[#9A9AA6] flex flex-wrap items-center justify-between gap-2">
                <span>Moeda padrão: Real (R$)</span>
                <span>Fuso: America/Sao_Paulo</span>
                <span className="text-[#FF7A1A] font-bold">
                  {APP_NAME} {APP_VERSION}
                </span>
              </div>

              <Botao
                type="submit"
                variante="primario"
                larguraTotal
                carregando={salvandoPref}
                texto="Salvar minhas preferências"
              />
            </form>
          </Card>

          {/* Card para Alterar a Senha */}
          <Card padding="lg">
            <form
              onSubmit={salvarNovaSenha}
              className="flex flex-col gap-4 min-w-0"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Lock className="w-4 h-4 text-[#FF7A1A] shrink-0" />
                <h2 className="text-base font-bold text-white truncate">
                  Alterar Minha Senha
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
                <Campo
                  rotulo="Nova senha"
                  type="password"
                  placeholder="Digite a nova senha"
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  autoComplete="new-password"
                  required
                />
                <Campo
                  rotulo="Confirmar nova senha"
                  type="password"
                  placeholder="Repita a nova senha"
                  value={confirmarNovaSenha}
                  onChange={(e) => setConfirmarNovaSenha(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>

              <Botao
                type="submit"
                variante="secundario"
                larguraTotal
                carregando={salvandoSenha}
                icone={<Lock className="w-4 h-4 text-[#FF7A1A]" />}
                texto="Atualizar minha senha"
              />
            </form>
          </Card>
        </div>
      )}

      {/* ====================================================================
          SEÇÃO 5: PAINEL DO ADMINISTRADOR (exclusivo Admin)
      ==================================================================== */}
      {secao === 'admin' && isAdmin && (
        <Card bordaAnimada padding="lg">
          <div className="flex flex-col gap-4 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <ShieldAlert className="w-5 h-5 text-[#FF7A1A] shrink-0" />
              <h2 className="text-base font-bold text-white truncate">
                Controle de Acesso e Usuários
              </h2>
            </div>

            {/* Controle do Cadastro Aberto / Fechado com confirmação */}
            <div className="p-4 rounded-2xl bg-[#0B0B0D] border border-[#262630] flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
              <div className="min-w-0">
                <p className="text-sm font-bold text-white truncate">
                  Cadastro de novos usuários:{' '}
                  <span
                    className={
                      configApp.signup_open ? 'text-[#2EE59D]' : 'text-[#FF3B30]'
                    }
                  >
                    {configApp.signup_open ? 'ABERTO' : 'FECHADO'}
                  </span>
                </p>
                <p className="text-xs text-[#9A9AA6] mt-0.5 leading-relaxed">
                  Quando fechado, a aba &ldquo;Criar conta&rdquo; some da tela inicial e o banco de dados bloqueia qualquer tentativa de cadastro via API.
                </p>
              </div>

              <Botao
                variante={configApp.signup_open ? 'perigo' : 'sucesso'}
                tamanho="sm"
                onClick={() => setModalConfirmarCadastro(true)}
                icone={
                  configApp.signup_open ? (
                    <Lock className="w-4 h-4" />
                  ) : (
                    <Unlock className="w-4 h-4" />
                  )
                }
                texto={
                  configApp.signup_open
                    ? 'Fechar novos cadastros'
                    : 'Abrir novos cadastros'
                }
              />
            </div>

            {/* Lista de Usuários */}
            <div className="space-y-2.5 min-w-0">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#9A9AA6]">
                Usuários do Sistema ({usuariosAdmin.length})
              </h3>

              {carregandoAdmin ? (
                <p className="text-xs text-[#9A9AA6]">Carregando lista...</p>
              ) : (
                usuariosAdmin.map((u) => (
                  <div
                    key={u.id}
                    className="p-3.5 rounded-xl bg-[#0B0B0D]/90 border border-[#262630] flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <p
                          className="text-sm font-bold text-white truncate"
                          title={u.name}
                        >
                          {u.name || 'Sem nome'}
                        </p>
                        {u.role === 'admin' && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#FF7A1A]/20 text-[#FF7A1A] font-extrabold shrink-0">
                            ADMIN
                          </span>
                        )}
                        <span
                          className={[
                            'text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0',
                            u.status === 'approved'
                              ? 'bg-[#2EE59D]/15 text-[#2EE59D]'
                              : u.status === 'pending'
                                ? 'bg-[#FFC940]/15 text-[#FFC940]'
                                : 'bg-[#FF3B30]/15 text-[#FF3B30]',
                          ].join(' ')}
                        >
                          {u.status === 'approved'
                            ? 'Aprovado'
                            : u.status === 'pending'
                              ? 'Pendente'
                              : 'Bloqueado'}
                        </span>
                      </div>
                      <p className="text-xs text-[#9A9AA6] truncate mt-0.5" title={u.email}>
                        {u.email}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                      {u.status === 'pending' && (
                        <Botao
                          variante="sucesso"
                          tamanho="sm"
                          icone={<CheckCircle2 className="w-3.5 h-3.5" />}
                          texto="Aprovar"
                          onClick={() => alterarStatusUsuario(u, 'approved')}
                        />
                      )}
                      {u.status === 'blocked' && (
                        <Botao
                          variante="sucesso"
                          tamanho="sm"
                          icone={<RotateCcw className="w-3.5 h-3.5" />}
                          texto="Reativar"
                          onClick={() => alterarStatusUsuario(u, 'approved')}
                        />
                      )}
                      {u.status !== 'blocked' && u.id !== perfil?.id && (
                        <Botao
                          variante="perigo"
                          tamanho="sm"
                          icone={<Ban className="w-3.5 h-3.5" />}
                          texto="Bloquear"
                          onClick={() => alterarStatusUsuario(u, 'blocked')}
                        />
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>
      )}

      {/* ====================================================================
          MODAL: CRIAR / EDITAR CONTA
      ==================================================================== */}
      <Modal
        aberto={modalContaAberto}
        aoFechar={() => setModalContaAberto(false)}
        titulo={contaEditando ? 'Editar Conta' : 'Nova Conta'}
      >
        <form onSubmit={salvarConta} className="flex flex-col gap-4 min-w-0">
          <Campo
            rotulo="Nome da conta (ex.: Nubank, Inter, Bolso)"
            value={contaNome}
            onChange={(e) => setContaNome(e.target.value)}
            placeholder="Ex.: Conta 1 - Nubank"
            required
          />

          <div className="flex flex-col gap-1.5 min-w-0">
            <span className="text-xs sm:text-sm font-medium text-[#F5F5F7]">
              Tipo da conta
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setContaTipo('bank')}
                className={[
                  'min-h-[46px] px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all',
                  contaTipo === 'bank'
                    ? 'bg-[#FF7A1A]/20 border-[#FF7A1A] text-white'
                    : 'bg-[#0B0B0D] border-[#262630] text-[#9A9AA6]',
                ].join(' ')}
              >
                <Landmark className="w-4 h-4 shrink-0" />
                <span className="truncate">Banco / Digital</span>
              </button>
              <button
                type="button"
                onClick={() => setContaTipo('cash')}
                className={[
                  'min-h-[46px] px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all',
                  contaTipo === 'cash'
                    ? 'bg-[#FF7A1A]/20 border-[#FF7A1A] text-white'
                    : 'bg-[#0B0B0D] border-[#262630] text-[#9A9AA6]',
                ].join(' ')}
              >
                <Banknote className="w-4 h-4 shrink-0" />
                <span className="truncate">Dinheiro (Bolso)</span>
              </button>
            </div>
          </div>

          <CampoMoeda
            rotulo="Saldo inicial hoje (R$)"
            centavos={contaSaldoInicial}
            aoMudarCentavos={setContaSaldoInicial}
            dica="Digite apenas os números (ex.: 15000 vira R$ 150,00)"
          />

          <div className="flex flex-col gap-1.5 min-w-0">
            <span className="text-xs sm:text-sm font-medium text-[#F5F5F7]">
              Cor de identificação
            </span>
            <div className="flex flex-wrap gap-2">
              {PALETA_CORES.map((c) => (
                <button
                  key={c.valor}
                  type="button"
                  onClick={() => setContaCor(c.valor)}
                  title={c.nome}
                  aria-label={c.nome}
                  style={{ backgroundColor: c.valor }}
                  className={[
                    'w-9 h-9 rounded-xl transition-transform',
                    contaCor === c.valor
                      ? 'ring-2 ring-white scale-110'
                      : 'opacity-70 hover:opacity-100',
                  ].join(' ')}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Botao
              type="button"
              variante="secundario"
              larguraTotal
              texto="Cancelar"
              onClick={() => setModalContaAberto(false)}
            />
            <Botao
              type="submit"
              variante="primario"
              larguraTotal
              carregando={salvandoConta}
              texto="Salvar Conta"
            />
          </div>
        </form>
      </Modal>

      {/* ====================================================================
          MODAL: CRIAR / EDITAR FORMA DE PAGAMENTO
      ==================================================================== */}
      <Modal
        aberto={modalFormaAberto}
        aoFechar={() => setModalFormaAberto(false)}
        titulo={
          formaEditando ? 'Editar Forma de Pagamento' : 'Nova Forma de Pagamento'
        }
      >
        <form onSubmit={salvarForma} className="flex flex-col gap-4 min-w-0">
          <Campo
            rotulo="Nome da forma de pagamento"
            value={formaNome}
            onChange={(e) => setFormaNome(e.target.value)}
            placeholder="Ex.: Maquininha Débito, Pix, Online (app)..."
            required
          />

          <div className="flex flex-col gap-1.5 min-w-0">
            <label
              htmlFor="select-conta-padrao"
              className="text-xs sm:text-sm font-medium text-[#F5F5F7] truncate"
            >
              Conta de destino padrão (onde o dinheiro cai)
            </label>
            <select
              id="select-conta-padrao"
              value={formaContaId}
              onChange={(e) => setFormaContaId(e.target.value)}
              className="w-full min-h-[48px] px-3.5 bg-[#0B0B0D] border border-[#262630] rounded-xl text-[#F5F5F7] text-sm focus:outline-none focus:ring-2 focus:ring-[#FF7A1A]/50"
            >
              <option value="">Escolher na hora do lançamento</option>
              {contasAtivas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.type === 'cash' ? 'Dinheiro' : 'Banco'})
                </option>
              ))}
            </select>
          </div>

          <Campo
            rotulo="Taxa descontada (%)"
            value={formaTaxaTexto}
            onChange={(e) => setFormaTaxaTexto(e.target.value)}
            placeholder="Ex.: 3,49 ou 0"
            inputMode="decimal"
            dica="Use vírgula ou ponto para decimais (ex.: 1,99 ou 3,49)"
          />

          <div className="p-3 rounded-xl bg-[#0B0B0D] border border-[#262630] flex items-center justify-between gap-2 min-w-0">
            <span className="text-xs text-[#9A9AA6] truncate">
              Simulação em R$ 100,00 brutos:
            </span>
            <div className="text-right shrink-0">
              <span className="text-[11px] text-[#9A9AA6] block">
                Cai líquido na conta:
              </span>
              <ValorMoeda
                centavos={liquidoPreviewCents}
                tamanho="sm"
                cor="positivo"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Botao
              type="button"
              variante="secundario"
              larguraTotal
              texto="Cancelar"
              onClick={() => setModalFormaAberto(false)}
            />
            <Botao
              type="submit"
              variante="primario"
              larguraTotal
              carregando={salvandoForma}
              texto="Salvar Forma"
            />
          </div>
        </form>
      </Modal>

      {/* ====================================================================
          MODAL: CRIAR / EDITAR CATEGORIA DE SAÍDA
      ==================================================================== */}
      <Modal
        aberto={modalCatAberto}
        aoFechar={() => setModalCatAberto(false)}
        titulo={catEditando ? 'Editar Categoria' : 'Nova Categoria de Saída'}
      >
        <form onSubmit={salvarCategoria} className="flex flex-col gap-4 min-w-0">
          <Campo
            rotulo="Nome da categoria"
            value={catNome}
            onChange={(e) => setCatNome(e.target.value)}
            placeholder="Ex.: Abastecimento, Pedágio..."
            required
          />

          <div className="flex flex-col gap-1.5 min-w-0">
            <span className="text-xs sm:text-sm font-medium text-[#F5F5F7]">
              Ícone
            </span>
            <div className="grid grid-cols-4 gap-2">
              {CATEGORY_ICONS_LIST.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCatIcone(item.id)}
                  className={[
                    'min-h-[48px] p-2 rounded-xl border flex flex-col items-center justify-center gap-1 text-[10px] transition-all min-w-0 overflow-hidden',
                    catIcone === item.id
                      ? 'bg-[#FF7A1A]/20 border-[#FF7A1A] text-white font-bold'
                      : 'bg-[#0B0B0D] border-[#262630] text-[#9A9AA6]',
                  ].join(' ')}
                >
                  <CategoryIcon name={item.id} className="w-4 h-4 shrink-0" />
                  <span className="truncate w-full text-center">{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5 min-w-0">
            <span className="text-xs sm:text-sm font-medium text-[#F5F5F7]">
              Cor da categoria
            </span>
            <div className="flex flex-wrap gap-2">
              {PALETA_CORES.map((c) => (
                <button
                  key={c.valor}
                  type="button"
                  onClick={() => setCatCor(c.valor)}
                  title={c.nome}
                  style={{ backgroundColor: c.valor }}
                  className={[
                    'w-9 h-9 rounded-xl transition-transform',
                    catCor === c.valor
                      ? 'ring-2 ring-white scale-110'
                      : 'opacity-70 hover:opacity-100',
                  ].join(' ')}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Botao
              type="button"
              variante="secundario"
              larguraTotal
              texto="Cancelar"
              onClick={() => setModalCatAberto(false)}
            />
            <Botao
              type="submit"
              variante="primario"
              larguraTotal
              carregando={salvandoCat}
              texto="Salvar Categoria"
            />
          </div>
        </form>
      </Modal>

      {/* ====================================================================
          MODAL: CRIAR / EDITAR FONTE DE RENDA OU APORTE (Fase 3B)
      ==================================================================== */}
      <Modal
        aberto={modalFonteAberto}
        aoFechar={() => setModalFonteAberto(false)}
        titulo={
          fonteEditando ? 'Editar Fonte de Renda' : 'Nova Fonte de Renda / Aporte'
        }
      >
        <form onSubmit={salvarFonte} className="flex flex-col gap-4 min-w-0">
          <Campo
            rotulo="Nome da fonte"
            value={fonteNome}
            onChange={(e) => setFonteNome(e.target.value)}
            placeholder="Ex.: Venda 3D — Shopee, Corridas (99), Aporte..."
            required
          />

          {/* Chave Conta como Ganho vs Aporte */}
          <div className="p-3 rounded-xl bg-[#0B0B0D] border border-[#262630] space-y-2 min-w-0">
            <span className="text-xs font-bold text-white block">
              Como esta entrada deve ser contabilizada?
            </span>
            <div className="grid grid-cols-2 gap-2 min-w-0">
              <button
                type="button"
                onClick={() => setFonteContaComoGanho(true)}
                className={[
                  'min-h-[44px] px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all truncate',
                  fonteContaComoGanho
                    ? 'bg-[#2EE59D]/20 border-[#2EE59D] text-[#2EE59D]'
                    : 'bg-[#141418] border-[#262630] text-[#9A9AA6]',
                ].join(' ')}
              >
                Conta como Ganho
              </button>
              <button
                type="button"
                onClick={() => setFonteContaComoGanho(false)}
                className={[
                  'min-h-[44px] px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all truncate',
                  !fonteContaComoGanho
                    ? 'bg-[#06B6D4]/20 border-[#06B6D4] text-[#06B6D4]'
                    : 'bg-[#141418] border-[#262630] text-[#9A9AA6]',
                ].join(' ')}
              >
                É um Aporte
              </button>
            </div>
            <p className="text-[11px] text-[#9A9AA6]">
              {fonteContaComoGanho
                ? 'Soma no saldo da conta e também entra nos seus relatórios e metas de ganho.'
                : 'Aporte: soma no saldo da conta, mas NÃO entra nos totais de ganho do dia/mês.'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
            <div className="flex flex-col gap-1.5 min-w-0">
              <label className="text-xs font-medium text-[#F5F5F7] truncate">
                Forma de pagamento padrão
              </label>
              <select
                value={fonteFormaId}
                onChange={(e) => {
                  const novoPmId = e.target.value;
                  setFonteFormaId(novoPmId);
                  const pm = formasAtivas.find((f) => f.id === novoPmId);
                  if (pm?.default_account_id) {
                    setFonteContaId(pm.default_account_id);
                  }
                }}
                className="w-full min-h-[44px] px-3 bg-[#0B0B0D] border border-[#262630] rounded-xl text-xs sm:text-sm text-white"
              >
                <option value="">Escolher na hora</option>
                {formasAtivas.map((pm) => (
                  <option key={pm.id} value={pm.id}>
                    {pm.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5 min-w-0">
              <label className="text-xs font-medium text-[#F5F5F7] truncate">
                Conta de destino padrão
              </label>
              <select
                value={fonteContaId}
                onChange={(e) => setFonteContaId(e.target.value)}
                className="w-full min-h-[44px] px-3 bg-[#0B0B0D] border border-[#262630] rounded-xl text-xs sm:text-sm text-white"
              >
                <option value="">Escolher na hora</option>
                {contasAtivas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 min-w-0">
            <span className="text-xs sm:text-sm font-medium text-[#F5F5F7]">
              Ícone da fonte
            </span>
            <div className="grid grid-cols-4 gap-2">
              {CATEGORY_ICONS_LIST.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFonteIcone(item.id)}
                  className={[
                    'min-h-[48px] p-2 rounded-xl border flex flex-col items-center justify-center gap-1 text-[10px] transition-all min-w-0 overflow-hidden',
                    fonteIcone === item.id
                      ? 'bg-[#FF7A1A]/20 border-[#FF7A1A] text-white font-bold'
                      : 'bg-[#0B0B0D] border-[#262630] text-[#9A9AA6]',
                  ].join(' ')}
                >
                  <CategoryIcon name={item.id} className="w-4 h-4 shrink-0" />
                  <span className="truncate w-full text-center">{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5 min-w-0">
            <span className="text-xs sm:text-sm font-medium text-[#F5F5F7]">
              Cor da etiqueta
            </span>
            <div className="flex flex-wrap gap-2">
              {PALETA_CORES.map((c) => (
                <button
                  key={c.valor}
                  type="button"
                  onClick={() => setFonteCor(c.valor)}
                  title={c.nome}
                  style={{ backgroundColor: c.valor }}
                  className={[
                    'w-9 h-9 rounded-xl transition-transform',
                    fonteCor === c.valor
                      ? 'ring-2 ring-white scale-110'
                      : 'opacity-70 hover:opacity-100',
                  ].join(' ')}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Botao
              type="button"
              variante="secundario"
              larguraTotal
              texto="Cancelar"
              onClick={() => setModalFonteAberto(false)}
            />
            <Botao
              type="submit"
              variante="primario"
              larguraTotal
              carregando={salvandoFonte}
              texto="Salvar Fonte"
            />
          </div>
        </form>
      </Modal>

      {/* ====================================================================
          MODAL: CONFIRMAÇÃO PARA ABRIR / FECHAR CADASTRO (ADMIN)
      ==================================================================== */}
      <Modal
        aberto={modalConfirmarCadastro}
        aoFechar={() => setModalConfirmarCadastro(false)}
        titulo={
          configApp.signup_open
            ? 'Fechar novos cadastros?'
            : 'Reabrir novos cadastros?'
        }
      >
        <div className="flex flex-col gap-4 min-w-0">
          <p className="text-xs sm:text-sm text-[#9A9AA6] leading-relaxed">
            {configApp.signup_open
              ? 'Ao fechar o cadastro, o botão "Criar conta" desaparecerá da tela de login e o banco de dados recusará qualquer nova inscrição até você reabrir.'
              : 'Ao reabrir o cadastro, novos usuários poderão solicitar acesso (e continuarão caindo na fila "Aguardando aprovação" até você aprovar).'}
          </p>

          <div className="flex gap-2">
            <Botao
              type="button"
              variante="secundario"
              larguraTotal
              texto="Cancelar"
              onClick={() => setModalConfirmarCadastro(false)}
            />
            <Botao
              type="button"
              variante={configApp.signup_open ? 'perigo' : 'sucesso'}
              larguraTotal
              carregando={alterandoCadastro}
              texto={
                configApp.signup_open
                  ? 'Sim, fechar agora'
                  : 'Sim, abrir cadastro'
              }
              onClick={confirmarAlternarCadastro}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

