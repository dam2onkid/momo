# Momo - Aptos Trading Bot

A Telegram bot built with GrammY for AI-assisted trading on Aptos.

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
- Add your bot token to `.env`:
  ```
  BOT_TOKEN=your_bot_token_here
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
