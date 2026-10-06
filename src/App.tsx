/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Component, ErrorInfo, ReactNode } from "react";
import { Dashboard } from "./components/Dashboard";
import { AlertCircle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  autoRecoveries: number;
}

/** Número máximo de remontagens automáticas antes de exibir a tela de erro. */
const MAX_AUTO_RECOVERIES = 2;

/**
 * Erros de DOM disparados pelo React quando algo FORA dele alterou a árvore
 * (tradutor automático do navegador, extensões de tradução, manipulação manual).
 * São transitórios: remontar a árvore faz o React reconstruir as referências.
 */
function isTransientDomError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "NotFoundError") return true;
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /insertBefore|removeChild|appendChild|replaceChild|not a child of this node|NotFoundError/i.test(message);
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    autoRecoveries: 0
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);

    // Falha de reconciliação de DOM não deve derrubar a aplicação inteira:
    // reagenda uma remontagem limpa em vez de exigir reload manual.
    if (isTransientDomError(error) && this.state.autoRecoveries < MAX_AUTO_RECOVERIES) {
      setTimeout(() => {
        this.setState(prev => ({
          hasError: false,
          error: null,
          autoRecoveries: prev.autoRecoveries + 1
        }));
      }, 60);
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      const isDomError = isTransientDomError(this.state.error);

      return (
        <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6 text-center">
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 max-w-lg space-y-4">
            <div className="w-12 h-12 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white mb-1">Ocorreu um erro inesperado</h2>
              <p className="text-xs text-red-300/80 font-mono">
                {this.state.error?.message || "Erro desconhecido na renderização."}
              </p>
              {isDomError && (
                <p className="text-[11px] text-amber-300/80 mt-3 leading-relaxed">
                  Este erro é típico de tradução automática da página (Google Translate / extensões)
                  ou de alguma extensão do navegador que altera o DOM. Desative a tradução desta
                  página (ou use uma janela anônima) e tente novamente.
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={this.handleRetry}
                className="px-4 py-2 rounded-lg bg-emerald-500 text-black font-bold text-xs flex items-center gap-2 hover:bg-emerald-400 cursor-pointer shadow"
              >
                <RefreshCw className="w-4 h-4" /> Tentar Novamente
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-lg bg-white text-black font-bold text-xs flex items-center gap-2 hover:bg-gray-200 cursor-pointer shadow"
              >
                <RefreshCw className="w-4 h-4" /> Recarregar Aplicação
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <Dashboard />
    </ErrorBoundary>
  );
}
