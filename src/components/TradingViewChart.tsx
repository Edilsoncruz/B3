const TV_TEMPLATE =
  'https://s.tradingview.com/widgetembed/?symbol={symbol}&interval=D&hidesidetoolbar=1&symboledit=1&saveimage=1&toolbarbg=f1f3f6&studies=%5B%5D&theme=dark&style=1&timezone=America%2FSao_Paulo&studies_overrides=%7B%7D&overrides=%7B%7D&wordwrap=1&matchtext=1&title=1&width=100%25&height=100%25';

export function TradingViewChart({ ticker, height = 300 }: { ticker: string; height?: number }) {
  const tvSymbol = /^[A-Z]{4}[0-9]$/.test(ticker) ? 'BMFBOVESPA:' + ticker : ticker;
  const src = TV_TEMPLATE.replace('{symbol}', encodeURIComponent(tvSymbol));

  return (
    <div
      className="w-full rounded-xl overflow-hidden border border-outline-variant bg-surface-container-low"
      style={{ height }}
    >
      <iframe
        key={tvSymbol}
        src={src}
        width="100%"
        height="100%"
        frameBorder="0"
        scrolling="no"
        allow="fullscreen"
        title={'Gráfico ' + ticker}
      />
    </div>
  );
}
