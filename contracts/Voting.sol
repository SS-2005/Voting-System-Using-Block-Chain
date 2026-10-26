// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Voting
 * @dev A beginner-friendly, decentralized voting smart contract for college mini-projects.
 * Implements role-based access control, voter registration, candidate management,
 * and an election lifecycle (NotStarted -> Ongoing -> Ended).
 */
contract Voting {
    // -------------------------------------------------------------
    // Enums and Structs
    // -------------------------------------------------------------

    enum ElectionState {
        NotStarted,
        Ongoing,
        Ended
    }

    struct Candidate {
        uint256 id;
        string name;
        string description;
        uint256 voteCount;
    }

    struct Voter {
        bool isRegistered;
        bool hasVoted;
        uint256 votedCandidateId;
    }

    // -------------------------------------------------------------
    // State Variables
    // -------------------------------------------------------------

    address public admin;
    ElectionState public electionState;
    uint256 public totalVotes;

    Candidate[] public candidates;
    mapping(address => Voter) public voters;

    // -------------------------------------------------------------
    // Events
    // -------------------------------------------------------------

    event CandidateAdded(uint256 indexed candidateId, string name, string description);
    event VoterRegistered(address indexed voter);
    event ElectionStarted();
    event ElectionEnded();
    event VoteCast(address indexed voter, uint256 indexed candidateId);

    // -------------------------------------------------------------
    // Modifiers
    // -------------------------------------------------------------

    modifier onlyAdmin() {
        require(msg.sender == admin, "Access denied: Only admin can perform this action");
        _;
    }

    modifier inState(ElectionState _state) {
        require(electionState == _state, "Action not allowed in current election state");
        _;
    }

    // -------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------

    /**
     * @dev Sets the deployer of the contract as the election administrator
     * and initializes the election state to NotStarted.
     */
    constructor() {
        admin = msg.sender;
        electionState = ElectionState.NotStarted;
    }

    // -------------------------------------------------------------
    // Administrative Functions
    // -------------------------------------------------------------

    /**
     * @notice Add a new candidate to the election
     * @dev Only allowed by the admin before the election starts
     * @param _name Name of the candidate
     * @param _description Short bio or description of the candidate
     */
    function addCandidate(string memory _name, string memory _description)
        external
        onlyAdmin
        inState(ElectionState.NotStarted)
    {
        require(bytes(_name).length > 0, "Candidate name cannot be empty");

        uint256 newId = candidates.length;
        candidates.push(Candidate({
            id: newId,
            name: _name,
            description: _description,
            voteCount: 0
        }));

        emit CandidateAdded(newId, _name, _description);
    }

    /**
     * @notice Register an eligible voter by wallet address
     * @dev Only allowed by the admin before the election ends
     * @param _voter Wallet address of the voter
     */
    function registerVoter(address _voter)
        external
        onlyAdmin
    {
        require(electionState != ElectionState.Ended, "Cannot register voters after election has ended");
        require(_voter != address(0), "Invalid voter address");
        require(!voters[_voter].isRegistered, "Voter is already registered");

        voters[_voter].isRegistered = true;

        emit VoterRegistered(_voter);
    }

    /**
     * @notice Start the voting period
     * @dev Can only be called by admin when election is in NotStarted state
     */
    function startElection()
        external
        onlyAdmin
        inState(ElectionState.NotStarted)
    {
        require(candidates.length >= 2, "At least 2 candidates required to start election");
        electionState = ElectionState.Ongoing;

        emit ElectionStarted();
    }

    /**
     * @notice Conclude the election
     * @dev Can only be called by admin while voting is Ongoing
     */
    function endElection()
        external
        onlyAdmin
        inState(ElectionState.Ongoing)
    {
        electionState = ElectionState.Ended;

        emit ElectionEnded();
    }

    // -------------------------------------------------------------
    // Voter Functions
    // -------------------------------------------------------------

    /**
     * @notice Cast a single vote for a registered candidate
     * @dev Requires voting to be Ongoing, caller to be registered, and caller to have not yet voted
     * @param _candidateId The index/ID of the candidate to vote for
     */
    function vote(uint256 _candidateId)
        external
        inState(ElectionState.Ongoing)
    {
        Voter storage sender = voters[msg.sender];

        require(sender.isRegistered, "You are not registered to vote in this election");
        require(!sender.hasVoted, "You have already cast your vote");
        require(_candidateId < candidates.length, "Invalid candidate ID");

        sender.hasVoted = true;
        sender.votedCandidateId = _candidateId;

        candidates[_candidateId].voteCount += 1;
        totalVotes += 1;

        emit VoteCast(msg.sender, _candidateId);
    }

    // -------------------------------------------------------------
    // Getter & View Functions
    // -------------------------------------------------------------

    /**
     * @notice Retrieve all registered candidates
     * @return Array of Candidate structs
     */
    function getCandidates() external view returns (Candidate[] memory) {
        return candidates;
    }

    /**
     * @notice Get candidate count
     * @return Total number of candidates
     */
    function getCandidateCount() external view returns (uint256) {
        return candidates.length;
    }

    /**
     * @notice Get voter status for a given address
     * @param _voter Wallet address to query
     * @return isRegistered Whether the address is authorized to vote
     * @return hasVoted Whether the address has already cast a vote
     * @return votedCandidateId The candidate ID the address voted for (if voted)
     */
    function getVoterStatus(address _voter)
        external
        view
        returns (bool isRegistered, bool hasVoted, uint256 votedCandidateId)
    {
        Voter memory v = voters[_voter];
        return (v.isRegistered, v.hasVoted, v.votedCandidateId);
    }

    /**
     * @notice Get current election results
     * @dev Can be called at any time to inspect current or final standings
     * @return candidateList All candidate data including vote counts
     * @return totalVoteCount Total votes recorded across all candidates
     * @return currentState Current lifecycle state of the election
     */
    function getResults()
        external
        view
        returns (
            Candidate[] memory candidateList,
            uint256 totalVoteCount,
            ElectionState currentState
        )
    {
        return (candidates, totalVotes, electionState);
    }
}
