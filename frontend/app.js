/**
 * Decentralized Voting System - Frontend Client
 * Interacts with the Voting.sol smart contract via Ethers.js and MetaMask
 */

// Global State
let provider = null;
let signer = null;
let userAddress = null;
let votingContract = null;
let contractAddress = null;
let contractABI = null;
let adminAddress = null;
let electionState = 0; // 0 = NotStarted, 1 = Ongoing, 2 = Ended
let isUserAdmin = false;
let userVoterStatus = { isRegistered: false, hasVoted: false, votedCandidateId: 0 };
let candidates = [];
let totalVotes = 0;

// Hardhat Localhost Network details
const HARDHAT_CHAIN_ID_HEX = "0x7a69"; // 31337 in hex
const HARDHAT_CHAIN_ID_DEC = 31337;

// DOM Elements
const connectWalletBtn = document.getElementById("connectWalletBtn");
const walletBtnText = document.getElementById("walletBtnText");
const walletBtnIcon = document.getElementById("walletBtnIcon");
const networkBadge = document.getElementById("networkBadge");
const networkName = document.getElementById("networkName");
const networkWarning = document.getElementById("networkWarning");
const switchNetworkBtn = document.getElementById("switchNetworkBtn");
const configWarning = document.getElementById("configWarning");
const manualContractAddress = document.getElementById("manualContractAddress");
const saveManualAddressBtn = document.getElementById("saveManualAddressBtn");

const statusAlert = document.getElementById("statusAlert");
const alertIcon = document.getElementById("alertIcon");
const alertMessage = document.getElementById("alertMessage");
const alertCloseBtn = document.getElementById("alertCloseBtn");

const electionStateBadge = document.getElementById("electionStateBadge");
const electionStateText = document.getElementById("electionStateText");
const electionStateSub = document.getElementById("electionStateSub");
const totalVotesText = document.getElementById("totalVotesText");
const candidateCountText = document.getElementById("candidateCountText");
const userRoleBadge = document.getElementById("userRoleBadge");
const voterStatusText = document.getElementById("voterStatusText");
const voterStatusSub = document.getElementById("voterStatusSub");

const adminSection = document.getElementById("adminSection");
const addCandidateForm = document.getElementById("addCandidateForm");
const candidateNameInput = document.getElementById("candidateName");
const candidateDescInput = document.getElementById("candidateDesc");
const addCandidateBtn = document.getElementById("addCandidateBtn");
const registerVoterForm = document.getElementById("registerVoterForm");
const voterAddressInput = document.getElementById("voterAddress");
const registerVoterBtn = document.getElementById("registerVoterBtn");
const startElectionBtn = document.getElementById("startElectionBtn");
const endElectionBtn = document.getElementById("endElectionBtn");

const noCandidatesMessage = document.getElementById("noCandidatesMessage");
const candidatesGrid = document.getElementById("candidatesGrid");
const refreshDataBtn = document.getElementById("refreshDataBtn");

const resultsTableBody = document.getElementById("resultsTableBody");
const resultsStateTag = document.getElementById("resultsStateTag");
const winnerBanner = document.getElementById("winnerBanner");
const winnerTitle = document.getElementById("winnerTitle");
const winnerSubtitle = document.getElementById("winnerSubtitle");

// -------------------------------------------------------------
// Initialization & Provider Detection
// -------------------------------------------------------------

window.addEventListener("DOMContentLoaded", async () => {
  setupEventListeners();
  loadContractConfig();
  updateAdminControlsUI(); // Ensure controls are appropriately disabled initially

  // Detect MetaMask (both immediate and async injection)
  await waitForMetaMask();
});

