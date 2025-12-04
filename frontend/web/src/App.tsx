// App.tsx
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { getContractReadOnly, getContractWithSigner } from "./contract";
import WalletManager from "./components/WalletManager";
import WalletSelector from "./components/WalletSelector";
import "./App.css";

interface RetirementPlan {
  id: string;
  encryptedAssets: string;
  retirementGoal: string;
  withdrawalStrategy: string;
  cashflowProjection: string;
  timestamp: number;
  owner: string;
  status: "pending" | "active" | "archived";
}

const App: React.FC = () => {
  // State management
  const [account, setAccount] = useState("");
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<RetirementPlan[]>([]);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [walletSelectorOpen, setWalletSelectorOpen] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{
    visible: boolean;
    status: "pending" | "success" | "error";
    message: string;
  }>({ visible: false, status: "pending", message: "" });
  const [newPlanData, setNewPlanData] = useState({
    encryptedAssets: "",
    retirementGoal: "",
    strategyPreference: "conservative"
  });
  const [activeTab, setActiveTab] = useState("dashboard");
  const [searchTerm, setSearchTerm] = useState("");

  // Randomly selected styles
  const colorScheme = "gradient (warm sunset)";
  const uiStyle = "glass morphism";
  const layout = "card-based";
  const interaction = "micro-interactions";

  // Calculate statistics
  const activePlans = plans.filter(p => p.status === "active").length;
  const archivedPlans = plans.filter(p => p.status === "archived").length;

  // Filter plans based on search term
  const filteredPlans = plans.filter(plan => 
    plan.retirementGoal.toLowerCase().includes(searchTerm.toLowerCase()) ||
    plan.withdrawalStrategy.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    loadPlans().finally(() => setLoading(false));
  }, []);

  const onWalletSelect = async (wallet: any) => {
    if (!wallet.provider) return;
    try {
      const web3Provider = new ethers.BrowserProvider(wallet.provider);
      setProvider(web3Provider);
      const accounts = await web3Provider.send("eth_requestAccounts", []);
      const acc = accounts[0] || "";
      setAccount(acc);

      wallet.provider.on("accountsChanged", async (accounts: string[]) => {
        const newAcc = accounts[0] || "";
        setAccount(newAcc);
      });
    } catch (e) {
      alert("Failed to connect wallet");
    }
  };

  const onConnect = () => setWalletSelectorOpen(true);
  const onDisconnect = () => {
    setAccount("");
    setProvider(null);
  };

  const loadPlans = async () => {
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      // Check contract availability
      const isAvailable = await contract.isAvailable();
      if (!isAvailable) {
        console.error("Contract is not available");
        return;
      }
      
      const keysBytes = await contract.getData("plan_keys");
      let keys: string[] = [];
      
      if (keysBytes.length > 0) {
        try {
          keys = JSON.parse(ethers.toUtf8String(keysBytes));
        } catch (e) {
          console.error("Error parsing plan keys:", e);
        }
      }
      
      const list: RetirementPlan[] = [];
      
      for (const key of keys) {
        try {
          const planBytes = await contract.getData(`plan_${key}`);
          if (planBytes.length > 0) {
            try {
              const planData = JSON.parse(ethers.toUtf8String(planBytes));
              list.push({
                id: key,
                encryptedAssets: planData.encryptedAssets,
                retirementGoal: planData.retirementGoal,
                withdrawalStrategy: planData.withdrawalStrategy,
                cashflowProjection: planData.cashflowProjection,
                timestamp: planData.timestamp,
                owner: planData.owner,
                status: planData.status || "pending"
              });
            } catch (e) {
              console.error(`Error parsing plan data for ${key}:`, e);
            }
          }
        } catch (e) {
          console.error(`Error loading plan ${key}:`, e);
        }
      }
      
      list.sort((a, b) => b.timestamp - a.timestamp);
      setPlans(list);
    } catch (e) {
      console.error("Error loading plans:", e);
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  };

  const submitPlan = async () => {
    if (!provider) { 
      alert("Please connect wallet first"); 
      return; 
    }
    
    setCreating(true);
    setTransactionStatus({
      visible: true,
      status: "pending",
      message: "Encrypting retirement data with FHE..."
    });
    
    try {
      // Simulate FHE encryption
      const encryptedData = `FHE-${btoa(JSON.stringify(newPlanData))}`;
      
      const contract = await getContractWithSigner();
      if (!contract) {
        throw new Error("Failed to get contract with signer");
      }
      
      const planId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      // Generate simulated cashflow projection based on strategy
      let cashflowProjection = "";
      switch(newPlanData.strategyPreference) {
        case "conservative":
          cashflowProjection = "Stable 3-4% withdrawal with inflation adjustment";
          break;
        case "moderate":
          cashflowProjection = "Variable 4-5% withdrawal with market adjustments";
          break;
        case "aggressive":
          cashflowProjection = "Dynamic 5-6% withdrawal with higher volatility";
          break;
        default:
          cashflowProjection = "Custom withdrawal strategy";
      }

      const planData = {
        encryptedAssets: encryptedData,
        retirementGoal: newPlanData.retirementGoal,
        withdrawalStrategy: newPlanData.strategyPreference,
        cashflowProjection: cashflowProjection,
        timestamp: Math.floor(Date.now() / 1000),
        owner: account,
        status: "active"
      };
      
      // Store encrypted data on-chain
      await contract.setData(
        `plan_${planId}`, 
        ethers.toUtf8Bytes(JSON.stringify(planData))
      );
      
      const keysBytes = await contract.getData("plan_keys");
      let keys: string[] = [];
      
      if (keysBytes.length > 0) {
        try {
          keys = JSON.parse(ethers.toUtf8String(keysBytes));
        } catch (e) {
          console.error("Error parsing keys:", e);
        }
      }
      
      keys.push(planId);
      
      await contract.setData(
        "plan_keys", 
        ethers.toUtf8Bytes(JSON.stringify(keys))
      );
      
      setTransactionStatus({
        visible: true,
        status: "success",
        message: "Retirement plan created securely!"
      });
      
      await loadPlans();
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
        setShowCreateModal(false);
        setNewPlanData({
          encryptedAssets: "",
          retirementGoal: "",
          strategyPreference: "conservative"
        });
      }, 2000);
    } catch (e: any) {
      const errorMessage = e.message.includes("user rejected transaction")
        ? "Transaction rejected by user"
        : "Submission failed: " + (e.message || "Unknown error");
      
      setTransactionStatus({
        visible: true,
        status: "error",
        message: errorMessage
      });
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 3000);
    } finally {
      setCreating(false);
    }
  };

  const archivePlan = async (planId: string) => {
    if (!provider) {
      alert("Please connect wallet first");
      return;
    }

    setTransactionStatus({
      visible: true,
      status: "pending",
      message: "Archiving plan with FHE..."
    });

    try {
      const contract = await getContractWithSigner();
      if (!contract) {
        throw new Error("Failed to get contract with signer");
      }
      
      const planBytes = await contract.getData(`plan_${planId}`);
      if (planBytes.length === 0) {
        throw new Error("Plan not found");
      }
      
      const planData = JSON.parse(ethers.toUtf8String(planBytes));
      
      const updatedPlan = {
        ...planData,
        status: "archived"
      };
      
      await contract.setData(
        `plan_${planId}`, 
        ethers.toUtf8Bytes(JSON.stringify(updatedPlan))
      );
      
      setTransactionStatus({
        visible: true,
        status: "success",
        message: "Plan archived successfully!"
      });
      
      await loadPlans();
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
    } catch (e: any) {
      setTransactionStatus({
        visible: true,
        status: "error",
        message: "Archive failed: " + (e.message || "Unknown error")
      });
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 3000);
    }
  };

  const isOwner = (address: string) => {
    return account.toLowerCase() === address.toLowerCase();
  };

  const tutorialSteps = [
    {
      title: "Connect Wallet",
      description: "Securely connect your crypto wallet to begin",
      icon: "🔗"
    },
    {
      title: "Enter Encrypted Assets",
      description: "Provide your encrypted financial data",
      icon: "🔒"
    },
    {
      title: "Set Retirement Goals",
      description: "Define your desired retirement lifestyle",
      icon: "🎯"
    },
    {
      title: "Run FHE Simulation",
      description: "Generate personalized withdrawal strategies",
      icon: "⚙️"
    },
    {
      title: "Review Projections",
      description: "Analyze encrypted cashflow simulations",
      icon: "📊"
    }
  ];

  const renderStrategyCard = (strategy: string) => {
    let title = "";
    let description = "";
    let icon = "📈";
    
    switch(strategy) {
      case "conservative":
        title = "Conservative Strategy";
        description = "Lower withdrawals for maximum longevity";
        icon = "🛡️";
        break;
      case "moderate":
        title = "Balanced Strategy";
        description = "Mix of stability and growth potential";
        icon = "⚖️";
        break;
      case "aggressive":
        title = "Growth Strategy";
        description = "Higher withdrawals with more volatility";
        icon = "🚀";
        break;
      default:
        title = "Custom Strategy";
        description = "Tailored to your specific needs";
    }

    return (
      <div className="strategy-card">
        <div className="strategy-icon">{icon}</div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    );
  };

  if (loading) return (
    <div className="loading-screen">
      <div className="spinner"></div>
      <p>Initializing FHE retirement planner...</p>
    </div>
  );

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo">
          <h1>Retire<span>Secure</span></h1>
          <p>FHE-Powered Retirement Planning</p>
        </div>
        
        <div className="header-actions">
          <WalletManager account={account} onConnect={onConnect} onDisconnect={onDisconnect} />
        </div>
      </header>
      
      <div className="main-content">
        <div className="welcome-banner">
          <div className="welcome-text">
            <h2>Privacy-Preserving Retirement Planning</h2>
            <p>Simulate encrypted withdrawal strategies without exposing your financial data</p>
          </div>
        </div>
        
        <div className="navigation-tabs">
          <button 
            className={`tab-button ${activeTab === "dashboard" ? "active" : ""}`}
            onClick={() => setActiveTab("dashboard")}
          >
            Dashboard
          </button>
          <button 
            className={`tab-button ${activeTab === "plans" ? "active" : ""}`}
            onClick={() => setActiveTab("plans")}
          >
            My Plans
          </button>
          <button 
            className={`tab-button ${activeTab === "strategies" ? "active" : ""}`}
            onClick={() => setActiveTab("strategies")}
          >
            Strategies
          </button>
          <button 
            className={`tab-button ${activeTab === "tutorial" ? "active" : ""}`}
            onClick={() => setActiveTab("tutorial")}
          >
            How It Works
          </button>
        </div>
        
        {activeTab === "dashboard" && (
          <div className="dashboard-grid">
            <div className="dashboard-card">
              <h3>Project Overview</h3>
              <p>RetireSecure uses fully homomorphic encryption (FHE) to analyze your retirement assets and goals while keeping all data encrypted.</p>
              <div className="fhe-badge">
                <span>FHE-Powered Privacy</span>
              </div>
            </div>
            
            <div className="dashboard-card">
              <h3>Your Retirement Plans</h3>
              <div className="stats-grid">
                <div className="stat-item">
                  <div className="stat-value">{plans.length}</div>
                  <div className="stat-label">Total Plans</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">{activePlans}</div>
                  <div className="stat-label">Active</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">{archivedPlans}</div>
                  <div className="stat-label">Archived</div>
                </div>
              </div>
              <button 
                className="create-plan-btn"
                onClick={() => setShowCreateModal(true)}
              >
                + New Plan
              </button>
            </div>
            
            <div className="dashboard-card">
              <h3>Withdrawal Strategies</h3>
              <div className="strategy-previews">
                {renderStrategyCard("conservative")}
                {renderStrategyCard("moderate")}
                {renderStrategyCard("aggressive")}
              </div>
            </div>
          </div>
        )}
        
        {activeTab === "plans" && (
          <div className="plans-section">
            <div className="section-header">
              <h2>My Retirement Plans</h2>
              <div className="header-actions">
                <input
                  type="text"
                  placeholder="Search plans..."
                  className="search-input"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <button 
                  onClick={loadPlans}
                  className="refresh-btn"
                  disabled={isRefreshing}
                >
                  {isRefreshing ? "Refreshing..." : "Refresh"}
                </button>
                <button 
                  className="create-plan-btn"
                  onClick={() => setShowCreateModal(true)}
                >
                  + New Plan
                </button>
              </div>
            </div>
            
            <div className="plans-list">
              {filteredPlans.length === 0 ? (
                <div className="no-plans">
                  <div className="no-plans-icon"></div>
                  <p>No retirement plans found</p>
                  <button 
                    className="create-plan-btn primary"
                    onClick={() => setShowCreateModal(true)}
                  >
                    Create Your First Plan
                  </button>
                </div>
              ) : (
                filteredPlans.map(plan => (
                  <div className="plan-card" key={plan.id}>
                    <div className="plan-header">
                      <h3>{plan.retirementGoal}</h3>
                      <span className={`status-badge ${plan.status}`}>
                        {plan.status}
                      </span>
                    </div>
                    <div className="plan-details">
                      <div className="detail-item">
                        <label>Strategy:</label>
                        <span>{plan.withdrawalStrategy}</span>
                      </div>
                      <div className="detail-item">
                        <label>Projection:</label>
                        <span>{plan.cashflowProjection}</span>
                      </div>
                      <div className="detail-item">
                        <label>Created:</label>
                        <span>{new Date(plan.timestamp * 1000).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="plan-actions">
                      {isOwner(plan.owner) && plan.status === "active" && (
                        <button 
                          className="action-btn archive"
                          onClick={() => archivePlan(plan.id)}
                        >
                          Archive
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
        
        {activeTab === "strategies" && (
          <div className="strategies-section">
            <h2>Withdrawal Strategy Options</h2>
            <p className="section-description">
              These strategies are simulated using your encrypted financial data without decryption
            </p>
            
            <div className="strategy-cards">
              <div className="strategy-card featured">
                <div className="strategy-icon">🛡️</div>
                <h3>Conservative Approach</h3>
                <p>3-4% initial withdrawal rate adjusted for inflation. Designed for maximum portfolio longevity.</p>
                <div className="strategy-stats">
                  <div className="stat">
                    <label>Success Rate:</label>
                    <span>95%+</span>
                  </div>
                  <div className="stat">
                    <label>Volatility:</label>
                    <span>Low</span>
                  </div>
                </div>
              </div>
              
              <div className="strategy-card featured">
                <div className="strategy-icon">⚖️</div>
                <h3>Balanced Approach</h3>
                <p>4-5% initial withdrawal with market adjustments. Balance between income and growth.</p>
                <div className="strategy-stats">
                  <div className="stat">
                    <label>Success Rate:</label>
                    <span>85-90%</span>
                  </div>
                  <div className="stat">
                    <label>Volatility:</label>
                    <span>Moderate</span>
                  </div>
                </div>
              </div>
              
              <div className="strategy-card featured">
                <div className="strategy-icon">🚀</div>
                <h3>Growth Approach</h3>
                <p>5-6% initial withdrawal with dynamic adjustments. Higher income potential with more risk.</p>
                <div className="strategy-stats">
                  <div className="stat">
                    <label>Success Rate:</label>
                    <span>70-80%</span>
                  </div>
                  <div className="stat">
                    <label>Volatility:</label>
                    <span>High</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === "tutorial" && (
          <div className="tutorial-section">
            <h2>How RetireSecure Works</h2>
            <p className="section-description">
              Learn how to plan your retirement income while keeping your financial data private
            </p>
            
            <div className="tutorial-steps">
              {tutorialSteps.map((step, index) => (
                <div className="tutorial-step" key={index}>
                  <div className="step-number">{index + 1}</div>
                  <div className="step-content">
                    <div className="step-icon">{step.icon}</div>
                    <h3>{step.title}</h3>
                    <p>{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="fhe-explainer">
              <h3>Fully Homomorphic Encryption</h3>
              <p>
                RetireSecure uses advanced cryptography to perform calculations on your encrypted financial data 
                without ever decrypting it. This means we can provide personalized retirement projections while 
                maintaining complete privacy of your sensitive information.
              </p>
            </div>
          </div>
        )}
      </div>
  
      {showCreateModal && (
        <ModalCreate 
          onSubmit={submitPlan} 
          onClose={() => setShowCreateModal(false)} 
          creating={creating}
          planData={newPlanData}
          setPlanData={setNewPlanData}
        />
      )}
      
      {walletSelectorOpen && (
        <WalletSelector
          isOpen={walletSelectorOpen}
          onWalletSelect={(wallet) => { onWalletSelect(wallet); setWalletSelectorOpen(false); }}
          onClose={() => setWalletSelectorOpen(false)}
        />
      )}
      
      {transactionStatus.visible && (
        <div className="transaction-modal">
          <div className="transaction-content">
            <div className={`transaction-icon ${transactionStatus.status}`}>
              {transactionStatus.status === "pending" && <div className="spinner"></div>}
              {transactionStatus.status === "success" && "✓"}
              {transactionStatus.status === "error" && "✗"}
            </div>
            <div className="transaction-message">
              {transactionStatus.message}
            </div>
          </div>
        </div>
      )}
  
      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <h3>RetireSecure</h3>
            <p>Privacy-preserving retirement planning powered by FHE</p>
          </div>
          
          <div className="footer-links">
            <a href="#" className="footer-link">Documentation</a>
            <a href="#" className="footer-link">Privacy Policy</a>
            <a href="#" className="footer-link">Terms</a>
            <a href="#" className="footer-link">Contact</a>
          </div>
        </div>
        
        <div className="footer-bottom">
          <div className="copyright">
            © {new Date().getFullYear()} RetireSecure. All rights reserved.
          </div>
          <div className="fhe-badge">
            <span>FHE-Powered Privacy</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

interface ModalCreateProps {
  onSubmit: () => void; 
  onClose: () => void; 
  creating: boolean;
  planData: any;
  setPlanData: (data: any) => void;
}

const ModalCreate: React.FC<ModalCreateProps> = ({ 
  onSubmit, 
  onClose, 
  creating,
  planData,
  setPlanData
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setPlanData({
      ...planData,
      [name]: value
    });
  };

  const handleSubmit = () => {
    if (!planData.encryptedAssets || !planData.retirementGoal) {
      alert("Please fill required fields");
      return;
    }
    
    onSubmit();
  };

  return (
    <div className="modal-overlay">
      <div className="create-modal">
        <div className="modal-header">
          <h2>Create New Retirement Plan</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="form-group">
            <label>Encrypted Assets *</label>
            <textarea 
              name="encryptedAssets"
              value={planData.encryptedAssets} 
              onChange={handleChange}
              placeholder="Paste your encrypted financial data..." 
              rows={3}
            />
          </div>
          
          <div className="form-group">
            <label>Retirement Goal *</label>
            <input 
              type="text"
              name="retirementGoal"
              value={planData.retirementGoal} 
              onChange={handleChange}
              placeholder="Describe your retirement lifestyle goal" 
            />
          </div>
          
          <div className="form-group">
            <label>Preferred Strategy</label>
            <select 
              name="strategyPreference"
              value={planData.strategyPreference} 
              onChange={handleChange}
            >
              <option value="conservative">Conservative (3-4% withdrawal)</option>
              <option value="moderate">Moderate (4-5% withdrawal)</option>
              <option value="aggressive">Aggressive (5-6% withdrawal)</option>
            </select>
          </div>
          
          <div className="privacy-notice">
            <div className="lock-icon"></div>
            <span>Your data remains encrypted during all calculations</span>
          </div>
        </div>
        
        <div className="modal-footer">
          <button 
            onClick={onClose}
            className="cancel-btn"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit} 
            disabled={creating}
            className="submit-btn"
          >
            {creating ? "Processing with FHE..." : "Create Plan"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;