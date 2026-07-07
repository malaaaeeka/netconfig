# NetConfig AI

> AI-powered network configuration assistant that converts natural language to Cisco IOS commands — powered by Fireworks AI on AMD GPUs.

## What It Does

Network engineers spend hours writing Cisco IOS commands manually. NetConfig AI lets you describe what you want in plain English and instantly generates production-ready configuration commands — which can be deployed directly to real or simulated routers with one click.

**Example:**
> "Configure OSPF with network 192.168.1.0/24 in area 0"

Generates:
```bash
router ospf 1
network 192.168.1.0 0.0.0.255 area 0
end
```

## Features

- Natural language to Cisco IOS command generation
- Network diagram upload — upload a topology image and get commands
- One-click deployment to real Cisco routers via SSH
- GNS3 simulator support for testing without real hardware
- Chat history saved to Firebase
- Firebase authentication
- Powered by Fireworks AI running on AMD GPUs

## Architecture

React Frontend → Flask Backend → Fireworks AI (AMD GPUs) → Cisco Router / GNS3

## Quick Start

### Prerequisites
- Docker Desktop
- Fireworks AI API key

### Run with Docker

```bash
git clone https://github.com/malaaaeeka/netconfig
cd netconfig
cp ai-chatbot-backend/.env.example ai-chatbot-backend/.env
# Add your FIREWORKS_API_KEY to .env
docker-compose up
```

Open `http://localhost:5173`

### Run Manually

**Backend:**
```bash
cd ai-chatbot-backend
pip install -r requirements.txt
py app.py
```

**Frontend:**
```bash
cd ai-network-chatbot
npm install
npm run dev
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React, Vite, Firebase Auth |
| Backend | Flask, Python |
| AI Inference | Fireworks AI (AMD GPUs) |
| Model | GPT-OSS 120B |
| Router Deployment | Netmiko, SSH |
| Storage | Firebase Firestore, Cloudinary |
| Simulation | GNS3 |

## Supported Protocols

- Routing: OSPF, EIGRP, BGP, RIP, Static Routes
- Switching: VLANs, Trunking, VTP, STP, Port Security
- Security: Standard ACL, Extended ACL, Named ACL
- NAT: Static NAT, Dynamic NAT, PAT
- Redundancy: HSRP, VRRP

## Built For

AMD Developer Hackathon: ACT II — Track 3 (Unicorn Track)

## Team

- Malaika Khalid
- Omama Khalid

Abdul Wali Khan University Mardan