async function waitForMetaMask() {
  if (window.ethereum) {
    onMetaMaskDetected();
    return;
  }

  // Listen for the standard MetaMask initialization event
  window.addEventListener("ethereum#initialized", onMetaMaskDetected, { once: true });

  // Fallback poll for 2.5 seconds (in case event was missed or provider was slightly delayed)
  let attempts = 0;
  const interval = setInterval(() => {
    attempts++;
    if (window.ethereum) {
      clearInterval(interval);
      onMetaMaskDetected();
    } else if (attempts >= 8) {
      clearInterval(interval);
      showMetaMaskNotFoundState();
    }
  }, 300);
}

function getMetaMaskProvider() {
  if (!window.ethereum) return null;
  // If multiple wallet extensions are installed (e.g. Coinbase, Phantom, MetaMask)
  if (window.ethereum.providers?.length) {
    const mm = window.ethereum.providers.find((p) => p.isMetaMask);
    return mm || window.ethereum;
  }
  return window.ethereum;
}

async function onMetaMaskDetected() {
  const eth = getMetaMaskProvider();
  if (!eth) return;

  connectWalletBtn.disabled = false;
  walletBtnText.textContent = "Connect MetaMask";

  try {
    const accounts = await eth.request({ method: "eth_accounts" });
    if (accounts && accounts.length > 0) {
      await initWallet(accounts[0]);
    } else {
      updateWalletUI(null);
    }
  } catch (err) {
    console.warn("Could not check connected accounts:", err);
  }

  eth.on("accountsChanged", (accounts) => {
    if (!accounts || accounts.length === 0) {
      handleDisconnect();
    } else {
      initWallet(accounts[0]);
    }
  });

  eth.on("chainChanged", () => {
    window.location.reload();
  });
}

function showMetaMaskNotFoundState() {
  connectWalletBtn.disabled = false; // Keep clickable to guide the user
  walletBtnIcon.textContent = "🦊";
  walletBtnText.textContent = "Install MetaMask";
  connectWalletBtn.className = "btn btn-warning";
  showAlert(
    "warning",
    `<strong>MetaMask is not detected in your browser!</strong><br />
     To use this DApp, please install the MetaMask browser extension from 
     <a href="https://metamask.io/download/" target="_blank" style="color: #fff; text-decoration: underline; font-weight: bold;">metamask.io/download</a>, 
     then refresh this page.`
  );
}

// -------------------------------------------------------------
// Event Listeners Setup
// -------------------------------------------------------------

function setupEventListeners() {
  connectWalletBtn.addEventListener("click", handleConnectWallet);
  switchNetworkBtn.addEventListener("click", switchOrAddHardhatNetwork);
  alertCloseBtn.addEventListener("click", hideAlert);
  refreshDataBtn.addEventListener("click", () => fetchContractData(true));

  saveManualAddressBtn.addEventListener("click", () => {
    const addr = manualContractAddress.value.trim();
    if (ethers.isAddress(addr)) {
      contractAddress = addr;
      configWarning.classList.add("d-none");
      showAlert("success", `Contract address manually updated to ${addr}`);
      if (signer) setupContract();
    } else {
      showAlert("danger", "Please enter a valid Ethereum address (0x...)");
    }
  });

  addCandidateForm.addEventListener("submit", handleAddCandidate);
  registerVoterForm.addEventListener("submit", handleRegisterVoter);
  startElectionBtn.addEventListener("click", handleStartElection);
  endElectionBtn.addEventListener("click", handleEndElection);
}

// -------------------------------------------------------------
// Configuration & Network Management
// -------------------------------------------------------------

