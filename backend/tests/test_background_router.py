import sys
from unittest.mock import MagicMock 

# --- MOCKING SETUP START ---
# We must mock everything that 'background.py' might touch via imports
# specifically 'backend.integration' and all its submodules.

mock_integration = MagicMock()
sys.modules["backend.integration"] = mock_integration
sys.modules["integration"] = mock_integration

# Mock specific submodules explicitly to ensure they are found
mock_prom_core = MagicMock()
sys.modules["backend.integration.prometheus_core"] = mock_prom_core
sys.modules["integration.prometheus_core"] = mock_prom_core

mock_kronos = MagicMock()
sys.modules["backend.integration.kronos_command"] = mock_kronos
sys.modules["integration.kronos_command"] = mock_kronos

# Mock other commands imported inside get_prometheus_instance
for mod in ["risk_command", "derivative_command", "mlforecast_command", 
            "sentiment_command", "fundamentals_command", "quickscore_command", "briefing_command"]:
    sys.modules[f"backend.integration.{mod}"] = MagicMock()
    sys.modules[f"integration.{mod}"] = MagicMock()

# Mock Prometheus Class Structure
mock_prom_instance = MagicMock()
mock_prom_instance.is_active = False
mock_prom_instance.gemini_model = "MockModel"
mock_prom_instance._load_prometheus_state.return_value = True

# When Prometheus() is instantiated in the router, return our mock instance
mock_prom_core.Prometheus.return_value = mock_prom_instance

# Mock Kronos Schedule
mock_kronos._load_schedule.return_value = [{"job": "mock_job", "next_run": "2029-01-01"}]

# --- MOCKING SETUP END ---

# NOW import the router
from fastapi.testclient import TestClient
from fastapi import FastAPI
from backend.routers.background import router

# Setup minimal app
app = FastAPI()
app.include_router(router)
client = TestClient(app)

def test_status_endpoint():
    # Act
    response = client.get("/api/background/status")
    
    # Assert
    assert response.status_code == 200
    data = response.json()
    assert data["active"] is True
    assert data["schedule"][0]["job"] == "mock_job"
    # Ensure it tried to load state
    mock_prom_instance._load_prometheus_state.assert_called()

def test_toggle_endpoint():
    # Act - disable
    response = client.post("/api/background/toggle", json={"active": False})
    
    # Assert
    assert response.status_code == 200
    assert response.json()["active"] is False
    assert mock_prom_instance.is_active is False
    mock_prom_instance._save_prometheus_state.assert_called()

def test_run_command_optimize():
    # Reset
    mock_kronos._handle_kronos_optimize.reset_mock()
    
    payload = {
        "command": "optimize",
        "params": {
            "strategy": "rsi", 
            "ticker": "SPY", 
            "period": "1y",
            "generations": 5,
            "population": 10
        }
    }
    
    response = client.post("/api/background/run", json=payload)
    assert response.status_code == 200
    mock_kronos._handle_kronos_optimize.assert_called_once()
    
    # Check args
    call_args = mock_kronos._handle_kronos_optimize.call_args
    parts = call_args[0][0] # First arg is list of parts
    assert parts == ["optimize", "rsi", "SPY", "1y", "5", "10"]

def test_run_command_convergence():
    mock_kronos._handle_kronos_convergence.reset_mock()
    
    payload = {
        "command": "convergence",
        "params": {
            "run_name": "Test1",
            "universes": "A,B",
            "conditions": "Bull",
            "strategies": "Strat1"
        }
    }
    
    response = client.post("/api/background/run", json=payload)
    assert response.status_code == 200
    mock_kronos._handle_kronos_convergence.assert_called_once()
    
    call_args = mock_kronos._handle_kronos_convergence.call_args
    parts = call_args[0][0]
    # Expected: ["convergence", "Test1", "--universes=A,B", "--conditions=Bull", "--strategies=Strat1"]
    assert parts[1] == "Test1"
    assert "--universes=A,B" in parts

def test_run_command_test_mode():
    mock_kronos._handle_kronos_test.reset_mock()
    
    payload = {
        "command": "test",
        "params": {
            "file": "foo.py",
            "ticker": "SPY",
            "period": "1y",
            "mode": "auto"
        }
    }
    
    response = client.post("/api/background/run", json=payload)
    assert response.status_code == 200
    mock_kronos._handle_kronos_test.assert_called_once()
    parts = mock_kronos._handle_kronos_test.call_args[0][0]
    assert parts == ["test", "foo.py", "SPY", "1y", "auto"]
