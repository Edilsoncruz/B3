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

    // DEEP AI - RECOMENDAÇÕES E REJEIÇÕES
    doc.addPage();
    doc.setFontSize(16);
    doc.text('5. DEEP AI (TERRA) - DIAGNÓSTICO', 14, 20);
    
    if (results) {
      const approved = results.filter(r => r.status === 'APPROVED' || r.status === 'SELECIONADA' || !r.status);
      const rejected = results.filter(r => r.status === 'REJECTED');
      
      doc.setFontSize(12);
      doc.text(`Aprovadas: ${approved.length} | Rejeitadas: ${rejected.length}`, 14, 30);
      
      let currentY = 40;
      
      // Aprovadas
      if (approved.length > 0) {
        doc.setFontSize(14);
        doc.text('Aprovadas:', 14, currentY);
        currentY += 10;
        
        approved.forEach((r, idx) => {
          if (currentY > 250) { doc.addPage(); currentY = 30; }
          doc.setFontSize(10);
          doc.text(`[APROVADA] ${r.ticker} - Score: ${r.strategy_score}`, 14, currentY);
          doc.setFontSize(8);
          doc.text(`Alvo: ${r.target_price} | Stop: ${r.stop_loss} | R:R 1:${r.risk_reward_ratio} | Prob: ${r.success_probability}%`, 14, currentY + 5);
          doc.text(`Tempo Est: ${r.estimated_timeframe} | Data Est: ${r.estimated_target_date}`, 14, currentY + 10);
          currentY += 18;
        });
      }
      
      // Rejeitadas
      if (rejected.length > 0) {
        if (currentY > 230) { doc.addPage(); currentY = 30; }
        doc.setFontSize(14);
        doc.text('Rejeitadas na Deep AI:', 14, currentY);
        currentY += 10;
        
        rejected.forEach((r) => {
          if (currentY > 250) { doc.addPage(); currentY = 30; }
          doc.setFontSize(10);
          doc.text(`[REJEITADA] ${r.ticker} - Score: ${r.strategy_score}`, 14, currentY);
          doc.setFontSize(8);
          doc.text(`Alvo: ${r.target_price} | Stop: ${r.stop_loss} | R:R 1:${r.risk_reward_ratio} | Prob: ${r.success_probability}%`, 14, currentY + 5);
          doc.text(`Tempo Est: ${r.estimated_timeframe} | Data Est: ${r.estimated_target_date}`, 14, currentY + 10);
          doc.setTextColor(220, 53, 69); // Vermelho
          doc.text(`Motivo(s): ${r.rejection_reason || 'Desconhecido'}`, 14, currentY + 15);
          doc.setTextColor(0, 0, 0); // Volta pro preto
          currentY += 23;
        });
      }
    }

    // TABELA DE FUNIL DIAGNÓSTICO
    doc.addPage();
    doc.setFontSize(16);
    doc.text('6. FUNIL DE ANÁLISE (DIAGNÓSTICO)', 14, 20);
    
    let initialCount = 0;
    let l1Eligible = 0;
    let l2Selected = 0;
    
    const l1Event = events?.find(e => e.stage === 'LAYER_1' && e.action === 'FILTERS_APPLIED');
    if (l1Event && l1Event.metadata) {
      initialCount = l1Event.metadata.total || 0;
      l1Eligible = initialCount - (l1Event.metadata.eliminated?.length || 0);
    }
    
    const l2Event = events?.find(e => e.stage === 'LAYER_2' && e.action === 'TRIAGE_COMPLETED');
    if (l2Event && l2Event.metadata && l2Event.metadata.ranking) {
      l2Selected = l2Event.metadata.ranking.length;
    } else if (evaluations) {
      l2Selected = evaluations.length;
    }
    
    const deepApproved = results?.filter(r => r.status === 'APPROVED' || r.status === 'SELECIONADA' || !r.status).length || 0;
    
    const funnelData = [
      ['Universo Inicial', initialCount.toString(), '—', '—', 'Base total'],
      ['Layer 1 (Determinística)', initialCount.toString(), (initialCount - l1Eligible).toString(), l1Eligible.toString(), 'Regras de preço/liquidez'],
      ['Layer 2 (Luna - Triagem)', l1Eligible.toString(), (l1Eligible - l2Selected).toString(), l2Selected.toString(), 'Filtro por score/técnica'],
      ['Layer 3 (Terra - Deep AI)', l2Selected.toString(), (l2Selected - deepApproved).toString(), deepApproved.toString(), 'Validação de alvo/horizonte/R:R']
    ];
    
    addAutoTable(doc, {
      startY: 30,
      head: [['Etapa', 'Entraram', 'Saíram (Eliminadas)', 'Aprovadas', 'Filtro Principal']],
      body: funnelData,
      theme: 'grid',
      styles: { fontSize: 9 }
    });

    // LINHA DO TEMPO
    doc.addPage();
    doc.setFontSize(16);
    doc.text('7. LINHA DO TEMPO DA EXECUÇÃO', 14, 20);
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
