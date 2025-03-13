import express from 'express';
import { getStockData_Weekly_CACHED, getStockData_Daily_CACHED, validateData, detectarTipoAtivo } from './functions.js';

const app = express();
const port = process.env.PORT || 5000; 

import cors from "cors";
app.use(cors({
    origin: "*", // 🔥 Permite qualquer frontend (só para testar!)
    methods: "GET,POST,OPTIONS",
    allowedHeaders: "Content-Type,Authorization"
}));

app.listen(port, () => {
    console.log(`API de dados de ações rodando em http://localhost:${port}`);
});

app.use(express.json());

app.get("/", (req, res) => {
    res.send("Bem vindo a API de dados de ações!");
});

// endpoint para pegar o histórico semanal de uma ação
app.get("/stock/weekly/:ticker", async (req, res) => {
    const { ticker } = req.params;

    if (!validateData(ticker)) {
        return res.status(400).json({ error: "Ticker inválido." });
    }

    try {
        const stockData = await getStockData_Weekly_CACHED(ticker);
        // if (!stockData) { 
        //     return res.status(404).json({ error: "Dados não encontrados." });
        // }
        return res.json(stockData);
    } catch {
        console.error("Erro ao buscar dados.");
        return res.status(503).json({ error: "Erro ao buscar dados." });
    }

});

app.get("/stock/daily/:ticker", async (req, res) => {
    const { ticker } = req.params;
    const anos = req.query.anos ? parseInt(req.query.anos) : 5; // 📌 Padrão: 5 anos

    if (!validateData(ticker)) {
        return res.status(400).json({ error: "Ticker inválido." });
    }

    if (![5, 10].includes(anos)) {
        return res.status(400).json({ error: "O parâmetro 'anos' deve ser 5 ou 10." });
    }

    try {
        console.log(`🔄 Buscando dados de ${ticker} para os últimos ${anos} anos...`);
        const stockData = await getStockData_Daily_CACHED(ticker, anos);

        if (!stockData || stockData.length === 0) { 
            return res.status(404).json({ error: "Dados não encontrados." });
        }

        return res.json(stockData);
    } catch (error) {
        console.error("❌ Erro ao buscar dados:", error);
        return res.status(503).json({ error: "Erro ao buscar dados." });
    }
});

// endpoint para pegar o histórico do dia de uma ação
app.get("/stock/last_value/:ticker", async (req, res) => { 
    const { ticker } = req.params;

    if (!validateData(ticker)) {
        return res.status(400).json({error: "Ticker inválido."})
    }

    try {
        const stockData = await getStockData_Daily_CACHED(ticker);
        if(!stockData) {
            return res.status(404).json({error: "Dados não encontrados."})
        }
        else {
            return res.json(stockData[0]);
        }
    } catch {
        console.error("Erro ao buscar dados.")
        return res.status(503).json({error: "Erro ao buscar dados."})
    }
});