function loadContractConfig() {
  // If deploy.js populated window.CONTRACT_ADDRESS and window.CONTRACT_ABI
  if (window.CONTRACT_ADDRESS && ethers.isAddress(window.CONTRACT_ADDRESS)) {
    contractAddress = window.CONTRACT_ADDRESS;
  }
  if (window.CONTRACT_ABI && Array.isArray(window.CONTRACT_ABI) && window.CONTRACT_ABI.length > 0) {
    contractABI = window.CONTRACT_ABI;
  }

  // Fallback ABI if contract-data.js has empty ABI
  if (!contractABI || contractABI.length === 0) {
    contractABI = [
      "function admin() view returns (address)",
      "function electionState() view returns (uint8)",
      "function totalVotes() view returns (uint256)",
      "function getCandidates() view returns (tuple(uint256 id, string name, string description, uint256 voteCount)[])",
      "function getCandidateCount() view returns (uint256)",
      "function getVoterStatus(address) view returns (bool isRegistered, bool hasVoted, uint256 votedCandidateId)",
      "function getResults() view returns (tuple(uint256 id, string name, string description, uint256 voteCount)[], uint256, uint8)",
      "function addCandidate(string name, string description)",
      "function registerVoter(address voter)",
      "function startElection()",
      "function endElection()",
      "function vote(uint256 candidateId)",
      "event CandidateAdded(uint256 indexed candidateId, string name, string description)",
      "event VoterRegistered(address indexed voter)",
      "event ElectionStarted()",
      "event ElectionEnded()",
      "event VoteCast(address indexed voter, uint256 indexed candidateId)"
    ];
  }

  if (!contractAddress) {
    configWarning.classList.remove("d-none");
  }
}

// -------------------------------------------------------------
// Network Management
// -------------------------------------------------------------

async function checkNetwork() {
  const eth = getMetaMaskProvider();
  if (!eth) return false;
  try {
    const chainId = await eth.request({ method: "eth_chainId" });
    const chainIdDec = parseInt(chainId, 16);

    if (chainIdDec === HARDHAT_CHAIN_ID_DEC) {
      networkBadge.className = "badge badge-success";
      networkName.textContent = "Hardhat Localhost (31337)";
      networkWarning.classList.add("d-none");
      return true;
    } else {
      networkBadge.className = "badge badge-danger";
      networkName.textContent = `Wrong Network (${chainIdDec})`;
      networkWarning.classList.remove("d-none");
      return false;
    }
  } catch (err) {
    console.error("Network check failed:", err);
    return false;
  }
}

async function switchOrAddHardhatNetwork() {
  const eth = getMetaMaskProvider();
  if (!eth) {
    showMetaMaskNotFoundState();
    return;
  }
  try {
    await eth.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: HARDHAT_CHAIN_ID_HEX }],
    });
  } catch (switchError) {
    // 4902 error code means the chain has not been added to MetaMask
    if (switchError.code === 4902) {
      try {
        await eth.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: HARDHAT_CHAIN_ID_HEX,
              chainName: "Hardhat Localhost",
              rpcUrls: ["http://127.0.0.1:8545"],
              nativeCurrency: {
                name: "Test ETH",
                symbol: "ETH",
                decimals: 18,
              },
            },
          ],
        });
      } catch (addError) {
        showAlert("danger", `Failed to add Hardhat network: ${addError.message}`);
      }
    } else {
      showAlert("danger", `Failed to switch network: ${switchError.message}`);
    }
  }
}

// -------------------------------------------------------------
// Wallet Connection
// -------------------------------------------------------------

async function handleConnectWallet() {
  const eth = getMetaMaskProvider();
  if (!eth) {
    showMetaMaskNotFoundState();
    window.open("https://metamask.io/download/", "_blank");
    return;
  }
  try {
    showAlert("info", "Requesting wallet connection... Please approve in MetaMask popup.");
    const accounts = await eth.request({ method: "eth_requestAccounts" });
    if (accounts && accounts.length > 0) {
      await initWallet(accounts[0]);
      showAlert("success", `Wallet connected: ${truncateAddress(accounts[0])}`);
    }
  } catch (err) {
    if (err.code === 4001) {
      showAlert("warning", "Connection request was rejected in MetaMask.");
    } else {
      showAlert("danger", `Connection error: ${err.message}`);
    }
  }
}

async function initWallet(address) {
  userAddress = address;
  const eth = getMetaMaskProvider();
  provider = new ethers.BrowserProvider(eth);
  signer = await provider.getSigner();

  updateWalletUI(userAddress);
  await checkNetwork();

  if (contractAddress && contractABI) {
    setupContract();
  }
}

