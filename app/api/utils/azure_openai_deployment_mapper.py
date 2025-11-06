import os

__ALL__ = ["map_model_to_deployment"]

DEFAULT_DEPLOYMENT_NAME = os.getenv("DEFAULT_DEPLOYMENT_NAME", "gpt-4")
GPT40_DEPLOYMENT_NAME = os.getenv("GPT40_DEPLOYMENT_NAME", "gpt-4")


def map_model_to_deployment(model: str) -> str:
    """
    Map a given OpenAI model name to the corresponding Azure OpenAI deployment name.
    """
    mapping = {
        "gpt-4o": GPT40_DEPLOYMENT_NAME,
    }
    return mapping.get(model, DEFAULT_DEPLOYMENT_NAME)
