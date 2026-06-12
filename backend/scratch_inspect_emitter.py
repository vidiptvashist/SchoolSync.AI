import os
import sys
import inspect
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
load_dotenv()

from livekit.agents import tts

print("Is AudioEmitter.push a coroutine?")
print(inspect.iscoroutinefunction(tts.AudioEmitter.push))
print("\nIs AudioEmitter.initialize a coroutine?")
print(inspect.iscoroutinefunction(tts.AudioEmitter.initialize))
