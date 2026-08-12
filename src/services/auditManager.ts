import { supabase } from '../lib/supabase';
import { SelectionParameters } from './universeSelector';

export interface AuditRunContext {
  auditId: string;
  isAuditMode: boolean;
  sequenceNumber: number;
}

export class AuditManager {
  private auditId: string;
  private isAuditMode: boolean;
  private sequenceNumber: number = 0;

  constructor(isAuditMode: boolean) {
    this.isAuditMode = isAuditMode;
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
    const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '');
    const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    this.auditId = `AUD-${dateStr}-${timeStr}-${randomSuffix}`;
  }

  public getContext(): AuditRunContext {
    return {
      auditId: this.auditId,
      isAuditMode: this.isAuditMode,
      sequenceNumber: this.sequenceNumber
    };
  }

  public isEnabled(): boolean {
    return this.isAuditMode;
  }

  public getAuditId(): string {
    return this.auditId;
  }

  private nextSequence(): number {
    this.sequenceNumber += 1;
    return this.sequenceNumber;
  }

  public async startRun(params: {
    strategy: string;
    strategyVersion: string;
    analysisMode: string;
    poolSize: number;
    recommendationCount: number;
    targetPeriodValue: number;
    targetPeriodUnit: string;
    selectionParams: SelectionParameters;
  }) {
    if (!this.isAuditMode) return;
    try {
      await supabase.from('audit_runs').insert({
        audit_id: this.auditId,
        strategy: params.strategy,
        strategy_version: params.strategyVersion,
        analysis_mode: params.analysisMode,
        pool_size: params.poolSize,
        recommendation_count: params.recommendationCount,
        target_period_value: params.targetPeriodValue,
        target_period_unit: params.targetPeriodUnit,
        selection_params: params.selectionParams,
      });
      await this.logEvent('SYSTEM', 'START', 'ALL', 'Início da Execução da Auditoria', 0);
    } catch (err) {
      console.error('[AuditManager] Error starting run:', err);
    }
  }

  public async logEvent(
    stage: string,
    eventType: string,
    ticker: string,
    description: string,
    durationMs: number = 0,
    metadata: any = {}
  ) {
    if (!this.isAuditMode) return;
    try {
      await supabase.from('audit_events').insert({
        audit_id: this.auditId,
        sequence_number: this.nextSequence(),
        stage,
        event_type: eventType,
        ticker,
        description,
        duration_ms: durationMs,
        metadata
      });
    } catch (err) {
      console.error('[AuditManager] Error logging event:', err);
    }
  }

  public async logAssetEvaluations(evaluations: any[]) {
    if (!this.isAuditMode) return;
    try {
      const records = evaluations.map((e, index) => ({
        audit_id: this.auditId,
        ticker: e.ticker,
        rank_position: index + 1,
        composite_score: e.score,
        status: e.status || (e.elegivel_para_analise_profunda ? 'ELEGIBLE' : 'REJECTED'),
        rejection_reason: e.motivo_selecao || null,
        metadata: {
          criterios_selecionados: e.criterios_selecionados,
          motivo_selecao: e.motivo_selecao,
          nivel_confianca: e.nivel_de_confianca
        }
      }));
      
      // Batch insert in chunks if needed (Supabase has limit around 1000)
      for (let i = 0; i < records.length; i += 500) {
        await supabase.from('audit_asset_evaluations').insert(records.slice(i, i + 500));
      }
    } catch (err) {
      console.error('[AuditManager] Error logging asset evaluations:', err);
    }
  }

  public async logSync(syncData: any) {
    if (!this.isAuditMode) return;
    try {
      await supabase.from('audit_sync').insert({
        audit_id: this.auditId,
        ticker: syncData.ticker,
        sync_status: syncData.status,
        last_available_date: syncData.lastAvailableDate,
        target_date: syncData.targetDate,
        missing_period_start: syncData.missingPeriodStart,
        missing_period_end: syncData.missingPeriodEnd,
        records_found: syncData.recordsFound || 0,
        records_added: syncData.recordsAdded || 0,
        source: syncData.source,
        error_message: syncData.errorMessage,
        duration_ms: syncData.durationMs || 0
      });
    } catch (err) {
      console.error('[AuditManager] Error logging sync:', err);
    }
  }

  public async logResults(results: any[]) {
    if (!this.isAuditMode) return;
    try {
      const records = results.map((r, index) => ({
        audit_id: this.auditId,
        ticker: r.ticker,
        final_rank: index + 1,
        analyzed_price: r.current_price || r.entry_price,
        target_price: r.target_price,
        stop_loss: r.stop_loss,
        success_probability: r.success_probability,
        strategy_score: r.strategy_score,
        risk_reward_ratio: r.risk_reward_ratio,
        estimated_timeframe: r.estimated_timeframe,
        estimated_target_date: r.estimated_target_date,
        approved_criteria: r.approved_criteria || [],
        rejected_criteria: r.rejected_criteria || [],
        analysis_text: r.analysis,
        status: r.status || (r.action === 'REJECT' ? 'REJECTED' : 'SELECIONADA'),
        rejection_reason: r.rejection_reasons ? r.rejection_reasons.join(" | ") : (r.reason || null)
      }));
      
      for (let i = 0; i < records.length; i += 100) {
        await supabase.from('audit_results').insert(records.slice(i, i + 100));
      }
    } catch (err) {
      console.error('[AuditManager] Error logging results:', err);
    }
  }

  public async finishRun(metrics: {
    totalExecutionTimeMs: number;
    totalTokens: number;
    promptTokens: number;
    responseTokens: number;
  }) {
    if (!this.isAuditMode) return;
    try {
      await supabase.from('audit_runs').update({
        total_execution_time_ms: metrics.totalExecutionTimeMs,
        total_tokens: metrics.totalTokens,
        total_prompt_tokens: metrics.promptTokens,
        total_response_tokens: metrics.responseTokens
      }).eq('audit_id', this.auditId);
      
      await this.logEvent('SYSTEM', 'END', 'ALL', 'Análise Concluída', 0);
    } catch (err) {
      console.error('[AuditManager] Error finishing run:', err);
    }
  }
}
