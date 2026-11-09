/**
 * Serviço de agendamento de notificações locais para o APK Android (PRD 4.3B, Fase 9)
 * Agenda lembretes locais para os próximos 30 dias. No navegador/PWA faz fallback silencioso.
 */

import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import type { InstallmentWithPurchase } from '../types/database';
import { formatCentsToBRL } from '../utils/format';

export async function requestNotificationPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;

  try {
    const status = await LocalNotifications.checkPermissions();
    if (status.display === 'granted') return true;

    const req = await LocalNotifications.requestPermissions();
    return req.display === 'granted';
  } catch (err) {
    console.warn('Erro ao solicitar permissão de notificações:', err);
    return false;
  }
}

/**
 * Reagenda as notificações dos próximos 30 dias baseado nas parcelas pendentes
 */
export async function scheduleInstallmentNotifications(
  installments?: InstallmentWithPurchase[],
  enabled = true,
  alertTime = '09:00',
  daysBefore = 1
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  if (!enabled) {
    try {
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length > 0) {
        await LocalNotifications.cancel({ notifications: pending.notifications });
      }
    } catch (e) {
      // Ignora erro
    }
    return;
  }

  const hasPerm = await requestNotificationPermission();
  if (!hasPerm) return;

  try {
    let items = installments;
    if (!items) {
      const { fetchInstallments } = await import('../api/supabase');
      items = await fetchInstallments({ status: 'pending' }).catch(() => []);
    }

    // 1. Limpa agendamentos anteriores
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({ notifications: pending.notifications });
    }

    const [hourStr, minStr] = alertTime.split(':');
    const alertHour = parseInt(hourStr || '9', 10);
    const alertMinute = parseInt(minStr || '0', 10);

    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const toSchedule: any[] = [];
    let notifIdCounter = 1000;

    for (const inst of items) {
      if (inst.status === 'paid') continue;

      const [y, m, d] = inst.due_date.split('-').map(Number);
      const dueDate = new Date(y, m - 1, d, alertHour, alertMinute, 0);

      // Lembrete no dia do vencimento
      if (dueDate > now && dueDate <= in30Days) {
        toSchedule.push({
          id: notifIdCounter++,
          title: 'Conta vence hoje! ⏰',
          body: `${inst.purchase?.title || 'Parcela'} vence hoje: ${formatCentsToBRL(inst.amount_cents)}`,
          schedule: { at: dueDate },
          extra: { installmentId: inst.id },
        });
      }

      // Lembrete de antecedência (ex: 1 dia antes)
      if (daysBefore > 0) {
        const beforeDate = new Date(dueDate.getTime() - daysBefore * 24 * 60 * 60 * 1000);
        if (beforeDate > now && beforeDate <= in30Days) {
          toSchedule.push({
            id: notifIdCounter++,
            title: `Conta vence em ${daysBefore} dia(s) 📅`,
            body: `${inst.purchase?.title || 'Parcela'}: ${formatCentsToBRL(inst.amount_cents)} vence dia ${d.toString().padStart(2, '0')}/${m.toString().padStart(2, '0')}`,
            schedule: { at: beforeDate },
            extra: { installmentId: inst.id },
          });
        }
      }
    }

    // Limite do Android para agendamento em lote seguro (máx 64)
    const limited = toSchedule.slice(0, 50);
    if (limited.length > 0) {
      await LocalNotifications.schedule({ notifications: limited });
    }
  } catch (err) {
    console.warn('Erro ao agendar notificações locais:', err);
  }
}
