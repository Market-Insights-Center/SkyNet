try:
    import sklearn
    print("sklearn imported")
    from backend.integration import mlforecast_command
    print("mlforecast_command imported")
except ImportError as e:
    print(f"Import failed: {e}")
except Exception as e:
    print(f"Error: {e}")
