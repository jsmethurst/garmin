// Shared helpers: one persistent Vercel Sandbox ("ciq-builder") that holds Garmin's Connect IQ SDK,
// the fenix 6X Pro device files and a signing key. Set up once, reused for every build.
import { Sandbox } from '@vercel/sandbox';

export const NAME = 'ciq-builder';
export const DEVICE = 'fenix6xpro';
export const ROOT = '/vercel/sandbox/ciq'; // default working directory of SDK-created sandboxes (writable)

export async function getBox({ create = false } = {}) {
  if (!create) return Sandbox.get({ name: NAME, resume: true });
  return Sandbox.getOrCreate({
    name: NAME,
    persistent: true,
    snapshotExpiration: 0, // never expire: devices are slow to re-download and need a Garmin login
    timeout: 5 * 60 * 1000,
    resources: { vcpus: 4 },
    resume: true,
  });
}

export async function sh(box, script, env = {}, sudo = false) {
  const r = await box.runCommand({ cmd: 'bash', args: ['-lc', script], env, sudo });
  return { code: r.exitCode, out: await r.stdout(), err: await r.stderr() };
}

export function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

export async function readBody(req, limit = 4 * 1024 * 1024) {
  const chunks = []; let n = 0;
  for await (const c of req) { n += c.length; if (n > limit) throw new Error('Request too large'); chunks.push(c); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

// Is the toolchain in the sandbox complete?
export const CHECK = `test -x ${ROOT}/sdk/bin/monkeyc && test -f ${ROOT}/key.der && ls $HOME/.Garmin/ConnectIQ/Devices/${DEVICE}/compiler.json >/dev/null 2>&1 && command -v java >/dev/null`;

// One-time (idempotent) setup, in two steps: system packages (root), then the Garmin toolchain (user).
export const SETUP_ROOT = `
set -e
if ! command -v java >/dev/null; then
  if command -v dnf >/dev/null; then dnf install -y -q java-17-amazon-corretto-headless unzip tar gzip
  else apt-get update -qq && apt-get install -y -qq openjdk-17-jre-headless unzip curl; fi
fi
mkdir -p ${ROOT} && chmod -R a+rwX ${ROOT}
`;

// Garmin only gives device files to a logged-in Garmin account.
export const SETUP = `
set -e
mkdir -p ${ROOT} && cd ${ROOT}
if [ ! -x sdk/bin/monkeyc ]; then
  curl -fsS -m 60 -o sdks.json https://developer.garmin.com/downloads/connect-iq/sdks/sdks.json
  F=$(node -e "const j=require('./sdks.json');console.log(j[j.length-1].linux)")
  curl -fsS -m 600 -o sdk.zip "https://developer.garmin.com/downloads/connect-iq/sdks/$F"
  rm -rf sdk && mkdir sdk && unzip -q sdk.zip -d sdk && rm sdk.zip
fi
if [ ! -x sm/connect-iq-sdk-manager ]; then
  mkdir -p sm
  curl -fsSL -m 120 https://github.com/lindell/connect-iq-sdk-manager-cli/releases/download/v0.8.4/connect-iq-sdk-manager-cli_0.8.4_Linux_x86_64.tar.gz | tar xz -C sm
fi
export PATH=${ROOT}/sm:$PATH
if [ "$GARMIN_SDK_AGREEMENT" = "accept" ]; then connect-iq-sdk-manager agreement accept; fi
connect-iq-sdk-manager login
connect-iq-sdk-manager device download -d ${DEVICE}
if [ ! -f key.der ]; then
  openssl genrsa -out key.pem 4096 2>/dev/null
  openssl pkcs8 -topk8 -inform PEM -outform DER -in key.pem -out key.der -nocrypt
fi
`;
