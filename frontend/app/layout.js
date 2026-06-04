import './globals.css';

export const metadata = {
  title: 'AXIOM Humanoid — Konnex Builder Program',
  description: 'Live humanoid robot control infrastructure on Konnex Subnet. VLA execution, 16-DOF joint telemetry, real onchain PoPW.',
  openGraph: {
    title: 'AXIOM Humanoid Control Subnet',
    description: 'Real VLA-driven humanoid execution with onchain Proof of Physical Work on Konnex.',
    type: 'website',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/* Firebase */}
        <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js" />
        <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js" />
      </head>
      <body>
        {/* Polkadot API — ESM */}
        <script type="module" dangerouslySetInnerHTML={{ __html: `
          import { ApiPromise, WsProvider } from 'https://cdn.jsdelivr.net/npm/@polkadot/api@16.5.6/+esm';
          window.PolkadotApiPromise  = ApiPromise;
          window.PolkadotWsProvider  = WsProvider;
          window.__polkadotApiLoaded = true;
        `}} />
        {children}
      </body>
    </html>
  );
}
