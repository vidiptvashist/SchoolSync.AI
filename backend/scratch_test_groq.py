import os
from dotenv import load_dotenv

load_dotenv()

try:
    import groq
    print("Groq package is installed!")
    client = groq.Groq(api_key=os.getenv("GROQ_API_KEY"))
    res = client.chat.completions.create(
        model="llama3-8b-8192",
        messages=[{"role": "user", "content": "Hello!"}]
    )
    print("Response:", res.choices[0].message.content)
except Exception as e:
    print("Error with Groq library:", e)

try:
    from openai import AsyncOpenAI
    print("OpenAI client also available.")
except Exception as e:
    print("Error with OpenAI library:", e)
