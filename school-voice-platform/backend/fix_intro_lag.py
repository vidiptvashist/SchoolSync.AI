import re

with open("voice_agent/agent.py", "r") as f:
    content = f.read()

# Add a 1.2 second sleep before the intro message
replacement = """    logger.info(f"Voice agent session started for {school_name}")
    
    # Sleep to allow SIP RTP to stabilize before speaking
    import asyncio
    await asyncio.sleep(1.2)
    
    welcome_text = f"Hello, welcome to {school_name}. How can I help you today?"""

content = content.replace(
    '    logger.info(f"Voice agent session started for {school_name}")\n    welcome_text = f"Hello, welcome to {school_name}. How can I help you today?"',
    replacement
)

with open("voice_agent/agent.py", "w") as f:
    f.write(content)

print("Fixed agent.py intro lag")
