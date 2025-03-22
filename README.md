# Momo - AI Trading Bot for Aptos Blockchain

Momo is an AI-powered Telegram bot designed for trading on the Aptos blockchain. It combines language AI capabilities with blockchain interactions to provide an intelligent trading assistant.

## Technologies Used

- **Node.js** - JavaScript runtime environment
- **GrammY** - Telegram Bot Framework for Node.js
- **Aptos Blockchain** - Blockchain platform with Move language
  - `@aptos-labs/ts-sdk` - TypeScript SDK for Aptos
  - `move-agent-kit` - Toolkit for Move language interactions
- **AI & Language Models**
  - `langchain` - Framework for LLM application development
  - `@langchain/core` - Core components for LangChain
  - `@langchain/langgraph` - Graph-based workflows for LangChain
  - `@langchain/openai` - OpenAI integration for LangChain
- **Database**
  - `@supabase/supabase-js` - Supabase JavaScript client
- **Utilities**
  - `axios` - HTTP client for API requests
  - `dotenv` - Environment variable management
  - `lodash` - Utility library

## Project Structure

```
momo/
├── src/
│   ├── controllers/ - Bot command handlers
│   ├── models/ - Data models
│   ├── config/ - Configuration files
│   ├── tools/ - Utility tools
│   ├── utils/ - Helper functions
│   └── index.js - Main bot application
├── .env - Environment variables
└── package.json - Project dependencies
```

## Setup

1. Clone the repository

```bash
git clone <repository-url>
cd momo
```

2. Install dependencies

```bash
npm install
```

3. Configure environment variables

- Copy `.env.example` to `.env`
- Get your bot token from [@BotFather](https://t.me/BotFather)
- Add required API keys and tokens to `.env`:

  ```
  # Telegram Bot Token (Get it from @BotFather)
  BOT_TOKEN=your_bot_token_here

  # Supabase Configuration
  SUPABASE_URL=your_supabase_url
  SUPABASE_ANON_KEY=your_supabase_anon_key

  # AI Configuration
  OPENROUTER_API_KEY=your_openrouter_api_key
  XAI_API_KEY=your_xai_api_key

  # Aptos Configuration
  APTOS_PRIVATE_KEY=your_aptos_private_key
  APTOS_NETWORK=testnet

  # Encryption Key (for secure data storage)
  ENCRYPTION_KEY=your_encryption_key
  ```

## Running the Bot

Development mode (with auto-reload):

```bash
npm run dev
```

Production mode:

```bash
npm start
```

## Features

- Welcome message on /start command
- Echo responses for text messages
- Error handling
- More features coming soon...

## License

ISC
