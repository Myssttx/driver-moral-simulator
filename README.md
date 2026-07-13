This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Split-or-Steal LSL dashboard

The protocol marker dashboard is available at:

```bash
http://localhost:3000/split-or-steal
```

For EmotivPRO recordings, start the local LSL bridge before the session:

```bash
python3 -m pip install -r python/requirements.txt
python3 python/marker_bridge.py
```

EmotivPRO should discover the marker outlet named `SplitOrStealProtocolMarkers`.
The dashboard sends pipe-delimited string markers for consent, surveys,
equipment setup, baseline, every Split-or-Steal round event, serial sevens,
trolley task boundaries, equipment removal, post-survey, debrief, and session
bookends. Use the dashboard CSV export as the operator-side marker log.

To also get an independent, portable marker log (in case the dashboard export
isn't available, or as a cross-check), run the session logger alongside the
bridge. It detects every marker on the `SplitOrStealProtocolMarkers` stream in
real time and writes it, with its LSL timestamp, to CSV — it never records
raw EEG (EmotivPRO stays the authoritative recorder for that):

```bash
python3 python/session_logger.py
# writes to python/sessions/session_<UTC timestamp>.csv by default
```

It fails loudly (no CSV written) if the marker bridge isn't already running.
Add `--monitor-eeg` to also print live per-channel min/max sanity stats
from the EEG LSL stream (never saved to disk) — useful to confirm the
headset is actually streaming before starting a real session. Run
`python3 python/session_logger.py --help` for all options.

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

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
