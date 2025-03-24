import express from 'express';
import { 
  getStockLastValue_CACHED, 
  getStockData_Daily_CACHED, 
  validateData, 
  detectarTipoAtivo 
} from './functions.js';
import cors from "cors";

const app = express();
const port = process.env.PORT || 5000; 

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*"); 
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

app.use(express.json());

app.get("/", (req, res) => {
    res.send("Bem vindo à API de dados de ações!");
});

// Endpoint para pegar o histórico diário de uma ação (Yahoo Finance)
// Permite escolher entre os últimos 5 ou 10 anos via query string (?anos=5 ou ?anos=10)
app.get("/stock/daily/:ticker", async (req, res) => {
    const { ticker } = req.params;
    const anos = req.query.anos ? parseInt(req.query.anos) : 5; // Padrão: 5 anos

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

// Endpoint para pegar o último valor de uma ação (retorna o registro mais recente dos dados diários)
app.get("/stock/last_value/:ticker", async (req, res) => { 
  const { ticker } = req.params;

  if (!validateData(ticker)) {
      return res.status(400).json({ error: "Ticker inválido." });
  }

  try {
      const lastValue = await getStockLastValue_CACHED(ticker);
      if (!lastValue) {
          return res.status(404).json({ error: "Dados não encontrados." });
      } else {
          return res.json(lastValue);
      }
  } catch (error) {
      console.error("Erro ao buscar dados.", error);
      return res.status(503).json({ error: "Erro ao buscar dados." });
  }
});


app.listen(port, () => {
    console.log(`API de dados de ações rodando em http://localhost:${port}`);
});