function handleDisconnect() {
  userAddress = null;
  signer = null;
  votingContract = null;
  isUserAdmin = false;
  updateWalletUI(null);
  showAlert("info", "Wallet disconnected.");
}

function updateWalletUI(address) {
  if (address) {
    walletBtnIcon.textContent = "🟢";
    walletBtnText.textContent = truncateAddress(address);
    connectWalletBtn.className = "btn btn-outline";
  } else {
    walletBtnIcon.textContent = "🦊";
    walletBtnText.textContent = "Connect MetaMask";
    connectWalletBtn.className = "btn btn-primary";
    userRoleBadge.className = "badge badge-neutral";
    userRoleBadge.textContent = "Guest";
    voterStatusText.textContent = "Wallet Disconnected";
    voterStatusSub.textContent = "Connect MetaMask to participate";
    adminSection.classList.remove("active-admin");
  }
}

function setupContract() {
  if (!contractAddress || !signer) return;
  try {
    votingContract = new ethers.Contract(contractAddress, contractABI, signer);
    fetchContractData();
  } catch (err) {
    console.error("Contract initialization failed:", err);
    showAlert("danger", `Contract binding error: ${err.message}`);
  }
}

// -------------------------------------------------------------
// Data Fetching & Sync
// -------------------------------------------------------------

async function fetchContractData(showToast = false) {
  if (!votingContract) return;

  try {
    if (showToast) showAlert("info", "Refreshing election data from blockchain...");

    // Fetch Admin and State
    adminAddress = await votingContract.admin();
    const rawState = await votingContract.electionState();
    electionState = Number(rawState);

    // Fetch Total Votes
    const rawTotalVotes = await votingContract.totalVotes();
    totalVotes = Number(rawTotalVotes);

    // Check if current user is admin
    if (userAddress) {
      isUserAdmin = userAddress.toLowerCase() === adminAddress.toLowerCase();
    } else {
      isUserAdmin = false;
    }

    // Fetch Voter Status for connected wallet
    if (userAddress) {
      const status = await votingContract.getVoterStatus(userAddress);
      userVoterStatus = {
        isRegistered: status[0],
        hasVoted: status[1],
        votedCandidateId: Number(status[2]),
      };
    }

    // Fetch Candidates List
    const rawCandidates = await votingContract.getCandidates();
    candidates = rawCandidates.map((c) => ({
      id: Number(c.id),
      name: c.name,
      description: c.description,
      voteCount: Number(c.voteCount),
    }));

    // Update UI Elements
    updateStatsUI();
    updateAdminControlsUI();
    renderCandidatesUI();
    renderResultsUI();

    if (showToast) showAlert("success", "Election data is up to date!");
  } catch (err) {
    console.error("Error reading contract data:", err);
    showAlert("danger", `Failed to load blockchain data: ${parseContractError(err)}`);
  }
}

// -------------------------------------------------------------
// UI Rendering Functions
// -------------------------------------------------------------

