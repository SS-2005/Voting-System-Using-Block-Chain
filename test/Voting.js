const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Voting Smart Contract", function () {
  let Voting;
  let voting;
  let admin, voter1, voter2, voter3, nonVoter;

  beforeEach(async function () {
    [admin, voter1, voter2, voter3, nonVoter] = await ethers.getSigners();

    Voting = await ethers.getContractFactory("Voting");
    voting = await Voting.deploy();
    await voting.waitForDeployment();
  });

  describe("Deployment and Initial State", function () {
    it("Should correctly assign the deployer as admin", async function () {
      expect(await voting.admin()).to.equal(admin.address);
    });

    it("Should initialize election state to NotStarted (0)", async function () {
      expect(await voting.electionState()).to.equal(0); // 0 = NotStarted
    });

    it("Should have 0 total votes initially", async function () {
      expect(await voting.totalVotes()).to.equal(0);
    });

    it("Should have 0 candidates initially", async function () {
      expect(await voting.getCandidateCount()).to.equal(0);
    });
  });

  describe("Candidate Management", function () {
    it("Should allow admin to add candidates", async function () {
      await expect(voting.connect(admin).addCandidate("Alice", "Computer Science Dept"))
        .to.emit(voting, "CandidateAdded")
        .withArgs(0, "Alice", "Computer Science Dept");

      await expect(voting.connect(admin).addCandidate("Bob", "Electrical Engineering Dept"))
        .to.emit(voting, "CandidateAdded")
        .withArgs(1, "Bob", "Electrical Engineering Dept");

      const candidates = await voting.getCandidates();
      expect(candidates.length).to.equal(2);
      expect(candidates[0].name).to.equal("Alice");
      expect(candidates[0].description).to.equal("Computer Science Dept");
      expect(candidates[0].voteCount).to.equal(0);
      expect(candidates[1].name).to.equal("Bob");
    });

    it("Should reject candidate addition with empty name", async function () {
      await expect(
        voting.connect(admin).addCandidate("", "No Name Candidate")
      ).to.be.revertedWith("Candidate name cannot be empty");
    });

    it("Should reject candidate addition by non-admin", async function () {
      await expect(
        voting.connect(voter1).addCandidate("Charlie", "Civil Engineering")
      ).to.be.revertedWith("Access denied: Only admin can perform this action");
    });

    it("Should reject adding candidates after election has started", async function () {
      // Add minimum candidates and start election
      await voting.connect(admin).addCandidate("Alice", "CS");
      await voting.connect(admin).addCandidate("Bob", "EE");
      await voting.connect(admin).startElection();

      await expect(
        voting.connect(admin).addCandidate("Charlie", "ME")
      ).to.be.revertedWith("Action not allowed in current election state");
    });
  });

  describe("Voter Registration", function () {
    it("Should allow admin to register eligible voters", async function () {
      await expect(voting.connect(admin).registerVoter(voter1.address))
        .to.emit(voting, "VoterRegistered")
        .withArgs(voter1.address);

      const status = await voting.getVoterStatus(voter1.address);
      expect(status.isRegistered).to.be.true;
      expect(status.hasVoted).to.be.false;
    });

    it("Should reject voter registration by non-admin", async function () {
      await expect(
        voting.connect(voter1).registerVoter(voter2.address)
      ).to.be.revertedWith("Access denied: Only admin can perform this action");
    });

    it("Should reject registering zero address", async function () {
      await expect(
        voting.connect(admin).registerVoter(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid voter address");
    });

    it("Should reject registering the same voter twice", async function () {
      await voting.connect(admin).registerVoter(voter1.address);
      await expect(
        voting.connect(admin).registerVoter(voter1.address)
      ).to.be.revertedWith("Voter is already registered");
    });

    it("Should reject voter registration after election has ended", async function () {
      await voting.connect(admin).addCandidate("Alice", "CS");
      await voting.connect(admin).addCandidate("Bob", "EE");
      await voting.connect(admin).startElection();
      await voting.connect(admin).endElection();

      await expect(
        voting.connect(admin).registerVoter(voter1.address)
      ).to.be.revertedWith("Cannot register voters after election has ended");
    });
  });

  describe("Election Lifecycle Management", function () {
    it("Should require at least 2 candidates to start election", async function () {
      await expect(voting.connect(admin).startElection()).to.be.revertedWith(
        "At least 2 candidates required to start election"
      );

      await voting.connect(admin).addCandidate("Alice", "CS");
      await expect(voting.connect(admin).startElection()).to.be.revertedWith(
        "At least 2 candidates required to start election"
      );

      await voting.connect(admin).addCandidate("Bob", "EE");
      await expect(voting.connect(admin).startElection())
        .to.emit(voting, "ElectionStarted");

      expect(await voting.electionState()).to.equal(1); // 1 = Ongoing
    });

    it("Should reject starting an election by non-admin", async function () {
      await voting.connect(admin).addCandidate("Alice", "CS");
      await voting.connect(admin).addCandidate("Bob", "EE");
      await expect(
        voting.connect(voter1).startElection()
      ).to.be.revertedWith("Access denied: Only admin can perform this action");
    });

    it("Should reject ending an election that hasn't started", async function () {
      await expect(
        voting.connect(admin).endElection()
      ).to.be.revertedWith("Action not allowed in current election state");
    });

    it("Should allow admin to end an ongoing election", async function () {
      await voting.connect(admin).addCandidate("Alice", "CS");
      await voting.connect(admin).addCandidate("Bob", "EE");
      await voting.connect(admin).startElection();

      await expect(voting.connect(admin).endElection())
        .to.emit(voting, "ElectionEnded");

      expect(await voting.electionState()).to.equal(2); // 2 = Ended
    });

    it("Should reject ending an election by non-admin", async function () {
      await voting.connect(admin).addCandidate("Alice", "CS");
      await voting.connect(admin).addCandidate("Bob", "EE");
      await voting.connect(admin).startElection();

      await expect(
        voting.connect(voter1).endElection()
      ).to.be.revertedWith("Access denied: Only admin can perform this action");
    });
  });

  describe("Voting Process and Security", function () {
    beforeEach(async function () {
      // Setup candidates
      await voting.connect(admin).addCandidate("Alice", "CS");
      await voting.connect(admin).addCandidate("Bob", "EE");
      // Register voter1 and voter2
      await voting.connect(admin).registerVoter(voter1.address);
      await voting.connect(admin).registerVoter(voter2.address);
    });

    it("Should reject votes before election starts", async function () {
      await expect(
        voting.connect(voter1).vote(0)
      ).to.be.revertedWith("Action not allowed in current election state");
    });

    it("Should allow registered voter to cast a vote during ongoing election", async function () {
      await voting.connect(admin).startElection();

      await expect(voting.connect(voter1).vote(0))
        .to.emit(voting, "VoteCast")
        .withArgs(voter1.address, 0);

      const status = await voting.getVoterStatus(voter1.address);
      expect(status.hasVoted).to.be.true;
      expect(status.votedCandidateId).to.equal(0);

      const candidates = await voting.getCandidates();
      expect(candidates[0].voteCount).to.equal(1);
      expect(candidates[1].voteCount).to.equal(0);
      expect(await voting.totalVotes()).to.equal(1);
    });

    it("Should reject vote from unauthorized / unregistered wallet", async function () {
      await voting.connect(admin).startElection();

      await expect(
        voting.connect(nonVoter).vote(0)
      ).to.be.revertedWith("You are not registered to vote in this election");
    });

    it("Should prevent the same wallet from voting twice", async function () {
      await voting.connect(admin).startElection();

      await voting.connect(voter1).vote(0);

      await expect(
        voting.connect(voter1).vote(1)
      ).to.be.revertedWith("You have already cast your vote");
    });

    it("Should reject votes with invalid candidate ID", async function () {
      await voting.connect(admin).startElection();

      await expect(
        voting.connect(voter1).vote(99)
      ).to.be.revertedWith("Invalid candidate ID");
    });

    it("Should reject votes after election has ended", async function () {
      await voting.connect(admin).startElection();
      await voting.connect(admin).endElection();

      await expect(
        voting.connect(voter1).vote(0)
      ).to.be.revertedWith("Action not allowed in current election state");
    });
  });

  describe("Results Retrieval", function () {
    it("Should correctly tally and return results", async function () {
      await voting.connect(admin).addCandidate("Alice", "CS");
      await voting.connect(admin).addCandidate("Bob", "EE");
      await voting.connect(admin).addCandidate("Charlie", "ME");

      await voting.connect(admin).registerVoter(voter1.address);
      await voting.connect(admin).registerVoter(voter2.address);
      await voting.connect(admin).registerVoter(voter3.address);

      await voting.connect(admin).startElection();

      // Alice receives 2 votes, Bob receives 1 vote, Charlie receives 0
      await voting.connect(voter1).vote(0);
      await voting.connect(voter2).vote(0);
      await voting.connect(voter3).vote(1);

      const results = await voting.getResults();
      const candidates = results[0];
      const total = results[1];
      const state = results[2];

      expect(total).to.equal(3);
      expect(state).to.equal(1); // Ongoing
      expect(candidates[0].voteCount).to.equal(2);
      expect(candidates[1].voteCount).to.equal(1);
      expect(candidates[2].voteCount).to.equal(0);

      // End election and verify state in getResults
      await voting.connect(admin).endElection();
      const finalResults = await voting.getResults();
      expect(finalResults[2]).to.equal(2); // Ended
    });
  });
});
