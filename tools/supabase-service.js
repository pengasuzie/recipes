const URL = "https://fmqsttxwgstzhjwfnxnk.supabase.co";

async function service(route, options = {}, fetcher = fetch) {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY is required");
  const response = await fetcher(URL + route, {
    ...options,
    headers: {
      apikey: key,
      Authorization: "Bearer " + key,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!response.ok) throw new Error(`Supabase ${response.status} (${route.split("?")[0]})`);
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

module.exports = { service, URL };