function updateStatsUI() {
  // Election State Badge & Text
  if (electionState === 0) {
    electionStateBadge.className = "badge badge-neutral";
    electionStateBadge.textContent = "Not Started";
    electionStateText.textContent = "Not Started";
    electionStateSub.textContent = "Setup phase: adding candidates and registering voters.";
  } else if (electionState === 1) {
    electionStateBadge.className = "badge badge-success";
    electionStateBadge.textContent = "Voting Active";
    electionStateText.textContent = "Ongoing";
    electionStateSub.textContent = "Authorized voters can cast their vote now.";
  } else if (electionState === 2) {
    electionStateBadge.className = "badge badge-danger";
    electionStateBadge.textContent = "Election Closed";
    electionStateText.textContent = "Closed";
    electionStateSub.textContent = "Voting concluded. Final results are verified on-chain.";
  }

  // Total Votes & Candidate Count
  totalVotesText.textContent = totalVotes;
  candidateCountText.textContent = candidates.length;

  // Connected Wallet Status
  if (userAddress) {
    if (isUserAdmin) {
      userRoleBadge.className = "badge badge-admin";
      userRoleBadge.textContent = "Administrator";
    } else if (userVoterStatus.isRegistered) {
      userRoleBadge.className = "badge badge-success";
      userRoleBadge.textContent = "Authorized Voter";
    } else {
      userRoleBadge.className = "badge badge-neutral";
      userRoleBadge.textContent = "Unregistered Wallet";
    }

    if (userVoterStatus.hasVoted) {
      const votedCandidate = candidates.find((c) => c.id === userVoterStatus.votedCandidateId);
      const candName = votedCandidate ? votedCandidate.name : `#${userVoterStatus.votedCandidateId}`;
      voterStatusText.textContent = "✅ Vote Cast";
      voterStatusSub.textContent = `You voted for Candidate: ${candName}`;
    } else if (userVoterStatus.isRegistered) {
      voterStatusText.textContent = "Eligible to Vote";
      voterStatusSub.textContent = electionState === 1 ? "Voting is live! Select a candidate below." : "Awaiting voting commencement.";
    } else {
      voterStatusText.textContent = "Not Registered";
      voterStatusSub.textContent = "Contact administrator to authorize this wallet address.";
    }
  }
}

function updateAdminControlsUI() {
  // If user is admin, visually distinguish the admin section
  if (isUserAdmin) {
    adminSection.classList.remove("d-none");
    adminSection.style.opacity = "1";
    adminSection.style.pointerEvents = "auto";
  } else {
    // Keep it visible as an educational demonstration, but disable submit buttons if not admin
    adminSection.style.opacity = "0.7";
  }

  // Add Candidate button only allowed before election starts
  addCandidateBtn.disabled = electionState !== 0 || !isUserAdmin;
  if (electionState !== 0) {
    addCandidateBtn.title = "Candidates cannot be added once election has started.";
  }

  // Register Voter allowed before election ends
  registerVoterBtn.disabled = electionState === 2 || !isUserAdmin;

  // Start Election: Admin only, state == 0, candidates >= 2
  startElectionBtn.disabled = !isUserAdmin || electionState !== 0 || candidates.length < 2;

  // End Election: Admin only, state == 1
  endElectionBtn.disabled = !isUserAdmin || electionState !== 1;
}

function renderCandidatesUI() {
  if (candidates.length === 0) {
    noCandidatesMessage.classList.remove("d-none");
    candidatesGrid.classList.add("d-none");
    return;
  }

  noCandidatesMessage.classList.add("d-none");
  candidatesGrid.classList.remove("d-none");
  candidatesGrid.innerHTML = "";

  candidates.forEach((cand) => {
    const card = document.createElement("div");
    card.className = "candidate-card";

    const isVotedChoice = userVoterStatus.hasVoted && userVoterStatus.votedCandidateId === cand.id;
    if (isVotedChoice) {
      card.classList.add("voted-for");
    }

    const percentage = totalVotes > 0 ? ((cand.voteCount / totalVotes) * 100).toFixed(1) : 0;

    let voteBtnState = "";
    let voteBtnText = "Vote for Candidate";
    let isBtnDisabled = false;

    if (!userAddress) {
      isBtnDisabled = true;
      voteBtnText = "Connect Wallet to Vote";
    } else if (electionState === 0) {
      isBtnDisabled = true;
      voteBtnText = "Election Not Started";
    } else if (electionState === 2) {
      isBtnDisabled = true;
      voteBtnText = "Election Closed";
    } else if (!userVoterStatus.isRegistered) {
      isBtnDisabled = true;
      voteBtnText = "Not Registered";
    } else if (userVoterStatus.hasVoted) {
      isBtnDisabled = true;
      voteBtnText = isVotedChoice ? "Your Voted Choice ✓" : "Already Voted";
    }

    card.innerHTML = `
      <div>
        <div class="candidate-top">
          <span class="candidate-id-badge">ID #${cand.id}</span>
          ${isVotedChoice ? '<span class="badge badge-success">Your Vote</span>' : ''}
        </div>
        <h3 class="candidate-name">${escapeHtml(cand.name)}</h3>
        <p class="candidate-desc">${escapeHtml(cand.description || "No description provided.")}</p>
      </div>

      <div>
        <div class="candidate-votes-bar">
          <div class="votes-info">
            <span>Votes: <strong>${cand.voteCount}</strong></span>
            <span>${percentage}%</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width: ${percentage}%"></div>
          </div>
        </div>

        <button 
          class="btn ${isVotedChoice ? 'btn-success' : 'btn-primary'} btn-block vote-action-btn" 
          data-id="${cand.id}" 
          ${isBtnDisabled ? 'disabled' : ''}>
          ${voteBtnText}
        </button>
      </div>
    `;

    const btn = card.querySelector(".vote-action-btn");
    if (!isBtnDisabled) {
      btn.addEventListener("click", () => handleCastVote(cand.id, cand.name));
    }

    candidatesGrid.appendChild(card);
  });
}

