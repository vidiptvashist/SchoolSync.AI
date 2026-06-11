import os
import time
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")
genai.configure(api_key=api_key)
model = genai.GenerativeModel("models/gemini-2.5-flash")

try:
    print("Testing gemini-2.5-flash...")
    response = model.generate_content("Hello! Are you working?")
    print("Response:", response.text)
    print("SUCCESS!")
except Exception as e:
    print(f"ERROR: {e}")
