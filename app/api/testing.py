import dotenv
dotenv.load_dotenv()

from utils.db import list_conversations

conversations = list_conversations()

print(len(list(conversations)))