function renderResultsUI() {
  resultsStateTag.textContent = electionState === 2 ? "Final On-Chain Results" : "Live Tally";

  if (candidates.length === 0) {
    resultsTableBody.innerHTML = `<tr><td colspan="5" class="text-center">No candidates registered.</td></tr>`;
    winnerBanner.classList.add("d-none");
    return;
  }

  resultsTableBody.innerHTML = "";

  // Sort candidates by voteCount descending for standings
  const sorted = [...candidates].sort((a, b) => b.voteCount - a.voteCount);

  sorted.forEach((cand, index) => {
    const percentage = totalVotes > 0 ? ((cand.voteCount / totalVotes) * 100).toFixed(1) : "0.0";
    const row = document.createElement("tr");

    row.innerHTML = `
      <td><strong>${index + 1}</strong></td>
      <td><strong>${escapeHtml(cand.name)}</strong></td>
      <td>${escapeHtml(cand.description || "-")}</td>
      <td>${cand.voteCount}</td>
      <td>
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <div class="progress-track" style="flex: 1; height: 6px;">
            <div class="progress-fill" style="width: ${percentage}%"></div>
          </div>
          <span style="font-size: 0.8rem; width: 45px;">${percentage}%</span>
        </div>
      </td>
    `;
    resultsTableBody.appendChild(row);
  });

  // Display winner banner if election is closed and has votes
  if (electionState === 2 && candidates.length > 0) {
    winnerBanner.classList.remove("d-none");
    const topCand = sorted[0];
    if (totalVotes === 0) {
      winnerTitle.textContent = "Election Concluded with No Votes Cast";
      winnerSubtitle.textContent = "Final tally recorded 0 total ballots.";
    } else if (sorted.length > 1 && sorted[0].voteCount === sorted[1].voteCount) {
      winnerTitle.textContent = `Tied Election: ${topCand.name} & ${sorted[1].name}`;
      winnerSubtitle.textContent = `Both tied with ${topCand.voteCount} vote(s) each.`;
    } else {
      winnerTitle.textContent = `Winner: ${topCand.name} 🎉`;
      winnerSubtitle.textContent = `Won with ${topCand.voteCount} vote(s) (${((topCand.voteCount / totalVotes) * 100).toFixed(1)}% of total vote).`;
    }
  } else {
    winnerBanner.classList.add("d-none");
  }
}

// -------------------------------------------------------------
// Transaction Handlers
// -------------------------------------------------------------

