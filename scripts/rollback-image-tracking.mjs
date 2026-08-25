const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TRACK_PATH = "/api/lb-phone/view-image";

if (!supabaseUrl || !serviceKey) {
  throw new Error("Image rollback requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
}

const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
};

function unwrapTracked(value) {
  let current = String(value || "").trim();
  if (!current) return "";
  for (let i = 0; i < 8; i++) {
    try {
      const url = new URL(current, "https://streatscope.vercel.app");
      if (url.pathname !== TRACK_PATH) break;
      const source = url.searchParams.get("src") || "";
      if (!source || source === current) break;
      current = source;
    } catch {
      break;
    }
  }
  return current;
}

async function read(path, optional = false) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, { headers, cache: "no-store" });
  if (!response.ok) {
    if (optional) return [];
    throw new Error(`Rollback lookup failed: ${path} -> ${response.status} ${await response.text()}`);
  }
  return response.json();
}

async function patch(table, id, fields) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      ...headers,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(fields),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Rollback update failed: ${table}#${id} -> ${response.status} ${await response.text()}`);
}

const [articles, features, guide, notifications] = await Promise.all([
  read("articles?select=id,image_url,social_image&limit=5000"),
  read("street_features?select=id,image_url&limit=5000"),
  read("guide_places?select=id,image_url&limit=5000"),
  read("phone_notifications?select=id,thumbnail&limit=5000", true),
]);

let restored = 0;

for (const row of articles) {
  const fields = {};
  const image = unwrapTracked(row.image_url);
  const social = unwrapTracked(row.social_image);
  if (row.image_url && image && image !== row.image_url) fields.image_url = image;
  if (row.social_image && social && social !== row.social_image) fields.social_image = social;
  if (Object.keys(fields).length) {
    await patch("articles", row.id, fields);
    restored++;
  }
}

for (const row of features) {
  const image = unwrapTracked(row.image_url);
  if (row.image_url && image && image !== row.image_url) {
    await patch("street_features", row.id, { image_url: image });
    restored++;
  }
}

for (const row of guide) {
  const image = unwrapTracked(row.image_url);
  if (row.image_url && image && image !== row.image_url) {
    await patch("guide_places", row.id, { image_url: image });
    restored++;
  }
}

for (const row of notifications) {
  const thumbnail = unwrapTracked(row.thumbnail);
  if (row.thumbnail && thumbnail && thumbnail !== row.thumbnail) {
    await patch("phone_notifications", row.id, { thumbnail });
    restored++;
  }
}

console.log(`[StreetScope] image tracking rollback restored ${restored} rows`);
