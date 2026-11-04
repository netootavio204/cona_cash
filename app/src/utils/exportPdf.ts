import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { FinancialReportData, Transaction } from '../types/database';
import { formatCentsToBRL, formatDateTimeBR } from '../utils/format';
import { APP_NAME, APP_VERSION } from '../config/version';

export interface ExportReportPDFOptions {
  periodoLabel: string;
  dataInicioBR: string;
  dataFimBR: string;
  report: FinancialReportData;
  transacoes: Transaction[];
  nomeUsuario: string;
  fonteSelecionadaNome?: string;
}

export async function exportReportToPDF({
  periodoLabel,
  dataInicioBR,
  dataFimBR,
  report,
  transacoes,
  nomeUsuario,
  fonteSelecionadaNome,
}: ExportReportPDFOptions): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // 1. CABEÇALHO COM TÍTULO E LOGO OFICIAL
  doc.setFillColor(11, 11, 13);
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setTextColor(255, 122, 26);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(APP_NAME, 14, 13);

  doc.setTextColor(245, 245, 247);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Relatório Financeiro & Desempenho por Fonte de Renda', 14, 20);

  doc.setFontSize(8);
  doc.setTextColor(154, 154, 166);
  doc.text(`Gerado por: ${nomeUsuario} • ${APP_VERSION}`, pageWidth - 14, 13, { align: 'right' });
  doc.text(`Período: ${periodoLabel} (${dataInicioBR} a ${dataFimBR})`, pageWidth - 14, 20, { align: 'right' });

  let currentY = 36;

  if (fonteSelecionadaNome) {
    doc.setFontSize(9);
    doc.setTextColor(255, 122, 26);
    doc.text(`Filtrado exclusivamente pela Fonte: ${fonteSelecionadaNome}`, 14, currentY);
    currentY += 6;
  }

  // 2. RESUMO EXECUTIVO (TABELA DE KPIS)
  const totals = report.totals;
  const kpiData = [
    ['Ganhos Brutos', formatCentsToBRL(totals.gross_earnings_cents)],
    ['Taxas de Meios de Pagamento', `− ${formatCentsToBRL(totals.fees_cents)}`],
    ['Ganhos Líquidos Reais', formatCentsToBRL(totals.net_earnings_cents)],
    ['Saídas / Custos Totais', `− ${formatCentsToBRL(totals.expenses_cents)}`],
    ['Resultado Líquido do Período', formatCentsToBRL(totals.net_result_cents)],
    ['Aportes Realizados (À parte)', formatCentsToBRL(totals.contributions_cents)],
  ];

  autoTable(doc, {
    startY: currentY,
    head: [['Indicador Financeiro', 'Valor Total (R$)']],
    body: kpiData,
    theme: 'grid',
    headStyles: {
      fillColor: [255, 122, 26],
      textColor: [11, 11, 13],
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: [30, 30, 35],
    },
    columnStyles: {
      0: { cellWidth: 110 },
      1: { cellWidth: 'auto', halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: 14, right: 14 },
  });

  currentY = (doc as any).lastAutoTable.finalY + 10;

  // 3. QUEBRA POR FONTE DE RENDA E LUCRO POR FONTE
  if (report.by_source.length > 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 20, 25);
    doc.text('1. Desempenho e Lucro Líquido por Fonte de Renda', 14, currentY);
    currentY += 4;

    const sourceRows = report.by_source.map((s) => [
      s.source_name + (!s.counts_as_earning ? ' (Aporte)' : ''),
      formatCentsToBRL(s.earnings_net_cents),
      formatCentsToBRL(s.direct_expenses_cents),
      formatCentsToBRL(s.profit_cents),
      String(s.count),
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['Fonte de Renda', 'Ganhos Líq.', 'Custos Diretos', 'Lucro Real', 'Qtd']],
      body: sourceRows,
      theme: 'striped',
      headStyles: {
        fillColor: [38, 38, 48],
        textColor: [255, 255, 255],
        fontSize: 8.5,
      },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 70 },
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right', fontStyle: 'bold' },
        4: { halign: 'center' },
      },
      margin: { left: 14, right: 14 },
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;
  }

  // 4. QUEBRA POR CATEGORIA DE SAÍDA
  if (report.by_category.length > 0) {
    if (currentY > pageHeight - 50) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 20, 25);
    doc.text('2. Despesas por Categoria', 14, currentY);
    currentY += 4;

    const catRows = report.by_category.map((c) => [
      c.category_name,
      formatCentsToBRL(c.total_cents),
      String(c.count),
      `${((c.total_cents / Math.max(1, report.totals.expenses_cents)) * 100).toFixed(1)}%`,
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['Categoria', 'Total Gasto', 'Lançamentos', '% do Total']],
      body: catRows,
      theme: 'striped',
      headStyles: {
        fillColor: [38, 38, 48],
        textColor: [255, 255, 255],
        fontSize: 8.5,
      },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { halign: 'right', fontStyle: 'bold' },
        2: { halign: 'center' },
        3: { halign: 'right' },
      },
      margin: { left: 14, right: 14 },
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;
  }

  // 5. LISTA DE LANÇAMENTOS DO PERÍODO
  if (transacoes && transacoes.length > 0) {
    doc.addPage();
    currentY = 20;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 20, 25);
    doc.text(`3. Extrato Completo de Lançamentos (${transacoes.length} registros)`, 14, currentY);
    currentY += 4;

    const txRows = transacoes.map((t) => {
      const tipoLabel =
        t.kind === 'income' ? 'Entrada' : t.kind === 'expense' ? 'Saída' : 'Transferência';
      return [
        formatDateTimeBR(t.occurred_at),
        tipoLabel,
        t.note || '—',
        formatCentsToBRL(t.gross_cents),
        formatCentsToBRL(t.net_cents),
      ];
    });

    autoTable(doc, {
      startY: currentY,
      head: [['Data / Hora', 'Tipo', 'Observação / Tags', 'Bruto', 'Líquido']],
      body: txRows,
      theme: 'plain',
      headStyles: {
        fillColor: [240, 240, 245],
        textColor: [20, 20, 25],
        fontSize: 8,
        fontStyle: 'bold',
      },
      bodyStyles: { fontSize: 7.5, textColor: [40, 40, 45] },
      columnStyles: {
        0: { cellWidth: 32 },
        1: { cellWidth: 24 },
        2: { cellWidth: 'auto' },
        3: { cellWidth: 26, halign: 'right' },
        4: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
      },
      margin: { left: 14, right: 14 },
    });
  }

  // Paginação no rodapé de todas as páginas
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(150, 150, 155);
    doc.text(
      `Página ${i} de ${totalPages} • Cona Cash ${APP_VERSION} • Documento gerado em ${new Date().toLocaleDateString('pt-BR')}`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' }
    );
  }

  doc.save(`Cona_Cash_Relatorio_${periodoLabel.replace(/\s+/g, '_')}.pdf`);
}

