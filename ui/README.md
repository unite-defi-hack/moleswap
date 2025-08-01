This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Wallet Connection Setup

This application supports both TON and Ethereum (Sepolia) wallet connections.

### Ethereum Wallet Connection

For the best experience with Ethereum wallet connection, you can optionally set up WalletConnect:

1. Go to [WalletConnect Cloud](https://cloud.walletconnect.com/)
2. Create a new project and get your Project ID
3. Create a `.env.local` file in the root directory with:
   ```
   NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your_project_id_here
   ```

Without the WalletConnect project ID, the Ethereum connection will still work with injected wallets (MetaMask, etc.) but won't support WalletConnect mobile wallets.

### TON Wallet Connection

The TON wallet connection is configured to use the TON Connect manifest. The manifest URL is set in the providers configuration.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
