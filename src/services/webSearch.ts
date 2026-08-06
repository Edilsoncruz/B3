// Retorna as últimas manchetes de um ticker buscando no Google News via Proxy Público CORS
export async function fetchRecentNews(ticker: string): Promise<string> {
  const query = encodeURIComponent(`${ticker} ações mercado financeiro brasil`);
  const rssUrl = `https://news.google.com/rss/search?q=${query}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;
  const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(rssUrl)}`;
  
  try {
    const response = await fetch(proxyUrl);
    if (!response.ok) return "Erro ao buscar notícias";
    
    const data = await response.json();
    const xml = data.contents;
    
    // Parse básico do XML do RSS (como estamos no browser, usamos DOMParser)
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xml, "text/xml");
    
    const items = xmlDoc.querySelectorAll("item");
    const headlines: string[] = [];
    
    for (let i = 0; i < Math.min(items.length, 5); i++) {
      const title = items[i].querySelector("title")?.textContent;
      const pubDate = items[i].querySelector("pubDate")?.textContent;
      if (title) headlines.push(`- ${pubDate ? pubDate.substring(0, 16) + ': ' : ''}${title}`);
    }
    
    return headlines.length > 0 
      ? headlines.join('\n')
      : "Nenhuma notícia recente encontrada.";
      
  } catch (error) {
    console.error(`Erro buscando notícias para ${ticker}:`, error);
    return "Falha na conexão com servidor de notícias.";
  }
}
