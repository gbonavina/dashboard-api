import express from 'express';
import { getStockData_Weekly_CACHED, getStockData_Daily_CACHED, validateData, detectarTipoAtivo } from './functions.js';

const app = express();
const port = process.env.PORT || 5000; 

import cors from "cors";
app.use(cors({
  origin: "http://localhost:3000",
  methods: "GET,POST,PUT,DELETE", 
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

// endpoint para pegar o historico diário de uma ação
app.get("/stock/daily/:ticker", async (req, res) => {
    const { ticker } = req.params;
    const { start, end } = req.query;

    if (!validateData(ticker)) {
        return res.status(400).json({ error: "Ticker inválido." });
    }

    try {
        const stockData = await getStockData_Daily_CACHED(ticker, start, end);
        console.log(stockData);

        if (!stockData) { 
            return res.status(404).json({ error: "Dados não encontrados." });
        }
        return res.json(stockData);
    } catch {
        console.error("Erro ao buscar dados.");
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
