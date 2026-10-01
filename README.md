# Driver Moral Simulator

This repository contains two separate browser tools:

- Participant task: `http://localhost:3000`
- Operator marker dashboard: `http://localhost:3000/split-or-steal`

The participant task does not link to the operator dashboard. Operators should
open `/split-or-steal` directly in a separate browser tab or window when they
need manual protocol markers.

## Standardized participant run

Every participant receives the same scenario sequence. The canonical order is
defined in `data/runOrder.js` as scenario IDs 1 through 20, and the app consumes
`ORDERED_SCENARIOS` instead of shuffling or sampling from the scenario bank.

Difficulty increases in four fixed blocks of five rounds:

- Rounds 1-5: baseline count tradeoffs
- Rounds 6-10: legality and age variables
- Rounds 11-15: roles and pets with tighter counts
- Rounds 16-20: maximum dilemma cases

## EmotivPRO serial markers

The game now uses one timing path for both the participant task and the operator
dashboard:

```text
browser event
  -> localhost WebSocket
  -> Python marker bridge
       -> one configured raw uint8 serial byte -> EmotivPRO
       -> optional rich string label -> LSL
       -> append-and-flush audit CSV
  <- ACK/NACK with code, write timing, and error state
```

The browser never opens the serial device. `python/marker_bridge.py` owns it,
serializes writes from every tab, and checks that each hardware write accepted
exactly one byte. It sends binary `bytes((code,))`: not ASCII digits and not a
line ending.

### Install and inspect

Python 3.11 or newer is required.

```bash
python3 -m venv python/.venv
source python/.venv/bin/activate            # Windows: python\.venv\Scripts\activate
python3 -m pip install -r python/requirements.txt

python3 python/marker_bridge.py --print-codebook
python3 python/marker_bridge.py --list-serial-ports
python3 -m unittest discover -s python/tests -v
```

Marker routes live only in `python/config/markers.yaml`. Serial framing, flow
control, port defaults, and failure policy live in `python/config/serial.yaml`.
Both effective configurations are snapshotted beside each bridge audit CSV.

The initial codebook is a lab decision and should be frozen before collecting
research data:

| Byte or range | Browser source | Event group |
| ---: | --- | --- |
| 1-2 | driver game | session start/end |
| 10 | operator dashboard | explicit serial test |
| 20-21 | driver game | trial start/end |
| 40 | driver game | scenario onset |
| 60-62 | driver game | left/right/timeout choice |
| 80 | driver game | outcome shown |
| 100-109 | operator dashboard | session, consent, survey, equipment, baseline |
| 110-115 | operator dashboard | Split-or-Steal rules and prompts |
| 116-119 | operator dashboard | trolley rules and task start/end |
| 120-126 | operator dashboard | equipment removal, post-survey, debrief, session end |
| 130-133 | operator dashboard | round start by opponent condition |
| 134-149 | operator dashboard | round, actor, and split/steal choice combinations |
| 150-153 | operator dashboard | outcome shown by opponent condition |
| 154-157 | operator dashboard | round end by opponent condition |
| 160-165 | operator dashboard | serial-sevens start/end by placement |
| 170-172 | operator dashboard | signal adjustment, pause, and resume |

Every marker-producing dashboard control has a serial assignment. Use
`python3 python/marker_bridge.py --print-codebook` for the exact byte-to-name
table. Source-scoped routing keeps the dashboard's session codes `100` and
`126` distinct from the participant game's session codes `1` and `2`.

### Simulation before connecting EmotivPRO

This exercises browser routing, ACKs, code selection, CSV durability, and the
full 102-event participant run without claiming that hardware received bytes:

```bash
source python/.venv/bin/activate
python3 python/marker_bridge.py --serial-simulate --disable-lsl
```

In another terminal:

```bash
npm run dev
```

Open `http://localhost:3000/split-or-steal`, click **Send test marker**, a
protocol milestone, and several round controls. Confirm each ACK shows its
configured code with result `simulated`; no supported dashboard action should
show `unmapped`. Audit files are written under `python/sessions/` and flushed
after every event. A complete 20-trial driver run contains 102 events: session
bookends plus five events per trial.

### Real paired-port test with EmotivPRO

On one computer, the bridge and EmotivPRO need the opposite ends of a paired
virtual/null-modem serial connection. A physical serial pair also works. Do not
give both programs the same endpoint; only one process can own a port.

1. Create or attach the pair and note its **sender** and **receiver** names.
2. In EmotivPRO, add a serial marker source using the receiver endpoint.
3. Set both sides to `115200` baud, `8` data bits, parity `N`, `1` stop bit,
   and no software/hardware flow control.
4. Start an EmotivPRO recording and arm the serial marker source.
5. Start the bridge on the sender endpoint, replacing the example path:

   ```bash
   source python/.venv/bin/activate
   python3 python/marker_bridge.py \
     --serial-port /dev/cu.YOUR-SENDER-END \
     --disable-lsl
   ```

   Windows example: `--serial-port COM5`. Linux example:
   `--serial-port /dev/ttyUSB0`.

6. Start the web app, open `http://localhost:3000/split-or-steal`, and click
   **Send test marker** several times. The UI must show code `10`, result
   `written`, and `bytes_written: 1` in the bridge ACK/log. Then send a
   protocol milestone and a round choice and confirm their configured codes
   are also `written` with one byte.
7. Confirm the markers appear in EmotivPRO during recording/playback, then
   export a short recording and verify the integer sequence in the exported
   marker channel.

For the serial validation run, leave the bridge's LSL output disabled and do
not arm the LSL marker inlet in EmotivPRO. Otherwise the same logical event can
appear twice and obscure which transport worked. After serial is verified, LSL
can be re-enabled by omitting `--disable-lsl` if the study intentionally needs
both outputs.

The dashboard deliberately distinguishes these states:

- `simulated`: routing worked, but no byte left the bridge;
- `written`: the operating system accepted exactly one byte;
- `failed`: the write raised an error or was short;
- `unmapped`: an unknown or malformed event has no serial code;
- EmotivPRO verified: only manual observation and/or the exported recording can
  establish this. The bridge never claims it automatically.

### Acquisition safeguards and logs

- The participant **Start run** button is blocked until the protocol-v2 bridge
  reports serial hardware or simulation ready. Set
  `NEXT_PUBLIC_REQUIRE_SERIAL=false` only for intentional LSL-only work.
- Disconnected events are rejected, not buffered and replayed with a false late
  timestamp.
- Every received event, including unmapped events and failed serial writes, is
  appended immediately to `python/sessions/bridge_*_markers.csv`.
- `bridge_*_markers_metadata.json` records the effective codebook, serial
  settings, start/end status, and counters.
- A green serial state proves the sender endpoint opened. A `written` ACK proves
  one OS write. Neither proves EmotivPRO stored the byte.

For intentional standalone play with no EEG marker bridge, launch Next.js with
`NEXT_PUBLIC_LSL_ENABLED=false`. The variable name is retained for compatibility
but now disables all bridge outputs, including serial.

### Optional LSL cross-check

When the bridge is started without `--disable-lsl`, EmotivPRO can discover the
rich string outlet `SplitOrStealProtocolMarkers`. The independent LSL-only
listener remains available:

```bash
python3 python/session_logger.py
```

It writes `python/sessions/session_<UTC timestamp>.csv` and can monitor live EEG
with `--monitor-eeg`; it does not prove that serial markers were received.

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
