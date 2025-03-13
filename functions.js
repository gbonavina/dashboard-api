import axios from 'axios';
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

async function getStockData_Daily(ticker, start, end) {
    const finz_ticker = ticker.replace(/\.sao/i, "").toLowerCase();
    let tipo_ativo = detectarTipoAtivo(finz_ticker);
    const API_URL_FINZ = `https://finz-api-evlu.onrender.com/${tipo_ativo}/${finz_ticker}`;

    let dados_quant = null;

    try {
        const response = await axios.get(API_URL_FINZ);

        if (Object.keys(response.data).length === 0) {
            console.error("⚠️ Erro: Nenhuma data encontrada na API Finz.");
            return null;
        }

        let dataKeys = Object.keys(response.data);
        let ativos = Object.keys(response.data[dataKeys[0]]);
        let tickerCorreto = ativos.find(t => t.toLowerCase() === finz_ticker.toLowerCase());

        if (!tickerCorreto) {
            console.error("⚠️ Erro: Ativo não encontrado na API Finz.");
            return null;
        }

        let raw_dados_quant = response.data[dataKeys[0]][tickerCorreto];

        dados_quant = Object.keys(raw_dados_quant).reduce((acc, key) => {
            let newKey = key
                .toLowerCase()
                .replace('ç', 'c')
                .replace('ã', 'a')
                .replace(/[^a-z0-9]/g, "_");

            let value = raw_dados_quant[key];

            if (typeof value === "string" && value.match(/^\d+,\d+$/)) {
                value = parseFloat(value.replace(",", ".").trim());
            }

            acc[newKey] = value;
            return acc;
        }, {});

    } catch (error) {
        console.error("Erro ao buscar dados na API Finz:", error);
        return null;
    }

    const API_URL_AV = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${ticker}.SAO&apikey=${API_KEY}`;
    
    try {
        const response = await axios.get(API_URL_AV, { 
            timeout: 15000,
            headers: { "User-Agent": "Mozilla/5.0" }
        });

        console.log("Resposta da Alpha Vantage:", response.data);
        
        if (!response.data || response.data["Error Message"]) {
            console.error("Erro na API Alpha Vantage:", response.data);
            return null;
        }

        const data = response.data["Time Series (Daily)"];
        let stockPrices = Object.keys(data).map(date => ({
            date: date,
            open: parseFloat(data[date]["1. open"]),
            high: parseFloat(data[date]["2. high"]),
            low: parseFloat(data[date]["3. low"]),
            close: parseFloat(data[date]["4. close"]),
            volume: parseFloat(data[date]["5. volume"])
        }));

        // ✅ Agora, sempre retorna TODOS os dados dentro do intervalo
        if (start && end) {
            stockPrices = stockPrices.filter(stock => {
                const stockDate = new Date(stock.date);
                return stockDate >= new Date(start) && stockDate <= new Date(end);
            });
        }

        if (dados_quant) {
            stockPrices[0] = { ...stockPrices[0], ...dados_quant };
        } else {
            console.warn("⚠️ Aviso: Nenhum dado encontrado na API Finz para esse ativo.");
        }

        if (stockPrices.length === 0) {
            console.error("⚠️ Erro: Nenhum dado encontrado dentro do período solicitado.");
            return null;
        }

        return stockPrices;

    } catch (error) {
        console.error("❌ Erro ao buscar dados da Alpha Vantage:", error);
        return null;
    }
}


async function getStockData_Daily_CACHED(ticker, start, end) {
    // Gera uma chave única para cada combinação de ticker, start e end
    const cacheKey = `stockData_Daily_${ticker}_${start || "null"}_${end || "null"}`;
    const cachedData = cache.get(cacheKey);

    if (cachedData) {
        console.log(`📦 Dados encontrados em cache para ${ticker} (${start} - ${end})`);
        return cachedData;
    }

    console.log(`🔄 Buscando novos dados para ${ticker} (${start} - ${end})`);
    const stockData = await getStockData_Daily(ticker, start, end);

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
