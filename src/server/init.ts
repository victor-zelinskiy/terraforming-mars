// The server's `.env` (see .env.sample), when there is one — Node's own loader (it throws on an absent file).
try {
  process.loadEnvFile();
} catch {
  // no .env: the environment is the process's
}
