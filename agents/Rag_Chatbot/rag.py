import json

with open("knowledge_base_new.json","r") as f:
    kb = json.load(f)

print(len(kb))