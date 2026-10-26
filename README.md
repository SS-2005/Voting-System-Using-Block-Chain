# Decentralized Blockchain Voting System
> **A complete, beginner-friendly Ethereum DApp tailored for college mini-projects & viva demonstrations.**

![Solidity](https://img.shields.io/badge/Solidity-^0.8.20-363636?logo=solidity)
![Hardhat](https://img.shields.io/badge/Hardhat-2.22.0-yellow?logo=ethereum)
![Ethers.js](https://img.shields.io/badge/Ethers.js-v6-blue)
![Frontend](https://img.shields.io/badge/Frontend-HTML5%20%2F%20CSS3%20%2F%20Vanilla%20JS-orange)
![License](https://img.shields.io/badge/License-MIT-green)

---

## Quick Re-Run Guide (Whenever You Re-Open the Project)

If you already installed the dependencies once and just want to run the project again:

1. **Terminal 1 (Start Blockchain):**
   ```bash
   npx hardhat node
   ```
2. **Terminal 2 (Deploy Contract & Launch Frontend):**
   ```bash
   npx hardhat run scripts/deploy.js --network localhost
   npm run frontend
   ```
3. Open **[http://localhost:3000](http://localhost:3000)** in your browser.
4. **MetaMask Notice:** In MetaMask &rarr; **Settings** &rarr; **Advanced** &rarr; Click **"Clear activity and nonce data"** (clears old transaction history from previous sessions so transactions don't get stuck).

---

## 1. Project Overview & Architecture

This project is a decentralized voting application (DApp) built using an Ethereum smart contract and a clean, responsive frontend. It simulates an election lifecycle where an **Administrator** manages candidates and whitelists eligible voter wallet addresses, while **Authorized Voters** securely cast single votes via MetaMask.

```
       +---------------------------------------------+
       |             Browser / MetaMask              |
       |  (HTML5, CSS3, Vanilla JS, Ethers.js v6)    |
       +---------------------+-----------------------+
                             | JSON-RPC (HTTP)
                             v
       +---------------------------------------------+
       |           Hardhat Local Blockchain          |
       |               (Chain ID: 31337)             |
       +---------------------+-----------------------+
                             |
                             v
       +---------------------------------------------+
       |             Voting.sol Contract             |
       |  - Access Control (onlyAdmin)               |
       |  - Election Lifecycle (NotStarted->Ongoing  |
       |    ->Ended)                                 |
       |  - Voter Whitelisting & Single Vote Guard   |
       |  - Direct On-Chain Result Counting          |
       +---------------------+-----------------------+
```

---

## 2. Technology Stack

- **Smart Contract:** Solidity (`^0.8.20`)
- **Blockchain Framework:** Hardhat
- **Local Blockchain Network:** Hardhat Node (`http://127.0.0.1:8545`, Chain ID `31337`)
- **Web3 Integration:** Ethers.js (v6)
- **Frontend:** Vanilla HTML5, CSS3, and JavaScript (No heavy frameworks or build tools needed)
- **Wallet Provider:** MetaMask Browser Extension
- **Testing:** Mocha, Chai, Hardhat Toolbox

---

## 3. Project Directory Structure

```
blockchain-voting/
├── contracts/
│   └── Voting.sol             # Solidity smart contract with lifecycle & access rules
├── scripts/
│   └── deploy.js              # Deployment script: deploys contract & syncs frontend ABI/address
├── test/
│   └── Voting.js              # Comprehensive automated test suite (25 test cases)
├── frontend/
│   ├── index.html             # Clean, responsive user interface
│   ├── style.css              # Dark-mode styling, responsive grid, status badges
│   ├── app.js                 # MetaMask & Ethers.js client interaction logic
│   ├── contract-data.js       # Auto-generated contract address & ABI (window globals)
│   └── contract-info.json     # Auto-generated JSON reference for contract details
├── hardhat.config.js          # Hardhat configuration (Solidity 0.8.20 & localhost)
├── package.json               # Project scripts and dependencies
├── .gitignore                 # Standard node, cache, and artifact ignores
├── LICENSE                    # MIT License
└── README.md                  # Comprehensive setup, execution & viva guide
```

---

## 4. Smart Contract Functions & Election Lifecycle

The contract (`Voting.sol`) manages a 3-stage election lifecycle:
1. **`NotStarted` (Stage 0):** Administrator registers candidates (minimum 2 candidates required). Administrator registers eligible voter wallet addresses. Voting is blocked.
2. **`Ongoing` (Stage 1):** Started by Administrator. Candidate registration is permanently locked. Registered voters can cast exactly 1 vote.
3. **`Ended` (Stage 2):** Concluded by Administrator. Voting is permanently disabled. Final results are locked and publicly verifiable.

### Contract API Summary

| Function | Access | Required State | Description |
|---|---|---|---|
| `addCandidate(string name, string description)` | Admin only | `NotStarted` | Registers a new candidate. |
| `registerVoter(address voter)` | Admin only | `NotStarted` or `Ongoing` | Whitelists a voter address. Rejects duplicates. |
| `startElection()` | Admin only | `NotStarted` | Begins voting (requires &ge; 2 candidates). |
| `endElection()` | Admin only | `Ongoing` | Closes voting permanently. |
| `vote(uint256 candidateId)` | Registered Voter | `Ongoing` | Records 1 vote; prevents double voting. |
| `getCandidates()` | Public (View) | Any | Returns list of all candidates and vote counts. |
| `getVoterStatus(address voter)` | Public (View) | Any | Returns `(isRegistered, hasVoted, votedCandidateId)`. |
| `getResults()` | Public (View) | Any | Returns candidates array, total votes, and current state. |

---

## 5. Step-by-Step Installation & Execution Guide

Follow these instructions in order using separate terminal windows.

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [MetaMask](https://metamask.io/) extension installed in your web browser (Chrome, Brave, Edge, or Firefox)

---

### Step 1: Install Dependencies
Open a terminal in the project directory:
```bash
npm install
```

---

### Step 2: Run the Automated Smart Contract Tests
Verify all 25 test cases pass:
```bash
npx hardhat test
```
*Expected result: 25 passing tests covering candidate addition, voter registration, state transitions, double-voting prevention, unauthorized wallet rejection, and result calculation.*

---

### Step 3: Start the Local Hardhat Blockchain (Terminal 1)
Open **Terminal 1** and start the local Ethereum node:
```bash
npx hardhat node
```
> [!IMPORTANT]
> **Keep Terminal 1 running!** This process acts as your local Ethereum blockchain.
> It prints 20 pre-funded test accounts (each with 10,000 test ETH) and their private keys.

**Example output in Terminal 1:**
```
Started HTTP and WebSocket JSON-RPC server at http://127.0.0.1:8545/
Account #0: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 (10000 ETH)
Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

Account #1: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 (10000 ETH)
Private Key: 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d

Account #2: 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC (10000 ETH)
Private Key: 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a
```

---

### Step 4: Deploy the Smart Contract (Terminal 2)
Open **Terminal 2** (leaving Terminal 1 open) and run:
```bash
npx hardhat run scripts/deploy.js --network localhost
```
*This command compiles the contract, deploys it to your running local node using `Account #0` (which becomes the Administrator), and automatically updates `frontend/contract-data.js` and `frontend/contract-info.json` with the deployed address and ABI.*

---

### Step 5: Configure MetaMask for Hardhat Localhost

1. Open your browser and click the **MetaMask extension icon**.
2. Click the **Network Selector** dropdown in the top-left of MetaMask &rarr; **Add network** &rarr; **Add a network manually**.
3. Fill in the network details:
   - **Network Name:** `Hardhat Localhost`
   - **New RPC URL:** `http://127.0.0.1:8545`
   - **Chain ID:** `31337`
   - **Currency Symbol:** `ETH`
4. Click **Save** and switch to `Hardhat Localhost`.

#### Import Local Test Accounts into MetaMask:
1. In MetaMask, click your **Account profile icon** &rarr; **Add account or hardware wallet** &rarr; **Import account**.
2. Select **Private Key**.
3. **Import Account #0 (The Administrator):**
   - Paste: `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`
   - Label it in MetaMask as **Admin (Hardhat #0)**.
4. **Import Account #1 (Test Voter 1):**
   - Click Import Account again.
   - Paste: `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d`
   - Label it as **Voter 1 (Hardhat #1)** (Comes with 10,000 test ETH for gas!).

> [!WARNING]
> **Safety Notice:** These private keys are public test keys built into Hardhat. Use them **ONLY on your local testnet**. Never send real funds or use these keys on Ethereum mainnet or public testnets.

---

### Step 6: Launch the Frontend
You can launch the frontend using:

```bash
npm run frontend
```
Then open your browser and navigate to: **[http://localhost:3000](http://localhost:3000)**  
*(Or double-click `frontend/index.html` to open directly).*

---

## 6. How to Conduct a Complete Project Demonstration (Demo Walkthrough)

Follow this script to demonstrate the project seamlessly during an evaluation or viva:

1. **Connect Administrator Wallet:**
   - In MetaMask, switch to **Admin (Hardhat #0)**: `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`.
   - On the web page, click **Connect MetaMask**.
   - Notice the status badge switches to **Administrator** and the network badge shows **Hardhat Localhost (31337)**.
   - Notice the election status is **Not Started**.

2. **Add Candidates:**
   - In the **Administrator Control Panel**, enter:
     - Candidate Name: `Alice Johnson`
     - Description: `Computer Science Dept • Student Council President`
     - Click **Add Candidate** &rarr; Confirm transaction in MetaMask.
   - Add a second candidate:
     - Candidate Name: `Bob Miller`
     - Description: `Electrical Engineering Dept • Sports Committee`
     - Click **Add Candidate** &rarr; Confirm transaction in MetaMask.
   - Observe both candidate cards appear dynamically with 0 votes and 0.0%.

3. **Register Voters:**
   - In the Administrator panel, under **Register Eligible Voter**, paste Voter 1's address:
     `0x70997970C51812dc3A010C7d01b50e0d17dc79C8`
   - Click **Authorize Voter** &rarr; Confirm transaction in MetaMask.

4. **Demonstrate Rules & Start Election:**
   - Note that voting is currently disabled because the election hasn't started.
   - As Admin, click **Start Election** &rarr; Confirm in MetaMask.
   - The status updates to **Voting Active (Ongoing)**.
   - Candidate registration is now locked (cannot add candidates after voting starts).

5. **Cast a Vote as Voter 1:**
   - In MetaMask, switch account to **Voter 1** (`0x7099...`).
   - Notice the UI immediately updates: role changes to **Authorized Voter** and status shows **Eligible to Vote**.
   - Click **Vote for Candidate** on `Alice Johnson`.
   - Confirm the transaction in MetaMask (ensure Voter 1 has test ETH for the tiny gas fee; if not, transfer 1 ETH from Admin or import Hardhat Account #1).
   - Watch the live update: Alice Johnson now has 1 vote (100%), total votes shows 1, and the card displays **Your Voted Choice ✓**.

6. **Demonstrate Double-Voting Prevention:**
   - Attempt to click vote again or vote for Bob Miller using Voter 1.
   - The buttons are disabled in the UI. If a user calls the contract directly, it reverts with `"You have already cast your vote"`.

7. **Demonstrate Unauthorized Voter Rejection:**
   - In MetaMask, switch to an unregistered wallet (e.g. Account #3).
   - The UI shows **Unregistered Wallet / Not Registered** and disables voting.

8. **End Election and View Final Results:**
   - Switch back to the **Admin** account in MetaMask.
   - Click **End Election** &rarr; Confirm in MetaMask.
   - Status updates to **Election Closed**.
   - Voting buttons are permanently disabled.
   - The **Winner Banner** illuminates: **Winner: Alice Johnson 🎉** with final percentage and verified on-chain tally.

---

## 7. Troubleshooting & Common Questions

### 1. MetaMask "Review" / "Confirm" button is disabled when voting
- **Cause:** The voting account has `0 ETH` to pay the gas fee (`0.0001 ETH`), OR the MetaMask popup has not been scrolled down.
- **Solution A:** Switch to Admin account in MetaMask &rarr; Send `1 ETH` to your voter account.
- **Solution B:** Import Hardhat Account #1 (`0x59c699...`), which already has 10,000 test ETH.
- **Solution C:** Scroll down inside the MetaMask transaction popup to the bottom.

### 2. Transaction stuck or "Nonce too high" error after restarting the node
- **Cause:** When `npx hardhat node` is restarted, the blockchain starts from block #0, but MetaMask remembers older transaction numbers (nonces).
- **Solution:** In MetaMask &rarr; **Settings** &rarr; **Advanced** &rarr; Click **"Clear activity and nonce data"**.

---

## 8. License

This project is licensed under the [MIT License](LICENSE). Developed as an educational reference for students and blockchain enthusiasts.


---

## Author: 
- SS-2005 (Sahil Shaikh)
