// functions.js
import axios from 'axios';
import yahooFinance from "yahoo-finance2";
import NodeCache from 'node-cache';
import dotenv from 'dotenv';
dotenv.config();

const cache = new NodeCache({ stdTTL: 3600 });
const API_KEY = process.env.API_KEY;
console.log("API_KEY utilizada:", API_KEY);

/**
 * Busca os dados diários do ativo via Yahoo Finance para os últimos `anos` (padrão 5).
 * Retorna um array de objetos ordenados por data (do mais antigo para o mais recente).
 */
async function getStockData_Daily(ticker, anos = 5) {
    try {
        console.log(`🔍 Buscando dados do Yahoo Finance para ${ticker} (${anos} anos)...`);

        // Converte o ticker para maiúsculas e concatena ".SA" para ações brasileiras
        const tickerYahoo = `${ticker.toUpperCase()}.SA`;

        // Faz a requisição para o Yahoo Finance
        const result = await yahooFinance.chart(tickerYahoo, {
            interval: "1d",    // Dados diários
            range: `${anos}y`,  // Últimos anos (ex: "5y")
        });

        // Verifica se a resposta é válida
        if (!result || !result.timestamp || result.timestamp.length === 0) {
            console.error("⚠️ Erro: Nenhum dado retornado pelo Yahoo Finance.");
            return null;
        }

        // Processa os dados retornados
        const stockPrices = result.timestamp.map((timestamp, index) => ({
            date: new Date(timestamp * 1000).toISOString().split("T")[0],
            open: result.indicators.quote[0].open[index],
            high: result.indicators.quote[0].high[index],
            low: result.indicators.quote[0].low[index],
            close: result.indicators.quote[0].close[index],
            volume: result.indicators.quote[0].volume[index],
        }));

        // Filtra dados a partir da data de início calculada (opcional, pois o range já limita)
        const hoje = new Date();
        const dataInicio = new Date();
        dataInicio.setFullYear(hoje.getFullYear() - anos);
        const dataInicioFormatada = dataInicio.toISOString().split("T")[0];
        const dadosFiltrados = stockPrices.filter(dado => dado.date >= dataInicioFormatada);

        console.log("📊 Dados filtrados prontos:", dadosFiltrados);
        return dadosFiltrados;
    } catch (error) {
        console.error("❌ Erro ao buscar dados do Yahoo Finance:", error);
        return null;
    }
}


/**
 * Versão cacheada da função getStockData_Daily.
 */
async function getStockData_Daily_CACHED(ticker, anos = 5) {
  const cacheKey = `stockData_Daily_${ticker}_${anos}anos`;
  const cachedData = cache.get(cacheKey);
  if (cachedData) {
    console.log(`📦 Dados diários encontrados em cache para ${ticker} (${anos} anos)`);
    return cachedData;
  }
  console.log(`🔄 Buscando novos dados diários para ${ticker} (${anos} anos)`);
  const stockData = await getStockData_Daily(ticker, anos);
  if (stockData) {
    cache.set(cacheKey, stockData);
  }
  return stockData;
}

/**
 * Busca o último valor do ativo usando a API Finz.
 * Essa função utiliza Finz apenas para retornar os dados de last_value.
 */
async function getStockLastValue(ticker) {
  const finz_ticker = ticker.replace(/\.sao/i, "").toLowerCase();
  const tipo_ativo = detectarTipoAtivo(finz_ticker);
  const API_URL_FINZ = `https://finz-api-evlu.onrender.com/${tipo_ativo}/${finz_ticker}`;

  try {
    const response = await axios.get(API_URL_FINZ);

    if (Object.keys(response.data).length === 0) {
      console.error("⚠️ Erro: Nenhuma data encontrada na API Finz.");
      return null;
    }

    // Supondo que a API Finz retorne um objeto onde a primeira chave possui os dados.
    const dataKeys = Object.keys(response.data);
    const ativos = Object.keys(response.data[dataKeys[0]]);
    const tickerCorreto = ativos.find(t => t.toLowerCase() === finz_ticker.toLowerCase());

    if (!tickerCorreto) {
      console.error("⚠️ Erro: Ativo não encontrado na API Finz.");
      return null;
    }

    const raw_dados_quant = response.data[dataKeys[0]][tickerCorreto];

    // Processa os dados (ex.: "cotacao": "R$ 27,05" → converte para número).
    const dados_quant = Object.keys(raw_dados_quant).reduce((acc, key) => {
      const newKey = key.toLowerCase().replace('ç', 'c').replace('ã', 'a').replace(/[^a-z0-9]/g, "_");
      let value = raw_dados_quant[key];
      if (typeof value === "string" && value.match(/^\d+,\d+$/)) {
        value = parseFloat(value.replace(",", ".").trim());
      }
      acc[newKey] = value;
      return acc;
    }, {});

    console.log("📊 Dados de last_value da API Finz:", dados_quant);
    return dados_quant;
  } catch (error) {
    console.error("❌ Erro ao buscar dados na API Finz:", error);
    return null;
  }
}

/**
 * Versão cacheada para o último valor.
 */
async function getStockLastValue_CACHED(ticker) {
  const cacheKey = `stockLastValue_${ticker}`;
  const cachedData = cache.get(cacheKey);
  if (cachedData) {
    console.log(`📦 Dados de last_value encontrados em cache para ${ticker}`);
    return cachedData;
  }
  console.log(`🔄 Buscando novos dados de last_value para ${ticker}`);
  const lastValue = await getStockLastValue(ticker);
  if (lastValue) {
    cache.set(cacheKey, lastValue);
  }
  return lastValue;
}

/**
 * Valida o ticker.
 */
function validateData(ticker) {
  if (!ticker) {
    console.error("Erro: Ticker não informado.");
    return false;
  }
  const REGEX = /^[A-Za-z0-9\.]+$/;
  return typeof ticker === 'string' && ticker.trim() !== '' && REGEX.test(ticker);
}

/**
 * Detecta o tipo de ativo (ações, FIIs, etc.).
 */
function detectarTipoAtivo(ticker) {
  const units = new Set(["BPAC11", "KLBN11", "SANB11", "IGTI11", "TAEE11", "ENGI11", "SAPR11", "ALUP11", "BRBI11", "DASA11", "AMAR11", "AZEV11", "RNEW11",
    "BIOM11", "PPLA11", "PINE11", "PSVM11"]);
  ticker = ticker.toUpperCase();
  // Ações normais (4 letras + 1 número)
  if (/^[A-Za-z]{4}\d$/.test(ticker)) {
    return "acoes";
  }
  // Se termina em 11, pode ser uma Unit ou um FII
  if (/^[A-Za-z]{3,4}11$/.test(ticker)) {
    return units.has(ticker) ? "acoes" : "fiis";
  }
  return "desconhecido";
}

export { 
  getStockData_Daily_CACHED, 
  getStockLastValue_CACHED, 
  validateData, 
  detectarTipoAtivo 
};
