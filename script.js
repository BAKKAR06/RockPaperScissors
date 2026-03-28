import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@6.13.1/dist/ethers.min.js";

let provider = null;
let signer = null;
let contract = null;
let currentAccount = "";

const contractAddress = "0xd9256601b9b9E6a0D52620360E85935c3A7713a2";

const contractABI = [
  {
    "inputs": [],
    "name": "deposit",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint8",
        "name": "choice",
        "type": "uint8"
      }
    ],
    "name": "playGame",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "player",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint8",
        "name": "playerChoice",
        "type": "uint8"
      },
      {
        "indexed": false,
        "internalType": "uint8",
        "name": "computerChoice",
        "type": "uint8"
      },
      {
        "indexed": false,
        "internalType": "bool",
        "name": "isWinner",
        "type": "bool"
      },
      {
        "indexed": false,
        "internalType": "bool",
        "name": "isDraw",
        "type": "bool"
      }
    ],
    "name": "GamePlayed",
    "type": "event"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "newPrice",
        "type": "uint256"
      }
    ],
    "name": "setGamePrice",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "withdraw",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "stateMutability": "payable",
    "type": "receive"
  },
  {
    "inputs": [],
    "name": "gamePrice",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getBalance",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "owner",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

function setStatus(message) {
  document.getElementById("status").innerText = message;
}

function setResult(message, color = "#f8fafc") {
  const resultElement = document.getElementById("result");
  resultElement.innerText = message;
  resultElement.style.color = color;
}

function shortAddress(address) {
  if (!address) return "Неизвестно";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function choiceToText(choice) {
  const value = Number(choice);
  if (value === 0) return "Камень";
  if (value === 1) return "Ножницы";
  if (value === 2) return "Бумага";
  return "Неизвестно";
}

async function init() {
  if (!window.ethereum) {
    setStatus("MetaMask не найден");
    setResult("Установите MetaMask для работы приложения", "#f87171");
    return false;
  }

  try {
    provider = new ethers.BrowserProvider(window.ethereum);
    const accounts = await provider.send("eth_requestAccounts", []);
    signer = await provider.getSigner();
    contract = new ethers.Contract(contractAddress, contractABI, signer);

    currentAccount = accounts[0];
    document.getElementById("walletAddress").innerText = shortAddress(currentAccount);

    setStatus("Кошелёк подключен");
    await loadContractInfo();

    return true;
  } catch (error) {
    console.error("Ошибка подключения:", error);
    setStatus("Ошибка подключения");
    setResult("Не удалось подключить MetaMask", "#f87171");
    return false;
  }
}

async function loadContractInfo() {
  if (!contract) return;

  try {
    const price = await contract.gamePrice();
    const balance = await contract.getBalance();

    document.getElementById("gamePrice").innerText = `${ethers.formatEther(price)} ETH`;
    document.getElementById("contractBalance").innerText = `${ethers.formatEther(balance)} ETH`;
  } catch (error) {
    console.error("Ошибка получения данных контракта:", error);
    document.getElementById("gamePrice").innerText = "Ошибка";
    document.getElementById("contractBalance").innerText = "Ошибка";
  }
}

async function connectWallet() {
  await init();
}

async function play(choice) {
  if (!contract) {
    const ok = await init();
    if (!ok) return;
  }

  try {
    setStatus("Подготовка транзакции...");
    setResult(`Ваш выбор: ${choiceToText(choice)}. Ожидание подтверждения...`, "#facc15");

    const gamePrice = await contract.gamePrice();

    const tx = await contract.playGame(choice, {
      value: gamePrice
    });

    setStatus("Транзакция отправлена. Ожидание подтверждения...");
    await tx.wait();

    setStatus("Игра завершена");
    setResult("Транзакция подтверждена. Нажмите «Получить результат»", "#38bdf8");

    await loadContractInfo();
  } catch (error) {
    console.error("Ошибка playGame:", error);
    setStatus("Ошибка транзакции");
    setResult("Не удалось выполнить игру. Проверьте сеть, адрес контракта и баланс.", "#f87171");
  }
}

async function getGameResult() {
  if (!contract || !provider) {
    const ok = await init();
    if (!ok) return;
  }

  try {
    setStatus("Получение результата из блокчейна...");

    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 5000);

    const events = await contract.queryFilter("GamePlayed", fromBlock, currentBlock);

    if (events.length === 0) {
      setStatus("События не найдены");
      setResult("События GamePlayed не найдены", "#f87171");
      return;
    }

    let userEvent = null;

    for (let i = events.length - 1; i >= 0; i--) {
      const event = events[i];
      if (
        event.args &&
        event.args.player &&
        event.args.player.toLowerCase() === currentAccount.toLowerCase()
      ) {
        userEvent = event;
        break;
      }
    }

    if (!userEvent) {
      setStatus("Нет события для текущего пользователя");
      setResult("Для вашего кошелька результат не найден", "#f87171");
      return;
    }

    const player = userEvent.args.player.toString();
    const playerChoice = userEvent.args.playerChoice.toString();
    const computerChoice = userEvent.args.computerChoice.toString();
    const isWinner = userEvent.args.isWinner;
    const isDraw = userEvent.args.isDraw;

    let message = "";

    if (isDraw) {
      message =
        `Игрок: ${shortAddress(player)} | ` +
        `Ваш выбор: ${choiceToText(playerChoice)} | ` +
        `Выбор компьютера: ${choiceToText(computerChoice)} | ` +
        `Результат: Ничья 🤝`;

      setResult(message, "#facc15");
    } else if (isWinner) {
      message =
        `Игрок: ${shortAddress(player)} | ` +
        `Ваш выбор: ${choiceToText(playerChoice)} | ` +
        `Выбор компьютера: ${choiceToText(computerChoice)} | ` +
        `Результат: Победа 🎉`;

      setResult(message, "#4ade80");
    } else {
      message =
        `Игрок: ${shortAddress(player)} | ` +
        `Ваш выбор: ${choiceToText(playerChoice)} | ` +
        `Выбор компьютера: ${choiceToText(computerChoice)} | ` +
        `Результат: Поражение 😔`;

      setResult(message, "#f87171");
    }

    setStatus("Результат успешно получен");
    console.log(message);
  } catch (error) {
    console.error("Ошибка получения результата:", error);
    setStatus("Ошибка чтения события");
    setResult("Не удалось прочитать событие GamePlayed", "#f87171");
  }
}

async function startApp() {
  document.getElementById("connectWallet").addEventListener("click", connectWallet);
  document.getElementById("refreshInfo").addEventListener("click", loadContractInfo);
  document.getElementById("getResult").addEventListener("click", getGameResult);

  document.getElementById("btnRock").addEventListener("click", async () => {
    await play(0);
  });

  document.getElementById("btnScissors").addEventListener("click", async () => {
    await play(1);
  });

  document.getElementById("btnPaper").addEventListener("click", async () => {
    await play(2);
  });

  await init();
}

startApp();