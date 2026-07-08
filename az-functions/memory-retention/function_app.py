import azure.functions as func
from memory_retention_bp import bp

app = func.FunctionApp(http_auth_level=func.AuthLevel.FUNCTION)
app.register_functions(bp)