async function handleAddCandidate(e) {
  e.preventDefault();
  if (!userAddress) {
    showAlert("warning", "Please connect your MetaMask wallet first using the button at the top right.");
    return;
  }
  if (!isUserAdmin) {
    showAlert("danger", `Access denied: Only the administrator (${truncateAddress(adminAddress)}) can add candidates.`);
    return;
  }
  if (!votingContract) {
    showAlert("danger", "Smart contract is not connected. Please verify the contract deployment.");
    return;
  }

  const name = candidateNameInput.value.trim();
  const desc = candidateDescInput.value.trim();

  if (!name) {
    showAlert("warning", "Candidate name is required.");
    return;
  }

  try {
    addCandidateBtn.disabled = true;
    showAlert("info", `Submitting transaction to add candidate "${name}"... Please confirm in MetaMask.`);

    const tx = await votingContract.addCandidate(name, desc);
    showAlert("info", `Transaction submitted! Hash: ${truncateHash(tx.hash)}. Waiting for block confirmation...`);

    const receipt = await tx.wait();
    showAlert("success", `Candidate "${name}" registered successfully! (Block #${receipt.blockNumber})`);

    candidateNameInput.value = "";
    candidateDescInput.value = "";
    await fetchContractData();
  } catch (err) {
    console.error("Add candidate failed:", err);
    showAlert("danger", `Failed to add candidate: ${parseContractError(err)}`);
  } finally {
    addCandidateBtn.disabled = false;
  }
}

async function handleRegisterVoter(e) {
  e.preventDefault();
  if (!userAddress) {
    showAlert("warning", "Please connect your MetaMask wallet first using the button at the top right.");
    return;
  }
  if (!isUserAdmin) {
    showAlert("danger", `Access denied: Only the administrator (${truncateAddress(adminAddress)}) can register voters.`);
    return;
  }
  if (!votingContract) {
    showAlert("danger", "Smart contract is not connected. Please verify the contract deployment.");
    return;
  }

  const voterAddr = voterAddressInput.value.trim();
  if (!ethers.isAddress(voterAddr)) {
    showAlert("warning", "Please provide a valid Ethereum wallet address (0x...).");
    return;
  }

  try {
    registerVoterBtn.disabled = true;
    showAlert("info", `Authorizing voter wallet ${truncateAddress(voterAddr)}... Confirm in MetaMask.`);

    const tx = await votingContract.registerVoter(voterAddr);
    showAlert("info", `Transaction submitted! Hash: ${truncateHash(tx.hash)}. Waiting for confirmation...`);

    const receipt = await tx.wait();
    showAlert("success", `Voter ${truncateAddress(voterAddr)} successfully registered! (Block #${receipt.blockNumber})`);

    voterAddressInput.value = "";
    await fetchContractData();
  } catch (err) {
    console.error("Register voter failed:", err);
    showAlert("danger", `Failed to register voter: ${parseContractError(err)}`);
  } finally {
    registerVoterBtn.disabled = false;
  }
}

async function handleStartElection() {
  if (!userAddress) {
    showAlert("warning", "Please connect your MetaMask wallet first using the button at the top right.");
    return;
  }
  if (!isUserAdmin) {
    showAlert("danger", `Access denied: Only the administrator (${truncateAddress(adminAddress)}) can start the election.`);
    return;
  }
  if (!votingContract) {
    showAlert("danger", "Smart contract is not connected.");
    return;
  }

  if (candidates.length < 2) {
    showAlert("warning", "At least 2 candidates must be registered before starting the election.");
    return;
  }

  const confirmStart = confirm("Are you sure you want to start voting? Candidate registrations will be locked.");
  if (!confirmStart) return;

  try {
    startElectionBtn.disabled = true;
    showAlert("info", "Starting election... Confirm transaction in MetaMask.");

    const tx = await votingContract.startElection();
    showAlert("info", `Starting transaction submitted! Hash: ${truncateHash(tx.hash)}.`);

    const receipt = await tx.wait();
    showAlert("success", `Election is now OPEN for voting! (Block #${receipt.blockNumber})`);

    await fetchContractData();
  } catch (err) {
    console.error("Start election failed:", err);
    showAlert("danger", `Failed to start election: ${parseContractError(err)}`);
  } finally {
    startElectionBtn.disabled = false;
  }
}

