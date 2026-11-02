// Queue helper for the recipe worker. Raw requests are written to an ignored directory.
const fs = require("node:fs");
const path = require("node:path");
const { service } = require("./supabase-service");

async function run(args, api = service) {
  const [command, id, argument, ...rest] = args;
  const resultNote = rest.join(" ");
  const rpc = (name, body) => api(`/rest/v1/rpc/${name}`, {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (command === "list") {
    return api("/rest/v1/recipe_requests?state=eq.waiting&select=id,url,note,created_at&order=created_at&limit=100");
  }

  if (command === "claim") {
    if (!id || !argument) throw new Error("claim requires a request UUID and output directory");
    const rows = await rpc("claim_recipe_request", { request_id: id });
    if (!rows.length) throw new Error("Request already claimed");
    fs.mkdirSync(argument, { recursive: true });
    const request = rows[0];
    fs.writeFileSync(path.join(argument, "request.json"), JSON.stringify(request, null, 2) + "\n", { mode: 0o600 });
    return { id: request.id, state: request.state, files: argument };
  }

  if (command === "ready" || command === "failed") {
    if (!id) throw new Error(`${command} requires a request.json path`);
    const request = JSON.parse(fs.readFileSync(id, "utf8"));
    if (command === "ready" && !argument) throw new Error("ready requires a recipe slug");
    if (command === "ready" && !/^[a-z0-9-]+$/.test(argument)) throw new Error("Invalid recipe slug");
    return rpc("finish_recipe_request", {
      request_id: request.id,
      token: request.claim_token,
      result_slug: command === "ready" ? argument : null,
      new_note: command === "ready" ? resultNote : (argument || "Could not complete this request."),
    });
  }

  if (command === "retry") {
    if (!id) throw new Error("retry requires a request UUID");
    return rpc("retry_recipe_request", { request_id: id });
  }

  throw new Error("Usage: list | claim <uuid> <requests-work/dir> | ready <request.json> <slug> [note] | failed <request.json> <reason> | retry <uuid>");
}

if (require.main === module) {
  run(process.argv.slice(2))
    .then(result => console.log(JSON.stringify(result)))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}

module.exports = { run };
