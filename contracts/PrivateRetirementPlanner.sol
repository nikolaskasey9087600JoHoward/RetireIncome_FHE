// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { FHE, euint32, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract PrivateRetirementPlanner is SepoliaConfig {
    // Encrypted user financial data
    struct EncryptedFinancialData {
        euint32 encryptedAssets;       // Encrypted total assets
        euint32 encryptedAnnualIncome; // Encrypted annual income
        euint32 encryptedRetirementAge; // Encrypted retirement age
        euint32 encryptedLifeExpectancy; // Encrypted life expectancy
        euint32 encryptedTargetIncome;  // Encrypted target retirement income
    }
    
    // Simulation results
    struct SimulationResult {
        euint32 encryptedStrategy;     // Encrypted optimal strategy ID
        euint32 encryptedWithdrawal;   // Encrypted recommended withdrawal
        euint32 encryptedSuccessRate;   // Encrypted success probability
        bool isSimulated;              // Simulation status
    }
    
    // Contract state
    mapping(address => EncryptedFinancialData) public userFinancialData;
    mapping(address => SimulationResult) public simulationResults;
    
    // Withdrawal strategies
    uint32 public constant FIXED_PERCENTAGE = 1;
    uint32 public constant INFLATION_ADJUSTED = 2;
    uint32 public constant DYNAMIC_SPENDING = 3;
    
    // Simulation parameters
    uint32 public constant SIMULATION_YEARS = 30;
    uint32 public constant DEFAULT_RETURN_RATE = 5; // 5% annual return
    
    // Events
    event FinancialDataSubmitted(address indexed user);
    event SimulationRequested(address indexed user);
    event SimulationCompleted(address indexed user);
    event StrategyDecrypted(address indexed user);
    
    modifier onlyDataOwner() {
        require(userFinancialData[msg.sender].encryptedAssets.isInitialized(), "No data submitted");
        _;
    }
    
    /// @notice Submit encrypted financial data
    function submitEncryptedData(
        euint32 encryptedAssets,
        euint32 encryptedAnnualIncome,
        euint32 encryptedRetirementAge,
        euint32 encryptedLifeExpectancy,
        euint32 encryptedTargetIncome
    ) public {
        userFinancialData[msg.sender] = EncryptedFinancialData({
            encryptedAssets: encryptedAssets,
            encryptedAnnualIncome: encryptedAnnualIncome,
            encryptedRetirementAge: encryptedRetirementAge,
            encryptedLifeExpectancy: encryptedLifeExpectancy,
            encryptedTargetIncome: encryptedTargetIncome
        });
        
        // Reset previous simulation
        simulationResults[msg.sender] = SimulationResult({
            encryptedStrategy: FHE.asEuint32(0),
            encryptedWithdrawal: FHE.asEuint32(0),
            encryptedSuccessRate: FHE.asEuint32(0),
            isSimulated: false
        });
        
        emit FinancialDataSubmitted(msg.sender);
    }
    
    /// @notice Request retirement simulation
    function requestRetirementSimulation() public onlyDataOwner {
        require(!simulationResults[msg.sender].isSimulated, "Simulation already completed");
        
        // Prepare encrypted data for simulation
        bytes32[] memory ciphertexts = new bytes32[](5);
        EncryptedFinancialData storage data = userFinancialData[msg.sender];
        
        ciphertexts[0] = FHE.toBytes32(data.encryptedAssets);
        ciphertexts[1] = FHE.toBytes32(data.encryptedAnnualIncome);
        ciphertexts[2] = FHE.toBytes32(data.encryptedRetirementAge);
        ciphertexts[3] = FHE.toBytes32(data.encryptedLifeExpectancy);
        ciphertexts[4] = FHE.toBytes32(data.encryptedTargetIncome);
        
        // Request simulation
        uint256 reqId = FHE.requestComputation(ciphertexts, this.runSimulation.selector);
        
        emit SimulationRequested(msg.sender);
    }
    
    /// @notice Callback for simulation results
    function runSimulation(
        uint256 requestId,
        bytes memory results,
        bytes memory proof
    ) public {
        // Verify computation proof
        FHE.checkSignatures(requestId, results, proof);
        
        // Process simulation results
        uint32[] memory simResults = abi.decode(results, (uint32[]));
        address user = msg.sender;
        
        simulationResults[user] = SimulationResult({
            encryptedStrategy: FHE.asEuint32(simResults[0]),
            encryptedWithdrawal: FHE.asEuint32(simResults[1]),
            encryptedSuccessRate: FHE.asEuint32(simResults[2]),
            isSimulated: true
        });
        
        emit SimulationCompleted(user);
    }
    
    /// @notice Request strategy decryption
    function requestStrategyDecryption() public onlyDataOwner {
        require(simulationResults[msg.sender].isSimulated, "Simulation not completed");
        
        // Prepare encrypted strategy for decryption
        bytes32[] memory ciphertexts = new bytes32[](1);
        ciphertexts[0] = FHE.toBytes32(simulationResults[msg.sender].encryptedStrategy);
        
        // Request decryption
        uint256 reqId = FHE.requestDecryption(ciphertexts, this.decryptStrategy.selector);
    }
    
    /// @notice Callback for decrypted strategy
    function decryptStrategy(
        uint256 requestId,
        bytes memory cleartexts,
        bytes memory proof
    ) public {
        // Verify decryption proof
        FHE.checkSignatures(requestId, cleartexts, proof);
        
        // Process decrypted strategy
        uint32 strategy = abi.decode(cleartexts, (uint32));
        
        emit StrategyDecrypted(msg.sender);
    }
    
    /// @notice Get recommended withdrawal amount (encrypted)
    function getEncryptedWithdrawal() public view onlyDataOwner returns (euint32) {
        return simulationResults[msg.sender].encryptedWithdrawal;
    }
    
    /// @notice Get success probability (encrypted)
    function getEncryptedSuccessRate() public view onlyDataOwner returns (euint32) {
        return simulationResults[msg.sender].encryptedSuccessRate;
    }
}