async function handleEndElection() {
  if (!userAddress) {
    showAlert("warning", "Please connect your MetaMask wallet first using the button at the top right.");
    return;
  }
  if (!isUserAdmin) {
    showAlert("danger", `Access denied: Only the administrator (${truncateAddress(adminAddress)}) can end the election.`);
    return;
  }
  if (!votingContract) {
    showAlert("danger", "Smart contract is not connected.");
    return;
  }

  const confirmEnd = confirm("Are you sure you want to end the election? Voting will be permanently closed.");
  if (!confirmEnd) return;

  try {
    endElectionBtn.disabled = true;
    showAlert("info", "Closing election... Confirm transaction in MetaMask.");

    const tx = await votingContract.endElection();
    showAlert("info", `Closing transaction submitted! Hash: ${truncateHash(tx.hash)}.`);

    const receipt = await tx.wait();
    showAlert("success", `Election has been officially closed! Final results are locked on-chain. (Block #${receipt.blockNumber})`);

    await fetchContractData();
  } catch (err) {
    console.error("End election failed:", err);
    showAlert("danger", `Failed to end election: ${parseContractError(err)}`);
  } finally {
    endElectionBtn.disabled = false;
  }
}

async function handleCastVote(candidateId, candidateName) {
  if (!votingContract || !userAddress) {
    showAlert("warning", "Please connect your wallet first.");
    return;
  }

  const confirmVote = confirm(`Are you sure you want to cast your 1 vote for "${candidateName}"?\nThis action cannot be undone or changed.`);
  if (!confirmVote) return;

  try {
    showAlert("info", `Casting vote for ${candidateName}... Confirm in MetaMask.`);

    const tx = await votingContract.vote(candidateId);
    showAlert("info", `Vote transaction broadcasted! Hash: ${truncateHash(tx.hash)}. Awaiting block inclusion...`);

    const receipt = await tx.wait();
    showAlert("success", `🎉 Vote successfully recorded for "${candidateName}"! (Block #${receipt.blockNumber})`);

    await fetchContractData();
  } catch (err) {
    console.error("Vote failed:", err);
    showAlert("danger", `Voting failed: ${parseContractError(err)}`);
  }
}

// -------------------------------------------------------------
// Utilities & Helper Functions
// -------------------------------------------------------------

function showAlert(type, message) {
  statusAlert.className = `alert alert-${type}`;
  statusAlert.classList.remove("d-none");

  const icons = {
    info: "ℹ️",
    success: "✅",
    warning: "⚠️",
    danger: "❌",
  };
  alertIcon.textContent = icons[type] || "ℹ️";
  alertMessage.innerHTML = message;
}

function hideAlert() {
  statusAlert.classList.add("d-none");
}

function truncateAddress(address) {
  if (!address) return "";
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

function truncateHash(hash) {
  if (!hash) return "";
  return `${hash.substring(0, 10)}...${hash.substring(hash.length - 6)}`;
}

function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function parseContractError(err) {
  if (!err) return "Unknown error";
  if (err.code === 4001 || (err.info && err.info.error && err.info.error.code === 4001)) {
    return "Transaction was rejected by user in MetaMask.";
  }
  if (err.reason) {
    return err.reason;
  }
  if (err.data && err.data.message) {
    return err.data.message;
  }
  if (err.message) {
    // Clean up long ethers error strings
    const match = err.message.match(/reverted with reason string '([^']+)'/);
    if (match && match[1]) {
      return match[1];
    }
    const executionMatch = err.message.match(/execution reverted: ([^"\n]+)/);
    if (executionMatch && executionMatch[1]) {
      return executionMatch[1];
    }
    if (err.message.includes("user rejected action")) {
      return "Transaction was rejected by user in MetaMask.";
    }
    return err.message.length > 120 ? err.message.substring(0, 120) + "..." : err.message;
  }
  return "An unexpected error occurred.";
}
