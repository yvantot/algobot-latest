export async function sealDataset(dataset) {
  const sessions = structuredClone(dataset.sessions);
  const manifest = await Promise.all(sessions.map(async session => {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(session)));
    return { session_id: session.session_id,
      sha256: Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("") };
  }));
  return { ...dataset, sessions, artifact_type: "algobot_dataset", export_id: crypto.randomUUID(),
    integrity: { algorithm: "SHA-256", encoding: "JSON.stringify(session), UTF-8", sessions: manifest } };
}
