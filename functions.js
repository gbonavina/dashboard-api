import axios from 'axios';
import yahooFinance from "yahoo-finance2";
import NodeCache from 'node-cache';
import dotenv from 'dotenv';
dotenv.config();

const cache = new NodeCache({stdTTL: 3600});
const API_KEY = process.env.API_KEY;
console.log("API_KEY utilizada:", API_KEY);

async function getStockData_Weekly(ticker) {
    const API_URL_AV = `https://www.alphavantage.co/query?function=TIME_SERIES_WEEKLY_ADJUSTED&symbol=${ticker}.SAO&apikey=${API_KEY}`;

    try {
        const response = await axios.get(API_URL_AV, { timeout: 15000 });
        console.log("Resposta completa da Alpha Vantage:", response.data);

        if (response.data["Note"]) {
            console.error("Aviso da Alpha Vantage:", response.data["Note"]);
            return null;
        }

        if (!response.data["Weekly Adjusted Time Series"]) {
            console.error("Erro: Dados históricos não encontrados.");
            return null;
        }

        const data = response.data["Weekly Adjusted Time Series"];
        const stockPrices = Object.keys(data).map(date => ({
            date: date,
            open: parseFloat(data[date]["1. open"]),
            high: parseFloat(data[date]["2. high"]),
            low: parseFloat(data[date]["3. low"]),
            close: parseFloat(data[date]["4. close"]),
            adjusted_close: parseFloat(data[date]["5. adjusted close"]),
            volume: parseFloat(data[date]["6. volume"]),
            dividend: parseFloat(data[date]["7. dividend amount"])
        }));

        return stockPrices;
    } catch (error) { 
        console.error("Erro ao buscar dados:", error);
        return null;
    }
}


async function getStockData_Weekly_CACHED(ticker) {
    // implementaçao de cache
    const cacheKey = `stockData_Weekly_${ticker}`;
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
        console.log("Dados encontrados em cache");
        return cachedData;
    }
    else {
        const stockData = await getStockData_Weekly(ticker);

        if (stockData) {
            cache.set(cacheKey, stockData);
        }
        return stockData;
    }

}

async function getStockData_Daily(ticker, anos = 5) {
    try {
        console.log(`🔍 Buscando dados do Yahoo Finance para ${ticker} (${anos} anos)...`);

        // 📌 Define o intervalo com base nos anos passados como parâmetro
        const hoje = new Date();
        const dataInicio = new Date();
        dataInicio.setFullYear(hoje.getFullYear() - anos);

        // 📌 Formata a data para o padrão exigido pelo Yahoo Finance (YYYY-MM-DD)
        const dataInicioFormatada = dataInicio.toISOString().split("T")[0];

        // 🔄 Faz a requisição para a API do Yahoo Finance
        const result = await yahooFinance.chart(`${ticker}.SA`, {
            interval: "1d",  // 🎯 Dados diários
            range: `${anos}y`,  // 🕒 Últimos X anos
        });

        // 🛠 Verifica se recebeu resposta válida
        if (!result || !result.timestamp || result.timestamp.length === 0) {
            console.error("⚠️ Erro: Nenhum dado retornado pelo Yahoo Finance.");
            return null;
        }

        // 📊 Processa os dados retornados
        const stockPrices = result.timestamp.map((timestamp, index) => ({
            date: new Date(timestamp * 1000).toISOString().split("T")[0], // Converte timestamp para YYYY-MM-DD
            open: result.indicators.quote[0].open[index],
            high: result.indicators.quote[0].high[index],
            low: result.indicators.quote[0].low[index],
            close: result.indicators.quote[0].close[index],
            volume: result.indicators.quote[0].volume[index],
        }));

        // 🛠 Filtra apenas os dados a partir da data de início
        const dadosFiltrados = stockPrices.filter(dado => dado.date >= dataInicioFormatada);

        console.log("📊 Dados filtrados prontos:", dadosFiltrados);
        return dadosFiltrados;
    } catch (error) {
        console.error("❌ Erro ao buscar dados do Yahoo Finance:", error);
        return null;
    }
}

// 📦 Implementação de cache
import NodeCache from 'node-cache';
const cache = new NodeCache({ stdTTL: 3600 });

async function getStockData_Daily_CACHED(ticker, anos = 5) {
    const cacheKey = `stockData_Daily_${ticker}_${anos}anos`;
    const cachedData = cache.get(cacheKey);

    if (cachedData) {
        console.log(`📦 Dados encontrados em cache para ${ticker} (${anos} anos)`);
        return cachedData;
    }

    console.log(`🔄 Buscando novos dados para ${ticker} (${anos} anos)`);
    const stockData = await getStockData_Daily(ticker, anos);

    if (stockData) {
        cache.set(cacheKey, stockData);
    }

    return stockData;
}

function validateData(ticker) {
    if (!ticker) {
        console.error("Erro: Ticker não informado.");
        return false;
    }

    const REGEX = /^[A-Za-z0-9\.]+$/;

    return typeof ticker === 'string' && ticker.trim() !== '' && REGEX.test(ticker);
}

function detectarTipoAtivo(ticker) {
    const units = new Set(["BPAC11", "KLBN11", "SANB11", "IGTI11", "TAEE11", "ENGI11", "SAPR11", "ALUP11", "BRBI11", "DASA11", "AMAR11", "AZEV11", "RNEW11",
        "BIOM11", "PPLA11", "PINE11", "PSVM11"]);

    ticker = ticker.toUpperCase();

    // Ações normais (4 letras + 1 número)
    if (/^[A-Za-z]{4}\d$/.test(ticker)) {
        // console.log("acoes");
        return "acoes";
    }

    // Se termina em 11, pode ser uma Unit ou um FII
    if (/^[A-Za-z]{3,4}11$/.test(ticker)) {
        return units.has(ticker) ? "acoes" : "fiis";
    }

    return "desconhecido";
}

export { getStockData_Weekly_CACHED, getStockData_Daily_CACHED, validateData, detectarTipoAtivo };

// getStockData_Daily("BBAS3.SAO", "24-02-2025", "06-03-2025");
