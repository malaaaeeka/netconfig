

from flask import Flask, request, jsonify
from flask_cors import CORS
from ssh_handler import execute_commands
import requests
import os
import base64
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

# ─── Fireworks AI Config ────────────────────────────────────────────────────
FIREWORKS_API_KEY = os.environ.get("FIREWORKS_API_KEY", "")
FIREWORKS_API_URL = "https://api.fireworks.ai/inference/v1/chat/completions"

# Vision-capable model on Fireworks / AMD hardware
# Update this model string on July 6th once AMD reveals the official models
FIREWORKS_MODEL = FIREWORKS_MODEL = "accounts/fireworks/models/gpt-oss-120b"

SYSTEM_PROMPT = """You are an expert Cisco IOS network engineer with 20 years of experience.

STRICT RULES:
- Output ONLY Cisco IOS commands, nothing else
- Never add explanations unless user specifically asks "explain"
- Use correct IOS indentation for sub-commands
- Always end configuration blocks with "end"
- Use "!" to separate different config sections
- If query is unclear, ask ONE clarifying question only

OUTPUT FORMAT - ALWAYS wrap commands in triple backticks like this:
```
! Configure OSPF
router ospf 1
 network 192.168.1.0 0.0.0.255 area 0
 network 10.0.0.0 0.0.0.255 area 0
end
```

NEVER show commands as plain text. ALWAYS use the triple backtick code block format.

SUPPORTED PROTOCOLS:
- Routing: OSPF, EIGRP, BGP, RIP, Static Routes
- Switching: VLANs, Trunking, VTP, STP, Port Security
- Security: Standard ACL, Extended ACL, Named ACL
- NAT: Static NAT, Dynamic NAT, PAT
- Redundancy: HSRP, VRRP
- General: Interface config, Hostname, Banner, Show commands"""


# ─── Chat Route (replaces Gemini) ──────────────────────────────────────────
@app.route('/api/chat', methods=['POST'])
def chat():
    print("=== CHAT ROUTE HIT ===")
    data = request.json
    print("Data:", data)
    message = data.get('message', '')
    history = data.get('history', [])
    image_base64 = data.get('image_base64', None)

    if not message:
        print("ERROR: no message")
        return jsonify({'error': 'No message provided'}), 400

    if not FIREWORKS_API_KEY:
        print("ERROR: no API key")
        return jsonify({'error': 'Fireworks API key not configured'}), 500
    
    print("KEY OK:", FIREWORKS_API_KEY[:5])

    # Build the user message content
    if image_base64:
        # Vision: send image + text together
        user_content = [
            {
                "type": "image_url",
                "image_url": {
                    "url": f"data:image/jpeg;base64,{image_base64}"
                }
            },
            {
                "type": "text",
                "text": (
                    "The user uploaded a network diagram. "
                    "Analyze it and generate appropriate Cisco IOS commands.\n\n"
                    f"User request: {message}"
                )
            }
        ]
    else:
        user_content = message

    # Build messages array: system + history + new user message
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages += history  # history should be [{role, content}, ...]
    messages.append({"role": "user", "content": user_content})

    try:
        response = requests.post(
            FIREWORKS_API_URL,
            headers={
                "Authorization": f"Bearer {FIREWORKS_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": FIREWORKS_MODEL,
                "messages": messages,
                "max_tokens": 1000,
                "temperature": 0.1
            },
            timeout=30
        )

        result = response.json()

        if response.status_code != 200:
            return jsonify({'error': result.get('error', 'Fireworks API error')}), response.status_code

        reply = result['choices'][0]['message']['content']
        return jsonify({'reply': reply})

    except requests.exceptions.Timeout:
        return jsonify({'error': 'Request timed out'}), 504
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─── Deploy Route (unchanged) ───────────────────────────────────────────────
@app.route('/api/deploy', methods=['POST'])
def deploy():
    data = request.json
    host = data.get('host')
    username = data.get('username')
    password = data.get('password')
    commands = data.get('commands')
    use_gns3 = data.get('use_gns3', False)

    if not commands:
        return jsonify({'error': 'No commands provided'}), 400
    if not use_gns3 and not all([host, username, password]):
        return jsonify({'error': 'Missing required fields'}), 400

    result = execute_commands(host, username, password, commands, use_gns3=use_gns3)
    return jsonify(result)


# ─── Ping Route (unchanged) ─────────────────────────────────────────────────
@app.route('/api/ping', methods=['POST'])
def ping():
    import subprocess
    host = request.json.get('host')
    response = subprocess.run(['ping', '-c', '2', host], capture_output=True)
    reachable = response.returncode == 0
    return jsonify({'reachable': reachable, 'host': host})


if __name__ == '__main__':
    app.run(debug=True, port=5002)