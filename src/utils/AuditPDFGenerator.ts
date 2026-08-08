import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '../lib/supabase';

// Helper for type-safe autotable extension
const addAutoTable = (doc: any, options: any) => {
  autoTable(doc, options);
};

export async function generateAuditPDF(auditId: string) {
  try {
    // 1. Buscar dados do Supabase
    const { data: runData } = await supabase.from('audit_runs').select('*').eq('audit_id', auditId).single();
    const { data: events } = await supabase.from('audit_events').select('*').eq('audit_id', auditId).order('sequence_number', { ascending: true });
    const { data: evaluations } = await supabase.from('audit_asset_evaluations').select('*').eq('audit_id', auditId).order('rank_position', { ascending: true });
    const { data: syncs } = await supabase.from('audit_sync').select('*').eq('audit_id', auditId);
    const { data: results } = await supabase.from('audit_results').select('*').eq('audit_id', auditId).order('final_rank', { ascending: true });

    if (!runData) throw new Error('Dados de auditoria não encontrados.');

    // 2. Inicializar PDF
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    
    // CAPA
    doc.setFontSize(22);
    doc.text('Relatório de Auditoria', pageWidth / 2, 40, { align: 'center' });
    doc.setFontSize(14);
    doc.text('SmartMoney Tracker AI', pageWidth / 2, 50, { align: 'center' });
    
    doc.setFontSize(10);
    doc.text(`ID da Execução: ${auditId}`, 20, 80);
    doc.text(`Data/Hora: ${new Date(runData.execution_date).toLocaleString()}`, 20, 90);
    doc.text(`Estratégia: ${runData.strategy} (v${runData.strategy_version})`, 20, 100);
    doc.text(`Modo de Análise: ${runData.analysis_mode}`, 20, 110);
    doc.text(`Pool Alvo: ${runData.pool_size}`, 20, 120);
    doc.text(`Recomendações Solicitadas: ${runData.recommendation_count}`, 20, 130);
    doc.text(`Tempo Alvo: ${runData.target_period_value} ${runData.target_period_unit}`, 20, 140);
    
    // RESUMO EXECUTIVO
    doc.addPage();
    doc.setFontSize(16);
    doc.text('1. RESUMO EXECUTIVO', 14, 20);
    doc.setFontSize(10);
    
    const execTimeSec = runData.total_execution_time_ms ? (runData.total_execution_time_ms / 1000).toFixed(2) : 'N/A';
    doc.text(`Universo Avaliado Inicialmente: ${evaluations?.length || 0} ações`, 14, 30);
    doc.text(`Ações Selecionadas para Sincronização: ${syncs?.length || 0}`, 14, 40);
    doc.text(`Recomendações Finais Geradas: ${results?.length || 0}`, 14, 50);
    doc.text(`Tempo Total de Execução: ${execTimeSec} segundos`, 14, 60);
    doc.text(`Tokens Utilizados (IA): ${runData.total_tokens || 0}`, 14, 70);

    // PROCESSO DE SELEÇÃO E RANKING
    doc.addPage();
    doc.setFontSize(16);
    doc.text('2. AVALIAÇÃO DO UNIVERSO', 14, 20);
    doc.setFontSize(10);
    doc.text('Scores individuais de cada ativo avaliado:', 14, 30);

    if (evaluations && evaluations.length > 0) {
      const evalData = evaluations.map(e => [
        e.ticker,
        e.composite_score,
        e.drop_score,
        e.volume_score,
        e.fundamentals_score,
        e.support_score,
        e.status
      ]);
      addAutoTable(doc, {
        startY: 35,
        head: [['Ticker', 'Score Final', 'Queda', 'Volume', 'Fundamentos', 'Suporte', 'Status']],
        body: evalData,
        theme: 'striped',
        styles: { fontSize: 8 }
      });
    }

    // DESCARTADAS
    doc.addPage();
    doc.setFontSize(16);
    doc.text('3. MOTIVOS DE DESCARTE', 14, 20);
    if (evaluations) {
      const rejected = evaluations.filter(e => e.status !== 'SELECIONADA');
      const rejectedData = rejected.map(e => [e.ticker, e.composite_score, e.rejection_reason]);
      addAutoTable(doc, {
        startY: 30,
        head: [['Ticker', 'Score', 'Motivo do Descarte']],
        body: rejectedData,
        theme: 'striped',
        styles: { fontSize: 8 }
      });
    }

    // SINCRONIZAÇÃO
    doc.addPage();
    doc.setFontSize(16);
    doc.text('4. SINCRONIZAÇÃO DE DADOS', 14, 20);
    if (syncs) {
      const syncData = syncs.map(s => [s.ticker, s.sync_status, s.source, s.records_added, s.error_message || 'OK']);
      addAutoTable(doc, {
        startY: 30,
        head: [['Ticker', 'Status', 'Fonte', 'Adicionados', 'Obs']],
        body: syncData,
        theme: 'striped',
        styles: { fontSize: 8 }
      });
    }

    // RESULTADOS FINAIS
    doc.addPage();
    doc.setFontSize(16);
    doc.text('5. RECOMENDAÇÕES FINAIS', 14, 20);
    if (results) {
      results.forEach((r, idx) => {
        const yStart = 30 + (idx * 60);
        if (yStart > 250) {
          doc.addPage();
        }
        const currentY = yStart > 250 ? 30 : yStart;
        
        doc.setFontSize(12);
        doc.text(`${r.final_rank}. ${r.ticker} - Score: ${r.strategy_score}`, 14, currentY);
        doc.setFontSize(9);
        doc.text(`Preço Analisado: ${r.analyzed_price} | Alvo: ${r.target_price} | Stop: ${r.stop_loss}`, 14, currentY + 7);
        doc.text(`Probabilidade: ${r.success_probability}% | Risco/Retorno: 1:${r.risk_reward_ratio}`, 14, currentY + 14);
        
        const lines = doc.splitTextToSize(r.analysis_text || '', pageWidth - 28);
        doc.text(lines, 14, currentY + 21);
      });
    }

    // LINHA DO TEMPO
    doc.addPage();
    doc.setFontSize(16);
    doc.text('6. LINHA DO TEMPO DA EXECUÇÃO', 14, 20);
    if (events) {
      const eventData = events.map(e => [
        `#${e.sequence_number.toString().padStart(3, '0')}`,
        new Date(e.event_timestamp).toLocaleTimeString(),
        e.stage,
        e.ticker,
        e.description
      ]);
      addAutoTable(doc, {
        startY: 30,
        head: [['Nº', 'Hora', 'Etapa', 'Ticker', 'Descrição']],
        body: eventData,
        theme: 'plain',
        styles: { fontSize: 8 }
      });
    }

    // Salvar PDF
    doc.save(`Auditoria_${auditId}.pdf`);

  } catch (err: any) {
    console.error('Erro ao gerar PDF da auditoria', err);
    alert('Não foi possível gerar o PDF da auditoria: ' + err.message);
  }
}
